export type CoverageHousehold = {
  household_id: string;
  status: string;
  /** Set false for a known non-residential or undeliverable stop. */
  eligible?: boolean;
};

export const COVERED_STATUSES = [
  "flyer_delivered",
  "knocked_no_answer",
  "conversation",
  "revisit",
  "supportive",
  "undecided",
  "opposed",
  "volunteer_interest",
  "lawn_sign_interest",
] as const;

export const EXCLUDED_STATUSES = [
  "inaccessible",
  "vacant",
  "no_campaign_material_requested",
] as const;

const coveredStatuses = new Set<string>(COVERED_STATUSES);
const excludedStatuses = new Set<string>(EXCLUDED_STATUSES);

export function isCoverageEligible(household: CoverageHousehold): boolean {
  return household.eligible !== false && !excludedStatuses.has(household.status);
}

export function isCoverageCovered(household: CoverageHousehold): boolean {
  return isCoverageEligible(household) && coveredStatuses.has(household.status);
}

export type CoverageSummary = {
  covered: number;
  remaining: number;
  totalEligible: number;
  coverage: number;
};

export type CoverageLocation = {
  household_id: string;
  lon: number;
  lat: number;
  eligible: boolean;
  covered: boolean;
  street?: string;
  civic_number?: string;
  /** Co-located households share a stop and incur one multi-unit entry cost. */
  stop_id?: string;
};

export type CoverageRoad = {
  id?: string | number;
  properties?: Record<string, unknown>;
  geometry: {
    type: string;
    coordinates: any;
  };
};

export type HouseholdAdjacencyGraph = {
  neighbors: Map<string, Set<string>>;
  stopIdByHousehold: Map<string, string>;
  eligibleHouseholdsByStop: Map<string, number>;
};

export type VisibleCoverageCluster = {
  cluster_id: string;
  household_ids: string[];
  covered: number;
  remaining: number;
  totalEligible: number;
  coverage: number;
};

export type NextUnderflyeredArea = {
  /** Assigned by the renderer to the visible bubble containing the centre. */
  cluster_id?: string;
  center_household_id: string;
  center_stop_id: string;
  /** Legacy aliases for the practical inner (150-household) window. */
  remaining: number;
  totalEligible: number;
  coverage: number;
  localCovered: number;
  localRemaining: number;
  sampleSize: number;
  targetSize: number;
  averageHouseholdHops: number;
  maxHouseholdHops: number;
  householdHopRadius: number;
  inner: LocalCoverageScale;
  middle: LocalCoverageScale;
  broad: LocalCoverageScale;
  nestedUndercoverageScore: number;
  /** Coverage score after the bounded geographic compactness penalty. */
  adjustedUndercoverageScore: number;
  /** Robust physical spread of the inner household window, in metres. */
  compactnessDistanceMeters: number;
  compactnessP90DistanceMeters: number;
  compactnessP95DistanceMeters: number;
  compactnessUpperDecileMeanMeters: number;
  compactnessNormalized: number;
  compactnessPenalty: number;
  nearestCoveredHouseholdHops: number | null;
  graphComponent: string;
  incompleteSamples: number[];
  /** The actual household footprint sampled by the nested recommendation. */
  household_ids: string[];
  tieBreakResult: string;
  reason: "local_coverage";
};

export type LocalCoverageScale = {
  targetSize: number;
  sampleSize: number;
  localCovered: number;
  localRemaining: number;
  coverage: number;
  uncoveredProportion: number;
  averageHouseholdHops: number;
  maxHouseholdHops: number;
  complete: boolean;
};

export type LocalCoverageArea = {
  center_household_id: string;
  center_stop_id: string;
  localCovered: number;
  localRemaining: number;
  sampleSize: number;
  targetSize: number;
  averageHouseholdHops: number;
  maxHouseholdHops: number;
  householdHopRadius: number;
  graphComponent: string;
  inner: LocalCoverageScale;
  middle: LocalCoverageScale;
  broad: LocalCoverageScale;
  nestedUndercoverageScore: number;
  adjustedUndercoverageScore: number;
  compactnessDistanceMeters: number;
  compactnessP90DistanceMeters: number;
  compactnessP95DistanceMeters: number;
  compactnessUpperDecileMeanMeters: number;
  compactnessNormalized: number;
  compactnessPenalty: number;
  nearestCoveredHouseholdHops: number | null;
  incompleteSamples: number[];
  /** The actual household footprint sampled by the nested recommendation. */
  household_ids: string[];
};

type RoadSegment = {
  roadKey: string;
  street: string;
  properties: Record<string, unknown>;
  start: [number, number];
  end: [number, number];
  lengthM: number;
  startAlongM: number;
};

type StopPlacement = {
  stopId: string;
  street: string;
  side: string;
  roadKey: string;
  point: [number, number];
  distanceM: number;
  alongM: number;
};

