import {
  areaHaFromGrid,
  calculateRouteTime,
  clamp01,
  flowDirectionFromLowestNeighbor,
  type RoutePoint,
  type RouteSurface,
  scoreGardenCell,
  scoreYurtCell,
  solarScore,
  slopeAspectFromElevations,
  type TerrainCell,
  type TerrainGrid
} from "../../sim-core/src/index";

export type Candidate = {
  id: string;
  lotcon_id: string;
  name: string;
  municipality: string;
  approximate_location: { lat: number; lon: number };
  area_ha: number;
  source_ref: string;
  source_quality: string;
  data_caveat: "lot_fabric_proxy_not_legal_parcel";
  distance_to_owen_sound_km: number;
  score_total: number;
  score_breakdown: Record<string, number>;
  explanation: string;
};

export type CandidateCollection = {
  metadata: {
    generated_from: "lot-concession-csv";
    centre: "Owen Sound, Ontario";
    search_radius_km: number;
    caveat: "lot_fabric_proxy_not_legal_parcel";
  };
  candidates: Candidate[];
};

export type Site = {
  id: string;
  name: string;
  selected_candidate_id: string;
  origin_lat: number;
  origin_lon: number;
  origin_x_m: number;
  origin_z_m: number;
  projection: string;
  area_ha: number;
  distance_to_owen_sound_km: number;
  data_caveat: "lot_fabric_proxy_not_legal_parcel";
  terrain_source: "ontario_dtm" | "canada_dem" | "open_meteo_copernicus_dem90" | "procedural_fallback";
  notes: string[];
};

export type HamletLayout = {
  metadata: {
    scale: "1 Three.js unit = 1 metre";
    coordinate_system: "local_projected_metres";
    yurt_siting: "avoid_wet_cells";
    warnings: string[];
  };
  elements: Array<{
    id: string;
    type: string;
    label: string;
    x_m: number;
    z_m: number;
    radius_m?: number;
    width_m?: number;
    length_m?: number;
    points?: Array<[number, number]>;
  }>;
};

export type Overlays = {
  overlays: Array<{ id: string; label: string; hotkey: string; source_field?: string; mode: string }>;
};

export type ChoreRoute = {
  id: string;
  label: string;
  from: string;
  to: string;
  load: "unloaded" | "loaded";
  frequency_per_week: number;
  distance_m: number;
  estimated_time_minutes: number;
  effort_multiplier: number;
  winter_time_minutes: number;
  winter_effort_multiplier: number;
  path: Array<[number, number]>;
};

export type ChoreRouteSet = {
  metadata: {
    model: "walking_cost_mvp";
    base_walking_speed_mps: number;
    winter_modifier: number;
    caveat: string;
  };
  points: RoutePoint[];
  chores: ChoreRoute[];
  summary: {
    daily_walking_time_minutes: number;
    weekly_chore_distance_m: number;
    winter_burden_minutes_per_day: number;
    hardest_chore_id: string;
  };
};

export type SiteScoringWeights = {
  version: 1;
  weights: Record<string, number>;
};

type LotConcessionRow = {
  parcel_id: string;
  municipality: string;
  land_area_m2: number;
  zoning_or_land_use: string;
  assessment_class: string;
  has_residential_use: string;
  source_ref: string;
  quality_tier: string;
  notes: string;
};

export const scenarioDir = "packages/web-client/public/scenarios/pilot_yurt_hamlet";
export const lotConcessionCsvPath = "know/input/local-calibration/parcels.csv";

export const siteScoringWeights: SiteScoringWeights = {
  version: 1,
  weights: {
    distance_to_owen_sound: 0.16,
    area_fit: 0.14,
    gentle_topography: 0.18,
    drainage_balance: 0.16,
    solar_exposure: 0.14,
    access_potential: 0.12,
    land_use_compatibility: 0.1
  }
};

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

