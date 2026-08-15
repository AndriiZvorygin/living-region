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

export function financeCapital({value, ownership = 'owned_out_right', downPaymentRate = 0, downPaymentCad = null, interestRateAnnual = 0, amortizationYears = 1, loanTermYears = null} = {}) {
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
    loan_term_years: loanTermYears == null ? null : finite(loanTermYears),
    monthly_debt_service_cad: round(monthlyDebtService(financedPrincipal, interestRateAnnual, amortizationYears))
  };
}

// Administration is a project operating budget, not a permanent $125 household
// coefficient. Fixed work is divided across households; resident records/billing
// scale with household count; professional work remains an annual allowance.
export const ADMINISTRATION_SCENARIOS = {
  legal_minimum: {
    id: 'legal_minimum',
    label: 'Legal minimum / resident self-managed',
    evidence_status: 'legal_minimum_candidate',
    description: 'Open-source records and resident governance. No recurring paid management budget is assumed; unavoidable external fees remain irregular and site-specific.',
    automation_level: 'open_source_self_managed',
    resident_labour_hours_year: 60,
    irregular_external_cash: {
      status: 'site_specific',
      annualized_in_monthly_charge: false,
      items: ['formation and filing fees', 'occasional required professional review', 'site-specific compliance advice']
    },
    components: {}
  },
  conventional: {
    id: 'conventional',
    label: 'Conventional administration',
    evidence_status: 'working_planning_assumption',
    description: 'Part-time project administration with ordinary bookkeeping, compliance, maintenance coordination and professional-service allowance.',
    automation_level: 'low',
    components: {
      lease_accounting_bookkeeping_fixed_annual_cad: {label: 'Lease, accounting and bookkeeping administration', kind: 'fixed_project', annual_cad: 3600, activities: ['lease billing', 'accounting close', 'reserve ledger']},
      tax_payment_administration_fixed_annual_cad: {label: 'Tax and payment administration', kind: 'fixed_project', annual_cad: 1800, activities: ['tax/payment calendar', 'bank reconciliation', 'annual filings']},
      compliance_records_fixed_annual_cad: {label: 'Compliance and site records', kind: 'fixed_project', annual_cad: 2400, activities: ['resident records', 'rule/checklist records', 'document control']},
      maintenance_coordination_fixed_annual_cad: {label: 'Maintenance coordination and inspections', kind: 'fixed_project', annual_cad: 1800, activities: ['work orders', 'inspection scheduling', 'contractor coordination']},
      resident_billing_records_variable_annual_cad_per_household: {label: 'Resident billing and records', kind: 'variable_per_household', annual_cad_per_household: 480, activities: ['household account changes', 'statements', 'routine correspondence']},
      legal_accounting_professional_allowance_annual_cad: {label: 'Legal/accounting professional allowance', kind: 'event_driven_allowance', annual_cad: 2640, activities: ['occasional legal review', 'year-end professional review', 'compliance questions']}
    }
  },
  software_assisted: {
    id: 'software_assisted',
    label: 'Software-assisted / self-managed',
    evidence_status: 'policy_design_choice_with_planning_costs',
    description: 'Open-source workflows automate repetitive records, billing, reserve ledgers, maintenance checklists, site-plan checks and document generation while retaining human oversight and professional review.',
    automation_level: 'medium_high',
    automation_capabilities: ['lease billing/accounting', 'reserve accounting', 'maintenance schedules', 'resident/site records', 'site-plan rule checking', 'carrying-capacity calculations', 'productive-land plans', 'inspection/checklist workflows', 'document generation'],
    components: {
      software_hosting_backup_security_fixed_annual_cad: {label: 'Software hosting, backup and security oversight', kind: 'fixed_project', annual_cad: 2400, activities: ['offline-capable records', 'backups', 'access review']},
      lease_accounting_workflow_fixed_annual_cad: {label: 'Lease/accounting workflow oversight', kind: 'fixed_project', annual_cad: 1800, activities: ['review automated statements', 'reserve reconciliation', 'year-end close']},
      compliance_document_generation_fixed_annual_cad: {label: 'Compliance and document workflow oversight', kind: 'fixed_project', annual_cad: 1200, activities: ['generated checklists', 'site-plan validation', 'document retention']},
      resident_billing_records_variable_annual_cad_per_household: {label: 'Resident records and exception handling', kind: 'variable_per_household', annual_cad_per_household: 240, activities: ['exceptions', 'account changes', 'routine correspondence']},
      legal_accounting_professional_allowance_annual_cad: {label: 'Legal/accounting professional allowance', kind: 'event_driven_allowance', annual_cad: 1800, activities: ['occasional legal review', 'year-end professional review', 'compliance questions']}
    }
  },
  lean_self_managed: {
    id: 'lean_self_managed',
    label: 'Lean self-managed sensitivity',
    evidence_status: 'sensitivity_assumption',
    description: 'Lower-cash scenario assuming residents perform routine coordination and open-source workflows handle most repeatable administration; it is not a zero-labour case.',
    automation_level: 'high',
    automation_capabilities: ['same as software-assisted, with more resident time and less paid coordination'],
    components: {
      software_hosting_backup_security_fixed_annual_cad: {label: 'Software hosting, backup and security oversight', kind: 'fixed_project', annual_cad: 1800, activities: ['backups', 'access review']},
      resident_governance_compliance_fixed_annual_cad: {label: 'Resident governance and compliance coordination', kind: 'fixed_project', annual_cad: 1800, activities: ['resident rota', 'checklists', 'document control']},
      lease_accounting_workflow_fixed_annual_cad: {label: 'Lease/accounting workflow oversight', kind: 'fixed_project', annual_cad: 1200, activities: ['review automated statements', 'reserve reconciliation']},
      resident_billing_records_variable_annual_cad_per_household: {label: 'Resident records and exception handling', kind: 'variable_per_household', annual_cad_per_household: 120, activities: ['exceptions', 'account changes']},
      legal_accounting_professional_allowance_annual_cad: {label: 'Legal/accounting professional allowance', kind: 'event_driven_allowance', annual_cad: 1200, activities: ['occasional legal review', 'annual professional check']}
    }
  }
};

