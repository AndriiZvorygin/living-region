import {defaultBuilding, householdProfiles} from './core.mjs';
import {calculateArcSiteLeaseEconomics, DEFAULT_SITE_LEASE_SCENARIO} from './site-lease.mjs';
import {buildLandMarketContract, estimateLandPriceForParcel, loadArcLandMarketData} from './land-market.mjs';

const clone = (value) => structuredClone(value);
const round = (value, digits = 6) => value == null || !Number.isFinite(Number(value)) ? null : Math.round(Number(value) * 10 ** digits) / 10 ** digits;
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const ARC_ADULT_SCALE_SCENARIOS = [1, 4, 12, 16, 20, 28, 40, 56];
export const ARC_ADULT_SCALE_CROSSOVER_SCENARIOS = [1, ...Array.from({length: 28}, (_, index) => (index + 1) * 2)];
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

function buildMarketBandCrossings(rows) {
  return rows.slice(1).flatMap((row, index) => {
    const previous = rows[index];
    if (row.land_market_band_id === previous.land_market_band_id) return [];
    const landPriceChange = row.land_price_cad_per_ha != null && previous.land_price_cad_per_ha != null
      ? round(row.land_price_cad_per_ha - previous.land_price_cad_per_ha, 2)
      : null;
    const householdMonthlyChange = row.combined_land_infrastructure_monthly_cad_per_household != null && previous.combined_land_infrastructure_monthly_cad_per_household != null
      ? round(row.combined_land_infrastructure_monthly_cad_per_household - previous.combined_land_infrastructure_monthly_cad_per_household, 2)
      : null;
    return [{
      adult_residents: row.adult_residents,
      households: row.households,
      parcel_hectares: row.total_parcel_hectares,
      previous_parcel_hectares: previous.total_parcel_hectares,
      previous_land_band: previous.land_market_band,
      new_land_band: row.land_market_band,
      previous_land_band_id: previous.land_market_band_id,
      new_land_band_id: row.land_market_band_id,
      previous_land_price_cad_per_ha: previous.land_price_cad_per_ha,
      new_land_price_cad_per_ha: row.land_price_cad_per_ha,
      land_price_change_cad_per_ha: landPriceChange,
      land_price_change_percent: landPriceChange != null && previous.land_price_cad_per_ha
        ? round(landPriceChange / previous.land_price_cad_per_ha * 100, 2)
        : null,
      previous_land_price_status: previous.land_price_status,
      new_land_price_status: row.land_price_status,
      previous_household_monthly_charge_cad: previous.combined_land_infrastructure_monthly_cad_per_household,
      household_monthly_charge_cad: row.combined_land_infrastructure_monthly_cad_per_household,
      household_monthly_change_cad: householdMonthlyChange,
      evidence_sufficient_for_new_band: row.land_price_status === 'measured_local_size_band'
    }];
  });
}

function buildEconomicSweetSpot({rows, crossover}) {
  if (!crossover) return null;
  const startIndex = rows.findIndex((row) => row.adult_residents === crossover.adult_residents);
  if (startIndex < 0) return null;
  const candidates = rows.slice(startIndex, -1).map((row, offset) => {
    const next = rows[startIndex + offset + 1];
    if (row.combined_land_infrastructure_monthly_cad_per_household == null || next.combined_land_infrastructure_monthly_cad_per_household == null) return null;
    const savings = row.combined_land_infrastructure_monthly_cad_per_household - next.combined_land_infrastructure_monthly_cad_per_household;
    return {
      row,
      next,
      savings_cad: round(savings, 2),
      relative_savings_ratio: row.combined_land_infrastructure_monthly_cad_per_household > 0 ? savings / row.combined_land_infrastructure_monthly_cad_per_household : null
    };
  }).filter(Boolean);
  const selected = candidates.find((candidate) => candidate.relative_savings_ratio != null && candidate.relative_savings_ratio <= .15);
  if (!selected) return null;
  return {
    adult_residents: selected.row.adult_residents,
    households: selected.row.households,
    parcel_hectares: selected.row.total_parcel_hectares,
    land_market_band: selected.row.land_market_band,
    next_adult_residents: selected.next.adult_residents,
    next_households: selected.next.households,
    next_parcel_hectares: selected.next.total_parcel_hectares,
    next_scale_relative_savings_ratio: round(selected.relative_savings_ratio, 6),
    next_scale_savings_percent: round(selected.relative_savings_ratio * 100, 2),
    next_scale_savings_cad_per_household: selected.savings_cad,
    explanation: `Within the measured ${selected.row.land_market_band} band, the first two-adult step with no more than 15% additional per-household savings is ${selected.row.adult_residents} to ${selected.next.adult_residents} adults: ${selected.savings_cad == null ? 'unresolved' : `$${selected.savings_cad.toFixed(2)}`} per household, or ${(selected.relative_savings_ratio * 100).toFixed(1)}%. This is a provisional economic sweet spot, not an optimization result.`
  };
}

