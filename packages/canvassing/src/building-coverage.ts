import { createHash } from "node:crypto";

export type Position = [number, number];
export type Feature = {
  type: "Feature";
  id?: string | number;
  properties: Record<string, any>;
  geometry: { type: string; coordinates: any };
};

export type AddressInput = {
  address_id: string;
  civic_number: string;
  street: string;
  unit: string;
  point: Position;
  external_source?: string;
  external_id?: string;
  address_confidence?: string;
  address_range_road_id?: string | null;
  inferred_from?: string | null;
};
export type AddressNumberCalibration = {
  event_id: string;
  address_id: string;
  structure_id: string;
  civic_number: string;
  street: string;
  unit: string;
};

export type CoverageAssociation = {
  structure_id: string | null;
  association_status:
    | "exact"
    | "high_confidence"
    | "probable_sourced"
    | "inferred_range"
    | "estimated"
    | "unresolved";
  nearest_footprint_m: number | null;
  candidates: Array<{ structure_id: string; distance_m: number }>;
};

export const stableId = (kind: string, source: string) =>
  `${kind}_${createHash("sha256")
    .update(`${kind}:${source}`)
    .digest("hex")
    .slice(0, 20)}`;

export const walkCoordinates = (
  coordinates: any,
  visitor: (point: Position) => void,
) =>
  typeof coordinates?.[0] === "number"
    ? visitor(coordinates as Position)
    : coordinates?.forEach((item: any) => walkCoordinates(item, visitor));

export const polygonContains = (point: Position, ring: number[][]) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i],
      [xj, yj] = ring[j];
    if (
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi
    )
      inside = !inside;
  }
  return inside;
};

export const geometryContains = (
  geometry: Feature["geometry"],
  point: Position,
) => {
  const polygons =
    geometry.type === "Polygon"
      ? [geometry.coordinates]
      : geometry.type === "MultiPolygon"
        ? geometry.coordinates
        : [];
  return polygons.some(
    (polygon: number[][][]) =>
      polygonContains(point, polygon[0]) &&
      !polygon
        .slice(1)
        .some((hole: number[][]) => polygonContains(point, hole)),
  );
};

export const centroid = (feature: Feature): Position => {
  const points: Position[] = [];
  walkCoordinates(feature.geometry.coordinates, (point) => points.push(point));
  return [
    points.reduce((sum, point) => sum + point[0], 0) / points.length,
    points.reduce((sum, point) => sum + point[1], 0) / points.length,
  ];
};

export const metresBetween = (a: Position, b: Position) => {
  const latitude = (((a[1] + b[1]) / 2) * Math.PI) / 180;
  return Math.hypot(
    (a[0] - b[0]) * 111320 * Math.cos(latitude),
    (a[1] - b[1]) * 111320,
  );
};

const pointSegment = (point: Position, a: Position, b: Position) => {
  const latitude = (point[1] * Math.PI) / 180,
    scaleX = 111320 * Math.cos(latitude),
    scaleY = 111320,
    px = point[0] * scaleX,
    py = point[1] * scaleY,
    ax = a[0] * scaleX,
    ay = a[1] * scaleY,
    bx = b[0] * scaleX,
    by = b[1] * scaleY,
    dx = bx - ax,
    dy = by - ay,
    lengthSquared = Math.max(1e-9, dx * dx + dy * dy),
    t = Math.max(
      0,
      Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared),
    ),
    projected: Position = [(ax + t * dx) / scaleX, (ay + t * dy) / scaleY];
  return {
    distance_m: Math.hypot(px - (ax + t * dx), py - (ay + t * dy)),
    projected,
    tangent: [
      dx / Math.sqrt(lengthSquared),
      dy / Math.sqrt(lengthSquared),
    ] as Position,
    side: Math.sign(dx * (py - ay) - dy * (px - ax)) || 0,
    t,
    length_m: Math.sqrt(lengthSquared),
  };
};

export const distanceToGeometry = (
  point: Position,
  geometry: Feature["geometry"],
) => {
  if (geometryContains(geometry, point)) return 0;
  let best = Infinity;
  const inspectRing = (ring: Position[]) => {
    for (let index = 1; index < ring.length; index++)
      best = Math.min(
        best,
        pointSegment(point, ring[index - 1], ring[index]).distance_m,
      );
  };
  if (geometry.type === "Polygon") geometry.coordinates.forEach(inspectRing);
  else if (geometry.type === "MultiPolygon")
    geometry.coordinates.forEach((polygon: Position[][]) =>
      polygon.forEach(inspectRing),
    );
  else
    walkCoordinates(geometry.coordinates, (candidate) => {
      best = Math.min(best, metresBetween(point, candidate));
    });
  return best;
};

const featureArea = (feature: Feature) => {
  const supplied = Number(
    feature.properties.area_m2 ?? feature.properties.Area,
  );
  if (Number.isFinite(supplied) && supplied > 0) return supplied;
  const center = centroid(feature),
    latitude = (center[1] * Math.PI) / 180,
    scaleX = 111320 * Math.cos(latitude),
    scaleY = 111320;
  const ring =
    feature.geometry.type === "Polygon"
      ? feature.geometry.coordinates[0]
      : feature.geometry.coordinates[0]?.[0];
  if (!ring?.length) return 0;
  let area = 0;
  for (let index = 0; index < ring.length - 1; index++)
    area +=
      ring[index][0] * scaleX * (ring[index + 1][1] * scaleY) -
      ring[index + 1][0] * scaleX * (ring[index][1] * scaleY);
  return Math.abs(area) / 2;
};

export const normalizeStreet = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    // Address sources alternate between ordinal street names ("7th") and
    // numeric names ("7"). Treat the ordinal suffix as presentation, not as
    // a different street, so official NAR components can be compared with
    // footprint labels and road names safely.
    .replace(/\b(\d+)(?:st|nd|rd|th)\b/g, "$1")
    .replace(/\bstreet\b/g, "st")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\broad\b/g, "rd")
    .replace(/\bhighway\b/g, "hwy")
    .replace(/\bwest\b/g, "w")
    .replace(/\beast\b/g, "e")
    .replace(/\bnorth\b/g, "n")
    .replace(/\bsouth\b/g, "s")
    .replace(/[^a-z0-9]/g, "");

