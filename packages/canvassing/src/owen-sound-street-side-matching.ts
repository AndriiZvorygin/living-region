import {
  centroid,
  distanceToGeometry,
  metresBetween,
  normalizeStreet,
  type Feature,
  type Position,
} from "./building-coverage";
import type { AddressUnit, NarLocation } from "./owen-sound-address-foundation";
import type { FootprintPlacement } from "./owen-sound-footprint-placement";

/**
 * A deliberately conservative distance for treating a BG point as physical
 * evidence for a roof.  It is below the old 50m placement ceiling and is
 * based on the observed p95 of the current Owen Sound placement set.
 */
export const NAR_VALIDATED_DISTANCE_M = 25;
export const NAR_SEQUENCE_DISTANCE_M = 40;

export type AddressQualityClassification =
  | "nar_contained_footprint"
  | "nar_validated_nearest"
  | "nar_nearest_no_known_conflict"
  | "nar_documented_exception"
  | "legacy_nar_confirmed"
  | "legacy_spatially_consistent"
  | "legacy_unverified"
  | "grid_estimated"
  | "unresolved";

export type StreetSideEvidence = {
  street_match: boolean;
  side_match: boolean;
  parity_match: boolean;
  hundred_block_match: boolean;
  neighbouring_sequence_match: boolean;
  unique_plausible_footprint: boolean;
  conservative_distance_match: boolean;
  coordinate_source: NarLocation["coordinate_source"] | null;
  distance_m: number | null;
  roof_number: number | null;
  nar_number: number | null;
  roof_street_key: string;
  nar_street_key: string;
  nar_side: "left" | "right" | null;
  roof_side: "left" | "right" | null;
  reason: string | null;
};

export type StreetSideAssignment = {
  location_id: string;
  structure_id: string;
  distance_m: number | null;
  method: "street_side_sequence";
  classification: AddressQualityClassification;
  evidence: StreetSideEvidence;
  cost: number;
};

type Road = Feature & { properties: Record<string, any> };
type NumberedAddress = {
  number: number;
  suffix: string;
  street_key: string;
};
type Side = "left" | "right";
type RoadProjection = {
  side: Side | null;
  along_m: number;
  distance_m: number;
  road: Road | null;
};

const roadIndexCache = new WeakMap<object, Map<string, Road[]>>();
const unitIndexCache = new WeakMap<object, Map<string, AddressUnit>>();

const roadsByStreet = (roads: Road[]) => {
  const cached = roadIndexCache.get(roads);
  if (cached) return cached;
  const index = new Map<string, Road[]>();
  for (const road of roads) {
    const key = normalizeStreet(road.properties.name);
    if (!key) continue;
    index.set(key, [...(index.get(key) ?? []), road]);
  }
  roadIndexCache.set(roads, index);
  return index;
};

const numericCivic = (value: unknown) => {
  const match = String(value ?? "").trim().match(/^(\d+)/);
  return match ? Number(match[1]) : null;
};

const numberSuffix = (value: unknown) =>
  String(value ?? "").trim().match(/^\d+(.+)$/)?.[1] ?? "";

export const addressStreetKey = (
  name: unknown,
  type: unknown = "",
  direction: unknown = "",
) => normalizeStreet([name, type, direction].filter(Boolean).join(" "));

const parseStreetLabel = (value: unknown): NumberedAddress | null => {
  const text = String(value ?? "").trim().replace(/^~/, "");
  const match = text.match(/^(\d+(?:[A-Z]|\/\d+)?)\s+(.+?)(?:\s+\+\d+)?$/i);
  if (!match) return null;
  const number = numericCivic(match[1]);
  if (number == null) return null;
  return {
    number,
    suffix: numberSuffix(match[1]),
    street_key: normalizeStreet(match[2]),
  };
};

export function parseRoofAddress(feature: Feature): NumberedAddress | null {
  const p = feature.properties;
  const explicitNumber = p.fallback_civic_number ?? p.inferred_civic_number ??
    (Array.isArray(p.civic_numbers) ? p.civic_numbers[0] : undefined);
  const explicitStreet = p.fallback_street;
  if (explicitNumber != null && String(explicitStreet ?? "").trim()) {
    const number = numericCivic(explicitNumber);
    if (number != null)
      return {
        number,
        suffix: numberSuffix(explicitNumber),
        street_key: normalizeStreet(explicitStreet),
      };
  }
  return parseStreetLabel(p.civic_label);
}

