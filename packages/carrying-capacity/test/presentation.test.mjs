import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCarryingCapacityPresentationContract} from '../src/presentation.mjs';

test('public presentation contains perennial evidence, reference-only candidates and metric display units', () => {
  const contract = buildCarryingCapacityPresentationContract({generatedAt: 'test'});
  assert.equal(contract.metric_only_presentation, true);
  assert.deepEqual(contract.units, {energy: 'MJ/day and GJ/year', land: 'ha', labour: 'hours/year', population: 'people'});
  assert.equal(contract.reference_profile.sex, 'male');
  assert.equal(contract.reference_profile.weight_kg, 75);
  assert.equal(contract.reference_profile.height_cm, 178);
  assert.equal(contract.perennial_food_evidence.rows.length, 8);
  assert.ok(contract.perennial_food_evidence.rows.some((row) => row.species === 'Heartnut/Japanese walnut' && row.evidence_status === 'reference only' && row.mature_food_gj_ha_year === null));
  assert.ok(contract.perennial_food_evidence.rows.some((row) => row.species === 'White oak/acorn systems' && row.evidence_status === 'reference only'));
  assert.equal(contract.perennial_food_evidence.mix_timeline.at(-1).harvested_food_gj_year, contract.perennial_food_evidence.central_mix.mature_food_gj_ha_year);
  assert.equal(contract.heating.default_building.archetype, 'arc_yurt');
  assert.ok(contract.heating.insulation_presets.good.wall_rsi > 0);
  const publicJson = JSON.stringify(contract);
  assert.equal(/\bkcal\b/i.test(publicJson), false);
  assert.equal(/\bcalories?\b/i.test(publicJson), false);
  assert.equal(/"(?:wall|roof|floor)_r"\s*:/.test(publicJson), false);
});