export function calculateAdministrationBudget({scenario_id = 'custom', household_count = 1, override_annual_cad = null, annual_cad = 0} = {}) {
  const count = Math.max(1, Math.round(finite(household_count, 1)));
  const scenario = ADMINISTRATION_SCENARIOS[scenario_id];
  if (!scenario) {
    const total = Math.max(0, finite(override_annual_cad ?? annual_cad));
    return {
      scenario_id: 'custom',
      scenario_label: 'Custom administration budget',
      evidence_status: 'custom_scenario',
      household_count: count,
      annual_total_cad: round(total),
      monthly_per_household_cad: round(total / count / 12),
      fixed_project_annual_cad: null,
      variable_household_annual_cad: null,
      event_driven_allowance_annual_cad: null,
      resident_labour_hours_year: 0,
      irregular_external_cash: {status: 'site_specific', annualized_in_monthly_charge: false, items: []},
      components: [],
      allocation_basis: 'explicit_custom_annual_budget'
    };
  }
  const components = Object.entries(scenario.components).map(([id, row]) => {
    const annual = row.kind === 'variable_per_household' ? row.annual_cad_per_household * count : row.annual_cad;
    return {id, label: row.label, kind: row.kind, annual_cad: round(annual), annual_cad_per_household: row.kind === 'variable_per_household' ? row.annual_cad_per_household : null, activities: row.activities, evidence_status: scenario.evidence_status};
  });
  const fixed = components.filter((row) => row.kind === 'fixed_project').reduce((sum, row) => sum + row.annual_cad, 0);
  const variable = components.filter((row) => row.kind === 'variable_per_household').reduce((sum, row) => sum + row.annual_cad, 0);
  const eventDriven = components.filter((row) => row.kind === 'event_driven_allowance').reduce((sum, row) => sum + row.annual_cad, 0);
  const total = fixed + variable + eventDriven;
  return {
    scenario_id: scenario.id,
    scenario_label: scenario.label,
    description: scenario.description,
    evidence_status: scenario.evidence_status,
    automation_level: scenario.automation_level,
    automation_capabilities: scenario.automation_capabilities ?? [],
    household_count: count,
    annual_total_cad: round(total),
    monthly_per_household_cad: round(total / count / 12),
    fixed_project_annual_cad: round(fixed),
    variable_household_annual_cad: round(variable),
    event_driven_allowance_annual_cad: round(eventDriven),
    resident_labour_hours_year: round(scenario.resident_labour_hours_year ?? 0),
    irregular_external_cash: scenario.irregular_external_cash ?? {status: 'not_applicable', annualized_in_monthly_charge: false, items: []},
    components,
    allocation_basis: scenario.id === 'legal_minimum'
      ? 'zero_recurring_external_cash; resident labour and irregular site-specific costs shown separately'
      : 'fixed_project_cost + variable_per_household_cost + event_driven_professional_allowance'
  };
}

