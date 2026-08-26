import { formatCivicNumber } from "./official-address";
import type { AddressUnit } from "./owen-sound-address-foundation";
import type { Feature, Position } from "./building-coverage";

type Road = Feature & { properties: Record<string, any> };
type Segment = {
  road: Road;
  a: Position;
  b: Position;
  distance_m: number;
  t: number;
  along_m: number;
  side: number;
};

const aliases: Record<string, string> = {
  AV: "AVE", AVE: "AVE", AVENUE: "AVE",
  ST: "ST", STREET: "ST",
  RD: "RD", ROAD: "RD",
  CRES: "CRES", CRESCENT: "CRES",
  DR: "DR", DRIVE: "DR",
  E: "E", EAST: "E", W: "W", WEST: "W", N: "N", NORTH: "N",
  S: "S", SOUTH: "S", NE: "NE", NW: "NW", SE: "SE", SW: "SW",
};

const normalize = (value: unknown) => String(value ?? "")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, " ")
  .trim()
  .split(/\s+/)
  .map((part) => aliases[part] ?? part)
  .join(" ");

const roadKey = (name: unknown, type?: unknown, direction?: unknown) =>
  normalize([name, type, direction].filter((value) => String(value ?? "").trim()).join(" "));

const numberedRoad = (name: string) => {
  const match = name.match(/^(\d+)(?:ST|ND|RD|TH)?\s+(AVE|ST)\b/);
  return match ? { number: Number(match[1]), type: match[2] } : null;
};

const numericCivic = (value: unknown) => {
  const match = String(value ?? "").trim().match(/^(\d+)/);
  return match ? Number(match[1]) : null;
};

const metres = (a: Position, b: Position) => {
  const latitude = (((a[1] + b[1]) / 2) * Math.PI) / 180;
  return Math.hypot(
    (a[0] - b[0]) * 111320 * Math.cos(latitude),
    (a[1] - b[1]) * 111320,
  );
};

const project = (point: Position, a: Position, b: Position) => {
  const latitude = (point[1] * Math.PI) / 180;
  const sx = 111320 * Math.cos(latitude);
  const sy = 111320;
  const px = point[0] * sx, py = point[1] * sy;
  const ax = a[0] * sx, ay = a[1] * sy;
  const bx = b[0] * sx, by = b[1] * sy;
  const dx = bx - ax, dy = by - ay;
  const length2 = Math.max(1e-9, dx * dx + dy * dy);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length2));
  const qx = ax + t * dx, qy = ay + t * dy;
  return {
    t,
    distance_m: Math.hypot(px - qx, py - qy),
    side: Math.sign(dx * (py - ay) - dy * (px - ax)),
    length_m: Math.sqrt(length2),
  };
};

const segments = (road: Road) => {
  const lines: Position[][] = road.geometry.type === "LineString"
    ? [road.geometry.coordinates as Position[]]
    : road.geometry.type === "MultiLineString"
      ? road.geometry.coordinates as Position[][]
      : [];
  const result: Array<{ a: Position; b: Position; length_m: number }> = [];
  for (const line of lines)
    for (let index = 1; index < line.length; index++)
      result.push({ a: line[index - 1], b: line[index], length_m: metres(line[index - 1], line[index]) });
  return result;
};

function nearestRoad(point: Position, roads: Road[], predicate: (road: Road) => boolean) {
  let best: Segment | null = null;
  for (const road of roads) {
    if (!predicate(road)) continue;
    let along = 0;
    for (const segment of segments(road)) {
      const candidate = project(point, segment.a, segment.b);
      const value: Segment = {
        road,
        a: segment.a,
        b: segment.b,
        distance_m: candidate.distance_m,
        t: candidate.t,
        along_m: along + candidate.t * segment.length_m,
        side: candidate.side,
      };
      if (!best || value.distance_m < best.distance_m) best = value;
      along += segment.length_m;
    }
  }
  return best;
}

const parity = (number: number) => number % 2 === 0 ? "E" : "O";
const rangeContains = (number: number, from: unknown, to: unknown) => {
  const a = Number(from), b = Number(to);
  return Number.isFinite(a) && Number.isFinite(b) && number >= Math.min(a, b) && number <= Math.max(a, b);
};

function parityIssue(unit: AddressUnit, road: Segment | null, number: number) {
  if (!road) return null;
  const p = road.road.properties;
  const sidePrefix = road.side >= 0 ? "left" : "right";
  const from = p[`${sidePrefix}_from`], to = p[`${sidePrefix}_to`];
  const expected = String(p[`${sidePrefix}_parity`] ?? "").toUpperCase();
  if (!rangeContains(number, from, to) || !["E", "O"].includes(expected)) return null;
  return parity(number) === expected ? null : {
    type: "parity_anomaly",
    address_id: unit.address_id,
    label: formatCivicNumber(unit.civic_number, unit.civic_number_suffix),
    road_id: String(p.road_id ?? road.road.id ?? ""),
    expected_parity: expected,
    actual_parity: parity(number),
  };
}

export type AddressNumberingReport = {
  generated_by: string;
  summary: {
    address_units: number;
    matched_same_road: number;
    road_match_distance_m: { p50: number | null; p90: number | null; p95: number | null; max: number | null };
    parity_anomalies: number;
    hundred_block_anomalies: number;
    direction_anomalies: number;
    suffix_anomalies: number;
    monotonic_progression_anomalies: number;
    cross_road_matches: number;
  };
  anomalies: Array<Record<string, unknown>>;
  spot_checks: Array<Record<string, unknown>>;
};

