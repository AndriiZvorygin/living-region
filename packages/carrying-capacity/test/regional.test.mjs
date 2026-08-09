import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateRegionalCarryingCapacity, calculateGreyCarryingCapacityAdoption} from '../src/regional.mjs';

test('regional aggregation reports household composition and site sensitivity', () => {
  const result = calculateRegionalCarryingCapacity({
    regionId: 'test',
    population: 1000,
    dwellings: 400,
    humanFoodPriorityHa: 100
  });
  const family = result.household_composition_sensitivity.find((row) => row.household_profile === 'two_adults_plus_two_children');
  const oneAdult = result.household_composition_sensitivity.find((row) => row.household_profile === 'one_adult');
  assert.equal(result.contract_version, '1.0.0');
  assert.equal(result.site_sensitivity.length, 3);
  assert.ok(oneAdult.households_supported > family.households_supported);
  assert.ok(family.mature_recurring_labour_hours_year > 0);
});

test('regional site shares are normalized and remain explicit', () => {
  const result = calculateRegionalCarryingCapacity({humanFoodPriorityHa: 60, siteShares: {favourable: 1, ordinary: 1, marginal: 2}});
  const total = Object.values(result.site_allocation.shares).reduce((sum, value) => sum + value, 0);
  assert.ok(Math.abs(total - 1) < 1e-12);
  assert.equal(result.site_allocation.shares.marginal, 0.5);
  assert.match(result.site_allocation.rule, /scenario allocation/);
});

test('Grey adoption scenarios use eligible households, explicit site mix and canonical transition years', () => {
  const result = calculateGreyCarryingCapacityAdoption({eligibleHouseholds: 100, eligiblePopulation: 260, regionalFoodDemandGJ: 1000, adoptionRates: [0, .5], externalInputConditions: {present: 1}});
  assert.deepEqual(result.adoption_rates, [0, .5]);
  assert.equal(result.scenarios.length, 2);
  const mature = result.scenarios[1].transition_years.find((row) => row.year === 'mature');
  const yearOne = result.scenarios[1].transition_years.find((row) => row.year === 1);
  assert.equal(mature.participating_households, 50);
  assert.ok(yearOne.establishment_annual_food_area_ha > mature.mature_annual_food_area_ha);
  assert.ok(mature.market_food_demand_displaced_gj_year > 0);
  assert.ok(mature.mature_exportable_surplus_gj_year >= 0);
});
