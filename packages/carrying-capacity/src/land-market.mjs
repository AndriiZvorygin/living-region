import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ACRE_TO_HECTARE = 2.4710538147;
const round = (value, digits = 2) => Math.round(Number(value) * 10 ** digits) / 10 ** digits;
const finite = (value, fallback = null) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const ARC_LAND_MARKET_CONTRACT_VERSION = '1.0.0';

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

// This is deliberately a benchmark plus an empty local observation slot. The
// benchmark is useful for context; only parcel-size-tagged observations enter
// the size curve. The planning curve is visibly provisional and replaceable.
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
  planning_curve_status: 'working_planning_sensitivity_not_market_evidence',
  planning_curve_basis: 'The 5–10 ha anchor is the 2024 Grey County survey benchmark converted from CAD 19,000 per tillable acre. Other bands are explicit sensitivity assumptions for testing parcel-size effects until whole-parcel observations are imported.'
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
  const pricePerHa = finite(raw.price_cad_per_ha ?? raw.price_per_ha_cad, null);
  const price = finite(raw.price_cad ?? raw.price ?? null, null);
  const pricePerAcre = finite(raw.price_cad_per_tillable_acre ?? raw.price_per_tillable_acre_cad, null);
  const acreBasis = ['per_acre', 'per_tillable_acre'].includes(raw.price_basis);
  const derivedPricePerHa = pricePerHa ?? (pricePerAcre == null ? (acreBasis && price != null ? price * ACRE_TO_HECTARE : price) : pricePerAcre * ACRE_TO_HECTARE);
  const parcelHa = finite(raw.total_parcel_area_ha ?? raw.parcel_area_ha, null);
  return {
    ...raw,
    observation_id: raw.observation_id ?? raw.id ?? null,
    observation_date: raw.observation_date ?? raw.date ?? null,
    municipality: raw.municipality ?? raw.county ?? null,
    total_parcel_area_ha: parcelHa,
    estimated_productive_area_ha: finite(raw.estimated_productive_area_ha, null),
    price_cad_per_ha: derivedPricePerHa == null ? null : round(derivedPricePerHa, 2),
    price_cad: price,
    price_basis: raw.price_basis ?? (pricePerAcre != null ? 'per_tillable_acre' : 'per_ha'),
    evidence_status: raw.evidence_status ?? 'manual_observation_unverified'
  };
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

function qualifyingParcelObservation(row) {
  return row.total_parcel_area_ha != null && row.price_cad_per_ha != null && row.improvement_adjustment_status !== 'improvements_not_removed' && row.value_basis !== 'farm_with_improvements';
}

function quantile(values, fraction) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return round(sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower), 2);
}

export function summarizeLandObservations(observations = []) {
  const normalized = observations.map(normalizeLandObservation);
  return ARC_LAND_SIZE_BANDS.map((band) => {
    const rows = normalized.filter((row) => qualifyingParcelObservation(row) && classifyLandSize(row.total_parcel_area_ha)?.id === band.id);
    const prices = rows.map((row) => row.price_cad_per_ha);
    return {
      ...band,
      sample_count: rows.length,
      median_price_cad_per_ha: quantile(prices, .5),
      lower_quartile_price_cad_per_ha: quantile(prices, .25),
      upper_quartile_price_cad_per_ha: quantile(prices, .75),
      min_price_cad_per_ha: prices.length ? Math.min(...prices) : null,
      max_price_cad_per_ha: prices.length ? Math.max(...prices) : null,
      property_type_composition: Object.fromEntries([...new Set(rows.map((row) => row.property_type).filter(Boolean))].map((type) => [type, rows.filter((row) => row.property_type === type).length])),
      observation_years: [...new Set(rows.map((row) => String(row.observation_date ?? '').slice(0, 4)).filter(Boolean))]
    };
  });
}

export function buildLandMarketContract(data = loadArcLandMarketData()) {
  const observations = (data.observations ?? []).map(normalizeLandObservation);
  return {
    contract_version: ARC_LAND_MARKET_CONTRACT_VERSION,
    geography: 'Grey County and comparable Ontario agricultural evidence',
    observations,
    parcel_size_bands: summarizeLandObservations(observations),
    sources: data.sources ?? ARC_LAND_MARKET_SOURCES,
    planning_curve: data.planning_curve ?? DEFAULT_ARC_LAND_MARKET_DATA.planning_curve,
    planning_curve_status: data.planning_curve_status ?? DEFAULT_ARC_LAND_MARKET_DATA.planning_curve_status,
    planning_curve_basis: data.planning_curve_basis ?? DEFAULT_ARC_LAND_MARKET_DATA.planning_curve_basis,
    local_parcel_curve_status: summarizeLandObservations(observations).some((row) => row.sample_count > 0) ? 'partial_size_tagged_observations' : 'unresolved_no_size_tagged_observations',
    notes: [
      'Survey benchmarks per tillable acre are not silently treated as whole-parcel sale prices.',
      'Farm properties with dwellings or outbuildings require improvement separation before entering the parcel curve.',
      'The importer accepts manually verified lawful observations; no REALTOR.ca scraping is used.'
    ]
  };
}

export function estimateLandPriceForParcel({parcelAreaHa, data = loadArcLandMarketData()} = {}) {
  const contract = buildLandMarketContract(data);
  const band = classifyLandSize(parcelAreaHa);
  if (!band) return {parcel_area_ha: parcelAreaHa, band: null, price_cad_per_ha: null, status: 'unresolved_missing_parcel_area', contract_version: contract.contract_version};
  const observed = contract.parcel_size_bands.find((row) => row.id === band.id);
  if (observed?.sample_count) return {parcel_area_ha: round(parcelAreaHa, 6), band_id: band.id, band_label: band.label, price_cad_per_ha: observed.median_price_cad_per_ha, price_range_cad_per_ha: [observed.lower_quartile_price_cad_per_ha, observed.upper_quartile_price_cad_per_ha], status: 'measured_local_size_band', sample_count: observed.sample_count, contract_version: contract.contract_version};
  return {parcel_area_ha: round(parcelAreaHa, 6), band_id: band.id, band_label: band.label, price_cad_per_ha: finite(contract.planning_curve?.[band.id], 35000), price_range_cad_per_ha: null, status: contract.local_parcel_curve_status === 'unresolved_no_size_tagged_observations' ? 'working_planning_sensitivity' : 'working_planning_sensitivity_for_sparse_band', sample_count: 0, contract_version: contract.contract_version};
}
