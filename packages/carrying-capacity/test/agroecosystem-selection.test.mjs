import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildPlantDatabase} from '../src/plant-database.mjs';
import {buildSiteSelectionContext, calculatePlantSuitability} from '../src/suitability.mjs';
import {calculateAgroecosystemPlan, calculateLayeredPerennialSuccession, scheduleAnnualPlots} from '../src/agroecosystem.mjs';
import {FOOD_NUTRIENT_PROFILES} from '../src/nutrition.mjs';

const database = buildPlantDatabase(JSON.parse(await readFile(new URL('../data/source/agroecosystem-plants.json', import.meta.url))));

test('site suitability gives inclusion and exclusion reasons', () => {
  const ordinary = buildSiteSelectionContext('ordinary_mesic');
  const marginal = buildSiteSelectionContext('shallow_rocky_marginal');
  const wheat = database.records.find((record) => record.id === 'annual_winter_wheat');
  const ordinaryResult = calculatePlantSuitability(wheat, ordinary);
  const marginalResult = calculatePlantSuitability(wheat, marginal);
  assert.equal(ordinaryResult.hard_compatible, true);
  assert.equal(marginalResult.hard_compatible, false);
  assert.ok(marginalResult.exclusion_reasons.length > 0);
});

test('annual schedule reports seasonal occupation and rotation conflicts', () => {
  const records = database.records.filter((record) => ['annual_dry_bean', 'annual_buckwheat'].includes(record.id));
  const schedule = scheduleAnnualPlots({records, totalAreaHa: 1, years: [1, 2, 3]});
  assert.equal(schedule.years.length, 3);
  assert.equal(schedule.years[0].occupied_area_ha, 1);
  assert.ok(schedule.years[0].plots.every((row) => row.harvest_day >= row.sowing_day));
});

test('layered perennial output changes with bearing curves and does not sum unlimited layers', () => {
  const records = database.records.filter((record) => ['perennial_raspberry', 'perennial_hazelnut', 'perennial_chinese_chestnut', 'support_clover'].includes(record.id));
  const timeline = calculateLayeredPerennialSuccession({records, totalAreaHa: 1, years: [1, 5, 8, 15, 'mature']});
  assert.equal(timeline.years[0].retained_edible_harvest_kg, 0);
  assert.ok(timeline.years.at(-1).retained_edible_harvest_kg > timeline.years[0].retained_edible_harvest_kg);
  assert.ok(timeline.years.at(-1).canopy_competition_factor <= 1);
  assert.equal(timeline.planted_perennial_footprint_ha, 1);
});

test('ordinary agroecosystem plan contains selected species, succession and explicit uncertainty', () => {
  const plan = calculateAgroecosystemPlan({database, siteId: 'ordinary_mesic', annualAreaHa: 1, perennialAreaHa: 1, householdFoodDemandGJYear: 100, nutritionProfiles: FOOD_NUTRIENT_PROFILES});
  assert.equal(plan.site.id, 'ordinary_mesic');
  assert.ok(plan.selection.selected.length > 0);
  assert.equal(plan.perennial_succession.years.length, 31);
  assert.equal(plan.reconciliation.unknown_values_are_not_zero, true);
  assert.ok(plan.whole_diet.years.some((row) => row.macro.energy_percent.fat > 0));
  for (const row of plan.whole_diet.years) {
    const reconciliation = row.reconciliation;
    const lhs = reconciliation.consumed_annual_kg + reconciliation.seed_kg + reconciliation.stored_kg + reconciliation.feed_kg + reconciliation.export_kg + reconciliation.loss_kg;
    assert.ok(Math.abs(lhs - reconciliation.produced_annual_kg) < .01);
    assert.ok(Math.abs(row.energy_reconciliation.consumed_gj_year - row.energy_reconciliation.demand_gj_year) < .000001);
  }
});