export function officialAddressForLocation(
  units: AddressUnit[],
  locationId: string,
): NumberedAddress | null {
  let index = unitIndexCache.get(units);
  if (!index) {
    index = new Map<string, AddressUnit>();
    for (const unit of units) {
      const existing = index.get(unit.location_id);
      const residential = unit.building_use === "residential" ||
        unit.building_use === "partly_residential";
      if (!existing || (residential &&
          existing.building_use !== "residential" &&
          existing.building_use !== "partly_residential"))
        index.set(unit.location_id, unit);
    }
    unitIndexCache.set(units, index);
  }
  const unit = index.get(locationId);
  if (!unit) return null;
  const number = numericCivic(unit.civic_number);
  if (number == null) return null;
  return {
    number,
    suffix: unit.civic_number_suffix,
    street_key: addressStreetKey(
      unit.official_street_name,
      unit.official_street_type,
      unit.official_street_direction,
    ),
  };
}

const lineCoordinates = (road: Road): Position[][] =>
  road.geometry.type === "LineString"
    ? [road.geometry.coordinates as Position[]]
    : road.geometry.type === "MultiLineString"
      ? road.geometry.coordinates as Position[][]
      : [];

const projectToSegment = (point: Position, a: Position, b: Position) => {
  const latitude = (point[1] * Math.PI) / 180;
  const sx = 111320 * Math.cos(latitude);
  const sy = 111320;
  const px = point[0] * sx, py = point[1] * sy;
  const ax = a[0] * sx, ay = a[1] * sy;
  const bx = b[0] * sx, by = b[1] * sy;
  const dx = bx - ax, dy = by - ay;
  const lengthSquared = Math.max(1e-9, dx * dx + dy * dy);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  const qx = ax + t * dx, qy = ay + t * dy;
  return {
    distance_m: Math.hypot(px - qx, py - qy),
    sideSign: Math.sign(dx * (py - ay) - dy * (px - ax)),
    along_m: t * Math.sqrt(lengthSquared),
  };
};

const rangeForSide = (road: Road, side: Side) => {
  const prefix = side === "left" ? "left" : "right";
  const from = Number(road.properties[`${prefix}_from`]);
  const to = Number(road.properties[`${prefix}_to`]);
  const parity = String(road.properties[`${prefix}_parity`] ?? "").toUpperCase().slice(0, 1);
  return Number.isFinite(from) && Number.isFinite(to)
    ? { from: Math.min(from, to), to: Math.max(from, to), parity }
    : null;
};

const sideForNumber = (road: Road, number: number): Side | null => {
  const matches = (["left", "right"] as Side[]).filter((side) => {
    const range = rangeForSide(road, side);
    return Boolean(range && number >= range.from && number <= range.to &&
      (!range.parity || (number % 2 === 0 ? "E" : "O") === range.parity));
  });
  return matches.length === 1 ? matches[0] : null;
};

function roadProjection(
  point: Position,
  streetKey: string,
  number: number | null,
  roads: Road[],
): RoadProjection {
  let best: RoadProjection | null = null;
  for (const road of roadsByStreet(roads).get(streetKey) ?? []) {
    let alongRoad = 0;
    for (const line of lineCoordinates(road)) {
      for (let index = 1; index < line.length; index++) {
        const a = line[index - 1], b = line[index];
        const length = metresBetween(a, b);
        const projected = projectToSegment(point, a, b);
        const geometricSide: Side | null = projected.sideSign > 0
          ? "left"
          : projected.sideSign < 0
            ? "right"
            : null;
        const side = geometricSide ?? (number == null ? null : sideForNumber(road, number));
        const candidate = {
          side,
          along_m: alongRoad + projected.along_m,
          distance_m: projected.distance_m,
          road,
        } satisfies RoadProjection;
        if (!best || candidate.distance_m < best.distance_m) best = candidate;
        alongRoad += length;
      }
    }
  }
  return best ?? { side: null, along_m: 0, distance_m: Infinity, road: null };
}

const parityMatchesRoadRange = (projection: RoadProjection, number: number | null) => {
  if (!projection.road || number == null || !projection.side) return null;
  const range = rangeForSide(projection.road, projection.side);
  if (!range || !range.parity || number < range.from || number > range.to) return null;
  return (number % 2 === 0 ? "E" : "O") === range.parity;
};

const blockCompatible = (left: number | null, right: number | null) =>
  left != null && right != null && Math.floor(left / 100) === Math.floor(right / 100);

