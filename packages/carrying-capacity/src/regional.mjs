import {loadCanonicalCarryingCapacity} from './index.mjs';
import {householdProfiles, siteClasses} from '../scripts/calc-household-capacity.mjs';

export const REGIONAL_CARRYING_CAPACITY_CONTRACT_VERSION = '1.0.0';

const defaultSiteShares = {favourable: 0.25, ordinary: 0.5, marginal: 0.25};
const siteIds = {favourable: 'wetter_productive', ordinary: 'ordinary_mesic', marginal: 'shallow_rocky_marginal'};
export const DEFAULT_GREY_HOUSEHOLD_MIX = {one_adult: .20, adult_plus_child: .10, two_adults: .30, two_adults_plus_one_child: .10, two_adults_plus_two_children: .20, two_adults_plus_three_children: .10};
export const GREY_ADOPTION_RATES = [0, .10, .25, .50, .75];
export const GREY_TRANSITION_YEARS = [1, 5, 10, 15, 'mature'];

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function aggregateProfile({profile, siteRows, siteAreas, householdsPerSite}) {
  const members = householdProfiles[profile]?.member_ids ?? [];
  const memberCount = members.length;
  const sites = siteRows.map((row) => {
    const area = siteAreas[row.site] ?? 0;
    const minimumHouseholds = row.robust_household_minimum_area_ha > 0 ? area / row.robust_household_minimum_area_ha : 0;
    const optionalHouseholds = row.gross_site_area_ha > 0 ? area / row.gross_site_area_ha : 0;
    const householdCount = householdsPerSite === 'optional' ? optionalHouseholds : minimumHouseholds;
    return {
      site: row.site,
      site_label: row.site_label,
      land_area_ha: area,
      robust_minimum_area_ha_per_household: row.robust_household_minimum_area_ha,
      gross_site_area_ha_per_household: row.gross_site_area_ha,
      households_supported: householdCount,
      population_supported: householdCount * memberCount,
      mature_recurring_labour_hours_year: householdCount * (row.recurring_labour?.total_recurring_labour_hours ?? 0),
      annual_bridge_area_ha: householdCount * (row.year1_annual_bridge_area_ha ?? 0),
      food_energy_supported_gj_year: householdCount * (row.household_food_gj_year ?? 0),
      optional_productive_surplus_area_ha: householdCount * (row.additional_productive_surplus_area_ha ?? 0)
    };
  });
  return {
    household_profile: profile,
    household_label: householdProfiles[profile]?.label ?? profile,
    member_count: memberCount,
    households_supported: sites.reduce((sum, row) => sum + row.households_supported, 0),
    population_supported: sites.reduce((sum, row) => sum + row.population_supported, 0),
    mature_recurring_labour_hours_year: sites.reduce((sum, row) => sum + row.mature_recurring_labour_hours_year, 0),
    annual_bridge_area_ha: sites.reduce((sum, row) => sum + row.annual_bridge_area_ha, 0),
    food_energy_supported_gj_year: sites.reduce((sum, row) => sum + row.food_energy_supported_gj_year, 0),
    optional_productive_surplus_area_ha: sites.reduce((sum, row) => sum + row.optional_productive_surplus_area_ha, 0),
    by_site: sites
  };
}

/**
 * Aggregate the canonical household/site carrying-capacity rows over a region.
 * Site shares are an explicit scenario allocation because current Grey data do
 * not provide a parcel-level biological capability classification.
 */
