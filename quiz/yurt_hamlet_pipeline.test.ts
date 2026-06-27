import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  areaHaFromGrid,
  calculateRouteTime,
  flowDirectionFromLowestNeighbor,
  scoreGardenCell,
  scoreYurtCell,
  solarScore,
  slopeAspectFromElevations
} from "../packages/sim-core/src/index";
import { candidatesFromLotRows, generateChoreRoutes, generateHamletLayout, generateTerrainGrid, parseLotConcessionCsv } from "../packages/data-pipeline/src/fixtures";
import { exportScenario, readJson } from "../packages/data-pipeline/src/io";
import { validateScenario } from "../packages/data-pipeline/src/validation";

describe("yurt hamlet terrain math", () => {
  test("computes area from grid cell size", () => {
    expect(areaHaFromGrid(100, 100, 10)).toBe(100);
    expect(areaHaFromGrid(40, 40, 25)).toBe(100);
  });

  test("computes slope and aspect from known elevation samples", () => {
    const southRising = slopeAspectFromElevations(100, 100, 100, 110, 10);
    expect(southRising.slope_degrees).toBeGreaterThan(20);
    expect(southRising.aspect_degrees).toBeCloseTo(180, 0);
  });

  test("solar score favours south-facing slopes", () => {
    expect(solarScore(180, 8)).toBeGreaterThan(solarScore(0, 8));
  });

  test("flow direction collects toward low cells", () => {
    const elevations = [
      [5, 5, 5],
      [5, 9, 4],
      [5, 5, 5]
    ];
    expect(flowDirectionFromLowestNeighbor(elevations, 1, 1)).toBe("E");
  });
});

describe("yurt hamlet suitability", () => {
  test("yurt suitability penalizes steep wet cells", () => {
    const good = scoreYurtCell({ slope_degrees: 3, wetness_index: 0.2, soil_capability_class: 2, solar_score: 0.8 });
    const poor = scoreYurtCell({ slope_degrees: 22, wetness_index: 0.9, soil_capability_class: 5, solar_score: 0.4 });
    expect(good).toBeGreaterThan(poor);
  });

  test("garden suitability favours solar, good soil, and gentle slope", () => {
    const good = scoreGardenCell({ slope_degrees: 2, wetness_index: 0.35, soil_capability_class: 2, solar_score: 0.9 });
    const poor = scoreGardenCell({ slope_degrees: 16, wetness_index: 0.9, soil_capability_class: 5, solar_score: 0.35 });
    expect(good).toBeGreaterThan(poor);
  });

  test("fallback terrain stays neutral when no DEM adapter is available", () => {
    const grid = generateTerrainGrid({ width: 20, height: 20, cellSizeM: 10 });
    expect(grid.metadata.min_elevation_m).toBe(grid.metadata.max_elevation_m);
    expect(Math.max(...grid.cells.map((cell) => cell.wetness_index))).toBeLessThanOrEqual(0.12);
    expect(grid.cells.every((cell) => cell.land_use === "base property")).toBe(true);
  });
});

