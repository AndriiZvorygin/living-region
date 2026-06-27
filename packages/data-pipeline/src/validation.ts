import { join } from "node:path";
import { scenarioDir, type CandidateCollection, type HamletLayout } from "./fixtures";
import { readJson } from "./io";
import type { TerrainCell, TerrainGrid } from "../../sim-core/src/index";

const terrainFields: Array<keyof TerrainCell> = [
  "id",
  "x_m",
  "z_m",
  "size_m",
  "elevation_m",
  "slope_degrees",
  "aspect_degrees",
  "solar_score",
  "wetness_index",
  "flow_direction",
  "soil_type",
  "soil_capability_class",
  "land_cover",
  "land_use",
  "yurt_suitability",
  "garden_suitability",
  "orchard_suitability",
  "field_suitability",
  "woodlot_suitability",
  "pond_suitability",
  "best_uses",
  "warnings"
];

const requiredLayoutTypes = [
  "building_envelope_1ha",
  "yurt",
  "common_house",
  "shared_kitchen_meeting",
  "root_cellar",
  "tool_shed_workshop",
  "chicken_coop",
  "woodshed",
  "compost",
  "water_storage",
  "pond",
  "swale",
  "gardens",
  "fields",
  "orchard",
  "shrub_area",
  "woodlot_coppice",
  "adjacent_road",
  "paths",
  "road_service_access"
];

const dryFootprintTypes = new Set(["yurt", "common_house", "shared_kitchen_meeting", "root_cellar", "tool_shed_workshop", "chicken_coop", "woodshed", "compost", "water_storage"]);
const requiredChores = new Set(["feed_chickens", "collect_eggs", "haul_water", "bring_compost", "harvest_shrubs", "bring_firewood"]);

function assert(condition: unknown, message: string, errors: string[]): void {
  if (!condition) errors.push(message);
}

function lonLatPairLike(x: number, z: number): boolean {
  return x < -40 && x > -100 && z > 40 && z < 60;
}

function cellAt(grid: TerrainGrid, xM: number, zM: number): TerrainCell | undefined {
  const x = Math.max(0, Math.min(grid.metadata.grid_width - 1, Math.round(xM / grid.metadata.cell_size_m)));
  const z = Math.max(0, Math.min(grid.metadata.grid_height - 1, Math.round(zM / grid.metadata.cell_size_m)));
  return grid.cells[z * grid.metadata.grid_width + x];
}

function footprintSamples(element: HamletLayout["elements"][number]): Array<[number, number]> {
  const halfWidth = element.width_m ? element.width_m / 2 : element.radius_m ?? 0;
  const halfLength = element.length_m ? element.length_m / 2 : element.radius_m ?? 0;
  return [
    [element.x_m, element.z_m],
    [element.x_m - halfWidth, element.z_m - halfLength],
    [element.x_m + halfWidth, element.z_m - halfLength],
    [element.x_m - halfWidth, element.z_m + halfLength],
    [element.x_m + halfWidth, element.z_m + halfLength]
  ];
}

function validateTerrain(grid: TerrainGrid | undefined, errors: string[], label = "terrain"): void {
  if (!grid) return;
  assert(grid.metadata?.grid_width <= 100 && grid.metadata?.grid_height <= 100, `${label}: terrain grid exceeds 100 x 100 MVP cap`, errors);
  assert(grid.metadata?.cell_size_m === 10 || grid.metadata?.cell_size_m === 25, `${label}: terrain cell size must be 10 m or 25 m`, errors);
  assert(["ontario_dtm", "canada_dem", "open_meteo_copernicus_dem90", "procedural_fallback"].includes(String(grid.metadata?.terrain_source)), `${label}: terrain source metadata is invalid`, errors);
  assert(grid.cells?.length === grid.metadata.grid_width * grid.metadata.grid_height, `${label}: terrain cell count does not match dimensions`, errors);
  for (const [index, cell] of (grid.cells ?? []).entries()) {
    for (const field of terrainFields) {
      assert(field in cell, `${label}: terrain cell ${index} missing ${field}`, errors);
    }
    assert(!("site_scoring_weights" in cell) && !("weights" in cell), `${label}: terrain cell ${cell.id} contains site scoring weights`, errors);
    assert(!lonLatPairLike(cell.x_m, cell.z_m), `${label}: terrain cell ${cell.id} has lon/lat-like render coordinates`, errors);
  }
}

function validateLayout(hamlet: HamletLayout | undefined, grid: TerrainGrid | undefined, errors: string[], label = "layout"): void {
  if (!hamlet) return;
  const types = new Set(hamlet.elements?.map((element) => element.type));
  for (const type of requiredLayoutTypes) assert(types.has(type), `${label}: hamlet_layout.json missing ${type}`, errors);
  const yurts = (hamlet.elements ?? []).filter((element) => element.type === "yurt");
  assert(yurts.length === 12, `${label}: hamlet_layout.json must contain 12 yurts`, errors);
  const envelope = (hamlet.elements ?? []).find((element) => element.type === "building_envelope_1ha");
  if (envelope?.width_m && envelope.length_m) {
    assert(envelope.width_m * envelope.length_m === 10_000, `${label}: building envelope must be exactly 1 ha`, errors);
    const minX = envelope.x_m - envelope.width_m / 2;
    const maxX = envelope.x_m + envelope.width_m / 2;
    const minZ = envelope.z_m - envelope.length_m / 2;
    const maxZ = envelope.z_m + envelope.length_m / 2;
    for (const yurt of yurts) {
      const radius = yurt.radius_m ?? 0;
      assert(
        yurt.x_m - radius >= minX && yurt.x_m + radius <= maxX && yurt.z_m - radius >= minZ && yurt.z_m + radius <= maxZ,
        `${label}: ${yurt.id} footprint is outside the 1 ha building envelope`,
        errors
      );
    }
  }
  if (grid) {
    for (const element of hamlet.elements ?? []) {
      if (!dryFootprintTypes.has(element.type)) continue;
      for (const [x, z] of footprintSamples(element)) {
        const cell = cellAt(grid, x, z);
        assert(cell && cell.wetness_index <= 0.62 && cell.pond_suitability <= 0.68 && cell.land_use !== "hydrology buffer", `${label}: ${element.id} footprint overlaps wet/water cell`, errors);
      }
    }
  }
}

