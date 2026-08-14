import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSiteLeasePresentationContract, calculateArcSiteLeaseEconomics, DEFAULT_SITE_LEASE_SCENARIO, INFRASTRUCTURE_SCENARIOS} from '../src/index.mjs';

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

test('legacy shared-services charge is reproducible and decomposes to line items', () => {
  const result = calculateArcSiteLeaseEconomics(scenario({infrastructure_scenario_id: 'legacy_current', community: {household_count: 12}}));
  assert.equal(result.infrastructure.capital_value_cad, 1055000);
  assert.equal(result.infrastructure.annual_costs_cad.operating, 75000);
  assert.equal(result.infrastructure.annual_costs_cad.replacement_reserve, 10550);
  assert.equal(result.households[0].shared_infrastructure_service.monthly_cad, 1162.31);
  const lineTotal = result.infrastructure.line_items.reduce((sum, row) => sum + row.annual_total_cad, 0);
  assert.equal(lineTotal, result.infrastructure.annual_costs_cad.total);
  assert.equal(result.infrastructure.line_items.length >= 13, true);
  assert.ok(result.infrastructure.line_items.some((row) => row.id === 'snow_clearing'));
  assert.ok(result.infrastructure.line_items.some((row) => row.id === 'administration'));
});

test('minimal, shared and amenity scenarios remain explicit and ordered by shared cost', () => {
  const results = ['minimal_compliant', 'shared_services', 'amenity_rich'].map((id) => calculateArcSiteLeaseEconomics(scenario({infrastructure_scenario_id: id, community: {household_count: 12}})));
  assert.equal(results[0].scenario.infrastructure_scenario_id, 'minimal_compliant');
  assert.ok(results[0].households[0].shared_infrastructure_service.monthly_cad < results[1].households[0].shared_infrastructure_service.monthly_cad);
  assert.ok(results[1].households[0].shared_infrastructure_service.monthly_cad < results[2].households[0].shared_infrastructure_service.monthly_cad);
  assert.equal(INFRASTRUCTURE_SCENARIOS.minimal_compliant.affordability_default, true);
  assert.equal(results[0].infrastructure.line_items.find((row) => row.id === 'common_building').requiredness, 'convenience/amenity');
});

test('debt service and replacement reserves are separate lifecycle costs', () => {
  const result = calculateArcSiteLeaseEconomics(scenario({infrastructure_scenario_id: 'shared_services', community: {household_count: 12}}));
  const early = result.infrastructure.reserve_sensitivity.find((row) => row.mode === 'early_life');
  const full = result.infrastructure.reserve_sensitivity.find((row) => row.mode === 'full_lifecycle');
  assert.equal(early.reserve_starts_year, 1);
  assert.ok(full.annual_reserve_cad > early.annual_reserve_cad);
  assert.ok(Math.abs(result.infrastructure.annual_costs_cad.capital_debt_service - result.infrastructure.financing.monthly_debt_service_cad * 12) < 0.2);
  assert.notEqual(result.infrastructure.annual_costs_cad.capital_debt_service, result.infrastructure.annual_costs_cad.replacement_reserve);
});

test('distributed alternatives are reported without being added to central shared charges', () => {
  const result = calculateArcSiteLeaseEconomics(scenario({infrastructure_scenario_id: 'minimal_compliant', community: {household_count: 12}}));
  const water = result.infrastructure.distributed_alternatives.comparisons.find((row) => row.component_id === 'shared_water');
  assert.ok(water.distributed_capital_total_cad > 0);
  assert.ok(water.distributed_annual_per_household_cad > 0);
  assert.equal(result.households[0].shared_infrastructure_service.monthly_cad, result.infrastructure.service_charge_per_household_month_cad);
  assert.equal(result.households[0].recurring_monthly_cost_cad.household_utilities_maintenance_monthly_cad, 150);
});

test('heterogeneous household site allocations use calculated reserved hectares', () => {
  const base = structuredClone(DEFAULT_SITE_LEASE_SCENARIO);
  const result = calculateArcSiteLeaseEconomics({scenario: {
    ...base,
    community: {
      ...base.community,
      household_count: undefined,
      households: [
        {...base.household, household_id: 'adult', members: ['adult_man']},
        {...base.household, household_id: 'family', members: ['adult_woman', 'adult_man', 'child_girl_8', 'adolescent_boy_14']}
      ]
    }
  }});
  assert.ok(result.households[1].reserved_productive_land_ha > result.households[0].reserved_productive_land_ha);
  assert.ok(result.households[1].site_lease.monthly_total_cad > result.households[0].site_lease.monthly_total_cad);
});

test('land reservation basis is explicit and policy allocation cannot alter biological hectares', () => {
  const biological = calculateArcSiteLeaseEconomics(scenario({arc_policy_allocation_ha: 1, community: {household_count: 1}}));
  const alternatePolicy = calculateArcSiteLeaseEconomics(scenario({arc_policy_allocation_ha: 2, community: {household_count: 1}}));
  assert.equal(biological.scenario.land_reservation_basis, 'maximum_transition_exclusive_footprint');
  assert.equal(biological.households[0].reserved_productive_land_ha, alternatePolicy.households[0].reserved_productive_land_ha);
});

test('site-lease presentation contract exposes auditable infrastructure scenarios and scale outputs', () => {
  const contract = buildSiteLeasePresentationContract();
  assert.equal(contract.recommended_infrastructure_scenario, 'minimal_compliant');
  assert.deepEqual(contract.infrastructure_scenarios.map((row) => row.id), Object.keys(INFRASTRUCTURE_SCENARIOS));
  assert.equal(contract.infrastructure_scale_examples.shared_services.length, 4);
  assert.equal(contract.infrastructure_scale_examples.shared_services[0].household_count, 12);
  assert.ok(contract.infrastructure_scale_examples.shared_services[0].shared_services_monthly_per_household_cad > contract.infrastructure_scale_examples.shared_services[3].shared_services_monthly_per_household_cad);
});

test('land reservation basis changes the reserved project area without changing biological transition outputs', () => {
  const peak = calculateArcSiteLeaseEconomics(scenario({land_reservation_basis: 'maximum_transition_exclusive_footprint'}));
  const mature = calculateArcSiteLeaseEconomics(scenario({land_reservation_basis: 'mature_requirement'}));
  assert.equal(peak.households[0].canonical_establishment_peak_land_requirement_ha, mature.households[0].canonical_establishment_peak_land_requirement_ha);
  assert.ok(peak.households[0].reserved_productive_land_ha >= mature.households[0].reserved_productive_land_ha);
  assert.ok(peak.project_land.total_property_area_ha >= mature.project_land.total_property_area_ha);
});
