import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateArcSiteLeaseEconomics, DEFAULT_SITE_LEASE_SCENARIO} from '../src/index.mjs';

function scenario(overrides = {}) {
  return {
    scenario: {
      ...structuredClone(DEFAULT_SITE_LEASE_SCENARIO),
      community: {...structuredClone(DEFAULT_SITE_LEASE_SCENARIO.community), household_count: 1, ...(overrides.community ?? {})},
      household: {...structuredClone(DEFAULT_SITE_LEASE_SCENARIO.household), ...(overrides.household ?? {})},
      land: {...structuredClone(DEFAULT_SITE_LEASE_SCENARIO.land), ...(overrides.land ?? {})},
      dwelling: {...structuredClone(DEFAULT_SITE_LEASE_SCENARIO.dwelling), ...(overrides.dwelling ?? {})},
      infrastructure: {...structuredClone(DEFAULT_SITE_LEASE_SCENARIO.infrastructure), ...(overrides.infrastructure ?? {})},
      ...overrides
    }
  };
}

test('resident land is never included in dwelling finance principal', () => {
  const result = calculateArcSiteLeaseEconomics(scenario());
  const household = result.households[0];
  assert.equal(household.dwelling.financing.capital_value_cad, 125000);
  assert.equal(household.dwelling.financing.financed_principal_cad, 112500);
  assert.equal(result.project_land.financing.capital_value_cad, result.project_land.total_land_value_cad);
  assert.notEqual(household.dwelling.financing.capital_value_cad, result.project_land.total_land_value_cad);
});

test('increasing calculated productive hectares increases the land lease component', () => {
  const ordinary = calculateArcSiteLeaseEconomics(scenario({site_id: 'ordinary_mesic'}));
  const marginal = calculateArcSiteLeaseEconomics(scenario({site_id: 'shallow_rocky_marginal'}));
  assert.ok(marginal.households[0].calculated_productive_land_ha > ordinary.households[0].calculated_productive_land_ha);
  assert.ok(marginal.households[0].site_lease.monthly_total_cad > ordinary.households[0].site_lease.monthly_total_cad);
});

test('increasing land price increases lease cost without changing biological hectares', () => {
  const low = calculateArcSiteLeaseEconomics(scenario({land: {price_cad_per_ha: 20000}}));
  const high = calculateArcSiteLeaseEconomics(scenario({land: {price_cad_per_ha: 60000}}));
  assert.equal(low.households[0].calculated_productive_land_ha, high.households[0].calculated_productive_land_ha);
  assert.ok(high.households[0].site_lease.monthly_total_cad > low.households[0].site_lease.monthly_total_cad);
});

test('financed land costs more monthly than debt-free land', () => {
  const financed = calculateArcSiteLeaseEconomics(scenario({land: {ownership: 'financed'}}));
  const outright = calculateArcSiteLeaseEconomics(scenario({land: {ownership: 'owned_out_right', recovery_mode: 'none'}}));
  assert.ok(financed.project_land.financing.monthly_debt_service_cad > 0);
  assert.equal(outright.project_land.financing.monthly_debt_service_cad, 0);
  assert.ok(financed.households[0].site_lease.monthly_total_cad > outright.households[0].site_lease.monthly_total_cad);
});

test('shared fixed infrastructure cost per household falls as the project grows', () => {
  const small = calculateArcSiteLeaseEconomics({scenario: {...structuredClone(DEFAULT_SITE_LEASE_SCENARIO), community: {...structuredClone(DEFAULT_SITE_LEASE_SCENARIO.community), household_count: 12}}});
  const large = calculateArcSiteLeaseEconomics({scenario: {...structuredClone(DEFAULT_SITE_LEASE_SCENARIO), community: {...structuredClone(DEFAULT_SITE_LEASE_SCENARIO.community), household_count: 25}}});
  assert.ok(large.households[0].shared_infrastructure_service.monthly_cad < small.households[0].shared_infrastructure_service.monthly_cad);
});

test('land and shared-service charges remain separate resident components', () => {
  const result = calculateArcSiteLeaseEconomics(scenario());
  const household = result.households[0];
  assert.ok(household.site_lease.monthly_total_cad > 0);
  assert.ok(household.shared_infrastructure_service.monthly_cad > 0);
  assert.notEqual(household.site_lease.monthly_total_cad, household.shared_infrastructure_service.monthly_cad);
  assert.ok(Math.abs(household.total_recurring_monthly_cost_cad - Object.values(household.recurring_monthly_cost_cad).reduce((sum, value) => sum + value, 0)) < 0.01);
});

test('project income equals required cost recovery in the central break-even case', () => {
  const result = calculateArcSiteLeaseEconomics(scenario({community: {household_count: 16}}));
  assert.equal(result.project.break_even.status, 'break_even_or_surplus');
  assert.ok(Math.abs(result.project.annual_revenue_cad.total - result.project.annual_costs_cad.total) < 0.1);
});

test('site allocation flows from canonical carrying capacity without a second hectare coefficient', () => {
  const result = calculateArcSiteLeaseEconomics(scenario({community: {household_count: 1}}));
  const household = result.households[0];
  assert.equal(household.calculated_productive_land_ha, household.physical_carrying_capacity.establishment_land_requirement_ha);
  assert.ok(household.physical_carrying_capacity.heating_area_ha > 0);
  assert.equal(result.physical_inputs.total_property_area_ha, Number((household.calculated_productive_land_ha + result.scenario.common_area_ha).toFixed(6)));
});