const normalizeStreet = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/\bstreet\b/g, "st")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\broad\b/g, "rd")
    .replace(/\bhighway\b/g, "hwy")
    .replace(/\bwest\b/g, "w")
    .replace(/\beast\b/g, "e")
    .replace(/\bnorth\b/g, "n")
    .replace(/\bsouth\b/g, "s")
    .replace(/[^a-z0-9]/g, "");

const roadLines = (road: CoverageRoad): [number, number][][] =>
  road.geometry.type === "MultiLineString"
    ? road.geometry.coordinates
    : road.geometry.type === "LineString"
      ? [road.geometry.coordinates]
      : [];

const metresBetween = (
  left: [number, number],
  right: [number, number],
) => {
  const latitude = (((left[1] + right[1]) / 2) * Math.PI) / 180;
  return Math.hypot(
    (left[0] - right[0]) * 111320 * Math.cos(latitude),
    (left[1] - right[1]) * 111320,
  );
};

const projectToSegment = (
  point: [number, number],
  start: [number, number],
  end: [number, number],
) => {
  const latitude = (point[1] * Math.PI) / 180;
  const scaleX = 111320 * Math.cos(latitude);
  const scaleY = 111320;
  const px = point[0] * scaleX;
  const py = point[1] * scaleY;
  const ax = start[0] * scaleX;
  const ay = start[1] * scaleY;
  const bx = end[0] * scaleX;
  const by = end[1] * scaleY;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = Math.max(1e-9, dx * dx + dy * dy);
  const t = Math.max(
    0,
    Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared),
  );
  const projected: [number, number] = [
    (ax + t * dx) / scaleX,
    (ay + t * dy) / scaleY,
  ];
  return {
    projected,
    distanceM: Math.hypot(px - (ax + t * dx), py - (ay + t * dy)),
    alongM: t * Math.sqrt(lengthSquared),
    cross: dx * (py - ay) - dy * (px - ax),
  };
};

const parseCivicNumber = (value: unknown) => {
  const number = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(number) ? number : null;
};

const paritySide = (
  location: CoverageLocation,
  properties: Record<string, unknown>,
  cross: number,
) => {
  const number = parseCivicNumber(location.civic_number);
  const parity = number == null ? null : number % 2 ? "odd" : "even";
  const leftParity = String(properties.left_parity ?? "")
    .toLowerCase()
    .slice(0, 1);
  const rightParity = String(properties.right_parity ?? "")
    .toLowerCase()
    .slice(0, 1);
  if (parity === "odd" && leftParity === "o") return "left";
  if (parity === "even" && leftParity === "e") return "left";
  if (parity === "odd" && rightParity === "o") return "right";
  if (parity === "even" && rightParity === "e") return "right";
  if (parity) return parity;
  return cross >= 0 ? "left" : "right";
};

const addAdjacencyEdge = (
  neighbors: Map<string, Set<string>>,
  left: string,
  right: string,
) => {
  if (left === right) return;
  neighbors.set(left, new Set([...(neighbors.get(left) ?? []), right]));
  neighbors.set(right, new Set([...(neighbors.get(right) ?? []), left]));
};

/**
 * Build the household-level topology used by the underflyered-area selector.
 * Edges are frontage order on one named street and side, or a connection
 * between stops nearest a real road-segment intersection. No point-to-point
 * geographic proximity edges are added.
 */