export function buildArcAdultScalePresentationContract(options = {}) {
  const landMarketData = options.landMarketData ?? loadArcLandMarketData();
  const scenarios = buildArcAdultScaleScenarios({adultCounts: options.adultCounts ?? ARC_ADULT_SCALE_SCENARIOS, landMarketData});
  const crossoverScenarios = buildArcAdultScaleScenarios({adultCounts: options.crossoverAdultCounts ?? ARC_ADULT_SCALE_CROSSOVER_SCENARIOS, landMarketData});
  const pricedScenarios = scenarios.filter((row) => row.combined_land_infrastructure_monthly_cad_per_household != null);
  const provisionalLowest = pricedScenarios.slice().sort((a, b) => a.combined_land_infrastructure_monthly_cad_per_household - b.combined_land_infrastructure_monthly_cad_per_household)[0];
  const landMarket = buildLandMarketContract(landMarketData);
  const marketBandCrossings = buildMarketBandCrossings(crossoverScenarios);
  const firstOver20Ha = crossoverScenarios.find((row) => Number(row.total_parcel_hectares) > 20) ?? null;
  const firstEvidenceBackedBandCrossover = marketBandCrossings.find((crossing) => crossing.evidence_sufficient_for_new_band && crossing.land_price_change_cad_per_ha != null && crossing.land_price_change_cad_per_ha < 0) ?? null;
  const marketBandCrossover = marketBandCrossings.find((crossing) => crossing.new_land_band_id === '20_to_40_ha' && crossing.evidence_sufficient_for_new_band && crossing.land_price_change_cad_per_ha != null && crossing.land_price_change_cad_per_ha < 0) ?? null;
  const economicSweetSpot = buildEconomicSweetSpot({rows: crossoverScenarios, crossover: marketBandCrossover});
  const farmScaleBand = landMarket.parcel_size_bands.find((band) => band.id === '20_to_40_ha');
  const largerFarmBand = landMarket.parcel_size_bands.find((band) => band.id === '40_plus_ha');
  const economicCrossoverStatus = marketBandCrossover
    ? economicSweetSpot
      ? (largerFarmBand?.sufficient_evidence_for_median ? 'provisional_evidence_supported_market_crossover_and_sweet_spot' : 'provisional_20_to_40_market_crossover_40_plus_unresolved')
      : 'provisional_market_crossover_no_sweet_spot'
    : 'unresolved_no_evidence_supported_market_band_crossover';
  const economicCrossover = {
    status: economicCrossoverStatus,
    scan_adult_counts: crossoverScenarios.map((row) => row.adult_residents),
    internal_scan: crossoverScenarios,
    market_band_crossings: marketBandCrossings,
    first_evidence_backed_band_crossover: firstEvidenceBackedBandCrossover,
    first_over_20_ha: firstOver20Ha ? {
      adult_residents: firstOver20Ha.adult_residents,
      households: firstOver20Ha.households,
      parcel_hectares: firstOver20Ha.total_parcel_hectares,
      land_market_band: firstOver20Ha.land_market_band,
      land_market_band_id: firstOver20Ha.land_market_band_id
    } : null,
    market_band_crossover: marketBandCrossover ? {
      ...marketBandCrossover,
      explanation: `The internal two-adult scan first enters the measured ${marketBandCrossover.new_land_band} band at ${marketBandCrossover.adult_residents} adults (${Number(marketBandCrossover.parcel_hectares).toFixed(2)} ha), rather than at the first public demonstration row. The observed land-price change is ${marketBandCrossover.land_price_change_cad_per_ha == null ? 'unresolved' : `${marketBandCrossover.land_price_change_cad_per_ha < 0 ? '-' : '+'}$${Math.abs(marketBandCrossover.land_price_change_cad_per_ha).toFixed(2)}/ha`} per hectare; the household charge changes by ${marketBandCrossover.household_monthly_change_cad == null ? 'unresolved' : `${marketBandCrossover.household_monthly_change_cad < 0 ? '-' : '+'}$${Math.abs(marketBandCrossover.household_monthly_change_cad).toFixed(2)}/month`}.`
    } : {
      status: 'unresolved',
      explanation: 'No transition into a lower-priced evidence-backed parcel band is currently supported by the loaded observations.'
    },
    economic_sweet_spot: economicSweetSpot,
    farm_scale_entry_adults: marketBandCrossover?.adult_residents ?? null,
    farm_scale_entry_band: marketBandCrossover?.new_land_band ?? null,
    diminishing_savings_point_adults: economicSweetSpot?.adult_residents ?? null,
    next_observed_scale_adults: economicSweetSpot?.next_adult_residents ?? null,
    next_scale_relative_savings_ratio: economicSweetSpot?.next_scale_relative_savings_ratio ?? null,
    provisional_lowest_charge_adult_scale: provisionalLowest?.adult_residents ?? null,
    provisional_lowest_charge_cad_per_household: provisionalLowest?.combined_land_infrastructure_monthly_cad_per_household ?? null,
    explanation: marketBandCrossover
      ? `The market-band crossover occurs at ${marketBandCrossover.adult_residents} adults in the internal scan. ${economicSweetSpot ? `The provisional economic sweet spot begins at ${economicSweetSpot.adult_residents} adults because the next two-adult step saves only ${economicSweetSpot.next_scale_savings_percent.toFixed(1)}%.` : 'A provisional sweet spot is not supported by the available priced steps.'} The 20–40 ha band has ${farmScaleBand?.sample_count ?? 0} observations and the 40+ ha band remains ${largerFarmBand?.sufficient_evidence_for_median ? 'supported' : 'unresolved'}.`
      : 'No adult-scale case currently enters a lower-priced parcel band with sufficient measured whole-property evidence.'
  };
  return {
    contract_version: '1.2.0',
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
