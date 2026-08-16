import {defaultBuilding, householdProfiles} from './core.mjs';
import {calculateArcSiteLeaseEconomics, DEFAULT_SITE_LEASE_SCENARIO} from './site-lease.mjs';
import {buildLandMarketContract, estimateLandPriceForParcel, loadArcLandMarketData} from './land-market.mjs';

const clone = (value) => structuredClone(value);
const round = (value, digits = 6) => value == null || !Number.isFinite(Number(value)) ? null : Math.round(Number(value) * 10 ** digits) / 10 ** digits;
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const ARC_ADULT_SCALE_SCENARIOS = [1, 4, 12, 16, 20, 28, 40, 56];
export const ARC_FAMILY_CAPACITY_STANDARD = {
  id: 'family_capacity_2_adults_3_children',
  household_profile_id: 'two_adults_plus_three_children',
  label: 'Family-capacity planning case',
  adult_residents: 2,
  dependent_children: 3,
  description: 'A two-adult household designed and land-reserved to support up to three dependent children. This is a capacity stress test, not a demographic forecast.'
};

function familyCapacityMembers() {
  return clone(householdProfiles[ARC_FAMILY_CAPACITY_STANDARD.household_profile_id].member_ids);
}

function adultScaleHouseholds(adultCount) {
  const count = Math.max(1, Math.round(finite(adultCount, 1)));
  if (count === 1) return [{
    household_id: 'adult-scale-household-1',
    label: '1 adult · single-adult planning case',
    members: ['reference_adult_man'],
    buildings: [defaultBuilding()],
    household_role: 'single_adult'
  }];
  const pairs = Math.floor(count / 2);
  const rows = Array.from({length: pairs}, (_, index) => ({
    household_id: `adult-scale-family-${index + 1}`,
    label: '2 adults + 3 dependent children · family-capacity planning case',
    members: familyCapacityMembers(),
    buildings: [defaultBuilding()],
    household_role: 'family_capacity_stress_test'
  }));
  if (count % 2) rows.push({
    household_id: `adult-scale-single-${rows.length + 1}`,
    label: '1 adult · single-adult planning case',
    members: ['reference_adult_man'],
    buildings: [defaultBuilding()],
    household_role: 'single_adult'
  });
  return rows;
}

function scenarioForScale({adultCount, price, data}) {
  const households = adultScaleHouseholds(adultCount);
  const base = clone(DEFAULT_SITE_LEASE_SCENARIO);
  return {
    ...base,
    community: {
      ...base.community,
      project_id: `arc-adult-scale-${adultCount}`,
      label: `${adultCount} adult ARC family-capacity planning case`,
      household_count: households.length,
      adult_residents: adultCount,
      dependent_children_capacity: households.reduce((sum, household) => sum + (household.household_role === 'family_capacity_stress_test' ? 3 : 0), 0),
      scale_basis: 'adult_residents',
      family_capacity_stress_test: true,
      households
    },
    land: {...base.land, price_cad_per_ha: price},
    land_market_data: data
  };
}

function resultAtPrice({adultCount, price, data}) {
  return calculateArcSiteLeaseEconomics({scenario: scenarioForScale({adultCount, price, data})});
}