export const civicHundredBlock = (number: number) => Math.floor(number / 100);

export const civicParity = (number: number) => number % 2 === 0 ? "even" : "odd";

/**
 * Return the frontage side inferred from the prepared road centreline.  This
 * is intentionally a small diagnostic/validation primitive; it is not used
 * to create a city-wide nearest-address fallback.
 */
export function streetSideForPoint(
  point: Position,
  streetName: unknown,
  streetType: unknown,
  streetDirection: unknown,
  number: number | null,
  roads: Feature[],
): Side | null {
  return roadProjection(
    point,
    addressStreetKey(streetName, streetType, streetDirection),
    number,
    roads as Road[],
  ).side;
}

const streetSideBlockKey = (streetKey: string, side: Side, number: number) =>
  `${streetKey}|${side}|${Math.floor(number / 100)}`;

const roofPoint = (feature: Feature): Position => centroid(feature);

const roofStreetAndNumber = (feature: Feature) => {
  const parsed = parseRoofAddress(feature);
  return parsed;
};

const plausibleResidentialFootprint = (feature: Feature | undefined) => {
  if (!feature) return false;
  const type = String(feature.properties.building_type ?? "").toLowerCase();
  const tag = String(feature.properties.source_building_tag ?? "").toLowerCase();
  if ([
    "commercial", "industrial", "warehouse", "retail", "office", "school",
    "college", "stadium", "community_centre", "mosque", "garage", "shed",
    "accessory",
  ].includes(type) || [
    "commercial", "industrial", "retail", "office", "school", "college",
    "stadium", "community_centre", "mosque", "garage", "shed", "roof",
  ].includes(tag)) return false;
  // `unclassified`/`yes` is deliberately not enough for a fully validated
  // nearest match. Containment remains a separate, stronger classification.
  return [
    "residential", "apartment", "townhouse", "townhouse_unit_estimated",
    "multi_unit_estimated",
  ].includes(type) || ["house", "detached", "semidetached", "terrace", "apartments", "residential"]
    .includes(tag);
};

function candidateUniqueness(
  placement: FootprintPlacement,
  structureId: string,
) {
  const selected = placement.candidates.find((candidate) => candidate.structure_id === structureId);
  if (!selected) return false;
  return !placement.candidates.some((candidate) =>
    candidate.structure_id !== structureId &&
    candidate.distance_m <= selected.distance_m + 5,
  );
}

function neighboringSequence(
  placement: FootprintPlacement,
  location: NarLocation,
  units: AddressUnit[],
  placements: FootprintPlacement[],
  _structuresById: Map<string, Feature>,
  _roads: Road[],
) {
  const official = officialAddressForLocation(units, location.loc_guid);
  if (!official || !placement.structure_id) return false;
  // Full road projection for every placement would turn validation into a
  // quadratic operation on the production dataset. The constrained matcher
  // already orders its inputs by civic number and road side. Here we perform
  // the inexpensive local consistency check: same-street anchors may bracket
  // this number, but a direct placement is not rejected merely because it is
  // an endpoint or because an intermediate lot is missing.
  const sameStreetNumbers = placements
    .filter((other) => other.structure_id && other.location_id !== placement.location_id)
    .map((other) => officialAddressForLocation(units, other.location_id))
    .filter((other): other is NumberedAddress => Boolean(other && other.street_key === official.street_key))
    .map((other) => other.number);
  const lower = sameStreetNumbers.some((number) => number < official.number);
  const higher = sameStreetNumbers.some((number) => number > official.number);
  return lower || higher || sameStreetNumbers.length === 0;
}

