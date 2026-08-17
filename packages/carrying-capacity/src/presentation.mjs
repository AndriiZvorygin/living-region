import fs from 'node:fs';
import path from 'node:path';
import {PACKAGE_ROOT, CARRYING_CAPACITY_CONTRACT_VERSION, loadCanonicalCarryingCapacity} from './index.mjs';
import {calculateGreyCarryingCapacityAdoption} from './regional.mjs';
import {calculateHealthCanadaEER, representativeProfiles} from './health-canada.mjs';
import {calculateFoodSystem, householdProfiles, siteClasses, FOOD_ADULT_EQUIVALENT_GJ_YEAR, buildingArchetypes, insulationPresets, defaultBuilding, labourCapacityLevels} from './core.mjs';
import {calculatePerennialMixTimeline} from './perennial.mjs';
import {GROWING_ENVIRONMENT_CONTRACT_VERSION, owenSoundGrowingEnvironment, siteCapabilityDefinitions, selectPerennialMixForSite} from './environment.mjs';
import {HOUSEHOLD_LAND_ADULT_AGE, HOUSEHOLD_TRANSITION_YEAR_CONVENTION} from './household-demand.mjs';
import {buildSiteLeasePresentationContract} from './site-lease.mjs';
import {buildArcAdultScalePresentationContract} from './arc-community-scale.mjs';
import {calculateHealthCanadaProtein, calculateHouseholdProteinDemand, HEALTH_CANADA_PROTEIN_DRI, HEALTH_CANADA_PROTEIN_QUALITY_REFERENCE, HEALTH_CANADA_PROTEIN_SOURCE} from './protein.mjs';
import {LIVESTOCK_CONTRACT_VERSION, CANONICAL_HOUSEHOLD_FAE, LIVESTOCK_SCALING_BASIS, LIVESTOCK_LABOUR_SCALING_METHOD, LIVESTOCK_LABOUR_SCALING_FORMULA, LIVESTOCK_LABOUR_SCALING_NOTE, LIVESTOCK_LABOUR_TASKS, LIVESTOCK_FEED_STREAMS, LIVESTOCK_SPECIES, MINIMUM_SELF_REPLACING_SYSTEMS, CHICKEN_BREED_CANDIDATES, CHICKEN_SYSTEM_COMPARISON, LIVESTOCK_RATION_SCENARIOS, PROPERTY_FEED_SUPPLY_RULES, compareNutrientFoodSystems} from './livestock.mjs';
import {NUTRITION_CONTRACT_VERSION, DAYS_PER_YEAR, NUTRIENT_DEFINITIONS, FOOD_PORTFOLIO, NUTRITION_GOAL_DEFINITIONS, HEALTH_CANADA_NUTRIENT_DRI_SOURCE, HEALTH_CANADA_AMINO_ACID_PATTERN_SOURCE, CANADIAN_NUTRIENT_FILE_SOURCE, FOOD_NUTRIENT_PROFILES, HEALTH_CANADA_AMINO_ACID_PATTERN} from './nutrition.mjs';
import {PLANT_DATABASE_CONTRACT_VERSION, PLANT_DATABASE_VERSION, buildPlantDatabase} from './plant-database.mjs';
import {AGROECOSYSTEM_CONTRACT_VERSION, SUPPORT_PLANT_SENSITIVITIES, AGROECOSYSTEM_OBJECTIVES} from './suitability.mjs';
import {calculateAgroecosystemPlan} from './agroecosystem.mjs';

export const PRESENTATION_CONTRACT_VERSION = '3.0.0';