function rowForScale({adultCount, data, landMarketContract}) {
  const provisional = resultAtPrice({adultCount, price: DEFAULT_SITE_LEASE_SCENARIO.land.price_cad_per_ha, data});
  const parcelArea = provisional.project_land.total_property_area_ha;
  const landEstimate = estimateLandPriceForParcel({parcelAreaHa: parcelArea, data});
  const priced = landEstimate.price_cad_per_ha != null && Number.isFinite(Number(landEstimate.price_cad_per_ha));
  const result = priced ? resultAtPrice({adultCount, price: landEstimate.price_cad_per_ha, data}) : provisional;
  const householdCount = result.scenario.household_count;
  const dependentChildren = result.scenario.dependent_children_capacity ?? 0;
  const siteLeaseMonthly = priced ? result.project.annual_revenue_cad.site_leases / householdCount / 12 : null;
  const infrastructureMonthly = result.infrastructure.service_charge_per_household_month_cad;
  const dwellingFinanceMonthly = result.households.reduce((sum, household) => sum + finite(household.affordability?.illustrative_dwelling_financing_monthly_cad), 0) / householdCount;
  const priceRange = landEstimate.price_range_cad_per_ha;
  return {
    adult_residents: adultCount,
    households: householdCount,
    dwellings: householdCount,
    dependent_children_capacity: dependentChildren,
    household_standard: adultCount === 1 ? 'single_adult_planning_case' : ARC_FAMILY_CAPACITY_STANDARD.id,
    family_capacity_case: adultCount > 1,
    productive_hectares: round(result.physical_inputs.productive_household_area_ha),
    mature_productive_hectares: round(result.physical_inputs.mature_productive_household_area_ha),
    common_hectares: round(result.physical_inputs.common_area_ha),
    total_parcel_hectares: round(result.physical_inputs.total_property_area_ha),
    establishment_peak_year: result.households[0]?.establishment_peak_year ?? null,
    land_market_band_id: landEstimate.band_id,
    land_market_band: landEstimate.band_label,
    land_price_cad_per_ha: round(landEstimate.price_cad_per_ha, 2),
    land_price_status: landEstimate.status,
    land_price_sample_count: landEstimate.sample_count ?? 0,
    land_price_range_cad_per_ha: priceRange?.map((value) => round(value, 2)) ?? null,
    estimated_parcel_acquisition_cad: priced ? round(result.project_land.total_land_value_cad, 2) : null,
    estimated_parcel_acquisition_range_cad: priced ? priceRange?.map((pricePerHa) => round(pricePerHa * result.project_land.total_property_area_ha, 2)) ?? null : null,
    land_financing_monthly_cad_per_household: priced ? round(result.project_land.financing.monthly_debt_service_cad / householdCount, 2) : null,
    site_lease_monthly_cad_per_household: round(siteLeaseMonthly, 2),
    shared_infrastructure_monthly_cad_per_household: round(infrastructureMonthly, 2),
    dwelling_financing_monthly_cad_per_household: round(dwellingFinanceMonthly, 2),
    combined_land_infrastructure_monthly_cad_per_household: priced ? round(siteLeaseMonthly + infrastructureMonthly, 2) : null,
    combined_illustrative_monthly_cad_per_household: priced ? round(siteLeaseMonthly + infrastructureMonthly + dwellingFinanceMonthly, 2) : null,
    common_area_geometry_mode: result.scenario.common_area_accounting.mode,
    evidence: {
      land_price: landEstimate.status,
      hectares: 'derived_from_canonical_carrying_capacity_and_existing_geometry',
      family_capacity: adultCount === 1 ? 'not_applicable' : 'planning_design_case'
    },
    land_market_contract_version: landMarketContract.contract_version
  };
}

export function buildArcAdultScaleScenarios({adultCounts = ARC_ADULT_SCALE_SCENARIOS, landMarketData = loadArcLandMarketData()} = {}) {
  const landMarketContract = buildLandMarketContract(landMarketData);
  return adultCounts.map((adultCount) => rowForScale({adultCount, data: landMarketData, landMarketContract}));
}

