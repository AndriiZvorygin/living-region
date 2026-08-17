const round = (value, digits = 6) => Math.round(Number(value) * 10 ** digits) / 10 ** digits;

function interpolate(anchors, year) {
  if (year === 'mature') return 1;
  const points = Object.entries(anchors ?? {}).map(([key, value]) => [Number(key), Number(value)]).sort((a, b) => a[0] - b[0]);
  const x = Number(year);
  if (!points.length || !Number.isFinite(x)) return 0;
  if (x <= points[0][0]) return points[0][1];
  if (x >= points.at(-1)[0]) return points.at(-1)[1];
  for (let i = 1; i < points.length; i++) {
    const [x2, y2] = points[i]; const [x1, y1] = points[i - 1];
    if (x <= x2) return y1 + (y2 - y1) * ((x - x1) / (x2 - x1));
  }
  return 0;
}

/**
 * Build the physical perennial harvest ledger used by both succession and
 * nutrition.  The function deliberately knows nothing about human rationing:
 * it reports what the planted layers produce, after their bearing curve and
 * retention losses.  The nutrition layer then allocates that finite harvest.
 */
export function calculatePerennialFoodProductionLedger({
  evidence = null,
  mix = evidence?.mix ?? [],
  curveAnchors = evidence?.curve_anchors?.central ?? {},
  footprintHa = 1,
  years = [1, 2, 3, 5, 8, 10, 15, 'mature'],
  retentionFactor = .70,
  compositionProfiles = {}
} = {}) {
  const sourceRows = evidence?.rows ?? [];
  const rows = mix.map((layer) => ({
    ...((sourceRows.find((candidate) => candidate.id === layer.id)) ?? {}),
    ...layer
  }));
  const retained = Math.max(0, Math.min(1, Number(retentionFactor)));
  return years.map((year) => {
    const layers = rows.map((row) => {
      const functionalClass = row.functional_class ?? row.class;
      const factor = interpolate(curveAnchors[functionalClass] ?? curveAnchors[row.class] ?? {}, year);
      const area = Number(footprintHa) * Number(row.area_share ?? 0);
      const yieldMultiplier = Number(row.site_yield_multiplier ?? 1);
      const matureYieldKg = Number(row.mature_yield_t_ha_year ?? 0) * 1000 * area * yieldMultiplier;
      const grossKg = matureYieldKg * factor;
      const grossEnergy = Number(row.mature_food_gj_ha_year ?? 0) * area * yieldMultiplier * factor;
      const profile = compositionProfiles[row.composition_id] ?? {};
      const macro = profile.macro_per_100g ?? {};
      const perKg = (field, fallback = 0) => {
        const profileValue = Number(macro[`${field}_g_per_100g`]);
        if (Number.isFinite(profileValue)) return profileValue * 10;
        const rowValue = Number(row[`${field}_kg_ha`]);
        return Number.isFinite(rowValue) && area > 0 ? rowValue * 1000 / Math.max(area, 1e-12) : fallback;
      };
      const retainedKg = grossKg * retained;
      const retainedEnergy = grossEnergy * retained;
      const nutrients = Object.fromEntries(Object.entries(profile.nutrients_per_100g ?? {}).filter(([, value]) => value != null).map(([id, value]) => [id, round(retainedKg * Number(value) * 10)]));
      return {
        id: row.id,
        species: row.species,
        composition_id: row.composition_id ?? null,
        functional_class: functionalClass,
        area_ha: round(area),
        bearing_factor: round(factor),
        gross_edible_harvest_kg: round(grossKg),
        retained_edible_harvest_kg: round(retainedKg),
        gross_food_energy_gj_year: round(grossEnergy),
        retained_food_energy_gj_year: round(retainedEnergy),
        protein_kg_year: round(retainedKg * perKg('protein') / 1000),
        fat_kg_year: round(retainedKg * perKg('fat') / 1000),
        carbohydrate_kg_year: round(retainedKg * perKg('carbohydrate') / 1000),
        fibre_kg_year: round(retainedKg * perKg('fibre') / 1000),
        saturated_fat_kg_year: round(retainedKg * perKg('saturated_fat') / 1000),
        linoleic_kg_year: round(retainedKg * perKg('linoleic') / 1000),
        alpha_linolenic_kg_year: round(retainedKg * perKg('alpha_linolenic') / 1000),
        micronutrients: nutrients,
        retention_factor: round(retained),
        loss_kg_year: round(Math.max(0, grossKg - retainedKg)),
        source: row.source ?? null,
        evidence_status: row.canonical_status ?? null
      };
    });
    return {
      year,
      planted_perennial_footprint_ha: round(Number(footprintHa)),
      gross_edible_harvest_kg: round(layers.reduce((sum, row) => sum + row.gross_edible_harvest_kg, 0)),
      retained_edible_harvest_kg: round(layers.reduce((sum, row) => sum + row.retained_edible_harvest_kg, 0)),
      gross_food_energy_gj_year: round(layers.reduce((sum, row) => sum + row.gross_food_energy_gj_year, 0)),
      retained_food_energy_gj_year: round(layers.reduce((sum, row) => sum + row.retained_food_energy_gj_year, 0)),
      protein_kg_year: round(layers.reduce((sum, row) => sum + row.protein_kg_year, 0)),
      fat_kg_year: round(layers.reduce((sum, row) => sum + row.fat_kg_year, 0)),
      carbohydrate_kg_year: round(layers.reduce((sum, row) => sum + row.carbohydrate_kg_year, 0)),
      fibre_kg_year: round(layers.reduce((sum, row) => sum + row.fibre_kg_year, 0)),
      saturated_fat_kg_year: round(layers.reduce((sum, row) => sum + row.saturated_fat_kg_year, 0)),
      linoleic_kg_year: round(layers.reduce((sum, row) => sum + row.linoleic_kg_year, 0)),
      alpha_linolenic_kg_year: round(layers.reduce((sum, row) => sum + row.alpha_linolenic_kg_year, 0)),
      micronutrients: Object.fromEntries([...new Set(layers.flatMap((row) => Object.keys(row.micronutrients ?? {})))].map((id) => [id, round(layers.reduce((sum, row) => sum + Number(row.micronutrients?.[id] ?? 0), 0))])),
      layers,
      retention_rule: 'Gross harvest is reduced by the explicit storage, wildlife and preparation retention factor before it is available to the household ledger.'
    };
  });
}

/** Build the canonical one-hectare mature perennial mix timeline. */
export function calculatePerennialMixTimeline({evidence, years = [1, 5, 10, 'mature'], scenario = 'central'} = {}) {
  const anchors = evidence?.curve_anchors?.[scenario] ?? evidence?.curve_anchors?.central ?? {};
  return calculatePerennialFoodProductionLedger({evidence, curveAnchors: anchors, years, footprintHa: 1}).map((row) => ({
    ...row,
    area_ha: 1,
    productive_area_ha: round(row.layers.reduce((sum, layer) => sum + layer.area_ha * layer.bearing_factor, 0)),
    harvested_food_gj_year: row.gross_food_energy_gj_year,
    layers: row.layers.map((layer) => ({...layer, area_share: layer.area_ha, maturity_factor: layer.bearing_factor, harvested_food_gj_year: layer.gross_food_energy_gj_year}))
  }));
}
