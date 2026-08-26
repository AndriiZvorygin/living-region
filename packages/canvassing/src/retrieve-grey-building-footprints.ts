import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import https from "node:https";
import {
  GREY_BUILDING_FOOTPRINTS_ITEM_URL,
  GREY_BUILDING_FOOTPRINTS_URL,
  GREY_OPEN_DATA_URL,
  GREY_TERMS_URL,
} from "./owen-sound-address-foundation";

const serviceLayerUrl = `${GREY_BUILDING_FOOTPRINTS_URL}/0`;
const defaultOutput = resolve(
  process.env.CANVASS_GREY_BUILDINGS_OUT ??
    "data/canvassing/grey-building-footprints-owen-sound.geojson",
);
const defaultMetadata = resolve(
  process.env.CANVASS_GREY_BUILDINGS_METADATA ??
    "data/canvassing/grey-building-footprints-source.json",
);

function requestJson(url: string) {
  return new Promise<any>((resolvePromise, reject) => {
    const request = https.get(
      url,
      { family: 4, headers: { accept: "application/json", "user-agent": "living-region-canvassing-address-retriever/1.0" } },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => (body += chunk));
        response.on("end", () => {
          if ((response.statusCode ?? 500) < 200 || (response.statusCode ?? 500) >= 300)
            return reject(new Error(`Grey County request failed: ${response.statusCode}`));
          try { resolvePromise(JSON.parse(body)); }
          catch (error) { reject(new Error(`Grey County returned invalid JSON: ${String(error)}`)); }
        });
      },
    );
    request.setTimeout(120_000, () => request.destroy(new Error("Grey County request timed out")));
    request.on("error", reject);
  });
}

function query(parameters: Record<string, string | number>) {
  const url = new URL(`${serviceLayerUrl}/query`);
  url.searchParams.set("f", parameters.returnCountOnly ? "json" : "geojson");
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, String(value));
  return requestJson(url.toString());
}

async function main() {
  const output = resolve(process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : defaultOutput);
  const metadataPath = resolve(process.argv.includes("--metadata") ? process.argv[process.argv.indexOf("--metadata") + 1] : defaultMetadata);
  const boundary = JSON.parse(await readFile("data/boundaries/owen-sound.geojson", "utf8"));
  const points: number[][] = [];
  const walk = (coordinates: any) => typeof coordinates?.[0] === "number" ? points.push(coordinates) : coordinates?.forEach(walk);
  for (const feature of boundary.features ?? []) walk(feature.geometry.coordinates);
  const xs = points.map((point) => point[0]), ys = points.map((point) => point[1]);
  const geometry = `${Math.min(...xs)},${Math.min(...ys)},${Math.max(...xs)},${Math.max(...ys)}`;
  const countResponse = await query({
    where: "1=1",
    geometry,
    geometryType: "esriGeometryEnvelope",
    inSR: 4326,
    spatialRel: "esriSpatialRelIntersects",
    returnCountOnly: "true",
  });
  const expected = Number(countResponse.count ?? 0);
  const features: any[] = [];
  for (let offset = 0; offset < expected || (expected === 0 && !features.length); offset += 2000) {
    const page = await query({
      where: "1=1",
      geometry,
      geometryType: "esriGeometryEnvelope",
      inSR: 4326,
      spatialRel: "esriSpatialRelIntersects",
      outFields: "*",
      returnGeometry: "true",
      outSR: 4326,
      resultOffset: offset,
      resultRecordCount: 2000,
    });
    features.push(...(page.features ?? []));
    if (!page.exceededTransferLimit && features.length >= expected) break;
    if (!page.features?.length) break;
  }
  await mkdir(dirname(output), { recursive: true });
  await mkdir(dirname(metadataPath), { recursive: true });
  const retrievedAt = new Date().toISOString();
  await writeFile(output, JSON.stringify({ type: "FeatureCollection", features, metadata: { retrieved_at: retrievedAt, source: serviceLayerUrl } }) + "\n");
  await writeFile(metadataPath, JSON.stringify({
    schema_version: 1,
    source: "Grey County Building Footprints - Open Data",
    item_url: GREY_BUILDING_FOOTPRINTS_ITEM_URL,
    service_url: GREY_BUILDING_FOOTPRINTS_URL,
    layer_id: 0,
    query_geometry: geometry,
    query_count: expected,
    feature_count: features.length,
    retrieval_date: retrievedAt.slice(0, 10),
    open_data_url: GREY_OPEN_DATA_URL,
    terms_url: GREY_TERMS_URL,
    licence: "Grey County Open Data Licence",
    required_attribution: "Contains information licensed under the Grey County Open Data Licence.",
    note: "Building footprints are supplemental physical geometry. Statistics Canada's National Address Register remains the civic-address authority.",
  }, null, 2) + "\n");
  console.log(JSON.stringify({ output, metadataPath, expected, feature_count: features.length }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
