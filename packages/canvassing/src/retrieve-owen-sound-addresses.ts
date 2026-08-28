import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  GREY_ADDRESS_LIKE_ITEM_URL,
  GREY_BUILDING_FOOTPRINTS_ITEM_URL,
  GREY_BUILDING_FOOTPRINTS_URL,
  GREY_OPEN_DATA_URL,
  GREY_TERMS_URL,
  OWEN_SOUND_CSD_CODE,
  OWEN_SOUND_CSD_NAME,
  STATCAN_NAR_CATALOGUE_URL,
  STATCAN_NAR_GUIDE_URL,
  STATCAN_NAR_PRODUCT_URL,
  STATCAN_NAR_URL,
  discoverCachedNar,
  downloadNar,
  extractOwenSoundNar,
  loadBoundary,
  loadExistingFeatures,
  migrationComparison,
  reconcileExistingAddresses,
  writeFoundationOutputs,
} from "./owen-sound-address-foundation";
import {
  applyAuthoritativePlacements,
  placeNarLocations,
} from "./owen-sound-footprint-placement";
import { validateOwenSoundAddressNumbering } from "./owen-sound-address-numbering";
import { formatOfficialStreet } from "./official-address";
import {
  assertNoAnonymousActiveAddressLabels,
  repairCanvassingStructureAddresses,
} from "./repair-canvassing-addresses";

const root = resolve(process.cwd());
const defaultZip = resolve(
  process.env.CANVASS_ADDRESS_SOURCE_CACHE ??
    "/tmp/living-region-address-cache/202606.zip",
);
const defaultOut = resolve(
  process.env.CANVASS_ADDRESS_FOUNDATION_OUT ??
    "data/derived/owen-sound-address-foundation",
);
const defaultBoundary = resolve("data/boundaries/owen-sound.geojson");
const defaultExisting = resolve("packages/web-client/public/canvassing/addresses.geojson");
const defaultLegacyExisting = resolve(
  process.env.CANVASS_LEGACY_ADDRESS_SOURCE ??
    "data/derived/owen-sound-address-foundation/legacy-address-source.geojson",
);
const defaultStructures = resolve("packages/web-client/public/canvassing/structures.geojson");
const defaultGreyFootprints = resolve("data/canvassing/grey-building-footprints-owen-sound.geojson");
const defaultRoads = resolve("packages/web-client/public/canvassing/roads.geojson");

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasArgument(name: string) {
  return process.argv.includes(name);
}

