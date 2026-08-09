import {pathToFileURL} from 'node:url';
import {readCsv, number, mean, round, writeJson, writeText, writeCsv, format, svgText} from './model-utils.mjs';

function pearson(xs, ys) {
  const xbar = mean(xs); const ybar = mean(ys);
  const numerator = xs.reduce((s, x, i) => s + (x - xbar) * (ys[i] - ybar), 0);
  const denominator = Math.sqrt(xs.reduce((s, x) => s + (x - xbar) ** 2, 0) * ys.reduce((s, y) => s + (y - ybar) ** 2, 0));
  return denominator ? numerator / denominator : null;
}

function parseClass(label) {
  const n = Number(label.match(/[0-9]+(?:\.[0-9]+)?/)?.[0]);
  return Number.isFinite(n) ? n : null;
}

function chart(rows, cleaned = false) {
  const width = 980, height = 540, left = 80, right = 35, top = 55, bottom = 100;
  const plotW = width - left - right, plotH = height - top - bottom;
  const y = value => top + plotH - (value / 1.5) * plotH;
  const x = i => left + (i + 0.5) * plotW / rows.length;
  const labels = rows.map((row, i) => `<text x="${x(i)}" y="${height - bottom + 24}" text-anchor="middle" font-size="12" transform="rotate(-35 ${x(i)} ${height - bottom + 24})">${svgText(cleaned ? row.label.replace('≤ ', '') + ' ha' : row.label)}</text>`).join('');
  const grid = [0, .5, 1, 1.5].map(v => `<line x1="${left}" x2="${width-right}" y1="${y(v)}" y2="${y(v)}" stroke="#ddd"/><text x="${left - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11">${v.toFixed(1)}</text>`).join('');
  const line = (key, color) => `<polyline fill="none" stroke="${color}" stroke-width="3" points="${rows.map((row, i) => `${x(i)},${y(row[key])}`).join(' ')}"/>${rows.map((row, i) => `<circle cx="${x(i)}" cy="${y(row[key])}" r="4" fill="${color}"/>`).join('')}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><text x="25" y="28" font-size="18" font-weight="bold">${cleaned ? 'Farm-size relative output (cleaned labels)' : 'Reconstruction of historical Farm_size_to_yield chart'}</text>${grid}${line('crop_return', '#4c78a8')}${line('food_return', '#e45756')}${labels}<line x1="${width-220}" x2="${width-190}" y1="32" y2="32" stroke="#4c78a8" stroke-width="3"/><text x="${width-180}" y="36" font-size="12">crop output / land</text><line x1="${width-220}" x2="${width-190}" y1="52" y2="52" stroke="#e45756" stroke-width="3"/><text x="${width-180}" y="56" font-size="12">food output / land</text><text x="${width/2}" y="${height-12}" text-anchor="middle" font-size="12">Farm-size class upper bound (hectares)</text><text x="18" y="${height/2}" text-anchor="middle" font-size="12" transform="rotate(-90 18 ${height/2})">Relative output (share / land share)</text></svg>`;
}

export function buildFarmSize() {
  const source = readCsv('data/source/farm-size-yield.csv');
  const rows = source.map(row => ({
    label: row.farm_size_class,
    upper_bound_ha: parseClass(row.farm_size_class),
    land_share_percent: number(row.land_share_percent),
    crop_share_percent: number(row.crop_share_percent),
    food_crop_share_percent: number(row.food_crop_share_percent),
    crop_return: number(row.return_on_land_food),
    food_return: number(row.return_on_land_food_and_crop)
  }));
  const classes = rows.filter(row => row.label !== 'all size' && row.upper_bound_ha !== null);
  const correlation = {
    crop_return_vs_upper_bound: pearson(classes.map(row => Math.log10(row.upper_bound_ha)), classes.map(row => row.crop_return)),
    food_return_vs_upper_bound: pearson(classes.map(row => Math.log10(row.upper_bound_ha)), classes.map(row => row.food_return))
  };
  writeCsv('data/derived/farm-size-relative-output.csv', [['farm_size_class','upper_bound_ha','land_share_percent','crop_share_percent','food_crop_share_percent','crop_output_relative_to_land','food_output_relative_to_land'], ...rows.map(row => [row.label,row.upper_bound_ha,row.land_share_percent,row.crop_share_percent,row.food_crop_share_percent,row.crop_return,row.food_return])]);
  writeJson('data/derived/farm-size-analysis.json', {source_url: 'https://ourworldindata.org/farm-size', rows, classes, correlation});
  writeText('outputs/charts/farm-size-original-reconstructed.svg', chart(classes));
  writeText('outputs/charts/farm-size-cleaned.svg', chart(classes, true));
  const md = `# Farm-size/productivity analysis

## Reconstruction

` + '`Farm_size_to_yield.ods`' + ` contains ten size classes labelled ` + '`<= 1`' + ` through ` + '`<= 1000`' + ` and an ` + '`all size`' + ` aggregate. The sheet records the share of land, share of crop land and share of food crop land, then calculates two ratios. The formula in the source is ` + '`[.C2]/[.B2]`' + ` for crop output relative to land and ` + '`[.D2]/[.B2]`' + ` for food-crop output relative to land, copied down each row. The embedded chart source is [Our World in Data's farm-size page](https://ourworldindata.org/farm-size).

| Size class | Land share | Crop share | Food-crop share | Crop/land | Food-crop/land |
|---|---:|---:|---:|---:|---:|
${rows.map(row => `| ${row.label} | ${format(row.land_share_percent, 0)}% | ${format(row.crop_share_percent, 0)}% | ${format(row.food_crop_share_percent, 0)}% | ${format(row.crop_return, 2)} | ${format(row.food_return, 2)} |`).join('\n')}

## Interpretation

Across the ten size classes, the correlation between log upper-size-bound and output/land ratio is ${format(correlation.crop_return_vs_upper_bound, 2)} for crop output and ${format(correlation.food_return_vs_upper_bound, 2)} for food-crop output. The small classes generally have higher ratios, but the pattern is not monotonic: the ` + '`<= 200`' + ` class rises again to 1.18 for food-crop output, for example. This supports a descriptive association in this constructed dataset, not a causal claim that smaller farms inherently produce more food per hectare.

Important caveats: the sheet does not document the exact OWID extraction date, definitions behind “crop” versus “food crop,” farm-type mix, regional composition, input intensity or whether classes are cumulative thresholds or bins. The all-size row is an aggregate and is not treated as an additional class in the correlation. This result should not be used as a universal productivity coefficient without rebuilding the underlying OWID query and checking the original metadata.
`;
  writeText('outputs/farm-size-analysis.md', md);
  return {rows, classes, correlation};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) buildFarmSize();