type RoadProjection = {
  road: Feature;
  distance_m: number;
  projected: Position;
  tangent: Position;
  side: number;
  fraction: number;
  along_m: number;
  length_m: number;
};

const roadLines = (road: Feature): Position[][] =>
  road.geometry.type === "MultiLineString"
    ? road.geometry.coordinates
    : road.geometry.type === "LineString"
      ? [road.geometry.coordinates]
      : [];

const nonVehicleHighways = new Set([
  "bridleway",
  "cycleway",
  "footway",
  "path",
  "pedestrian",
  "platform",
  "steps",
]);

const placementRoads = (roads: Feature[]) => {
  const officialNames = new Set(
    roads
      .filter(
        (road) => road.properties.source === "Grey County road centrelines",
      )
      .map((road) => normalizeStreet(road.properties.name))
      .filter(Boolean),
  );
  return roads.filter((road) => {
    const highway = String(road.properties.highway ?? "").toLowerCase();
    if (highway && nonVehicleHighways.has(highway)) return false;
    // OSM and municipal data can carry two centre-lines for the same street.
    // Prefer the official centre-line for roof clearance so a harmless offset
    // between the sources cannot make an otherwise valid frontage impossible.
    return !(
      highway &&
      normalizeStreet(road.properties.name) &&
      officialNames.has(normalizeStreet(road.properties.name))
    );
  });
};

const projectToRoad = (
  point: Position,
  road: Feature,
): RoadProjection | undefined => {
  let totalLength = 0;
  const segments: Array<{
    a: Position;
    b: Position;
    start_m: number;
    length_m: number;
  }> = [];
  for (const line of roadLines(road))
    for (let index = 1; index < line.length; index++) {
      const length_m = metresBetween(line[index - 1], line[index]);
      segments.push({
        a: line[index - 1],
        b: line[index],
        start_m: totalLength,
        length_m,
      });
      totalLength += length_m;
    }
  let best: (ReturnType<typeof pointSegment> & { along_m: number }) | undefined;
  for (const segment of segments) {
    const result = pointSegment(point, segment.a, segment.b),
      along_m = segment.start_m + result.t * segment.length_m;
    if (!best || result.distance_m < best.distance_m)
      best = { ...result, along_m };
  }
  return best
    ? {
        road,
        distance_m: best.distance_m,
        projected: best.projected,
        tangent: best.tangent,
        side: best.side,
        fraction: totalLength ? best.along_m / totalLength : 0,
        along_m: best.along_m,
        length_m: totalLength,
      }
    : undefined;
};

const pointAlongRoad = (road: Feature, fraction: number) => {
  const lines = roadLines(road),
    lengths = lines.flatMap((line) =>
      line.slice(1).map((point, index) => metresBetween(line[index], point)),
    ),
    total = lengths.reduce((sum, length) => sum + length, 0);
  let remaining = Math.max(0, Math.min(1, fraction)) * total,
    segmentIndex = 0;
  for (const line of lines)
    for (let index = 1; index < line.length; index++) {
      const length = lengths[segmentIndex++];
      if (remaining <= length || segmentIndex === lengths.length) {
        const t = length ? Math.max(0, Math.min(1, remaining / length)) : 0,
          a = line[index - 1],
          b = line[index],
          latitude = (((a[1] + b[1]) / 2) * Math.PI) / 180,
          dx = (b[0] - a[0]) * 111320 * Math.cos(latitude),
          dy = (b[1] - a[1]) * 111320,
          magnitude = Math.max(1e-9, Math.hypot(dx, dy));
        return {
          point: [
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t,
          ] as Position,
          tangent: [dx / magnitude, dy / magnitude] as Position,
        };
      }
      remaining -= length;
    }
  return undefined;
};

const roadRange = (road: Feature, side: number) => {
  const properties = road.properties,
    left = side > 0,
    from = Number(left ? properties.left_from : properties.right_from),
    to = Number(left ? properties.left_to : properties.right_to),
    parity = String(left ? properties.left_parity : properties.right_parity)
      .toUpperCase()
      .slice(0, 1);
  return Number.isFinite(from) && Number.isFinite(to) && (from || to)
    ? { from, to, parity }
    : undefined;
};

const rangeContains = (range: ReturnType<typeof roadRange>, civic: number) =>
  Boolean(
    range &&
    civic >= Math.min(range.from, range.to) &&
    civic <= Math.max(range.from, range.to),
  );

const gridKey = (point: Position, cellDegrees = 0.0005) =>
  `${Math.floor(point[0] / cellDegrees)}:${Math.floor(point[1] / cellDegrees)}`;

const nearbyGridKeys = (point: Position, radius = 2, cellDegrees = 0.0005) => {
  const x = Math.floor(point[0] / cellDegrees),
    y = Math.floor(point[1] / cellDegrees),
    keys: string[] = [];
  for (let dx = -radius; dx <= radius; dx++)
    for (let dy = -radius; dy <= radius; dy++) keys.push(`${x + dx}:${y + dy}`);
  return keys;
};

const addToGrid = <T>(grid: Map<string, T[]>, point: Position, value: T) => {
  const key = gridKey(point);
  grid.set(key, [...(grid.get(key) ?? []), value]);
};

const nearbyGridValues = <T>(
  grid: Map<string, T[]>,
  point: Position,
  radius = 2,
) => [
  ...new Set(
    nearbyGridKeys(point, radius).flatMap((key) => grid.get(key) ?? []),
  ),
];

const roadGrid = (roads: Feature[]) => {
  const grid = new Map<string, Feature[]>();
  for (const road of placementRoads(roads))
    for (const line of roadLines(road))
      for (let index = 1; index < line.length; index++) {
        const a = line[index - 1],
          b = line[index],
          distance = metresBetween(a, b),
          samples = Math.max(1, Math.ceil(distance / 35));
        for (let sample = 0; sample <= samples; sample++)
          addToGrid(
            grid,
            [
              a[0] + ((b[0] - a[0]) * sample) / samples,
              a[1] + ((b[1] - a[1]) * sample) / samples,
            ],
            road,
          );
      }
  return grid;
};

