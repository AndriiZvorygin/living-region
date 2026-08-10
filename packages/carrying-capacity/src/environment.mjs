import environmentData from '../data/source/owen-sound-growing-environment.json' with {type: 'json'};

export const GROWING_ENVIRONMENT_CONTRACT_VERSION = environmentData.contract_version;
export const owenSoundGrowingEnvironment = environmentData;
export const siteCapabilityDefinitions = environmentData.site_capabilities;

export function siteCapability(siteId = 'ordinary_mesic') {
  return siteCapabilityDefinitions[siteId] ?? siteCapabilityDefinitions.ordinary_mesic;
}

/** Select and renormalize only perennial layers viable on the selected site. */
export function selectPerennialMixForSite(baseMix = [], siteId = 'ordinary_mesic') {
  const capability = siteCapability(siteId);
  const selected = baseMix
    .map((row) => ({...row, site_viability: capability.perennial_layers?.[row.id] ?? {viable: true, yield_multiplier: 1}}))
    .filter((row) => row.site_viability.viable !== false && Number(row.mature_food_gj_ha_year) > 0);
  const weight = selected.reduce((sum, row) => sum + Number(row.area_share ?? 0), 0);
  if (!weight) throw new Error(`No viable perennial layers for site ${siteId}`);
  return selected.map((row) => ({
    ...row,
    original_area_share: row.area_share,
    area_share: Number(row.area_share ?? 0) / weight,
    site_yield_multiplier: Number(row.site_viability.yield_multiplier ?? 1)
  }));
}

export function viableAnnualCropIds(siteId = 'ordinary_mesic') {
  return Object.entries(siteCapability(siteId).annual_crops ?? {})
    .filter(([, row]) => row.viable !== false)
    .map(([id]) => id);
}
