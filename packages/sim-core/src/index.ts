export type SuitabilityUse = "yurt" | "garden" | "orchard" | "field" | "woodlot" | "pond";

export type TerrainCell = {
  id: string;
  x_m: number;
  z_m: number;
  size_m: number;
  elevation_m: number;
  slope_degrees: number;
  aspect_degrees: number;
  solar_score: number;
  wetness_index: number;
  flow_direction: string;
  soil_type: string;
  soil_capability_class: number;
  land_cover: string;
  land_use: string;
  yurt_suitability: number;
  garden_suitability: number;
  orchard_suitability: number;
  field_suitability: number;
  woodlot_suitability: number;
  pond_suitability: number;
  best_uses: SuitabilityUse[];
  warnings: string[];
};

export type TerrainGrid = {
  metadata: {
    grid_width: number;
    grid_height: number;
    cell_size_m: number;
    total_area_ha: number;
    min_elevation_m: number;
    max_elevation_m: number;
    terrain_source?: "ontario_dtm" | "canada_dem" | "open_meteo_copernicus_dem90" | "procedural_fallback";
    terrain_source_detail?: string;
    origin_lat: number;
    origin_lon: number;
    origin_x_m: number;
    origin_z_m: number;
    projection: string;
  };
  cells: TerrainCell[];
};

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function areaHaFromGrid(width: number, height: number, cellSizeM: number): number {
  return (width * height * cellSizeM * cellSizeM) / 10_000;
}

export function slopeAspectFromElevations(
  west: number,
  east: number,
  north: number,
  south: number,
  cellSizeM: number
): { slope_degrees: number; aspect_degrees: number } {
  const dzdx = (east - west) / (2 * cellSizeM);
  const dzdz = (south - north) / (2 * cellSizeM);
  const slopeRadians = Math.atan(Math.sqrt(dzdx * dzdx + dzdz * dzdz));
  const aspectRadians = Math.atan2(dzdx, dzdz);
  const aspect = (180 + (aspectRadians * 180) / Math.PI + 360) % 360;
  return {
    slope_degrees: (slopeRadians * 180) / Math.PI,
    aspect_degrees: aspect
  };
}

export function solarScore(aspectDegrees: number, slopeDegrees: number): number {
  const southness = (Math.cos(((aspectDegrees - 180) * Math.PI) / 180) + 1) / 2;
  const slopeBonus = clamp01(1 - Math.abs(slopeDegrees - 8) / 30);
  return clamp01(0.25 + 0.55 * southness + 0.2 * slopeBonus);
}

export function scoreYurtCell(cell: Pick<TerrainCell, "slope_degrees" | "wetness_index" | "soil_capability_class" | "solar_score">): number {
  return clamp01(
    0.42 * (1 - clamp01(cell.slope_degrees / 18)) +
      0.28 * (1 - cell.wetness_index) +
      0.18 * cell.solar_score +
      0.12 * clamp01((5 - cell.soil_capability_class) / 4)
  );
}

export function scoreGardenCell(cell: Pick<TerrainCell, "slope_degrees" | "wetness_index" | "soil_capability_class" | "solar_score">): number {
  return clamp01(
    0.42 * cell.solar_score +
      0.28 * clamp01((5 - cell.soil_capability_class) / 4) +
      0.2 * (1 - clamp01(cell.slope_degrees / 12)) +
      0.1 * (1 - Math.abs(cell.wetness_index - 0.35))
  );
}

export function flowDirectionFromLowestNeighbor(
  elevations: number[][],
  x: number,
  z: number
): string {
  const here = elevations[z][x];
  const dirs = [
    ["N", 0, -1],
    ["NE", 1, -1],
    ["E", 1, 0],
    ["SE", 1, 1],
    ["S", 0, 1],
    ["SW", -1, 1],
    ["W", -1, 0],
    ["NW", -1, -1]
  ] as const;
  let best = { dir: "sink", elevation: here };
  for (const [dir, dx, dz] of dirs) {
    const row = elevations[z + dz];
    const elevation = row?.[x + dx];
    if (typeof elevation === "number" && elevation < best.elevation) {
      best = { dir, elevation };
    }
  }
  return best.dir;
}

export type RouteSurface = "road" | "path" | "field" | "off_path" | "wet";

export type RoutePoint = {
  id: string;
  label: string;
  x_m: number;
  z_m: number;
};

export type RouteCostOptions = {
  baseWalkingSpeedMps?: number;
  loadModifier?: number;
  winterModifier?: number;
  surfaceAt?: (x_m: number, z_m: number, cell: TerrainCell) => RouteSurface;
};

export type RouteCostResult = {
  distance_m: number;
  time_minutes: number;
  effort_multiplier: number;
  path: Array<[number, number]>;
};