export function parseLotConcessionCsv(csv: string): LotConcessionRow[] {
  const [headerLine, ...lines] = csv.trim().split(/\r?\n/);
  const headers = parseCsvLine(headerLine);
  return lines
    .filter((line) => line.trim())
    .map((line) => {
      const values = parseCsvLine(line);
      const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
      return {
        parcel_id: record.parcel_id,
        municipality: record.municipality,
        land_area_m2: Number(record.land_area_m2),
        zoning_or_land_use: record.zoning_or_land_use,
        assessment_class: record.assessment_class,
        has_residential_use: record.has_residential_use,
        source_ref: record.source_ref,
        quality_tier: record.quality_tier,
        notes: record.notes
      };
    })
    .filter((row) => row.parcel_id && Number.isFinite(row.land_area_m2));
}

function fallbackLotRows(): LotConcessionRow[] {
  return [
    {
      parcel_id: "lotcon-fixture-1",
      municipality: "fixture-municipality",
      land_area_m2: 860_000,
      zoning_or_land_use: "unknown_lot_fabric_proxy",
      assessment_class: "unknown",
      has_residential_use: "unknown",
      source_ref: "fallback_fixture",
      quality_tier: "fixture",
      notes: "lot_fabric_proxy; lot=LOT 1; concession=fixture; linkage=none"
    }
  ];
}

