import test from 'node:test';
import assert from 'node:assert/strict';
import {ADMINISTRATION_SCENARIOS, buildSiteLeasePresentationContract, calculateAdministrationBudget, calculateArcSiteLeaseEconomics, calculateCommonPropertyAreaAccounting, calculateCommonPropertyOperations, DEFAULT_SITE_LEASE_SCENARIO, INFRASTRUCTURE_SCENARIOS} from '../src/index.mjs';

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

test('recommended site lease exposes a stable common-property share and a productive land charge', () => {
  const adult = calculateArcSiteLeaseEconomics(scenario({community: {household_count: 1}})).households[0];
  const family = calculateArcSiteLeaseEconomics(scenario({
    community: {household_count: 1},
    household: {members: ['adult_woman', 'adult_man', 'child_girl_8', 'adolescent_boy_14']}
  })).households[0];
  assert.equal(adult.site_lease.common_property_land_holding_share_monthly_cad, family.site_lease.common_property_land_holding_share_monthly_cad);
  assert.equal(adult.site_lease.productive_land_charge_per_hectare_monthly_cad, family.site_lease.productive_land_charge_per_hectare_monthly_cad);
  assert.ok(family.site_lease.productive_land_portion_monthly_cad > adult.site_lease.productive_land_portion_monthly_cad);
});

test('common property is recovered by the common-property layer and not the productive land layer', () => {
  const result = calculateArcSiteLeaseEconomics(scenario({community: {household_count: 12}}));
  const accounting = result.project_land.land_accounting;
  assert.ok(accounting.acquisition.common_land_value_cad > 0);
  assert.ok(accounting.common_property_land_holding.annual_components_cad.common_land_finance_recovery_annual_cad > 0);
  assert.ok(accounting.common_property_land_holding.annual_components_cad.common_property_tax_annual_cad > 0);
  assert.equal(accounting.productive_land_charge.annual_components_cad.common_property_tax_annual_cad, undefined);
  assert.equal(accounting.common_property_land_holding.annual_components_cad.common_vacancy_reserve_annual_cad > 0, true);
  assert.equal(accounting.productive_land_charge.annual_components_cad.productive_vacancy_reserve_annual_cad > 0, true);
  assert.equal(result.project.land_layer_break_even.revenue_equals_required_cost_recovery, true);
});

test('land leases recover the land layer without shared-infrastructure revenue', () => {
  const result = calculateArcSiteLeaseEconomics(scenario({community: {household_count: 16}}));
  const landBreakEven = result.project.land_layer_break_even;
  assert.ok(Math.abs(landBreakEven.site_lease_revenue_cad - landBreakEven.land_layer_cost_cad) < 0.2);
  assert.ok(Math.abs(landBreakEven.site_lease_revenue_cad - result.project.annual_costs_cad.land) < 0.2);
  assert.notEqual(result.project.annual_revenue_cad.shared_services, 0);
});

test('shared infrastructure does not enter the site lease', () => {
  const minimal = calculateArcSiteLeaseEconomics(scenario({infrastructure_scenario_id: 'minimal_compliant', community: {household_count: 12}}));
  const amenity = calculateArcSiteLeaseEconomics(scenario({infrastructure_scenario_id: 'amenity_rich', community: {household_count: 12}}));
  assert.equal(minimal.households[0].site_lease.monthly_total_cad, amenity.households[0].site_lease.monthly_total_cad);
  assert.notEqual(minimal.households[0].shared_infrastructure_service.monthly_cad, amenity.households[0].shared_infrastructure_service.monthly_cad);
});

test('visible household monthly cost stack has no hidden residual', () => {
  const household = calculateArcSiteLeaseEconomics(scenario({community: {household_count: 12}})).households[0];
  const stack = household.monthly_cost_stack;
  const explicit = stack.dwelling_financing_monthly_cad + stack.site_lease_monthly_cad + stack.shared_infrastructure_monthly_cad + stack.dwelling_maintenance_replacement_monthly_cad + stack.household_utilities_maintenance_monthly_cad;
  assert.equal(stack.residual_monthly_cad, 0);
  assert.equal(stack.visible_component_total_monthly_cad, stack.total_monthly_cad);
  assert.ok(Math.abs(explicit - stack.total_monthly_cad) < 0.02);
});

