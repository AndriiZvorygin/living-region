import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildArcDwellingAffordabilityIntegration,
  buildHouseCostPresentationContract,
  calculateHouseCost,
  calculateYurtGeometry,
  MIN_RESIDENTIAL_DIAMETER_M,
  calculateOccupancyCompliance
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
  assert.equal(result.contract_version, '4.3.0');
  assert.equal(result.supplier_package.id, 'yc_30_base_installed');
  assert.equal(result.supplier_package.selected_price_cad, 36404);
  assert.equal(result.supplier_package.price_basis, 'installed');
  assert.match(result.supplier_package.source_url, /yurts-canada\.ca/);
  assert.equal(result.supplier_package.inclusion_matrix.platform, 'excluded');
  assert.equal(result.supplier_package.inclusion_matrix.utilities, 'excluded');
  assert.equal(result.accounting.no_historical_input_used, true);
  assert.equal(result.completion_stage, 'yurt_package');
  assert.equal(result.selected_stage.label, 'Yurt package');
  assert.match(result.selected_stage.description, /not a platform-supported or habitable dwelling/);
  assert.equal(result.components.find((row) => row.id === 'additional_windows'), undefined);
  assert.equal(result.components.find((row) => row.id === 'additional_doors'), undefined);
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
  assert.equal(result.water_package_reconciliation.historical_inclusive_total_cad, 5940);
  assert.equal(result.water_package_reconciliation.current_itemized_total_cad, 6744.62);
  assert.equal(result.water_package_reconciliation.difference_cad, 804.62);
  assert.equal(Math.round(result.water_package_reconciliation.current_itemized_rows.reduce((total, row) => total + row.cash_cost_cad, 0) * 100) / 100, 6744.62);
  assert.equal(result.water_package_reconciliation.difference_classification.changed_equipment.status, 'not_established');
  assert.equal(result.water_package_reconciliation.difference_classification.changed_scope.status, 'not_established');
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
  const expected = result.selected_stage.cash_cost_cad * 0.8 / 300;
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

test('custom quote overrides the selected completed-stage financing basis and stays auditable', () => {
  const result = calculateHouseCost({completionStage: 'basic_completed_arc', customCompletedQuoteCad: 61000});
  assert.equal(result.totals.custom_quote_applied, true);
  assert.equal(result.financing.capital_value_cad, 61000);
  assert.notEqual(result.totals.upfront_cash_required_cad, 61000);
  assert.equal(result.totals.quote_delta_unallocated_cad, Math.round((61000 - result.totals.completed_dwelling_capital_cad) * 100) / 100);
});

test('ARC integration keeps dwelling finance separate from land and infrastructure', () => {
  const house = calculateHouseCost({completionStage: 'basic_completed_arc'});
  const integrated = buildArcDwellingAffordabilityIntegration({houseCost: house, landAndInfrastructureMonthlyCad: 268.22});
  assert.equal(integrated.dwelling_capital_cad, house.selected_stage.economic_cost_cad);
  assert.equal(integrated.land_and_shared_infrastructure_monthly_cad, 268.22);
  assert.equal(integrated.completion_stage, 'basic_completed_arc');
  assert.equal(integrated.combined_monthly_cad, Math.round((house.selected_financing.monthly_debt_service_cad + 268.22) * 100) / 100);
});

test('layered pricing starts with the supplier package and reconciles every layer', () => {
  const bare = calculateHouseCost();
  const complete = calculateHouseCost({completionStage: 'basic_completed_arc'});
  assert.equal(bare.pricing_layers.length, 5);
  assert.equal(bare.pricing_layers[0].incremental_cash_cost_cad, bare.supplier_package.selected_price_cad);
  assert.equal(bare.selected_stage.cash_cost_cad, bare.pricing_layers[0].cumulative_cash_cost_cad);
  assert.equal(complete.selected_stage.cash_cost_cad, complete.totals.upfront_cash_required_cad);
  assert.equal(complete.pricing_layers.at(-1).cumulative_cash_cost_cad, complete.totals.upfront_cash_required_cad);
  assert.equal(complete.accounting.pricing_layer_sum_check, true);
  assert.equal(complete.accounting.pricing_layer_economic_sum_check, true);
  assert.ok(complete.pricing_layers.every((layer) => layer.component_ids.every((id) => id)));
});

test('cash waterfall separates the basic dwelling subtotal from project costs', () => {
  const result = calculateHouseCost({completionStage: 'basic_completed_arc'});
  const waterfall = result.cost_waterfall;
  assert.equal(waterfall.basic_dwelling_subtotal_cad, 66374.59);
  assert.equal(waterfall.project_costs_before_tax_cad, 5800);
  assert.deepEqual(waterfall.project_cost_rows.map((row) => [row.id, row.cash_cost_cad]), [
    ['delivery_logistics', 1800],
    ['design_engineering', 3000],
    ['permits', 1000]
  ]);
  assert.equal(waterfall.total_before_tax_and_contingency_cad, 72174.59);
  assert.equal(waterfall.tax_hst_allowance_cad, 9382.70);
  assert.equal(waterfall.contingency_cad, 6524.58);
  assert.equal(waterfall.final_cash_construction_budget_cad, 88081.87);
  assert.equal(waterfall.checks.project_costs_sum_check, true);
  assert.equal(waterfall.checks.subtotal_plus_project_costs_check, true);
});