export function buildHouseholdAdjacencyGraph(
  locations: CoverageLocation[],
  roads: CoverageRoad[],
): HouseholdAdjacencyGraph {
  const neighbors = new Map<string, Set<string>>();
  const stopIdByHousehold = new Map<string, string>();
  const eligibleHouseholdsByStop = new Map<string, number>();
  const uniqueLocations = new Map<string, CoverageLocation>();
  for (const location of locations) {
    uniqueLocations.set(location.household_id, location);
    const stopId = location.stop_id ?? location.household_id;
    stopIdByHousehold.set(location.household_id, stopId);
    if (location.eligible)
      eligibleHouseholdsByStop.set(
        stopId,
        (eligibleHouseholdsByStop.get(stopId) ?? 0) + 1,
      );
    if (!neighbors.has(stopId)) neighbors.set(stopId, new Set());
  }

  const segmentsByStreet = new Map<string, RoadSegment[]>();
  const roadEndpoints: Array<{
    point: [number, number];
    street: string;
    roadKey: string;
  }> = [];
  roads.forEach((road, roadIndex) => {
    const properties = road.properties ?? {};
    const street = normalizeStreet(properties.name);
    if (!street) return;
    const roadKey = String(
      properties.road_id ?? road.id ?? `${street}:${roadIndex}`,
    );
    for (const line of roadLines(road)) {
      if (line.length < 2) continue;
      roadEndpoints.push({ point: line[0], street, roadKey });
      roadEndpoints.push({ point: line[line.length - 1], street, roadKey });
      let startAlongM = 0;
      for (let index = 1; index < line.length; index++) {
        const start = line[index - 1];
        const end = line[index];
        const lengthM = metresBetween(start, end);
        const segment = {
          roadKey,
          street,
          properties,
          start,
          end,
          lengthM,
          startAlongM,
        } satisfies RoadSegment;
        segmentsByStreet.set(street, [
          ...(segmentsByStreet.get(street) ?? []),
          segment,
        ]);
        startAlongM += lengthM;
      }
    }
  });

  const placements = new Map<string, StopPlacement>();
  const civicNumberByStop = new Map<string, number | null>();
  for (const location of uniqueLocations.values()) {
    const street = normalizeStreet(location.street);
    if (!street) continue;
    const stopId = stopIdByHousehold.get(location.household_id)!;
    const civicNumber = parseCivicNumber(location.civic_number);
    if (!civicNumberByStop.has(stopId))
      civicNumberByStop.set(stopId, civicNumber);
    const candidates = segmentsByStreet.get(street) ?? [];
    let best:
      | (RoadSegment & {
          projected: [number, number];
          distanceM: number;
          alongM: number;
          cross: number;
        })
      | undefined;
    for (const segment of candidates) {
      const projection = projectToSegment(
        [location.lon, location.lat],
        segment.start,
        segment.end,
      );
      if (!best || projection.distanceM < best.distanceM)
        best = {
          ...segment,
          projected: projection.projected,
          distanceM: projection.distanceM,
          alongM: projection.alongM,
          cross: projection.cross,
        };
    }
    if (!best) continue;
    const existing = placements.get(stopId);
    const placement: StopPlacement = {
      stopId,
      street: best.street,
      side: paritySide(location, best.properties, best.cross),
      roadKey: best.roadKey,
      point: [location.lon, location.lat],
      distanceM: best.distanceM,
      alongM: best.startAlongM + best.alongM,
    };
    if (!existing || placement.distanceM < existing.distanceM)
      placements.set(stopId, placement);
  }

  const orderedStops = new Map<string, StopPlacement[]>();
  for (const placement of placements.values()) {
    // A named street may be split into many municipal segment records. Civic
    // number ordering carries the frontage continuity across those records;
    // unrelated street names still never receive a proximity edge.
    const key = `${placement.street}|${placement.side}`;
    orderedStops.set(key, [...(orderedStops.get(key) ?? []), placement]);
  }
  for (const stops of orderedStops.values()) {
    stops.sort((left, right) => {
      const leftNumber = civicNumberByStop.get(left.stopId) ?? null;
      const rightNumber = civicNumberByStop.get(right.stopId) ?? null;
      if (leftNumber != null && rightNumber != null && leftNumber !== rightNumber)
        return leftNumber - rightNumber;
      return left.alongM - right.alongM || left.stopId.localeCompare(right.stopId);
    });
    for (let index = 1; index < stops.length; index++)
      addAdjacencyEdge(neighbors, stops[index - 1].stopId, stops[index].stopId);
  }

  // Join only road endpoints that represent an intersection between named
  // streets, then connect the nearest stop on each side of those streets.
  const intersections: Array<{
    point: [number, number];
    streets: Set<string>;
  }> = [];
  for (let left = 0; left < roadEndpoints.length; left++) {
    for (let right = left + 1; right < roadEndpoints.length; right++) {
      const first = roadEndpoints[left];
      const second = roadEndpoints[right];
      if (first.street === second.street || metresBetween(first.point, second.point) > 40)
        continue;
      const point: [number, number] = [
        (first.point[0] + second.point[0]) / 2,
        (first.point[1] + second.point[1]) / 2,
      ];
      const existing = intersections.find(
        (intersection) =>
          metresBetween(intersection.point, point) <= 40 &&
          intersection.streets.has(first.street),
      );
      if (existing) {
        existing.streets.add(second.street);
      } else {
        intersections.push({
          point,
          streets: new Set([first.street, second.street]),
        });
      }
    }
  }
  for (const intersection of intersections) {
    const nearby = [...placements.values()].filter(
      (placement) =>
        intersection.streets.has(placement.street) &&
        metresBetween(intersection.point, placement.point) <= 100,
    );
    const representatives = new Map<string, StopPlacement>();
    for (const placement of nearby) {
      const key = `${placement.street}|${placement.side}`;
      const current = representatives.get(key);
      if (
        !current ||
        metresBetween(intersection.point, placement.point) <
          metresBetween(intersection.point, current.point)
      )
        representatives.set(key, placement);
    }
    const stops = [...representatives.values()];
    for (let left = 0; left < stops.length; left++)
      for (let right = left + 1; right < stops.length; right++)
        addAdjacencyEdge(neighbors, stops[left].stopId, stops[right].stopId);
  }
  return { neighbors, stopIdByHousehold, eligibleHouseholdsByStop };
}

