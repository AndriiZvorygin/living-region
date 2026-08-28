import {
  centroid,
  distanceToGeometry,
  geometryContains,
  normalizeStreet,
  metresBetween,
  stableId,
  type Feature,
  type Position,
} from "./building-coverage";
import {
  formatCivicNumber,
  formatOfficialBaseAddress,
} from "./official-address";
import type { AddressUnit, NarLocation } from "./owen-sound-address-foundation";
import {
  matchUnresolvedNarLocations,
  validateNarPlacementEvidence,
  type AddressQualityClassification,
  type StreetSideEvidence,
} from "./owen-sound-street-side-matching";

export const DEFAULT_FOOTPRINT_MATCH_THRESHOLD_M = 50;
export const FOOTPRINT_AMBIGUITY_TOLERANCE_M = 2;

export type FootprintPlacementStatus =
  | "exact"
  | "nearest"
  | "ambiguous"
  | "unmatched";

export type FootprintCandidate = {
  footprint_id: string;
  structure_id: string;
  source: string;
  distance_m: number;
  centroid_distance_m: number;
  street_compatibility?: "match" | "mismatch" | "unknown";
  civic_number_compatibility?: "match" | "mismatch" | "unknown";
  compatibility_score?: number;
  footprint_area_m2?: number;
};

export type FootprintPlacement = {
  location_id: string;
  structure_id: string | null;
  status: FootprintPlacementStatus;
  distance_m: number | null;
  footprint_id: string | null;
  footprint_source: string | null;
  candidates: FootprintCandidate[];
  point: Position;
  coordinate_source?: NarLocation["coordinate_source"];
  address_ids?: string[];
  official_street?: string;
  rejection_reason?: string;
  /** Placement method and confidence are separate from the coarse status. */
  match_method?: "nar_contained_footprint" | "nar_nearest" | "street_side_sequence" | "unresolved";
  confidence_classification?: AddressQualityClassification;
  validation?: StreetSideEvidence;
};

type IndexedFeature = { feature: Feature; bbox: [number, number, number, number] };

const geometryIsPolygon = (feature: Feature) =>
  feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon";

const footprintAreaM2 = (feature: Feature) => {
  const center = centroid(feature);
  const latitudeScale = 111320 * Math.cos((center[1] * Math.PI) / 180);
  const latitudeScaleSquared = 111320;
  let area = 0;
  const visitRing = (ring: Position[]) => {
    for (let index = 1; index < ring.length; index++)
      area +=
        ring[index - 1][0] * latitudeScale * ring[index][1] * latitudeScaleSquared -
        ring[index][0] * latitudeScale * ring[index - 1][1] * latitudeScaleSquared;
  };
  const rings = feature.geometry.type === "Polygon"
    ? [feature.geometry.coordinates[0]]
    : feature.geometry.coordinates.map((polygon: Position[][]) => polygon[0]);
  for (const ring of rings) {
    if (ring?.length) visitRing(ring);
  }
  return Math.abs(area) / 2;
};

const bboxFor = (feature: Feature): [number, number, number, number] => {
  const points: Position[] = [];
  const walk = (coordinates: any) => {
    if (typeof coordinates?.[0] === "number") points.push(coordinates as Position);
    else coordinates?.forEach(walk);
  };
  walk(feature.geometry.coordinates);
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};

const cellKey = (x: number, y: number) => `${x}:${y}`;

class SpatialIndex {
  private readonly cells = new Map<string, IndexedFeature[]>();
  // About 20 metres at Owen Sound's latitude. This keeps the initial search
  // close to the 50m matching threshold instead of checking every roof in a
  // 400m tile neighbourhood.
  private readonly cellSize = 0.00025;

