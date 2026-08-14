// Browser-safe land-layer accounting shared by reports and the education UI.
// This module intentionally contains no filesystem or Node-only dependencies.

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round = (value, digits = 2) => Math.round(Number(value) * 10 ** digits) / 10 ** digits;

export function monthlyDebtService(principal, annualRate, years) {
  const amount = Math.max(0, finite(principal));
  const months = Math.max(1, Math.round(finite(years, 1) * 12));
  const monthlyRate = Math.max(0, finite(annualRate)) / 12;
  if (!amount) return 0;
  if (!monthlyRate) return amount / months;
  return amount * monthlyRate / (1 - (1 + monthlyRate) ** -months);
}

export function financeCapital({value, ownership = 'owned_out_right', downPaymentRate = 0, downPaymentCad = null, interestRateAnnual = 0, amortizationYears = 1} = {}) {
  const capitalValue = Math.max(0, finite(value));
  const explicitDownPayment = downPaymentCad == null ? capitalValue * Math.max(0, finite(downPaymentRate)) : finite(downPaymentCad);
  const downPayment = ownership === 'financed' || ownership === 'partial_equity'
    ? Math.min(capitalValue, Math.max(0, explicitDownPayment))
    : ownership === 'owned_out_right' ? capitalValue : 0;
  const financedPrincipal = ownership === 'financed' || ownership === 'partial_equity' ? Math.max(0, capitalValue - downPayment) : 0;
  return {
    capital_value_cad: round(capitalValue),
    ownership,
    down_payment_cad: round(downPayment),
    financed_principal_cad: round(financedPrincipal),
    interest_rate_annual: finite(interestRateAnnual),
    amortization_years: finite(amortizationYears),
    monthly_debt_service_cad: round(monthlyDebtService(financedPrincipal, interestRateAnnual, amortizationYears))
  };
}

function recoveryForValue(value, land) {
  if (land.recovery_mode === 'capital_recovery') {
    return monthlyDebtService(value, land.capital_recovery_rate_annual ?? land.interest_rate_annual, land.capital_recovery_years ?? land.amortization_years) * 12;
  }
  if (land.recovery_mode === 'none') return 0;
  return financeCapital({
    value,
    ownership: land.ownership,
    downPaymentRate: land.down_payment_rate,
    downPaymentCad: land.down_payment_cad == null || !land.total_property_value_cad
      ? null
      : finite(land.down_payment_cad) * value / Math.max(.000001, land.total_property_value_cad),
    interestRateAnnual: land.interest_rate_annual,
    amortizationYears: land.amortization_years
  }).monthly_debt_service_cad * 12;
}

const sum = (object) => Object.values(object).reduce((total, value) => total + finite(value), 0);

/**
 * Recover the whole purchased property through two visible land-lease layers:
 * an equal household base charge for common property and a productive-hectare
 * charge for exclusive land. Shared infrastructure is deliberately absent.
 */