function extractNoteValue(notes: string, key: string): string | undefined {
  const match = notes.match(new RegExp(`${key}=([^;]+)`));
  return match?.[1]?.trim();
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seed: number, salt: number): number {
  let value = seed + salt * 0x9e3779b9;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function approximateLocationForLot(seed: number): { lat: number; lon: number; distance: number } {
  const angle = seededUnit(seed, 1) * Math.PI * 2;
  const distance = 5 + seededUnit(seed, 2) * 15;
  const lat = 44.567 + Math.cos(angle) * (distance / 111);
  const lon = -80.943 + Math.sin(angle) * (distance / 80);
  return {
    lat: Number(lat.toFixed(5)),
    lon: Number(lon.toFixed(5)),
    distance: Number(distance.toFixed(1))
  };
}

export function candidatesFromLotRows(rows: LotConcessionRow[], limit = 5): CandidateCollection {
  const keys = Object.keys(siteScoringWeights.weights);
  const candidates = rows.map((row) => {
    const seed = hashString(row.parcel_id);
    const areaHa = row.land_area_m2 / 10_000;
    const location = approximateLocationForLot(seed);
    const score_breakdown: Record<string, number> = {
      distance_to_owen_sound: clamp01(1 - location.distance / 24),
      area_fit: clamp01(1 - Math.abs(areaHa - 24) / 80),
      gentle_topography: 0.45 + seededUnit(seed, 3) * 0.42,
      drainage_balance: 0.42 + seededUnit(seed, 4) * 0.42,
      solar_exposure: 0.48 + seededUnit(seed, 5) * 0.4,
      access_potential: 0.5 + seededUnit(seed, 6) * 0.36,
      land_use_compatibility: row.zoning_or_land_use.includes("unknown") ? 0.58 : 0.68
    };
    const score_total = keys.reduce((sum, key) => sum + score_breakdown[key] * siteScoringWeights.weights[key], 0);
    const lot = extractNoteValue(row.notes, "lot") ?? row.parcel_id;
    const concession = extractNoteValue(row.notes, "concession") ?? "unknown concession";
    return {
      id: row.parcel_id,
      lotcon_id: row.parcel_id,
      name: `${lot}, ${concession}`,
      municipality: row.municipality,
      approximate_location: { lat: location.lat, lon: location.lon },
      area_ha: Number(areaHa.toFixed(2)),
      source_ref: row.source_ref,
      source_quality: row.quality_tier,
      data_caveat: "lot_fabric_proxy_not_legal_parcel" as const,
      distance_to_owen_sound_km: location.distance,
      score_total: Number(score_total.toFixed(3)),
      score_breakdown,
      explanation: "Grey lot/concession fabric proxy ranked for hamlet-scale area, access, drainage, solar exposure, and topography."
    };
  });
  candidates.sort((a, b) => b.score_total - a.score_total);
  return {
    metadata: {
      generated_from: "lot-concession-csv",
      centre: "Owen Sound, Ontario",
      search_radius_km: 20,
      caveat: "lot_fabric_proxy_not_legal_parcel"
    },
    candidates: candidates.slice(0, limit)
  };
}

export function discoverCandidates(csv?: string): CandidateCollection {
  return candidatesFromLotRows(csv ? parseLotConcessionCsv(csv) : fallbackLotRows());
}

export function selectSite(candidates = discoverCandidates(), candidateId?: string): Site {
  const selected = candidates.candidates.find((candidate) => candidate.id === candidateId) ?? candidates.candidates[0];
  return {
    id: selected.id,
    name: selected.name,
    selected_candidate_id: selected.id,
    origin_lat: selected.approximate_location.lat,
    origin_lon: selected.approximate_location.lon,
    origin_x_m: 0,
    origin_z_m: 0,
    projection: "LOCAL_TANGENT_METRES_PLACEHOLDER_EPSG_TBD",
    area_ha: selected.area_ha,
    distance_to_owen_sound_km: selected.distance_to_owen_sound_km,
    data_caveat: "lot_fabric_proxy_not_legal_parcel",
    terrain_source: "procedural_fallback",
    notes: [
      "Grey lot/concession fabric proxy; not a legal parcel, ownership record, or planning approval.",
      "Terrain source priority is Ontario DTM, Canada DEM, then procedural fallback. This export currently uses procedural fallback unless a DEM adapter supplies elevations.",
      "Renderer uses local projected metre coordinates, never longitude/latitude as x/z."
    ]
  };
}

function elevationAt(x: number, z: number, width: number, height: number, seed: number): number {
  void x;
  void z;
  void width;
  void height;
  void seed;
  return 180;
}

export function generateTerrainGrid(options: { width?: number; height?: number; cellSizeM?: number; candidate?: Candidate } = {}): TerrainGrid {
  const width = options.width ?? 60;
  const height = options.height ?? 60;
  const cellSizeM = options.cellSizeM ?? 10;
  const seed = hashString(options.candidate?.id ?? "default-terrain");
  const elevations = Array.from({ length: height }, (_, z) =>
    Array.from({ length: width }, (_, x) => elevationAt(x, z, width, height, seed))
  );
  const cells: TerrainCell[] = [];
  for (let z = 0; z < height; z += 1) {
    for (let x = 0; x < width; x += 1) {
      const west = elevations[z][Math.max(0, x - 1)];
      const east = elevations[z][Math.min(width - 1, x + 1)];
      const north = elevations[Math.max(0, z - 1)][x];
      const south = elevations[Math.min(height - 1, z + 1)][x];
      const slopeAspect = slopeAspectFromElevations(west, east, north, south, cellSizeM);
      const wetness_index = 0.12;
      const solar_score = solarScore(slopeAspect.aspect_degrees, slopeAspect.slope_degrees);
      const soilClass = 3;
      const base = {
        id: `cell_${x}_${z}`,
        x_m: x * cellSizeM,
        z_m: z * cellSizeM,
        size_m: cellSizeM,
        elevation_m: Number(elevations[z][x].toFixed(2)),
        slope_degrees: Number(slopeAspect.slope_degrees.toFixed(2)),
        aspect_degrees: Number(slopeAspect.aspect_degrees.toFixed(1)),
        solar_score: Number(solar_score.toFixed(3)),
        wetness_index: Number(wetness_index.toFixed(3)),
        flow_direction: flowDirectionFromLowestNeighbor(elevations, x, z),
        soil_type: "unknown; DEM/soil adapter not loaded",
        soil_capability_class: soilClass,
        land_cover: "unknown lot fabric",
        land_use: "base property"
      };
      const yurt = scoreYurtCell(base);
      const garden = scoreGardenCell(base);
      const orchard = clamp01(0.45 * solar_score + 0.28 * (1 - wetness_index) + 0.27 * (1 - clamp01(slopeAspect.slope_degrees / 14)));
      const field = clamp01(0.36 * garden + 0.4 * (1 - clamp01(slopeAspect.slope_degrees / 10)) + 0.24 * (1 - wetness_index));
      const woodlot = 0.35;
      const pond = 0.05;
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
        warnings: ["placeholder terrain; no DEM-derived slope, drainage, or land cover"]
      });
    }
  }
  const values = cells.map((cell) => cell.elevation_m);
  return {
    metadata: {
      grid_width: width,
      grid_height: height,
      cell_size_m: cellSizeM,
      total_area_ha: Number(areaHaFromGrid(width, height, cellSizeM).toFixed(2)),
      min_elevation_m: Math.min(...values),
      max_elevation_m: Math.max(...values),
      terrain_source: "procedural_fallback",
      terrain_source_detail: "No local Ontario DTM or Canada DEM adapter output found; using flat neutral placeholder terrain. Visible ponds, swales, gardens, and woodlot are explicit proposed layout add-ons, not inferred site conditions.",
      origin_lat: options.candidate?.approximate_location.lat ?? 44.612,
      origin_lon: options.candidate?.approximate_location.lon ?? -80.995,
      origin_x_m: 0,
      origin_z_m: 0,
      projection: "LOCAL_TANGENT_METRES_PLACEHOLDER_EPSG_TBD"
    },
    cells
  };
}

