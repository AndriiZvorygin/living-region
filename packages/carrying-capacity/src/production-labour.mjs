import labourEvidence from '../data/derived/food-production-labour.json' with {type: 'json'};

export const FOOD_PRODUCTION_LABOUR_CONTRACT_VERSION = '1.0.0';
export const LABOUR_WEEKS_PER_YEAR = 365.25 / 7;
export const LABOUR_DAYS_PER_YEAR = 365.25;
export const LABOUR_CAPACITY_THRESHOLDS = Object.freeze({
  comfortable_max_utilization: .75,
  high_max_utilization: 1,
  labels: Object.freeze({comfortable: 'comfortable labour margin', high: 'high labour demand', exceeded: 'labour capacity exceeded'})
});

const round = (value, digits = 3) => Math.round(Number(value) * 10 ** digits) / 10 ** digits;
const number = (value, fallback = null) => Number.isFinite(Number(value)) ? Number(value) : fallback;

// The source labour table uses production classes while the food ledgers use
// stable crop/evidence IDs. This is a mapping layer, not a second coefficient
// table; all hours come from the generated labour evidence rows.
export const LABOUR_PROFILE_BY_PRODUCTION_ID = Object.freeze({
  annual_potato: 'annual_staple_low_input',
  potato_low_input_synthesis: 'annual_staple_low_input',
  annual_winter_wheat: 'annual_staple_low_input',
  wheat_low_input_synthesis: 'annual_staple_low_input',
  annual_oat: 'annual_staple_low_input',
  oats_low_input_synthesis: 'annual_staple_low_input',
  annual_buckwheat: 'annual_staple_low_input',
  buckwheat_low_input_synthesis: 'annual_staple_low_input',
  annual_dry_bean: 'annual_legume_oilseed_low_input',
  dry_beans_low_input_synthesis: 'annual_legume_oilseed_low_input',
  annual_sunflower: 'annual_legume_oilseed_low_input',
  sunflower_low_input_synthesis: 'annual_legume_oilseed_low_input',
  annual_carrot: 'annual_intensive_vegetable',
  carrot_low_input_synthesis: 'annual_intensive_vegetable',
  carrot_raw: 'annual_intensive_vegetable',
  leafy_green_raw: 'annual_intensive_vegetable',
  perennial_raspberry: 'early_berry',
  early_berry_low_input_synthesis: 'early_berry',
  perennial_hazelnut: 'intermediate_nut_shrub',
  intermediate_hazelnut_low_input_synthesis: 'intermediate_nut_shrub',
  perennial_apple_pear: 'intermediate_fruit_tree',
  intermediate_apple_low_input_synthesis: 'intermediate_fruit_tree',
  perennial_chinese_chestnut: 'long_staple_tree',
  long_staple_chestnut_low_input_synthesis: 'long_staple_tree',
  perennial_black_walnut: 'long_staple_tree',
  perennial_vegetable: 'perennial_vegetable',
  support_black_locust: 'long_staple_tree',
  support_honey_locust: 'long_staple_tree',
  support_siberian_peashrub: 'long_staple_tree',
  support_autumn_olive: 'early_berry',
  support_clover: 'perennial_vegetable'
});

const labourRows = Object.fromEntries((labourEvidence.rows ?? []).map((row) => [row.id, row]));

const CATEGORY_IDS = Object.freeze(['annual_crops', 'perennial_food_forest', 'livestock', 'harvesting', 'food_preservation_storage', 'system_maintenance']);
const emptyCategories = () => Object.fromEntries(CATEGORY_IDS.map((id) => [id, 0]));

const seasonalWeights = Object.freeze({
  annual_crops: [0, 0, 0, .10, .25, .30, .20, .10, .05, 0, 0, 0],
  perennial_food_forest: [0, 0, 0, .20, .25, .20, .15, .10, .05, .05, 0, 0],
  harvesting: [0, 0, 0, 0, .05, .10, .15, .20, .25, .20, .05, 0],
  food_preservation_storage: [.05, 0, 0, 0, 0, .05, .10, .20, .25, .20, .10, .05],
  system_maintenance: [.05, .05, .05, .15, .20, .15, .10, .10, .05, .05, .025, .025],
  livestock: Array.from({length: 12}, () => 1 / 12)
});

const taskNumber = (profile, key) => number(profile?.[key], 0);

function profileForId(id, records = []) {
  const record = records.find((row) => row.id === id);
  const profileId = LABOUR_PROFILE_BY_PRODUCTION_ID[id] ?? LABOUR_PROFILE_BY_PRODUCTION_ID[record?.outputs?.[0]?.nutrition?.composition_id];
  return {profileId, profile: profileId ? labourRows[profileId] : null, record};
}

