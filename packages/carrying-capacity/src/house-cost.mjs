import evidence from '../data/source/house-cost-evidence.json' with {type: 'json'};
import {financeCapital} from './site-lease-browser.mjs';

export const HOUSE_COST_CONTRACT_VERSION = evidence.contract_version;
export const HOUSE_COST_EVIDENCE = evidence;
export const HOUSE_COST_MODEL_ID = evidence.model_id;

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const nonNegative = (value, fallback = 0) => Math.max(0, finite(value, fallback));
const clamp = (value, min, max) => Math.max(min, Math.min(max, finite(value, min)));
const round = (value, digits = 2) => Math.round(nonNegative(value) * 10 ** digits) / 10 ** digits;
const roundSigned = (value, digits = 2) => Math.round(finite(value) * 10 ** digits) / 10 ** digits;
const sum = (rows, key) => rows.reduce((total, row) => total + finite(row[key]), 0);

const SOFT_COMPONENTS = new Set(['delivery', 'equipment_hire', 'design_engineering', 'permits']);

function layoutRule(layout) {
  return evidence.layout_rules[layout] ?? evidence.layout_rules.single_storey;
}

function normalizeDesign(design = {}) {
  const layout = evidence.layout_rules[design.layout] ? design.layout : evidence.defaults.layout;
  const rule = layoutRule(layout);
  return {
    diameter_m: clamp(design.diameter_m ?? evidence.defaults.diameter_m, 3, 20),
    wall_height_m: clamp(design.wall_height_m ?? evidence.defaults.wall_height_m, 1.8, 4),
    roof_pitch_degrees: clamp(design.roof_pitch_degrees ?? evidence.defaults.roof_pitch_degrees, 10, 60),
    household_size: Math.max(1, Math.round(finite(design.household_size, evidence.defaults.household_size))),
    layout,
    window_count: Math.max(1, Math.round(finite(design.window_count, evidence.defaults.window_count))),
    door_count: Math.max(1, Math.round(finite(design.door_count, evidence.defaults.door_count))),
    partition_loss_fraction: clamp(design.partition_loss_fraction ?? evidence.defaults.partition_loss_fraction, 0, .25),
    stair_opening_m2: Math.max(0, finite(design.stair_opening_m2, rule.stair_opening_m2)),
    restricted_headroom_fraction: clamp(design.restricted_headroom_fraction ?? rule.restricted_headroom_fraction, 0, .75),
    guard_length_m: Math.max(0, finite(design.guard_length_m, rule.guard_length_m))
  };
}

export function calculateYurtGeometry(design = {}) {
  const input = normalizeDesign(design);
  const radius = input.diameter_m / 2;
  const footprint = Math.PI * radius ** 2;
  const perimeter = Math.PI * input.diameter_m;
  const roofRise = radius * Math.tan(input.roof_pitch_degrees * Math.PI / 180);
  const roofSlope = Math.sqrt(radius ** 2 + roofRise ** 2);
  const roofArea = Math.PI * radius * roofSlope;
  const wallArea = perimeter * input.wall_height_m;
  const upperFloor = footprint * layoutRule(input.layout).upper_floor_fraction;
  const grossFloor = footprint + upperFloor;
  const stairOpening = input.layout === 'single_storey' ? 0 : Math.min(input.stair_opening_m2, upperFloor);
  const partitionLoss = grossFloor * input.partition_loss_fraction;
  const restrictedHeadroom = upperFloor * input.restricted_headroom_fraction;
  const usableFloor = Math.max(0, grossFloor - stairOpening - partitionLoss - restrictedHeadroom);
  return {
    inputs: input,
    radius_m: round(radius, 4),
    footprint_m2: round(footprint, 4),
    perimeter_m: round(perimeter, 4),
    exterior_wall_area_m2: round(wallArea, 4),
    roof_rise_m: round(roofRise, 4),
    roof_sloping_area_m2: round(roofArea, 4),
    lower_floor_area_m2: round(footprint, 4),
    upper_floor_area_m2: round(upperFloor, 4),
    gross_floor_area_m2: round(grossFloor, 4),
    usable_floor_area_m2: round(usableFloor, 4),
    area_deductions_m2: {
      stair_opening: round(stairOpening, 4),
      interior_partitions: round(partitionLoss, 4),
      restricted_headroom: round(restrictedHeadroom, 4),
      total: round(stairOpening + partitionLoss + restrictedHeadroom, 4)
    },
    envelope_area_m2: round(wallArea + roofArea, 4),
    dimensional_checks: {
      footprint_from_radius_m2: round(Math.PI * radius ** 2, 4),
      roof_uses_sloping_area: true,
      usable_not_greater_than_gross: usableFloor <= grossFloor + 1e-9
    }
  };
}

