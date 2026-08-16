import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  calculateHealthCanadaEER,
  calculateHealthCanadaProtein,
  calculateHouseholdProteinDemand,
  calculateFeedLedger,
  calculateLivestockScenario,
  calculateMinimumSelfReplacingLivestockSystem,
  calculateNutrientFoodSystem,
  compareNutrientFoodSystems,
  calculateLivestockReproductiveLedger,
  calculateLivestockLabour,
  CHICKEN_SYSTEM_COMPARISON,
  LIVESTOCK_SPECIES,
  calculateFoodNutrientAdequacy,
  calculateHealthCanadaNutrientDemand,
  DAYS_PER_YEAR,
  derivePropertyFeedSupply,
  calculateFoodSystem,
  siteClasses,
  calculateInteractiveHousehold,
  CANONICAL_HOUSEHOLD_FAE,
  FOOD_ADULT_EQUIVALENT_GJ_YEAR,
  LIVESTOCK_LABOUR_SCALING_METHOD,
  LIVESTOCK_LABOUR_SCALING_FORMULA,
  LIVESTOCK_LABOUR_TASKS
} from '../src/index.mjs';

const foodEvidence = JSON.parse(readFileSync(new URL('../data/derived/evidence-food-yields.json', import.meta.url)));
const woodyEvidence = JSON.parse(readFileSync(new URL('../data/derived/evidence-woody-yields.json', import.meta.url)));
const presentation = JSON.parse(readFileSync(new URL('../../education-web/public/generated/carrying-capacity/presentation.json', import.meta.url)));

function member(overrides = {}) {
  return {id: 'member', label: 'Member', age_y: 35, sex: 'male', weight_kg: 75, height_cm: 178, activity: 'low', labour_level: 'moderate', ...overrides};
}

function site(siteId = 'ordinary_mesic') {
  return {...siteClasses[siteId], calculateFoodSystem};
}

test('Health Canada protein demand is a separate DRI calculation from energy demand', () => {
  const lowActivity = member({activity: 'low'});
  const active = member({activity: 'very'});
  const lowEnergy = calculateHealthCanadaEER(lowActivity);
  const activeEnergy = calculateHealthCanadaEER(active);
  const lowProtein = calculateHealthCanadaProtein(lowActivity);
  const activeProtein = calculateHealthCanadaProtein(active);
  assert.notEqual(lowEnergy.gj_year, activeEnergy.gj_year);
  assert.equal(lowProtein.rda_g_day, activeProtein.rda_g_day);
  assert.equal(lowProtein.rda_g_day, 60);
  assert.equal(calculateHealthCanadaProtein(member({age_y: 8, weight_kg: 28, height_cm: 130, sex: 'female'})).rda_g_day, 26.6);
  assert.equal(calculateHouseholdProteinDemand([lowActivity, member({id: 'child', age_y: 8, weight_kg: 28, height_cm: 130, sex: 'female'})]).household_protein_kg_year, 31.63065);
});

test('a high-energy crop system can still fail the separate protein constraint', () => {
  const rows = ['potato_low_input_synthesis', 'wheat_low_input_synthesis', 'dry_beans_low_input_synthesis', 'sunflower_low_input_synthesis', 'oats_low_input_synthesis'].map((id) => ({id, crop: id, category: 'test', food_gj_ha: 100, protein_kg_ha: 0, fat_kg_ha: 0, carbohydrate_kg_ha: 0}));
  const result = calculateNutrientFoodSystem({foodEvidence: {rows}, demandGJ: 10, proteinDemandKgYear: 1, siteCapability: site()});
  assert.ok(result.plant_food.delivered_food_energy_gj >= 10 - 1e-9);
  assert.equal(result.plant_protein_kg_year, 0);
  assert.equal(result.protein_adequacy, false);
});

test('canonical on-site feed ledgers distinguish edible feed and convert shortage to local land', () => {
  const propertyFeed = derivePropertyFeedSupply({foodSystem: {required_food_area_ha: 1}});
  const ledger = calculateFeedLedger({speciesId: 'rabbit_meat', rationId: 'arc_integrated', propertyFeedSupply: propertyFeed});
  assert.equal(ledger.purchased_dry_matter_kg_year, 0);
  assert.equal(ledger.feed_deficit_dm_kg_year, 0);
  assert.ok(ledger.additional_dedicated_feed_land_ha > 0);
  assert.equal(ledger.human_edible_feed_dm_kg_year + ledger.human_inedible_feed_dm_kg_year, ledger.dry_matter_requirement_kg_year);
  assert.ok(ledger.on_property_dry_matter_kg_year <= Object.values(propertyFeed).filter((value) => Number.isFinite(Number(value))).reduce((sum, value) => sum + Number(value), 0));
  assert.ok(ledger.human_inedible_feed_dm_kg_year > 0);
  assert.ok(ledger.winter_stored_feed_available_kg_year >= ledger.winter_stored_feed_required_kg_year);
  assert.equal(propertyFeed.double_counting_rule.includes('not assigned twice'), true);
});

