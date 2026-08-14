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
import {calculateLandLeaseAccounting, financeCapital, monthlyDebtService} from './site-lease-browser.mjs';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const round = (value, digits = 2) => Math.round(Number(value) * 10 ** digits) / 10 ** digits;
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const deepClone = (value) => JSON.parse(JSON.stringify(value));

export const ARC_SITE_LEASE_CONTRACT_VERSION = '1.3.0';
export const SITE_LEASE_ALLOCATION_METHODS = {
  proportional_hectares: 'All allocable site-lease pools are proportional to calculated productive hectares.',
  base_plus_hectare: 'Recommended: productive-land value and area-dependent tax follow productive hectares; common-property value and fixed land-holding costs are divided equally.',
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

export const LAND_FINANCING_EVIDENCE = {
  status: 'planning_range_not_product_specific',
  sources: [
    {
      institution: 'Farm Credit Canada',
      title: 'Borrowing basics - 3 ways to prepare for your next loan',
      date: 'current web guidance accessed 2026-08-14',
      url: 'https://www.fcc-fac.ca/en/knowledge/borrowing-basics',
      finding: 'FCC says land loans typically require 25% down, land loans can reach up to 29 years, and most are in the 20-25-year range. It distinguishes a loan term, such as 5 or 10 years, from the amortization period.',
      evidence_status: 'primary lender guidance; not a binding quote or universal requirement'
    },
    {
      institution: 'Farm Credit Canada',
      title: 'Land and Buildings',
      date: 'current web product page accessed 2026-08-14',
      url: 'https://www.fcc-fac.ca/en/financing/agriculture/land-buildings',
      finding: 'FCC offers producer land/building financing with lender-selected interest terms, maturity dates, amortization periods and repayment schedules.',
      evidence_status: 'primary lender product description; entity eligibility and pricing require underwriting'
    },
    {
      institution: 'Agriculture and Agri-Food Canada',
      title: 'Canadian Agricultural Loans Act Program: Before you apply',
      date: '2020-01-14 page; current program page accessed 2026-08-14',
      url: 'https://agriculture.canada.ca/en/programs/canadian-agricultural-loans-act/step-3-before-apply',
      finding: 'CALA loans are administered by lenders for eligible farmers and agricultural co-operatives. The maximum repayment term for land purchases is 15 years, although a lender may amortize longer with a balloon payment at year 15; floating and fixed rate caps are defined relative to lender rates.',
      evidence_status: 'government program rule; eligibility for an ARC land-holding entity must be confirmed'
    },
    {
      institution: 'Farm Credit Canada',
      title: 'Deteriorating farmland affordability presents challenges',
      date: '2024 web analysis accessed 2026-08-14',
      url: 'https://www.fcc-fac.ca/en/knowledge/economics/deteriorating-farmland-affordability',
      finding: 'FCC uses 25% down and 25-year amortization as an analytical farmland-purchase assumption.',
      evidence_status: 'primary lender analytical convention; not a product promise'
    }
  ],
  interpretation: {
    down_payment: '25% is the best-supported neutral planning case found; actual equity, collateral and lender policy may differ.',
    amortization: '20-25 years is the neutral planning band in FCC guidance. A 30-year amortization is possible in some land products but is not established here for an ARC land-holding entity.',
    loan_term: 'Loan term/renewal is separate from amortization. The project must refinance or renew at the term end unless it has an open or fully amortizing structure.',
    interest_rate: 'No current public lender quote was found for this specific entity and security structure. Use lender-quoted rates or explicit sensitivity cases, not a canonical expected rate.',
    eligibility: 'The ARC entity must be assessed as an agricultural producer/co-operative, commercial borrower, land trust/non-profit or another eligible borrower; residential mortgage assumptions do not establish eligibility.'
  },
  planning_sensitivities: {
    down_payment_rates: [.10, .20, .25, .30],
    interest_rate_annual: [.04, .06, .08],
    amortization_years: [15, 20, 25, 30],
    loan_terms_years: [5, 10, 15]
  }
};

export const LAND_FINANCING_SCENARIOS = {
  illustrative_current: {
    id: 'illustrative_current',
    label: 'Illustrative current case',
    down_payment_rate: .20,
    interest_rate_annual: .06,
    amortization_years: 30,
    loan_term_years: 5,
    status: 'illustrative_not_canonical',
    note: 'Retained for continuity with the existing public URL and reports; not a forecast of ARC land financing.'
  },
  neutral_land_planning: {
    id: 'neutral_land_planning',
    label: 'Neutral land-planning comparison',
    down_payment_rate: .25,
    interest_rate_annual: .06,
    amortization_years: 25,
    loan_term_years: 5,
    status: 'planning_comparison',
    note: '25% down and 25-year amortization follow FCC land-financing analytical conventions; the interest rate remains an explicit scenario input.'
  },
  cala_land_purchase: {
    id: 'cala_land_purchase',
    label: 'CALA-style land comparison',
    down_payment_rate: .20,
    interest_rate_annual: .06,
    amortization_years: 15,
    loan_term_years: 15,
    status: 'eligibility_dependent',
    note: 'Illustrates a 15-year land repayment horizon consistent with CALA limits; eligibility and lender terms must be confirmed.'
  }
};

const REQUIREDNESS_LABELS = {
  legally_required: 'legally required',
  physically_necessary: 'physically necessary',
  cost_saving_option: 'cost-saving option',
  convenience_amenity: 'convenience/amenity',
  unresolved_site_specific: 'unresolved/site-specific'
};

const infrastructureComponent = (id, label, {
  capital_cost_cad = 0,
  annual_operating_cost_cad = 0,
  requiredness = 'unresolved_site_specific',
  source_status = 'planning assumption; site-specific legal/design review required',
  distributed_capital_cost_per_household_cad = 0,
  distributed_annual_operating_cost_per_household_cad = 0,
  notes = ''
} = {}) => ({
  id,
  label,
  capital_cost_cad,
  annual_operating_cost_cad,
  requiredness: REQUIREDNESS_LABELS[requiredness] ?? requiredness,
  source_status,
  distributed_capital_cost_per_household_cad,
  distributed_annual_operating_cost_per_household_cad,
  notes
});

const infrastructureFinancing = {ownership: 'financed', down_payment_rate: .20, interest_rate_annual: .06, amortization_years: 30};

/**
 * Infrastructure alternatives are deliberately explicit. A zero centralized
 * cost can mean that the function is distributed to households, not that the
 * physical requirement disappeared.
 */
export const INFRASTRUCTURE_SCENARIOS = {
  legacy_current: {
    id: 'legacy_current',
    label: 'Legacy current shared-services baseline',
    affordability_default: false,
    description: 'The pre-audit configuration, retained to explain the former $1,162/month result.',
    reserve_policy: {default_mode: 'full_lifecycle', early_life_rate_annual: .005, full_lifecycle_rate_annual: .01, starts_year: 1},
    maintenance_rate_annual: .02,
    financing: infrastructureFinancing,
    capital_components: {
      internal_access: infrastructureComponent('internal_access', 'Internal road/access', {capital_cost_cad: 250000, requiredness: 'physically_necessary', notes: 'Road/access capital was a single legacy placeholder.'}),
      road_maintenance: infrastructureComponent('road_maintenance', 'Road maintenance', {annual_operating_cost_cad: 10000, requiredness: 'physically_necessary', notes: 'Split from the legacy road/snow operating pool for audit display.'}),
      snow_clearing: infrastructureComponent('snow_clearing', 'Snow clearing', {annual_operating_cost_cad: 8000, requiredness: 'physically_necessary', notes: 'Split from the legacy road/snow operating pool for audit display.'}),
      shared_water: infrastructureComponent('shared_water', 'Shared water supply/treatment', {capital_cost_cad: 180000, annual_operating_cost_cad: 5000, requiredness: 'unresolved_site_specific'}),
      shared_sewage: infrastructureComponent('shared_sewage', 'Shared sewage/greywater', {capital_cost_cad: 250000, annual_operating_cost_cad: 7000, requiredness: 'unresolved_site_specific'}),
      electrical_distribution: infrastructureComponent('electrical_distribution', 'Electrical distribution', {requiredness: 'unresolved_site_specific', notes: 'Not separately costed in the legacy configuration.'}),
      common_laundry: infrastructureComponent('common_laundry', 'Common laundry', {requiredness: 'convenience_amenity', notes: 'Not separately costed in the legacy configuration.'}),
      common_building: infrastructureComponent('common_building', 'Workshop/common building', {capital_cost_cad: 250000, annual_operating_cost_cad: 12000, requiredness: 'convenience_amenity'}),
      shared_equipment: infrastructureComponent('shared_equipment', 'Shared equipment', {capital_cost_cad: 75000, requiredness: 'convenience_amenity'}),
      waste_system: infrastructureComponent('waste_system', 'Waste handling', {capital_cost_cad: 50000, requiredness: 'physically_necessary', notes: 'Capital placeholder; no separate operating cost in legacy pool.'}),
      insurance: infrastructureComponent('insurance', 'Infrastructure insurance', {annual_operating_cost_cad: 15000, requiredness: 'physically_necessary'}),
      administration: infrastructureComponent('administration', 'Infrastructure administration', {annual_operating_cost_cad: 18000, requiredness: 'physically_necessary', notes: 'Potentially overlaps with land-holding administration; retained for baseline audit.'}),
      shared_heating: infrastructureComponent('shared_heating', 'Centralized heating', {requiredness: 'unresolved_site_specific', notes: 'Heating remains household/building-based in the canonical model.'})
    }
  },
  minimal_compliant: {
    id: 'minimal_compliant',
    label: 'Minimal compliant ARC',
    affordability_default: true,
    description: 'Only a basic access route, small waste/compost function and essential project insurance are centralized; water, wastewater and electricity remain site-specific distributed options.',
    reserve_policy: {default_mode: 'early_life', early_life_rate_annual: .005, full_lifecycle_rate_annual: .01, starts_year: 1},
    maintenance_rate_annual: .015,
    financing: infrastructureFinancing,
    capital_components: {
      internal_access: infrastructureComponent('internal_access', 'Gravel internal road/access', {capital_cost_cad: 120000, annual_operating_cost_cad: 0, requiredness: 'physically_necessary', notes: 'Gravel/emergency access placeholder; road standard must be confirmed with the municipality and fire authority.'}),
      road_maintenance: infrastructureComponent('road_maintenance', 'Road maintenance', {annual_operating_cost_cad: 6000, requiredness: 'physically_necessary'}),
      snow_clearing: infrastructureComponent('snow_clearing', 'Snow clearing', {annual_operating_cost_cad: 4000, requiredness: 'physically_necessary'}),
      shared_water: infrastructureComponent('shared_water', 'Shared water supply/treatment', {requiredness: 'unresolved_site_specific', distributed_capital_cost_per_household_cad: 14000, distributed_annual_operating_cost_per_household_cad: 600, notes: 'Distributed well/rainwater/treatment alternative; legal feasibility is site-specific.'}),
      shared_sewage: infrastructureComponent('shared_sewage', 'Shared sewage/greywater', {requiredness: 'unresolved_site_specific', distributed_capital_cost_per_household_cad: 16000, distributed_annual_operating_cost_per_household_cad: 750, notes: 'Distributed septic/greywater/composting alternative; legal feasibility is site-specific.'}),
      electrical_distribution: infrastructureComponent('electrical_distribution', 'Electrical distribution', {requiredness: 'unresolved_site_specific', distributed_capital_cost_per_household_cad: 12000, distributed_annual_operating_cost_per_household_cad: 900, notes: 'Household grid connection or individual solar/storage alternative; not a measured quote.'}),
      common_laundry: infrastructureComponent('common_laundry', 'Common laundry', {requiredness: 'convenience_amenity', notes: 'No common laundry in the minimal scenario; household laundry is not priced as shared infrastructure.'}),
      common_building: infrastructureComponent('common_building', 'Workshop/common building', {requiredness: 'convenience_amenity', notes: 'No common building in the minimal scenario.'}),
      shared_equipment: infrastructureComponent('shared_equipment', 'Shared equipment', {requiredness: 'convenience_amenity', notes: 'No shared equipment in the minimal scenario.'}),
      waste_system: infrastructureComponent('waste_system', 'Waste and compost systems', {capital_cost_cad: 20000, annual_operating_cost_cad: 4000, requiredness: 'physically_necessary'}),
      insurance: infrastructureComponent('insurance', 'Infrastructure insurance', {annual_operating_cost_cad: 8000, requiredness: 'physically_necessary'}),
      administration: infrastructureComponent('administration', 'Infrastructure administration', {requiredness: 'physically_necessary', notes: 'Land-holding administration remains in the site-lease layer; not charged again here.'}),
      shared_heating: infrastructureComponent('shared_heating', 'Centralized heating', {requiredness: 'unresolved_site_specific', notes: 'Household building heat and woody hectares remain the canonical baseline; no central heating capital is assumed.'})
    }
  },
  shared_services: {
    id: 'shared_services',
    label: 'Shared-services ARC',
    affordability_default: false,
    description: 'Adds centralized services where sharing may create an economy of scale, while keeping optional facilities visible.',
    reserve_policy: {default_mode: 'early_life', early_life_rate_annual: .005, full_lifecycle_rate_annual: .01, starts_year: 1},
    maintenance_rate_annual: .02,
    financing: infrastructureFinancing,
    capital_components: {
      internal_access: infrastructureComponent('internal_access', 'Internal road/access', {capital_cost_cad: 180000, requiredness: 'physically_necessary'}),
      road_maintenance: infrastructureComponent('road_maintenance', 'Road maintenance', {annual_operating_cost_cad: 10000, requiredness: 'physically_necessary'}),
      snow_clearing: infrastructureComponent('snow_clearing', 'Snow clearing', {annual_operating_cost_cad: 8000, requiredness: 'physically_necessary'}),
      shared_water: infrastructureComponent('shared_water', 'Shared water supply/treatment', {capital_cost_cad: 180000, annual_operating_cost_cad: 5000, requiredness: 'cost_saving_option', distributed_capital_cost_per_household_cad: 14000, distributed_annual_operating_cost_per_household_cad: 600}),
      shared_sewage: infrastructureComponent('shared_sewage', 'Shared sewage/greywater', {capital_cost_cad: 220000, annual_operating_cost_cad: 7000, requiredness: 'cost_saving_option', distributed_capital_cost_per_household_cad: 16000, distributed_annual_operating_cost_per_household_cad: 750}),
      electrical_distribution: infrastructureComponent('electrical_distribution', 'Electrical distribution', {capital_cost_cad: 80000, annual_operating_cost_cad: 2000, requiredness: 'cost_saving_option', distributed_capital_cost_per_household_cad: 12000, distributed_annual_operating_cost_per_household_cad: 900}),
      common_laundry: infrastructureComponent('common_laundry', 'Common laundry', {capital_cost_cad: 90000, annual_operating_cost_cad: 6000, requiredness: 'cost_saving_option', distributed_capital_cost_per_household_cad: 1500, distributed_annual_operating_cost_per_household_cad: 150}),
      common_building: infrastructureComponent('common_building', 'Workshop/common building', {capital_cost_cad: 150000, annual_operating_cost_cad: 10000, requiredness: 'convenience_amenity'}),
      shared_equipment: infrastructureComponent('shared_equipment', 'Shared equipment', {capital_cost_cad: 75000, annual_operating_cost_cad: 2000, requiredness: 'cost_saving_option'}),
      waste_system: infrastructureComponent('waste_system', 'Waste handling', {capital_cost_cad: 30000, annual_operating_cost_cad: 3000, requiredness: 'physically_necessary'}),
      insurance: infrastructureComponent('insurance', 'Infrastructure insurance', {annual_operating_cost_cad: 12000, requiredness: 'physically_necessary'}),
      administration: infrastructureComponent('administration', 'Infrastructure administration', {requiredness: 'physically_necessary', notes: 'Shared operational administration is covered by the land-holding administration allowance in the central case.'}),
      shared_heating: infrastructureComponent('shared_heating', 'Centralized heating', {requiredness: 'unresolved_site_specific', notes: 'No central heating cost credited without a local design and fuel-price evidence.'})
    }
  },
  amenity_rich: {
    id: 'amenity_rich',
    label: 'Amenity-rich ARC',
    affordability_default: false,
    description: 'Adds a larger common building, laundry, electrical distribution and shared equipment beyond the minimal housing/productive-land requirement.',
    reserve_policy: {default_mode: 'full_lifecycle', early_life_rate_annual: .005, full_lifecycle_rate_annual: .01, starts_year: 1},
    maintenance_rate_annual: .02,
    financing: infrastructureFinancing,
    capital_components: {
      internal_access: infrastructureComponent('internal_access', 'Internal road/access', {capital_cost_cad: 250000, requiredness: 'physically_necessary'}),
      road_maintenance: infrastructureComponent('road_maintenance', 'Road maintenance', {annual_operating_cost_cad: 10000, requiredness: 'physically_necessary'}),
      snow_clearing: infrastructureComponent('snow_clearing', 'Snow clearing', {annual_operating_cost_cad: 8000, requiredness: 'physically_necessary'}),
      shared_water: infrastructureComponent('shared_water', 'Shared water supply/treatment', {capital_cost_cad: 180000, annual_operating_cost_cad: 5000, requiredness: 'cost_saving_option'}),
      shared_sewage: infrastructureComponent('shared_sewage', 'Shared sewage/greywater', {capital_cost_cad: 250000, annual_operating_cost_cad: 7000, requiredness: 'cost_saving_option'}),
      electrical_distribution: infrastructureComponent('electrical_distribution', 'Electrical distribution', {capital_cost_cad: 100000, annual_operating_cost_cad: 2000, requiredness: 'cost_saving_option'}),
      common_laundry: infrastructureComponent('common_laundry', 'Common laundry', {capital_cost_cad: 120000, annual_operating_cost_cad: 7000, requiredness: 'convenience_amenity'}),
      common_building: infrastructureComponent('common_building', 'Workshop/common building', {capital_cost_cad: 250000, annual_operating_cost_cad: 12000, requiredness: 'convenience_amenity'}),
      shared_equipment: infrastructureComponent('shared_equipment', 'Shared equipment', {capital_cost_cad: 75000, annual_operating_cost_cad: 2000, requiredness: 'convenience_amenity'}),
      waste_system: infrastructureComponent('waste_system', 'Waste handling', {capital_cost_cad: 50000, annual_operating_cost_cad: 4000, requiredness: 'physically_necessary'}),
      insurance: infrastructureComponent('insurance', 'Infrastructure insurance', {annual_operating_cost_cad: 15000, requiredness: 'physically_necessary'}),
      administration: infrastructureComponent('administration', 'Infrastructure administration', {requiredness: 'physically_necessary', notes: 'Shared operational administration remains separate from land-holding administration in this sensitivity.'}),
      shared_heating: infrastructureComponent('shared_heating', 'Centralized heating', {requiredness: 'unresolved_site_specific', notes: 'No central heating cost credited without a local design and fuel-price evidence.'})
    }
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
    fixed_land_reserve_annual_cad: 0,
    vacancy_reserve_rate_annual: 0.05,
    legal_lease_term_years: 49,
    ownership: 'financed',
    down_payment_rate: 0.20,
    interest_rate_annual: 0.06,
    amortization_years: 30,
    loan_term_years: 5,
    financing_scenario_id: 'illustrative_current',
    recovery_mode: 'debt_service'
  },
  land_reservation_basis: 'maximum_transition_exclusive_footprint',
  infrastructure_scenario_id: 'minimal_compliant',
  infrastructure: deepClone(INFRASTRUCTURE_SCENARIOS.minimal_compliant)
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
  return {
    household_id: household.household_id ?? 'household-1',
    label: household.label ?? 'ARC household',
    members,
    buildings,
    result,
    transition,
    establishment_land_requirement_ha: finite(transition.establishment_land_requirement_ha),
    mature_land_requirement_ha: finite(transition.mature_land_requirement_ha)
  };
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
  const financing = infrastructure.financing ?? DEFAULT_SITE_LEASE_SCENARIO.infrastructure.financing;
  const operatingOverrides = infrastructure.annual_operating_costs_cad ?? {};
  const operatingAliases = {
    road_maintenance: operatingOverrides.road_access_and_snow == null ? null : finite(operatingOverrides.road_access_and_snow) * 10 / 18,
    snow_clearing: operatingOverrides.road_access_and_snow == null ? null : finite(operatingOverrides.road_access_and_snow) * 8 / 18,
    shared_water: operatingOverrides.water_sewage_operations == null ? null : finite(operatingOverrides.water_sewage_operations) * 5 / 12,
    shared_sewage: operatingOverrides.water_sewage_operations == null ? null : finite(operatingOverrides.water_sewage_operations) * 7 / 12,
    common_building: operatingOverrides.common_building_utilities,
    insurance: operatingOverrides.insurance,
    administration: operatingOverrides.administration
  };
  const reservePolicy = infrastructure.reserve_policy ?? {};
  const reserveMode = infrastructure.replacement_reserve_mode ?? reservePolicy.default_mode ?? 'full_lifecycle';
  const reserveRate = infrastructure.replacement_reserve_rate_annual == null
    ? Math.max(0, finite(reservePolicy[reserveMode === 'early_life' ? 'early_life_rate_annual' : 'full_lifecycle_rate_annual'], .01))
    : Math.max(0, finite(infrastructure.replacement_reserve_rate_annual));
  const maintenanceRate = Math.max(0, finite(infrastructure.maintenance_rate_annual));
  const components = Object.fromEntries(Object.entries(infrastructure.capital_components ?? {}).map(([id, row]) => {
    const included = row.included !== false;
    const explicitOperating = row.annual_operating_cost_cad;
    const operating = explicitOperating == null
      ? (operatingOverrides[id] == null ? operatingAliases[id] : operatingOverrides[id])
      : explicitOperating;
    return [id, {
      ...row,
      id,
      label: row.label ?? id,
      included,
      capital_cost_cad: included ? Math.max(0, finite(row.capital_cost_cad)) : 0,
      annual_operating_cost_cad: included ? Math.max(0, finite(operating)) : 0,
      maintenance_rate_annual: Math.max(0, finite(row.maintenance_rate_annual, maintenanceRate)),
      distributed_capital_cost_per_household_cad: Math.max(0, finite(row.distributed_capital_cost_per_household_cad)),
      distributed_annual_operating_cost_per_household_cad: Math.max(0, finite(row.distributed_annual_operating_cost_per_household_cad))
    }];
  }));
  const rows = Object.values(components);
  const capitalValue = rows.reduce((sum, row) => sum + row.capital_cost_cad, 0);
  const finance = financeCapital({
    value: capitalValue,
    ownership: financing.ownership ?? 'financed',
    downPaymentRate: financing.down_payment_rate,
    downPaymentCad: financing.down_payment_cad,
    interestRateAnnual: financing.interest_rate_annual,
    amortizationYears: financing.amortization_years
  });
  const lineItems = rows.map((row) => {
    const lineFinance = financeCapital({
      value: row.capital_cost_cad,
      ownership: financing.ownership ?? 'financed',
      downPaymentRate: financing.down_payment_rate,
      downPaymentCad: financing.down_payment_cad == null ? null : finite(financing.down_payment_cad) * row.capital_cost_cad / Math.max(.000001, capitalValue),
      interestRateAnnual: financing.interest_rate_annual,
      amortizationYears: financing.amortization_years
    });
    const debtServiceAnnual = lineFinance.monthly_debt_service_cad * 12;
    const maintenanceAnnual = row.capital_cost_cad * row.maintenance_rate_annual;
    const replacementAnnual = row.capital_cost_cad * reserveRate;
    const annualTotal = debtServiceAnnual + row.annual_operating_cost_cad + maintenanceAnnual + replacementAnnual;
    return {
      id: row.id,
      component: row.label,
      label: row.label,
      included: row.included,
      capital_cost_cad: round(row.capital_cost_cad),
      financing_term: {
        ownership: lineFinance.ownership,
        down_payment_cad: lineFinance.down_payment_cad,
        financed_principal_cad: lineFinance.financed_principal_cad,
        interest_rate_annual: lineFinance.interest_rate_annual,
        amortization_years: lineFinance.amortization_years,
        debt_service_annual_cad: round(debtServiceAnnual)
      },
      annual_operating_cost_cad: round(row.annual_operating_cost_cad),
      annual_maintenance_cad: round(maintenanceAnnual),
      replacement_reserve_annual_cad: round(replacementAnnual),
      annual_total_cad: round(annualTotal),
      monthly_household_allocation_cad: round(annualTotal / householdCount / 12),
      requiredness: row.requiredness,
      source_status: row.source_status,
      notes: row.notes,
      distributed_alternative: {
        capital_cost_per_household_cad: round(row.distributed_capital_cost_per_household_cad),
        annual_operating_cost_per_household_cad: round(row.distributed_annual_operating_cost_per_household_cad)
      }
    };
  });
  const annualCosts = {
    capital_debt_service: lineItems.reduce((sum, row) => sum + row.financing_term.debt_service_annual_cad, 0),
    operating: lineItems.reduce((sum, row) => sum + row.annual_operating_cost_cad, 0),
    maintenance: lineItems.reduce((sum, row) => sum + row.annual_maintenance_cad, 0),
    replacement_reserve: lineItems.reduce((sum, row) => sum + row.replacement_reserve_annual_cad, 0)
  };
  annualCosts.total = Object.values(annualCosts).reduce((sum, value) => sum + value, 0);
  const reserveSensitivity = ['early_life', 'full_lifecycle'].map((mode) => {
    const rate = Math.max(0, finite(reservePolicy[mode === 'early_life' ? 'early_life_rate_annual' : 'full_lifecycle_rate_annual'], mode === 'early_life' ? .005 : .01));
    const reserve = capitalValue * rate;
    const annualTotal = annualCosts.capital_debt_service + annualCosts.operating + annualCosts.maintenance + reserve;
    return {
      mode,
      reserve_rate_annual: rate,
      reserve_starts_year: finite(reservePolicy.starts_year, 1),
      annual_reserve_cad: round(reserve),
      annual_total_cad: round(annualTotal),
      monthly_household_allocation_cad: round(annualTotal / householdCount / 12)
    };
  });
  const distributed_vs_centralized = lineItems.map((row) => {
    const distributedCapital = row.distributed_alternative.capital_cost_per_household_cad * householdCount;
    const distributedFinance = financeCapital({
      value: distributedCapital,
      ownership: financing.ownership ?? 'financed',
      downPaymentRate: financing.down_payment_rate,
      downPaymentCad: financing.down_payment_cad == null ? null : finite(financing.down_payment_cad) * distributedCapital,
      interestRateAnnual: financing.interest_rate_annual,
      amortizationYears: financing.amortization_years
    });
    const distributedDebtAnnual = distributedFinance.monthly_debt_service_cad * 12;
    const distributedMaintenance = distributedCapital * maintenanceRate;
    const distributedReserve = distributedCapital * reserveRate;
    const distributedOperating = row.distributed_alternative.annual_operating_cost_per_household_cad * householdCount;
    const distributedAnnual = distributedDebtAnnual + distributedOperating + distributedMaintenance + distributedReserve;
    const centralAnnualPerHousehold = row.annual_total_cad / householdCount;
    const distributedAnnualPerHousehold = distributedAnnual / householdCount;
    const hasComparison = distributedCapital > 0 || distributedOperating > 0 || row.capital_cost_cad > 0 || row.annual_operating_cost_cad > 0;
    return {
      component_id: row.id,
      component: row.component,
      household_count: householdCount,
      centralized_annual_per_household_cad: round(centralAnnualPerHousehold),
      distributed_capital_total_cad: round(distributedCapital),
      distributed_annual_operating_total_cad: round(distributedOperating),
      distributed_annual_per_household_cad: round(distributedAnnualPerHousehold),
      distributed_monthly_per_household_cad: round(distributedAnnualPerHousehold / 12),
      result: row.id === 'shared_heating'
        ? 'unresolved'
        : hasComparison && distributedAnnualPerHousehold < centralAnnualPerHousehold
          ? 'distributed_placeholder_lower'
          : hasComparison ? 'centralized_placeholder_lower_or_equal' : 'no_cost_comparison',
      source_status: row.id === 'shared_heating' ? 'unresolved; canonical model prices household/building heating separately' : row.source_status,
      caveat: 'Distributed values are planning placeholders and do not establish legal feasibility or a procurement preference.'
    };
  });
  const distributedCapitalTotal = distributed_vs_centralized.reduce((sum, row) => sum + row.distributed_capital_total_cad, 0);
  const distributedOperatingTotal = distributed_vs_centralized.reduce((sum, row) => sum + row.distributed_annual_operating_total_cad, 0);
  return {
    scenario_id: scenario.infrastructure_scenario_id,
    scenario_label: infrastructure.label,
    description: infrastructure.description,
    capital_components: components,
    line_items: lineItems,
    capital_value_cad: round(capitalValue),
    financing: finance,
    reserve_policy: {
      mode: reserveMode,
      rate_annual: reserveRate,
      starts_year: finite(reservePolicy.starts_year, 1),
      early_life_rate_annual: finite(reservePolicy.early_life_rate_annual, .005),
      full_lifecycle_rate_annual: finite(reservePolicy.full_lifecycle_rate_annual, .01),
      explanation: 'Debt service repays the financed capital. Replacement reserve accumulates separately for future renewal and does not reduce the debt balance.'
    },
    annual_costs_cad: Object.fromEntries(Object.entries(annualCosts).map(([key, value]) => [key, round(value)])),
    costs_classification: {capital_debt_service: 'capital recovery', operating: 'operating expense', maintenance: 'operating expense', replacement_reserve: 'reserve'},
    service_charge_per_household_month_cad: round(annualCosts.total / householdCount / 12),
    annual_cost_per_household_cad: round(annualCosts.total / householdCount),
    reserve_contribution_annual_cad: round(annualCosts.replacement_reserve),
    reserve_sensitivity: reserveSensitivity,
    distributed_alternatives: {
      capital_total_cad: round(distributedCapitalTotal),
      annual_operating_total_cad: round(distributedOperatingTotal),
      comparisons: distributed_vs_centralized
    },
    evidence: SITE_LEASE_EVIDENCE.infrastructure
  };
}

function allocatePool({households, pools, method}) {
  const areaOf = (row) => finite(row.reserved_land_requirement_ha ?? row.establishment_land_requirement_ha ?? row.transition?.establishment_land_requirement_ha);
  const totalHectares = households.reduce((sum, row) => sum + areaOf(row), 0);
  const count = households.length;
  const byHectare = (value, household) => totalHectares > 0 ? value * areaOf(household) / totalHectares : value / count;
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
  const infrastructureScenarioId = source.infrastructure_scenario_id ?? source.infrastructure_scenario ?? DEFAULT_SITE_LEASE_SCENARIO.infrastructure_scenario_id;
  const infrastructureScenario = INFRASTRUCTURE_SCENARIOS[infrastructureScenarioId];
  if (!infrastructureScenario) throw new Error(`Unknown ARC infrastructure scenario: ${infrastructureScenarioId}`);
  const defaultInfrastructure = infrastructureScenario;
  const sourceInfrastructure = source.infrastructure && JSON.stringify(source.infrastructure) !== JSON.stringify(DEFAULT_SITE_LEASE_SCENARIO.infrastructure) ? source.infrastructure : {};
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
      annual_operating_costs_cad: {...deepClone(defaultInfrastructure.annual_operating_costs_cad ?? {}), ...(sourceInfrastructure.annual_operating_costs_cad ?? {})}
    }
  };
  merged.infrastructure_scenario_id = infrastructureScenarioId;
  merged.site_id = source.site_id ?? source.siteId ?? merged.site_id;
  if (!SITE_IDS.has(merged.site_id)) throw new Error(`Unknown carrying-capacity site for lease economics: ${merged.site_id}`);
  const declaredFinancingId = merged.land.financing_scenario_id;
  const declaredFinancing = LAND_FINANCING_SCENARIOS[declaredFinancingId];
  if (declaredFinancing && ['down_payment_rate', 'interest_rate_annual', 'amortization_years', 'loan_term_years'].some((key) => Number(merged.land[key]) !== Number(declaredFinancing[key]))) merged.land.financing_scenario_id = 'custom';
  merged.community.allocation_method = source.community?.allocation_method ?? source.allocation_method ?? merged.community.allocation_method;
  if (!SITE_LEASE_ALLOCATION_METHODS[merged.community.allocation_method]) throw new Error(`Unknown site-lease allocation method: ${merged.community.allocation_method}`);
  return merged;
}

