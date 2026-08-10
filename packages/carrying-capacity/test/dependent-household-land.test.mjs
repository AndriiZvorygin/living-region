import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateInteractiveHousehold, calculateHouseholdFoodDemandProfile, calculateHealthCanadaEER} from '../src/index.mjs';

const contract = JSON.parse(readFileSync(new URL('../../education-web/public/generated/carrying-capacity/presentation.json', import.meta.url)));
const model = contract.establishment.site_models.ordinary_mesic;
const foodEvidence = contract.food_energy_evidence;
const woodyCases = contract.woody_yields.cases;
const matureReferenceRow = contract.mature_rows.find((row) => row.site === 'ordinary_mesic' && row.household === 'two_adults');

function adult(id, sex = 'male') {
  return {...calculateHealthCanadaEER({id, label: id, age_y: 35, sex, weight_kg: sex === 'male' ? 75 : 65, height_cm: sex === 'male' ? 178 : 165, activity: 'low'}), labour_level: 'moderate'};
}

function child(id = 'child', age_y = 8) {
  return {...calculateHealthCanadaEER({id, label: id, age_y, sex: 'female', weight_kg: 28, height_cm: 130, activity: 'low'}), labour_level: 'dependent'};
}

function run(members, arcPolicyAllocationHa = null) {
  return calculateInteractiveHousehold({members, buildings: [contract.heating.default_building], siteId: 'ordinary_mesic', foodEvidence, woodyCases, matureReferenceRow, establishmentModel: model, arcPolicyAllocationHa});
}

test('dependent children share pooled food and do not enlarge the permanent perennial footprint', () => {
  const adults = [adult('adult-1', 'female'), adult('adult-2')];
  const twoAdults = run(adults);
  const oneChild = run([...adults, child('child-1', 8)]);
  const twoChildren = run([...adults, child('child-1', 8), {...child('child-2', 14), sex: 'male'}]);
  const adultFootprint = twoAdults.establishment_land.strategy_comparison.progressive_handoff.planted_perennial_footprint_ha;
  assert.equal(oneChild.establishment_land.strategy_comparison.progressive_handoff.planted_perennial_footprint_ha, adultFootprint);
  assert.equal(twoChildren.establishment_land.strategy_comparison.progressive_handoff.planted_perennial_footprint_ha, adultFootprint);
  assert.equal(twoAdults.permanent_adult_food_demand_gj_year, oneChild.permanent_adult_food_demand_gj_year);
  assert.ok(oneChild.dependent_child_food_demand_gj_year > 0);
  assert.ok(twoChildren.dependent_child_food_demand_gj_year > oneChild.dependent_child_food_demand_gj_year);
});

test('dependent calories are pooled across annual and perennial production', () => {
  const result = run([adult('adult-1'), child('child-1', 8)]);
  const row = result.establishment_land.strategy_comparison.progressive_handoff.rows.find((item) => item.year === 5);
  assert.ok(row.perennial_usable_food_gj > 0);
  assert.ok(row.annual_usable_food_gj + row.perennial_usable_food_gj >= row.household_food_demand_gj_year - 1e-9);
  assert.ok(row.dependent_food_supplement_annual_area_ha > 0);
  assert.equal(row.permanent_adult_annual_area_required_ha + row.dependent_food_supplement_annual_area_ha, row.annual_area_ha);
  assert.ok(row.dependent_food_supplement_annual_area_ha < row.annual_area_ha);
});

test('rising pooled perennial output reduces the dependent annual bridge', () => {
  const result = run([adult('adult-1'), child('child-1', 8)]);
  const rows = result.establishment_land.strategy_comparison.progressive_handoff.rows;
  const year1 = rows.find((row) => row.year === 1);
  const year5 = rows.find((row) => row.year === 5);
  assert.ok(year5.perennial_usable_food_gj > year1.perennial_usable_food_gj);
  assert.ok(year5.dependent_food_supplement_annual_area_ha < year1.dependent_food_supplement_annual_area_ha);
  assert.ok(year5.annual_usable_food_gj + year5.perennial_usable_food_gj >= year5.household_food_demand_gj_year - 1e-9);
});

