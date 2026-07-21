import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

type Feature = { type: "Feature"; id?: string | number; properties: Record<string, unknown>; geometry: { type: string; coordinates: any } };
type Collection = { type: "FeatureCollection"; features: Feature[] };
const root = resolve(process.cwd());
const output = join(root, "packages/web-client/public/canvassing");
const stable = (kind: string, source: string) => `${kind}_${createHash("sha256").update(`${kind}:${source}`).digest("hex").slice(0, 20)}`;
const walk = (coordinates: any, visitor: (point: [number, number]) => void) => typeof coordinates?.[0] === "number" ? visitor(coordinates) : coordinates?.forEach((item: any) => walk(item, visitor));
const bboxIntersects = (feature: Feature, bbox: number[]) => { let hit = false; walk(feature.geometry.coordinates, ([x, y]) => { if (x >= bbox[0] && x <= bbox[2] && y >= bbox[1] && y <= bbox[3]) hit = true; }); return hit; };
const polygonContains = (point: [number, number], ring: number[][]) => { let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > point[1]) !== (yj > point[1]) && point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi) inside = !inside; } return inside; };
const centroid = (feature: Feature): [number, number] => { const points: [number, number][] = []; walk(feature.geometry.coordinates, (point) => points.push(point)); return [points.reduce((s, p) => s + p[0], 0) / points.length, points.reduce((s, p) => s + p[1], 0) / points.length]; };
const addressLabel = (p: Record<string, unknown>) => [p["addr:housenumber"], p["addr:street"], p["addr:unit"] ? `Unit ${p["addr:unit"]}` : ""].filter(Boolean).join(" ");

async function main() {
  const temporary = await mkdtemp(join(tmpdir(), "living-region-canvassing-"));
  try {
    const rawPath = join(temporary, "osm.geojson");
    execFileSync("osmium", ["export", join(root, "data/osm/owen-sound.osm.pbf"), "-o", rawPath, "--overwrite", "--add-unique-id=type_id"], { stdio: "inherit" });
    const raw = JSON.parse(await readFile(rawPath, "utf8")) as Collection;
    const boundary = JSON.parse(await readFile(join(root, "data/boundaries/owen-sound.geojson"), "utf8")) as Collection;
    const ring = boundary.features[0].geometry.coordinates[0] as number[][];
    const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
    const bbox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    const inCity = (feature: Feature) => polygonContains(centroid(feature), ring);
    const buildings = raw.features.filter((f) => f.properties.building && ["Polygon", "MultiPolygon"].includes(f.geometry.type) && inCity(f)).map((f) => {
      const sourceId = String(f.id ?? f.properties.id ?? "unknown");
      const rawType = String(f.properties.building);
      const buildingType = ["apartments", "residential", "house", "detached", "semidetached_house", "terrace"].includes(rawType) ? (rawType === "apartments" ? "apartment" : "residential") : ["commercial", "retail", "office", "industrial"].includes(rawType) ? "commercial" : ["school", "hospital", "church", "civic", "public"].includes(rawType) ? "institutional" : ["garage", "garages", "shed", "carport"].includes(rawType) ? "accessory" : "unclassified";
      return { ...f, id: stable("structure", `osm:${sourceId}`), properties: { structure_id: stable("structure", `osm:${sourceId}`), external_source: "openstreetmap", external_id: sourceId, building_type: buildingType, source_building_tag: rawType, source_timestamp: f.properties.timestamp ?? null, confidence: "source_mapped" } };
    });
    const addresses = raw.features.filter((f) => f.properties["addr:housenumber"] && inCity(f)).map((f) => {
      const sourceId = String(f.id ?? f.properties.id ?? "unknown");
      const point = f.geometry.type === "Point" ? f.geometry.coordinates as [number, number] : centroid(f);
      const containing = buildings.filter((building) => building.geometry.type === "Polygon" ? polygonContains(point, building.geometry.coordinates[0]) : building.geometry.coordinates.some((polygon:any) => polygonContains(point, polygon[0]))).map((building) => building.properties.structure_id as string);
      return { type: "Feature" as const, id: stable("address", `osm:${sourceId}`), properties: { address_id: stable("address", `osm:${sourceId}`), external_source: "openstreetmap", external_id: sourceId, civic_number: String(f.properties["addr:housenumber"]), street: String(f.properties["addr:street"] ?? ""), unit: String(f.properties["addr:unit"] ?? ""), label: addressLabel(f.properties), structure_id: containing.length === 1 ? containing[0] : null, association_status: containing.length === 1 ? "spatially_joined" : containing.length > 1 ? "ambiguous_multiple_structures" : "unmatched_point", association_candidates: containing }, geometry: { type: "Point", coordinates: point } };
    });
    const officialRoads = JSON.parse(await readFile(join(root, "know/input/gis/road-centrelines-grey.geojson"), "utf8")) as Collection;
    const roads = officialRoads.features.filter((f) => bboxIntersects(f, bbox)).map((f) => ({ ...f, properties: { road_id: stable("road", `grey:${f.properties.OBJECTID}`), name: f.properties.ROAD_NAME ?? f.properties.STREET_NAM ?? "", road_class: f.properties.STREET_CLA ?? "", source: "Grey County road centrelines" } }));
    await mkdir(output, { recursive: true });
    await Promise.all([
      writeFile(join(output, "structures.geojson"), JSON.stringify({ type: "FeatureCollection", features: buildings }) + "\n"),
      writeFile(join(output, "addresses.geojson"), JSON.stringify({ type: "FeatureCollection", features: addresses }) + "\n"),
      writeFile(join(output, "roads.geojson"), JSON.stringify({ type: "FeatureCollection", features: roads }) + "\n"),
      writeFile(join(output, "boundary.geojson"), JSON.stringify(boundary) + "\n"),
      writeFile(join(output, "parcels.geojson"), JSON.stringify({ type: "FeatureCollection", metadata: { status: "unavailable", reason: "No Owen Sound urban parcel fabric in local repository" }, features: [] }) + "\n"),
      writeFile(join(output, "manifest.json"), JSON.stringify({ generated_at: new Date().toISOString(), crs: "OGC:CRS84 / WGS84 longitude-latitude", extent: bbox, sources: { osm: "data/osm/owen-sound.osm.pbf", roads: "know/input/gis/road-centrelines-grey.geojson", boundary: "data/boundaries/owen-sound.geojson" }, counts: { structures: buildings.length, addresses: addresses.length, matched_addresses: addresses.filter((a) => a.properties.structure_id).length, ambiguous_addresses: addresses.filter((a) => String(a.properties.association_status).startsWith("ambiguous")).length, unmatched_addresses: addresses.filter((a) => a.properties.association_status === "unmatched_point").length, roads: roads.length }, source_currency: { osm_latest_object_timestamp: "2026-05-18", official_roads: "see source manifest; feature-level currency not supplied" } }, null, 2) + "\n")
    ]);
    console.log(`Prepared ${buildings.length} structures, ${addresses.length} addresses and ${roads.length} roads in ${output}`);
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
