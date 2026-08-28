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
/** Differences below this are not meaningful orientation evidence. */
export const ORIENTATION_COST_EPSILON = 0.05;
/** Keep floating-point DP noise from selecting a different path. */
export const MATCH_COST_EPSILON = 1e-9;

export type AddressQualityClassification =
  | "nar_building_contained"
  | "nar_building_validated_nearest"
  | "nar_building_sequence"
  | "nar_block_face_sequence"
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
  coordinate_offset_m: number | null;
  neighbouring_anchors: {
    lower: SequenceAnchorEvidence | null;
    higher: SequenceAnchorEvidence | null;
    orientation: "increasing" | "decreasing" | null;
    lower_available: boolean;
    higher_available: boolean;
  };
  ordering_orientation: "increasing" | "decreasing" | null;
  ordering_basis: "trusted_anchors" | "two_orientation_comparison" | "unresolved";
  reason: string | null;
};

export type SequenceAnchorEvidence = {
  location_id: string;
  structure_id: string;
  civic_number: number;
  civic_number_suffix: string;
  along_m: number;
  confidence: string;
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
  fraction: number;
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

const numberSuffix = (value: unknown) => {
  const text = String(value ?? "").trim();
  if (/^\d+$/.test(text)) return "";
  return text.match(/^\d+([A-Za-z]+|\/\d+|-[A-Za-z0-9]+)$/)?.[1] ?? "";
};

const hasSourceAddressCorrection = (feature: Feature) => {
  const properties = feature.properties;
  return properties.manual_civic_correction === true ||
    String(properties.address_source_status ?? "") === "manual_verified" ||
    String(properties.address_label_source ?? "") === "manual_correction" ||
    String(properties.address_quality ?? "") === "manually_verified";
};

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

export function parseRoofAddress(feature: Feature, roads: Feature[] = []): NumberedAddress | null {
  const p = feature.properties;
  const inferredNumber = numericCivic(p.inferred_civic_number);
  const rangeRoadId = String(p.address_range_road_id ?? "");
  const rangeRoad = rangeRoadId
    ? roads.find((road) => String(road.properties.road_id ?? road.id ?? "") === rangeRoadId)
    : undefined;
  // Road-range metadata is source geography and remains stable across
  // publication. It is the preferred street key for sequence matching;
  // published NAR labels and prior-NAR fallback labels are not ordering
  // evidence.
  if (rangeRoad && inferredNumber != null) {
    return {
      number: inferredNumber,
      suffix: numberSuffix(p.inferred_civic_number),
      street_key: normalizeStreet(rangeRoad.properties.name),
    };
  }
  const derivedAddress = String(p.address_source_status ?? "") === "authoritative" ||
    String(p.legacy_address_fallback_source ?? "") === "prior_nar_association";
  if (derivedAddress && !hasSourceAddressCorrection(feature)) return null;
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
  const start = Number(road.properties[`${prefix}_from`]);
  const end = Number(road.properties[`${prefix}_to`]);
  const parity = String(road.properties[`${prefix}_parity`] ?? "").toUpperCase().slice(0, 1);
  return Number.isFinite(start) && Number.isFinite(end)
    ? { from: Math.min(start, end), to: Math.max(start, end), start, end, parity }
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
    const lines = lineCoordinates(road);
    const roadLength = lines.reduce((total, line) => total + line.slice(1).reduce(
      (length, point, index) => length + metresBetween(line[index], point), 0,
    ), 0);
    let alongRoad = 0;
    for (const line of lines) {
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
          fraction: roadLength ? (alongRoad + projected.along_m) / roadLength : 0,
          distance_m: projected.distance_m,
          road,
        } satisfies RoadProjection;
        if (!best || candidate.distance_m < best.distance_m) best = candidate;
        alongRoad += length;
      }
    }
  }
  return best ?? { side: null, along_m: 0, fraction: 0, distance_m: Infinity, road: null };
}

const blockAtProjection = (projection: RoadProjection) => {
  if (!projection.road || !projection.side) return null;
  const range = rangeForSide(projection.road, projection.side);
  if (!range) return null;
  const interpolated = range.start + (range.end - range.start) * projection.fraction;
  return Number.isFinite(interpolated) ? Math.floor(interpolated / 100) : null;
};

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