export function validateOwenSoundAddressNumbering(
  units: AddressUnit[],
  roadFeatures: Feature[],
): AddressNumberingReport {
  const roads = roadFeatures.filter((feature) => ["LineString", "MultiLineString"].includes(feature.geometry.type)) as Road[];
  const byKey = new Map<string, Road[]>();
  for (const road of roads) {
    const key = normalize(road.properties.name);
    if (!key) continue;
    byKey.set(key, [...(byKey.get(key) ?? []), road]);
  }
  const anomalies: Array<Record<string, unknown>> = [];
  const distanceValues: number[] = [];
  const progression: Array<{ unit: AddressUnit; road: Segment; number: number }> = [];
  let matchedSameRoad = 0;
  let crossRoadMatches = 0;
  const spots = new Set(["808 2nd Avenue East", "254 8th Street East"]);
  const spotChecks: Array<Record<string, unknown>> = [];

  for (const unit of units) {
    const number = numericCivic(unit.civic_number);
    if (number == null) continue;
    const fullKey = roadKey(unit.official_street_name, unit.official_street_type, unit.official_street_direction);
    const sameRoads = byKey.get(fullKey) ?? byKey.get(normalize([unit.official_street_name, unit.official_street_type].join(" "))) ?? [];
    const same = nearestRoad([unit.longitude, unit.latitude], sameRoads, () => true);
    if (same) {
      matchedSameRoad++;
      distanceValues.push(same.distance_m);
      progression.push({ unit, road: same, number });
      const issue = parityIssue(unit, same, number);
      if (issue) anomalies.push(issue);
    }
    const numbered = numberedRoad(fullKey);
    let cross: Segment | null = null;
    if (numbered) {
      cross = nearestRoad(
        [unit.longitude, unit.latitude],
        roads,
        (road) => {
          const candidate = numberedRoad(normalize(road.properties.name));
          return Boolean(candidate && candidate.type !== numbered.type);
        },
      );
      if (cross) {
        crossRoadMatches++;
        const crossNumber = numberedRoad(normalize(cross.road.properties.name))!.number;
        const expectedBlock = Math.floor(number / 100);
        if (expectedBlock > 0 && Math.abs(crossNumber - expectedBlock) > 1)
          anomalies.push({
            type: "hundred_block_anomaly",
            address_id: unit.address_id,
            label: unit.label,
            road: fullKey,
            civic_hundred_block: expectedBlock,
            nearest_cross_road: normalize(cross.road.properties.name),
            nearest_cross_road_number: crossNumber,
            distance_m: cross.distance_m,
          });
      }
    }
    const suffix = String(unit.civic_number_suffix ?? "").trim();
    if (suffix && !/^[A-Z0-9]+(?:[/-][A-Z0-9]+)*$/i.test(suffix))
      anomalies.push({ type: "suffix_anomaly", address_id: unit.address_id, label: unit.label, suffix });
    const direction = normalize(unit.official_street_direction);
    if (direction && !["E", "W", "N", "S", "NE", "NW", "SE", "SW"].includes(direction))
      anomalies.push({ type: "direction_anomaly", address_id: unit.address_id, label: unit.label, direction });
    const canonical = formatCivicNumber(unit.civic_number, unit.civic_number_suffix);
    if (spots.has(canonical + " " + unit.label.replace(/^\S+\s+/, "")))
      spotChecks.push({ address_id: unit.address_id, label: unit.label, same_road_distance_m: same?.distance_m ?? null, cross_road: cross ? normalize(cross.road.properties.name) : null, cross_road_distance_m: cross?.distance_m ?? null, civic_hundred_block: Math.floor(number / 100) });
  }

  const byRoadAndSide = new Map<string, Array<{ unit: AddressUnit; road: Segment; number: number }>>();
  for (const item of progression) {
    const roadId = String(item.road.road.properties.road_id ?? item.road.road.id ?? "");
    const key = `${roadId}:${item.road.side >= 0 ? "left" : "right"}`;
    byRoadAndSide.set(key, [...(byRoadAndSide.get(key) ?? []), item]);
  }
  for (const [key, items] of byRoadAndSide) {
    items.sort((a, b) => a.road.along_m - b.road.along_m || a.unit.address_id.localeCompare(b.unit.address_id));
    for (let index = 1; index < items.length; index++) {
      if (items[index].number >= items[index - 1].number) continue;
      anomalies.push({
        type: "monotonic_progression_anomaly",
        road_side: key,
        previous_address_id: items[index - 1].unit.address_id,
        previous_civic_number: items[index - 1].number,
        address_id: items[index].unit.address_id,
        civic_number: items[index].number,
      });
    }
  }
  const percentile = (fraction: number) => {
    const values = [...distanceValues].sort((a, b) => a - b);
    return values.length ? values[Math.min(values.length - 1, Math.floor((values.length - 1) * fraction))] : null;
  };
  const count = (type: string) => anomalies.filter((anomaly) => anomaly.type === type).length;
  return {
    generated_by: "validateOwenSoundAddressNumbering",
    summary: {
      address_units: units.length,
      matched_same_road: matchedSameRoad,
      road_match_distance_m: { p50: percentile(0.5), p90: percentile(0.9), p95: percentile(0.95), max: distanceValues.length ? Math.max(...distanceValues) : null },
      parity_anomalies: count("parity_anomaly"),
      hundred_block_anomalies: count("hundred_block_anomaly"),
      direction_anomalies: count("direction_anomaly"),
      suffix_anomalies: count("suffix_anomaly"),
      monotonic_progression_anomalies: count("monotonic_progression_anomaly"),
      cross_road_matches: crossRoadMatches,
    },
    anomalies,
    spot_checks: spotChecks,
  };
}