test('livestock conversion reports human-edible and human-inedible feed separately', () => {
  const propertyFeed = derivePropertyFeedSupply({foodSystem: {required_food_area_ha: 1}});
  const rabbit = calculateLivestockScenario({speciesId: 'rabbit_meat', rationId: 'arc_integrated', propertyFeedSupply: propertyFeed});
  assert.equal(rabbit.feed.human_edible_feed_dm_kg_year + rabbit.feed.human_inedible_feed_dm_kg_year, rabbit.feed.dry_matter_requirement_kg_year);
  assert.ok(rabbit.feed.human_inedible_feed_dm_kg_year > 0);
  assert.ok(rabbit.human_edible_protein_conversion_efficiency == null || rabbit.human_edible_protein_conversion_efficiency >= 0);
});

test('external-feed sensitivities remain separate and are not ARC-feasible', () => {
  const propertyFeed = derivePropertyFeedSupply({foodSystem: {required_food_area_ha: 1}});
  const external = calculateFeedLedger({speciesId: 'rabbit_meat', rationId: 'conventional_reference', propertyFeedSupply: propertyFeed});
  assert.ok(external.purchased_dry_matter_kg_year > 0);
  assert.equal(external.feed_self_sufficiency, false);
});

test('animal food output uses edible product and reports winter feed, labour and housing', () => {
  const result = calculateLivestockScenario({speciesId: 'goose_meat', rationId: 'low_food_competition', propertyFeedSupply: derivePropertyFeedSupply({foodSystem: {required_food_area_ha: 1}})});
  assert.equal(result.output.edible_meat_kg_year, 24);
  assert.equal(result.output.liveweight_kg_year, undefined);
  assert.ok(result.feed.winter_stored_feed_required_kg_year > 0);
  assert.ok(result.labour.total_hours_year > 0);
  assert.ok(result.housing.area_m2 > 0);
  assert.ok(result.manure_kg_year > 0);
});

test('livestock replaces only its own food-energy output and adds on-site feed land', () => {
  const demand = calculateHealthCanadaEER(member()).gj_year;
  const protein = calculateHouseholdProteinDemand([member()]).household_protein_kg_year;
  const plants = calculateNutrientFoodSystem({foodEvidence, demandGJ: demand, proteinDemandKgYear: protein, siteCapability: site()});
  const rabbits = calculateNutrientFoodSystem({foodEvidence, demandGJ: demand, proteinDemandKgYear: protein, siteCapability: site(), livestockMode: 'rabbit_meat'});
  assert.ok(rabbits.plant_food.required_food_area_ha < plants.plant_food.required_food_area_ha);
  assert.ok(rabbits.feed.additional_dedicated_feed_land_ha > 0);
  assert.equal(rabbits.feed.purchased_feed_dm_kg_year, 0);
  assert.equal(rabbits.feed.feed_deficit_dm_kg_year, 0);
  assert.equal(rabbits.feed.feed_self_sufficiency, true);
  assert.equal(rabbits.plant_food.delivered_food_energy_gj + rabbits.animal_food_energy_gj_year, plants.plant_only.food_energy_gj_year);
});

test('mixed livestock consumes each property feed stream at most once', () => {
  const demand = calculateHealthCanadaEER(member()).gj_year;
  const protein = calculateHouseholdProteinDemand([member()]).household_protein_kg_year;
  const result = calculateNutrientFoodSystem({foodEvidence, demandGJ: demand, proteinDemandKgYear: protein, siteCapability: site(), livestockMode: 'mixed_rabbit_eggs'});
  const consumed = Object.fromEntries(result.animals.flatMap((animal) => animal.feed.rows).reduce((map, row) => map.set(row.stream_id, (map.get(row.stream_id) ?? 0) + row.on_property_dm_kg), new Map()));
  for (const [streamId, amount] of Object.entries(consumed)) assert.ok(amount <= Number(result.feed.property_supply[streamId] ?? 0) + 1e-6, `${streamId} consumed ${amount} above property supply`);
  assert.equal(result.feed.purchased_feed_dm_kg_year, 0);
  assert.equal(result.feed.feed_deficit_dm_kg_year, 0);
});

