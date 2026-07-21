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
const requiredChores = new Set(["morning_chickens", "eggs_and_compost", "firewood_loop", "garden_harvest_loop", "haul_water", "harvest_shrubs"]);

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

type ChoreForValidation = {
  id?: string;
  task_id?: string;
  title?: string;
  assigned_agent_type?: string;
  recurrence?: { frequency_per_week?: number };
  priority?: number;
  distance_m?: number;
  travel_time_minutes?: number;
  action_time_minutes?: number;
  estimated_time_minutes?: number;
  effort_multiplier?: number;
  path?: unknown[];
  stops?: Array<{ location_id?: string; point_id?: string; action?: string; expected_duration_minutes?: number; load?: string; carried_item?: string; produces?: unknown; consumes?: unknown }>;
  legs?: Array<{ from?: string; to?: string; distance_m?: number; estimated_time_minutes?: number; path?: unknown[] }>;
};

function validateChores(chores: ChoreForValidation[], errors: string[], label = "chore_routes.json"): void {
  for (const id of requiredChores) assert(chores.some((chore) => chore.task_id === id || chore.id === id), `${label} missing ${id}`, errors);
  for (const chore of chores) {
    const taskId = chore.task_id ?? chore.id ?? "unknown";
    assert(typeof chore.task_id === "string" && chore.task_id.length > 0, `${label}/${taskId}: missing task_id`, errors);
    assert(typeof chore.title === "string" && chore.title.length > 0, `${label}/${taskId}: missing title`, errors);
    assert(typeof chore.assigned_agent_type === "string" && chore.assigned_agent_type.length > 0, `${label}/${taskId}: missing assigned_agent_type`, errors);
    assert(Number(chore.recurrence?.frequency_per_week) > 0, `${label}/${taskId}: missing recurrence.frequency_per_week`, errors);
    assert(Number.isFinite(chore.priority), `${label}/${taskId}: missing priority`, errors);
    assert(
      Number(chore.distance_m) > 0 &&
        Number(chore.travel_time_minutes) > 0 &&
        Number(chore.action_time_minutes) > 0 &&
        Number(chore.estimated_time_minutes) >= Number(chore.travel_time_minutes) + Number(chore.action_time_minutes) - 0.2 &&
        Number(chore.effort_multiplier) >= 1,
      `${label}/${taskId}: invalid task cost`,
      errors
    );
    assert(Array.isArray(chore.path) && chore.path.length >= 2, `${label}/${taskId}: missing route path`, errors);
    assert(Array.isArray(chore.stops) && chore.stops.length >= 2, `${label}/${taskId}: missing itinerary stops`, errors);
    for (const [index, stop] of (chore.stops ?? []).entries()) {
      assert(typeof stop.location_id === "string" && stop.location_id.length > 0, `${label}/${taskId}: stop ${index + 1} missing location_id`, errors);
      assert(typeof stop.action === "string" && stop.action.length > 0, `${label}/${taskId}: stop ${index + 1} missing action`, errors);
      assert(Number(stop.expected_duration_minutes) >= 0, `${label}/${taskId}: stop ${index + 1} missing expected_duration_minutes`, errors);
      assert(!stop.produces || Array.isArray(stop.produces), `${label}/${taskId}: stop ${index + 1} produces must be an array`, errors);
      assert(!stop.consumes || Array.isArray(stop.consumes), `${label}/${taskId}: stop ${index + 1} consumes must be an array`, errors);
    }
    assert(Array.isArray(chore.legs) && chore.legs.length === Math.max(0, (chore.stops?.length ?? 0) - 1), `${label}/${taskId}: leg count must match stop sequence`, errors);
    for (const [index, leg] of (chore.legs ?? []).entries()) {
      const from = chore.stops?.[index]?.location_id ?? chore.stops?.[index]?.point_id;
      const to = chore.stops?.[index + 1]?.location_id ?? chore.stops?.[index + 1]?.point_id;
      assert(leg.from === from && leg.to === to, `${label}/${taskId}: leg ${index + 1} does not follow stop order`, errors);
      assert(Number(leg.distance_m) > 0 && Number(leg.estimated_time_minutes) > 0, `${label}/${taskId}: leg ${index + 1} has invalid cost`, errors);
      assert(Array.isArray(leg.path) && leg.path.length >= 2, `${label}/${taskId}: leg ${index + 1} missing path`, errors);
    }
  }
}

function tasksFromRouteSet(routeSet: unknown): ChoreForValidation[] {
  const value = routeSet as { tasks?: ChoreForValidation[]; chores?: ChoreForValidation[] } | undefined;
  return value?.tasks ?? value?.chores ?? [];
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
  validateChores(tasksFromRouteSet(choreRoutes), errors);

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
      readJson<{ tasks?: ChoreForValidation[]; chores?: ChoreForValidation[] }>(join(siteDir, "chore_routes.json")).catch((error) => {
        errors.push(`${candidate.id}/chore_routes.json: ${error.message}`);
        return undefined;
      })
    ]);
    assert((candidateSite as { selected_candidate_id?: string } | undefined)?.selected_candidate_id === candidate.id, `${candidate.id}: site selected_candidate_id mismatch`, errors);
    validateTerrain(candidateTerrain, errors, candidate.id);
    validateLayout(candidateLayout, candidateTerrain, errors, candidate.id);
    validateChores(tasksFromRouteSet(candidateChores), errors, candidate.id);
  }
  return errors;
}
