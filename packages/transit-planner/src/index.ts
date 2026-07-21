export type Position = [number, number];

export type GraphNode = {
  id: number;
  lon: number;
  lat: number;
  x_m: number;
  y_m: number;
  edges: number[];
};

export type GraphEdge = {
  id: number;
  from: number;
  to: number;
  coordinates: Position[];
  length_m: number;
  travel_seconds: number;
  road_name: string;
  road_class: number;
  posted_speed_kph: number;
  inferred_speed: boolean;
  pedestrian: boolean;
  lane_count: number;
  winter_maintenance: string;
};

export type StreetGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  origin: Position;
};

export type Destination = {
  id: string;
  name: string;
  category: string;
  lon: number;
  lat: number;
  major: boolean;
  source: "osm_verified" | "manual_verified" | "public_facility";
};

export type Stop = Destination & { sequence: number; fixed: boolean };

export type RoutedPath = {
  coordinates: Position[];
  edge_ids: number[];
  distance_m: number;
  travel_seconds: number;
  turns: number;
  sharp_turns: number;
  left_turns_across_major: number;
  intersections: number;
  straight_distance_m: number;
  circuitry_ratio: number;
};

export type PlannerConfig = {
  bus: {
    default_speed_kph_by_road_class: Record<string, number>;
    speed_cap_kph: number;
    road_class_penalty_seconds_per_km: Record<string, number>;
    intersection_penalty_seconds: number;
    turn_penalty_seconds: number;
    sharp_turn_penalty_seconds: number;
    left_turn_major_road_penalty_seconds: number;
    major_road_classes: number[];
    stop_dwell_seconds: number;
    terminal_layover_minutes: number;
    service_span_hours: number;
    stop_spacing_target_m: number;
    stop_spacing_min_m: number;
    stop_spacing_max_m: number;
    route_circuitry_warning_ratio: number;
  };
  walking: {
    speed_kph: number;
    coverage_thresholds_m: number[];
    population_snap_limit_m: number;
    allowed_highways: string[];
  };
};

type GeoFeature = { type: "Feature"; properties?: Record<string, unknown>; geometry?: { type: string; coordinates: unknown } | null };
type GeoCollection = { type: "FeatureCollection"; features: GeoFeature[] };

const EARTH_RADIUS_M = 6_371_000;

export function project(lon: number, lat: number, origin: Position): [number, number] {
  const lat0 = origin[1] * Math.PI / 180;
  return [
    (lon - origin[0]) * Math.PI / 180 * EARTH_RADIUS_M * Math.cos(lat0),
    (lat - origin[1]) * Math.PI / 180 * EARTH_RADIUS_M
  ];
}

export function distanceMetres(a: Position, b: Position): number {
  const origin: Position = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const pa = project(a[0], a[1], origin);
  const pb = project(b[0], b[1], origin);
  return Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
}

export function estimateActiveStops(stopCount: number, averagePassengers: number, eventsPerPassenger: number, sharedEventFactor: number, lowUsageFactor: number, minimumUsedStops: number) {
  const effectiveEvents = averagePassengers * eventsPerPassenger * sharedEventFactor;
  const expected = Math.min(stopCount, Math.max(minimumUsedStops, stopCount * (1 - Math.pow(Math.max(0, stopCount - 1) / Math.max(1, stopCount), effectiveEvents))));
  const low = Math.min(expected, Math.max(minimumUsedStops, expected * lowUsageFactor));
  return { low: Number(low.toFixed(1)), expected: Number(expected.toFixed(1)), all_stops: stopCount };
}

export function pointInPolygon(point: Position, polygon: Position[][]): boolean {
  let inside = false;
  const ring = polygon[0] ?? [];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > point[1]) !== (yj > point[1]) && point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function geometryLines(geometry: GeoFeature["geometry"]): Position[][] {
  if (!geometry) return [];
  if (geometry.type === "LineString") return [geometry.coordinates as Position[]];
  if (geometry.type === "MultiLineString") return geometry.coordinates as Position[][];
  return [];
}

function coordinateKey(x: number, y: number): string {
  return `${Math.round(x / 2)}:${Math.round(y / 2)}`;
}

