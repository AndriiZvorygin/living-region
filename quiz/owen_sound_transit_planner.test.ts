import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import { buildBusGraph, buildWalkingGraph, calculateCoverage, estimateActiveStops, placeStops, shortestBusPath, type PlannerConfig } from "../packages/transit-planner/src/index";
import { buildDirectionalRoute, compareCounterRotatingStrategies, directionalOverlapKilometres, reverseDirectionalRoute } from "../packages/transit-planner/src/loop-analysis";
import { clockfaceStopSpacing } from "../packages/transit-planner/src/schedule-analysis";
import { matchAadtToGraph, parseAadtText } from "../packages/transit-planner/src/traffic-data";
import { buildIntegratedScenarios, type CostProfile, type IntegratedRoute } from "../packages/transit-planner/src/integrated-analysis";

const config: PlannerConfig = {
  bus: {
    default_speed_kph_by_road_class: { "3": 40, "5": 30, default: 30 },
    speed_cap_kph: 50,
    road_class_penalty_seconds_per_km: { "3": 0, "5": 30, default: 35 },
    intersection_penalty_seconds: 3,
    turn_penalty_seconds: 7,
    sharp_turn_penalty_seconds: 12,
    left_turn_major_road_penalty_seconds: 18,
    major_road_classes: [1, 2, 3],
    stop_dwell_seconds: 20,
    terminal_layover_minutes: 5,
    service_span_hours: 14,
    stop_spacing_target_m: 350,
    stop_spacing_min_m: 280,
    stop_spacing_max_m: 420,
    route_circuitry_warning_ratio: 1.45
  },
  walking: { speed_kph: 4.5, coverage_thresholds_m: [300, 400, 600], population_snap_limit_m: 180, allowed_highways: ["residential", "footway"] }
};

const boundary: [number, number][][] = [[[-81.01, 43.99], [-80.99, 43.99], [-80.99, 44.01], [-81.01, 44.01], [-81.01, 43.99]]];
const road = (name: string, coordinates: [number, number][], extra = {}) => ({ type: "Feature" as const, properties: { ROAD_NAME: name, JURIS_L: "CITY OF OWEN SOUND", JURIS_R: "CITY OF OWEN SOUND", ORN_ROAD_CLASS: 5, SPEED_LIMI: 40, ...extra }, geometry: { type: "LineString", coordinates } });