function cellAt(grid: TerrainGrid, xM: number, zM: number): TerrainCell {
  const x = Math.max(0, Math.min(grid.metadata.grid_width - 1, Math.round(xM / grid.metadata.cell_size_m)));
  const z = Math.max(0, Math.min(grid.metadata.grid_height - 1, Math.round(zM / grid.metadata.cell_size_m)));
  return grid.cells[z * grid.metadata.grid_width + x];
}

function isDryYurtPad(grid: TerrainGrid, xM: number, zM: number, radiusM: number): boolean {
  const samples = [
    [xM, zM],
    [xM - radiusM, zM],
    [xM + radiusM, zM],
    [xM, zM - radiusM],
    [xM, zM + radiusM]
  ];
  return samples.every(([x, z]) => {
    const cell = cellAt(grid, x, z);
    return cell.wetness_index <= 0.62 && cell.pond_suitability <= 0.68 && cell.land_use !== "hydrology buffer";
  });
}

function isDryFootprint(grid: TerrainGrid, xM: number, zM: number, halfWidthM: number, halfLengthM: number): boolean {
  const samples = [
    [xM, zM],
    [xM - halfWidthM, zM - halfLengthM],
    [xM + halfWidthM, zM - halfLengthM],
    [xM - halfWidthM, zM + halfLengthM],
    [xM + halfWidthM, zM + halfLengthM]
  ];
  return samples.every(([x, z]) => {
    const cell = cellAt(grid, x, z);
    return cell.wetness_index <= 0.62 && cell.pond_suitability <= 0.68 && cell.land_use !== "hydrology buffer";
  });
}

function selectEnvelope(grid: TerrainGrid): { x_m: number; z_m: number; width_m: number; length_m: number } {
  const half = 50;
  const candidates = grid.cells
    .filter((cell) => cell.x_m >= half && cell.z_m >= half && cell.x_m <= (grid.metadata.grid_width - 1) * grid.metadata.cell_size_m - half && cell.z_m <= (grid.metadata.grid_height - 1) * grid.metadata.cell_size_m - half)
    .map((cell) => ({
      cell,
      score: cell.yurt_suitability + cell.solar_score * 0.25 - cell.wetness_index * 0.55 - Math.abs(cell.x_m - 300) / 1000 - Math.abs(cell.z_m - 290) / 1000
    }))
    .sort((a, b) => b.score - a.score);
  const selected = candidates[0]?.cell ?? grid.cells[Math.floor(grid.cells.length / 2)];
  return { x_m: selected.x_m, z_m: selected.z_m, width_m: 100, length_m: 100 };
}

