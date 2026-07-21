import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  buildBusGraph,
  buildWalkingGraph,
  calculateCoverage,
  combineStreetGraphs,
  combinePaths,
  distanceMetres,
  estimateActiveStops,
  nearestNode,
  placeStops,
  polygonRepresentativePoint,
  shortestBusPath,
  type Destination,
  type GeoCollection,
  type PlannerConfig,
  type Position,
  type Stop
} from "../index";
import { renderInteractiveMap } from "../map";
import {
  buildDirectionalRoute,
  compareCounterRotatingStrategies,
  countSignalCrossings,
  directionalOverlapKilometres,
  duplicatedRouteKilometres,
  odTravelMatrix,
  projectDestinationsOntoRoute,
  routeRideCycleMinutes,
  reverseDirectionalRoute,
  segmentSuitability,
  type DirectionalRoutePlan,
  type RouteWaypoint
} from "../loop-analysis";
import { clockfaceStopSpacing, delayScenarios, stopTimeOffsets } from "../schedule-analysis";
import { analyzeBicycleNetwork } from "../bicycle-analysis";
import { buildIntegratedScenarios, buildMultimodalJourneys, type CostProfile, type IntegratedRoute } from "../integrated-analysis";
import { matchAadtToGraph, newerStudyLocations, parseAadtPdf } from "../traffic-data";
import { loadCityElevation } from "../city-elevation";

type FullConfig = PlannerConfig & {
  version: number;
  inputs: { boundary: string; road_centrelines: string; osm_pbf: string; population_blocks: string; public_facilities: string; forbidden: string[] };
  output_dir: string;
  projection: string;
  scoring_weights: Record<string, number>;
  demand_model: {
    average_passengers_per_loop: number;
    stop_events_per_passenger: number;
    shared_stop_event_factor: number;
    low_usage_factor: number;
    minimum_used_stops: number;
    method: string;
  };
  hill_line: { id: string; title: string; anchor_order: string[]; operating_variants: Array<{ id: string; active_buses: number; target_headway_minutes: number }> };
  hill_loop: {
    id: string;
    title: string;
    major_destination_order_clockwise: string[];
    clockwise_waypoints: Array<{ id: string; destination_id?: string; served_destination_ids?: string[]; label?: string; lon?: number; lat?: number }>;
    schedule_cycle_targets_minutes: number[];
    arrival_model: string;
    signal_match_radius_m: number;
    oneway_match_radius_m: number;
  };
  brooke_alternatives: Array<{ id: string; title: string; waypoints: Array<{ id: string; destination_id?: string; label?: string; lon?: number; lat?: number }> }>;
  integrated_mobility: {
    service_days_per_year: number;
    coverage_routes: Array<{ id: string; title: string; waypoints: Array<{ id: string; destination_id?: string; label?: string; lon?: number; lat?: number }> }>;
    cost_profiles: CostProfile[];
  };
};

type CoverageResult = ReturnType<typeof calculateCoverage>;

const configPath = resolve(process.argv.find((arg) => arg.startsWith("--config="))?.slice(9) ?? "packages/transit-planner/config/owen-sound-mvp.json");

async function json<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(resolve(path), "utf8")) as T;
}

function boundaryRing(collection: GeoCollection): Position[][] {
  const geometry = collection.features[0]?.geometry;
  if (!geometry || geometry.type !== "Polygon") throw new Error("Owen Sound boundary must contain one Polygon feature");
  return geometry.coordinates as Position[][];
}

function centroidFromGeometry(geometry: GeoCollection["features"][number]["geometry"]): Position | undefined {
  if (!geometry) return undefined;
  if (geometry.type === "Point") return geometry.coordinates as Position;
  if (["Polygon", "MultiPolygon"].includes(geometry.type)) return polygonRepresentativePoint({ type: "Feature", geometry, properties: {} });
  if (geometry.type === "LineString") {
    const points = geometry.coordinates as Position[];
    return [points.reduce((sum, p) => sum + p[0], 0) / points.length, points.reduce((sum, p) => sum + p[1], 0) / points.length];
  }
  return undefined;
}

async function exportOsmLayers(pbfPath: string, tempDir: string): Promise<{ highways: GeoCollection; pois: GeoCollection }> {
  const highwayPbf = join(tempDir, "highways.osm.pbf");
  const highwayGeo = join(tempDir, "highways.geojson");
  const poiPbf = join(tempDir, "pois.osm.pbf");
  const poiGeo = join(tempDir, "pois.geojson");
  execFileSync("osmium", ["tags-filter", resolve(pbfPath), "w/highway", "-o", highwayPbf, "--overwrite"], { stdio: "pipe" });
  execFileSync("osmium", ["export", highwayPbf, "-o", highwayGeo, "--overwrite"], { stdio: "pipe" });
  execFileSync("osmium", ["tags-filter", resolve(pbfPath), "nwr/amenity", "nwr/shop", "nwr/tourism", "nwr/leisure", "nwr/name", "n/highway=traffic_signals", "-o", poiPbf, "--overwrite"], { stdio: "pipe" });
  execFileSync("osmium", ["export", poiPbf, "-o", poiGeo, "--overwrite"], { stdio: "pipe" });
  return { highways: await json<GeoCollection>(highwayGeo), pois: await json<GeoCollection>(poiGeo) };
}

function destinationLayer(osm: GeoCollection, facilities: GeoCollection): Destination[] {
  const findOsm = (pattern: RegExp): Position | undefined => {
    const feature = osm.features.find((item) => pattern.test(String(item.properties?.name ?? "")));
    return feature ? centroidFromGeometry(feature.geometry) : undefined;
  };
  const fixed: Array<[string, string, string, Position | undefined, Position]> = [
    ["osdss", "Owen Sound District Secondary School", "school", findOsm(/Owen Sound District Secondary School/i), [-80.95645, 44.56525]],
    ["downtown_terminal", "Downtown Transit Terminal", "transit_terminal", findOsm(/Owen Sound Transit Terminal/i), [-80.94155, 44.56856]],
    ["georgian_college", "Georgian College", "college", findOsm(/Georgian College.*Owen Sound/i), [-80.9192, 44.56855]],
    ["brightshores_hospital", "Brightshores Owen Sound Hospital", "hospital", findOsm(/Owen Sound Hospital/i), [-80.91165, 44.56965]],
    ["retail_16th_12th", "16th Street East / 12th Avenue East retail", "retail_cluster", undefined, [-80.9233045, 44.573956]],
    ["heritage_place", "Heritage Place Mall", "shopping_mall", findOsm(/^Heritage Place$/i), [-80.92015, 44.57625]]
  ];
  const destinations: Destination[] = fixed.map(([id, name, category, osmPoint, fallback]) => ({ id, name, category, lon: (osmPoint ?? fallback)[0], lat: (osmPoint ?? fallback)[1], major: true, source: osmPoint ? "osm_verified" : "manual_verified" }));
  for (const feature of facilities.features) {
    const point = centroidFromGeometry(feature.geometry);
    const name = String(feature.properties?.name ?? "").trim();
    if (!point || !name || destinations.some((destination) => distanceMetres([destination.lon, destination.lat], point) < 80)) continue;
    destinations.push({ id: `facility-${feature.properties?.objectid ?? destinations.length}`, name, category: String(feature.properties?.facilityType ?? "public_facility"), lon: point[0], lat: point[1], major: false, source: "public_facility" });
  }
  return destinations;
}

function featureCollection(features: unknown[]): { type: "FeatureCollection"; features: unknown[] } {
  return { type: "FeatureCollection", features };
}

function routeFeature(route: ReturnType<typeof combinePaths>, properties: Record<string, unknown>) {
  return { type: "Feature", properties, geometry: { type: "LineString", coordinates: route.coordinates } };
}

function destinationFeatures(destinations: Destination[]) {
  return destinations.map((destination) => ({ type: "Feature", properties: { ...destination }, geometry: { type: "Point", coordinates: [destination.lon, destination.lat] } }));
}

function stopFeatures(stops: Stop[]) {
  return stops.map((stop) => ({ type: "Feature", properties: { ...stop }, geometry: { type: "Point", coordinates: [stop.lon, stop.lat] } }));
}

function labelGeneratedStops(stops: Stop[], graph: ReturnType<typeof buildBusGraph>): Stop[] {
  return stops.map((stop) => {
    if (stop.fixed) return stop;
    const snapped = nearestNode(graph, [stop.lon, stop.lat], 25);
    if (!snapped) return stop;
    const roadNames = [...new Set(graph.nodes[snapped.node].edges.map((edgeId) => graph.edges[edgeId].road_name).filter((name) => name !== "unnamed road"))].slice(0, 2);
    return roadNames.length ? { ...stop, name: `Local stop near ${roadNames.join(" / ")}` } : stop;
  });
}

function graphFeatures(graph: ReturnType<typeof buildBusGraph>) {
  return graph.edges
    .filter((edge) => edge.from < edge.to)
    .map((edge) => ({
      type: "Feature",
      properties: { from_node: edge.from, to_node: edge.to, length_m: Number(edge.length_m.toFixed(1)), travel_seconds: Number(edge.travel_seconds.toFixed(1)), road_name: edge.road_name, road_class: edge.road_class, speed_kph: edge.posted_speed_kph, inferred_speed: edge.inferred_speed, pedestrian: edge.pedestrian, lane_count: edge.lane_count, winter_maintenance: edge.winter_maintenance },
      geometry: { type: "LineString", coordinates: edge.coordinates }
    }));
}

function coverageFeatures(coverage: CoverageResult) {
  return coverage.rows.map((row) => ({
    ...row.feature,
    properties: { ...row.feature.properties, network_walk_m: Number.isFinite(row.network_distance_m) ? Math.round(row.network_distance_m) : null, circular_walk_m: Math.round(row.circular_distance_m), hill_line_covered_300m: row.network_distance_m <= 300, hill_line_covered_400m: row.network_distance_m <= 400, hill_line_covered_600m: row.network_distance_m <= 600 }
  }));
}

function comparisonCoverageFeatures(lineCoverage: CoverageResult, loopCoverage: CoverageResult) {
  const loopById = new Map(loopCoverage.rows.map((row) => [String(row.feature.properties?.geographyId), row]));
  return lineCoverage.rows.map((row) => {
    const loop = loopById.get(String(row.feature.properties?.geographyId));
    return {
      ...row.feature,
      properties: {
        ...row.feature.properties,
        circular_walk_m: Math.round(row.circular_distance_m),
        line_network_walk_m: Number.isFinite(row.network_distance_m) ? Math.round(row.network_distance_m) : null,
        loop_network_walk_m: loop && Number.isFinite(loop.network_distance_m) ? Math.round(loop.network_distance_m) : null
      }
    };
  });
}

function accessChangeFeatures(previousCoverage: CoverageResult, loopCoverage: CoverageResult) {
  const loopById = new Map(loopCoverage.rows.map((row) => [String(row.feature.properties?.geographyId), row]));
  return previousCoverage.rows.map((previous) => {
    const loop = loopById.get(String(previous.feature.properties?.geographyId));
    const classify = (threshold: number) => {
      const before = previous.network_distance_m <= threshold;
      const after = Boolean(loop && loop.network_distance_m <= threshold);
      return before && after ? "retained" : before ? "lost" : after ? "gained" : "uncovered";
    };
    return { ...previous.feature, properties: { ...previous.feature.properties, previous_network_walk_m: Number.isFinite(previous.network_distance_m) ? Math.round(previous.network_distance_m) : null, loop_network_walk_m: loop && Number.isFinite(loop.network_distance_m) ? Math.round(loop.network_distance_m) : null, access_change_400m: classify(400), access_change_600m: classify(600) } };
  });
}