test('a site with no feed production makes on-site livestock infeasible instead of importing feed', () => {
  const demand = calculateHealthCanadaEER(member()).gj_year;
  const protein = calculateHouseholdProteinDemand([member()]).household_protein_kg_year;
  const impossibleSite = {...site(), food_yield_multiplier: 1, feed_yield_multiplier: 0};
  const result = calculateNutrientFoodSystem({foodEvidence, demandGJ: demand, proteinDemandKgYear: protein, siteCapability: impossibleSite, livestockMode: 'rabbit_meat'});
  assert.equal(result.feed.purchased_feed_dm_kg_year, 0);
  assert.ok(result.feed.feed_deficit_dm_kg_year > 0);
  assert.equal(result.feed_self_sufficiency, false);
  assert.equal(result.optimizer_eligible, false);
});

test('the nutrient optimizer excludes every external-feed sensitivity', () => {
  const demand = calculateHealthCanadaEER(member()).gj_year;
  const protein = calculateHouseholdProteinDemand([member()]).household_protein_kg_year;
  const comparison = compareNutrientFoodSystems({foodEvidence, demandGJ: demand, proteinDemandKgYear: protein, siteCapability: site()});
  assert.equal(comparison.best?.mode, 'plants_only');
  assert.equal(comparison.best?.ration_id, 'arc_integrated');
  assert.ok(comparison.rows.filter((row) => row.ration_id !== 'arc_integrated').every((row) => !row.optimizer_eligible));
});

test('canonical chicken is a self-replacing dual-purpose flock with no recurring bird imports', () => {
  const ledger = calculateLivestockReproductiveLedger({speciesId: 'chicken_eggs'});
  assert.equal(ledger.self_replacing, true);
  assert.equal(ledger.external_replacement_chicks_year, 0);
  assert.equal(ledger.external_replacement_pullets_year, 0);
  assert.ok(ledger.gross_eggs_year > ledger.edible_eggs_year);
  assert.ok(ledger.surplus_males_year > 0);
  const result = calculateLivestockScenario({speciesId: 'chicken_eggs', rationId: 'arc_integrated', propertyFeedSupply: derivePropertyFeedSupply({foodSystem: {required_food_area_ha: 1}})});
  assert.equal(result.reproduction.feed_all_generations_included, true);
  assert.ok(result.output.edible_meat_kg_year > 0);
  assert.equal(result.feed.purchased_dry_matter_kg_year, 0);
  assert.deepEqual(LIVESTOCK_SPECIES.chicken_eggs.reproduction.reproduction_modes, ['broody_hen', 'local_incubator']);
  assert.equal(CHICKEN_SYSTEM_COMPARISON.canonical.breeding.includes('no recurring'), true);
  assert.equal(CHICKEN_SYSTEM_COMPARISON.industrial_sensitivity.evidence_status, 'non-canonical comparison boundary');
});

test('canonical livestock reproduction ledgers reject recurring animal imports', () => {
  for (const speciesId of ['rabbit_meat', 'chicken_eggs', 'goose_meat', 'goat_meat']) {
    const ledger = calculateLivestockReproductiveLedger({speciesId});
    assert.equal(ledger.self_replacing, true, speciesId);
    assert.equal(ledger.feed_all_generations_included, true, speciesId);
    assert.equal(ledger.external_replacement_animals_year ?? ledger.external_replacement_chicks_year ?? 0, 0, speciesId);
  }
});

test('fast-growing chicken sensitivity is not canonical without self-replacement', () => {
  const demand = calculateHealthCanadaEER(member()).gj_year;
  const protein = calculateHouseholdProteinDemand([member()]).household_protein_kg_year;
  const result = calculateNutrientFoodSystem({foodEvidence, demandGJ: demand, proteinDemandKgYear: protein, members: [member()], siteCapability: site(), livestockMode: 'chicken_meat'});
  assert.equal(result.reproductive_self_sufficiency, false);
  assert.equal(result.optimizer_eligible, false);
});

