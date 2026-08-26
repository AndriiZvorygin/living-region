import { mkdir } from "node:fs/promises";
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
  const retrievalDate = argument("--retrieved-at") ?? new Date().toISOString().slice(0, 10);
  if (hasArgument("--download") || !(await discoverCachedNar(dirname(zipPath))).includes(zipPath)) {
    if (!hasArgument("--download") && process.argv.includes("--zip"))
      throw new Error(`NAR ZIP not found at ${zipPath}; provide --download to retrieve it from the official link`);
    console.log(`Downloading the official June 2026 NAR release to ${zipPath}`);
    await downloadNar(zipPath, argument("--url") ?? STATCAN_NAR_URL);
  }
  const [boundary, existing] = await Promise.all([
    loadBoundary(boundaryPath),
    loadExistingFeatures(existingPath),
  ]);
  const result = await extractOwenSoundNar({
    zipPath,
    boundary,
    retrievalDate,
  });
  const primary = result.units.filter((unit) =>
    ["residential", "partly_residential"].includes(unit.building_use),
  );
  const reconciliation = reconcileExistingAddresses(primary, existing);
  const comparison = migrationComparison(result, existing);
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
  };
  await writeFoundationOutputs({
    result,
    reconciliation,
    existingFeatures: existing,
    outDir,
    publishAddressesPath: hasArgument("--publish") ? defaultExisting : undefined,
    sourceManifest,
  });
  console.log(JSON.stringify({
    source: sourceManifest.selected_source.name,
    output: outDir,
    source_counts: result.source_counts,
    validation: result.validation,
    reconciliation: comparison,
    published_to_existing_bundle: hasArgument("--publish"),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
