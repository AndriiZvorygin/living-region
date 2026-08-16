import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ACRE_TO_HECTARE = 2.4710538147;
const round = (value, digits = 2) => Math.round(Number(value) * 10 ** digits) / 10 ** digits;
const finite = (value, fallback = null) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const ARC_LAND_MARKET_CONTRACT_VERSION = '1.2.0';
export const ARC_LAND_MARKET_MINIMUM_BAND_SAMPLE = 3;

export const ARC_LAND_SIZE_BANDS = [
  {id: 'under_2_ha', label: '<2 ha', min_ha: 0, max_ha: 2},
  {id: '2_to_5_ha', label: '2–5 ha', min_ha: 2, max_ha: 5},
  {id: '5_to_10_ha', label: '5–10 ha', min_ha: 5, max_ha: 10},
  {id: '10_to_20_ha', label: '10–20 ha', min_ha: 10, max_ha: 20},
  {id: '20_to_40_ha', label: '20–40 ha', min_ha: 20, max_ha: 40},
  {id: '40_plus_ha', label: '40+ ha', min_ha: 40, max_ha: null}
];

export const ARC_LAND_MARKET_SOURCES = [
  {
    id: 'ontario_farmland_value_rental_survey_2024',
    institution: 'Ontario Farmland Value and Rental Value Survey',
    title: '2024 Farmland Value Rental Value Survey',
    date: '2024 observations, published 2025',
    url: 'https://www.onfarmlandsurvey.com/_files/ugd/25f478_d4037c4c1a514db29440ad1d0cfb5c73.pdf',
    geography: 'Grey County and Ontario counties',
    evidence_status: 'survey_benchmark',
    limitation: 'Reports tillable-acre values and response counts, not whole-parcel size-tagged transactions or bare-land sale records.'
  },
  {
    id: 'royal_lepage_rcr_public_listing_pages',
    institution: 'Royal LePage RCR Realty / public brokerage listing pages',
    title: 'Grey County vacant-land and farm listing observations',
    date: '2025–2026 observations; retrieved 2026-08-15',
    url: 'https://www.royallepage.ca/en/on/west-grey/land/properties/',
    geography: 'Grey County municipalities including West Grey, Grey Highlands, Chatsworth, Georgian Bluffs and Southgate',
    evidence_status: 'public_listing_observations',
    limitation: 'Asking prices are not completed sale prices; listing descriptions and acreage should be independently verified before acquisition decisions.'
  },
  {
    id: 'sutton_sound_public_listing_pages',
    institution: 'Sutton-Sound Realty',
    title: 'Grey County vacant-land listing observations',
    date: '2025–2026 observations; retrieved 2026-08-15',
    url: 'https://www.suttonsoundrealty.ca/office-listings?p=6',
    geography: 'Georgian Bluffs and Grey County',
    evidence_status: 'public_listing_observations',
    limitation: 'Asking prices and listing status can change; observations are preserved with the source URL and retrieval date.'
  },
  {
    id: 'grey_bruce_public_listing_aggregators',
    institution: 'Public brokerage-fed listing pages',
    title: 'REW, Zolo, Squareyards, One Percent Realty, Krib and comparable public listing pages',
    date: '2025–2026 observations; retrieved 2026-08-15',
    url: 'https://www.rew.ca/properties/areas/west-grey-on/type/land-lot',
    geography: 'Grey County municipalities',
    evidence_status: 'public_listing_observations',
    limitation: 'Secondary listing displays may lag source brokerage records and are used as documented observations, not as a substitute for verified sale data.'
  },
  {
    id: 'ontario_farmland_value_open_data',
    institution: 'Ontario Ministry of Agriculture, Food and Agribusiness',
    title: 'Estimated value and rental rate of farmland by county and township',
    date: '1991–2021 dataset; validated 2022, catalog record updated 2025',
    url: 'https://data.ontario.ca/en/dataset/estimated-value-and-rental-rate-of-farmland-by-county-and-township',
    geography: 'Ontario counties and townships',
    evidence_status: 'official_context_dataset',
    limitation: 'Farm land/building value context is not a parcel-size curve and does not isolate ARC-suitable bare land.'
  },
  {
    id: 'fcc_farmland_values_2025',
    institution: 'Farm Credit Canada',
    title: 'FCC Farmland Values Report',
    date: '2025 values; accessed 2026-08-15',
    url: 'https://www.fcc-fac.ca/en/knowledge/economics/farmland-values-report',
    geography: 'Canadian provinces and FCC regions',
    evidence_status: 'authoritative_comparator',
    limitation: 'Regional cultivated-land value trends are not Grey County parcel-size observations and detailed historical data require FCC Online Services access.'
  },
  {
    id: 'statistics_canada_farm_capital_2021',
    institution: 'Statistics Canada',
    title: 'Farm capital, Census of Agriculture, 2021, Table 32-10-0237-01',
    date: '2021',
    url: 'https://www150.statcan.gc.ca/n1/en/catalogue/3210023701',
    geography: 'Canada, provinces, census divisions and other agricultural geographies',
    evidence_status: 'official_context_dataset',
    limitation: 'Value of land and buildings includes improvements and is not a bare-land parcel-price series.'
  }
];