function componentQuantity(component, geometry, overrides = {}) {
  const key = component.driver;
  const defaults = {
    footprint_m2: geometry.footprint_m2,
    perimeter_m: geometry.perimeter_m,
    roof_area_m2: geometry.roof_sloping_area_m2,
    envelope_area_m2: geometry.envelope_area_m2,
    usable_floor_area_m2: geometry.usable_floor_area_m2,
    upper_floor_area_m2: geometry.upper_floor_area_m2,
    window_count: geometry.inputs.window_count,
    door_count: geometry.inputs.door_count,
    stair_count: geometry.inputs.layout === 'single_storey' ? 0 : 1,
    guard_length_m: geometry.inputs.layout === 'single_storey' ? 0 : geometry.inputs.guard_length_m,
    people_above_two: Math.max(0, geometry.inputs.household_size - 2),
    fixed: 1,
    servicing_mode: 1
  };
  return Math.max(0, finite(overrides[key], defaults[key] ?? 0));
}

function serviceRate(componentId, band, servicingMode) {
  const mode = evidence.servicing_modes[servicingMode] ?? evidence.servicing_modes.arc_household_systems;
  if (!Object.prototype.hasOwnProperty.call(mode.components, componentId)) return null;
  const value = finite(mode.components[componentId], 0);
  return componentId === 'hot_water' ? value : value * (band === 'low' ? .95 : band === 'high' ? 1.15 : 1);
}

function thresholdEffects({geometry, band}) {
  const effects = new Map();
  const applied = [];
  for (const rule of evidence.threshold_rules) {
    let matches = false;
    if (rule.id === 'large_diameter_9_144') matches = geometry.inputs.diameter_m > 9.144;
    if (rule.id === 'large_diameter_10_668') matches = geometry.inputs.diameter_m > 10.668;
    if (rule.id === 'roof_pitch_above_35') matches = geometry.inputs.roof_pitch_degrees > 35;
    if (rule.id === 'partial_or_full_upper_floor') matches = geometry.inputs.layout !== 'single_storey';
    if (!matches) continue;
    const additions = Object.entries(rule.added_cost_cad ?? {}).map(([componentId, value]) => ({component_id: componentId, amount_cad: finite(value) * (band === 'low' ? .9 : band === 'high' ? 1.2 : 1)}));
    const multipliers = Object.entries(rule.rate_multipliers ?? {}).map(([componentId, value]) => ({component_id: componentId, multiplier: finite(value, 1)}));
    for (const effect of additions) effects.set(effect.component_id, (effects.get(effect.component_id) ?? 0) + effect.amount_cad);
    applied.push({...rule, additions, rate_multipliers: multipliers});
  }
  return {effects, applied};
}

function multiplierForComponent(applied, componentId) {
  return applied.reduce((factor, rule) => factor * (rule.rate_multipliers ?? []).filter((row) => row.component_id === componentId).reduce((product, row) => product * finite(row.multiplier, 1), 1), 1);
}

