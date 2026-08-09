import {
  appendFile,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { DatabaseSync, backup } from "node:sqlite";
import { dirname, join, resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import {
  applySampleOverrides,
  defaultFollowupDate,
  distributedSample,
  scheduleState,
  type SampleOverride,
} from "./followup-workflow";
import {
  frontageCuts,
  splitStructure,
  type Geometry,
  type SplitCut,
} from "./structure-split";

const root = resolve(process.cwd());
const host = process.env.CANVASS_HOST ?? "127.0.0.1";
const port = Number(process.env.CANVASS_PORT ?? 4174);
const token = process.env.CANVASS_AUTH_TOKEN ?? "";
if (!["127.0.0.1", "localhost", "::1"].includes(host) && !token)
  throw new Error(
    "CANVASS_AUTH_TOKEN is required when canvassing server is exposed beyond localhost",
  );
const storePath = resolve(
  process.env.CANVASS_DB ?? "private/canvassing/owen-sound.sqlite",
);
const journalPath = resolve(
  process.env.CANVASS_EVENT_LOG ?? "private/canvassing/visits.pya.jsonl",
);
const calibrationPath = resolve(
  process.env.CANVASS_CALIBRATION_EXPORT ??
    "private/canvassing/address-number-calibration.json",
);
const splitCalibrationPath = resolve(
  process.env.CANVASS_SPLIT_CALIBRATION_EXPORT ??
    "private/canvassing/structure-split-calibration.json",
);
await mkdir(dirname(storePath), { recursive: true });
const db = new DatabaseSync(storePath);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS structures (id TEXT PRIMARY KEY, geometry_json TEXT NOT NULL, building_type TEXT NOT NULL, external_source TEXT, external_id TEXT, source_confidence TEXT, imported_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS addresses (id TEXT PRIMARY KEY, structure_id TEXT REFERENCES structures(id), civic_number TEXT, street TEXT, unit TEXT, label TEXT, lon REAL NOT NULL, lat REAL NOT NULL, external_source TEXT, external_id TEXT, association_status TEXT, imported_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS households (id TEXT PRIMARY KEY, address_id TEXT NOT NULL REFERENCES addresses(id), unit_label TEXT, created_at TEXT NOT NULL, UNIQUE(address_id, unit_label));
CREATE TABLE IF NOT EXISTS people (id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id), name TEXT, phone TEXT, email TEXT, voluntarily_supplied INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS routes (id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', created_by TEXT NOT NULL, created_at TEXT NOT NULL, resumed_at TEXT);
CREATE TABLE IF NOT EXISTS route_stops (id TEXT PRIMARY KEY, route_id TEXT NOT NULL REFERENCES routes(id), household_id TEXT NOT NULL REFERENCES households(id), sequence INTEGER NOT NULL, street_side TEXT, completed_at TEXT, skipped INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS visits (id TEXT PRIMARY KEY, occurred_at TEXT NOT NULL, user_id TEXT NOT NULL, household_id TEXT NOT NULL REFERENCES households(id), route_id TEXT, flyer_delivered INTEGER NOT NULL, door_knocked INTEGER NOT NULL, outcome TEXT NOT NULL, conversation_occurred INTEGER NOT NULL, issue_categories_json TEXT NOT NULL, notes TEXT NOT NULL, follow_up_action TEXT, follow_up_date TEXT, support_category TEXT, source TEXT NOT NULL, imported_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS issue_categories (id TEXT PRIMARY KEY, label TEXT UNIQUE NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS follow_ups (id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id), visit_id TEXT REFERENCES visits(id), action TEXT NOT NULL, due_date TEXT, completed_at TEXT);
CREATE TABLE IF NOT EXISTS imports (id TEXT PRIMARY KEY, source_name TEXT NOT NULL, imported_by TEXT NOT NULL, imported_at TEXT NOT NULL, record_count INTEGER NOT NULL, warnings_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, occurred_at TEXT NOT NULL, user_id TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, detail_json TEXT NOT NULL);`);
db.exec(
  `CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL);`,
);
const migrated = new Set(
  (
    db.prepare("SELECT version FROM schema_migrations").all() as Array<{
      version: number;
    }>
  ).map((row) => row.version),
);
if (!migrated.has(1))
  db.prepare(
    "INSERT INTO schema_migrations VALUES (1,'milestone_1_baseline',?)",
  ).run(new Date().toISOString());
if (!migrated.has(2)) {
  db.exec(`BEGIN;
  CREATE TABLE route_sessions (id TEXT PRIMARY KEY, route_id TEXT NOT NULL REFERENCES routes(id), user_id TEXT NOT NULL, started_at TEXT NOT NULL, ended_at TEXT, flyers_at_start INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE route_session_events (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES route_sessions(id), occurred_at TEXT NOT NULL, event_type TEXT NOT NULL CHECK(event_type IN ('start','pause','resume','end')), detail_json TEXT NOT NULL);
  CREATE TABLE visit_corrections (id TEXT PRIMARY KEY, visit_id TEXT NOT NULL REFERENCES visits(id), occurred_at TEXT NOT NULL, user_id TEXT NOT NULL, correction_type TEXT NOT NULL CHECK(correction_type IN ('undo','restore')), reason TEXT, source TEXT NOT NULL);
  CREATE TABLE route_stop_events (id TEXT PRIMARY KEY, route_stop_id TEXT NOT NULL REFERENCES route_stops(id), session_id TEXT REFERENCES route_sessions(id), occurred_at TEXT NOT NULL, user_id TEXT NOT NULL, event_type TEXT NOT NULL CHECK(event_type IN ('skip','unskip')), detail_json TEXT NOT NULL);
  CREATE TABLE address_association_events (id TEXT PRIMARY KEY, address_id TEXT NOT NULL REFERENCES addresses(id), structure_id TEXT REFERENCES structures(id), occurred_at TEXT NOT NULL, user_id TEXT NOT NULL, event_type TEXT NOT NULL CHECK(event_type IN ('associate','clear','correct')), confidence TEXT NOT NULL, reason TEXT, previous_event_id TEXT);
  CREATE TABLE submission_keys (submission_key TEXT PRIMARY KEY, created_at TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT);
  CREATE TABLE journal_chain (sequence INTEGER PRIMARY KEY, event_hash TEXT UNIQUE NOT NULL, previous_hash TEXT, occurred_at TEXT NOT NULL);
  ALTER TABLE visits ADD COLUMN session_id TEXT REFERENCES route_sessions(id);
  INSERT INTO schema_migrations VALUES (2,'field_sessions_corrections_and_associations',datetime('now'));
  COMMIT;`);
}
if (!migrated.has(3)) {
  db.exec(
    `BEGIN;CREATE TABLE route_order_events (id TEXT PRIMARY KEY,route_id TEXT NOT NULL REFERENCES routes(id),occurred_at TEXT NOT NULL,user_id TEXT NOT NULL,reason TEXT NOT NULL,ordered_household_ids_json TEXT NOT NULL);INSERT INTO schema_migrations VALUES (3,'append_only_route_order_history',datetime('now'));COMMIT;`,
  );
}
if (!migrated.has(4)) {
  db.exec(`BEGIN;
  ALTER TABLE routes ADD COLUMN route_kind TEXT NOT NULL DEFAULT 'flyer_delivery';
  ALTER TABLE routes ADD COLUMN source_route_id TEXT REFERENCES routes(id);
  ALTER TABLE routes ADD COLUMN scheduled_for TEXT;
  ALTER TABLE routes ADD COLUMN accepted_at TEXT;
  CREATE TABLE followup_samples (id TEXT PRIMARY KEY,source_route_id TEXT NOT NULL UNIQUE REFERENCES routes(id),followup_route_id TEXT UNIQUE REFERENCES routes(id),sampling_mode TEXT NOT NULL CHECK(sampling_mode IN ('percentage','target_count')),percentage REAL,target_count INTEGER,seed TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('draft','accepted','cancelled')),flyer_date TEXT NOT NULL,scheduled_for TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL,accepted_at TEXT);
  CREATE TABLE followup_sample_items (sample_id TEXT NOT NULL REFERENCES followup_samples(id),household_id TEXT NOT NULL REFERENCES households(id),base_rank INTEGER NOT NULL,included INTEGER NOT NULL DEFAULT 1,manual_order INTEGER,PRIMARY KEY(sample_id,household_id));
  CREATE TABLE followup_sample_events (id TEXT PRIMARY KEY,sample_id TEXT NOT NULL REFERENCES followup_samples(id),occurred_at TEXT NOT NULL,user_id TEXT NOT NULL,event_type TEXT NOT NULL CHECK(event_type IN ('generate','include','exclude','reorder','accept','reschedule')),payload_json TEXT NOT NULL);
  CREATE TABLE neighbourhood_conversations (id TEXT PRIMARY KEY,occurred_at TEXT NOT NULL,user_id TEXT NOT NULL,lon REAL NOT NULL,lat REAL NOT NULL,location_accuracy_m REAL,issue_discussed TEXT NOT NULL,political_outcome TEXT,possible_volunteer INTEGER NOT NULL DEFAULT 0,possible_local_representative INTEGER NOT NULL DEFAULT 0,possible_councillor_candidate INTEGER NOT NULL DEFAULT 0,follow_up_requested INTEGER NOT NULL DEFAULT 0,household_id TEXT REFERENCES households(id),route_id TEXT REFERENCES routes(id),source TEXT NOT NULL,created_at TEXT NOT NULL);
  CREATE TABLE route_stop_completion_events (id TEXT PRIMARY KEY,route_stop_id TEXT NOT NULL REFERENCES route_stops(id),conversation_id TEXT REFERENCES neighbourhood_conversations(id),occurred_at TEXT NOT NULL,user_id TEXT NOT NULL,event_type TEXT NOT NULL CHECK(event_type IN ('complete','reopen')),detail_json TEXT NOT NULL);
  CREATE TABLE recruitment_areas (id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL);
  CREATE TABLE recruitment_prospects (id TEXT PRIMARY KEY,area_id TEXT NOT NULL REFERENCES recruitment_areas(id),display_name TEXT,household_id TEXT REFERENCES households(id),visit_id TEXT REFERENCES visits(id),conversation_id TEXT REFERENCES neighbourhood_conversations(id),role_interest TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL);
  CREATE TABLE recruitment_status_events (id TEXT PRIMARY KEY,area_id TEXT NOT NULL REFERENCES recruitment_areas(id),prospect_id TEXT REFERENCES recruitment_prospects(id),scope TEXT NOT NULL CHECK(scope IN ('area','prospect')),status TEXT NOT NULL CHECK(status IN ('candidate_confirmed','candidate_needed','potential_candidate_identified','contacted','considering','declined','registered')),occurred_at TEXT NOT NULL,user_id TEXT NOT NULL,source TEXT NOT NULL,detail_json TEXT NOT NULL);
  CREATE TABLE address_review_records (id TEXT PRIMARY KEY,address_id TEXT,external_source TEXT NOT NULL,external_id TEXT NOT NULL,label TEXT NOT NULL,lon REAL NOT NULL,lat REAL NOT NULL,within_boundary INTEGER NOT NULL,queue_flags_json TEXT NOT NULL,imported_geometry_json TEXT NOT NULL,imported_at TEXT NOT NULL);
  INSERT INTO recruitment_areas VALUES ('owen-sound-citywide','Owen Sound citywide',datetime('now'));
  INSERT INTO recruitment_status_events VALUES (lower(hex(randomblob(16))),'owen-sound-citywide',NULL,'area','candidate_needed',datetime('now'),'system','migration','{}');
  INSERT INTO schema_migrations VALUES (4,'weekly_followup_conversations_recruitment_review',datetime('now'));
  COMMIT;`);
}
if (!migrated.has(5)) {
  db.exec(`BEGIN;
  ALTER TABLE structures ADD COLUMN source_active INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE addresses ADD COLUMN source_active INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE address_review_records ADD COLUMN source_active INTEGER NOT NULL DEFAULT 1;
  CREATE INDEX addresses_source_active ON addresses(source_active);
  CREATE INDEX structures_source_active ON structures(source_active);
  INSERT INTO schema_migrations VALUES (5,'prepared_geography_lifecycle',datetime('now'));
  COMMIT;`);
}
if (!migrated.has(6)) {
  db.exec(`BEGIN;
  CREATE TABLE address_number_events (
    id TEXT PRIMARY KEY,
    address_id TEXT NOT NULL REFERENCES addresses(id),
    structure_id TEXT NOT NULL REFERENCES structures(id),
    occurred_at TEXT NOT NULL,
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK(event_type IN ('set','correct')),
    civic_number TEXT NOT NULL,
    street TEXT NOT NULL,
    unit TEXT NOT NULL,
    reason TEXT,
    previous_event_id TEXT REFERENCES address_number_events(id)
  );
  CREATE INDEX address_number_events_address ON address_number_events(address_id,occurred_at);
  CREATE INDEX address_number_events_structure ON address_number_events(structure_id,occurred_at);
  INSERT INTO schema_migrations VALUES (6,'append_only_address_number_calibration',datetime('now'));
  COMMIT;`);
}
if (!migrated.has(7)) {
  db.exec(`BEGIN;
  ALTER TABLE visits ADD COLUMN revisit_requested INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE visits ADD COLUMN no_answer INTEGER NOT NULL DEFAULT 0;
  INSERT INTO schema_migrations VALUES (7,'independent_visit_result_flags',datetime('now'));
  COMMIT;`);
}
if (!migrated.has(8)) {
  db.exec(`BEGIN;
  CREATE TABLE structure_split_events (
    id TEXT PRIMARY KEY,
    parent_structure_id TEXT NOT NULL REFERENCES structures(id),
    occurred_at TEXT NOT NULL,
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK(event_type IN ('accept','reverse')),
    method TEXT NOT NULL CHECK(method IN ('cut_lines','frontage')),
    payload_json TEXT NOT NULL,
    reason TEXT,
    previous_event_id TEXT REFERENCES structure_split_events(id)
  );
  CREATE INDEX structure_split_events_parent ON structure_split_events(parent_structure_id,occurred_at);
  INSERT INTO schema_migrations VALUES (8,'append_only_structure_splits',datetime('now'));
  COMMIT;`);
}
if (!migrated.has(9)) {
  db.exec(`BEGIN;
  CREATE TABLE household_flyer_events (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL REFERENCES households(id),
    occurred_at TEXT NOT NULL,
    user_id TEXT NOT NULL,
    flyer_delivered INTEGER NOT NULL CHECK(flyer_delivered IN (0,1)),
    reason TEXT,
    source TEXT NOT NULL,
    previous_event_id TEXT REFERENCES household_flyer_events(id)
  );
  CREATE INDEX household_flyer_events_household
    ON household_flyer_events(household_id,occurred_at);
  INSERT INTO schema_migrations VALUES
    (9,'append_only_household_flyer_state',datetime('now'));
  COMMIT;`);
}
if (!migrated.has(10)) {
  db.exec(`BEGIN;
  ALTER TABLE people
    ADD COLUMN mailing_list_consent INTEGER NOT NULL DEFAULT 0;
  CREATE TABLE person_contact_events (
    id TEXT PRIMARY KEY,
    person_id TEXT NOT NULL REFERENCES people(id),
    household_id TEXT NOT NULL REFERENCES households(id),
    occurred_at TEXT NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    mailing_list_consent INTEGER NOT NULL
      CHECK(mailing_list_consent IN (0,1)),
    voluntarily_supplied INTEGER NOT NULL
      CHECK(voluntarily_supplied IN (0,1)),
    source TEXT NOT NULL,
    previous_event_id TEXT REFERENCES person_contact_events(id)
  );
  CREATE INDEX person_contact_events_person
    ON person_contact_events(person_id,occurred_at);
  CREATE INDEX person_contact_events_household
    ON person_contact_events(household_id,occurred_at);
  INSERT INTO schema_migrations VALUES
    (10,'append_only_person_contact_details',datetime('now'));
  COMMIT;`);
}
db.exec(
  `CREATE VIEW IF NOT EXISTS active_visits AS SELECT v.* FROM visits v WHERE COALESCE((SELECT correction_type FROM visit_corrections c WHERE c.visit_id=v.id ORDER BY c.occurred_at DESC,c.rowid DESC LIMIT 1),'restore')!='undo';`,
);
db.exec(`CREATE VIEW IF NOT EXISTS effective_addresses AS
SELECT a.*,
  COALESCE((SELECT e.civic_number FROM address_number_events e WHERE e.address_id=a.id ORDER BY e.occurred_at DESC,e.rowid DESC LIMIT 1),a.civic_number) civic_number_effective,
  COALESCE((SELECT e.street FROM address_number_events e WHERE e.address_id=a.id ORDER BY e.occurred_at DESC,e.rowid DESC LIMIT 1),a.street) street_effective,
  COALESCE((SELECT e.unit FROM address_number_events e WHERE e.address_id=a.id ORDER BY e.occurred_at DESC,e.rowid DESC LIMIT 1),a.unit) unit_effective,
  (SELECT e.id FROM address_number_events e WHERE e.address_id=a.id ORDER BY e.occurred_at DESC,e.rowid DESC LIMIT 1) number_event_id
FROM addresses a;`);
db.exec(`DROP VIEW IF EXISTS household_flyer_state;
CREATE VIEW household_flyer_state AS
SELECT h.id household_id,
  COALESCE((
    SELECT state FROM (
      SELECT v.occurred_at,v.id,0 sort_priority,1 state
      FROM active_visits v
      WHERE v.household_id=h.id AND v.flyer_delivered=1
      UNION ALL
      SELECT f.occurred_at,f.id,1 sort_priority,f.flyer_delivered state
      FROM household_flyer_events f
      WHERE f.household_id=h.id
    )
    ORDER BY occurred_at DESC,sort_priority DESC,id DESC LIMIT 1
  ),0) flyer_delivered
FROM households h;`);
db.exec(`DROP VIEW IF EXISTS effective_people;
CREATE VIEW effective_people AS
SELECT p.id,p.household_id,
  COALESCE((SELECT e.name FROM person_contact_events e WHERE e.person_id=p.id ORDER BY e.occurred_at DESC,e.rowid DESC LIMIT 1),p.name,'') name,
  COALESCE((SELECT e.phone FROM person_contact_events e WHERE e.person_id=p.id ORDER BY e.occurred_at DESC,e.rowid DESC LIMIT 1),p.phone,'') phone,
  COALESCE((SELECT e.email FROM person_contact_events e WHERE e.person_id=p.id ORDER BY e.occurred_at DESC,e.rowid DESC LIMIT 1),p.email,'') email,
  COALESCE((SELECT e.mailing_list_consent FROM person_contact_events e WHERE e.person_id=p.id ORDER BY e.occurred_at DESC,e.rowid DESC LIMIT 1),p.mailing_list_consent,0) mailing_list_consent,
  COALESCE((SELECT e.voluntarily_supplied FROM person_contact_events e WHERE e.person_id=p.id ORDER BY e.occurred_at DESC,e.rowid DESC LIMIT 1),p.voluntarily_supplied,1) voluntarily_supplied,
  (SELECT e.id FROM person_contact_events e WHERE e.person_id=p.id ORDER BY e.occurred_at DESC,e.rowid DESC LIMIT 1) latest_event_id,
  COALESCE((SELECT e.occurred_at FROM person_contact_events e WHERE e.person_id=p.id ORDER BY e.occurred_at DESC,e.rowid DESC LIMIT 1),p.created_at) last_updated_at
FROM people p;`);

const now = () => new Date().toISOString();
const json = (
  res: ServerResponse,
  status: number,
  value: unknown,
  contentType = "application/json",
) => {
  const body =
    contentType === "application/json" ? JSON.stringify(value) : String(value);
  res.writeHead(status, {
    "content-type": `${contentType}; charset=utf-8`,
    "cache-control": "no-store",
  });
  res.end(body);
};
const body = async (req: IncomingMessage) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
};
const audit = (
  user: string,
  action: string,
  type: string,
  id: string | null,
  detail: unknown,
) =>
  db
    .prepare("INSERT INTO audit_events VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(randomUUID(), now(), user, action, type, id, JSON.stringify(detail));
let journalWriteQueue = Promise.resolve();
const recordEvent = async (event: Record<string, unknown>) => {
  const write = journalWriteQueue.then(async () => {
    const last = db
      .prepare(
        "SELECT sequence,event_hash FROM journal_chain ORDER BY sequence DESC LIMIT 1",
      )
      .get() as { sequence: number; event_hash: string } | undefined;
    const envelope = {
      sequence: (last?.sequence ?? 0) + 1,
      previous_hash: last?.event_hash ?? null,
      event,
    };
    const event_hash = createHash("sha256")
      .update(JSON.stringify(envelope))
      .digest("hex");
    await mkdir(dirname(journalPath), { recursive: true });
    await appendFile(
      journalPath,
      JSON.stringify({ ...envelope, event_hash }) + "\n",
      { mode: 0o600 },
    );
    db.prepare("INSERT INTO journal_chain VALUES (?,?,?,?)").run(
      envelope.sequence,
      event_hash,
      envelope.previous_hash,
      now(),
    );
  });
  journalWriteQueue = write.catch(() => undefined);
  return write;
};

const geometryCenter = (geometryJson: string): [number, number] => {
  const geometry = JSON.parse(geometryJson),
    points: Array<[number, number]> = [],
    walk = (coordinates: any) => {
      if (typeof coordinates?.[0] === "number")
        points.push(coordinates as [number, number]);
      else coordinates?.forEach(walk);
    };
  walk(geometry.coordinates);
  return [
    points.reduce((sum, point) => sum + point[0], 0) / points.length,
    points.reduce((sum, point) => sum + point[1], 0) / points.length,
  ];
};

const metresBetween = (
  a: [number, number],
  b: [number, number],
): number => {
  const latitude = (((a[1] + b[1]) / 2) * Math.PI) / 180;
  return Math.hypot(
    (a[0] - b[0]) * 111320 * Math.cos(latitude),
    (a[1] - b[1]) * 111320,
  );
};

const latestSplitEvents = () => {
  const rows = db
    .prepare(
      `SELECT e.* FROM structure_split_events e
       WHERE e.rowid=(SELECT x.rowid FROM structure_split_events x
         WHERE x.parent_structure_id=e.parent_structure_id
         ORDER BY x.occurred_at DESC,x.rowid DESC LIMIT 1)
       ORDER BY e.occurred_at`,
    )
    .all() as any[];
  return rows.map((row) => ({
    ...row,
    payload: JSON.parse(row.payload_json),
  }));
};

async function writeSplitCalibration() {
  const records = latestSplitEvents()
    .filter((event) => event.event_type === "accept")
    .map((event) => ({
      event_id: event.id,
      parent_structure_id: event.parent_structure_id,
      occurred_at: event.occurred_at,
      method: event.method,
      reason: event.reason,
      ...event.payload,
    }));
  await mkdir(dirname(splitCalibrationPath), { recursive: true });
  await writeFile(
    splitCalibrationPath,
    JSON.stringify(
      {
        generated_at: now(),
        purpose:
          "Private append-only building split corrections for canvassing regeneration",
        records,
      },
      null,
      2,
    ) + "\n",
    { mode: 0o600 },
  );
}

async function writeAddressNumberCalibration() {
  const records = db
    .prepare(
      `SELECT e.id event_id,e.address_id,e.structure_id,e.occurred_at,
       e.civic_number,e.street,e.unit,e.reason,
       s.external_source structure_source,s.external_id structure_external_id
       FROM address_number_events e
       JOIN structures s ON s.id=e.structure_id
       WHERE e.rowid=(SELECT e2.rowid FROM address_number_events e2
         WHERE e2.address_id=e.address_id
         ORDER BY e2.occurred_at DESC,e2.rowid DESC LIMIT 1)
       ORDER BY e.structure_id,e.address_id`,
    )
    .all();
  await mkdir(dirname(calibrationPath), { recursive: true });
  await writeFile(
    calibrationPath,
    JSON.stringify(
      {
        schema_version: 1,
        generated_at: now(),
        purpose:
          "Private, manually verified civic-number references for canvassing regeneration",
        records,
      },
      null,
      2,
    ) + "\n",
    { mode: 0o600 },
  );
}

async function seed() {
  const base = join(root, "packages/web-client/public/canvassing");
  const structures = JSON.parse(
    await readFile(join(base, "structures.geojson"), "utf8"),
  );
  const addresses = JSON.parse(
    await readFile(join(base, "addresses.geojson"), "utf8"),
  );
  const addressReview = JSON.parse(
    await readFile(join(base, "address-review.geojson"), "utf8"),
  );
  const timestamp = now();
  db.exec("BEGIN");
  try {
    db.exec(
      "UPDATE structures SET source_active=0 WHERE external_source!='manual_canvassing_split'; UPDATE addresses SET source_active=0 WHERE external_source NOT IN ('manual_canvassing','manual_split_inferred'); UPDATE address_review_records SET source_active=0;",
    );
    const insertStructure = db.prepare(
      "INSERT INTO structures (id,geometry_json,building_type,external_source,external_id,source_confidence,imported_at,source_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1) ON CONFLICT(id) DO UPDATE SET geometry_json=excluded.geometry_json,building_type=excluded.building_type,external_source=excluded.external_source,external_id=excluded.external_id,source_confidence=excluded.source_confidence,imported_at=excluded.imported_at,source_active=1",
    );
    for (const feature of structures.features)
      insertStructure.run(
        feature.properties.structure_id,
        JSON.stringify(feature.geometry),
        feature.properties.building_type,
        feature.properties.external_source,
        feature.properties.external_id,
        feature.properties.confidence,
        timestamp,
      );
    const insertAddress = db.prepare(
      "INSERT INTO addresses (id,structure_id,civic_number,street,unit,label,lon,lat,external_source,external_id,association_status,imported_at,source_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1) ON CONFLICT(id) DO UPDATE SET structure_id=excluded.structure_id,civic_number=excluded.civic_number,street=excluded.street,unit=excluded.unit,label=excluded.label,lon=excluded.lon,lat=excluded.lat,association_status=excluded.association_status,imported_at=excluded.imported_at,source_active=1",
    );
    const insertHousehold = db.prepare(
      "INSERT OR IGNORE INTO households VALUES (?, ?, ?, ?)",
    );
    for (const feature of addresses.features) {
      const p = feature.properties,
        [lon, lat] = feature.geometry.coordinates;
      insertAddress.run(
        p.address_id,
        p.structure_id,
        p.civic_number,
        p.street,
        p.unit,
        p.label,
        lon,
        lat,
        p.external_source,
        p.external_id,
        p.association_status,
        timestamp,
      );
      insertHousehold.run(
        `household_${p.address_id.slice(8)}`,
        p.address_id,
        p.unit || "",
        timestamp,
      );
    }
    const insertReview = db.prepare(
      "INSERT INTO address_review_records (id,address_id,external_source,external_id,label,lon,lat,within_boundary,queue_flags_json,imported_geometry_json,imported_at,source_active) VALUES (?,?,?,?,?,?,?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET address_id=excluded.address_id,external_source=excluded.external_source,external_id=excluded.external_id,label=excluded.label,lon=excluded.lon,lat=excluded.lat,within_boundary=excluded.within_boundary,queue_flags_json=excluded.queue_flags_json,imported_geometry_json=excluded.imported_geometry_json,imported_at=excluded.imported_at,source_active=1",
    );
    for (const feature of addressReview.features) {
      const p = feature.properties,
        [lon, lat] = feature.geometry.coordinates;
      insertReview.run(
        p.review_id,
        p.address_id,
        p.external_source,
        p.external_id,
        p.label,
        lon,
        lat,
        p.within_boundary ? 1 : 0,
        JSON.stringify(p.queue_flags),
        JSON.stringify(feature.geometry),
        timestamp,
      );
    }
    db.exec("COMMIT");
    audit("system", "seed", "import", null, {
      structures: structures.features.length,
      addresses: addresses.features.length,
      address_review_records: addressReview.features.length,
    });
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {}
    throw error;
  }
}
await seed();
await writeAddressNumberCalibration();

const backupDir = resolve("private/canvassing/backups");
async function performBackup(label = "daily") {
  await mkdir(backupDir, { recursive: true });
  const path = join(
    backupDir,
    `owen-sound-${label}-${new Date().toISOString().replaceAll(":", "-").slice(0, 19)}.sqlite`,
  );
  await backup(db, path);
  const check = new DatabaseSync(path, { readOnly: true });
  const result = check.prepare("PRAGMA quick_check").get() as any;
  check.close();
  if (result.quick_check !== "ok")
    throw new Error(`Backup restore check failed: ${result.quick_check}`);
  return path;
}
async function backupStatus() {
  await mkdir(backupDir, { recursive: true });
  const files = await Promise.all(
    (await readdir(backupDir))
      .filter((file) => file.endsWith(".sqlite"))
      .map(async (file) => ({ file, info: await stat(join(backupDir, file)) })),
  );
  const latest = files.sort((a, b) => b.info.mtimeMs - a.info.mtimeMs)[0];
  if (!latest) return { recent: false, latest: null, age_hours: null };
  const info = latest.info;
  const age = (Date.now() - info.mtimeMs) / 3_600_000;
  return { recent: age <= 26, latest: latest.file, age_hours: +age.toFixed(1) };
}
if (!(await backupStatus()).recent) await performBackup();
setInterval(
  async () => {
    try {
      if (!(await backupStatus()).recent) await performBackup();
    } catch (error) {
      console.error("Automatic canvassing backup failed", error);
    }
  },
  60 * 60 * 1000,
).unref();

async function verifyJournal() {
  const content = await readFile(journalPath, "utf8").catch(() => "");
  let previous: string | null = null,
    count = 0;
  for (const line of content.split(/\r?\n/).filter(Boolean)) {
    const row = JSON.parse(line);
    const expected = createHash("sha256")
      .update(
        JSON.stringify({
          sequence: row.sequence,
          previous_hash: row.previous_hash,
          event: row.event,
        }),
      )
      .digest("hex");
    if (row.previous_hash !== previous || row.event_hash !== expected)
      return {
        valid: false,
        count,
        error: `chain mismatch at sequence ${row.sequence}`,
      };
    previous = row.event_hash;
    count++;
  }
  const databaseCount = Number(
    (db.prepare("SELECT count(*) count FROM journal_chain").get() as any).count,
  );
  return {
    valid: count === databaseCount,
    count,
    database_count: databaseCount,
    error: count === databaseCount ? null : "journal/database count mismatch",
  };
}

function sessionSummary(sessionId: string) {
  const session = db
    .prepare("SELECT * FROM route_sessions WHERE id=?")
    .get(sessionId) as any;
  if (!session) return null;
  const events = db
    .prepare(
      "SELECT * FROM route_session_events WHERE session_id=? ORDER BY occurred_at,rowid",
    )
    .all(sessionId) as any[];
  const visits = db
    .prepare(
      "SELECT * FROM active_visits WHERE session_id=? ORDER BY occurred_at",
    )
    .all(sessionId) as any[];
  const stopEvents = db
    .prepare(
      "SELECT * FROM route_stop_events WHERE session_id=? ORDER BY occurred_at",
    )
    .all(sessionId) as any[];
  const end = session.ended_at ?? now();
  let activeMs = 0,
    pauseMs = 0,
    cursor = Date.parse(session.started_at),
    paused = false;
  for (const event of events.slice(1)) {
    const at = Date.parse(event.occurred_at);
    if (paused) pauseMs += Math.max(0, at - cursor);
    else activeMs += Math.max(0, at - cursor);
    cursor = at;
    if (event.event_type === "pause") paused = true;
    if (event.event_type === "resume") paused = false;
  }
  const endMs = Date.parse(end);
  if (paused) pauseMs += Math.max(0, endMs - cursor);
  else activeMs += Math.max(0, endMs - cursor);
  const skips = new Map<string, string>();
  for (const event of stopEvents)
    skips.set(event.route_stop_id, event.event_type);
  const attempted = new Set(visits.map((v) => v.household_id));
  const conversations = visits.filter((v) => v.conversation_occurred).length;
  const answers = visits.filter((v) =>
    [
      "conversation",
      "supportive",
      "undecided",
      "opposed",
      "volunteer_interest",
      "lawn_sign_interest",
    ].includes(v.outcome),
  ).length;
  return {
    session_id: session.id,
    route_id: session.route_id,
    started_at: session.started_at,
    ended_at: session.ended_at,
    paused: !session.ended_at && paused,
    elapsed_active_minutes: +(activeMs / 60000).toFixed(1),
    pause_minutes: +(pauseMs / 60000).toFixed(1),
    flyers_used: visits.filter((v) => v.flyer_delivered).length,
    stops_attempted: attempted.size,
    doors_knocked: visits.filter((v) => v.door_knocked).length,
    answers,
    conversations,
    revisits: visits.filter(
      (v) => v.revisit_requested || v.outcome === "revisit",
    ).length,
    skipped_stops: [...skips.values()].filter((value) => value === "skip")
      .length,
    completed_stops_per_hour: activeMs
      ? +(attempted.size / (activeMs / 3_600_000)).toFixed(1)
      : 0,
  };
}

function state(role = "candidate") {
  const households = db
    .prepare(
      `SELECT h.id household_id,h.unit_label,a.id address_id,
    CASE WHEN EXISTS(SELECT 1 FROM address_association_events ae WHERE ae.address_id=a.id) THEN (SELECT CASE WHEN ae.event_type='clear' THEN NULL ELSE ae.structure_id END FROM address_association_events ae WHERE ae.address_id=a.id ORDER BY ae.occurred_at DESC,ae.rowid DESC LIMIT 1) ELSE a.structure_id END structure_id,
    a.structure_id imported_structure_id,a.civic_number_effective civic_number,a.street_effective street,a.unit_effective unit,
    CASE WHEN a.number_event_id IS NOT NULL THEN trim(a.civic_number_effective||' '||a.street_effective||CASE WHEN a.unit_effective!='' THEN ' Unit '||a.unit_effective ELSE '' END) ELSE a.label END label,
    a.lon,a.lat,a.number_event_id,CASE WHEN a.number_event_id IS NOT NULL THEN 1 ELSE 0 END number_corrected,
    CASE WHEN EXISTS(SELECT 1 FROM address_association_events ae WHERE ae.address_id=a.id) THEN 'manual_verified' ELSE a.association_status END association_status,
    COALESCE((SELECT CASE WHEN v.revisit_requested=1 THEN 'revisit' ELSE v.outcome END FROM active_visits v WHERE v.household_id=h.id AND (fs.flyer_delivered=1 OR v.outcome!='flyer_delivered') ORDER BY v.occurred_at DESC,v.id DESC LIMIT 1),'untouched') status,
    fs.flyer_delivered,
    COALESCE((SELECT max(v.door_knocked) FROM active_visits v WHERE v.household_id=h.id),0) door_knocked,
    COALESCE((SELECT max(v.conversation_occurred) FROM active_visits v WHERE v.household_id=h.id),0) conversation_occurred,
    COALESCE((SELECT max(v.revisit_requested) FROM active_visits v WHERE v.household_id=h.id),0) revisit_requested,
    COALESCE((SELECT max(v.no_answer) FROM active_visits v WHERE v.household_id=h.id),0) no_answer,
    (SELECT v.outcome FROM active_visits v
      WHERE v.household_id=h.id
      AND v.outcome IN ('supportive','undecided','opposed','volunteer_interest','lawn_sign_interest','vacant','no_campaign_material_requested')
      ORDER BY v.occurred_at DESC,v.id DESC LIMIT 1) political_outcome,
    (SELECT occurred_at FROM (
      SELECT v.occurred_at,v.id FROM active_visits v WHERE v.household_id=h.id
      UNION ALL
      SELECT f.occurred_at,f.id FROM household_flyer_events f WHERE f.household_id=h.id
      UNION ALL
      SELECT p.last_updated_at,p.id FROM effective_people p WHERE p.household_id=h.id
    ) ORDER BY occurred_at DESC,id DESC LIMIT 1) last_updated_at,
    (SELECT count(*) FROM active_visits v WHERE v.household_id=h.id) visit_count
    FROM households h JOIN effective_addresses a ON a.id=h.address_id
    JOIN household_flyer_state fs ON fs.household_id=h.id
    WHERE a.source_active=1`,
    )
    .all();
  const routes = db
    .prepare(
      "SELECT r.*,count(s.id) stop_count,sum(CASE WHEN s.completed_at IS NOT NULL THEN 1 ELSE 0 END) completed_count FROM routes r LEFT JOIN route_stops s ON s.route_id=r.id GROUP BY r.id ORDER BY r.created_at DESC",
    )
    .all();
  const route_stops = db
    .prepare(
      `SELECT s.*,
       CASE WHEN a.number_event_id IS NOT NULL THEN trim(a.civic_number_effective||' '||a.street_effective||CASE WHEN a.unit_effective!='' THEN ' Unit '||a.unit_effective ELSE '' END) ELSE a.label END label,
       a.civic_number_effective civic_number,a.street_effective street,a.lon,a.lat
       FROM route_stops s JOIN households h ON h.id=s.household_id
       JOIN effective_addresses a ON a.id=h.address_id
       ORDER BY s.route_id,s.sequence`,
    )
    .all();
  const followup_samples = (
    db
      .prepare(
        "SELECT fs.*,sr.name source_route_name,fr.name followup_route_name FROM followup_samples fs JOIN routes sr ON sr.id=fs.source_route_id LEFT JOIN routes fr ON fr.id=fs.followup_route_id ORDER BY fs.scheduled_for,fs.created_at",
      )
      .all() as any[]
  ).map((sample) => ({
    ...sample,
    schedule_state: scheduleState(sample.scheduled_for, now().slice(0, 10)),
    household_ids: (
      db
        .prepare(
          "SELECT household_id FROM followup_sample_items WHERE sample_id=? AND included=1 ORDER BY COALESCE(manual_order,base_rank),base_rank",
        )
        .all(sample.id) as Array<{ household_id: string }>
    ).map((item) => item.household_id),
  }));
  const reviewRows = db
    .prepare(
      "SELECT queue_flags_json FROM address_review_records WHERE source_active=1",
    )
    .all() as Array<{ queue_flags_json: string }>;
  const address_review_counts: Record<string, number> = {};
  for (const row of reviewRows)
    for (const queue of JSON.parse(row.queue_flags_json))
      address_review_counts[queue] = (address_review_counts[queue] ?? 0) + 1;
  const recruitment_areas =
    role === "volunteer"
      ? []
      : (db
          .prepare(
            "SELECT ra.*,(SELECT status FROM recruitment_status_events rse WHERE rse.area_id=ra.id AND rse.scope='area' ORDER BY occurred_at DESC,rowid DESC LIMIT 1) status FROM recruitment_areas ra ORDER BY name",
          )
          .all() as any[]);
  const recruitment_prospects =
    role === "volunteer"
      ? []
      : (db
          .prepare(
            "SELECT rp.*,ra.name area_name,(SELECT status FROM recruitment_status_events rse WHERE rse.prospect_id=rp.id AND rse.scope='prospect' ORDER BY occurred_at DESC,rowid DESC LIMIT 1) status FROM recruitment_prospects rp JOIN recruitment_areas ra ON ra.id=rp.area_id ORDER BY rp.created_at DESC",
          )
          .all() as any[]);
  const neighbourhood_conversations =
    role === "volunteer"
      ? []
      : (db
          .prepare(
            `SELECT nc.*,CASE WHEN a.number_event_id IS NOT NULL
             THEN trim(a.civic_number_effective||' '||a.street_effective||CASE WHEN a.unit_effective!='' THEN ' Unit '||a.unit_effective ELSE '' END)
             ELSE a.label END household_label
             FROM neighbourhood_conversations nc
             LEFT JOIN households h ON h.id=nc.household_id
             LEFT JOIN effective_addresses a ON a.id=h.address_id
             ORDER BY nc.occurred_at DESC LIMIT 100`,
          )
          .all() as any[]);
  const sessions = (
    db
      .prepare(
        "SELECT id FROM route_sessions ORDER BY started_at DESC LIMIT 25",
      )
      .all() as Array<{ id: string }>
  ).map((row) => sessionSummary(row.id));
  const summary = db
    .prepare(
      `SELECT count(*) total_households,
    sum(fs.flyer_delivered) flyers_delivered,
    sum(EXISTS(SELECT 1 FROM active_visits v WHERE v.household_id=h.id AND v.door_knocked=1)) doors_knocked,
    sum(EXISTS(SELECT 1 FROM active_visits v WHERE v.household_id=h.id AND v.outcome IN ('conversation','supportive','undecided','opposed','volunteer_interest','lawn_sign_interest'))) answers,
    sum(EXISTS(SELECT 1 FROM active_visits v WHERE v.household_id=h.id AND v.conversation_occurred=1)) conversations,
    sum(EXISTS(SELECT 1 FROM active_visits v WHERE v.household_id=h.id AND (v.revisit_requested=1 OR v.outcome='revisit'))) revisits,
    sum(EXISTS(SELECT 1 FROM active_visits v WHERE v.household_id=h.id AND v.outcome='supportive')) supporters,
    sum(EXISTS(SELECT 1 FROM active_visits v WHERE v.household_id=h.id AND v.outcome='volunteer_interest')) volunteers,
    sum(EXISTS(SELECT 1 FROM active_visits v WHERE v.household_id=h.id AND v.outcome='lawn_sign_interest')) lawn_signs
    FROM households h JOIN addresses a ON a.id=h.address_id
    JOIN household_flyer_state fs ON fs.household_id=h.id
    WHERE a.source_active=1`,
    )
    .get() as any;
  summary.untouched_households =
    Number(summary.total_households) -
    households.filter((h: any) => h.status !== "untouched").length;
  summary.answer_rate = summary.doors_knocked
    ? +((summary.answers / summary.doors_knocked) * 100).toFixed(1)
    : 0;
  summary.conversation_rate = summary.doors_knocked
    ? +((summary.conversations / summary.doors_knocked) * 100).toFixed(1)
    : 0;
  const span = db
    .prepare(
      "SELECT min(occurred_at) first,max(occurred_at) last,count(DISTINCT household_id) completed FROM active_visits",
    )
    .get() as any;
  const hours =
    span.first && span.last
      ? Math.max(
          1 / 60,
          (Date.parse(span.last) - Date.parse(span.first)) / 3_600_000,
        )
      : 0;
  summary.households_completed_per_hour = hours
    ? +(span.completed / hours).toFixed(1)
    : 0;
  return {
    households,
    routes,
    route_stops,
    route_sessions: sessions,
    followup_samples,
    neighbourhood_conversations,
    recruitment_areas,
    recruitment_prospects,
    address_review_counts,
    schema_version: 10,
    summary,
  };
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false;
  for (let i = 0; i <= text.length; i++) {
    const c = text[i] ?? "\n";
    if (c === '"' && quoted && text[i + 1] === '"') {
      value += '"';
      i++;
    } else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(value);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else value += c;
  }
  const headers = rows.shift() ?? [];
  return rows.map((values) =>
    Object.fromEntries(
      headers.map((header, i) => [header.trim(), values[i] ?? ""]),
    ),
  );
}
const csvCell = (value: unknown) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;

function sourceSamplingStops(routeId: string) {
  return db
    .prepare(
      `SELECT s.household_id,a.street_effective street,a.civic_number_effective civic_number,a.lon,a.lat
       FROM route_stops s JOIN households h ON h.id=s.household_id JOIN effective_addresses a ON a.id=h.address_id
       JOIN household_flyer_state fs ON fs.household_id=s.household_id
       WHERE s.route_id=? AND s.completed_at IS NOT NULL
       AND fs.flyer_delivered=1
       ORDER BY s.sequence`,
    )
    .all(routeId) as Array<{
    household_id: string;
    street: string;
    civic_number: string;
    lon: number;
    lat: number;
  }>;
}

function followupSample(sampleId: string) {
  const sample = db
    .prepare("SELECT * FROM followup_samples WHERE id=?")
    .get(sampleId) as any;
  if (!sample) return null;
  sample.household_ids = (
    db
      .prepare(
        "SELECT household_id FROM followup_sample_items WHERE sample_id=? AND included=1 ORDER BY COALESCE(manual_order,base_rank),base_rank",
      )
      .all(sampleId) as Array<{ household_id: string }>
  ).map((item) => item.household_id);
  return sample;
}

const recruitmentStatuses = new Set([
  "candidate_confirmed",
  "candidate_needed",
  "potential_candidate_identified",
  "contacted",
  "considering",
  "declined",
  "registered",
]);

const server = createServer(async (req, res) => {
  try {
    const url = new URL(
      req.url ?? "/",
      `http://${req.headers.host ?? "localhost"}`,
    );
    if (token && req.headers.authorization !== `Bearer ${token}`)
      return json(res, 401, { error: "authentication required" });
    const user = String(req.headers["x-canvass-user"] ?? "local-user");
    const role = String(req.headers["x-canvass-role"] ?? "candidate");
    if (req.method === "GET" && url.pathname === "/api/canvassing/health") {
      db.prepare("SELECT 1").get();
      return json(res, 200, { status: "ok" });
    }
    if (req.method === "GET" && url.pathname === "/api/canvassing/state")
      return json(res, 200, state(role));
    if (req.method === "POST" && url.pathname === "/api/canvassing/visits") {
      const input = JSON.parse(await body(req));
      if (role === "volunteer") {
        input.notes = "";
        input.support_category = null;
        input.issue_categories = [];
        input.follow_up_action = null;
        input.follow_up_date = null;
      }
      const submissionKey = String(input.submission_key ?? "");
      if (!submissionKey)
        return json(res, 400, { error: "submission_key is required" });
      try {
        db.prepare("INSERT INTO submission_keys VALUES (?,?,'visit',NULL)").run(
          submissionKey,
          now(),
        );
      } catch {
        return json(res, 409, {
          error: "duplicate submission ignored",
          submission_key: submissionKey,
        });
      }
      const allowed = [
        "untouched",
        "flyer_delivered",
        "knocked_no_answer",
        "conversation",
        "revisit",
        "supportive",
        "undecided",
        "opposed",
        "volunteer_interest",
        "lawn_sign_interest",
        "inaccessible",
        "vacant",
        "no_campaign_material_requested",
      ];
      if (!allowed.includes(input.outcome))
        return json(res, 400, { error: "invalid outcome" });
      const event = {
        id: randomUUID(),
        occurred_at: input.occurred_at ?? now(),
        user_id: user,
        household_id: input.household_id,
        route_id: input.route_id ?? null,
        flyer_delivered: Boolean(input.flyer_delivered),
        door_knocked: Boolean(input.door_knocked),
        outcome: input.outcome,
        conversation_occurred: Boolean(input.conversation_occurred),
        revisit_requested: Boolean(input.revisit_requested),
        no_answer: Boolean(input.no_answer),
        issue_categories: input.issue_categories ?? [],
        notes: input.notes ?? "",
        follow_up_action: input.follow_up_action ?? null,
        follow_up_date: input.follow_up_date ?? null,
        support_category: input.support_category ?? null,
        source: input.source ?? "candidate",
        imported_at: now(),
        session_id: input.session_id ?? null,
      };
      db.prepare(
        "INSERT INTO visits (id,occurred_at,user_id,household_id,route_id,flyer_delivered,door_knocked,outcome,conversation_occurred,issue_categories_json,notes,follow_up_action,follow_up_date,support_category,source,imported_at,session_id,revisit_requested,no_answer) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      ).run(
        event.id,
        event.occurred_at,
        event.user_id,
        event.household_id,
        event.route_id,
        +event.flyer_delivered,
        +event.door_knocked,
        event.outcome,
        +event.conversation_occurred,
        JSON.stringify(event.issue_categories),
        event.notes,
        event.follow_up_action,
        event.follow_up_date,
        event.support_category,
        event.source,
        event.imported_at,
        event.session_id,
        +event.revisit_requested,
        +event.no_answer,
      );
      db.prepare(
        "UPDATE submission_keys SET entity_id=? WHERE submission_key=?",
      ).run(event.id, submissionKey);
      if (event.route_id)
        db.prepare(
          "UPDATE route_stops SET completed_at=? WHERE route_id=? AND household_id=?",
        ).run(event.occurred_at, event.route_id, event.household_id);
      if (event.follow_up_action)
        db.prepare("INSERT INTO follow_ups VALUES (?,?,?,?,?,NULL)").run(
          randomUUID(),
          event.household_id,
          event.id,
          event.follow_up_action,
          event.follow_up_date,
        );
      audit(user, "append", "visit", event.id, {
        household_id: event.household_id,
        outcome: event.outcome,
      });
      await recordEvent({ type: "canvassing.visit.appended", ...event });
      return json(res, 201, event);
    }
    if (
      req.method === "POST" &&
      /^\/api\/canvassing\/households\/[^/]+\/flyer-status$/.test(url.pathname)
    ) {
      const householdId = url.pathname.split("/").at(-2)!,
        input = JSON.parse(await body(req)),
        flyerDelivered = input.flyer_delivered;
      if (typeof flyerDelivered !== "boolean")
        return json(res, 400, {
          error: "flyer_delivered must be true or false",
        });
      const household = db
        .prepare("SELECT id FROM households WHERE id=?")
        .get(householdId);
      if (!household) return json(res, 404, { error: "household not found" });
      const current = db
        .prepare(
          "SELECT flyer_delivered FROM household_flyer_state WHERE household_id=?",
        )
        .get(householdId) as { flyer_delivered: number };
      if (Boolean(current.flyer_delivered) === flyerDelivered)
        return json(res, 200, {
          household_id: householdId,
          flyer_delivered: flyerDelivered,
          changed: false,
        });
      const previous = db
          .prepare(
            "SELECT id FROM household_flyer_events WHERE household_id=? ORDER BY occurred_at DESC,rowid DESC LIMIT 1",
          )
          .get(householdId) as { id: string } | undefined,
        event = {
          id: randomUUID(),
          household_id: householdId,
          occurred_at: input.occurred_at ?? now(),
          user_id: user,
          flyer_delivered: flyerDelivered,
          reason: input.reason ?? "manual household flyer correction",
          source: input.source ?? "manual_correction",
          previous_event_id: previous?.id ?? null,
        };
      db.prepare(
        "INSERT INTO household_flyer_events VALUES (?,?,?,?,?,?,?,?)",
      ).run(
        event.id,
        event.household_id,
        event.occurred_at,
        event.user_id,
        +event.flyer_delivered,
        event.reason,
        event.source,
        event.previous_event_id,
      );
      audit(user, "correct", "household_flyer_status", householdId, event);
      await recordEvent({
        type: "canvassing.household.flyer_status_corrected",
        ...event,
      });
      return json(res, 201, { ...event, changed: true });
    }
    if (
      req.method === "GET" &&
      /^\/api\/canvassing\/households\/[^/]+\/contacts$/.test(url.pathname)
    ) {
      if (role === "volunteer")
        return json(res, 403, {
          error: "private contact details require candidate role",
        });
      const householdId = url.pathname.split("/").at(-2)!;
      return json(
        res,
        200,
        db
          .prepare(
            `SELECT p.id person_id,p.name,p.phone,p.email,
             p.mailing_list_consent,p.last_updated_at,
             a.civic_number_effective civic_number,
             a.street_effective street,
             trim(a.civic_number_effective||' '||a.street_effective) address_label
             FROM effective_people p
             JOIN households h ON h.id=p.household_id
             JOIN effective_addresses a ON a.id=h.address_id
             WHERE p.household_id=? ORDER BY p.name,p.id`,
          )
          .all(householdId),
      );
    }
    if (
      req.method === "POST" &&
      /^\/api\/canvassing\/households\/[^/]+\/contacts$/.test(url.pathname)
    ) {
      if (role === "volunteer")
        return json(res, 403, {
          error: "private contact details require candidate role",
        });
      const householdId = url.pathname.split("/").at(-2)!,
        input = JSON.parse(await body(req)),
        name = String(input.name ?? "").trim(),
        phone = String(input.phone ?? "").trim(),
        email = String(input.email ?? "").trim(),
        mailingListConsent = Boolean(input.mailing_list_consent);
      if (!name && !phone && !email)
        return json(res, 400, {
          error: "Provide a name, phone number, or email address",
        });
      if (
        name.length > 200 ||
        phone.length > 50 ||
        email.length > 254 ||
        (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      )
        return json(res, 400, { error: "Contact details are invalid" });
      if (mailingListConsent && !email)
        return json(res, 400, {
          error: "An email address is required for mailing-list consent",
        });
      if (
        !db.prepare("SELECT 1 FROM households WHERE id=?").get(householdId)
      )
        return json(res, 404, { error: "household not found" });
      const timestamp = input.occurred_at ?? now();
      let personId = String(input.person_id ?? "");
      if (personId) {
        const person = db
          .prepare("SELECT id FROM people WHERE id=? AND household_id=?")
          .get(personId, householdId);
        if (!person)
          return json(res, 404, {
            error: "contact person not found for this household",
          });
      } else {
        personId = randomUUID();
        db.prepare(
          "INSERT INTO people (id,household_id,name,phone,email,voluntarily_supplied,created_at,mailing_list_consent) VALUES (?,?,?,?,?,?,?,?)",
        ).run(
          personId,
          householdId,
          name,
          phone,
          email,
          1,
          timestamp,
          +mailingListConsent,
        );
      }
      const previous = db
          .prepare(
            "SELECT id FROM person_contact_events WHERE person_id=? ORDER BY occurred_at DESC,rowid DESC LIMIT 1",
          )
          .get(personId) as { id: string } | undefined,
        event = {
          id: randomUUID(),
          person_id: personId,
          household_id: householdId,
          occurred_at: timestamp,
          user_id: user,
          name,
          phone,
          email,
          mailing_list_consent: mailingListConsent,
          voluntarily_supplied: true,
          source: input.source ?? "candidate",
          previous_event_id: previous?.id ?? null,
        };
      db.prepare(
        "INSERT INTO person_contact_events VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
      ).run(
        event.id,
        event.person_id,
        event.household_id,
        event.occurred_at,
        event.user_id,
        event.name,
        event.phone,
        event.email,
        +event.mailing_list_consent,
        +event.voluntarily_supplied,
        event.source,
        event.previous_event_id,
      );
      audit(user, "append", "person_contact", personId, {
        household_id: householdId,
        mailing_list_consent: mailingListConsent,
      });
      await recordEvent({
        type: "canvassing.person_contact.appended",
        event_id: event.id,
        person_id: personId,
        household_id: householdId,
        mailing_list_consent: mailingListConsent,
        source: event.source,
      });
      const address = db
        .prepare(
          `SELECT a.civic_number_effective civic_number,
           a.street_effective street,
           trim(a.civic_number_effective||' '||a.street_effective) address_label
           FROM households h JOIN effective_addresses a ON a.id=h.address_id
           WHERE h.id=?`,
        )
        .get(householdId) as {
        civic_number: string;
        street: string;
        address_label: string;
      };
      return json(res, 201, {
        person_id: personId,
        household_id: householdId,
        name,
        phone,
        email,
        mailing_list_consent: mailingListConsent,
        last_updated_at: timestamp,
        ...address,
      });
    }
    if (
      req.method === "POST" &&
      url.pathname === "/api/canvassing/undo-latest"
    ) {
      const input = JSON.parse(await body(req));
      const sessionId = String(input.session_id ?? "");
      const visit = db
        .prepare(
          "SELECT v.* FROM active_visits v WHERE (?='' OR v.session_id=?) ORDER BY v.occurred_at DESC,v.id DESC LIMIT 1",
        )
        .get(sessionId, sessionId) as any;
      const stopEvent = db
        .prepare(
          "SELECT * FROM route_stop_events WHERE (?='' OR session_id=?) AND event_type='skip' AND NOT EXISTS(SELECT 1 FROM route_stop_events later WHERE later.route_stop_id=route_stop_events.route_stop_id AND later.event_type='unskip' AND later.occurred_at>route_stop_events.occurred_at) ORDER BY occurred_at DESC,rowid DESC LIMIT 1",
        )
        .get(sessionId, sessionId) as any;
      if (!visit && !stopEvent)
        return json(res, 404, { error: "no stop event to undo" });
      if (visit && (!stopEvent || visit.occurred_at >= stopEvent.occurred_at)) {
        const correction = {
          id: randomUUID(),
          visit_id: visit.id,
          occurred_at: now(),
          user_id: user,
          correction_type: "undo",
          reason: input.reason ?? "field undo",
          source: "manual_correction",
        };
        db.prepare("INSERT INTO visit_corrections VALUES (?,?,?,?,?,?,?)").run(
          correction.id,
          correction.visit_id,
          correction.occurred_at,
          correction.user_id,
          correction.correction_type,
          correction.reason,
          correction.source,
        );
        if (visit.route_id)
          db.prepare(
            "UPDATE route_stops SET completed_at=NULL WHERE route_id=? AND household_id=? AND NOT EXISTS(SELECT 1 FROM active_visits av WHERE av.route_id=? AND av.household_id=?)",
          ).run(
            visit.route_id,
            visit.household_id,
            visit.route_id,
            visit.household_id,
          );
        audit(user, "correct", "visit", visit.id, correction);
        await recordEvent({
          type: "canvassing.visit.corrected",
          ...correction,
        });
        return json(res, 201, { undone: "visit", correction });
      }
      const correction = {
        id: randomUUID(),
        route_stop_id: stopEvent.route_stop_id,
        session_id: stopEvent.session_id,
        occurred_at: now(),
        user_id: user,
        event_type: "unskip",
        detail_json: JSON.stringify({
          corrects: stopEvent.id,
          reason: input.reason ?? "field undo",
        }),
      };
      db.prepare("INSERT INTO route_stop_events VALUES (?,?,?,?,?,?,?)").run(
        correction.id,
        correction.route_stop_id,
        correction.session_id,
        correction.occurred_at,
        correction.user_id,
        correction.event_type,
        correction.detail_json,
      );
      db.prepare("UPDATE route_stops SET skipped=0 WHERE id=?").run(
        stopEvent.route_stop_id,
      );
      await recordEvent({
        type: "canvassing.route_stop.corrected",
        ...correction,
      });
      return json(res, 201, { undone: "skip", correction });
    }
    if (
      req.method === "POST" &&
      /^\/api\/canvassing\/routes\/[^/]+\/followup-sample$/.test(url.pathname)
    ) {
      if (role === "volunteer")
        return json(res, 403, {
          error: "follow-up sampling requires candidate role",
        });
      const routeId = url.pathname.split("/").at(-2)!;
      const existing = db
        .prepare("SELECT * FROM followup_samples WHERE source_route_id=?")
        .get(routeId) as any;
      if (existing)
        return json(res, 409, {
          error:
            existing.status === "accepted"
              ? "accepted follow-up samples cannot be regenerated"
              : "a stable draft already exists for this route",
          sample: followupSample(existing.id),
        });
      const input = JSON.parse(await body(req));
      const totalStops = Number(
        (
          db
            .prepare("SELECT count(*) count FROM route_stops WHERE route_id=?")
            .get(routeId) as any
        )?.count ?? 0,
      );
      const eligible = sourceSamplingStops(routeId);
      if (!totalStops || eligible.length !== totalStops)
        return json(res, 400, {
          error: "source flyer route must be complete before sampling",
          route_stops: totalStops,
          completed_flyer_stops: eligible.length,
        });
      const flyerDate = String(input.flyer_date ?? now().slice(0, 10));
      const targetCount =
        input.target_count == null ? undefined : Number(input.target_count);
      const percentage =
        targetCount == null ? Number(input.percentage ?? 20) : null;
      const seed = String(input.seed ?? `followup:${routeId}:${flyerDate}`);
      const selected = distributedSample(eligible, {
        seed,
        percentage: percentage ?? undefined,
        targetCount,
      });
      const sample = {
        id: randomUUID(),
        source_route_id: routeId,
        sampling_mode: targetCount == null ? "percentage" : "target_count",
        percentage,
        target_count: targetCount ?? null,
        seed,
        flyer_date: flyerDate,
        scheduled_for: String(
          input.scheduled_for ?? defaultFollowupDate(flyerDate),
        ),
        created_at: now(),
      };
      db.exec("BEGIN");
      try {
        db.prepare(
          "INSERT INTO followup_samples (id,source_route_id,followup_route_id,sampling_mode,percentage,target_count,seed,status,flyer_date,scheduled_for,created_by,created_at,accepted_at) VALUES (?,?,NULL,?,?,?,?, 'draft',?,?,?,?,NULL)",
        ).run(
          sample.id,
          sample.source_route_id,
          sample.sampling_mode,
          sample.percentage,
          sample.target_count,
          sample.seed,
          sample.flyer_date,
          sample.scheduled_for,
          user,
          sample.created_at,
        );
        const insertItem = db.prepare(
          "INSERT INTO followup_sample_items VALUES (?,?,?,1,NULL)",
        );
        selected.forEach((stop, index) =>
          insertItem.run(sample.id, stop.household_id, index + 1),
        );
        db.prepare(
          "INSERT INTO followup_sample_events VALUES (?,?,?,?,?,?)",
        ).run(
          randomUUID(),
          sample.id,
          sample.created_at,
          user,
          "generate",
          JSON.stringify({
            eligible: eligible.length,
            selected: selected.length,
            seed,
            sampling_mode: sample.sampling_mode,
            percentage,
            target_count: targetCount ?? null,
          }),
        );
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
      await recordEvent({
        type: "canvassing.followup_sample.generated",
        ...sample,
        selected_household_ids: selected.map((stop) => stop.household_id),
      });
      return json(res, 201, followupSample(sample.id));
    }
    if (
      req.method === "POST" &&
      /^\/api\/canvassing\/followup-samples\/[^/]+\/override$/.test(
        url.pathname,
      )
    ) {
      if (role === "volunteer")
        return json(res, 403, {
          error: "sample editing requires candidate role",
        });
      const sampleId = url.pathname.split("/").at(-2)!,
        sample = followupSample(sampleId);
      if (!sample) return json(res, 404, { error: "sample not found" });
      if (sample.status === "accepted")
        return json(res, 409, {
          error: "accepted follow-up routes are immutable",
        });
      const input = JSON.parse(await body(req)) as SampleOverride;
      if (!["include", "exclude", "reorder"].includes(input.type))
        return json(res, 400, { error: "invalid sample override" });
      const available = sourceSamplingStops(sample.source_route_id).map(
        (stop) => stop.household_id,
      );
      const next = applySampleOverrides(sample.household_ids, available, [
        input,
      ]);
      db.exec("BEGIN");
      try {
        db.prepare(
          "UPDATE followup_sample_items SET included=0,manual_order=NULL WHERE sample_id=?",
        ).run(sampleId);
        const upsert = db.prepare(
          "INSERT INTO followup_sample_items (sample_id,household_id,base_rank,included,manual_order) VALUES (?,?,?,1,?) ON CONFLICT(sample_id,household_id) DO UPDATE SET included=1,manual_order=excluded.manual_order",
        );
        next.forEach((householdId, index) =>
          upsert.run(sampleId, householdId, 1_000_000 + index, index + 1),
        );
        const occurred = now();
        db.prepare(
          "INSERT INTO followup_sample_events VALUES (?,?,?,?,?,?)",
        ).run(
          randomUUID(),
          sampleId,
          occurred,
          user,
          input.type,
          JSON.stringify(input),
        );
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
      await recordEvent({
        type: `canvassing.followup_sample.${input.type}`,
        sample_id: sampleId,
        user_id: user,
        occurred_at: now(),
        override: input,
        resulting_household_ids: next,
      });
      return json(res, 200, followupSample(sampleId));
    }
    if (
      req.method === "POST" &&
      /^\/api\/canvassing\/followup-samples\/[^/]+\/schedule$/.test(
        url.pathname,
      )
    ) {
      if (role === "volunteer")
        return json(res, 403, {
          error: "schedule editing requires candidate role",
        });
      const sampleId = url.pathname.split("/").at(-2)!,
        sample = followupSample(sampleId);
      if (!sample) return json(res, 404, { error: "sample not found" });
      const input = JSON.parse(await body(req)),
        scheduledFor = String(input.scheduled_for ?? "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledFor))
        return json(res, 400, { error: "scheduled_for must be YYYY-MM-DD" });
      db.prepare("UPDATE followup_samples SET scheduled_for=? WHERE id=?").run(
        scheduledFor,
        sampleId,
      );
      if (sample.followup_route_id)
        db.prepare("UPDATE routes SET scheduled_for=? WHERE id=?").run(
          scheduledFor,
          sample.followup_route_id,
        );
      const occurred = now();
      db.prepare("INSERT INTO followup_sample_events VALUES (?,?,?,?,?,?)").run(
        randomUUID(),
        sampleId,
        occurred,
        user,
        "reschedule",
        JSON.stringify({ scheduled_for: scheduledFor }),
      );
      await recordEvent({
        type: "canvassing.followup_sample.rescheduled",
        sample_id: sampleId,
        scheduled_for: scheduledFor,
        user_id: user,
        occurred_at: occurred,
      });
      return json(res, 200, followupSample(sampleId));
    }
    if (
      req.method === "POST" &&
      /^\/api\/canvassing\/followup-samples\/[^/]+\/accept$/.test(url.pathname)
    ) {
      if (role === "volunteer")
        return json(res, 403, {
          error: "sample acceptance requires candidate role",
        });
      const sampleId = url.pathname.split("/").at(-2)!,
        sample = followupSample(sampleId);
      if (!sample) return json(res, 404, { error: "sample not found" });
      if (sample.status === "accepted") return json(res, 200, sample);
      if (!sample.household_ids.length)
        return json(res, 400, { error: "cannot accept an empty sample" });
      const source = db
        .prepare("SELECT name FROM routes WHERE id=?")
        .get(sample.source_route_id) as { name: string };
      const routeId = randomUUID(),
        acceptedAt = now();
      db.exec("BEGIN");
      try {
        db.prepare(
          "INSERT INTO routes (id,name,status,created_by,created_at,resumed_at,route_kind,source_route_id,scheduled_for,accepted_at) VALUES (?,?, 'active',?,?,NULL,'followup_canvass',?,?,?)",
        ).run(
          routeId,
          `${source.name} follow-up`,
          user,
          acceptedAt,
          sample.source_route_id,
          sample.scheduled_for,
          acceptedAt,
        );
        const insertStop = db.prepare(
          "INSERT INTO route_stops VALUES (?,?,?,?,NULL,NULL,0)",
        );
        sample.household_ids.forEach((householdId: string, index: number) =>
          insertStop.run(randomUUID(), routeId, householdId, index + 1),
        );
        db.prepare(
          "UPDATE followup_samples SET status='accepted',followup_route_id=?,accepted_at=? WHERE id=?",
        ).run(routeId, acceptedAt, sampleId);
        db.prepare(
          "INSERT INTO followup_sample_events VALUES (?,?,?,?,?,'{}')",
        ).run(randomUUID(), sampleId, acceptedAt, user, "accept");
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
      await recordEvent({
        type: "canvassing.followup_sample.accepted",
        sample_id: sampleId,
        source_route_id: sample.source_route_id,
        followup_route_id: routeId,
        scheduled_for: sample.scheduled_for,
        accepted_at: acceptedAt,
        household_ids: sample.household_ids,
      });
      return json(res, 201, followupSample(sampleId));
    }
    if (
      req.method === "POST" &&
      url.pathname === "/api/canvassing/neighbourhood-conversations"
    ) {
      const input = JSON.parse(await body(req)),
        submissionKey = String(input.submission_key ?? "");
      if (!submissionKey)
        return json(res, 400, { error: "submission_key is required" });
      try {
        db.prepare(
          "INSERT INTO submission_keys VALUES (?,?,'neighbourhood_conversation',NULL)",
        ).run(submissionKey, now());
      } catch {
        return json(res, 409, {
          error: "duplicate submission ignored",
          submission_key: submissionKey,
        });
      }
      if (role === "volunteer") {
        input.political_outcome = null;
        input.possible_local_representative = false;
        input.possible_councillor_candidate = false;
      }
      const conversation = {
        id: randomUUID(),
        occurred_at: input.occurred_at ?? now(),
        user_id: user,
        lon: Number(input.lon),
        lat: Number(input.lat),
        location_accuracy_m:
          input.location_accuracy_m == null
            ? null
            : Number(input.location_accuracy_m),
        issue_discussed: String(input.issue_discussed ?? ""),
        political_outcome: input.political_outcome ?? null,
        possible_volunteer: Boolean(input.possible_volunteer),
        possible_local_representative: Boolean(
          input.possible_local_representative,
        ),
        possible_councillor_candidate: Boolean(
          input.possible_councillor_candidate,
        ),
        follow_up_requested: Boolean(input.follow_up_requested),
        household_id: input.household_id ?? null,
        route_id: input.route_id ?? null,
        source: role === "volunteer" ? "volunteer" : "candidate",
        created_at: now(),
      };
      if (
        !Number.isFinite(conversation.lon) ||
        !Number.isFinite(conversation.lat)
      )
        return json(res, 400, { error: "approximate location is required" });
      db.prepare(
        "INSERT INTO neighbourhood_conversations VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      ).run(
        conversation.id,
        conversation.occurred_at,
        conversation.user_id,
        conversation.lon,
        conversation.lat,
        conversation.location_accuracy_m,
        conversation.issue_discussed,
        conversation.political_outcome,
        +conversation.possible_volunteer,
        +conversation.possible_local_representative,
        +conversation.possible_councillor_candidate,
        +conversation.follow_up_requested,
        conversation.household_id,
        conversation.route_id,
        conversation.source,
        conversation.created_at,
      );
      db.prepare(
        "UPDATE submission_keys SET entity_id=? WHERE submission_key=?",
      ).run(conversation.id, submissionKey);
      if (
        input.complete_household_attempt &&
        conversation.household_id &&
        conversation.route_id
      ) {
        const stop = db
          .prepare(
            "SELECT id FROM route_stops WHERE route_id=? AND household_id=?",
          )
          .get(conversation.route_id, conversation.household_id) as
          { id: string } | undefined;
        if (stop) {
          const completion = {
            id: randomUUID(),
            route_stop_id: stop.id,
            conversation_id: conversation.id,
            occurred_at: conversation.occurred_at,
            user_id: user,
            event_type: "complete",
            detail_json: JSON.stringify({
              source: "neighbourhood_conversation",
            }),
          };
          db.prepare(
            "INSERT INTO route_stop_completion_events VALUES (?,?,?,?,?,?,?)",
          ).run(
            completion.id,
            completion.route_stop_id,
            completion.conversation_id,
            completion.occurred_at,
            completion.user_id,
            completion.event_type,
            completion.detail_json,
          );
          db.prepare("UPDATE route_stops SET completed_at=? WHERE id=?").run(
            conversation.occurred_at,
            stop.id,
          );
        }
      }
      audit(user, "append", "neighbourhood_conversation", conversation.id, {
        household_id: conversation.household_id,
        route_id: conversation.route_id,
      });
      await recordEvent({
        type: "canvassing.neighbourhood_conversation.appended",
        ...conversation,
        complete_household_attempt: Boolean(input.complete_household_attempt),
      });
      return json(res, 201, conversation);
    }
    if (
      req.method === "POST" &&
      url.pathname === "/api/canvassing/recruitment/areas"
    ) {
      if (role === "volunteer")
        return json(res, 403, { error: "recruitment data is private" });
      const input = JSON.parse(await body(req)),
        id = randomUUID(),
        occurred = now();
      db.prepare("INSERT INTO recruitment_areas VALUES (?,?,?)").run(
        id,
        String(input.name),
        occurred,
      );
      db.prepare(
        "INSERT INTO recruitment_status_events VALUES (?,?,NULL,'area','candidate_needed',?,?,?,'{}')",
      ).run(randomUUID(), id, occurred, user, "manual");
      await recordEvent({
        type: "canvassing.recruitment_area.created",
        id,
        name: input.name,
        occurred_at: occurred,
        user_id: user,
      });
      return json(res, 201, {
        id,
        name: input.name,
        status: "candidate_needed",
      });
    }
    if (
      req.method === "POST" &&
      /^\/api\/canvassing\/recruitment\/areas\/[^/]+\/status$/.test(
        url.pathname,
      )
    ) {
      if (role === "volunteer")
        return json(res, 403, { error: "recruitment data is private" });
      const areaId = url.pathname.split("/").at(-2)!,
        input = JSON.parse(await body(req)),
        status = String(input.status);
      if (!recruitmentStatuses.has(status))
        return json(res, 400, { error: "invalid recruitment status" });
      const event = {
        id: randomUUID(),
        area_id: areaId,
        occurred_at: now(),
        user_id: user,
        status,
      };
      db.prepare(
        "INSERT INTO recruitment_status_events VALUES (?,?,NULL,'area',?,?,?,?,?)",
      ).run(
        event.id,
        event.area_id,
        event.status,
        event.occurred_at,
        event.user_id,
        "manual",
        JSON.stringify({ note: input.note ?? null }),
      );
      await recordEvent({
        type: "canvassing.recruitment_area.status_appended",
        ...event,
      });
      return json(res, 201, event);
    }
    if (
      req.method === "POST" &&
      url.pathname === "/api/canvassing/recruitment/prospects"
    ) {
      if (role === "volunteer")
        return json(res, 403, { error: "recruitment data is private" });
      const input = JSON.parse(await body(req)),
        areaId = String(input.area_id ?? "owen-sound-citywide");
      let visitId = input.visit_id ?? null;
      if (!visitId && input.household_id)
        visitId =
          (
            db
              .prepare(
                "SELECT id FROM active_visits WHERE household_id=? ORDER BY occurred_at DESC LIMIT 1",
              )
              .get(input.household_id) as any
          )?.id ?? null;
      const prospect = {
        id: randomUUID(),
        area_id: areaId,
        display_name: input.display_name ?? null,
        household_id: input.household_id ?? null,
        visit_id: visitId,
        conversation_id: input.conversation_id ?? null,
        role_interest: String(input.role_interest ?? "candidate"),
        created_by: user,
        created_at: now(),
      };
      db.prepare(
        "INSERT INTO recruitment_prospects VALUES (?,?,?,?,?,?,?,?,?)",
      ).run(
        prospect.id,
        prospect.area_id,
        prospect.display_name,
        prospect.household_id,
        prospect.visit_id,
        prospect.conversation_id,
        prospect.role_interest,
        prospect.created_by,
        prospect.created_at,
      );
      db.prepare(
        "INSERT INTO recruitment_status_events VALUES (?,?,?,'prospect','potential_candidate_identified',?,?,?,'{}')",
      ).run(
        randomUUID(),
        prospect.area_id,
        prospect.id,
        prospect.created_at,
        user,
        prospect.conversation_id
          ? "neighbourhood_conversation"
          : prospect.visit_id
            ? "household_visit"
            : "manual",
      );
      await recordEvent({
        type: "canvassing.recruitment_prospect.created",
        ...prospect,
      });
      return json(res, 201, {
        ...prospect,
        status: "potential_candidate_identified",
      });
    }
    if (
      req.method === "POST" &&
      /^\/api\/canvassing\/recruitment\/prospects\/[^/]+\/status$/.test(
        url.pathname,
      )
    ) {
      if (role === "volunteer")
        return json(res, 403, { error: "recruitment data is private" });
      const prospectId = url.pathname.split("/").at(-2)!,
        input = JSON.parse(await body(req)),
        status = String(input.status);
      if (!recruitmentStatuses.has(status))
        return json(res, 400, { error: "invalid recruitment status" });
      const prospect = db
        .prepare("SELECT area_id FROM recruitment_prospects WHERE id=?")
        .get(prospectId) as { area_id: string } | undefined;
      if (!prospect) return json(res, 404, { error: "prospect not found" });
      const occurred = now();
      db.prepare(
        "INSERT INTO recruitment_status_events VALUES (?,?,?,'prospect',?,?,?,?,?)",
      ).run(
        randomUUID(),
        prospect.area_id,
        prospectId,
        status,
        occurred,
        user,
        "manual",
        JSON.stringify({ note: input.note ?? null }),
      );
      await recordEvent({
        type: "canvassing.recruitment_prospect.status_appended",
        prospect_id: prospectId,
        area_id: prospect.area_id,
        status,
        occurred_at: occurred,
        user_id: user,
      });
      return json(res, 201, {
        prospect_id: prospectId,
        status,
        occurred_at: occurred,
      });
    }
    if (
      req.method === "GET" &&
      url.pathname === "/api/canvassing/address-review"
    ) {
      if (role === "volunteer")
        return json(res, 403, {
          error: "address review requires candidate role",
        });
      const queue = String(url.searchParams.get("queue") ?? "");
      const rows = db
        .prepare(
          "SELECT * FROM address_review_records ORDER BY label LIMIT 1000",
        )
        .all() as any[];
      return json(
        res,
        200,
        rows
          .filter(
            (row) =>
              !queue ||
              (JSON.parse(row.queue_flags_json) as string[]).includes(queue),
          )
          .map((row) => ({
            ...row,
            queue_flags: JSON.parse(row.queue_flags_json),
            imported_geometry: JSON.parse(row.imported_geometry_json),
            queue_flags_json: undefined,
            imported_geometry_json: undefined,
          })),
      );
    }
    if (req.method === "POST" && url.pathname === "/api/canvassing/routes") {
      const input = JSON.parse(await body(req));
      const id = randomUUID(),
        created = now();
      db.exec("BEGIN");
      try {
        db.prepare(
          "INSERT INTO routes (id,name,status,created_by,created_at,resumed_at,route_kind,source_route_id,scheduled_for,accepted_at) VALUES (?,?,?,?,?,NULL,'flyer_delivery',NULL,NULL,NULL)",
        ).run(
          id,
          input.name || `Route ${created.slice(0, 10)}`,
          "active",
          user,
          created,
        );
        const insert = db.prepare(
          "INSERT INTO route_stops VALUES (?,?,?,?,?,NULL,0)",
        );
        (input.household_ids ?? []).forEach(
          (householdId: string, index: number) =>
            insert.run(
              randomUUID(),
              id,
              householdId,
              index + 1,
              input.street_side ?? null,
            ),
        );
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
      audit(user, "create", "route", id, {
        stop_count: input.household_ids?.length ?? 0,
      });
      return json(res, 201, { id });
    }
    if (
      req.method === "POST" &&
      /^\/api\/canvassing\/routes\/[^/]+\/reorder$/.test(url.pathname)
    ) {
      const routeId = url.pathname.split("/").at(-2)!,
        input = JSON.parse(await body(req)),
        ordered = Array.isArray(input.household_ids) ? input.household_ids : [];
      db.exec("BEGIN");
      try {
        const update = db.prepare(
          "UPDATE route_stops SET sequence=? WHERE route_id=? AND household_id=?",
        );
        ordered.forEach((householdId: string, index: number) =>
          update.run(index + 1, routeId, householdId),
        );
        const event = {
          id: randomUUID(),
          route_id: routeId,
          occurred_at: now(),
          user_id: user,
          reason: input.reason ?? "manual reorder",
          ordered_household_ids_json: JSON.stringify(ordered),
        };
        db.prepare("INSERT INTO route_order_events VALUES (?,?,?,?,?,?)").run(
          event.id,
          event.route_id,
          event.occurred_at,
          event.user_id,
          event.reason,
          event.ordered_household_ids_json,
        );
        db.exec("COMMIT");
        audit(user, "reorder", "route", routeId, {
          count: ordered.length,
          reason: event.reason,
        });
        await recordEvent({ type: "canvassing.route.reordered", ...event });
        return json(res, 200, {
          route_id: routeId,
          stop_count: ordered.length,
        });
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    }
    if (
      req.method === "PATCH" &&
      url.pathname.startsWith("/api/canvassing/routes/")
    ) {
      const id = url.pathname.split("/").at(-1)!;
      const input = JSON.parse(await body(req));
      db.prepare("UPDATE routes SET status=?,resumed_at=? WHERE id=?").run(
        input.status,
        input.status === "active" ? now() : null,
        id,
      );
      audit(user, "update", "route", id, input);
      return json(res, 200, { id, status: input.status });
    }
    if (req.method === "POST" && url.pathname === "/api/canvassing/sessions") {
      const input = JSON.parse(await body(req)),
        id = randomUUID(),
        started = now();
      db.prepare("INSERT INTO route_sessions VALUES (?,?,?,?,NULL,?)").run(
        id,
        input.route_id,
        user,
        started,
        Number(input.flyers_at_start ?? 0),
      );
      db.prepare("INSERT INTO route_session_events VALUES (?,?,?,?,?)").run(
        randomUUID(),
        id,
        started,
        "start",
        "{}",
      );
      audit(user, "start", "route_session", id, { route_id: input.route_id });
      await recordEvent({
        type: "canvassing.route_session.started",
        id,
        route_id: input.route_id,
        user_id: user,
        occurred_at: started,
      });
      return json(res, 201, sessionSummary(id));
    }
    if (
      req.method === "POST" &&
      /^\/api\/canvassing\/sessions\/[^/]+\/(pause|resume|end)$/.test(
        url.pathname,
      )
    ) {
      const parts = url.pathname.split("/"),
        id = parts.at(-2)!,
        eventType = parts.at(-1)!,
        occurred = now();
      const session = db
        .prepare("SELECT * FROM route_sessions WHERE id=?")
        .get(id) as any;
      if (!session) return json(res, 404, { error: "session not found" });
      db.prepare("INSERT INTO route_session_events VALUES (?,?,?,?,?)").run(
        randomUUID(),
        id,
        occurred,
        eventType,
        "{}",
      );
      if (eventType === "end")
        db.prepare("UPDATE route_sessions SET ended_at=? WHERE id=?").run(
          occurred,
          id,
        );
      audit(user, eventType, "route_session", id, {});
      await recordEvent({
        type: `canvassing.route_session.${eventType}`,
        id,
        user_id: user,
        occurred_at: occurred,
      });
      return json(res, 200, sessionSummary(id));
    }
    if (
      req.method === "POST" &&
      /^\/api\/canvassing\/route-stops\/[^/]+\/skip$/.test(url.pathname)
    ) {
      const stopId = url.pathname.split("/").at(-2)!,
        input = JSON.parse(await body(req)),
        event = {
          id: randomUUID(),
          route_stop_id: stopId,
          session_id: input.session_id ?? null,
          occurred_at: now(),
          user_id: user,
          event_type: "skip",
          detail_json: JSON.stringify({ reason: input.reason ?? "field skip" }),
        };
      db.prepare("INSERT INTO route_stop_events VALUES (?,?,?,?,?,?,?)").run(
        event.id,
        event.route_stop_id,
        event.session_id,
        event.occurred_at,
        event.user_id,
        event.event_type,
        event.detail_json,
      );
      db.prepare("UPDATE route_stops SET skipped=1 WHERE id=?").run(stopId);
      await recordEvent({ type: "canvassing.route_stop.skipped", ...event });
      return json(res, 201, event);
    }
    if (
      req.method === "GET" &&
      url.pathname === "/api/canvassing/structure-splits"
    ) {
      const active = latestSplitEvents().filter(
        (event) => event.event_type === "accept",
        ),
        hiddenParentIds = new Set(
          active.map((event) => event.parent_structure_id),
        );
      return json(res, 200, {
        hidden_parent_ids: [...hiddenParentIds],
        features: active.flatMap((event) =>
          event.payload.children
            .filter((child: any) => !hiddenParentIds.has(child.id))
            .map((child: any) => ({
              type: "Feature",
              id: child.id,
              properties: {
                structure_id: child.id,
                external_source: "manual_canvassing_split",
                external_id: child.id,
                building_type: "residential",
                confidence: "manual_split",
                geometry_provenance: "manual_split",
                split_parent_structure_id: event.parent_structure_id,
                split_event_id: event.id,
                split_child_index: child.index,
                civic_label: child.civic_label,
                civic_numbers: child.civic_numbers,
              },
              geometry: child.geometry,
            })),
        ),
      });
    }
    if (
      req.method === "POST" &&
      /^\/api\/canvassing\/structures\/[^/]+\/split\/preview$/.test(
        url.pathname,
      )
    ) {
      if (role === "volunteer")
        return json(res, 403, { error: "roof splitting requires candidate role" });
      const structureId = url.pathname.split("/").at(-3)!,
        input = JSON.parse(await body(req)),
        structure = db
          .prepare(
            "SELECT id,geometry_json FROM structures WHERE id=? AND source_active=1",
          )
          .get(structureId) as
          | { id: string; geometry_json: string }
          | undefined;
      if (!structure) return json(res, 404, { error: "structure not found" });
      const geometry = JSON.parse(structure.geometry_json) as Geometry,
        method = input.method === "frontage" ? "frontage" : "cut_lines",
        cuts: SplitCut[] =
          method === "frontage"
            ? frontageCuts(
                geometry,
                Number(input.unit_count ?? 2),
                Boolean(input.rotate),
              )
            : input.cuts ?? [],
        previewId = String(input.preview_id ?? randomUUID()),
        result = splitStructure(structureId, previewId, geometry, cuts);
      return json(res, 200, { preview_id: previewId, method, cuts, ...result });
    }
    if (
      req.method === "POST" &&
      /^\/api\/canvassing\/structures\/[^/]+\/split$/.test(url.pathname)
    ) {
      if (role === "volunteer")
        return json(res, 403, { error: "roof splitting requires candidate role" });
      const structureId = url.pathname.split("/").at(-2)!,
        input = JSON.parse(await body(req)),
        submissionKey = String(input.submission_key ?? "");
      if (!submissionKey)
        return json(res, 400, { error: "submission_key is required" });
      try {
        db.prepare(
          "INSERT INTO submission_keys VALUES (?,?,'structure_split',NULL)",
        ).run(submissionKey, now());
      } catch {
        return json(res, 409, {
          error: "duplicate submission ignored",
          submission_key: submissionKey,
        });
      }
      const existing = latestSplitEvents().find(
        (event) =>
          event.parent_structure_id === structureId &&
          event.event_type === "accept",
      );
      if (existing)
        return json(res, 409, { error: "structure already has an active split" });
      const structure = db
        .prepare(
          "SELECT * FROM structures WHERE id=? AND source_active=1",
        )
        .get(structureId) as any;
      if (!structure) return json(res, 404, { error: "structure not found" });
      const eventId = randomUUID(),
        geometry = JSON.parse(structure.geometry_json) as Geometry,
        method = input.method === "frontage" ? "frontage" : "cut_lines",
        cuts: SplitCut[] =
          method === "frontage"
            ? frontageCuts(
                geometry,
                Number(input.unit_count ?? 2),
                Boolean(input.rotate),
              )
            : input.cuts ?? [],
        result = splitStructure(structureId, eventId, geometry, cuts),
        timestamp = now(),
        homes = state("candidate").households as any[],
        direct = homes.filter((home) => home.structure_id === structureId),
        references = new Set(
          (input.reference_address_ids ?? []).map(String),
        ),
        baseHomes = direct.length
          ? direct
          : homes.filter((home) => references.has(home.address_id)),
        centers = result.children.map((child) =>
          geometryCenter(JSON.stringify(child.geometry)),
        ),
        assignedChildren = new Set<number>(),
        childAddresses = new Map<number, any[]>();
      for (const home of direct) {
        let childIndex = 0,
          distance = Infinity;
        centers.forEach((center, index) => {
          const candidate = metresBetween([home.lon, home.lat], center);
          if (candidate < distance) {
            distance = candidate;
            childIndex = index;
          }
        });
        assignedChildren.add(childIndex);
        childAddresses.set(childIndex, [
          ...(childAddresses.get(childIndex) ?? []),
          home,
        ]);
      }
      const base = baseHomes[0],
        baseNumber = Number.parseInt(String(base?.civic_number ?? "0"), 10),
        street = String(base?.street ?? input.street ?? "Address review"),
        used = new Set(
          (
            db
              .prepare(
                "SELECT civic_number_effective civic_number,street_effective street FROM effective_addresses WHERE source_active=1",
              )
              .all() as any[]
          ).map(
            (row) =>
              `${String(row.street).toLowerCase()}|${String(row.civic_number)}`,
          ),
        ),
        children = result.children.map((child, index) => {
          const linked = childAddresses.get(index) ?? [];
          return {
            ...child,
            index: index + 1,
            civic_numbers: linked.map((home) => home.civic_number),
            civic_label: linked.length
              ? linked.map((home) => home.civic_number).join(" / ")
              : "",
          };
        });
      db.exec("BEGIN");
      try {
        const insertStructure = db.prepare(
            "INSERT INTO structures (id,geometry_json,building_type,external_source,external_id,source_confidence,imported_at,source_active) VALUES (?,?,?,?,?,?,?,1)",
          ),
          insertAssociation = db.prepare(
            "INSERT INTO address_association_events VALUES (?,?,?,?,?,?,?,?,?)",
          );
        for (const child of children)
          insertStructure.run(
            child.id,
            JSON.stringify(child.geometry),
            "residential",
            "manual_canvassing_split",
            child.id,
            "manual_split",
            timestamp,
          );
        for (const [index, linked] of childAddresses)
          for (const home of linked) {
            const previous = db
              .prepare(
                "SELECT id FROM address_association_events WHERE address_id=? ORDER BY occurred_at DESC,rowid DESC LIMIT 1",
              )
              .get(home.address_id) as any;
            insertAssociation.run(
              randomUUID(),
              home.address_id,
              children[index].id,
              timestamp,
              user,
              previous ? "correct" : "associate",
              "manual_verified",
              "accepted building split",
              previous?.id ?? null,
            );
          }
        const anchorIndex = children.findIndex(
          (_, index) => (childAddresses.get(index) ?? []).length > 0,
        );
        for (let index = 0; index < children.length; index++) {
          if (assignedChildren.has(index)) continue;
          const direction = anchorIndex >= 0 && index < anchorIndex ? -1 : 1;
          let offset =
              anchorIndex >= 0
                ? Math.max(1, Math.abs(index - anchorIndex))
                : index + 1,
            civic =
              Number.isFinite(baseNumber) && baseNumber > 0
                ? baseNumber + direction * offset * 2
                : index + 1;
          while (used.has(`${street.toLowerCase()}|${civic}`)) {
            offset++;
            civic = baseNumber + direction * offset * 2;
          }
          used.add(`${street.toLowerCase()}|${civic}`);
          const addressId = `address_${createHash("sha256")
              .update(`manual-split:${eventId}:${index}`)
              .digest("hex")
              .slice(0, 20)}`,
            householdId = `household_${addressId.slice(8)}`,
            [lon, lat] = centers[index];
          db.prepare(
            "INSERT INTO addresses (id,structure_id,civic_number,street,unit,label,lon,lat,external_source,external_id,association_status,imported_at,source_active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)",
          ).run(
            addressId,
            children[index].id,
            String(civic),
            street,
            "",
            `~${civic} ${street}`,
            lon,
            lat,
            "manual_split_inferred",
            children[index].id,
            "manual_split_inferred",
            timestamp,
          );
          db.prepare("INSERT INTO households VALUES (?,?,?,?)").run(
            householdId,
            addressId,
            "",
            timestamp,
          );
          children[index].civic_numbers = [String(civic)];
          children[index].civic_label = `~${civic}`;
        }
        const payload = {
          cuts,
          parent_area_m2: result.parent_area_m2,
          retained_area_ratio: result.retained_area_ratio,
          children,
        };
        db.prepare(
          "INSERT INTO structure_split_events VALUES (?,?,?,?,?,?,?,?,NULL)",
        ).run(
          eventId,
          structureId,
          timestamp,
          user,
          "accept",
          method,
          JSON.stringify(payload),
          input.reason ?? "manual roof split",
        );
        db.prepare(
          "UPDATE submission_keys SET entity_id=? WHERE submission_key=?",
        ).run(eventId, submissionKey);
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
      await writeSplitCalibration();
      audit(user, "split", "structure", structureId, {
        event_id: eventId,
        child_count: children.length,
        method,
      });
      await recordEvent({
        type: "canvassing.structure.split",
        event_id: eventId,
        parent_structure_id: structureId,
        child_ids: children.map((child) => child.id),
        method,
      });
      return json(res, 201, {
        event_id: eventId,
        parent_structure_id: structureId,
        method,
        children,
      });
    }
    if (
      req.method === "POST" &&
      /^\/api\/canvassing\/structures\/[^/]+\/split\/reverse$/.test(
        url.pathname,
      )
    ) {
      if (role === "volunteer")
        return json(res, 403, { error: "roof splitting requires candidate role" });
      const structureId = url.pathname.split("/").at(-3)!,
        latest = latestSplitEvents().find(
          (event) => event.parent_structure_id === structureId,
        );
      if (!latest || latest.event_type !== "accept")
        return json(res, 404, { error: "no active split" });
      const childIds = new Set(
          latest.payload.children.map((child: any) => child.id),
        ),
        nested = latestSplitEvents().find(
          (event) =>
            event.event_type === "accept" &&
            childIds.has(event.parent_structure_id),
        );
      if (nested)
        return json(res, 409, {
          error: "Undo the finer child split before undoing this parent split",
          nested_parent_structure_id: nested.parent_structure_id,
        });
      const timestamp = now(),
        eventId = randomUUID(),
        homes = (state("candidate").households as any[]).filter((home) =>
          childIds.has(home.structure_id),
        );
      db.exec("BEGIN");
      try {
        for (const home of homes) {
          const previous = db
            .prepare(
              "SELECT id FROM address_association_events WHERE address_id=? ORDER BY occurred_at DESC,rowid DESC LIMIT 1",
            )
            .get(home.address_id) as any;
          db.prepare(
            "INSERT INTO address_association_events VALUES (?,?,?,?,?,?,?,?,?)",
          ).run(
            randomUUID(),
            home.address_id,
            structureId,
            timestamp,
            user,
            previous ? "correct" : "associate",
            "manual_verified",
            "reversed building split",
            previous?.id ?? null,
          );
        }
        db.prepare(
          "INSERT INTO structure_split_events VALUES (?,?,?,?,?,?,?,?,?)",
        ).run(
          eventId,
          structureId,
          timestamp,
          user,
          "reverse",
          latest.method,
          JSON.stringify(latest.payload),
          "manual split reversal",
          latest.id,
        );
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
      await writeSplitCalibration();
      audit(user, "reverse_split", "structure", structureId, {
        event_id: eventId,
        restored_households: homes.length,
      });
      await recordEvent({
        type: "canvassing.structure.split_reversed",
        event_id: eventId,
        parent_structure_id: structureId,
      });
      return json(res, 201, {
        event_id: eventId,
        parent_structure_id: structureId,
        restored_households: homes.length,
      });
    }
    if (
      req.method === "POST" &&
      /^\/api\/canvassing\/structures\/[^/]+\/civic-number$/.test(url.pathname)
    ) {
      if (role === "volunteer")
        return json(res, 403, {
          error: "address correction requires candidate role",
        });
      const structureId = url.pathname.split("/").at(-2)!,
        input = JSON.parse(await body(req)),
        civicNumber = String(input.civic_number ?? "").trim(),
        street = String(input.street ?? "").trim();
      if (
        !/^[0-9][0-9A-Za-z /-]{0,19}$/.test(civicNumber) ||
        !street ||
        street.length > 100
      )
        return json(res, 400, {
          error: "Provide a civic number and street name",
        });
      const structure = db
        .prepare(
          "SELECT id,geometry_json FROM structures WHERE id=? AND source_active=1",
        )
        .get(structureId) as { id: string; geometry_json: string } | undefined;
      if (!structure) return json(res, 404, { error: "structure not found" });

      let addressIds = (state("candidate").households as any[])
        .filter((home) => home.structure_id === structureId)
        .map((home) => String(home.address_id));
      addressIds = [...new Set(addressIds)];
      if (!addressIds.length) {
        const addressId = `address_${createHash("sha256")
            .update(`manual-structure-address:${structureId}`)
            .digest("hex")
            .slice(0, 20)}`,
          householdId = `household_${addressId.slice(8)}`,
          [lon, lat] = geometryCenter(structure.geometry_json),
          timestamp = now();
        db.prepare(
          `INSERT INTO addresses
           (id,structure_id,civic_number,street,unit,label,lon,lat,external_source,external_id,association_status,imported_at,source_active)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)
           ON CONFLICT(id) DO UPDATE SET structure_id=excluded.structure_id,source_active=1`,
        ).run(
          addressId,
          structureId,
          civicNumber,
          street,
          "",
          `${civicNumber} ${street}`,
          lon,
          lat,
          "manual_canvassing",
          structureId,
          "manual_verified",
          timestamp,
        );
        db.prepare("INSERT OR IGNORE INTO households VALUES (?,?,?,?)").run(
          householdId,
          addressId,
          "",
          timestamp,
        );
        addressIds = [addressId];
      }

      const events = [];
      for (const addressId of addressIds) {
        const address = db
          .prepare("SELECT unit FROM addresses WHERE id=?")
          .get(addressId) as { unit: string } | undefined;
        if (!address) continue;
        const previous = db
            .prepare(
              "SELECT id FROM address_number_events WHERE address_id=? ORDER BY occurred_at DESC,rowid DESC LIMIT 1",
            )
            .get(addressId) as { id: string } | undefined,
          event = {
            id: randomUUID(),
            address_id: addressId,
            structure_id: structureId,
            occurred_at: now(),
            user_id: user,
            event_type: previous ? "correct" : "set",
            civic_number: civicNumber,
            street,
            unit: address.unit ?? "",
            reason: input.reason ?? "manual roof number correction",
            previous_event_id: previous?.id ?? null,
          };
        db.prepare(
          "INSERT INTO address_number_events VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        ).run(
          event.id,
          event.address_id,
          event.structure_id,
          event.occurred_at,
          event.user_id,
          event.event_type,
          event.civic_number,
          event.street,
          event.unit,
          event.reason,
          event.previous_event_id,
        );
        events.push(event);
        await recordEvent({
          type: "canvassing.address_number.appended",
          ...event,
        });
      }
      await writeAddressNumberCalibration();
      audit(user, "correct", "structure_civic_number", structureId, {
        civic_number: civicNumber,
        street,
        address_ids: addressIds,
        events: events.length,
      });
      return json(res, 201, {
        structure_id: structureId,
        civic_number: civicNumber,
        street,
        address_ids: addressIds,
        events,
      });
    }
    if (
      req.method === "POST" &&
      /^\/api\/canvassing\/addresses\/[^/]+\/association$/.test(url.pathname)
    ) {
      if (role === "volunteer")
        return json(res, 403, {
          error: "address review requires candidate role",
        });
      const addressId = url.pathname.split("/").at(-2)!,
        input = JSON.parse(await body(req)),
        previous = db
          .prepare(
            "SELECT id FROM address_association_events WHERE address_id=? ORDER BY occurred_at DESC,rowid DESC LIMIT 1",
          )
          .get(addressId) as any;
      const event = {
        id: randomUUID(),
        address_id: addressId,
        structure_id: input.structure_id ?? null,
        occurred_at: now(),
        user_id: user,
        event_type: input.structure_id
          ? previous
            ? "correct"
            : "associate"
          : "clear",
        confidence: "manual_verified",
        reason: input.reason ?? "manual map review",
        previous_event_id: previous?.id ?? null,
      };
      db.prepare(
        "INSERT INTO address_association_events VALUES (?,?,?,?,?,?,?,?,?)",
      ).run(
        event.id,
        event.address_id,
        event.structure_id,
        event.occurred_at,
        event.user_id,
        event.event_type,
        event.confidence,
        event.reason,
        event.previous_event_id,
      );
      audit(user, "associate", "address", addressId, event);
      await recordEvent({
        type: "canvassing.address_association.appended",
        ...event,
      });
      return json(res, 201, event);
    }
    if (
      req.method === "POST" &&
      /^\/api\/canvassing\/addresses\/[^/]+\/association\/undo$/.test(
        url.pathname,
      )
    ) {
      if (role === "volunteer")
        return json(res, 403, {
          error: "address review requires candidate role",
        });
      const addressId = url.pathname.split("/").at(-3)!,
        latest = db
          .prepare(
            "SELECT * FROM address_association_events WHERE address_id=? ORDER BY occurred_at DESC,rowid DESC LIMIT 1",
          )
          .get(addressId) as any;
      if (!latest)
        return json(res, 404, { error: "no manual association to correct" });
      const prior = latest.previous_event_id
          ? (db
              .prepare("SELECT * FROM address_association_events WHERE id=?")
              .get(latest.previous_event_id) as any)
          : null,
        imported = db
          .prepare("SELECT structure_id FROM addresses WHERE id=?")
          .get(addressId) as { structure_id: string | null },
        restoredStructureId = prior
          ? prior.structure_id
          : imported.structure_id,
        event = {
          id: randomUUID(),
          address_id: addressId,
          structure_id: restoredStructureId,
          occurred_at: now(),
          user_id: user,
          event_type: restoredStructureId ? "correct" : "clear",
          confidence: "manual_verified",
          reason: "reverse prior manual association",
          previous_event_id: latest.id,
        };
      db.prepare(
        "INSERT INTO address_association_events VALUES (?,?,?,?,?,?,?,?,?)",
      ).run(
        event.id,
        event.address_id,
        event.structure_id,
        event.occurred_at,
        event.user_id,
        event.event_type,
        event.confidence,
        event.reason,
        event.previous_event_id,
      );
      await recordEvent({
        type: "canvassing.address_association.corrected",
        ...event,
      });
      return json(res, 201, event);
    }
    if (
      req.method === "POST" &&
      url.pathname === "/api/canvassing/import.csv"
    ) {
      const records = parseCsv(await body(req));
      let imported = 0;
      for (const row of records) {
        const address = String(row.address ?? "").toLowerCase();
        const match = db
          .prepare(
            `SELECT h.id FROM households h JOIN effective_addresses a ON a.id=h.address_id
             WHERE lower(CASE WHEN a.number_event_id IS NOT NULL
               THEN trim(a.civic_number_effective||' '||a.street_effective||CASE WHEN a.unit_effective!='' THEN ' Unit '||a.unit_effective ELSE '' END)
               ELSE a.label END)=? LIMIT 1`,
          )
          .get(address) as any;
        if (!match) continue;
        const event = {
          household_id: match.id,
          outcome: row.outcome || "conversation",
          notes: row.notes || "",
          support_category: row.support_level || null,
          occurred_at: row.date_met || now(),
        };
        const request = {
          ...event,
          flyer_delivered: false,
          door_knocked: true,
          conversation_occurred: true,
          issue_categories: String(row.issues || "")
            .split(";")
            .filter(Boolean),
          follow_up_action: row.follow_up || null,
          source: "import",
        };
        const id = randomUUID(),
          importedAt = now();
        db.prepare(
          "INSERT INTO visits (id,occurred_at,user_id,household_id,route_id,flyer_delivered,door_knocked,outcome,conversation_occurred,issue_categories_json,notes,follow_up_action,follow_up_date,support_category,source,imported_at,session_id) VALUES (?,?,?,?,NULL,?,?,?,?,?,?,?,?,?,?,?,NULL)",
        ).run(
          id,
          request.occurred_at,
          user,
          request.household_id,
          0,
          1,
          request.outcome,
          1,
          JSON.stringify(request.issue_categories),
          request.notes,
          request.follow_up_action,
          null,
          request.support_category,
          "import",
          importedAt,
        );
        await recordEvent({
          type: "canvassing.visit.imported",
          id,
          ...request,
          imported_at: importedAt,
        });
        imported++;
      }
      const importId = randomUUID();
      db.prepare("INSERT INTO imports VALUES (?,?,?,?,?,?)").run(
        importId,
        "csv_upload",
        user,
        now(),
        imported,
        "[]",
      );
      audit(user, "import", "csv", importId, { imported });
      return json(res, 200, { imported, total_records: records.length });
    }
    if (
      req.method === "GET" &&
      url.pathname === "/api/canvassing/export/routes.csv"
    ) {
      const rows = db
        .prepare(
          `SELECT r.name route,s.sequence,
           CASE WHEN a.number_event_id IS NOT NULL
             THEN trim(a.civic_number_effective||' '||a.street_effective||CASE WHEN a.unit_effective!='' THEN ' Unit '||a.unit_effective ELSE '' END)
             ELSE a.label END address,
           h.id household_id,s.completed_at,s.skipped
           FROM route_stops s JOIN routes r ON r.id=s.route_id
           JOIN households h ON h.id=s.household_id
           JOIN effective_addresses a ON a.id=h.address_id
           ORDER BY r.name,s.sequence`,
        )
        .all() as any[];
      const headers = [
        "route",
        "sequence",
        "address",
        "household_id",
        "completed_at",
        "skipped",
      ];
      audit(user, "export", "route_csv", null, { rows: rows.length });
      return json(
        res,
        200,
        [
          headers.join(","),
          ...rows.map((row) => headers.map((h) => csvCell(row[h])).join(",")),
        ].join("\n"),
        "text/csv",
      );
    }
    if (
      req.method === "GET" &&
      url.pathname === "/api/canvassing/export/redacted.geojson"
    ) {
      const rows = state().households as any[];
      const features = rows.map((row) => ({
        type: "Feature",
        properties: {
          household_id: row.household_id,
          status: row.status,
          flyer_delivered: Boolean(row.flyer_delivered),
          door_knocked: Boolean(row.door_knocked),
        },
        geometry: { type: "Point", coordinates: [row.lon, row.lat] },
      }));
      audit(user, "export", "redacted_geojson", null, {
        features: features.length,
      });
      return json(res, 200, {
        type: "FeatureCollection",
        metadata: {
          redacted: true,
          excluded: [
            "people",
            "contact_information",
            "notes",
            "political_impressions",
          ],
        },
        features,
      });
    }
    if (
      req.method === "GET" &&
      url.pathname === "/api/canvassing/operations/status"
    )
      return json(res, 200, {
        backup: await backupStatus(),
        journal: await verifyJournal(),
        schema_version: 10,
      });
    if (req.method === "POST" && url.pathname === "/api/canvassing/backup") {
      const path = await performBackup("manual");
      audit(user, "backup", "database", null, { path });
      return json(res, 201, { path, restore_test: "passed" });
    }
    if (
      req.method === "POST" &&
      url.pathname === "/api/canvassing/maintenance/preflight"
    ) {
      const exportPath = join(
        backupDir,
        `route-export-before-maintenance-${Date.now()}.csv`,
      );
      const rows = db
        .prepare(
          `SELECT r.name,s.sequence,
           CASE WHEN a.number_event_id IS NOT NULL
             THEN trim(a.civic_number_effective||' '||a.street_effective||CASE WHEN a.unit_effective!='' THEN ' Unit '||a.unit_effective ELSE '' END)
             ELSE a.label END label,
           s.completed_at,s.skipped
           FROM route_stops s JOIN routes r ON r.id=s.route_id
           JOIN households h ON h.id=s.household_id
           JOIN effective_addresses a ON a.id=h.address_id
           ORDER BY r.name,s.sequence`,
        )
        .all() as any[];
      await writeFile(
        exportPath,
        [
          "route,sequence,address,completed_at,skipped",
          ...rows.map((row) =>
            [row.name, row.sequence, row.label, row.completed_at, row.skipped]
              .map(csvCell)
              .join(","),
          ),
        ].join("\n"),
      );
      const backupPath = await performBackup("pre-maintenance");
      audit(user, "preflight", "maintenance", null, { exportPath, backupPath });
      return json(res, 201, {
        route_export: exportPath,
        backup: backupPath,
        restore_test: "passed",
      });
    }
    return json(res, 404, { error: "not found" });
  } catch (error) {
    console.error(error);
    return json(res, 500, {
      error: error instanceof Error ? error.message : "server error",
    });
  }
});
server.listen(port, host, () =>
  console.log(`Private canvassing API listening on http://${host}:${port}`),
);
