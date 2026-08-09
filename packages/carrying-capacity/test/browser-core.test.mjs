import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {calculateHealthCanadaEER, calculateInteractiveHousehold} from '../src/browser.mjs';

const food = JSON.parse(fs.readFileSync(new URL('../data/derived/evidence-food-yields.json', import.meta.url), 'utf8'));
const woody = JSON.parse(fs.readFileSync(new URL('../data/derived/evidence-woody-yields.json', import.meta.url), 'utf8'));

test('browser-safe EER interface matches the canonical metric results', () => {
  const result = calculateHealthCanadaEER({age_y: 35, sex: 'female', weight_kg: 65, height_cm: 165, activity: 'low'});
  assert.ok(result.mj_day > 0);
  assert.equal(result.gj_year, Number((result.mj_day * 365.25 / 1000).toFixed(6)));
});

test('browser-safe household interface keeps food, heat and reserve land distinct', () => {
  const members = [calculateHealthCanadaEER({age_y: 35, sex: 'female', weight_kg: 65, height_cm: 165, activity: 'low'})];
  const result = calculateInteractiveHousehold({members, siteId: 'ordinary_mesic', foodEvidence: food, woodyCases: woody.cases});
  assert.ok(result.food_area_ha > 0);
  assert.ok(result.food_adult_equivalents > 0);
  assert.match(result.caveat, /food-energy normalization only/);
  assert.ok(result.heating_area_ha > 0);
  assert.equal(result.robust_minimum_area_ha, Number((result.food_area_ha + result.heating_area_ha + result.resilience_allowances_ha.diversity_and_rotation_ha).toFixed(6)));
});