test('nutrient completeness reports amino-acid pattern and external nutrient boundary', () => {
  const demand = calculateHealthCanadaEER(member()).gj_year;
  const result = calculateNutrientFoodSystem({foodEvidence, demandGJ: demand, proteinDemandKgYear: calculateHouseholdProteinDemand([member()]).household_protein_kg_year, members: [member()], siteCapability: site()});
  assert.ok(result.nutrient_completeness.amino_acid_pattern.limiting_amino_acid);
  assert.ok(result.nutrient_completeness.amino_acid_pattern.rows.lysine.adequacy_ratio > 0);
  assert.ok(result.nutrient_completeness.external_inputs.some((row) => row.nutrient === 'iodine'));
  assert.equal(result.feed.purchased_feed_dm_kg_year, 0);
});

test('daily micronutrient targets are explicit and annual adequacy uses 365.25 days', () => {
  const family = [
    member({id: 'adult-woman', sex: 'female'}),
    member({id: 'adult-man'}),
    member({id: 'child-girl', age_y: 8, sex: 'female', weight_kg: 28, height_cm: 130}),
    member({id: 'teen-boy', age_y: 14, sex: 'male', weight_kg: 48, height_cm: 160}),
    member({id: 'child-boy', age_y: 8, sex: 'male', weight_kg: 28, height_cm: 130})
  ];
  const demand = family.reduce((sum, person) => {
    const row = calculateHealthCanadaNutrientDemand(person);
    return sum + row.vitamin_b12_ug_day;
  }, 0);
  const rows = family.map(calculateHealthCanadaNutrientDemand);
  const total = rows.reduce((sum, row) => ({
    b12: sum.b12 + row.vitamin_b12_ug_day,
    d: sum.d + row.vitamin_d_ug_day,
    a: sum.a + row.vitamin_a_rae_ug_day,
    iron: sum.iron + row.iron_mg_day
  }), {b12: 0, d: 0, a: 0, iron: 0});
  assert.equal(demand, 9.6);
  assert.equal(total.b12, 9.6);
  assert.equal(total.d, 75);
  assert.equal(total.a, 3300);
  assert.equal(total.iron, 57);
  assert.equal(total.b12 * DAYS_PER_YEAR, 3506.4);
  assert.equal(total.d * DAYS_PER_YEAR, 27393.75);
  assert.equal(total.a * DAYS_PER_YEAR, 1205325);
  assert.equal(total.iron * DAYS_PER_YEAR, 20819.25);
});

test('chicken adds food-form B12 but annualized demand remains explicit', () => {
  const demand = calculateHealthCanadaEER(member()).gj_year;
  const protein = calculateHouseholdProteinDemand([member()]).household_protein_kg_year;
  const plants = calculateNutrientFoodSystem({foodEvidence, demandGJ: demand, proteinDemandKgYear: protein, members: [member()], siteCapability: site()});
  const chickens = calculateNutrientFoodSystem({foodEvidence, demandGJ: demand, proteinDemandKgYear: protein, members: [member()], siteCapability: site(), livestockMode: 'chicken_eggs'});
  assert.notEqual(plants.nutrient_completeness.nutrients.b12.status, 'adequate from property-produced food');
  assert.ok(chickens.nutrient_completeness.nutrients.b12.supplied_annual > plants.nutrient_completeness.nutrients.b12.supplied_annual);
  assert.ok(chickens.nutrient_completeness.nutrients.b12.target_annual > chickens.nutrient_completeness.nutrients.b12.target_daily);
  assert.equal(chickens.nutrient_completeness.nutrients.b12.target_annual, chickens.nutrient_completeness.nutrients.b12.target_daily * DAYS_PER_YEAR);
  assert.ok(chickens.nutrient_completeness.nutrients.b12.adequacy_ratio > 0);
  assert.equal(chickens.nutrient_completeness.dimensional_analysis.legacy_ambiguous_target_removed, true);
});

test('whole-diet macros combine plant and animal food after energy displacement', () => {
  const family = [member({id: 'adult-woman', sex: 'female'}), member({id: 'adult-man'}), member({id: 'child-girl', age_y: 8, sex: 'female', weight_kg: 28, height_cm: 130}), member({id: 'teen-boy', age_y: 14, sex: 'male', weight_kg: 48, height_cm: 160}), member({id: 'child-boy', age_y: 8, sex: 'male', weight_kg: 28, height_cm: 130})];
  const demand = family.reduce((sum, person) => sum + calculateHealthCanadaEER(person).gj_year, 0);
  const result = calculateNutrientFoodSystem({foodEvidence, demandGJ: demand, proteinDemandKgYear: calculateHouseholdProteinDemand(family).household_protein_kg_year, members: family, siteCapability: site()});
  const macros = result.nutrient_completeness.whole_diet.macros;
  assert.ok(macros.energy_percent.carbohydrate > 55 && macros.energy_percent.carbohydrate < 70);
  assert.ok(macros.energy_percent.protein > 10 && macros.energy_percent.protein < 20);
  assert.ok(macros.energy_percent.fat > 20 && macros.energy_percent.fat < 30);
  assert.ok(macros.grams_per_day.unsaturated_fat >= macros.grams_per_day.saturated_fat);
  assert.equal(macros.flags.children_fat_floor_met, false);
  assert.ok(macros.amdr.household_intersection.fat_percent_energy.min >= 25);
});

