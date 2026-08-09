import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateRegionalCarryingCapacity} from '../src/regional.mjs';

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