function terrainCellAt(grid: TerrainGrid, x: number, z: number): TerrainCell {
  const clampedX = Math.max(0, Math.min(grid.metadata.grid_width - 1, x));
  const clampedZ = Math.max(0, Math.min(grid.metadata.grid_height - 1, z));
  return grid.cells[clampedZ * grid.metadata.grid_width + clampedX];
}

function gridIndexForPoint(grid: TerrainGrid, point: Pick<RoutePoint, "x_m" | "z_m">): { x: number; z: number } {
  return {
    x: Math.max(0, Math.min(grid.metadata.grid_width - 1, Math.round(point.x_m / grid.metadata.cell_size_m))),
    z: Math.max(0, Math.min(grid.metadata.grid_height - 1, Math.round(point.z_m / grid.metadata.cell_size_m)))
  };
}

export function routeSurfaceModifier(surface: RouteSurface): number {
  if (surface === "road") return 0.82;
  if (surface === "path") return 0.95;
  if (surface === "field") return 1.12;
  if (surface === "wet") return 1.55;
  return 1.25;
}

export function routeSlopeModifier(slopeDegrees: number): number {
  return 1 + Math.pow(Math.max(0, slopeDegrees) / 14, 1.35);
}

export function calculateRouteTime(
  grid: TerrainGrid,
  start: RoutePoint,
  end: RoutePoint,
  options: RouteCostOptions = {}
): RouteCostResult {
  const baseWalkingSpeedMps = options.baseWalkingSpeedMps ?? 1.25;
  const loadModifier = options.loadModifier ?? 1;
  const winterModifier = options.winterModifier ?? 1;
  const startIndex = gridIndexForPoint(grid, start);
  const endIndex = gridIndexForPoint(grid, end);
  const width = grid.metadata.grid_width;
  const height = grid.metadata.grid_height;
  const cellSize = grid.metadata.cell_size_m;
  const count = width * height;
  const dist = Array.from({ length: count }, () => Number.POSITIVE_INFINITY);
  const prev: Array<{ x: number; z: number } | undefined> = new Array(count).fill(undefined);
  const visited = new Set<number>();
  const indexOf = (x: number, z: number) => z * width + x;
  const startFlat = indexOf(startIndex.x, startIndex.z);
  const endFlat = indexOf(endIndex.x, endIndex.z);
  dist[startFlat] = 0;

  while (visited.size < count) {
    let current = -1;
    let best = Number.POSITIVE_INFINITY;
    for (let index = 0; index < count; index += 1) {
      if (!visited.has(index) && dist[index] < best) {
        current = index;
        best = dist[index];
      }
    }
    if (current === -1 || current === endFlat) break;
    visited.add(current);
    const x = current % width;
    const z = Math.floor(current / width);
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dz === 0) continue;
        const nx = x + dx;
        const nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= width || nz >= height) continue;
        const next = indexOf(nx, nz);
        if (visited.has(next)) continue;
        const cell = terrainCellAt(grid, nx, nz);
        const stepDistance = cellSize * (dx !== 0 && dz !== 0 ? Math.SQRT2 : 1);
        const surface = options.surfaceAt?.(cell.x_m, cell.z_m, cell) ?? (cell.wetness_index > 0.72 ? "wet" : "off_path");
        const stepSeconds =
          (stepDistance / baseWalkingSpeedMps) *
          routeSlopeModifier(cell.slope_degrees) *
          routeSurfaceModifier(surface) *
          loadModifier *
          winterModifier;
        const candidate = dist[current] + stepSeconds;
        if (candidate < dist[next]) {
          dist[next] = candidate;
          prev[next] = { x, z };
        }
      }
    }
  }

  const reversed: Array<[number, number]> = [];
  let cursor: { x: number; z: number } = endIndex;
  let guard = 0;
  while (guard < count) {
    const cell = terrainCellAt(grid, cursor.x, cursor.z);
    reversed.push([cell.x_m, cell.z_m]);
    if (cursor.x === startIndex.x && cursor.z === startIndex.z) break;
    const previous = prev[indexOf(cursor.x, cursor.z)];
    if (!previous) break;
    cursor = previous;
    guard += 1;
  }
  const path = reversed.reverse();
  let distanceM = 0;
  for (let index = 0; index < path.length - 1; index += 1) {
    distanceM += Math.hypot(path[index + 1][0] - path[index][0], path[index + 1][1] - path[index][1]);
  }
  const straightSeconds = Math.max(1, distanceM / baseWalkingSpeedMps);
  return {
    distance_m: Number(distanceM.toFixed(1)),
    time_minutes: Number((dist[endFlat] / 60).toFixed(1)),
    effort_multiplier: Number(Math.max(1, dist[endFlat] / straightSeconds).toFixed(2)),
    path
  };
}