test('nutritional-completeness planning selects fat and protein roles and reports a real macro constraint', () => {
  const plan = calculateAgroecosystemPlan({database, siteId: 'ordinary_mesic', objectives: ['nutritional_completeness'], annualAreaHa: 1, perennialAreaHa: 1, householdFoodDemandGJYear: 100, annualResilienceFloorGJYear: 10, nutritionProfiles: FOOD_NUTRIENT_PROFILES});
  const selected = new Set(plan.selection.selected.map((row) => row.plant_id));
  assert.equal(selected.has('annual_dry_bean'), true);
  assert.equal(selected.has('annual_sunflower'), true);
  assert.equal(plan.nutrition_constraint.status, 'current_ration_feasible');
  assert.ok(plan.whole_diet.years.every((row) => row.nutrition_constraint.status === 'current_ration_feasible'));
  const yearOne = plan.whole_diet.years.find((row) => row.year === 1);
  const mature = plan.whole_diet.years.find((row) => row.year === 'mature');
  const sunflower = (row) => row.produced.annual.find((item) => item.plant_id === 'annual_sunflower');
  assert.ok(sunflower(yearOne).energy_share >= sunflower(mature).energy_share);
});

test('macro contract distinguishes a protein miss from optimizer infeasibility', () => {
  const plan = calculateAgroecosystemPlan({database, siteId: 'ordinary_mesic', objectives: ['low_external_input'], annualAreaHa: 1, perennialAreaHa: 1, householdFoodDemandGJYear: 4.279466, annualResilienceFloorGJYear: .4279466, nutritionProfiles: FOOD_NUTRIENT_PROFILES, humanure: {enabled: false}});
  const yearFive = plan.whole_diet.years.find((row) => row.year === 5);
  assert.equal(yearFive.nutrition_constraint.current_ration.status, 'outside_targets');
  assert.equal(yearFive.nutrition_constraint.checks.carbohydrate.met, true);
  assert.equal(yearFive.nutrition_constraint.checks.fat.met, true);
  assert.equal(yearFive.nutrition_constraint.checks.protein.status, 'below_target');
  assert.equal(yearFive.nutrition_constraint.optimizer.status, 'not_requested');
  assert.equal(yearFive.nutrition_constraint.status, 'current_ration_outside_targets');
  assert.ok(yearFive.nutrition_constraint.adjustment.share_transfer > 0);
  assert.ok(yearFive.nutrition_constraint.adjustment.resulting_energy_percent.protein >= 10);
  assert.equal(plan.nutrition_constraint.status, 'current_ration_outside_targets');
});

test('macro-feasible candidate set is reported separately from the displayed ration', () => {
  const plan = calculateAgroecosystemPlan({database, siteId: 'ordinary_mesic', objectives: ['nutritional_completeness'], annualAreaHa: 1, perennialAreaHa: 1, householdFoodDemandGJYear: 4.279466, annualResilienceFloorGJYear: .4279466, nutritionProfiles: FOOD_NUTRIENT_PROFILES});
  const yearOne = plan.whole_diet.years.find((row) => row.year === 1);
  assert.equal(yearOne.nutrition_constraint.optimizer.status, 'feasible_candidate_exists');
  assert.equal(yearOne.nutrition_constraint.optimizer.proved_infeasible, false);
});

test('truly infeasible macro food set is proven only under an explicit nutrition objective', () => {
  const records = database.records.filter((record) => ['annual_potato', 'annual_winter_wheat'].includes(record.id));
  const plan = calculateAgroecosystemPlan({database: {records}, siteId: 'ordinary_mesic', objectives: ['nutritional_completeness'], annualAreaHa: 1, perennialAreaHa: 0, householdFoodDemandGJYear: 20, nutritionProfiles: FOOD_NUTRIENT_PROFILES});
  assert.equal(plan.nutrition_constraint.status, 'optimizer_proved_infeasible');
  assert.equal(plan.nutrition_constraint.optimizer.status, 'proved_infeasible_under_active_food_set');
  assert.ok(plan.whole_diet.years.every((row) => row.nutrition_constraint.optimizer.proved_infeasible));
});