export function calculateLandLeaseAccounting({
  households = [],
  common_property_land_ha = 0,
  land_price_cad_per_ha = 0,
  ownership = 'financed',
  down_payment_rate = 0,
  down_payment_cad = null,
  interest_rate_annual = 0,
  amortization_years = 1,
  recovery_mode = 'debt_service',
  capital_recovery_rate_annual,
  capital_recovery_years,
  property_tax_rate_annual = 0,
  land_insurance_annual_cad = 0,
  common_land_costs_annual_cad = 0,
  administration_annual_cad = 0,
  fixed_land_reserve_annual_cad = 0,
  vacancy_reserve_rate_annual = 0,
  allocation_method = 'base_plus_hectare'
} = {}) {
  const rows = Array.isArray(households) && households.length ? households : [{household_id: 'household-1', reserved_land_requirement_ha: 0}];
  const areaOf = (row) => Math.max(0, finite(row.reserved_land_requirement_ha ?? row.productive_land_ha ?? row.establishment_land_requirement_ha));
  const count = rows.length;
  const productiveArea = rows.reduce((total, row) => total + areaOf(row), 0);
  const commonArea = Math.max(0, finite(common_property_land_ha));
  const totalPropertyArea = productiveArea + commonArea;
  const price = Math.max(0, finite(land_price_cad_per_ha));
  const productiveValue = productiveArea * price;
  const commonValue = commonArea * price;
  const totalValue = productiveValue + commonValue;
  const land = {
    ownership,
    down_payment_rate,
    down_payment_cad,
    interest_rate_annual,
    amortization_years,
    recovery_mode,
    capital_recovery_rate_annual,
    capital_recovery_years,
    total_property_value_cad: totalValue
  };
  const financing = financeCapital({value: totalValue, ownership, downPaymentRate: down_payment_rate, downPaymentCad: down_payment_cad, interestRateAnnual: interest_rate_annual, amortizationYears: amortization_years});
  const productiveFinance = recoveryForValue(productiveValue, land);
  const commonFinance = recoveryForValue(commonValue, land);
  const productiveTax = productiveValue * Math.max(0, finite(property_tax_rate_annual));
  const commonTax = commonValue * Math.max(0, finite(property_tax_rate_annual));
  const baseBeforeVacancy = {
    common_land_finance_recovery_annual_cad: commonFinance,
    common_property_tax_annual_cad: commonTax,
    land_insurance_annual_cad: Math.max(0, finite(land_insurance_annual_cad)),
    common_land_costs_annual_cad: Math.max(0, finite(common_land_costs_annual_cad)),
    administration_annual_cad: Math.max(0, finite(administration_annual_cad)),
    fixed_land_reserve_annual_cad: Math.max(0, finite(fixed_land_reserve_annual_cad))
  };
  const areaBeforeVacancy = {
    productive_land_finance_recovery_annual_cad: productiveFinance,
    productive_property_tax_annual_cad: productiveTax
  };
  const rate = Math.max(0, finite(vacancy_reserve_rate_annual));
  const baseVacancy = sum(baseBeforeVacancy) * rate;
  const areaVacancy = sum(areaBeforeVacancy) * rate;
  const baseComponents = {...baseBeforeVacancy, vacancy_reserve_annual_cad: baseVacancy};
  const areaComponents = {...areaBeforeVacancy, vacancy_reserve_annual_cad: areaVacancy};
  const baseAnnual = sum(baseComponents);
  const areaAnnual = sum(areaComponents);
  const totalAnnual = baseAnnual + areaAnnual;
  const basePerHousehold = baseAnnual / count;
  const areaPerHectare = productiveArea > 0 ? areaAnnual / productiveArea : 0;
  const allocations = rows.map((row) => {
    const hectares = areaOf(row);
    const areaShare = productiveArea > 0 ? hectares / productiveArea : 0;
    const baseAnnualForHousehold = allocation_method === 'proportional_hectares' ? baseAnnual * areaShare : basePerHousehold;
    const areaAnnualForHousehold = areaAnnual * areaShare;
    const annual = baseAnnualForHousehold + areaAnnualForHousehold;
    const baseMonthly = baseAnnualForHousehold / 12;
    const hectareMonthly = hectares * areaPerHectare / 12;
    return {
      household_id: row.household_id,
      reserved_land_requirement_ha: round(hectares, 6),
      base_household_land_holding_charge_annual_cad: round(baseAnnualForHousehold),
      hectare_land_charge_annual_cad: round(areaAnnualForHousehold),
      base_household_land_holding_charge_monthly_cad: round(baseMonthly),
      land_charge_per_hectare_month_cad: round(areaPerHectare / 12),
      hectare_portion_monthly_cad: round(hectareMonthly),
      annual_components_cad: {
        ...Object.fromEntries(Object.entries(baseComponents).map(([key, value]) => [key, round(allocation_method === 'proportional_hectares' ? value * areaShare : value / count)])),
        ...Object.fromEntries(Object.entries(areaComponents).map(([key, value]) => [key, round(value * areaShare)]))
      },
      annual_total_cad: round(annual),
      monthly_total_cad: round(annual / 12)
    };
  });
  return {
    allocation_method,
    property_area: {
      productive_exclusive_land_ha: round(productiveArea, 6),
      common_property_land_ha: round(commonArea, 6),
      total_property_area_ha: round(totalPropertyArea, 6)
    },
    acquisition: {
      land_price_cad_per_ha: round(price),
      productive_land_value_cad: round(productiveValue),
      common_land_value_cad: round(commonValue),
      total_land_value_cad: round(totalValue),
      financing,
      productive_land_finance_recovery_annual_cad: round(productiveFinance),
      common_land_finance_recovery_annual_cad: round(commonFinance)
    },
    base_household_land_holding: {
      annual_components_cad: Object.fromEntries(Object.entries(baseComponents).map(([key, value]) => [key, round(value)])),
      annual_project_cost_before_vacancy_cad: round(sum(baseBeforeVacancy)),
      annual_vacancy_allowance_cad: round(baseVacancy),
      annual_project_cost_cad: round(baseAnnual),
      monthly_per_household_cad: round(basePerHousehold / 12),
      formula: 'equal household share of common-property land holding costs and fixed reserves'
    },
    hectare_charge: {
      annual_components_cad: Object.fromEntries(Object.entries(areaComponents).map(([key, value]) => [key, round(value)])),
      annual_project_cost_before_vacancy_cad: round(sum(areaBeforeVacancy)),
      annual_vacancy_allowance_cad: round(areaVacancy),
      annual_project_cost_cad: round(areaAnnual),
      productive_hectares: round(productiveArea, 6),
      monthly_per_hectare_cad: round(areaPerHectare / 12),
      formula: 'productive/exclusive hectares × area-dependent land cost per hectare'
    },
    annual_land_layer_cost_cad: round(totalAnnual),
    monthly_land_layer_cost_cad: round(totalAnnual / 12),
    allocations,
    revenue_recovery: {
      annual_site_lease_revenue_cad: round(allocations.reduce((total, row) => total + row.annual_total_cad, 0)),
      annual_land_layer_cost_cad: round(totalAnnual),
      rounded_allocation_difference_cad: round(allocations.reduce((total, row) => total + row.annual_total_cad, 0) - totalAnnual),
      break_even_before_rounding: true
    }
  };
}