export function mergeBuildingSources(
  osmBuildings: Feature[],
  canadaFeatures: Feature[],
  boundaryRing: number[][],
) {
  const osmByNumericId = new Map(
      osmBuildings.map((feature) => [
        String(feature.properties.external_id ?? "").replace(/^[a-z]/, ""),
        feature,
      ]),
    ),
    osmGrid = new Map<string, Feature[]>();
  for (const feature of osmBuildings) {
    const key = gridKey(centroid(feature));
    osmGrid.set(key, [...(osmGrid.get(key) ?? []), feature]);
  }
  const additions: Feature[] = [];
  let outsideBoundary = 0,
    deduplicated = 0;
  for (const source of canadaFeatures) {
    const center = centroid(source);
    if (!polygonContains(center, boundaryRing)) {
      outsideBoundary++;
      continue;
    }
    const sourceOsmId = String(source.properties.OSM_ID ?? ""),
      nearby = nearbyGridKeys(center)
        .flatMap((key) => osmGrid.get(key) ?? [])
        .filter(
          (osm) =>
            metresBetween(center, centroid(osm)) <= 70 ||
            geometryContains(osm.geometry, center) ||
            geometryContains(source.geometry, centroid(osm)),
        ),
      duplicate =
        (sourceOsmId && osmByNumericId.get(sourceOsmId)) ||
        nearby.find(
          (osm) =>
            geometryContains(osm.geometry, center) ||
            geometryContains(source.geometry, centroid(osm)) ||
            (metresBetween(center, centroid(osm)) <= 5 &&
              distanceToGeometry(center, osm.geometry) <= 3),
        );
    if (duplicate) {
      deduplicated++;
      continue;
    }
    const sourceComponents = ["OSM", "ODB", "MSB"].filter(
        (name) => source.properties[name],
      ),
      id = stableId(
        "structure",
        `canada-structures:${source.properties.CS_ID}`,
      ),
      type = String(
        source.properties.OSM_Type ?? source.properties.LC_Name ?? "",
      ).toLowerCase();
    additions.push({
      type: "Feature",
      id,
      properties: {
        structure_id: id,
        external_source: "canada_structures",
        external_id: String(source.properties.CS_ID),
        building_type: /apartment/.test(type)
          ? "apartment"
          : /commercial|retail|office|industrial/.test(type)
            ? "commercial"
            : /school|hospital|church|civic|public/.test(type)
              ? "institutional"
              : "unclassified",
        confidence: "source_integrated",
        geometry_provenance: "sourced",
        source_components: sourceComponents,
        source_osm_id: source.properties.OSM_ID ?? null,
        source_odb_id: source.properties.ODB_ID ?? null,
        area_m2: Number(source.properties.Area) || null,
        height_m: Number(source.properties.Height) || null,
        licence: "Open Government Licence - Canada",
      },
      geometry: source.geometry,
    });
  }
  return {
    buildings: [...osmBuildings, ...additions],
    additions,
    audit: {
      canada_bbox_candidates: canadaFeatures.length,
      canada_outside_boundary: outsideBoundary,
      deduplicated_polygons: deduplicated,
      additional_sourced_footprints: additions.length,
    },
  };
}

export function mergeCityMapBuildingSource(
  existingBuildings: Feature[],
  cityMapFeatures: Feature[],
  boundaryRing: number[][],
) {
  const existingGrid = new Map<string, Feature[]>();
  for (const feature of existingBuildings)
    addToGrid(existingGrid, centroid(feature), feature);

  const additions: Feature[] = [];
  let outsideBoundary = 0,
    deduplicated = 0;
  for (const source of cityMapFeatures) {
    const center = centroid(source);
    if (!polygonContains(center, boundaryRing)) {
      outsideBoundary++;
      continue;
    }
    const duplicate = nearbyGridValues(existingGrid, center, 2).find(
      (existing) =>
        geometryContains(existing.geometry, center) ||
        geometryContains(source.geometry, centroid(existing)) ||
        (metresBetween(center, centroid(existing)) <= 5 &&
          distanceToGeometry(center, existing.geometry) <= 3),
    );
    if (duplicate) {
      deduplicated++;
      continue;
    }
    const externalId = String(
        source.properties.CITY_MAP_ID ?? source.id ?? "unknown",
      ),
      id = stableId("structure", `owen-sound-city-map:${externalId}`);
    const addition: Feature = {
      type: "Feature",
      id,
      properties: {
        structure_id: id,
        external_source: "owen_sound_city_map_pdf",
        external_id: externalId,
        building_type: source.properties.subdivision_method
          ? "townhouse_unit_estimated"
          : "unclassified",
        confidence: source.properties.confidence ?? "official_map_extracted",
        geometry_provenance: "sourced",
        source_components: ["City of Owen Sound city map"],
        source_layer: source.properties.source_layer,
        source_pdf_sha256: source.properties.source_pdf_sha256,
        source_map_date: source.properties.source_map_date,
        source_parent_geometry_id:
          source.properties.source_parent_geometry_id ?? null,
        subdivision_method: source.properties.subdivision_method ?? null,
        townhouse_unit_index: source.properties.townhouse_unit_index ?? null,
        townhouse_unit_count: source.properties.townhouse_unit_count ?? null,
        area_m2: Number(source.properties.area_m2) || null,
        licence:
          "Not stated in supplied PDF; private reference use pending confirmation",
        private_reference_only: true,
      },
      geometry: source.geometry,
    };
    additions.push(addition);
    addToGrid(existingGrid, center, addition);
  }
  return {
    buildings: [...existingBuildings, ...additions],
    additions,
    audit: {
      city_map_candidates: cityMapFeatures.length,
      city_map_outside_boundary: outsideBoundary,
      city_map_deduplicated_polygons: deduplicated,
      city_map_additional_footprints: additions.length,
    },
  };
}

const nearestRoadSegment = (
  point: Position,
  street: string,
  roads: Feature[],
) => {
  const usableRoads = placementRoads(roads),
    normalizedStreet = normalizeStreet(street),
    named = usableRoads.filter(
      (road) => normalizeStreet(road.properties.name) === normalizedStreet,
    ),
    candidates = named.length ? named : usableRoads;
  let best: (ReturnType<typeof pointSegment> & { road: Feature }) | undefined;
  for (const road of candidates) {
    const lines =
      road.geometry.type === "MultiLineString"
        ? road.geometry.coordinates
        : road.geometry.type === "LineString"
          ? [road.geometry.coordinates]
          : [];
    for (const line of lines)
      for (let index = 1; index < line.length; index++) {
        const result = pointSegment(point, line[index - 1], line[index]);
        if (!best || result.distance_m < best.distance_m)
          best = { ...result, road };
      }
  }
  return best;
};