function normalizeOptions(options = {}) {
  const band = ['low', 'central', 'high'].includes(options.band) ? options.band : 'central';
  const servicingMode = evidence.servicing_modes[options.servicingMode] ? options.servicingMode : evidence.defaults.servicing_mode;
  const labourMode = evidence.labour_modes[options.labourMode] ? options.labourMode : evidence.defaults.labour_mode;
  return {
    band,
    servicingMode,
    labourMode,
    design: normalizeDesign(options.design),
    unitRateOverrides: options.unitRateOverrides ?? {},
    quantityOverrides: options.quantityOverrides ?? {},
    taxRate: clamp(options.taxRate ?? evidence.tax_and_contingency.tax_rate[band], 0, .3),
    contingencyRate: clamp(options.contingencyRate ?? evidence.tax_and_contingency.contingency_rate[band], 0, .3),
    labourRateCadPerHour: Math.max(0, finite(options.labourRateCadPerHour, evidence.defaults.labour_rate_cad_per_hour)),
    ownerLabourValueRateCadPerHour: Math.max(0, finite(options.ownerLabourValueRateCadPerHour, evidence.defaults.owner_labour_value_rate_cad_per_hour)),
    financing: {
      ownership: options.financing?.ownership === 'owned_out_right' ? 'owned_out_right' : 'financed',
      downPaymentRate: clamp(options.financing?.downPaymentRate ?? evidence.defaults.financing.down_payment_rate, 0, 1),
      interestRateAnnual: clamp(options.financing?.interestRateAnnual ?? evidence.defaults.financing.interest_rate_annual, 0, 1),
      amortizationYears: Math.max(1, finite(options.financing?.amortizationYears, evidence.defaults.financing.amortization_years)),
      loanTermYears: options.financing?.loanTermYears == null ? evidence.defaults.financing.loan_term_years : Math.max(1, finite(options.financing.loanTermYears))
    },
    customCompletedQuoteCad: options.customCompletedQuoteCad == null ? null : Math.max(0, finite(options.customCompletedQuoteCad))
  };
}

