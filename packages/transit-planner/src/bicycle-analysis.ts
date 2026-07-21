import { distanceMetres, nearestNode, polygonRepresentativePoint, type Destination, type GeoCollection, type GraphEdge, type Position, type Stop, type StreetGraph } from "./index";
import type { TrafficCount } from "./traffic-data";
import type { CityElevationModel } from "./city-elevation";

export type BicycleStress = {
  edge_id: number;
  lts: 1 | 2 | 3 | 4;
  category: "comfortable" | "connecting" | "experienced_rider";
  confidence: "measured_local" | "measured_nearby" | "classification_proxy" | "unknown";
  measured_aadt: number | null;
  count_year: number | null;
  truck_percent: number | null;
  reasons: string[];
  climbing_difficulty: "unknown";
};

function stressForEdge(edge: GraphEdge, count?: TrafficCount): BicycleStress {
  let lts: 1 | 2 | 3 | 4 = 1;
  const reasons: string[] = [];
  if (count) {
    lts = count.aadt_2016 <= 3_000 ? 1 : count.aadt_2016 <= 8_000 ? 2 : count.aadt_2016 <= 15_000 ? 3 : 4;
    reasons.push(`measured 2016 AADT ${count.aadt_2016}`);
  }
  if (edge.posted_speed_kph >= 60) { lts = 4; reasons.push(`posted speed ${edge.posted_speed_kph} km/h`); }
  else if (edge.posted_speed_kph >= 50 && lts < 2) { lts = 2; reasons.push("50 km/h posted speed"); }
  if (edge.lane_count >= 4 && lts < 3) { lts = 3; reasons.push(`${edge.lane_count} recorded lanes`); }
  if (edge.road_class <= 2 && lts < 4) { lts = 4; reasons.push("provincial/highway road class proxy"); }
  else if (edge.road_class === 3 && lts < 2) { lts = 2; reasons.push("collector/arterial class modest proxy"); }
  if (edge.pedestrian) { lts = 1; reasons.push("OSM bicycle-suitable path/trail"); }
  if (!reasons.length) reasons.push("quiet local-street default");
  return { edge_id: edge.id, lts, category: lts <= 2 ? "comfortable" : lts === 3 ? "connecting" : "experienced_rider", confidence: count ? "measured_local" : edge.road_name ? "classification_proxy" : "unknown", measured_aadt: count?.aadt_2016 ?? null, count_year: count?.observed_count_year ?? null, truck_percent: count?.truck_percent ?? null, reasons, climbing_difficulty: "unknown" };
}

type RouteMode = "comfortable" | "least_climbing" | "fastest_practical";

function largestComponent(graph: StreetGraph): Set<number> {
  const remaining = new Set(graph.nodes.map((node) => node.id));
  let largest = new Set<number>();
  while (remaining.size) {
    const seed = remaining.values().next().value as number;
    const component = new Set<number>();
    const queue = [seed];
    remaining.delete(seed);
    while (queue.length) {
      const node = queue.pop()!;
      component.add(node);
      for (const edgeId of graph.nodes[node].edges) {
        const next = graph.edges[edgeId].to;
        if (remaining.delete(next)) queue.push(next);
      }
    }
    if (component.size > largest.size) largest = component;
  }
  return largest;
}

function nearestIn(graph: StreetGraph, position: Position, allowed: Set<number>, maximum = 500) {
  let best: { node: number; distance_m: number } | undefined;
  for (const nodeId of allowed) {
    const node = graph.nodes[nodeId];
    const distance = distanceMetres(position, [node.lon, node.lat]);
    if (distance <= maximum && (!best || distance < best.distance_m)) best = { node: nodeId, distance_m: distance };
  }
  return best;
}