function normalizedTasks(profile, productionType) {
  if (!profile) return {total: 0, categories: emptyCategories(), missing: true};
  const isAnnual = productionType === 'annual';
  const raw = isAnnual
    ? {
      annual_crops: taskNumber(profile, 'soil_preparation_hours_per_ha') + taskNumber(profile, 'planting_hours_per_ha') + taskNumber(profile, 'weeding_hours_per_ha'),
      harvesting: taskNumber(profile, 'harvest_hours_per_ha'),
      food_preservation_storage: taskNumber(profile, 'processing_storage_hours_per_ha'),
      system_maintenance: taskNumber(profile, 'irrigation_monitoring_hours_per_ha') + taskNumber(profile, 'pest_wildlife_management_hours_per_ha')
    }
    : {
      perennial_food_forest: taskNumber(profile, 'pruning_maintenance_hours_per_ha') + taskNumber(profile, 'orchard_maintenance_hours_per_ha') + taskNumber(profile, 'weeding_hours_per_ha'),
      harvesting: taskNumber(profile, 'harvest_hours_per_ha'),
      food_preservation_storage: taskNumber(profile, 'processing_storage_hours_per_ha'),
      system_maintenance: taskNumber(profile, 'irrigation_monitoring_hours_per_ha') + taskNumber(profile, 'pest_wildlife_management_hours_per_ha')
    };
  const rawTotal = Object.values(raw).reduce((sum, value) => sum + value, 0);
  const targetTotal = taskNumber(profile, 'mature_recurring_hours_per_ha');
  const scale = rawTotal > 0 && targetTotal > 0 ? targetTotal / rawTotal : 0;
  const categories = emptyCategories();
  for (const [id, value] of Object.entries(raw)) categories[id] = value * scale;
  return {total: targetTotal, categories, missing: !(targetTotal > 0)};
}

function productionRowsForYear({foodSuccessionRow, wholeDietRow} = {}) {
  if (foodSuccessionRow) return (foodSuccessionRow.foods ?? []).map((row) => ({id: row.id, production_type: row.production_type, area_ha: number(row.area_ha, 0), bearing_factor: number(row.bearing_factor, 1)}));
  if (!wholeDietRow) return [];
  return [
    ...(wholeDietRow.produced?.annual ?? []).map((row) => ({id: row.plant_id, production_type: 'annual', area_ha: number(row.required_area_ha, 0), bearing_factor: 1})),
    ...(wholeDietRow.produced?.perennial ?? []).map((row) => ({id: row.plant_id, production_type: 'perennial', area_ha: number(row.area_ha, 0), bearing_factor: number(row.bearing_factor, 0)}))
  ];
}

function addCategories(target, source, multiplier = 1) {
  for (const id of CATEGORY_IDS) target[id] += Number(source[id] ?? 0) * multiplier;
}

function addSeasonalHours(months, categories) {
  for (const category of CATEGORY_IDS) {
    const total = Number(categories[category] ?? 0);
    const weights = seasonalWeights[category];
    for (let index = 0; index < 12; index += 1) months[index] += total * weights[index];
  }
}

