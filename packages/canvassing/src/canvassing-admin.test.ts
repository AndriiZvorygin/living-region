import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateTemporaryPassword } from "./auth";

describe.sequential("canvassing admin user management", () => {
  const port = 46_000 + (process.pid % 1_000);
  const api = `http://127.0.0.1:${port}`;
  const password = "canvassing-test-password";
  let directory = "";
  let server: ChildProcess;

  async function startServer(extra: Record<string, string> = {}) {
    server = spawn("node_modules/.bin/tsx", ["packages/canvassing/src/server.ts"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CANVASS_HOST: "127.0.0.1",
        CANVASS_PORT: String(port),
        CANVASS_DB: join(directory, "canvassing.sqlite"),
        CANVASS_EVENT_LOG: join(directory, "events.jsonl"),
        CANVASS_CALIBRATION_EXPORT: join(directory, "address-number-calibration.json"),
        CANVASS_SPLIT_CALIBRATION_EXPORT: join(directory, "structure-split-calibration.json"),
        CANVASS_TEST_USERS: "1",
        CANVASS_TEST_PASSWORD: password,
        CANVASSING_ADMIN_EMAIL: "andrii@example.test",
        CANVASSING_FROM_EMAIL: "canvassing@example.test",
        CANVASSING_REPLY_TO_EMAIL: "andrii@example.test",
        CANVASSING_TEST_MAIL_FILE: join(directory, "mail.jsonl"),
        CANVASSING_BASE_URL: "https://canvassing.example.test",
        ...extra,
      },
      stdio: "ignore",
    });
    for (let attempt = 0; attempt < 120; attempt++) {
      try {
        if ((await fetch(`${api}/api/canvassing/health`)).ok) return;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("Disposable admin server did not start");
  }

  async function login(username: string, suppliedPassword = password) {
    const response = await fetch(`${api}/api/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password: suppliedPassword }),
    });
    const data = await response.json();
    return {
      response,
      data,
      cookie: response.headers.get("set-cookie")?.split(";", 1)[0] ?? "",
    };
  }

  async function apiRequest(path: string, cookie = "", init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (cookie) headers.set("cookie", cookie);
    const response = await fetch(`${api}${path}`, { ...init, headers });
    return { response, data: await response.json().catch(() => ({})) };
  }

  function database<T = any>(sql: string, ...parameters: string[]) {
    const script = `
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(${JSON.stringify(join(directory, "canvassing.sqlite"))}, { readOnly: true });
      console.log(JSON.stringify(db.prepare(${JSON.stringify(sql)}).all(...${JSON.stringify(parameters)})));
      db.close();
    `;
    return JSON.parse(execFileSync(process.execPath, ["-e", script], { encoding: "utf8" })) as T;
  }

  async function mailRows() {
    const text = await readFile(join(directory, "mail.jsonl"), "utf8").catch(() => "");
    return text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }

  async function createUser(
    cookie: string,
    input: Record<string, unknown> = {},
  ) {
    return apiRequest("/api/admin/users", cookie, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        display_name: "Test Volunteer",
        username: `test-volunteer-${Date.now()}`,
        role: "volunteer",
        delivery: "admin",
        ...input,
      }),
    });
  }

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "living-region-canvassing-admin-"));
    await startServer();
  }, 60_000);

  afterAll(async () => {
    if (server && server.exitCode == null) {
      server.kill("SIGTERM");
      await new Promise<void>((resolve) => server.once("exit", () => resolve()));
    }
    await rm(directory, { recursive: true, force: true });
  });

  it("enforces candidate-only user administration", async () => {
    const andrii = await login("andrii");
    const rynaldo = await login("rynaldo");
    expect((await apiRequest("/api/admin/users", andrii.cookie)).response.status).toBe(200);
    expect((await apiRequest("/api/admin/users", rynaldo.cookie)).response.status).toBe(403);
    expect(
      (
        await apiRequest("/api/admin/users", rynaldo.cookie, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ display_name: "Nope", username: "nope" }),
        })
      ).response.status,
    ).toBe(403);
    expect(
      (await apiRequest("/api/admin/users/andrii/password", rynaldo.cookie, { method: "POST" }))
        .response.status,
    ).toBe(403);
    expect((await apiRequest("/api/admin/users")).response.status).toBe(401);
  });

  it("generates readable passwords with sufficient random material", () => {
    const generated = new Set(Array.from({ length: 32 }, () => generateTemporaryPassword()));
    expect(generated.size).toBe(32);
    for (const value of generated) {
      expect(value).toMatch(/^[A-HJ-NP-Zabcdefghijkmnopqrstuvwxyz23456789]{5}(?:-[A-HJ-NP-Zabcdefghijkmnopqrstuvwxyz23456789]{5}){3}$/);
      expect(value.replaceAll("-", "")).toHaveLength(20);
    }
  });

  it("creates a user with a one-time generated password and admin-forward email", async () => {
    const andrii = await login("andrii");
    const created = await createUser(andrii.cookie, {
      display_name: "New Volunteer",
      username: "new-volunteer",
      email: "new.volunteer@example.test",
    });
    expect(created.response.status).toBe(201);
    expect(created.data.user).toMatchObject({
      username: "new-volunteer",
      role: "volunteer",
      email: "new.volunteer@example.test",
    });
    expect(created.data.user).not.toHaveProperty("password_hash");
    expect(created.data.temporary_password).toMatch(/^[A-Za-z2-9-]+$/);
    expect(created.data.temporary_password.replaceAll("-", "")).toHaveLength(20);

    const stored = database<Array<{ password_hash: string; email: string }>>(
      "SELECT password_hash,email FROM users WHERE username=?",
      "new-volunteer",
    )[0];
    expect(stored.email).toBe("new.volunteer@example.test");
    expect(stored.password_hash).toContain("argon2id");
    expect(stored.password_hash).not.toContain(created.data.temporary_password);
    expect(JSON.stringify(stored)).not.toContain(created.data.temporary_password);

    const duplicate = await createUser(andrii.cookie, {
      display_name: "Duplicate",
      username: "new-volunteer",
    });
    expect(duplicate.response.status).toBe(409);

    const volunteer = await login("new-volunteer", created.data.temporary_password);
    expect(volunteer.response.status).toBe(200);
    const mail = (await mailRows()).at(-1);
    expect(mail).toMatchObject({
      to: "andrii@example.test",
      subject: "Owen Sound canvassing account for New Volunteer",
      reply_to: "andrii@example.test",
    });
    expect(mail.text).toContain("Username: new-volunteer");
    expect(mail.text).toContain(`Password: ${created.data.temporary_password}`);
    expect(mail.text).toContain("https://canvassing.example.test/canvassing/");
    const journal = await readFile(join(directory, "events.jsonl"), "utf8");
    expect(journal).not.toContain(created.data.temporary_password);
  });

  it("supports direct volunteer delivery, editable profile fields, and canonical stats", async () => {
    const andrii = await login("andrii");
    const created = await createUser(andrii.cookie, {
      display_name: "Direct Volunteer",
      username: "direct-volunteer",
      email: "direct.volunteer@example.test",
      delivery: "volunteer",
    });
    expect(created.response.status).toBe(201);
    expect((await mailRows()).at(-1)).toMatchObject({ to: "direct.volunteer@example.test" });

    const updated = await apiRequest("/api/admin/users/direct-volunteer", andrii.cookie, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        display_name: "Direct Volunteer Updated",
        email: "updated.volunteer@example.test",
        role: "volunteer",
        active: true,
      }),
    });
    expect(updated.response.status).toBe(200);
    expect(updated.data.user).toMatchObject({
      display_name: "Direct Volunteer Updated",
      email: "updated.volunteer@example.test",
    });

    const rynaldo = await login("rynaldo");
    const state = await apiRequest("/api/canvassing/state", rynaldo.cookie);
    const untouched = state.data.households.filter((home: any) => home.status === "untouched");
    expect(untouched.length).toBeGreaterThan(4);
    const first = untouched[0].household_id;
    const second = untouched[1].household_id;
    const third = untouched[2].household_id;
    const fourth = untouched[3].household_id;
    const deliver = (cookie: string, key: string, householdId: string) =>
      apiRequest("/api/canvassing/visits", cookie, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          submission_key: key,
          household_id: householdId,
          outcome: "flyer_delivered",
          flyer_delivered: true,
          flyer_id: "flyer-2-current",
        }),
      });
    expect((await deliver(rynaldo.cookie, "stats-rynaldo-effective", first)).response.status).toBe(201);
    expect((await deliver(andrii.cookie, "stats-andrii-effective", second)).response.status).toBe(201);
    expect((await deliver(rynaldo.cookie, "stats-rynaldo-corrected", third)).response.status).toBe(201);
    const undoneVisit = await apiRequest("/api/canvassing/visits", rynaldo.cookie, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        submission_key: "stats-rynaldo-undone-visit",
        household_id: fourth,
        outcome: "knocked_no_answer",
        door_knocked: true,
        flyer_delivered: false,
      }),
    });
    expect(undoneVisit.response.status).toBe(201);
    const undo = await apiRequest("/api/canvassing/undo-latest", rynaldo.cookie, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(undo.response.status).toBe(201);
    const corrected = await apiRequest(
      `/api/canvassing/households/${third}/flyer-status`,
      rynaldo.cookie,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ flyer_delivered: false, reason: "stats correction" }),
      },
    );
    expect(corrected.response.status).toBe(201);

    const users = (await apiRequest("/api/admin/users", andrii.cookie)).data.users as any[];
    const rynaldoRow = users.find((row) => row.username === "rynaldo");
    const andriiRow = users.find((row) => row.username === "andrii");
    expect(rynaldoRow).toMatchObject({ current_flagship_flyers: 1, total_flyer_deliveries: 1 });
    expect(andriiRow).toMatchObject({ current_flagship_flyers: 1, total_flyer_deliveries: 1 });
    expect(rynaldoRow.visits).toBe(2);
    expect(andriiRow.visits).toBe(1);
  });

  it("resets passwords, invalidates old sessions, and records no password contents", async () => {
    const andrii = await login("andrii");
    const created = await createUser(andrii.cookie, {
      display_name: "Reset Volunteer",
      username: "reset-volunteer",
      email: "reset.volunteer@example.test",
    });
    const oldPassword = created.data.temporary_password;
    const oldLogin = await login("reset-volunteer", oldPassword);
    expect(oldLogin.response.status).toBe(200);
    const reset = await apiRequest("/api/admin/users/reset-volunteer/password", andrii.cookie, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ delivery: "admin" }),
    });
    expect(reset.response.status).toBe(200);
    expect(reset.data.temporary_password).not.toBe(oldPassword);
    expect((await login("reset-volunteer", oldPassword)).response.status).toBe(401);
    expect((await login("reset-volunteer", reset.data.temporary_password)).response.status).toBe(200);
    expect((await apiRequest("/api/canvassing/state", oldLogin.cookie)).response.status).toBe(401);
    const journal = await readFile(join(directory, "events.jsonl"), "utf8");
    expect(journal).not.toContain(oldPassword);
    expect(journal).not.toContain(reset.data.temporary_password);
    const audit = database<Array<{ detail_json: string }>>(
      "SELECT detail_json FROM audit_events WHERE entity_id=? OR user_id=?",
      "reset-volunteer",
      "andrii",
    );
    expect(audit.every((row) => !row.detail_json.includes(oldPassword))).toBe(true);
    expect(audit.every((row) => !row.detail_json.includes(reset.data.temporary_password))).toBe(true);
  });

  it("allows a user to change their own password without forcing it", async () => {
    const rynaldo = await login("rynaldo");
    const changed = await apiRequest("/api/me/password", rynaldo.cookie, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        current_password: password,
        new_password: "a deliberately long volunteer passphrase",
        confirm_password: "a deliberately long volunteer passphrase",
      }),
    });
    expect(changed.response.status).toBe(200);
    expect((await login("rynaldo", password)).response.status).toBe(401);
    expect((await login("rynaldo", "a deliberately long volunteer passphrase")).response.status).toBe(200);
  });
});

describe.sequential("canvassing admin mail failure", () => {
  const port = 47_000 + (process.pid % 1_000);
  const api = `http://127.0.0.1:${port}`;
  const password = "canvassing-test-password";
  let directory = "";
  let server: ChildProcess;

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "living-region-canvassing-admin-mail-failure-"));
    server = spawn("node_modules/.bin/tsx", ["packages/canvassing/src/server.ts"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CANVASS_HOST: "127.0.0.1",
        CANVASS_PORT: String(port),
        CANVASS_DB: join(directory, "canvassing.sqlite"),
        CANVASS_EVENT_LOG: join(directory, "events.jsonl"),
        CANVASS_CALIBRATION_EXPORT: join(directory, "address-number-calibration.json"),
        CANVASS_SPLIT_CALIBRATION_EXPORT: join(directory, "structure-split-calibration.json"),
        CANVASS_TEST_USERS: "1",
        CANVASS_TEST_PASSWORD: password,
        CANVASSING_ADMIN_EMAIL: "andrii@example.test",
        CANVASSING_FROM_EMAIL: "canvassing@example.test",
        CANVASSING_TEST_MAIL_FAIL: "1",
      },
      stdio: "ignore",
    });
    for (let attempt = 0; attempt < 120; attempt++) {
      try {
        if ((await fetch(`${api}/api/canvassing/health`)).ok) return;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("Disposable mail-failure server did not start");
  }, 60_000);

  afterAll(async () => {
    if (server && server.exitCode == null) {
      server.kill("SIGTERM");
      await new Promise<void>((resolve) => server.once("exit", () => resolve()));
    }
    await rm(directory, { recursive: true, force: true });
  });

  it("keeps the account and exposes the password once when delivery fails", async () => {
    const loginResponse = await fetch(`${api}/api/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "andrii", password }),
    });
    const cookie = loginResponse.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
    const response = await fetch(`${api}/api/admin/users`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        display_name: "Mail Failure Volunteer",
        username: "mail-failure-volunteer",
        delivery: "admin",
      }),
    });
    const data = await response.json();
    expect(response.status).toBe(201);
    expect(data.delivery.status).toBe("failed");
    expect((await fetch(`${api}/api/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "mail-failure-volunteer", password: data.temporary_password }),
    })).status).toBe(200);
  });
});
