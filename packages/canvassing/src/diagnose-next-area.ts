import { mkdir, readFile, writeFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { dirname, resolve } from "node:path";
import {
  buildHouseholdAdjacencyGraph,
  isCoverageCovered,
  isCoverageEligible,
  rankNextUnderflyeredAreas,
  rankNextUnderflyeredAreasOriginal,
  rankNextUnderflyeredAreasWithoutCompactness,
  scoreNextUnderflyeredAreas,
  type CoverageLocation,
  type LocalCoverageArea,
} from "../../web-client/src/canvassing-coverage";

type StateHousehold = {
  household_id: string;
  structure_id: string | null;
  address_id: string;
  civic_number: string;
  street: string;
  status: string;
  lon: number;
  lat: number;
  flyer_history?: Array<{
    occurred_at: string;
    flyer_id: string | null;
  }>;
};

type DiagnosticOptions = {
  statePath: string;
  databasePath: string;
  outputPath: string;
  geojsonPath: string;
  recentDays: number;
};

const nonResidentialBuildingTypes = new Set([
  "commercial",
  "industrial",
  "retail",
  "office",
  "school",
  "university",
  "hospital",
  "clinic",
  "warehouse",
  "church",
  "civic",
  "public",
  "garage",
  "shed",
  "barn",
]);

function options(): DiagnosticOptions {
  const statePath = process.env.CANVASS_DIAGNOSTIC_STATE;
  if (!statePath)
    throw new Error("CANVASS_DIAGNOSTIC_STATE must point to /api/canvassing/state JSON");
  const outputPath = resolve(
    process.env.CANVASS_DIAGNOSTIC_OUTPUT ?? "artifacts/next-area-diagnostic.json",
  );
  return {
    statePath: resolve(statePath),
    databasePath: resolve(
      process.env.CANVASS_DIAGNOSTIC_DB ?? "private/canvassing/owen-sound.sqlite",
    ),
    outputPath,
    geojsonPath: resolve(
      process.env.CANVASS_DIAGNOSTIC_GEOJSON ??
        "artifacts/next-area-diagnostic.geojson",
    ),
    recentDays: Number(process.env.CANVASS_DIAGNOSTIC_RECENT_DAYS ?? "14"),
  };
}

const distanceMetres = (
  left: { lon: number; lat: number },
  right: { lon: number; lat: number },
) => {
  const latitude = (((left.lat + right.lat) / 2) * Math.PI) / 180;
  return Math.hypot(
    (left.lon - right.lon) * 111320 * Math.cos(latitude),
    (left.lat - right.lat) * 111320,
  );
};

function latestFlyerDate(household: StateHousehold) {
  return household.flyer_history?.reduce<string | null>(
    (latest, event) =>
      !latest || event.occurred_at > latest ? event.occurred_at : latest,
    null,
  );
}

function scaleSummary(
  scale: LocalCoverageArea["inner"],
  ids: string[],
  households: Map<string, StateHousehold>,
  asOf: Date,
  recentDays: number,
) {
  const coverageAge = ids.map((id) => {
    const household = households.get(id)!;
    const latest = latestFlyerDate(household);
    const ageDays = latest
      ? (asOf.getTime() - Date.parse(latest)) / 86_400_000
      : null;
    return {
      household_id: id,
      covered: isCoverageCovered({ household_id: id, status: household.status }),
      last_flyer_at: latest,
      age_days: ageDays == null ? null : +ageDays.toFixed(2),
      age_class:
        ageDays == null ? "never" : ageDays <= recentDays ? "recent" : "older",
    };
  });
  return {
    target_size: scale.targetSize,
    sample_size: scale.sampleSize,
    total_eligible_households: scale.sampleSize,
    covered_households: scale.localCovered,
    uncovered_households: scale.localRemaining,
    coverage: scale.coverage,
    uncovered_proportion: scale.uncoveredProportion,
    average_hop_cost: scale.averageHouseholdHops,
    max_hop_cost: scale.maxHouseholdHops,
    complete: scale.complete,
    window_size_effect: scale.complete
      ? "complete"
      : `incomplete: ${scale.sampleSize} of ${scale.targetSize}`,
    recent_covered_households: coverageAge.filter(
      (item) => item.covered && item.age_class === "recent",
    ).length,
    older_covered_households: coverageAge.filter(
      (item) => item.covered && item.age_class === "older",
    ).length,
    never_covered_households: coverageAge.filter(
      (item) => !item.covered && item.age_class === "never",
    ).length,
  };
}

function summarizeArea(
  area: LocalCoverageArea,
  rank: number,
  households: Map<string, StateHousehold>,
  asOf: Date,
  recentDays: number,
  selectedCenter: StateHousehold | undefined,
) {
  const ids = area.household_ids;
  const innerIds = ids.slice(0, area.inner.targetSize);
  const middleIds = ids.slice(0, area.middle.targetSize);
  const broadIds = ids.slice(0, area.broad.targetSize);
  const center = households.get(area.center_household_id);
  const age = ids.map((id) => {
    const household = households.get(id)!;
    const latest = latestFlyerDate(household);
    const ageDays = latest == null ? null : (asOf.getTime() - Date.parse(latest)) / 86_400_000;
    return { covered: isCoverageCovered({ household_id: id, status: household.status }), ageDays };
  });
  return {
    rank,
    center_household_id: area.center_household_id,
    center_stop_id: area.center_stop_id,
    center: center
      ? {
          civic_number: center.civic_number,
          street: center.street,
          lon: center.lon,
          lat: center.lat,
        }
      : null,
    distance_from_selected_m:
      center && selectedCenter ? +distanceMetres(center, selectedCenter).toFixed(1) : null,
    graph_component: area.graphComponent,
    recommendation_footprint_households: ids.length,
    recommendation_footprint_uncovered: age.filter((item) => !item.covered).length,
    recommendation_footprint_recent_covered: age.filter(
      (item) => item.covered && item.ageDays != null && item.ageDays <= recentDays,
    ).length,
    recommendation_footprint_older_covered: age.filter(
      (item) => item.covered && item.ageDays != null && item.ageDays > recentDays,
    ).length,
    windows: {
      inner: scaleSummary(area.inner, innerIds, households, asOf, recentDays),
      middle: scaleSummary(area.middle, middleIds, households, asOf, recentDays),
      broad: scaleSummary(area.broad, broadIds, households, asOf, recentDays),
    },
    weighted_score: area.nestedUndercoverageScore,
    adjusted_score: area.adjustedUndercoverageScore,
    compactness: {
      spread_m: area.compactnessDistanceMeters,
      p90_m: area.compactnessP90DistanceMeters,
      p95_m: area.compactnessP95DistanceMeters,
      upper_decile_mean_m: area.compactnessUpperDecileMeanMeters,
      normalized: area.compactnessNormalized,
      penalty: area.compactnessPenalty,
    },
    score_formula: "0.5*inner.uncovered_proportion + 0.3*middle.uncovered_proportion + 0.2*broad.uncovered_proportion",
    distance_from_covered_household_hops: area.nearestCoveredHouseholdHops,
    tie_break: {
      primary_weighted_score: area.nestedUndercoverageScore,
      secondary_nearest_covered_household_hops: area.nearestCoveredHouseholdHops,
      tertiary_inner_average_hop_cost: area.inner.averageHouseholdHops,
      final_stable_id: area.center_household_id,
      selector_text: `score ${(area.nestedUndercoverageScore * 100).toFixed(1)}%; nearest covered hops ${area.nearestCoveredHouseholdHops == null ? "unconnected" : area.nearestCoveredHouseholdHops}; inner average hops ${area.inner.averageHouseholdHops.toFixed(1)}`,
    },
    incomplete_samples: area.incompleteSamples,
    window_household_ids: {
      inner: innerIds,
      middle: middleIds,
      broad: broadIds,
    },
  };
}

function pointFeature(
  household: StateHousehold,
  properties: Record<string, unknown>,
) {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [household.lon, household.lat] },
    properties: {
      household_id: household.household_id,
      address: `${household.civic_number} ${household.street}`.trim(),
      status: household.status,
      ...properties,
    },
  };
}

