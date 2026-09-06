import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildArcDwellingAffordabilityIntegration,
  calculateHouseCost,
  calculateYurtGeometry,
  buildHouseCostPresentationContract
} from '../src/index.mjs';

test('reference yurt uses full precision geometry and sloping roof area', () => {
  const geometry = calculateYurtGeometry({diameter_m: 9.144, roof_pitch_degrees: 30});
  assert.ok(Math.abs(geometry.footprint_m2 - 65.6693) < 0.001);
  assert.ok(geometry.roof_sloping_area_m2 > geometry.footprint_m2);
  assert.equal(geometry.inputs.diameter_m, 9.144);
});

test('usable floor area shows stair, partition and headroom deductions', () => {
  const single = calculateYurtGeometry({diameter_m: 9.144, layout: 'single_storey'});
  const loft = calculateYurtGeometry({diameter_m: 9.144, layout: 'partial_loft'});
  assert.equal(single.area_deductions_m2.stair_opening, 0);
  assert.ok(single.usable_floor_area_m2 < single.gross_floor_area_m2);
  assert.ok(loft.gross_floor_area_m2 > single.gross_floor_area_m2);
  assert.ok(loft.area_deductions_m2.total > single.area_deductions_m2.total);
  assert.ok(loft.usable_floor_area_m2 > single.usable_floor_area_m2);
});

test('reference utility package is included once in resident dwelling capital', () => {
  const result = calculateHouseCost({labourMode: 'owner_builder', band: 'central', servicingMode: 'arc_household_systems'});
  const water = result.components.find((row) => row.id === 'water_plumbing_sanitation');
  const hotWater = result.components.find((row) => row.id === 'hot_water');
  const electric = result.components.find((row) => row.id === 'household_electrical');
  const permits = result.components.find((row) => row.id === 'permits');
  assert.equal(water.cash_cost_cad, 5940);
  assert.equal(water.package_included_paid_labour_cad, 1200);
  assert.equal(water.package_included_fee_cad, 600);
  assert.equal(hotWater.material_cost_cad, 1600);
  assert.equal(hotWater.package_included_paid_labour_cad, 400);
  assert.equal(electric.material_cost_cad, 2600);
  assert.equal(electric.package_included_paid_labour_cad, 700);
  assert.equal(electric.package_included_fee_cad, 100);
  assert.equal(permits.cash_cost_cad, 400);
  assert.equal(permits.package_fee_offset_cad, 600);
  assert.equal(result.accounting.utility_single_home, true);
});

test('servicing alternatives change the correct dwelling components only', () => {
  const arc = calculateHouseCost({servicingMode: 'arc_household_systems'});
  const generic = calculateHouseCost({servicingMode: 'generic_well_septic_grid'});
  const centralized = calculateHouseCost({servicingMode: 'centralized_shared_services'});
  assert.ok(generic.totals.completed_dwelling_capital_cad > arc.totals.completed_dwelling_capital_cad);
  assert.equal(centralized.components.find((row) => row.id === 'water_plumbing_sanitation').material_cost_cad, 0);
  assert.equal(centralized.components.find((row) => row.id === 'household_electrical').material_cost_cad, 0);
  assert.equal(centralized.servicing.shared_infrastructure_additions.centralized_water, 'quote required');
});

test('component cash rows plus tax and contingency reconcile at full precision', () => {
  const result = calculateHouseCost({labourMode: 'mixed_labour'});
  assert.equal(result.accounting.component_sum_check, true);
  assert.equal(result.accounting.component_rows_plus_additional_cad, result.totals.upfront_cash_required_cad);
  assert.equal(result.stages.completed_dwelling.cash_cost_cad, result.totals.upfront_cash_required_cad);
});

test('owner-builder, mixed and contractor labour remain separately visible', () => {
  const owner = calculateHouseCost({labourMode: 'owner_builder'});
  const mixed = calculateHouseCost({labourMode: 'mixed_labour'});
  const contractor = calculateHouseCost({labourMode: 'contractor_built'});
  assert.ok(owner.labour.paid_hours > 0, 'professional and approval work remains paid');
  assert.ok(owner.labour.owner_hours > 0);
  assert.ok(mixed.labour.paid_hours > 0 && mixed.labour.owner_hours > 0);
  assert.equal(contractor.labour.owner_hours, 0);
  assert.equal(contractor.labour.paid_hours, contractor.labour.total_labour_hours);
  assert.ok(owner.totals.upfront_cash_required_cad < contractor.totals.upfront_cash_required_cad);
});

test('zero-interest dwelling financing is principal divided by payment months', () => {
  const result = calculateHouseCost({financing: {ownership: 'financed', downPaymentRate: 0.2, interestRateAnnual: 0, amortizationYears: 25}});
  const expected = (result.totals.upfront_cash_required_cad * 0.8) / 300;
  assert.ok(Math.abs(result.financing.monthly_debt_service_cad - expected) < 0.02);
});

test('inclusive package labour overrides replace the included allowance rather than stacking', () => {
  const baseline = calculateHouseCost({labourMode: 'contractor_built', labourRateCadPerHour: 45});
  const override = calculateHouseCost({labourMode: 'contractor_built', labourRateCadPerHour: 60});
  const packageRows = baseline.components.filter((row) => row.package_id);
  assert.equal(packageRows.reduce((sum, row) => sum + row.cash_cost_cad, 0), 11240);
  assert.ok(Math.abs(packageRows.reduce((sum, row) => sum + row.labour_hours_total, 0) - 51.112) < .0001);
  const packageDelta = override.components.filter((row) => row.package_id).reduce((sum, row) => sum + row.cash_cost_cad, 0)
    - packageRows.reduce((sum, row) => sum + row.cash_cost_cad, 0);
  assert.ok(packageDelta > 760 && packageDelta < 770);
  assert.ok(override.components.find((row) => row.id === 'water_plumbing_sanitation').package_labour_override_delta_cad > 0);
});

