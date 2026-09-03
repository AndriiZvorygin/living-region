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
        CANVASSING_LOGIN_URL: "https://canvassing.example.test/canvass",
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

  it("provides a candidate-only lawn-sign worklist from canonical canvassing data", async () => {
    const andrii = await login("andrii");
    const state = await apiRequest("/api/canvassing/state", andrii.cookie);
    const household = state.data.households.find((home: any) => home.status === "untouched");
    expect(household).toBeTruthy();

    const recorded = await apiRequest("/api/canvassing/visits", andrii.cookie, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        submission_key: "admin-lawn-sign-worklist-test",
        household_id: household.household_id,
        outcome: "lawn_sign_interest",
        flyer_delivered: false,
        conversation_occurred: true,
      }),
    });
    expect(recorded.response.status).toBe(201);

    const contact = await apiRequest(
      `/api/canvassing/households/${encodeURIComponent(household.household_id)}/contacts`,
      andrii.cookie,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Lawn Sign Test", email: "sign@example.test" }),
      },
    );
    expect(contact.response.status).toBe(201);

    const list = await apiRequest("/api/admin/lawn-signs", andrii.cookie);
    expect(list.response.status).toBe(200);
    expect(list.data.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          household_id: household.household_id,
          address_label: household.label,
          contact_name: "Lawn Sign Test",
          contact_email: "sign@example.test",
          approval_count: 1,
          latest_recorded_by: "Andrii",
        }),
      ]),
    );

    const search = await apiRequest(
      `/api/admin/lawn-signs?q=${encodeURIComponent(String(household.label))}`,
      andrii.cookie,
    );
    expect(search.response.status).toBe(200);
    expect(search.data.households).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ household_id: household.household_id }),
      ]),
    );

    const rynaldo = await login("rynaldo");
    expect((await apiRequest("/api/admin/lawn-signs", rynaldo.cookie)).response.status).toBe(403);
    expect((await apiRequest("/api/admin/lawn-signs")).response.status).toBe(401);
  });

  it("records supplied sign details and a private signature for linked and manual approvals", async () => {
    const andrii = await login("andrii");
    const state = await apiRequest("/api/canvassing/state", andrii.cookie);
    const household = state.data.households.find((home: any) => home.status === "untouched");
    expect(household).toBeTruthy();
    const signature = {
      media_type: "image/png",
      filename: "signed-consent.png",
      data_base64: Buffer.from("test-signature").toString("base64"),
    };
    const linkedInput = {
      submission_key: "admin-lawn-sign-linked-details-test",
      household_id: household.household_id,
      name: "Provided Resident",
      address: "169 2nd Avenue West",
      phone: "519-555-0100",
      email: "resident@example.test",
      signature,
    };
    const linked = await apiRequest("/api/admin/lawn-signs", andrii.cookie, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(linkedInput),
    });
    expect(linked.response.status).toBe(201);
    expect(linked.data).toMatchObject({
      household_id: household.household_id,
      name: "Provided Resident",
      address: "169 2nd Avenue West",
      signature: { uploaded: true, media_type: "image/png" },
    });

    const duplicate = await apiRequest("/api/admin/lawn-signs", andrii.cookie, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(linkedInput),
    });
    expect(duplicate.response.status).toBe(200);
    expect(duplicate.data).toMatchObject({ duplicate: true, approval_id: linked.data.approval_id });

    const manual = await apiRequest("/api/admin/lawn-signs", andrii.cookie, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        submission_key: "admin-lawn-sign-manual-details-test",
        name: "Manual Resident",
        address: "999 Test Street, Owen Sound",
        signature: { ...signature, filename: "manual-consent.png" },
      }),
    });
    expect(manual.response.status).toBe(201);
    expect(manual.data.household_id).toBeNull();

    const stored = database<
      Array<{
        household_id: string | null;
        visit_id: string | null;
        provided_name: string;
        provided_address: string;
        signature_data_base64: string;
      }>
    >(
      "SELECT household_id,visit_id,provided_name,provided_address,signature_data_base64 FROM lawn_sign_approvals WHERE id IN (?,?) ORDER BY provided_name",
      linked.data.approval_id,
      manual.data.approval_id,
    );
    expect(stored).toHaveLength(2);
    expect(stored[0]).toMatchObject({
      provided_name: "Manual Resident",
      provided_address: "999 Test Street, Owen Sound",
      household_id: null,
      visit_id: null,
    });
    expect(stored[1]).toMatchObject({
      provided_name: "Provided Resident",
      provided_address: "169 2nd Avenue West",
      household_id: household.household_id,
      visit_id: linked.data.visit_id,
      signature_data_base64: signature.data_base64,
    });

    const list = await apiRequest("/api/admin/lawn-signs", andrii.cookie);
    expect(list.data.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          approval_id: linked.data.approval_id,
          address_label: "169 2nd Avenue West",
          signature_uploaded: true,
        }),
        expect.objectContaining({
          approval_id: manual.data.approval_id,
          household_id: null,
          address_label: "999 Test Street, Owen Sound",
          signature_uploaded: true,
        }),
      ]),
    );
    const signatureResponse = await fetch(
      `${api}/api/admin/lawn-signs/${manual.data.approval_id}/signature`,
      { headers: { cookie: andrii.cookie } },
    );
    expect(signatureResponse.status).toBe(200);
    expect(signatureResponse.headers.get("content-type")).toContain("image/png");
    expect(Buffer.from(await signatureResponse.arrayBuffer()).toString()).toBe("test-signature");

    // The linked approval deliberately exercises the canonical visit path.
    // Correct that fixture visit before the following stats test so this
    // sequential server remains isolated without deleting history.
    const undone = await apiRequest("/api/canvassing/undo-latest", andrii.cookie, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "test fixture cleanup" }),
    });
    expect(undone.response.status).toBe(201);
  });

  it("requires a signature and keeps signature access candidate-only", async () => {
    const andrii = await login("andrii");
    const missing = await apiRequest("/api/admin/lawn-signs", andrii.cookie, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        submission_key: "admin-lawn-sign-missing-signature-test",
        name: "No Signature",
        address: "1 Test Street",
      }),
    });
    expect(missing.response.status).toBe(400);
    expect(missing.data.error).toMatch(/signature/i);
    const rynaldo = await login("rynaldo");
    expect(
      (
        await apiRequest(
          "/api/admin/lawn-signs/manual/signature",
          rynaldo.cookie,
        )
      ).response.status,
    ).toBe(403);
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
      subject: "Your Andrii for Mayor canvassing login",
      reply_to: "andrii@example.test",
    });
    expect(mail.text).toContain("Username: new-volunteer");
    expect(mail.text).toContain(`Password: ${created.data.temporary_password}`);
    expect(mail.text).toContain("Canvassing app: https://canvassing.example.test/canvass");
    expect(mail.text).toContain("https://helpos.ca/vol");
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
    expect(andriiRow.visits).toBe(2);
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