export function calculateInterveningHouseholdCosts(
  locations: CoverageLocation[],
  graph: HouseholdAdjacencyGraph,
): Map<string, number> {
  const unique = new Map<string, CoverageLocation>();
  for (const location of locations) unique.set(location.household_id, location);
  const distanceByStop = new Map<string, number>();
  const pending = new Set<string>();
  for (const location of unique.values()) {
    const stopId =
      graph.stopIdByHousehold.get(location.household_id) ?? location.household_id;
    if (!graph.neighbors.has(stopId)) graph.neighbors.set(stopId, new Set());
    if (location.eligible && location.covered) {
      distanceByStop.set(stopId, 0);
      pending.add(stopId);
    } else if (!distanceByStop.has(stopId)) {
      distanceByStop.set(stopId, Infinity);
      pending.add(stopId);
    }
  }
  while (pending.size) {
    let current = "";
    let currentDistance = Infinity;
    for (const candidate of pending) {
      const distance = distanceByStop.get(candidate) ?? Infinity;
      if (distance < currentDistance) {
        current = candidate;
        currentDistance = distance;
      }
    }
    if (!current) break;
    pending.delete(current);
    for (const neighbor of graph.neighbors.get(current) ?? []) {
      const entryCost = graph.eligibleHouseholdsByStop.get(neighbor) ?? 0;
      const proposed = currentDistance + entryCost;
      if (proposed < (distanceByStop.get(neighbor) ?? Infinity)) {
        distanceByStop.set(neighbor, proposed);
        pending.add(neighbor);
      }
    }
  }
  return new Map(
    [...unique.values()].map((location) => [
      location.household_id,
      distanceByStop.get(
        graph.stopIdByHousehold.get(location.household_id) ?? location.household_id,
      ) ?? Infinity,
    ]),
  );
}

export const NESTED_COVERAGE_TARGETS = [150, 300, 600] as const;
const LOCAL_COVERAGE_TARGET = NESTED_COVERAGE_TARGETS[0];

/**
 * Geographic compactness is deliberately bounded so coverage remains the
 * primary objective. A maximum penalty of 0.005 is half a percentage point
 * of the undercoverage score; larger coverage differences cannot be erased by
 * geography alone.
 */
export const COMPACTNESS_PENALTY_WEIGHT = 0.005;

/**
 * Smooth normalization scale for the physical spread metric. The current
 * Owen Sound candidate distribution has a typical inner-window p90 near this
 * walking scale; this is a scale, not a hard radius cutoff.
 */
export const COMPACTNESS_DISTANCE_SCALE_METERS = 500;

/** Ignore insignificant floating-point differences before tie-breaking. */
export const SELECTOR_SCORE_EPSILON = 1e-9;

const COMPACTNESS_TAIL_WEIGHT = 0.25;
const COMPACTNESS_TAIL_FRACTION = 0.1;

type StopCoverageStats = {
  eligible: Array<{ household_id: string; covered: boolean }>;
  covered: number;
};

type LocalCoverageContext = {
  locations: Map<string, CoverageLocation>;
  statsByStop: Map<string, StopCoverageStats>;
  componentByStop: Map<string, string>;
  interveningHouseholdHops: Map<string, number>;
};

type CompactnessMetrics = {
  distanceMeters: number;
  p90DistanceMeters: number;
  p95DistanceMeters: number;
  upperDecileMeanMeters: number;
  normalized: number;
  penalty: number;
};

const uniqueCoverageLocations = (locations: CoverageLocation[]) => {
  const unique = new Map<string, CoverageLocation>();
  for (const location of locations) unique.set(location.household_id, location);
  return unique;
};

const buildGraphComponents = (graph: HouseholdAdjacencyGraph) => {
  const componentByStop = new Map<string, string>();
  const stops = new Set<string>(graph.neighbors.keys());
  for (const neighbors of graph.neighbors.values())
    for (const neighbor of neighbors) stops.add(neighbor);
  for (const start of [...stops].sort()) {
    if (componentByStop.has(start)) continue;
    const queue = [start];
    const component: string[] = [];
    componentByStop.set(start, start);
    while (queue.length) {
      const current = queue.shift()!;
      component.push(current);
      for (const neighbor of graph.neighbors.get(current) ?? []) {
        if (componentByStop.has(neighbor)) continue;
        componentByStop.set(neighbor, start);
        queue.push(neighbor);
      }
    }
    const componentId = [...component].sort()[0] ?? start;
    for (const stop of component) componentByStop.set(stop, componentId);
  }
  return componentByStop;
};

const buildLocalCoverageContext = (
  locations: CoverageLocation[],
  graph: HouseholdAdjacencyGraph,
): LocalCoverageContext => {
  const unique = uniqueCoverageLocations(locations);
  const statsByStop = new Map<string, StopCoverageStats>();
  for (const location of unique.values()) {
    if (!location.eligible) continue;
    const stopId =
      graph.stopIdByHousehold.get(location.household_id) ?? location.household_id;
    const current = statsByStop.get(stopId) ?? { eligible: [], covered: 0 };
    current.eligible.push({
      household_id: location.household_id,
      covered: location.covered,
    });
    if (location.covered) current.covered += 1;
    statsByStop.set(stopId, current);
  }
  for (const stats of statsByStop.values())
    stats.eligible.sort((left, right) => left.household_id.localeCompare(right.household_id));
  return {
    locations: unique,
    statsByStop,
    componentByStop: buildGraphComponents(graph),
    interveningHouseholdHops: calculateInterveningHouseholdCosts(
      [...unique.values()],
      graph,
    ),
  };
};

