const round = (value, digits = 6) => Math.round(Number(value) * 10 ** digits) / 10 ** digits;

export const DEFAULT_ESTABLISHMENT_YEARS = [1, 2, 3, 5, 8, 10, 15, 'mature'];
export const DEFAULT_ANNUAL_INTERCROP_OVERLAP = {1: .75, 2: .75, 3: .60, 5: .40, 8: .15, 10: .05, 15: 0, mature: 0};

function interpolate(anchors = {}, year) {
  if (year === 'mature') return 1;
  const points = Object.entries(anchors).map(([key, value]) => [Number(key), Number(value)]).sort((a, b) => a[0] - b[0]);
  if (!points.length) return 0;
  const x = Number(year);
  if (x <= points[0][0]) return points[0][1];
  if (x >= points.at(-1)[0]) return points.at(-1)[1];
  for (let index = 1; index < points.length; index += 1) {
    const [x2, y2] = points[index];
    const [x1, y1] = points[index - 1];
    if (x <= x2) return y1 + (y2 - y1) * ((x - x1) / (x2 - x1));
  }
  return 0;
}

function classProduction({perennialMix, curveAnchors = {}, year, footprintHa, yieldMultiplier = 1}) {
  return perennialMix.map((row) => {
    const curve = curveAnchors[row.functional_class] ?? curveAnchors[row.class] ?? {};
    const fraction = interpolate(curve, year);
    const gross = footprintHa * Number(row.area_share ?? 0) * Number(row.mature_food_gj_ha_year ?? 0) * Number(row.site_yield_multiplier ?? 1) * yieldMultiplier * fraction;
    return {
      id: row.id,
      functional_class: row.functional_class ?? row.class,
      area_share: Number(row.area_share ?? 0),
      yield_fraction: round(fraction),
      gross_food_gj: round(gross),
      usable_food_gj: round(gross)
    };
  });
}

/**
 * Size a new perennial system independently of any policy allocation.
 * The perennial footprint is planted from the beginning, while annual food
 * supplies the residual demand during the maturity curve.
 */