export function calculateRegionalCarryingCapacity({
  regionId = 'region',
  regionLabel = regionId,
  population = 0,
  dwellings = 0,
  humanFoodPriorityHa,
  productiveLandHa,
  siteShares = defaultSiteShares,
  householdsPerSite = 'minimum',
  canonical = loadCanonicalCarryingCapacity()
} = {}) {
  const landHa = finite(humanFoodPriorityHa ?? productiveLandHa);
  const normalizedShares = Object.fromEntries(Object.entries(defaultSiteShares).map(([key, value]) => [key, finite(siteShares[key], value)]));
  const shareTotal = Object.values(normalizedShares).reduce((sum, value) => sum + value, 0);
  if (shareTotal <= 0) throw new Error('regional carrying-capacity site shares must have a positive sum');
  for (const key of Object.keys(normalizedShares)) normalizedShares[key] /= shareTotal;
  const siteAreas = Object.fromEntries(Object.entries(normalizedShares).map(([key, share]) => [siteIds[key], landHa * share]));
  const canonicalRows = canonical.canonical?.mature_food_system?.canonical_rows ?? [];
  const siteRows = Object.values(siteIds).map((site) => canonicalRows.find((row) => row.site === site && row.module === 'plants_only' && row.household === 'two_adults_plus_two_children'));
  if (siteRows.some((row) => !row)) throw new Error('Canonical mature carrying-capacity rows are incomplete');
  const profileRows = Object.keys(householdProfiles).map((profile) => {
    const rows = Object.values(siteIds).map((site) => canonicalRows.find((row) => row.site === site && row.module === 'plants_only' && row.household === profile));
    return aggregateProfile({profile, siteRows: rows, siteAreas, householdsPerSite});
  });
  const centralFamily = profileRows.find((row) => row.household_profile === 'two_adults_plus_two_children');
  return {
    contract_version: REGIONAL_CARRYING_CAPACITY_CONTRACT_VERSION,
    region_id: regionId,
    region_label: regionLabel,
    input_population_people: finite(population),
    input_dwellings: finite(dwellings),
    candidate_human_food_land_ha: landHa,
    site_allocation: {
      rule: 'scenario allocation; no parcel-level biological capability map is currently available',
      shares: normalizedShares,
      land_area_ha: siteAreas
    },
    household_count_basis: householdsPerSite === 'optional' ? 'gross site area including optional productive target' : 'robust household minimum area',
    site_sensitivity: siteRows.map((row) => ({
      site: row.site,
      site_label: row.site_label,
      robust_minimum_area_ha_per_household: row.robust_household_minimum_area_ha,
      gross_site_area_ha_per_household: row.gross_site_area_ha,
      land_surplus_or_deficit_vs_arc_allocation_ha: row.land_surplus_or_deficit_ha,
      recurring_labour_hours_year: row.recurring_labour?.total_recurring_labour_hours ?? null
    })),
    household_composition_sensitivity: profileRows,
    planning_reference: {
      household_profile: centralFamily.household_profile,
      population_supported_people: centralFamily.population_supported,
      coverage_of_input_population_percent: finite(population) > 0 ? centralFamily.population_supported / population * 100 : null,
      coverage_of_input_dwellings_percent: finite(dwellings) > 0 ? centralFamily.households_supported / dwellings * 100 : null
    },
    limitations: [
      'Grey County land areas are current Living Region overlay-derived food-land proxies, not ownership or legal access.',
      'Favourable/ordinary/marginal shares are explicit sensitivity assumptions until a validated soil, slope, drainage and climate capability layer is available.',
      'Population support is a biological planning capacity, not a forecast of adoption, tenure, labour availability, governance or market access.'
    ]
  };
}

function normalizedShares(input, fallback) {
  const raw = Object.fromEntries(Object.keys(fallback).map((key) => [key, finite(input?.[key], fallback[key])]));
  const total = Object.values(raw).reduce((sum, value) => sum + Math.max(0, value), 0);
  if (total <= 0) throw new Error('carrying-capacity shares must have a positive sum');
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Math.max(0, value) / total]));
}

function transitionFor(canonical, site, household, year) {
  const householdRow = (canonical.canonical?.food_forest_transition?.households ?? []).find((candidate) => candidate.site === site && candidate.household === household);
  if (!householdRow) throw new Error(`Missing canonical transition row for ${site}/${household}`);
  const rows = householdRow.transition?.constant_annual_reserve?.rows ?? [];
  const row = rows.find((candidate) => candidate.year === year) ?? (year === 'mature' ? rows.find((candidate) => candidate.year === 'mature') : null) ?? rows.at(-1);
  return {...row, establishment_land_requirement_ha: householdRow.establishment_land_requirement_ha, mature_land_requirement_ha: householdRow.mature_land_requirement_ha, arc_policy_allocation_ha: householdRow.arc_policy_comparison?.allocation_ha ?? householdRow.arc_allocation_ha, arc_policy_establishment_surplus_or_deficit_ha: householdRow.arc_policy_comparison?.establishment_surplus_or_deficit_ha};
}