type QueueEntry = { stopId: string; distance: number };

const queueBefore = (left: QueueEntry, right: QueueEntry) =>
  left.distance - right.distance || left.stopId.localeCompare(right.stopId);

const queuePush = (queue: QueueEntry[], entry: QueueEntry) => {
  queue.push(entry);
  let index = queue.length - 1;
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    if (queueBefore(queue[parent], queue[index]) <= 0) break;
    [queue[parent], queue[index]] = [queue[index], queue[parent]];
    index = parent;
  }
};

const queuePop = (queue: QueueEntry[]) => {
  const first = queue[0];
  const last = queue.pop();
  if (last && queue.length) {
    queue[0] = last;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if (left < queue.length && queueBefore(queue[left], queue[smallest]) < 0)
        smallest = left;
      if (right < queue.length && queueBefore(queue[right], queue[smallest]) < 0)
        smallest = right;
      if (smallest === index) break;
      [queue[index], queue[smallest]] = [queue[smallest], queue[index]];
      index = smallest;
    }
  }
  return first;
};

const coverageScale = (
  sampled: Array<{ covered: boolean; distance: number }>,
  targetSize: number,
): LocalCoverageScale => {
  const selected = sampled.slice(0, targetSize);
  const localCovered = selected.filter((household) => household.covered).length;
  const averageHouseholdHops = selected.length
    ? selected.reduce((sum, household) => sum + household.distance, 0) /
      selected.length
    : 0;
  const maxHouseholdHops = selected.reduce(
    (max, household) => Math.max(max, household.distance),
    0,
  );
  return {
    targetSize,
    sampleSize: selected.length,
    localCovered,
    localRemaining: selected.length - localCovered,
    coverage: selected.length ? localCovered / selected.length : 0,
    uncoveredProportion: selected.length
      ? (selected.length - localCovered) / selected.length
      : 0,
    averageHouseholdHops,
    maxHouseholdHops,
    complete: selected.length >= targetSize,
  };
};

const percentile = (sorted: number[], fraction: number) => {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))];
};

/**
 * Measure physical coherence without turning one bad coordinate into a hard
 * exclusion. The base is the p90 centre distance. The upper-decile mean adds
 * a small, winsorized tail signal so several distant households matter while
 * one anomalous outlier cannot dominate the result.
 */
const calculateCompactnessMetrics = (
  sampled: Array<{ household_id: string }>,
  targetSize: number,
  center: CoverageLocation,
  locations: Map<string, CoverageLocation>,
): CompactnessMetrics => {
  const selected = sampled
    .slice(0, targetSize)
    .map((household) => locations.get(household.household_id))
    .filter((location): location is CoverageLocation => Boolean(location));
  const distances = selected
    .map((location) => {
      const latitude = ((center.lat + location.lat) / 2) * (Math.PI / 180);
      return Math.hypot(
        (center.lon - location.lon) * 111320 * Math.cos(latitude),
        (center.lat - location.lat) * 111320,
      );
    })
    .sort((left, right) => left - right);
  if (!distances.length)
    return {
      distanceMeters: 0,
      p90DistanceMeters: 0,
      p95DistanceMeters: 0,
      upperDecileMeanMeters: 0,
      normalized: 0,
      penalty: 0,
    };
  const p90DistanceMeters = percentile(distances, 0.9);
  const p95DistanceMeters = percentile(distances, 0.95);
  const tailStart = Math.max(
    0,
    distances.length - Math.max(1, Math.ceil(distances.length * COMPACTNESS_TAIL_FRACTION)),
  );
  const winsorizedTail = distances
    .slice(tailStart)
    .map((distance) => Math.min(distance, p95DistanceMeters * 2));
  const upperDecileMeanMeters =
    winsorizedTail.reduce((sum, distance) => sum + distance, 0) /
    winsorizedTail.length;
  const distanceMeters =
    (1 - COMPACTNESS_TAIL_WEIGHT) * p90DistanceMeters +
    COMPACTNESS_TAIL_WEIGHT * upperDecileMeanMeters;
  const normalized =
    distanceMeters /
    (distanceMeters + COMPACTNESS_DISTANCE_SCALE_METERS);
  return {
    distanceMeters,
    p90DistanceMeters,
    p95DistanceMeters,
    upperDecileMeanMeters,
    normalized,
    penalty: COMPACTNESS_PENALTY_WEIGHT * normalized,
  };
};

const nestedCoverageScore = (
  inner: LocalCoverageScale,
  middle: LocalCoverageScale,
  broad: LocalCoverageScale,
) =>
  0.5 * inner.uncoveredProportion +
  0.3 * middle.uncoveredProportion +
  0.2 * broad.uncoveredProportion;