export function validateNarPlacementEvidence(options: {
  location: NarLocation;
  units: AddressUnit[];
  placement: FootprintPlacement;
  structure?: Feature;
  placements?: FootprintPlacement[];
  structures?: Feature[];
  roads?: Feature[];
}): StreetSideEvidence {
  const official = officialAddressForLocation(options.units, options.location.loc_guid);
  const roof = options.structure ? roofStreetAndNumber(options.structure) : null;
  const roads = (options.roads ?? []) as Road[];
  const narPoint: Position = [options.location.longitude, options.location.latitude];
  const roofPointValue = options.structure ? roofPoint(options.structure) : null;
  const narProjection = official
    ? roadProjection(narPoint, official.street_key, official.number, roads)
    : { side: null, along_m: 0, distance_m: Infinity, road: null };
  const roofProjectionValue = roof && roofPointValue
    ? roadProjection(roofPointValue, roof.street_key, roof.number, roads)
    : { side: null, along_m: 0, distance_m: Infinity, road: null };
  const distance = options.structure
    ? distanceToGeometry(narPoint, options.structure.geometry)
    : null;
  const streetMatch = Boolean(official && roof && official.street_key === roof.street_key);
  const sideMatch = Boolean(narProjection.side && roofProjectionValue.side &&
    narProjection.side === roofProjectionValue.side);
  const narParity = parityMatchesRoadRange(narProjection, official?.number ?? null);
  const roofParity = parityMatchesRoadRange(roofProjectionValue, roof?.number ?? null);
  const parityMatch = narParity !== false && roofParity !== false &&
    (official?.number == null || roof?.number == null ||
      official.number % 2 === roof.number % 2);
  const hundredBlockMatch = blockCompatible(official?.number ?? null, roof?.number ?? null);
  const sequenceMatch = options.placements && options.structures && options.roads
    ? neighboringSequence(
        options.placement,
        options.location,
        options.units,
        options.placements,
        new Map(options.structures.map((feature) => [String(feature.properties.structure_id ?? feature.id), feature])),
        roads,
      )
    : streetMatch;
  const unique = Boolean(options.structure &&
    candidateUniqueness(options.placement, String(options.structure.properties.structure_id ?? options.structure.id)) &&
    plausibleResidentialFootprint(options.structure));
  const conservativeDistance = options.location.coordinate_source === "nar_building" &&
    distance != null && distance <= NAR_VALIDATED_DISTANCE_M;
  const reason = !official
    ? "official NAR address could not be parsed"
    : !roof
      ? "candidate roof has no usable civic address"
      : !streetMatch
        ? "street mismatch"
        : !sideMatch
          ? "street-side evidence is missing or contradictory"
          : !parityMatch
            ? "odd/even parity mismatch"
            : !hundredBlockMatch
              ? "civic hundred-block mismatch"
              : !sequenceMatch
                ? "neighbouring address sequence is contradictory"
                : !unique
                  ? "more than one plausible footprint remains"
                  : !conservativeDistance
                    ? options.location.coordinate_source === "nar_block_face_fallback"
                      ? "BF_REPPOINT is not building-coordinate evidence"
                      : "building coordinate is outside the conservative validation distance"
                    : null;
  return {
    street_match: streetMatch,
    side_match: sideMatch,
    parity_match: parityMatch,
    hundred_block_match: hundredBlockMatch,
    neighbouring_sequence_match: sequenceMatch,
    unique_plausible_footprint: unique,
    conservative_distance_match: conservativeDistance,
    coordinate_source: options.location.coordinate_source,
    distance_m: distance,
    roof_number: roof?.number ?? null,
    nar_number: official?.number ?? null,
    roof_street_key: roof?.street_key ?? "",
    nar_street_key: official?.street_key ?? "",
    nar_side: narProjection.side,
    roof_side: roofProjectionValue.side,
    reason,
  };
}

function structureCandidate(
  feature: Feature,
  nar: SequenceNar,
  roof: SequenceRoof,
  preciseDistance = true,
) {
  if (roof.address.street_key !== nar.address.street_key || roof.side !== nar.side)
    return null;
  if (nar.address.number % 2 !== roof.address.number % 2) return null;
  if (!blockCompatible(nar.address.number, roof.address.number)) return null;
  const distance = preciseDistance
    ? distanceToGeometry(nar.point, feature.geometry)
    : metresBetween(nar.point, roofPoint(feature));
  if (preciseDistance && nar.location.coordinate_source === "nar_building" && distance > NAR_SEQUENCE_DISTANCE_M)
    return null;
  return {
    feature,
    roof: roof.address,
    distance,
    cost: Math.abs(nar.address.number - roof.address.number) / 25 +
      (nar.location.coordinate_source === "nar_building" ? distance / 20 : 0),
  };
}

const structureCandidateCost = (
  feature: Feature,
  nar: SequenceNar,
  roof: SequenceRoof,
) => structureCandidate(feature, nar, roof, false)?.cost ?? Infinity;

type SequenceNar = {
  location: NarLocation;
  address: NumberedAddress;
  side: Side;
  along_m: number;
  point: Position;
};
type SequenceRoof = {
  feature: Feature;
  address: NumberedAddress;
  side: Side;
  along_m: number;
};