test('dependent demand ages out of the parental parcel on the documented timeline', () => {
  const result = run([adult('adult-1'), child('child-1', 8)]);
  const rows = result.establishment_land.strategy_comparison.progressive_handoff.rows;
  const year10 = rows.find((row) => row.year === 10);
  const year15 = rows.find((row) => row.year === 15);
  const mature = rows.find((row) => row.year === 'mature');
  assert.deepEqual(year10.active_dependent_member_ids, ['child-1']);
  assert.deepEqual(year15.active_dependent_member_ids, []);
  assert.equal(year15.dependent_child_food_demand_gj_year, 0);
  assert.equal(mature.household_food_demand_gj_year, result.permanent_adult_food_demand_gj_year);
  assert.equal(mature.dependent_child_food_demand_gj_year, 0);
});

test('an existing adult increases permanent demand while a child does not', () => {
  const oneAdult = run([adult('adult-1')]);
  const adultPlusChild = run([adult('adult-1'), child('child-1')]);
  const twoAdults = run([adult('adult-1'), adult('adult-2')]);
  const adultFootprint = oneAdult.establishment_land.strategy_comparison.progressive_handoff.planted_perennial_footprint_ha;
  assert.equal(adultPlusChild.establishment_land.strategy_comparison.progressive_handoff.planted_perennial_footprint_ha, adultFootprint);
  assert.ok(twoAdults.permanent_adult_food_demand_gj_year > oneAdult.permanent_adult_food_demand_gj_year);
  assert.ok(twoAdults.establishment_land.strategy_comparison.progressive_handoff.planted_perennial_footprint_ha > adultFootprint);
});

test('ARC allocation remains a comparison only', () => {
  const members = [adult('adult-1'), child('child-1')];
  const lower = run(members, 1);
  const higher = run(members, 2);
  const lowerLand = lower.establishment_land.strategy_comparison.progressive_handoff;
  const higherLand = higher.establishment_land.strategy_comparison.progressive_handoff;
  assert.equal(lowerLand.planted_perennial_footprint_ha, higherLand.planted_perennial_footprint_ha);
  assert.equal(lowerLand.establishment_land_requirement_ha, higherLand.establishment_land_requirement_ha);
  assert.notEqual(lowerLand.arc_policy_allocation_ha, higherLand.arc_policy_allocation_ha);
});

test('land roles are explicit and default from age without using labour capacity', () => {
  const profile = calculateHouseholdFoodDemandProfile([{id: 'adult', age_y: 18, sex: 'female', weight_kg: 65, height_cm: 165, activity: 'low', labour_level: 'dependent'}, {id: 'child', age_y: 8, sex: 'female', weight_kg: 28, height_cm: 130, activity: 'low', labour_level: 'full'}]);
  assert.deepEqual(profile.members.map((member) => member.land_role), ['permanent_adult', 'dependent_child']);
  assert.equal(profile.permanent_adult_count, 1);
  assert.equal(profile.dependent_child_count, 1);
  assert.equal(profile.adult_transition_age, 18);
});

test('generated presentation contract exposes the pooled adult/dependent land accounting', () => {
  const row = contract.transition_rows.find((item) => item.site === 'ordinary_mesic' && item.household === 'two_adults_plus_two_children');
  assert.equal(row.permanent_adult_food_demand_gj_year, contract.transition_rows.find((item) => item.site === 'ordinary_mesic' && item.household === 'two_adults').permanent_adult_food_demand_gj_year);
  assert.ok(row.dependent_child_food_demand_gj_year > 0);
  assert.equal(row.adult_transition_age, 18);
  assert.match(row.year_convention, /Year 1/);
  assert.match(contract.establishment.pooled_food_rule, /pooled outputs/);
});