test('completion stages expose outstanding work and stage-specific financing', () => {
  const packageStage = calculateHouseCost({completionStage: 'yurt_package'});
  const platformStage = calculateHouseCost({completionStage: 'platform_supported_shell'});
  const completed = calculateHouseCost({completionStage: 'basic_completed_arc'});
  assert.deepEqual(packageStage.selected_stage.layer_ids, ['yurt_package']);
  assert.deepEqual(packageStage.selected_stage.remaining_layer_ids, ['platform_foundation', 'four_season_completion', 'basic_household_amenities', 'project_costs']);
  assert.ok(platformStage.selected_stage.cash_cost_cad > packageStage.selected_stage.cash_cost_cad);
  assert.ok(completed.selected_financing.monthly_debt_service_cad > packageStage.selected_financing.monthly_debt_service_cad);
  assert.equal(completed.selected_stage.label, 'Basic completed ARC dwelling');
  assert.match(completed.selected_stage.description, /household systems/);
});

test('presentation contract exposes market evidence, BOM and source-linked rows', () => {
  const contract = buildHouseCostPresentationContract();
  assert.equal(contract.contract_version, '4.3.0');
  assert.ok(contract.market_evidence.yurt_packages.length >= 8);
  assert.ok(contract.market_evidence.platform_design.rows.length >= 7);
  assert.ok(contract.central.components.some((row) => row.id === 'water_collection_storage_first_flush'));
  assert.ok(contract.central.components.some((row) => row.id === 'pv_400w'));
  assert.ok(contract.sources.length >= 5);
  assert.ok(contract.diameter_sensitivity.length >= 4);
  assert.equal(contract.layout_comparison.length, 3);
  assert.ok(contract.central.supplier_package.source_url);
  assert.equal(contract.pricing_layers.length, 5);
  assert.equal(contract.defaults.completion_stage, 'yurt_package');
  assert.equal(contract.pricing_layers.at(-1).label, 'Delivery, design, permits, tax and contingency');
  assert.ok(contract.procurement_routes.yurts_canada_purchased_package);
  assert.equal(contract.procurement_routes.local_fabrication_owner_built.status, 'unmodeled');
  assert.equal(contract.central.water_package_reconciliation.difference_cad, 804.62);
  assert.equal(contract.central.cost_waterfall.project_costs_before_tax_cad, 5800);
  assert.equal(contract.central.cost_waterfall.basic_dwelling_subtotal_cad, 66374.59);
  assert.equal(contract.central.cost_waterfall.checks.subtotal_plus_project_costs_check, true);
});

test('ordinary residential shell options start at 20 ft and keep smaller evidence out of calculations', () => {
  const below20 = calculateHouseCost({design: {diameter_m: 4.8768}, completionStage: 'basic_completed_arc'});
  const twenty = calculateHouseCost({design: {diameter_m: 6.096}, completionStage: 'basic_completed_arc'});
  const twentyFour = calculateHouseCost({design: {diameter_m: 7.3152}, completionStage: 'basic_completed_arc'});
  const thirty = calculateHouseCost({design: {diameter_m: 9.144}, completionStage: 'basic_completed_arc'});
  assert.equal(MIN_RESIDENTIAL_DIAMETER_M, 6.096);
  assert.equal(below20.geometry.inputs.diameter_m, MIN_RESIDENTIAL_DIAMETER_M);
  assert.equal(below20.supplier_package.id, 'yc_20_base_installed');
  assert.equal(twenty.supplier_package.id, 'yc_20_base_installed');
  assert.equal(twentyFour.supplier_package.id, 'yc_24_base_installed');
  assert.equal(thirty.supplier_package.id, 'yc_30_base_installed');
  assert.equal(below20.geometry.inputs.residential_shell.requested_below_minimum, true);
  assert.ok(below20.mortgage.selected_stage_cash_basis_cad > 0);
});