function numeric(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

function makeGraph(origin: Position) {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeByKey = new Map<string, number>();
  const nodeAt = (position: Position): number => {
    const [x, y] = project(position[0], position[1], origin);
    const key = coordinateKey(x, y);
    const existing = nodeByKey.get(key);
    if (existing != null) return existing;
    const id = nodes.length;
    nodes.push({ id, lon: position[0], lat: position[1], x_m: x, y_m: y, edges: [] });
    nodeByKey.set(key, id);
    return id;
  };
  const addEdge = (from: Position, to: Position, data: Omit<GraphEdge, "id" | "from" | "to" | "coordinates">): void => {
    const fromId = nodeAt(from);
    const toId = nodeAt(to);
    if (fromId === toId || data.length_m < 1) return;
    const id = edges.length;
    edges.push({ id, from: fromId, to: toId, coordinates: [from, to], ...data });
    nodes[fromId].edges.push(id);
  };
  return { nodes, edges, addEdge };
}

export function buildBusGraph(roads: GeoCollection, boundary: Position[][], config: PlannerConfig, origin: Position): StreetGraph {
  const graph = makeGraph(origin);
  for (const feature of roads.features) {
    const p = feature.properties ?? {};
    const jurisdiction = `${text(p.JURIS_L)} ${text(p.JURIS_R)}`.toUpperCase();
    if (!jurisdiction.includes("OWEN SOUND")) continue;
    if (/NOT SUITABLE|CLOSED|PRIVATE/i.test(text(p.CLOSE_DETR))) continue;
    const roadClass = numeric(p.ORN_ROAD_CLASS, numeric(p.STREET_CLA, 5));
    const posted = numeric(p.SPEED_LIMI);
    const inferred = !(posted > 0);
    const configuredSpeed = numeric(config.bus.default_speed_kph_by_road_class[String(roadClass)], config.bus.default_speed_kph_by_road_class.default);
    const speed = Math.min(config.bus.speed_cap_kph, posted > 0 ? posted : configuredSpeed);
    const roadName = text(p.ROAD_NAME_ABBR) || text(p.ROAD_NAME) || "unnamed road";
    for (const line of geometryLines(feature.geometry)) {
      for (let index = 0; index < line.length - 1; index += 1) {
        const a = line[index];
        const b = line[index + 1];
        const midpoint: Position = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        if (!pointInPolygon(midpoint, boundary)) continue;
        const length = distanceMetres(a, b);
        const classPenalty = numeric(config.bus.road_class_penalty_seconds_per_km[String(roadClass)], config.bus.road_class_penalty_seconds_per_km.default);
        const travel = length / (speed / 3.6) + length / 1000 * classPenalty;
        const common = { length_m: length, travel_seconds: travel, road_name: roadName, road_class: roadClass, posted_speed_kph: speed, inferred_speed: inferred, pedestrian: false, lane_count: numeric(p.LANE_COUNT), winter_maintenance: text(p.MAINT_WINTER) };
        graph.addEdge(a, b, common);
        graph.addEdge(b, a, common);
      }
    }
  }
  return { nodes: graph.nodes, edges: graph.edges, origin };
}

export function buildWalkingGraph(osm: GeoCollection, boundary: Position[][], config: PlannerConfig, origin: Position): StreetGraph {
  const graph = makeGraph(origin);
  const allowed = new Set(config.walking.allowed_highways);
  for (const feature of osm.features) {
    const p = feature.properties ?? {};
    const highway = text(p.highway);
    if (!allowed.has(highway) || /private|no/.test(text(p.access))) continue;
    for (const line of geometryLines(feature.geometry)) {
      for (let index = 0; index < line.length - 1; index += 1) {
        const a = line[index];
        const b = line[index + 1];
        const midpoint: Position = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        if (!pointInPolygon(midpoint, boundary)) continue;
        const length = distanceMetres(a, b);
        const common = { length_m: length, travel_seconds: length / (config.walking.speed_kph / 3.6), road_name: text(p.name) || highway, road_class: 9, posted_speed_kph: config.walking.speed_kph, inferred_speed: true, pedestrian: true, lane_count: 0, winter_maintenance: "" };
        graph.addEdge(a, b, common);
        if (text(p.oneway) !== "yes") graph.addEdge(b, a, common);
      }
    }
  }
  return { nodes: graph.nodes, edges: graph.edges, origin };
}

export function combineStreetGraphs(graphs: StreetGraph[]): StreetGraph {
  if (!graphs.length) throw new Error("At least one graph is required");
  const combined = makeGraph(graphs[0].origin);
  for (const graph of graphs) for (const edge of graph.edges) {
    const { id: _id, from: _from, to: _to, coordinates, ...data } = edge;
    combined.addEdge(coordinates[0], coordinates.at(-1) as Position, data);
  }
  return { nodes: combined.nodes, edges: combined.edges, origin: graphs[0].origin };
}

export function nearestNode(graph: StreetGraph, position: Position, maxDistance = Infinity): { node: number; distance_m: number } | undefined {
  const [x, y] = project(position[0], position[1], graph.origin);
  let bestNode = -1;
  let bestDistance = maxDistance;
  for (const node of graph.nodes) {
    const distance = Math.hypot(node.x_m - x, node.y_m - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestNode = node.id;
    }
  }
  return bestNode < 0 ? undefined : { node: bestNode, distance_m: bestDistance };
}

function edgeBearing(graph: StreetGraph, edge: GraphEdge): number {
  const from = graph.nodes[edge.from];
  const to = graph.nodes[edge.to];
  return Math.atan2(to.x_m - from.x_m, to.y_m - from.y_m) * 180 / Math.PI;
}

function turnAngle(a: number, b: number): number {
  return ((b - a + 540) % 360) - 180;
}

type QueueItem = { key: string; node: number; previous_edge?: number; cost: number };

function popLowest(queue: QueueItem[]): QueueItem {
  let lowest = 0;
  for (let index = 1; index < queue.length; index += 1) if (queue[index].cost < queue[lowest].cost) lowest = index;
  return queue.splice(lowest, 1)[0];
}

export function shortestBusPath(graph: StreetGraph, from: Position, to: Position, config: PlannerConfig): RoutedPath {
  const start = nearestNode(graph, from);
  const finish = nearestNode(graph, to);
  if (!start || !finish) throw new Error("Unable to snap Hill Line anchor to bus graph");
  const startKey = `${start.node}:start`;
  const queue: QueueItem[] = [{ key: startKey, node: start.node, cost: 0 }];
  const costs = new Map<string, number>([[startKey, 0]]);
  const previous = new Map<string, { key: string; edge: number }>();
  let finalKey: string | undefined;
  while (queue.length) {
    const current = popLowest(queue);
    if (current.cost !== costs.get(current.key)) continue;
    if (current.node === finish.node) { finalKey = current.key; break; }
    for (const edgeId of graph.nodes[current.node].edges) {
      const edge = graph.edges[edgeId];
      let penalty = graph.nodes[current.node].edges.length > 2 ? config.bus.intersection_penalty_seconds : 0;
      if (current.previous_edge != null) {
        const prior = graph.edges[current.previous_edge];
        if (edge.to === prior.from) continue;
        const angle = turnAngle(edgeBearing(graph, prior), edgeBearing(graph, edge));
        if (prior.road_name !== edge.road_name && Math.abs(angle) > 20) penalty += config.bus.turn_penalty_seconds;
        if (Math.abs(angle) > 105) penalty += config.bus.sharp_turn_penalty_seconds;
        const crossesMajor = graph.nodes[current.node].edges.some((id) => config.bus.major_road_classes.includes(graph.edges[id].road_class));
        if (angle < -20 && crossesMajor) penalty += config.bus.left_turn_major_road_penalty_seconds;
      }
      const cost = current.cost + edge.travel_seconds + penalty;
      const key = `${edge.to}:${edge.id}`;
      if (cost >= (costs.get(key) ?? Infinity)) continue;
      costs.set(key, cost);
      previous.set(key, { key: current.key, edge: edge.id });
      queue.push({ key, node: edge.to, previous_edge: edge.id, cost });
    }
  }
  if (!finalKey) throw new Error(`No bus path between ${from.join(",")} and ${to.join(",")}`);
  const edgeIds: number[] = [];
  let cursor = finalKey;
  while (cursor !== startKey) {
    const item = previous.get(cursor);
    if (!item) throw new Error("Broken bus route predecessor chain");
    edgeIds.push(item.edge);
    cursor = item.key;
  }
  edgeIds.reverse();
  const edges = edgeIds.map((id) => graph.edges[id]);
  const coordinates: Position[] = [];
  edges.forEach((edge, index) => coordinates.push(...(index ? edge.coordinates.slice(1) : edge.coordinates)));
  let turns = 0;
  let sharpTurns = 0;
  let leftMajor = 0;
  for (let index = 1; index < edges.length; index += 1) {
    const angle = turnAngle(edgeBearing(graph, edges[index - 1]), edgeBearing(graph, edges[index]));
    if (edges[index - 1].road_name !== edges[index].road_name && Math.abs(angle) > 20) turns += 1;
    if (Math.abs(angle) > 105) sharpTurns += 1;
    if (angle < -20 && graph.nodes[edges[index].from].edges.some((id) => config.bus.major_road_classes.includes(graph.edges[id].road_class))) leftMajor += 1;
  }
  const distance = edges.reduce((sum, edge) => sum + edge.length_m, 0);
  const straight = distanceMetres(from, to);
  return {
    coordinates,
    edge_ids: edgeIds,
    distance_m: distance,
    travel_seconds: costs.get(finalKey) ?? 0,
    turns,
    sharp_turns: sharpTurns,
    left_turns_across_major: leftMajor,
    intersections: edges.filter((edge) => graph.nodes[edge.to].edges.length > 2).length,
    straight_distance_m: straight,
    circuitry_ratio: distance / Math.max(1, straight)
  };
}

export function combinePaths(paths: RoutedPath[]): RoutedPath {
  const coordinates: Position[] = [];
  paths.forEach((path, index) => coordinates.push(...(index ? path.coordinates.slice(1) : path.coordinates)));
  const sum = (field: keyof RoutedPath) => paths.reduce((total, path) => total + Number(path[field]), 0);
  return {
    coordinates,
    edge_ids: paths.flatMap((path) => path.edge_ids),
    distance_m: sum("distance_m"),
    travel_seconds: sum("travel_seconds"),
    turns: sum("turns"),
    sharp_turns: sum("sharp_turns"),
    left_turns_across_major: sum("left_turns_across_major"),
    intersections: sum("intersections"),
    straight_distance_m: sum("straight_distance_m"),
    circuitry_ratio: sum("distance_m") / Math.max(1, sum("straight_distance_m"))
  };
}

export function placeStops(path: RoutedPath, fixedDestinations: Destination[], targetSpacingM: number, minimumSpacingM = targetSpacingM * 0.85, preferredIntersections: Position[] = []): Stop[] {
  const stops: Stop[] = fixedDestinations.map((destination, sequence) => ({ ...destination, sequence, fixed: true }));
  const cumulative = [0];
  for (let index = 1; index < path.coordinates.length; index += 1) cumulative.push(cumulative[index - 1] + distanceMetres(path.coordinates[index - 1], path.coordinates[index]));
  const preferredIndices = path.coordinates
    .map((position, index) => ({ position, index, distance: cumulative[index] }))
    .filter((candidate) => preferredIntersections.some((intersection) => distanceMetres(candidate.position, intersection) <= 5));
  let travelled = 0;
  let next = targetSpacingM;
  let sequence = fixedDestinations.length;
  for (let index = 1; index < path.coordinates.length; index += 1) {
    const a = path.coordinates[index - 1];
    const b = path.coordinates[index];
    const segment = distanceMetres(a, b);
    while (travelled + segment >= next) {
      const ratio = (next - travelled) / segment;
      const interpolated: Position = [a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio];
      const intersection = preferredIndices
        .filter((candidate) => candidate.distance >= next - 75 && candidate.distance <= next + 150)
        .sort((left, right) => Number(left.distance < next) - Number(right.distance < next) || Math.abs(left.distance - next) - Math.abs(right.distance - next))[0];
      const point = intersection?.position ?? interpolated;
      if (stops.every((stop) => distanceMetres([stop.lon, stop.lat], point) >= minimumSpacingM)) {
        stops.push({ id: `local-${sequence}`, name: `Local stop ${sequence + 1}`, category: "local_stop", lon: point[0], lat: point[1], major: false, source: "manual_verified", sequence, fixed: false });
        sequence += 1;
      }
      next += targetSpacingM;
    }
    travelled += segment;
  }
  return stops.sort((a, b) => a.sequence - b.sequence);
}

export function multiSourceWalkingDistances(graph: StreetGraph, stops: Stop[], maxDistanceM: number): number[] {
  const distances = Array(graph.nodes.length).fill(Infinity);
  const queue: Array<{ node: number; cost: number }> = [];
  for (const stop of stops) {
    const snapped = nearestNode(graph, [stop.lon, stop.lat], 250);
    if (!snapped) continue;
    const initial = snapped.distance_m;
    if (initial < distances[snapped.node]) {
      distances[snapped.node] = initial;
      queue.push({ node: snapped.node, cost: initial });
    }
  }
  while (queue.length) {
    let lowest = 0;
    for (let index = 1; index < queue.length; index += 1) if (queue[index].cost < queue[lowest].cost) lowest = index;
    const current = queue.splice(lowest, 1)[0];
    if (current.cost !== distances[current.node] || current.cost > maxDistanceM) continue;
    for (const edgeId of graph.nodes[current.node].edges) {
      const edge = graph.edges[edgeId];
      const next = current.cost + edge.length_m;
      if (next < distances[edge.to] && next <= maxDistanceM) {
        distances[edge.to] = next;
        queue.push({ node: edge.to, cost: next });
      }
    }
  }
  return distances;
}

export function polygonRepresentativePoint(feature: GeoFeature): Position | undefined {
  const geometry = feature.geometry;
  if (!geometry || !["Polygon", "MultiPolygon"].includes(geometry.type)) return undefined;
  const coordinates = geometry.coordinates as number[][][][];
  const ring: Position[] = geometry.type === "Polygon" ? (geometry.coordinates as Position[][])[0] : coordinates[0][0] as Position[];
  if (!ring?.length) return undefined;
  return [ring.reduce((sum, p) => sum + p[0], 0) / ring.length, ring.reduce((sum, p) => sum + p[1], 0) / ring.length];
}

export function calculateCoverage(population: GeoCollection, walkingGraph: StreetGraph, stops: Stop[], thresholds: number[], snapLimitM: number) {
  const maximum = Math.max(...thresholds);
  const networkDistances = multiSourceWalkingDistances(walkingGraph, stops, maximum + snapLimitM);
  const rows = population.features
    .filter((feature) => feature.properties?.municipalityName === "Owen Sound")
    .map((feature) => {
      const point = polygonRepresentativePoint(feature);
      if (!point) return undefined;
      const snap = nearestNode(walkingGraph, point, snapLimitM);
      const network = snap ? networkDistances[snap.node] + snap.distance_m : Infinity;
      const circular = Math.min(...stops.map((stop) => distanceMetres(point, [stop.lon, stop.lat])));
      return { feature, point, network_distance_m: network, circular_distance_m: circular, population: numeric(feature.properties?.population), dwellings: numeric(feature.properties?.dwellings) };
    })
    .filter(Boolean) as Array<{ feature: GeoFeature; point: Position; network_distance_m: number; circular_distance_m: number; population: number; dwellings: number }>;
  const summarize = (field: "network_distance_m" | "circular_distance_m") => Object.fromEntries(thresholds.map((threshold) => {
    const covered = rows.filter((row) => row[field] <= threshold);
    return [String(threshold), { population: covered.reduce((sum, row) => sum + row.population, 0), dwellings: covered.reduce((sum, row) => sum + row.dwellings, 0) }];
  }));
  const totalPopulation = rows.reduce((sum, row) => sum + row.population, 0);
  const totalDwellings = rows.reduce((sum, row) => sum + row.dwellings, 0);
  const validate = (summary: Record<string, { population: number; dwellings: number }>, method: string) => {
    let previousPeople = -1, previousDwellings = -1;
    for (const threshold of [...thresholds].sort((a, b) => a - b)) {
      const value = summary[String(threshold)];
      if (value.population > totalPopulation || value.dwellings > totalDwellings) throw new Error(`${method} coverage exceeds Owen Sound census totals at ${threshold} m`);
      if (value.population < previousPeople || value.dwellings < previousDwellings) throw new Error(`${method} coverage is not monotonic at ${threshold} m`);
      previousPeople = value.population; previousDwellings = value.dwellings;
    }
  };
  const network = summarize("network_distance_m");
  const circular = summarize("circular_distance_m");
  validate(network, "network"); validate(circular, "circular");
  const weightedDistance = rows.reduce((sum, row) => sum + Math.min(row.network_distance_m, maximum * 2) * row.population, 0) / Math.max(1, totalPopulation);
  return { rows, totals: { population: totalPopulation, dwellings: totalDwellings }, network, circular, methodology: { allocation: "whole census block assigned by polygon representative point", partial_block_allocation: false, population_apportionment: false, catchment_union: "one minimum distance per block from a multi-source graph search seeded by all stops", overlap_deduplication: "each source block appears once and is counted at most once per threshold" }, population_weighted_mean_walk_m: weightedDistance };
}

export type { GeoCollection, GeoFeature };