type InferredCandidate = {
  building: Feature;
  projection: RoadProjection;
  side: number;
  range: NonNullable<ReturnType<typeof roadRange>>;
  expandedSmallFrontage: boolean;
};

export function inferAddressesFromRoadRanges(
  addresses: AddressInput[],
  sourcedBuildings: Feature[],
  associations: Map<string, CoverageAssociation>,
  roads: Feature[],
  reservedAddresses: Array<Pick<AddressInput, "civic_number" | "street">> = [],
) {
  const occupiedStructures = new Set(
      [...associations.values()]
        .map((association) => association.structure_id)
        .filter((id): id is string => Boolean(id)),
    ),
    usedNumbers = new Set(
      [...addresses, ...reservedAddresses].map(
        (address) =>
          `${normalizeStreet(address.street)}|${address.civic_number}`,
      ),
    ),
    buildingGrid = new Map<string, Feature[]>(),
    candidates: InferredCandidate[] = [],
    rejected = {
      unsuitable_building: 0,
      rear_or_accessory: 0,
      no_address_range: 0,
      ambiguous_corner: 0,
      duplicate_frontage: 0,
      exhausted_range: 0,
    };
  for (const building of sourcedBuildings)
    addToGrid(buildingGrid, centroid(building), building);
  for (const building of sourcedBuildings) {
    if (occupiedStructures.has(String(building.properties.structure_id)))
      continue;
    const area = featureArea(building),
      sourceType = String(
        building.properties.source_building_tag ??
          building.properties.building_type ??
          "",
      ).toLowerCase(),
      explicitResidential =
        building.properties.building_type === "residential" ||
        /house|residential|apartments|semidetached|terrace/.test(sourceType);
    if (
      /garage|shed|carport|roof|barn|industrial|commercial|retail|school|hospital|church/.test(
        sourceType,
      ) ||
      area < 35 ||
      area > 650
    ) {
      rejected.unsuitable_building++;
      continue;
    }
    const center = centroid(building),
      expandedSmallFrontage = !explicitResidential && area < 60,
      projections = roads
        .map((road) => projectToRoad(center, road))
        .filter((projection): projection is RoadProjection => {
          if (!projection || projection.distance_m > 70) return false;
          return Boolean(roadRange(projection.road, projection.side));
        })
        .sort((left, right) => left.distance_m - right.distance_m);
    const occupiesFrontage = (projection: RoadProjection) =>
      !nearbyGridValues(buildingGrid, center, 1).some((other) => {
        if (other === building || featureArea(other) < 35) return false;
        const otherProjection = projectToRoad(centroid(other), projection.road);
        return Boolean(
          otherProjection &&
          otherProjection.side === projection.side &&
          Math.abs(otherProjection.along_m - projection.along_m) <= 16 &&
          otherProjection.distance_m + 4 < projection.distance_m,
        );
      });
    const requiresFrontage =
        expandedSmallFrontage ||
        (!explicitResidential && (projections[0]?.distance_m ?? 0) > 52),
      best = requiresFrontage
        ? projections.find(occupiesFrontage)
        : projections[0];
    const second = projections.find(
      (projection) =>
        normalizeStreet(projection.road.properties.name) !==
        normalizeStreet(best?.road.properties.name),
    );
    if (!best) {
      if (requiresFrontage && projections.length) {
        rejected.unsuitable_building++;
        rejected.rear_or_accessory++;
      } else rejected.no_address_range++;
      continue;
    }
    if (
      second &&
      second.distance_m <= 34 &&
      second.distance_m - best.distance_m < 3
    ) {
      rejected.ambiguous_corner++;
      continue;
    }
    const range = roadRange(best.road, best.side);
    if (!range) {
      rejected.no_address_range++;
      continue;
    }
    candidates.push({
      building,
      projection: best,
      side: best.side,
      range,
      expandedSmallFrontage,
    });
  }

  const groups = new Map<string, InferredCandidate[]>();
  for (const candidate of candidates) {
    const key = `${candidate.projection.road.properties.road_id}|${
      candidate.side > 0 ? "left" : "right"
    }`;
    groups.set(key, [...(groups.get(key) ?? []), candidate]);
  }

  const inferred: AddressInput[] = [];
  for (const group of groups.values()) {
    group.sort(
      (left, right) => left.projection.fraction - right.projection.fraction,
    );
    const road = group[0].projection.road,
      range = group[0].range,
      step = range.to >= range.from ? 2 : -2,
      allNumbers: number[] = [];
    for (
      let number = range.from;
      step > 0 ? number <= range.to : number >= range.to;
      number += step
    )
      if (
        !usedNumbers.has(`${normalizeStreet(road.properties.name)}|${number}`)
      )
        allNumbers.push(number);
    let previousIndex = -1;
    for (let index = 0; index < group.length; index++) {
      const candidate = group[index],
        remaining = group.length - index - 1,
        minimumIndex = previousIndex + 1,
        maximumIndex = allNumbers.length - remaining - 1;
      if (minimumIndex > maximumIndex) {
        rejected.exhausted_range++;
        continue;
      }
      const preferred = Math.round(
          candidate.projection.fraction * Math.max(0, allNumbers.length - 1),
        ),
        numberIndex = Math.max(minimumIndex, Math.min(maximumIndex, preferred)),
        civic = allNumbers[numberIndex],
        structureId = String(candidate.building.properties.structure_id),
        addressId = stableId("address", `inferred-range:${structureId}`),
        street = String(road.properties.name),
        input: AddressInput = {
          address_id: addressId,
          civic_number: String(civic),
          street,
          unit: "",
          point: centroid(candidate.building),
          external_source: "grey_county_address_range",
          external_id: String(road.properties.road_id),
          address_confidence: "inferred_range",
          address_range_road_id: String(road.properties.road_id),
          inferred_from: candidate.expandedSmallFrontage
            ? "official_segment_range_and_small_frontage_roof_order"
            : "official_segment_range_and_sourced_roof_order",
        };
      inferred.push(input);
      associations.set(addressId, {
        structure_id: structureId,
        association_status: "inferred_range",
        nearest_footprint_m: 0,
        candidates: [{ structure_id: structureId, distance_m: 0 }],
      });
      candidate.building.properties.inferred_civic_number = civic;
      candidate.building.properties.address_range_road_id =
        road.properties.road_id;
      candidate.building.properties.address_range_side =
        candidate.side > 0 ? "left" : "right";
      candidate.building.properties.address_inference_confidence =
        "inferred_range";
      candidate.building.properties.small_frontage_inference =
        candidate.expandedSmallFrontage;
      usedNumbers.add(`${normalizeStreet(street)}|${civic}`);
      previousIndex = numberIndex;
    }
  }
  return { inferred, audit: { candidates: candidates.length, ...rejected } };
}

