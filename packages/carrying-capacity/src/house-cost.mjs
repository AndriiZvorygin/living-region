import evidence from '../data/source/house-cost-evidence.json' with {type: 'json'};
import marketEvidence from '../data/source/house-cost-market-evidence.json' with {type: 'json'};
import {financeCapital} from './site-lease-browser.mjs';

export const HOUSE_COST_CONTRACT_VERSION = '4.0.0';
export const HOUSE_COST_EVIDENCE = evidence;
export const HOUSE_COST_MODEL_ID = evidence.model_id;

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const nonNegative = (value, fallback = 0) => Math.max(0, finite(value, fallback));
const clamp = (value, min, max) => Math.max(min, Math.min(max, finite(value, min)));
const round = (value, digits = 2) => Math.round(nonNegative(value) * 10 ** digits) / 10 ** digits;
const roundSigned = (value, digits = 2) => Math.round(finite(value) * 10 ** digits) / 10 ** digits;
const sum = (rows, key) => rows.reduce((total, row) => total + finite(row[key]), 0);

const SOFT_COMPONENTS = new Set(['delivery', 'equipment_hire', 'design_engineering', 'permits']);

export const HOUSE_COST_PRICING_LAYERS = [
  {id: 'yurt_package', label: 'Yurt package', stage: 'bare_package', description: 'The selected supplier package and its published inclusions only.'},
  {id: 'platform_foundation', label: 'Platform and foundation', stage: 'platform_supported_shell', description: 'The preliminary platform/foundation BOM, supports, fasteners and assembly.'},
  {id: 'four_season_completion', label: 'Four-season completion', stage: 'four_season_structure', description: 'Additional openings, envelope work, heating, chimney, ventilation and layout structure.'},
  {id: 'basic_household_amenities', label: 'Basic household amenities', stage: 'basic_completed_arc', description: 'Household water, sanitation, shower, hot water, electrical and minimal kitchen/bath fit-out.'},
  {id: 'project_costs', label: 'Project costs and optional upgrades', stage: 'basic_completed_arc', description: 'Delivery, design, permits, taxes, contingency and explicitly selected project allowances.'}
];

const COMPLETION_STAGE_IDS = new Set(HOUSE_COST_PRICING_LAYERS.map((layer) => layer.stage));
const COMPLETION_STAGE_ALIASES = {package: 'yurt_package', bare_package: 'yurt_package', platform_shell: 'platform_supported_shell', four_season: 'four_season_structure', completed: 'basic_completed_arc'};
const COMPLETION_STAGE_LAYER_COUNTS = {yurt_package: 1, platform_supported_shell: 2, four_season_structure: 3, basic_completed_arc: HOUSE_COST_PRICING_LAYERS.length};
const COMPLETION_STAGE_PRESENTATION = {
  yurt_package: {label: 'Yurt package', description: 'Package-only view: the selected supplier price and its published inclusions. It is not a platform-supported or habitable dwelling.'},
  platform_supported_shell: {label: 'Platform-supported shell', description: 'Supplier package plus the preliminary platform and foundation BOM.'},
  four_season_structure: {label: 'Four-season structure', description: 'Platform-supported shell plus additional four-season completion work.'},
  basic_completed_arc: {label: 'Basic completed ARC dwelling', description: 'The modest ARC completion specification, including household systems and project-cost allowances.'}
};

function normalizeCompletionStage(value) {
  const normalized = COMPLETION_STAGE_ALIASES[value] ?? value;
  return COMPLETION_STAGE_IDS.has(normalized) ? normalized : (evidence.defaults.completion_stage ?? 'yurt_package');
}

function pricingLayerForRow(row) {
  if (row.id === 'purchased_yurt_package') return 'yurt_package';
  if (row.id.startsWith('platform_')) return 'platform_foundation';
  if (['additional_windows', 'additional_doors', 'additional_interior_liner_and_furring', 'interior_finish_materials', 'upper_floor_structure', 'stairs', 'guards', 'wood_stove_and_chimney', 'balanced_ventilation'].includes(row.id)) return 'four_season_completion';
  if (['kitchen_fitout_materials', 'bathroom_fitout_materials'].includes(row.id) || String(row.package_id ?? '').startsWith('utility_') || String(row.package_id ?? '').startsWith('alternative_')) return 'basic_household_amenities';
  if (['delivery_logistics', 'design_engineering', 'permits'].includes(row.id)) return 'project_costs';
  return row.stage === 'shell' ? 'four_season_completion' : 'basic_household_amenities';
}

function layoutRule(layout) {
  return evidence.layout_rules[layout] ?? evidence.layout_rules.single_storey;
}

