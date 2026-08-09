import {loadCanonicalCarryingCapacity} from './index.mjs';
import {householdProfiles, siteClasses} from '../scripts/calc-household-capacity.mjs';

export const REGIONAL_CARRYING_CAPACITY_CONTRACT_VERSION = '1.0.0';

const defaultSiteShares = {favourable: 0.25, ordinary: 0.5, marginal: 0.25};
const siteIds = {favourable: 'wetter_productive', ordinary: 'ordinary_mesic', marginal: 'shallow_rocky_marginal'};

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
