import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  areaHaFromGrid,
  clamp01,
  flowDirectionFromLowestNeighbor,
  scoreGardenCell,
  scoreYurtCell,
  solarScore,
  slopeAspectFromElevations,
  type TerrainCell,
  type TerrainGrid
} from "../../sim-core/src/index";
import type { Candidate } from "./fixtures";

const cacheDir = "know/input/terrain-cache/open-meteo";
const endpoint = "https://api.open-meteo.com/v1/elevation";

type ElevationCache = {
  source: "open-meteo-copernicus-dem90";
  candidate_id: string;
  width: number;
  height: number;
  cell_size_m: number;
  origin_lat: number;
  origin_lon: number;
  elevations: number[][];
};

function cachePath(candidate: Candidate, width: number, height: number, cellSizeM: number): string {
  return join(cacheDir, `${candidate.id}_${width}x${height}_${cellSizeM}m.json`);
}

function metresToLatLon(originLat: number, originLon: number, xM: number, zM: number, width: number, height: number, cellSizeM: number): { lat: number; lon: number } {
  const centreX = ((width - 1) * cellSizeM) / 2;
  const centreZ = ((height - 1) * cellSizeM) / 2;
  const northM = centreZ - zM;
  const eastM = xM - centreX;
  const metresPerDegLat = 111_320;
  const metresPerDegLon = Math.max(1, 111_320 * Math.cos((originLat * Math.PI) / 180));
  return {
    lat: originLat + northM / metresPerDegLat,
    lon: originLon + eastM / metresPerDegLon
  };
}

async function fetchElevations(points: Array<{ lat: number; lon: number }>): Promise<number[]> {
  const elevations: number[] = [];
  const batchSize = 100;
  for (let start = 0; start < points.length; start += batchSize) {
    const batch = points.slice(start, start + batchSize);
    const latitude = batch.map((point) => point.lat.toFixed(6)).join(",");
    const longitude = batch.map((point) => point.lon.toFixed(6)).join(",");
    const response = await fetch(`${endpoint}?latitude=${latitude}&longitude=${longitude}`);
    if (!response.ok) throw new Error(`Open-Meteo elevation request failed: ${response.status}`);
    const payload = (await response.json()) as { elevation?: Array<number | null> };
    if (!Array.isArray(payload.elevation) || payload.elevation.length !== batch.length) {
      throw new Error("Open-Meteo elevation response did not match requested point count");
    }
    for (const value of payload.elevation) {
      if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Open-Meteo elevation response contained missing elevation");
      elevations.push(value);
    }
  }
  return elevations;
}

function interpolateElevation(coarse: number[][], xM: number, zM: number, sampleSpacingM: number): number {
  const gx = xM / sampleSpacingM;
  const gz = zM / sampleSpacingM;
  const x0 = Math.max(0, Math.min(coarse[0].length - 1, Math.floor(gx)));
  const z0 = Math.max(0, Math.min(coarse.length - 1, Math.floor(gz)));
  const x1 = Math.max(0, Math.min(coarse[0].length - 1, x0 + 1));
  const z1 = Math.max(0, Math.min(coarse.length - 1, z0 + 1));
  const tx = Math.max(0, Math.min(1, gx - x0));
  const tz = Math.max(0, Math.min(1, gz - z0));
  const north = coarse[z0][x0] * (1 - tx) + coarse[z0][x1] * tx;
  const south = coarse[z1][x0] * (1 - tx) + coarse[z1][x1] * tx;
  return north * (1 - tz) + south * tz;
}