describe("Owen Sound transit planner milestone one", () => {
  test("bus graph excludes unsuitable links and routes over validated streets", () => {
    const roads = { type: "FeatureCollection" as const, features: [
      road("Main", [[-81, 44], [-80.999, 44], [-80.998, 44]]),
      road("Cross", [[-80.999, 44], [-80.999, 44.001]]),
      road("Private", [[-80.998, 44], [-80.998, 44.001]], { CLOSE_DETR: "NOT SUITABLE" })
    ] };
    const graph = buildBusGraph(roads, boundary, config, [-81, 44]);
    expect(graph.edges.some((edge) => edge.road_name === "Private")).toBe(false);
    const route = shortestBusPath(graph, [-81, 44], [-80.999, 44.001], config);
    expect(route.distance_m).toBeGreaterThan(150);
    expect(route.turns).toBe(1);
    expect(route.travel_seconds).toBeGreaterThan(0);
  });

  test("intermediate stops are deterministic and retain fixed destinations", () => {
    const route = { coordinates: [[-81, 44], [-80.99, 44]] as [number, number][], edge_ids: [], distance_m: 790, travel_seconds: 100, turns: 0, sharp_turns: 0, left_turns_across_major: 0, intersections: 0, straight_distance_m: 790, circuitry_ratio: 1 };
    const fixed = [{ id: "a", name: "A", category: "major", lon: -81, lat: 44, major: true, source: "manual_verified" as const }, { id: "b", name: "B", category: "major", lon: -80.99, lat: 44, major: true, source: "manual_verified" as const }];
    const stops = placeStops(route, fixed, 350);
    expect(stops.filter((stop) => stop.fixed)).toHaveLength(2);
    expect(stops.some((stop) => !stop.fixed)).toBe(true);
  });

  test("walking coverage reports network and circular results separately", () => {
    const osm = { type: "FeatureCollection" as const, features: [{ type: "Feature" as const, properties: { highway: "residential" }, geometry: { type: "LineString", coordinates: [[-81, 44], [-80.995, 44]] } }] };
    const graph = buildWalkingGraph(osm, boundary, config, [-81, 44]);
    const population = { type: "FeatureCollection" as const, features: [{ type: "Feature" as const, properties: { municipalityName: "Owen Sound", population: 100, dwellings: 50 }, geometry: { type: "Polygon", coordinates: [[[-80.9991, 43.9999], [-80.9989, 43.9999], [-80.9989, 44.0001], [-80.9991, 44.0001], [-80.9991, 43.9999]]] } }] };
    const stops = [{ id: "s", name: "Stop", category: "stop", lon: -81, lat: 44, major: true, source: "manual_verified" as const, sequence: 0, fixed: true }];
    const coverage = calculateCoverage(population, graph, stops, [300, 400, 600], 180);
    expect(coverage.network["300"].population).toBe(100);
    expect(coverage.circular["300"].population).toBe(100);
  });

  test("coverage unions all stops without duplicating blocks and remains monotonic", () => {
    const osm = { type: "FeatureCollection" as const, features: [{ type: "Feature" as const, properties: { highway: "residential" }, geometry: { type: "LineString", coordinates: [[-81, 44], [-80.995, 44]] } }] };
    const graph = buildWalkingGraph(osm, boundary, config, [-81, 44]);
    const population = { type: "FeatureCollection" as const, features: [{ type: "Feature" as const, properties: { municipalityName: "Owen Sound", population: 100, dwellings: 50 }, geometry: { type: "Polygon", coordinates: [[[-80.9991, 43.9999], [-80.9989, 43.9999], [-80.9989, 44.0001], [-80.9991, 44.0001], [-80.9991, 43.9999]]] } }] };
    const stops = [-81, -80.998].map((lon, sequence) => ({ id: `s${sequence}`, name: `Stop ${sequence}`, category: "stop", lon, lat: 44, major: true, source: "manual_verified" as const, sequence, fixed: true }));
    const coverage = calculateCoverage(population, graph, stops, [100, 300, 600], 180);
    expect(coverage.network["600"]).toEqual({ population: 100, dwellings: 50 });
    expect([100, 300, 600].map((threshold) => coverage.network[String(threshold)].population)).toEqual([100, 100, 100]);
    expect(coverage.totals).toEqual({ population: 100, dwellings: 50 });
    expect(coverage.methodology.overlap_deduplication).toContain("at most once");
  });

  test("configuration explicitly forbids the invalid Pierce County route layer", async () => {
    const parsed = JSON.parse(await readFile("packages/transit-planner/config/owen-sound-mvp.json", "utf8"));
    expect(parsed.inputs.forbidden).toContain("know/input/gis/grey-transit-routes.geojson");
  });

  test("counter-clockwise service reverses the exact clockwise street loop", () => {
    const roads = { type: "FeatureCollection" as const, features: [
      road("South", [[-81, 44], [-80.999, 44]]),
      road("East", [[-80.999, 44], [-80.999, 44.001]]),
      road("North", [[-80.999, 44.001], [-81, 44.001]]),
      road("West", [[-81, 44.001], [-81, 44]])
    ] };
    const graph = buildBusGraph(roads, boundary, config, [-81, 44]);
    const clockwise = buildDirectionalRoute(graph, [
      { id: "a", label: "A", position: [-81, 44], destination_id: "a" },
      { id: "b", label: "B", position: [-80.999, 44.001], destination_id: "b" },
      { id: "a", label: "A", position: [-81, 44], destination_id: "a" }
    ], config, "clockwise", "clockwise");
    const counter = reverseDirectionalRoute(clockwise, graph, config, "counter");
    expect(counter.route.coordinates).toEqual([...clockwise.route.coordinates].reverse());
    expect(directionalOverlapKilometres(clockwise.route, counter.route, graph)).toBeGreaterThan(0.18);
  });

  test("counter-rotating strategy reports first-arrival and shorter-direction choices", () => {
    const clockwise = [
      { origin_id: "a", destination_id: "b", in_vehicle_minutes: 2 },
      { origin_id: "b", destination_id: "a", in_vehicle_minutes: 28 }
    ];
    const counter = [
      { origin_id: "a", destination_id: "b", in_vehicle_minutes: 28 },
      { origin_id: "b", destination_id: "a", in_vehicle_minutes: 2 }
    ];
    const compared = compareCounterRotatingStrategies(clockwise, counter, 30, 30, 40);
    expect(compared).toHaveLength(2);
    expect(compared.every((row) => row.recommended_rule.includes("clockwise") || row.recommended_rule === "take_first_arriving")).toBe(true);
    expect(compared.every((row) => row.expected_journey_with_arrival_information_minutes <= row.expected_journey_first_arriving_minutes)).toBe(true);
  });

  test("low-ridership stop use remains below scheduled-stop worst case", () => {
    const estimate = estimateActiveStops(12, 7, 2, 0.72, 0.55, 2);
    expect(estimate).toEqual({ low: 3.9, expected: 7, all_stops: 12 });
    expect(estimate.expected).toBeLessThan(estimate.all_stops);
  });

  test("staggered counter-rotating departures produce stop-specific intervals", () => {
    const clockwise = [{ stop_id: "terminal", stop_name: "Terminal", route_snap_distance_m: 0, offset_minutes: 0 }, { stop_id: "east", stop_name: "East", route_snap_distance_m: 0, offset_minutes: 10 }];
    const counter = [{ stop_id: "terminal", stop_name: "Terminal", route_snap_distance_m: 0, offset_minutes: 0 }, { stop_id: "east", stop_name: "East", route_snap_distance_m: 0, offset_minutes: 20 }];
    const rows = clockfaceStopSpacing(clockwise, counter, 0, 15);
    expect(rows[0].intervals.map((row) => row.gap_minutes)).toEqual([15, 15, 15, 15]);
    expect(rows[1].largest_gap_minutes).toBe(25);
    expect(rows[1].smallest_gap_minutes).toBe(5);
  });

  test("official AADT rows preserve historical daily volume and provisional truck share", () => {
    const parsed = parseAadtText("10th St E & 2nd Ave E East Leg 14,923 19,504 -4,581 -23% 32%");
    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0]).toMatchObject({ aadt_2016: 14923, aadt_2006: 19504, truck_percent: 32, truck_percent_provisional: true, observed_count_year: 2016, measure_type: "aadt" });
  });

  test("AADT matching attaches evidence only to the named directional leg", () => {
    const roads = { type: "FeatureCollection" as const, features: [
      road("10th St E", [[-81.001, 44], [-81, 44], [-80.999, 44]]),
      road("2nd Ave E", [[-81, 43.999], [-81, 44], [-81, 44.001]])
    ] };
    const graph = buildBusGraph(roads, boundary, config, [-81, 44]);
    const record = parseAadtText("10th St E & 2nd Ave E East Leg 14,923 19,504 -4,581 -23% 32%").records[0];
    const matched = matchAadtToGraph([record], graph);
    expect(matched.geojson.features).toHaveLength(1);
    expect(matched.matched_edge_counts.size).toBe(1);
    expect(matched.geojson.features[0].properties?.match_confidence).toBe("measured_local");
  });

  test("integrated scenarios preserve component costs and monotonic added-route coverage", () => {
    const osm = { type: "FeatureCollection" as const, features: [{ type: "Feature" as const, properties: { highway: "residential" }, geometry: { type: "LineString", coordinates: [[-81, 44], [-80.995, 44], [-80.99, 44]] } }] };
    const graph = buildWalkingGraph(osm, boundary, config, [-81, 44]);
    const population = { type: "FeatureCollection" as const, features: [
      { type: "Feature" as const, properties: { municipalityName: "Owen Sound", population: 100, dwellings: 40 }, geometry: { type: "Polygon", coordinates: [[[-80.9991, 43.9999], [-80.9989, 43.9999], [-80.9989, 44.0001], [-80.9991, 44.0001], [-80.9991, 43.9999]]] } },
      { type: "Feature" as const, properties: { municipalityName: "Owen Sound", population: 80, dwellings: 30 }, geometry: { type: "Polygon", coordinates: [[[-80.9901, 43.9999], [-80.9899, 43.9999], [-80.9899, 44.0001], [-80.9901, 44.0001], [-80.9901, 43.9999]]] } }
    ] };
    const stop = (id: string, lon: number) => ({ id, name: id, category: "stop", lon, lat: 44, major: false, source: "manual_verified" as const, sequence: 0, fixed: true });
    const path = { coordinates: [[-81, 44], [-80.99, 44]] as [number, number][], edge_ids: [], distance_m: 790, travel_seconds: 180, turns: 0, sharp_turns: 0, left_turns_across_major: 0, intersections: 0, straight_distance_m: 790, circuitry_ratio: 1 };
    const base: IntegratedRoute = { id: "base", title: "Base", path, stops: [stop("west", -81)], buses: 1, service_hours: 10, expected_cycle_minutes: 30, adverse_cycle_minutes: 30, direct_destination_ids: [] };
    const added: IntegratedRoute = { ...base, id: "added", stops: [stop("east", -80.99)] };
    const profile: CostProfile = { id: "existing_contracted", title: "Test", driver_compensation_per_vehicle_hour: 30, vehicle_operation_per_km: 1, administration_per_vehicle_hour: 5, fuel_per_km: 0.2, maintenance_per_km: 0.3, insurance_per_vehicle_annual: 1000, capital_replacement_per_km: 0.1 };
    const result = buildIntegratedScenarios([{ id: "four", title: "Four", routes: [base], active_buses: 1, evening_minibus: false }, { id: "five", title: "Five", routes: [base, added], active_buses: 2, evening_minibus: false }], graph, population, [300, 400, 600], { comfortable_only: { 1000: { population: 0 }, 2000: { population: 0 }, 3000: { population: 0 } }, comfortable_plus_connecting: { 1000: { population: 0 }, 2000: { population: 0 }, 3000: { population: 0 } } }, [profile], 1);
    expect(result.rows[1].people_400m_walk).toBeGreaterThanOrEqual(result.rows[0].people_400m_walk);
    expect(result.rows[0].annual_costs[0].components).toHaveProperty("direct_driver_compensation");
    expect(result.rows[0].annual_costs[0].components).toHaveProperty("capital_replacement");
  });
});
