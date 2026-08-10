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

/** Build the canonical one-hectare mature perennial mix timeline. */
export function calculatePerennialMixTimeline({evidence, years = [1, 5, 10, 'mature'], scenario = 'central'} = {}) {
  const rows = evidence?.rows ?? [];
  const mix = evidence?.mix ?? [];
  const anchors = evidence?.curve_anchors?.[scenario] ?? evidence?.curve_anchors?.central ?? {};
  return years.map((year) => {
    const layers = mix.map((layer) => {
      const row = rows.find((candidate) => candidate.id === layer.id) ?? layer;
      const factor = interpolate(anchors[layer.class], year);
      return {id: layer.id, species: row.species, area_share: Number(layer.area_share), maturity_factor: round(factor), harvested_food_gj_year: round(Number(row.mature_food_gj_ha_year ?? 0) * Number(layer.area_share) * factor)};
    });
    return {year, area_ha: 1, productive_area_ha: round(layers.reduce((sum, layer) => sum + layer.area_share * layer.maturity_factor, 0)), harvested_food_gj_year: round(layers.reduce((sum, layer) => sum + layer.harvested_food_gj_year, 0)), layers};
  });
}