export function calculateHouseCost(options = {}) {
  const input = normalizeOptions(options);
  const geometry = calculateYurtGeometry(input.design);
  const thresholds = thresholdEffects({geometry, band: input.band});
  const labourMode = evidence.labour_modes[input.labourMode];
  const rows = evidence.components.map((component) => {
    const active = !component.layout_condition || (component.layout_condition === 'not_single_storey' && geometry.inputs.layout !== 'single_storey');
    const quantity = active ? componentQuantity(component, geometry, input.quantityOverrides) : 0;
    const sourceServiceRate = serviceRate(component.id, input.band, input.servicingMode);
    const baseRate = input.unitRateOverrides[component.id] == null
      ? sourceServiceRate ?? finite(component.rates?.[input.band], 0)
      : Math.max(0, finite(input.unitRateOverrides[component.id]));
    const unitRate = baseRate * multiplierForComponent(thresholds.applied, component.id);
    const baseMaterial = quantity * unitRate;
    const thresholdAddition = quantity > 0 ? finite(thresholds.effects.get(component.id), 0) : 0;
    const materialCost = baseMaterial + thresholdAddition;
    const fullHours = quantity * finite(component.labour_hours_per_unit?.[input.band], 0);
    const ownerEligible = component.owner_eligible !== false;
    const paidShare = ownerEligible ? finite(labourMode.paid_labour_share) : 1;
    const ownerShare = ownerEligible ? finite(labourMode.owner_labour_share) : 0;
    const paidHours = fullHours * paidShare;
    const ownerHours = fullHours * ownerShare;
    const paidCash = paidHours * input.labourRateCadPerHour;
    const ownerImputed = ownerHours * input.ownerLabourValueRateCadPerHour;
    return {
      id: component.id,
      label: component.label,
      stage: component.stage,
      driver: component.driver,
      unit: component.unit,
      quantity: round(quantity, 4),
      base_unit_rate_cad: round(baseRate, 2),
      unit_rate_cad: round(unitRate, 2),
      base_material_cost_cad: round(baseMaterial),
      threshold_addition_cad: round(thresholdAddition),
      material_cost_cad: round(materialCost),
      labour_hours_total: round(fullHours, 3),
      paid_labour_hours: round(paidHours, 3),
      owner_labour_hours: round(ownerHours, 3),
      paid_labour_cash_cad: round(paidCash),
      owner_labour_imputed_cad: round(ownerImputed),
      cash_cost_cad: round(materialCost + paidCash),
      economic_capital_cad: round(materialCost + paidCash + ownerImputed),
      owner_eligible: ownerEligible,
      active,
      taxable: Boolean(component.taxable),
      status: component.status,
      source_note: component.source_note,
      source_service_rate: sourceServiceRate != null,
      servicing_mode: input.servicingMode
    };
  });
  const activeRows = rows.filter((row) => row.active);
  const directCashBeforeTax = sum(activeRows, 'cash_cost_cad');
  const taxableCash = activeRows.filter((row) => row.taxable).reduce((total, row) => total + row.cash_cost_cad, 0);
  const taxes = taxableCash * input.taxRate;
  const contingency = (directCashBeforeTax + taxes) * input.contingencyRate;
  const additionalRows = [
    {id: 'taxes', label: 'Taxes / HST allowance', driver: 'taxable cash cost', unit: 'CAD', quantity: input.taxRate, unit_rate_cad: taxableCash, cash_cost_cad: taxes, status: 'provisional_tax_treatment', source_note: 'Tax treatment and any new-housing rebate require project-specific review.'},
    {id: 'contingency', label: 'Contingency', driver: 'pre-contingency cash', unit: 'CAD', quantity: input.contingencyRate, unit_rate_cad: directCashBeforeTax + taxes, cash_cost_cad: contingency, status: 'campaign_planning_assumption', source_note: 'Explicit planning allowance; not a hidden reconciliation adjustment.'}
  ];
  const cashBeforeAdditional = directCashBeforeTax;
  const upfrontCash = cashBeforeAdditional + taxes + contingency;
  const ownerImputed = sum(activeRows, 'owner_labour_imputed_cad');
  const economicCapital = upfrontCash + ownerImputed;
  const customQuote = input.customCompletedQuoteCad != null;
  const headlineCapital = customQuote ? input.customCompletedQuoteCad : upfrontCash;
  const financing = financeCapital({value: headlineCapital, ownership: input.financing.ownership, downPaymentRate: input.financing.downPaymentRate, interestRateAnnual: input.financing.interestRateAnnual, amortizationYears: input.financing.amortizationYears, loanTermYears: input.financing.loanTermYears});
  const stageRows = (stage) => activeRows.filter((row) => stage === 'shell' ? row.stage === 'shell' : stage === 'insulated_heated' ? ['shell', 'insulated_heated'].includes(row.stage) : true);
  const stageTotal = (stage) => sum(stageRows(stage), 'cash_cost_cad');
  const coreRows = activeRows.filter((row) => !SOFT_COMPONENTS.has(row.id));
  const coreCapital = sum(coreRows, 'economic_capital_cad');
  const legacy = evidence.legacy_arc_benchmark;
  const sharedServices = evidence.servicing_modes[input.servicingMode].shared_infrastructure_additions ?? null;
  const result = {
    contract_version: HOUSE_COST_CONTRACT_VERSION,
    model_id: HOUSE_COST_MODEL_ID,
    package_label: evidence.title,
    price_basis_date: evidence.price_basis_date,
    band: input.band,
    design: geometry.inputs,
    geometry,
    servicing: {mode: input.servicingMode, ...evidence.servicing_modes[input.servicingMode], shared_infrastructure_additions: sharedServices},
    labour: {
      mode: input.labourMode,
      ...labourMode,
      labour_rate_cad_per_hour: input.labourRateCadPerHour,
      owner_labour_value_rate_cad_per_hour: input.ownerLabourValueRateCadPerHour,
      paid_hours: round(sum(activeRows, 'paid_labour_hours'), 2),
      owner_hours: round(sum(activeRows, 'owner_labour_hours'), 2),
      paid_labour_cash_cad: round(sum(activeRows, 'paid_labour_cash_cad')),
      owner_labour_imputed_cad: round(ownerImputed),
      total_labour_hours: round(sum(activeRows, 'labour_hours_total'), 2)
    },
    components: activeRows,
    inactive_components: rows.filter((row) => !row.active),
    additional_costs: additionalRows,
    thresholds: {applied: thresholds.applied, all_rules: evidence.threshold_rules},
    stages: {
      shell: {cash_cost_cad: round(stageTotal('shell')), includes: ['platform_foundation', 'frame', 'roof', 'insulation', 'weatherproofing', 'windows', 'doors', 'upper_floor_structure']},
      insulated_heated_structure: {cash_cost_cad: round(stageTotal('insulated_heated')), includes: ['shell', 'interior_finishes', 'heating', 'ventilation', 'stairs', 'guards']},
      completed_before_tax_and_contingency: {cash_cost_cad: round(directCashBeforeTax), includes: activeRows.map((row) => row.id)},
      completed_dwelling: {cash_cost_cad: round(upfrontCash), economic_capital_cad: round(economicCapital), includes: [...activeRows.map((row) => row.id), 'taxes', 'contingency']}
    },
    totals: {
      direct_cash_before_tax_cad: round(directCashBeforeTax),
      taxes_cad: round(taxes),
      contingency_cad: round(contingency),
      upfront_cash_required_cad: round(upfrontCash),
      owner_labour_imputed_cad: round(ownerImputed),
      completed_dwelling_capital_cad: round(economicCapital),
      headline_financed_value_cad: round(headlineCapital),
      custom_quote_applied: customQuote,
      quote_delta_unallocated_cad: customQuote ? roundSigned(input.customCompletedQuoteCad - economicCapital) : 0,
      core_capital_before_soft_costs_cad: round(coreCapital),
      financing_basis: customQuote ? 'custom_completed_quote' : 'upfront_cash_excluding_contributed_owner_labour'
    },
    financing: {
      ...financing,
      assumption_status: 'illustrative_dwelling_financing_scenario',
      loan_term_vs_amortization: 'Loan term/renewal is separate from the amortization period used to calculate scheduled payment.'
    },
    legacy_reconciliation: {
      legacy_range_cad: legacy.range_cad,
      legacy_central_cad: legacy.range_cad.central,
      legacy_diameter_m_rounded: legacy.diameter_m_rounded,
      model_diameter_m: geometry.inputs.diameter_m,
      legacy_gross_floor_area_m2: legacy.gross_floor_area_m2,
      model_gross_floor_area_m2: geometry.gross_floor_area_m2,
      model_core_capital_before_soft_tax_contingency_cad: round(coreCapital),
      model_completed_economic_capital_cad: round(economicCapital),
      delta_from_legacy_central_cad: roundSigned(economicCapital - legacy.range_cad.central),
      explanation: 'The legacy CAD 61,000 was an integrated planning benchmark with unrecovered source detail. This model carries forward its utility package, then exposes component drivers, layout/diameter thresholds, delivery, equipment hire, design, permits, tax and contingency separately.'
    },
    accounting: {
      component_sum_check: round(activeRows.reduce((total, row) => total + row.cash_cost_cad, 0) + taxes + contingency) === round(upfrontCash),
      component_rows_plus_additional_cad: round(sum(activeRows, 'cash_cost_cad') + sum(additionalRows, 'cash_cost_cad')),
      upfront_cash_required_cad: round(upfrontCash),
      resident_owned_dwelling_only: true,
      excludes: ['land purchase', 'site lease', 'shared infrastructure operating charges', 'household operating expenses'],
      utility_single_home: true
    },
    input_status: {
      dimensions: 'derived_from_geometry_and_user_input',
      existing_arc_utility_package: 'legacy_design_specification_reconciled_planning_assumption',
      component_rates: 'planning_rate_or_supplier_range',
      thresholds: 'provisional_until_engineered',
      labour_rates: 'quotation_or_operating_data_required',
      taxes: 'site_specific_tax_review_required',
      financing: 'illustrative_financing_scenario'
    },
    evidence: evidence.sources,
    assumptions: {
      tax_rate: input.taxRate,
      contingency_rate: input.contingencyRate,
      custom_quote: input.customCompletedQuoteCad
    }
  };
  return result;
}