export async function validateScenario(dir = scenarioDir): Promise<string[]> {
  const errors: string[] = [];
  const requiredFiles = ["site.json", "candidates.json", "terrain_grid.json", "hamlet_layout.json", "chore_routes.json", "overlays.json", "site_scoring_weights.json"];
  const [site, candidates, terrain, layout, choreRoutes, overlays, weights] = await Promise.all(
    requiredFiles.map((file) =>
      readJson(join(dir, file)).catch((error) => {
        errors.push(`${file}: ${error.message}`);
        return undefined;
      })
    )
  );

  assert(site && typeof (site as { selected_candidate_id?: unknown }).selected_candidate_id === "string", "site.json missing selected_candidate_id", errors);
  assert(Array.isArray((candidates as { candidates?: unknown })?.candidates), "candidates.json missing candidates array", errors);
  for (const candidate of ((candidates as CandidateCollection | undefined)?.candidates ?? [])) {
    assert(candidate.data_caveat === "lot_fabric_proxy_not_legal_parcel", `${candidate.id}: missing lot-fabric proxy caveat`, errors);
    assert(typeof candidate.lotcon_id === "string" && candidate.lotcon_id.length > 0, `${candidate.id}: missing lotcon_id`, errors);
  }
  assert((weights as { weights?: unknown })?.weights && typeof (weights as { weights?: unknown }).weights === "object", "site_scoring_weights.json missing weights", errors);
  assert(Array.isArray((overlays as { overlays?: unknown })?.overlays), "overlays.json missing overlays array", errors);
  const defaultChores = (choreRoutes as { chores?: Array<{ id?: string; distance_m?: number; estimated_time_minutes?: number; effort_multiplier?: number; path?: unknown[] }> } | undefined)?.chores ?? [];
  for (const id of requiredChores) assert(defaultChores.some((chore) => chore.id === id), `chore_routes.json missing ${id}`, errors);
  for (const chore of defaultChores) {
    assert(Number(chore.distance_m) > 0 && Number(chore.estimated_time_minutes) > 0 && Number(chore.effort_multiplier) >= 1, `${chore.id}: invalid chore cost`, errors);
    assert(Array.isArray(chore.path) && chore.path.length >= 2, `${chore.id}: missing route path`, errors);
  }

  validateTerrain(terrain as TerrainGrid | undefined, errors);
  validateLayout(layout as HamletLayout | undefined, terrain as TerrainGrid | undefined, errors);

  for (const candidate of ((candidates as CandidateCollection | undefined)?.candidates ?? [])) {
    const siteDir = join(dir, "sites", candidate.id);
    const [candidateSite, candidateTerrain, candidateLayout, candidateChores] = await Promise.all([
      readJson(join(siteDir, "site.json")).catch((error) => errors.push(`${candidate.id}/site.json: ${error.message}`)),
      readJson<TerrainGrid>(join(siteDir, "terrain_grid.json")).catch((error) => {
        errors.push(`${candidate.id}/terrain_grid.json: ${error.message}`);
        return undefined;
      }),
      readJson<HamletLayout>(join(siteDir, "hamlet_layout.json")).catch((error) => {
        errors.push(`${candidate.id}/hamlet_layout.json: ${error.message}`);
        return undefined;
      }),
      readJson<{ chores: Array<{ id: string; distance_m: number; estimated_time_minutes: number; effort_multiplier: number; path: unknown[] }> }>(join(siteDir, "chore_routes.json")).catch((error) => {
        errors.push(`${candidate.id}/chore_routes.json: ${error.message}`);
        return undefined;
      })
    ]);
    assert((candidateSite as { selected_candidate_id?: string } | undefined)?.selected_candidate_id === candidate.id, `${candidate.id}: site selected_candidate_id mismatch`, errors);
    validateTerrain(candidateTerrain, errors, candidate.id);
    validateLayout(candidateLayout, candidateTerrain, errors, candidate.id);
    for (const id of requiredChores) assert(candidateChores?.chores.some((chore) => chore.id === id), `${candidate.id}: missing ${id}`, errors);
    for (const chore of candidateChores?.chores ?? []) {
      assert(chore.distance_m > 0 && chore.estimated_time_minutes > 0 && chore.effort_multiplier >= 1, `${candidate.id}/${chore.id}: invalid chore cost`, errors);
      assert(Array.isArray(chore.path) && chore.path.length >= 2, `${candidate.id}/${chore.id}: missing route path`, errors);
    }
  }
  return errors;
}
