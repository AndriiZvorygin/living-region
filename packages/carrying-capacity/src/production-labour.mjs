import labourEvidence from '../data/derived/food-production-labour.json' with {type: 'json'};
import {calculateHumanureContribution, calculateNutrientLedger, calculatePlantNutrientFlows} from './nutrient-ledger.mjs';

export const FOOD_PRODUCTION_LABOUR_CONTRACT_VERSION = '2.0.0';
export const LABOUR_WEEKS_PER_YEAR = 365.25 / 7;
export const LABOUR_DAYS_PER_YEAR = 365.25;
export const LABOUR_PROJECTION_MODE = 'fixed_household';
export const LABOUR_MECHANIZATION_ASSUMPTION = Object.freeze({
  id: 'low_input_household_scale_manual',
  label: 'Low-input household-scale manual system',
  description: 'Durable hand tools and small-scale equipment may be used, but commercial tractor, combine and chemical-input savings are not silently assumed. Machine operator time remains human labour.',
  equipment_dependence: 'low-to-moderate',
  fuel_or_electricity: 'not quantified in this food-production labour ledger; external energy dependence remains unresolved'
});
export const LABOUR_CAPACITY_THRESHOLDS = Object.freeze({
  comfortable_max_utilization: .75,
  high_max_utilization: 1,
  labels: Object.freeze({comfortable: 'comfortable labour margin', high: 'high labour demand', exceeded: 'labour capacity exceeded'})
});

const round = (value, digits = 3) => Math.round(Number(value) * 10 ** digits) / 10 ** digits;
const number = (value, fallback = null) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));

// The source labour table uses production classes while the food ledgers use
// stable crop/evidence IDs. This is a mapping layer, not a second coefficient
// table; all coefficients come from the generated labour evidence rows.
export const LABOUR_PROFILE_BY_PRODUCTION_ID = Object.freeze({
  annual_potato: 'annual_staple_low_input', potato_low_input_synthesis: 'annual_staple_low_input',
  annual_winter_wheat: 'annual_staple_low_input', wheat_low_input_synthesis: 'annual_staple_low_input',
  annual_oat: 'annual_staple_low_input', oats_low_input_synthesis: 'annual_staple_low_input',
  annual_buckwheat: 'annual_staple_low_input', buckwheat_low_input_synthesis: 'annual_staple_low_input',
  annual_dry_bean: 'annual_legume_oilseed_low_input', dry_beans_low_input_synthesis: 'annual_legume_oilseed_low_input',
  annual_sunflower: 'annual_legume_oilseed_low_input', sunflower_low_input_synthesis: 'annual_legume_oilseed_low_input',
  annual_carrot: 'annual_intensive_vegetable', carrot_low_input_synthesis: 'annual_intensive_vegetable', carrot_raw: 'annual_intensive_vegetable', leafy_green_raw: 'annual_intensive_vegetable',
  perennial_raspberry: 'early_berry', early_berry_low_input_synthesis: 'early_berry',
  perennial_hazelnut: 'intermediate_nut_shrub', intermediate_hazelnut_low_input_synthesis: 'intermediate_nut_shrub',
  perennial_apple_pear: 'intermediate_fruit_tree', intermediate_apple_low_input_synthesis: 'intermediate_fruit_tree',
  perennial_chinese_chestnut: 'long_staple_tree', long_staple_chestnut_low_input_synthesis: 'long_staple_tree', perennial_black_walnut: 'long_staple_tree',
  perennial_vegetable: 'perennial_vegetable',
  support_black_locust: 'long_staple_tree', support_honey_locust: 'long_staple_tree', support_siberian_peashrub: 'long_staple_tree', support_autumn_olive: 'early_berry', support_clover: 'perennial_vegetable'
});

const labourRows = Object.fromEntries((labourEvidence.rows ?? []).map((row) => [row.id, row]));
export const LABOUR_CATEGORIES = Object.freeze([
  'annual_crops', 'perennial_food_forest', 'livestock', 'harvesting', 'food_preservation_storage',
  'fertility_nutrient_cycling', 'seed_propagation', 'water_management', 'system_maintenance'
]);
export const CLOSED_LOOP_WORK_ITEMS = Object.freeze([
  {id: 'initial_seed_and_planting_stock', labour_category: 'seed_propagation', input_category: 'externally_purchased_imported', timing: 'establishment', unit: 'not quantified', evidence_status: 'unresolved'},
  {id: 'seed_saving_and_propagation', labour_category: 'seed_propagation', input_category: 'produced_recycled_on_site', timing: 'recurring', unit: 'person-hours/year; coefficient missing', evidence_status: 'unresolved'},
  {id: 'fertility_and_biomass_cycling', labour_category: 'fertility_nutrient_cycling', input_category: 'produced_recycled_on_site', timing: 'recurring', unit: 'person-hours/year; coefficient missing', evidence_status: 'unresolved'},
  {id: 'humanure_and_nutrient_recycling', labour_category: 'fertility_nutrient_cycling', input_category: 'reused_community_shared_resource', timing: 'recurring', unit: 'person-hours/year; approval and coefficient missing', evidence_status: 'unresolved'},
  {id: 'fuel_electricity_and_equipment', labour_category: 'system_maintenance', input_category: 'externally_purchased_imported', timing: 'recurring', unit: 'fuel/electricity quantity not quantified', evidence_status: 'unresolved'},
  {id: 'irrigation_water_source', labour_category: 'water_management', input_category: 'unresolved', timing: 'recurring', unit: 'water volume and energy not quantified', evidence_status: 'unresolved'},
  {id: 'support_plant_management', labour_category: 'system_maintenance', input_category: 'produced_recycled_on_site', timing: 'recurring', unit: 'person-hours/year; support records required', evidence_status: 'unresolved'},
  {id: 'production_records', labour_category: 'system_maintenance', input_category: 'unresolved', timing: 'recurring', unit: 'production record required', evidence_status: 'unresolved'}
]);
const emptyCategories = () => Object.fromEntries(LABOUR_CATEGORIES.map((id) => [id, 0]));

