import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

type Feature = {
  type: "Feature";
  id?: string | number;
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: any };
};
type Collection = { type: "FeatureCollection"; features: Feature[] };
const root = resolve(process.cwd());
const output = join(root, "packages/web-client/public/canvassing");
const highConfidenceMaxMetres = Number(
  process.env.CANVASS_HIGH_CONFIDENCE_M ?? 12,
);
const probableMaxMetres = Number(process.env.CANVASS_PROBABLE_M ?? 30);
const farFromRoadMetres = Number(process.env.CANVASS_FAR_FROM_ROAD_M ?? 50);
const stable = (kind: string, source: string) =>
  `${kind}_${createHash("sha256").update(`${kind}:${source}`).digest("hex").slice(0, 20)}`;
const walk = (coordinates: any, visitor: (point: [number, number]) => void) =>
  typeof coordinates?.[0] === "number"
    ? visitor(coordinates)
    : coordinates?.forEach((item: any) => walk(item, visitor));
const bboxIntersects = (feature: Feature, bbox: number[]) => {
  let hit = false;
  walk(feature.geometry.coordinates, ([x, y]) => {
    if (x >= bbox[0] && x <= bbox[2] && y >= bbox[1] && y <= bbox[3])
      hit = true;
  });
  return hit;
};
const polygonContains = (point: [number, number], ring: number[][]) => {
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
const centroid = (feature: Feature): [number, number] => {
  const points: [number, number][] = [];
  walk(feature.geometry.coordinates, (point) => points.push(point));
  return [
    points.reduce((s, p) => s + p[0], 0) / points.length,
    points.reduce((s, p) => s + p[1], 0) / points.length,
  ];
};
const addressLabel = (p: Record<string, unknown>) =>
  [
    p["addr:housenumber"],
    p["addr:street"],
    p["addr:unit"] ? `Unit ${p["addr:unit"]}` : "",
  ]
    .filter(Boolean)
    .join(" ");
const normalize = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/\bstreet\b/g, "st")
    .replace(/\bavenue\b/g, "ave")
    .replace(/[^a-z0-9]/g, "");
const metres = (a: [number, number], b: [number, number]) => {
  const lat = (((a[1] + b[1]) / 2) * Math.PI) / 180;
  return Math.hypot(
    (a[0] - b[0]) * 111320 * Math.cos(lat),
    (a[1] - b[1]) * 111320,
  );
};
const pointSegmentDistance = (
  point: [number, number],
  a: [number, number],
  b: [number, number],
) => {
  const lat = (point[1] * Math.PI) / 180,
    sx = 111320 * Math.cos(lat),
    sy = 111320,
    px = point[0] * sx,
    py = point[1] * sy,
    ax = a[0] * sx,
    ay = a[1] * sy,
    bx = b[0] * sx,
    by = b[1] * sy,
    dx = bx - ax,
    dy = by - ay,
    t = Math.max(
      0,
      Math.min(
        1,
        ((px - ax) * dx + (py - ay) * dy) / Math.max(1, dx * dx + dy * dy),
      ),
    );
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};
const distanceToFeature = (point: [number, number], feature: Feature) => {
  let best = Infinity;
  const lines: any[] =
    feature.geometry.type === "MultiLineString"
      ? feature.geometry.coordinates
      : feature.geometry.type === "LineString"
        ? [feature.geometry.coordinates]
        : [];
  for (const line of lines)
    for (let i = 1; i < line.length; i++)
      best = Math.min(best, pointSegmentDistance(point, line[i - 1], line[i]));
  if (!lines.length)
    walk(feature.geometry.coordinates, (candidate) => {
      best = Math.min(best, metres(point, candidate));
    });
  return best;
};

