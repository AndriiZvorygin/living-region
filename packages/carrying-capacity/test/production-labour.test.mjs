import test from 'node:test';
import assert from 'node:assert/strict';
import plantSource from '../data/source/agroecosystem-plants.json' with {type: 'json'};
import {buildPlantDatabase} from '../src/plant-database.mjs';
import {FOOD_NUTRIENT_PROFILES} from '../src/nutrition.mjs';
import {calculateAgroecosystemPlan} from '../src/agroecosystem.mjs';
import {calculateFoodProductionLabour} from '../src/production-labour.mjs';

const database = buildPlantDatabase(plantSource);

function planFor(demand) {
  return calculateAgroecosystemPlan({
    database,
    siteId: 'ordinary_mesic',
    objectives: ['low_external_input'],
    supportPlantRatio: .25,
    annualAreaHa: 1,
    perennialAreaHa: 1,
    nutritionProfiles: FOOD_NUTRIENT_PROFILES,
    householdPeople: 1,
    householdFoodDemandGJYear: demand,
    annualResilienceFloorGJYear: demand * .1
  });
}

test('food-production labour follows the succession ledger through establishment and maturity', () => {
  const plan = planFor(70);
  const ledger = plan.labour;
  assert.equal(ledger.stages[0].year, 0);
  assert.ok(ledger.stages[0].establishment_hours_year > 0);
  assert.ok(ledger.stages.some((row) => row.year === 1));
  assert.ok(ledger.stages.some((row) => row.year === 2));
  assert.ok(ledger.stages.some((row) => row.year === 3));
  assert.ok(ledger.stages.some((row) => row.year === 5));
  assert.ok(ledger.stages.some((row) => row.year === 10));
  assert.ok(ledger.stages.some((row) => row.year === 'mature'));
  const yearOne = ledger.stages.find((row) => row.year === 1);
  const mature = ledger.stages.find((row) => row.year === 'mature');
  assert.ok(yearOne.recurring_hours_year > 0);
  assert.ok(mature.recurring_hours_year > 0);
  assert.ok(yearOne.categories.perennial_food_forest > 0);
  assert.equal(ledger.stages[0].nutrition.status, 'not_yet_producing');
  assert.ok(ledger.stages.every((row) => row.food.annual_food_energy_gj_year >= 0));
  assert.ok(ledger.stages.filter((row) => row.year !== 0).every((row) => row.food.energy_sufficiency === true));
});

test('labour categories reconcile and use explicit weekly and seasonal units', () => {
  const stage = planFor(70).labour.stages.find((row) => row.year === 5);
  const categoryTotal = Object.values(stage.categories).reduce((sum, value) => sum + value, 0);
  assert.ok(Math.abs(categoryTotal - stage.recurring_hours_year) < .05);
  assert.ok(Math.abs(stage.average_hours_week - stage.total_hours_year / (365.25 / 7)) < .02);
  assert.ok(stage.seasonal_peak_hours_week >= stage.average_hours_week);
  assert.ok(stage.peak_month >= 1 && stage.peak_month <= 12);
});

test('household food-production labour responds to production scale without changing labour units', () => {
  const small = planFor(35).labour.stages.find((row) => row.year === 1);
  const large = planFor(105).labour.stages.find((row) => row.year === 1);
  assert.ok(large.total_hours_year > small.total_hours_year);
  assert.equal(typeof large.total_hours_year, 'number');
  assert.equal(typeof large.average_hours_week, 'number');
});

test('missing labour mappings are surfaced instead of becoming zero', () => {
  const ledger = calculateFoodProductionLabour({foodSuccessionLedger: {rows: [{year: 1, household_food_demand_gj_year: 10, annual_food_energy_gj_year: 10, foods: [{id: 'unmapped-crop', production_type: 'annual', area_ha: 1}]}]}});
  assert.equal(ledger.stages[1].data_quality.status, 'partial');
  assert.ok(ledger.missing_data.some((row) => row.id === 'unmapped-crop'));
});