function route(graph: StreetGraph, stresses: BicycleStress[], from: Position, to: Position, mode: RouteMode, routable: Set<number>, elevation?: CityElevationModel) {
  const start = nearestIn(graph, from, routable);
  const finish = nearestIn(graph, to, routable);
  if (!start || !finish) return undefined;
  const stress = new Map(stresses.map((row) => [row.edge_id, row]));
  const distances = Array(graph.nodes.length).fill(Infinity);
  const previous = new Map<number, number>();
  const queue: Array<{ node: number; cost: number }> = [{ node: start.node, cost: 0 }];
  distances[start.node] = 0;
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;
    if (current.cost !== distances[current.node]) continue;
    if (current.node === finish.node) break;
    for (const edgeId of graph.nodes[current.node].edges) {
      const edge = graph.edges[edgeId];
      const row = stress.get(edgeId)!;
      const multiplier = mode === "comfortable" ? [0, 1, 1.45, 3.2, 8][row.lts] : mode === "fastest_practical" ? [0, 1, 1.12, 1.45, 2.7][row.lts] : [0, 1, 1.08, 1.25, 2.2][row.lts];
      const uphill = elevation ? Math.max(0, elevation.elevationAt([graph.nodes[edge.to].lon, graph.nodes[edge.to].lat]) - elevation.elevationAt([graph.nodes[edge.from].lon, graph.nodes[edge.from].lat])) : 0;
      const climbPenalty = mode === "least_climbing" ? uphill * 24 : mode === "fastest_practical" ? uphill * 10 : uphill * 4;
      const next = current.cost + edge.length_m * multiplier + climbPenalty;
      if (next >= distances[edge.to]) continue;
      distances[edge.to] = next;
      previous.set(edge.to, edgeId);
      queue.push({ node: edge.to, cost: next });
    }
  }
  if (!Number.isFinite(distances[finish.node])) return undefined;
  const edgeIds: number[] = [];
  for (let node = finish.node; node !== start.node;) {
    const edgeId = previous.get(node);
    if (edgeId == null) return undefined;
    edgeIds.push(edgeId);
    node = graph.edges[edgeId].from;
  }
  edgeIds.reverse();
  const coordinates: Position[] = [];
  edgeIds.forEach((id, index) => coordinates.push(...(index ? graph.edges[id].coordinates.slice(1) : graph.edges[id].coordinates)));
  const distance = edgeIds.reduce((sum, id) => sum + graph.edges[id].length_m, 0);
  return { edge_ids: edgeIds, coordinates, distance_m: distance, estimated_minutes: Number((distance / (15_000 / 60)).toFixed(1)), maximum_lts: Math.max(...edgeIds.map((id) => stress.get(id)!.lts)), ...(elevation ? elevation.profile(coordinates) : {}), climbing_status: elevation ? "interim_open_meteo_copernicus_dem90" : "unknown_no_city_elevation_surface" };
}

function multiSourceDistance(graph: StreetGraph, stops: Stop[], maximum: number, stresses?: BicycleStress[], maximumLts = 4): number[] {
  const distances = Array(graph.nodes.length).fill(Infinity);
  const queue: Array<{ node: number; distance: number }> = [];
  for (const stop of stops) {
    const snap = nearestNode(graph, [stop.lon, stop.lat], 400);
    if (snap) { distances[snap.node] = snap.distance_m; queue.push({ node: snap.node, distance: snap.distance_m }); }
  }
  while (queue.length) {
    queue.sort((a, b) => a.distance - b.distance);
    const current = queue.shift()!;
    if (current.distance !== distances[current.node] || current.distance > maximum) continue;
    for (const edgeId of graph.nodes[current.node].edges) {
      const edge = graph.edges[edgeId];
      if (stresses && stresses[edgeId].lts > maximumLts) continue;
      const next = current.distance + edge.length_m;
      if (next < distances[edge.to] && next <= maximum) { distances[edge.to] = next; queue.push({ node: edge.to, distance: next }); }
    }
  }
  return distances;
}