const seasonalWeights = Object.freeze({
  annual_crops: [0, 0, 0, .10, .25, .30, .20, .10, .05, 0, 0, 0],
  perennial_food_forest: [0, 0, 0, .20, .25, .20, .15, .10, .05, .05, 0, 0],
  livestock: Array.from({length: 12}, () => 1 / 12),
  harvesting: [0, 0, 0, 0, .05, .10, .15, .20, .25, .20, .05, 0],
  food_preservation_storage: [.05, 0, 0, 0, 0, .05, .10, .20, .25, .20, .10, .05],
  fertility_nutrient_cycling: [.05, .05, .10, .15, .20, .15, .10, .10, .05, .025, 0, 0],
  seed_propagation: [.10, .10, .10, .20, .15, .10, .05, .05, .05, .05, .025, 0],
  water_management: [.05, .05, .05, .15, .20, .15, .10, .10, .05, .05, .025, .025],
  system_maintenance: [.05, .05, .05, .15, .20, .15, .10, .10, .05, .05, .025, .025]
});

const TASK_FIELDS = Object.freeze({
  soil_preparation: {label: 'Soil preparation', field: 'soil_preparation_hours_per_ha', category: 'annual_crops'},
  planting: {label: 'Annual planting/replanting', field: 'planting_hours_per_ha', category: 'annual_crops'},
  weeding: {label: 'Weed suppression', field: 'weeding_hours_per_ha', category: 'annual_crops'},
  pruning: {label: 'Pruning/training', field: 'pruning_maintenance_hours_per_ha', category: 'perennial_food_forest'},
  orchard: {label: 'Orchard/food-forest maintenance', field: 'orchard_maintenance_hours_per_ha', category: 'perennial_food_forest'},
  perennial_weeding: {label: 'Perennial weed/mulch zone management', field: 'weeding_hours_per_ha', category: 'perennial_food_forest'},
  irrigation: {label: 'Water management', field: 'irrigation_monitoring_hours_per_ha', category: 'water_management'},
  pest: {label: 'Pest/wildlife monitoring', field: 'pest_wildlife_management_hours_per_ha', category: 'system_maintenance'},
  harvest: {label: 'Harvest', field: 'harvest_hours_per_ha', category: 'harvesting'},
  processing: {label: 'Preservation/storage processing', field: 'processing_storage_hours_per_ha', category: 'food_preservation_storage'}
});

// These curves are task-specific planning assumptions. Bearing affects harvest
// and processing only; young plants still need site care before they yield.
const PERENNIAL_TASK_CURVES = Object.freeze({
  pruning: {1: .35, 2: .60, 3: .80, 5: .95, 10: 1, mature: 1},
  orchard: {1: .55, 2: .75, 3: .90, 5: .95, 10: 1, mature: 1},
  perennial_weeding: {1: 1, 2: 1, 3: .95, 5: .90, 10: .80, mature: .75},
  irrigation: {1: 1, 2: 1, 3: .90, 5: .80, 10: .65, mature: .55},
  pest: {1: 1, 2: 1, 3: 1, 5: 1, 10: 1, mature: 1}
});

function curveAt(curve, year) {
  const numericYear = year === 'mature' ? 30 : Number(year);
  const anchors = Object.entries(curve).map(([key, value]) => [key === 'mature' ? 30 : Number(key), Number(value)]).sort((a, b) => a[0] - b[0]);
  const prior = anchors.filter(([key]) => key <= numericYear).at(-1);
  const next = anchors.find(([key]) => key >= numericYear);
  if (!prior) return anchors[0]?.[1] ?? 1;
  if (!next || prior[0] === next[0]) return prior[1];
  return prior[1] + (next[1] - prior[1]) * (numericYear - prior[0]) / (next[0] - prior[0]);
}

function taskNumber(profile, key) { return number(profile?.[key], 0); }

function profileForId(id, records = []) {
  const record = records.find((row) => row.id === id);
  const profileId = LABOUR_PROFILE_BY_PRODUCTION_ID[id] ?? LABOUR_PROFILE_BY_PRODUCTION_ID[record?.outputs?.[0]?.nutrition?.composition_id];
  return {profileId, profile: profileId ? labourRows[profileId] : null, record};
}