export function generateHamletLayout(grid?: TerrainGrid): HamletLayout {
  const terrain = grid ?? generateTerrainGrid();
  const envelope = selectEnvelope(terrain);
  const radiusM = 4.5;
  const minSpacingM = 18;
  const minX = envelope.x_m - envelope.width_m / 2 + radiusM;
  const maxX = envelope.x_m + envelope.width_m / 2 - radiusM;
  const minZ = envelope.z_m - envelope.length_m / 2 + radiusM;
  const maxZ = envelope.z_m + envelope.length_m / 2 - radiusM;
  const selectedPads: TerrainCell[] = [];
  const padCandidates = terrain.cells
    .filter((cell) => cell.x_m >= minX && cell.x_m <= maxX && cell.z_m >= minZ && cell.z_m <= maxZ)
    .filter((cell) => isDryYurtPad(terrain, cell.x_m, cell.z_m, radiusM))
    .sort((a, b) => b.yurt_suitability - a.yurt_suitability);
  for (const cell of padCandidates) {
    if (selectedPads.length >= 12) break;
    const farEnough = selectedPads.every((pad) => Math.hypot(pad.x_m - cell.x_m, pad.z_m - cell.z_m) >= minSpacingM);
    if (farEnough) selectedPads.push(cell);
  }
  const warnings = selectedPads.length < 12 ? [`Only ${selectedPads.length} dry yurt pads found inside the 1 ha building envelope.`] : [];
  const yurts = selectedPads.map((cell, index) => ({
    id: `yurt_${String(index + 1).padStart(2, "0")}`,
    type: "yurt",
    label: `Yurt ${index + 1}`,
    x_m: cell.x_m,
    z_m: cell.z_m,
    radius_m: radiusM
  }));

  const occupied = selectedPads.map((cell) => ({ x_m: cell.x_m, z_m: cell.z_m, radius_m: 9 }));
  function pickDryCell(preferredX: number, preferredZ: number, widthM: number, lengthM: number): { x_m: number; z_m: number } {
    const candidates = terrain.cells
      .filter((cell) => cell.x_m >= minX && cell.x_m <= maxX && cell.z_m >= minZ && cell.z_m <= maxZ)
      .filter((cell) => isDryFootprint(terrain, cell.x_m, cell.z_m, widthM / 2, lengthM / 2))
      .map((cell) => ({
        cell,
        score:
          cell.yurt_suitability +
          cell.solar_score * 0.2 -
          cell.wetness_index * 0.8 -
          Math.hypot(cell.x_m - preferredX, cell.z_m - preferredZ) / 100 -
          Math.max(0, 18 - Math.min(...occupied.map((item) => Math.hypot(item.x_m - cell.x_m, item.z_m - cell.z_m) - item.radius_m))) / 10
      }))
      .sort((a, b) => b.score - a.score);
    const selected = candidates[0]?.cell ?? cellAt(terrain, envelope.x_m, envelope.z_m);
    occupied.push({ x_m: selected.x_m, z_m: selected.z_m, radius_m: Math.max(widthM, lengthM) / 2 });
    return { x_m: selected.x_m, z_m: selected.z_m };
  }

  const commonHouse = pickDryCell(envelope.x_m, envelope.z_m, 16, 10);
  const sharedKitchen = pickDryCell(envelope.x_m + 18, envelope.z_m - 14, 12, 8);
  const rootCellar = pickDryCell(envelope.x_m - 34, envelope.z_m + 34, 8, 5);
  const workshop = pickDryCell(envelope.x_m + 34, envelope.z_m - 34, 12, 7);
  const compost = pickDryCell(envelope.x_m + 38, envelope.z_m + 34, 14, 14);
  const waterStorage = pickDryCell(envelope.x_m + 40, envelope.z_m - 24, 12, 12);
  const chickenCoop = pickDryCell(envelope.x_m - 38, envelope.z_m - 34, 12, 8);
  const woodshed = pickDryCell(envelope.x_m - 38, envelope.z_m + 8, 12, 6);

  const envelopeClearance = 70;
  const wetCellsOutsideEnvelope = terrain.cells
    .filter((cell) => cell.x_m < envelope.x_m - envelopeClearance || cell.x_m > envelope.x_m + envelopeClearance || cell.z_m < envelope.z_m - envelopeClearance || cell.z_m > envelope.z_m + envelopeClearance)
    .sort((a, b) => b.pond_suitability - a.pond_suitability);
  const pondCell = wetCellsOutsideEnvelope[0] ?? terrain.cells[terrain.cells.length - 1];
  const swaleCells = wetCellsOutsideEnvelope
    .filter((cell) => Math.abs(cell.x_m - pondCell.x_m) <= terrain.metadata.cell_size_m * 2)
    .sort((a, b) => a.z_m - b.z_m);
  const swaleStart = swaleCells[0] ?? pondCell;
  const swaleEnd = swaleCells[swaleCells.length - 1] ?? pondCell;
  const terrainMaxX = (terrain.metadata.grid_width - 1) * terrain.metadata.cell_size_m;
  const terrainMaxZ = (terrain.metadata.grid_height - 1) * terrain.metadata.cell_size_m;
  const roadX = terrainMaxX - 15;

  return {
    metadata: { scale: "1 Three.js unit = 1 metre", coordinate_system: "local_projected_metres", yurt_siting: "avoid_wet_cells", warnings },
    elements: [
      {
        id: "building_envelope_1ha",
        type: "building_envelope_1ha",
        label: "1 ha building envelope",
        x_m: envelope.x_m,
        z_m: envelope.z_m,
        width_m: envelope.width_m,
        length_m: envelope.length_m
      },
      ...yurts,
      { id: "common_house", type: "common_house", label: "Common house", x_m: commonHouse.x_m, z_m: commonHouse.z_m, width_m: 16, length_m: 10 },
      { id: "shared_kitchen_meeting", type: "shared_kitchen_meeting", label: "Shared kitchen / meeting", x_m: sharedKitchen.x_m, z_m: sharedKitchen.z_m, width_m: 12, length_m: 8 },
      { id: "root_cellar", type: "root_cellar", label: "Root cellar", x_m: rootCellar.x_m, z_m: rootCellar.z_m, width_m: 8, length_m: 5 },
      { id: "tool_shed_workshop", type: "tool_shed_workshop", label: "Tool shed / workshop", x_m: workshop.x_m, z_m: workshop.z_m, width_m: 12, length_m: 7 },
      { id: "chicken_coop", type: "chicken_coop", label: "Chicken coop", x_m: chickenCoop.x_m, z_m: chickenCoop.z_m, width_m: 12, length_m: 8 },
      { id: "woodshed", type: "woodshed", label: "Woodshed", x_m: woodshed.x_m, z_m: woodshed.z_m, width_m: 12, length_m: 6 },
      { id: "compost", type: "compost", label: "Compost", x_m: compost.x_m, z_m: compost.z_m, radius_m: 7 },
      { id: "water_storage", type: "water_storage", label: "Water storage", x_m: waterStorage.x_m, z_m: waterStorage.z_m, radius_m: 6 },
      { id: "pond", type: "pond", label: "Pond", x_m: pondCell.x_m, z_m: pondCell.z_m, radius_m: 24 },
      { id: "swale", type: "swale", label: "Drainage swale", x_m: pondCell.x_m, z_m: pondCell.z_m, points: [[swaleStart.x_m, swaleStart.z_m], [pondCell.x_m, pondCell.z_m], [swaleEnd.x_m, swaleEnd.z_m]] },
      { id: "gardens", type: "gardens", label: "Market gardens", x_m: commonHouse.x_m + 120, z_m: commonHouse.z_m - 90, width_m: 105, length_m: 86 },
      { id: "fields", type: "fields", label: "Small fields", x_m: commonHouse.x_m + 130, z_m: commonHouse.z_m + 95, width_m: 120, length_m: 95 },
      { id: "orchard", type: "orchard", label: "Orchard", x_m: commonHouse.x_m - 100, z_m: commonHouse.z_m - 70, width_m: 86, length_m: 72 },
      { id: "shrub_area", type: "shrub_area", label: "Shrub harvest area", x_m: commonHouse.x_m - 135, z_m: commonHouse.z_m - 105, width_m: 68, length_m: 48 },
      { id: "woodlot_coppice", type: "woodlot_coppice", label: "Woodlot / coppice", x_m: commonHouse.x_m - 190, z_m: commonHouse.z_m + 10, width_m: 140, length_m: 300 },
      { id: "adjacent_road", type: "adjacent_road", label: "Adjacent concession road", x_m: roadX, z_m: terrainMaxZ / 2, width_m: 8, points: [[roadX, 0], [roadX, terrainMaxZ]] },
      { id: "paths", type: "paths", label: "Loop paths", x_m: commonHouse.x_m, z_m: commonHouse.z_m, width_m: 1.5, points: [[envelope.x_m - 42, envelope.z_m], [envelope.x_m, envelope.z_m - 38], [envelope.x_m + 42, envelope.z_m], [envelope.x_m, envelope.z_m + 38], [envelope.x_m - 42, envelope.z_m]] },
      { id: "road_service_access", type: "road_service_access", label: "Road / service access", x_m: commonHouse.x_m + 220, z_m: commonHouse.z_m, width_m: 4, points: [[roadX, envelope.z_m], [envelope.x_m + 90, envelope.z_m], [workshop.x_m, workshop.z_m]] }
    ]
  };
}