function readJson(filePath, fallback = {}) { return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : fallback; }
function finite(value, fallback = 0) { return Number.isFinite(Number(value)) ? Number(value) : fallback; }
function metricEnergy(row) { return {mj_day: row.mj_day, gj_year: row.gj_year}; }
function publicEer(row, landRole = null) { return {id: row.id, label: row.label, age_y: row.age_y, sex: row.sex, weight_kg: row.weight_kg, height_cm: row.height_cm, activity: row.activity, ...(landRole ? {land_role: landRole} : {}), ...metricEnergy(row), source: row.source, status: row.status}; }
function publicText(value) { return String(value ?? '').replace(/\b[\d,.]+\s*lb\/acre\b/gi, 'an imperial full-production reference').replace(/\bkcal\b/gi, 'source energy unit').replace(/\bcalories?\b/gi, 'food energy'); }
function publicize(value) { if (Array.isArray(value)) return value.map(publicize); if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, publicize(child)])); return typeof value === 'string' ? publicText(value) : value; }
function publicPerennialRow(row) { return {id: row.id, species: row.species, composition_id: row.composition_id ?? null, functional_class: row.functional_class, role: row.role, first_meaningful_crop_year: row.first_meaningful_crop_year || null, substantial_crop_year: row.substantial_crop_year || null, mature_year: row.mature_year || null, mature_yield_t_ha_year: row.mature_yield_t_ha_year === '' ? null : row.mature_yield_t_ha_year, mature_food_gj_ha_year: row.mature_food_gj_ha_year, protein_kg_ha: row.protein_kg_ha, fat_kg_ha: row.fat_kg_ha, carbohydrate_kg_ha: row.carbohydrate_kg_ha, evidence_status: row.canonical_status, evidence_type: row.evidence_type, source: row.source, geography: row.geography, climate_or_site: row.climate_or_site, model_role: row.role, notes: publicText(row.notes)}; }
function publicProteinMember(row) { return publicize({id: row.id, label: row.label, age_y: row.age_y, sex: row.sex, weight_kg: row.weight_kg, ear_g_kg_day: row.ear_g_kg_day, rda_g_kg_day: row.rda_g_kg_day, ear_g_day: row.ear_g_day, rda_g_day: row.rda_g_day, ear_kg_year: row.ear_kg_year, rda_kg_year: row.rda_kg_year, reference_band: row.reference_band, pregnancy: row.pregnancy, lactation: row.lactation, source: row.source, status: row.status}); }
function publicLivestockSpecies(row) { return publicize({id: row.id, label: row.label, animal: row.animal, unit_label: row.unit_label, output: row.output, feed_dm_kg_year: row.feed_dm_kg_year, housing_area_m2: row.housing_area_m2, fencing_m: row.fencing_m, water_l_day: row.water_l_day, labour_hours_year: row.labour_hours_year, slaughter_processing_hours_year: row.slaughter_processing_hours_year, manure_kg_year: row.manure_kg_year, production_start_year: row.production_start_year, food_profile_id: row.food_profile_id ?? null, food_profile_id_by_output: row.food_profile_id_by_output ?? null, canonical_arc: row.canonical_arc !== false, reproduction: row.reproduction ?? null, sources: row.sources, evidence_status: 'planning_synthesis_bounded_by_extension_and_government_guidance', notes: row.notes}); }
function publicB12Candidate(row) {
  if (!row) return null;
  return Object.fromEntries(['system', 'breeding_females', 'breeding_males', 'rabbit_does', 'chicken_hens', 'scale', 'b12_coverage_ratio', 'b12_covered', 'harvest_animals', 'edible_meat_kg_year', 'edible_protein_kg_year', 'food_feed_area_ha', 'labour_hours_year', 'human_edible_feed_protein_kg_year', 'feed_self_sufficiency'].filter((key) => Object.hasOwn(row, key)).map((key) => [key, row[key]]));
}
function publicB12Search(value) {
  if (!value) return null;
  return {scale: value.scale, selected_does: value.selected_does, selected_bucks: value.selected_bucks, population: value.population, adequacy: {b12: value.adequacy?.nutrients?.b12 ?? null}, system_comparison: Object.fromEntries(Object.entries(value.system_comparison ?? {}).map(([id, comparison]) => [id, {minimum_population: publicB12Candidate(comparison.minimum_population), lowest_land: publicB12Candidate(comparison.lowest_land), lowest_labour: publicB12Candidate(comparison.lowest_labour), lowest_human_edible_feed: publicB12Candidate(comparison.lowest_human_edible_feed)}])), search_rule: value.search_rule, status: value.status};
}
function publicSuccessionLedger(ledger) {
  if (!ledger) return null;
  return {
    years: ledger.years,
    planted_perennial_footprint_ha: ledger.planted_perennial_footprint_ha,
    peak_food_production_area_ha: ledger.peak_food_production_area_ha,
    canonical_rule: publicText(ledger.canonical_rule),
    rows: (ledger.rows ?? []).map((row) => ({
      year: row.year,
      household_food_demand_gj_year: row.household_food_demand_gj_year,
      animal_food_energy_gj_year: row.animal_food_energy_gj_year,
      annual_food_energy_gj_year: row.annual_food_energy_gj_year,
      perennial_food_energy_available_gj_year: row.perennial_food_energy_available_gj_year,
      perennial_food_energy_consumed_gj_year: row.perennial_food_energy_consumed_gj_year,
      consumed_food_energy_gj_year: row.consumed_food_energy_gj_year,
      produced_food_energy_gj_year: row.produced_food_energy_gj_year,
      exportable_surplus_food_energy_gj_year: row.exportable_surplus_food_energy_gj_year,
      annual_cultivation_area_ha: row.annual_cultivation_area_ha,
      planted_perennial_footprint_ha: row.planted_perennial_footprint_ha,
      valid_annual_perennial_intercrop_overlap_ha: row.valid_annual_perennial_intercrop_overlap_ha,
      occupied_food_production_area_ha: row.occupied_food_production_area_ha,
      land_reconciliation: publicize(row.land_reconciliation),
      macro_summary: publicize({energy_percent: row.macro_summary?.energy_percent, grams_per_day: row.macro_summary?.grams_per_day, mass_kg_year: row.macro_summary?.mass_kg_year, flags: row.macro_summary?.flags}),
      nutrients: publicize(Object.fromEntries(Object.entries(row.nutrients ?? {}).map(([id, nutrient]) => [id, {status: nutrient.status, adequacy_ratio: nutrient.adequacy_ratio}]))),
      amino_acid_pattern: publicize({limiting_amino_acid: row.amino_acid_pattern?.limiting_amino_acid, absolute_limiting_amino_acid: row.amino_acid_pattern?.absolute_limiting_amino_acid, absolute_adequacy: row.amino_acid_pattern?.absolute_adequacy}),
      external_inputs: publicize((row.external_inputs ?? []).map((item) => item.nutrient ?? item)),
      accounting: publicize(row.accounting),
      food_rows: (row.foods ?? []).map((food) => ({id: food.id, label: food.label, composition_id: food.composition_id, production_type: food.production_type, zone_assignment: food.zone_assignment ?? (food.production_type === 'perennial' ? 'perennial_food_zone' : 'annual_cultivation_zone'), area_ha: food.area_ha, consumed_food_kg_year: food.consumed_food_kg_year, produced_food_kg_year: food.produced_food_kg_year, reserved_food_kg_year: food.reserved_food_kg_year, livestock_feed_food_kg_year: food.livestock_feed_food_kg_year, exportable_surplus_food_kg_year: food.exportable_surplus_food_kg_year, lost_food_kg_year: food.lost_food_kg_year, required_area_ha: food.area_ha})),
      major_fat_sources: (row.foods ?? []).filter((food) => ['hazelnut_dried', 'black_walnut_dried', 'sunflower_seed_dry'].includes(food.composition_id) && Number(food.consumed_food_kg_year ?? 0) > 0).map((food) => ({composition_id: food.composition_id, label: food.label, consumed_food_kg_year: food.consumed_food_kg_year})),
      perennial_layers: (row.perennial_rows ?? []).map((layer) => ({id: layer.id, species: layer.species, composition_id: layer.composition_id, area_ha: layer.area_ha, bearing_factor: layer.bearing_factor, gross_edible_harvest_kg: layer.gross_edible_harvest_kg, retained_edible_harvest_kg: layer.retained_edible_harvest_kg, consumed_food_kg_year: layer.consumed_food_kg_year, produced_food_energy_gj_year: layer.produced_food_energy_gj_year, consumed_food_energy_gj_year: layer.consumed_food_energy_gj_year, protein_kg_year: layer.protein_kg_year, fat_kg_year: layer.fat_kg_year, carbohydrate_kg_year: layer.carbohydrate_kg_year, fibre_kg_year: layer.fibre_kg_year, micronutrients: layer.micronutrients, source: layer.source, evidence_status: layer.evidence_status}))
    }))
  };
}
function compactNutrientCompleteness(value) {
  if (!value) return null;
  const demand = value.demand ?? {};
  const aggregate = demand.aggregate ?? {};
  const wholeDiet = value.whole_diet ?? {};
  const amino = value.amino_acid_pattern ?? {};
  return {
    contract_version: value.contract_version,
    demand: {
      days_per_year: demand.days_per_year,
      members: (demand.members ?? []).map((member) => ({
        id: member.id,
        age_y: member.age_y,
        sex: member.sex,
        pregnancy: member.pregnancy,
        lactation: member.lactation,
        protein_rda_g_day: member.protein_rda_g_day,
        protein_rda_g_year: member.protein_rda_g_year,
        daily: Object.fromEntries(Object.entries(member).filter(([key]) => key.endsWith('_day') && !key.startsWith('protein_'))),
        annual: Object.fromEntries(Object.entries(member).filter(([key]) => key.endsWith('_year') && !key.startsWith('protein_')))
      })),
      aggregate: {
        daily: aggregate.daily,
        annual: aggregate.annual,
        protein_rda_g_day: aggregate.protein_rda_g_day,
        protein_rda_g_year: aggregate.protein_rda_g_year
      }
    },
    supply: {protein_g: value.supply?.protein_g, sources: value.supply?.sources},
    whole_diet: {
      portfolio_energy_share: wholeDiet.portfolio_energy_share,
      base_staple_energy_share: wholeDiet.base_staple_energy_share,
      succession_year: wholeDiet.succession_year,
      macros: publicize(wholeDiet.macros)
    },
    amino_acid_pattern: publicize({
      source: amino.source,
      reference_mg_per_g_protein: amino.reference_mg_per_g_protein,
      limiting_amino_acid: amino.limiting_amino_acid,
      limiting_pattern_amino_acid: amino.limiting_pattern_amino_acid,
      absolute_limiting_amino_acid: amino.absolute_limiting_amino_acid,
      absolute_adequacy: amino.absolute_adequacy,
      requirement_method: amino.requirement_method,
      digestibility_method: amino.digestibility_method,
      rows: amino.rows
    }),
    nutrients: publicize(Object.fromEntries(Object.entries(value.nutrients ?? {}).map(([id, nutrient]) => [id, {
      target_daily: nutrient.target_daily,
      target_annual: nutrient.target_annual,
      supplied_annual: nutrient.supplied_annual,
      adequacy_ratio: nutrient.adequacy_ratio,
      status: nutrient.status,
      unit: nutrient.unit,
      daily_unit: nutrient.daily_unit
    }]))),
    iron_assessment: publicize(value.iron_assessment),
    external_inputs: publicize(value.external_inputs),
    dimensional_analysis: publicize(value.dimensional_analysis),
    food_source_boundary: publicText(value.food_source_boundary),
    status: value.status
  };
}

