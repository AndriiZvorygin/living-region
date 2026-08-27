import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  addAddressLabels,
  addUnaddressedStructureReferences,
  applyAddressNumberCalibrations,
  associateAddressesWithBuildings,
  findGeneratedGeometryConflicts,
  mergeBuildingSources,
  mergeCityMapBuildingSource,
  stableId,
  type AddressNumberCalibration,
  type AddressInput,
  type Feature,
} from "./building-coverage";
import {
  isCanvassableStructureType,
  operationalTargetForStructure,
} from "./operational-target";

type Collection = { type: "FeatureCollection"; features: Feature[] };
const root = resolve(process.cwd());
const output = join(root, "packages/web-client/public/canvassing");
const highConfidenceMaxMetres = Number(
  process.env.CANVASS_HIGH_CONFIDENCE_M ?? 12,
);
const probableMaxMetres = Number(process.env.CANVASS_PROBABLE_M ?? 30);
const farFromRoadMetres = Number(process.env.CANVASS_FAR_FROM_ROAD_M ?? 50);
const stable = stableId;
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
    const osmBuildings = raw.features
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
            geometry_provenance: "sourced",
            source_components: ["OSM"],
            licence: "ODbL 1.0",
          },
        };
      });
    const cityMapBuildingsPath = join(
        root,
        "data/canvassing/owen-sound-city-map-buildings.geojson",
      ),
      cityMapBuildings = JSON.parse(
        await readFile(cityMapBuildingsPath, "utf8"),
      ) as Collection,
      cityMapSourceMetadata = JSON.parse(
        await readFile(
          join(root, "data/canvassing/owen-sound-city-map-source.json"),
          "utf8",
        ),
      ),
      cityMerged = mergeCityMapBuildingSource(
        osmBuildings,
        cityMapBuildings.features,
        ring,
      ),
      canadaStructuresPath = join(
        root,
        "data/canvassing/canada-structures-owen-sound.geojson",
      ),
      canadaStructures = JSON.parse(
        await readFile(canadaStructuresPath, "utf8"),
      ) as Collection,
      canadaSourceMetadata = JSON.parse(
        await readFile(
          join(root, "data/canvassing/canada-structures-source.json"),
          "utf8",
        ),
      ),
      merged = mergeBuildingSources(
        cityMerged.buildings,
        canadaStructures.features,
        ring,
      ),
      sourcedBuildings = merged.buildings;
    const osmRoads = raw.features.filter(
      (feature) =>
        feature.properties.highway &&
        ["LineString", "MultiLineString"].includes(feature.geometry.type),
    );
    const officialRoads = JSON.parse(
        await readFile(
          join(root, "know/input/gis/road-centrelines-grey.geojson"),
          "utf8",
        ),
      ) as Collection,
      roads = officialRoads.features
        .filter((feature) => bboxIntersects(feature, bbox))
        .map((feature) => ({
          ...feature,
          properties: {
            road_id: stable("road", `grey:${feature.properties.OBJECTID}`),
            name:
              feature.properties.ROAD_NAME ??
              feature.properties.STREET_NAM ??
              "",
            road_class: feature.properties.STREET_CLA ?? "",
            lane_count: feature.properties.LANE_COUNT ?? null,
            speed_limit_kmh: feature.properties.SPEED_LIMI ?? null,
            left_from: feature.properties.L_F_ADD ?? null,
            left_to: feature.properties.L_T_ADD ?? null,
            right_from: feature.properties.R_F_ADD ?? null,
            right_to: feature.properties.R_T_ADD ?? null,
            left_parity: feature.properties.PARITY_L ?? null,
            right_parity: feature.properties.PARITY_R ?? null,
            source: "Grey County road centrelines",
          },
        }));
    const streetNames = new Set(
      [...osmRoads, ...roads]
        .map((feature) => normalize(feature.properties.name))
        .filter(Boolean),
    );
    const allAddressFeatures = raw.features.filter(
      (f) => f.properties["addr:housenumber"],
    );
    const cityAddressFeatures = allAddressFeatures.filter(inCity);
    const addressInputs: AddressInput[] = cityAddressFeatures.map((feature) => {
      const sourceId = String(feature.id ?? feature.properties.id ?? "unknown"),
        point =
          feature.geometry.type === "Point"
            ? (feature.geometry.coordinates as [number, number])
            : centroid(feature);
      return {
        address_id: stable("address", `osm:${sourceId}`),
        civic_number: String(feature.properties["addr:housenumber"]),
        street: String(feature.properties["addr:street"] ?? ""),
        unit: String(feature.properties["addr:unit"] ?? ""),
        point,
      };
    });
    const calibrationDocument = JSON.parse(
        await readFile(
          join(root, "private/canvassing/address-number-calibration.json"),
          "utf8",
        ).catch(() => '{"records":[]}'),
      ) as { records: AddressNumberCalibration[] },
      coverage = associateAddressesWithBuildings(
        addressInputs,
        sourcedBuildings,
        [...osmRoads, ...roads],
        {
          highConfidenceM: highConfidenceMaxMetres,
          probableM: probableMaxMetres,
          addressRangeRoads: roads,
          reservedAddresses: calibrationDocument.records,
        },
      ),
      allAddressInputs = [...addressInputs, ...coverage.inferredAddresses],
      buildings = [...sourcedBuildings, ...coverage.estimated];
    const calibrationResult = applyAddressNumberCalibrations(
      allAddressInputs,
      buildings,
      coverage.associations,
      calibrationDocument.records,
    );
    const generatedGeometryConflicts = findGeneratedGeometryConflicts(
        coverage.estimated,
        sourcedBuildings,
        [...osmRoads, ...roads],
      ),
      linkedByStructure = addAddressLabels(
        buildings,
        allAddressInputs,
        coverage.associations,
      ),
      unaddressedStructureReferences = addUnaddressedStructureReferences(
        buildings,
        linkedByStructure,
      );
    const roadById = new Map(
      roads.map((road) => [String(road.properties.road_id ?? ""), road]),
    );
    for (const building of buildings) {
      const structureId = String(building.properties.structure_id),
        linked = linkedByStructure.get(structureId) ?? [],
        addressIds = [
          ...linked.map((address) => address.address_id),
        ],
        householdIds = [
          ...new Set(
            addressIds
              .map((addressId) => String(addressId))
              .filter((addressId) => addressId.startsWith("address_"))
              .map((addressId) => `household_${addressId.slice(8)}`),
          ),
        ],
        canvassable =
          isCanvassableStructureType(building.properties.building_type) &&
          (householdIds.length > 0 ||
            isCanvassableStructureType(building.properties.building_type));
      if (canvassable && !householdIds.length) {
        const rangeRoad = roadById.get(
          String(building.properties.address_range_road_id ?? ""),
        );
        let road = rangeRoad;
        if (!road) {
          const point = centroid(building);
          road = roads
            .map((candidate) => ({
              candidate,
              distance: distanceToFeature(point, candidate),
            }))
            .sort(
              (left, right) =>
                left.distance - right.distance ||
                String(left.candidate.properties.name ?? "").localeCompare(
                  String(right.candidate.properties.name ?? ""),
                ),
            )[0]?.candidate;
        }
        const inferredNumber = String(
          building.properties.inferred_civic_number ??
            building.properties.civic_numbers?.[0] ??
            String(building.properties.civic_label ?? "").match(/\d+/)?.[0] ??
            "1",
        );
        const inferredStreet = String(road?.properties.name ?? "Owen Sound Road");
        building.properties.fallback_civic_number = inferredNumber;
        building.properties.fallback_street = inferredStreet;
        building.properties.fallback_unit = "";
        building.properties.address_label_source =
          "owen_sound_grid_estimate";
        building.properties.address_source_status = "estimated";
        building.properties.address_quality = "grid_estimated";
        building.properties.civic_numbers = [inferredNumber];
        building.properties.civic_label = `~${inferredNumber} ${inferredStreet}`;
        householdIds.push(
          operationalTargetForStructure(structureId).householdId,
        );
        building.properties.selection_target_kind = "operational_roof";
      } else if (canvassable && householdIds.length) {
        building.properties.selection_target_kind = "address_household";
      } else if (!canvassable) {
        householdIds.length = 0;
        building.properties.selection_target_kind = null;
      }
      building.properties.canvassable = canvassable;
      building.properties.selection_target_ids = householdIds;
      building.properties.selection_target_id = householdIds[0] ?? null;
    }
    const missingSelectionTargets = buildings.filter(
      (building) =>
        building.properties.canvassable &&
        !String(building.properties.selection_target_id ?? ""),
    );
    if (missingSelectionTargets.length)
      throw new Error(
        `Canvassing data invariant failed: ${missingSelectionTargets.length} canvassable structures lack selection targets`,
      );
    const matchCounts = {
        exact: 0,
        high_confidence: 0,
        probable_sourced: 0,
        inferred_range: 0,
        estimated: 0,
        unresolved: 0,
      },
      normalizedCounts = new Map<string, number>();
    for (const input of allAddressInputs) {
      const key = normalize(
        `${input.civic_number} ${input.street} ${input.unit}`,
      );
      normalizedCounts.set(key, (normalizedCounts.get(key) ?? 0) + 1);
    }
    const addresses = allAddressInputs.map((input) => {
      const addressId = input.address_id,
        point = input.point,
        association = coverage.associations.get(addressId)!,
        inferred = input.address_confidence === "inferred_range";
      matchCounts[association.association_status]++;
      const normalizedAddress = normalize(
          `${input.civic_number} ${input.street} ${input.unit}`,
        ),
        street = input.street;
      const nearestRoad = Math.min(
        ...osmRoads.map((road) => distanceToFeature(point, road)),
      );
      return {
        type: "Feature" as const,
        id: addressId,
        properties: {
          address_id: addressId,
          external_source: input.external_source ?? "openstreetmap",
          external_id: input.external_id ?? addressId,
          civic_number: input.civic_number,
          street,
          unit: input.unit,
          label: `${inferred ? "~" : ""}${input.civic_number} ${street}${
            input.unit ? ` Unit ${input.unit}` : ""
          }`,
          structure_id: association.structure_id,
          association_status: association.association_status,
          address_confidence:
            input.address_confidence ?? association.association_status,
          address_range_road_id: input.address_range_road_id ?? null,
          inferred_from: input.inferred_from ?? null,
          association_candidates: association.candidates,
          normalized_address: normalizedAddress,
          duplicate_normalized_address:
            (normalizedCounts.get(normalizedAddress) ?? 0) > 1,
          apparent_multi_unit:
            Boolean(input.unit) ||
            (normalizedCounts.get(
              normalize(`${input.civic_number} ${street}`),
            ) ?? 0) > 1,
          street_match: streetNames.has(normalize(street)),
          nearest_road_m: +nearestRoad.toFixed(1),
          nearest_footprint_m: association.nearest_footprint_m,
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
          properties.association_status === "probable_sourced"
            ? "suspicious_building_match"
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
    const coverageReview = addresses
        .filter((address) =>
          ["probable_sourced", "unresolved"].includes(
            String(address.properties.association_status),
          ),
        )
        .map((address) => ({
          type: "Feature",
          properties: {
            address_id: address.properties.address_id,
            label: address.properties.label,
            association_status: address.properties.association_status,
            structure_id: address.properties.structure_id,
            nearest_sourced_footprint_m: address.properties.nearest_footprint_m,
            review_reason:
              address.properties.association_status === "probable_sourced"
                ? "Sourced roof is beyond the high-confidence distance threshold"
                : "No usable roof geometry was generated",
          },
          geometry: address.geometry,
        })),
      sourcedAddressCount = addresses.filter((address) =>
        [
          "exact",
          "high_confidence",
          "probable_sourced",
          "inferred_range",
        ].includes(String(address.properties.association_status)),
      ).length,
      estimatedAddressCount = matchCounts.estimated,
      multiAddressBuildings = [...linkedByStructure.values()].filter(
        (linked) => linked.length > 1,
      ).length,
      coverageAudit = {
        generated_at: new Date().toISOString(),
        existing_osm_footprints: osmBuildings.length,
        city_map_candidates: cityMerged.audit.city_map_candidates,
        city_map_additional_footprints:
          cityMerged.audit.city_map_additional_footprints,
        city_map_deduplicated_polygons:
          cityMerged.audit.city_map_deduplicated_polygons,
        canada_structures_candidates_in_bbox:
          merged.audit.canada_bbox_candidates,
        canada_structures_outside_boundary:
          merged.audit.canada_outside_boundary,
        additional_sourced_footprints:
          merged.audit.additional_sourced_footprints,
        deduplicated_polygons:
          cityMerged.audit.city_map_deduplicated_polygons +
          merged.audit.deduplicated_polygons,
        total_sourced_footprints: sourcedBuildings.length,
        estimated_footprints: coverage.estimated.length,
        total_display_footprints: buildings.length,
        structures_with_civic_labels: buildings.filter((building) =>
          Boolean(building.properties.civic_label),
        ).length,
        structures_without_civic_labels: buildings.filter(
          (building) => !building.properties.civic_label,
        ).length,
        unaddressed_structure_references: unaddressedStructureReferences,
        canvassable_structures: buildings.filter(
          (building) => building.properties.canvassable,
        ).length,
        canvassable_structures_without_selection_target:
          missingSelectionTargets.length,
        small_frontage_inferred: buildings.filter((building) =>
          Boolean(building.properties.small_frontage_inference),
        ).length,
        manual_number_calibrations_applied: calibrationResult.applied,
        manual_number_calibrations_unmatched: calibrationResult.unmatched,
        civic_addresses: addresses.length,
        imported_civic_addresses: addressInputs.length,
        inferred_range_addresses: coverage.inferredAddresses.length,
        addresses_matched_to_sourced_roofs: sourcedAddressCount,
        addresses_receiving_estimated_roofs: estimatedAddressCount,
        multi_address_buildings: multiAddressBuildings,
        unresolved_addresses: matchCounts.unresolved,
        suspicious_or_long_distance_matches: coverageReview.length,
        generated_geometry_conflicts: generatedGeometryConflicts.length,
        collision_safe_placement_failures: coverage.placementReview.length,
        inference_audit: coverage.inferenceAudit,
        association_counts: matchCounts,
      };
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
        join(output, "building-coverage-review.geojson"),
        JSON.stringify({
          type: "FeatureCollection",
          features: coverageReview,
        }) + "\n",
      ),
      writeFile(
        join(output, "building-coverage-audit.json"),
        JSON.stringify(coverageAudit, null, 2) + "\n",
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
                (a) => a.properties.association_candidates.length > 1,
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
            methodology: `Point-in-polygon is preferred. Plausible sourced roofs within ${highConfidenceMaxMetres} m are high confidence; sourced roofs up to ${probableMaxMetres} m are marked probable and queued for review. Unlinked plausible sourced roofs receive stable inferred addresses from official left/right segment ranges and parity. Remaining imported civic-address groups receive a collision-checked, street-oriented estimated roof or remain a reviewable point. Display roofs without their own address retain a provisional reference to the nearest addressed structure so every roof is selectable without creating duplicate households; these references can be separated through an audited manual civic-number correction.`,
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
              "The official Owen Sound city-map building layer fills local roof gaps while preserving suitable OSM footprints; Canada Structures fills remaining gaps. Official Grey County address ranges create stable inferred household stops; unmatched imported civic addresses receive collision-checked local roofs or review points.",
            usable_sources: [
              {
                source: "OpenStreetMap",
                path: "data/osm/owen-sound.osm.pbf",
                licence: "ODbL 1.0",
                structures: osmBuildings.length,
                role: "preferred sourced geometry",
              },
              {
                source: "City of Owen Sound city map",
                path: "data/canvassing/owen-sound-city-map-buildings.geojson",
                source_path: cityMapSourceMetadata.source_path,
                source_map_date: cityMapSourceMetadata.source_map_date,
                source_pdf_sha256: cityMapSourceMetadata.source_pdf_sha256,
                derived_sha256: cityMapSourceMetadata.output_sha256,
                licence: cityMapSourceMetadata.licence,
                structures: cityMerged.audit.city_map_additional_footprints,
                role: "official-map private reference geometry extracted from the isolated GeoPDF layer",
                private_reference_only: true,
              },
              {
                source: "Canada Structures",
                path: "data/canvassing/canada-structures-owen-sound.geojson",
                source_url: canadaSourceMetadata.source_url,
                licence: canadaSourceMetadata.licence,
                source_last_modified: canadaSourceMetadata.source_last_modified,
                clip_sha256: canadaSourceMetadata.clip_sha256,
                structures: merged.audit.additional_sourced_footprints,
                role: "deduplicated private reference geometry",
              },
              {
                source: "Living Region estimated roofs",
                licence: null,
                structures: coverage.estimated.length,
                role: "collision-checked local canvassing geometry only",
              },
              {
                source: "Grey County road address ranges",
                path: "know/input/gis/road-centrelines-grey.geojson",
                licence: "local source metadata applies",
                structures: coverage.inferredAddresses.length,
                role: "approximate household numbering for unlinked sourced roofs",
              },
            ],
            audited_absent_sources: [
              "Original City of Owen Sound municipal building GIS feature service or downloadable feature class",
            ],
            excluded_as_building_sources: [
              "empty import templates",
              "fixtures and examples",
              "rural lot and concession polygons",
            ],
            private_reference_layer_added: true,
            os_map_import_allowed: false,
            coverage: coverageAudit,
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
              canada_structures:
                "data/canvassing/canada-structures-owen-sound.geojson",
              owen_sound_city_map:
                "data/canvassing/owen-sound-city-map-buildings.geojson",
              roads: "know/input/gis/road-centrelines-grey.geojson",
              boundary: "data/boundaries/owen-sound.geojson",
            },
            counts: {
              structures: buildings.length,
              canvassable_structures: buildings.filter(
                (building) => building.properties.canvassable,
              ).length,
              canvassable_structures_without_selection_target:
                missingSelectionTargets.length,
              addresses: addresses.length,
              matched_addresses: addresses.filter(
                (a) => a.properties.structure_id,
              ).length,
              sourced_structures: sourcedBuildings.length,
              estimated_structures: coverage.estimated.length,
              unresolved_addresses: matchCounts.unresolved,
              match_confidence: matchCounts,
              roads: roads.length,
              address_review_records: reviewRecords.length,
            },
            source_currency: {
              osm_latest_object_timestamp: "2026-05-18",
              canada_structures: canadaSourceMetadata.source_last_modified,
              owen_sound_city_map: cityMapSourceMetadata.source_map_date,
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