async function loadOrFetchElevationCache(candidate: Candidate, width: number, height: number, cellSizeM: number): Promise<ElevationCache> {
  const path = cachePath(candidate, width, height, cellSizeM);
  const cached = await readFile(path, "utf8").catch(() => undefined);
  if (cached) return JSON.parse(cached) as ElevationCache;

  const sampleSpacingM = Math.max(90, cellSizeM);
  const coarseWidth = Math.ceil(((width - 1) * cellSizeM) / sampleSpacingM) + 1;
  const coarseHeight = Math.ceil(((height - 1) * cellSizeM) / sampleSpacingM) + 1;
  const points: Array<{ lat: number; lon: number }> = [];
  for (let z = 0; z < coarseHeight; z += 1) {
    for (let x = 0; x < coarseWidth; x += 1) {
      points.push(metresToLatLon(candidate.approximate_location.lat, candidate.approximate_location.lon, x * sampleSpacingM, z * sampleSpacingM, width, height, cellSizeM));
    }
  }
  const flatCoarseElevations = await fetchElevations(points);
  const coarseElevations = Array.from({ length: coarseHeight }, (_, z) => flatCoarseElevations.slice(z * coarseWidth, z * coarseWidth + coarseWidth));
  const elevations = Array.from({ length: height }, (_, z) =>
    Array.from({ length: width }, (_, x) => interpolateElevation(coarseElevations, x * cellSizeM, z * cellSizeM, sampleSpacingM))
  );
  const cache: ElevationCache = {
    source: "open-meteo-copernicus-dem90",
    candidate_id: candidate.id,
    width,
    height,
    cell_size_m: cellSizeM,
    origin_lat: candidate.approximate_location.lat,
    origin_lon: candidate.approximate_location.lon,
    elevations
  };
  await mkdir(cacheDir, { recursive: true });
  await writeFile(path, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
  return cache;
}

export async function generateRealElevationTerrainGrid(options: { width?: number; height?: number; cellSizeM?: number; candidate: Candidate }): Promise<TerrainGrid> {
  const width = options.width ?? 60;
  const height = options.height ?? 60;
  const cellSizeM = options.cellSizeM ?? 10;
  const cache = await loadOrFetchElevationCache(options.candidate, width, height, cellSizeM);
  const elevations = cache.elevations;
  const allElevations = elevations.flat();
  const minElevation = Math.min(...allElevations);
  const maxElevation = Math.max(...allElevations);
  const sortedElevations = [...allElevations].sort((a, b) => a - b);
  const q15 = sortedElevations[Math.floor(sortedElevations.length * 0.15)] ?? minElevation;
  const q35 = sortedElevations[Math.floor(sortedElevations.length * 0.35)] ?? minElevation;
  const range = Math.max(1, maxElevation - minElevation);
  const cells: TerrainCell[] = [];

  for (let z = 0; z < height; z += 1) {
    for (let x = 0; x < width; x += 1) {
      const west = elevations[z][Math.max(0, x - 1)];
      const east = elevations[z][Math.min(width - 1, x + 1)];
      const north = elevations[Math.max(0, z - 1)][x];
      const south = elevations[Math.min(height - 1, z + 1)][x];
      const slopeAspect = slopeAspectFromElevations(west, east, north, south, cellSizeM);
      const elevation = elevations[z][x];
      const lowness = clamp01((q35 - elevation) / Math.max(1, q35 - minElevation));
      const wetness_index = clamp01(0.1 + lowness * 0.42 + (elevation <= q15 ? 0.12 : 0));
      const solar_score = solarScore(slopeAspect.aspect_degrees, slopeAspect.slope_degrees);
      const soilClass = wetness_index > 0.72 ? 5 : slopeAspect.slope_degrees > 12 ? 4 : 3;
      const base = {
        id: `cell_${x}_${z}`,
        x_m: x * cellSizeM,
        z_m: z * cellSizeM,
        size_m: cellSizeM,
        elevation_m: Number(elevation.toFixed(2)),
        slope_degrees: Number(slopeAspect.slope_degrees.toFixed(2)),
        aspect_degrees: Number(slopeAspect.aspect_degrees.toFixed(1)),
        solar_score: Number(solar_score.toFixed(3)),
        wetness_index: Number(wetness_index.toFixed(3)),
        flow_direction: flowDirectionFromLowestNeighbor(elevations, x, z),
        soil_type: "unknown; DEM-derived terrain only",
        soil_capability_class: soilClass,
        land_cover: "unknown lot fabric",
        land_use: "base property"
      };
      const yurt = scoreYurtCell(base);
      const garden = scoreGardenCell(base);
      const orchard = clamp01(0.45 * solar_score + 0.28 * (1 - wetness_index) + 0.27 * (1 - clamp01(slopeAspect.slope_degrees / 14)));
      const field = clamp01(0.36 * garden + 0.4 * (1 - clamp01(slopeAspect.slope_degrees / 10)) + 0.24 * (1 - wetness_index));
      const woodlot = clamp01(0.3 + clamp01(slopeAspect.slope_degrees / 15) * 0.25);
      const pond = clamp01(wetness_index * 0.7 + lowness * 0.3);
      const ranked: Array<[TerrainCell["best_uses"][number], number]> = [
        ["yurt", yurt],
        ["garden", garden],
        ["orchard", orchard],
        ["field", field],
        ["woodlot", woodlot],
        ["pond", pond]
      ];
      ranked.sort((a, b) => b[1] - a[1]);
      cells.push({
        ...base,
        yurt_suitability: Number(yurt.toFixed(3)),
        garden_suitability: Number(garden.toFixed(3)),
        orchard_suitability: Number(orchard.toFixed(3)),
        field_suitability: Number(field.toFixed(3)),
        woodlot_suitability: Number(woodlot.toFixed(3)),
        pond_suitability: Number(pond.toFixed(3)),
        best_uses: ranked.slice(0, 2).map(([use]) => use),
        warnings: [
          ...(range < 2 ? ["DEM resolution is coarse relative to the lot view; local microtopography not represented"] : []),
          ...(slopeAspect.slope_degrees > 14 ? ["steep for accessible paths and platforms"] : [])
        ]
      });
    }
  }

  return {
    metadata: {
      grid_width: width,
      grid_height: height,
      cell_size_m: cellSizeM,
      total_area_ha: Number(areaHaFromGrid(width, height, cellSizeM).toFixed(2)),
      min_elevation_m: Number(minElevation.toFixed(2)),
      max_elevation_m: Number(maxElevation.toFixed(2)),
      terrain_source: "open_meteo_copernicus_dem90",
      terrain_source_detail: "Elevations sampled from Open-Meteo Elevation API backed by Copernicus DEM GLO-90. This is real DEM elevation, not OSM and not local LiDAR/DTM.",
      origin_lat: options.candidate.approximate_location.lat,
      origin_lon: options.candidate.approximate_location.lon,
      origin_x_m: 0,
      origin_z_m: 0,
      projection: "LOCAL_TANGENT_METRES_APPROX_FROM_WGS84"
    },
    cells
  };
}