export function buildArcAdultScalePresentationContract(options = {}) {
  const landMarketData = options.landMarketData ?? loadArcLandMarketData();
  const scenarios = buildArcAdultScaleScenarios({adultCounts: options.adultCounts ?? ARC_ADULT_SCALE_SCENARIOS, landMarketData});
  const pricedScenarios = scenarios.filter((row) => row.combined_land_infrastructure_monthly_cad_per_household != null);
  const provisionalLowest = pricedScenarios.slice().sort((a, b) => a.combined_land_infrastructure_monthly_cad_per_household - b.combined_land_infrastructure_monthly_cad_per_household)[0];
  const farmScaleBands = new Set(['20_to_40_ha', '40_plus_ha']);
  const farmScaleEntry = pricedScenarios.find((row) => farmScaleBands.has(row.land_market_band_id));
  const nextPricedScale = farmScaleEntry ? pricedScenarios.find((row) => row.adult_residents > farmScaleEntry.adult_residents) : null;
  const nextScaleSavingsRatio = farmScaleEntry && nextPricedScale
    ? (farmScaleEntry.combined_land_infrastructure_monthly_cad_per_household - nextPricedScale.combined_land_infrastructure_monthly_cad_per_household) / farmScaleEntry.combined_land_infrastructure_monthly_cad_per_household
    : null;
  const diminishingSavingsPoint = farmScaleEntry && nextScaleSavingsRatio != null && nextScaleSavingsRatio <= .15 ? farmScaleEntry : null;
  const landMarket = buildLandMarketContract(landMarketData);
  const economicCrossover = farmScaleEntry ? {
    status: diminishingSavingsPoint
      ? (landMarket.parcel_size_bands.find((band) => band.id === '40_plus_ha')?.sufficient_evidence_for_median
        ? 'evidence_supported_farm_scale_crossover'
        : 'evidence_supported_20_to_40_ha_crossover_40_plus_unresolved')
      : 'partial_evidence_farm_scale_entry_no_diminishing_point',
    farm_scale_entry_adults: farmScaleEntry.adult_residents,
    farm_scale_entry_band: farmScaleEntry.land_market_band,
    diminishing_savings_point_adults: diminishingSavingsPoint?.adult_residents ?? null,
    next_observed_scale_adults: nextPricedScale?.adult_residents ?? null,
    next_scale_relative_savings_ratio: nextScaleSavingsRatio,
    provisional_lowest_charge_adult_scale: provisionalLowest?.adult_residents ?? null,
    provisional_lowest_charge_cad_per_household: provisionalLowest?.combined_land_infrastructure_monthly_cad_per_household ?? null,
    explanation: diminishingSavingsPoint
      ? `The first priced ARC case in a measured farm-scale band is ${farmScaleEntry.adult_residents} adults. The next priced demonstration saves ${(nextScaleSavingsRatio * 100).toFixed(1)}%, below the 15% diminishing-savings threshold. The 40+ ha band remains ${landMarket.parcel_size_bands.find((band) => band.id === '40_plus_ha')?.sufficient_evidence_for_median ? 'supported' : 'unresolved'}, so this is a provisional crossover rather than a citywide market conclusion.`
      : `A measured farm-scale band begins at ${farmScaleEntry.adult_residents} adults, but the next-scale savings test is not yet supported by the loaded observations.`
  } : {
    status: 'unresolved_no_measured_farm_scale_band',
    farm_scale_entry_adults: null,
    farm_scale_entry_band: null,
    diminishing_savings_point_adults: null,
    next_observed_scale_adults: null,
    next_scale_relative_savings_ratio: null,
    provisional_lowest_charge_adult_scale: provisionalLowest?.adult_residents ?? null,
    provisional_lowest_charge_cad_per_household: provisionalLowest?.combined_land_infrastructure_monthly_cad_per_household ?? null,
    explanation: 'No adult-scale case currently falls in a parcel-size band with sufficient measured whole-property evidence.'
  };
  return {
    contract_version: '1.1.0',
    scale_basis: 'adult_residents',
    scenarios,
    family_capacity_standard: ARC_FAMILY_CAPACITY_STANDARD,
    land_market: landMarket,
    economic_crossover: economicCrossover,
    notes: [
      'Adult count is the primary settlement-scale variable. Household and dwelling count is a resulting planning arrangement.',
      'Except for the 1-adult case, each pair of adults is stress-tested as a two-adult household capable of supporting three dependent children.',
      'The family-capacity case is not a forecast of actual ARC demographics.',
      'Land price bands use measured listing observations where the minimum sample threshold is met. Sparse bands remain unresolved rather than being filled from the planning sensitivity curve.',
      'The economic crossover is a bounded demonstration result. It does not establish a universal Grey County price curve, and improved properties, recreational premiums and asking-versus-sale differences remain material caveats.'
    ]
  };
}