const median = (values: number[], fallback: number) => {
  if (!values.length) return fallback;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const estimatedRectangle = (
  center: Position,
  tangent: Position,
  widthM: number,
  depthM: number,
) => {
  const latitude = (center[1] * Math.PI) / 180,
    scaleX = 111320 * Math.cos(latitude),
    scaleY = 111320,
    normal: Position = [-tangent[1], tangent[0]],
    corners: Position[] = [
      [-widthM / 2, -depthM / 2],
      [widthM / 2, -depthM / 2],
      [widthM / 2, depthM / 2],
      [-widthM / 2, depthM / 2],
      [-widthM / 2, -depthM / 2],
    ].map(([along, across]) => [
      center[0] + (tangent[0] * along + normal[0] * across) / scaleX,
      center[1] + (tangent[1] * along + normal[1] * across) / scaleY,
    ]);
  return { type: "Polygon", coordinates: [corners] };
};

const orientation = (a: Position, b: Position, c: Position) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

const segmentsIntersect = (
  a: Position,
  b: Position,
  c: Position,
  d: Position,
) => {
  const abC = orientation(a, b, c),
    abD = orientation(a, b, d),
    cdA = orientation(c, d, a),
    cdB = orientation(c, d, b),
    epsilon = 1e-12,
    within = (value: number, left: number, right: number) =>
      value >= Math.min(left, right) - epsilon &&
      value <= Math.max(left, right) + epsilon,
    onSegment = (left: Position, right: Position, point: Position) =>
      Math.abs(orientation(left, right, point)) <= epsilon &&
      within(point[0], left[0], right[0]) &&
      within(point[1], left[1], right[1]);
  return (
    (((abC > 0 && abD < 0) || (abC < 0 && abD > 0)) &&
      ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0))) ||
    onSegment(a, b, c) ||
    onSegment(a, b, d) ||
    onSegment(c, d, a) ||
    onSegment(c, d, b)
  );
};

const polygonRings = (geometry: Feature["geometry"]): Position[][] =>
  geometry.type === "Polygon"
    ? geometry.coordinates
    : geometry.type === "MultiPolygon"
      ? geometry.coordinates.flat()
      : [];

const geometriesIntersect = (
  left: Feature["geometry"],
  right: Feature["geometry"],
) => {
  const leftRings = polygonRings(left),
    rightRings = polygonRings(right);
  for (const a of leftRings)
    for (const b of rightRings) {
      for (let ai = 1; ai < a.length; ai++)
        for (let bi = 1; bi < b.length; bi++)
          if (segmentsIntersect(a[ai - 1], a[ai], b[bi - 1], b[bi]))
            return true;
      if (a[0] && polygonContains(a[0], b)) return true;
      if (b[0] && polygonContains(b[0], a)) return true;
    }
  return false;
};

const segmentDistanceM = (
  a: Position,
  b: Position,
  c: Position,
  d: Position,
) =>
  segmentsIntersect(a, b, c, d)
    ? 0
    : Math.min(
        pointSegment(a, c, d).distance_m,
        pointSegment(b, c, d).distance_m,
        pointSegment(c, a, b).distance_m,
        pointSegment(d, a, b).distance_m,
      );

const geometryRoadDistance = (
  geometry: Feature["geometry"],
  roads: Feature[],
) => {
  let best = Infinity;
  for (const ring of polygonRings(geometry))
    for (let index = 1; index < ring.length; index++)
      for (const road of roads)
        for (const line of roadLines(road))
          for (let roadIndex = 1; roadIndex < line.length; roadIndex++)
            best = Math.min(
              best,
              segmentDistanceM(
                ring[index - 1],
                ring[index],
                line[roadIndex - 1],
                line[roadIndex],
              ),
            );
  return best;
};

const rangePlacement = (address: AddressInput, roads: Feature[]) => {
  const civic = Number.parseInt(address.civic_number, 10);
  if (!Number.isFinite(civic)) return undefined;
  const candidates = roads
    .filter(
      (road) =>
        normalizeStreet(road.properties.name) ===
        normalizeStreet(address.street),
    )
    .flatMap((road) =>
      [1, -1].flatMap((side) => {
        const range = roadRange(road, side);
        if (!rangeContains(range, civic)) return [];
        const span = range!.to - range!.from,
          fraction = span ? (civic - range!.from) / span : 0.5,
          location = pointAlongRoad(road, fraction);
        return location
          ? [
              {
                road,
                side,
                range: range!,
                fraction,
                ...location,
                source_distance_m: metresBetween(address.point, location.point),
              },
            ]
          : [];
      }),
    )
    .sort((left, right) => left.source_distance_m - right.source_distance_m);
  return candidates[0];
};

export function findGeneratedGeometryConflicts(
  estimated: Feature[],
  sourced: Feature[],
  roads: Feature[],
  minimumRoadClearanceM = 3.5,
) {
  const conflicts: Array<{
      structure_id: string;
      conflict_type: string;
      other_id: string | null;
      distance_m: number | null;
    }> = [],
    sourcedGrid = new Map<string, Feature[]>(),
    estimatedGrid = new Map<string, Feature[]>(),
    nearbyRoadGrid = roadGrid(roads);
  for (const feature of sourced)
    addToGrid(sourcedGrid, centroid(feature), feature);
  for (let index = 0; index < estimated.length; index++) {
    const feature = estimated[index],
      structureId = String(feature.properties.structure_id),
      center = centroid(feature),
      roadDistance = geometryRoadDistance(
        feature.geometry,
        nearbyGridValues(nearbyRoadGrid, center, 1),
      );
    if (roadDistance < minimumRoadClearanceM)
      conflicts.push({
        structure_id: structureId,
        conflict_type: "road_clearance",
        other_id: null,
        distance_m: +roadDistance.toFixed(1),
      });
    // Large institutional footprints can overlap a generated roof while
    // their centroid sits more than one grid cell away.
    for (const obstacle of nearbyGridValues(sourcedGrid, center, 2))
      if (geometriesIntersect(feature.geometry, obstacle.geometry))
        conflicts.push({
          structure_id: structureId,
          conflict_type: "sourced_roof_overlap",
          other_id: String(obstacle.properties.structure_id),
          distance_m: 0,
        });
    for (const obstacle of nearbyGridValues(estimatedGrid, center, 2))
      if (geometriesIntersect(feature.geometry, obstacle.geometry))
        conflicts.push({
          structure_id: structureId,
          conflict_type: "estimated_roof_overlap",
          other_id: String(obstacle.properties.structure_id),
          distance_m: 0,
        });
    addToGrid(estimatedGrid, center, feature);
  }
  return conflicts;
}