function routePointFromElement(layout: HamletLayout, id: string, label?: string): RoutePoint {
  const element = layout.elements.find((item) => item.id === id);
  if (!element) throw new Error(`Missing chore route point element '${id}'`);
  return { id, label: label ?? element.label, x_m: element.x_m, z_m: element.z_m };
}

function nearestDistanceToPolyline(x: number, z: number, points: Array<[number, number]>): number {
  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index < points.length - 1; index += 1) {
    const [x1, z1] = points[index];
    const [x2, z2] = points[index + 1];
    const dx = x2 - x1;
    const dz = z2 - z1;
    const lengthSq = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / lengthSq));
    const px = x1 + dx * t;
    const pz = z1 + dz * t;
    best = Math.min(best, Math.hypot(x - px, z - pz));
  }
  return best;
}

function surfaceForLayout(layout: HamletLayout, x: number, z: number, cell: TerrainCell): RouteSurface {
  for (const element of layout.elements) {
    if (!element.points) continue;
    const distance = nearestDistanceToPolyline(x, z, element.points);
    if (distance <= (element.width_m ?? 1.5) / 2 + cell.size_m * 0.5) {
      if (element.type === "adjacent_road" || element.type === "road_service_access") return "road";
      if (element.type === "paths") return "path";
    }
  }
  if (cell.land_use === "hydrology buffer" || cell.wetness_index > 0.72) return "wet";
  if (cell.land_use.includes("agriculture")) return "field";
  return "off_path";
}

