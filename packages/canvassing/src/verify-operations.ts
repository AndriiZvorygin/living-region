import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { join, resolve } from "node:path";

const databasePath = resolve(
  process.env.CANVASS_DB ?? "private/canvassing/owen-sound.sqlite",
);
const journalPath = resolve(
  process.env.CANVASS_EVENT_LOG ?? "private/canvassing/visits.pya.jsonl",
);
const backupDirectory = resolve("private/canvassing/backups");

const database = new DatabaseSync(databasePath, { readOnly: true });
const quickCheck = database.prepare("PRAGMA quick_check").get() as {
  quick_check: string;
};
const foreignKeyProblems = database.prepare("PRAGMA foreign_key_check").all();
const schemaVersion = Number(
  (
    database
      .prepare("SELECT max(version) version FROM schema_migrations")
      .get() as any
  ).version,
);
const journalRows = Number(
  (database.prepare("SELECT count(*) count FROM journal_chain").get() as any)
    .count,
);
database.close();
if (quickCheck.quick_check !== "ok")
  throw new Error(`Database integrity failed: ${quickCheck.quick_check}`);
if (foreignKeyProblems.length)
  throw new Error(
    `Database has ${foreignKeyProblems.length} foreign-key violations`,
  );
if (schemaVersion !== 12)
  throw new Error(`Expected schema version 12, found ${schemaVersion}`);

let previous: string | null = null,
  journalCount = 0;
const journal = await readFile(journalPath, "utf8").catch(() => "");
for (const line of journal.split(/\r?\n/).filter(Boolean)) {
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
    throw new Error(`Journal chain failed at sequence ${row.sequence}`);
  previous = row.event_hash;
  journalCount++;
}
if (journalRows !== journalCount)
  throw new Error(
    `Journal has ${journalCount} records but database has ${journalRows}`,
  );

const backups = await Promise.all(
  (await readdir(backupDirectory))
    .filter((file) => file.endsWith(".sqlite"))
    .map(async (file) => ({
      file,
      modified: (await stat(join(backupDirectory, file))).mtimeMs,
    })),
);
const latest = backups.sort((a, b) => b.modified - a.modified)[0];
if (!latest) throw new Error("No SQLite backup is available");
const restored = new DatabaseSync(join(backupDirectory, latest.file), {
  readOnly: true,
});
const restoreCheck = restored.prepare("PRAGMA quick_check").get() as {
  quick_check: string;
};
restored.close();
if (restoreCheck.quick_check !== "ok")
  throw new Error(
    `Latest backup restore test failed: ${restoreCheck.quick_check}`,
  );

console.log(
  JSON.stringify(
    {
      database_integrity: "ok",
      foreign_keys: "ok",
      schema_version: schemaVersion,
      journal: { valid: true, records: journalCount },
      latest_backup: latest.file,
      restore_test: "passed",
    },
    null,
    2,
  ),
);