const stableCompare = (left: { number: number; suffix: string; id: string }, right: { number: number; suffix: string; id: string }) =>
  left.number - right.number ||
  left.suffix.localeCompare(right.suffix, undefined, { numeric: true }) ||
  left.id.localeCompare(right.id);

function matchGroup(nars: SequenceNar[], roofs: SequenceRoof[], units: AddressUnit[], placements: FootprintPlacement[], roads: Road[], structures: Feature[]) {
  const skipNar = 24;
  const skipRoof = 24;
  const rows = nars.length + 1;
  const cols = roofs.length + 1;
  const dp = Array.from({ length: rows }, () => new Float64Array(cols).fill(Infinity));
  const choices = Array.from({ length: rows }, () => new Uint8Array(cols));
  // Keep the DP matrix numeric. Storing one object per pair is needlessly
  // expensive for the largest Owen Sound street groups; accepted pairs are
  // re-evaluated during the short backtrace below.
  const candidateGrid = nars.map((nar) => {
    const costs = new Float64Array(roofs.length).fill(Infinity);
    roofs.forEach((roof, index) => {
      // Civic-number locality is an inexpensive first filter. The DP can
      // still skip vacant/missing lots, while avoiding a dense all-pairs
      // geometry calculation for an entire street group.
      costs[index] = Math.abs(nar.address.number - roof.address.number) <= 50
        ? structureCandidateCost(roof.feature, nar, roof)
        : Infinity;
    });
    return costs;
  });
  dp[0][0] = 0;
  for (let i = 0; i <= nars.length; i++) {
    for (let j = 0; j <= roofs.length; j++) {
      const current = dp[i][j];
      if (!Number.isFinite(current)) continue;
      if (i < nars.length && current + skipNar < dp[i + 1][j]) {
        dp[i + 1][j] = current + skipNar;
        choices[i + 1][j] = 2;
      }
      if (j < roofs.length && current + skipRoof < dp[i][j + 1]) {
        dp[i][j + 1] = current + skipRoof;
        choices[i][j + 1] = 3;
      }
      if (i >= nars.length || j >= roofs.length) continue;
      const candidateCost = candidateGrid[i]?.[j] ?? Infinity;
      if (!Number.isFinite(candidateCost) || candidateCost > skipNar + skipRoof) continue;
      if (current + candidateCost < dp[i + 1][j + 1]) {
        dp[i + 1][j + 1] = current + candidateCost;
        choices[i + 1][j + 1] = 1;
      }
    }
  }
  const assignments: StreetSideAssignment[] = [];
  let i = nars.length, j = roofs.length;
  const placementByLocation = new Map(placements.map((placement) => [placement.location_id, placement]));
  while (i > 0 || j > 0) {
    const choice = choices[i][j];
    if (choice === 1) {
      const nar = nars[i - 1], roof = roofs[j - 1];
      const candidate = structureCandidate(roof.feature, nar, roof);
      if (candidate) {
        const placement = placementByLocation.get(nar.location.loc_guid);
        if (placement) {
          const evidence = validateNarPlacementEvidence({
            location: nar.location,
            units,
            placement: {
              ...placement,
              structure_id: String(roof.feature.properties.structure_id ?? roof.feature.id),
              distance_m: candidate.distance,
              candidates: [{
                footprint_id: String(roof.feature.properties.external_id ?? roof.feature.id ?? ""),
                structure_id: String(roof.feature.properties.structure_id ?? roof.feature.id),
                source: String(roof.feature.properties.external_source ?? ""),
                distance_m: candidate.distance,
                centroid_distance_m: metresBetween([nar.location.longitude, nar.location.latitude], roofPoint(roof.feature)),
              }],
              point: [nar.location.longitude, nar.location.latitude],
            },
            structure: roof.feature,
            placements,
            structures,
            roads,
          });
          const oldQuality = String(roof.feature.properties.address_quality ?? "");
          const full = evidence.street_match && evidence.side_match && evidence.parity_match &&
            evidence.hundred_block_match && evidence.neighbouring_sequence_match &&
            evidence.unique_plausible_footprint && evidence.conservative_distance_match;
          const classification: AddressQualityClassification = full
            ? oldQuality === "legacy_unverified" &&
                evidence.roof_number === evidence.nar_number
              ? "legacy_nar_confirmed"
              : evidence.roof_number === evidence.nar_number
                ? "nar_validated_nearest"
                : "nar_nearest_no_known_conflict"
            : oldQuality === "legacy_unverified" &&
                evidence.street_match && evidence.side_match && evidence.parity_match && evidence.hundred_block_match
              ? "legacy_spatially_consistent"
              : "nar_nearest_no_known_conflict";
          assignments.push({
            location_id: nar.location.loc_guid,
            structure_id: String(roof.feature.properties.structure_id ?? roof.feature.id),
            distance_m: candidate.distance,
            method: "street_side_sequence",
            classification,
            evidence,
            cost: candidate.cost,
          });
        }
      }
      i--; j--;
    } else if (choice === 2) i--;
    else if (choice === 3) j--;
    else if (i > 0) i--;
    else j--;
  }
  return assignments;
}