  constructor(features: Feature[]) {
    for (const feature of features) {
      if (!geometryIsPolygon(feature)) continue;
      const bbox = bboxFor(feature);
      const minX = Math.floor(bbox[0] / this.cellSize);
      const maxX = Math.floor(bbox[2] / this.cellSize);
      const minY = Math.floor(bbox[1] / this.cellSize);
      const maxY = Math.floor(bbox[3] / this.cellSize);
      const indexed = { feature, bbox };
      for (let x = minX; x <= maxX; x++)
        for (let y = minY; y <= maxY; y++) {
          const key = cellKey(x, y);
          this.cells.set(key, [...(this.cells.get(key) ?? []), indexed]);
        }
    }
  }

  nearby(point: Position, radiusCells: number) {
    const x = Math.floor(point[0] / this.cellSize);
    const y = Math.floor(point[1] / this.cellSize);
    const values = new Map<string, IndexedFeature>();
    for (let dx = -radiusCells; dx <= radiusCells; dx++)
      for (let dy = -radiusCells; dy <= radiusCells; dy++)
        for (const item of this.cells.get(cellKey(x + dx, y + dy)) ?? [])
          values.set(String(item.feature.properties.structure_id ?? item.feature.id), item);
    return [...values.values()];
  }
}

const sourceName = (feature: Feature) =>
  String(feature.properties.external_source ?? "existing_building_footprint");

const structureId = (feature: Feature, source: string) =>
  source === "grey_county_building_footprints"
    ? stableId("structure", `grey:${greyFootprintId(feature)}`)
    : String(
        feature.properties.structure_id ??
          feature.id ??
          stableId("structure", `${source}:${feature.properties.external_id ?? "unknown"}`),
      );

const greyFootprintId = (feature: Feature) =>
  String(
    feature.properties.OBJECTID ??
      feature.properties.objectid ??
      feature.properties.external_id ??
      feature.properties.grey_county_footprint_id ??
      feature.id ??
      "unknown",
  );

const isUsableExistingFootprint = (feature: Feature) => {
  const source = sourceName(feature);
  const type = String(feature.properties.building_type ?? "").toLowerCase();
  return source !== "living_region_estimate" && type !== "accessory";
};

type PlacementContext = {
  civicNumbers: string[];
  officialStreet: string;
  preferredStructureId?: string;
};

const civicNumberValue = (value: unknown) => {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : null;
};

const candidateStreetKeys = (feature: Feature) => {
  const properties = feature.properties;
  const labelStreet = String(properties.civic_label ?? "")
    .replace(/^~?\d+[A-Z0-9/-]*\s*/i, "")
    .replace(/\s+\+\d+$/, "")
    .trim();
  return [...new Set(
    [properties.fallback_street, properties.address_range_street, labelStreet]
      .map((value) => normalizeStreet(value))
      .filter(Boolean),
  )];
};

const candidateCivicNumbers = (feature: Feature) => [
  ...(Array.isArray(feature.properties.civic_numbers)
    ? feature.properties.civic_numbers
    : []),
  feature.properties.inferred_civic_number,
  feature.properties.fallback_civic_number,
  String(feature.properties.civic_label ?? "").match(/^~?(\d+)/)?.[1],
]
  .map(civicNumberValue)
  .filter((value): value is number => value != null);

function candidateFor(
  feature: Feature,
  point: Position,
  context: PlacementContext,
): FootprintCandidate {
  const source = sourceName(feature);
  const officialStreet = normalizeStreet(context.officialStreet);
  const streets = candidateStreetKeys(feature);
  const streetCompatibility: FootprintCandidate["street_compatibility"] =
    !officialStreet || !streets.length
      ? "unknown"
      : streets.includes(officialStreet)
        ? "match"
        : "mismatch";
  const numbers = context.civicNumbers
    .map(civicNumberValue)
    .filter((value): value is number => value != null);
  const candidateNumbers = candidateCivicNumbers(feature);
  const candidateAddressIsAuthoritative =
    String(feature.properties.address_source_status ?? "") === "authoritative" ||
    String(feature.properties.address_label_source ?? "") ===
      "statistics_canada_national_address_register";
  const civicCompatibility: FootprintCandidate["civic_number_compatibility"] =
    !numbers.length || !candidateNumbers.length
      ? "unknown"
      : !candidateAddressIsAuthoritative
        ? "unknown"
      : candidateNumbers.some((value) => numbers.includes(value))
        ? "match"
        : "mismatch";
  const compatibilityScore =
    (streetCompatibility === "match" ? 2 : streetCompatibility === "unknown" ? 1 : 0) +
    (civicCompatibility === "match" ? 2 : civicCompatibility === "unknown" ? 1 : 0);
  return {
    footprint_id:
      source === "grey_county_building_footprints"
        ? greyFootprintId(feature)
        : String(feature.properties.external_id ?? feature.id ?? feature.properties.structure_id),
    structure_id: structureId(feature, source),
    source,
    distance_m: distanceToGeometry(point, feature.geometry),
    centroid_distance_m: metresBetween(point, centroid(feature)),
    street_compatibility: streetCompatibility,
    civic_number_compatibility: civicCompatibility,
    compatibility_score: compatibilityScore,
    footprint_area_m2: footprintAreaM2(feature),
  };
}