function productionRowsForYear({foodSuccessionRow, wholeDietRow} = {}) {
  if (foodSuccessionRow) return (foodSuccessionRow.foods ?? []).map((row) => ({
    id: row.id,
    label: row.label ?? row.species ?? row.id,
    production_type: row.production_type,
    area_ha: number(row.area_ha, 0),
    bearing_factor: number(row.bearing_factor, 1),
    produced_food_kg_year: number(row.produced_food_kg_year ?? row.gross_edible_harvest_kg, null),
    retained_food_kg_year: number(row.retained_food_kg_year ?? row.retained_edible_harvest_kg, null),
    food_energy_gj_year: number(row.consumed_food_energy_gj_year ?? row.retained_food_energy_gj_year, 0),
    production_status: row.production_status ?? null,
    source: row.source ?? null,
    evidence_status: row.evidence_status ?? null
  }));
  if (!wholeDietRow) return [];
  return [
    ...(wholeDietRow.produced?.annual ?? []).map((row) => ({id: row.plant_id, label: row.plant_id, production_type: 'annual', area_ha: number(row.required_area_ha, 0), bearing_factor: 1, produced_food_kg_year: number(row.produced_food_kg_year, null), retained_food_kg_year: number(row.consumed_food_kg_year, null)})),
    ...(wholeDietRow.produced?.perennial ?? []).map((row) => ({id: row.plant_id, label: row.plant_id, production_type: 'perennial', area_ha: number(row.area_ha, 0), bearing_factor: number(row.bearing_factor, 0), produced_food_kg_year: number(row.harvest_kg_year, null), retained_food_kg_year: number(row.harvest_kg_year, null)}))
  ];
}

function addCategories(target, source, multiplier = 1) {
  for (const id of LABOUR_CATEGORIES) target[id] += Number(source[id] ?? 0) * multiplier;
}

function addSeasonalHours(months, categories) {
  for (const category of LABOUR_CATEGORIES) {
    const weights = seasonalWeights[category];
    const total = Number(categories[category] ?? 0);
    for (let index = 0; index < 12; index += 1) months[index] += total * (weights?.[index] ?? 0);
  }
}

function livestockHoursForYear(animals = [], year) {
  const result = {recurring: 0, processing: 0};
  for (const animal of animals) {
    const starts = Number(animal.production_start_year ?? 1);
    if (!(year === 'mature' || Number(year) >= starts)) continue;
    result.recurring += Number(animal.labour?.recurring_hours_year ?? 0);
    result.processing += Number(animal.labour?.slaughter_processing_hours_year ?? 0);
  }
  return result;
}

function stageNutrition({row, animalEnergy = 0, demandGJ = 0, proteinDemandKgYear = null} = {}) {
  const consumed = Number(row?.consumed_food_energy_gj_year ?? 0) + animalEnergy;
  const energy = {adequate: consumed >= Number(demandGJ) - 1e-9, supplied_gj_year: round(consumed), demand_gj_year: round(demandGJ)};
  const proteinSupply = Number(row?.macro_summary?.mass_kg_year?.protein ?? NaN);
  const proteinRatio = Number(row?.nutrients?.protein?.adequacy_ratio ?? row?.whole_diet?.protein_adequacy_ratio ?? (Number.isFinite(proteinSupply) && Number(proteinDemandKgYear) > 0 ? proteinSupply / Number(proteinDemandKgYear) : NaN));
  const protein = {adequate: Number.isFinite(proteinRatio) ? proteinRatio >= 1 : null, supplied_kg_year: Number.isFinite(proteinSupply) ? round(proteinSupply) : null, demand_kg_year: Number(proteinDemandKgYear) > 0 ? round(proteinDemandKgYear) : null, adequacy_ratio: Number.isFinite(proteinRatio) ? round(proteinRatio) : null};
  const external = (row?.external_inputs ?? []).map((item) => item.nutrient ?? item.id ?? String(item));
  const status = energy.adequate && protein.adequate !== false ? 'adequacy_reported_with_external_boundaries' : energy.adequate ? 'protein_or_tracked_nutrient_constraint' : 'food_energy_deficit';
  return {status, energy, protein, external_inputs: external, note: 'Nutrition status is read from the same year-specific food ledger. An immature perennial system is never treated as sufficient merely because its labour is low.'};
}

function actualHarvestFactor(production, matureById) {
  if (production.production_type !== 'perennial') return 1;
  const mature = matureById.get(production.id);
  const actual = Number(production.produced_food_kg_year);
  const matureHarvest = Number(mature?.produced_food_kg_year);
  if (Number.isFinite(actual) && Number.isFinite(matureHarvest) && matureHarvest > 0) return clamp(actual / matureHarvest);
  return clamp(production.bearing_factor);
}

function taskDevelopmentFactor(taskId, year, productionType) {
  if (productionType === 'annual') return 1;
  return curveAt(PERENNIAL_TASK_CURVES[taskId] ?? {1: 1, mature: 1}, year);
}