// The local observations are manually entered from lawful public listing and
// sale pages. The planning curve remains only a fallback for a future band
// whose evidence falls below the minimum sample threshold.
export const DEFAULT_ARC_LAND_MARKET_DATA = {
  contract_version: ARC_LAND_MARKET_CONTRACT_VERSION,
  observations: [
    {
      observation_id: 'grey-2024-tillable-benchmark',
      observation_date: '2024-12-31',
      source: 'ontario_farmland_value_rental_survey_2024',
      municipality: 'Grey County',
      property_identifier: null,
      source_url: 'https://www.onfarmlandsurvey.com/_files/ugd/25f478_d4037c4c1a514db29440ad1d0cfb5c73.pdf',
      price_cad: 19000,
      price_basis: 'per_tillable_acre',
      total_parcel_area_ha: null,
      estimated_productive_area_ha: null,
      property_type: 'average_quality_cropland_benchmark',
      dwelling_included: null,
      barns_outbuildings_included: null,
      road_frontage_access: null,
      servicing: null,
      agricultural_designation: null,
      site_quality_notes: 'Median Grey County average-quality cropland response; 29 responses.',
      response_count: 29,
      value_basis: 'tillable_land_survey',
      improvement_adjustment_status: 'not_applicable_benchmark_not_parcel_sale',
      evidence_status: 'survey_benchmark'
    }
  ],
  sources: ARC_LAND_MARKET_SOURCES,
  planning_curve: {
    under_2_ha: 60000,
    '2_to_5_ha': 50000,
    '5_to_10_ha': 46950,
    '10_to_20_ha': 42000,
    '20_to_40_ha': 36000,
    '40_plus_ha': 32000
  },
  minimum_observations_for_curve: ARC_LAND_MARKET_MINIMUM_BAND_SAMPLE,
  planning_curve_status: 'fallback_only_for_unresolved_or_sparse_bands',
  planning_curve_basis: 'The 5–10 ha value is anchored to the 2024 Grey County survey benchmark converted from CAD 19,000 per tillable acre. Other values remain explicit fallback sensitivities and are not used when a parcel-size band has sufficient local observations.'
};

export function landMarketDataPath() {
  return path.join(PACKAGE_ROOT, 'data/source/arc-land-market-observations.json');
}

export function loadArcLandMarketData(filePath = landMarketDataPath()) {
  if (!fs.existsSync(filePath)) return structuredClone(DEFAULT_ARC_LAND_MARKET_DATA);
  const loaded = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return {
    ...structuredClone(DEFAULT_ARC_LAND_MARKET_DATA),
    ...loaded,
    observations: Array.isArray(loaded.observations) ? loaded.observations : [],
    sources: loaded.sources ?? DEFAULT_ARC_LAND_MARKET_DATA.sources
  };
}

