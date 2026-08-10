import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  calculateBuildingHeatingDemand,
  calculateHeatingLoads,
  calculateHouseholdLabourCapacity,
  calculateInteractiveHousehold,
  calculatePersonVisualMetrics,
  calculateExclusiveLandAllocation,
  calculateHealthCanadaEER
} from '../src/index.mjs';

const foodEvidence = JSON.parse(readFileSync(new URL('../data/derived/evidence-food-yields.json', import.meta.url)));
const woodyEvidence = JSON.parse(readFileSync(new URL('../data/derived/evidence-woody-yields.json', import.meta.url)));
const canonical = JSON.parse(readFileSync(new URL('../outputs/summary.json', import.meta.url)));

test('building floor area and envelope load aggregate monotonically', () => {
  const one = calculateBuildingHeatingDemand({floor_area_m2: 65.6, archetype: 'arc_yurt', insulation: 'good'});
  const two = calculateBuildingHeatingDemand({floor_area_m2: 131.2, archetype: 'arc_yurt', insulation: 'good'});
  const basic = calculateBuildingHeatingDemand({floor_area_m2: 65.6, archetype: 'arc_yurt', insulation: 'basic'});
  assert.ok(two.heat_loss.annual_useful_space_heating_gj > one.heat_loss.annual_useful_space_heating_gj);
  assert.ok(two.wood.gross_wood_energy_required_gj > one.wood.gross_wood_energy_required_gj);
  assert.ok(basic.heat_loss.annual_useful_space_heating_gj > one.heat_loss.annual_useful_space_heating_gj);
  assert.equal(one.assumptions.wall_rsi, 3.52);
});

test('multiple buildings sum useful heat and woody energy', () => {
  const one = calculateHeatingLoads({buildings: [{floor_area_m2: 65.6, archetype: 'arc_yurt', insulation: 'good'}]});
  const two = calculateHeatingLoads({buildings: [{floor_area_m2: 65.6, archetype: 'arc_yurt', insulation: 'good'}, {floor_area_m2: 65.6, archetype: 'arc_yurt', insulation: 'good'}]});
  assert.equal(two.buildings.length, 2);
  assert.ok(two.total_useful_heat_gj_year > one.total_useful_heat_gj_year);
  assert.ok(Math.abs(two.total_useful_heat_gj_year - one.total_useful_heat_gj_year * 2) < 1e-9);
});

test('building loads propagate into interactive woody hectares and total land', () => {
  const member = calculateHealthCanadaEER({id: 'adult', label: 'Adult', age_y: 35, sex: 'male', weight_kg: 75, height_cm: 178, activity: 'low'});
  const mature = canonical.canonical.mature_food_system.canonical_rows.find((row) => row.site === 'ordinary_mesic' && row.household === 'one_adult' && row.module === 'plants_only');
  const one = calculateInteractiveHousehold({members: [{...member, labour_level: 'moderate'}], buildings: [{floor_area_m2: 65.6, archetype: 'arc_yurt', insulation: 'good'}], foodEvidence, woodyCases: woodyEvidence.cases, matureReferenceRow: mature});
  const two = calculateInteractiveHousehold({members: [{...member, labour_level: 'moderate'}], buildings: [{floor_area_m2: 65.6, archetype: 'arc_yurt', insulation: 'good'}, {floor_area_m2: 65.6, archetype: 'arc_yurt', insulation: 'good'}], foodEvidence, woodyCases: woodyEvidence.cases, matureReferenceRow: mature});
  assert.ok(two.heating_area_ha > one.heating_area_ha);
  assert.ok(two.robust_minimum_area_ha > one.robust_minimum_area_ha);
});

test('food demand and assigned labour capacity are independent', () => {
  const profile = calculateHealthCanadaEER({id: 'adult', label: 'Adult', age_y: 35, sex: 'male', weight_kg: 75, height_cm: 178, activity: 'low', labour_level: 'dependent'});
  const mature = canonical.canonical.mature_food_system.canonical_rows.find((row) => row.site === 'ordinary_mesic' && row.household === 'one_adult' && row.module === 'plants_only');
  const noWork = calculateInteractiveHousehold({members: [{...profile, labour_level: 'dependent'}], foodEvidence, woodyCases: woodyEvidence.cases, matureReferenceRow: mature});
  const fullWork = calculateInteractiveHousehold({members: [{...profile, labour_level: 'full'}], foodEvidence, woodyCases: woodyEvidence.cases, matureReferenceRow: mature});
  assert.equal(noWork.household_food_gj_year, fullWork.household_food_gj_year);
  assert.ok(fullWork.labour.available_hours_year > noWork.labour.available_hours_year);
  assert.ok(fullWork.labour.available_heavy_hours_year > noWork.labour.available_heavy_hours_year);
});

test('person visual metrics respond to height, weight and age category without changing food equations', () => {
  const adult = calculatePersonVisualMetrics({age_y: 35, height_cm: 178, weight_kg: 75});
  const child = calculatePersonVisualMetrics({age_y: 8, height_cm: 130, weight_kg: 28});
  const heavier = calculatePersonVisualMetrics({age_y: 35, height_cm: 178, weight_kg: 100});
  assert.equal(adult.age_category, 'adult');
  assert.equal(child.age_category, 'child');
  assert.ok(child.height_scale < adult.height_scale);
  assert.ok(heavier.width_scale > adult.width_scale);
});

test('exclusive hectare allocation keeps ecological overlays out of the total', () => {
  const allocation = calculateExclusiveLandAllocation({foodAreaHa: 1, heatingAreaHa: .2, reserveHa: .1});
  assert.equal(allocation.exclusive_total_ha, 1.3);
  assert.deepEqual(allocation.parts.map((part) => part.area_ha), [.25, .75, .2, .1]);
  assert.equal(allocation.ecological_overlays.length, 3);
});