const calculateCoverageAreaWithTargets = (
  centerHouseholdId: string,
  graph: HouseholdAdjacencyGraph,
  context: LocalCoverageContext,
  targetSizes: readonly number[],
): LocalCoverageArea | null => {
  const center = context.locations.get(centerHouseholdId);
  if (!center) return null;
  const centerStopId =
    graph.stopIdByHousehold.get(centerHouseholdId) ?? centerHouseholdId;
  const distances = new Map<string, number>([[centerStopId, 0]]);
  const queue: QueueEntry[] = [];
  queuePush(queue, { stopId: centerStopId, distance: 0 });
  const visited = new Set<string>();
  const maxTarget = Math.max(...targetSizes);
  const sampled: Array<{
    household_id: string;
    covered: boolean;
    distance: number;
  }> = [];
  while (queue.length && sampled.length < maxTarget) {
    const current = queuePop(queue)!;
    if (visited.has(current.stopId)) continue;
    visited.add(current.stopId);
    const stats = context.statsByStop.get(current.stopId);
    if (stats) {
      const take = Math.min(maxTarget - sampled.length, stats.eligible.length);
      const selected = stats.eligible.slice(0, take);
      sampled.push(
        ...selected.map((household) => ({
          household_id: household.household_id,
          covered: household.covered,
          distance: current.distance,
        })),
      );
    }
    for (const neighbor of graph.neighbors.get(current.stopId) ?? []) {
      if (visited.has(neighbor)) continue;
      const entryCost = graph.eligibleHouseholdsByStop.get(neighbor) ?? 0;
      const distance = current.distance + entryCost;
      if (distance < (distances.get(neighbor) ?? Infinity)) {
        distances.set(neighbor, distance);
        queuePush(queue, { stopId: neighbor, distance });
      }
    }
  }
  if (!sampled.length) return null;
  const [innerTarget, middleTarget, broadTarget] = targetSizes;
  const inner = coverageScale(sampled, innerTarget);
  const middle = coverageScale(sampled, middleTarget ?? innerTarget);
  const broad = coverageScale(
    sampled,
    broadTarget ?? middleTarget ?? innerTarget,
  );
  const nearestCoveredHouseholdHops = context.interveningHouseholdHops.get(
    centerHouseholdId,
  );
  const finiteNearestCoveredHouseholdHops = Number.isFinite(
    nearestCoveredHouseholdHops,
  )
    ? nearestCoveredHouseholdHops!
    : null;
  const nestedUndercoverageScore = nestedCoverageScore(inner, middle, broad);
  const compactness = calculateCompactnessMetrics(
    sampled,
    innerTarget,
    center,
    context.locations,
  );
  const incompleteSamples = [inner, middle, broad]
    .filter((scale) => !scale.complete)
    .map((scale) => scale.targetSize);
  return {
    center_household_id: centerHouseholdId,
    center_stop_id: centerStopId,
    localCovered: inner.localCovered,
    localRemaining: inner.localRemaining,
    sampleSize: inner.sampleSize,
    targetSize: inner.targetSize,
    averageHouseholdHops: inner.averageHouseholdHops,
    maxHouseholdHops: inner.maxHouseholdHops,
    householdHopRadius: inner.maxHouseholdHops,
    graphComponent: context.componentByStop.get(centerStopId) ?? centerStopId,
    inner,
    middle,
    broad,
    nestedUndercoverageScore,
    adjustedUndercoverageScore:
      nestedUndercoverageScore - compactness.penalty,
    compactnessDistanceMeters: compactness.distanceMeters,
    compactnessP90DistanceMeters: compactness.p90DistanceMeters,
    compactnessP95DistanceMeters: compactness.p95DistanceMeters,
    compactnessUpperDecileMeanMeters: compactness.upperDecileMeanMeters,
    compactnessNormalized: compactness.normalized,
    compactnessPenalty: compactness.penalty,
    nearestCoveredHouseholdHops: finiteNearestCoveredHouseholdHops,
    incompleteSamples,
    household_ids: sampled.map((household) => household.household_id),
  };
};

const calculateLocalCoverageAreaWithContext = (
  centerHouseholdId: string,
  graph: HouseholdAdjacencyGraph,
  context: LocalCoverageContext,
  targetSize: number,
) =>
  calculateCoverageAreaWithTargets(centerHouseholdId, graph, context, [targetSize]);

export function calculateLocalCoverageArea(
  centerHouseholdId: string,
  locations: CoverageLocation[],
  graph: HouseholdAdjacencyGraph,
  targetSize: number = LOCAL_COVERAGE_TARGET,
): LocalCoverageArea | null {
  return calculateLocalCoverageAreaWithContext(
    centerHouseholdId,
    graph,
    buildLocalCoverageContext(locations, graph),
    targetSize,
  );
}

export function calculateNestedCoverageArea(
  centerHouseholdId: string,
  locations: CoverageLocation[],
  graph: HouseholdAdjacencyGraph,
): LocalCoverageArea | null {
  return calculateCoverageAreaWithTargets(
    centerHouseholdId,
    graph,
    buildLocalCoverageContext(locations, graph),
    NESTED_COVERAGE_TARGETS,
  );
}

