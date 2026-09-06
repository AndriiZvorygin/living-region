import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildArcDwellingAffordabilityIntegration,
  buildHouseCostPresentationContract,
  calculateHouseCost,
  calculateYurtGeometry
} from '../src/index.mjs';

test('reference yurt uses full precision geometry and sloping roof area', () => {
  const geometry = calculateYurtGeometry({diameter_m: 9.144, roof_pitch_degrees: 30});
  assert.ok(Math.abs(geometry.footprint_m2 - 65.6693) < 0.001);
  assert.ok(geometry.roof_sloping_area_m2 > geometry.footprint_m2);
  assert.equal(geometry.inputs.diameter_m, 9.144);
});

test('usable floor area shows layout deductions and full-storey envelope', () => {
  const single = calculateYurtGeometry({diameter_m: 9.144, layout: 'single_storey'});
  const loft = calculateYurtGeometry({diameter_m: 9.144, layout: 'partial_loft'});
  const full = calculateYurtGeometry({diameter_m: 9.144, layout: 'full_two_storeys'});
  assert.equal(single.area_deductions_m2.stair_opening, 0);
  assert.ok(single.usable_floor_area_m2 < single.gross_floor_area_m2);
  assert.ok(loft.gross_floor_area_m2 > single.gross_floor_area_m2);
  assert.ok(loft.area_deductions_m2.total > single.area_deductions_m2.total);
  assert.ok(full.total_wall_height_m > single.total_wall_height_m);
});

test('published supplier package is the first pricing input', () => {
  const result = calculateHouseCost({band: 'central'});
  assert.equal(result.contract_version, '3.0.0');
  assert.equal(result.supplier_package.id, 'yc_30_base_installed');
  assert.equal(result.supplier_package.selected_price_cad, 36404);
  assert.equal(result.supplier_package.price_basis, 'installed');
  assert.match(result.supplier_package.source_url, /yurts-canada\.ca/);
  assert.equal(result.supplier_package.inclusion_matrix.platform, 'excluded');
  assert.equal(result.supplier_package.inclusion_matrix.utilities, 'excluded');
  assert.equal(result.accounting.no_historical_input_used, true);
});

test('priced supplier selection remains available without using the historical ARC total', () => {
  const result = calculateHouseCost({yurtSupplierId: 'the_out_factory'});
  assert.equal(result.supplier_package.source.id, 'the_out_factory');
  assert.equal(result.supplier_package.selection_method, 'linear_interpolation_between_published_sizes');
  assert.equal(result.accounting.no_historical_input_used, true);
  assert.ok(result.supplier_package.selected_price_cad > 0);
});

test('platform quantities are driven by geometry and reference blocks are not over-counted', () => {
  const result = calculateHouseCost();
  const blocks = result.components.find((row) => row.id === 'platform_support_blocks');
  const decking = result.components.find((row) => row.id === 'platform_decking');
  assert.equal(blocks.quantity, 36);
  assert.ok(decking.quantity >= 24);
  assert.ok(blocks.source_url);
  assert.ok(result.market_evidence.platform_design.rows.length >= 7);
});

test('itemized utility package counts each household system once', () => {
  const result = calculateHouseCost({servicingMode: 'arc_household_systems'});
  const utilityRows = result.components.filter((row) => String(row.package_id).startsWith('utility_'));
  assert.ok(utilityRows.some((row) => row.id === 'water_collection_storage_first_flush'));
  assert.ok(utilityRows.some((row) => row.id === 'pv_400w'));
  assert.ok(utilityRows.some((row) => row.id === 'solar_thermal_collector'));
  assert.equal(utilityRows.filter((row) => row.id === 'qualified_water_installation')[0].material_cost_cad, 0);
  assert.equal(Math.round(utilityRows.reduce((total, row) => total + row.cash_cost_cad, 0) * 100) / 100, 12450.62);
  assert.equal(result.accounting.utility_single_home, true);
  assert.deepEqual(Object.keys(result.servicing.components).sort(), ['arc_household_systems', 'hot_water', 'household_electrical'].sort());
  assert.equal(Math.round(Object.values(result.servicing.components).reduce((total, value) => total + value, 0) * 100) / 100, 12450.62);
});

test('former-model reconciliation sums current itemized utility packages', () => {
  const result = calculateHouseCost({servicingMode: 'arc_household_systems'});
  const rows = Object.fromEntries(result.legacy_reconciliation.bridge_rows.map((row) => [row.component, row]));
  assert.equal(rows['Water / plumbing / sanitation'].new_amount_cad, 6744.62);
  assert.equal(rows['Hot water'].new_amount_cad, 2000);
  assert.equal(rows['Household electrical'].new_amount_cad, 3706);
  assert.equal(rows['General permits'].new_amount_cad, 1000);
  assert.ok(Math.abs(result.legacy_reconciliation.bridge.corrected_economic_capital_cad - result.totals.economic_cost_cad) < 0.005);
  assert.ok(result.legacy_reconciliation.bridge.total_delta_cad < 0);
});

test('servicing alternatives stay in the dwelling layer and use distinct scopes', () => {
  const arc = calculateHouseCost({servicingMode: 'arc_household_systems'});
  const generic = calculateHouseCost({servicingMode: 'generic_well_septic_grid'});
  const centralized = calculateHouseCost({servicingMode: 'centralized_shared_services'});
  assert.ok(generic.totals.upfront_cash_required_cad > arc.totals.upfront_cash_required_cad);
  assert.equal(centralized.components.find((row) => row.id === 'alternative_water_plumbing_sanitation').cash_cost_cad, 0);
  assert.equal(centralized.components.find((row) => row.id === 'alternative_household_electrical').cash_cost_cad, 0);
  assert.equal(centralized.servicing.shared_infrastructure_additions.centralized_water, 'quote required');
  assert.equal(centralized.accounting.utility_single_home, false);
});