test('presentation contract includes household-first land accounting inputs and examples', () => {
  const contract = buildSiteLeasePresentationContract();
  assert.equal(contract.default_inputs.common_property_land_ha, 1.5);
  assert.equal(contract.default_inputs.land_financing.interest_rate_annual, .06);
  assert.ok(contract.household_examples.one_adult_ordinary.land_infrastructure.site_lease_monthly_cad > 0);
  assert.equal(contract.household_examples.one_adult_ordinary.land_infrastructure.combined_monthly_cad, Number((contract.household_examples.one_adult_ordinary.site_lease.monthly_total_cad + contract.household_examples.one_adult_ordinary.shared_infrastructure_service.monthly_cad).toFixed(2)));
  assert.equal(contract.default_inputs.dwelling_capital_cost_cad, undefined);
  assert.equal(contract.default_inputs.dwelling_financing, undefined);
  assert.equal(contract.default_inputs.dwelling_costs, undefined);
  assert.equal(contract.evidence.dwelling_capital_cost, undefined);
  assert.equal(contract.default_inputs.land_costs?.administration_scenario_id, 'conventional');
  assert.equal(contract.administration_scale_examples.conventional[0].monthly_per_household_cad, 125);
  assert.equal(contract.administration_scale_examples.conventional[3].monthly_per_household_cad, 60.4);
  assert.equal(contract.common_area_accounting.mode, 'pooled_planning_assumption');
  assert.equal(contract.common_area_accounting.spatial_pipeline_status, 'not_connected_to_current_ARC_economics');
});

test('public ARC charge is exactly site lease plus shared infrastructure', () => {
  const result = calculateArcSiteLeaseEconomics(scenario({community: {household_count: 12}}));
  const household = result.households[0];
  assert.equal(household.land_infrastructure.combined_monthly_cad, Number((household.site_lease.monthly_total_cad + household.shared_infrastructure_service.monthly_cad).toFixed(2)));
  assert.equal(result.project.land_layer_break_even.revenue_equals_required_cost_recovery, true);
  assert.equal(result.project.infrastructure_layer_break_even.revenue_equals_required_cost_recovery, true);
});

test('dwelling and household expense inputs cannot alter the public land-infrastructure charge', () => {
  const base = calculateArcSiteLeaseEconomics(scenario({community: {household_count: 12}}));
  const altered = calculateArcSiteLeaseEconomics(scenario({
    community: {household_count: 12},
    dwelling: {capital_cost_cad: 999999, down_payment_rate: 0, interest_rate_annual: .2, maintenance_replacement_rate_annual: .5, household_utilities_annual_cad: 99999}
  }));
  assert.equal(base.households[0].land_infrastructure.combined_monthly_cad, altered.households[0].land_infrastructure.combined_monthly_cad);
});

test('site lease decomposition exposes debt, equity, tax, overhead and reserves without double recovery', () => {
  const result = calculateArcSiteLeaseEconomics(scenario({community: {household_count: 12}}));
  const household = result.households[0];
  const common = household.site_lease.common_property_land_holding.monthly_components_cad;
  const productive = household.site_lease.productive_land_charge.monthly_components_cad;
  assert.equal(Number((Object.values(common).reduce((sum, value) => sum + value, 0)).toFixed(2)), household.site_lease.common_property_land_holding_share_monthly_cad);
  assert.equal(Number((Object.values(productive).reduce((sum, value) => sum + value, 0)).toFixed(2)), household.site_lease.productive_land_portion_monthly_cad);
  assert.equal(household.site_lease.financing.equity_recovery_monthly_cad, 0);
  assert.ok(Math.abs(result.project_land.annual_costs_cad.land_finance_recovery - (result.project_land.annual_costs_cad.productive_land_finance_recovery + result.project_land.annual_costs_cad.common_land_finance_recovery)) < 0.01);
  assert.equal(result.project_land.annual_costs_cad.vacancy_reserve, result.project_land.land_accounting.common_property_land_holding.annual_vacancy_allowance_cad + result.project_land.land_accounting.productive_land_charge.annual_vacancy_allowance_cad);
});

