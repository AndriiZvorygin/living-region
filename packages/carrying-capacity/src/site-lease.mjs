import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  calculateInteractiveHousehold,
  defaultBuilding,
  householdProfiles,
  siteClasses
} from './core.mjs';
import {representativeProfiles} from './health-canada.mjs';
import {selectPerennialMixForSite} from './environment.mjs';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const round = (value, digits = 2) => Math.round(Number(value) * 10 ** digits) / 10 ** digits;
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const deepClone = (value) => JSON.parse(JSON.stringify(value));

export const ARC_SITE_LEASE_CONTRACT_VERSION = '1.0.0';
export const SITE_LEASE_ALLOCATION_METHODS = {
  proportional_hectares: 'All allocable site-lease pools are proportional to calculated productive hectares.',
  base_plus_hectare: 'Recommended: land-specific costs follow productive hectares; shared land-holding costs are divided equally.',
  equal_shared_and_hectare_land: 'Property tax and shared land-holding costs are equal; land finance recovery follows productive hectares.'
};

export const SITE_LEASE_EVIDENCE = {
  land_price: {
    status: 'working_scenario_assumption',
    source: 'Living Region repository audit and the existing task-specified Grey County working range',
    notes: 'No current, parcel-matched Grey County rural land-sale series was found in the repository. The 30,000–40,000 CAD/ha working range is retained as a sensitivity input, not a canonical market value.'
  },
  dwelling_capital_cost: {
    status: 'working_scenario_assumption',
    source: 'No current ARC dwelling construction-cost benchmark was found in the Living Region repository',
    notes: 'The default is intentionally replaceable and is not the obsolete HelpOS combined housing-plus-land figure.'
  },
  property_tax: {
    status: 'planning_assumption',
    source: 'No parcel assessment/tax roll was found in the repository',
    notes: 'The tax rate is an explicit scenario input and should be replaced by the applicable municipal/assessment basis for a real property.'
  },
  infrastructure: {
    status: 'planning_assumption',
    source: 'No site design, servicing quote, or ARC infrastructure bill of quantities was found in the repository',
    notes: 'Capital and operating values are transparent placeholders for scenario comparison, not local procurement estimates.'
  }
};

export const DEFAULT_SITE_LEASE_SCENARIO = {
  site_id: 'ordinary_mesic',
  household: {
    household_id: 'household-1',
    label: 'Reference adult household',
    members: ['adult_man'],
    buildings: [defaultBuilding()]
  },
  community: {
    project_id: 'arc-community-12',
    label: '12-household ARC project',
    household_count: 12,
    common_area_ha: 1.5,
    allocation_method: 'base_plus_hectare'
  },
  dwelling: {
    capital_cost_cad: 125000,
    down_payment_rate: 0.10,
    interest_rate_annual: 0.06,
    amortization_years: 25,
    maintenance_replacement_rate_annual: 0.02,
    household_utilities_annual_cad: 1800,
    ownership: 'resident_owned'
  },
  land: {
    price_cad_per_ha: 35000,
    property_tax_rate_annual: 0.01,
    insurance_annual_cad: 3000,
    common_land_costs_annual_cad: 6000,
    administration_annual_cad: 18000,
    vacancy_reserve_rate_annual: 0.05,
    legal_lease_term_years: 49,
    ownership: 'financed',
    down_payment_rate: 0.20,
    interest_rate_annual: 0.06,
    amortization_years: 30,
    recovery_mode: 'debt_service'
  },
  infrastructure: {
    financing: {
      ownership: 'financed',
      down_payment_rate: 0.20,
      interest_rate_annual: 0.06,
      amortization_years: 30
    },
    capital_components: {
      internal_access: {label: 'Internal road/access', included: true, capital_cost_cad: 250000},
      shared_water: {label: 'Shared water infrastructure', included: true, capital_cost_cad: 180000},
      shared_sewage: {label: 'Shared sewage infrastructure', included: true, capital_cost_cad: 250000},
      common_building: {label: 'Common building / amenity', included: true, capital_cost_cad: 250000},
      waste_system: {label: 'Waste and compost systems', included: true, capital_cost_cad: 50000},
      shared_equipment: {label: 'Shared equipment', included: true, capital_cost_cad: 75000}
    },
    annual_operating_costs_cad: {
      road_access_and_snow: 18000,
      water_sewage_operations: 12000,
      common_building_utilities: 12000,
      insurance: 15000,
      administration: 18000
    },
    maintenance_rate_annual: 0.02,
    replacement_reserve_rate_annual: 0.01
  }
};