function isTrustedSequenceAnchor(placement: FootprintPlacement) {
  const quality = String(placement.confidence_classification ?? "");
  return placement.coordinate_source === "nar_building" && (
    quality === "nar_building_contained" ||
    quality === "nar_building_validated_nearest" ||
    // Accept the legacy names while an older in-memory fixture is being
    // upgraded. They are never emitted by the current publisher.
    quality === "nar_contained_footprint" || quality === "nar_validated_nearest"
  );
}

function neighboringSequence(
  placement: FootprintPlacement,
  location: NarLocation,
  units: AddressUnit[],
  placements: FootprintPlacement[],
  structuresById: Map<string, Feature>,
  roads: Road[],
): {
  matches: boolean;
  anchors: StreetSideEvidence["neighbouring_anchors"];
} {
  const official = officialAddressForLocation(units, location.loc_guid);
  const empty = {
    lower: null,
    higher: null,
    orientation: null,
    lower_available: false,
    higher_available: false,
  } satisfies StreetSideEvidence["neighbouring_anchors"];
  if (!official || !placement.structure_id) return { matches: false, anchors: empty };
  const structure = structuresById.get(placement.structure_id);
  if (!structure) return { matches: false, anchors: empty };
  const candidateProjection = roadProjection(
    roofPoint(structure), official.street_key, official.number, roads,
  );
  if (!candidateProjection.road || !candidateProjection.side)
    return { matches: false, anchors: empty };
  const candidateBlock = civicHundredBlock(official.number);
  const anchors: Array<SequenceAnchorEvidence & { number: number }> = [];
  for (const other of placements) {
    if (other.location_id === placement.location_id || !other.structure_id ||
        !isTrustedSequenceAnchor(other)) continue;
    const otherOfficial = officialAddressForLocation(units, other.location_id);
    const otherStructure = structuresById.get(other.structure_id);
    if (!otherOfficial || !otherStructure || otherOfficial.street_key !== official.street_key ||
        civicHundredBlock(otherOfficial.number) !== candidateBlock) continue;
    const otherProjection = roadProjection(
      roofPoint(otherStructure), otherOfficial.street_key, otherOfficial.number, roads,
    );
    if (otherProjection.side !== candidateProjection.side) continue;
    anchors.push({
      location_id: other.location_id,
      structure_id: other.structure_id,
      civic_number: otherOfficial.number,
      civic_number_suffix: otherOfficial.suffix,
      number: otherOfficial.number,
      along_m: otherProjection.along_m,
      confidence: String(other.confidence_classification),
    });
  }
  const lower = anchors
    .filter((anchor) => anchor.number < official.number)
    .sort((a, b) => b.number - a.number || b.along_m - a.along_m)[0] ?? null;
  const higher = anchors
    .filter((anchor) => anchor.number > official.number)
    .sort((a, b) => a.number - b.number || a.along_m - b.along_m)[0] ?? null;
  const orientation = lower && higher && lower.along_m !== higher.along_m
    ? higher.along_m > lower.along_m ? "increasing" : "decreasing"
    : null;
  const anchorView = (anchor: (typeof anchors)[number] | null): SequenceAnchorEvidence | null =>
    anchor ? {
      location_id: anchor.location_id,
      structure_id: anchor.structure_id,
      civic_number: anchor.civic_number,
      civic_number_suffix: anchor.civic_number_suffix,
      along_m: anchor.along_m,
      confidence: anchor.confidence,
    } : null;
  const output = {
    lower: anchorView(lower),
    higher: anchorView(higher),
    orientation,
    lower_available: Boolean(lower),
    higher_available: Boolean(higher),
  } satisfies StreetSideEvidence["neighbouring_anchors"];
  const brackets = Boolean(lower && higher && orientation && (
    orientation === "increasing"
      ? lower.along_m < candidateProjection.along_m && candidateProjection.along_m < higher.along_m
      : lower.along_m > candidateProjection.along_m && candidateProjection.along_m > higher.along_m
  ));
  if (lower && higher) return { matches: brackets, anchors: output };
  if (!lower && !higher) return { matches: true, anchors: output };
  // A one-sided endpoint is accepted only with strong physical evidence. A
  // sequence assignment begins as unmatched, so it cannot bootstrap itself
  // into endpoint validation.
  const strongEndpoint = placement.status === "exact" ||
    (placement.coordinate_source === "nar_building" &&
      placement.distance_m != null && placement.distance_m <= 12);
  return { matches: strongEndpoint, anchors: output };
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
    : { side: null, along_m: 0, fraction: 0, distance_m: Infinity, road: null };
  const roofProjectionValue = roof && roofPointValue
    ? roadProjection(roofPointValue, roof.street_key, roof.number, roads)
    : { side: null, along_m: 0, fraction: 0, distance_m: Infinity, road: null };
  const distance = options.structure && options.location.coordinate_source === "nar_building"
    ? distanceToGeometry(narPoint, options.structure.geometry)
    : null;
  // BF_REPPOINT is useful for street-side sequencing, but its geometric
  // offset from a roof is not a building-placement accuracy measurement.
  const coordinateOffset = options.structure
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
  const sequenceResult = options.placements && options.structures && options.roads
    ? neighboringSequence(
        options.placement,
        options.location,
        options.units,
        options.placements,
        new Map(options.structures.map((feature) => [String(feature.properties.structure_id ?? feature.id), feature])),
        roads,
      )
    : {
        matches: streetMatch,
        anchors: {
          lower: null,
          higher: null,
          orientation: null,
          lower_available: false,
          higher_available: false,
        },
      };
  const sequenceMatch = sequenceResult.matches;
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
    coordinate_offset_m: coordinateOffset,
    neighbouring_anchors: sequenceResult.anchors,
    ordering_orientation: null,
    ordering_basis: "unresolved",
    reason,
  };
}