/**
 * Match unresolved NAR locations to still-unassigned roofs without a
 * city-wide nearest fallback.  The DP permits vacant lots, missing footprints
 * and accessory structures by charging explicit skip penalties; only low-cost
 * one-to-one matches survive.
 */
export function matchUnresolvedNarLocations(options: {
  locations: NarLocation[];
  units: AddressUnit[];
  structures: Feature[];
  roads: Feature[];
  placements: FootprintPlacement[];
}) {
  const roads = options.roads as Road[];
  const unitsByLocation = new Map<string, AddressUnit[]>();
  for (const unit of options.units) {
    const values = unitsByLocation.get(unit.location_id) ?? [];
    values.push(unit);
    unitsByLocation.set(unit.location_id, values);
  }
  const occupied = new Set(
    options.placements.map((placement) => placement.structure_id).filter((id): id is string => Boolean(id)),
  );
  const roofs: SequenceRoof[] = [];
  for (const feature of options.structures) {
    const structureId = String(feature.properties.structure_id ?? feature.id ?? "");
    // Grey footprints are already considered by the direct point/containment
    // pass.  Generated Grey structures carry a published address label; if
    // they entered this second pass they would become new sequence candidates
    // on the next run and make repeated publication drift.  Keep the ordered
    // fallback limited to the pre-existing roof inventory.
    if (!structureId || occupied.has(structureId) || feature.properties.canvassable === false ||
        feature.properties.external_source === "grey_county_building_footprints")
      continue;
    const parsed = parseRoofAddress(feature);
    if (!parsed) continue;
    const projection = roadProjection(roofPoint(feature), parsed.street_key, parsed.number, roads);
    if (!projection.side) continue;
    roofs.push({ feature, address: parsed, side: projection.side, along_m: projection.along_m });
  }
  const locationsByGroup = new Map<string, SequenceNar[]>();
  for (const location of options.locations) {
    const placement = options.placements.find((candidate) => candidate.location_id === location.loc_guid);
    if (placement?.structure_id) continue;
    const address = officialAddressForLocation(options.units, location.loc_guid);
    if (!address) continue;
    const projection = roadProjection(
      [location.longitude, location.latitude],
      address.street_key,
      address.number,
      roads,
    );
    if (!projection.side) continue;
    const group = streetSideBlockKey(address.street_key, projection.side, address.number);
    const values = locationsByGroup.get(group) ?? [];
    values.push({
      location,
      address,
      side: projection.side,
      along_m: projection.along_m,
      point: [location.longitude, location.latitude],
    });
    locationsByGroup.set(group, values);
  }
  const roofsByGroup = new Map<string, SequenceRoof[]>();
  for (const roof of roofs) {
    const group = streetSideBlockKey(roof.address.street_key, roof.side, roof.address.number);
    const values = roofsByGroup.get(group) ?? [];
    values.push(roof);
    roofsByGroup.set(group, values);
  }
  const assignments: StreetSideAssignment[] = [];
  for (const [group, nars] of locationsByGroup) {
    const candidates = roofsByGroup.get(group) ?? [];
    if (!candidates.length) continue;
    nars.sort((a, b) => stableCompare(
      { number: a.address.number, suffix: a.address.suffix, id: a.location.loc_guid },
      { number: b.address.number, suffix: b.address.suffix, id: b.location.loc_guid },
    ));
    candidates.sort((a, b) => stableCompare(
      { number: a.address.number, suffix: a.address.suffix, id: String(a.feature.properties.structure_id ?? a.feature.id) },
      { number: b.address.number, suffix: b.address.suffix, id: String(b.feature.properties.structure_id ?? b.feature.id) },
    ));
    assignments.push(...matchGroup(nars, candidates, options.units, options.placements, roads, options.structures));
  }
  assignments.sort((a, b) => a.location_id.localeCompare(b.location_id));
  return assignments;
}