export function normalizeLandObservation(raw = {}) {
  const pricePerHaRaw = raw.price_cad_per_ha ?? raw.price_per_ha_cad;
  const priceRaw = raw.price_cad ?? raw.price;
  const adjustedPriceRaw = raw.adjusted_price_cad ?? raw.land_only_adjusted_price_cad;
  const pricePerAcreRaw = raw.price_cad_per_tillable_acre ?? raw.price_per_tillable_acre_cad;
  const pricePerHa = pricePerHaRaw == null ? null : finite(pricePerHaRaw, null);
  const price = priceRaw == null ? null : finite(priceRaw, null);
  const adjustedPrice = adjustedPriceRaw == null ? null : finite(adjustedPriceRaw, null);
  const pricePerAcre = pricePerAcreRaw == null ? null : finite(pricePerAcreRaw, null);
  const acreBasis = ['per_acre', 'per_tillable_acre'].includes(raw.price_basis);
  const totalParcelAcresRaw = raw.total_parcel_area_acres ?? raw.parcel_area_acres;
  const productiveAcresRaw = raw.estimated_productive_area_acres ?? raw.productive_area_acres;
  const totalParcelAcres = totalParcelAcresRaw == null ? null : finite(totalParcelAcresRaw, null);
  const productiveAcres = productiveAcresRaw == null ? null : finite(productiveAcresRaw, null);
  const parcelHaRaw = raw.total_parcel_area_ha ?? raw.parcel_area_ha;
  const productiveHaRaw = raw.estimated_productive_area_ha;
  const parcelHa = parcelHaRaw == null
    ? (totalParcelAcres == null ? null : totalParcelAcres / ACRE_TO_HECTARE)
    : finite(parcelHaRaw, null);
  const productiveHa = productiveHaRaw == null
    ? (productiveAcres == null ? null : productiveAcres / ACRE_TO_HECTARE)
    : finite(productiveHaRaw, null);
  const wholePropertyBasis = ['whole_property_asking_price', 'whole_property_sale_price', 'whole_property_value'].includes(raw.price_basis);
  const curvePrice = adjustedPrice ?? price;
  const derivedPricePerHa = pricePerHa ?? (pricePerAcre == null
    ? (wholePropertyBasis && curvePrice != null && parcelHa ? curvePrice / parcelHa : (acreBasis && curvePrice != null ? curvePrice * ACRE_TO_HECTARE : curvePrice))
    : pricePerAcre * ACRE_TO_HECTARE);
  const normalized = {
    ...raw,
    observation_id: raw.observation_id ?? raw.id ?? null,
    observation_date: raw.observation_date ?? raw.date ?? null,
    retrieval_date: raw.retrieval_date ?? raw.retrieved_on ?? null,
    municipality: raw.municipality ?? raw.county ?? null,
    total_parcel_area_acres: totalParcelAcres,
    total_parcel_area_ha: parcelHa,
    estimated_productive_area_acres: productiveAcres,
    estimated_productive_area_ha: productiveHa,
    raw_price_cad: price,
    adjusted_price_cad: adjustedPrice,
    price_cad_per_ha: derivedPricePerHa == null ? null : round(derivedPricePerHa, 2),
    gross_acquisition_price_cad: price,
    gross_acquisition_price_cad_per_ha: price == null || parcelHa == null || parcelHa <= 0 ? null : round(price / parcelHa, 2),
    adjusted_land_price_cad_per_ha: adjustedPrice == null || parcelHa == null || parcelHa <= 0 ? null : round(adjustedPrice / parcelHa, 2),
    price_cad: price,
    price_basis: raw.price_basis ?? (pricePerAcre != null ? 'per_tillable_acre' : 'per_ha'),
    evidence_status: raw.evidence_status ?? 'manual_observation_unverified'
  };
  normalized.property_market_class = isImprovedProperty(normalized) ? 'improved_property' : 'vacant_land';
  normalized.substantial_improvements = hasSubstantialImprovements(normalized);
  normalized.arc_usable_acquisition = qualifyingAcquisitionObservation(normalized);
  normalized.potential_arc_reuse = buildArcReuseAssessment(normalized);
  return normalized;
}

export function parseLandObservationCsv(csvText) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];
    const next = csvText[index + 1];
    if (character === '"' && quoted && next === '"') { field += '"'; index += 1; continue; }
    if (character === '"') { quoted = !quoted; continue; }
    if (character === ',' && !quoted) { row.push(field); field = ''; continue; }
    if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(field); field = '';
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      continue;
    }
    field += character;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const headers = (rows.shift() ?? []).map((header) => header.trim());
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? '']))).map(normalizeLandObservation);
}