function taskRow({production, profile, profileId, taskId, year, quantity, activityFactor = 1, sourceKind = 'recurring'}) {
  const definition = TASK_FIELDS[taskId];
  const coefficient = taskNumber(profile, definition.field);
  const hours = coefficient * quantity;
  return {
    id: `${sourceKind}:${year}:${production.id}:${taskId}`,
    production_id: production.id,
    crop_or_species: production.label,
    production_type: production.production_type,
    year,
    task: taskId,
    labour_task: definition.label,
    category: definition.category,
    coefficient,
    coefficient_unit: 'person-hours/ha',
    quantity_ha: round(quantity, 6),
    activity_factor: round(activityFactor, 6),
    calculated_hours: round(hours, 3),
    edible_harvest_kg_year: production.produced_food_kg_year,
    retained_edible_harvest_kg_year: production.retained_food_kg_year,
    bearing_factor: production.bearing_factor,
    profile_id: profileId,
    source: profile.source ?? null,
    evidence_type: profile.evidence_type ?? null,
    mechanization_assumption: LABOUR_MECHANIZATION_ASSUMPTION.id,
    accounting_note: sourceKind === 'establishment' ? 'One-time crop/perennial establishment task; site infrastructure is separate.' : taskId === 'harvest' || taskId === 'processing' ? 'Harvest/processing activity is scaled by actual edible production relative to the mature production row where available.' : 'Additive task coefficient; no normalization to mature_recurring_hours_per_ha.'
  };
}

function recurringTaskRows(production, profile, profileId, year, matureById) {
  const annual = production.production_type === 'annual';
  const taskIds = annual ? ['soil_preparation', 'planting', 'weeding', 'irrigation', 'pest', 'harvest', 'processing'] : ['pruning', 'orchard', 'perennial_weeding', 'irrigation', 'pest', 'harvest', 'processing'];
  const harvestFactor = actualHarvestFactor(production, matureById);
  return taskIds.map((taskId) => {
    const definition = TASK_FIELDS[taskId];
    const development = taskDevelopmentFactor(taskId, year, production.production_type);
    const activity = taskId === 'harvest' || taskId === 'processing' ? harvestFactor : development;
    return taskRow({production, profile, profileId, taskId, year, quantity: Number(production.area_ha ?? 0) * activity, activityFactor: activity});
  });
}

function establishmentTaskRows(production, profile, profileId, year) {
  const coefficient = taskNumber(profile, 'establishment_hours_per_ha');
  return [{
    id: `establishment:${year}:${production.id}`,
    production_id: production.id,
    crop_or_species: production.label,
    production_type: production.production_type,
    year,
    task: 'initial_establishment',
    labour_task: 'Initial land preparation, planting and establishment',
    category: production.production_type === 'annual' ? 'annual_crops' : 'perennial_food_forest',
    coefficient,
    coefficient_unit: 'person-hours/ha',
    quantity_ha: round(Number(production.area_ha ?? 0), 6),
    activity_factor: 1,
    calculated_hours: round(coefficient * Number(production.area_ha ?? 0), 3),
    edible_harvest_kg_year: production.produced_food_kg_year,
    retained_edible_harvest_kg_year: production.retained_food_kg_year,
    bearing_factor: production.bearing_factor,
    profile_id: profileId,
    source: profile.source ?? null,
    evidence_type: profile.evidence_type ?? null,
    mechanization_assumption: LABOUR_MECHANIZATION_ASSUMPTION.id,
    accounting_note: 'Food-crop and perennial establishment labour only; fencing, water, access, earthworks and other site infrastructure are not included.'
  }];
}

function categoryHours(rows) {
  const categories = emptyCategories();
  for (const row of rows) categories[row.category] += Number(row.calculated_hours ?? 0);
  return categories;
}

function unresolvedClosedLoopWork({productionRows, supportRecords, isYearZero}) {
  const rows = [];
  const add = (id, reason) => {
    const definition = CLOSED_LOOP_WORK_ITEMS.find((item) => item.id === id);
    rows.push({...definition, status: 'unresolved', amount: null, reason});
  };
  if (isYearZero) add('initial_seed_and_planting_stock', 'Initial seed, tree/shrub stock and propagation material are not costed by the food-production labour source.');
  add('seed_saving_and_propagation', 'Seed saving, nursery work and perennial replacement are required for a low-input system but have no numeric task coefficient in the current source table.');
  add('fertility_and_biomass_cycling', 'Compost, mulch, chop-and-drop and nutrient application work are required to replace recurring purchased fertility; current source has no additive hours/ha coefficient.');
  add('humanure_and_nutrient_recycling', 'Existing nutrient ledger can calculate treated recovery, but this food path does not yet supply a site-approved humanure schedule or labour coefficient.');
  add('fuel_electricity_and_equipment', 'Low-input household equipment and operator hours are explicit; fuel/electricity quantities are not yet coupled to this task ledger.');
  add('irrigation_water_source', 'Water-management hours are counted from the source coefficient, but source, pumping energy and approval requirements are site-specific.');
  if (!supportRecords.length) add('support_plant_management', 'Support-plant records were not supplied to this household food ledger; support management is not treated as zero.');
  if (!productionRows.length) add('production_records', 'No production rows were supplied.');
  return rows;
}