function bboxDistanceM(point: Position, bbox: [number, number, number, number]) {
  const clamped: Position = [
    Math.max(bbox[0], Math.min(bbox[2], point[0])),
    Math.max(bbox[1], Math.min(bbox[3], point[1])),
  ];
  return metresBetween(point, clamped);
}

function chooseCandidate(
  point: Position,
  candidates: Feature[],
  thresholdM: number,
  context: PlacementContext,
): FootprintPlacement {
  const ranked = candidates
    .map((feature) => ({ feature, candidate: candidateFor(feature, point, context) }))
    .sort((a, b) => {
      const compatibilityDifference =
        (b.candidate.compatibility_score ?? 0) - (a.candidate.compatibility_score ?? 0);
      const distanceDifference = a.candidate.distance_m - b.candidate.distance_m;
      const areaDifference =
        (a.candidate.footprint_area_m2 ?? Infinity) -
        (b.candidate.footprint_area_m2 ?? Infinity);
      const preferenceDifference =
        (b.candidate.structure_id === context.preferredStructureId ? 1 : 0) -
        (a.candidate.structure_id === context.preferredStructureId ? 1 : 0);
      return distanceDifference || compatibilityDifference || areaDifference || preferenceDifference ||
        (a.candidate.source === "grey_county_building_footprints" ? -1 : 0) -
          (b.candidate.source === "grey_county_building_footprints" ? -1 : 0) ||
        a.candidate.centroid_distance_m - b.candidate.centroid_distance_m ||
        a.candidate.structure_id.localeCompare(b.candidate.structure_id);
    });
  const allCandidates = ranked.slice(0, 8).map((item) => item.candidate);
  const best = ranked[0];
  if (!best || best.candidate.distance_m > thresholdM)
    return {
      location_id: "",
      structure_id: null,
      status: "unmatched",
      distance_m: best?.candidate.distance_m ?? null,
      footprint_id: null,
      footprint_source: null,
      candidates: allCandidates,
      point,
      official_street: context.officialStreet,
      rejection_reason: "no credible footprint within the conservative match threshold",
    };
  const sameSourceNearBest = ranked.filter((item) =>
    item.candidate.source === best.candidate.source &&
    item.candidate.distance_m - best.candidate.distance_m <= FOOTPRINT_AMBIGUITY_TOLERANCE_M &&
    item.candidate.structure_id !== context.preferredStructureId &&
    item.candidate.structure_id !== best.candidate.structure_id &&
    (item.candidate.compatibility_score ?? 0) === (best.candidate.compatibility_score ?? 0),
  );
  if (sameSourceNearBest.length) {
    return {
      location_id: "",
      structure_id: null,
      status: "ambiguous",
      distance_m: best.candidate.distance_m,
      footprint_id: null,
      footprint_source: best.candidate.source,
      candidates: allCandidates,
      point,
      official_street: context.officialStreet,
      rejection_reason: "multiple nearby footprints remain similarly plausible",
    };
  }
  return {
    location_id: "",
    structure_id: best.candidate.structure_id,
    status: best.candidate.distance_m === 0 ? "exact" : "nearest",
    distance_m: best.candidate.distance_m,
    footprint_id: best.candidate.footprint_id,
    footprint_source: best.candidate.source,
    candidates: allCandidates,
    point,
    official_street: context.officialStreet,
  };
}