async function main() {
  const zipPath = resolve(argument("--zip") ?? defaultZip);
  const outDir = resolve(argument("--out") ?? defaultOut);
  const boundaryPath = resolve(argument("--boundary") ?? defaultBoundary);
  const existingPath = resolve(argument("--existing") ?? defaultExisting);
  const structuresPath = resolve(argument("--structures") ?? defaultStructures);
  const greyFootprintsPath = resolve(argument("--grey-footprints") ?? defaultGreyFootprints);
  const roadsPath = resolve(argument("--roads") ?? defaultRoads);
  const retrievalDate = argument("--retrieved-at") ?? new Date().toISOString().slice(0, 10);
  if (hasArgument("--download") || !(await discoverCachedNar(dirname(zipPath))).includes(zipPath)) {
    if (!hasArgument("--download") && process.argv.includes("--zip"))
      throw new Error(`NAR ZIP not found at ${zipPath}; provide --download to retrieve it from the official link`);
    console.log(`Downloading the official June 2026 NAR release to ${zipPath}`);
    await downloadNar(zipPath, argument("--url") ?? STATCAN_NAR_URL);
  }
  const [boundary, existing, legacyExisting, structuresFile, greyFile, roadsFile] = await Promise.all([
    loadBoundary(boundaryPath),
    loadExistingFeatures(existingPath),
    loadExistingFeatures(defaultLegacyExisting).catch(() => []),
    loadExistingFeatures(structuresPath),
    loadExistingFeatures(greyFootprintsPath).catch(() => []),
    loadExistingFeatures(roadsPath).catch(() => []),
  ]);
  const result = await extractOwenSoundNar({
    zipPath,
    boundary,
    retrievalDate,
  });
  const primary = result.units.filter((unit) =>
    ["residential", "partly_residential"].includes(unit.building_use),
  );
  const existingById = new Map<string, (typeof existing)[number]>();
  for (const feature of [...existing, ...legacyExisting]) {
    const id = String(
      feature.properties.address_id ??
        feature.properties.internal_address_id ??
        feature.id ??
        "",
    );
    if (id && !existingById.has(id)) existingById.set(id, feature);
  }
  const reconciliationSourceFeatures = [...existingById.values()];
  const reconciliation = reconcileExistingAddresses(primary, reconciliationSourceFeatures);
  const previousAuthoritativeStructureIds = reconciliationSourceFeatures
    .map((feature) => feature.properties)
    .filter((properties) => properties.external_source === "statistics_canada_national_address_register")
    .map((properties) => String(properties.structure_id ?? ""))
    .filter(Boolean);
  const preferredStructureByLocation = new Map<string, string>();
  const reconciliationByAddress = new Map(reconciliation.matches.map((match) => [match.address_id, match]));
  for (const unit of primary) {
    const match = reconciliationByAddress.get(unit.address_id);
    if (match?.structure_id && !preferredStructureByLocation.has(unit.location_id))
      preferredStructureByLocation.set(unit.location_id, match.structure_id);
  }
  const placement = placeNarLocations({
    locations: result.locations,
    structures: structuresFile,
    greyFootprints: greyFile,
    units: result.units,
    preferredStructureByLocation,
    roads: roadsFile,
  });
  const placedStructures = applyAuthoritativePlacements({
    structures: structuresFile,
    units: result.units,
    placements: placement.placements,
    previousAuthoritativeStructureIds,
    greyFootprints: placement.greyFootprints,
  });
  const placementByLocation = new Map(
    placement.placements.map((item) => [item.location_id, item.structure_id]),
  );
  const placementDetailsByLocation = new Map(
    placement.placements.map((item) => [item.location_id, item]),
  );
  const internalAddressIdByNarId = new Map(
    reconciliation.matches.map((match) => [match.address_id, match.internal_address_id]),
  );
  const addressRepair = repairCanvassingStructureAddresses({
    structures: placedStructures.structures,
    roads: roadsFile,
    addresses: primary.map((unit) => ({
      type: "Feature" as const,
      properties: {
        // The published address feature and the household FK use the stable
        // internal ID. Keep the NAR ADDR_GUID in source_address_guid so the
        // structure target materialization cannot accidentally manufacture a
        // second household ID from the external GUID.
        address_id: internalAddressIdByNarId.get(unit.address_id) ?? unit.internal_address_id,
        source_address_guid: unit.address_id,
        civic_number: unit.civic_number,
        civic_number_base: unit.civic_number,
        street: formatOfficialStreet(
          unit.official_street_name,
          unit.official_street_type,
          unit.official_street_direction,
        ),
        structure_id: placementByLocation.get(unit.location_id) ?? null,
        nar_placement_status:
          placementDetailsByLocation.get(unit.location_id)?.status ?? "unmatched",
        nar_placement_distance_m:
          placementDetailsByLocation.get(unit.location_id)?.distance_m ?? null,
        nar_match_method:
          placementDetailsByLocation.get(unit.location_id)?.match_method ?? "unresolved",
        nar_address_quality:
          placementDetailsByLocation.get(unit.location_id)?.confidence_classification ?? "unresolved",
        nar_validation:
          placementDetailsByLocation.get(unit.location_id)?.validation ?? null,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [unit.longitude, unit.latitude],
      },
    })),
    legacyAddresses: legacyExisting,
  });
  assertNoAnonymousActiveAddressLabels(placedStructures.structures);
  const placementStructureIds = new Set(
    placement.placements
      .map((item) => item.structure_id)
      .filter((value): value is string => Boolean(value)),
  );
  const selectedGreyFootprintIds = new Set(
    placement.placements
      .filter((item) => item.footprint_source === "grey_county_building_footprints")
      .map((item) => item.footprint_id)
      .filter((value): value is string => Boolean(value)),
  );
  const oldStructureById = new Map(
    structuresFile.map((feature) => [String(feature.properties.structure_id ?? feature.id), feature]),
  );
  const estimatedLabelsReplaced = [...placementStructureIds].filter((id) =>
    String(oldStructureById.get(id)?.properties.civic_label ?? "").startsWith("~"),
  ).length;
  const usableOldFootprints = structuresFile.filter((feature) =>
    feature.properties.external_source !== "living_region_estimate" &&
    String(feature.properties.building_type ?? "").toLowerCase() !== "accessory",
  );
  const numberingReport = validateOwenSoundAddressNumbering(primary, roadsFile);
  const comparison = migrationComparison(result, reconciliationSourceFeatures);
  const sourceManifest = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    geography: {
      province_code: "35",
      csd_code: OWEN_SOUND_CSD_CODE,
      csd_name: OWEN_SOUND_CSD_NAME,
      boundary_path: "data/boundaries/owen-sound.geojson",
      boundary_rule: "CSD_CODE=3542059 joined through LOC_GUID, plus point-in-polygon validation against the repository Owen Sound municipal boundary",
    },
    selected_source: {
      name: "Statistics Canada National Address Register, June 2026",
      catalogue_url: STATCAN_NAR_CATALOGUE_URL,
      product_url: STATCAN_NAR_PRODUCT_URL,
      user_guide_url: STATCAN_NAR_GUIDE_URL,
      download_url: argument("--url") ?? STATCAN_NAR_URL,
      retrieval_date: retrievalDate,
      licence: "Statistics Canada Open Licence Agreement",
      raw_cache_path: "/tmp/living-region-address-cache/202606.zip (outside the repository; override with CANVASS_ADDRESS_SOURCE_CACHE)",
      raw_files_are_not_committed: true,
      coordinate_selection: "paired BG_LATITUDE/BG_LONGITUDE building coordinate; BF_REPPOINT used only when BG is unavailable and labelled as a fallback",
    },
    supplemental_source: {
      name: "Grey County Building Footprints - Open Data",
      public_gis_application_item_id: "645d414b2614427e91efc9c197c79657",
      public_open_data_group_id: "0810446c724f4ebf81fbe7be185da5c8",
      item_url: GREY_BUILDING_FOOTPRINTS_ITEM_URL,
      service_url: GREY_BUILDING_FOOTPRINTS_URL,
      layer_id: 0,
      open_data_url: GREY_OPEN_DATA_URL,
      licence: "Grey County Open Data Licence",
      required_attribution: "Contains information licensed under the Grey County Open Data Licence.",
      service_capabilities: "public query service; maxRecordCount 2000; WGS84 export available through ArcGIS service",
      role: "licensed physical-building geometry reference; not used as the address-unit authority",
    },
    rejected_address_source: {
      name: "Grey County Assessment Parcel v2 / Addresses",
      item_url: GREY_ADDRESS_LIKE_ITEM_URL,
      reason: "The public table exposes MPAC/Teranet assessment address data and roll-number fields, but its item metadata does not state the Grey County Open Data Licence. It was not used for the derived campaign address dataset, and roll numbers were not collected.",
      grey_terms_url: GREY_TERMS_URL,
    },
    comparison_source: {
      name: "Open Database of Addresses, 2021",
      role: "not used; retained only as a possible historical comparison because the newer June 2026 NAR was sufficiently complete",
    },
    privacy: {
      excluded_fields: ["roll_number", "resident_name", "telephone", "property_owner_information"],
      note: "The NAR is a non-confidential address reference and does not identify residents or businesses.",
    },
    reconciliation_method: {
      exact_key: "normalized civic number + normalized official street components + normalized apartment/suite",
      fallback_key: "normalized civic number + normalized street components with an unused existing row no more than 75 metres away",
      existing_id_policy: "reuse the existing internal address_id when matched so household and visit foreign keys remain stable; otherwise use a SHA-256-derived ID from the NAR ADDR_GUID",
      unmatched_existing_policy: "retain in SQLite through the existing source_active lifecycle and export for review; do not delete historical households or events",
    },
      counts: comparison,
      physical_footprint_matching: {
        threshold_m: 50,
        grey_snapshot_path: "data/canvassing/grey-building-footprints-owen-sound.geojson",
        fallback_structure_path: "packages/web-client/public/canvassing/structures.geojson",
        placement_statuses: "exact, nearest, ambiguous, unmatched; authoritative points are never discarded because a footprint is unresolved",
      },
      numbering_validation: {
        rules: "Owen Sound numbered-grid parity, direction, hundred-block, cross-road, and monotonic progression checks; authoritative NAR values are preserved and anomalies are review flags",
        report: "address-numbering-validation.json",
      },
  };
  await writeFoundationOutputs({
    result,
    reconciliation,
    existingFeatures: reconciliationSourceFeatures,
    outDir,
    publishAddressesPath: hasArgument("--publish") ? defaultExisting : undefined,
    sourceManifest,
    structures: placedStructures.structures,
    placements: placement.placements,
    numberingReport,
    roadCount: roadsFile.length,
    audit: {
      address_display: {
        nar_locations_with_placement: placement.placements.filter((item) => item.structure_id).length,
        unique_structures_receiving_nar: placementStructureIds.size,
        estimated_structure_labels_replaced: estimatedLabelsReplaced,
        active_address_labels_are_nar_formatted: true,
        former_estimated_labels_are_not_used_for_nar_address_units: true,
        operational_roof_address_repair: addressRepair,
      },
      physical_footprint_audit: {
        usable_existing_footprints: usableOldFootprints.length,
        grey_footprints_retrieved: greyFile.length,
        unaddressed_usable_footprints_excluded_from_canvassing_locations:
          usableOldFootprints.filter((feature) => !placementStructureIds.has(String(feature.properties.structure_id ?? feature.id))).length +
          greyFile.filter((feature) => !selectedGreyFootprintIds.has(String(feature.properties.OBJECTID ?? feature.properties.objectid ?? feature.id))).length,
        multi_address_structures: placedStructures.structures.filter((feature) => Number(feature.properties.address_count ?? 0) > 1).length,
      },
    },
  });
  console.log(JSON.stringify({
    source: sourceManifest.selected_source.name,
    output: outDir,
    source_counts: result.source_counts,
    validation: result.validation,
    reconciliation: comparison,
    footprint_placement: {
      ...placement.placements.reduce((counts, item) => {
        counts[item.status] = (counts[item.status] ?? 0) + 1;
        return counts;
      }, {} as Record<string, number>),
      grey_snapshot_features: greyFile.length,
    },
    numbering: numberingReport.summary,
    published_to_existing_bundle: hasArgument("--publish"),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