test('nutrition goals resolve to explicit canonical food systems without hiding the selected basis', () => {
  const people = [member(), member({id: 'adult-2', sex: 'female', weight_kg: 65, height_cm: 165})];
  const demand = people.reduce((sum, person) => sum + calculateHealthCanadaEER(person).gj_year, 0);
  const args = {foodEvidence, demandGJ: demand, proteinDemandKgYear: calculateHouseholdProteinDemand(people).household_protein_kg_year, members: people, siteCapability: site()};
  const b12 = calculateNutrientFoodSystem({...args, nutritionGoal: 'minimum_property_b12'});
  const mixed = calculateNutrientFoodSystem({...args, nutritionGoal: 'nutrient_dense_mixed'});
  assert.equal(b12.nutrition_goal_resolution.id, 'minimum_property_b12');
  assert.equal(b12.livestock_scaling_basis, 'minimum_property_b12_discrete_search');
  assert.equal(mixed.mode, 'mixed_rabbit_eggs');
  assert.equal(mixed.nutrition_goal_resolution.id, 'nutrient_dense_mixed');
});

test('amino-acid quality pattern is separate from absolute household adequacy', () => {
  const demand = calculateHealthCanadaEER(member()).gj_year;
  const result = calculateNutrientFoodSystem({foodEvidence, demandGJ: demand, proteinDemandKgYear: calculateHouseholdProteinDemand([member()]).household_protein_kg_year, members: [member()], siteCapability: site()});
  const lysine = result.nutrient_completeness.amino_acid_pattern.rows.lysine;
  assert.ok(lysine.quality_pattern_ratio < 1);
  assert.ok(lysine.absolute_adequacy_ratio > 1);
  assert.ok(lysine.actual_intake_g_year > lysine.requirement_g_year);
  assert.equal(lysine.digestibility_status, 'unresolved evidence');
  assert.equal(lysine.digestibility_adjusted_ratio, null);
  assert.equal(result.nutrient_completeness.amino_acid_pattern.absolute_adequacy, true);
});

test('minimum self-replacing rabbit scale is a discrete viable colony', () => {
  const colony = calculateMinimumSelfReplacingLivestockSystem({speciesId: 'rabbit_meat', propertyFeedSupply: derivePropertyFeedSupply({foodSystem: {required_food_area_ha: 1}})});
  assert.equal(colony.scale, 1);
  assert.equal(colony.reproduction.self_replacing, true);
  assert.equal(colony.reproduction.feed_all_generations_included, true);
  assert.equal(colony.reproduction.external_replacement_animals_year, 0);
  assert.ok(colony.output.edible_meat_kg_year > 0);
});