test('public contract labels illustrative financing and exposes neutral comparisons', () => {
  const contract = buildSiteLeasePresentationContract();
  assert.equal(contract.land_financing_scenarios.illustrative_current.status, 'illustrative_not_canonical');
  assert.equal(contract.land_financing_scenarios.neutral_land_planning.amortization_years, 25);
  assert.equal(contract.land_financing_evidence.interpretation.loan_term.includes('separate'), true);
  assert.deepEqual(contract.default_inputs.land_financing, {
    ownership: 'financed',
    down_payment_rate: .2,
    interest_rate_annual: .06,
    amortization_years: 30,
    loan_term_years: 5,
    financing_scenario_id: 'illustrative_current',
    evidence_status: 'illustrative_not_canonical'
  });
});

test('administration budget explains the former $125 household charge and scales fixed work', () => {
  const twelve = calculateAdministrationBudget({scenario_id: 'conventional', household_count: 12});
  assert.equal(twelve.annual_total_cad, 18000);
  assert.equal(twelve.monthly_per_household_cad, 125);
  assert.equal(twelve.fixed_project_annual_cad, 9600);
  assert.equal(twelve.variable_household_annual_cad, 5760);
  assert.equal(twelve.event_driven_allowance_annual_cad, 2640);
  const sixteen = calculateAdministrationBudget({scenario_id: 'conventional', household_count: 16});
  const twentyFive = calculateAdministrationBudget({scenario_id: 'conventional', household_count: 25});
  const fifty = calculateAdministrationBudget({scenario_id: 'conventional', household_count: 50});
  assert.deepEqual([sixteen.annual_total_cad, twentyFive.annual_total_cad, fifty.annual_total_cad], [19920, 24240, 36240]);
  assert.ok(fifty.monthly_per_household_cad < sixteen.monthly_per_household_cad);
  assert.equal(Object.keys(ADMINISTRATION_SCENARIOS).sort().join(','), 'conventional,lean_self_managed,software_assisted');
});

test('software-assisted administration remains non-zero and exposes automation scope', () => {
  const budget = calculateAdministrationBudget({scenario_id: 'software_assisted', household_count: 12});
  assert.equal(budget.annual_total_cad, 10080);
  assert.ok(budget.monthly_per_household_cad > 0);
  assert.ok(budget.automation_capabilities.includes('lease billing/accounting'));
  assert.ok(budget.components.some((row) => row.kind === 'event_driven_allowance'));
});

test('common-property operations are decomposed and exclude infrastructure operations', () => {
  const operations = calculateCommonPropertyOperations({scenario_id: 'contracted_baseline'});
  assert.equal(operations.annual_total_cad, 6000);
  assert.equal(operations.components.length, 5);
  assert.ok(operations.components.some((row) => row.id === 'road_edge_drainage_annual_cad'));
  assert.ok(operations.excludes.includes('snow clearing'));
  assert.ok(operations.excludes.includes('infrastructure insurance'));
});

test('common property can move from pooled planning hectares to explicit site-plan areas', () => {
  const pooled = calculateCommonPropertyAreaAccounting({common_area_ha: 1.5, components: {residential_footprints: null}});
  assert.equal(pooled.mode, 'pooled_planning_assumption');
  assert.equal(pooled.total_common_area_ha, 1.5);
  const components = {
    residential_footprints: .12,
    internal_road_access: .38,
    common_buildings_infrastructure: .08,
    ecological_water_buffers: .55,
    shared_productive_areas: .22,
    other_required_common_land: .15
  };
  const explicit = calculateCommonPropertyAreaAccounting({components});
  assert.equal(explicit.mode, 'spatial_or_layout_derived');
  assert.equal(explicit.total_common_area_ha, 1.5);
  const result = calculateArcSiteLeaseEconomics(scenario({community: {common_area_ha: 0, common_area_accounting: {components}}}));
  assert.equal(result.scenario.common_area_ha, 1.5);
  assert.equal(result.physical_inputs.common_area_accounting.mode, 'spatial_or_layout_derived');
});