test('cash, owner value and financing contribution have distinct accounting boundaries', () => {
  const result = calculateHouseCost({labourMode: 'mixed_labour'});
  assert.equal(result.totals.cash_plus_owner_labour_equals_economic, true);
  assert.equal(result.totals.construction_cash_expenditure_cad, result.totals.direct_cash_before_tax_cad);
  assert.equal(result.totals.initial_cash_contribution_cad, Math.round(result.totals.upfront_cash_required_cad * .1 * 100) / 100);
  assert.equal(result.totals.financed_principal_cad, result.financing.financed_principal_cad);
  assert.equal(result.totals.completed_dwelling_capital_cad, 102382);
});

test('legacy bridge exposes the correction from the former 108247.21 economic result', () => {
  const result = calculateHouseCost({labourMode: 'mixed_labour'});
  const bridge = result.legacy_reconciliation.bridge;
  assert.equal(bridge.former_model_economic_capital_cad, 108247.209692);
  assert.ok(Math.abs(bridge.total_delta_cad + 5865.209692) < .01);
  assert.equal(result.legacy_reconciliation.bridge_rows.length, 4);
});

test('signed quote and benchmark deltas remain signed and thresholded overrides are not multiplied twice', () => {
  const quote = calculateHouseCost({customCompletedQuoteCad: 61000});
  assert.ok(quote.totals.quote_delta_unallocated_cad < 0);
  assert.ok(quote.legacy_reconciliation.delta_from_legacy_central_cad > 0);
  const thresholded = calculateHouseCost({design: {diameter_m: 9.3}});
  const frame = thresholded.components.find((row) => row.id === 'frame');
  const overridden = calculateHouseCost({design: {diameter_m: 9.3}, unitRateOverrides: {frame: frame.base_unit_rate_cad}});
  assert.equal(overridden.components.find((row) => row.id === 'frame').base_unit_rate_cad, frame.base_unit_rate_cad);
  assert.equal(overridden.components.find((row) => row.id === 'frame').unit_rate_cad, frame.unit_rate_cad);
});

test('diameter thresholds are discrete and layout costs are explicit', () => {
  const base = calculateHouseCost({design: {diameter_m: 9.144}});
  const larger = calculateHouseCost({design: {diameter_m: 9.2}});
  const veryLarge = calculateHouseCost({design: {diameter_m: 11}});
  const twoStorey = calculateHouseCost({design: {layout: 'full_two_storeys'}});
  assert.equal(base.thresholds.applied.some((row) => row.id === 'large_diameter_9_144'), false);
  assert.equal(larger.thresholds.applied.some((row) => row.id === 'large_diameter_9_144'), true);
  assert.equal(veryLarge.thresholds.applied.some((row) => row.id === 'large_diameter_10_668'), true);
  assert.ok(twoStorey.components.find((row) => row.id === 'upper_floor_structure').active);
  assert.ok(twoStorey.components.find((row) => row.id === 'stairs').material_cost_cad > 0);
});

test('reference diameter has no threshold and storey envelopes/headroom follow geometry', () => {
  const single = calculateHouseCost({design: {diameter_m: 9.144, layout: 'single_storey'}});
  const full = calculateHouseCost({design: {diameter_m: 9.144, layout: 'full_two_storeys'}});
  assert.equal(single.thresholds.applied.some((row) => row.id === 'large_diameter_9_144'), false);
  assert.equal(single.geometry.total_wall_height_m, 2.4);
  assert.equal(full.geometry.total_wall_height_m, 4.8);
  assert.equal(full.geometry.upper_floor_elevation_m, 2.4);
  assert.equal(full.geometry.area_deductions_m2.restricted_headroom, 0);
});

test('custom completed quote overrides only the financing headline and stays auditable', () => {
  const result = calculateHouseCost({customCompletedQuoteCad: 61000});
  assert.equal(result.totals.custom_quote_applied, true);
  assert.equal(result.financing.capital_value_cad, 61000);
  assert.notEqual(result.totals.upfront_cash_required_cad, 61000);
  assert.equal(result.totals.quote_delta_unallocated_cad, Math.round((61000 - result.totals.completed_dwelling_capital_cad) * 100) / 100);
});

test('ARC integration keeps dwelling finance separate from land and infrastructure', () => {
  const house = calculateHouseCost();
  const integrated = buildArcDwellingAffordabilityIntegration({houseCost: house, landAndInfrastructureMonthlyCad: 268.22});
  assert.equal(integrated.dwelling_capital_cad, house.totals.completed_dwelling_capital_cad);
  assert.equal(integrated.land_and_shared_infrastructure_monthly_cad, 268.22);
  assert.equal(integrated.combined_monthly_cad, Math.round((house.financing.monthly_debt_service_cad + 268.22) * 100) / 100);
});

test('presentation contract includes diameter and layout sensitivity', () => {
  const contract = buildHouseCostPresentationContract();
  assert.equal(contract.contract_version, '2.0.0');
  assert.ok(contract.service_package_accounting.arc_household_systems.water_plumbing_sanitation);
  assert.ok(contract.central.legacy_reconciliation.bridge);
  assert.ok(contract.diameter_sensitivity.length >= 5);
  assert.equal(contract.layout_comparison.length, 3);
  assert.ok(contract.sources.length >= 5);
});
