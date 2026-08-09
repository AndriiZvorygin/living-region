import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAnnualFoodBridge,
  calculateDwellingHeatingDemand,
  calculateHealthCanadaHouseholdFoodEnergyDemand,
  calculateMultifunctionalLandAccounting,
  calculateRobustMinimumVsOptionalProductiveSurplus,
  calculateWoodyBiomassLandRequirement,
  CARRYING_CAPACITY_CONTRACT_VERSION
} from '../src/index.mjs';

test('public API calculates household food-energy demand by composition', () => {
  const one = calculateHealthCanadaHouseholdFoodEnergyDemand({members: ['adult_woman']});
  const family = calculateHealthCanadaHouseholdFoodEnergyDemand({members: ['adult_woman', 'adult_man', 'child_girl_8', 'adolescent_boy_14']});
  assert.equal(one.contract_version, CARRYING_CAPACITY_CONTRACT_VERSION);
  assert.ok(family.household_energy_gj_year > one.household_energy_gj_year);
});

test('public API exposes annual bridge, heating and woody land calculations', () => {
  const bridge = calculateAnnualFoodBridge({demandGJ: 10, site: 'ordinary_mesic'});
  const heating = calculateDwellingHeatingDemand();
  const woody = calculateWoodyBiomassLandRequirement({heating});
  assert.ok(bridge.required_food_area_ha > 0);
  assert.ok(heating.heat_loss.annual_useful_space_heating_gj > 0);
  assert.ok(woody.cases.central.ordinary.required_woody_area_ha > 0);
});

test('multifunctional accounting separates robust minimum from optional surplus', () => {
  const accounting = calculateMultifunctionalLandAccounting({foodAreaHa: 1, heatingAreaHa: 0.2});
  const surplus = calculateRobustMinimumVsOptionalProductiveSurplus({robustMinimumHa: accounting.robust_minimum_area_ha, allocatedHa: 2, optionalTargetHa: 0.2});
  assert.ok(accounting.resilience_allowance_total_ha > 0);
  assert.ok(Math.abs(surplus.minimum_surplus_or_deficit_ha - 0.3) < 1e-9);
  assert.equal(surplus.optional_target_fully_met, true);
});
