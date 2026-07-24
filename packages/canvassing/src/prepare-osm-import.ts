import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const input = join(root, "packages/web-client/public/canvassing/structures.geojson");
const output = join(root, "artifacts/owen-sound-building-import");
const privateKeys = [
  "status", "route", "visit", "person", "support", "volunteer", "sign", "note", "household", "address",
];

const ringIsValid = (ring: number[][]) =>
  ring.length >= 4 &&
  ring[0][0] === ring.at(-1)?.[0] &&
  ring[0][1] === ring.at(-1)?.[1] &&
  new Set(ring.map((point) => point.join(","))).size >= 3;

function geometryResult(geometry: any) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
  return polygons.length > 0 && polygons.every((polygon: number[][][]) => ringIsValid(polygon[0])) ? "valid_basic_geometry" : "invalid_or_unsupported";
}

async function main() {
  const source = JSON.parse(await readFile(input, "utf8"));
  const features = source.features.map((feature: any) => ({
    type: "Feature",
    properties: {
      source_footprint_id: feature.properties.external_id,
      source: "OpenStreetMap",
      licence: "ODbL 1.0",
      existing_osm_overlap_result: "existing_osm_building_self",
      geometry_validation_result: geometryResult(feature.geometry),
      candidate_import_batch: null,
    },
    geometry: feature.geometry,
  }));
  const collection = {
    type: "FeatureCollection",
    metadata: {
      purpose: "public building import QA only",
      api_uploading_enabled: false,
      candidate_source_available: false,
      excluded_private_fields: privateKeys,
    },
    features,
  };
  const serialized = JSON.stringify(collection);
  for (const key of privateKeys) {
    if (new RegExp(`"[^"\\n]*${key}[^"\\n]*"\\s*:`, "i").test(serialized)) throw new Error(`Private field leaked into public export: ${key}`);
  }
  await mkdir(output, { recursive: true });
  await writeFile(join(output, "public-building-geography.geojson"), serialized + "\n");
  await writeFile(join(output, "qa-summary.json"), JSON.stringify({ source_features: features.length, valid_basic_geometry: features.filter((feature: any) => feature.properties.geometry_validation_result === "valid_basic_geometry").length, candidate_import_features: 0, api_uploading_enabled: false }, null, 2) + "\n");
  console.log(`Prepared public-only QA geography for ${features.length} existing OSM buildings; 0 import candidates.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
