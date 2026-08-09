import {
  copyFile,
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const databasePath = resolve(
    process.env.CANVASS_DB ?? "private/canvassing/owen-sound.sqlite",
  ),
  journalPath = resolve(
    process.env.CANVASS_EVENT_LOG ??
      "private/canvassing/visits.pya.jsonl",
  ),
  backupDirectory = resolve(
    process.env.CANVASS_BACKUP_DIR ?? "private/canvassing/backups",
  ),
  raw = await readFile(journalPath, "utf8"),
  timestamp = new Date().toISOString().replaceAll(":", "-").replace(".", "-"),
  archive = join(backupDirectory, `journal-before-repair-${timestamp}.jsonl`),
  rows = raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line)),
  rawHash = createHash("sha256").update(raw).digest("hex");

await mkdir(backupDirectory, { recursive: true });
await copyFile(journalPath, archive);

const events = rows.map((row) => row.event);
events.push({
  type: "canvassing.journal.reconciled",
  occurred_at: new Date().toISOString(),
  source_archive: archive,
  source_sha256: rawHash,
  source_rows: rows.length,
  reason: "serialized concurrent bulk flyer writes produced competing sequences",
});

let previous: string | null = null;
const canonical = events.map((event, index) => {
  const envelope = {
      sequence: index + 1,
      previous_hash: previous,
      event,
    },
    event_hash = createHash("sha256")
      .update(JSON.stringify(envelope))
      .digest("hex");
  previous = event_hash;
  return { ...envelope, event_hash };
});

const temporary = `${journalPath}.repairing`;
await writeFile(
  temporary,
  canonical.map((row) => JSON.stringify(row)).join("\n") + "\n",
  { mode: 0o600 },
);

const db = new DatabaseSync(databasePath);
db.exec("PRAGMA foreign_keys=ON; BEGIN");
try {
  db.exec("DELETE FROM journal_chain");
  const insert = db.prepare("INSERT INTO journal_chain VALUES (?,?,?,?)"),
    occurredAt = new Date().toISOString();
  for (const row of canonical)
    insert.run(
      row.sequence,
      row.event_hash,
      row.previous_hash,
      occurredAt,
    );
  db.prepare("INSERT INTO audit_events VALUES (?,?,?,?,?,?,?)").run(
    randomUUID(),
    occurredAt,
    "system",
    "reconcile",
    "journal_chain",
    null,
    JSON.stringify({
      archive,
      source_sha256: rawHash,
      source_rows: rows.length,
      canonical_rows: canonical.length,
    }),
  );
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
} finally {
  db.close();
}
await rename(temporary, journalPath);
console.log(
  JSON.stringify(
    {
      archive,
      source_sha256: rawHash,
      source_rows: rows.length,
      canonical_rows: canonical.length,
      final_hash: previous,
    },
    null,
    2,
  ),
);