function matureFor(canonical, site, household) {
  const rows = canonical.canonical?.mature_food_system?.canonical_rows ?? [];
  const row = rows.find((candidate) => candidate.site === site && candidate.household === household && candidate.module === 'plants_only');
  if (!row) throw new Error(`Missing canonical mature row for ${site}/${household}`);
  return row;
}

/**
 * Grey adoption scenarios built from canonical household/site transition rows.
 * The eligibility and site mix are explicit regional proxies; they are not a
 * claim that every eligible hectare has been biologically classified.
 */
export function calculateGreyCarryingCapacityAdoption({
  eligibleHouseholds = 0,
  eligiblePopulation = 0,
  regionalFoodDemandGJ = 0,
  siteShares = defaultSiteShares,
  householdMix = DEFAULT_GREY_HOUSEHOLD_MIX,
  adoptionRates = GREY_ADOPTION_RATES,
  transitionYears = GREY_TRANSITION_YEARS,
  canonical = loadCanonicalCarryingCapacity(),
  eligibilityBasis = 'best current dwelling-land proxy; household/site constraints remain unresolved',
  externalInputConditions = {present_external_inputs: 1, constrained_fuel_fertilizer: .85, deeper_systemic_input_constraint: .65}
} = {}) {
  const shares = normalizedShares(siteShares, defaultSiteShares);
  const mix = normalizedShares(householdMix, DEFAULT_GREY_HOUSEHOLD_MIX);
  const sites = Object.entries(shares).map(([key, share]) => ({key, share, site: siteIds[key]}));
  const scenarios = [];
  for (const adoptionRate of adoptionRates) {
    for (const condition of Object.entries(externalInputConditions)) {
      const conditionId = condition[0];
      const inputFactor = finite(condition[1], 1);
      const years = transitionYears.map((year) => {
        const totals = {participating_households: 0, participating_population_people: 0, productive_land_required_ha: 0, establishment_land_requirement_ha: 0, mature_land_requirement_ha: 0, arc_policy_allocation_ha: 0, arc_policy_establishment_surplus_or_deficit_ha: 0, establishment_annual_food_area_ha: 0, mature_annual_food_area_ha: 0, mature_perennial_food_area_ha: 0, woody_heating_area_ha: 0, labour_hours_total: 0, heavy_cultivation_labour_hours: 0, household_food_demand_supplied_gj_year: 0, market_food_demand_displaced_gj_year: 0, mature_exportable_surplus_gj_year: 0};
        const profileRows = [];
        for (const [profile, profileShare] of Object.entries(mix)) {
          const memberCount = householdProfiles[profile]?.member_ids?.length ?? 0;
          for (const {key, share, site} of sites) {
            const participants = finite(eligibleHouseholds) * adoptionRate * profileShare * share;
            if (participants <= 0) continue;
            const transition = transitionFor(canonical, site, profile, year);
            const mature = matureFor(canonical, site, profile);
            const coveredFood = finite(transition.total_usable_food_gj) * inputFactor;
            const householdDemand = finite(mature.household_food_gj_year);
            const displaced = Math.min(householdDemand, coveredFood);
            const surplus = Math.max(0, coveredFood - householdDemand);
            const occupied = finite(transition.occupied_food_production_area_ha, finite(transition.annual_area_ha) + finite(transition.perennial_area_ha) - finite(transition.young_forest_annual_intercrop_overlap_ha));
            const exclusiveLand = finite(transition.total_exclusive_land_requirement_ha, occupied + finite(mature.heating_area_ha) + finite(mature.land_accounting?.exclusive_other_area_ha));
            const labourTotal = finite(transition.labour?.total_labour_hours_including_establishment, transition.labour?.total_recurring_labour_hours);
            const heavy = finite(transition.labour?.annual_soil_preparation_hours) + finite(transition.labour?.annual_planting_hours) + finite(transition.labour?.annual_weeding_hours);
            totals.participating_households += participants;
            totals.participating_population_people += participants * memberCount;
            totals.productive_land_required_ha += participants * exclusiveLand;
            totals.establishment_land_requirement_ha += participants * finite(transition.establishment_land_requirement_ha, exclusiveLand);
            totals.mature_land_requirement_ha += participants * finite(transition.mature_land_requirement_ha, exclusiveLand);
            totals.arc_policy_allocation_ha += participants * finite(transition.arc_policy_allocation_ha);
            totals.arc_policy_establishment_surplus_or_deficit_ha += participants * finite(transition.arc_policy_establishment_surplus_or_deficit_ha);
            totals.establishment_annual_food_area_ha += participants * finite(transition.annual_area_ha);
            totals.mature_annual_food_area_ha += participants * finite(mature.mature_annual_area_ha);
            totals.mature_perennial_food_area_ha += participants * finite(mature.mature_perennial_area_ha);
            totals.woody_heating_area_ha += participants * finite(mature.heating_area_ha);
            totals.labour_hours_total += participants * (labourTotal / Math.max(inputFactor, .1));
            totals.heavy_cultivation_labour_hours += participants * (heavy / Math.max(inputFactor, .1));
            totals.household_food_demand_supplied_gj_year += participants * coveredFood;
            totals.market_food_demand_displaced_gj_year += participants * displaced;
            totals.mature_exportable_surplus_gj_year += participants * surplus;
            profileRows.push({profile, site_class: key, households: participants, people: participants * memberCount, food_demand_gj_year: participants * householdDemand, food_supplied_gj_year: participants * coveredFood, market_demand_displaced_gj_year: participants * displaced, exportable_surplus_gj_year: participants * surplus, occupied_food_area_ha: participants * occupied, productive_land_required_ha: participants * exclusiveLand, establishment_land_requirement_ha: participants * finite(transition.establishment_land_requirement_ha, exclusiveLand), mature_land_requirement_ha: participants * finite(transition.mature_land_requirement_ha, exclusiveLand), annual_food_area_ha: participants * finite(transition.annual_area_ha), perennial_food_area_ha: participants * finite(transition.perennial_area_ha), heating_area_ha: participants * finite(mature.heating_area_ha), labour_hours: participants * labourTotal / Math.max(inputFactor, .1)});
          }
        }
        const demand = finite(regionalFoodDemandGJ);
        return {year, ...Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, Number(value.toFixed(6))])), regional_food_coverage_change_percent: demand > 0 ? totals.market_food_demand_displaced_gj_year / demand * 100 : null, food_gap_replacement_requirement_gj_year: Math.max(0, demand - totals.market_food_demand_displaced_gj_year), site_mix: shares, profile_rows: profileRows};
      });
      scenarios.push({scenario_id: `adoption_${Math.round(adoptionRate * 100)}_${conditionId}`, adoption_rate: adoptionRate, adoption_percent: adoptionRate * 100, external_input_condition: conditionId, external_input_factor: inputFactor, eligibility_basis: eligibilityBasis, eligible_households: finite(eligibleHouseholds), eligible_population_people: finite(eligiblePopulation), site_shares: shares, household_mix: mix, transition_years: years});
    }
  }
  return {contract_version: REGIONAL_CARRYING_CAPACITY_CONTRACT_VERSION, eligibility_basis: eligibilityBasis, eligible_households: finite(eligibleHouseholds), eligible_population_people: finite(eligiblePopulation), regional_food_demand_gj_year: finite(regionalFoodDemandGJ), default_site_shares: shares, default_household_mix: mix, adoption_rates: adoptionRates, transition_years: transitionYears, external_input_conditions: externalInputConditions, scenarios};
}