const rankScoredUnderflyeredAreas = (
  scored: LocalCoverageArea[],
  useCompactness = true,
  useScoreEpsilon = true,
) => {
  // A tiny disconnected component can otherwise report 100% undercoverage
  // from one available household and outrank a city-sized neighbourhood.
  // Keep those areas scored and visible in diagnostics, but only let them
  // compete when no undercovered candidate has a complete practical
  // 150-household window. Once a dense area is fully covered, an incomplete
  // isolated remainder must still be reachable.
  const undercovered = scored.filter((area) => area.inner.localRemaining > 0);
  const completeInner = undercovered.filter((area) => area.inner.complete);
  const candidates = completeInner.length
    ? completeInner
    : undercovered.length
      ? undercovered
      : scored;
  return [...candidates].sort(
    (left, right) => {
      const leftScore = useCompactness
        ? left.adjustedUndercoverageScore
        : left.nestedUndercoverageScore;
      const rightScore = useCompactness
        ? right.adjustedUndercoverageScore
        : right.nestedUndercoverageScore;
      const scoreDifference = rightScore - leftScore;
      if (
        useScoreEpsilon
          ? Math.abs(scoreDifference) > SELECTOR_SCORE_EPSILON
          : scoreDifference !== 0
      )
        return scoreDifference;
      return (
        (right.nearestCoveredHouseholdHops == null ? -1 : right.nearestCoveredHouseholdHops) -
          (left.nearestCoveredHouseholdHops == null ? -1 : left.nearestCoveredHouseholdHops) ||
        left.inner.averageHouseholdHops - right.inner.averageHouseholdHops ||
        left.center_household_id.localeCompare(right.center_household_id)
      );
    },
  );
};

const chooseNextUnderflyeredArea = (
  scored: LocalCoverageArea[],
): NextUnderflyeredArea | null => {
  const chosen = rankScoredUnderflyeredAreas(scored)[0];
  if (!chosen) return null;
  const tieBreakResult =
    `score ${(chosen.nestedUndercoverageScore * 100).toFixed(1)}%; nearest covered hops ${chosen.nearestCoveredHouseholdHops == null ? "unconnected" : chosen.nearestCoveredHouseholdHops}; inner average hops ${chosen.inner.averageHouseholdHops.toFixed(1)}`;
  return {
    ...chosen,
    remaining: chosen.localRemaining,
    totalEligible: chosen.sampleSize,
    coverage: chosen.sampleSize
      ? chosen.localCovered / chosen.sampleSize
      : 0,
    tieBreakResult,
    reason: "local_coverage",
  };
};

/**
 * Return the same deterministic ranking used by the selector. This is kept
 * as a small diagnostic API so the server and regression tools can explain
 * why a practical centre won instead of inspecting only the winner.
 */
export function rankNextUnderflyeredAreas(
  locations: CoverageLocation[],
  graph: HouseholdAdjacencyGraph,
  _targetSize: number = LOCAL_COVERAGE_TARGET,
): LocalCoverageArea[] {
  return rankScoredUnderflyeredAreas(
    scoreNextUnderflyeredAreas(locations, graph, _targetSize),
  );
}

/** Developer-only baseline ranking used to explain compactness changes. */
export function rankNextUnderflyeredAreasWithoutCompactness(
  locations: CoverageLocation[],
  graph: HouseholdAdjacencyGraph,
  _targetSize: number = LOCAL_COVERAGE_TARGET,
): LocalCoverageArea[] {
  return rankScoredUnderflyeredAreas(
    scoreNextUnderflyeredAreas(locations, graph, _targetSize),
    false,
  );
}

/** Developer-only pre-change ranking, including its floating-point ordering. */
export function rankNextUnderflyeredAreasOriginal(
  locations: CoverageLocation[],
  graph: HouseholdAdjacencyGraph,
  _targetSize: number = LOCAL_COVERAGE_TARGET,
): LocalCoverageArea[] {
  return rankScoredUnderflyeredAreas(
    scoreNextUnderflyeredAreas(locations, graph, _targetSize),
    false,
    false,
  );
}

/**
 * Score every eligible centre without applying the practical-area ranking
 * policy. This makes the excluded alternatives inspectable when a field
 * recommendation appears geographically surprising.
 */
export function scoreNextUnderflyeredAreas(
  locations: CoverageLocation[],
  graph: HouseholdAdjacencyGraph,
  _targetSize: number = LOCAL_COVERAGE_TARGET,
): LocalCoverageArea[] {
  const context = buildLocalCoverageContext(locations, graph);
  const eligible = [...context.locations.values()].filter((location) => location.eligible);
  if (!eligible.length || eligible.every((location) => location.covered)) return [];
  const targetSizes =
    _targetSize === LOCAL_COVERAGE_TARGET
      ? NESTED_COVERAGE_TARGETS
      : [_targetSize, _targetSize * 2, _targetSize * 4];
  const scored = eligible
    .map((location) =>
      calculateCoverageAreaWithTargets(
        location.household_id,
        graph,
        context,
        targetSizes,
      ),
    )
    .filter((area): area is LocalCoverageArea => Boolean(area));
  return scored;
}