export function associateAddressesWithBuildings(
  addresses: AddressInput[],
  sourcedBuildings: Feature[],
  roads: Feature[],
  options: {
    highConfidenceM?: number;
    probableM?: number;
    addressRangeRoads?: Feature[];
    minimumRoadClearanceM?: number;
    reservedAddresses?: Array<Pick<AddressInput, "civic_number" | "street">>;
  } = {},
) {
  const highConfidenceM = options.highConfidenceM ?? 12,
    probableM = options.probableM ?? 28,
    buildingGrid = new Map<string, Feature[]>(),
    associations = new Map<string, CoverageAssociation>(),
    addressBase = (address: AddressInput) =>
      `${address.civic_number}|${address.street}`.toLowerCase(),
    assignedBases = new Map<string, Set<string>>();
  for (const building of sourcedBuildings) {
    const key = gridKey(centroid(building));
    buildingGrid.set(key, [...(buildingGrid.get(key) ?? []), building]);
  }
  const candidatesFor = (point: Position) =>
    [
      ...new Map(
        nearbyGridKeys(point, 3)
          .flatMap((key) => buildingGrid.get(key) ?? [])
          .map((feature) => [feature.properties.structure_id, feature]),
      ).values(),
    ]
      .map((building) => ({
        building,
        distance_m: distanceToGeometry(point, building.geometry),
      }))
      .sort((left, right) => left.distance_m - right.distance_m);

  const pending: AddressInput[] = [];
  for (const address of addresses) {
    const candidates = candidatesFor(address.point),
      containing = candidates.filter((candidate) => candidate.distance_m === 0),
      chosen =
        containing.length === 1
          ? containing[0]
          : containing.length > 1
            ? [...containing].sort(
                (left, right) =>
                  featureArea(left.building) - featureArea(right.building),
              )[0]
            : undefined;
    if (!chosen) {
      pending.push(address);
      associations.set(address.address_id, {
        structure_id: null,
        association_status: "unresolved",
        nearest_footprint_m: Number.isFinite(candidates[0]?.distance_m)
          ? +candidates[0].distance_m.toFixed(1)
          : null,
        candidates: candidates.slice(0, 3).map((candidate) => ({
          structure_id: candidate.building.properties.structure_id,
          distance_m: +candidate.distance_m.toFixed(1),
        })),
      });
      continue;
    }
    const structureId = String(chosen.building.properties.structure_id);
    associations.set(address.address_id, {
      structure_id: structureId,
      association_status: "exact",
      nearest_footprint_m: 0,
      candidates: [{ structure_id: structureId, distance_m: 0 }],
    });
    assignedBases.set(
      structureId,
      new Set([
        ...(assignedBases.get(structureId) ?? []),
        addressBase(address),
      ]),
    );
  }

  const remaining: AddressInput[] = [];
  for (const address of pending) {
    const candidates = candidatesFor(address.point),
      base = addressBase(address),
      plausible = candidates.find((candidate) => {
        if (candidate.distance_m > probableM) return false;
        const id = String(candidate.building.properties.structure_id),
          occupied = assignedBases.get(id);
        if (!occupied?.size || occupied.has(base)) return true;
        return (
          candidate.building.properties.building_type === "apartment" ||
          (featureArea(candidate.building) >= 325 &&
            candidate.distance_m <= highConfidenceM)
        );
      });
    if (!plausible) {
      remaining.push(address);
      continue;
    }
    const structureId = String(plausible.building.properties.structure_id),
      status =
        plausible.distance_m <= highConfidenceM
          ? "high_confidence"
          : "probable_sourced";
    associations.set(address.address_id, {
      structure_id: structureId,
      association_status: status,
      nearest_footprint_m: +plausible.distance_m.toFixed(1),
      candidates: candidates.slice(0, 3).map((candidate) => ({
        structure_id: candidate.building.properties.structure_id,
        distance_m: +candidate.distance_m.toFixed(1),
      })),
    });
    assignedBases.set(
      structureId,
      new Set([...(assignedBases.get(structureId) ?? []), base]),
    );
  }

  const inferredResult = inferAddressesFromRoadRanges(
      addresses,
      sourcedBuildings,
      associations,
      options.addressRangeRoads ?? [],
      options.reservedAddresses ?? [],
    ),
    estimated: Feature[] = [],
    obstacleGrid = new Map<string, Feature[]>(),
    nearbyRoadGrid = roadGrid(roads),
    placementReview: Array<{
      address_ids: string[];
      label: string;
      reason: string;
    }> = [],
    grouped = new Map<string, AddressInput[][]>();
  for (const building of sourcedBuildings)
    addToGrid(obstacleGrid, centroid(building), building);
  for (const address of remaining) {
    const key = addressBase(address);
    const groups = grouped.get(key) ?? [],
      nearbyGroup = groups.find((group) =>
        group.some(
          (candidate) => metresBetween(candidate.point, address.point) <= 35,
        ),
      );
    if (nearbyGroup) nearbyGroup.push(address);
    else groups.push([address]);
    grouped.set(key, groups);
  }
  for (const [base, groups] of grouped) {
    // Keep same-address units together when they are co-located, but do not
    // collapse duplicate source records hundreds of metres apart into one
    // household roof. Sorting makes the split deterministic across refreshes.
    groups.sort((left, right) =>
      left
        .map((address) => address.address_id)
        .sort()
        .join("|")
        .localeCompare(
          right
            .map((address) => address.address_id)
            .sort()
            .join("|"),
        ),
    );
    for (const [groupIndex, group] of groups.entries()) {
      const representative = group[0],
        rangeCandidate = rangePlacement(
          representative,
          options.addressRangeRoads ?? [],
        ),
        // A source point can be stale or snapped to the wrong duplicate. Do
        // not pull a roof hundreds of metres away just because its civic number
        // falls in a road range; use the actual nearest frontage in that case.
        officialPlacement =
          rangeCandidate && rangeCandidate.source_distance_m <= 120
            ? rangeCandidate
            : undefined,
        road = officialPlacement
          ? {
              road: officialPlacement.road,
              projected: officialPlacement.point,
              tangent: officialPlacement.tangent,
              side: officialPlacement.side,
              distance_m: officialPlacement.source_distance_m,
            }
          : nearestRoadSegment(
              representative.point,
              representative.street,
              roads,
            ),
        nearbyAreas = sourcedBuildings
          .filter((building) => {
            const distance = metresBetween(
              representative.point,
              centroid(building),
            );
            const area = featureArea(building);
            return distance <= 90 && area >= 45 && area <= 350;
          })
          .slice(0, 20)
          .map(featureArea),
        area = median(nearbyAreas, 130),
        defaultWidth = Math.max(8, Math.min(15, Math.sqrt(area / 1.35))),
        sameStreetDistances = addresses
          .filter(
            (candidate) =>
              candidate.address_id !== representative.address_id &&
              candidate.street.toLowerCase() ===
                representative.street.toLowerCase(),
          )
          .map((candidate) =>
            metresBetween(representative.point, candidate.point),
          )
          .filter((distance) => distance > 2 && distance < 60),
        baseWidth = Math.max(
          6,
          Math.min(defaultWidth, median(sameStreetDistances, 24) * 0.58),
        ),
        baseDepth = Math.max(10, Math.min(22, area / baseWidth)),
        tangent = road?.tangent ?? ([1, 0] as Position),
        normal: Position = [-tangent[1], tangent[0]],
        numeric = Number.parseInt(representative.civic_number, 10),
        side =
          road?.side ||
          (Number.isFinite(numeric) && numeric % 2 === 0 ? 1 : -1),
        id = stableId(
          "structure",
          `estimated:${base}${groups.length > 1 ? `:cluster-${groupIndex + 1}` : ""}`,
        );
      let placed:
      | {
          geometry: Feature["geometry"];
          width: number;
          depth: number;
          shift_m: number;
          center: Position;
        }
      | undefined;
      const laneCount = Number(road?.road.properties.lane_count) || 2,
        roadHalfWidth = Math.max(3.2, laneCount * 1.6),
        // Address ranges often terminate at an intersection. Search into the
        // block first in those cases so corner addresses do not pile up on the
        // same small patch of frontage.
        interiorDirection = officialPlacement
          ? officialPlacement.fraction <= 0.08
            ? 1
            : officialPlacement.fraction >= 0.92
              ? -1
              : 0
          : 0,
        baseShifts = [
          0, 6, -6, 12, -12, 18, -18, 24, -24, 36, -36, 48, -48, 60, -60,
          72, -72, 90, -90,
        ],
        shiftCandidates = [
          ...(interiorDirection
            ? [12, 24, 36, 48, 60, 72, 90].map(
                (distance) => distance * interiorDirection,
              )
            : []),
          ...baseShifts,
        ].filter(
          (shift, index, values) => values.indexOf(shift) === index,
        ),
        // A smaller fallback footprint is preferable to dropping a valid civic
        // address when a sourced roof or a corner leaves limited space.
        scaleCandidates = [1, 0.86, 0.72, 0.58, 0.46];
      for (const scale of scaleCandidates) {
        const width = Math.max(5.5, baseWidth * scale),
          depth = Math.max(8, baseDepth * scale);
        for (const shift_m of shiftCandidates) {
          let center: Position;
          if (road) {
            const latitude = (road.projected[1] * Math.PI) / 180,
              scaleX = 111320 * Math.cos(latitude),
              setback = roadHalfWidth + 3 + depth / 2;
            center = [
              road.projected[0] +
                (tangent[0] * shift_m + normal[0] * side * setback) / scaleX,
              road.projected[1] +
                (tangent[1] * shift_m + normal[1] * side * setback) / 111320,
            ];
          } else center = representative.point;
          const geometry = estimatedRectangle(center, tangent, width, depth),
            nearbyObstacles = nearbyGridValues(obstacleGrid, center, 2),
            nearbyRoads = nearbyGridValues(nearbyRoadGrid, center, 1),
            overlaps = nearbyObstacles.some((obstacle) =>
              geometriesIntersect(geometry, obstacle.geometry),
            ),
            roadDistance = geometryRoadDistance(geometry, nearbyRoads);
          if (
            !overlaps &&
            roadDistance >= (options.minimumRoadClearanceM ?? 3.5)
          ) {
            placed = { geometry, width, depth, shift_m, center };
            break;
          }
        }
        if (placed) break;
      }
      if (!placed) {
        placementReview.push({
          address_ids: group.map((address) => address.address_id),
          label: `${representative.civic_number} ${representative.street}`,
          reason: "No collision-free roof placement was available",
        });
        continue;
      }
      estimated.push({
        type: "Feature",
        id,
        properties: {
          structure_id: id,
          external_source: "living_region_estimate",
          external_id: base,
          building_type:
            group.length > 1 ? "multi_unit_estimated" : "residential",
          confidence: "estimated",
          geometry_provenance: "estimated",
          source_components: [],
          licence: null,
          area_m2: +(placed.width * placed.depth).toFixed(1),
          estimated_width_m: +placed.width.toFixed(1),
          estimated_depth_m: +placed.depth.toFixed(1),
          estimated_shift_m: placed.shift_m,
          address_range_road_id:
            officialPlacement?.road.properties.road_id ?? null,
          address_range_fraction:
            officialPlacement?.fraction == null
              ? null
              : +officialPlacement.fraction.toFixed(4),
          estimated_from: nearbyAreas.length
            ? "nearby_roof_dimensions"
            : "residential_fallback",
        },
        geometry: placed.geometry,
      });
      addToGrid(obstacleGrid, placed.center, estimated[estimated.length - 1]);
      for (const address of group)
        associations.set(address.address_id, {
          ...associations.get(address.address_id)!,
          structure_id: id,
          association_status: "estimated",
        });
    }
  }

  return {
    associations,
    estimated,
    inferredAddresses: inferredResult.inferred,
    inferenceAudit: inferredResult.audit,
    placementReview,
  };
}