export const COMMON_PROPERTY_OPERATIONS_SCENARIOS = {
  legal_minimum: {
    id: 'legal_minimum',
    label: 'Legal minimum / resident-maintained',
    evidence_status: 'legal_minimum_candidate',
    description: 'No contractor budget. Residents maintain only common-property drainage and minimum grounds/hazard standards here. Internal-road passability, snow/obstruction control and sanitary waste handling are represented in the separate infrastructure layer so the same work is not counted twice.',
    components: {
      drainage_excavation_repair: {label: 'Drainage and excavation repair', annual_cad: 0, resident_labour_hours_year: 40, requiredness: 'physically_necessary', source_status: 'O. Reg. 517/06 s. 6 and 32; site-specific condition assessment required'},
      minimum_grounds_and_weeds: {label: 'Minimum grounds, weeds and hazard removal', annual_cad: 0, resident_labour_hours_year: 24, requiredness: 'legally_required', source_status: 'Owen Sound Property Standards By-law 1999-030; active agricultural/gardening areas are treated separately'}
    }
  },
  contracted_baseline: {
    id: 'contracted_baseline',
    label: 'Common-property operations baseline',
    evidence_status: 'working_planning_assumption',
    description: 'Cash operating allowance for common grounds and buffers. Snow clearing, road maintenance, waste handling and infrastructure insurance remain in the shared-infrastructure layer.',
    components: {
      vegetation_management_annual_cad: {label: 'Common-land mowing and vegetation management', annual_cad: 1800},
      road_edge_drainage_annual_cad: {label: 'Road-edge and drainage maintenance', annual_cad: 1200},
      common_paths_annual_cad: {label: 'Common paths and access-side grounds', annual_cad: 600},
      ecological_buffer_maintenance_annual_cad: {label: 'Ecological and water-buffer maintenance', annual_cad: 1200},
      common_area_repairs_miscellaneous_annual_cad: {label: 'Common-area repairs and miscellaneous grounds work', annual_cad: 1200}
    }
  }
};