function compactNutrientSummary(value) {
  if (!value) return null;
  return {
    contract_version: value.contract_version,
    whole_diet: {
      succession_year: value.whole_diet?.succession_year,
      energy_percent: value.whole_diet?.macros?.energy_percent,
      grams_per_day: value.whole_diet?.macros?.grams_per_day
    },
    amino_acid_pattern: {
      limiting_amino_acid: value.amino_acid_pattern?.limiting_amino_acid,
      absolute_limiting_amino_acid: value.amino_acid_pattern?.absolute_limiting_amino_acid,
      absolute_adequacy: value.amino_acid_pattern?.absolute_adequacy
    },
    nutrients: Object.fromEntries(Object.entries(value.nutrients ?? {}).map(([id, nutrient]) => [id, {adequacy_ratio: nutrient.adequacy_ratio, status: nutrient.status}])),
    external_inputs: (value.external_inputs ?? []).map((item) => ({nutrient: item.nutrient, status: item.status})),
    status: value.status
  };
}

function publicNutrientRows(rows, {detailed = true} = {}) {
  if (!detailed) return rows.map((row) => ({
    contract_version: row.contract_version,
    mode: row.mode,
    nutrition_goal: row.nutrition_goal,
    ration_id: row.ration_id,
    livestock_system_count: row.livestock_system_count,
    livestock_scale: row.livestock_scale,
    livestock_scaling_basis: row.livestock_scaling_basis,
    protein_demand_kg_year: row.protein_demand_kg_year,
    plant_energy_demand_gj_year: row.plant_energy_demand_gj_year,
    animal_food_energy_gj_year: row.animal_food_energy_gj_year,
    plant_protein_kg_year: row.plant_protein_kg_year,
    animal_protein_kg_year: row.animal_protein_kg_year,
    total_protein_kg_year: row.total_protein_kg_year,
    protein_coverage_ratio: row.protein_coverage_ratio,
    protein_adequacy: row.protein_adequacy,
    nutrient_completeness: compactNutrientSummary(row.nutrient_completeness),
    feed: publicize({
      feed_self_sufficiency: row.feed?.feed_self_sufficiency,
      additional_dedicated_feed_land_ha: row.feed?.additional_dedicated_feed_land_ha,
      human_edible_feed_protein_consumed_kg: row.feed?.human_edible_feed_protein_consumed_kg,
      human_inedible_feed_dm_kg: row.feed?.human_inedible_feed_dm_kg,
      winter_stored_feed_required_kg: row.feed?.winter_stored_feed_required_kg,
      winter_stored_feed_available_kg: row.feed?.winter_stored_feed_available_kg
    }),
    labour: publicize({
      recurring_hours_year: row.labour?.recurring_hours_year,
      slaughter_processing_hours_year: row.labour?.slaughter_processing_hours_year,
      total_hours_year: row.labour?.total_hours_year
    }),
    reproductive_self_sufficiency: row.reproductive_self_sufficiency,
    optimizer_eligible: row.optimizer_eligible,
    optimizer_note: publicText(row.optimizer_note)
  }));
  return rows.map((row) => {
  const completeness = row.nutrient_completeness ?? {};
  const compactCompleteness = compactNutrientCompleteness(completeness);
  const animals = (row.animals ?? []).map((animal) => { const {task_definition: _taskDefinition, ...labour} = animal.labour ?? {}; return {...animal, labour}; });
  return {
    contract_version: row.contract_version,
    mode: row.mode,
    nutrition_goal: row.nutrition_goal,
    nutrition_goal_resolution: publicize(row.nutrition_goal_resolution),
    ration_id: row.ration_id,
    livestock_system_count: row.livestock_system_count,
    livestock_scale: row.livestock_scale,
    livestock_scaling_basis: row.livestock_scaling_basis,
    minimum_property_b12: publicB12Search(row.minimum_property_b12),
    protein_demand_kg_year: row.protein_demand_kg_year,
    plant_only: publicize(row.plant_only),
    plant_food: publicize({required_food_area_ha: row.plant_food?.required_food_area_ha, delivered_food_energy_gj: row.plant_food?.delivered_food_energy_gj, macro_delivered_to_household: row.plant_food?.macro_delivered_to_household}),
    food_succession_ledger: row.mode === 'plants_only' ? publicSuccessionLedger(row.food_succession_ledger) : null,
    // The plants-only row is the canonical succession reference. Repeating
    // the same multi-year ledger on every ration row made the browser contract
    // needlessly large; animal rows still expose their complete current-year
    // nutrient result and feed/reproduction ledger.
    plants_only_food_succession_ledger: null,
    portfolio_land: publicize({base_food_area_ha: row.portfolio_land?.base_food_area_ha, additional_area_ha: row.portfolio_land?.additional_area_ha, total_food_area_with_portfolio_ha: row.portfolio_land?.total_food_area_with_portfolio_ha, area_reconciliation: row.portfolio_land?.area_reconciliation, rows: (row.portfolio_land?.rows ?? []).map((item) => ({id: item.id, label: item.label, composition_id: item.composition_id, required_area_ha: item.required_area_ha, effective_food_gj_ha_year: item.effective_food_gj_ha_year, allocated_within_existing_food_zone_ha: item.allocated_within_existing_food_zone_ha, true_overflow_area_ha: item.true_overflow_area_ha, additional_area_ha: item.additional_area_ha, zone_assignment: item.zone_assignment, site_viability: item.site_viability, production_by_year: item.production_by_year}))}),
    food_feed_area_ha: row.food_feed_area_ha,
    plant_energy_demand_gj_year: row.plant_energy_demand_gj_year,
    animal_food_energy_gj_year: row.animal_food_energy_gj_year,
    animal_protein_kg_year: row.animal_protein_kg_year,
    animal_output_by_year: publicize(row.animal_output_by_year),
    plant_protein_kg_year: row.plant_protein_kg_year,
    total_protein_kg_year: row.total_protein_kg_year,
    protein_deficit_kg_year: row.protein_deficit_kg_year,
    protein_coverage_ratio: row.protein_coverage_ratio,
    protein_adequacy: row.protein_adequacy,
    animals: publicize(animals),
    feed: publicize(row.feed),
    labour: publicize(row.labour),
    feed_self_sufficiency: row.feed_self_sufficiency,
    energy_adequacy: row.energy_adequacy,
    nutrient_completeness: publicize(compactCompleteness),
    plants_only_nutrient_completeness: null,
    pregnancy_sensitivity_nutrient_completeness: row.mode === 'plants_only' ? compactNutrientCompleteness(row.pregnancy_sensitivity_nutrient_completeness) : null,
    pregnancy_sensitivity_comparison: publicize(row.pregnancy_sensitivity_comparison),
    pregnancy_sensitivity_subject: publicize(row.pregnancy_sensitivity_subject),
    marginal_nutrient_value: publicize(row.marginal_nutrient_value),
    nutrition_goals: publicize(row.nutrition_goals),
    reproductive_self_sufficiency: row.reproductive_self_sufficiency,
    optimizer_eligible: row.optimizer_eligible,
    optimizer_note: publicText(row.optimizer_note),
    evidence_boundary: publicText(row.evidence_boundary)
  };
  });
}
function publicLivestockFeed(id) { return [id, publicize({id, ...LIVESTOCK_FEED_STREAMS[id]})]; }
function pickTransition(row) { return {year: row.year, annual_food_area_ha: row.annual_area_ha, perennial_food_area_ha: row.perennial_area_ha, planted_perennial_footprint_ha: row.planted_perennial_footprint_ha, annual_perennial_intercrop_overlap_ha: row.young_forest_annual_intercrop_overlap_ha, occupied_food_production_area_ha: row.occupied_food_production_area_ha, total_exclusive_land_requirement_ha: row.total_exclusive_land_requirement_ha, portfolio_overflow_area_ha: row.portfolio_overflow_area_ha, feed_overflow_area_ha: row.feed_overflow_area_ha, land_reconciliation: publicize(row.land_reconciliation), annual_food_supplied_gj_year: row.annual_usable_food_gj, perennial_food_supplied_gj_year: row.perennial_usable_food_gj, household_food_demand_gj_year: row.household_food_demand_gj_year, permanent_adult_food_demand_gj_year: row.permanent_adult_food_demand_gj_year, dependent_child_food_demand_gj_year: row.dependent_child_food_demand_gj_year, dependent_food_supplement_annual_area_ha: row.dependent_food_supplement_annual_area_ha, food_coverage_ratio: row.household_food_coverage_ratio, exportable_food_energy_surplus_gj_year: row.exportable_food_energy_surplus_gj, labour: publicize(row.labour)}; }
function publicRegional(regional) { return {...regional, scenarios: regional.scenarios.map((scenario) => ({...scenario, transition_years: scenario.transition_years.map(({profile_rows, ...year}) => year)}))}; }
function publicAgroecosystem(plan) {
  return {
    contract_version: plan.contract_version,
    site: {id: plan.site.id, label: plan.site.label, climate: plan.site.climate, soil: plan.site.soil, light: plan.site.light},
    objectives: plan.objectives,
    support_plant_ratio: plan.support_plant_ratio,
    selection: {
      selected: plan.selection.selected,
      named_solutions: plan.selection.named_solutions,
      candidates: plan.selection.candidates.map((row) => ({plant_id: row.plant_id, common_name: row.common_name, life_cycle: row.life_cycle, layer: row.layer, selected: row.selected, selection_reason: row.selection_reason, nutritional_role: row.nutritional_role, status: row.suitability.status, score: row.suitability.suitability_score, evidence_status: row.suitability.evidence_status, inclusion_reasons: row.suitability.inclusion_reasons, exclusion_reasons: row.suitability.exclusion_reasons, missing_data: row.suitability.missing_data}))
    },
    annual_schedule: plan.annual_schedule,
    perennial_succession: plan.perennial_succession,
    whole_diet: plan.whole_diet,
    nutrition_constraint: plan.nutrition_constraint,
    nutrient_ledger: plan.nutrient_ledger,
    reconciliation: plan.reconciliation
  };
}