export function classifyLandSize(parcelHa) {
  const value = finite(parcelHa, null);
  if (value == null || value < 0) return null;
  return ARC_LAND_SIZE_BANDS.find((band) => value >= band.min_ha && (band.max_ha == null || value < band.max_ha)) ?? ARC_LAND_SIZE_BANDS.at(-1);
}

function isImprovedProperty(row) {
  const propertyType = String(row.property_type ?? '').toLowerCase();
  return row.dwelling_included === true
    || row.barns_outbuildings_included === true
    || propertyType.includes('farm_with')
    || propertyType.includes('with_dwelling')
    || propertyType.includes('with_outbuilding');
}

function hasSubstantialImprovements(row) {
  const propertyType = String(row.property_type ?? '').toLowerCase();
  if (row.dwelling_included === true || propertyType.includes('farm_with') || propertyType.includes('with_dwelling')) return true;
  if (propertyType.includes('vacant_land_with_outbuilding')) return true;
  return row.barns_outbuildings_included === true && row.improvement_adjustment_status === 'improvements_not_removed';
}

function qualifyingAcquisitionObservation(row) {
  if (row.total_parcel_area_ha == null || row.gross_acquisition_price_cad == null) return false;
  if (row.curve_eligibility === 'excluded_unverified' || row.curve_eligibility === 'excluded_strategic_or_development_premium') return false;
  return ['whole_property_asking_price', 'whole_property_sale_price', 'whole_property_value'].includes(row.price_basis);
}

function buildArcReuseAssessment(row) {
  const servicing = String(row.servicing ?? '').toLowerCase();
  const access = String(row.road_frontage_access ?? '').toLowerCase();
  const hasDwelling = row.dwelling_included === true;
  const hasBuildings = row.barns_outbuildings_included === true;
  const hasWater = /well|water|existing_dwelling_services/.test(servicing);
  const hasSewage = /septic|sewage|existing_dwelling_services/.test(servicing);
  const hasElectrical = /hydro|electrical|grid|existing_dwelling_services/.test(servicing);
  const hasAccess = /driveway|paved_road|rural_road|highway|access/.test(access);
  const asset = (id, present, status = 'not_present', note = '') => ({id, present, status, reuse_value_cad: null, note});
  const assets = [
    asset('resident_dwelling', hasDwelling, hasDwelling ? 'condition_unknown' : 'not_present', hasDwelling ? 'Existing dwelling requires condition, occupancy and code review.' : ''),
    asset('common_amenity_building', hasDwelling, hasDwelling ? 'potentially_reusable' : 'not_present', hasDwelling ? 'Farmhouse or existing house could serve as common space; permitted use is unresolved.' : ''),
    asset('workshop_storage', hasBuildings, hasBuildings ? 'potentially_reusable' : 'not_present', hasBuildings ? 'Barn, shed or workshop requires condition and safe-use review.' : ''),
    asset('agricultural_buildings', hasBuildings, hasBuildings ? 'potentially_reusable' : 'not_present'),
    asset('road_access', hasAccess, hasAccess ? 'potentially_reusable' : 'not_present', hasAccess ? 'Existing frontage or driveway may reduce new access work; no capital credit is assumed.' : ''),
    asset('well_water_system', hasWater, hasWater ? 'condition_unknown' : 'not_present', hasWater ? 'Existing water evidence still requires potability, capacity and approval review.' : ''),
    asset('septic_sanitation', hasSewage, hasSewage ? 'condition_unknown' : 'not_present', hasSewage ? 'Existing sewage evidence still requires capacity and approval review.' : ''),
    asset('grid_electrical_service', hasElectrical, hasElectrical ? 'potentially_reusable' : 'not_present', hasElectrical ? 'Existing electrical service requires capacity and connection review.' : '')
  ];
  return {
    assessment_status: assets.some((item) => item.present) ? 'candidate_reuse_unpriced' : 'no_known_reuse_assets',
    capital_offset_status: assets.some((item) => item.present) ? 'reuse_value_unresolved' : 'not_applicable',
    assets,
    note: 'Existing assets remain in the gross acquisition price. No monetary capital offset is applied without condition, legal and replacement-cost evidence.'
  };
}