test('automatic livestock scale resizes one selected system within household animal counts', () => {
  const child = {id: 'child', label: 'Child', age_y: 8, sex: 'female', weight_kg: 28, height_cm: 130, activity: 'low', labour_level: 'dependent'};
  const adult = member();
  const foodSystem = (members, mode = 'rabbit_meat', extra = {}) => {
    const demand = members.reduce((sum, person) => sum + calculateHealthCanadaEER(person).gj_year, 0);
    const protein = calculateHouseholdProteinDemand(members).household_protein_kg_year;
    return calculateNutrientFoodSystem({foodEvidence, demandGJ: demand, proteinDemandKgYear: protein, members, siteCapability: site(), livestockMode: mode, ...extra});
  };
  const one = foodSystem([adult]);
  const two = foodSystem([adult, member({id: 'adult-2', sex: 'female', weight_kg: 65, height_cm: 165})]);
  const family = foodSystem([adult, member({id: 'adult-2', sex: 'female', weight_kg: 65, height_cm: 165}), child, {...child, id: 'child-2', age_y: 14, sex: 'male', weight_kg: 48, height_cm: 160}, {...child, id: 'child-3', sex: 'male'}]);
  assert.equal(one.livestock_system_count, 1);
  assert.equal(two.livestock_system_count, 1);
  assert.equal(family.livestock_system_count, 1);
  assert.ok(family.livestock_scale > 0.9 && family.livestock_scale < 1.01);
  assert.equal(family.livestock_scaling_basis, 'household_food_adult_equivalents_divided_by_canonical_household_fae');
  assert.equal(family.animals[0].output.edible_protein_kg_year, 8.89);
  assert.equal(family.animals[0].reproduction.breeding_females, 4);
  assert.equal(family.animals[0].reproduction.breeding_males, 1);
  assert.equal(family.animals[0].reproduction.kits_surviving_year, 84);
  assert.equal(family.animals[0].reproduction.animals_available_for_harvest_year, 82.75);
  assert.equal(family.animals[0].labour.recurring_hours_year, 180);
  assert.equal(family.animals[0].labour.slaughter_processing_hours_year, 45);
  assert.equal(family.animals[0].labour.total_hours_year, 225);
  assert.equal(family.animals[0].housing.area_m2, 12);
  assert.equal(family.animals[0].feed.dry_matter_requirement_kg_year, 350);
  assert.ok(family.animals[0].output.edible_protein_kg_year > two.animals[0].output.edible_protein_kg_year);
  assert.ok(family.feed.additional_dedicated_feed_land_ha > one.feed.additional_dedicated_feed_land_ha);
});

test('all canonical livestock modes scale with the same household count', () => {
  const adults = [member(), member({id: 'adult-2', sex: 'female', weight_kg: 65, height_cm: 165})];
  const child = {id: 'child', label: 'Child', age_y: 8, sex: 'female', weight_kg: 28, height_cm: 130, activity: 'low', labour_level: 'dependent'};
  const family = [...adults, child, {...child, id: 'child-2', age_y: 14, sex: 'male', weight_kg: 48, height_cm: 160}, {...child, id: 'child-3', sex: 'male'}];
  const run = (members, livestockMode) => {
    const demand = members.reduce((sum, person) => sum + calculateHealthCanadaEER(person).gj_year, 0);
    return calculateNutrientFoodSystem({foodEvidence, demandGJ: demand, proteinDemandKgYear: calculateHouseholdProteinDemand(members).household_protein_kg_year, members, siteCapability: site(), livestockMode});
  };
  for (const mode of ['chicken_eggs', 'chicken_meat', 'goose_meat', 'goat_meat', 'mixed_rabbit_eggs']) {
    const result = run(family, mode);
    const adultResult = run(adults, mode);
    assert.equal(result.livestock_system_count, mode === 'mixed_rabbit_eggs' ? 2 : 1, mode);
    assert.ok(result.animals.every((animal) => animal.scale > 0 && animal.scale < 1.01), mode);
    assert.ok(result.animals.every((animal) => (animal.population.breeding_females ?? animal.population.production_animals_year) > 0), mode);
    assert.ok(result.feed.annual_feed_required_kg > adultResult.feed.annual_feed_required_kg, mode);
    assert.ok(result.labour.livestock_hours_year > adultResult.labour.livestock_hours_year, mode);
    assert.ok(result.animals.every((animal, index) => animal.housing.area_m2 >= adultResult.animals[index].housing.area_m2), mode);
    assert.ok(result.feed.additional_dedicated_feed_land_ha >= adultResult.feed.additional_dedicated_feed_land_ha, mode);
  }
});

test('task-based labour preserves the canonical rabbit ledger and exposes every task', () => {
  const canonical = calculateLivestockScenario({speciesId: 'rabbit_meat', scale: 1, propertyFeedSupply: {}, requireSelfSufficient: false});
  const oneDoe = calculateLivestockScenario({speciesId: 'rabbit_meat', scale: .25, propertyFeedSupply: {}, requireSelfSufficient: false});
  const eightDoes = calculateLivestockScenario({speciesId: 'rabbit_meat', scale: 2, propertyFeedSupply: {}, requireSelfSufficient: false});
  assert.equal(canonical.labour.recurring_hours_year, 180);
  assert.equal(canonical.labour.slaughter_processing_hours_year, 45);
  assert.equal(canonical.labour.total_hours_year, 225);
  assert.ok(oneDoe.labour.recurring_hours_year > canonical.labour.recurring_hours_year * .25);
  assert.ok(eightDoes.labour.recurring_hours_year < canonical.labour.recurring_hours_year * 2);
  assert.equal(canonical.labour.scaling_method, LIVESTOCK_LABOUR_SCALING_METHOD);
  assert.equal(canonical.labour.scaling_formula, LIVESTOCK_LABOUR_SCALING_FORMULA);
  assert.equal(canonical.labour.components.recurring.fixed_system, 90);
  assert.equal(canonical.labour.components.processing.batch_setup, 10);
  assert.equal(canonical.labour.activity.average_growout_inventory, 16.109589);
  assert.equal(canonical.labour.activity.processing_batches_year, 4);
  assert.deepEqual(Object.keys(canonical.labour.sensitivities).sort(), ['central', 'high', 'low']);
  assert.deepEqual(canonical.labour.task_definition, LIVESTOCK_LABOUR_TASKS.rabbit_meat);
});

