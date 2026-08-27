import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const { DatabaseSync } = createRequire(import.meta.url)(
  "node:sqlite",
) as typeof import("node:sqlite");

export type HistoricalStructureRow = {
  historical_structure_id: string;
  historical_household_id: string;
  historical_address_id: string;
  canonical_structure_id: string;
  match_method: string;
  confidence: "exact_structure_geometry" | "review";
  historical_label: string;
};

export function buildStructureHistoryCrosswalk(
  historicalRows: Array<{
    structure_id: string;
    household_id: string;
    address_id: string;
    label: string;
  }>,
  currentStructureIds: ReadonlySet<string>,
) {
  const rows: HistoricalStructureRow[] = [];
  for (const row of historicalRows) {
    if (!row.structure_id || !row.household_id || !row.address_id) continue;
    const canonical = currentStructureIds.has(row.structure_id)
      ? row.structure_id
      : "";
    rows.push({
      historical_structure_id: row.structure_id,
      historical_household_id: row.household_id,
      historical_address_id: row.address_id,
      canonical_structure_id: canonical,
      match_method: canonical
        ? "identical_structure_id_and_geometry"
        : "historical_physical_roof_unresolved",
      confidence: canonical ? "exact_structure_geometry" : "review",
      historical_label: row.label,
    });
  }
  return rows;
}

const argument = (name: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

async function main() {
  const sourcePath = resolve(
    argument("--source") ??
      process.env.CANVASS_HISTORY_SOURCE_DB ??
      "private/canvassing/backups/owen-sound-pre-address-history-2026-08-26.sqlite",
  );
  const structuresPath = resolve(
    argument("--structures") ??
      "packages/web-client/public/canvassing/structures.geojson",
  );
  const outputPath = resolve(
    argument("--out") ??
      "packages/web-client/public/canvassing/structure-history-crosswalk.json",
  );
  const structures = JSON.parse(await readFile(structuresPath, "utf8"));
  const currentStructureIds = new Set<string>(
    structures.features.map((feature: any) =>
      String(feature.properties?.structure_id ?? feature.id ?? ""),
    ),
  );
  const db = new DatabaseSync(sourcePath, { readOnly: true });
  const rows = db
    .prepare(
      `SELECT DISTINCT
          a.structure_id,
          h.id household_id,
          a.id address_id,
          COALESCE(a.label,'') label
       FROM addresses a
       JOIN households h ON h.address_id=a.id
      WHERE a.structure_id IS NOT NULL
        AND (
          EXISTS (SELECT 1 FROM visits v WHERE v.household_id=h.id)
          OR EXISTS (SELECT 1 FROM household_flyer_events f WHERE f.household_id=h.id)
          OR EXISTS (SELECT 1 FROM neighbourhood_conversations n WHERE n.household_id=h.id)
          OR EXISTS (SELECT 1 FROM people p WHERE p.household_id=h.id)
        )
      ORDER BY a.structure_id,h.id`,
    )
    .all() as Array<{
    structure_id: string;
    household_id: string;
    address_id: string;
    label: string;
  }>;
  db.close();
  const crosswalk = buildStructureHistoryCrosswalk(rows, currentStructureIds);
  await writeFile(
    outputPath,
    JSON.stringify(
      {
        schema_version: 1,
        generated_at: new Date().toISOString(),
        source_snapshot: sourcePath,
        purpose:
          "Permanent physical-roof identity crosswalk for projecting historical activity after address replacement",
        rows: crosswalk,
        summary: {
          historical_activity_rows: crosswalk.length,
          historical_structures: new Set(
            crosswalk.map((row) => row.historical_structure_id),
          ).size,
          exact_structure_geometry: crosswalk.filter(
            (row) => row.confidence === "exact_structure_geometry",
          ).length,
          unresolved: crosswalk.filter((row) => row.confidence === "review")
            .length,
        },
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `Built ${crosswalk.length} physical-roof history rows (${new Set(crosswalk.map((row) => row.historical_structure_id)).size} structures) at ${outputPath}`,
  );
}

if (process.argv[1]?.endsWith("build-structure-history-crosswalk.ts"))
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
