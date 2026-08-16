import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  calculateHealthCanadaEER,
  calculateHealthCanadaProtein,
  calculateHouseholdProteinDemand,
  calculateFeedLedger,
  calculateLivestockScenario,
  calculateNutrientFoodSystem,
  compareNutrientFoodSystems,
  calculateLivestockReproductiveLedger,
  CHICKEN_SYSTEM_COMPARISON,
  LIVESTOCK_SPECIES,
  calculateFoodNutrientAdequacy,
  derivePropertyFeedSupply,
  calculateFoodSystem,
  siteClasses,
  calculateInteractiveHousehold
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

test('chicken adds food-form B12 while plants-only leaves it unresolved', () => {
  const demand = calculateHealthCanadaEER(member()).gj_year;
  const protein = calculateHouseholdProteinDemand([member()]).household_protein_kg_year;
  const plants = calculateNutrientFoodSystem({foodEvidence, demandGJ: demand, proteinDemandKgYear: protein, members: [member()], siteCapability: site()});
  const chickens = calculateNutrientFoodSystem({foodEvidence, demandGJ: demand, proteinDemandKgYear: protein, members: [member()], siteCapability: site(), livestockMode: 'chicken_eggs'});
  assert.notEqual(plants.nutrient_completeness.nutrients.b12.status, 'adequate from property food');
  assert.equal(chickens.nutrient_completeness.nutrients.b12.status, 'adequate from property food');
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