async function main() {
  const temporary = await mkdtemp(join(tmpdir(), "living-region-canvassing-"));
  try {
    const rawPath = join(temporary, "osm.geojson");
    execFileSync(
      "osmium",
      [
        "export",
        join(root, "data/osm/owen-sound.osm.pbf"),
        "-o",
        rawPath,
        "--overwrite",
        "--add-unique-id=type_id",
      ],
      { stdio: "inherit" },
    );
    const raw = JSON.parse(await readFile(rawPath, "utf8")) as Collection;
    const boundary = JSON.parse(
      await readFile(join(root, "data/boundaries/owen-sound.geojson"), "utf8"),
    ) as Collection;
    const ring = boundary.features[0].geometry.coordinates[0] as number[][];
    const xs = ring.map((p) => p[0]),
      ys = ring.map((p) => p[1]);
    const bbox = [
      Math.min(...xs),
      Math.min(...ys),
      Math.max(...xs),
      Math.max(...ys),
    ];
    const inCity = (feature: Feature) =>
      polygonContains(centroid(feature), ring);
    const buildings = raw.features
      .filter(
        (f) =>
          f.properties.building &&
          ["Polygon", "MultiPolygon"].includes(f.geometry.type) &&
          inCity(f),
      )
      .map((f) => {
        const sourceId = String(f.id ?? f.properties.id ?? "unknown");
        const rawType = String(f.properties.building);
        const buildingType = [
          "apartments",
          "residential",
          "house",
          "detached",
          "semidetached_house",
          "terrace",
        ].includes(rawType)
          ? rawType === "apartments"
            ? "apartment"
            : "residential"
          : ["commercial", "retail", "office", "industrial"].includes(rawType)
            ? "commercial"
            : ["school", "hospital", "church", "civic", "public"].includes(
                  rawType,
                )
              ? "institutional"
              : ["garage", "garages", "shed", "carport"].includes(rawType)
                ? "accessory"
                : "unclassified";
        return {
          ...f,
          id: stable("structure", `osm:${sourceId}`),
          properties: {
            structure_id: stable("structure", `osm:${sourceId}`),
            external_source: "openstreetmap",
            external_id: sourceId,
            building_type: buildingType,
            source_building_tag: rawType,
            source_timestamp: f.properties.timestamp ?? null,
            confidence: "source_mapped",
          },
        };
      });
    const osmRoads = raw.features.filter(
      (feature) =>
        feature.properties.highway &&
        ["LineString", "MultiLineString"].includes(feature.geometry.type),
    );
    const streetNames = new Set(
      osmRoads
        .map((feature) => normalize(feature.properties.name))
        .filter(Boolean),
    );
    const allAddressFeatures = raw.features.filter(
      (f) => f.properties["addr:housenumber"],
    );
    const cityAddressFeatures = allAddressFeatures.filter(inCity);
    const normalizedCounts = new Map<string, number>();
    for (const feature of cityAddressFeatures) {
      const key = normalize(
        `${feature.properties["addr:housenumber"]} ${feature.properties["addr:street"]} ${feature.properties["addr:unit"] ?? ""}`,
      );
      normalizedCounts.set(key, (normalizedCounts.get(key) ?? 0) + 1);
    }
    const matchCounts = {
      exact: 0,
      high_confidence: 0,
      probable: 0,
      ambiguous: 0,
      unmatched: 0,
    };
    const addresses = cityAddressFeatures.map((f) => {
      const sourceId = String(f.id ?? f.properties.id ?? "unknown");
      const point =
        f.geometry.type === "Point"
          ? (f.geometry.coordinates as [number, number])
          : centroid(f);
      const containing = buildings.filter((building) =>
        building.geometry.type === "Polygon"
          ? polygonContains(point, building.geometry.coordinates[0])
          : building.geometry.coordinates.some((polygon: any) =>
              polygonContains(point, polygon[0]),
            ),
      );
      const nearest = buildings
        .map((building) => ({
          building,
          distance_m: distanceToFeature(point, building),
        }))
        .sort((a, b) => a.distance_m - b.distance_m)
        .slice(0, 3);
      let confidence:
          "exact" | "high_confidence" | "probable" | "ambiguous" | "unmatched" =
          "unmatched",
        associated: string | null = null;
      if (containing.length === 1) {
        confidence = "exact";
        associated = containing[0].properties.structure_id as string;
      } else if (containing.length > 1) confidence = "ambiguous";
      else if (
        nearest[0]?.distance_m <= highConfidenceMaxMetres &&
        nearest[1] &&
        nearest[1].distance_m - nearest[0].distance_m < 3
      )
        confidence = "ambiguous";
      else if (nearest[0]?.distance_m <= highConfidenceMaxMetres) {
        confidence = "high_confidence";
        associated = nearest[0].building.properties.structure_id as string;
      } else if (nearest[0]?.distance_m <= probableMaxMetres)
        confidence = "probable";
      matchCounts[confidence]++;
      const normalizedAddress = normalize(
          `${f.properties["addr:housenumber"]} ${f.properties["addr:street"]} ${f.properties["addr:unit"] ?? ""}`,
        ),
        street = String(f.properties["addr:street"] ?? "");
      const nearestRoad = Math.min(
        ...osmRoads.map((road) => distanceToFeature(point, road)),
      );
      return {
        type: "Feature" as const,
        id: stable("address", `osm:${sourceId}`),
        properties: {
          address_id: stable("address", `osm:${sourceId}`),
          external_source: "openstreetmap",
          external_id: sourceId,
          civic_number: String(f.properties["addr:housenumber"]),
          street,
          unit: String(f.properties["addr:unit"] ?? ""),
          label: addressLabel(f.properties),
          structure_id: associated,
          association_status: confidence,
          association_candidates: [
            ...containing.map((building) => ({
              structure_id: building.properties.structure_id,
              distance_m: 0,
            })),
            ...nearest.map((item) => ({
              structure_id: item.building.properties.structure_id,
              distance_m: +item.distance_m.toFixed(1),
            })),
          ].slice(0, 3),
          normalized_address: normalizedAddress,
          duplicate_normalized_address:
            (normalizedCounts.get(normalizedAddress) ?? 0) > 1,
          apparent_multi_unit:
            Boolean(f.properties["addr:unit"]) ||
            (normalizedCounts.get(
              normalize(`${f.properties["addr:housenumber"]} ${street}`),
            ) ?? 0) > 1,
          street_match: streetNames.has(normalize(street)),
          nearest_road_m: +nearestRoad.toFixed(1),
          nearest_footprint_m: Number.isFinite(nearest[0]?.distance_m)
            ? +nearest[0].distance_m.toFixed(1)
            : null,
        },
        geometry: { type: "Point", coordinates: point },
      };
    });
    const reviewRecords = addresses
      .map((feature) => {
        const properties = feature.properties;
        const queues = [
          properties.duplicate_normalized_address
            ? "duplicate_normalized"
            : null,
          properties.apparent_multi_unit ? "apparent_multi_unit" : null,
          !properties.street_match ? "unmatched_street" : null,
          Number(properties.nearest_road_m) > farFromRoadMetres
            ? "distant_from_road"
            : null,
        ].filter(Boolean);
        return {
          type: "Feature" as const,
          properties: {
            review_id: properties.address_id,
            address_id: properties.address_id,
            external_source: properties.external_source,
            external_id: properties.external_id,
            label: properties.label,
            queue_flags: queues,
            within_boundary: true,
          },
          geometry: feature.geometry,
        };
      })
      .filter((feature) => feature.properties.queue_flags.length);
    for (const feature of allAddressFeatures.filter(
      (feature) => !inCity(feature),
    )) {
      const sourceId = String(feature.id ?? feature.properties.id ?? "unknown");
      const point =
        feature.geometry.type === "Point"
          ? (feature.geometry.coordinates as [number, number])
          : centroid(feature);
      reviewRecords.push({
        type: "Feature",
        properties: {
          review_id: stable("address", `osm:${sourceId}`),
          address_id: null,
          external_source: "openstreetmap",
          external_id: sourceId,
          label: addressLabel(feature.properties),
          queue_flags: ["outside_boundary"],
          within_boundary: false,
        },
        geometry: { type: "Point", coordinates: point },
      } as any);
    }
    const officialRoads = JSON.parse(
      await readFile(
        join(root, "know/input/gis/road-centrelines-grey.geojson"),
        "utf8",
      ),
    ) as Collection;
    const roads = officialRoads.features
      .filter((f) => bboxIntersects(f, bbox))
      .map((f) => ({
        ...f,
        properties: {
          road_id: stable("road", `grey:${f.properties.OBJECTID}`),
          name: f.properties.ROAD_NAME ?? f.properties.STREET_NAM ?? "",
          road_class: f.properties.STREET_CLA ?? "",
          source: "Grey County road centrelines",
        },
      }));
    await mkdir(output, { recursive: true });
    await Promise.all([
      writeFile(
        join(output, "structures.geojson"),
        JSON.stringify({ type: "FeatureCollection", features: buildings }) +
          "\n",
      ),
      writeFile(
        join(output, "addresses.geojson"),
        JSON.stringify({ type: "FeatureCollection", features: addresses }) +
          "\n",
      ),
      writeFile(
        join(output, "address-review.geojson"),
        JSON.stringify({ type: "FeatureCollection", features: reviewRecords }) +
          "\n",
      ),
      writeFile(
        join(output, "roads.geojson"),
        JSON.stringify({ type: "FeatureCollection", features: roads }) + "\n",
      ),
      writeFile(
        join(output, "boundary.geojson"),
        JSON.stringify(boundary) + "\n",
      ),
      writeFile(
        join(output, "parcels.geojson"),
        JSON.stringify({
          type: "FeatureCollection",
          metadata: {
            status: "unavailable",
            reason: "No Owen Sound urban parcel fabric in local repository",
          },
          features: [],
        }) + "\n",
      ),
      writeFile(
        join(output, "address-quality.json"),
        JSON.stringify(
          {
            generated_at: new Date().toISOString(),
            config: {
              high_confidence_max_m: highConfidenceMaxMetres,
              probable_max_m: probableMaxMetres,
              far_from_road_m: farFromRoadMetres,
            },
            totals: {
              civic_addresses: addresses.length,
              duplicate_normalized_addresses: addresses.filter(
                (a) => a.properties.duplicate_normalized_address,
              ).length,
              outside_municipal_boundary:
                allAddressFeatures.length - cityAddressFeatures.length,
              far_from_any_road: addresses.filter(
                (a) => Number(a.properties.nearest_road_m) > farFromRoadMetres,
              ).length,
              no_street_match: addresses.filter(
                (a) => !a.properties.street_match,
              ).length,
              several_points_same_civic_address: addresses.filter(
                (a) => a.properties.duplicate_normalized_address,
              ).length,
              apparent_multi_unit: addresses.filter(
                (a) => a.properties.apparent_multi_unit,
              ).length,
              more_than_one_candidate_building: addresses.filter(
                (a) => a.properties.association_status === "ambiguous",
              ).length,
              nearest_footprint_beyond_high_confidence_threshold:
                addresses.filter(
                  (a) =>
                    Number(a.properties.nearest_footprint_m) >
                    highConfidenceMaxMetres,
                ).length,
              nearest_footprint_beyond_probable_threshold: addresses.filter(
                (a) =>
                  Number(a.properties.nearest_footprint_m) > probableMaxMetres,
              ).length,
            },
            automatic_join_counts: matchCounts,
            methodology: `Exact containment and a sole plausible footprint within ${highConfidenceMaxMetres} m are automatic. Candidates within ${probableMaxMetres} m are probable; probable and ambiguous candidates remain review-only.`,
          },
          null,
          2,
        ) + "\n",
      ),
      writeFile(
        join(output, "building-source-audit.json"),
        JSON.stringify(
          {
            generated_at: new Date().toISOString(),
            result:
              "No additional licence-compatible Owen Sound building footprint source is present locally.",
            usable_sources: [
              {
                source: "OpenStreetMap",
                path: "data/osm/owen-sound.osm.pbf",
                licence: "ODbL 1.0",
                structures: buildings.length,
                role: "application building layer",
              },
            ],
            audited_absent_sources: [
              "Microsoft Canadian Building Footprints",
              "Statistics Canada building footprints",
              "City of Owen Sound municipal building footprints",
            ],
            excluded_as_building_sources: [
              "empty import templates",
              "fixtures and examples",
              "rural lot and concession polygons",
            ],
            private_reference_layer_added: false,
          },
          null,
          2,
        ) + "\n",
      ),
      writeFile(
        join(output, "manifest.json"),
        JSON.stringify(
          {
            generated_at: new Date().toISOString(),
            crs: "OGC:CRS84 / WGS84 longitude-latitude",
            extent: bbox,
            sources: {
              osm: "data/osm/owen-sound.osm.pbf",
              roads: "know/input/gis/road-centrelines-grey.geojson",
              boundary: "data/boundaries/owen-sound.geojson",
            },
            counts: {
              structures: buildings.length,
              addresses: addresses.length,
              matched_addresses: addresses.filter(
                (a) => a.properties.structure_id,
              ).length,
              ambiguous_addresses: matchCounts.ambiguous,
              unmatched_addresses: matchCounts.unmatched,
              match_confidence: matchCounts,
              roads: roads.length,
              address_review_records: reviewRecords.length,
            },
            source_currency: {
              osm_latest_object_timestamp: "2026-05-18",
              official_roads:
                "see source manifest; feature-level currency not supplied",
            },
          },
          null,
          2,
        ) + "\n",
      ),
    ]);
    console.log(
      `Prepared ${buildings.length} structures, ${addresses.length} addresses and ${roads.length} roads in ${output}`,
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