test('macro target checks use raw energy shares and retain dimensional energy factors', () => {
  const plan = calculateAgroecosystemPlan({database, siteId: 'ordinary_mesic', objectives: ['low_external_input'], annualAreaHa: 1, perennialAreaHa: 1, householdFoodDemandGJYear: 4.279466, annualResilienceFloorGJYear: .4279466, nutritionProfiles: FOOD_NUTRIENT_PROFILES});
  const row = plan.whole_diet.years.find((candidate) => candidate.year === 5);
  assert.deepEqual(row.nutrition_constraint.target_ranges, {carbohydrate: {min: 45, max: 65, unit: '% of food energy'}, protein: {min: 10, max: 35, unit: '% of food energy'}, fat: {min: 20, max: 35, unit: '% of food energy'}});
  assert.equal(row.macro.energy_factor_basis.includes('0.016736'), true);
  assert.equal(row.energy_reconciliation.status, 'balanced');
  assert.ok(Math.abs(Object.values(row.macro.energy_percent).reduce((sum, value) => sum + value, 0) - 100) < .02);
});

test('macro matrix recalculates status across site, objective and succession changes', () => {
  const cases = [];
  for (const siteId of ['ordinary_mesic', 'dry', 'shallow_rocky_marginal']) for (const objective of ['low_external_input', 'nutritional_completeness']) {
    const plan = calculateAgroecosystemPlan({database, siteId, objectives: [objective], annualAreaHa: 1, perennialAreaHa: 1, householdFoodDemandGJYear: 4.279466, annualResilienceFloorGJYear: .4279466, nutritionProfiles: FOOD_NUTRIENT_PROFILES, humanure: {enabled: false}});
    const row = plan.whole_diet.years.find((candidate) => candidate.year === 5);
    cases.push({siteId, objective, status: row.nutrition_constraint.status, optimizer: row.nutrition_constraint.optimizer.status});
    assert.ok(['current_ration_feasible', 'current_ration_outside_targets', 'optimizer_proved_infeasible'].includes(row.nutrition_constraint.status));
    assert.deepEqual(Object.keys(row.nutrition_constraint.checks).sort(), ['carbohydrate', 'fat', 'protein']);
  }
  assert.ok(cases.some((row) => row.objective === 'low_external_input' && row.status === 'current_ration_outside_targets'));
  assert.ok(cases.some((row) => row.objective === 'nutritional_completeness' && row.optimizer === 'feasible_candidate_exists'));
});

test('the URL scenario parameters resolve to a year-five protein-only current-ration miss', () => {
  const url = new URL('https://andriizvorygin.github.io/living-region/carrying-capacity?preset=reference_adult_man&site=ordinary_mesic&livestock=plants_only&ration=arc_integrated&goal=plants_plus_external&agroGoal=low_external_input&supportRatio=0.25&agroYear=5&humanure=0');
  const plan = calculateAgroecosystemPlan({database, siteId: url.searchParams.get('site'), objectives: [url.searchParams.get('agroGoal')], supportPlantRatio: Number(url.searchParams.get('supportRatio')), annualAreaHa: 1, perennialAreaHa: 1, nutritionProfiles: FOOD_NUTRIENT_PROFILES, householdPeople: 1, householdFoodDemandGJYear: 4.279466, annualResilienceFloorGJYear: .4279466, humanure: {enabled: url.searchParams.get('humanure') === '1'}});
  const row = plan.whole_diet.years.find((candidate) => candidate.year === Number(url.searchParams.get('agroYear')));
  assert.equal(row.nutrition_constraint.status, 'current_ration_outside_targets');
  assert.equal(row.nutrition_constraint.optimizer.status, 'not_requested');
  assert.equal(row.nutrition_constraint.checks.carbohydrate.met, true);
  assert.equal(row.nutrition_constraint.checks.fat.met, true);
  assert.equal(row.nutrition_constraint.checks.protein.status, 'below_target');
});