test('component cash rows plus tax and contingency reconcile at full precision', () => {
  const result = calculateHouseCost({labourMode: 'mixed_labour'});
  assert.equal(result.accounting.component_sum_check, true);
  assert.equal(result.accounting.component_rows_plus_additional_cad, result.totals.upfront_cash_required_cad);
  assert.equal(result.stages.completed_dwelling.cash_cost_cad, result.totals.upfront_cash_required_cad);
  assert.equal(result.totals.cash_plus_owner_labour_equals_economic, true);
});

test('owner-builder, mixed and contractor labour remain separately visible', () => {
  const owner = calculateHouseCost({labourMode: 'owner_builder'});
  const mixed = calculateHouseCost({labourMode: 'mixed_labour'});
  const contractor = calculateHouseCost({labourMode: 'contractor_built'});
  assert.ok(owner.labour.paid_hours > 0);
  assert.ok(owner.labour.owner_hours > 0);
  assert.ok(mixed.labour.paid_hours > 0 && mixed.labour.owner_hours > 0);
  assert.equal(contractor.labour.owner_hours, 0);
  assert.equal(contractor.labour.paid_hours, contractor.labour.total_labour_hours);
  assert.ok(owner.totals.upfront_cash_required_cad < contractor.totals.upfront_cash_required_cad);
  assert.ok(owner.totals.economic_cost_cad < contractor.totals.economic_cost_cad);
});

test('zero-interest financing uses principal divided by payment months', () => {
  const result = calculateHouseCost({financing: {ownership: 'financed', downPaymentRate: 0.2, interestRateAnnual: 0, amortizationYears: 25}});
  const expected = result.totals.upfront_cash_required_cad * 0.8 / 300;
  assert.ok(Math.abs(result.financing.monthly_debt_service_cad - expected) < 0.02);
  assert.equal(result.totals.initial_cash_contribution_cad, result.financing.down_payment_cad);
  assert.equal(result.totals.financed_principal_cad, result.financing.financed_principal_cad);
});

test('rate overrides replace a material price without changing its quantity', () => {
  const baseline = calculateHouseCost({design: {diameter_m: 9.3}});
  const row = baseline.components.find((item) => item.id === 'platform_decking');
  const override = calculateHouseCost({design: {diameter_m: 9.3}, materialPriceOverrides: {'spruce_tg_plywood_3_4': row.base_unit_rate_cad * 1.2}});
  const changed = override.components.find((item) => item.id === row.id);
  assert.equal(changed.quantity, row.quantity);
  assert.ok(changed.material_cost_cad > row.material_cost_cad);
  assert.equal(changed.material_price_override_used, true);
});

test('diameter and layout thresholds are explicit and not multiplied twice', () => {
  const base = calculateHouseCost({design: {diameter_m: 9.144}});
  const larger = calculateHouseCost({design: {diameter_m: 9.2}});
  const veryLarge = calculateHouseCost({design: {diameter_m: 11}});
  const twoStorey = calculateHouseCost({design: {layout: 'full_two_storeys'}});
  assert.equal(base.thresholds.applied.some((row) => row.id === 'large_diameter_9_144'), false);
  assert.equal(larger.thresholds.applied.some((row) => row.id === 'large_diameter_9_144'), true);
  assert.equal(veryLarge.thresholds.applied.some((row) => row.id === 'large_diameter_10_668'), true);
  assert.equal(larger.components.find((row) => row.id === 'purchased_yurt_package').threshold_addition_cad, 1400);
  assert.equal(larger.components.find((row) => row.id === 'platform_joists').threshold_addition_cad, 1000);
  assert.ok(twoStorey.components.find((row) => row.id === 'upper_floor_structure')?.active);
  assert.ok(twoStorey.components.find((row) => row.id === 'stairs')?.cash_cost_cad > 0);
});

test('reference package has no diameter threshold and geometry remains physically distinct by layout', () => {
  const single = calculateHouseCost({design: {diameter_m: 9.144, layout: 'single_storey'}});
  const full = calculateHouseCost({design: {diameter_m: 9.144, layout: 'full_two_storeys'}});
  assert.equal(single.thresholds.applied.some((row) => row.id === 'large_diameter_9_144'), false);
  assert.equal(single.geometry.total_wall_height_m, 2.4);
  assert.equal(full.geometry.total_wall_height_m, 4.8);
  assert.equal(full.geometry.upper_floor_elevation_m, 2.4);
});

test('custom quote overrides only the financing headline and stays auditable', () => {
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

test('presentation contract exposes market evidence, BOM and source-linked rows', () => {
  const contract = buildHouseCostPresentationContract();
  assert.equal(contract.contract_version, '3.0.0');
  assert.ok(contract.market_evidence.yurt_packages.length >= 8);
  assert.ok(contract.market_evidence.platform_design.rows.length >= 7);
  assert.ok(contract.central.components.some((row) => row.id === 'water_collection_storage_first_flush'));
  assert.ok(contract.central.components.some((row) => row.id === 'pv_400w'));
  assert.ok(contract.sources.length >= 5);
  assert.ok(contract.diameter_sensitivity.length >= 5);
  assert.equal(contract.layout_comparison.length, 3);
  assert.ok(contract.central.supplier_package.source_url);
});