const SITE_IDS = new Set(Object.keys(siteClasses));

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, relativePath), 'utf8'));
}

let canonicalInputs;
function loadCanonicalSiteLeaseInputs() {
  if (canonicalInputs) return canonicalInputs;
  const foodEvidence = readJson('data/derived/evidence-food-yields.json');
  const woodyEvidence = readJson('data/derived/evidence-woody-yields.json');
  const perennialEvidence = readJson('data/derived/perennial-yield-evidence.json');
  const canonical = readJson('outputs/summary.json');
  const siteModels = Object.fromEntries([...SITE_IDS].map((siteId) => [siteId, {
    site_id: siteId,
    curve_anchors: perennialEvidence.curve_anchors.central,
    perennial_mix: selectPerennialMixForSite(perennialEvidence.mix, siteId),
    years: [1, 2, 3, 5, 8, 10, 15, 'mature'],
    annual_intercrop_overlap_by_year: {1: .75, 2: .75, 3: .60, 5: .40, 8: .15, 10: .05, 15: 0, mature: 0},
    loss_or_reserve_fraction: .30,
    annual_reserve_fraction: .25
  }]));
  canonicalInputs = {foodEvidence, woodyCases: woodyEvidence.cases, canonical, siteModels};
  return canonicalInputs;
}

function normalizeMember(member, index) {
  if (typeof member === 'string') {
    const profile = representativeProfiles[member];
    if (!profile) throw new Error(`Unknown ARC household member profile: ${member}`);
    return {id: member, ...deepClone(profile)};
  }
  if (!member || typeof member !== 'object') throw new Error(`Household member ${index + 1} must be a profile id or object`);
  return {...member, id: member.id ?? `member-${index + 1}`};
}

function normalizeBuildings(buildings) {
  const rows = Array.isArray(buildings) && buildings.length ? buildings : [defaultBuilding()];
  return rows.map((building, index) => ({...building, id: building.id ?? `building-${index + 1}`}));
}

function matchingProfileId(members) {
  const ids = members.map((member) => member.id).sort().join('|');
  return Object.entries(householdProfiles).find(([, profile]) => profile.member_ids.slice().sort().join('|') === ids)?.[0] ?? null;
}

function monthlyDebtService(principal, annualRate, years) {
  const amount = Math.max(0, finite(principal));
  const months = Math.max(1, Math.round(finite(years, 1) * 12));
  const monthlyRate = Math.max(0, finite(annualRate)) / 12;
  if (!amount) return 0;
  if (!monthlyRate) return amount / months;
  return amount * monthlyRate / (1 - (1 + monthlyRate) ** -months);
}