function livestockHoursForYear(animals = [], year) {
  const result = {recurring: 0, processing: 0};
  for (const animal of animals) {
    const starts = Number(animal.production_start_year ?? 1);
    const active = year === 'mature' || Number(year) >= starts;
    if (!active) continue;
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

export function calculateFoodProductionLabour({foodSuccessionLedger = null, wholeDiet = null, records = [], animals = [], years = null, supportPlantRatio = .25, perennialFootprintHa = null, proteinDemandKgYear = null, availableLabourHoursYear = null, participatingWorkers = null} = {}) {
  const sourceYears = years ?? foodSuccessionLedger?.rows?.map((row) => row.year) ?? wholeDiet?.years?.map((row) => row.year) ?? [];
  const normalizedYears = [...new Set(sourceYears)].filter((year) => year !== 0);
  const firstRow = foodSuccessionLedger?.rows?.[0] ?? wholeDiet?.years?.[0];
  const inferredFootprint = Number(perennialFootprintHa ?? firstRow?.planted_perennial_footprint_ha ?? foodSuccessionLedger?.planted_perennial_footprint_ha ?? 0);
  const supportRecords = records.filter((record) => record.architecture?.life_cycle === 'support' || record.architecture?.layer === 'support');
  const supportArea = inferredFootprint * Number(supportPlantRatio) / Math.max(1, supportRecords.length);
  const missing = [];
  const stages = [];
  const establishmentCategories = emptyCategories();
  for (const row of [...(foodSuccessionLedger?.rows ?? []), ...(wholeDiet?.years ?? [])].slice(0, 1)) {
    for (const production of productionRowsForYear({foodSuccessionRow: foodSuccessionLedger ? row : null, wholeDietRow: wholeDiet ? row : null})) {
      const {profile} = profileForId(production.id, records);
      if (!profile) { missing.push({id: production.id, reason: 'No mapped labour evidence profile'}); continue; }
      if (production.production_type === 'perennial') establishmentCategories.perennial_food_forest += Number(production.area_ha) * taskNumber(profile, 'establishment_hours_per_ha');
    }
  }
  for (const record of supportRecords) {
    const {profile} = profileForId(record.id, records);
    if (!profile) { missing.push({id: record.id, reason: 'No mapped support-plant labour evidence profile'}); continue; }
    establishmentCategories.system_maintenance += supportArea * taskNumber(profile, 'establishment_hours_per_ha');
  }
  const buildStage = (year, sourceRow, isYearZero = false) => {
    const categories = emptyCategories();
    const productionRows = productionRowsForYear({foodSuccessionRow: foodSuccessionLedger ? sourceRow : null, wholeDietRow: wholeDiet ? sourceRow : null});
    for (const production of productionRows) {
      const {profile} = profileForId(production.id, records);
      if (!profile) { missing.push({id: production.id, year, reason: 'No mapped labour evidence profile'}); continue; }
      const tasks = normalizedTasks(profile, production.production_type);
      const area = Number(production.area_ha ?? 0);
      const bearing = production.production_type === 'perennial' ? Math.max(0, Math.min(1, Number(production.bearing_factor ?? 0))) : 1;
      if (production.production_type === 'annual') addCategories(categories, tasks.categories, area);
      else {
        const maintenanceFactor = .35 + .65 * bearing;
        categories.perennial_food_forest += tasks.categories.perennial_food_forest * area * maintenanceFactor;
        categories.system_maintenance += tasks.categories.system_maintenance * area * maintenanceFactor;
        categories.harvesting += tasks.categories.harvesting * area * bearing;
        categories.food_preservation_storage += tasks.categories.food_preservation_storage * area * bearing;
      }
    }
    if (!isYearZero) {
      const livestock = livestockHoursForYear(animals, year);
      categories.livestock += livestock.recurring;
      categories.food_preservation_storage += livestock.processing;
    }
    for (const record of supportRecords) {
      const {profile} = profileForId(record.id, records);
      if (!profile) continue;
      const maintenance = taskNumber(profile, 'mature_recurring_hours_per_ha') * supportArea * .75;
      categories.system_maintenance += maintenance;
    }
    const establishment = isYearZero ? establishmentCategories : emptyCategories();
    const recurringHours = Object.values(categories).reduce((sum, value) => sum + value, 0);
    const establishmentHours = Object.values(establishment).reduce((sum, value) => sum + value, 0);
    const totalHours = recurringHours + establishmentHours;
    const months = Array.from({length: 12}, () => 0);
    addSeasonalHours(months, categories);
    if (isYearZero) addSeasonalHours(months, establishment);
    const peakHours = Math.max(...months, 0);
    const peakIndex = months.indexOf(peakHours);
    const demand = Number(sourceRow?.household_food_demand_gj_year ?? 0);
    const animalEnergy = livestockHoursForYear(animals, year).recurring > 0 ? animals.filter((animal) => year === 'mature' || Number(year) >= Number(animal.production_start_year ?? 1)).reduce((sum, animal) => sum + Number(animal.output?.food_energy_gj_year ?? 0), 0) : 0;
    const annualFoodEnergy = sourceRow?.annual_food_energy_gj_year != null
      ? Number(sourceRow.annual_food_energy_gj_year)
      : Math.max(0, Number(sourceRow?.consumed_food_energy_gj_year ?? 0) - Number(sourceRow?.perennial_food_energy_consumed_gj_year ?? 0));
    const perennialFoodEnergy = Number(sourceRow?.perennial_food_energy_consumed_gj_year ?? 0);
    const totalUsableFoodEnergy = annualFoodEnergy + perennialFoodEnergy + animalEnergy;
    return {year, establishment_hours_year: round(establishmentHours), recurring_hours_year: round(recurringHours), total_hours_year: round(totalHours), average_hours_week: round(totalHours / LABOUR_WEEKS_PER_YEAR, 2), recurring_average_hours_week: round(recurringHours / LABOUR_WEEKS_PER_YEAR, 2), hours_per_person_week: participatingWorkers ? round(totalHours / LABOUR_WEEKS_PER_YEAR / Number(participatingWorkers), 2) : null, hours_per_household_week: round(totalHours / LABOUR_WEEKS_PER_YEAR, 2), seasonal_peak_hours_week: round(peakHours / (365.25 / 12 / 7), 2), peak_month: peakIndex >= 0 ? peakIndex + 1 : null, monthly_hours: months.map((value) => round(value, 2)), categories: Object.fromEntries(Object.entries(categories).map(([id, value]) => [id, round(value, 2)])), establishment_categories: Object.fromEntries(Object.entries(establishment).map(([id, value]) => [id, round(value, 2)])), food: {household_food_demand_gj_year: round(demand), annual_food_energy_gj_year: round(annualFoodEnergy), perennial_food_energy_gj_year: round(perennialFoodEnergy), animal_food_energy_gj_year: round(animalEnergy), total_usable_food_energy_gj_year: round(totalUsableFoodEnergy), energy_sufficiency: isYearZero ? false : totalUsableFoodEnergy >= demand - 1e-9}, nutrition: isYearZero ? {status: 'not_yet_producing', food_sufficiency: false, note: 'Year 0 is site establishment before the first production season.'} : stageNutrition({row: sourceRow, animalEnergy, demandGJ: demand, proteinDemandKgYear}), data_quality: {status: missing.length ? 'partial' : 'complete', missing_labour_data_count: missing.length}};
  };
  stages.push(buildStage(0, {household_food_demand_gj_year: Number(firstRow?.household_food_demand_gj_year ?? 0)}, true));
  for (const year of normalizedYears) {
    const sourceRow = foodSuccessionLedger?.rows?.find((row) => row.year === year) ?? wholeDiet?.years?.find((row) => row.year === year);
    stages.push(buildStage(year, sourceRow));
  }
  const available = number(availableLabourHoursYear);
  const capacity = available == null ? null : {available_hours_year: round(available), available_hours_week: round(available / LABOUR_WEEKS_PER_YEAR, 2), participating_workers: participatingWorkers == null ? null : Number(participatingWorkers)};
  const capacityStages = stages.map((stage) => {
    if (!capacity || !(capacity.available_hours_week > 0)) return {...stage, capacity: {status: 'unresolved', utilization: null, note: 'No available food-production labour input was supplied.'}};
    const utilization = stage.total_hours_year / capacity.available_hours_year;
    const status = utilization <= LABOUR_CAPACITY_THRESHOLDS.comfortable_max_utilization ? 'comfortable' : utilization <= LABOUR_CAPACITY_THRESHOLDS.high_max_utilization ? 'high' : 'exceeded';
    return {...stage, capacity: {status, utilization: round(utilization), utilization_percent: round(utilization * 100, 1), available_hours_year: capacity.available_hours_year, available_hours_week: capacity.available_hours_week}};
  });
  const totals = capacityStages.reduce((best, row) => row.total_hours_year > best.total_hours_year ? row : best, capacityStages[0] ?? {total_hours_year: 0});
  return {
    contract_version: FOOD_PRODUCTION_LABOUR_CONTRACT_VERSION,
    source: labourEvidence.source,
    evidence_boundary: 'Hours use the existing evidence-informed production labour table. They are planning estimates, not Grey-Bruce time-and-motion observations; missing mapped profiles remain visible and are excluded from totals rather than silently becoming zero.',
    year_convention: 'Year 0 is initial perennial/support establishment before the first production season. Year 1 is the first annual production season; mature is the long-run bearing state.',
    units: {hours: 'person-hours/year', average: 'person-hours/week', area_basis: 'person-hours/ha', animal_basis: 'person-hours/animal/year where supplied by livestock task ledger'},
    categories: CATEGORY_IDS,
    seasonal_method: 'Coarse month weights distribute source task categories across planting/growing, harvest and winter preservation periods; monthly distributions are planning sensitivities, not measured calendars.',
    unmodeled_work: ['Site acquisition, access-road construction, water systems, fencing and initial earthworks are outside this food-production labour ledger unless a selected production source explicitly includes them. They must not be read as zero labour.'],
    capacity_thresholds: LABOUR_CAPACITY_THRESHOLDS,
    stages: capacityStages,
    peak_stage: totals.year,
    peak_hours_year: round(totals.total_hours_year),
    missing_data: [...new Map(missing.map((row) => [`${row.id}:${row.reason}`, row])).values()],
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