function nutrientInputLedger({productionRows, supportPlants = [], people = 1, humanureEnabled = false}) {
  const production = productionRows.map((row) => ({retained_edible_harvest_kg: Number(row.retained_food_kg_year ?? 0), residue_kg_dm: Number(row.residue_kg_dm_year ?? 0)}));
  const humanure = calculateHumanureContribution({people, enabled: humanureEnabled});
  const flows = calculatePlantNutrientFlows({production, supportPlants, humanure});
  const balance = calculateNutrientLedger({years: [1], initialStocks: {N: 0, P: 0, K: 0}, annual: {production, supportPlants, densities: undefined}, humanure, externalInputs: {N: 0, P: 0, K: 0}});
  return {humanure, flows, balance: balance.years[0]?.balance, status: 'incomplete_input_streams', assumptions: {initial_stocks: 'zero only for this flow audit; not a soil-stock estimate', residue_return: 'only row-level residue_kg_dm_year is credited', support_fixation: 'only supplied support records are credited'}, note: 'This is an audit of currently wired nutrient flows only. Residue return, fixation availability, humanure approval, mineral replacement and nutrient losses remain unresolved rather than being treated as zero.'};
}

export function calculateFoodProductionLabour({foodSuccessionLedger = null, wholeDiet = null, records = [], animals = [], years = null, supportPlantRatio = .25, perennialFootprintHa = null, proteinDemandKgYear = null, availableLabourHoursYear = null, participatingWorkers = null, projectionMode = LABOUR_PROJECTION_MODE, householdPeople = 1, humanureEnabled = false} = {}) {
  const sourceYears = years ?? foodSuccessionLedger?.rows?.map((row) => row.year) ?? wholeDiet?.years?.map((row) => row.year) ?? [];
  const normalizedYears = [...new Set(sourceYears)].filter((year) => year !== 0);
  const firstRow = foodSuccessionLedger?.rows?.[0] ?? wholeDiet?.years?.[0];
  const inferredFootprint = Number(perennialFootprintHa ?? firstRow?.planted_perennial_footprint_ha ?? foodSuccessionLedger?.planted_perennial_footprint_ha ?? 0);
  const supportRecords = records.filter((record) => record.architecture?.life_cycle === 'support' || record.architecture?.layer === 'support');
  const supportArea = inferredFootprint * Number(supportPlantRatio) / Math.max(1, supportRecords.length);
  const missing = [];
  const allSourceRows = [...(foodSuccessionLedger?.rows ?? []), ...(wholeDiet?.years ?? [])];
  const firstProductions = productionRowsForYear({foodSuccessionRow: foodSuccessionLedger ? firstRow : null, wholeDietRow: wholeDiet ? firstRow : null});
  const establishmentRows = [];
  for (const production of firstProductions) {
    const {profile, profileId} = profileForId(production.id, records);
    if (!profile) { missing.push({id: production.id, reason: 'No mapped labour evidence profile'}); continue; }
    establishmentRows.push(...establishmentTaskRows(production, profile, profileId, 0));
  }
  for (const record of supportRecords) {
    const {profile, profileId} = profileForId(record.id, records);
    if (!profile) { missing.push({id: record.id, reason: 'No mapped support-plant labour evidence profile'}); continue; }
    establishmentRows.push({id: 'establishment:0:' + record.id, production_id: record.id, crop_or_species: record.label ?? record.id, production_type: 'support', year: 0, task: 'support_establishment', labour_task: 'Support-plant establishment', category: 'system_maintenance', coefficient: taskNumber(profile, 'establishment_hours_per_ha'), coefficient_unit: 'person-hours/ha', quantity_ha: round(supportArea, 6), activity_factor: 1, calculated_hours: round(taskNumber(profile, 'establishment_hours_per_ha') * supportArea, 3), profile_id: profileId, source: profile.source ?? null, evidence_type: profile.evidence_type ?? null, mechanization_assumption: LABOUR_MECHANIZATION_ASSUMPTION.id});
  }

  const matureProductions = productionRowsForYear({foodSuccessionRow: foodSuccessionLedger?.rows?.find((row) => row.year === 'mature'), wholeDietRow: wholeDiet?.years?.find((row) => row.year === 'mature')});
  const matureById = new Map(matureProductions.map((row) => [row.id, row]));
  const buildStage = (year, sourceRow, isYearZero = false) => {
    const rawProductionRows = productionRowsForYear({foodSuccessionRow: foodSuccessionLedger ? sourceRow : null, wholeDietRow: wholeDiet ? sourceRow : null});
    const productionRows = isYearZero
      ? firstProductions.map((row) => ({...row, bearing_factor: 0, produced_food_kg_year: 0, retained_food_kg_year: 0, food_energy_gj_year: 0, production_status: 'planted; establishment year; no food output credited'}))
      : rawProductionRows;
    const taskRows = [];
    for (const production of productionRows) {
      const {profile, profileId} = profileForId(production.id, records);
      if (!profile) { missing.push({id: production.id, year, reason: 'No mapped labour evidence profile'}); continue; }
      taskRows.push(...(isYearZero ? [] : recurringTaskRows(production, profile, profileId, year, matureById)));
    }
    const livestock = isYearZero ? {recurring: 0, processing: 0} : livestockHoursForYear(animals, year);
    if (livestock.recurring) taskRows.push({id: `recurring:${year}:livestock-care`, production_id: 'livestock', crop_or_species: 'Selected livestock', production_type: 'livestock', year, task: 'care', labour_task: 'Livestock recurring care', category: 'livestock', coefficient: livestock.recurring, coefficient_unit: 'person-hours/year', quantity_ha: null, activity_factor: 1, calculated_hours: round(livestock.recurring), mechanization_assumption: LABOUR_MECHANIZATION_ASSUMPTION.id});
    if (livestock.processing) taskRows.push({id: `recurring:${year}:livestock-processing`, production_id: 'livestock', crop_or_species: 'Selected livestock', production_type: 'livestock', year, task: 'processing', labour_task: 'Livestock processing', category: 'food_preservation_storage', coefficient: livestock.processing, coefficient_unit: 'person-hours/year', quantity_ha: null, activity_factor: 1, calculated_hours: round(livestock.processing), mechanization_assumption: LABOUR_MECHANIZATION_ASSUMPTION.id});
    for (const record of supportRecords) {
      const {profile, profileId} = profileForId(record.id, records);
      if (!profile) continue;
      taskRows.push({id: `recurring:${year}:${record.id}:support`, production_id: record.id, crop_or_species: record.label ?? record.id, production_type: 'support', year, task: 'support_maintenance', labour_task: 'Support-plant management', category: 'system_maintenance', coefficient: taskNumber(profile, 'mature_recurring_hours_per_ha'), coefficient_unit: 'person-hours/ha', quantity_ha: round(supportArea, 6), activity_factor: .75, calculated_hours: round(taskNumber(profile, 'mature_recurring_hours_per_ha') * supportArea * .75), profile_id: profileId, source: profile.source ?? null, evidence_type: profile.evidence_type ?? null, mechanization_assumption: LABOUR_MECHANIZATION_ASSUMPTION.id, accounting_note: 'Support plants are an overlay; their labour is not added as a second productive hectare.'});
    }
    const categories = categoryHours(taskRows);
    const establishment = isYearZero ? establishmentRows : [];
    const establishmentCategories = categoryHours(establishment);
    const recurringHours = Object.values(categories).reduce((sum, value) => sum + value, 0);
    const establishmentHours = Object.values(establishmentCategories).reduce((sum, value) => sum + value, 0);
    const totalHours = recurringHours + establishmentHours;
    const months = Array.from({length: 12}, () => 0);
    addSeasonalHours(months, categories); addSeasonalHours(months, establishmentCategories);
    const peakHours = Math.max(...months, 0); const peakIndex = months.indexOf(peakHours);
    const demand = Number(sourceRow?.household_food_demand_gj_year ?? 0);
    const activeAnimals = animals.filter((animal) => year === 'mature' || Number(year) >= Number(animal.production_start_year ?? 1));
    const animalEnergy = activeAnimals.reduce((sum, animal) => sum + Number(animal.output?.food_energy_gj_year ?? 0), 0);
    const annualFoodEnergy = sourceRow?.annual_food_energy_gj_year != null ? Number(sourceRow.annual_food_energy_gj_year) : Math.max(0, Number(sourceRow?.consumed_food_energy_gj_year ?? 0) - Number(sourceRow?.perennial_food_energy_consumed_gj_year ?? 0));
    const perennialFoodEnergy = Number(sourceRow?.perennial_food_energy_consumed_gj_year ?? 0);
    const totalUsableFoodEnergy = annualFoodEnergy + perennialFoodEnergy + animalEnergy;
    const foodRows = productionRows.map((row) => ({crop_or_species: row.label, crop_id: row.id, production_type: row.production_type, area_ha: round(row.area_ha, 6), bearing_factor: round(row.bearing_factor, 6), edible_harvest_kg_year: row.produced_food_kg_year, retained_edible_harvest_kg_year: row.retained_food_kg_year, food_energy_gj_year: round(row.food_energy_gj_year ?? 0, 6), production_status: row.production_status, source: row.source, evidence_status: row.evidence_status}));
    const unresolved = unresolvedClosedLoopWork({productionRows, supportRecords, isYearZero});
    const supportPlants = supportRecords.map((record) => ({plant_id: record.id, area_ha: supportArea, nitrogen_fixed_kg_ha_year: Number(record.ecological_function?.nitrogen_fixation_kg_n_ha_year?.central ?? record.ecological_function?.nitrogen_fixation_kg_n_ha_year ?? 0)}));
    const closedLoop = nutrientInputLedger({productionRows, supportPlants, people: householdPeople, humanureEnabled});
    const topContributors = [...taskRows, ...establishment].sort((a, b) => Number(b.calculated_hours) - Number(a.calculated_hours)).slice(0, 5).map((row) => ({task: row.labour_task, crop_or_species: row.crop_or_species, hours_year: row.calculated_hours, category: row.category}));
    const sumRows = [...taskRows, ...establishment].reduce((sum, row) => sum + Number(row.calculated_hours ?? 0), 0);
    return {
      year, projection_mode: projectionMode, household_food_demand_gj_year: round(demand), people_fed: householdPeople,
      annual_area_ha: round(productionRows.filter((row) => row.production_type === 'annual').reduce((sum, row) => sum + row.area_ha, 0), 6),
      perennial_area_ha: round(productionRows.filter((row) => row.production_type === 'perennial').reduce((sum, row) => sum + row.area_ha, 0), 6),
      food_production_by_crop: foodRows, task_rows: taskRows, establishment_task_rows: establishment, audit_rows: [...establishment, ...taskRows],
      establishment_hours_year: round(establishmentHours), recurring_hours_year: round(recurringHours), total_hours_year: round(totalHours),
      average_hours_week: round(totalHours / LABOUR_WEEKS_PER_YEAR, 2), recurring_average_hours_week: round(recurringHours / LABOUR_WEEKS_PER_YEAR, 2),
      hours_per_person_week: participatingWorkers ? round(totalHours / LABOUR_WEEKS_PER_YEAR / Number(participatingWorkers), 2) : round(totalHours / LABOUR_WEEKS_PER_YEAR, 2),
      hours_per_household_week: round(totalHours / LABOUR_WEEKS_PER_YEAR, 2), seasonal_peak_hours_week: round(peakHours / (365.25 / 12 / 7), 2), peak_month: peakIndex >= 0 ? peakIndex + 1 : null, monthly_hours: months.map((value) => round(value, 2)),
      categories: Object.fromEntries(Object.entries(categories).map(([id, value]) => [id, round(value, 2)])), establishment_categories: Object.fromEntries(Object.entries(establishmentCategories).map(([id, value]) => [id, round(value, 2)])),
      task_hours_reconciliation: {visible_task_rows_hours: round(sumRows), reported_total_hours: round(totalHours), difference_hours: round(sumRows - totalHours), balanced: Math.abs(sumRows - totalHours) < .001},
      food: {household_food_demand_gj_year: round(demand), annual_food_energy_gj_year: round(annualFoodEnergy), perennial_food_energy_gj_year: round(perennialFoodEnergy), animal_food_energy_gj_year: round(animalEnergy), total_usable_food_energy_gj_year: round(totalUsableFoodEnergy), annual_food_percent: demand > 0 ? round(annualFoodEnergy / demand * 100, 2) : null, perennial_food_percent: demand > 0 ? round(perennialFoodEnergy / demand * 100, 2) : null, energy_sufficiency: isYearZero ? false : totalUsableFoodEnergy >= demand - 1e-9},
      nutrition: isYearZero ? {status: 'not_yet_producing', food_sufficiency: false, note: 'Year 0 is crop/perennial establishment before the first production season.'} : stageNutrition({row: sourceRow, animalEnergy, demandGJ: demand, proteinDemandKgYear}),
      external_input_ledger: {establishment_external_inputs: unresolved.filter((row) => row.timing === 'establishment'), recurring_external_inputs: unresolved.filter((row) => row.timing === 'recurring' && row.input_category === 'externally_purchased_imported'), internally_regenerated_inputs: unresolved.filter((row) => row.timing === 'recurring' && ['produced_recycled_on_site', 'reused_community_shared_resource'].includes(row.input_category)), unresolved_inputs: unresolved.filter((row) => row.input_category === 'unresolved'), unresolved_closed_loop_dependencies: unresolved, nutrient_ledger: closedLoop, status: unresolved.length ? 'unresolved' : 'low_recurring_external_input'},
      closed_loop_labour_gaps: unresolved.filter((row) => row.labour_category).map((row) => ({id: row.id, category: row.labour_category, status: 'unresolved', hours_year: null, unit: row.unit, reason: row.reason})),
      closed_loop_status: unresolved.length ? 'unresolved' : 'low_recurring_external_input', unresolved_work: unresolved, top_labour_contributors: topContributors, data_quality: {status: missing.length || unresolved.length ? 'partial' : 'complete', missing_labour_data_count: missing.length, unresolved_closed_loop_dependency_count: unresolved.length}
    };
  };
  const stages = [buildStage(0, {household_food_demand_gj_year: Number(firstRow?.household_food_demand_gj_year ?? 0)}, true), ...normalizedYears.map((year) => buildStage(year, foodSuccessionLedger?.rows?.find((row) => row.year === year) ?? wholeDiet?.years?.find((row) => row.year === year)))];
  const available = number(availableLabourHoursYear);
  const capacity = available == null ? null : {available_hours_year: round(available), available_hours_week: round(available / LABOUR_WEEKS_PER_YEAR, 2), participating_workers: participatingWorkers == null ? null : Number(participatingWorkers)};
  const capacityStages = stages.map((stage) => {
    if (!capacity || !(capacity.available_hours_week > 0)) return {...stage, capacity: {status: 'unresolved', utilization: null, note: 'No available food-production labour input was supplied.'}};
    const utilization = stage.total_hours_year / capacity.available_hours_year;
    const status = utilization <= LABOUR_CAPACITY_THRESHOLDS.comfortable_max_utilization ? 'comfortable' : utilization <= LABOUR_CAPACITY_THRESHOLDS.high_max_utilization ? 'high' : 'exceeded';
    return {...stage, capacity: {status, utilization: round(utilization), utilization_percent: round(utilization * 100, 1), available_hours_year: capacity.available_hours_year, available_hours_week: capacity.available_hours_week}};
  });
  const totals = capacityStages.reduce((best, row) => row.total_hours_year > best.total_hours_year ? row : best, capacityStages[0] ?? {total_hours_year: 0});
  const referenceReconciliation = labourEvidence.rows.map((profile) => {
    const fields = profile.production_class.startsWith('Annual') ? ['soil_preparation_hours_per_ha', 'planting_hours_per_ha', 'weeding_hours_per_ha', 'harvest_hours_per_ha', 'irrigation_monitoring_hours_per_ha', 'pest_wildlife_management_hours_per_ha', 'processing_storage_hours_per_ha'] : ['pruning_maintenance_hours_per_ha', 'orchard_maintenance_hours_per_ha', 'weeding_hours_per_ha', 'harvest_hours_per_ha', 'irrigation_monitoring_hours_per_ha', 'pest_wildlife_management_hours_per_ha', 'processing_storage_hours_per_ha'];
    const additive = fields.reduce((sum, field) => sum + taskNumber(profile, field), 0);
    return {id: profile.id, additive_task_hours_per_ha: round(additive), source_reference_mature_recurring_hours_per_ha: number(profile.mature_recurring_hours_per_ha), difference_hours_per_ha: round(additive - taskNumber(profile, 'mature_recurring_hours_per_ha')), accounting_basis: 'additive task coefficients are canonical; mature_recurring_hours_per_ha is retained as a separate source reference and is not used to normalize task rows', source: profile.source, evidence_type: profile.evidence_type};
  });
  return {
    contract_version: FOOD_PRODUCTION_LABOUR_CONTRACT_VERSION,
    projection_mode: projectionMode,
    people_fed: householdPeople,
    source: labourEvidence.source,
    evidence_boundary: 'Hours use the existing evidence-informed production labour table. They are additive planning estimates, not Grey-Bruce time-and-motion observations. Closed-loop replacement work without coefficients remains visible as unresolved rather than being treated as zero.',
    units: {hours: 'person-hours/year', average: 'person-hours/week', area_basis: 'person-hours/ha', harvest_basis: 'person-hours/ha scaled by actual harvest fraction where mass is available'},
    categories: LABOUR_CATEGORIES,
    scope: 'Food-crop and perennial establishment labour only. Site acquisition, access, water-system installation, fencing, earthworks and other site infrastructure are outside this ledger and unresolved separately.',
    mechanization_assumption: LABOUR_MECHANIZATION_ASSUMPTION,
    development_curves: {perennial_task_curves: PERENNIAL_TASK_CURVES, provenance: 'Planning curves keep maintenance tasks active before bearing; numeric local time-series observations are unavailable and must be replaced by measured household data.'},
    seasonal_method: 'Coarse month weights distribute source task categories across planting, growing, harvest and winter preservation periods; distributions are planning sensitivities, not measured calendars.',
    reference_reconciliation: referenceReconciliation,
    historical_reconciliation: {
      previous_time_aware_reference_adult_mature_hours_year: 93.228,
      previous_mature_food_system_reference_adult_hours_year: 134,
      source: 'packages/carrying-capacity/outputs/mature-food-system-canonical.md and the pre-2.0 food-production labour contract',
      status: 'historical comparison only; the additive task ledger below is now the single canonical food-production labour pathway',
      explanation: 'The 93.228 h/year result used normalized task totals and generic bearing-based perennial maintenance. The 134 h/year result came from the earlier mature trade-off ledger, which used its own class-level labour aggregation and a different canonical share/reporting boundary. The current ledger exposes crop/task/area/production rows so the difference can be reconciled rather than hidden.'
    },
    capacity_thresholds: LABOUR_CAPACITY_THRESHOLDS,
    stages: capacityStages,
    peak_stage: totals.year,
    peak_hours_year: round(totals.total_hours_year),
    missing_data: [...new Map(missing.map((row) => [`${row.id}:${row.reason}`, row])).values()],
    closed_loop_assessment: {status: 'unresolved', reason: 'Food production is energy-sufficient in the selected stages, but nutrient return, propagation, water source, equipment energy and recurring mineral requirements are not all quantified in the current ledger.', categories: ['produced/recycled on site', 'reused community/shared resource', 'externally purchased/imported', 'unresolved'], labour_gap_rule: 'Closed-loop replacement work is not assigned zero hours. It remains a visible unresolved labour gap until a coefficient with units and provenance is supplied.', nutrient_ledger_boundary: 'Existing nutrient and humanure ledgers are attached per stage. They expose only currently supplied flows; missing residue, fixation, approval and mineral streams remain unresolved.'},
    closed_loop_work_items: CLOSED_LOOP_WORK_ITEMS,
    source_profiles: labourEvidence.rows.map((row) => ({id: row.id, production_class: row.production_class, establishment_hours_per_ha: number(row.establishment_hours_per_ha), mature_recurring_hours_per_ha: number(row.mature_recurring_hours_per_ha), source: row.source, evidence_type: row.evidence_type, notes: row.notes}))
  };
}

export function compareFoodLabourCapacity(labourLedger, {availableHoursYear = null, participatingWorkers = null} = {}) {
  const available = number(availableHoursYear);
  return labourLedger.stages.map((stage) => {
    if (!(available > 0)) return {year: stage.year, status: 'unresolved', utilization: null};
    const utilization = Number(stage.total_hours_year ?? 0) / available;
    return {year: stage.year, available_hours_year: round(available), available_hours_week: round(available / LABOUR_WEEKS_PER_YEAR, 2), required_hours_week: stage.average_hours_week, utilization: round(utilization), utilization_percent: round(utilization * 100, 1), participating_workers: participatingWorkers, status: utilization <= LABOUR_CAPACITY_THRESHOLDS.comfortable_max_utilization ? 'comfortable' : utilization <= LABOUR_CAPACITY_THRESHOLDS.high_max_utilization ? 'high' : 'exceeded'};
  });
}