function financeCapital({value, ownership = 'owned_out_right', downPaymentRate = 0, downPaymentCad = null, interestRateAnnual = 0, amortizationYears = 1} = {}) {
  const capitalValue = Math.max(0, finite(value));
  const explicitDownPayment = downPaymentCad == null ? capitalValue * Math.max(0, finite(downPaymentRate)) : finite(downPaymentCad);
  const downPayment = ownership === 'financed' || ownership === 'partial_equity' ? Math.min(capitalValue, Math.max(0, explicitDownPayment)) : ownership === 'owned_out_right' ? capitalValue : 0;
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

function householdCapacity({household, siteId, inputs}) {
  const members = (household.members ?? ['adult_man']).map(normalizeMember);
  const buildings = normalizeBuildings(household.buildings);
  const model = inputs.siteModels[siteId];
  const profileId = matchingProfileId(members);
  const matureReferenceRow = profileId
    ? inputs.canonical.canonical?.mature_food_system?.canonical_rows?.find((row) => row.site === siteId && row.household === profileId && row.module === 'plants_only')
    : null;
  const result = calculateInteractiveHousehold({
    members,
    buildings,
    siteId,
    foodEvidence: inputs.foodEvidence,
    woodyCases: inputs.woodyCases,
    matureReferenceRow,
    establishmentModel: model
  });
  const transition = result.establishment_land?.strategy_comparison?.progressive_handoff;
  if (!transition) throw new Error('Site-lease calculation requires the canonical establishment transition');
  return {household_id: household.household_id ?? 'household-1', label: household.label ?? 'ARC household', members, buildings, result, transition};
}

function normalizeHouseholds(scenario) {
  if (Array.isArray(scenario.community?.households) && scenario.community.households.length) return scenario.community.households;
  const count = Math.max(1, Math.round(finite(scenario.community?.household_count, 1)));
  return Array.from({length: count}, (_, index) => ({
    ...deepClone(scenario.household ?? DEFAULT_SITE_LEASE_SCENARIO.household),
    household_id: `${scenario.household?.household_id ?? 'household'}-${index + 1}`
  }));
}

function sumObjectValues(object = {}) {
  return Object.values(object).reduce((sum, value) => sum + finite(value), 0);
}

function projectInfrastructure(scenario, householdCount) {
  const infrastructure = scenario.infrastructure ?? {};
  const components = Object.fromEntries(Object.entries(infrastructure.capital_components ?? {}).map(([id, row]) => [id, {
    id,
    label: row.label ?? id,
    included: row.included !== false,
    capital_cost_cad: row.included === false ? 0 : Math.max(0, finite(row.capital_cost_cad))
  }]));
  const capitalValue = sumObjectValues(Object.fromEntries(Object.entries(components).map(([id, row]) => [id, row.capital_cost_cad])));
  const financing = infrastructure.financing ?? DEFAULT_SITE_LEASE_SCENARIO.infrastructure.financing;
  const finance = financeCapital({
    value: capitalValue,
    ownership: financing.ownership ?? 'financed',
    downPaymentRate: financing.down_payment_rate,
    downPaymentCad: financing.down_payment_cad,
    interestRateAnnual: financing.interest_rate_annual,
    amortizationYears: financing.amortization_years
  });
  const operating = {...(infrastructure.annual_operating_costs_cad ?? {})};
  const operatingAnnual = sumObjectValues(operating);
  const maintenanceAnnual = capitalValue * Math.max(0, finite(infrastructure.maintenance_rate_annual));
  const replacementAnnual = capitalValue * Math.max(0, finite(infrastructure.replacement_reserve_rate_annual));
  const capitalDebtAnnual = finance.monthly_debt_service_cad * 12;
  const totalAnnual = capitalDebtAnnual + operatingAnnual + maintenanceAnnual + replacementAnnual;
  return {
    capital_components: components,
    capital_value_cad: round(capitalValue),
    financing: finance,
    annual_costs_cad: {
      capital_debt_service: round(capitalDebtAnnual),
      operating: round(operatingAnnual),
      maintenance: round(maintenanceAnnual),
      replacement_reserve: round(replacementAnnual),
      total: round(totalAnnual)
    },
    costs_classification: {capital_debt_service: 'capital recovery', operating: 'operating expense', maintenance: 'operating expense', replacement_reserve: 'reserve'},
    service_charge_per_household_month_cad: round(totalAnnual / householdCount),
    reserve_contribution_annual_cad: round(replacementAnnual),
    evidence: SITE_LEASE_EVIDENCE.infrastructure
  };
}

function allocatePool({households, pools, method}) {
  const totalHectares = households.reduce((sum, row) => sum + row.establishment_land_requirement_ha, 0);
  const count = households.length;
  const byHectare = (value, household) => totalHectares > 0 ? value * household.establishment_land_requirement_ha / totalHectares : value / count;
  const byHousehold = (value) => value / count;
  return households.map((household) => {
    const preliminary = method === 'proportional_hectares'
      ? Object.fromEntries(Object.entries(pools).filter(([key]) => key !== 'vacancy_reserve_annual_cad').map(([key, value]) => [key, byHectare(value, household)]))
      : method === 'equal_shared_and_hectare_land'
        ? {
          land_finance_recovery_annual_cad: byHectare(pools.land_finance_recovery_annual_cad, household),
          property_tax_annual_cad: byHousehold(pools.property_tax_annual_cad),
          land_insurance_annual_cad: byHousehold(pools.land_insurance_annual_cad),
          common_land_costs_annual_cad: byHousehold(pools.common_land_costs_annual_cad),
          administration_annual_cad: byHousehold(pools.administration_annual_cad)
        }
        : {
          land_finance_recovery_annual_cad: byHectare(pools.land_finance_recovery_annual_cad, household),
          property_tax_annual_cad: byHectare(pools.property_tax_annual_cad, household),
          land_insurance_annual_cad: byHousehold(pools.land_insurance_annual_cad),
          common_land_costs_annual_cad: byHousehold(pools.common_land_costs_annual_cad),
          administration_annual_cad: byHousehold(pools.administration_annual_cad)
        };
    const beforeReserve = sumObjectValues(preliminary);
    const reserve = pools.vacancy_reserve_annual_cad * (beforeReserve / Math.max(0.000001, sumObjectValues(pools) - pools.vacancy_reserve_annual_cad));
    const components = {...preliminary, vacancy_reserve_annual_cad: reserve};
    return {household_id: household.household_id, annual_components_cad: Object.fromEntries(Object.entries(components).map(([key, value]) => [key, round(value)])), annual_total_cad: round(sumObjectValues(components)), monthly_total_cad: round(sumObjectValues(components) / 12)};
  });
}

function normalizedScenario(options = {}) {
  const source = options.scenario ? deepClone(options.scenario) : deepClone(options);
  const defaultInfrastructure = DEFAULT_SITE_LEASE_SCENARIO.infrastructure;
  const sourceInfrastructure = source.infrastructure ?? {};
  const merged = {
    ...deepClone(DEFAULT_SITE_LEASE_SCENARIO),
    ...source,
    household: {...deepClone(DEFAULT_SITE_LEASE_SCENARIO.household), ...(source.household ?? {})},
    community: {...deepClone(DEFAULT_SITE_LEASE_SCENARIO.community), ...(source.community ?? {})},
    dwelling: {...deepClone(DEFAULT_SITE_LEASE_SCENARIO.dwelling), ...(source.dwelling ?? {})},
    land: {...deepClone(DEFAULT_SITE_LEASE_SCENARIO.land), ...(source.land ?? {})},
    infrastructure: {
      ...deepClone(defaultInfrastructure),
      ...sourceInfrastructure,
      financing: {...deepClone(defaultInfrastructure.financing), ...(sourceInfrastructure.financing ?? {})},
      capital_components: {...deepClone(defaultInfrastructure.capital_components), ...(sourceInfrastructure.capital_components ?? {})},
      annual_operating_costs_cad: {...deepClone(defaultInfrastructure.annual_operating_costs_cad), ...(sourceInfrastructure.annual_operating_costs_cad ?? {})}
    }
  };
  merged.site_id = source.site_id ?? source.siteId ?? merged.site_id;
  if (!SITE_IDS.has(merged.site_id)) throw new Error(`Unknown carrying-capacity site for lease economics: ${merged.site_id}`);
  merged.community.allocation_method = source.community?.allocation_method ?? source.allocation_method ?? merged.community.allocation_method;
  if (!SITE_LEASE_ALLOCATION_METHODS[merged.community.allocation_method]) throw new Error(`Unknown site-lease allocation method: ${merged.community.allocation_method}`);
  return merged;
}

/**
 * Calculate resident-owned dwelling plus project-owned land and shared-service economics.
 * All hectares and heat loads come from the canonical carrying-capacity API; monetary
 * values are explicit scenario inputs until local project quotes are available.
 */
export function calculateArcSiteLeaseEconomics(options = {}) {
  const scenario = normalizedScenario(options);
  const inputs = loadCanonicalSiteLeaseInputs();
  const households = normalizeHouseholds(scenario).map((household) => householdCapacity({household, siteId: scenario.site_id, inputs}));
  const count = households.length;
  const productive = households.reduce((sum, row) => sum + finite(row.transition.establishment_land_requirement_ha), 0);
  const matureProductive = households.reduce((sum, row) => sum + finite(row.transition.mature_land_requirement_ha), 0);
  const commonArea = Math.max(0, finite(scenario.community.common_area_ha));
  const totalPropertyArea = productive + commonArea;
  const landValue = totalPropertyArea * Math.max(0, finite(scenario.land.price_cad_per_ha));
  const landFinance = financeCapital({
    value: landValue,
    ownership: scenario.land.ownership,
    downPaymentRate: scenario.land.down_payment_rate,
    downPaymentCad: scenario.land.down_payment_cad,
    interestRateAnnual: scenario.land.interest_rate_annual,
    amortizationYears: scenario.land.amortization_years
  });
  const landRecoveryAnnual = scenario.land.recovery_mode === 'capital_recovery'
    ? monthlyDebtService(landValue, scenario.land.capital_recovery_rate_annual ?? scenario.land.interest_rate_annual, scenario.land.capital_recovery_years ?? scenario.land.amortization_years) * 12
    : scenario.land.recovery_mode === 'none' ? 0 : landFinance.monthly_debt_service_cad * 12;
  const propertyTaxAnnual = landValue * Math.max(0, finite(scenario.land.property_tax_rate_annual));
  const landPoolsBeforeReserve = {
    land_finance_recovery_annual_cad: landRecoveryAnnual,
    property_tax_annual_cad: propertyTaxAnnual,
    land_insurance_annual_cad: Math.max(0, finite(scenario.land.insurance_annual_cad)),
    common_land_costs_annual_cad: Math.max(0, finite(scenario.land.common_land_costs_annual_cad)),
    administration_annual_cad: Math.max(0, finite(scenario.land.administration_annual_cad)),
    vacancy_reserve_annual_cad: 0
  };
  const reserveBaseAnnual = sumObjectValues(landPoolsBeforeReserve);
  const landPools = {...landPoolsBeforeReserve, vacancy_reserve_annual_cad: reserveBaseAnnual * Math.max(0, finite(scenario.land.vacancy_reserve_rate_annual))};
  const leaseAllocations = allocatePool({households, pools: landPools, method: scenario.community.allocation_method});
  const infrastructure = projectInfrastructure(scenario, count);
  const householdOutput = households.map((household, index) => {
    const dwellingFinance = financeCapital({
      value: scenario.dwelling.capital_cost_cad,
      ownership: scenario.dwelling.ownership === 'owned_out_right' ? 'owned_out_right' : 'financed',
      downPaymentRate: scenario.dwelling.down_payment_rate,
      downPaymentCad: scenario.dwelling.down_payment_cad,
      interestRateAnnual: scenario.dwelling.interest_rate_annual,
      amortizationYears: scenario.dwelling.amortization_years
    });
    const dwellingMaintenanceAnnual = Math.max(0, finite(scenario.dwelling.capital_cost_cad)) * Math.max(0, finite(scenario.dwelling.maintenance_replacement_rate_annual));
    const siteLease = leaseAllocations[index];
    const sharedServiceAnnual = infrastructure.annual_costs_cad.total / count;
    const recurring = {
      dwelling_financing_monthly_cad: dwellingFinance.monthly_debt_service_cad,
      dwelling_maintenance_replacement_monthly_cad: dwellingMaintenanceAnnual / 12,
      site_lease_monthly_cad: siteLease.monthly_total_cad,
      shared_infrastructure_service_monthly_cad: sharedServiceAnnual / 12,
      household_utilities_maintenance_monthly_cad: Math.max(0, finite(scenario.dwelling.household_utilities_annual_cad)) / 12
    };
    return {
      household_id: household.household_id,
      label: household.label,
      members: household.members,
      buildings: household.buildings,
      site_id: scenario.site_id,
      calculated_productive_land_ha: round(household.transition.establishment_land_requirement_ha, 6),
      mature_productive_land_requirement_ha: round(household.transition.mature_land_requirement_ha, 6),
      establishment_peak_year: household.transition.establishment_peak_year,
      household_food_demand_gj_year: household.result.household_food_gj_year,
      dwelling: {capital_cost_cad: round(scenario.dwelling.capital_cost_cad), financing: dwellingFinance, maintenance_replacement_annual_cad: round(dwellingMaintenanceAnnual)},
      site_lease: {...siteLease, allocation_method: scenario.community.allocation_method, allocation_method_description: SITE_LEASE_ALLOCATION_METHODS[scenario.community.allocation_method]},
      shared_infrastructure_service: {annual_cad: round(sharedServiceAnnual), monthly_cad: round(sharedServiceAnnual / 12)},
      recurring_monthly_cost_cad: Object.fromEntries(Object.entries(recurring).map(([key, value]) => [key, round(value)])),
      total_recurring_monthly_cost_cad: round(sumObjectValues(recurring)),
      physical_carrying_capacity: {
        establishment_land_requirement_ha: round(household.transition.establishment_land_requirement_ha, 6),
        mature_land_requirement_ha: round(household.transition.mature_land_requirement_ha, 6),
        heating_area_ha: round(household.result.heating_area_ha, 6),
        household_food_demand_gj_year: household.result.household_food_gj_year
      }
    };
  });
  const annualLeaseRevenue = leaseAllocations.reduce((sum, row) => sum + row.annual_total_cad, 0);
  const annualSharedRevenue = infrastructure.annual_costs_cad.total;
  const annualLandCosts = landRecoveryAnnual + propertyTaxAnnual + landPools.land_insurance_annual_cad + landPools.common_land_costs_annual_cad + landPools.administration_annual_cad + landPools.vacancy_reserve_annual_cad;
  const annualProjectCosts = annualLandCosts + infrastructure.annual_costs_cad.total;
  const totalProjectRevenue = annualLeaseRevenue + annualSharedRevenue;
  const result = {
    contract_version: ARC_SITE_LEASE_CONTRACT_VERSION,
    model: 'resident-owned dwelling + project-owned ARC land + household site lease + shared infrastructure/service charge',
    scenario: {
      project_id: scenario.community.project_id,
      project_label: scenario.community.label,
      site_id: scenario.site_id,
      site_label: siteClasses[scenario.site_id].label,
      household_count: count,
      common_area_ha: round(commonArea, 6),
      allocation_method: scenario.community.allocation_method,
      legal_lease_term_years: finite(scenario.land.legal_lease_term_years),
      debt_amortization_is_separate_from_legal_lease_term: true
    },
    physical_inputs: {
      household_productive_area_basis: 'canonical carrying-capacity establishment peak exclusive land requirement',
      productive_household_area_ha: round(productive, 6),
      mature_productive_household_area_ha: round(matureProductive, 6),
      total_property_area_ha: round(totalPropertyArea, 6),
      common_area_ha: round(commonArea, 6),
      household_results: householdOutput.map((row) => row.physical_carrying_capacity)
    },
    project_land: {
      total_property_area_ha: round(totalPropertyArea, 6),
      land_price_cad_per_ha: round(scenario.land.price_cad_per_ha),
      total_land_value_cad: round(landValue),
      financing: landFinance,
      annual_costs_cad: {
        land_finance_recovery: round(landRecoveryAnnual),
        property_tax: round(propertyTaxAnnual),
        land_insurance: round(landPools.land_insurance_annual_cad),
        common_land_costs: round(landPools.common_land_costs_annual_cad),
        administration: round(landPools.administration_annual_cad),
        vacancy_reserve: round(landPools.vacancy_reserve_annual_cad),
        total: round(annualLandCosts)
      },
      costs_classification: {land_finance_recovery: 'capital recovery', property_tax: 'operating expense', land_insurance: 'operating expense', common_land_costs: 'operating expense', administration: 'operating expense', vacancy_reserve: 'reserve'}
    },
    infrastructure,
    households: householdOutput,
    project: {
      annual_revenue_cad: {site_leases: round(annualLeaseRevenue), shared_services: round(annualSharedRevenue), total: round(totalProjectRevenue)},
      annual_costs_cad: {land: round(annualLandCosts), shared_infrastructure: round(infrastructure.annual_costs_cad.total), total: round(annualProjectCosts)},
      annual_reserves_cad: round(landPools.vacancy_reserve_annual_cad + infrastructure.reserve_contribution_annual_cad),
      break_even: {status: totalProjectRevenue + 0.1 >= annualProjectCosts ? 'break_even_or_surplus' : 'shortfall', annual_surplus_or_shortfall_cad: round(totalProjectRevenue - annualProjectCosts), revenue_equals_required_cost_recovery: Math.abs(totalProjectRevenue - annualProjectCosts) < .1}
    },
    allocation_sensitivity: calculateSiteLeaseAllocationSensitivity({scenario, households, pools: landPools}),
    evidence: SITE_LEASE_EVIDENCE,
    assumptions: {
      dwelling_cost_is_not_from_a_current_local_build_quote: true,
      land_price_is_not_a_current_observed_grey_county_market_value: true,
      infrastructure_values_require_site_design_and_quotes: true,
      resident_owns_dwelling_and_does_not_own_project_land: true,
      carrying_capacity_is_physical_requirement_not_a_financing_coefficient: true
    }
  };
  return result;
}

export function calculateSiteLeaseAllocationSensitivity({scenario, households, pools} = {}) {
  return Object.entries(SITE_LEASE_ALLOCATION_METHODS).map(([method, description]) => {
    const rows = allocatePool({households, pools, method});
    return {
      method,
      description,
      household_monthly_site_lease_cad: rows.map((row) => ({household_id: row.household_id, monthly_total_cad: row.monthly_total_cad})),
      lowest_monthly_cad: round(Math.min(...rows.map((row) => row.monthly_total_cad))),
      highest_monthly_cad: round(Math.max(...rows.map((row) => row.monthly_total_cad))),
      average_monthly_cad: round(rows.reduce((sum, row) => sum + row.monthly_total_cad, 0) / rows.length)
    };
  });
}

export function buildSiteLeasePresentationContract() {
  const ordinary = calculateArcSiteLeaseEconomics({
    scenario: {...deepClone(DEFAULT_SITE_LEASE_SCENARIO), community: {...deepClone(DEFAULT_SITE_LEASE_SCENARIO.community), household_count: 1}, household: {...deepClone(DEFAULT_SITE_LEASE_SCENARIO.household), label: 'Reference adult man'}}
  });
  const family = calculateArcSiteLeaseEconomics({
    scenario: {...deepClone(DEFAULT_SITE_LEASE_SCENARIO), household: {household_id: 'family-1', label: '2 adults + 2 children', members: ['adult_woman', 'adult_man', 'child_girl_8', 'adolescent_boy_14'], buildings: [defaultBuilding()]}, community: {...deepClone(DEFAULT_SITE_LEASE_SCENARIO.community), household_count: 1}}
  });
  return {
    contract_version: ARC_SITE_LEASE_CONTRACT_VERSION,
    api: 'calculateArcSiteLeaseEconomics',
    planning_guideline: {productive_land_per_adult_ha: 1, label: 'Approximately 1 ha of productive land per adult is an early ARC planning benchmark; the property/household model refines it.'},
    allocation_methods: SITE_LEASE_ALLOCATION_METHODS,
    evidence: SITE_LEASE_EVIDENCE,
    default_inputs: {land_price_cad_per_ha: DEFAULT_SITE_LEASE_SCENARIO.land.price_cad_per_ha, dwelling_capital_cost_cad: DEFAULT_SITE_LEASE_SCENARIO.dwelling.capital_cost_cad, legal_lease_term_years: DEFAULT_SITE_LEASE_SCENARIO.land.legal_lease_term_years},
    examples: {
      one_adult_ordinary: {productive_land_ha: ordinary.households[0].calculated_productive_land_ha, mature_land_ha: ordinary.households[0].mature_productive_land_requirement_ha, total_recurring_monthly_cost_cad: ordinary.households[0].total_recurring_monthly_cost_cad},
      family_ordinary: {productive_land_ha: family.households[0].calculated_productive_land_ha, mature_land_ha: family.households[0].mature_productive_land_requirement_ha, total_recurring_monthly_cost_cad: family.households[0].total_recurring_monthly_cost_cad}
    },
    notes: [
      'Resident-owned dwelling capital is separate from project land and is never included in land principal.',
      'Site lease recovers project land costs; shared infrastructure is reported as a separate service charge.',
      'Community size, land price, tax, infrastructure and financing are scenario inputs pending property-specific evidence.'
    ]
  };
}
