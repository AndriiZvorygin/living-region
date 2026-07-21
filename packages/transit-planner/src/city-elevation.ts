import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { distanceMetres, type GeoCollection, type Position, type StreetGraph } from "./index";

const ENDPOINT = "https://api.open-meteo.com/v1/elevation";
const SAMPLE_SPACING_M = 250;
export const CITY_ELEVATION_CACHE = "know/input/terrain-cache/open-meteo/owen-sound-city-grid.json";

export type ElevationProfile = {
  elevation_gain_m: number;
  descent_m: number;
  maximum_segment_grade_percent: number;
  raw_maximum_segment_grade_percent: number;
  start_elevation_m: number;
  end_elevation_m: number;
  quality_flags: string[];
};

type Cache = {
  metadata: Record<string, unknown>;
  west: number; south: number; east: number; north: number;
  width: number; height: number;
  elevations: number[];
};

export type CityElevationModel = {
  cache: Cache;
  elevationAt(position: Position): number;
  profile(coordinates: Position[]): ElevationProfile;
  edgeGeoJson(graph: StreetGraph): GeoCollection;
};

async function fetchElevations(points: Position[]): Promise<number[]> {
  const values: number[] = [];
  for (let start = 0; start < points.length; start += 100) {
    const batch = points.slice(start, start + 100);
    const url = `${ENDPOINT}?latitude=${batch.map((p) => p[1].toFixed(6)).join(",")}&longitude=${batch.map((p) => p[0].toFixed(6)).join(",")}`;
    let response: Response | undefined;
    for (let attempt = 0; attempt < 6; attempt++) {
      response = await fetch(url);
      if (response.ok) break;
      if (response.status !== 429 && response.status < 500) throw new Error(`Open-Meteo elevation request failed: ${response.status}`);
      await new Promise((resolve) => setTimeout(resolve, 1_500 * (attempt + 1)));
    }
    if (!response?.ok) throw new Error(`Open-Meteo elevation request failed after retries: ${response?.status ?? "no response"}`);
    const payload = await response.json() as { elevation?: Array<number | null> };
    if (!payload.elevation || payload.elevation.length !== batch.length) throw new Error("Open-Meteo elevation response length mismatch");
    values.push(...payload.elevation.map((value) => {
      if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Open-Meteo returned missing city elevation");
      return value;
    }));
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return values;
}

function makeModel(cache: Cache): CityElevationModel {
  const elevationAt = ([lon, lat]: Position) => {
    const x = Math.max(0, Math.min(cache.width - 1, (lon - cache.west) / (cache.east - cache.west) * (cache.width - 1)));
    const y = Math.max(0, Math.min(cache.height - 1, (lat - cache.south) / (cache.north - cache.south) * (cache.height - 1)));
    const x0 = Math.floor(x), x1 = Math.min(cache.width - 1, x0 + 1), y0 = Math.floor(y), y1 = Math.min(cache.height - 1, y0 + 1);
    const tx = x - x0, ty = y - y0;
    const at = (xx: number, yy: number) => cache.elevations[yy * cache.width + xx];
    return (at(x0, y0) * (1 - tx) + at(x1, y0) * tx) * (1 - ty) + (at(x0, y1) * (1 - tx) + at(x1, y1) * tx) * ty;
  };
  const profile = (coordinates: Position[]): ElevationProfile => {
    const samples: Position[] = [];
    for (let i = 1; i < coordinates.length; i++) {
      const a = coordinates[i - 1], b = coordinates[i];
      const distance = distanceMetres(a, b);
      const divisions = Math.max(1, Math.ceil(distance / 90));
      for (let j = i === 1 ? 0 : 1; j <= divisions; j++) samples.push([a[0] + (b[0] - a[0]) * j / divisions, a[1] + (b[1] - a[1]) * j / divisions]);
    }
    if (!samples.length && coordinates.length) samples.push(coordinates[0]);
    const elevations = samples.map(elevationAt);
    let gain = 0, descent = 0, rawMax = 0, plausibleMax = 0;
    const flags = new Set<string>();
    for (let i = 1; i < samples.length; i++) {
      const delta = elevations[i] - elevations[i - 1];
      if (delta > 0) gain += delta; else descent -= delta;
      const grade = Math.abs(delta) / Math.max(1, distanceMetres(samples[i - 1], samples[i])) * 100;
      rawMax = Math.max(rawMax, grade);
      if (grade <= 20) plausibleMax = Math.max(plausibleMax, grade); else flags.add("implausible_grade_over_20_percent_excluded_from_maximum");
    }
    flags.add("interim_coarse_90m_dem_not_engineering_grade");
    return { elevation_gain_m: +gain.toFixed(1), descent_m: +descent.toFixed(1), maximum_segment_grade_percent: +plausibleMax.toFixed(1), raw_maximum_segment_grade_percent: +rawMax.toFixed(1), start_elevation_m: +(elevations[0] ?? 0).toFixed(1), end_elevation_m: +(elevations.at(-1) ?? 0).toFixed(1), quality_flags: [...flags] };
  };
  const edgeGeoJson = (graph: StreetGraph): GeoCollection => ({ type: "FeatureCollection", features: graph.edges.filter((edge) => edge.id % 2 === 0).map((edge) => ({ type: "Feature", properties: { edge_id: edge.id, ...profile(edge.coordinates), source: "open-meteo-copernicus-dem90", confidence: "interim_coarse_dem" }, geometry: { type: "LineString", coordinates: edge.coordinates } })) });
  return { cache, elevationAt, profile, edgeGeoJson };
}

export async function loadCityElevation(graph: StreetGraph, cachePath = CITY_ELEVATION_CACHE): Promise<CityElevationModel> {
  const existing = await readFile(cachePath, "utf8").catch(() => undefined);
  if (existing) return makeModel(JSON.parse(existing) as Cache);
  const lons = graph.nodes.map((node) => node.lon), lats = graph.nodes.map((node) => node.lat);
  const west = Math.min(...lons), east = Math.max(...lons), south = Math.min(...lats), north = Math.max(...lats);
  const midLat = (south + north) / 2;
  const width = Math.ceil(distanceMetres([west, midLat], [east, midLat]) / SAMPLE_SPACING_M) + 1;
  const height = Math.ceil(distanceMetres([west, south], [west, north]) / SAMPLE_SPACING_M) + 1;
  const points: Position[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) points.push([west + (east - west) * x / (width - 1), south + (north - south) * y / (height - 1)]);
  const cache: Cache = { metadata: { source: "open-meteo-copernicus-dem90", source_url: "https://open-meteo.com/en/docs/elevation-api", endpoint: ENDPOINT, retrieved_at: new Date().toISOString(), product: "Copernicus DEM 2021 GLO-90", nominal_source_resolution_m: 90, city_sampling_interval_m: SAMPLE_SPACING_M, vertical_datum: "not stated by Open-Meteo API; verify upstream Copernicus metadata", licence: "CC BY 4.0", purpose: "interim planning-level bicycle climbing analysis" }, west, south, east, north, width, height, elevations: await fetchElevations(points) };
  await mkdir(dirname(cachePath), { recursive: true });
  await writeFile(cachePath, JSON.stringify(cache, null, 2) + "\n");
  return makeModel(cache);
}