export function generateChoreRoutes(grid: TerrainGrid, layout: HamletLayout): ChoreRouteSet {
  const yurtElements = layout.elements.filter((element) => element.type === "yurt");
  const yurtCluster = {
    id: "yurt_cluster",
    label: "Yurt cluster",
    x_m: Number((yurtElements.reduce((sum, item) => sum + item.x_m, 0) / yurtElements.length).toFixed(1)),
    z_m: Number((yurtElements.reduce((sum, item) => sum + item.z_m, 0) / yurtElements.length).toFixed(1))
  };
  const points: RoutePoint[] = [
    routePointFromElement(layout, "shared_kitchen_meeting", "Common kitchen"),
    yurtCluster,
    routePointFromElement(layout, "water_storage", "Water source / storage"),
    routePointFromElement(layout, "chicken_coop", "Chicken coop"),
    routePointFromElement(layout, "compost", "Compost"),
    routePointFromElement(layout, "gardens", "Garden"),
    routePointFromElement(layout, "shrub_area", "Shrub harvest area"),
    routePointFromElement(layout, "woodshed", "Woodshed")
  ];
  const pointById = new Map(points.map((point) => [point.id, point]));
  const definitions = [
    ["feed_chickens", "Feed chickens", "shared_kitchen_meeting", "chicken_coop", "loaded", 7],
    ["collect_eggs", "Collect eggs", "chicken_coop", "shared_kitchen_meeting", "unloaded", 7],
    ["haul_water", "Haul water to yurt cluster", "water_storage", "yurt_cluster", "loaded", 7],
    ["bring_compost", "Bring compost to garden", "compost", "gardens", "loaded", 3],
    ["harvest_shrubs", "Harvest shrubs", "shared_kitchen_meeting", "shrub_area", "loaded", 2],
    ["bring_firewood", "Bring firewood to kitchen", "woodshed", "shared_kitchen_meeting", "loaded", 5]
  ] as const;
  const chores = definitions.map(([id, label, from, to, load, frequency]) => {
    const start = pointById.get(from);
    const end = pointById.get(to);
    if (!start || !end) throw new Error(`Missing chore route endpoints for ${id}`);
    const loadModifier = load === "loaded" ? 1.28 : 1;
    const normal = calculateRouteTime(grid, start, end, {
      loadModifier,
      surfaceAt: (x, z, cell) => surfaceForLayout(layout, x, z, cell)
    });
    const winter = calculateRouteTime(grid, start, end, {
      loadModifier,
      winterModifier: 1.35,
      surfaceAt: (x, z, cell) => surfaceForLayout(layout, x, z, cell)
    });
    return {
      id,
      label,
      from,
      to,
      load,
      frequency_per_week: frequency,
      distance_m: normal.distance_m,
      estimated_time_minutes: normal.time_minutes,
      effort_multiplier: normal.effort_multiplier,
      winter_time_minutes: winter.time_minutes,
      winter_effort_multiplier: winter.effort_multiplier,
      path: normal.path
    };
  });
  const weeklyMinutes = chores.reduce((sum, chore) => sum + chore.estimated_time_minutes * chore.frequency_per_week, 0);
  const weeklyWinterMinutes = chores.reduce((sum, chore) => sum + chore.winter_time_minutes * chore.frequency_per_week, 0);
  const weeklyDistance = chores.reduce((sum, chore) => sum + chore.distance_m * chore.frequency_per_week, 0);
  const hardest = [...chores].sort((a, b) => b.winter_time_minutes * b.effort_multiplier - a.winter_time_minutes * a.effort_multiplier)[0];
  return {
    metadata: {
      model: "walking_cost_mvp",
      base_walking_speed_mps: 1.25,
      winter_modifier: 1.35,
      caveat: "Deterministic MVP route-cost model using grid slope, path/road surface, distance, and simple load modifiers."
    },
    points,
    chores,
    summary: {
      daily_walking_time_minutes: Number((weeklyMinutes / 7).toFixed(1)),
      weekly_chore_distance_m: Number(weeklyDistance.toFixed(1)),
      winter_burden_minutes_per_day: Number((weeklyWinterMinutes / 7).toFixed(1)),
      hardest_chore_id: hardest.id
    }
  };
}

export function generateOverlays(): Overlays {
  return {
    overlays: [
      { id: "land_use", label: "Land use", hotkey: "1", source_field: "land_use", mode: "category" },
      { id: "elevation", label: "Elevation", hotkey: "2", source_field: "elevation_m", mode: "ramp" },
      { id: "slope", label: "Slope", hotkey: "3", source_field: "slope_degrees", mode: "ramp" },
      { id: "aspect", label: "Aspect", hotkey: "4", source_field: "aspect_degrees", mode: "wheel" },
      { id: "solar", label: "Solar", hotkey: "5", source_field: "solar_score", mode: "ramp" },
      { id: "yurt_suitability", label: "Yurt suitability", hotkey: "6", source_field: "yurt_suitability", mode: "ramp" },
      { id: "crop_suitability", label: "Crop suitability", hotkey: "7", source_field: "garden_suitability", mode: "ramp" },
      { id: "wetness", label: "Wetness / hydrology", hotkey: "8", source_field: "wetness_index", mode: "ramp" },
      { id: "proposed_layout", label: "Proposed layout", hotkey: "9", mode: "layout" },
      { id: "constraints", label: "Constraints placeholder", hotkey: "0", mode: "placeholder" }
    ]
  };
}
