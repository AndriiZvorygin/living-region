import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe.sequential("canvassing roof selection", () => {
  const port = 47_000 + (process.pid % 1_000);
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
    for (let attempt = 0; attempt < 120; attempt++) {
      try {
        if ((await fetch(`${api}/api/canvassing/health`)).ok) return;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("Disposable roof-selection server did not start");
  }

  async function stopServer() {
    if (!server || server.exitCode != null) return;
    server.kill("SIGTERM");
    await new Promise<void>((resolve) => server.once("exit", () => resolve()));
  }

  async function login(username = "rynaldo") {
    const response = await fetch(`${api}/api/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    expect(response.status).toBe(200);
    return response.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
  }

  async function request(path: string, cookie: string, init?: RequestInit) {
    const headers = new Headers(init?.headers);
    headers.set("cookie", cookie);
    const response = await fetch(`${api}${path}`, { ...init, headers });
    return { response, data: await response.json() };
  }

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "living-region-canvassing-roof-selection-"));
    await startServer();
  }, 60_000);

  afterAll(async () => {
    await stopServer();
    await rm(directory, { recursive: true, force: true });
  });

  it("makes an unlinked roof selectable and preserves its status after restart", async () => {
    const cookie = await login();
    const initial = await request("/api/canvassing/state", cookie);
    const structures = JSON.parse(
      await readFile("packages/web-client/public/canvassing/structures.geojson", "utf8"),
    );
    const linked = new Set(
      initial.data.households.map((home: { structure_id: string | null }) => home.structure_id),
    );
    const roof = structures.features.find((feature: any) => {
      const properties = feature.properties ?? {};
      return (
        !linked.has(properties.structure_id) &&
        !properties.address_reference_ids?.length &&
        !properties.authoritative_address_ids?.length &&
        properties.building_type === "unclassified"
      );
    });
    expect(roof).toBeTruthy();

    const target = await request(
      `/api/canvassing/structures/${roof.properties.structure_id}/selection-target`,
      cookie,
      { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
    );
    expect(target.response.status).toBe(201);
    expect(target.data.household_ids).toHaveLength(1);

    const householdId = target.data.household_ids[0];
    const delivery = await request("/api/canvassing/visits", cookie, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        submission_key: "roof-selection-delivery",
        household_id: householdId,
        outcome: "flyer_delivered",
        flyer_delivered: true,
        flyer_id: "flyer-2-current",
      }),
    });
    expect(delivery.response.status).toBe(201);
    expect(delivery.data.user_id).toBe("rynaldo");

    const afterDelivery = await request("/api/canvassing/state", cookie);
    expect(
      afterDelivery.data.households.find(
        (home: { household_id: string }) => home.household_id === householdId,
      ),
    ).toMatchObject({
      structure_id: roof.properties.structure_id,
      label: expect.stringContaining("Canvassing roof"),
      flyer_delivered: 1,
      legacy_history_review: 0,
    });

    await stopServer();
    await startServer();
    const afterRestart = await request("/api/canvassing/state", await login());
    expect(
      afterRestart.data.households.find(
        (home: { household_id: string }) => home.household_id === householdId,
      ),
    ).toMatchObject({ flyer_delivered: 1, structure_id: roof.properties.structure_id });
  });

  it("allows reviewed roofs and keeps invalid bulk targets isolated", async () => {
    const cookie = await login();
    const state = await request("/api/canvassing/state", cookie);
    const script = `
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(${JSON.stringify(join(directory, "canvassing.sqlite"))});
      const structure = db.prepare('SELECT id FROM structures WHERE source_active=1 LIMIT 1').get();
      if (!structure) throw new Error('no structure fixture');
      const addressId = 'address_roof_review_fixture';
      const householdId = 'household_roof_review_fixture';
      db.prepare('INSERT OR IGNORE INTO addresses (id,structure_id,civic_number,street,unit,label,lon,lat,external_source,external_id,association_status,imported_at,source_active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(addressId, structure.id, '', '', '', 'Review roof fixture', 0, 0, 'legacy_fixture', structure.id, 'legacy_review', new Date().toISOString(), 0);
      db.prepare('INSERT OR IGNORE INTO households (id,address_id,unit_label,created_at) VALUES (?,?,?,?)').run(householdId,addressId,'',new Date().toISOString());
      const source = { legacy_address_id: addressId, legacy_household_id: householdId };
      const timestamp = new Date().toISOString();
      db.prepare('INSERT OR REPLACE INTO legacy_history_reviews (legacy_address_id,review_status,reason,created_at,updated_at) VALUES (?,?,?,?,?)').run(source.legacy_address_id,'ambiguous_activity','selection regression fixture',timestamp,timestamp);
      console.log(JSON.stringify(source));
      db.close();
    `;
    const reviewSource = JSON.parse(
      execFileSync(process.execPath, ["-e", script], { encoding: "utf8" }),
    ) as { legacy_address_id: string; legacy_household_id: string };
    expect(reviewSource).toBeTruthy();
    const reviewed = (
      await request("/api/canvassing/state", cookie)
    ).data.households.find(
      (home: { household_id: string; legacy_history_review?: number; flyer_delivered: number }) =>
        home.household_id === reviewSource.legacy_household_id &&
        home.legacy_history_review === 1 &&
        !home.flyer_delivered,
    );
    expect(reviewed).toBeTruthy();

    const reviewedVisit = await request("/api/canvassing/visits", cookie, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        submission_key: "reviewed-roof-delivery",
        household_id: reviewed.household_id,
        outcome: "flyer_delivered",
        flyer_delivered: true,
        flyer_id: "flyer-2-current",
      }),
    });
    expect(reviewedVisit.response.status).toBe(201);
    const after = await request("/api/canvassing/state", cookie);
    expect(
      after.data.households.find(
        (home: { household_id: string }) => home.household_id === reviewed.household_id,
      ),
    ).toMatchObject({ flyer_delivered: 1, legacy_history_review: 1 });

    const ordinary = state.data.households.find(
      (home: { household_id: string; status: string }) =>
        home.status === "untouched" && home.household_id !== reviewed.household_id,
    );
    expect(ordinary).toBeTruthy();
    const results = await Promise.allSettled([
      request("/api/canvassing/visits", cookie, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          submission_key: "mixed-bulk-valid",
          household_id: ordinary.household_id,
          outcome: "knocked_no_answer",
          door_knocked: true,
          flyer_delivered: false,
        }),
      }),
      request("/api/canvassing/visits", cookie, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          submission_key: "mixed-bulk-invalid",
          household_id: "missing-household",
          outcome: "flyer_delivered",
          flyer_delivered: true,
          flyer_id: "flyer-2-current",
        }),
      }),
    ]);
    expect(results[0].status).toBe("fulfilled");
    expect(results[1].status).toBe("fulfilled");
    expect((results[0] as PromiseFulfilledResult<any>).value.response.status).toBe(201);
    expect((results[1] as PromiseFulfilledResult<any>).value.response.status).toBe(404);
  });
});