export function buildHouseCostPresentationContract(options = {}) {
  const bands = Object.fromEntries(['low', 'central', 'high'].map((band) => [band, calculateHouseCost({...options, band})]));
  const diameterSensitivity = evidence.diameter_presets.map((preset) => {
    const result = calculateHouseCost({...options, design: {...options.design, diameter_m: preset.diameter_m}});
    return {id: preset.id, label: preset.label, diameter_m: result.geometry.inputs.diameter_m, usable_floor_area_m2: result.geometry.usable_floor_area_m2, completed_dwelling_capital_cad: result.totals.completed_dwelling_capital_cad, upfront_cash_required_cad: result.totals.upfront_cash_required_cad, cost_per_usable_m2_cad: result.geometry.usable_floor_area_m2 ? result.totals.completed_dwelling_capital_cad / result.geometry.usable_floor_area_m2 : null, thresholds: result.thresholds.applied.map((row) => row.id)};
  });
  const comparison = ['single_storey', 'partial_loft', 'full_two_storeys'].map((layout) => {
    const result = calculateHouseCost({...options, design: {...options.design, layout}});
    return {layout, label: evidence.layout_rules[layout].label, usable_floor_area_m2: result.geometry.usable_floor_area_m2, completed_dwelling_capital_cad: result.totals.completed_dwelling_capital_cad, upfront_cash_required_cad: result.totals.upfront_cash_required_cad, cost_per_usable_m2_cad: result.geometry.usable_floor_area_m2 ? result.totals.completed_dwelling_capital_cad / result.geometry.usable_floor_area_m2 : null, owner_labour_hours: result.labour.owner_hours, paid_labour_hours: result.labour.paid_hours};
  });
  return {
    contract_version: HOUSE_COST_CONTRACT_VERSION,
    model_id: HOUSE_COST_MODEL_ID,
    title: evidence.title,
    defaults: evidence.defaults,
    diameter_presets: evidence.diameter_presets,
    layout_rules: evidence.layout_rules,
    labour_modes: evidence.labour_modes,
    servicing_modes: evidence.servicing_modes,
    tax_and_contingency: evidence.tax_and_contingency,
    component_evidence: evidence.components,
    threshold_rules: evidence.threshold_rules,
    legacy_arc_benchmark: evidence.legacy_arc_benchmark,
    central: bands.central,
    bands,
    diameter_sensitivity: diameterSensitivity,
    layout_comparison: comparison,
    accounting_rules: evidence.accounting_rules,
    sources: evidence.sources,
    generated_at: '2026-09-05'
  };
}

export function buildArcDwellingAffordabilityIntegration({houseCost, landAndInfrastructureMonthlyCad = null} = {}) {
  if (!houseCost?.totals) throw new Error('houseCost result is required');
  const monthlyLandAndInfrastructure = landAndInfrastructureMonthlyCad == null ? null : Math.max(0, finite(landAndInfrastructureMonthlyCad));
  return {
    contract_version: HOUSE_COST_CONTRACT_VERSION,
    dwelling_capital_cad: houseCost.totals.completed_dwelling_capital_cad,
    upfront_cash_required_cad: houseCost.totals.upfront_cash_required_cad,
    dwelling_financing_monthly_cad: houseCost.financing.monthly_debt_service_cad,
    land_and_shared_infrastructure_monthly_cad: monthlyLandAndInfrastructure,
    combined_monthly_cad: monthlyLandAndInfrastructure == null ? null : round(houseCost.financing.monthly_debt_service_cad + monthlyLandAndInfrastructure),
    accounting_boundary: 'resident-owned dwelling is separate from ARC site lease and shared infrastructure; centralized servicing additions are not silently added to either layer'
  };
}