export function addAddressLabels(
  buildings: Feature[],
  addresses: AddressInput[],
  associations: Map<string, CoverageAssociation>,
) {
  const byStructure = new Map<string, AddressInput[]>();
  for (const address of addresses) {
    const structureId = associations.get(address.address_id)?.structure_id;
    if (structureId)
      byStructure.set(structureId, [
        ...(byStructure.get(structureId) ?? []),
        address,
      ]);
  }
  for (const building of buildings) {
    const linked = byStructure.get(building.properties.structure_id) ?? [],
      civicNumbers = [
        ...new Set(linked.map((address) => address.civic_number)),
      ].sort((left, right) =>
        left.localeCompare(right, undefined, { numeric: true }),
      );
    building.properties.address_count = linked.length;
    building.properties.civic_numbers = civicNumbers;
    const inferredOnly =
      linked.length > 0 &&
      linked.every(
        (address) => address.address_confidence === "inferred_range",
      );
    building.properties.civic_label =
      civicNumbers.length <= 3
        ? `${inferredOnly ? "~" : ""}${linked
            .map((address) =>
              [address.civic_number, address.street, address.unit]
                .filter(Boolean)
                .join(" "),
            )
            .join(" / ")}`
        : `${inferredOnly ? "~" : ""}${civicNumbers[0]} +${civicNumbers.length - 1}`;
  }
  return byStructure;
}