export function analyzeBicycleNetwork(graph: StreetGraph, measured: Map<number, TrafficCount>, population: GeoCollection, loopStops: Stop[], destinations: Destination[], elevation?: CityElevationModel) {
  const stresses = graph.edges.map((edge) => stressForEdge(edge, measured.get(edge.id)));
  const routable = largestComponent(graph);
  const stressGeo: GeoCollection = { type: "FeatureCollection", features: graph.edges.filter((edge) => edge.id % 2 === 0).map((edge) => ({ type: "Feature", properties: stresses[edge.id], geometry: { type: "LineString", coordinates: edge.coordinates } })) };
  const byId = new Map(destinations.map((destination) => [destination.id, destination]));
  const terminal = byId.get("downtown_terminal")!;
  const pairs = [
    ["west-hill-to-terminal", byId.get("osdss"), terminal],
    ["terminal-to-hospital-college", terminal, byId.get("brightshores_hospital")],
    ["hospital-to-heritage", byId.get("brightshores_hospital"), byId.get("heritage_place")],
    ["terminal-to-east-retail", terminal, byId.get("retail_16th_12th")]
  ] as const;
  const routeFeatures: GeoCollection["features"] = [];
  const routeRows: Record<string, unknown>[] = [];
  for (const [connectionId, from, to] of pairs) {
    if (!from || !to) continue;
    for (const mode of ["comfortable", "least_climbing", "fastest_practical"] as RouteMode[]) {
      const result = route(graph, stresses, [from.lon, from.lat], [to.lon, to.lat], mode, routable, elevation);
      if (!result) continue;
      const category = result.maximum_lts <= 2 ? "comfortable" : result.maximum_lts === 3 ? "connecting" : "experienced_rider";
      const properties = { connection_id: connectionId, from: from.name, to: to.name, preference: mode, category, distance_m: Number(result.distance_m.toFixed(0)), estimated_minutes: result.estimated_minutes, maximum_lts: result.maximum_lts, elevation_gain_m: result.elevation_gain_m ?? null, descent_m: result.descent_m ?? null, maximum_segment_grade_percent: result.maximum_segment_grade_percent ?? null, quality_flags: result.quality_flags ?? [], climbing_status: result.climbing_status };
      routeRows.push(properties);
      routeFeatures.push({ type: "Feature", properties, geometry: { type: "LineString", coordinates: result.coordinates } });
    }
  }
  const distanceSets = { comfortable_only: multiSourceDistance(graph, loopStops, 3_000, stresses, 2), comfortable_plus_connecting: multiSourceDistance(graph, loopStops, 3_000, stresses, 3), all_legal: multiSourceDistance(graph, loopStops, 3_000, stresses, 4) };
  const blocks = population.features.filter((feature) => feature.properties?.municipalityName === "Owen Sound").map((feature) => {
    const point = polygonRepresentativePoint(feature);
    const snap = point ? nearestNode(graph, point, 300) : undefined;
    const distances = Object.fromEntries(Object.entries(distanceSets).map(([category, values]) => [category, snap ? values[snap.node] + snap.distance_m : Infinity])) as Record<keyof typeof distanceSets, number>;
    return { feature, distances, population: Number(feature.properties?.population ?? 0), dwellings: Number(feature.properties?.dwellings ?? 0) };
  });
  const coverageByComfort = Object.fromEntries(Object.keys(distanceSets).map((category) => [category, Object.fromEntries([1_000, 2_000, 3_000].map((threshold) => [threshold, { population: blocks.filter((row) => row.distances[category as keyof typeof distanceSets] <= threshold).reduce((sum, row) => sum + row.population, 0), dwellings: blocks.filter((row) => row.distances[category as keyof typeof distanceSets] <= threshold).reduce((sum, row) => sum + row.dwellings, 0) }]))]));
  const totals = { people: blocks.reduce((sum, row) => sum + row.population, 0), dwellings: blocks.reduce((sum, row) => sum + row.dwellings, 0), census_blocks: blocks.length };
  for (const [category, values] of Object.entries(coverageByComfort) as Array<[string, Record<string, { population: number; dwellings: number }>]>) {
    let priorPeople = -1, priorDwellings = -1;
    for (const threshold of [1_000, 2_000, 3_000]) {
      const value = values[String(threshold)];
      if (value.population > totals.people || value.dwellings > totals.dwellings) throw new Error(`${category} bicycle coverage exceeds Owen Sound totals`);
      if (value.population < priorPeople || value.dwellings < priorDwellings) throw new Error(`${category} bicycle coverage is not monotonic`);
      priorPeople = value.population; priorDwellings = value.dwellings;
    }
  }
  const coverage = coverageByComfort.all_legal;
  const accessGeo: GeoCollection = { type: "FeatureCollection", features: blocks.map((row) => ({ ...row.feature, properties: { ...row.feature.properties, bicycle_distance_to_hill_loop_m: Number.isFinite(row.distances.all_legal) ? Number(row.distances.all_legal.toFixed(0)) : null, bicycle_distance_comfortable_only_m: Number.isFinite(row.distances.comfortable_only) ? Number(row.distances.comfortable_only.toFixed(0)) : null, bicycle_distance_comfortable_plus_connecting_m: Number.isFinite(row.distances.comfortable_plus_connecting) ? Number(row.distances.comfortable_plus_connecting.toFixed(0)) : null } })) };
  const priorities = ["downtown_terminal", "osdss", "brightshores_hospital", "georgian_college", "heritage_place"].map((id) => byId.get(id)).filter(Boolean) as Destination[];
  const transferGeo: GeoCollection = { type: "FeatureCollection", features: priorities.map((point) => ({ type: "Feature", properties: { id: point.id, name: point.name, secure_bicycle_parking_candidate: true, repair_station_candidate: ["downtown_terminal", "brightshores_hospital", "heritage_place"].includes(point.id), bus_bicycle_transfer_priority: "high", current_bus_rack_capacity: 2, current_capacity_source: "user_supplied_unverified", future_rack_recommendation: 3, future_recommendation_condition: "vehicle compatibility and procurement review" }, geometry: { type: "Point", coordinates: [point.lon, point.lat] } })) };
  return { stresses, stressGeo, routeGeo: { type: "FeatureCollection", features: routeFeatures } as GeoCollection, routeRows, accessGeo, coverage, coverageByComfort, totals, coverageMethodology: { source_fields: { people: "properties.population", dwellings: "properties.dwellings" }, allocation: "whole census block assigned by polygon representative point", partial_block_allocation: false, population_apportionment: false, catchment_union: "minimum network distance to the union of all Hill Loop stops", overlap_deduplication: "each filtered census block is represented by one row and counted at most once per threshold" }, transferGeo };
}
