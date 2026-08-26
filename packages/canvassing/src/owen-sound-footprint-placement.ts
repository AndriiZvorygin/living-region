import {
  centroid,
  distanceToGeometry,
  geometryContains,
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
};

type IndexedFeature = { feature: Feature; bbox: [number, number, number, number] };

const geometryIsPolygon = (feature: Feature) =>
  feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon";

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
  String(feature.properties.OBJECTID ?? feature.properties.objectid ?? feature.id ?? "unknown");

const isUsableExistingFootprint = (feature: Feature) => {
  const source = sourceName(feature);
  const type = String(feature.properties.building_type ?? "").toLowerCase();
  return source !== "living_region_estimate" && type !== "accessory";
};

function candidateFor(feature: Feature, point: Position): FootprintCandidate {
  const source = sourceName(feature);
  return {
    footprint_id:
      source === "grey_county_building_footprints"
        ? greyFootprintId(feature)
        : String(feature.properties.external_id ?? feature.id ?? feature.properties.structure_id),
    structure_id: structureId(feature, source),
    source,
    distance_m: distanceToGeometry(point, feature.geometry),
    centroid_distance_m: metresBetween(point, centroid(feature)),
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
  context: { civicNumbers: string[]; preferredStructureId?: string },
): FootprintPlacement {
  const addressMatches = (feature: Feature) => {
    const labels = [
      ...(feature.properties.civic_numbers ?? []),
      feature.properties.civic_label ?? "",
    ].map((value) => String(value));
    return context.civicNumbers.some((number) =>
      labels.some((label) => new RegExp(`(?:^|\\D)${number}(?:$|\\D)`).test(label)),
    );
  };
  const civicHintDistance = (feature: Feature) => {
    const hints = [
      ...(feature.properties.civic_numbers ?? []),
      feature.properties.inferred_civic_number,
      feature.properties.civic_label,
    ]
      .map((value) => Number(String(value ?? "").match(/\d+/)?.[0]))
      .filter((value) => Number.isFinite(value));
    const numbers = context.civicNumbers
      .map((value) => Number(String(value).match(/\d+/)?.[0]))
      .filter((value) => Number.isFinite(value));
    if (!hints.length || !numbers.length) return Infinity;
    return Math.min(...hints.flatMap((hint) => numbers.map((number) => Math.abs(hint - number))));
  };
  const ranked = candidates
    .map((feature) => ({ feature, candidate: candidateFor(feature, point) }))
    .sort((a, b) => {
      const preference = (item: { feature: Feature; candidate: FootprintCandidate }) =>
        item.candidate.structure_id === context.preferredStructureId
          ? 2
          : addressMatches(item.feature)
            ? 1
            : 0;
      const preferenceDifference = preference(b) - preference(a);
      const distanceDifference = a.candidate.distance_m - b.candidate.distance_m;
      const hintDifference = civicHintDistance(a.feature) - civicHintDistance(b.feature);
      return (preferenceDifference && Math.abs(distanceDifference) <= 10
        ? preferenceDifference
        : distanceDifference) ||
        (Math.abs(distanceDifference) <= FOOTPRINT_AMBIGUITY_TOLERANCE_M && hintDifference) ||
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
    };

  const sameSourceNearBest = ranked.filter(
    (item) =>
      item.candidate.source === best.candidate.source &&
      item.candidate.distance_m - best.candidate.distance_m <= FOOTPRINT_AMBIGUITY_TOLERANCE_M &&
      item.candidate.structure_id !== context.preferredStructureId &&
      !addressMatches(item.feature) &&
      civicHintDistance(item.feature) === civicHintDistance(best.feature) &&
      item.candidate.structure_id !== best.candidate.structure_id,
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
  };
}

export function placeNarLocations(options: {
  locations: NarLocation[];
  structures: Feature[];
  greyFootprints?: Feature[];
  units?: AddressUnit[];
  preferredStructureByLocation?: Map<string, string>;
  thresholdM?: number;
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
  const all = [...grey, ...existing];
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
    let poolEntries = containingGrey.length ? containingGrey : containingExisting.length ? containingExisting : nearbyEntries.filter((item) => bboxDistanceM(point, item.bbox) <= thresholdM + 25);
    if (!poolEntries.length) poolEntries = index.nearby(point, 12).filter((item) => bboxDistanceM(point, item.bbox) <= thresholdM + 25);
    if (!poolEntries.length) poolEntries = [...new Set([...grey, ...existing])].map((feature) => ({ feature, bbox: bboxFor(feature) }));
    const civicNumbers = [...new Set((unitsByLocation.get(location.loc_guid) ?? []).map((unit) => formatCivicNumber(unit.civic_number, unit.civic_number_suffix)))];
    const placement = chooseCandidate(point, poolEntries.map((item) => item.feature), thresholdM, {
      civicNumbers,
      preferredStructureId: options.preferredStructureByLocation?.get(location.loc_guid),
    });
    placement.location_id = location.loc_guid;
    return placement;
  });
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
  const structureForPlacement = new Map<string, FootprintPlacement>();
  for (const placement of options.placements) {
    if (!placement.structure_id) continue;
    structureForPlacement.set(placement.structure_id, placement);
    if (!byStructure.has(placement.structure_id) && placement.footprint_source === "grey_county_building_footprints") {
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
