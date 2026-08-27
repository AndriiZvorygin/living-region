import { readFile, writeFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { dirname, resolve } from "node:path";

type JsonFeature = {
  type: string;
  id?: string | number;
  geometry?: unknown;
  properties: Record<string, any>;
};

const argument = (name: string, fallback: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
};

const currentDbPath = resolve(
  argument("--current-db", process.env.CANVASS_DB ?? "private/canvassing/owen-sound.sqlite"),
);
const preMigrationDbPath = resolve(
  argument(
    "--pre-migration-db",
    "private/canvassing/backups/owen-sound-pre-address-history-2026-08-26.sqlite",
  ),
);
const structuresPath = resolve(
  argument("--structures", "packages/web-client/public/canvassing/structures.geojson"),
);
const outputPath = resolve(
  argument("--out", "artifacts/owen-sound-address-recovery-2026-08-27.json"),
);

const rows = <T = Record<string, any>>(db: DatabaseSync, sql: string, ...params: any[]) =>
  db.prepare(sql).all(...params) as T[];

const one = <T = Record<string, any>>(db: DatabaseSync, sql: string, ...params: any[]) =>
  db.prepare(sql).get(...params) as T | undefined;

const count = (db: DatabaseSync, sql: string, ...params: unknown[]) =>
  Number((one<{ count: number }>(db, sql, ...params)?.count ?? 0));

function latestVisitIsActive(db: DatabaseSync, visitId: string) {
  const correction = one<{ correction_type: string }>(
    db,
    `SELECT correction_type
       FROM visit_corrections
      WHERE visit_id=?
      ORDER BY occurred_at DESC,rowid DESC
      LIMIT 1`,
    visitId,
  );
  return correction?.correction_type !== "undo";
}

function eventDetails(db: DatabaseSync, householdId: string) {
  const visits = rows(db, `
    SELECT v.id,v.occurred_at,v.user_id,v.household_id,v.flyer_id,
           v.flyer_delivered,v.door_knocked,v.outcome,v.conversation_occurred,
           v.notes,v.follow_up_action,v.follow_up_date,v.support_category,
           v.source,v.session_id,v.revisit_requested,v.no_answer
      FROM visits v
     WHERE v.household_id=?
     ORDER BY v.occurred_at,v.id`, householdId)
    .filter((visit) => latestVisitIsActive(db, String(visit.id)))
    .map((visit) => ({
      kind: "visit",
      id: String(visit.id),
      occurred_at: visit.occurred_at,
      user_id: visit.user_id,
      flyer_id: visit.flyer_id ?? null,
      flyer_delivered: Number(visit.flyer_delivered) === 1,
      outcome: visit.outcome,
      conversation_occurred: Number(visit.conversation_occurred) === 1,
      notes: visit.notes ?? null,
      follow_up_action: visit.follow_up_action ?? null,
      follow_up_date: visit.follow_up_date ?? null,
      support_category: visit.support_category ?? null,
      source: visit.source,
      corrections: rows(db, `
        SELECT id,occurred_at,user_id,correction_type,reason,source
          FROM visit_corrections
         WHERE visit_id=?
         ORDER BY occurred_at,id`, visit.id),
    }));
  const flyerEvents = rows(db, `
    SELECT id,household_id,occurred_at,user_id,flyer_id,flyer_delivered,
           reason,source,previous_event_id
      FROM household_flyer_events
     WHERE household_id=?
     ORDER BY occurred_at,id`, householdId)
    .map((event) => ({
      kind: "household_flyer_event",
      id: String(event.id),
      occurred_at: event.occurred_at,
      user_id: event.user_id,
      flyer_id: event.flyer_id ?? null,
      flyer_delivered: Number(event.flyer_delivered) === 1,
      reason: event.reason ?? null,
      source: event.source,
      previous_event_id: event.previous_event_id ?? null,
    }));
  return [...visits, ...flyerEvents];
}

function structureGeometry(db: DatabaseSync, structureId: string) {
  const row = one<{ geometry_json: string }>(
    db,
    "SELECT geometry_json FROM structures WHERE id=?",
    structureId,
  );
  if (!row) return null;
  try {
    return JSON.parse(row.geometry_json);
  } catch {
    return row.geometry_json;
  }
}

async function main() {
  const current = new DatabaseSync(currentDbPath, { readOnly: true });
  const before = new DatabaseSync(preMigrationDbPath, { readOnly: true });
  const structuresDocument = JSON.parse(await readFile(structuresPath, "utf8")) as {
    features: JsonFeature[];
  };
  const structureFeatures = new Map(
    structuresDocument.features.map((feature) => [
      String(feature.properties.structure_id ?? feature.id ?? ""),
      feature,
    ]),
  );

  const beforeVisits = rows(before, `
    SELECT v.id,v.occurred_at,v.user_id,v.household_id,v.flyer_id,
           h.address_id,a.structure_id,a.civic_number,a.street,a.unit,a.label,
           s.id old_structure_id
      FROM visits v
      JOIN households h ON h.id=v.household_id
      JOIN addresses a ON a.id=h.address_id
      LEFT JOIN structures s ON s.id=a.structure_id
     WHERE v.flyer_delivered=1
     ORDER BY a.structure_id,v.occurred_at,v.id`)
    .filter((visit) => latestVisitIsActive(before, String(visit.id)));
  const byOldStructure = new Map<string, any[]>();
  for (const visit of beforeVisits) {
    const structureId = String(visit.old_structure_id ?? visit.structure_id ?? "");
    if (!structureId) continue;
    (byOldStructure.get(structureId) ?? (byOldStructure.set(structureId, []), byOldStructure.get(structureId)!)).push(visit);
  }

  const hasCrosswalk = Boolean(
    one(current, "SELECT 1 FROM sqlite_master WHERE type='table' AND name='structure_history_crosswalk'"),
  );
  const crosswalk = new Map<string, { canonical_structure_id: string; match_method: string; confidence: string }>();
  if (hasCrosswalk) {
    for (const row of rows(current, "SELECT historical_structure_id,canonical_structure_id,match_method,confidence FROM structure_history_crosswalk")) {
      if (!crosswalk.has(String(row.historical_structure_id)))
        crosswalk.set(String(row.historical_structure_id), {
          canonical_structure_id: String(row.canonical_structure_id),
          match_method: String(row.match_method),
          confidence: String(row.confidence),
        });
    }
  }

  const currentVisitIds = new Set(rows<{ id: string }>(current, "SELECT id FROM visits").map((row) => String(row.id)));
  const beforeVisitIds = new Set(beforeVisits.map((visit) => String(visit.id)));
  const currentFlyerEvents = rows<{ household_id: string; flyer_delivered: number; id: string }>(
    current,
    "SELECT household_id,flyer_delivered,id FROM household_flyer_events",
  );
  const currentFlyerHouseholds = new Set(
    currentFlyerEvents.filter((event) => Number(event.flyer_delivered) === 1).map((event) => String(event.household_id)),
  );
  const currentFlyerStructures = new Set<string>();
  const currentFlyerEventIdsByStructure = new Map<string, string[]>();
  const currentPhysicalEvents = new Map<string, any[]>();
  const addCurrentEvent = (structureId: string, event: any) => {
    const list = currentPhysicalEvents.get(structureId) ?? [];
    list.push(event);
    currentPhysicalEvents.set(structureId, list);
    if (event.flyer_delivered) {
      currentFlyerStructures.add(structureId);
      const ids = currentFlyerEventIdsByStructure.get(structureId) ?? [];
      ids.push(String(event.id));
      currentFlyerEventIdsByStructure.set(structureId, ids);
    }
  };
  for (const row of rows(current, `
    SELECT v.id,v.household_id,v.occurred_at,v.user_id,v.flyer_id,v.flyer_delivered,
           h.address_id,a.structure_id
      FROM visits v
      JOIN households h ON h.id=v.household_id
      LEFT JOIN addresses a ON a.id=h.address_id
     WHERE v.flyer_delivered=1`)) {
    if (!latestVisitIsActive(current, String(row.id))) continue;
    if (row.structure_id) addCurrentEvent(String(row.structure_id), row);
  }
  if (hasCrosswalk) {
    for (const row of rows(current, `
      SELECT c.canonical_structure_id,v.id,v.household_id,v.occurred_at,v.user_id,
             v.flyer_id,v.flyer_delivered
        FROM structure_history_crosswalk c
        JOIN visits v ON v.household_id=c.historical_household_id
       WHERE v.flyer_delivered=1`)) {
      if (!latestVisitIsActive(current, String(row.id))) continue;
      addCurrentEvent(String(row.canonical_structure_id), row);
    }
  }
  for (const event of currentFlyerEvents.filter((item) => Number(item.flyer_delivered) === 1)) {
    const household = one<{ address_id: string }>(current, "SELECT address_id FROM households WHERE id=?", event.household_id);
    const address = household && one<{ structure_id: string }>(current, "SELECT structure_id FROM addresses WHERE id=?", household.address_id);
    if (address?.structure_id)
      addCurrentEvent(String(address.structure_id), { ...event, flyer_delivered: true });
  }

  const historicalStructures = [...byOldStructure.keys()];
  const canonicalGroups = new Map<string, string[]>();
  const inventory = historicalStructures.map((oldStructureId) => {
    const oldEvents = byOldStructure.get(oldStructureId) ?? [];
    const mapping = crosswalk.get(oldStructureId);
    const canonicalStructureId = mapping?.canonical_structure_id ?? oldStructureId;
    const currentFeature = structureFeatures.get(canonicalStructureId);
    const currentEvents = currentPhysicalEvents.get(canonicalStructureId) ?? [];
    const oldEventIds = oldEvents.map((event) => String(event.id));
    const missingEventIds = oldEventIds.filter((id) => !currentVisitIds.has(id));
    const currentEventIds = new Set(currentEvents.map((event) => String(event.id)));
    const currentHasFlyer = currentFlyerStructures.has(canonicalStructureId);
    const currentAddress = currentFeature?.properties ?? {};
    const group = canonicalGroups.get(canonicalStructureId) ?? [];
    group.push(oldStructureId);
    canonicalGroups.set(canonicalStructureId, group);
    return {
      old_structure_id: oldStructureId,
      old_household_ids: [...new Set(oldEvents.map((event) => String(event.household_id)))],
      old_address_ids: [...new Set(oldEvents.map((event) => String(event.address_id)))],
      old_labels: [...new Set(oldEvents.map((event) => String(event.label ?? "")).filter(Boolean))],
      old_coordinates: oldEvents[0]
        ? { longitude: Number(oldEvents[0].lon), latitude: Number(oldEvents[0].lat) }
        : null,
      old_geometry: structureGeometry(before, oldStructureId),
      current_structure_id: currentFeature ? canonicalStructureId : null,
      current_addr_guid: currentAddress.authoritative_address_ids?.[0] ?? null,
      current_loc_guid: currentAddress.authoritative_location_ids?.[0] ?? null,
      current_label: currentAddress.civic_label ?? null,
      current_status: currentHasFlyer ? "flyer_delivered" : "untouched",
      current_geometry: currentFeature?.geometry ?? structureGeometry(current, canonicalStructureId),
      match_method: mapping?.match_method ?? (currentFeature ? "identical_structure_id" : "unresolved"),
      match_confidence: mapping?.confidence ?? (currentFeature ? "exact_structure_geometry" : "unresolved"),
      flyer_event_ids: oldEventIds,
      current_event_ids: [...currentEventIds],
      missing_event_ids: missingEventIds,
      events: oldEvents.flatMap((event) => eventDetails(before, String(event.household_id))),
      recovery_classification: !currentFeature
        ? "unresolved_physical_roof"
        : missingEventIds.length
          ? "events_missing_from_current_database"
          : currentHasFlyer
            ? "already_preserved"
            : "projection_only_repair",
    };
  });

  const merged = inventory.filter((item) => (canonicalGroups.get(item.current_structure_id ?? "")?.length ?? 0) > 1);
  for (const item of inventory)
    if (merged.includes(item) && item.recovery_classification === "already_preserved")
      item.recovery_classification = "merged_physical_roofs";

  const activeFeatures = structuresDocument.features.filter((feature) => feature.properties.canvassable);
  const activeResidentialTargets = activeFeatures.filter((feature) => feature.properties.selection_target_id);
  const databaseActiveTargetFailures = rows(current, `
    SELECT a.id,a.label
      FROM addresses a
      JOIN households h ON h.address_id=a.id
      JOIN structures s ON s.id=a.structure_id
     WHERE a.source_active=1 AND s.source_active=1
       AND (trim(a.civic_number)='' OR trim(a.street)=''
            OR a.label LIKE 'Canvassing roof %')`);
  const databaseActiveAnonymousLabels = rows(current, `
    SELECT a.id
      FROM addresses a
      JOIN households h ON h.address_id=a.id
      JOIN structures s ON s.id=a.structure_id
     WHERE a.source_active=1 AND s.source_active=1
       AND a.label LIKE 'Canvassing roof %'`);
  const report = {
    generated_at: new Date().toISOString(),
    source: {
      current_database: currentDbPath,
      pre_migration_database: preMigrationDbPath,
      structures_asset: structuresPath,
      recovery_source_is_comparison_only: true,
    },
    counts: {
      pre_migration_total_visits: count(before, "SELECT count(*) count FROM visits"),
      pre_migration_effective_visits: count(before, `SELECT count(*) count FROM visits v WHERE COALESCE((SELECT correction_type FROM visit_corrections c WHERE c.visit_id=v.id ORDER BY c.occurred_at DESC,c.rowid DESC LIMIT 1),'restore')!='undo'`),
      current_visits: count(current, "SELECT count(*) count FROM visits"),
      current_household_flyer_events: count(current, "SELECT count(*) count FROM household_flyer_events"),
      pre_migration_flyered_physical_roofs: inventory.length,
      recovered_flyered_physical_roofs: inventory.filter((item) => item.current_status === "flyer_delivered").length,
      already_correct_roofs: inventory.filter((item) => item.recovery_classification === "already_preserved").length,
      projection_only_repairs: inventory.filter((item) => item.recovery_classification === "projection_only_repair").length,
      rows_restored_from_backup: inventory.reduce((sum, item) => sum + item.missing_event_ids.length, 0),
      duplicate_roofs_merged: merged.length,
      unresolved_physical_roofs: inventory.filter((item) => item.recovery_classification === "unresolved_physical_roof").length,
      events_genuinely_absent_from_current: new Set(inventory.flatMap((item) => item.missing_event_ids)).size,
      post_migration_visits_preserved: [...currentVisitIds].filter((id) => !beforeVisitIds.has(id)).length,
    },
    invariants: {
      active_canvassing_roof_labels: activeFeatures.filter((feature) => /^Canvassing roof\b/i.test(String(feature.properties.civic_label ?? ""))).length,
      active_residential_targets_without_address: activeResidentialTargets.filter((feature) => {
        const p = feature.properties;
        return !String(p.civic_label ?? "").match(/\d+/) || !String(p.civic_label ?? "").replace(/^~?\d+[A-Z0-9/-]*\s*/i, "").trim();
      }).length,
      distant_review_targets_used_as_addresses: activeFeatures.filter((feature) => feature.properties.address_relation_confidence === "distant_review" || feature.properties.address_source_status === "distant_review").length,
      previously_flyered_physical_roofs_lost: inventory.filter((item) => item.current_status !== "flyer_delivered").length,
      rendered_canvassable_roofs_without_selectable_target: activeFeatures.filter((feature) => !String(feature.properties.selection_target_id ?? "")).length,
      active_database_targets_without_human_address: databaseActiveTargetFailures.length,
      active_database_canvassing_roof_labels: databaseActiveAnonymousLabels.length,
    },
    current_address_source_counts: activeFeatures.reduce((acc, feature) => {
      const key = String(feature.properties.address_source_status ?? feature.properties.address_label_source ?? "unknown");
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    current_address_quality_counts: activeFeatures.reduce((acc, feature) => {
      const key = String(feature.properties.address_quality ?? "unknown");
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    active_roofs: {
      structures: structuresDocument.features.length,
      canvassable: activeFeatures.length,
      with_authoritative_nar_addresses: activeFeatures.filter((feature) => feature.properties.address_source_status === "authoritative").length,
      with_verified_legacy_addresses: activeFeatures.filter((feature) => feature.properties.address_source_status === "legacy_fallback").length,
      with_grid_estimated_addresses: activeFeatures.filter((feature) => feature.properties.address_source_status === "estimated").length,
      accessory_or_non_canvassable: structuresDocument.features.length - activeFeatures.length,
      active_targets_with_blank_civic_number_or_street: activeResidentialTargets.filter((feature) => !String(feature.properties.fallback_civic_number ?? feature.properties.civic_label ?? "").match(/\d+/) || !String(feature.properties.fallback_street ?? feature.properties.civic_label ?? "").trim()).length,
      stale_address_reference_features: activeFeatures.filter((feature) => Array.isArray(feature.properties.address_reference_ids) && feature.properties.address_reference_ids.length > 0).length,
      current_crosswalk_rows: hasCrosswalk ? count(current, "SELECT count(*) count FROM structure_history_crosswalk") : 0,
    },
    physical_roof_groups: [...canonicalGroups.entries()].filter(([, oldIds]) => oldIds.length > 1).map(([canonical_structure_id, old_structure_ids]) => ({ canonical_structure_id, old_structure_ids })),
    inventory,
  };

  await writeFile(outputPath, JSON.stringify(report, null, 2) + "\n");
  current.close();
  before.close();
  console.log(JSON.stringify({ output: outputPath, counts: report.counts, invariants: report.invariants }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