export function buildCarryingCapacityPresentationContract({produceDir = 'know/produce', generatedAt = new Date().toISOString()} = {}) {
  const canonical = loadCanonicalCarryingCapacity();
  const plantSource = readJson(path.join(PACKAGE_ROOT, 'data/source/agroecosystem-plants.json'));
  const plantDatabase = buildPlantDatabase(plantSource);
  const foodEvidence = readJson(path.join(PACKAGE_ROOT, 'data/derived/evidence-food-yields.json'));
  const perennialEvidence = readJson(path.join(PACKAGE_ROOT, 'data/derived/perennial-yield-evidence.json'));
  const heatingEvidence = readJson(path.join(PACKAGE_ROOT, 'data/derived/evidence-heating.json'));
  const woodyEvidence = readJson(path.join(PACKAGE_ROOT, 'data/derived/evidence-woody-yields.json'));
  const systemicEnergy = readJson(path.resolve(PACKAGE_ROOT, '../../data/systemic-energy/systemic-energy-v1.json'));
  const dwelling = readJson(path.resolve(produceDir, 'grey-dwelling-land-access.json'));
  const foodCalibration = readJson(path.resolve(produceDir, 'grey-food-calibration.json'));
  const landAccessProxyAvailable = dwelling.dwellingLandAccessValid !== false
    && Number.isFinite(Number(dwelling.estimatedDwellingsWithGardenScaleAccess))
    && Number.isFinite(Number(dwelling.estimatedPopulationWithGardenScaleAccess));
  const eligibleHouseholds = landAccessProxyAvailable ? finite(dwelling.estimatedDwellingsWithGardenScaleAccess) : 0;
  const eligiblePopulation = landAccessProxyAvailable ? finite(dwelling.estimatedPopulationWithGardenScaleAccess) : 0;
  const landAccessStatus = landAccessProxyAvailable ? 'available' : 'unavailable_missing_validated_proxy';
  const energyScenarios = Object.fromEntries(Object.entries(canonical.canonical.human_energy.scenarios ?? {}).map(([id, row]) => [id, publicEer(row)]));
  const publicSiteLabels = {wetter_productive: 'Favourable / productive', ordinary_mesic: 'Ordinary / mesic', dry: 'Dry / moisture-limited', shallow_rocky_marginal: 'Marginal / shallow / rocky'};
  const publicSites = Object.fromEntries(Object.keys(publicSiteLabels).map((id) => [id, publicize({id, ...siteClasses[id], label: publicSiteLabels[id], local_environment: siteCapabilityDefinitions[id]})]));
  const referenceProfile = {id: 'reference_adult_man', ...representativeProfiles.reference_adult_man};
  const nutrientExamples = Object.fromEntries(Object.entries(householdProfiles).flatMap(([householdId, profile]) => Object.keys(publicSiteLabels).map((siteId) => {
    const members = profile.member_ids.map((memberId) => ({id: memberId, ...representativeProfiles[memberId]}));
    const energyDemand = members.reduce((sum, member) => sum + calculateHealthCanadaEER(member).gj_year, 0);
    const proteinDemand = calculateHouseholdProteinDemand(members);
    const comparison = compareNutrientFoodSystems({foodEvidence, demandGJ: energyDemand, proteinDemandKgYear: proteinDemand.household_protein_kg_year, members, siteCapability: {...siteClasses[siteId], calculateFoodSystem}, perennialMix: selectPerennialMixForSite(perennialEvidence.mix, siteId), curveAnchors: perennialEvidence.curve_anchors.central});
    const detailed = householdId === 'two_adults_plus_three_children' && siteId === 'ordinary_mesic';
    return [`${householdId}:${siteId}`, {household: householdId, site: siteId, protein_demand: publicize(proteinDemand), rows: publicNutrientRows(comparison.rows, {detailed}), objectives: publicize(comparison.objectives), pareto_efficient_options: publicize(comparison.pareto_efficient_options), best: publicize(comparison.best)}];
  })));
  const proteinDriRows = Object.fromEntries(Object.entries(HEALTH_CANADA_PROTEIN_DRI).map(([id, row]) => [id, publicize({id, ...row})]));
  const matureRows = (canonical.canonical.mature_food_system.canonical_rows ?? []).filter((row) => row.module === 'plants_only').map((row) => ({site: row.site, site_label: row.site_label, household: row.household, household_label: row.household_label, household_food_gj_year: row.household_food_gj_year, current_household_food_demand_gj_year: row.current_household_food_demand_gj_year, permanent_adult_food_demand_gj_year: row.permanent_adult_food_demand_gj_year, dependent_child_food_demand_gj_year: row.dependent_child_food_demand_gj_year, year1_annual_bridge_area_ha: row.year1_annual_bridge_area_ha, mature_annual_area_ha: row.mature_annual_area_ha, mature_perennial_area_ha: row.mature_perennial_area_ha, heating_area_ha: row.heating_area_ha, robust_household_minimum_area_ha: row.robust_household_minimum_area_ha, additional_productive_surplus_area_ha: row.additional_productive_surplus_area_ha, gross_site_area_ha: row.gross_site_area_ha, land_accounting: publicize(row.land_accounting), recurring_labour: publicize(row.recurring_labour), human_food_energy: publicize(row.human_food_energy), evidence_boundary: publicize(row.evidence_boundary), selection_rule: publicText(row.selection_rule)}));
  const transitionRows = (canonical.canonical.food_forest_transition.households ?? []).filter((row) => Object.hasOwn(publicSiteLabels, row.site)).map((row) => ({site: row.site, site_label: row.site_label, household: row.household, household_label: row.household_label, household_food_demand_gj_year: row.household_food_demand_gj_year, current_household_food_demand_gj_year: row.current_household_food_demand_gj_year, permanent_adult_food_demand_gj_year: row.permanent_adult_food_demand_gj_year, dependent_child_food_demand_gj_year: row.dependent_child_food_demand_gj_year, mature_parental_food_demand_gj_year: row.mature_parental_food_demand_gj_year, adult_transition_age: row.adult_transition_age, year_convention: row.year_convention, land_roles: publicize(row.land_roles), establishment_land_requirement_ha: row.establishment_land_requirement_ha, mature_land_requirement_ha: row.mature_land_requirement_ha, establishment_peak_year: row.establishment_peak_year, planted_perennial_footprint_ha: row.planted_perennial_footprint_ha, arc_policy_comparison: publicize(row.arc_policy_comparison), viable_annual_crops: row.viable_annual_crops, excluded_annual_crops: row.excluded_annual_crops, viable_perennial_layers: row.viable_perennial_layers, rows: row.transition.constant_annual_reserve.rows.map(pickTransition), transition_model: row.transition.constant_annual_reserve.description}));
  const siteLease = buildSiteLeasePresentationContract();
  const familyCapacityExample = siteLease.household_examples.family_ordinary;
  const publicArcContract = {contract_version: '1.1.0', model_version: canonical.model_version, source_commit: process.env.GITHUB_SHA ?? process.env.SOURCE_COMMIT ?? 'local-build', publication_ready: true, publication_status: 'Ready for planning publication with explicit nutritional boundaries. Plants-only remains the canonical low-complexity policy baseline; self-replacing livestock is an optional household trade-off. Small external nutrient inputs and unresolved food-form evidence remain disclosed rather than silently counted.', canonical_household: 'two_adults_plus_three_children', canonical_site: 'ordinary_mesic', productive_hectares: {establishment: familyCapacityExample?.physical_carrying_capacity?.establishment_land_requirement_ha ?? null, mature: familyCapacityExample?.physical_carrying_capacity?.mature_land_requirement_ha ?? null}, resident_owned_dwelling_capital: familyCapacityExample?.affordability?.completed_resident_owned_dwelling_capital_cad ?? null, dwelling_financing_monthly_cad: familyCapacityExample?.affordability?.illustrative_dwelling_financing_monthly_cad ?? null, land_site_community_reference: familyCapacityExample?.land_infrastructure ?? null, combined_monthly_estimate_cad: familyCapacityExample?.affordability?.illustrative_dwelling_financing_plus_land_shared_monthly_cad ?? null, tenure_statement: 'The dwelling is resident-owned; the productive and common site remains one leased ARC property/title under an illustrative planning scenario.', resident_explanation: 'Children add pooled food demand while dependent but do not add a permanent perennial allocation to the parental parcel. Land, dwelling and shared infrastructure are separate layers.', caveats: ['Presentation contract values are generated from canonical Living Region APIs.', 'Absolute amino-acid adequacy is a transparent planning comparison derived from Health Canada protein RDA and reference-pattern values; food-specific digestibility adjustment is unresolved where evidence is unavailable.', 'Iodized salt, B12/vitamin supplements, veterinary minerals and other non-food inputs are disclosed separately and are not counted as property food.', 'Land prices, site capability, crop yields, livestock reproductive ledgers and local approvals remain planning evidence or site-specific.']};
  const referenceFamilyMembers = householdProfiles.two_adults_plus_three_children.member_ids.map((memberId) => ({id: memberId, ...representativeProfiles[memberId]}));
  const referenceFamilyDemandGJYear = referenceFamilyMembers.reduce((sum, member) => sum + calculateHealthCanadaEER(member).gj_year, 0);
  const agroecosystemReference = calculateAgroecosystemPlan({database: plantDatabase, siteId: 'ordinary_mesic', objectives: ['low_external_input', 'nutritional_completeness', 'resilient_diverse'], supportPlantRatio: .25, annualAreaHa: 1, perennialAreaHa: 1, nutritionProfiles: FOOD_NUTRIENT_PROFILES, householdPeople: 5, householdFoodDemandGJYear: referenceFamilyDemandGJYear, annualResilienceFloorGJYear: referenceFamilyDemandGJYear * .1, humanure: {enabled: false}});
  const presets = Object.entries(householdProfiles).map(([id, profile]) => ({id, label: profile.label, member_ids: profile.member_ids, members: profile.member_ids.map((memberId) => { const member = canonical.canonical.human_energy.scenarios[memberId]; return publicEer(member, Number(member.age_y) >= HOUSEHOLD_LAND_ADULT_AGE ? 'permanent_adult' : 'dependent_child'); })}));
  const regionalFoodDemandGJ = Number(foodCalibration.foodDemandBaseline?.totalFoodDemandGJ ?? 0);
  const regional = calculateGreyCarryingCapacityAdoption({eligibleHouseholds, eligiblePopulation, regionalFoodDemandGJ, eligibilityBasis: 'estimatedDwellingsWithGardenScaleAccess and corresponding population from the current dwelling-land proxy; not parcel ownership or biological site classification'});
  const siteMixVariants = {
    balanced: regional,
    favourable_heavy: calculateGreyCarryingCapacityAdoption({eligibleHouseholds, eligiblePopulation, regionalFoodDemandGJ, siteShares: {favourable: .5, ordinary: .3, marginal: .2}, eligibilityBasis: 'same garden-scale dwelling-land proxy; alternative explicit site-mix sensitivity'}),
    marginal_heavy: calculateGreyCarryingCapacityAdoption({eligibleHouseholds, eligiblePopulation, regionalFoodDemandGJ, siteShares: {favourable: .15, ordinary: .35, marginal: .5}, eligibilityBasis: 'same garden-scale dwelling-land proxy; alternative explicit site-mix sensitivity'})
  };
  return {
    contract_version: PRESENTATION_CONTRACT_VERSION,
    model_contract_version: CARRYING_CAPACITY_CONTRACT_VERSION,
    model_version: canonical.model_version,
    generated_at: generatedAt,
    units: {energy: 'MJ/day and GJ/year', land: 'ha', labour: 'hours/year', population: 'people'},
    metric_only_presentation: true,
    reference_profile: publicEer(calculateHealthCanadaEER(referenceProfile)),
    health_canada: {source: canonical.canonical.human_energy.source, scenarios: energyScenarios, activity_categories: ['inactive', 'low', 'active', 'very'], food_adult_equivalent: {gj_year: FOOD_ADULT_EQUIVALENT_GJ_YEAR, definition: 'Mean food-energy requirement of the representative low-activity adult woman and man; food-energy normalization only, not a land multiplier.'}, equation_note: 'The canonical equation is evaluated in its source form; this public presentation exposes energy in MJ and GJ only.'},
    protein: {source: HEALTH_CANADA_PROTEIN_SOURCE, dri_rows: proteinDriRows, quality_reference: publicize(HEALTH_CANADA_PROTEIN_QUALITY_REFERENCE), target: 'RDA', note: 'Protein is constrained separately from Health Canada energy. Total protein adequacy does not prove indispensable-amino-acid, digestibility, micronutrient or food-safety adequacy.'},
    nutrition: {contract_version: NUTRITION_CONTRACT_VERSION, days_per_year: DAYS_PER_YEAR, nutrient_definitions: publicize(NUTRIENT_DEFINITIONS), goals: publicize(NUTRITION_GOAL_DEFINITIONS), nutrient_dri_source: HEALTH_CANADA_NUTRIENT_DRI_SOURCE, amino_acid_pattern_source: HEALTH_CANADA_AMINO_ACID_PATTERN_SOURCE, food_composition_source: CANADIAN_NUTRIENT_FILE_SOURCE, amino_acid_pattern: HEALTH_CANADA_AMINO_ACID_PATTERN, absolute_amino_acid_requirement_method: 'Apply the Health Canada age-1+ reference pattern to each member protein RDA; this is a planning comparison, not a separate clinical amino-acid DRI table.', digestibility_method: 'Food-specific digestibility-adjusted quality is unresolved unless defensible evidence is available; raw pattern and absolute intake are shown separately.', food_profiles: publicize(FOOD_NUTRIENT_PROFILES), food_portfolio: publicize(FOOD_PORTFOLIO), succession_years: [1, 2, 3, 5, 8, 10, 15, 'mature'], succession_rule: 'The year-by-year food-production ledger is the shared source for perennial bearing, annual residual production, consumed-diet macros, reserves, surplus and food-area timing. Annual bridge rations are year-specific and are not permanent mature plants-only diets.', external_input_rule: 'Property food nutrients are counted separately from iodized salt, supplements, fortified foods and veterinary minerals. Unmeasured nutrient values remain unresolved.'},
    agroecosystem: {contract_version: AGROECOSYSTEM_CONTRACT_VERSION, plant_database_version: PLANT_DATABASE_VERSION, plant_database_contract_version: PLANT_DATABASE_CONTRACT_VERSION, support_plant_sensitivities: SUPPORT_PLANT_SENSITIVITIES, source_manifest: plantSource.source_manifest.map(publicText), records: plantDatabase.records.map((record) => publicize({id: record.id, identity: record.identity, architecture: record.architecture, establishment: record.establishment, site_needs: record.site_needs, outputs: record.outputs, ecological_function: record.ecological_function, management: record.management, relationships: record.relationships, evidence: record.evidence})), reference_plan: publicAgroecosystem(agroecosystemReference), objectives: Object.fromEntries(Object.entries(AGROECOSYSTEM_OBJECTIVES).map(([id, row]) => [id, row.label])), model_boundary: 'This planner selects compatible plants, schedules annual plots, models layered succession and reconciles nutrient stocks. Existing household energy, nutrition, livestock and land APIs remain the downstream canonical reporting interfaces during migration.'},
    site_classes: publicSites,
    environment: publicize({contract_version: GROWING_ENVIRONMENT_CONTRACT_VERSION, ...owenSoundGrowingEnvironment, solar: owenSoundGrowingEnvironment.climate.solar}),
    establishment: publicize({starting_condition: 'bare_land_new_planting', years: [1, 2, 3, 5, 8, 10, 15, 'mature'], annual_intercrop_overlap_by_year: {1: .75, 2: .75, 3: .60, 5: .40, 8: .15, 10: .05, 15: 0, mature: 0}, loss_or_reserve_fraction: .30, annual_reserve_fraction: .25, adult_transition_age: HOUSEHOLD_LAND_ADULT_AGE, year_convention: HOUSEHOLD_TRANSITION_YEAR_CONVENTION, pooled_food_rule: 'Annual and perennial food are pooled outputs available to every current household member. Dependent children increase current demand and annual bridge requirements only while they remain under the adult-transition age; they do not receive a child-specific perennial footprint.', arc_policy_comparison: 'ARC allocation is tested after the biological calculation and never constrains the planted perennial footprint or annual bridge.', site_models: Object.fromEntries(Object.keys(publicSiteLabels).map((id) => [id, {site_id: id, curve_anchors: perennialEvidence.curve_anchors.central, perennial_mix: selectPerennialMixForSite(perennialEvidence.mix, id), years: [1, 2, 3, 5, 8, 10, 15, 'mature'], annual_intercrop_overlap_by_year: {1: .75, 2: .75, 3: .60, 5: .40, 8: .15, 10: .05, 15: 0, mature: 0}, loss_or_reserve_fraction: .30, annual_reserve_fraction: .25}]))}),
    public_arc_contract: publicArcContract,
    site_lease_economics: {...siteLease, adult_scale: buildArcAdultScalePresentationContract()},
    household_profiles: householdProfiles,
    household_presets: presets,
    mature_rows: matureRows,
    transition_rows: transitionRows,
    heating: {source: heatingEvidence.source, audit: heatingEvidence.audit, cases: Object.fromEntries(Object.entries(heatingEvidence.cases).map(([id, row]) => [id, {useful_space_heating_gj_year: row.heat_loss.annual_useful_space_heating_gj, gross_wood_energy_gj_year: row.wood.gross_wood_energy_required_gj, dry_wood_tonnes_year: row.wood.approximate_dry_wood_tonnes}])), building_archetypes: Object.fromEntries(Object.entries(buildingArchetypes).map(([id, row]) => [id, {id, ...row}])), insulation_presets: Object.fromEntries(Object.entries(insulationPresets).map(([id, row]) => [id, {id, ...row}])), default_building: defaultBuilding(), labour_capacity_levels: labourCapacityLevels, model_notes: ['Building heating is calculated from form geometry, floor area, RSI envelope values, window loss, ventilation/infiltration, ECCC HDD, indoor temperature, heater efficiency and thermal bridges.', 'Building presets are transparent physical assumptions, not as-built surveys.']},
    woody_yields: {source: woodyEvidence.source, bands: woodyEvidence.bands, cases: woodyEvidence.cases},
    food_energy_evidence: {source: foodEvidence.source, rows: foodEvidence.rows.map((row) => ({id: row.id, crop: row.crop, category: row.category, composition_id: row.composition_id ?? null, edible_yield_t_ha: row.edible_yield_t_ha ?? null, food_gj_ha: row.food_gj_ha, protein_kg_ha: row.protein_kg_ha, fat_kg_ha: row.fat_kg_ha, carbohydrate_kg_ha: row.carbohydrate_kg_ha, evidence_type: row.evidence_type, canonical_status: row.canonical_status, source: row.source}))},
    livestock: {contract_version: LIVESTOCK_CONTRACT_VERSION, canonical_household_fae: CANONICAL_HOUSEHOLD_FAE, scaling_basis: LIVESTOCK_SCALING_BASIS, labour_scaling: {method: LIVESTOCK_LABOUR_SCALING_METHOD, formula: LIVESTOCK_LABOUR_SCALING_FORMULA, note: LIVESTOCK_LABOUR_SCALING_NOTE, task_definitions: publicize(LIVESTOCK_LABOUR_TASKS)}, feed_streams: Object.fromEntries(Object.keys(LIVESTOCK_FEED_STREAMS).map(publicLivestockFeed)), species: Object.fromEntries(Object.entries(LIVESTOCK_SPECIES).map(([id, row]) => [id, publicLivestockSpecies(row)])), minimum_self_replacing_systems: publicize(MINIMUM_SELF_REPLACING_SYSTEMS), chicken_breed_candidates: publicize(CHICKEN_BREED_CANDIDATES), chicken_system_comparison: publicize(CHICKEN_SYSTEM_COMPARISON), selected_chicken_reference: 'Chantecler / conservative true-breeding dual-purpose range', ration_scenarios: publicize(LIVESTOCK_RATION_SCENARIOS), property_feed_supply_rules: publicize(PROPERTY_FEED_SUPPLY_RULES), examples: nutrientExamples, source_note: 'Animal output and feed ledgers are bounded planning syntheses. Canonical ARC rows prohibit purchased feed, require zero external replacement animals and convert finite-feed shortfalls into dedicated on-site feed hectares or infeasibility. The household gets one selected system base, then productive animals, output, feed, housing, manure and labour resize from actual discrete animal counts. One breeding male serves the documented species-specific female capacity before another is planned.'},
    perennial_food_evidence: {source: perennialEvidence.source, rows: perennialEvidence.rows.map(publicPerennialRow), mix: perennialEvidence.mix.map((row) => ({id: row.id, area_share: row.area_share, class: row.class, species: row.species, role: row.role, mature_food_gj_ha_year: row.mature_food_gj_ha_year, canonical_status: row.canonical_status})), central_mix: perennialEvidence.central_mix, mix_timeline: calculatePerennialMixTimeline({evidence: perennialEvidence}), evidence_limitations: perennialEvidence.evidence_limitations.map(publicText), research_updates: publicize(perennialEvidence.research_updates ?? [])},
    regional: {grey: {...publicRegional(regional), site_mix_variants: Object.fromEntries(Object.entries(siteMixVariants).map(([key, variant]) => [key, publicRegional(variant)]))}, land_access_proxy: {status: landAccessStatus, eligible_households: landAccessProxyAvailable ? eligibleHouseholds : null, eligible_population_people: landAccessProxyAvailable ? eligiblePopulation : null, source_file: 'grey-dwelling-land-access.json', caveat: 'Best current proxy only; Grey County does not yet have a validated parcel-level biological site-capability map. Regional outputs are zeroed when this proxy is unavailable rather than silently reusing stale data.'}},
    systemic_energy_contract: {contract_id: systemicEnergy.contract_id, schema_version: systemicEnergy.schema_version, producer: systemicEnergy.producer, fields: (systemicEnergy.fields ?? []).map((field) => ({field_id: field.field_id, evidence_status: field.evidence_status, source_date: field.source_date, uncertainty: field.uncertainty}))},
    solar: {status: 'conceptual_only', numerical_local_solar_budget: false, note: 'A defensible Owen Sound annual solar-radiation source and transformation chain have not yet been established; no photosynthetic efficiency or crop yield is invented here.'},
    methodology: {dependency_chain: ['person characteristics', 'Health Canada energy requirement', 'pooled current household food demand', 'adult-sized perennial footprint', 'annual bridge for remaining dependent demand', 'perennial transition and resilience reserve', 'mature parental land plus woody heating'], parallel_chains: {people: ['age, sex, height, weight, activity', 'MJ/day', 'adult/dependent land role', 'pooled food-production area'], buildings: ['floor area, form, RSI envelope, leakage', 'GJ/year useful heat', 'gross woody energy', 'woody-production area']}, labour_note: 'Metabolic food demand and explicit assigned labour capacity are separate inputs. Sex, age, height, weight and activity do not infer agricultural capability.', household_land_role_note: `Members under ${HOUSEHOLD_LAND_ADULT_AGE} are dependent children by default. Children add pooled food demand while dependent, but do not add permanent perennial acreage to the parental parcel; after transition their adult allocation is outside this calculation. ${HOUSEHOLD_TRANSITION_YEAR_CONVENTION}`, land_accounting: 'Annual food, perennial food, heating and exclusive reserve are kept distinct; soil/water, wildlife, fibre and habitat functions are reported as overlapping multifunctional coverage.', custom_household_note: 'The browser imports pure canonical EER, pooled household-demand, balanced-food, building-heating and labour-capacity functions. Custom transition charts use the same adult/dependent demand profile as the CLI model; household presets display full canonical transition rows.', external_input_note: 'Energy-condition multipliers are regional scenario overlays, not replacements for the biological carrying-capacity evidence model.'},
    sources: [{institution: 'Health Canada', title: 'Equations to Estimate Energy Requirement', url: canonical.canonical.human_energy.source, evidence_status: 'official equation'}, {institution: 'Living Region carrying-capacity package', title: 'Evidence summary and canonical household/site rows', url: 'packages/carrying-capacity/outputs/summary.json', evidence_status: 'generated canonical model'}, {institution: 'ECCC / Living Region', title: 'Owen Sound heating-degree-day and dwelling envelope case', url: 'packages/carrying-capacity/data/derived/evidence-heating.json', evidence_status: 'modelled case with climate normal'}, {institution: 'Living Region perennial evidence', title: 'Perennial yield and establishment evidence', url: 'packages/carrying-capacity/outputs/perennial-yield-evidence.md', evidence_status: 'mixed measured, extension and planning synthesis; see row status'}, {institution: 'Living Region evidence files', title: 'Balanced low-input food yields and woody biomass bands', url: 'packages/carrying-capacity/data/derived/', evidence_status: 'mixed measured/synthesized evidence; see row status'}]
  };
}
