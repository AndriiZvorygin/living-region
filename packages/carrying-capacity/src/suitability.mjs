import {owenSoundGrowingEnvironment, siteCapability} from './environment.mjs';

export const AGROECOSYSTEM_CONTRACT_VERSION = '1.3.0';
export const SUPPORT_PLANT_SENSITIVITIES = Object.freeze([0.15, 0.25, 0.33]);
export const AGROECOSYSTEM_OBJECTIVES = Object.freeze({
  low_external_input: {label: 'Lowest external inputs'},
  low_land: {label: 'Lowest productive land'},
  low_labour: {label: 'Lowest labour'},
  nutritional_completeness: {label: 'Nutritional completeness'},
  resilient_diverse: {label: 'Resilience and diversity'}
});

const depthRank = {shallow: 1, shallow_to_moderate: 1.5, moderate: 2, moderate_to_deep: 2.5, deep: 3, variable: 1.5};
const climate = owenSoundGrowingEnvironment.climate;
const CAPABILITY_ALIASES = {
  annual_potato: 'potato_low_input_synthesis', annual_winter_wheat: 'wheat_low_input_synthesis',
  annual_dry_bean: 'dry_beans_low_input_synthesis', annual_sunflower: 'sunflower_low_input_synthesis',
  annual_oat: 'oats_low_input_synthesis', perennial_raspberry: 'early_berry_low_input_synthesis',
  perennial_hazelnut: 'intermediate_hazelnut_low_input_synthesis',
  perennial_chinese_chestnut: 'long_staple_chestnut_low_input_synthesis',
  perennial_apple_pear: 'intermediate_apple_low_input_synthesis'
};

export function buildSiteSelectionContext(siteId = 'ordinary_mesic', overrides = {}) {
  const capability = siteCapability(siteId);
  return {
    id: siteId,
    label: capability.label,
    capability,
    climate: {
      growing_degree_days_base5: climate.growing_degree_days.value_degree_days,
      frost_free_days: climate.frost_free_period.average_length_days,
      precipitation_annual_mm: climate.precipitation.annual_mm,
      precipitation_growing_season_mm: climate.precipitation.growing_season_mm,
      minimum_winter_temp_c: overrides.minimum_winter_temp_c ?? -28
    },
    soil: {
      depth: capability.soil_depth,
      drainage: capability.drainage,
      moisture: capability.wetness_constraint,
      capability_class_band: capability.cli_capability_class_band,
      texture: overrides.soil_texture ?? null,
      ph: overrides.ph ?? null
    },
    light: overrides.light ?? 'full_sun',
    slope_percent: overrides.slope_percent ?? null,
    wind_exposure: overrides.wind_exposure ?? null,
    water_available: overrides.water_available ?? true,
    permitted_species: overrides.permitted_species ?? null,
    excluded_species: overrides.excluded_species ?? [],
    user_overrides: overrides.user_overrides ?? {}
  };
}

function addReason(reasons, reason) { if (!reasons.includes(reason)) reasons.push(reason); }