function graphComponentCount(graph: ReturnType<typeof buildHouseholdAdjacencyGraph>) {
  const stops = new Set<string>(graph.neighbors.keys());
  for (const neighbors of graph.neighbors.values())
    for (const neighbor of neighbors) stops.add(neighbor);
  const visited = new Set<string>();
  let count = 0;
  for (const start of stops) {
    if (visited.has(start)) continue;
    count++;
    const queue = [start];
    visited.add(start);
    while (queue.length) {
      const current = queue.shift()!;
      for (const neighbor of graph.neighbors.get(current) ?? []) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return count;
}

async function main() {
  const config = options();
  const state = JSON.parse(await readFile(config.statePath, "utf8")) as {
    households: StateHousehold[];
    schema_version: number;
  };
  const roads = JSON.parse(
    await readFile("packages/web-client/public/canvassing/roads.geojson", "utf8"),
  ).features;
  const db = new DatabaseSync(config.databasePath, { readOnly: true });
  const buildingTypes = new Map(
    (
      db
        .prepare("SELECT id,building_type FROM structures WHERE source_active=1")
        .all() as Array<{ id: string; building_type: string }>
    ).map((row) => [row.id, String(row.building_type ?? "").toLowerCase()]),
  );
  const hasRecommendationHolds = Boolean(
    (
      db
        .prepare(
          "SELECT 1 FROM sqlite_master WHERE type='table' AND name='recommendation_holds'",
        )
        .get() as { 1?: number } | undefined
    )?.[1],
  );
  const activeHolds = hasRecommendationHolds
    ? (db
        .prepare(
          `SELECT id,user_id,center_household_id,household_ids_json,created_at,expires_at
           FROM recommendation_holds WHERE expires_at>datetime('now')`,
        )
        .all() as Array<{
        id: string;
        user_id: string;
        center_household_id: string;
        household_ids_json: string;
        created_at: string;
        expires_at: string;
      }>)
    : [];
  db.close();

  const locations: CoverageLocation[] = state.households.map((home) => {
    const nonResidential = nonResidentialBuildingTypes.has(
      buildingTypes.get(String(home.structure_id ?? "")) ?? "",
    );
    const eligible =
      !nonResidential &&
      isCoverageEligible({ household_id: home.household_id, status: home.status });
    return {
      household_id: home.household_id,
      lon: Number(home.lon),
      lat: Number(home.lat),
      eligible,
      covered:
        eligible && isCoverageCovered({ household_id: home.household_id, status: home.status }),
      street: home.street,
      civic_number: home.civic_number,
      stop_id: home.structure_id ?? home.address_id,
    };
  });
  const graph = buildHouseholdAdjacencyGraph(locations, roads);
  const households = new Map(state.households.map((home) => [home.household_id, home]));
  const asOf = new Date(
    Math.max(
      Date.now(),
      ...state.households.flatMap((home) =>
        (home.flyer_history ?? []).map((event) => Date.parse(event.occurred_at)),
      ),
    ),
  );
  const scored = scoreNextUnderflyeredAreas(locations, graph);
  const legacyRanked = rankNextUnderflyeredAreasOriginal(
    locations,
    graph,
  );
  const tieCleanedRanked = rankNextUnderflyeredAreasWithoutCompactness(
    locations,
    graph,
  );
  const ranked = rankNextUnderflyeredAreas(locations, graph);
  const selected = ranked[0];
  const selectedCenter = selected ? households.get(selected.center_household_id) : undefined;
  const baselineRows = legacyRanked
    .slice(0, 10)
    .map((area, index) =>
      summarizeArea(area, index + 1, households, asOf, config.recentDays, selectedCenter),
    );
  const rankedRows = ranked
    .slice(0, 10)
    .map((area, index) =>
      summarizeArea(area, index + 1, households, asOf, config.recentDays, selectedCenter),
    );

  const deliveryCheckpoints = selected
    ? [...new Set([
        0,
        1,
        2,
        5,
        10,
        25,
        50,
        75,
        100,
        125,
        selected.inner.targetSize,
      ])].filter((count) => count <= selected.inner.targetSize)
    : [];
  const selectedInnerUncovered = selected
    ? selected.household_ids
        .slice(0, selected.inner.targetSize)
        .filter((id) => !locations.find((location) => location.household_id === id)?.covered)
    : [];
  const deliverySimulation = deliveryCheckpoints.map((count) => {
    const delivered = new Set(selectedInnerUncovered.slice(0, count));
    const simulatedLocations = locations.map((location) => ({
      ...location,
      covered: location.covered || delivered.has(location.household_id),
    }));
    const simulatedRanked = rankNextUnderflyeredAreas(simulatedLocations, graph);
    const top = simulatedRanked[0];
    return {
      simulated_new_deliveries: count,
      top_center_household_id: top?.center_household_id ?? null,
      top_score: top?.nestedUndercoverageScore ?? null,
      top_address: top
        ? (() => {
            const home = households.get(top.center_household_id);
            return home ? `${home.civic_number} ${home.street}` : null;
          })()
        : null,
      original_center_still_wins: top?.center_household_id === selected?.center_household_id,
    };
  });
  const firstDifferentRecommendation = deliverySimulation.find(
    (row) => row.simulated_new_deliveries > 0 && !row.original_center_still_wins,
  );

  const beforeRank = new Map(
    legacyRanked.map((area, index) => [area.center_household_id, index + 1]),
  );
  const afterRank = new Map(
    ranked.map((area, index) => [area.center_household_id, index + 1]),
  );
  const rankingChanges = [...new Set([
    ...legacyRanked.slice(0, 20).map((area) => area.center_household_id),
    ...ranked.slice(0, 20).map((area) => area.center_household_id),
  ])]
    .map((householdId) => ({
      household_id: householdId,
      before_rank: beforeRank.get(householdId) ?? null,
      after_rank: afterRank.get(householdId) ?? null,
      rank_delta:
        (beforeRank.get(householdId) ?? 0) - (afterRank.get(householdId) ?? 0),
    }))
    .filter((row) => row.before_rank !== row.after_rank)
    .sort((left, right) =>
      (left.after_rank ?? Number.POSITIVE_INFINITY) -
        (right.after_rank ?? Number.POSITIVE_INFINITY),
    );

  const comparisons = selected
    ? ranked
        .slice(1)
        .map((area) => {
          const center = households.get(area.center_household_id);
          return {
            area,
            distance: center ? distanceMetres(center, selectedCenter!) : 0,
          };
        })
        .sort((left, right) => right.distance - left.distance)
        .slice(0, 3)
        .map(({ area }) =>
          summarizeArea(
            area,
            ranked.indexOf(area) + 1,
            households,
            asOf,
            config.recentDays,
            selectedCenter,
          ),
        )
    : [];

  const householdById = households;
  const geojsonFeatures: any[] = [];
  for (const home of state.households) {
    const covered = isCoverageCovered({ household_id: home.household_id, status: home.status });
    const latest = latestFlyerDate(home);
    const ageDays = latest == null ? null : (asOf.getTime() - Date.parse(latest)) / 86_400_000;
    geojsonFeatures.push(
      pointFeature(home, {
        layer: covered ? "covered_household" : "uncovered_household",
        coverage_age_class: !covered ? "uncovered" : ageDays != null && ageDays <= config.recentDays ? "recent" : "older",
        last_flyer_at: latest,
      }),
    );
  }
  for (const [index, row] of rankedRows.entries()) {
    const center = householdById.get(row.center_household_id)!;
    geojsonFeatures.push(
      pointFeature(center, {
        layer: "candidate_center",
        ranking_mode: "compactness_aware",
        rank: index + 1,
        weighted_score: row.weighted_score,
        adjusted_score: row.adjusted_score,
      }),
    );
  }
  for (const [index, row] of baselineRows.entries()) {
    const center = householdById.get(row.center_household_id)!;
    geojsonFeatures.push(
      pointFeature(center, {
        layer: "candidate_center_before_compactness",
        ranking_mode: "coverage_only",
        rank: index + 1,
        weighted_score: row.weighted_score,
      }),
    );
  }
  if (selected) {
    for (const window of ["inner", "middle", "broad"] as const) {
      for (const id of selected.household_ids.slice(0, selected[window].targetSize)) {
        const home = householdById.get(id);
        if (!home) continue;
        geojsonFeatures.push(
          pointFeature(home, {
            layer: `selected_${window}_window`,
            covered: isCoverageCovered({ household_id: id, status: home.status }),
          }),
        );
      }
    }
  }

  const summary = {
    generated_at: new Date().toISOString(),
    as_of: asOf.toISOString(),
    recent_days_threshold: config.recentDays,
    source_state_schema_version: state.schema_version,
    households_in_state: state.households.length,
    eligible_households: locations.filter((location) => location.eligible).length,
    covered_eligible_households: locations.filter((location) => location.eligible && location.covered).length,
    uncovered_eligible_households: locations.filter((location) => location.eligible && !location.covered).length,
    graph: {
      household_nodes: graph.stopIdByHousehold.size,
      stops: graph.eligibleHouseholdsByStop.size,
      graph_components: graphComponentCount(graph),
    },
    active_recommendation_holds: activeHolds.map((hold) => ({
      ...hold,
      household_ids: JSON.parse(hold.household_ids_json),
    })),
    selector: {
      target_windows: [150, 300, 600],
      scored_centres: scored.length,
      policy_ranked_centres: ranked.length,
      incomplete_inner_windows_scored: scored.filter((area) => !area.inner.complete).length,
      incomplete_inner_windows_competing: ranked.filter((area) => !area.inner.complete).length,
      ranking_policy: "undercovered complete inner windows compete when any exist; adjusted score desc within a bounded compactness penalty, then nearest-covered hops desc, inner average hops asc, stable household ID asc",
      baseline_ranking_policy: "undercovered complete inner windows compete when any exist; coverage score desc, nearest-covered hops desc, inner average hops asc, stable household ID asc",
      tie_cleaned_coverage_only_policy: "same as the baseline, but ignores score differences below the selector epsilon before tie-breaking",
      formula: "0.5*inner.uncovered_proportion + 0.3*middle.uncovered_proportion + 0.2*broad.uncovered_proportion",
      compactness: {
        metric: "0.75*p90 centre distance + 0.25*winsorized upper-decile mean distance, inner 150-household window",
        normalization: "spread_m / (spread_m + 500)",
        penalty: "0.005 * normalized compactness",
      },
    },
    selected: selected
      ? summarizeArea(selected, 1, households, asOf, config.recentDays, selectedCenter)
      : null,
    top_10: rankedRows,
    top_10_before_compactness: baselineRows,
    top_10_after_tie_cleanup_before_compactness: tieCleanedRanked
      .slice(0, 10)
      .map((area, index) =>
        summarizeArea(area, index + 1, households, asOf, config.recentDays, selectedCenter),
      ),
    ranking_changes: rankingChanges,
    geographically_distant_comparisons: comparisons,
    delivery_simulation: {
      method: "Mark currently uncovered households in the selected centre's inner 150-household order as covered, then rerun the unchanged selector.",
      selected_inner_uncovered_available: selectedInnerUncovered.length,
      checkpoints: deliverySimulation,
      first_different_recommendation: firstDifferentRecommendation ?? null,
    },
  };
  await mkdir(dirname(config.outputPath), { recursive: true });
  await mkdir(dirname(config.geojsonPath), { recursive: true });
  await writeFile(config.outputPath, JSON.stringify(summary, null, 2) + "\n");
  await writeFile(
    config.geojsonPath,
    JSON.stringify({ type: "FeatureCollection", features: geojsonFeatures }, null, 2) + "\n",
  );
  console.log(JSON.stringify({ output: config.outputPath, geojson: config.geojsonPath, selected: summary.selected, top_10: rankedRows.map((row) => ({ rank: row.rank, center_household_id: row.center_household_id, address: row.center ? `${row.center.civic_number} ${row.center.street}` : null, score: row.weighted_score })) }, null, 2));
}

await main();
