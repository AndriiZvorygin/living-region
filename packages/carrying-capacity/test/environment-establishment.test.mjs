import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateFoodEvidence} from '../scripts/calc-evidence-food.mjs';
import {calculatePerennialEvidence} from '../scripts/calc-food-forest-transition.mjs';
import {calculateEstablishmentLandRequirement} from '../src/establishment.mjs';
import {owenSoundGrowingEnvironment, siteCapabilityDefinitions, selectPerennialMixForSite} from '../src/environment.mjs';
import {calculateFoodSystem, siteClasses} from '../src/core.mjs';

const years = [1, 2, 3, 5, 8, 10, 15, 'mature'];
const overlap = {1: .75, 2: .75, 3: .60, 5: .40, 8: .15, 10: .05, 15: 0, mature: 0};

function model(siteId = 'ordinary_mesic') {
  const food = calculateFoodEvidence();
  const perennial = calculatePerennialEvidence();
  const annual = calculateFoodSystem(food, 10, siteClasses[siteId]);
  return {annual, perennialMix: selectPerennialMixForSite(perennial.mix, siteId), curveAnchors: perennial.curve_anchors.central};
}

test('Owen Sound environment contract keeps measured climate, soil framework and unresolved solar distinct', () => {
  assert.equal(owenSoundGrowingEnvironment.region.id, 'owen_sound_grey_county');
  assert.equal(owenSoundGrowingEnvironment.climate.growing_degree_days.value_degree_days, 2073.5);
  assert.equal(owenSoundGrowingEnvironment.climate.frost_free_period.average_length_days, 162);
  assert.equal(owenSoundGrowingEnvironment.climate.precipitation.growing_season_mm, 510.7);
  assert.equal(owenSoundGrowingEnvironment.climate.solar.status, 'unresolved');
  assert.equal(owenSoundGrowingEnvironment.soil_framework.local_status, 'framework_only');
  assert.ok(Object.keys(siteCapabilityDefinitions).includes('shallow_rocky_marginal'));
});

test('site capability excludes biologically unsuitable crops instead of scaling every crop', () => {
  const food = calculateFoodEvidence();
  const ordinary = calculateFoodSystem(food, 10, siteClasses.ordinary_mesic);
  const favourable = calculateFoodSystem(food, 10, siteClasses.wetter_productive);
  const marginal = calculateFoodSystem(food, 10, siteClasses.shallow_rocky_marginal);
  assert.ok(ordinary.viable_crop_ids.includes('wheat_low_input_synthesis'));
  assert.equal(favourable.rows.find((row) => row.id === 'potato_low_input_synthesis').site_yield_multiplier, 1.1);
  assert.ok(marginal.excluded_crop_ids.includes('wheat_low_input_synthesis'));
  assert.ok(marginal.excluded_crop_ids.includes('sunflower_low_input_synthesis'));
  assert.ok(marginal.required_food_area_ha > ordinary.required_food_area_ha);
});

test('bare-land establishment plants perennial acreage before it produces food', () => {
  const {annual, perennialMix, curveAnchors} = model();
  const result = calculateEstablishmentLandRequirement({demandGJ: 10, annualYieldGJHaYear: annual.gross_energy_per_ha, perennialMix, curveAnchors, years, annualIntercropOverlap: overlap, heatingAreaHa: .1, exclusiveReserveHa: .12, arcPolicyAllocationHa: 1});
  const yearOne = result.rows.find((row) => row.year === 1);
  const yearTen = result.rows.find((row) => row.year === 10);
  assert.ok(yearOne.planted_perennial_footprint_ha > 0);
  assert.equal(yearOne.perennial_usable_food_gj, 0);
  assert.ok(yearOne.annual_area_ha > yearTen.annual_area_ha);
  assert.equal(yearOne.occupied_food_production_area_ha, yearOne.annual_area_ha + yearOne.planted_perennial_footprint_ha - yearOne.young_forest_annual_intercrop_overlap_ha);
});

test('ARC allocation changes only the comparison, never the biological requirement', () => {
  const {annual, perennialMix, curveAnchors} = model('shallow_rocky_marginal');
  const input = {demandGJ: 10, annualYieldGJHaYear: annual.gross_energy_per_ha, perennialMix, curveAnchors, years, annualIntercropOverlap: overlap, heatingAreaHa: .2, exclusiveReserveHa: .12};
  const narrow = calculateEstablishmentLandRequirement({...input, arcPolicyAllocationHa: .5});
  const broad = calculateEstablishmentLandRequirement({...input, arcPolicyAllocationHa: 2});
  assert.equal(narrow.establishment_land_requirement_ha, broad.establishment_land_requirement_ha);
  assert.equal(narrow.mature_land_requirement_ha, broad.mature_land_requirement_ha);
  assert.equal(narrow.planted_perennial_footprint_ha, broad.planted_perennial_footprint_ha);
  assert.notEqual(narrow.arc_policy_surplus_or_deficit_ha, broad.arc_policy_surplus_or_deficit_ha);
  assert.equal(narrow.biological_requirement_independent_of_arc_policy, true);
});

test('establishment requirement is the peak exclusive footprint and mature acreage is separate', () => {
  const {annual, perennialMix, curveAnchors} = model();
  const result = calculateEstablishmentLandRequirement({demandGJ: 10, annualYieldGJHaYear: annual.gross_energy_per_ha, perennialMix, curveAnchors, years, annualIntercropOverlap: overlap, heatingAreaHa: .2, exclusiveReserveHa: .12});
  assert.equal(result.establishment_land_requirement_ha, Math.max(...result.rows.map((row) => row.total_exclusive_land_requirement_ha)));
  assert.ok(result.establishment_land_requirement_ha >= result.mature_land_requirement_ha);
  assert.ok(result.rows.every((row) => row.total_exclusive_land_requirement_ha >= row.occupied_food_production_area_ha));
});

test('site-specific perennial viability changes the mature system', () => {
  const ordinary = model('ordinary_mesic');
  const marginal = model('shallow_rocky_marginal');
  assert.ok(ordinary.perennialMix.some((row) => row.id.includes('chestnut')));
  assert.ok(!marginal.perennialMix.some((row) => row.id.includes('chestnut')));
  const ordinaryResult = calculateEstablishmentLandRequirement({demandGJ: 10, annualYieldGJHaYear: ordinary.annual.gross_energy_per_ha, perennialMix: ordinary.perennialMix, curveAnchors: ordinary.curveAnchors, years, annualIntercropOverlap: overlap});
  const marginalResult = calculateEstablishmentLandRequirement({demandGJ: 10, annualYieldGJHaYear: marginal.annual.gross_energy_per_ha, perennialMix: marginal.perennialMix, curveAnchors: marginal.curveAnchors, years, annualIntercropOverlap: overlap});
  assert.ok(marginalResult.establishment_land_requirement_ha > ordinaryResult.establishment_land_requirement_ha);
});