test('task-based livestock labour rises with animal count while unit labour generally falls', () => {
  for (const speciesId of ['rabbit_meat', 'chicken_eggs', 'goose_meat', 'goat_meat']) {
    const small = calculateLivestockScenario({speciesId, scale: .5, propertyFeedSupply: {}, requireSelfSufficient: false});
    const canonical = calculateLivestockScenario({speciesId, scale: 1, propertyFeedSupply: {}, requireSelfSufficient: false});
    const large = calculateLivestockScenario({speciesId, scale: 2, propertyFeedSupply: {}, requireSelfSufficient: false});
    assert.ok(small.labour.total_hours_year < canonical.labour.total_hours_year, speciesId);
    assert.ok(canonical.labour.total_hours_year < large.labour.total_hours_year, speciesId);
    assert.ok(large.labour.hours_per_kg_edible_product <= small.labour.hours_per_kg_edible_product, speciesId);
  }
});

test('task labour helper matches the public labour method and processing equation', () => {
  const row = calculateLivestockScenario({speciesId: 'rabbit_meat', scale: 1, propertyFeedSupply: {}, requireSelfSufficient: false});
  const helper = calculateLivestockLabour({speciesId: 'rabbit_meat', population: row.population});
  const processing = helper.components.processing.batch_setup + helper.components.processing.harvested_animals;
  assert.equal(helper.scaling_method, LIVESTOCK_LABOUR_SCALING_METHOD);
  assert.equal(helper.scaling_formula, LIVESTOCK_LABOUR_SCALING_FORMULA);
  assert.equal(helper.processing_hours_year, processing);
  assert.equal(row.labour.slaughter_processing_hours_year, helper.processing_hours_year);
  assert.equal(row.labour.hours_per_kg_edible_product, 5.5147);
  assert.equal(row.labour.hours_per_kg_animal_protein, 25.3093);
});

test('plants-only has no livestock systems and explicit sensitivity scale is respected', () => {
  const people = [member(), member({id: 'adult-2', sex: 'female', weight_kg: 65, height_cm: 165})];
  const demand = people.reduce((sum, person) => sum + calculateHealthCanadaEER(person).gj_year, 0);
  const plants = calculateNutrientFoodSystem({foodEvidence, demandGJ: demand, proteinDemandKgYear: calculateHouseholdProteinDemand(people).household_protein_kg_year, members: people, siteCapability: site(), livestockMode: 'plants_only'});
  const override = calculateNutrientFoodSystem({foodEvidence, demandGJ: demand, proteinDemandKgYear: calculateHouseholdProteinDemand(people).household_protein_kg_year, members: people, siteCapability: site(), livestockMode: 'rabbit_meat', livestockScale: 1});
  assert.equal(plants.livestock_system_count, 0);
  assert.equal(plants.animal_protein_kg_year, 0);
  assert.equal(override.livestock_system_count, 1);
  assert.equal(override.livestock_scaling_basis, 'explicit_sensitivity_override');
});