function qualifyingParcelObservation(row) {
  if (row.total_parcel_area_ha == null || row.price_cad_per_ha == null) return false;
  if (row.curve_eligibility === 'excluded_improved_property' || row.curve_eligibility === 'excluded_unverified' || row.curve_eligibility === 'excluded_strategic_or_development_premium') return false;
  return row.improvement_adjustment_status !== 'improvements_not_removed' && row.value_basis !== 'farm_with_improvements';
}

function observationStatus(row) {
  return row.transaction_status ?? (row.price_basis === 'whole_property_sale_price' ? 'sold_listing' : 'active_listing');
}

function quantile(values, fraction) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return round(sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower), 2);
}

function summarizeMarketObservations(observations = [], predicate = qualifyingParcelObservation, marketView = 'vacant_land') {
  const normalized = observations.map(normalizeLandObservation);
  return ARC_LAND_SIZE_BANDS.map((band) => {
    const rows = normalized.filter((row) => qualifyingParcelObservation(row) && classifyLandSize(row.total_parcel_area_ha)?.id === band.id);
    const selected = normalized.filter((row) => predicate(row) && classifyLandSize(row.total_parcel_area_ha)?.id === band.id);
    const prices = selected.map((row) => marketView === 'vacant_land' ? row.price_cad_per_ha : row.gross_acquisition_price_cad_per_ha);
    const grossPrices = selected.map((row) => row.gross_acquisition_price_cad_per_ha);
    const totalPrices = selected.map((row) => row.gross_acquisition_price_cad);
    return {
      ...band,
      market_view: marketView,
      sample_count: selected.length,
      median_price_cad_per_ha: quantile(prices, .5),
      median_gross_price_cad_per_ha: quantile(grossPrices, .5),
      median_total_acquisition_price_cad: quantile(totalPrices, .5),
      lower_quartile_price_cad_per_ha: quantile(prices, .25),
      upper_quartile_price_cad_per_ha: quantile(prices, .75),
      min_price_cad_per_ha: prices.length ? Math.min(...prices) : null,
      max_price_cad_per_ha: prices.length ? Math.max(...prices) : null,
      min_total_acquisition_price_cad: totalPrices.length ? Math.min(...totalPrices) : null,
      max_total_acquisition_price_cad: totalPrices.length ? Math.max(...totalPrices) : null,
      property_type_composition: Object.fromEntries([...new Set(selected.map((row) => row.property_type).filter(Boolean))].map((type) => [type, selected.filter((row) => row.property_type === type).length])),
      observation_years: [...new Set(selected.map((row) => String(row.observation_date ?? '').slice(0, 4)).filter(Boolean))],
      transaction_status_composition: Object.fromEntries([...new Set(selected.map(observationStatus))].map((status) => [status, selected.filter((row) => observationStatus(row) === status).length])),
      vacant_observation_count: selected.filter((row) => String(row.property_type ?? '').startsWith('vacant_')).length,
      improved_observation_count_excluded: normalized.filter((row) => classifyLandSize(row.total_parcel_area_ha)?.id === band.id && !qualifyingParcelObservation(row) && (row.dwelling_included === true || row.barns_outbuildings_included === true || String(row.property_type ?? '').includes('farm_with'))).length
    };
  });
}

export function summarizeLandObservations(observations = []) {
  return summarizeMarketObservations(observations, qualifyingParcelObservation, 'vacant_land');
}

export function getArcAcquisitionObservation({observationId, data = loadArcLandMarketData()} = {}) {
  const row = (data.observations ?? []).map(normalizeLandObservation).find((candidate) => candidate.observation_id === observationId);
  return row && qualifyingAcquisitionObservation(row) ? row : null;
}