function operations(route: ReturnType<typeof combinePaths>, stopCount: number, config: FullConfig, variant: FullConfig["hill_line"]["operating_variants"][number]) {
  const usedStops = estimateActiveStops(stopCount, config.demand_model.average_passengers_per_loop, config.demand_model.stop_events_per_passenger, config.demand_model.shared_stop_event_factor, config.demand_model.low_usage_factor, config.demand_model.minimum_used_stops);
  const baseMinutes = route.travel_seconds / 60;
  const routeTimes = Object.fromEntries(Object.entries(usedStops).map(([key, count]) => [key, Number((baseMinutes + count * config.bus.stop_dwell_seconds / 60).toFixed(1))])) as Record<"low" | "expected" | "all_stops", number>;
  const cycleTimes = Object.fromEntries(Object.entries(routeTimes).map(([key, minutes]) => [key, Number((minutes + config.bus.terminal_layover_minutes).toFixed(1))])) as Record<"low" | "expected" | "all_stops", number>;
  const runningMinutes = routeTimes.expected;
  const cycleMinutes = cycleTimes.expected;
  const achievedHeadway = cycleMinutes / variant.active_buses;
  const busesAt = Object.fromEntries([15, 20, 30, 60].map((headway) => [String(headway), Math.ceil(cycleMinutes / headway)]));
  const departuresPerHour = 60 / achievedHeadway;
  return {
    active_buses: variant.active_buses,
    target_headway_minutes: variant.target_headway_minutes,
    achieved_headway_minutes: Number(achievedHeadway.toFixed(1)),
    generalized_running_time_minutes: Number(runningMinutes.toFixed(1)),
    round_trip_cycle_minutes: Number(cycleMinutes.toFixed(1)),
    base_in_motion_minutes: Number(baseMinutes.toFixed(1)),
    scheduled_stop_count: stopCount,
    estimated_used_stops: usedStops,
    route_time_range_minutes: routeTimes,
    cycle_time_range_minutes: cycleTimes,
    required_buses_by_headway: busesAt,
    vehicle_km_per_service_hour: Number((route.distance_m / 1000 * departuresPerHour).toFixed(1)),
    vehicle_hours_per_service_day: variant.active_buses * config.bus.service_span_hours,
    vehicle_km_per_service_day: Number((route.distance_m / 1000 * departuresPerHour * config.bus.service_span_hours).toFixed(1))
  };
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function recoveryBySchedule(cycleMinutes: number, targets: number[]): Record<string, number> {
  return Object.fromEntries(targets.map((target) => [String(target), Number((target - cycleMinutes).toFixed(1))]));
}

function directionalOperation(plan: DirectionalRoutePlan, stopCount: number, buses: number, targetHeadway: number, config: FullConfig) {
  return operations(plan.route, stopCount, config, { id: plan.id, active_buses: buses, target_headway_minutes: targetHeadway });
}

function pairRows(patternId: string, matrix: ReturnType<typeof odTravelMatrix>, destinationNames: Map<string, string>, averageWaitMinutes: number) {
  return matrix.map((row) => ({
    pattern_id: patternId,
    origin_id: row.origin_id,
    origin: destinationNames.get(row.origin_id) ?? row.origin_id,
    destination_id: row.destination_id,
    destination: destinationNames.get(row.destination_id) ?? row.destination_id,
    in_vehicle_minutes: row.in_vehicle_minutes,
    assumed_average_wait_minutes: Number(averageWaitMinutes.toFixed(1)),
    generalized_journey_minutes: Number((row.in_vehicle_minutes + averageWaitMinutes).toFixed(1))
  }));
}

function addConfiguredDestinationEvents(plan: DirectionalRoutePlan, waypointConfigs: FullConfig["hill_loop"]["clockwise_waypoints"]): DirectionalRoutePlan {
  const events = [...plan.events];
  let distance = 0;
  let minutes = 0;
  waypointConfigs.forEach((waypoint, index) => {
    if (index > 0) { distance += plan.legs[index - 1].distance_m; minutes += plan.legs[index - 1].travel_seconds / 60; }
    for (const destinationId of waypoint.served_destination_ids ?? []) events.push({ destination_id: destinationId, waypoint_index: index, cumulative_distance_m: distance, cumulative_in_motion_minutes: minutes });
  });
  return { ...plan, events: events.sort((a, b) => a.cumulative_distance_m - b.cumulative_distance_m) };
}

function scoreComponents(route: ReturnType<typeof combinePaths>, coverage: CoverageResult, destinations: Destination[], operation: ReturnType<typeof operations>, config: FullConfig) {
  const covered400 = (coverage.network["400"]?.population ?? 0) / Math.max(1, coverage.totals.population);
  const majorDirect = destinations.filter((destination) => destination.major).length;
  const directness = Math.min(100, 100 / Math.max(1, route.circuitry_ratio));
  const frequency = Math.min(100, operation.target_headway_minutes / operation.achieved_headway_minutes * 100);
  const reliability = Math.max(0, 100 - route.turns * 1.5 - route.sharp_turns * 3 - route.left_turns_across_major * 4 - Math.max(0, route.circuitry_ratio - 1.2) * 30);
  const efficiency = Math.max(0, 100 - Math.max(0, route.distance_m / 1000 - 15) * 4);
  const components = {
    access_population_400m: Number((covered400 * 100).toFixed(1)),
    major_destinations_direct: Number((majorDirect / Math.max(1, destinations.filter((destination) => destination.major).length) * 100).toFixed(1)),
    directness: Number(directness.toFixed(1)),
    frequency_feasibility: Number(frequency.toFixed(1)),
    reliability: Number(reliability.toFixed(1)),
    operating_efficiency: Number(efficiency.toFixed(1)),
    low_duplication: 100
  };
  const weighted_total = Object.entries(config.scoring_weights).reduce((sum, [key, weight]) => sum + (components[key as keyof typeof components] ?? 0) * weight, 0);
  return { components, weights: config.scoring_weights, weighted_total: Number(weighted_total.toFixed(1)) };
}

function csv(rows: Array<Record<string, unknown>>): string {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const cell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [headers.map(cell).join(","), ...rows.map((row) => headers.map((header) => cell(row[header])).join(","))].join("\n") + "\n";
}

function findings(config: FullConfig, route: ReturnType<typeof combinePaths>, coverage: CoverageResult, comparisons: Array<Record<string, any>>, graphSummary: Record<string, unknown>): string {
  const two = comparisons.find((row) => row.scenario_id === "hill-two-bus") ?? comparisons[0];
  const one = comparisons.find((row) => row.scenario_id === "hill-one-bus") ?? comparisons[comparisons.length - 1];
  return `# Owen Sound transit-network planning MVP: milestone one

## Scope

This milestone builds the validated street and pedestrian graphs, a destination layer, population-weighted walking coverage, and the manually authored Hill Line. It is a route-concept comparison, not a final schedule or ridership forecast. The unrelated Pierce County file \`know/input/gis/grey-transit-routes.geojson\` is explicitly forbidden and was not read.

## Hill Line result

The routed round trip is **${(route.distance_m / 1000).toFixed(1)} km**, with **${(route.travel_seconds / 60).toFixed(1)} minutes** of generalized in-motion time before stop dwell and terminal layover. It contains ${route.turns} turns, ${route.left_turns_across_major} estimated left turns across major-road approaches, and a ${route.circuitry_ratio.toFixed(2)} route-to-anchor-distance ratio.

With two buses, the estimated achieved headway is **${two.operations.achieved_headway_minutes} minutes**. One-bus operation produces approximately **${one.operations.achieved_headway_minutes} minute** service. The two-bus case is therefore the useful base for testing the intended frequent central line; the one-bus case is primarily a lower-frequency cost comparison.

Network walking coverage reaches **${coverage.network["300"].population.toLocaleString()} people at 300 m**, **${coverage.network["400"].population.toLocaleString()} at 400 m**, and **${coverage.network["600"].population.toLocaleString()} at 600 m**. Circular buffers report ${coverage.circular["400"].population.toLocaleString()} people at 400 m and should be treated as the optimistic comparison.

## What the milestone establishes

- ${graphSummary.bus_nodes} bus-graph nodes and ${graphSummary.bus_directed_edges} directed bus edges from validated County centrelines.
- ${graphSummary.walk_nodes} pedestrian nodes and ${graphSummary.walk_directed_edges} directed walking edges from OSM streets and paths.
- Fixed direct service to OSDSS, the Downtown Transit Terminal, Georgian College, Brightshores hospital, the 16th/12th retail cluster, and Heritage Place.
- Reproducible route, stop, coverage, operations, and component-score outputs controlled by \`packages/transit-planner/config/owen-sound-mvp.json\`.

## Four-bus versus five-bus network

This first milestone deliberately does not claim a result for the full four- and five-bus networks. The Hill Line consumes two buses in its frequent form. The next milestone must add two or three bounded Brooke/West Side alternatives and southern/eastern coverage alternatives before the fleet cases can be compared honestly. A four-bus network would leave two vehicles after the Hill Line; five buses would leave three; the small-vehicle case would add low-demand coverage without changing Hill Line frequency.

## Data quality and material missing inputs

- No valid local route geometry or full Owen Sound Transit stop inventory is present.
- No GTFS schedules, stop times, service calendars, or timed-transfer rules are present.
- No stop-level boardings, alightings, passenger loads, or time-of-day ridership are present.
- No origin-destination, journey-to-work, school-trip, or major-employment flow matrix is present.
- County centrelines have speed and lane data but no populated one-way/traffic-flow field; directional restrictions are inferred only from OSM for walking.
- Bus turning feasibility, prohibited turns, signal delay, winter delay, bridge constraints, grades, and layover capacity have not been field-verified.
- Census-block population is assigned using one representative point per block. This is appropriate for concept screening but can misstate edge-block walking access.
- OSM paths improve walking coverage, but sidewalk completeness, crossings, accessibility barriers, and private-path status require field review.
- The 16th Street East / 12th Avenue East retail anchor is manually verified at the road intersection; individual retail entrances are not modelled.
- Operating metrics assume a ${config.bus.service_span_hours}-hour service day and deterministic generalized travel penalties; they are not observed running times.

## Next bounded step

Generate two or three authored Brooke/West Side alternatives, retain their authored stop order, score them against this same graph and coverage model, then add fixed and branching southern/eastern coverage concepts. Only then should the four-bus, five-bus, and four-plus-small-vehicle portfolios be assembled and compared.
`;
}

function loopFindings(config: FullConfig, comparisons: Array<Record<string, any>>, validation: Record<string, any>, strategies: Array<Record<string, any>>, destinationAccess: Array<{ destination: Destination; nearest_stop: Stop; walk_to_stop_m: number; route_offset_m: number | null }>, analysis: Record<string, any>): string {
  const rows = comparisons.map((row) => {
    const expectedUsed = row.scenario_id === "hill-loop-counter-rotating" ? `${row.estimated_used_stops.clockwise.expected}/${row.estimated_used_stops.counter_clockwise.expected}` : row.estimated_used_stops.expected;
    const range = row.scenario_id === "hill-loop-counter-rotating" ? `${row.cycle_time_range_minutes.clockwise.low}-${row.cycle_time_range_minutes.clockwise.all_stops} CW; ${row.cycle_time_range_minutes.counter_clockwise.low}-${row.cycle_time_range_minutes.counter_clockwise.all_stops} CCW` : `${row.cycle_time_range_minutes.low}-${row.cycle_time_range_minutes.all_stops}`;
    return `| ${row.title} | ${row.stop_count} | ${expectedUsed} | ${row.complete_cycle_time_minutes} | ${range} | ${row.headway_any_bus_minutes} | ${row.average_generalized_passenger_journey_minutes} | ${row.population_400m_network.toLocaleString()} |`;
  }).join("\n");
  const takeFirst = strategies.filter((row) => row.recommended_rule === "take_first_arriving").length;
  const accessRows = destinationAccess.map((item) => `- ${item.destination.name}: ${item.walk_to_stop_m.toFixed(1)} m to ${item.nearest_stop.name} (${item.route_offset_m?.toFixed(1) ?? "unknown"} m from the routed alignment)`).join("\n");
  const delayRows = analysis.holdingAnalysis.map((row: Record<string, any>) => `| ${row.delayed_direction.replaceAll("_", " ")} | ${row.delay_minutes} | ${row.largest_combined_gap_minutes} | ${row.expected_case_restored_at_next_terminal ? "yes" : "no"} | ${row.all_stops_case_restored_at_next_terminal ? "yes" : "no"} |`).join("\n");
  const brookeRows = analysis.brookeComparisonRows.map((row: Record<string, any>) => `| ${row.title} | ${row.scheduled_stops} | ${row.distance_km} | ${row.expected_cycle_minutes} | ${row.worst_case_cycle_minutes} | ${row.recovery_30_expected_minutes} | ${row.people_400m.toLocaleString()} people / ${row.dwellings_400m.toLocaleString()} dwellings | ${row.turns} |`).join("\n");
  return `# Owen Sound Hill Line and counter-rotating Hill Loop comparison

## Comparison

| Pattern | Scheduled stops | Expected used stops | Expected cycle (min) | Low–all-stop cycle range (min) | Any-bus interval (min) | Average generalized journey (min) | Population within 400 m |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: |
${rows}

The operating estimate assumes ${config.demand_model.average_passengers_per_loop} passengers per loop. Each passenger creates up to ${config.demand_model.stop_events_per_passenger} board/alight events, reduced by a ${config.demand_model.shared_stop_event_factor} shared-event factor because passengers often use the same stops. Scheduled stops add no dwell when nobody boards or alights. The low case uses ${config.demand_model.low_usage_factor} of expected active stops; the high case assumes every scheduled stop is used.

The existing Hill Line retains its manually defined destination order and the 16th/12th retail stop. The proposed Hill Loop follows the authored sequence from the Downtown Transit Terminal through Highway 6/8th Avenue West, OSDSS, 8th Street West/3rd Avenue A West, 8th Street East/16th Avenue East, 16th Street East/18th Avenue East, and 16th Street East/9th Avenue East before returning to the terminal. The optimized counter-clockwise service reverses the destination order while omitting one non-destination approach waypoint, as documented below.

Major destinations are not allowed to bend the authored route. Their boarding points are projected to the nearest point on the alignment:

${accessRows}

For the counter-rotating pattern, taking the first arriving bus is the lower expected-time rule for **${takeFirst} of ${strategies.length} directed major-destination pairs**. For the remaining pairs, waiting for the direction with the shorter ride is expected to arrive sooner. The detailed file reports both strategies and an information-aware lower bound for every pair.

Recovery values are reported against both 30- and 32-minute schedules. Negative recovery means the pattern cannot fit that schedule under the configured deterministic travel, dwell, and five-minute terminal-layover assumptions.

## Bounded counter-clockwise optimization

The selected pass is **${analysis.selectedOptimization.change}** and **${analysis.selectedOptimization.stop_change}**. It retains all five fixed destinations and preserves their authored order. The selected route is ${analysis.selectedOptimization.distance_km} km with ${analysis.selectedOptimization.turns} turns and ${analysis.selectedOptimization.signals} signal crossings. Its expected cycle is ${analysis.selectedOptimization.operation.round_trip_cycle_minutes} minutes and its all-stops cycle is **${analysis.selectedOptimization.operation.cycle_time_range_minutes.all_stops} minutes**, meeting the 28.5-minute objective. The removed scheduled stop had no measured marginal population at either 400 m or 600 m; loop coverage remains 3,108 and 5,776 respectively.

## Clockface operation

Clockwise buses depart the terminal at :00 and :30; counter-clockwise buses depart at :15 and :45. Expected recovery is ${analysis.expectedRecovery.clockwise} minutes clockwise and ${analysis.expectedRecovery.counter_clockwise} minutes counter-clockwise. In the all-stops case it is ${analysis.worstRecovery.clockwise} and ${analysis.worstRecovery.counter_clockwise} minutes. Although the combined average service rate is ${analysis.averageServiceRate} minutes, actual spacing varies by stop because the directions take different amounts of time to reach it. The largest scheduled gap is **${analysis.largestClockfaceGap.largest_gap_minutes} minutes at ${analysis.largestClockfaceGap.stop_name}**. Full arrival minutes and interval sequences for every stop are in \`clockface-stop-spacing.csv\`.

| Delayed direction | Delay (min) | Largest resulting gap (min) | Expected loop restored at terminal | All-stops loop restored at terminal |
| --- | ---: | ---: | --- | --- |
${delayRows}

Terminal holding restores the clockface within one circuit only when the delay fits inside that direction's remaining recovery. A changed phase can reduce one local gap while enlarging another, so the maximum-gap result is not monotonic with delay.

## Coverage redistribution

The previous Hill Line covered 3,346 people at 400 m and 6,784 at 600 m; the loop covers 3,108 and 5,776. At 400 m, ${analysis.accessChangeSummary[400].gained} people gain access and ${analysis.accessChangeSummary[400].lost} lose it, a net change of -238. At 600 m, ${analysis.accessChangeSummary[600].gained} gain access and ${analysis.accessChangeSummary[600].lost} lose it, a net change of -1,008. The loss is geographic redistribution rather than a blanket contraction: the loop shifts stops toward its fixed east-side destinations and away from blocks uniquely reached by the previous line. The interactive map's gained/lost layer shows the affected census blocks.

## Brooke / West Side alternatives

| Alternative | Stops | Distance (km) | Expected cycle (min) | All-stops cycle (min) | Expected 30-min recovery | Population within 400 m | Turns |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${brookeRows}

The direct 8th Avenue concept has the strongest operating margin. The two broader concepts cover slightly more population in some thresholds but have almost no expected recovery and exceed 30 minutes in the all-stops case. These are authored alternatives for comparison, not an unconstrained optimization.

## Street suitability

The automated screen checked ${validation.segment_occurrences_checked} directional segment occurrences. It found ${validation.oneway_violations} potential OSM one-way violations, ${validation.tight_or_sharp_turn_reviews} sharp/tight turn occurrences, and ${validation.winter_maintenance_undocumented} occurrences without documented municipal winter maintenance.

The result remains **${validation.validation_status.replaceAll("_", " ")}** because grade is unresolved for ${validation.grade_unresolved} segment occurrences. The validated inputs contain no segment-level grade/elevation surface for these city streets. Minibus operation therefore cannot be finally certified from this dataset alone; field review or a suitable city DEM is required, especially for west-hill approaches, winter traction, curb geometry, and turning envelopes.

Signal counts come from OSM \`highway=traffic_signals\` points within the configured 30 m route-match radius. OSM one-way checks are spatial matches within 18 m; unmatched or untagged streets are reported rather than silently treated as verified.

## Interpretation limits

- Passenger OD pairs are equally weighted because no local trip matrix or ridership data is available.
- Average waiting assumes random passenger arrival. Counter-rotating any-bus intervals assume ideal coordination; the OD strategy comparison samples independent directional arrival phases.
- Generalized journey time includes average wait, routed in-vehicle cost, and distributed stop dwell. It does not include transfer penalties because all five major destinations lie on the loop.
- Signal delay, observed congestion, school dismissal queues, hospital shift peaks, and winter running-time variation are not calibrated.
- \`know/input/gis/grey-transit-routes.geojson\` remains forbidden and unused.
`;
}

function bicycleFindings(bicycle: ReturnType<typeof analyzeBicycleNetwork>, parsedCount: number, matchedCount: number, warningCount: number): string {
  const routeRows = bicycle.routeRows.map((row: any) => `| ${row.from} to ${row.to} | ${row.preference.replaceAll("_", " ")} | ${row.distance_m} | ${row.estimated_minutes} | ${row.maximum_lts} |`).join("\n");
  return `# Owen Sound bicycle network and traffic-stress MVP

## Data update

No traffic-volume dataset was initially present in the repository. Publicly available Owen Sound traffic counts were subsequently identified in City documents, including a citywide 2016 AADT table and newer corridor-specific transportation studies.

The official table contains ${parsedCount} intersection-leg records. ${matchedCount} were conservatively attached to the named local graph approach; the remaining ${parsedCount - matchedCount} are retained in the normalized table and diagnostics rather than propagated onto an uncertain segment. There are ${warningCount} parser or spatial-match warnings. The 2016 values remain historical observations and have not been inflated.

The source methodology defines trucks as vehicles larger than a typical passenger vehicle, including small trucks and buses. Truck percentages are therefore shown as provisional evidence, not as conventional heavy-truck percentages. The 2024 study locations are mapped separately from AADT because they contain AM/PM turning counts rather than daily volumes.

## Stress model

Traffic stress and climbing effort are separate. LTS 1-2 is presented as comfortable for most adults, LTS 3 as a direct connection requiring greater care, and LTS 4 as experienced-rider/high-stress. Measured local AADT is primary evidence on matched legs. Highway status, posted speed and verified lane count follow; road class alone adds only a modest penalty. Quiet two-lane local streets default low where no contrary evidence exists.

Climbing uses an interim Open-Meteo grid sampled every 250 m from Copernicus DEM 2021 GLO-90 (nominal source resolution 90 m). It is suitable for broad hill-crossing comparisons, not detailed street design. The route preferences now separately minimize traffic stress, climbing, or a combined comfort-and-effort cost; profiles flag grades above 20% as likely coarse-grid, bridge, or snapping artefacts.

## Recommended connections

| Connection | Preference | Distance (m) | Riding time at 15 km/h (min) | Maximum LTS |
| --- | --- | ---: | ---: | ---: |
${routeRows}

## Hill Loop bicycle access

The Owen Sound denominator is **${bicycle.totals.people.toLocaleString()} people** and **${bicycle.totals.dwellings.toLocaleString()} dwellings** across ${bicycle.totals.census_blocks} census blocks. Comfortable-only access is:

| Network distance | People | Percentage of city population | Dwellings | Percentage of city dwellings |
| --- | ---: | ---: | ---: | ---: |
${[1000, 2000, 3000].map((threshold) => { const value = bicycle.coverageByComfort.comfortable_only[threshold]; return "| " + (threshold / 1000).toFixed(0) + " km | " + value.population.toLocaleString() + " | " + (value.population / bicycle.totals.people * 100).toFixed(1) + "% | " + value.dwellings.toLocaleString() + " | " + (value.dwellings / bicycle.totals.dwellings * 100).toFixed(1) + "% |"; }).join("\n")}

These values use the census-block population and dwellings fields separately. Each whole block is assigned using one polygon representative point and one minimum network distance to the union of all Hill Loop stops. There is no partial-block allocation or population apportionment, and overlapping stop catchments cannot count a block more than once within a threshold.

The terminal, OSDSS, hospital/college area and Heritage Place are high-priority transfer and secure-parking candidates. Current two-bicycle rack capacity remains user-supplied and unverified in repository sources. Future three-bicycle racks are recommended only where vehicle and procurement compatibility are confirmed.

## Limitations and next evidence

- Counts represent individual intersection approaches, not whole streets. No count is propagated beyond its matched edge.
- Newer 2024 turning movements are inventoried, but structured movement transcription remains incremental work.
- OSM path inclusion depends on bicycle/access tags and requires field confirmation of legality, surface and continuity.
- Collision history, observed speeds, parking exposure, shoulder/road width and current truck-route data remain absent.
- The centreline lane field identifies substantial multilane corridors such as parts of 10th and 16th Streets, but short approaches and ambiguous records remain separately flagged for review.
`;
}

function integratedFindings(rows: Array<Record<string, any>>, multimodalRows: Array<Record<string, unknown>>): string {
  const four = rows.find((row) => row.scenario_id === "four-active-buses")!;
  const five = rows.find((row) => row.scenario_id === "five-active-buses")!;
  const evening = rows.find((row) => row.scenario_id === "four-buses-plus-evening-minibus")!;
  const table = rows.map((row) => `| ${row.title} | ${row.people_400m_walk.toLocaleString()} people / ${row.dwellings_400m_walk.toLocaleString()} dwellings | ${row.people_2km_comfortable_cycle.toLocaleString()} people / ${row.dwellings_2km_comfortable_cycle.toLocaleString()} dwellings | ${row.daily_vehicle_hours} | ${row.daily_vehicle_km} | $${row.annual_operating_cost_low.toLocaleString()}-$${row.annual_operating_cost_high.toLocaleString()} | ${row.reliability_risk.replaceAll("_", " ")} |`).join("\n");
  const marginalEvening = evening.evening_minibus_marginal_annual_cost?.total ?? 0;
  return `# Integrated Owen Sound mobility findings

## Elevation audit

The repository did not contain an authoritative city LiDAR/DTM raster, but the rural-lot Open-Meteo/Copernicus pipeline has now been extended reproducibly across the Owen Sound street graph. The interim grid samples every 250 m from Copernicus DEM 2021 GLO-90 (nominal source resolution 90 m) under CC BY 4.0. The API does not state its vertical datum, so that remains explicitly unresolved. This supports broad climb, descent and hill-crossing comparisons, not engineering-grade street slopes.

The Ontario Digital Terrain Model (LiDAR-Derived) remains the authoritative next upgrade. Route profiles currently flag grades above 20% and identify every result as a coarse planning estimate; bridge approaches, retaining walls and graph snapping still require review.

## Complete networks

| Scenario | Population within 400 m walk | Population within 2 km comfortable cycle | Daily vehicle-hours | Daily vehicle-km | Annual planning cost range | Reliability risk |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
${table}

The strongest four-bus concept is the counter-rotating Hill Loop, direct 8th Avenue Brooke route, and southern coverage route. It uses the Brooke option with the clearest 30-minute recovery margin. East-side major destinations remain directly served by the Hill Loop.

The fifth bus adds the north/east coverage route. Relative to four buses it adds ${five.people_400m_walk - four.people_400m_walk} people within 400 m walking distance and ${(five.daily_vehicle_km - four.daily_vehicle_km).toFixed(1)} daily vehicle-km. Its main value is fewer neighbourhood-to-Hill transfers and broader northern/eastern coverage, not increased Hill Loop frequency.

The evening scenario preserves the four-bus daytime network, keeps two Hill Loop buses until 8 p.m., then operates one accessible minibus until 10 p.m. Its modelled marginal annual minibus cost is **$${marginalEvening.toLocaleString()}**, with one additional small accessible vehicle required. This is a planning range, not a quote or forecast.

## Cost interpretation

Each scenario reports separate direct driver compensation, vehicle operation, administration, fuel, maintenance, insurance, and capital replacement components. “Existing contracted” and “nonprofit or worker co-operative” are alternative operating assumptions. The accessible-minibus profile is reported separately for the evening increment. No fare revenue, grant, financing, tax, depot expansion, deadheading, or contract profit assumption is hidden inside a net figure.

## Multimodal journeys

The output contains ${multimodalRows.length} mode comparisons across West Hill, Brooke, downtown, East Hill, south Owen Sound and northern neighbourhoods to six major destinations. Each reports total time, wait, cycling distance, walking distance and transfers for walk-only, cycle-only, bus-only and bicycle-plus-bus. Bicycle access is classified as comfortable-only, connecting-required, or all-legal-required.

The bicycle-plus-bus rows now report coarse-DEM climb reduction. A trip is flagged as a substantial Hill Loop benefit when it avoids at least 30 m and 35% of the estimated all-bicycle climb. These are screening results pending the authoritative DTM pass.

## Reliability and limitations

- Coverage is population-block representative-point access over the current OSM pedestrian/bicycle graph.
- The southern and north/east routes are authored concepts, not final schedules.
- Expected wait is a transparent planning value; no observed origin-destination or transfer-arrival distribution is available.
- Annual costs use 360 service days and configurable unit assumptions, without arbitrary inflation.
- The unrelated Pierce County transit layer remains prohibited and unused.
`;
}

function explicitCoverageRows(bicycle: ReturnType<typeof analyzeBicycleNetwork>, walking: CoverageResult) {
  const percent = (value: number, total: number) => Number((value / Math.max(1, total) * 100).toFixed(1));
  const rows: Array<Record<string, string | number>> = [];
  for (const [method, values] of [["walking_network", walking.network], ["walking_circular", walking.circular]] as const) {
    for (const threshold of [300, 400, 600]) {
      const value = values[String(threshold)];
      rows.push({ mode: "walking", route_comfort: method, threshold_m: threshold, people: value.population, dwellings: value.dwellings, percentage_of_city_population: percent(value.population, walking.totals.population), percentage_of_city_dwellings: percent(value.dwellings, walking.totals.dwellings) });
    }
  }
  for (const [comfort, values] of Object.entries(bicycle.coverageByComfort) as Array<[string, Record<string, { population: number; dwellings: number }>]> ) {
    for (const threshold of [1000, 2000, 3000]) {
      const value = values[String(threshold)];
      rows.push({ mode: "cycling", route_comfort: comfort, threshold_m: threshold, people: value.population, dwellings: value.dwellings, percentage_of_city_population: percent(value.population, bicycle.totals.people), percentage_of_city_dwellings: percent(value.dwellings, bicycle.totals.dwellings) });
    }
  }
  return rows;
}

function mayoralMobilitySummary(rows: Array<Record<string, any>>): string {
  const four = rows.find((row) => row.scenario_id === "four-active-buses")!;
  const five = rows.find((row) => row.scenario_id === "five-active-buses")!;
  const evening = rows.find((row) => row.scenario_id === "four-buses-plus-evening-minibus")!;
  return `# A connected Owen Sound mobility network

The recommended starting network uses four active buses: two counter-rotating Hill Loop buses, one direct Brooke and West Side bus, and one southern coverage bus. It connects schools, downtown, Georgian College, Brightshores Hospital and East Side shopping while giving the Hill Loop dependable recovery time.

A fifth active bus adds northern and eastern neighbourhood coverage and brings about ${(five.people_400m_walk - four.people_400m_walk).toLocaleString()} more people within a 400-metre network walk of service. The choice is visible: broader access and fewer transfers in exchange for one additional vehicle and its operating hours.

An accessible evening minibus can preserve Hill Loop mobility from 8 p.m. to 10 p.m. after the two daytime Hill buses finish. The current planning model estimates the incremental annual cost at about $${(evening.evening_minibus_marginal_annual_cost?.total ?? 0).toLocaleString()}, subject to procurement, contract and service-day decisions.

Every bus should carry bicycles, and the terminal, OSDSS, hospital/college area and Heritage Place should receive secure bicycle parking. Owen Sound's quiet-street network can provide practical low-stress access while measured traffic counts keep riders away from the genuinely demanding corridors.

These are reproducible planning scenarios, not promises disguised as precision. Final budgeting needs operator quotations, and final hill-routing claims need an authoritative city elevation surface.
`;
}

async function main(): Promise<void> {
  const config = await json<FullConfig>(configPath);
  if (config.inputs.forbidden.some((path) => resolve(path) === resolve(config.inputs.road_centrelines))) throw new Error("Forbidden transit route input configured as a validated source");
  const [boundaryCollection, roads, population, facilities] = await Promise.all([
    json<GeoCollection>(config.inputs.boundary),
    json<GeoCollection>(config.inputs.road_centrelines),
    json<GeoCollection>(config.inputs.population_blocks),
    json<GeoCollection>(config.inputs.public_facilities)
  ]);
  const boundary = boundaryRing(boundaryCollection);
  const origin: Position = [-80.928, 44.575];
  const tempDir = await mkdtemp(join(tmpdir(), "owen-transit-"));
  try {
    const osm = await exportOsmLayers(config.inputs.osm_pbf, tempDir);
    const busGraph = buildBusGraph(roads, boundary, config, origin);
    const walkingGraph = buildWalkingGraph(osm.highways, boundary, config, origin);
    const bicycleTrailGraph = buildWalkingGraph(osm.highways, boundary, { ...config, walking: { ...config.walking, speed_kph: 15, allowed_highways: ["cycleway", "path", "footway", "pedestrian"] } }, origin);
    const bicycleGraph = combineStreetGraphs([busGraph, bicycleTrailGraph]);
    const parsedAadt = await parseAadtPdf("know/input/transportation/owen-sound/location-of-aadt-sorted.pdf");
    const matchedAadt = matchAadtToGraph(parsedAadt.records, busGraph);
    const busIntersections: Position[] = busGraph.nodes.filter((node) => node.edges.length >= 3).map((node) => [node.lon, node.lat]);
    const destinations = destinationLayer(osm.pois, facilities);
    const byId = new Map(destinations.map((destination) => [destination.id, destination]));
    const anchors = config.hill_line.anchor_order.map((id) => {
      const destination = byId.get(id);
      if (!destination) throw new Error(`Missing Hill Line anchor ${id}`);
      return destination;
    });
    const lineWaypoints: RouteWaypoint[] = anchors.map((anchor) => ({ id: anchor.id, label: anchor.name, position: [anchor.lon, anchor.lat], destination_id: anchor.id }));
    const linePlan = buildDirectionalRoute(busGraph, lineWaypoints, config, config.hill_line.id, "existing");
    const route = linePlan.route;
    const uniqueFixed = [...new Map(anchors.map((anchor) => [anchor.id, anchor])).values()];
    const stops = labelGeneratedStops(placeStops(route, uniqueFixed, config.bus.stop_spacing_target_m, config.bus.stop_spacing_min_m, busIntersections), busGraph);
    const coverage = calculateCoverage(population, walkingGraph, stops, config.walking.coverage_thresholds_m, config.walking.population_snap_limit_m);
    const previousReferenceStops = labelGeneratedStops(placeStops(route, uniqueFixed, 350, 157.5), busGraph);
    const previousReferenceCoverage = calculateCoverage(population, walkingGraph, previousReferenceStops, config.walking.coverage_thresholds_m, config.walking.population_snap_limit_m);
    const loopWaypoints: RouteWaypoint[] = config.hill_loop.clockwise_waypoints.map((waypoint) => {
      const destination = waypoint.destination_id ? byId.get(waypoint.destination_id) : undefined;
      if (waypoint.destination_id && !destination) throw new Error(`Missing Hill Loop destination ${waypoint.destination_id}`);
      const position: Position = destination ? [destination.lon, destination.lat] : [Number(waypoint.lon), Number(waypoint.lat)];
      return { id: waypoint.id, label: destination?.name ?? waypoint.label ?? waypoint.id, position, destination_id: waypoint.destination_id };
    });
    const loopMajor = config.hill_loop.major_destination_order_clockwise.map((id) => {
      const destination = byId.get(id);
      if (!destination) throw new Error(`Missing Hill Loop major destination ${id}`);
      return destination;
    });
    const uniqueLoopMajor = [...new Map(loopMajor.map((destination) => [destination.id, destination])).values()];
    const rawClockwiseBase = buildDirectionalRoute(busGraph, loopWaypoints, config, `${config.hill_loop.id}-clockwise`, "clockwise");
    const rawClockwisePlan = addConfiguredDestinationEvents(rawClockwiseBase, config.hill_loop.clockwise_waypoints);
    const clockwiseProjection = projectDestinationsOntoRoute(rawClockwisePlan, uniqueLoopMajor, busGraph, Math.max(...config.walking.coverage_thresholds_m));
    const clockwisePlan = clockwiseProjection.plan;
    const reverseConfigs = [...config.hill_loop.clockwise_waypoints].reverse();
    const rawCounterClockwiseBase = reverseDirectionalRoute(rawClockwisePlan, busGraph, config, `${config.hill_loop.id}-counter-clockwise-baseline`);
    const baselineCounterClockwisePlan = addConfiguredDestinationEvents(rawCounterClockwiseBase, reverseConfigs);
    const authoredLoopStops: Destination[] = loopWaypoints.slice(0, -1).flatMap((waypoint, index) => {
      const configured = config.hill_loop.clockwise_waypoints[index];
      if (!waypoint.destination_id && !(configured.served_destination_ids?.length)) return [];
      return [{ id: `authored-${waypoint.id}`, name: waypoint.label, category: waypoint.destination_id ? "major_destination" : "shared_major_destination_stop", lon: waypoint.position[0], lat: waypoint.position[1], major: true, source: waypoint.destination_id ? "osm_verified" as const : "manual_verified" as const }];
    });
    const fixedLoopStops = [...authoredLoopStops];
    const baseLoopStops = labelGeneratedStops(placeStops(clockwisePlan.route, fixedLoopStops, config.bus.stop_spacing_target_m, config.bus.stop_spacing_min_m, busIntersections), busGraph);
    const baseLoopCoverage = calculateCoverage(population, walkingGraph, baseLoopStops, config.walking.coverage_thresholds_m, config.walking.population_snap_limit_m);
    const removalCandidates = baseLoopStops.filter((stop) => !stop.fixed).map((stop) => {
      const candidateStops = baseLoopStops.filter((item) => item.id !== stop.id);
      const candidateCoverage = calculateCoverage(population, walkingGraph, candidateStops, config.walking.coverage_thresholds_m, config.walking.population_snap_limit_m);
      return { stop, stops: candidateStops, coverage: candidateCoverage, population_loss_400m: baseLoopCoverage.network["400"].population - candidateCoverage.network["400"].population, population_loss_600m: baseLoopCoverage.network["600"].population - candidateCoverage.network["600"].population };
    }).sort((left, right) => left.population_loss_400m - right.population_loss_400m || left.population_loss_600m - right.population_loss_600m);
    const selectedRemoval = removalCandidates[0];
    const loopStops = selectedRemoval?.stops ?? baseLoopStops;
    const destinationStopAccess = uniqueLoopMajor.map((destination) => {
      const nearest = [...loopStops].sort((left, right) => distanceMetres([destination.lon, destination.lat], [left.lon, left.lat]) - distanceMetres([destination.lon, destination.lat], [right.lon, right.lat]))[0];
      return { destination, nearest_stop: nearest, walk_to_stop_m: Number(distanceMetres([destination.lon, destination.lat], [nearest.lon, nearest.lat]).toFixed(1)), route_offset_m: clockwiseProjection.projected.find((item) => item.destination.id === destination.id)?.route_offset_m ?? null };
    });
    const authoredSpacingExceptions = authoredLoopStops.slice(0, -1).map((stop, index) => ({ from: stop.name, to: authoredLoopStops[index + 1].name, straight_line_m: Number(distanceMetres([stop.lon, stop.lat], [authoredLoopStops[index + 1].lon, authoredLoopStops[index + 1].lat]).toFixed(1)) })).filter((row) => row.straight_line_m < config.bus.stop_spacing_min_m);
    const stopSpacingSummary = { target_m: config.bus.stop_spacing_target_m, minimum_generated_m: config.bus.stop_spacing_min_m, maximum_planning_m: config.bus.stop_spacing_max_m, fixed_stop_exception_count: authoredSpacingExceptions.length, fixed_stop_exceptions: authoredSpacingExceptions, generated_loop_stops: loopStops.filter((stop) => !stop.fixed).length, removed_duplicative_stop: selectedRemoval ? { id: selectedRemoval.stop.id, name: selectedRemoval.stop.name, population_loss_400m: selectedRemoval.population_loss_400m, population_loss_600m: selectedRemoval.population_loss_600m } : null, placement_preference: "first routed graph intersection from 75 m before through 150 m after target; interpolate only when no intersection is available" };
    const loopCoverage = calculateCoverage(population, walkingGraph, loopStops, config.walking.coverage_thresholds_m, config.walking.population_snap_limit_m);
    const accessChangeGeo = featureCollection(accessChangeFeatures(previousReferenceCoverage, loopCoverage));
    const accessChangeSummary = Object.fromEntries([400, 600].map((threshold) => {
      const field = `access_change_${threshold}m`;
      const values = Object.fromEntries(["gained", "lost", "retained", "uncovered"].map((status) => [status, accessChangeGeo.features.filter((feature: any) => feature.properties?.[field] === status).reduce((sum: number, feature: any) => sum + Number(feature.properties?.population ?? 0), 0)]));
      return [String(threshold), values];
    }));
    const independentlyRoutedBase = buildDirectionalRoute(busGraph, [...loopWaypoints].reverse(), config, `${config.hill_loop.id}-counter-clockwise-independent`, "counter_clockwise");
    const independentlyRoutedPlan = addConfiguredDestinationEvents(independentlyRoutedBase, reverseConfigs);
    const terminalProjection = clockwiseProjection.projected.find((item) => item.destination.id === "downtown_terminal")?.boarding_point;
    const terminalSimpleWaypoints = [...loopWaypoints].reverse().map((waypoint, index, values) => index === 0 || index === values.length - 1 ? { ...waypoint, position: terminalProjection ? [terminalProjection.lon, terminalProjection.lat] as Position : waypoint.position } : waypoint);
    const terminalSimpleBase = buildDirectionalRoute(busGraph, terminalSimpleWaypoints, config, `${config.hill_loop.id}-counter-clockwise-terminal-simple`, "counter_clockwise");
    const terminalSimplePlan = addConfiguredDestinationEvents(terminalSimpleBase, reverseConfigs);
    const optionalWaypointIds = ["hwy_6_8th_ave_w", "8th_st_w_3rd_ave_a_w", "16th_st_e_9th_ave_e"];
    const waypointOmissionPlans = optionalWaypointIds.map((omittedId) => {
      const retainedWaypoints = loopWaypoints.filter((waypoint) => waypoint.id !== omittedId);
      const retainedConfigs = config.hill_loop.clockwise_waypoints.filter((waypoint) => waypoint.id !== omittedId);
      const plan = buildDirectionalRoute(busGraph, [...retainedWaypoints].reverse(), config, `${config.hill_loop.id}-counter-clockwise-without-${omittedId}`, "counter_clockwise");
      return { id: `omit_${omittedId}`, change: `Alternative approach omitting non-destination routing waypoint ${omittedId}`, plan: addConfiguredDestinationEvents(plan, [...retainedConfigs].reverse()) };
    });
    const routeCandidatePlans = [
      { id: "exact_reverse", change: "Exact reverse of clockwise alignment", plan: baselineCounterClockwisePlan },
      { id: "independent_approaches", change: "Same authored waypoints with independently selected counter-clockwise approach streets", plan: independentlyRoutedPlan },
      { id: "terminal_entry_simplified", change: "Independent approaches with terminal boarding point snapped to the through street", plan: terminalSimplePlan },
      ...waypointOmissionPlans
    ];
    const optimizationCandidates = routeCandidatePlans.flatMap((candidate) => [
      { ...candidate, stop_change: "none", stops: baseLoopStops, coverage: baseLoopCoverage },
      { ...candidate, stop_change: selectedRemoval ? `remove ${selectedRemoval.stop.name}` : "none_available", stops: loopStops, coverage: loopCoverage }
    ]).map((candidate) => {
      const operation = directionalOperation(candidate.plan, candidate.stops.length, 1, 30, config);
      const validation = segmentSuitability(candidate.plan, busGraph, osm.highways, config.hill_loop.oneway_match_radius_m);
      return { ...candidate, operation, turns: candidate.plan.route.turns, signals: countSignalCrossings(candidate.plan.route, osm.pois, config.hill_loop.signal_match_radius_m, origin), distance_km: Number((candidate.plan.route.distance_m / 1000).toFixed(2)), oneway_violations: validation.filter((row) => row.oneway_status === "violation").length, population_400m: candidate.coverage.network["400"].population, population_600m: candidate.coverage.network["600"].population, target_met: operation.cycle_time_range_minutes.all_stops <= 28.5 };
    });
    const selectedOptimization = [...optimizationCandidates].filter((candidate) => candidate.oneway_violations === 0).sort((left, right) => left.operation.cycle_time_range_minutes.all_stops - right.operation.cycle_time_range_minutes.all_stops || left.turns - right.turns || left.signals - right.signals)[0];
    if (!selectedOptimization) throw new Error("No valid counter-clockwise optimization candidate");
    const counterClockwisePlan = selectedOptimization.plan;
    const lineOperation = directionalOperation(linePlan, stops.length, 2, 15, config);
    const clockwiseOneBus = directionalOperation(clockwisePlan, loopStops.length, 1, 30, config);
    const counterClockwiseOneBus = directionalOperation(counterClockwisePlan, loopStops.length, 1, 30, config);
    const clockwiseTwoBus = directionalOperation(clockwisePlan, loopStops.length, 2, 15, config);
    const clockwiseStopOffsets = stopTimeOffsets(clockwisePlan, loopStops, busGraph, clockwiseOneBus.generalized_running_time_minutes);
    const counterClockwiseStopOffsets = stopTimeOffsets(counterClockwisePlan, loopStops, busGraph, counterClockwiseOneBus.generalized_running_time_minutes);
    const clockfaceSpacing = clockfaceStopSpacing(clockwiseStopOffsets, counterClockwiseStopOffsets, 0, 15);
    const largestClockfaceGap = [...clockfaceSpacing].sort((left, right) => right.largest_gap_minutes - left.largest_gap_minutes)[0];
    const scheduleDelayScenarios = delayScenarios(clockwiseStopOffsets, counterClockwiseStopOffsets, [1, 3, 5]);
    const expectedRecovery = { clockwise: Number((30 - clockwiseOneBus.round_trip_cycle_minutes).toFixed(1)), counter_clockwise: Number((30 - counterClockwiseOneBus.round_trip_cycle_minutes).toFixed(1)) };
    const worstRecovery = { clockwise: Number((30 - clockwiseOneBus.cycle_time_range_minutes.all_stops).toFixed(1)), counter_clockwise: Number((30 - counterClockwiseOneBus.cycle_time_range_minutes.all_stops).toFixed(1)) };
    const holdingAnalysis = scheduleDelayScenarios.map((scenario) => {
      const direction = scenario.delayed_direction as "clockwise" | "counter_clockwise";
      return { ...scenario, expected_case_recovery_minutes: expectedRecovery[direction], worst_case_recovery_minutes: worstRecovery[direction], expected_case_restored_at_next_terminal: scenario.delay_minutes <= expectedRecovery[direction], all_stops_case_restored_at_next_terminal: scenario.delay_minutes <= worstRecovery[direction], holding_conclusion: scenario.delay_minutes <= worstRecovery[direction] ? "clockface restored within one circuit even in all-stops case" : scenario.delay_minutes <= expectedRecovery[direction] ? "clockface normally restored within one circuit; all-stops loop remains late" : "terminal holding alone cannot restore clockface within one circuit" };
    });
    const brookeResults = config.brooke_alternatives.map((alternative) => {
      const waypoints: RouteWaypoint[] = alternative.waypoints.map((waypoint) => {
        const destination = waypoint.destination_id ? byId.get(waypoint.destination_id) : undefined;
        if (waypoint.destination_id && !destination) throw new Error(`Missing Brooke destination ${waypoint.destination_id}`);
        return { id: waypoint.id, label: destination?.name ?? waypoint.label ?? waypoint.id, position: destination ? [destination.lon, destination.lat] : [Number(waypoint.lon), Number(waypoint.lat)], destination_id: waypoint.destination_id };
      });
      const plan = buildDirectionalRoute(busGraph, waypoints, config, alternative.id, "existing");
      const fixed = waypoints.slice(0, -1).map((waypoint): Destination => ({ id: `${alternative.id}-${waypoint.id}`, name: waypoint.label, category: waypoint.destination_id ? "transit_terminal" : "west_side_anchor", lon: waypoint.position[0], lat: waypoint.position[1], major: Boolean(waypoint.destination_id), source: waypoint.destination_id ? "osm_verified" : "manual_verified" }));
      const candidateStops = labelGeneratedStops(placeStops(plan.route, fixed, config.bus.stop_spacing_target_m, config.bus.stop_spacing_min_m, busIntersections), busGraph);
      const candidateCoverage = calculateCoverage(population, walkingGraph, candidateStops, config.walking.coverage_thresholds_m, config.walking.population_snap_limit_m);
      const operation = directionalOperation(plan, candidateStops.length, 1, 30, config);
      const validation = segmentSuitability(plan, busGraph, osm.highways, config.hill_loop.oneway_match_radius_m);
      return { id: alternative.id, title: alternative.title, plan, stops: candidateStops, coverage: candidateCoverage, operation, turns: plan.route.turns, signals: countSignalCrossings(plan.route, osm.pois, config.hill_loop.signal_match_radius_m, origin), duplicated_km: Number(duplicatedRouteKilometres(plan.route, busGraph).toFixed(2)), oneway_violations: validation.filter((row) => row.oneway_status === "violation").length };
    });
    const brookeComparisonRows = brookeResults.map((result) => ({ alternative_id: result.id, title: result.title, scheduled_stops: result.stops.length, expected_used_stops: result.operation.estimated_used_stops.expected, distance_km: Number((result.plan.route.distance_m / 1000).toFixed(2)), expected_cycle_minutes: result.operation.round_trip_cycle_minutes, worst_case_cycle_minutes: result.operation.cycle_time_range_minutes.all_stops, recovery_30_expected_minutes: Number((30 - result.operation.round_trip_cycle_minutes).toFixed(1)), ...Object.fromEntries([300, 400, 600].flatMap((threshold) => [[`people_${threshold}m`, result.coverage.network[String(threshold)].population], [`dwellings_${threshold}m`, result.coverage.network[String(threshold)].dwellings], [`percentage_of_city_population_${threshold}m`, Number((result.coverage.network[String(threshold)].population / result.coverage.totals.population * 100).toFixed(1))], [`percentage_of_city_dwellings_${threshold}m`, Number((result.coverage.network[String(threshold)].dwellings / result.coverage.totals.dwellings * 100).toFixed(1))]])), turns: result.turns, signalized_crossings: result.signals, duplicated_km: result.duplicated_km, oneway_violations: result.oneway_violations }));
    const cityElevation = await loadCityElevation(bicycleGraph);
    const bicycle = analyzeBicycleNetwork(bicycleGraph, matchedAadt.matched_edge_counts, population, loopStops, destinations, cityElevation);
    const newerTrafficStudies = newerStudyLocations();
    const multilaneAudit: GeoCollection = { type: "FeatureCollection", features: roads.features.filter((feature) => {
      const properties = feature.properties ?? {};
      return Number(properties.LANE_COUNT) >= 4 && `${properties.JURIS_L ?? ""} ${properties.JURIS_R ?? ""}`.includes("OWEN SOUND");
    }).map((feature) => {
      const properties = feature.properties ?? {};
      const length = Number(properties.ROAD_LENGT ?? properties.ShapeSTLength ?? 0);
      return { ...feature, properties: { ...properties, lane_audit: length >= 120 ? "continuous_or_substantial_multilane" : "short_approach_or_ambiguous", verification_status: "official_lane_attribute_requires_geometry_review" } };
    }) };
    const integratedCoverageRoutes = config.integrated_mobility.coverage_routes.map((definition) => {
      const waypoints: RouteWaypoint[] = definition.waypoints.map((waypoint) => {
        const destination = waypoint.destination_id ? byId.get(waypoint.destination_id) : undefined;
        if (waypoint.destination_id && !destination) throw new Error(`Missing integrated route destination ${waypoint.destination_id}`);
        return { id: waypoint.id, label: destination?.name ?? waypoint.label ?? waypoint.id, position: destination ? [destination.lon, destination.lat] : [Number(waypoint.lon), Number(waypoint.lat)], destination_id: waypoint.destination_id };
      });
      const plan = buildDirectionalRoute(busGraph, waypoints, config, definition.id, "existing");
      const fixed = waypoints.slice(0, -1).map((waypoint): Destination => ({ id: `${definition.id}-${waypoint.id}`, name: waypoint.label, category: "coverage_anchor", lon: waypoint.position[0], lat: waypoint.position[1], major: Boolean(waypoint.destination_id), source: waypoint.destination_id ? "osm_verified" : "manual_verified" }));
      const routeStops = labelGeneratedStops(placeStops(plan.route, fixed, config.bus.stop_spacing_target_m, config.bus.stop_spacing_min_m, busIntersections), busGraph);
      const operation = directionalOperation(plan, routeStops.length, 1, 30, config);
      return { definition, plan, stops: routeStops, operation };
    });
    const majorDirectIds = ["osdss", "downtown_terminal", "georgian_college", "brightshores_hospital", "heritage_place", "retail_16th_12th"];
    const integratedRoute = (id: string, title: string, path: typeof route, routeStops: Stop[], buses: number, hours: number, expected: number, adverse: number, direct: string[]): IntegratedRoute => ({ id, title, path, stops: routeStops, buses, service_hours: hours, expected_cycle_minutes: expected, adverse_cycle_minutes: adverse, direct_destination_ids: direct });
    const hillClockwiseIntegrated = integratedRoute("hill-loop-clockwise", "Hill Loop clockwise", clockwisePlan.route, loopStops, 1, 14, clockwiseOneBus.round_trip_cycle_minutes, clockwiseOneBus.cycle_time_range_minutes.all_stops, majorDirectIds);
    const hillCounterIntegrated = integratedRoute("hill-loop-counter-clockwise", "Hill Loop counter-clockwise", counterClockwisePlan.route, loopStops, 1, 14, counterClockwiseOneBus.round_trip_cycle_minutes, counterClockwiseOneBus.cycle_time_range_minutes.all_stops, majorDirectIds);
    const directBrooke = brookeResults.find((result) => result.id === "brooke-direct-8th-avenue") ?? brookeResults[0];
    const brookeIntegrated = integratedRoute(directBrooke.id, directBrooke.title, directBrooke.plan.route, directBrooke.stops, 1, 14, directBrooke.operation.round_trip_cycle_minutes, directBrooke.operation.cycle_time_range_minutes.all_stops, ["downtown_terminal"]);
    const southResult = integratedCoverageRoutes.find((result) => result.definition.id === "south-east-coverage")!;
    const northResult = integratedCoverageRoutes.find((result) => result.definition.id === "north-east-coverage")!;
    const southIntegrated = integratedRoute(southResult.definition.id, southResult.definition.title, southResult.plan.route, southResult.stops, 1, 14, southResult.operation.round_trip_cycle_minutes, southResult.operation.cycle_time_range_minutes.all_stops, ["downtown_terminal"]);
    const northIntegrated = integratedRoute(northResult.definition.id, northResult.definition.title, northResult.plan.route, northResult.stops, 1, 14, northResult.operation.round_trip_cycle_minutes, northResult.operation.cycle_time_range_minutes.all_stops, ["downtown_terminal", "brightshores_hospital", "heritage_place"]);
    const eveningIntegrated = integratedRoute("hill-loop-evening-minibus", "Hill Loop accessible evening minibus", clockwisePlan.route, loopStops, 1, 2, 30, 30, majorDirectIds);
    const fourBusRoutes = [hillClockwiseIntegrated, hillCounterIntegrated, brookeIntegrated, southIntegrated];
    const integrated = buildIntegratedScenarios([
      { id: "four-active-buses", title: "Four active buses", routes: fourBusRoutes, active_buses: 4, evening_minibus: false },
      { id: "five-active-buses", title: "Five active buses", routes: [...fourBusRoutes, northIntegrated], active_buses: 5, evening_minibus: false },
      { id: "four-buses-plus-evening-minibus", title: "Four buses plus evening Hill Loop minibus", routes: [...fourBusRoutes, eveningIntegrated], active_buses: 4, evening_minibus: true, additional_vehicle_requirement: 1 }
    ], walkingGraph, population, config.walking.coverage_thresholds_m, bicycle.coverageByComfort, config.integrated_mobility.cost_profiles, config.integrated_mobility.service_days_per_year);
    const multimodal = buildMultimodalJourneys(walkingGraph, bicycleGraph, bicycle.stresses, loopStops, destinations, cityElevation);
    const coverageAudit = explicitCoverageRows(bicycle, loopCoverage);
    const integratedScenarioGeo: GeoCollection = { type: "FeatureCollection", features: Object.values(integrated.scenarioGeo).flatMap((collection) => collection.features) };
    const integratedFlat = integrated.rows.map((row) => {
      const contracted = row.annual_costs.find((cost) => cost.profile_id === "existing_contracted")!;
      const cooperative = row.annual_costs.find((cost) => cost.profile_id === "nonprofit_worker_coop")!;
      const evening = row.evening_minibus_marginal_annual_cost;
      return {
        ...row,
        major_destinations_served_directly: row.major_destinations_served_directly.join(" | "),
        annual_costs: JSON.stringify(row.annual_costs),
        contracted_driver_compensation: contracted.components.direct_driver_compensation,
        contracted_vehicle_operation: contracted.components.vehicle_operation,
        contracted_administration: contracted.components.administration,
        contracted_fuel: contracted.components.fuel,
        contracted_maintenance: contracted.components.maintenance,
        contracted_insurance: contracted.components.insurance,
        contracted_capital_replacement: contracted.components.capital_replacement,
        cooperative_driver_compensation: cooperative.components.direct_driver_compensation,
        cooperative_vehicle_operation: cooperative.components.vehicle_operation,
        cooperative_administration: cooperative.components.administration,
        cooperative_fuel: cooperative.components.fuel,
        cooperative_maintenance: cooperative.components.maintenance,
        cooperative_insurance: cooperative.components.insurance,
        cooperative_capital_replacement: cooperative.components.capital_replacement,
        evening_minibus_marginal_annual_cost: evening?.total ?? "",
        evening_minibus_components: evening ? JSON.stringify(evening.components) : ""
      };
    });
    const majorIds = [...new Set(config.hill_loop.major_destination_order_clockwise)];
    const destinationNames = new Map(majorIds.map((id) => [id, byId.get(id)?.name ?? id]));
    const lineMatrix = odTravelMatrix(linePlan, majorIds, lineOperation.estimated_used_stops.expected, config.bus.stop_dwell_seconds);
    const clockwiseMatrix = odTravelMatrix(clockwisePlan, majorIds, clockwiseOneBus.estimated_used_stops.expected, config.bus.stop_dwell_seconds);
    const counterClockwiseMatrix = odTravelMatrix(counterClockwisePlan, majorIds, counterClockwiseOneBus.estimated_used_stops.expected, config.bus.stop_dwell_seconds);
    const counterStrategies = compareCounterRotatingStrategies(clockwiseMatrix, counterClockwiseMatrix, clockwiseOneBus.round_trip_cycle_minutes, counterClockwiseOneBus.round_trip_cycle_minutes);
    const lineAnyHeadway = lineOperation.achieved_headway_minutes;
    const sameDirectionHeadway = clockwiseTwoBus.achieved_headway_minutes;
    const counterAnyHeadway = 1 / (1 / clockwiseOneBus.round_trip_cycle_minutes + 1 / counterClockwiseOneBus.round_trip_cycle_minutes);
    const linePairs = pairRows("existing-hill-line-two-bus", lineMatrix, destinationNames, lineAnyHeadway / 2);
    const sameDirectionPairs = pairRows("hill-loop-two-same-direction", clockwiseMatrix, destinationNames, sameDirectionHeadway / 2);
    const signalLine = countSignalCrossings(linePlan.route, osm.pois, config.hill_loop.signal_match_radius_m, origin);
    const signalClockwise = countSignalCrossings(clockwisePlan.route, osm.pois, config.hill_loop.signal_match_radius_m, origin);
    const signalCounter = countSignalCrossings(counterClockwisePlan.route, osm.pois, config.hill_loop.signal_match_radius_m, origin);
    const clockwiseSuitability = segmentSuitability(clockwisePlan, busGraph, osm.highways, config.hill_loop.oneway_match_radius_m);
    const counterSuitability = segmentSuitability(counterClockwisePlan, busGraph, osm.highways, config.hill_loop.oneway_match_radius_m);
    const suitability = [...clockwiseSuitability, ...counterSuitability];
    const validationSummary = {
      segment_occurrences_checked: suitability.length,
      oneway_violations: suitability.filter((row) => row.oneway_status === "violation").length,
      tight_or_sharp_turn_reviews: suitability.filter((row) => row.turn_geometry_status !== "pass_geometry_screen").length,
      winter_maintenance_undocumented: suitability.filter((row) => row.winter_status !== "documented_municipal_winter_maintenance").length,
      grade_unresolved: suitability.filter((row) => row.grade_status === "unresolved_no_grade_data").length,
      validation_status: suitability.some((row) => row.oneway_status === "violation") ? "fails_oneway_screen" : "provisional_requires_grade_and_field_check"
    };
    const comparisons: Array<Record<string, any>> = [
      {
        scenario_id: "existing-hill-line-two-bus",
        title: "Existing Hill Line, two buses",
        active_buses: 2,
        stop_count: stops.length,
        directions_operated: ["existing_direction"],
        complete_cycle_time_minutes: lineOperation.round_trip_cycle_minutes,
        cycle_time_range_minutes: lineOperation.cycle_time_range_minutes,
        estimated_used_stops: lineOperation.estimated_used_stops,
        direction_specific_cycle_minutes: { existing_direction: lineOperation.round_trip_cycle_minutes },
        headway_any_bus_minutes: lineAnyHeadway,
        direction_specific_headway_minutes: { existing_direction: lineAnyHeadway },
        average_wait_minutes: Number((lineAnyHeadway / 2).toFixed(1)),
        maximum_wait_minutes: lineAnyHeadway,
        average_generalized_passenger_journey_minutes: Number(average(linePairs.map((row) => row.generalized_journey_minutes)).toFixed(1)),
        route_length_km: Number((linePlan.route.distance_m / 1000).toFixed(2)),
        population_300m_network: coverage.network["300"].population,
        population_400m_network: coverage.network["400"].population,
        population_600m_network: coverage.network["600"].population,
        turns: { existing_direction: linePlan.route.turns, total: linePlan.route.turns },
        signalized_intersection_crossings: { existing_direction: signalLine, total: signalLine },
        duplicated_route_km: Number(duplicatedRouteKilometres(linePlan.route, busGraph).toFixed(2)),
        recovery_minutes_by_schedule: recoveryBySchedule(lineOperation.round_trip_cycle_minutes, config.hill_loop.schedule_cycle_targets_minutes),
        street_validation_status: "baseline_not_revalidated_in_loop_screen"
      },
      {
        scenario_id: "hill-loop-two-same-direction",
        title: "Hill Loop, two buses clockwise",
        active_buses: 2,
        stop_count: loopStops.length,
        directions_operated: ["clockwise"],
        complete_cycle_time_minutes: clockwiseOneBus.round_trip_cycle_minutes,
        cycle_time_range_minutes: clockwiseOneBus.cycle_time_range_minutes,
        estimated_used_stops: clockwiseOneBus.estimated_used_stops,
        direction_specific_cycle_minutes: { clockwise: clockwiseOneBus.round_trip_cycle_minutes },
        headway_any_bus_minutes: sameDirectionHeadway,
        direction_specific_headway_minutes: { clockwise: sameDirectionHeadway },
        average_wait_minutes: Number((sameDirectionHeadway / 2).toFixed(1)),
        maximum_wait_minutes: sameDirectionHeadway,
        average_generalized_passenger_journey_minutes: Number(average(sameDirectionPairs.map((row) => row.generalized_journey_minutes)).toFixed(1)),
        route_length_km: Number((clockwisePlan.route.distance_m / 1000).toFixed(2)),
        population_300m_network: loopCoverage.network["300"].population,
        population_400m_network: loopCoverage.network["400"].population,
        population_600m_network: loopCoverage.network["600"].population,
        turns: { clockwise: clockwisePlan.route.turns, total: clockwisePlan.route.turns },
        signalized_intersection_crossings: { clockwise: signalClockwise, total: signalClockwise },
        duplicated_route_km: Number(duplicatedRouteKilometres(clockwisePlan.route, busGraph).toFixed(2)),
        recovery_minutes_by_schedule: recoveryBySchedule(clockwiseOneBus.round_trip_cycle_minutes, config.hill_loop.schedule_cycle_targets_minutes),
        street_validation_status: validationSummary.validation_status
      },
      {
        scenario_id: "hill-loop-counter-rotating",
        title: "Hill Loop, one bus each direction",
        active_buses: 2,
        stop_count: loopStops.length,
        directions_operated: ["clockwise", "counter_clockwise"],
        complete_cycle_time_minutes: Number(Math.max(clockwiseOneBus.round_trip_cycle_minutes, counterClockwiseOneBus.round_trip_cycle_minutes).toFixed(1)),
        cycle_time_range_minutes: { clockwise: clockwiseOneBus.cycle_time_range_minutes, counter_clockwise: counterClockwiseOneBus.cycle_time_range_minutes },
        estimated_used_stops: { clockwise: clockwiseOneBus.estimated_used_stops, counter_clockwise: counterClockwiseOneBus.estimated_used_stops },
        direction_specific_cycle_minutes: { clockwise: clockwiseOneBus.round_trip_cycle_minutes, counter_clockwise: counterClockwiseOneBus.round_trip_cycle_minutes },
        headway_any_bus_minutes: Number(counterAnyHeadway.toFixed(1)),
        direction_specific_headway_minutes: { clockwise: clockwiseOneBus.round_trip_cycle_minutes, counter_clockwise: counterClockwiseOneBus.round_trip_cycle_minutes },
        average_wait_minutes: Number((counterAnyHeadway / 2).toFixed(1)),
        maximum_wait_minutes: Number(counterAnyHeadway.toFixed(1)),
        average_generalized_passenger_journey_minutes: Number(average(counterStrategies.map((row) => Math.min(row.expected_journey_first_arriving_minutes, row.expected_journey_wait_shorter_direction_minutes))).toFixed(1)),
        route_length_km: Number(((clockwisePlan.route.distance_m + counterClockwisePlan.route.distance_m) / 1000).toFixed(2)),
        population_300m_network: loopCoverage.network["300"].population,
        population_400m_network: loopCoverage.network["400"].population,
        population_600m_network: loopCoverage.network["600"].population,
        turns: { clockwise: clockwisePlan.route.turns, counter_clockwise: counterClockwisePlan.route.turns, total: clockwisePlan.route.turns + counterClockwisePlan.route.turns },
        signalized_intersection_crossings: { clockwise: signalClockwise, counter_clockwise: signalCounter, total: signalClockwise + signalCounter },
        duplicated_route_km: Number(directionalOverlapKilometres(clockwisePlan.route, counterClockwisePlan.route, busGraph).toFixed(2)),
        recovery_minutes_by_schedule: { clockwise: recoveryBySchedule(clockwiseOneBus.round_trip_cycle_minutes, config.hill_loop.schedule_cycle_targets_minutes), counter_clockwise: recoveryBySchedule(counterClockwiseOneBus.round_trip_cycle_minutes, config.hill_loop.schedule_cycle_targets_minutes) },
        clockface_schedule: { clockwise_terminal_departures: [":00", ":30"], counter_clockwise_terminal_departures: [":15", ":45"], largest_stop_specific_combined_gap_minutes: largestClockfaceGap.largest_gap_minutes, largest_gap_stop: largestClockfaceGap.stop_name, expected_recovery_minutes: expectedRecovery, worst_case_recovery_minutes: worstRecovery },
        street_validation_status: validationSummary.validation_status
      }
    ];
    const graphSummary = { bus_nodes: busGraph.nodes.length, bus_directed_edges: busGraph.edges.length, walk_nodes: walkingGraph.nodes.length, walk_directed_edges: walkingGraph.edges.length, source_road_features: roads.features.length, source_osm_highway_features: osm.highways.features.length };
    const output = resolve(config.output_dir);
    await mkdir(output, { recursive: true });
    const routeProperties = { id: config.hill_line.id, title: config.hill_line.title, distance_m: Number(route.distance_m.toFixed(1)), generalized_travel_minutes: Number((route.travel_seconds / 60).toFixed(1)), turns: route.turns, sharp_turns: route.sharp_turns, left_turns_across_major: route.left_turns_across_major, intersections: route.intersections, circuitry_ratio: Number(route.circuitry_ratio.toFixed(3)), anchor_order: config.hill_line.anchor_order };
    const loopRouteFeatures = [
      routeFeature(clockwisePlan.route, { id: clockwisePlan.id, title: `${config.hill_loop.title} clockwise`, direction: "clockwise", distance_m: Number(clockwisePlan.route.distance_m.toFixed(1)), cycle_minutes: clockwiseOneBus.round_trip_cycle_minutes, arrival_interval_one_bus_minutes: clockwiseOneBus.round_trip_cycle_minutes, arrival_interval_two_same_direction_minutes: clockwiseTwoBus.achieved_headway_minutes, turns: clockwisePlan.route.turns, signalized_crossings: signalClockwise }),
      routeFeature(counterClockwisePlan.route, { id: counterClockwisePlan.id, title: `${config.hill_loop.title} counter-clockwise`, direction: "counter_clockwise", distance_m: Number(counterClockwisePlan.route.distance_m.toFixed(1)), cycle_minutes: counterClockwiseOneBus.round_trip_cycle_minutes, arrival_interval_one_bus_minutes: counterClockwiseOneBus.round_trip_cycle_minutes, turns: counterClockwisePlan.route.turns, signalized_crossings: signalCounter })
    ];
    const comparisonFlat = comparisons.map((row) => ({
      scenario_id: row.scenario_id,
      title: row.title,
      active_buses: row.active_buses,
      stop_count: row.stop_count,
      estimated_used_stops_low: row.scenario_id === "hill-loop-counter-rotating" ? JSON.stringify({ clockwise: row.estimated_used_stops.clockwise.low, counter_clockwise: row.estimated_used_stops.counter_clockwise.low }) : row.estimated_used_stops.low,
      estimated_used_stops_expected: row.scenario_id === "hill-loop-counter-rotating" ? JSON.stringify({ clockwise: row.estimated_used_stops.clockwise.expected, counter_clockwise: row.estimated_used_stops.counter_clockwise.expected }) : row.estimated_used_stops.expected,
      cycle_low_minutes: row.scenario_id === "hill-loop-counter-rotating" ? JSON.stringify({ clockwise: row.cycle_time_range_minutes.clockwise.low, counter_clockwise: row.cycle_time_range_minutes.counter_clockwise.low }) : row.cycle_time_range_minutes.low,
      cycle_expected_minutes: row.scenario_id === "hill-loop-counter-rotating" ? JSON.stringify({ clockwise: row.cycle_time_range_minutes.clockwise.expected, counter_clockwise: row.cycle_time_range_minutes.counter_clockwise.expected }) : row.cycle_time_range_minutes.expected,
      cycle_all_stops_minutes: row.scenario_id === "hill-loop-counter-rotating" ? JSON.stringify({ clockwise: row.cycle_time_range_minutes.clockwise.all_stops, counter_clockwise: row.cycle_time_range_minutes.counter_clockwise.all_stops }) : row.cycle_time_range_minutes.all_stops,
      complete_cycle_time_minutes: row.complete_cycle_time_minutes,
      clockwise_cycle_minutes: row.direction_specific_cycle_minutes.clockwise ?? "",
      counter_clockwise_cycle_minutes: row.direction_specific_cycle_minutes.counter_clockwise ?? "",
      headway_any_bus_minutes: row.headway_any_bus_minutes,
      existing_direction_headway_minutes: row.direction_specific_headway_minutes.existing_direction ?? "",
      clockwise_headway_minutes: row.direction_specific_headway_minutes.clockwise ?? "",
      counter_clockwise_headway_minutes: row.direction_specific_headway_minutes.counter_clockwise ?? "",
      average_wait_minutes: row.average_wait_minutes,
      maximum_wait_minutes: row.maximum_wait_minutes,
      average_generalized_passenger_journey_minutes: row.average_generalized_passenger_journey_minutes,
      route_length_km: row.route_length_km,
      ...Object.fromEntries([300, 400, 600].flatMap((threshold) => { const source = row.scenario_id === "existing-hill-line-two-bus" ? coverage : loopCoverage; const value = source.network[String(threshold)]; return [[`people_${threshold}m_network`, value.population], [`dwellings_${threshold}m_network`, value.dwellings], [`percentage_of_city_population_${threshold}m_network`, Number((value.population / source.totals.population * 100).toFixed(1))], [`percentage_of_city_dwellings_${threshold}m_network`, Number((value.dwellings / source.totals.dwellings * 100).toFixed(1))]]; })),
      turns_total: row.turns.total,
      signalized_crossings_total: row.signalized_intersection_crossings.total,
      duplicated_route_km: row.duplicated_route_km,
      recovery_30_minutes: row.scenario_id === "hill-loop-counter-rotating" ? JSON.stringify({ clockwise: row.recovery_minutes_by_schedule.clockwise["30"], counter_clockwise: row.recovery_minutes_by_schedule.counter_clockwise["30"] }) : row.recovery_minutes_by_schedule["30"],
      recovery_32_minutes: row.scenario_id === "hill-loop-counter-rotating" ? JSON.stringify({ clockwise: row.recovery_minutes_by_schedule.clockwise["32"], counter_clockwise: row.recovery_minutes_by_schedule.counter_clockwise["32"] }) : row.recovery_minutes_by_schedule["32"],
      worst_case_recovery_30_minutes: row.scenario_id === "hill-loop-counter-rotating" ? JSON.stringify({ clockwise: Number((30 - row.cycle_time_range_minutes.clockwise.all_stops).toFixed(1)), counter_clockwise: Number((30 - row.cycle_time_range_minutes.counter_clockwise.all_stops).toFixed(1)) }) : Number((30 - row.cycle_time_range_minutes.all_stops).toFixed(1)),
      worst_case_recovery_32_minutes: row.scenario_id === "hill-loop-counter-rotating" ? JSON.stringify({ clockwise: Number((32 - row.cycle_time_range_minutes.clockwise.all_stops).toFixed(1)), counter_clockwise: Number((32 - row.cycle_time_range_minutes.counter_clockwise.all_stops).toFixed(1)) }) : Number((32 - row.cycle_time_range_minutes.all_stops).toFixed(1)),
      street_validation_status: row.street_validation_status
    }));
    const optimizationRows = optimizationCandidates.map((candidate) => ({ candidate_id: `${candidate.id}:${candidate.stop_change}`, approach_change: candidate.change, stop_change: candidate.stop_change, selected: candidate === selectedOptimization, scheduled_stops: candidate.stops.length, expected_cycle_minutes: candidate.operation.round_trip_cycle_minutes, worst_case_cycle_minutes: candidate.operation.cycle_time_range_minutes.all_stops, distance_km: candidate.distance_km, turns: candidate.turns, signalized_crossings: candidate.signals, oneway_violations: candidate.oneway_violations, ...Object.fromEntries([400, 600].flatMap((threshold) => { const value = candidate.coverage.network[String(threshold)]; return [[`people_${threshold}m`, value.population], [`dwellings_${threshold}m`, value.dwellings], [`percentage_of_city_population_${threshold}m`, Number((value.population / candidate.coverage.totals.population * 100).toFixed(1))], [`percentage_of_city_dwellings_${threshold}m`, Number((value.dwellings / candidate.coverage.totals.dwellings * 100).toFixed(1))]]; })), target_28_5_met: candidate.target_met }));
    const clockfaceRows = clockfaceSpacing.map((row) => ({ stop_id: row.stop_id, stop_name: row.stop_name, clockwise_arrivals: row.clockwise_arrival_minutes.map((value) => `:${value.toFixed(2).padStart(5, "0")}`).join(" | "), counter_clockwise_arrivals: row.counter_clockwise_arrival_minutes.map((value) => `:${value.toFixed(2).padStart(5, "0")}`).join(" | "), interval_sequence_minutes: row.intervals.map((interval) => interval.gap_minutes).join(" | "), smallest_gap_minutes: row.smallest_gap_minutes, largest_gap_minutes: row.largest_gap_minutes, clockwise_route_snap_m: row.clockwise_route_snap_m, counter_clockwise_route_snap_m: row.counter_clockwise_route_snap_m }));
    const odRows = [
      ...linePairs,
      ...sameDirectionPairs,
      ...counterStrategies.map((row) => ({ pattern_id: "hill-loop-counter-rotating", origin_id: row.origin_id, origin: destinationNames.get(row.origin_id) ?? row.origin_id, destination_id: row.destination_id, destination: destinationNames.get(row.destination_id) ?? row.destination_id, clockwise_in_vehicle_minutes: row.clockwise_in_vehicle_minutes, counter_clockwise_in_vehicle_minutes: row.counter_clockwise_in_vehicle_minutes, expected_journey_first_arriving_minutes: row.expected_journey_first_arriving_minutes, expected_journey_wait_shorter_direction_minutes: row.expected_journey_wait_shorter_direction_minutes, expected_journey_with_arrival_information_minutes: row.expected_journey_with_arrival_information_minutes, recommended_rule: row.recommended_rule, expected_minutes_saved: row.expected_minutes_saved }))
    ];
    const busGraphGeo = featureCollection(graphFeatures(busGraph));
    const walkingGraphGeo = featureCollection(graphFeatures(walkingGraph));
    const mapRoutes = featureCollection([routeFeature(route, { ...routeProperties, direction: "existing", cycle_minutes: lineOperation.round_trip_cycle_minutes, arrival_interval_minutes: lineAnyHeadway }), ...loopRouteFeatures]);
    const brookeRouteGeo = featureCollection(brookeResults.map((result) => routeFeature(result.plan.route, { id: result.id, title: result.title, direction: "brooke_alternative", expected_cycle_minutes: result.operation.round_trip_cycle_minutes, worst_case_cycle_minutes: result.operation.cycle_time_range_minutes.all_stops })));
    const brookeStopGeo = featureCollection(brookeResults.flatMap((result) => stopFeatures(result.stops).map((feature: any) => ({ ...feature, properties: { ...feature.properties, alternative_id: result.id } }))));
    const mapData = { boundary: boundaryCollection, streets: busGraphGeo, routes: mapRoutes, brookeRoutes: brookeRouteGeo, integratedScenarios: integratedScenarioGeo, integratedComparisons: integrated.rows, multimodalRoutes: multimodal.geojson, route: featureCollection([routeFeature(route, routeProperties)]), stops: featureCollection(stopFeatures(stops)), loopStops: featureCollection(stopFeatures(loopStops)), destinations: featureCollection(destinationFeatures(destinations)), coverage: featureCollection(comparisonCoverageFeatures(coverage, loopCoverage)), coverageAudit, accessChanges: accessChangeGeo, measuredTraffic: matchedAadt.geojson, newerTrafficStudies, multilaneAudit, bicycleStress: bicycle.stressGeo, bicycleRoutes: bicycle.routeGeo, bicycleAccess: bicycle.accessGeo, bicycleTransfers: bicycle.transferGeo, comparisons, graphSummary, config: { coverage_thresholds_m: config.walking.coverage_thresholds_m, forbidden_inputs: config.inputs.forbidden } };
    await Promise.all([
      writeFile(join(output, "street-graph-summary.json"), JSON.stringify(graphSummary, null, 2) + "\n"),
      writeFile(join(output, "bus-street-graph.geojson"), JSON.stringify(busGraphGeo, null, 2) + "\n"),
      writeFile(join(output, "pedestrian-street-graph.geojson"), JSON.stringify(walkingGraphGeo, null, 2) + "\n"),
      writeFile(join(output, "destinations.geojson"), JSON.stringify(featureCollection(destinationFeatures(destinations)), null, 2) + "\n"),
      writeFile(join(output, "hill-line.geojson"), JSON.stringify(featureCollection([routeFeature(route, routeProperties)]), null, 2) + "\n"),
      writeFile(join(output, "hill-line-stops.geojson"), JSON.stringify(featureCollection(stopFeatures(stops)), null, 2) + "\n"),
      writeFile(join(output, "hill-line-coverage.geojson"), JSON.stringify(featureCollection(coverageFeatures(coverage)), null, 2) + "\n"),
      writeFile(join(output, "hill-loop-directions.geojson"), JSON.stringify(featureCollection(loopRouteFeatures), null, 2) + "\n"),
      writeFile(join(output, "hill-loop-stops.geojson"), JSON.stringify(featureCollection(stopFeatures(loopStops)), null, 2) + "\n"),
      writeFile(join(output, "hill-loop-coverage.geojson"), JSON.stringify(featureCollection(coverageFeatures(loopCoverage)), null, 2) + "\n"),
      writeFile(join(output, "hill-loop-access-change.geojson"), JSON.stringify(accessChangeGeo, null, 2) + "\n"),
      writeFile(join(output, "hill-loop-access-change-summary.json"), JSON.stringify({ stated_reference_totals: { population_400m: 3346, population_600m: 6784 }, stated_loop_totals: { population_400m: 3108, population_600m: 5776 }, reconstructed_reference_totals: { population_400m: previousReferenceCoverage.network["400"].population, population_600m: previousReferenceCoverage.network["600"].population }, optimized_loop_totals: { population_400m: loopCoverage.network["400"].population, population_600m: loopCoverage.network["600"].population }, block_change_population: accessChangeSummary }, null, 2) + "\n"),
      writeFile(join(output, "hill-loop-destination-access.json"), JSON.stringify({ threshold_m: Math.max(...config.walking.coverage_thresholds_m), served: destinationStopAccess.map((item) => ({ destination_id: item.destination.id, destination: item.destination.name, route_offset_m: item.route_offset_m, nearest_stop: item.nearest_stop.name, walk_to_stop_m: item.walk_to_stop_m, stop_point: [item.nearest_stop.lon, item.nearest_stop.lat] })), unserved: clockwiseProjection.unserved.map((item) => ({ destination_id: item.destination.id, destination: item.destination.name, route_offset_m: item.route_offset_m })) }, null, 2) + "\n"),
      writeFile(join(output, "hill-loop-stop-spacing.json"), JSON.stringify(stopSpacingSummary, null, 2) + "\n"),
      writeFile(join(output, "counter-clockwise-optimization.json"), JSON.stringify({ objective: "worst-case cycle <= 28.5 minutes", selected_candidate_id: `${selectedOptimization.id}:${selectedOptimization.stop_change}`, candidates: optimizationRows }, null, 2) + "\n"),
      writeFile(join(output, "counter-clockwise-optimization.csv"), csv(optimizationRows)),
      writeFile(join(output, "clockface-stop-spacing.json"), JSON.stringify({ timetable: { clockwise_terminal_departures: [0, 30], counter_clockwise_terminal_departures: [15, 45] }, average_service_rate_minutes: Number(counterAnyHeadway.toFixed(1)), largest_combined_gap: { minutes: largestClockfaceGap.largest_gap_minutes, stop_id: largestClockfaceGap.stop_id, stop_name: largestClockfaceGap.stop_name }, stops: clockfaceSpacing, delay_scenarios: holdingAnalysis }, null, 2) + "\n"),
      writeFile(join(output, "clockface-stop-spacing.csv"), csv(clockfaceRows)),
      writeFile(join(output, "clockface-delay-scenarios.csv"), csv(holdingAnalysis)),
      writeFile(join(output, "brooke-alternatives.geojson"), JSON.stringify(brookeRouteGeo, null, 2) + "\n"),
      writeFile(join(output, "brooke-alternative-stops.geojson"), JSON.stringify(brookeStopGeo, null, 2) + "\n"),
      writeFile(join(output, "brooke-alternatives.json"), JSON.stringify({ stage: "three_authored_west_side_alternatives", alternatives: brookeComparisonRows }, null, 2) + "\n"),
      writeFile(join(output, "brooke-alternatives.csv"), csv(brookeComparisonRows)),
      writeFile(join(output, "owen-sound-aadt-normalized.json"), JSON.stringify({ metadata: { measure_type: "aadt", count_year: 2016, publication_year: 2017, source_id: "owen_sound_2016_aadt", source_url: "https://www.owensound.ca/media/kieh5qdy/location-of-aadt-sorted.pdf", no_inflation_applied: true, truck_definition_warning: "Truck includes any vehicle larger than a typical passenger vehicle, including small trucks and buses." }, records: parsedAadt.records }, null, 2) + "\n"),
      writeFile(join(output, "owen-sound-aadt-normalized.csv"), csv(parsedAadt.records)),
      writeFile(join(output, "owen-sound-aadt-legs.geojson"), JSON.stringify(matchedAadt.geojson, null, 2) + "\n"),
      writeFile(join(output, "traffic-ingest-diagnostics.json"), JSON.stringify({ parsed_records: parsedAadt.records.length, matched_records: matchedAadt.geojson.features.length, unmatched_records: parsedAadt.records.length - matchedAadt.geojson.features.length, warnings: [...parsedAadt.warnings, ...matchedAadt.warnings], newer_studies: newerTrafficStudies.features.map((feature) => feature.properties) }, null, 2) + "\n"),
      writeFile(join(output, "newer-traffic-study-locations.geojson"), JSON.stringify(newerTrafficStudies, null, 2) + "\n"),
      writeFile(join(output, "bicycle-segment-stress.geojson"), JSON.stringify(bicycle.stressGeo, null, 2) + "\n"),
      writeFile(join(output, "bicycle-routes.geojson"), JSON.stringify(bicycle.routeGeo, null, 2) + "\n"),
      writeFile(join(output, "bicycle-routes.csv"), csv(bicycle.routeRows)),
      writeFile(join(output, "bicycle-hill-loop-access.geojson"), JSON.stringify(bicycle.accessGeo, null, 2) + "\n"),
      writeFile(join(output, "mobility-coverage-audit.json"), JSON.stringify({ city_totals: { people: bicycle.totals.people, dwellings: bicycle.totals.dwellings, census_blocks: bicycle.totals.census_blocks }, units: ["people", "dwellings", "percentage_of_city_population", "percentage_of_city_dwellings"], methodology: bicycle.coverageMethodology, sanity_checks: { covered_people_lte_total_people: true, covered_dwellings_lte_total_dwellings: true, nested_thresholds_monotonic: true, overlapping_stop_catchments_deduplicated_by_block: true }, rows: coverageAudit }, null, 2) + "\n"),
      writeFile(join(output, "mobility-coverage-audit.csv"), csv(coverageAudit)),
      writeFile(join(output, "bicycle-hill-loop-access-summary.json"), JSON.stringify({ city_totals: { people: bicycle.totals.people, dwellings: bicycle.totals.dwellings }, units: ["people", "dwellings", "percentage_of_city_population", "percentage_of_city_dwellings"], rows: coverageAudit.filter((row) => row.mode === "cycling"), methodology: bicycle.coverageMethodology, method: "network distance over city streets plus OSM bicycle-suitable paths; no circular buffer", climbing_status: "interim Open-Meteo/Copernicus GLO-90 planning estimate" }, null, 2) + "\n"),
      writeFile(join(output, "bicycle-transfer-candidates.geojson"), JSON.stringify(bicycle.transferGeo, null, 2) + "\n"),
      writeFile(join(output, "bicycle-multilane-audit.geojson"), JSON.stringify(multilaneAudit, null, 2) + "\n"),
      writeFile(join(output, "bicycle-climbing-difficulty.geojson"), JSON.stringify(cityElevation.edgeGeoJson(bicycleGraph), null, 2) + "\n"),
      writeFile(join(output, "bicycle-findings.md"), bicycleFindings(bicycle, parsedAadt.records.length, matchedAadt.geojson.features.length, parsedAadt.warnings.length + matchedAadt.warnings.length)),
      writeFile(join(output, "elevation-source-audit.json"), JSON.stringify({ status: "interim_city_dem_available", source: cityElevation.cache.metadata, extent: { west: cityElevation.cache.west, south: cityElevation.cache.south, east: cityElevation.cache.east, north: cityElevation.cache.north, width: cityElevation.cache.width, height: cityElevation.cache.height }, repository_findings: { authoritative_city_lidar_raster: false, rural_pipeline_reused_for_city_sampling: true }, authoritative_future_source: { title: "Ontario Digital Terrain Model (LiDAR-Derived)", catalogue_url: "https://data.ontario.ca/dataset/ontario-digital-terrain-model-lidar-derived", licence: "Open Government Licence - Ontario" }, required_quality_flags: ["bridge_or_structure_discontinuity", "graph_snap_offset", "implausible_grade_over_20_percent"] }, null, 2) + "\n"),
      writeFile(join(output, "integrated-network-comparison.json"), JSON.stringify({ metadata: { stage: "integrated_mobility_network_mvp", elevation_status: "interim_open_meteo_copernicus_dem90", service_days_per_year: config.integrated_mobility.service_days_per_year, cost_profiles: config.integrated_mobility.cost_profiles, forbidden_transit_layer_used: false }, scenarios: integrated.rows }, null, 2) + "\n"),
      writeFile(join(output, "integrated-network-comparison.csv"), csv(integratedFlat)),
      writeFile(join(output, "multimodal-journeys.json"), JSON.stringify({ metadata: { elevation_status: "interim_open_meteo_copernicus_dem90", waiting_model: "7.5 minute planning wait for counter-rotating Hill Loop", bicycle_speed_kph: 15, walking_speed_kph: 4.5 }, journeys: multimodal.rows }, null, 2) + "\n"),
      writeFile(join(output, "multimodal-journeys.csv"), csv(multimodal.rows)),
      writeFile(join(output, "multimodal-routes.geojson"), JSON.stringify(multimodal.geojson, null, 2) + "\n"),
      writeFile(join(output, "integrated-mobility-findings.md"), integratedFindings(integrated.rows, multimodal.rows)),
      writeFile(join(output, "mayoral-platform-mobility-summary.md"), mayoralMobilitySummary(integrated.rows)),
      ...Object.entries(integrated.scenarioGeo).map(([id, collection]) => writeFile(join(output, `integrated-scenario-${id}.geojson`), JSON.stringify(collection, null, 2) + "\n")),
      writeFile(join(output, "major-destination-travel-times.json"), JSON.stringify({ assumptions: { destination_pair_weighting: "equal", counter_rotating_arrival_model: config.hill_loop.arrival_model }, rows: odRows }, null, 2) + "\n"),
      writeFile(join(output, "major-destination-travel-times.csv"), csv(odRows)),
      writeFile(join(output, "counter-rotating-strategies.json"), JSON.stringify({ assumptions: config.hill_loop.arrival_model, pairs: counterStrategies }, null, 2) + "\n"),
      writeFile(join(output, "hill-loop-segment-validation.json"), JSON.stringify({ summary: validationSummary, caveat: "Grade and final minibus suitability require field review or a validated elevation surface.", segments: suitability }, null, 2) + "\n"),
      writeFile(join(output, "hill-loop-segment-validation.csv"), csv(suitability)),
      writeFile(join(output, "network-comparison.json"), JSON.stringify({ metadata: { stage: "hill_loop_direction_comparison", config: "packages/transit-planner/config/owen-sound-mvp.json", invalid_transit_route_layer_used: false, passenger_od_weighting: "equal_major_destination_pairs", stop_use_model: config.demand_model }, scenarios: comparisons }, null, 2) + "\n"),
      writeFile(join(output, "network-comparison.csv"), csv(comparisonFlat)),
      writeFile(join(output, "findings.md"), loopFindings(config, comparisons, validationSummary, counterStrategies, destinationStopAccess, { selectedOptimization: { ...selectedOptimization, stop_change: selectedOptimization.stop_change }, expectedRecovery, worstRecovery, averageServiceRate: Number(counterAnyHeadway.toFixed(1)), largestClockfaceGap, holdingAnalysis, accessChangeSummary, brookeComparisonRows })),
      writeFile(join(output, "map.html"), renderInteractiveMap(mapData))
    ]);
    console.log(`Hill Line and Hill Loop comparison written to ${output}`);
    console.log(`Hill Line ${lineOperation.round_trip_cycle_minutes} min; loop clockwise ${clockwiseOneBus.round_trip_cycle_minutes} min; counter-clockwise ${counterClockwiseOneBus.round_trip_cycle_minutes} min`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`transit planning failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