function compatibleMultipleLocations(
  structure: Feature | undefined,
  placements: FootprintPlacement[],
  unitsByLocation: Map<string, AddressUnit[]>,
) {
  if (!structure || placements.length <= 1) return true;
  const properties = structure.properties;
  const buildingType = String(properties.building_type ?? "").toLowerCase();
  const sourceTag = String(properties.source_building_tag ?? "").toLowerCase();
  const apartment = buildingType === "apartment" || sourceTag === "apartments";
  const points = new Set(placements.map((placement) => placement.point.join(",")));
  const streets = new Set(
    placements
      .map((placement) => normalizeStreet(placement.official_street ?? ""))
      .filter(Boolean),
  );
  const civicNumbers = placements.flatMap((placement) =>
    (unitsByLocation.get(placement.location_id) ?? []).map((unit) => civicNumberValue(unit.civic_number)),
  ).filter((value): value is number => value != null);
  const numberSpan = civicNumbers.length ? Math.max(...civicNumbers) - Math.min(...civicNumbers) : Infinity;
  const everyContained = placements.every((placement) => placement.status === "exact");
  // Multiple distinct NAR locations are accepted only for a typed apartment
  // structure, or for a small number of demonstrably distinct points inside
  // one footprint. Identical/repeated NAR points cannot justify collapsing
  // unrelated civic addresses onto an ordinary house.
  return streets.size <= 1 && numberSpan <= 100 &&
    ((apartment && everyContained && placements.length <= 12) ||
      (points.size === placements.length && everyContained && placements.length <= 4));
}