function normalizeDesign(design = {}) {
  const layout = evidence.layout_rules[design.layout] ? design.layout : evidence.defaults.layout;
  const rule = layoutRule(layout);
  const restrictedHeadroomOverride = design.restricted_headroom_override_used === true
    || (design.restricted_headroom_override_used !== false && design.restricted_headroom_fraction != null);
  return {
    diameter_m: clamp(design.diameter_m ?? evidence.defaults.diameter_m, 3, 20),
    wall_height_m: clamp(design.wall_height_m ?? evidence.defaults.wall_height_m, 1.8, 4),
    roof_pitch_degrees: clamp(design.roof_pitch_degrees ?? evidence.defaults.roof_pitch_degrees, 10, 60),
    household_size: Math.max(1, Math.round(finite(design.household_size, evidence.defaults.household_size))),
    layout,
    window_count: Math.max(0, Math.round(finite(design.window_count, evidence.defaults.window_count))),
    door_count: Math.max(1, Math.round(finite(design.door_count, evidence.defaults.door_count))),
    partition_loss_fraction: clamp(design.partition_loss_fraction ?? evidence.defaults.partition_loss_fraction, 0, .25),
    stair_opening_m2: Math.max(0, finite(design.stair_opening_m2, rule.stair_opening_m2)),
    restricted_headroom_override_used: restrictedHeadroomOverride,
    restricted_headroom_fraction: !restrictedHeadroomOverride
      ? rule.restricted_headroom_fraction
      : clamp(design.restricted_headroom_fraction, 0, .75),
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
  const rule = layoutRule(input.layout);
  const totalWallHeight = input.wall_height_m * finite(rule.wall_height_multiplier, 1);
  const upperFloor = footprint * finite(rule.upper_floor_fraction);
  const upperFloorElevation = input.wall_height_m * finite(rule.upper_floor_elevation_factor);
  const grossFloor = footprint + upperFloor;
  const stairOpening = input.layout === 'single_storey' ? 0 : Math.min(input.stair_opening_m2, upperFloor);
  const partitionLoss = grossFloor * input.partition_loss_fraction;
  const minimumHeadroom = finite(rule.minimum_headroom_m, 1.98);
  const roofBaseHeight = totalWallHeight;
  const requiredRoofHeight = upperFloorElevation + minimumHeadroom;
  const headroomRatio = roofRise > 0 ? (requiredRoofHeight - roofBaseHeight) / roofRise : 1;
  const upperFloorRadius = upperFloor > 0 ? radius * Math.sqrt(Math.min(1, upperFloor / footprint)) : 0;
  const unrestrictedRadius = headroomRatio <= 0
    ? upperFloorRadius
    : headroomRatio >= 1
      ? 0
      : radius * (1 - headroomRatio);
  const derivedRestrictedFraction = upperFloorRadius > 0
    ? 1 - Math.min(upperFloorRadius, Math.max(0, unrestrictedRadius)) ** 2 / upperFloorRadius ** 2
    : 0;
  const restrictedHeadroomFraction = input.restricted_headroom_fraction == null
    ? clamp(derivedRestrictedFraction, 0, 1)
    : input.restricted_headroom_fraction;
  const restrictedHeadroom = upperFloor * restrictedHeadroomFraction;
  const wallArea = perimeter * totalWallHeight;
  const usableFloor = Math.max(0, grossFloor - stairOpening - partitionLoss - restrictedHeadroom);
  return {
    inputs: input,
    radius_m: round(radius, 4),
    footprint_m2: round(footprint, 4),
    perimeter_m: round(perimeter, 4),
    exterior_wall_area_m2: round(wallArea, 4),
    total_wall_height_m: round(totalWallHeight, 4),
    upper_floor_elevation_m: round(upperFloorElevation, 4),
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
      restricted_headroom_fraction: round(restrictedHeadroomFraction, 4),
      total: round(stairOpening + partitionLoss + restrictedHeadroom, 4)
    },
    envelope_area_m2: round(wallArea + roofArea, 4),
    headroom: {
      minimum_headroom_m: minimumHeadroom,
      roof_base_height_m: round(roofBaseHeight, 4),
      derived_restricted_fraction: round(derivedRestrictedFraction, 4),
      input_override_used: input.restricted_headroom_override_used,
      method: 'Radial pitched-roof clearance above configured upper-floor elevation; full two-storey layouts receive a second wall-height envelope.'
    },
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

function servicePackage(componentId, band, servicingMode, baseRate) {
  const component = evidence.components.find((row) => row.id === componentId);
  const packageId = component?.service_package_id;
  const packageRecord = packageId ? evidence.service_package_accounting?.[servicingMode]?.[packageId] : null;
  if (!packageRecord) return null;
  const sourceTotal = finite(evidence.servicing_modes[servicingMode]?.components?.[componentId], packageRecord.inclusive_total_cad);
  const bandFactor = sourceTotal ? baseRate / sourceTotal : 1;
  return {
    id: packageId,
    inclusiveTotal: finite(baseRate),
    includedPaidLabour: Math.min(finite(baseRate), finite(packageRecord.included_paid_labour_cad) * bandFactor),
    includedFee: Math.min(finite(baseRate), finite(packageRecord.included_fee_cad) * bandFactor),
    labourRateBasis: Math.max(.01, finite(packageRecord.labour_rate_basis_cad_per_hour, 45)),
    scope: packageRecord.scope ?? [],
    sourceNote: packageRecord.source_note
  };
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
    completionStage: normalizeCompletionStage(options.completionStage),
    servicingMode,
    labourMode,
    design: normalizeDesign(options.design),
    yurtSupplierId: typeof options.yurtSupplierId === 'string' ? options.yurtSupplierId : 'yurts_canada',
    yurtPackageId: typeof options.yurtPackageId === 'string' ? options.yurtPackageId : null,
    unitRateOverrides: options.unitRateOverrides ?? {},
    quantityOverrides: options.quantityOverrides ?? {},
    materialPriceOverrides: {...(options.unitRateOverrides ?? {}), ...(options.materialPriceOverrides ?? {})},
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

function calculateLegacyRateHouseCost(options = {}) {
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
    const packageInfo = active ? servicePackage(component.id, input.band, input.servicingMode, unitRate) : null;
    const packageTotal = packageInfo ? quantity * packageInfo.inclusiveTotal : 0;
    const packageIncludedPaidLabour = packageInfo ? quantity * packageInfo.includedPaidLabour : 0;
    const packageIncludedFee = packageInfo ? quantity * packageInfo.includedFee : 0;
    const packageNonLabour = packageInfo ? Math.max(0, packageTotal - packageIncludedPaidLabour) : 0;
    const materialCost = packageInfo ? packageNonLabour : baseMaterial + thresholdAddition;
    const fullHours = packageInfo
      ? packageIncludedPaidLabour / packageInfo.labourRateBasis
      : quantity * finite(component.labour_hours_per_unit?.[input.band], 0);
    const ownerEligible = packageInfo ? false : component.owner_eligible !== false;
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
      base_material_cost_cad: round(packageInfo ? packageNonLabour : baseMaterial),
      threshold_addition_cad: round(packageInfo ? 0 : thresholdAddition),
      material_cost_cad: round(materialCost),
      package_id: packageInfo?.id ?? null,
      package_total_cad: packageInfo ? round(packageTotal) : null,
      package_included_paid_labour_cad: packageInfo ? round(packageIncludedPaidLabour) : null,
      package_included_fee_cad: packageInfo ? round(packageIncludedFee) : null,
      package_non_labour_cost_cad: packageInfo ? round(packageNonLabour) : null,
      package_labour_override_delta_cad: packageInfo ? roundSigned(paidCash - packageIncludedPaidLabour) : 0,
      package_scope: packageInfo?.scope ?? [],
      package_source_note: packageInfo?.sourceNote ?? null,
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
      scope_ids: component.scope_ids ?? [],
      excludes_scope_ids: component.excludes_scope_ids ?? [],
      servicing_mode: input.servicingMode
    };
  });
  const activeRows = rows.filter((row) => row.active);
  const packagePermitAllowance = input.servicingMode === 'arc_household_systems'
    ? finite(evidence.service_package_accounting?.arc_household_systems?.water_plumbing_sanitation?.included_fee_cad)
    : 0;
  const permitRow = activeRows.find((row) => row.id === 'permits');
  if (permitRow && packagePermitAllowance > 0) {
    const offset = Math.min(permitRow.cash_cost_cad, packagePermitAllowance);
    permitRow.cash_cost_cad = round(Math.max(0, permitRow.cash_cost_cad - offset));
    permitRow.material_cost_cad = permitRow.cash_cost_cad;
    permitRow.base_material_cost_cad = permitRow.cash_cost_cad;
    permitRow.economic_capital_cad = permitRow.cash_cost_cad;
    permitRow.package_fee_offset_cad = round(offset);
    permitRow.package_fee_offset_note = 'The ARC water/plumbing/sanitation package already includes this permit allowance; only the residual general permit allowance is charged here.';
  }
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
    completion_stage: input.completionStage,
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
      construction_cash_expenditure_cad: round(directCashBeforeTax),
      initial_cash_contribution_cad: round(financing.down_payment_cad),
      financed_principal_cad: round(financing.financed_principal_cad),
      owner_labour_imputed_cad: round(ownerImputed),
      completed_dwelling_capital_cad: round(economicCapital),
      economic_cost_cad: round(economicCapital),
      cash_plus_owner_labour_equals_economic: Math.abs(economicCapital - (upfrontCash + ownerImputed)) < .005,
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
      legacy_exact_integrated_total_cad: legacy.legacy_exact_integrated_total_cad,
      legacy_public_rounded_total_cad: legacy.legacy_public_rounded_total_cad,
      historical_scope_components: legacy.legacy_scope_components,
      former_model_reference: evidence.former_model_reference,
      bridge_rows: [
        {component: 'Water / plumbing / sanitation', original_scope: 'Inclusive package', original_amount_cad: 5940, former_model_amount_cad: evidence.former_model_reference.component_cash_costs.water_plumbing + evidence.former_model_reference.component_cash_costs.sanitation_greywater, new_scope: 'One inclusive package; included labour and fee decomposed, not added again', new_amount_cad: activeRows.find((row) => row.id === 'water_plumbing_sanitation')?.cash_cost_cad ?? 0, delta_from_former_model_cad: roundSigned((activeRows.find((row) => row.id === 'water_plumbing_sanitation')?.cash_cost_cad ?? 0) - (evidence.former_model_reference.component_cash_costs.water_plumbing + evidence.former_model_reference.component_cash_costs.sanitation_greywater)), evidence: 'Historical ARC design brief; original itemized quotation unrecovered.'},
        {component: 'Hot water', original_scope: 'Inclusive package including integration labour', original_amount_cad: 2000, former_model_amount_cad: evidence.former_model_reference.component_cash_costs.hot_water, new_scope: 'One inclusive package; labour allowance is replaced only by a labour override', new_amount_cad: activeRows.find((row) => row.id === 'hot_water')?.cash_cost_cad ?? 0, delta_from_former_model_cad: roundSigned((activeRows.find((row) => row.id === 'hot_water')?.cash_cost_cad ?? 0) - evidence.former_model_reference.component_cash_costs.hot_water), evidence: 'Historical ARC design brief; original itemized quotation unrecovered.'},
        {component: 'Household electrical', original_scope: 'Inclusive off-grid package including qualified labour and inspection allowance', original_amount_cad: 3300, former_model_amount_cad: evidence.former_model_reference.component_cash_costs.household_electrical, new_scope: 'One inclusive package; labour and inspection allowance exposed inside package', new_amount_cad: activeRows.find((row) => row.id === 'household_electrical')?.cash_cost_cad ?? 0, delta_from_former_model_cad: roundSigned((activeRows.find((row) => row.id === 'household_electrical')?.cash_cost_cad ?? 0) - evidence.former_model_reference.component_cash_costs.household_electrical), evidence: 'Historical ARC design brief; original itemized quotation unrecovered.'},
        {component: 'General permits', original_scope: 'The utility package includes CAD 600 permit allowance', original_amount_cad: 0, former_model_amount_cad: evidence.former_model_reference.component_cash_costs.permits, new_scope: 'Residual general permit allowance after CAD 600 package offset', new_amount_cad: activeRows.find((row) => row.id === 'permits')?.cash_cost_cad ?? 0, delta_from_former_model_cad: roundSigned((activeRows.find((row) => row.id === 'permits')?.cash_cost_cad ?? 0) - evidence.former_model_reference.component_cash_costs.permits), evidence: 'Historical ARC package detail plus current municipal-fee placeholder.'}
      ],
      bridge: {
        former_model_economic_capital_cad: evidence.former_model_reference.economic_capital_cad,
        corrected_economic_capital_cad: economicCapital,
        direct_cash_delta_cad: directCashBeforeTax - evidence.former_model_reference.direct_cash_before_tax_cad,
        tax_delta_cad: taxes - evidence.former_model_reference.taxes_cad,
        contingency_delta_cad: contingency - evidence.former_model_reference.contingency_cad,
        owner_labour_delta_cad: ownerImputed - evidence.former_model_reference.owner_labour_imputed_cad,
        total_delta_cad: economicCapital - evidence.former_model_reference.economic_capital_cad,
        explanation: 'The bridge isolates corrected bundled-package/permit overlap, then recomputes tax and contingency on the lower cash base. Owner-labour valuation is unchanged. Structure, kitchen/bath fit-out and other planning-rate differences remain visible as unresolved scope/pricing differences rather than hidden offsets.'
      },
      explanation: 'The legacy CAD 61,000 was an integrated planning benchmark with a historical exact sum of CAD 61,240. This model keeps that reference beside an independently itemized scope, corrects bundled utility labour and permit overlap, and distinguishes cash construction budget, owner-labour economic value, taxes, contingency and financing.'
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

const MARKET_BAND_FACTORS = marketEvidence.planning_band_factors;
const MARKET_REFERENCE_AREA_M2 = Math.PI * (9.144 / 2) ** 2;

function marketPrice(value, band) {
  return nonNegative(value) * finite(MARKET_BAND_FACTORS[band], 1);
}

function packageForOptions(input) {
  const priced = marketEvidence.yurt_packages.filter((row) => finite(row.price_cad, 0) > 0);
  const requested = input.yurtPackageId ? marketEvidence.yurt_packages.find((row) => row.id === input.yurtPackageId) : null;
  const supplierId = input.yurtSupplierId ?? 'yurts_canada';
  const supplierPriced = priced.filter((row) => row.supplier_id === supplierId);
  const candidates = supplierPriced.length ? supplierPriced : priced.filter((row) => row.supplier_id === 'yurts_canada');
  const exact = requested?.price_cad ? requested : candidates.find((row) => Math.abs(row.diameter_m - input.design.diameter_m) < 0.0001);
  if (exact) return {...exact, selection_method: 'exact_published_or_selected_package', source: marketEvidence.suppliers.find((row) => row.id === exact.supplier_id)};
  const ordered = [...candidates].sort((a, b) => a.diameter_m - b.diameter_m);
  const lower = [...ordered].reverse().find((row) => row.diameter_m <= input.design.diameter_m) ?? ordered[0];
  const upper = ordered.find((row) => row.diameter_m >= input.design.diameter_m) ?? ordered.at(-1);
  const denominator = upper.diameter_m - lower.diameter_m;
  const proportion = denominator ? (input.design.diameter_m - lower.diameter_m) / denominator : 0;
  const price = lower.price_cad + (upper.price_cad - lower.price_cad) * proportion;
  const extrapolated = input.design.diameter_m < ordered[0].diameter_m || input.design.diameter_m > ordered.at(-1).diameter_m;
  return {
    ...upper,
    id: `${supplierId}_interpolated_${input.design.diameter_m.toFixed(3)}`,
    diameter_m: input.design.diameter_m,
    diameter_label: `${input.design.diameter_m.toFixed(3)} m custom`,
    price_cad: price,
    selection_method: extrapolated ? 'extrapolated_from_nearest_published_sizes' : 'linear_interpolation_between_published_sizes',
    interpolation: {lower_package_id: lower.id, upper_package_id: upper.id, proportion, extrapolated},
    source: marketEvidence.suppliers.find((row) => row.id === upper.supplier_id)
  };
}

function marketThresholdEffects(geometry, band) {
  const applied = [];
  const additions = new Map();
  // Store threshold additions at their base value. The row renderer applies the
  // selected planning band exactly once, just like every other material rate.
  const add = (id, amount) => additions.set(id, (additions.get(id) ?? 0) + finite(amount));
  if (geometry.inputs.diameter_m > 9.144) {
    applied.push({id: 'large_diameter_9_144', label: 'Diameter above 9.144 m', trigger: 'diameter_m > 9.144', confidence: 'provisional', source: 'Yurt package and platform load-path changes above the priced 30 ft reference require supplier and engineer confirmation.', additions: [{component_id: 'purchased_yurt_package', amount_cad: marketPrice(1400, band)}, {component_id: 'platform_bom', amount_cad: marketPrice(1000, band)}, {component_id: 'design_engineering', amount_cad: marketPrice(500, band)}]});
    add('purchased_yurt_package', 1400);
    add('platform_bom', 1000);
    add('design_engineering', 500);
  }
  if (geometry.inputs.diameter_m > 10.668) {
    applied.push({id: 'large_diameter_10_668', label: 'Diameter above 10.668 m', trigger: 'diameter_m > 10.668', confidence: 'provisional', source: 'Larger span and snow/wind load path require quotation and engineering.', additions: [{component_id: 'purchased_yurt_package', amount_cad: marketPrice(2400, band)}, {component_id: 'platform_bom', amount_cad: marketPrice(1800, band)}, {component_id: 'design_engineering', amount_cad: marketPrice(1000, band)}]});
    add('purchased_yurt_package', 2400);
    add('platform_bom', 1800);
    add('design_engineering', 1000);
  }
  if (geometry.inputs.roof_pitch_degrees > 35) {
    applied.push({id: 'roof_pitch_above_35', label: 'Roof pitch above 35 degrees', trigger: 'roof_pitch_degrees > 35', confidence: 'provisional', source: 'Planning allowance for changed roof geometry and connections; not a code threshold.', rate_multipliers: [{component_id: 'purchased_yurt_package', multiplier: 1.15}]});
  }
  return {applied, additions};
}

function quantityForPlatformRow(row, geometry, overrides) {
  if (overrides[row.id] != null) return nonNegative(overrides[row.id]);
  const area = geometry.footprint_m2;
  const perimeter = geometry.perimeter_m;
  const waste = finite(marketEvidence.platform_design.waste_factor, 0.1);
  const material = marketEvidence.material_catalog.find((item) => item.id === row.material_id);
  if (row.id === 'platform_support_blocks') return Math.max(1, Math.ceil((36 * area / MARKET_REFERENCE_AREA_M2) - 1e-5));
  if (row.id === 'platform_pt_beams') return Math.ceil((perimeter * 1.35 / finite(material?.coverage, 4.8768)) * (1 + waste));
  if (row.id === 'platform_joists') return Math.ceil((area * 0.75 / finite(material?.coverage, 4.8768)) * (1 + waste));
  if (row.id === 'platform_decking' || row.id === 'platform_floor_insulation' || row.id === 'platform_vapour_layer') return Math.ceil(area * (1 + waste) / finite(material?.coverage, area));
  return 1;
}

function labourShares(mode, eligible) {
  if (!eligible) return {paid: 1, owner: 0};
  const definition = evidence.labour_modes[mode];
  return {paid: finite(definition?.paid_labour_share, 1), owner: finite(definition?.owner_labour_share, 0)};
}

function pricedMarketRow({id, label, stage, quantity, unit, rate, labourHours = 0, labourIncludedCash = 0, fee = 0, ownerEligible = true, status, sourceNote, sourceUrl, priceDate, evidenceStatus, driver, scope = [], packageId = null, sourcePackageId = null, packageScope = [], thresholdAddition = 0, materialId = null, input, quantityOverride = false}) {
  const shares = labourShares(input.labourMode, ownerEligible);
  const overrideKey = materialId && input.materialPriceOverrides[materialId] != null ? materialId : id;
  const selectedRate = input.materialPriceOverrides[overrideKey] == null ? rate : nonNegative(input.materialPriceOverrides[overrideKey]);
  const selectedLabourIncludedCash = input.materialPriceOverrides[id] != null && labourIncludedCash > 0 ? nonNegative(input.materialPriceOverrides[id]) : labourIncludedCash;
  const materialCost = marketPrice(selectedRate * quantity, input.band) + marketPrice(thresholdAddition, input.band);
  const includedLabour = marketPrice(selectedLabourIncludedCash * quantity, input.band);
  const paidCash = includedLabour || labourHours > 0 ? includedLabour + labourHours * shares.paid * input.labourRateCadPerHour : 0;
  const ownerHours = labourHours * shares.owner;
  const ownerImputed = ownerHours * input.ownerLabourValueRateCadPerHour;
  const feeCost = marketPrice(fee * quantity, input.band);
  const cash = materialCost + paidCash + feeCost;
  return {
    id, label, stage, driver, unit,
    quantity: round(quantity, 4),
    base_unit_rate_cad: round(selectedRate, 2),
    unit_rate_cad: round(marketPrice(selectedRate, input.band), 2),
    base_material_cost_cad: round(selectedRate * quantity),
    threshold_addition_cad: round(thresholdAddition),
    material_cost_cad: round(materialCost),
    package_id: packageId,
    source_package_id: sourcePackageId,
    package_total_cad: packageId ? round(materialCost + includedLabour + feeCost) : null,
    package_included_paid_labour_cad: packageId && labourIncludedCash ? round(includedLabour) : null,
    package_included_fee_cad: packageId && fee ? round(feeCost) : null,
    package_non_labour_cost_cad: packageId ? round(materialCost + feeCost) : null,
    package_included_installation: packageScope.includes('mandatory supplier installation'),
    package_labour_override_delta_cad: 0,
    package_scope: packageScope,
    package_source_note: packageId ? sourceNote : null,
    labour_hours_total: round(labourHours + (includedLabour / Math.max(0.01, input.labourRateCadPerHour)), 3),
    paid_labour_hours: round((includedLabour / Math.max(0.01, input.labourRateCadPerHour)) + labourHours * shares.paid, 3),
    owner_labour_hours: round(ownerHours, 3),
    paid_labour_cash_cad: round(paidCash),
    owner_labour_imputed_cad: round(ownerImputed),
    cash_cost_cad: round(cash),
    economic_capital_cad: round(cash + ownerImputed),
    owner_eligible: ownerEligible,
    active: true,
    taxable: true,
    status: status ?? evidenceStatus ?? 'provisional',
    evidence_status: evidenceStatus ?? status ?? 'provisional',
    source_note: sourceNote ?? null,
    source_url: sourceUrl ?? null,
    price_date: priceDate ?? marketEvidence.price_basis_date,
    source_service_rate: false,
    scope_ids: scope,
    excludes_scope_ids: [],
    material_id: materialId,
    quantity_override_used: quantityOverride,
    material_price_override_used: input.materialPriceOverrides[overrideKey] != null
  };
}

function utilityPackageBundle(servicingMode) {
  const ids = servicingMode === 'arc_household_systems'
    ? ['arc_household_systems', 'hot_water', 'household_electrical']
    : [servicingMode];
  const records = ids.map((id) => marketEvidence.utility_packages[id] ? {id, ...marketEvidence.utility_packages[id]} : null).filter(Boolean);
  if (!records.length) return null;
  return {
    id: `utility_${servicingMode}`,
    label: records.map((record) => record.label).join(' + '),
    status: records.map((record) => record.status).join('; '),
    rows: records.flatMap((record) => record.rows.map((row) => ({...row, source_package_id: record.id, source_package_label: record.label})))
  };
}

function firstPrinciplesUtilityRows(input) {
  const mode = utilityPackageBundle(input.servicingMode);
  if (mode) {
    return mode.rows.map((row) => pricedMarketRow({
      id: row.id,
      label: row.label,
      stage: 'completed',
      quantity: input.quantityOverrides[row.id] == null ? finite(row.quantity, 1) : nonNegative(input.quantityOverrides[row.id]),
      unit: row.unit,
      rate: row.category === 'paid_labour' || row.category === 'fees' ? 0 : finite(row.unit_price_cad),
      labourIncludedCash: row.category === 'paid_labour' ? finite(row.unit_price_cad) : 0,
      fee: row.category === 'fees' ? finite(row.unit_price_cad) : 0,
      labourHours: 0,
      ownerEligible: false,
      status: row.evidence_status,
      evidenceStatus: row.evidence_status,
      sourceNote: row.note ?? mode.label,
      sourceUrl: row.material_id ? marketEvidence.material_catalog.find((material) => material.id === row.material_id)?.source_url : null,
      materialId: row.material_id ?? null,
      input,
      packageId: mode.id,
      // Keep the original utility-package boundary on every priced row. The
      // fallback protects hand-authored/older source records that predate the
      // normalized source_package_id field.
      sourcePackageId: row.source_package_id ?? mode.id,
      packageScope: [row.source_package_label ?? mode.label]
    }));
  }
  const legacyMode = evidence.servicing_modes[input.servicingMode] ?? evidence.servicing_modes.arc_household_systems;
  const genericMap = {water_plumbing_sanitation: 'water_plumbing_sanitation', household_electrical: 'household_electrical', hot_water: 'hot_water'};
  return Object.entries(legacyMode.components).map(([id, amount]) => pricedMarketRow({id: `alternative_${id}`, label: `${legacyMode.label}: ${id}`, stage: 'completed', quantity: 1, unit: 'CAD/dwelling', rate: finite(amount), ownerEligible: false, status: 'alternative_package_placeholder', sourceNote: legacyMode.description, input, packageId: `alternative_${input.servicingMode}`, packageScope: [genericMap[id] ?? id]}));
}

function calculateFirstPrinciplesHouseCost(options = {}) {
  const input = normalizeOptions(options);
  const geometry = calculateYurtGeometry(input.design);
  const yurtPackage = packageForOptions(input);
  const threshold = marketThresholdEffects(geometry, input.band);
  const rows = [];
  rows.push(pricedMarketRow({
    id: 'purchased_yurt_package',
    label: `${yurtPackage.source?.name ?? 'Yurt supplier'} ${yurtPackage.diameter_label} Base Kit`,
    stage: 'shell',
    quantity: 1,
    unit: 'CAD/package',
    rate: finite(yurtPackage.price_cad) * (threshold.applied.some((row) => row.id === 'roof_pitch_above_35') ? 1.15 : 1),
    thresholdAddition: finite(threshold.additions.get('purchased_yurt_package')),
    labourHours: 0,
    ownerEligible: false,
    status: yurtPackage.evidence_status,
    evidenceStatus: yurtPackage.evidence_status,
    sourceNote: `${yurtPackage.source?.note ?? ''} Published package inclusions: ${(yurtPackage.included ?? []).join('; ')}. Exclusions: ${(yurtPackage.excluded ?? []).join('; ')}. Selection: ${yurtPackage.selection_method}.`,
    sourceUrl: yurtPackage.source?.source_url,
    priceDate: yurtPackage.source?.observed_date,
    input,
    packageId: yurtPackage.id,
    packageScope: yurtPackage.included ?? []
  }));
  const platformRows = marketEvidence.platform_design.rows.map((spec) => {
    const material = marketEvidence.material_catalog.find((item) => item.id === spec.material_id);
    const quantity = quantityForPlatformRow(spec, geometry, input.quantityOverrides);
    return pricedMarketRow({id: spec.id, label: spec.label, stage: 'shell', quantity, unit: spec.unit, rate: finite(spec.unit_price_cad ?? material?.unit_price_cad), labourHours: quantity * (spec.id === 'platform_connectors' ? 4 : 0.55), ownerEligible: true, status: spec.evidence_status, evidenceStatus: spec.evidence_status, sourceNote: `${spec.quantity_formula}; ${spec.scope}. ${marketEvidence.platform_design.engineering_note}`, sourceUrl: material?.source_url, materialId: spec.material_id, driver: spec.driver, scope: [spec.scope], thresholdAddition: spec.id === 'platform_connectors' ? 0 : finite(threshold.additions.get('platform_bom'), 0) * (spec.id === 'platform_joists' ? 1 : 0), input, quantityOverride: input.quantityOverrides[spec.id] != null});
  });
  rows.push(...platformRows);
  const addRows = marketEvidence.additional_assemblies.map((spec) => {
    let quantity = componentQuantity({driver: spec.driver}, geometry, input.quantityOverrides);
    if (spec.id === 'additional_interior_liner_and_furring') quantity = 0;
    if (spec.id === 'additional_windows') quantity = Math.max(0, geometry.inputs.window_count - finite(spec.included_default_windows, 0));
    if (spec.id === 'additional_doors') quantity = Math.max(0, geometry.inputs.door_count - finite(spec.included_default_doors, 1));
    const unitRate = finite(spec.central_rate_cad);
    const hours = finite(spec.labour_hours, spec.labour_hours_per_unit ?? spec.labour_hours_per_m2 ?? 0) * quantity;
    return pricedMarketRow({id: spec.id, label: spec.label, stage: spec.stage, quantity, unit: spec.unit, rate: unitRate, labourHours: hours, ownerEligible: !['wood_stove_and_chimney', 'balanced_ventilation', 'delivery_logistics', 'design_engineering', 'permits'].includes(spec.id), status: spec.evidence_status, evidenceStatus: spec.evidence_status, sourceNote: spec.note, sourceUrl: null, driver: spec.driver, thresholdAddition: finite(threshold.additions.get(spec.id)), input, quantityOverride: input.quantityOverrides[spec.id] != null});
  });
  rows.push(...addRows);
  if (input.servicingMode === 'centralized_shared_services') {
    rows.push(...firstPrinciplesUtilityRows(input));
  } else {
    rows.push(...firstPrinciplesUtilityRows(input));
  }
  const activeRows = rows.filter((row) => row.active && row.quantity > 0).map((row) => ({...row, pricing_layer: pricingLayerForRow(row)}));
  const itemizedPackage = utilityPackageBundle(input.servicingMode);
  const serviceComponents = itemizedPackage
    ? Object.fromEntries([...new Set(itemizedPackage.rows.map((row) => row.source_package_id))].map((packageId) => [packageId, round(sum(activeRows.filter((row) => row.source_package_id === packageId), 'cash_cost_cad'))]))
    : Object.fromEntries(activeRows.filter((row) => row.package_id === `alternative_${input.servicingMode}`).map((row) => [row.id, round(row.cash_cost_cad)]));
  const directCashBeforeTax = sum(activeRows, 'cash_cost_cad');
  const taxableCash = activeRows.filter((row) => row.taxable).reduce((total, row) => total + finite(row.cash_cost_cad), 0);
  const taxes = taxableCash * input.taxRate;
  const contingency = (directCashBeforeTax + taxes) * input.contingencyRate;
  const additionalRows = [
    {id: 'taxes', label: 'Taxes / HST allowance', driver: 'taxable cash cost', unit: 'CAD', quantity: input.taxRate, unit_rate_cad: taxableCash, cash_cost_cad: taxes, economic_capital_cad: taxes, pricing_layer: 'project_costs', status: 'provisional_tax_treatment', source_note: 'Tax treatment and any new-housing rebate require project-specific review.'},
    {id: 'contingency', label: 'Contingency', driver: 'pre-contingency cash', unit: 'CAD', quantity: input.contingencyRate, unit_rate_cad: directCashBeforeTax + taxes, cash_cost_cad: contingency, economic_capital_cad: contingency, pricing_layer: 'project_costs', status: 'campaign_planning_assumption', source_note: 'Explicit planning allowance; not a hidden calibration adjustment.'}
  ];
  const upfrontCash = directCashBeforeTax + taxes + contingency;
  const ownerImputed = sum(activeRows, 'owner_labour_imputed_cad');
  const economicCapital = upfrontCash + ownerImputed;
  const customQuote = input.customCompletedQuoteCad != null;
  const headlineCapital = customQuote ? input.customCompletedQuoteCad : upfrontCash;
  const financing = financeCapital({value: headlineCapital, ownership: input.financing.ownership, downPaymentRate: input.financing.downPaymentRate, interestRateAnnual: input.financing.interestRateAnnual, amortizationYears: input.financing.amortizationYears, loanTermYears: input.financing.loanTermYears});
  const stageRows = (stage) => activeRows.filter((row) => stage === 'shell' ? row.stage === 'shell' : stage === 'insulated_heated' ? ['shell', 'insulated_heated'].includes(row.stage) : true);
  const stageTotal = (stage) => sum(stageRows(stage), 'cash_cost_cad');
  const allLayerRows = [...activeRows, ...additionalRows];
  let cumulativeLayerCash = 0;
  let cumulativeLayerEconomic = 0;
  const pricingLayers = HOUSE_COST_PRICING_LAYERS.map((definition) => {
    const layerRows = allLayerRows.filter((row) => row.pricing_layer === definition.id);
    const incrementalCash = sum(layerRows, 'cash_cost_cad');
    const incrementalEconomic = sum(layerRows, 'economic_capital_cad');
    cumulativeLayerCash += incrementalCash;
    cumulativeLayerEconomic += incrementalEconomic;
    return {...definition, incremental_cash_cost_cad: round(incrementalCash), incremental_economic_cost_cad: round(incrementalEconomic), cumulative_cash_cost_cad: round(cumulativeLayerCash), cumulative_economic_cost_cad: round(cumulativeLayerEconomic), component_ids: layerRows.map((row) => row.id)};
  });
  const selectedLayerIndex = Math.max(0, (COMPLETION_STAGE_LAYER_COUNTS[input.completionStage] ?? 1) - 1);
  const selectedLayer = pricingLayers[selectedLayerIndex] ?? pricingLayers[0];
  const selectedLayerIds = new Set(pricingLayers.slice(0, selectedLayerIndex + 1).map((layer) => layer.id));
  const selectedRows = allLayerRows.filter((row) => selectedLayerIds.has(row.pricing_layer));
  const selectedCash = sum(selectedRows, 'cash_cost_cad');
  const selectedEconomic = sum(selectedRows, 'economic_capital_cad');
  const selectedHeadlineCapital = customQuote && input.completionStage === 'basic_completed_arc' ? input.customCompletedQuoteCad : selectedCash;
  const selectedFinancing = financeCapital({value: selectedHeadlineCapital, ownership: input.financing.ownership, downPaymentRate: input.financing.downPaymentRate, interestRateAnnual: input.financing.interestRateAnnual, amortizationYears: input.financing.amortizationYears, loanTermYears: input.financing.loanTermYears});
  const sourceList = [...evidence.sources, ...marketEvidence.suppliers.map((supplier) => ({id: supplier.id, institution: supplier.name, title: 'Yurt package and price evidence', url: supplier.source_url, classification: supplier.price_status, note: supplier.note})), ...marketEvidence.material_catalog.filter((row) => row.source_url).map((row) => ({id: row.id, institution: row.label.split(' ')[0], title: row.label, url: row.source_url, classification: row.evidence_status, note: `Observed ${row.price_date}; ${row.note ?? ''}`}))];
  const legacy = evidence.legacy_arc_benchmark;
  const formerModel = evidence.former_model_reference;
  const currentPackageCash = (packageId) => round(sum(activeRows.filter((row) => row.source_package_id === packageId), 'cash_cost_cad'));
  const currentComponentCash = (rowId) => round(sum(activeRows.filter((row) => row.id === rowId), 'cash_cost_cad'));
  const bridgeRows = [
    {component: 'Water / plumbing / sanitation', original_scope: 'Inclusive package', original_amount_cad: 5940, former_model_amount_cad: formerModel.component_cash_costs.water_plumbing + formerModel.component_cash_costs.sanitation_greywater, new_scope: 'One inclusive package; included labour and fee decomposed, not added again', new_amount_cad: currentPackageCash('arc_household_systems'), evidence: 'Historical ARC design brief; original itemized quotation unrecovered.'},
    {component: 'Hot water', original_scope: 'Inclusive package including integration labour', original_amount_cad: 2000, former_model_amount_cad: formerModel.component_cash_costs.hot_water, new_scope: 'One inclusive package; labour allowance is replaced only by a labour override', new_amount_cad: currentPackageCash('hot_water'), evidence: 'Historical ARC design brief; original itemized quotation unrecovered.'},
    {component: 'Household electrical', original_scope: 'Inclusive off-grid package including qualified labour and inspection allowance', original_amount_cad: 3300, former_model_amount_cad: formerModel.component_cash_costs.household_electrical, new_scope: 'One inclusive package; labour and inspection allowance exposed inside package', new_amount_cad: currentPackageCash('household_electrical'), evidence: 'Historical ARC design brief; original itemized quotation unrecovered.'},
    {component: 'General permits', original_scope: 'The utility package includes CAD 600 permit allowance', original_amount_cad: 0, former_model_amount_cad: formerModel.component_cash_costs.permits, new_scope: 'Residual general permit allowance after CAD 600 package offset', new_amount_cad: currentComponentCash('permits'), evidence: 'Historical ARC package detail plus current municipal-fee placeholder.'}
  ].map((row) => ({...row, delta_from_former_model_cad: roundSigned(row.new_amount_cad - row.former_model_amount_cad)}));
  const formerModelBridge = {
    former_model_economic_capital_cad: formerModel.economic_capital_cad,
    corrected_economic_capital_cad: economicCapital,
    direct_cash_delta_cad: directCashBeforeTax - formerModel.direct_cash_before_tax_cad,
    tax_delta_cad: taxes - formerModel.taxes_cad,
    contingency_delta_cad: contingency - formerModel.contingency_cad,
    owner_labour_delta_cad: ownerImputed - formerModel.owner_labour_imputed_cad,
    total_delta_cad: economicCapital - formerModel.economic_capital_cad,
    explanation: 'The bridge isolates corrected bundled-package/permit overlap, then recomputes tax and contingency on the changed cash base. Contributed owner-labour value is shown separately; its delta reflects the changed task scope and labour basis. Structure, kitchen/bath fit-out and other planning-rate differences remain visible as unresolved scope/pricing differences rather than hidden offsets.'
  };
  return {
    contract_version: HOUSE_COST_CONTRACT_VERSION,
    model_id: HOUSE_COST_MODEL_ID,
    package_label: 'First-principles yurt package plus quantity-based completion model',
    price_basis_date: marketEvidence.price_basis_date,
    pricing_model: marketEvidence.pricing_model_id,
    band: input.band,
    completion_stage: input.completionStage,
    design: geometry.inputs,
    geometry,
    supplier_package: {...yurtPackage, selected_price_cad: round(marketPrice(yurtPackage.price_cad, input.band)), published_price_cad: yurtPackage.price_cad, price_currency: 'CAD', source_url: yurtPackage.source?.source_url, inclusion_matrix: marketEvidence.package_inclusion_matrix.rows.find((row) => row.package_id === yurtPackage.id) ?? null},
    servicing: {mode: input.servicingMode, label: evidence.servicing_modes[input.servicingMode]?.label, description: evidence.servicing_modes[input.servicingMode]?.description, status: itemizedPackage?.status ?? 'alternative_package_placeholder', components: serviceComponents, historical_reference_components: evidence.servicing_modes[input.servicingMode]?.components ?? null, shared_infrastructure_additions: evidence.servicing_modes[input.servicingMode]?.shared_infrastructure_additions ?? {}, itemized_package: itemizedPackage},
    labour: {mode: input.labourMode, ...evidence.labour_modes[input.labourMode], labour_rate_cad_per_hour: input.labourRateCadPerHour, owner_labour_value_rate_cad_per_hour: input.ownerLabourValueRateCadPerHour, paid_hours: round(sum(activeRows, 'paid_labour_hours'), 2), owner_hours: round(sum(activeRows, 'owner_labour_hours'), 2), paid_labour_cash_cad: round(sum(activeRows, 'paid_labour_cash_cad')), owner_labour_imputed_cad: round(ownerImputed), total_labour_hours: round(sum(activeRows, 'labour_hours_total'), 2)},
    components: activeRows,
    inactive_components: [...rows.filter((row) => !row.active), ...marketEvidence.additional_assemblies.filter((row) => row.id === 'additional_interior_liner_and_furring').map((row) => ({id: row.id, label: row.label, active: false, status: 'included_by_supplier_package', source_note: row.note}))],
    additional_costs: additionalRows,
    thresholds: {applied: threshold.applied, all_rules: [...evidence.threshold_rules, ...threshold.applied.filter((row) => !evidence.threshold_rules.some((rule) => rule.id === row.id))]},
    pricing_layers: pricingLayers,
    selected_stage: {id: input.completionStage, label: COMPLETION_STAGE_PRESENTATION[input.completionStage].label, description: COMPLETION_STAGE_PRESENTATION[input.completionStage].description, layer_ids: pricingLayers.slice(0, selectedLayerIndex + 1).map((layer) => layer.id), cash_cost_cad: round(selectedCash), economic_cost_cad: round(selectedEconomic), financing_value_cad: round(selectedHeadlineCapital), initial_cash_contribution_cad: round(selectedFinancing.down_payment_cad), financed_principal_cad: round(selectedFinancing.financed_principal_cad), remaining_layer_ids: pricingLayers.slice(selectedLayerIndex + 1).map((layer) => layer.id)},
    stages: {shell: {cash_cost_cad: round(stageTotal('shell')), includes: ['purchased_yurt_package', 'platform BOM', 'additional openings']}, insulated_heated_structure: {cash_cost_cad: round(stageTotal('insulated_heated')), includes: ['shell', 'interior finish', 'heating', 'ventilation']}, completed_before_tax_and_contingency: {cash_cost_cad: round(directCashBeforeTax), includes: activeRows.map((row) => row.id)}, completed_dwelling: {cash_cost_cad: round(upfrontCash), economic_capital_cad: round(economicCapital), includes: [...activeRows.map((row) => row.id), 'taxes', 'contingency']}},
    totals: {direct_cash_before_tax_cad: round(directCashBeforeTax), taxes_cad: round(taxes), contingency_cad: round(contingency), upfront_cash_required_cad: round(upfrontCash), construction_cash_expenditure_cad: round(directCashBeforeTax), initial_cash_contribution_cad: round(financing.down_payment_cad), financed_principal_cad: round(financing.financed_principal_cad), owner_labour_imputed_cad: round(ownerImputed), completed_dwelling_capital_cad: round(economicCapital), economic_cost_cad: round(economicCapital), selected_stage_cash_cost_cad: round(selectedCash), selected_stage_economic_cost_cad: round(selectedEconomic), cash_plus_owner_labour_equals_economic: Math.abs(economicCapital - upfrontCash - ownerImputed) < .005, headline_financed_value_cad: round(headlineCapital), custom_quote_applied: customQuote, quote_delta_unallocated_cad: customQuote ? roundSigned(input.customCompletedQuoteCad - economicCapital) : 0, financing_basis: customQuote ? 'custom_completed_quote' : 'upfront_cash_excluding_contributed_owner_labour'},
    financing: {...financing, assumption_status: 'illustrative_dwelling_financing_scenario', loan_term_vs_amortization: 'Loan term/renewal is separate from the amortization period used to calculate scheduled payment.'},
    selected_financing: {...selectedFinancing, assumption_status: 'illustrative_dwelling_financing_scenario', loan_term_vs_amortization: 'Loan term/renewal is separate from the amortization period used to calculate scheduled payment.'},
    legacy_reconciliation: {legacy_range_cad: legacy.range_cad, legacy_central_cad: legacy.range_cad.central, legacy_diameter_m_rounded: legacy.diameter_m_rounded, model_diameter_m: geometry.inputs.diameter_m, legacy_gross_floor_area_m2: legacy.gross_floor_area_m2, model_gross_floor_area_m2: geometry.gross_floor_area_m2, model_completed_economic_capital_cad: round(economicCapital), delta_from_legacy_central_cad: roundSigned(economicCapital - legacy.range_cad.central), legacy_exact_integrated_total_cad: legacy.legacy_exact_integrated_total_cad, legacy_public_rounded_total_cad: legacy.legacy_public_rounded_total_cad, historical_scope_components: legacy.legacy_scope_components, former_model_reference: formerModel, bridge_rows: bridgeRows, bridge: formerModelBridge, explanation: 'The historical CAD 61,000 is retained for comparison only. It is not an input, rate, calibration target or residual in this first-principles model.'},
    accounting: {component_sum_check: round(activeRows.reduce((total, row) => total + row.cash_cost_cad, 0) + taxes + contingency) === round(upfrontCash), component_rows_plus_additional_cad: round(sum(activeRows, 'cash_cost_cad') + sum(additionalRows, 'cash_cost_cad')), pricing_layer_sum_check: round(cumulativeLayerCash) === round(upfrontCash), pricing_layer_economic_sum_check: Math.abs(cumulativeLayerEconomic - economicCapital) < .05, pricing_layer_economic_residual_cad: roundSigned(cumulativeLayerEconomic - economicCapital, 4), upfront_cash_required_cad: round(upfrontCash), resident_owned_dwelling_only: true, excludes: ['land purchase', 'site lease', 'shared infrastructure operating charges', 'household operating expenses'], utility_single_home: input.servicingMode !== 'centralized_shared_services', no_historical_input_used: true, package_included_items_not_repriced: true},
    input_status: {dimensions: 'derived_from_geometry_and_user_input', supplier_package_price: yurtPackage.evidence_status, material_prices: 'published_retail_price_or_explicit_provisional_allowance', thresholds: 'provisional_until_engineered', labour_rates: 'planning_labour_allowance_or_quote_required', taxes: 'site_specific_tax_review_required', financing: 'illustrative_financing_scenario'},
    evidence: sourceList,
    market_evidence: {contract_version: marketEvidence.contract_version, pricing_model_id: marketEvidence.pricing_model_id, supplier_count: marketEvidence.suppliers.length, package_count: marketEvidence.yurt_packages.length, material_count: marketEvidence.material_catalog.length, package_inclusion_matrix: marketEvidence.package_inclusion_matrix, platform_design: marketEvidence.platform_design, utility_packages: marketEvidence.utility_packages, additional_assemblies: marketEvidence.additional_assemblies, planning_band_factors: marketEvidence.planning_band_factors},
    assumptions: {tax_rate: input.taxRate, contingency_rate: input.contingencyRate, custom_quote: input.customCompletedQuoteCad, package_selection: yurtPackage.selection_method, completion_stage: input.completionStage}
  };
}

export function calculateHouseCost(options = {}) {
  return calculateFirstPrinciplesHouseCost(options);
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
    pricing_layers: HOUSE_COST_PRICING_LAYERS,
    labour_modes: evidence.labour_modes,
    servicing_modes: evidence.servicing_modes,
    service_package_accounting: evidence.service_package_accounting,
    tax_and_contingency: evidence.tax_and_contingency,
    component_evidence: evidence.components,
    pricing_model: marketEvidence.pricing_model_id,
    market_evidence: marketEvidence,
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
  const selected = houseCost.selected_stage ?? {id: 'basic_completed_arc', label: 'Basic completed ARC dwelling', cash_cost_cad: houseCost.totals.upfront_cash_required_cad, economic_cost_cad: houseCost.totals.economic_cost_cad};
  const financing = houseCost.selected_financing ?? houseCost.financing;
  return {
    contract_version: HOUSE_COST_CONTRACT_VERSION,
    dwelling_capital_cad: selected.economic_cost_cad,
    upfront_cash_required_cad: selected.cash_cost_cad,
    dwelling_financing_monthly_cad: financing.monthly_debt_service_cad,
    completion_stage: selected.id,
    completion_stage_label: selected.label,
    included_layer_ids: selected.layer_ids ?? [],
    outstanding_layer_ids: selected.remaining_layer_ids ?? [],
    land_and_shared_infrastructure_monthly_cad: monthlyLandAndInfrastructure,
    combined_monthly_cad: monthlyLandAndInfrastructure == null ? null : round(financing.monthly_debt_service_cad + monthlyLandAndInfrastructure),
    accounting_boundary: 'resident-owned dwelling is separate from ARC site lease and shared infrastructure; centralized servicing additions are not silently added to either layer'
  };
}