function structureCandidate(
  feature: Feature,
  nar: SequenceNar,
  roof: SequenceRoof,
) {
  if (roof.address.street_key !== nar.address.street_key || roof.side !== nar.side)
    return null;
  const distance = nar.location.coordinate_source === "nar_building"
    ? distanceToGeometry(nar.point, feature.geometry)
    : null;
  if (distance != null && distance > NAR_SEQUENCE_DISTANCE_M) return null;
  const blockMatch = roof.block == null || roof.block === civicHundredBlock(nar.address.number);
  const parityMatch = roof.address.number % 2 === nar.address.number % 2;
  // Civic labels on roofs are often estimates. They remain a weak cost after
  // spatial ordering has been established; they are never used to order a
  // roof and a local number mismatch cannot prevent a spatial correction.
  const numberPenalty = Math.min(6, Math.abs(nar.address.number - roof.address.number) / 100);
  const blockPenalty = blockMatch ? 0 : 4;
  const parityPenalty = parityMatch ? 0 : 1.5;
  const buildingGeometryPenalty = distance == null ? 0 : distance / 20;
  const alongPenalty = nar.location.coordinate_source === "nar_building"
    ? Math.abs(nar.along_m - roof.along_m) / 80
    : 0;
  return {
    feature,
    roof: roof.address,
    distance_m: distance,
    coordinate_offset_m: distance,
    consistent: blockMatch && parityMatch,
    cost: numberPenalty + blockPenalty + parityPenalty + buildingGeometryPenalty + alongPenalty,
  };
}

const structureCandidateCost = (
  feature: Feature,
  nar: SequenceNar,
  roof: SequenceRoof,
) => structureCandidate(feature, nar, roof)?.cost ?? Infinity;

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
  block: number | null;
};

const stableCompare = (left: { number: number; suffix: string; id: string }, right: { number: number; suffix: string; id: string }) =>
  left.number - right.number ||
  left.suffix.localeCompare(right.suffix, undefined, { numeric: true }) ||
  left.id.localeCompare(right.id);

type MatchGroupResult = {
  assignments: StreetSideAssignment[];
  cost: number;
  matched: number;
  consistent: number;
};