export function placeNarLocations(options: {
  locations: NarLocation[];
  structures: Feature[];
  greyFootprints?: Feature[];
  units?: AddressUnit[];
  preferredStructureByLocation?: Map<string, string>;
  thresholdM?: number;
  roads?: Feature[];
}) {
  const grey = (options.greyFootprints ?? [])
    .filter(geometryIsPolygon)
    .map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        external_source: "grey_county_building_footprints",
      },
    }));
  const existing = options.structures.filter(
    (feature) => geometryIsPolygon(feature) && isUsableExistingFootprint(feature),
  );
  // The published bundle may already contain Grey-derived structures created
  // by an earlier address run.  The same stable Grey footprint is also in the
  // fresh licensed snapshot.  Keep one candidate per physical structure and
  // prefer the fresh raw geometry so newly published address metadata cannot
  // feed back into the next placement decision and make regeneration drift.
  const allById = new Map<string, Feature>();
  for (const feature of grey)
    allById.set(structureId(feature, sourceName(feature)), feature);
  for (const feature of existing) {
    const id = structureId(feature, sourceName(feature));
    if (!allById.has(id)) allById.set(id, feature);
  }
  const all = [...allById.values()];
  const index = new SpatialIndex(all);
  const thresholdM = options.thresholdM ?? DEFAULT_FOOTPRINT_MATCH_THRESHOLD_M;
  const unitsByLocation = new Map<string, AddressUnit[]>();
  for (const unit of options.units ?? []) {
    const list = unitsByLocation.get(unit.location_id) ?? [];
    list.push(unit);
    unitsByLocation.set(unit.location_id, list);
  }
  const placements = options.locations.map((location) => {
    const point: Position = [location.longitude, location.latitude];
    let nearbyEntries = index.nearby(point, 3);
    if (!nearbyEntries.length) nearbyEntries = index.nearby(point, 12);
    const containingGrey = nearbyEntries.filter(
      (item) => bboxDistanceM(point, item.bbox) === 0 &&
        sourceName(item.feature) === "grey_county_building_footprints" && geometryContains(item.feature.geometry, point),
    );
    const containingExisting = nearbyEntries.filter(
      (item) => bboxDistanceM(point, item.bbox) === 0 &&
        sourceName(item.feature) !== "grey_county_building_footprints" && geometryContains(item.feature.geometry, point),
    );
    const unitsAtLocation = unitsByLocation.get(location.loc_guid) ?? [];
    const officialStreet = unitsAtLocation[0]
      ? [
          unitsAtLocation[0].official_street_name,
          unitsAtLocation[0].official_street_type,
          unitsAtLocation[0].official_street_direction,
        ].filter(Boolean).join(" ")
      : "";
    const civicNumbers = [...new Set(unitsAtLocation.map((unit) =>
      formatCivicNumber(unit.civic_number, unit.civic_number_suffix),
    ))];
    const nearbyWithinThreshold = nearbyEntries.filter(
      (item) => bboxDistanceM(point, item.bbox) <= thresholdM,
    );
    const compatibleNearby = nearbyWithinThreshold.filter((item) => {
      const candidate = candidateFor(item.feature, point, { civicNumbers, officialStreet });
      // An explicit street or civic-number contradiction is evidence that a
      // nearby footprint is the wrong property. Unknown metadata is allowed
      // because an OSM/municipal footprint may not carry address fields, but
      // a known contradiction must not be turned into a false NAR match.
      return candidate.street_compatibility !== "mismatch" &&
        candidate.civic_number_compatibility !== "mismatch";
    });
    const addressCompatible = compatibleNearby.filter((item) => {
      const candidate = candidateFor(item.feature, point, { civicNumbers, officialStreet });
      return candidate.street_compatibility === "match" &&
        candidate.civic_number_compatibility === "match";
    });
    // A known civic/street match is stronger evidence than a merely
    // containing polygon. In every other case containment and then distance
    // are used, but only inside the conservative threshold.
    let poolEntries = addressCompatible.length
      ? compatibleNearby
          .filter((item) => addressCompatible.some((match) => match.feature === item.feature))
      : containingGrey.length
        ? containingGrey.filter((item) => compatibleNearby.some((candidate) => candidate.feature === item.feature))
        : containingExisting.length
          ? containingExisting.filter((item) => compatibleNearby.some((candidate) => candidate.feature === item.feature))
          : compatibleNearby;
    // Do not reintroduce an incompatible footprint through a broader search.
    // If the conservative local candidates all contradict the official NAR
    // street or civic number, leave this LOC_GUID unresolved for review.
    // Never fall back to a city-wide nearest building. An unresolved NAR
    // location is safer than a false civic-address association.
    const placement = chooseCandidate(point, poolEntries.map((item) => item.feature), thresholdM, {
      civicNumbers,
      officialStreet,
      preferredStructureId: options.preferredStructureByLocation?.get(location.loc_guid),
    });
    placement.location_id = location.loc_guid;
    placement.coordinate_source = location.coordinate_source;
    placement.address_ids = unitsAtLocation.map((unit) => unit.address_id);
    return placement;
  });
  const structuresById = new Map(
    options.structures.map((feature) => [
      String(feature.properties.structure_id ?? feature.id ?? ""),
      feature,
    ]),
  );
  const locationById = new Map(options.locations.map((location) => [location.loc_guid, location]));
  // A coarse `nearest` status is retained for compatibility with existing
  // consumers, but the published confidence is now evidence-based. In
  // particular, a BF_REPPOINT can never satisfy the validated-nearest rule.
  for (const placement of placements) {
    if (!placement.structure_id) {
      placement.match_method = "unresolved";
      placement.confidence_classification = "unresolved";
      continue;
    }
    const location = locationById.get(placement.location_id);
    const structure = structuresById.get(placement.structure_id);
    if (!location) continue;
    const validation = validateNarPlacementEvidence({
      location,
      units: options.units ?? [],
      placement,
      structure,
      placements,
      structures: options.structures,
      roads: options.roads ?? [],
    });
    placement.validation = validation;
    placement.match_method = placement.status === "exact"
      ? "nar_contained_footprint"
      : "nar_nearest";
    placement.confidence_classification = placement.status === "exact"
      ? location.coordinate_source === "nar_building"
        ? "nar_contained_footprint"
        : "nar_nearest_no_known_conflict"
      : validation.street_match && validation.side_match && validation.parity_match &&
          validation.hundred_block_match && validation.neighbouring_sequence_match &&
          validation.unique_plausible_footprint && validation.conservative_distance_match
        ? "nar_validated_nearest"
        : "nar_nearest_no_known_conflict";
  }
  // The direct point/containment matcher intentionally leaves ambiguous
  // points unresolved. A second, constrained pass can resolve only those
  // cases where official street-side ordering supplies enough evidence. It
  // never searches for the nearest address city-wide and it never reuses a
  // structure already occupied by another LOC_GUID.
  const sequenceAssignments = matchUnresolvedNarLocations({
    locations: options.locations,
    units: options.units ?? [],
    structures: options.structures,
    roads: options.roads ?? [],
    placements,
  });
  for (const assignment of sequenceAssignments) {
    const placement = placements.find((candidate) => candidate.location_id === assignment.location_id);
    if (!placement) continue;
    const structure = structuresById.get(assignment.structure_id);
    if (!structure) continue;
    placement.structure_id = assignment.structure_id;
    placement.status = "nearest";
    placement.distance_m = assignment.distance_m;
    placement.footprint_id = String(structure.properties.external_id ?? structure.id ?? "");
    placement.footprint_source = sourceName(structure);
    placement.match_method = assignment.method;
    placement.confidence_classification = assignment.classification;
    placement.validation = assignment.evidence;
    placement.rejection_reason = undefined;
    if (!placement.candidates.some((candidate) => candidate.structure_id === assignment.structure_id))
      placement.candidates = [
        ...placement.candidates,
        {
          footprint_id: placement.footprint_id,
          structure_id: assignment.structure_id,
          source: placement.footprint_source,
          distance_m: assignment.distance_m ?? Infinity,
          centroid_distance_m: assignment.distance_m ?? Infinity,
          street_compatibility: "match" as const,
          civic_number_compatibility: "match" as const,
        },
      ].slice(0, 8);
  }
  const byStructure = new Map<string, FootprintPlacement[]>();
  for (const placement of placements) {
    if (!placement.structure_id) continue;
    const values = byStructure.get(placement.structure_id) ?? [];
    values.push(placement);
    byStructure.set(placement.structure_id, values);
  }
  const allByStructure = new Map(
    all.map((feature) => [structureId(feature, sourceName(feature)), feature]),
  );
  for (const [assignedStructureId, grouped] of byStructure) {
    if (compatibleMultipleLocations(allByStructure.get(assignedStructureId), grouped, unitsByLocation)) continue;
    const [keep, ...reject] = [...grouped].sort(
      (left, right) =>
        (right.status === "exact" ? 1 : 0) - (left.status === "exact" ? 1 : 0) ||
        (right.candidates[0]?.compatibility_score ?? 0) - (left.candidates[0]?.compatibility_score ?? 0) ||
        (left.distance_m ?? Infinity) - (right.distance_m ?? Infinity) ||
        left.location_id.localeCompare(right.location_id),
    );
    void keep;
    for (const placement of reject) {
      placement.structure_id = null;
      placement.footprint_id = null;
      placement.footprint_source = null;
      placement.status = "ambiguous";
      placement.match_method = "unresolved";
      placement.confidence_classification = "unresolved";
      placement.validation = undefined;
      placement.rejection_reason =
        "distinct LOC_GUIDs share one footprint without sufficient multi-entrance or apartment evidence";
    }
  }
  return { placements, greyFootprints: grey, existingFootprints: existing };
}

