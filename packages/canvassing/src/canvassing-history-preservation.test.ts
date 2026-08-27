import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

describe.sequential("authoritative address history preservation", () => {
  const port = 45_000 + (process.pid % 1_000);
  const api = `http://127.0.0.1:${port}`;
  const password = "canvassing-test-password";
  let directory = "";
  let server: ChildProcess | undefined;
  let canonicalAddressId = "";
  let legacyAddressId = "address-history-preservation-test";
  const eventId = "history-preservation-visit-test";

  async function startServer() {
    server = spawn("node_modules/.bin/tsx", ["packages/canvassing/src/server.ts"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
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
    for (let attempt = 0; attempt < 1_800; attempt++) {
      try {
        if ((await fetch(`${api}/api/canvassing/health`)).ok) return;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("Disposable history-preservation server did not start");
  }

  async function stopServer() {
    if (!server || server.exitCode != null) return;
    server.kill("SIGTERM");
    await new Promise<void>((resolve) => server!.once("exit", () => resolve()));
  }

  async function login() {
    const response = await fetch(`${api}/api/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "andrii", password }),
    });
    expect(response.status).toBe(200);
    return response.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
  }

  async function state(cookie: string) {
    const response = await fetch(`${api}/api/canvassing/state`, {
      headers: { cookie },
    });
    expect(response.status).toBe(200);
    return response.json();
  }

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "living-region-history-preservation-"));
    await startServer();
    const db = new DatabaseSync(join(directory, "canvassing.sqlite"));
    const canonical = db
      .prepare("SELECT id,structure_id,lon,lat FROM addresses WHERE source_active=1 ORDER BY id LIMIT 1")
      .get() as { id: string; structure_id: string | null; lon: number; lat: number };
    canonicalAddressId = canonical.id;
    const timestamp = "2026-08-26T20:00:00.000Z";
    db.prepare(
      `INSERT INTO addresses
       (id,structure_id,civic_number,street,unit,label,lon,lat,external_source,external_id,association_status,imported_at,source_active)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0)`,
    ).run(
      legacyAddressId,
      canonical.structure_id,
      "999",
      "Historical Street East",
      "",
      "999 Historical Street East",
      canonical.lon,
      canonical.lat,
      "legacy_history_test",
      legacyAddressId,
      "legacy",
      timestamp,
    );
    const legacyHouseholdId = `household_${legacyAddressId.slice(8)}`;
    db.prepare("INSERT INTO households VALUES (?,?,?,?)").run(
      legacyHouseholdId,
      legacyAddressId,
      "",
      timestamp,
    );
    db.prepare(
      `INSERT INTO visits
       (id,occurred_at,user_id,household_id,route_id,flyer_delivered,door_knocked,outcome,conversation_occurred,issue_categories_json,notes,follow_up_action,follow_up_date,support_category,source,imported_at,session_id,revisit_requested,no_answer,flyer_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      eventId,
      timestamp,
      "andrii",
      legacyHouseholdId,
      null,
      1,
      1,
      "flyer_delivered",
      0,
      "[]",
      "historical note preserved",
      null,
      null,
      null,
      "candidate",
      timestamp,
      null,
      0,
      0,
      "flyer-2-current",
    );
    const canonicalHouseholdId = `household_${canonicalAddressId.slice(8)}`;
    db.prepare(
      `INSERT INTO legacy_history_links
       (legacy_address_id,legacy_household_id,canonical_address_id,canonical_household_id,canonical_location_id,match_status,distance_m,candidate_count,candidate_location_count,reason,linked_at)
       VALUES (?,?,?,?,?,'confident',0,1,1,'test confident historical link',?)`,
    ).run(
      legacyAddressId,
      legacyHouseholdId,
      canonicalAddressId,
      canonicalHouseholdId,
      "test-location",
      timestamp,
    );
    db.prepare(
      `INSERT INTO structure_history_crosswalk
       (historical_household_id,historical_structure_id,historical_address_id,
        canonical_structure_id,match_method,confidence,historical_label,
        created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    ).run(
      legacyHouseholdId,
      canonical.structure_id,
      legacyAddressId,
      canonical.structure_id,
      "test_structure_geometry",
      "exact_structure_geometry",
      "999 Historical Street East",
      timestamp,
      timestamp,
    );
    db.close();
  }, 120_000);

  afterAll(async () => {
    await stopServer();
    await rm(directory, { recursive: true, force: true });
  });

  it("projects the corrected address and status without rewriting the original event", async () => {
    const cookie = await login();
    const current = await state(cookie);
    const canonical = current.households.find((home: any) => home.address_id === canonicalAddressId);
    expect(canonical).toMatchObject({
      address_id: canonicalAddressId,
      flyer_delivered: 1,
      status: "flyer_delivered",
      visit_count: 1,
    });
    expect(canonical.flyer_history).toContainEqual(
      expect.objectContaining({ event_id: eventId, user_id: "andrii" }),
    );
    expect(current.physical_roof_activity).toContainEqual(
      expect.objectContaining({
        structure_id: canonical.structure_id,
        flyer_delivered: 1,
        flyer_history: expect.arrayContaining([
          expect.objectContaining({ event_id: eventId, user_id: "andrii" }),
        ]),
      }),
    );
    expect(current.households.some((home: any) => home.address_id === legacyAddressId)).toBe(false);
    const db = new DatabaseSync(join(directory, "canvassing.sqlite"), { readOnly: true });
    expect(db.prepare("SELECT notes FROM visits WHERE id=?").get(eventId)).toEqual({
      notes: "historical note preserved",
    });
    db.close();
  });

  it("keeps the projected status after reseed and server restart", async () => {
    const before = new DatabaseSync(join(directory, "canvassing.sqlite"), { readOnly: true });
    expect(before.prepare("SELECT match_status FROM legacy_history_links WHERE legacy_address_id=?").get(legacyAddressId)).toEqual({
      match_status: "confident",
    });
    before.close();
    await stopServer();
    await startServer();
    const current = await state(await login());
    const canonical = current.households.find((home: any) => home.address_id === canonicalAddressId);
    expect(canonical).toMatchObject({ flyer_delivered: 1, status: "flyer_delivered", visit_count: 1 });
    expect(canonical.flyer_history).toContainEqual(expect.objectContaining({ event_id: eventId }));
    const db = new DatabaseSync(join(directory, "canvassing.sqlite"), { readOnly: true });
    expect(db.prepare("SELECT count(*) count FROM visits WHERE id=?").get(eventId)).toEqual({ count: 1 });
    expect(db.prepare("SELECT count(*) count FROM legacy_history_reviews WHERE legacy_address_id=?").get(legacyAddressId)).toEqual({ count: 0 });
    db.close();
  });
});
