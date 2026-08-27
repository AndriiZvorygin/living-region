import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type Hold = {
  id: string;
  user_id: string;
  center_household_id: string;
  household_ids_json: string;
  created_at: string;
  expires_at: string;
};

describe.sequential("canvassing recommendation holds", () => {
  const port = 45_000 + (process.pid % 1_000);
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
        CANVASS_RECOMMENDATION_HOLD_MINUTES: "30",
      },
      stdio: "ignore",
    });
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        if ((await fetch(`${api}/api/canvassing/health`)).ok) return;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("Disposable recommendation-hold server did not start");
  }

  async function login(username: string) {
    const response = await fetch(`${api}/api/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    expect(response.status).toBe(200);
    return response.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
  }

  async function next(cookie: string) {
    const response = await fetch(`${api}/api/canvassing/next-area`, {
      headers: { cookie },
    });
    return { response, data: await response.json() };
  }

  async function meaningfulVisit(
    cookie: string,
    submissionKey: string,
    householdId: string,
  ) {
    return fetch(`${api}/api/canvassing/visits`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        submission_key: submissionKey,
        household_id: householdId,
        outcome: "knocked_no_answer",
        door_knocked: true,
        flyer_delivered: false,
      }),
    });
  }

  function holds() {
    const script = `
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(${JSON.stringify(join(directory, "canvassing.sqlite"))}, { readOnly: true });
      console.log(JSON.stringify(db.prepare('SELECT id,user_id,center_household_id,household_ids_json,created_at,expires_at FROM recommendation_holds ORDER BY created_at,id').all()));
      db.close();
    `;
    return JSON.parse(execFileSync(process.execPath, ["-e", script], { encoding: "utf8" })) as Hold[];
  }

  function update(sql: string, ...parameters: string[]) {
    const script = `
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(${JSON.stringify(join(directory, "canvassing.sqlite"))});
      db.prepare(${JSON.stringify(sql)}).run(...${JSON.stringify(parameters)});
      db.close();
    `;
    execFileSync(process.execPath, ["-e", script]);
  }

  function footprint(hold: Hold) {
    return new Set<string>(JSON.parse(hold.household_ids_json));
  }

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "living-region-canvassing-holds-"));
    await startServer();
  }, 60_000);

  afterAll(async () => {
    if (server && server.exitCode == null) {
      server.kill("SIGTERM");
      await new Promise<void>((resolve) => server.once("exit", () => resolve()));
    }
    await rm(directory, { recursive: true, force: true });
  });

  it("keeps another user out during active work and replaces same-user holds", async () => {
    const andrii = await login("andrii");
    const rynaldo = await login("rynaldo");
    update("DELETE FROM recommendation_holds");
    const first = await next(andrii);
    expect(first.response.status).toBe(200);
    expect(first.data.recommendation.household_ids).toBeUndefined();
    const firstHold = holds().find((hold) => hold.user_id === "andrii");
    expect(firstHold).toBeTruthy();
    const firstExpiry = firstHold!.expires_at;
    const firstActivity = [...footprint(firstHold!)][0];
    expect((await meaningfulVisit(andrii, "recommendation-hold-andrii-work", firstActivity)).status).toBe(201);
    const refreshedAndriiHold = holds().find((hold) => hold.user_id === "andrii");
    expect(refreshedAndriiHold!.id).toBe(firstHold!.id);
    expect(Date.parse(refreshedAndriiHold!.expires_at)).toBeGreaterThan(
      Date.parse(firstExpiry),
    );

    const second = await next(rynaldo);
    expect(second.response.status).toBe(200);
    const secondHold = holds().find((hold) => hold.user_id === "rynaldo");
    expect(secondHold).toBeTruthy();
    expect(second.data.recommendation.center_household_id).not.toBe(
      first.data.recommendation.center_household_id,
    );
    expect([...footprint(secondHold!)].some((id) => footprint(firstHold!).has(id))).toBe(
      false,
    );

    const previousId = secondHold!.id;
    await next(rynaldo);
    const replacementHolds = holds().filter((hold) => hold.user_id === "rynaldo");
    expect(replacementHolds).toHaveLength(1);
    expect(replacementHolds[0].id).not.toBe(previousId);
  }, 90_000);

  it("refreshes only for repeated meaningful activity inside the footprint", async () => {
    const rynaldo = await login("rynaldo");
    update("DELETE FROM recommendation_holds");
    const recommendation = await next(rynaldo);
    const hold = holds().find((row) => row.user_id === "rynaldo");
    expect(hold).toBeTruthy();
    const footprintIds = [...footprint(hold!)];
    const firstInside = footprintIds[0];
    const secondInside = footprintIds[1];
    const stateResponse = await fetch(`${api}/api/canvassing/state`, {
      headers: { cookie: rynaldo },
    });
    const state = await stateResponse.json();
    const outside = state.households.find(
      (household: { household_id: string }) => !footprint(hold!).has(household.household_id),
    );
    expect(outside).toBeTruthy();

    const response = await meaningfulVisit(
      rynaldo,
      "recommendation-hold-inside-1",
      firstInside,
    );
    expect(response.status).toBe(201);
    const afterFirstInside = holds().find((row) => row.user_id === "rynaldo")!;
    expect(afterFirstInside.id).toBe(hold!.id);
    expect(Date.parse(afterFirstInside.expires_at)).toBeGreaterThan(
      Date.parse(hold!.expires_at),
    );

    const beforeOutside = afterFirstInside.expires_at;
    expect(
      (await meaningfulVisit(rynaldo, "recommendation-hold-outside", outside.household_id)).status,
    ).toBe(201);
    const afterOutside = holds().find((row) => row.user_id === "rynaldo")!;
    expect(afterOutside.expires_at).toBe(beforeOutside);

    const responseAgain = await meaningfulVisit(
      rynaldo,
      "recommendation-hold-inside-2",
      secondInside,
    );
    expect(responseAgain.status).toBe(201);
    const afterSecondInside = holds().find((row) => row.user_id === "rynaldo")!;
    expect(afterSecondInside.id).toBe(hold!.id);
    expect(Date.parse(afterSecondInside.expires_at)).toBeGreaterThan(
      Date.parse(afterOutside.expires_at),
    );
    expect(recommendation.data.recommendation).toBeTruthy();
  }, 90_000);

  it("ignores expired holds", async () => {
    const andrii = await login("andrii");
    const rynaldo = await login("rynaldo");
    update("DELETE FROM recommendation_holds");
    const first = await next(andrii);
    const firstHold = holds().find((hold) => hold.user_id === "andrii");
    expect(firstHold).toBeTruthy();
    update("UPDATE recommendation_holds SET expires_at=? WHERE id=?", "2000-01-01T00:00:00.000Z", firstHold!.id);
    const second = await next(rynaldo);
    expect(second.response.status).toBe(200);
    expect(second.data.recommendation.center_household_id).toBe(
      first.data.recommendation.center_household_id,
    );
  }, 90_000);

  it("serializes near-simultaneous requests before creating holds", async () => {
    const andrii = await login("andrii");
    const rynaldo = await login("rynaldo");
    update("DELETE FROM recommendation_holds");
    const [first, second] = await Promise.all([next(andrii), next(rynaldo)]);
    expect(first.response.status).toBe(200);
    expect(second.response.status).toBe(200);
    expect(first.data.recommendation.center_household_id).not.toBe(
      second.data.recommendation.center_household_id,
    );
    const activeHolds = holds();
    expect(activeHolds).toHaveLength(2);
    expect(new Set(activeHolds.map((hold) => hold.user_id))).toEqual(
      new Set(["andrii", "rynaldo"]),
    );
    expect([...footprint(activeHolds[0])].some((id) => footprint(activeHolds[1]).has(id))).toBe(
      false,
    );
  }, 90_000);
});