export function calculateEstablishmentLandRequirement({
  demandGJ,
  permanentAdultDemandGJ = null,
  demandByYear = null,
  demandScopeByYear = null,
  annualYieldGJHaYear,
  perennialMix = [],
  curveAnchors = {},
  years = DEFAULT_ESTABLISHMENT_YEARS,
  annualIntercropOverlap = DEFAULT_ANNUAL_INTERCROP_OVERLAP,
  loss = .30,
  annualReserveFraction = .25,
  strategy = 'progressive_handoff',
  heatingAreaHa = 0,
  additionalExclusiveLandHa = 0,
  exclusiveReserveHa = .12,
  yieldMultiplier = 1,
  arcPolicyAllocationHa = null,
  plantedPerennialFootprintHa = null,
  perennialFoodProductionLedger = null
} = {}) {
  if (!(Number(demandGJ) > 0)) throw new Error('establishment land requires positive household food demand');
  if (!(Number(annualYieldGJHaYear) > 0)) throw new Error('establishment land requires a positive viable annual yield');
  if (!perennialMix.length) throw new Error('establishment land requires at least one viable perennial layer');
  const annualYield = Number(annualYieldGJHaYear);
  const netAnnualYield = annualYield * (1 - Number(loss));
  const maturePerennialYield = perennialMix.reduce((sum, row) => sum + Number(row.area_share ?? 0) * Number(row.mature_food_gj_ha_year ?? 0) * Number(row.site_yield_multiplier ?? 1), 0) * Number(yieldMultiplier);
  if (!(maturePerennialYield > 0)) throw new Error('selected perennial system has no mature food yield');
  const permanentDemand = Number(permanentAdultDemandGJ ?? demandGJ);
  if (!(permanentDemand > 0)) throw new Error('establishment land requires positive permanent adult food demand');
  const demandAt = (year) => Number(demandByYear?.[String(year)] ?? demandGJ);
  const scopeAt = (year) => demandScopeByYear?.[String(year)] ?? {
    permanent_adult_food_demand_gj_year: permanentDemand,
    dependent_child_food_demand_gj_year: Math.max(0, demandAt(year) - permanentDemand),
    household_food_demand_gj_year: demandAt(year)
  };
  const plantedFootprint = plantedPerennialFootprintHa == null
    ? permanentDemand / (maturePerennialYield * (1 - Number(loss)))
    : Number(plantedPerennialFootprintHa);
  const rows = years.map((year) => {
    const householdDemand = demandAt(year);
    const demandScope = scopeAt(year);
    const ledgerRow = perennialFoodProductionLedger?.rows?.find((candidate) => String(candidate.year) === String(year));
    const productionRows = ledgerRow?.perennial_rows?.map((row) => ({id: row.id, functional_class: row.functional_class, area_share: Number(row.area_ha ?? 0) / Math.max(plantedFootprint, 1e-12), yield_fraction: row.bearing_factor, gross_food_gj: row.gross_food_energy_gj_year, usable_food_gj: row.retained_food_energy_gj_year})) ?? classProduction({perennialMix, curveAnchors, year, footprintHa: plantedFootprint, yieldMultiplier});
    const perennialGross = ledgerRow ? Number(ledgerRow.perennial_food_energy_available_gj_year ?? 0) / Math.max(1 - Number(loss), .01) : productionRows.reduce((sum, row) => sum + row.gross_food_gj, 0);
    const perennialUsable = ledgerRow ? Number(ledgerRow.perennial_food_energy_consumed_gj_year ?? 0) : perennialGross * (1 - Number(loss));
    const residual = Math.max(0, householdDemand - perennialUsable);
    const ledgerAnnualArea = ledgerRow ? Number(ledgerRow.annual_cultivation_area_ha ?? 0) : null;
    const requestedAnnualArea = ledgerAnnualArea != null && strategy === 'progressive_handoff' ? ledgerAnnualArea : strategy === 'constant_annual_reserve'
      ? Math.max(householdDemand * Number(annualReserveFraction) / netAnnualYield, residual / netAnnualYield)
      : residual / netAnnualYield;
    const overlapFraction = Number(annualIntercropOverlap[year] ?? 0);
    const overlap = Math.min(requestedAnnualArea, plantedFootprint) * overlapFraction;
    const occupiedFood = requestedAnnualArea + plantedFootprint - overlap;
    const totalExclusive = occupiedFood + Number(heatingAreaHa) + Number(exclusiveReserveHa) + Number(additionalExclusiveLandHa);
    const annualGross = ledgerRow ? Number(ledgerRow.annual_food_energy_gj_year ?? 0) / Math.max(1 - Number(loss), .01) : requestedAnnualArea * annualYield;
    const annualUsable = ledgerRow ? Number(ledgerRow.annual_food_energy_gj_year ?? 0) : annualGross * (1 - Number(loss));
    const adultResidual = Math.max(0, permanentDemand - perennialUsable);
    const adultAnnualArea = adultResidual / netAnnualYield;
    return {
      year,
      annual_area_required_ha: round(requestedAnnualArea),
      annual_area_ha: round(requestedAnnualArea),
      annual_gross_food_gj: round(annualGross),
      annual_usable_food_gj: round(annualUsable),
      perennial_area_ha: round(plantedFootprint),
      planted_perennial_footprint_ha: round(plantedFootprint),
      perennial_gross_food_gj: round(perennialGross),
      perennial_usable_food_gj: round(perennialUsable),
      perennial_by_function_usable_gj: Object.fromEntries(productionRows.map((row) => [row.functional_class, row.usable_food_gj])),
      class_production: productionRows,
      total_usable_food_gj: round(annualUsable + perennialUsable),
      household_food_demand_gj_year: round(householdDemand),
      permanent_adult_food_demand_gj_year: round(Number(demandScope.permanent_adult_food_demand_gj_year ?? permanentDemand)),
      dependent_child_food_demand_gj_year: round(Number(demandScope.dependent_child_food_demand_gj_year ?? Math.max(0, householdDemand - permanentDemand))),
      active_dependent_member_ids: demandScope.active_dependent_member_ids ?? [],
      active_dependent_child_count: Number(demandScope.active_dependent_child_count ?? 0),
      permanent_adult_annual_area_required_ha: round(adultAnnualArea),
      dependent_food_supplement_annual_area_ha: round(Math.max(0, requestedAnnualArea - adultAnnualArea)),
      dependent_food_supplement_gj_year: round(Math.max(0, householdDemand - permanentDemand)),
      household_food_coverage_ratio: householdDemand > 0 ? round((annualUsable + perennialUsable) / householdDemand) : 1,
      perennial_food_coverage_ratio: householdDemand > 0 ? round(perennialUsable / householdDemand) : 1,
      household_food_surplus_or_deficit_gj: round(annualUsable + perennialUsable - householdDemand),
      young_forest_annual_intercrop_overlap_ha: round(overlap),
      land_double_counted_as_if_separate_ha: round(overlap),
      occupied_food_production_area_ha: round(occupiedFood),
      heating_area_ha: round(heatingAreaHa),
      additional_exclusive_land_ha: round(additionalExclusiveLandHa),
      exclusive_resilience_reserve_ha: round(exclusiveReserveHa),
      total_exclusive_land_requirement_ha: round(totalExclusive),
      annual_land_limited: false,
      establishment_deficit_gj: round(Math.max(0, householdDemand - annualUsable - perennialUsable))
    };
  });
  const peak = rows.reduce((best, row) => row.total_exclusive_land_requirement_ha > best.total_exclusive_land_requirement_ha ? row : best, rows[0]);
  const mature = rows.find((row) => row.year === 'mature') ?? rows.at(-1);
  const result = {
    starting_condition: 'bare_land_new_planting',
    strategy,
    years,
    loss_or_reserve_fraction: Number(loss),
    annual_reserve_fraction: Number(annualReserveFraction),
    annual_yield_gj_ha_year: round(annualYield),
    mature_perennial_yield_gj_ha_year: round(maturePerennialYield),
    planted_perennial_footprint_ha: round(plantedFootprint),
    current_household_food_demand_gj_year: round(Number(demandGJ)),
    permanent_adult_food_demand_gj_year: round(permanentDemand),
    dependent_child_food_demand_gj_year: round(Math.max(0, Number(demandGJ) - permanentDemand)),
    annual_bridge_area_required_year_1_ha: round(demandAt(1) / netAnnualYield),
    rows,
    establishment_land_requirement_ha: peak.total_exclusive_land_requirement_ha,
    establishment_peak_year: peak.year,
    establishment_food_peak_ha: peak.occupied_food_production_area_ha,
    mature_land_requirement_ha: mature.total_exclusive_land_requirement_ha,
    mature_food_production_footprint_ha: mature.occupied_food_production_area_ha,
    heating_area_ha: round(heatingAreaHa),
    additional_exclusive_land_ha: round(additionalExclusiveLandHa),
    exclusive_resilience_reserve_ha: round(exclusiveReserveHa),
    arc_policy_allocation_ha: arcPolicyAllocationHa == null ? null : round(arcPolicyAllocationHa),
    arc_policy_surplus_or_deficit_ha: arcPolicyAllocationHa == null ? null : round(Number(arcPolicyAllocationHa) - peak.total_exclusive_land_requirement_ha),
    biological_requirement_independent_of_arc_policy: true
  };
  return result;
}

export function calculateEstablishmentLandAccounting({progressive, constant} = {}) {
  if (!progressive) throw new Error('establishment accounting requires a progressive transition');
  return {
    establishment_land_requirement_ha: progressive.establishment_land_requirement_ha,
    mature_land_requirement_ha: progressive.mature_land_requirement_ha,
    establishment_peak_year: progressive.establishment_peak_year,
    establishment_food_peak_ha: progressive.establishment_food_peak_ha,
    mature_food_production_footprint_ha: progressive.mature_food_production_footprint_ha,
    planted_perennial_footprint_ha: progressive.planted_perennial_footprint_ha,
    heating_area_ha: progressive.heating_area_ha,
    exclusive_resilience_reserve_ha: progressive.exclusive_resilience_reserve_ha,
    strategy_comparison: constant ? {progressive_handoff: progressive, constant_annual_reserve: constant} : {progressive_handoff: progressive}
  };
}