function summarizeAcquisitionMarket(observations, predicate, marketView) {
  const normalized = observations.map(normalizeLandObservation);
  const selected = normalized.filter(predicate);
  const prices = selected.map((row) => row.gross_acquisition_price_cad_per_ha);
  const totalPrices = selected.map((row) => row.gross_acquisition_price_cad);
  return {
    market_view: marketView,
    observation_count: selected.length,
    median_total_acquisition_price_cad: quantile(totalPrices, .5),
    lower_quartile_total_acquisition_price_cad: quantile(totalPrices, .25),
    upper_quartile_total_acquisition_price_cad: quantile(totalPrices, .75),
    median_gross_price_cad_per_ha: quantile(prices, .5),
    parcel_size_bands: summarizeMarketObservations(observations, predicate, marketView),
    property_type_composition: Object.fromEntries([...new Set(selected.map((row) => row.property_type).filter(Boolean))].map((type) => [type, selected.filter((row) => row.property_type === type).length])),
    observation_ids: selected.map((row) => row.observation_id)
  };
}

function productiveLandComparators(observations) {
  return observations.filter((row) => row.price_cad_per_ha != null && (row.price_basis === 'per_tillable_acre' || row.productive_curve_eligibility === 'productive_land_curve')).map((row) => ({
    observation_id: row.observation_id,
    source: row.source,
    source_url: row.source_url,
    observation_date: row.observation_date,
    municipality: row.municipality,
    price_cad_per_productive_ha: row.price_cad_per_ha,
    estimated_productive_area_ha: row.estimated_productive_area_ha,
    evidence_status: row.evidence_status,
    note: row.price_basis === 'per_tillable_acre' ? 'Tillable-acre survey benchmark; not a whole-parcel transaction.' : 'Productive-area observation requires improvement and land-use verification.'
  }));
}

export function buildLandMarketContract(data = loadArcLandMarketData()) {
  const observations = (data.observations ?? []).map(normalizeLandObservation);
  const parcelSizeBands = summarizeLandObservations(observations);
  const vacantLandMarket = summarizeAcquisitionMarket(observations, qualifyingParcelObservation, 'vacant_land');
  const improvedPropertyMarket = summarizeAcquisitionMarket(observations, (row) => qualifyingAcquisitionObservation(row) && isImprovedProperty(row), 'improved_property');
  const arcUsableMarket = summarizeAcquisitionMarket(observations, qualifyingAcquisitionObservation, 'arc_usable_acquisition');
  const adjustedLandRows = observations.filter((row) => qualifyingAcquisitionObservation(row) && row.adjusted_price_cad != null);
  const minimumSampleCount = Number(data.minimum_observations_for_curve ?? ARC_LAND_MARKET_MINIMUM_BAND_SAMPLE);
  return {
    contract_version: ARC_LAND_MARKET_CONTRACT_VERSION,
    geography: 'Grey County and comparable Ontario agricultural evidence',
    observations,
    parcel_size_bands: parcelSizeBands.map((band) => ({...band, sufficient_evidence_for_median: band.sample_count >= minimumSampleCount})),
    vacant_land_market: {
      ...vacantLandMarket,
      parcel_size_bands: vacantLandMarket.parcel_size_bands.map((band) => ({...band, sufficient_evidence_for_median: band.sample_count >= minimumSampleCount}))
    },
    improved_property_acquisition_market: {
      ...improvedPropertyMarket,
      parcel_size_bands: improvedPropertyMarket.parcel_size_bands.map((band) => ({...band, sufficient_evidence_for_median: band.sample_count >= minimumSampleCount}))
    },
    arc_usable_acquisition_market: {
      ...arcUsableMarket,
      parcel_size_bands: arcUsableMarket.parcel_size_bands.map((band) => ({...band, sufficient_evidence_for_median: band.sample_count >= minimumSampleCount}))
    },
    adjusted_land_value_evidence: {
      market_view: 'adjusted_land_value',
      observation_count: adjustedLandRows.length,
      status: adjustedLandRows.length ? 'available_for_separate_analysis' : 'unresolved_no_documented_improvement_adjustments',
      observation_ids: adjustedLandRows.map((row) => row.observation_id),
      note: 'Adjusted land values are never substituted for gross acquisition prices. A documented improvement value or defensible residual method is required.'
    },
    productive_land_comparators: productiveLandComparators(observations),
    sources: data.sources ?? ARC_LAND_MARKET_SOURCES,
    planning_curve: data.planning_curve ?? DEFAULT_ARC_LAND_MARKET_DATA.planning_curve,
    planning_curve_status: data.planning_curve_status ?? DEFAULT_ARC_LAND_MARKET_DATA.planning_curve_status,
    planning_curve_basis: data.planning_curve_basis ?? DEFAULT_ARC_LAND_MARKET_DATA.planning_curve_basis,
    minimum_observations_for_curve: minimumSampleCount,
    local_parcel_curve_status: parcelSizeBands.every((row) => row.sample_count >= minimumSampleCount) ? 'measured_local_whole_property_curve' : parcelSizeBands.some((row) => row.sample_count > 0) ? 'partial_measured_whole_property_curve' : 'unresolved_no_size_tagged_observations',
    productive_land_curve_status: productiveLandComparators(observations).some((row) => row.estimated_productive_area_ha != null) ? 'requires_improvement_adjustment_and_more_observations' : 'survey_comparator_only_no_parcel_curve',
    improved_property_observation_count: observations.filter(isImprovedProperty).length,
    improved_property_substantial_observation_count: observations.filter(hasSubstantialImprovements).length,
    usable_whole_property_observation_count: observations.filter(qualifyingParcelObservation).length,
    usable_vacant_land_observation_count: vacantLandMarket.observation_count,
    usable_arc_acquisition_observation_count: arcUsableMarket.observation_count,
    minor_improvement_overlap_observation_count: observations.filter((row) => isImprovedProperty(row) && !hasSubstantialImprovements(row) && qualifyingAcquisitionObservation(row)).length,
    notes: [
      'Survey benchmarks per tillable acre are not silently treated as whole-parcel sale prices.',
      'Vacant-land bands exclude substantial buildings while retaining minor improvements as explicitly flagged observations when they are not a separate material asset.',
      'Improved properties enter gross acquisition statistics at their actual whole-property asking or sale price; no farmhouse or barn value is silently subtracted.',
      'Existing improvements expose candidate ARC reuse assets, but no monetary capital offset is applied without condition, legal and replacement-cost evidence.',
      'The importer accepts manually verified lawful observations; no REALTOR.ca scraping is used.'
    ]
  };
}