export function addUnaddressedStructureReferences(
  buildings: Feature[],
  linkedByStructure: Map<string, AddressInput[]>,
) {
  const addressed = buildings.filter(
      (building) =>
        (linkedByStructure.get(String(building.properties.structure_id)) ?? [])
          .length > 0,
    ),
    centers = new Map(
      buildings.map((building) => [
        String(building.properties.structure_id),
        centroid(building),
      ]),
    );
  const counts = {
    shared_accessory: 0,
    provisional_nearest: 0,
    high_confidence: 0,
    probable: 0,
    distant_review: 0,
    unresolved: 0,
  };
  for (const building of buildings) {
    const structureId = String(building.properties.structure_id);
    if ((linkedByStructure.get(structureId) ?? []).length) continue;
    const center = centers.get(structureId)!;
    let nearest:
      | { building: Feature; addresses: AddressInput[]; distance_m: number }
      | undefined;
    for (const candidate of addressed) {
      const candidateId = String(candidate.properties.structure_id),
        distance_m = metresBetween(center, centers.get(candidateId)!);
      if (!nearest || distance_m < nearest.distance_m)
        nearest = {
          building: candidate,
          addresses: linkedByStructure.get(candidateId)!,
          distance_m,
        };
    }
    const type = String(building.properties.building_type ?? "unclassified").toLowerCase(),
      isAccessory = new Set(["accessory", "garage", "shed", "carport"]).has(type);
    // A nearby accessory can share the primary property's address. A normal
    // roof must not inherit an address from another building: a citywide
    // nearest roof is not evidence of a civic-address association.
    // This legacy pre-processing hook is deliberately limited to an explicitly
    // tagged accessory immediately beside a primary building. It never gives
    // a normal roof an address and never searches beyond the local footprint.
    if (!nearest || !isAccessory || nearest.distance_m > 20) {
      delete building.properties.address_reference_ids;
      delete building.properties.address_reference_structure_id;
      delete building.properties.address_reference_distance_m;
      delete building.properties.address_relation;
      delete building.properties.address_relation_confidence;
      counts.unresolved++;
      continue;
    }
    const relation = "shared_accessory",
      confidence = "high_confidence",
      civicNumbers = [
        ...new Set(nearest.addresses.map((address) => address.civic_number)),
      ].sort((left, right) =>
        left.localeCompare(right, undefined, { numeric: true }),
      );
    building.properties.address_relation = relation;
    building.properties.address_relation_confidence = confidence;
    building.properties.address_reference_structure_id =
      nearest.building.properties.structure_id;
    building.properties.address_reference_ids = nearest.addresses.map(
      (address) => address.address_id,
    );
    building.properties.address_reference_distance_m =
      +nearest.distance_m.toFixed(1);
    building.properties.civic_numbers = civicNumbers;
    building.properties.civic_label =
      civicNumbers.length <= 3
        ? nearest.addresses
            .map((address) =>
              [address.civic_number, address.street, address.unit]
                .filter(Boolean)
                .join(" "),
            )
            .join(" / ")
        : `${civicNumbers[0]} +${civicNumbers.length - 1}`;
    counts[relation]++;
    counts[confidence]++;
  }
  return counts;
}

export function applyAddressNumberCalibrations(
  addresses: AddressInput[],
  buildings: Feature[],
  associations: Map<string, CoverageAssociation>,
  calibrations: AddressNumberCalibration[],
) {
  let applied = 0,
    unmatched = 0;
  for (const calibration of calibrations) {
    let input = addresses.find(
      (candidate) => candidate.address_id === calibration.address_id,
    );
    if (!input) {
      const building = buildings.find(
        (candidate) =>
          candidate.properties.structure_id === calibration.structure_id,
      );
      if (!building) {
        unmatched++;
        continue;
      }
      input = {
        address_id: calibration.address_id,
        civic_number: calibration.civic_number,
        street: calibration.street,
        unit: calibration.unit ?? "",
        point: centroid(building),
        external_source: "manual_canvassing",
        external_id: calibration.event_id,
        address_confidence: "manual_verified",
        inferred_from: "manual_structure_number_calibration",
      };
      addresses.push(input);
      associations.set(input.address_id, {
        structure_id: calibration.structure_id,
        association_status: "exact",
        nearest_footprint_m: 0,
        candidates: [{ structure_id: calibration.structure_id, distance_m: 0 }],
      });
    }
    input.civic_number = calibration.civic_number;
    input.street = calibration.street;
    input.unit = calibration.unit ?? input.unit;
    input.address_confidence = "manual_verified";
    input.inferred_from = "manual_structure_number_calibration";
    applied++;
  }
  return { applied, unmatched };
}