describe("candidate ranking and export", () => {
  const sampleCsv = `parcel_id,municipality,land_area_m2,zoning_or_land_use,assessment_class,has_residential_use,source_ref,quality_tier,notes
lotcon-balanced,municipality-1,240000.00,unknown_lot_fabric_proxy,unknown,unknown,grey_gis_lots_and_concessions_grey,direct_local,"lot_fabric_proxy; lot=LOT 20; concession=2; legal=LOT 20, CON 2; linkage=none"
lotcon-huge,municipality-1,2200000.00,unknown_lot_fabric_proxy,unknown,unknown,grey_gis_lots_and_concessions_grey,direct_local,"lot_fabric_proxy; lot=LOT 99; concession=9; legal=LOT 99, CON 9; linkage=none"`;

  test("balanced lot candidate ranks above poor area-fit candidates", () => {
    const candidates = candidatesFromLotRows(parseLotConcessionCsv(sampleCsv), 2).candidates;
    expect(candidates[0].id).toBe("lotcon-balanced");
    expect(candidates[0].score_total).toBeGreaterThan(candidates.at(-1)?.score_total ?? 1);
    expect(candidates[0].data_caveat).toBe("lot_fabric_proxy_not_legal_parcel");
  });

  test("all yurt and building footprints avoid wet cells", () => {
    const terrain = generateTerrainGrid();
    const layout = generateHamletLayout(terrain);
    const envelope = layout.elements.find((element) => element.type === "building_envelope_1ha");
    expect(envelope?.width_m).toBeDefined();
    expect(envelope?.length_m).toBeDefined();
    expect((envelope?.width_m ?? 0) * (envelope?.length_m ?? 0)).toBe(10_000);
    const minX = envelope!.x_m - envelope!.width_m! / 2;
    const maxX = envelope!.x_m + envelope!.width_m! / 2;
    const minZ = envelope!.z_m - envelope!.length_m! / 2;
    const maxZ = envelope!.z_m + envelope!.length_m! / 2;
    for (const yurt of layout.elements.filter((element) => element.type === "yurt")) {
      const radius = yurt.radius_m ?? 0;
      expect(yurt.x_m - radius).toBeGreaterThanOrEqual(minX);
      expect(yurt.x_m + radius).toBeLessThanOrEqual(maxX);
      expect(yurt.z_m - radius).toBeGreaterThanOrEqual(minZ);
      expect(yurt.z_m + radius).toBeLessThanOrEqual(maxZ);
      const cell = terrain.cells[Math.round(yurt.z_m / terrain.metadata.cell_size_m) * terrain.metadata.grid_width + Math.round(yurt.x_m / terrain.metadata.cell_size_m)];
      expect(cell.wetness_index).toBeLessThanOrEqual(0.62);
      expect(cell.pond_suitability).toBeLessThanOrEqual(0.68);
    }
    for (const element of layout.elements.filter((item) => ["common_house", "shared_kitchen_meeting", "root_cellar", "tool_shed_workshop", "compost", "water_storage"].includes(item.type))) {
      const cell = terrain.cells[Math.round(element.z_m / terrain.metadata.cell_size_m) * terrain.metadata.grid_width + Math.round(element.x_m / terrain.metadata.cell_size_m)];
      expect(cell.wetness_index).toBeLessThanOrEqual(0.62);
      expect(cell.pond_suitability).toBeLessThanOrEqual(0.68);
    }
  });

  test("route model applies load and winter modifiers", () => {
    const terrain = generateTerrainGrid({ width: 20, height: 20, cellSizeM: 10 });
    const start = { id: "a", label: "A", x_m: 20, z_m: 20 };
    const end = { id: "b", label: "B", x_m: 160, z_m: 160 };
    const unloaded = calculateRouteTime(terrain, start, end, { loadModifier: 1 });
    const loadedWinter = calculateRouteTime(terrain, start, end, { loadModifier: 1.28, winterModifier: 1.35 });
    expect(unloaded.distance_m).toBeGreaterThan(0);
    expect(loadedWinter.time_minutes).toBeGreaterThan(unloaded.time_minutes);
  });

  test("chore routes export fixed MVP chores with paths and burden summary", () => {
    const terrain = generateTerrainGrid();
    const layout = generateHamletLayout(terrain);
    const routes = generateChoreRoutes(terrain, layout);
    expect(routes.chores.map((chore) => chore.id).sort()).toEqual([
      "bring_compost",
      "bring_firewood",
      "collect_eggs",
      "feed_chickens",
      "harvest_shrubs",
      "haul_water"
    ]);
    expect(routes.summary.daily_walking_time_minutes).toBeGreaterThan(0);
    expect(routes.summary.weekly_chore_distance_m).toBeGreaterThan(0);
    expect(routes.chores.every((chore) => chore.path.length >= 2)).toBe(true);
  });

  test("export writes all scenario files and required fields", async () => {
    const dir = await mkdtemp(join(tmpdir(), "yurt-hamlet-"));
    const originalCwd = process.cwd();
    process.chdir(dir);
    try {
      await mkdir("know/input/local-calibration", { recursive: true });
      await writeFile("know/input/local-calibration/parcels.csv", sampleCsv, "utf8");
      const files = await exportScenario();
      expect(files.some((file) => file.endsWith("sites/lotcon-balanced/terrain_grid.json"))).toBe(true);
      const scenarioDir = "packages/web-client/public/scenarios/pilot_yurt_hamlet";
      const site = await readJson<{ selected_candidate_id: string }>(join(scenarioDir, "site.json"));
      const candidates = await readJson<{ candidates: Array<{ id: string; data_caveat: string }> }>(join(scenarioDir, "candidates.json"));
      const terrain = await readJson<{ cells: unknown[]; metadata: { grid_width: number; grid_height: number; terrain_source: string } }>(join(scenarioDir, "sites", site.selected_candidate_id, "terrain_grid.json"));
      const chores = await readJson<{ chores: unknown[] }>(join(scenarioDir, "sites", site.selected_candidate_id, "chore_routes.json"));
      expect(site.selected_candidate_id).toBe("lotcon-balanced");
      expect(candidates.candidates[0].data_caveat).toBe("lot_fabric_proxy_not_legal_parcel");
      expect(["open_meteo_copernicus_dem90", "procedural_fallback"]).toContain(terrain.metadata.terrain_source);
      expect(chores.chores.length).toBe(6);
      expect(terrain.cells.length).toBe(terrain.metadata.grid_width * terrain.metadata.grid_height);
      expect(await validateScenario(scenarioDir)).toEqual([]);
    } finally {
      process.chdir(originalCwd);
      await rm(dir, { recursive: true, force: true });
    }
  });
});