export function calculatePlantSuitability(record, site = buildSiteSelectionContext(), options = {}) {
  const reasons = [];
  const exclusions = [];
  const missing = [];
  const needs = record.site_needs ?? {};
  const override = options.overrides?.[record.id] ?? site.user_overrides?.[record.id] ?? null;
  const hard = [];
  const climateMinimum = Number(needs.min_winter_temp_c);
  const seasonalCrop = record.architecture?.life_cycle === 'annual';
  if (!seasonalCrop && Number.isFinite(climateMinimum) && Number(site.climate.minimum_winter_temp_c) < climateMinimum) {
    hard.push(`winter survival is below the ${site.climate.minimum_winter_temp_c} °C scenario minimum`);
  }
  if (Number.isFinite(Number(needs.growing_degree_days_base5)) && Number(needs.growing_degree_days_base5) > Number(site.climate.growing_degree_days_base5)) {
    hard.push(`requires ${needs.growing_degree_days_base5} growing degree days but the local index is ${site.climate.growing_degree_days_base5}`);
  }
  if (needs.frost_sensitive && Number(record.establishment?.harvest_window?.end_doy) > 300 && site.climate.frost_free_days < 150) {
    hard.push('frost-sensitive crop has an unresolved late harvest window');
  }
  const excluded = new Set(site.excluded_species ?? []);
  if (excluded.has(record.id)) hard.push('excluded by the user for this scenario');
  if (Array.isArray(site.permitted_species) && !site.permitted_species.includes(record.id)) hard.push('not in the user-permitted species list');
  const yieldValues = record.outputs.map((output) => output.yield?.central).filter((value) => Number.isFinite(value));
  if (!yieldValues.length && record.outputs.some((output) => output.edible)) addReason(missing, 'edible yield evidence is unresolved');
  if (!record.evidence?.sources?.length) addReason(missing, 'no source link is attached');
  if (needs.ph && site.soil.ph) {
    const ph = Number(site.soil.ph);
    if (ph < Number(needs.ph.min) || ph > Number(needs.ph.max)) hard.push(`soil pH ${ph} is outside the stated ${needs.ph.min}–${needs.ph.max} range`);
  } else if (needs.ph?.min != null) addReason(missing, 'parcel pH is not mapped');
  if (site.light === 'partial_shade' && needs.light === 'full_sun') addReason(reasons, 'full-sun yield penalty applied to a partial-shade site');
  if (site.soil.depth && needs.soil_depth) {
    const gap = (depthRank[needs.soil_depth] ?? 2) - (depthRank[site.soil.depth] ?? 2);
    if (gap > 0) addReason(reasons, 'root-depth preference is below the site capability and yield is reduced');
  }
  if (site.soil.moisture.includes('wet') && needs.moisture?.includes?.('dry')) addReason(reasons, 'wetness placement or drainage is required');
  if (needs.water_requirement === 'high' && !site.water_available) hard.push('high water requirement has no available water source');
  const yieldPenalty = Math.max(.25, 1 - Math.max(0, (depthRank[needs.soil_depth] ?? 2) - (depthRank[site.soil.depth] ?? 2)) * .15);
  const lightPenalty = site.light === 'partial_shade' && needs.light === 'full_sun' ? .65 : 1;
  const capabilityId = CAPABILITY_ALIASES[record.id] ?? record.id;
  const capabilityRule = site.capability?.annual_crops?.[capabilityId] ?? site.capability?.perennial_layers?.[capabilityId];
  const sitePenalty = capabilityRule?.viable === false ? 0 : Number(capabilityRule?.yield_multiplier ?? 1);
  if (capabilityRule?.viable === false) hard.push('excluded by the selected regional site-capability scenario');
  if (override?.allow === true) { hard.length = 0; addReason(reasons, 'user override allows a normally excluded candidate; feasibility remains conditional'); }
  const hardCompatible = hard.length === 0;
  const confidencePenalty = Math.max(0, 1 - missing.length * .12 - (record.evidence?.confidence === 'low' ? .12 : 0));
  const score = hardCompatible ? Math.max(0, Math.min(1, sitePenalty * yieldPenalty * lightPenalty * confidencePenalty)) : 0;
  if (hardCompatible && !reasons.length) addReason(reasons, 'climate and site requirements are compatible with this scenario');
  exclusions.push(...hard);
  return {
    plant_id: record.id,
    hard_compatible: hardCompatible,
    suitability_score: Number(score.toFixed(4)),
    yield_multiplier: Number((score || sitePenalty || 0).toFixed(4)),
    confidence_penalty: Number(confidencePenalty.toFixed(4)),
    evidence_status: record.identity.evidence_status ?? record.evidence.source_class,
    missing_data: missing,
    inclusion_reasons: reasons,
    exclusion_reasons: exclusions,
    user_override: override,
    status: hardCompatible ? (missing.length ? 'conditional' : 'included') : 'excluded'
  };
}

export function rankPlantCandidates({database, site = buildSiteSelectionContext(), objectives = ['low_external_input'], overrides = {}} = {}) {
  const rows = (database.records ?? []).map((record) => ({record, suitability: calculatePlantSuitability(record, site, {overrides})}));
  return rows.sort((a, b) => b.suitability.suitability_score - a.suitability.suitability_score || a.record.id.localeCompare(b.record.id));
}