test('32 ft exact evidence is supplier-specific while 12 ft and 16 ft remain evidence-only', () => {
  const contract = buildHouseCostPresentationContract();
  const defaultOptions = contract.supplier_diameter_options.yurts_canada.map((row) => row.label);
  const outFactoryOptions = contract.supplier_diameter_options.the_out_factory.map((row) => row.label);
  assert.deepEqual(defaultOptions, ['20 ft', '24 ft', '30 ft']);
  assert.ok(outFactoryOptions.some((label) => label.includes('32 ft')));
  assert.equal(contract.central.market_evidence.yurt_packages.find((row) => row.diameter_label === '12 ft').ordinary_residential_eligible, false);
  assert.equal(contract.central.market_evidence.yurt_packages.find((row) => row.diameter_label === '16 ft').ordinary_residential_eligible, false);
  const outFactory = calculateHouseCost({yurtSupplierId: 'the_out_factory', design: {diameter_m: 9.7536}});
  assert.equal(outFactory.supplier_package.id, 'tof_32_import_estimate');
});

test('occupancy screen uses Ontario open-concept reference and evaluates code-sensitive requirements', () => {
  const twenty = calculateHouseCost({design: {diameter_m: 6.096, household_size: 1}});
  const review = twenty.occupancy_compliance;
  assert.equal(review.reference_open_concept_minimum_finished_floor_area_m2, 17.5);
  assert.equal(review.occupants, 1);
  assert.equal(review.checks.find((row) => row.id === 'finished_floor_area').status, 'passes_reference_minimum');
  assert.equal(review.checks.find((row) => row.id === 'egress_windows').status, 'review_required');
  assert.equal(review.checks.find((row) => row.id === 'zoning_occupancy').status, 'review_required');
  const separated = calculateOccupancyCompliance(twenty.geometry, {layout: 'separated_rooms', occupants: 2, bedroom_count: 1, bathroom_area_m2: 3, kitchen_area_m2: 4.2});
  assert.equal(separated.layout, 'separated_rooms');
  assert.equal(separated.required_reference_area_m2, 23.8);
});

test('basic completed preset selects only itemized minimal completion components', () => {
  const result = calculateHouseCost({completionStage: 'basic_completed_arc'});
  const selected = new Set(result.components.filter((row) => row.selection_id).map((row) => row.selection_id));
  const unselected = new Set(result.inactive_components.filter((row) => row.selection_id).map((row) => row.selection_id));
  assert.deepEqual(selected, new Set(['heating', 'ventilation', 'privacy_partition', 'protective_floor_surface', 'basic_counter']));
  assert.deepEqual(unselected, new Set(['interior_surface_finish', 'kitchen_cabinetry', 'kitchen_appliances', 'bathroom_fittings']));
  const privacy = result.components.find((row) => row.id === 'privacy_partition');
  const floor = result.components.find((row) => row.id === 'protective_floor_surface');
  const counter = result.components.find((row) => row.id === 'basic_counter');
  assert.equal(privacy.quantity, 7.2);
  assert.equal(privacy.quantity_unit, 'm²');
  assert.equal(floor.quantity, result.geometry.usable_floor_area_m2);
  assert.equal(floor.quantity_unit, 'm²');
  assert.equal(counter.quantity, 1.08);
  assert.equal(counter.quantity_unit, 'm²');
  assert.equal(privacy.cash_cost_cad, 473.4);
  assert.equal(floor.cash_cost_cad, 914.12);
  assert.equal(counter.cash_cost_cad, 284.85);
  assert.equal(result.components.find((row) => row.id === 'interior_finish_materials'), undefined);
  assert.equal(result.components.find((row) => row.id === 'kitchen_fitout_materials'), undefined);
  assert.equal(result.components.find((row) => row.id === 'bathroom_fitout_materials'), undefined);
});

test('completion controls are independent and utility fixtures remain in one package', () => {
  const noHeating = calculateHouseCost({completionStage: 'basic_completed_arc', completionSelections: {heating: false}});
  assert.equal(noHeating.components.find((row) => row.id === 'wood_stove_and_chimney'), undefined);
  assert.ok(noHeating.components.find((row) => row.id === 'balanced_ventilation'));
  assert.ok(noHeating.components.find((row) => row.id === 'privacy_partition'));
  const allOptional = calculateHouseCost({completionStage: 'basic_completed_arc', completionSelections: {
    heating: true,
    ventilation: true,
    privacy_partition: true,
    protective_floor_surface: true,
    interior_surface_finish: true,
    basic_counter: true,
    kitchen_cabinetry: true,
    kitchen_appliances: true,
    bathroom_fittings: true
  }});
  assert.ok(allOptional.components.find((row) => row.id === 'kitchen_cabinetry'));
  assert.ok(allOptional.components.find((row) => row.id === 'bathroom_fittings'));
  const utilityIds = allOptional.components.filter((row) => String(row.package_id).startsWith('utility_')).map((row) => row.id);
  assert.equal(utilityIds.filter((id) => id === 'sink_and_shower_fixtures').length, 1);
  assert.equal(utilityIds.filter((id) => id === 'composting_toilet').length, 1);
  assert.equal(utilityIds.filter((id) => id === 'qualified_water_installation').length, 1);
  assert.equal(allOptional.accounting.utility_single_home, true);
});