export function estimateLandPriceForParcel({parcelAreaHa, market = 'vacant_land', data = loadArcLandMarketData()} = {}) {
  const contract = buildLandMarketContract(data);
  const band = classifyLandSize(parcelAreaHa);
  const marketContract = market === 'improved_property'
    ? contract.improved_property_acquisition_market
    : market === 'arc_usable_acquisition' || market === 'all_arc_usable'
      ? contract.arc_usable_acquisition_market
      : contract.vacant_land_market;
  if (!band) return {parcel_area_ha: parcelAreaHa, market_view: marketContract.market_view, band: null, price_cad_per_ha: null, status: 'unresolved_missing_parcel_area', contract_version: contract.contract_version};
  const observed = marketContract.parcel_size_bands.find((row) => row.id === band.id);
  if (observed?.sufficient_evidence_for_median) return {parcel_area_ha: round(parcelAreaHa, 6), market_view: marketContract.market_view, band_id: band.id, band_label: band.label, price_cad_per_ha: observed.median_price_cad_per_ha, price_range_cad_per_ha: [observed.lower_quartile_price_cad_per_ha, observed.upper_quartile_price_cad_per_ha], median_total_acquisition_price_cad: observed.median_total_acquisition_price_cad, status: 'measured_local_size_band', sample_count: observed.sample_count, contract_version: contract.contract_version};
  return {parcel_area_ha: round(parcelAreaHa, 6), market_view: marketContract.market_view, band_id: band.id, band_label: band.label, price_cad_per_ha: null, price_range_cad_per_ha: null, median_total_acquisition_price_cad: null, status: 'unresolved_insufficient_local_size_band_evidence', sample_count: observed?.sample_count ?? 0, required_sample_count: contract.minimum_observations_for_curve, contract_version: contract.contract_version};
}