export function calculateCommonPropertyOperations({scenario_id = 'contracted_baseline', override_annual_cad = null} = {}) {
  const scenario = COMMON_PROPERTY_OPERATIONS_SCENARIOS[scenario_id];
  if (!scenario) return {scenario_id: 'custom', scenario_label: 'Custom common-property operations', evidence_status: 'custom_scenario', annual_total_cad: round(Math.max(0, finite(override_annual_cad))), resident_labour_hours_year: 0, future_replacement_liability_cad: 0, components: []};
  const components = Object.entries(scenario.components).map(([id, row]) => ({id, label: row.label, annual_cad: round(row.annual_cad), resident_labour_hours_year: round(row.resident_labour_hours_year ?? 0), requiredness: row.requiredness ?? 'working planning assumption', source_status: row.source_status ?? scenario.evidence_status, evidence_status: scenario.evidence_status}));
  return {scenario_id: scenario.id, scenario_label: scenario.label, description: scenario.description, evidence_status: scenario.evidence_status, annual_total_cad: round(components.reduce((sum, row) => sum + row.annual_cad, 0)), resident_labour_hours_year: round(components.reduce((sum, row) => sum + row.resident_labour_hours_year, 0)), future_replacement_liability_cad: 0, components, excludes: ['snow clearing contracts', 'road maintenance contracts', 'centralized water/sewage/electricity', 'infrastructure insurance', 'land-holding administration', 'vacancy reserve']};
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
 * an equal common-property land holding share and a productive-hectare charge
 * for exclusive land. Shared infrastructure is deliberately absent.
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
  loan_term_years = null,
  recovery_mode = 'debt_service',
  capital_recovery_rate_annual,
  capital_recovery_years,
  property_tax_rate_annual = 0,
  land_insurance_annual_cad = 0,
  common_land_costs_annual_cad = 0,
  administration_annual_cad = 0,
  administration_scenario_id = 'custom',
  administration_override_annual_cad = null,
  fixed_land_reserve_annual_cad = 0,
  vacancy_reserve_rate_annual = 0,
  allocation_method = 'base_plus_hectare'
} = {}) {
  const rows = Array.isArray(households) && households.length ? households : [{household_id: 'household-1', reserved_land_requirement_ha: 0}];
  const areaOf = (row) => Math.max(0, finite(row.reserved_land_requirement_ha ?? row.productive_land_ha ?? row.establishment_land_requirement_ha));
  const count = rows.length;
  const administration = calculateAdministrationBudget({scenario_id: administration_scenario_id, household_count: count, override_annual_cad: administration_override_annual_cad, annual_cad: administration_annual_cad});
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
    loan_term_years,
    recovery_mode,
    capital_recovery_rate_annual,
    capital_recovery_years,
    total_property_value_cad: totalValue
  };
  const financing = financeCapital({value: totalValue, ownership, downPaymentRate: down_payment_rate, downPaymentCad: down_payment_cad, interestRateAnnual: interest_rate_annual, amortizationYears: amortization_years, loanTermYears: loan_term_years});
  const productiveFinance = recoveryForValue(productiveValue, land);
  const commonFinance = recoveryForValue(commonValue, land);
  const productiveTax = productiveValue * Math.max(0, finite(property_tax_rate_annual));
  const commonTax = commonValue * Math.max(0, finite(property_tax_rate_annual));
  const baseBeforeVacancy = {
    common_land_finance_recovery_annual_cad: commonFinance,
    common_property_tax_annual_cad: commonTax,
    land_insurance_annual_cad: Math.max(0, finite(land_insurance_annual_cad)),
    common_land_costs_annual_cad: Math.max(0, finite(common_land_costs_annual_cad)),
    administration_annual_cad: administration.annual_total_cad,
    fixed_land_reserve_annual_cad: Math.max(0, finite(fixed_land_reserve_annual_cad))
  };
  const areaBeforeVacancy = {
    productive_land_finance_recovery_annual_cad: productiveFinance,
    productive_property_tax_annual_cad: productiveTax
  };
  const rate = Math.max(0, finite(vacancy_reserve_rate_annual));
  const baseVacancy = sum(baseBeforeVacancy) * rate;
  const areaVacancy = sum(areaBeforeVacancy) * rate;
  // Keep common and productive vacancy reserves distinct. A shared key here
  // would make the spread below silently overwrite one reserve in the detail
  // output even though the project totals remained correct.
  const baseComponents = {...baseBeforeVacancy, common_vacancy_reserve_annual_cad: baseVacancy};
  const areaComponents = {...areaBeforeVacancy, productive_vacancy_reserve_annual_cad: areaVacancy};
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
    const commonComponents = Object.fromEntries(Object.entries(baseComponents).map(([key, value]) => [key, round(allocation_method === 'proportional_hectares' ? value * areaShare : value / count)]));
    const productiveComponents = Object.fromEntries(Object.entries(areaComponents).map(([key, value]) => [key, round(value * areaShare)]));
    return {
      household_id: row.household_id,
      reserved_land_requirement_ha: round(hectares, 6),
      productive_land_charge_annual_cad: round(areaAnnualForHousehold),
      annual_components_cad: {
        ...commonComponents,
        ...productiveComponents
      },
      common_property_land_holding_annual_components_cad: commonComponents,
      productive_land_annual_components_cad: productiveComponents,
      common_property_land_holding_charge_monthly_cad: round(baseMonthly),
      productive_land_charge_per_hectare_monthly_cad: round(areaPerHectare / 12),
      productive_land_portion_monthly_cad: round(hectareMonthly),
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
      initial_equity_contribution_cad: round(financing.down_payment_cad),
      equity_recovery_annual_cad: 0,
      equity_recovery_policy: 'Initial project equity is a source of acquisition capital; it is not charged again as recurring lease recovery or opportunity-cost return.',
      productive_land_finance_recovery_annual_cad: round(productiveFinance),
      common_land_finance_recovery_annual_cad: round(commonFinance)
    },
    common_property_land_holding: {
      annual_components_cad: Object.fromEntries(Object.entries(baseComponents).map(([key, value]) => [key, round(value)])),
      annual_project_cost_before_vacancy_cad: round(sum(baseBeforeVacancy)),
      annual_vacancy_allowance_cad: round(baseVacancy),
      annual_project_cost_cad: round(baseAnnual),
      monthly_per_household_cad: round(basePerHousehold / 12),
      allocation_basis: 'equal_per_household',
      formula: 'equal household share of common-property land holding costs and fixed reserves',
      includes: ['common property/access/ecological land acquisition and debt', 'common property tax', 'land insurance', 'common-land operating costs', 'land-holding administration', 'fixed land reserve', 'common-property vacancy reserve'],
      excludes: ['productive/exclusive land acquisition and tax', 'shared infrastructure', 'resident dwelling and household expenses']
    },
    administration,
    productive_land_charge: {
      annual_components_cad: Object.fromEntries(Object.entries(areaComponents).map(([key, value]) => [key, round(value)])),
      annual_project_cost_before_vacancy_cad: round(sum(areaBeforeVacancy)),
      annual_vacancy_allowance_cad: round(areaVacancy),
      annual_project_cost_cad: round(areaAnnual),
      productive_hectares: round(productiveArea, 6),
      monthly_per_hectare_cad: round(areaPerHectare / 12),
      monthly_components_per_hectare_cad: Object.fromEntries(Object.entries(areaComponents).map(([key, value]) => [key.replace(/_annual_cad$/, '_monthly_per_hectare_cad'), round(value / Math.max(.000001, productiveArea) / 12)])),
      allocation_basis: 'proportional_to_reserved_productive_hectares',
      formula: 'productive/exclusive hectares × area-dependent land cost per hectare',
      includes: ['productive/exclusive land acquisition and debt', 'productive-land tax', 'productive-land vacancy reserve'],
      excludes: ['common property/access/ecological land', 'shared infrastructure', 'resident dwelling and household expenses']
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