/**
 * Choose a stable centre from the full household graph. This deliberately
 * does not inspect map clusters: zooming only changes how the fixed centre is
 * drawn, never which neighbourhood wins.
 */
export function selectNextUnderflyeredArea(
  locations: CoverageLocation[],
  graph: HouseholdAdjacencyGraph,
  _targetSize: number = LOCAL_COVERAGE_TARGET,
): NextUnderflyeredArea | null {
  const context = buildLocalCoverageContext(locations, graph);
  const eligible = [...context.locations.values()].filter((location) => location.eligible);
  if (!eligible.length || eligible.every((location) => location.covered)) return null;
  const targetSizes =
    _targetSize === LOCAL_COVERAGE_TARGET
      ? NESTED_COVERAGE_TARGETS
      : [_targetSize, _targetSize * 2, _targetSize * 4];
  const scored = eligible
    .map((location) =>
      calculateCoverageAreaWithTargets(
        location.household_id,
        graph,
        context,
        targetSizes,
      ),
    )
    .filter((area): area is LocalCoverageArea => Boolean(area));
  return chooseNextUnderflyeredArea(scored);
}

/**
 * Browser-friendly version of the same deterministic selector. It yields
 * between candidate centres so a phone can paint and accept map gestures
 * while the recommendation is being calculated.
 */
export async function selectNextUnderflyeredAreaAsync(
  locations: CoverageLocation[],
  graph: HouseholdAdjacencyGraph,
  _targetSize: number = LOCAL_COVERAGE_TARGET,
): Promise<NextUnderflyeredArea | null> {
  const context = buildLocalCoverageContext(locations, graph);
  const eligible = [...context.locations.values()].filter((location) => location.eligible);
  if (!eligible.length || eligible.every((location) => location.covered)) return null;
  const targetSizes =
    _targetSize === LOCAL_COVERAGE_TARGET
      ? NESTED_COVERAGE_TARGETS
      : [_targetSize, _targetSize * 2, _targetSize * 4];
  const scored: LocalCoverageArea[] = [];
  for (let index = 0; index < eligible.length; index += 1) {
    const area = calculateCoverageAreaWithTargets(
      eligible[index].household_id,
      graph,
      context,
      targetSizes,
    );
    if (area) scored.push(area);
    if ((index + 1) % 32 === 0)
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return chooseNextUnderflyeredArea(scored);
}

/**
 * Deduplicate by stable household ID before counting. If a caller supplies
 * historical records, one covered record is enough to cover that household.
 */
export function calculateCoverage(
  households: CoverageHousehold[],
): CoverageSummary {
  const unique = new Map<
    string,
    { eligible: boolean; covered: boolean }
  >();
  for (const household of households) {
    const current = unique.get(household.household_id);
    const eligible = isCoverageEligible(household);
    const covered = isCoverageCovered(household);
    if (!current) {
      unique.set(household.household_id, { eligible, covered });
    } else {
      current.eligible = current.eligible && eligible;
      current.covered = current.covered || covered;
    }
  }
  let totalEligible = 0;
  let covered = 0;
  for (const value of unique.values()) {
    if (!value.eligible) continue;
    totalEligible += 1;
    if (value.covered) covered += 1;
  }
  const remaining = totalEligible - covered;
  return {
    covered,
    remaining,
    totalEligible,
    coverage: totalEligible ? covered / totalEligible : 0,
  };
}

/** Add child counts directly; never average child percentages. */
export function aggregateCoverage(
  summaries: CoverageSummary[],
): CoverageSummary {
  const covered = summaries.reduce((sum, item) => sum + item.covered, 0);
  const totalEligible = summaries.reduce(
    (sum, item) => sum + item.totalEligible,
    0,
  );
  const remaining = totalEligible - covered;
  return {
    covered,
    remaining,
    totalEligible,
    coverage: totalEligible ? covered / totalEligible : 0,
  };
}

const INFERNO_ANCHORS: Array<[number, [number, number, number]]> = [
  [0, [0, 0, 4]],
  [0.2, [66, 10, 104]],
  [0.4, [147, 38, 103]],
  [0.6, [221, 81, 58]],
  [0.8, [252, 165, 10]],
  [1, [252, 255, 164]],
];

export function infernoCoverageColor(value: number): string {
  const coverage = Math.max(0, Math.min(1, value));
  for (let index = 1; index < INFERNO_ANCHORS.length; index += 1) {
    const [rightStop, rightColor] = INFERNO_ANCHORS[index];
    const [leftStop, leftColor] = INFERNO_ANCHORS[index - 1];
    if (coverage > rightStop) continue;
    const fraction = (coverage - leftStop) / (rightStop - leftStop);
    const channels = leftColor.map((channel, channelIndex) =>
      Math.round(channel + (rightColor[channelIndex] - channel) * fraction),
    );
    return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
  }
  return "#fcffa4";
}