function cloneGreyStructure(feature: Feature, structureIdValue: string): Feature {
  return {
    type: "Feature",
    id: structureIdValue,
    properties: {
      structure_id: structureIdValue,
      external_source: "grey_county_building_footprints",
      external_id: greyFootprintId(feature),
      building_type: "unclassified",
      confidence: "source_mapped",
      geometry_provenance: "sourced",
      source_components: ["Grey County Building Footprints"],
      licence: "Grey County Open Data Licence",
      required_attribution: "Contains information licensed under the Grey County Open Data Licence.",
      grey_county_footprint_id: greyFootprintId(feature),
    },
    geometry: feature.geometry,
  };
}

export function applyAuthoritativePlacements(options: {
  structures: Feature[];
  units: AddressUnit[];
  placements: FootprintPlacement[];
  previousAuthoritativeStructureIds?: string[];
  greyFootprints?: Feature[];
}) {
  const structures = options.structures.map((feature) => ({
    ...feature,
    properties: { ...feature.properties },
  }));
  const byStructure = new Map(
    structures.map((feature) => [String(feature.properties.structure_id ?? feature.id), feature]),
  );
  const greyById = new Map((options.greyFootprints ?? []).map((feature) => [greyFootprintId(feature), feature]));
  const primaryLocationIds = new Set(
    options.units
      .filter((unit) => ["residential", "partly_residential"].includes(unit.building_use))
      .map((unit) => unit.location_id),
  );
  const structureForPlacement = new Map<string, FootprintPlacement>();
  for (const placement of options.placements) {
    if (!placement.structure_id) continue;
    structureForPlacement.set(placement.structure_id, placement);
    if (!byStructure.has(placement.structure_id) &&
        placement.footprint_source === "grey_county_building_footprints" &&
        primaryLocationIds.has(placement.location_id)) {
      const grey = greyById.get(placement.footprint_id ?? "");
      if (grey) {
        const created = cloneGreyStructure(grey, placement.structure_id);
        structures.push(created);
        byStructure.set(placement.structure_id, created);
      }
    }
  }
  const authoritativeIds = new Set(options.placements.map((placement) => placement.structure_id).filter(Boolean));
  for (const oldId of options.previousAuthoritativeStructureIds ?? []) {
    if (authoritativeIds.has(oldId)) continue;
    const feature = byStructure.get(oldId);
    if (!feature) continue;
    // Keep the last human address as provenance when a formerly authoritative
    // NAR association is no longer credible under the corrected BG point.
    // It is intentionally reclassified by repairCanvassingStructureAddresses
    // as an unverified legacy fallback; deleting it would create an anonymous
    // roof and erase useful physical-roof evidence.
    const oldLabel = String(feature.properties.civic_label ?? "").trim();
    const oldNumbers = Array.isArray(feature.properties.civic_numbers)
      ? feature.properties.civic_numbers.map(String).filter(Boolean)
      : [];
    if (oldLabel && !feature.properties.fallback_civic_number) {
      const leading = oldLabel.match(/^\s*(?:\d+[A-Z0-9/-]*\s*\/\s*)*(\d+[A-Z0-9/-]*)\s+(.+)$/i);
      const fallbackStreet = leading?.[2]?.trim() ?? oldLabel.replace(/^\S+\s+/, "");
      feature.properties.fallback_civic_number = oldNumbers[0] ?? leading?.[1] ?? "";
      feature.properties.fallback_street = fallbackStreet;
      feature.properties.fallback_unit = String(feature.properties.fallback_unit ?? "");
      feature.properties.legacy_address_fallback_source = "prior_nar_association";
    }
    delete feature.properties.civic_label;
    delete feature.properties.civic_numbers;
    delete feature.properties.address_count;
    delete feature.properties.authoritative_address_labels;
    delete feature.properties.address_label_source;
  }

  const unitsByLocation = new Map<string, AddressUnit[]>();
  for (const unit of options.units) {
    const list = unitsByLocation.get(unit.location_id) ?? [];
    list.push(unit);
    unitsByLocation.set(unit.location_id, list);
  }
  const primaryByStructure = new Map<string, AddressUnit[]>();
  for (const placement of options.placements) {
    if (!placement.structure_id) continue;
    const units = (unitsByLocation.get(placement.location_id) ?? []).filter((unit) =>
      ["residential", "partly_residential"].includes(unit.building_use),
    );
    if (!units.length) continue;
    primaryByStructure.set(placement.structure_id, [
      ...(primaryByStructure.get(placement.structure_id) ?? []),
      ...units,
    ]);
    const structure = byStructure.get(placement.structure_id);
    if (structure) {
      structure.properties.authoritative_location_ids = [
        ...new Set([
          ...(structure.properties.authoritative_location_ids ?? []),
          placement.location_id,
        ]),
      ];
      structure.properties.footprint_match_status = placement.status;
      structure.properties.footprint_match_distance_m = placement.distance_m;
      structure.properties.footprint_source = placement.footprint_source;
      structure.properties.footprint_review_required = ["ambiguous", "unmatched"].includes(placement.status);
    }
  }
  for (const [structureIdValue, units] of primaryByStructure) {
    const structure = byStructure.get(structureIdValue);
    if (!structure) continue;
    const baseLabels = [...new Set(units.map((unit) => formatOfficialBaseAddress({
      civicNumber: unit.civic_number,
      civicNumberSuffix: unit.civic_number_suffix,
      streetName: unit.official_street_name,
      streetType: unit.official_street_type,
      streetDirection: unit.official_street_direction,
    })) )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const civicNumbers = [...new Set(units.map((unit) => formatCivicNumber(unit.civic_number, unit.civic_number_suffix)))].sort(
      (a, b) => a.localeCompare(b, undefined, { numeric: true }),
    );
    structure.properties.address_count = units.length;
    structure.properties.civic_numbers = civicNumbers;
    structure.properties.civic_label = baseLabels.length <= 3
      ? baseLabels.join(" / ")
      : `${baseLabels[0]} +${baseLabels.length - 1}`;
    structure.properties.authoritative_address_labels = baseLabels;
    structure.properties.authoritative_address_ids = units.map((unit) => unit.address_id);
    structure.properties.address_label_source = "statistics_canada_national_address_register";
    structure.properties.address_source_status = "authoritative";
    structure.properties.residential_unit_count = units.length;
  }
  return { structures, placements: options.placements };
}

export function placementReviewFeatures(placements: FootprintPlacement[]) {
  return placements
    .filter((placement) => placement.status === "ambiguous" || placement.status === "unmatched")
    .map((placement) => ({
      type: "Feature" as const,
      properties: {
        location_id: placement.location_id,
        review_status: placement.status,
        footprint_distance_m: placement.distance_m,
        footprint_source: placement.footprint_source,
        candidates: placement.candidates,
      },
      geometry: { type: "Point" as const, coordinates: placement.point },
    }));
}

export function placementSummary(placements: FootprintPlacement[]) {
  const distances = placements
    .map((placement) => placement.distance_m)
    .filter((distance): distance is number => distance != null && Number.isFinite(distance))
    .sort((a, b) => a - b);
  const percentile = (value: number) =>
    distances.length ? distances[Math.min(distances.length - 1, Math.floor((distances.length - 1) * value))] : null;
  return {
    total_locations: placements.length,
    exact_matches: placements.filter((placement) => placement.status === "exact").length,
    nearest_matches: placements.filter((placement) => placement.status === "nearest").length,
    ambiguous_matches: placements.filter((placement) => placement.status === "ambiguous").length,
    unmatched_matches: placements.filter((placement) => placement.status === "unmatched").length,
    distance_m: {
      p50: percentile(0.5),
      p90: percentile(0.9),
      p95: percentile(0.95),
      p99: percentile(0.99),
      max: distances.at(-1) ?? null,
    },
    grey_exact_matches: placements.filter(
      (placement) => placement.status === "exact" && placement.footprint_source === "grey_county_building_footprints",
    ).length,
    grey_nearest_matches: placements.filter(
      (placement) => placement.status === "nearest" && placement.footprint_source === "grey_county_building_footprints",
    ).length,
    review_required: placements.filter((placement) => placement.status === "ambiguous" || placement.status === "unmatched").length,
  };
}