test('interactive establishment and nutrient results share one automatic livestock count', () => {
  const members = [member(), member({id: 'adult-2', sex: 'female', weight_kg: 65, height_cm: 165}), {id: 'child', label: 'Child', age_y: 8, sex: 'female', weight_kg: 28, height_cm: 130, activity: 'low', labour_level: 'dependent'}, {id: 'teen', label: 'Teen', age_y: 14, sex: 'male', weight_kg: 48, height_cm: 160, activity: 'low', labour_level: 'dependent'}, {id: 'child-2', label: 'Child 2', age_y: 8, sex: 'male', weight_kg: 28, height_cm: 130, activity: 'low', labour_level: 'dependent'}];
  const result = calculateInteractiveHousehold({members, buildings: [presentation.heating.default_building], siteId: 'ordinary_mesic', foodEvidence, woodyCases: woodyEvidence.cases, establishmentModel: presentation.establishment.site_models.ordinary_mesic, livestockMode: 'rabbit_meat'});
  const peak = result.establishment_land.strategy_comparison.progressive_handoff.rows.find((row) => row.year === result.establishment_land.strategy_comparison.progressive_handoff.establishment_peak_year);
  assert.equal(result.nutrient_food_system.livestock_system_count, 1);
  assert.equal(result.nutrient_food_system.animals[0].output.edible_protein_kg_year, 8.89);
  assert.equal(result.nutrient_food_system.animals[0].reproduction.breeding_females, 4);
  assert.equal(peak.additional_exclusive_land_ha, result.nutrient_food_system.feed.additional_dedicated_feed_land_ha);
});

test('every household preset and livestock mode uses one shared normalized scale', () => {
  const modes = ['rabbit_meat', 'chicken_eggs', 'chicken_meat', 'goose_meat', 'goat_meat', 'mixed_rabbit_eggs'];
  for (const preset of presentation.household_presets) {
    const members = preset.members;
    const demand = members.reduce((sum, person) => sum + calculateHealthCanadaEER(person).gj_year, 0);
    const expectedScale = demand / (FOOD_ADULT_EQUIVALENT_GJ_YEAR * CANONICAL_HOUSEHOLD_FAE);
    for (const mode of modes) {
      const result = calculateNutrientFoodSystem({foodEvidence, demandGJ: demand, proteinDemandKgYear: calculateHouseholdProteinDemand(members).household_protein_kg_year, members, siteCapability: site(), livestockMode: mode});
      assert.equal(result.livestock_system_count, mode === 'mixed_rabbit_eggs' ? 2 : 1, `${preset.id}:${mode}`);
      assert.ok(Math.abs(result.livestock_scale - expectedScale) < 0.00001, `${preset.id}:${mode}`);
      assert.ok(result.animals.every((animal) => animal.feed.dry_matter_requirement_kg_year >= 0), `${preset.id}:${mode}`);
      assert.ok(result.animals.every((animal) => animal.reproduction.self_replacing || mode === 'chicken_meat'), `${preset.id}:${mode}`);
    }
  }
});

test('nutritional comparison exposes distinct objectives and Pareto options', () => {
  const demand = calculateHealthCanadaEER(member()).gj_year;
  const protein = calculateHouseholdProteinDemand([member()]).household_protein_kg_year;
  const comparison = compareNutrientFoodSystems({foodEvidence, demandGJ: demand, proteinDemandKgYear: protein, members: [member()], siteCapability: site()});
  assert.ok(comparison.objectives.lowest_food_feed_area);
  assert.ok(comparison.objectives.lowest_external_nutrient_dependence);
  assert.ok(comparison.objectives.maximum_nutritional_completeness);
  assert.ok(comparison.pareto_efficient_options.some((row) => row.mode === 'plants_only'));
  assert.ok(comparison.pareto_efficient_options.length >= 2);
});

test('plants-only remains valid and integrated establishment uses species production start years', () => {
  const members = [member({id: 'adult-1', sex: 'female', weight_kg: 65, height_cm: 165}), member({id: 'adult-2'}), member({id: 'child', age_y: 8, weight_kg: 28, height_cm: 130, sex: 'female', labour_level: 'dependent'})];
  const plants = calculateInteractiveHousehold({members, siteId: 'ordinary_mesic', foodEvidence, woodyCases: woodyEvidence.cases, establishmentModel: presentation.establishment.site_models.ordinary_mesic, livestockMode: 'plants_only'});
  const goats = calculateInteractiveHousehold({members, siteId: 'ordinary_mesic', foodEvidence, woodyCases: woodyEvidence.cases, establishmentModel: presentation.establishment.site_models.ordinary_mesic, livestockMode: 'goat_meat'});
  assert.equal(plants.nutrient_food_system.mode, 'plants_only');
  assert.equal(plants.nutrient_food_system.protein_adequacy, true);
  assert.equal(goats.nutrient_food_system.animal_output_by_year['1'].food_energy_gj_year, 0);
  assert.ok(goats.nutrient_food_system.animal_output_by_year['2'].food_energy_gj_year > 0);
  assert.ok(goats.establishment_land.strategy_comparison.progressive_handoff.establishment_land_requirement_ha > plants.establishment_land.strategy_comparison.progressive_handoff.establishment_land_requirement_ha);
});
