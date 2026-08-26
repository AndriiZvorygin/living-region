import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe.sequential("canvassing authenticated multi-user workflow", () => {
  const port = 44_000 + (process.pid % 1_000);
  const api = `http://127.0.0.1:${port}`;
  const password = "canvassing-test-password";
  let directory = "";
  let server: ChildProcess;

  async function startServer() {
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
      },
      stdio: "ignore",
    });
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        if ((await fetch(`${api}/api/canvassing/health`)).ok) return;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("Disposable authenticated canvassing server did not start");
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

  async function apiRequest(
    path: string,
    cookie = "",
    init: RequestInit = {},
  ) {
    const headers = new Headers(init.headers);
    if (cookie) headers.set("cookie", cookie);
    const response = await fetch(`${api}${path}`, { ...init, headers });
    return { response, data: await response.json() };
  }

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "living-region-canvassing-auth-"));
    await startServer();
  }, 60_000);

  afterAll(async () => {
    if (server && server.exitCode == null) {
      server.kill("SIGTERM");
      await new Promise<void>((resolve) => server.once("exit", () => resolve()));
    }
    await rm(directory, { recursive: true, force: true });
  });

  it("requires authenticated sessions and rejects invalid credentials", async () => {
    const unauthenticated = await apiRequest("/api/canvassing/state");
    expect(unauthenticated.response.status).toBe(401);
    const incorrect = await login("andrii", "wrong-password");
    expect(incorrect.response.status).toBe(401);
    const andrii = await login("andrii");
    expect(andrii.response.status).toBe(200);
    expect(andrii.data.user).toMatchObject({ username: "andrii", role: "candidate" });
    const me = await apiRequest("/api/me", andrii.cookie);
    expect(me.response.status).toBe(200);
    expect(me.data.user.id).toBe("andrii");
  });

  it("uses authenticated actors for the shared two-user field workflow", async () => {
    const andrii = await login("andrii");
    const rynaldo = await login("rynaldo");
    const volunteerState = await apiRequest("/api/canvassing/state", rynaldo.cookie);
    const candidateState = await apiRequest("/api/canvassing/state", andrii.cookie);
    expect(volunteerState.response.status).toBe(200);
    expect(candidateState.response.status).toBe(200);
    expect(volunteerState.data.recruitment_areas).toEqual([]);
    expect(volunteerState.data.followup_samples).toEqual([]);
    const privateImport = await apiRequest("/api/canvassing/import.csv", rynaldo.cookie, {
      method: "POST",
      headers: { "content-type": "text/csv" },
      body: "",
    });
    expect(privateImport.response.status).toBe(403);
    const privateOutcome = await apiRequest("/api/canvassing/visits", rynaldo.cookie, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        submission_key: "volunteer-private-outcome",
        household_id: "not-used",
        outcome: "supportive",
        flyer_delivered: false,
      }),
    });
    expect(privateOutcome.response.status).toBe(403);
    const household = volunteerState.data.households.find(
      (home: any) => home.status === "untouched",
    );
    const secondHousehold = candidateState.data.households.find(
      (home: any) => home.status === "untouched" && home.household_id !== household.household_id,
    );
    expect(household).toBeTruthy();
    expect(secondHousehold).toBeTruthy();

    const volunteerNext = await apiRequest("/api/canvassing/next-area", rynaldo.cookie);
    const candidateNext = await apiRequest("/api/canvassing/next-area", andrii.cookie);
    expect(volunteerNext.response.status).toBe(200);
    expect(candidateNext.response.status).toBe(200);

    const delivered = await apiRequest("/api/canvassing/visits", rynaldo.cookie, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-canvass-user": "andrii",
        "x-canvass-role": "candidate",
      },
      body: JSON.stringify({
        submission_key: "authenticated-rynaldo-delivery",
        household_id: household.household_id,
        outcome: "flyer_delivered",
        flyer_delivered: true,
        flyer_id: "flyer-2-current",
        source: "candidate",
      }),
    });
    expect(delivered.response.status).toBe(201);
    expect(delivered.data.user_id).toBe("rynaldo");
    expect(delivered.data.source).toBe("volunteer");

    const sharedCandidateState = await apiRequest("/api/canvassing/state", andrii.cookie);
    const deliveredHousehold = sharedCandidateState.data.households.find(
      (home: any) => home.household_id === household.household_id,
    );
    expect(deliveredHousehold.flyer_history[0].user_id).toBe("rynaldo");
    expect(deliveredHousehold.political_outcome).toBeNull();

    const correction = await apiRequest(
      `/api/canvassing/households/${household.household_id}/flyer-status`,
      rynaldo.cookie,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ flyer_delivered: false, reason: "test correction" }),
      },
    );
    expect(correction.response.status).toBe(201);
    expect(correction.data.user_id).toBe("rynaldo");

    const andriiDelivery = await apiRequest("/api/canvassing/visits", andrii.cookie, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        submission_key: "authenticated-andrii-delivery",
        household_id: secondHousehold.household_id,
        outcome: "flyer_delivered",
        flyer_delivered: true,
        flyer_id: "flyer-2-current",
      }),
    });
    expect(andriiDelivery.response.status).toBe(201);
    expect(andriiDelivery.data.user_id).toBe("andrii");
    const refreshedForRynaldo = await apiRequest("/api/canvassing/state", rynaldo.cookie);
    expect(refreshedForRynaldo.data.households).toEqual(
      expect.any(Array),
    );
    expect(refreshedForRynaldo.data.households.find(
      (home: any) => home.household_id === secondHousehold.household_id,
    ).flyer_delivered).toBe(1);

    const loggedOut = await apiRequest("/api/logout", rynaldo.cookie, { method: "POST" });
    expect(loggedOut.response.status).toBe(200);
    const afterLogout = await apiRequest("/api/canvassing/state", rynaldo.cookie);
    expect(afterLogout.response.status).toBe(401);
  });

  it("rejects inactive accounts", async () => {
    execFileSync(process.execPath, [
      "-e",
      `const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(${JSON.stringify(join(directory, "canvassing.sqlite"))}); db.prepare("UPDATE users SET active=0 WHERE username='rynaldo'").run(); db.close();`,
    ]);
    const inactive = await login("rynaldo");
    expect(inactive.response.status).toBe(401);
  });
});