/**
 * Calculate project-owned land and shared-service economics. Legacy dwelling fields
 * remain in the raw internal result for compatibility, but the public contract and
 * reports expose only land lease plus shared infrastructure.
 * All hectares and heat loads come from the canonical carrying-capacity API; monetary
 * values are explicit scenario inputs until local project quotes are available.
 */
export function calculateArcSiteLeaseEconomics(options = {}) {
  const scenario = normalizedScenario(options);
  const inputs = loadCanonicalSiteLeaseInputs();
  const households = normalizeHouseholds(scenario).map((household) => householdCapacity({household, siteId: scenario.site_id, inputs}));
  const count = households.length;
  const landReservationBasis = scenario.land_reservation_basis ?? 'maximum_transition_exclusive_footprint';
  const reservedAreaOf = (row) => landReservationBasis === 'mature_requirement'
    ? row.mature_land_requirement_ha
    : landReservationBasis === 'fixed_planning_allocation'
      ? finite(scenario.fixed_planning_allocation_ha ?? scenario.land.fixed_planning_allocation_ha, 1)
      : row.establishment_land_requirement_ha;
  households.forEach((row) => { row.reserved_land_requirement_ha = finite(reservedAreaOf(row)); });
  const productive = households.reduce((sum, row) => sum + finite(row.reserved_land_requirement_ha), 0);
  const matureProductive = households.reduce((sum, row) => sum + finite(row.mature_land_requirement_ha), 0);
  const commonArea = Math.max(0, finite(scenario.community.common_area_ha));
  const totalPropertyArea = productive + commonArea;
  const landAccounting = calculateLandLeaseAccounting({
    households,
    common_property_land_ha: commonArea,
    land_price_cad_per_ha: scenario.land.price_cad_per_ha,
    ownership: scenario.land.ownership,
    down_payment_rate: scenario.land.down_payment_rate,
    down_payment_cad: scenario.land.down_payment_cad,
    interest_rate_annual: scenario.land.interest_rate_annual,
    amortization_years: scenario.land.amortization_years,
    loan_term_years: scenario.land.loan_term_years,
    recovery_mode: scenario.land.recovery_mode,
    capital_recovery_rate_annual: scenario.land.capital_recovery_rate_annual,
    capital_recovery_years: scenario.land.capital_recovery_years,
    property_tax_rate_annual: scenario.land.property_tax_rate_annual,
    land_insurance_annual_cad: scenario.land.insurance_annual_cad,
    common_land_costs_annual_cad: scenario.land.common_land_costs_annual_cad,
    administration_annual_cad: scenario.land.administration_annual_cad,
    fixed_land_reserve_annual_cad: scenario.land.fixed_land_reserve_annual_cad,
    vacancy_reserve_rate_annual: scenario.land.vacancy_reserve_rate_annual,
    allocation_method: scenario.community.allocation_method
  });
  const landValue = landAccounting.acquisition.total_land_value_cad;
  const landFinance = landAccounting.acquisition.financing;
  const landPools = {
    land_finance_recovery_annual_cad: landAccounting.acquisition.productive_land_finance_recovery_annual_cad + landAccounting.acquisition.common_land_finance_recovery_annual_cad,
    property_tax_annual_cad: landAccounting.common_property_land_holding.annual_components_cad.common_property_tax_annual_cad + landAccounting.productive_land_charge.annual_components_cad.productive_property_tax_annual_cad,
    land_insurance_annual_cad: finite(scenario.land.insurance_annual_cad),
    common_land_costs_annual_cad: finite(scenario.land.common_land_costs_annual_cad),
    administration_annual_cad: finite(scenario.land.administration_annual_cad),
    fixed_land_reserve_annual_cad: finite(scenario.land.fixed_land_reserve_annual_cad),
    vacancy_reserve_annual_cad: landAccounting.common_property_land_holding.annual_vacancy_allowance_cad + landAccounting.productive_land_charge.annual_vacancy_allowance_cad
  };
  const leaseAllocations = scenario.community.allocation_method === 'base_plus_hectare'
    ? landAccounting.allocations
    : allocatePool({households, pools: landPools, method: scenario.community.allocation_method});
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
    const landAllocation = landAccounting.allocations[index];
    const siteLeaseMonthly = scenario.community.allocation_method === 'base_plus_hectare'
      ? landAllocation.monthly_total_cad
      : siteLease.monthly_total_cad;
    const recurring = {
      dwelling_financing_monthly_cad: dwellingFinance.monthly_debt_service_cad,
      dwelling_maintenance_replacement_monthly_cad: dwellingMaintenanceAnnual / 12,
      site_lease_monthly_cad: siteLeaseMonthly,
      shared_infrastructure_service_monthly_cad: sharedServiceAnnual / 12,
      household_utilities_maintenance_monthly_cad: Math.max(0, finite(scenario.dwelling.household_utilities_annual_cad)) / 12
    };
    const baseLandMonthly = scenario.community.allocation_method === 'base_plus_hectare'
      ? landAllocation.common_property_land_holding_charge_monthly_cad
      : siteLeaseMonthly;
    const hectareLandMonthly = scenario.community.allocation_method === 'base_plus_hectare'
      ? landAllocation.productive_land_portion_monthly_cad
      : 0;
    const visibleTotal = sumObjectValues(recurring);
    const detailedSiteLease = scenario.community.allocation_method === 'base_plus_hectare' ? landAllocation : siteLease;
    const sharedInfrastructureMonthly = sharedServiceAnnual / 12;
    const landInfrastructureMonthly = siteLeaseMonthly + sharedInfrastructureMonthly;
    return {
      household_id: household.household_id,
      label: household.label,
      members: household.members,
      buildings: household.buildings,
      site_id: scenario.site_id,
      calculated_productive_land_ha: round(household.reserved_land_requirement_ha, 6),
      canonical_establishment_peak_land_requirement_ha: round(household.transition.establishment_land_requirement_ha, 6),
      reserved_productive_land_ha: round(household.reserved_land_requirement_ha, 6),
      mature_productive_land_requirement_ha: round(household.transition.mature_land_requirement_ha, 6),
      establishment_peak_year: household.transition.establishment_peak_year,
      household_food_demand_gj_year: household.result.household_food_gj_year,
      dwelling: {capital_cost_cad: round(scenario.dwelling.capital_cost_cad), financing: dwellingFinance, maintenance_replacement_annual_cad: round(dwellingMaintenanceAnnual)},
      site_lease: {
        ...detailedSiteLease,
        monthly_total_cad: round(siteLeaseMonthly),
        annual_total_cad: round(siteLeaseMonthly * 12),
        allocation_method: scenario.community.allocation_method,
        allocation_method_description: SITE_LEASE_ALLOCATION_METHODS[scenario.community.allocation_method],
        common_property_land_holding_share_monthly_cad: round(baseLandMonthly),
        productive_land_allocation_ha: round(household.reserved_land_requirement_ha, 6),
        productive_land_charge_per_hectare_monthly_cad: round(detailedSiteLease.productive_land_charge_per_hectare_monthly_cad),
        productive_land_portion_monthly_cad: round(hectareLandMonthly),
        common_property_land_holding: {
          allocation_basis: 'equal_per_household',
          monthly_components_cad: Object.fromEntries(Object.entries(detailedSiteLease.common_property_land_holding_annual_components_cad ?? {}).map(([key, value]) => [key.replace(/_annual_cad$/, '_monthly_cad'), round(value / 12)])),
          monthly_total_cad: round(baseLandMonthly)
        },
        productive_land_charge: {
          allocation_basis: 'proportional_to_reserved_productive_hectares',
          monthly_components_cad: Object.fromEntries(Object.entries(detailedSiteLease.productive_land_annual_components_cad ?? {}).map(([key, value]) => [key.replace(/_annual_cad$/, '_monthly_cad'), round(value / 12)])),
          monthly_components_per_hectare_cad: detailedSiteLease.monthly_components_per_hectare_cad,
          monthly_total_cad: round(hectareLandMonthly)
        },
        financing: {
          debt_service_monthly_cad: round(landFinance.monthly_debt_service_cad * (finite(household.reserved_land_requirement_ha) + commonArea / count) / Math.max(.000001, totalPropertyArea)),
          initial_equity_contribution_cad: round(landFinance.down_payment_cad * (finite(household.reserved_land_requirement_ha) + commonArea / count) / Math.max(.000001, totalPropertyArea)),
          equity_recovery_monthly_cad: 0,
          equity_recovery_policy: 'Initial project equity is not recovered again as recurring site-lease revenue.'
        }
      },
      shared_infrastructure_service: {
        scenario_id: infrastructure.scenario_id,
        annual_cad: round(sharedServiceAnnual),
        monthly_cad: round(sharedInfrastructureMonthly),
        replacement_reserve_annual_cad: round(infrastructure.reserve_contribution_annual_cad / count)
      },
      land_infrastructure: {
        productive_allocation_ha: round(household.reserved_land_requirement_ha, 6),
        site_lease_monthly_cad: round(siteLeaseMonthly),
        shared_infrastructure_monthly_cad: round(sharedInfrastructureMonthly),
        combined_monthly_cad: round(landInfrastructureMonthly),
        formula: 'site lease + shared infrastructure fee; dwelling and household expenses excluded'
      },
      recurring_monthly_cost_cad: Object.fromEntries(Object.entries(recurring).map(([key, value]) => [key, round(value)])),
      monthly_cost_stack: {
        dwelling_financing_monthly_cad: round(recurring.dwelling_financing_monthly_cad),
        site_lease_monthly_cad: round(siteLeaseMonthly),
        site_lease_base_monthly_cad: round(baseLandMonthly),
        site_lease_hectare_monthly_cad: round(hectareLandMonthly),
        shared_infrastructure_monthly_cad: round(recurring.shared_infrastructure_service_monthly_cad),
        dwelling_maintenance_replacement_monthly_cad: round(recurring.dwelling_maintenance_replacement_monthly_cad),
        household_utilities_maintenance_monthly_cad: round(recurring.household_utilities_maintenance_monthly_cad),
        total_monthly_cad: round(visibleTotal),
        visible_component_total_monthly_cad: round(visibleTotal),
        residual_monthly_cad: 0
      },
      total_recurring_monthly_cost_cad: round(visibleTotal),
      physical_carrying_capacity: {
        establishment_land_requirement_ha: round(household.reserved_land_requirement_ha, 6),
        canonical_establishment_peak_land_requirement_ha: round(household.transition.establishment_land_requirement_ha, 6),
        mature_land_requirement_ha: round(household.transition.mature_land_requirement_ha, 6),
        heating_area_ha: round(household.result.heating_area_ha, 6),
        household_food_demand_gj_year: household.result.household_food_gj_year
      }
    };
  });
  const annualLeaseRevenue = scenario.community.allocation_method === 'base_plus_hectare'
    ? landAccounting.revenue_recovery.annual_site_lease_revenue_cad
    : leaseAllocations.reduce((sum, row) => sum + row.annual_total_cad, 0);
  const annualSharedRevenue = infrastructure.annual_costs_cad.total;
  const annualLandCosts = landAccounting.annual_land_layer_cost_cad;
  const annualProjectCosts = annualLandCosts + infrastructure.annual_costs_cad.total;
  const totalProjectRevenue = annualLeaseRevenue + annualSharedRevenue;
  const result = {
    contract_version: ARC_SITE_LEASE_CONTRACT_VERSION,
    model: 'project-owned ARC land + household site lease + shared infrastructure/service charge; private dwelling excluded from public economics',
    scenario: {
      project_id: scenario.community.project_id,
      project_label: scenario.community.label,
      site_id: scenario.site_id,
      site_label: siteClasses[scenario.site_id].label,
      household_count: count,
      common_area_ha: round(commonArea, 6),
      allocation_method: scenario.community.allocation_method,
      land_reservation_basis: landReservationBasis,
      infrastructure_scenario_id: scenario.infrastructure_scenario_id,
      land_financing_scenario_id: scenario.land.financing_scenario_id ?? 'custom',
      legal_lease_term_years: finite(scenario.land.legal_lease_term_years),
      debt_amortization_is_separate_from_legal_lease_term: true
    },
    physical_inputs: {
      household_productive_area_basis: landReservationBasis,
      productive_household_area_ha: round(productive, 6),
      mature_productive_household_area_ha: round(matureProductive, 6),
      total_property_area_ha: round(totalPropertyArea, 6),
      common_area_ha: round(commonArea, 6),
      household_results: householdOutput.map((row) => row.physical_carrying_capacity)
    },
    project_land: {
      total_property_area_ha: round(totalPropertyArea, 6),
      productive_land_value_cad: landAccounting.acquisition.productive_land_value_cad,
      common_land_value_cad: landAccounting.acquisition.common_land_value_cad,
      land_price_cad_per_ha: round(scenario.land.price_cad_per_ha),
      total_land_value_cad: round(landValue),
      financing: landFinance,
      annual_costs_cad: {
        land_finance_recovery: round(landAccounting.acquisition.productive_land_finance_recovery_annual_cad + landAccounting.acquisition.common_land_finance_recovery_annual_cad),
        productive_land_finance_recovery: landAccounting.acquisition.productive_land_finance_recovery_annual_cad,
        common_land_finance_recovery: landAccounting.acquisition.common_land_finance_recovery_annual_cad,
        property_tax: round(landAccounting.productive_land_charge.annual_components_cad.productive_property_tax_annual_cad + landAccounting.common_property_land_holding.annual_components_cad.common_property_tax_annual_cad),
        productive_property_tax: landAccounting.productive_land_charge.annual_components_cad.productive_property_tax_annual_cad,
        common_property_tax: landAccounting.common_property_land_holding.annual_components_cad.common_property_tax_annual_cad,
        land_insurance: round(landPools.land_insurance_annual_cad),
        common_land_costs: round(landPools.common_land_costs_annual_cad),
        administration: round(landPools.administration_annual_cad),
        fixed_land_reserve: round(landPools.fixed_land_reserve_annual_cad),
        vacancy_reserve: round(landPools.vacancy_reserve_annual_cad),
        total: round(annualLandCosts)
      },
      costs_classification: {land_finance_recovery: 'capital recovery', property_tax: 'operating expense', land_insurance: 'operating expense', common_land_costs: 'operating expense', administration: 'operating expense', fixed_land_reserve: 'reserve', vacancy_reserve: 'reserve'},
      land_accounting: landAccounting
    },
    land_financing: {
      scenario_id: scenario.land.financing_scenario_id ?? 'custom',
      scenario_label: LAND_FINANCING_SCENARIOS[scenario.land.financing_scenario_id]?.label ?? 'Custom land-financing inputs',
      evidence_status: LAND_FINANCING_SCENARIOS[scenario.land.financing_scenario_id]?.status ?? 'custom_scenario',
      loan_term_years: scenario.land.loan_term_years ?? null,
      amortization_years: scenario.land.amortization_years,
      interest_rate_annual: scenario.land.interest_rate_annual,
      down_payment_rate: scenario.land.down_payment_rate,
      debt_service_monthly_cad: landFinance.monthly_debt_service_cad,
      initial_equity_contribution_cad: landFinance.down_payment_cad,
      equity_recovery_annual_cad: 0,
      equity_recovery_policy: 'Initial equity is not included in recurring site-lease recovery.'
    },
      infrastructure,
    households: householdOutput,
    project: {
      annual_revenue_cad: {site_leases: round(annualLeaseRevenue), shared_services: round(annualSharedRevenue), total: round(totalProjectRevenue)},
      annual_costs_cad: {land: round(annualLandCosts), shared_infrastructure: round(infrastructure.annual_costs_cad.total), total: round(annualProjectCosts)},
      annual_reserves_cad: round(landPools.vacancy_reserve_annual_cad + infrastructure.reserve_contribution_annual_cad),
      land_layer_break_even: {
        site_lease_revenue_cad: round(annualLeaseRevenue),
        land_layer_cost_cad: round(annualLandCosts),
        annual_surplus_or_shortfall_cad: round(annualLeaseRevenue - annualLandCosts),
        revenue_equals_required_cost_recovery: Math.abs(annualLeaseRevenue - annualLandCosts) < .2
      },
      infrastructure_layer_break_even: {
        shared_service_revenue_cad: round(annualSharedRevenue),
        infrastructure_layer_cost_cad: round(infrastructure.annual_costs_cad.total),
        annual_surplus_or_shortfall_cad: round(annualSharedRevenue - infrastructure.annual_costs_cad.total),
        revenue_equals_required_cost_recovery: Math.abs(annualSharedRevenue - infrastructure.annual_costs_cad.total) < .2
      },
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
    scenario: {...deepClone(DEFAULT_SITE_LEASE_SCENARIO), community: {...deepClone(DEFAULT_SITE_LEASE_SCENARIO.community), household_count: 12}, household: {...deepClone(DEFAULT_SITE_LEASE_SCENARIO.household), label: 'Reference adult man'}}
  });
  const family = calculateArcSiteLeaseEconomics({
    scenario: {...deepClone(DEFAULT_SITE_LEASE_SCENARIO), household: {household_id: 'family-1', label: '2 adults + 2 children', members: ['adult_woman', 'adult_man', 'child_girl_8', 'adolescent_boy_14'], buildings: [defaultBuilding()]}, community: {...deepClone(DEFAULT_SITE_LEASE_SCENARIO.community), household_count: 12}}
  });
  const infrastructureScenarioMetadata = Object.values(INFRASTRUCTURE_SCENARIOS).map((scenario) => ({
    id: scenario.id,
    label: scenario.label,
    description: scenario.description,
    affordability_default: scenario.affordability_default,
    reserve_policy: scenario.reserve_policy,
    maintenance_rate_annual: scenario.maintenance_rate_annual,
    financing: scenario.financing,
    components: Object.values(scenario.capital_components).map((row) => ({
      id: row.id,
      label: row.label,
      capital_cost_cad: row.capital_cost_cad ?? 0,
      annual_operating_cost_cad: row.annual_operating_cost_cad ?? 0,
      requiredness: row.requiredness,
      source_status: row.source_status,
      distributed_capital_cost_per_household_cad: row.distributed_capital_cost_per_household_cad ?? 0,
      distributed_annual_operating_cost_per_household_cad: row.distributed_annual_operating_cost_per_household_cad ?? 0,
      notes: row.notes
    }))
  }));
  const infrastructureScaleExamples = Object.fromEntries(Object.values(INFRASTRUCTURE_SCENARIOS).map((scenario) => [scenario.id, [12, 16, 25, 50].map((householdCount) => {
    const result = calculateArcSiteLeaseEconomics({scenario: {...deepClone(DEFAULT_SITE_LEASE_SCENARIO), infrastructure_scenario_id: scenario.id, community: {...deepClone(DEFAULT_SITE_LEASE_SCENARIO.community), household_count: householdCount}}});
    const household = result.households[0];
    return {
      household_count: householdCount,
      infrastructure_capital_cad: result.infrastructure.capital_value_cad,
      infrastructure_annual_operating_cad: result.infrastructure.annual_costs_cad.operating,
      infrastructure_annual_reserve_cad: result.infrastructure.annual_costs_cad.replacement_reserve,
      infrastructure_annual_capital_debt_service_cad: result.infrastructure.annual_costs_cad.capital_debt_service,
      infrastructure_annual_total_cad: result.infrastructure.annual_costs_cad.total,
      shared_services_monthly_per_household_cad: household.shared_infrastructure_service.monthly_cad,
      site_lease_monthly_per_household_cad: household.site_lease.monthly_total_cad,
      land_infrastructure_monthly_per_household_cad: household.land_infrastructure.combined_monthly_cad,
      annual_shared_service_revenue_cad: result.project.infrastructure_layer_break_even.shared_service_revenue_cad,
      annual_infrastructure_layer_cost_cad: result.project.infrastructure_layer_break_even.infrastructure_layer_cost_cad,
      infrastructure_layer_break_even: result.project.infrastructure_layer_break_even.revenue_equals_required_cost_recovery
    };
  })]));
  const publicEvidence = Object.fromEntries(Object.entries(SITE_LEASE_EVIDENCE).filter(([key]) => key !== 'dwelling_capital_cost'));
  return {
    contract_version: ARC_SITE_LEASE_CONTRACT_VERSION,
    api: 'calculateArcSiteLeaseEconomics',
    planning_guideline: {productive_land_per_adult_ha: 1, label: 'Approximately 1 ha of productive land per adult is an early ARC planning benchmark; the property/household model refines it.'},
    allocation_methods: SITE_LEASE_ALLOCATION_METHODS,
    recommended_infrastructure_scenario: 'minimal_compliant',
    land_reservation_basis: {
      default: DEFAULT_SITE_LEASE_SCENARIO.land_reservation_basis,
      options: ['maximum_transition_exclusive_footprint', 'mature_requirement', 'fixed_planning_allocation'],
      explanation: 'The project reserves the maximum exclusive footprint needed during establishment; mature annual cropping reductions do not make the underlying parcel disposable.'
    },
    infrastructure_scenarios: infrastructureScenarioMetadata,
    infrastructure_scale_examples: infrastructureScaleExamples,
    land_financing_evidence: LAND_FINANCING_EVIDENCE,
    land_financing_scenarios: LAND_FINANCING_SCENARIOS,
    evidence: publicEvidence,
    default_inputs: {
      land_price_cad_per_ha: DEFAULT_SITE_LEASE_SCENARIO.land.price_cad_per_ha,
      common_property_land_ha: DEFAULT_SITE_LEASE_SCENARIO.community.common_area_ha,
      legal_lease_term_years: DEFAULT_SITE_LEASE_SCENARIO.land.legal_lease_term_years,
      land_financing: {
        ownership: DEFAULT_SITE_LEASE_SCENARIO.land.ownership,
        down_payment_rate: DEFAULT_SITE_LEASE_SCENARIO.land.down_payment_rate,
        interest_rate_annual: DEFAULT_SITE_LEASE_SCENARIO.land.interest_rate_annual,
        amortization_years: DEFAULT_SITE_LEASE_SCENARIO.land.amortization_years,
        loan_term_years: DEFAULT_SITE_LEASE_SCENARIO.land.loan_term_years,
        financing_scenario_id: DEFAULT_SITE_LEASE_SCENARIO.land.financing_scenario_id,
        evidence_status: LAND_FINANCING_SCENARIOS[DEFAULT_SITE_LEASE_SCENARIO.land.financing_scenario_id].status
      },
      land_costs: {
        property_tax_rate_annual: DEFAULT_SITE_LEASE_SCENARIO.land.property_tax_rate_annual,
        insurance_annual_cad: DEFAULT_SITE_LEASE_SCENARIO.land.insurance_annual_cad,
        common_land_costs_annual_cad: DEFAULT_SITE_LEASE_SCENARIO.land.common_land_costs_annual_cad,
        administration_annual_cad: DEFAULT_SITE_LEASE_SCENARIO.land.administration_annual_cad,
        fixed_land_reserve_annual_cad: DEFAULT_SITE_LEASE_SCENARIO.land.fixed_land_reserve_annual_cad,
        vacancy_reserve_rate_annual: DEFAULT_SITE_LEASE_SCENARIO.land.vacancy_reserve_rate_annual
      }
    },
    household_examples: {
      one_adult_ordinary: {land_infrastructure: ordinary.households[0].land_infrastructure, site_lease: ordinary.households[0].site_lease, shared_infrastructure_service: ordinary.households[0].shared_infrastructure_service, physical_carrying_capacity: ordinary.households[0].physical_carrying_capacity},
      family_ordinary: {land_infrastructure: family.households[0].land_infrastructure, site_lease: family.households[0].site_lease, shared_infrastructure_service: family.households[0].shared_infrastructure_service, physical_carrying_capacity: family.households[0].physical_carrying_capacity}
    },
    examples: {
      one_adult_ordinary: {productive_land_ha: ordinary.households[0].calculated_productive_land_ha, mature_land_ha: ordinary.households[0].mature_productive_land_requirement_ha, land_infrastructure_monthly_cad: ordinary.households[0].land_infrastructure.combined_monthly_cad},
      family_ordinary: {productive_land_ha: family.households[0].calculated_productive_land_ha, mature_land_ha: family.households[0].mature_productive_land_requirement_ha, land_infrastructure_monthly_cad: family.households[0].land_infrastructure.combined_monthly_cad}
    },
    notes: [
      'The private dwelling is outside this public land-and-infrastructure comparison and is never included in land principal.',
      'Site lease recovers project land costs; shared infrastructure is reported as a separate service charge.',
      'Community size, land price, tax, infrastructure and financing are scenario inputs pending property-specific evidence.'
    ]
  };
}
