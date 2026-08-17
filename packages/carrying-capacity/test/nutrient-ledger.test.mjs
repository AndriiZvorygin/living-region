import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateHumanureContribution, calculateNutrientBalance, calculateNutrientLedger} from '../src/nutrient-ledger.mjs';

test('nutrient balance closes with internal transfers instead of creating fertility', () => {
  const balance = calculateNutrientBalance({openingStock: {N: 10, P: 5, K: 8}, biologicalAdditions: {N: 2}, internalTransfersIn: {N: 3}, internalTransfersOut: {N: 3}, exports: {N: 1}, losses: {N: 1}});
  assert.equal(balance.balanced, true);
  assert.equal(balance.closing_stock.N, 10);
});

test('humanure separates raw, treated and crop-available nutrients', () => {
  const result = calculateHumanureContribution({people: 5, enabled: true});
  assert.ok(result.raw_urine.N > result.crop_available.N);
  assert.ok(result.crop_available.P > 0);
  assert.match(result.health_boundary, /treated/);
});

test('multi-year ledger carries stocks and reconciles each year', () => {
  const result = calculateNutrientLedger({years: [1, 2], initialStocks: {N: 20, P: 10, K: 10}, annual: (year) => ({production: [{retained_edible_harvest_kg: year * 10, residue_kg_dm: 20}]}), externalInputs: {N: 1}, losses: {N: .2}});
  assert.equal(result.all_years_balanced, true);
  assert.equal(result.years.length, 2);
  assert.equal(result.final_stock.N > 0, true);
});