function matchGroup(
  nars: SequenceNar[],
  roofs: SequenceRoof[],
  orientation: 1 | -1,
  orderingBasis: "trusted_anchors" | "two_orientation_comparison",
  units: AddressUnit[],
  placements: FootprintPlacement[],
  roads: Road[],
  structures: Feature[],
): MatchGroupResult {
  const skipNar = 24;
  const skipRoof = 24;
  const orderedRoofs = orientation === 1 ? roofs : [...roofs].reverse();
  const rows = nars.length + 1;
  const cols = orderedRoofs.length + 1;
  const dp = Array.from({ length: rows }, () => new Float64Array(cols).fill(Infinity));
  const choices = Array.from({ length: rows }, () => new Uint8Array(cols));
  // Keep the DP matrix numeric. Storing one object per pair is needlessly
  // expensive for the largest Owen Sound street groups; accepted pairs are
  // re-evaluated during the short backtrace below.
  const candidateGrid = nars.map((nar) => {
    const costs = new Float64Array(orderedRoofs.length).fill(Infinity);
    orderedRoofs.forEach((roof, index) => {
      costs[index] = structureCandidateCost(roof.feature, nar, roof);
    });
    return costs;
  });
  dp[0][0] = 0;
  for (let i = 0; i <= nars.length; i++) {
    for (let j = 0; j <= roofs.length; j++) {
      const current = dp[i][j];
      if (!Number.isFinite(current)) continue;
      if (i < nars.length && current + skipNar < dp[i + 1][j] - MATCH_COST_EPSILON) {
        dp[i + 1][j] = current + skipNar;
        choices[i + 1][j] = 2;
      }
      if (j < roofs.length && current + skipRoof < dp[i][j + 1] - MATCH_COST_EPSILON) {
        dp[i][j + 1] = current + skipRoof;
        choices[i][j + 1] = 3;
      }
      if (i >= nars.length || j >= roofs.length) continue;
      const candidateCost = candidateGrid[i]?.[j] ?? Infinity;
      if (!Number.isFinite(candidateCost) || candidateCost > skipNar + skipRoof) continue;
      if (current + candidateCost < dp[i + 1][j + 1] - MATCH_COST_EPSILON) {
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
      const nar = nars[i - 1], roof = orderedRoofs[j - 1];
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
              distance_m: candidate.distance_m ?? 0,
              candidates: [{
                footprint_id: String(roof.feature.properties.external_id ?? roof.feature.id ?? ""),
                structure_id: String(roof.feature.properties.structure_id ?? roof.feature.id),
                source: String(roof.feature.properties.external_source ?? ""),
                distance_m: candidate.distance_m ?? 0,
                centroid_distance_m: metresBetween([nar.location.longitude, nar.location.latitude], roofPoint(roof.feature)),
              }],
              point: [nar.location.longitude, nar.location.latitude],
            },
            structure: roof.feature,
            placements,
            structures,
            roads,
          });
          evidence.ordering_orientation = orientation === 1 ? "increasing" : "decreasing";
          evidence.ordering_basis = orderingBasis;
          const oldQuality = String(roof.feature.properties.address_quality ?? "");
          const full = evidence.street_match && evidence.side_match && evidence.parity_match &&
            evidence.hundred_block_match && evidence.neighbouring_sequence_match &&
            evidence.unique_plausible_footprint && evidence.conservative_distance_match;
          const orderedStreetSide = evidence.street_match && evidence.side_match &&
            evidence.parity_match && evidence.hundred_block_match;
          const classification: AddressQualityClassification =
            nar.location.coordinate_source === "nar_block_face_fallback" && orderedStreetSide
              ? "nar_block_face_sequence"
              : full
                ? oldQuality === "legacy_unverified" &&
                    evidence.roof_number === evidence.nar_number
                  ? "legacy_nar_confirmed"
                  : "nar_building_sequence"
                : oldQuality === "legacy_unverified" &&
                evidence.street_match && evidence.side_match && evidence.parity_match && evidence.hundred_block_match
                  ? "legacy_spatially_consistent"
                  : "nar_nearest_no_known_conflict";
          assignments.push({
            location_id: nar.location.loc_guid,
            structure_id: String(roof.feature.properties.structure_id ?? roof.feature.id),
            distance_m: candidate.distance_m,
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
  const matched = assignments.length;
  const consistent = assignments.filter((assignment) =>
    assignment.evidence.hundred_block_match && assignment.evidence.parity_match,
  ).length;
  return {
    assignments,
    cost: dp[nars.length][orderedRoofs.length],
    matched,
    consistent,
  };
}

function inferOrientationFromTrustedAnchors(options: {
  nars: SequenceNar[];
  placements: FootprintPlacement[];
  units: AddressUnit[];
  structures: Feature[];
  roads: Road[];
}): 1 | -1 | null {
  const group = options.nars[0];
  if (!group) return null;
  const groupKey = streetSideBlockKey(group.address.street_key, group.side, group.address.number);
  const structuresById = new Map(options.structures.map((feature) => [
    String(feature.properties.structure_id ?? feature.id), feature,
  ]));
  const anchors = options.placements.flatMap((placement) => {
    if (!placement.structure_id || !isTrustedSequenceAnchor(placement)) return [];
    const official = officialAddressForLocation(options.units, placement.location_id);
    const structure = structuresById.get(placement.structure_id);
    if (!official || !structure) return [];
    const projection = roadProjection(
      roofPoint(structure), official.street_key, official.number, options.roads,
    );
    if (!projection.side || streetSideBlockKey(official.street_key, projection.side, official.number) !== groupKey)
      return [];
    return [{ number: official.number, along_m: projection.along_m }];
  }).sort((a, b) => a.number - b.number || a.along_m - b.along_m);
  let increasingVotes = 0;
  let decreasingVotes = 0;
  for (let index = 1; index < anchors.length; index++) {
    const previous = anchors[index - 1], current = anchors[index];
    if (current.number === previous.number || current.along_m === previous.along_m) continue;
    if (current.along_m > previous.along_m) increasingVotes++;
    else decreasingVotes++;
  }
  if (increasingVotes && !decreasingVotes) return 1;
  if (decreasingVotes && !increasingVotes) return -1;
  return null;
}

function chooseOrientationResult(
  normal: MatchGroupResult,
  reversed: MatchGroupResult,
): MatchGroupResult | null {
  if (!normal.matched && !reversed.matched) return null;
  if (normal.matched !== reversed.matched)
    return normal.matched > reversed.matched ? normal : reversed;
  if (normal.consistent !== reversed.consistent)
    return normal.consistent > reversed.consistent ? normal : reversed;
  const difference = Math.abs(normal.cost - reversed.cost);
  // If both orientations explain the same number of roofs equally well, do
  // not let an arbitrary legacy label or floating-point noise choose one.
  // A small but material civic-support difference is enough to resolve a
  // reversed line; otherwise the block remains unresolved for review.
  if (difference <= ORIENTATION_COST_EPSILON) return null;
  return normal.cost < reversed.cost ? normal : reversed;
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
    const parsed = parseRoofAddress(feature, roads);
    if (!parsed) continue;
    const projection = roadProjection(roofPoint(feature), parsed.street_key, parsed.number, roads);
    if (!projection.side) continue;
    roofs.push({
      feature,
      address: parsed,
      side: projection.side,
      along_m: projection.along_m,
      // The road's prepared address range is the primary coarse block
      // grouping. The old roof number is only a fallback when the road has no
      // usable range; it never orders the roof.
      block: blockAtProjection(projection) ?? civicHundredBlock(parsed.number),
    });
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
    // Official NAR addresses define the civic sequence. Physical roofs are
    // ordered only by their road projection, never by their prior estimated
    // civic labels.
    candidates.sort((a, b) => a.along_m - b.along_m ||
      String(a.feature.properties.structure_id ?? a.feature.id).localeCompare(
        String(b.feature.properties.structure_id ?? b.feature.id),
      ));
    const anchoredOrientation = inferOrientationFromTrustedAnchors({
      nars,
      placements: options.placements,
      units: options.units,
      structures: options.structures,
      roads,
    });
    const selected = anchoredOrientation
      ? matchGroup(nars, candidates, anchoredOrientation, "trusted_anchors", options.units, options.placements, roads, options.structures)
      : chooseOrientationResult(
          matchGroup(nars, candidates, 1, "two_orientation_comparison", options.units, options.placements, roads, options.structures),
          matchGroup(nars, candidates, -1, "two_orientation_comparison", options.units, options.placements, roads, options.structures),
        );
    if (selected) assignments.push(...selected.assignments);
  }
  assignments.sort((a, b) => a.location_id.localeCompare(b.location_id));
  return assignments;
}
