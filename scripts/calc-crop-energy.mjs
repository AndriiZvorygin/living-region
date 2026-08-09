import {pathToFileURL} from 'node:url';
import {readCsv, number, stats, round, writeJson, writeText, writeCsv, ensureDir, svgText, format} from './model-utils.mjs';

const roles = {
  'black walnut': ['fat', 'manual: nut with 80% fat in source nutrient row'],
  'n. hazelnut': ['fat', 'manual: nut with 81% fat in source nutrient row'],
  'pine nut': ['fat', 'manual: nut with 85% fat in source nutrient row'],
  chestnut: ['starch/carbohydrate', 'manual: 89% carbohydrate in source nutrient row'],
  buckwheat: ['starch/carbohydrate', 'manual: grain/starch; 79% carbohydrate in source nutrient row'],
  rye: ['starch/carbohydrate', 'manual: grain/starch; 81% carbohydrate in source nutrient row'],
  wildrice: ['starch/carbohydrate', 'manual: grain/starch; 82% carbohydrate in source nutrient row'],
  'sunflower potato': ['starch/carbohydrate', 'manual: potato/starch; 90% carbohydrate in source nutrient row'],
  cassava: ['starch/carbohydrate', 'manual: root/starch; 97% carbohydrate in source nutrient row'],
  lupine: ['protein/legume', 'manual: legume; 34% protein in source nutrient row'],
  'apios americana': ['protein/legume', 'manual: edible tuber/legume-like staple; 40% protein in source nutrient row'],
  'autumn olive': ['fruit', 'manual: fruit crop in original tree-yield section'],
  grapes: ['fruit', 'manual: fruit crop in original tree-yield section'],
  apples: ['fruit', 'manual: fruit crop in original tree-yield section'],
  'cactus pear': ['fruit', 'manual: fruit crop in original perennial-yield section']
};

function classify(row) {
  const [role, basis] = roles[row.crop_species.toLowerCase()] || ['mixed', 'manual: no stronger classification rule available'];
  return {role, basis};
}

function chart(rows, median) {
  const width = 980;
  const left = 180;
  const plotWidth = 720;
  const top = 45;
  const rowHeight = 27;
  const max = Math.max(...rows.map(row => row.gj), 1);
  const height = top + rows.length * rowHeight + 45;
  const colors = {'starch/carbohydrate': '#4c78a8', fat: '#f58518', 'protein/legume': '#54a24b', fruit: '#e45756', mixed: '#777'};
  const scale = v => left + (v / max) * plotWidth;
  const bars = rows.map((row, i) => {
    const y = top + i * rowHeight;
    const color = colors[row.role] || colors.mixed;
    return `<text x="${left - 8}" y="${y + 16}" text-anchor="end" font-size="12">${svgText(row.name)}</text><rect x="${left}" y="${y + 4}" width="${Math.max(1, scale(row.gj) - left)}" height="18" fill="${color}"/><text x="${scale(row.gj) + 6}" y="${y + 17}" font-size="11">${format(row.gj, 2)} GJ/ha</text>`;
  }).join('');
  const medianX = scale(median);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><text x="20" y="25" font-size="18" font-weight="bold">Historical crop food-energy observations</text><line x1="${medianX}" x2="${medianX}" y1="32" y2="${height - 30}" stroke="#222" stroke-dasharray="5 4"/><text x="${medianX + 5}" y="25" font-size="11">median ${format(median, 2)} GJ/ha</text>${bars}<text x="${left + plotWidth / 2}" y="${height - 8}" text-anchor="middle" font-size="12">Gross harvested food energy (GJ/ha/year as recorded or calculated in source workbook)</text></svg>`;
}

export function buildCropEnergy() {
  const source = readCsv('data/source/crops.csv');
  const rows = source.map((row, index) => {
    const {role, basis} = classify(row);
    return {
      observation_id: index + 1,
      name: row.crop_species,
      original_group: row.crop_group_original,
      gj: number(row.gj_per_ha),
      yield_tonnes_per_ha: number(row.yield_tonnes_per_ha),
      energy_density_kj_per_100g: number(row.energy_density_kj_per_100g),
      carbs_fraction: number(row.carbs_fraction),
      fats_fraction: number(row.fats_fraction),
      protein_fraction: number(row.protein_fraction),
      role,
      classification_basis: basis,
      source_sheet: row.source_sheet,
      source_row: number(row.source_row),
      source_formula_gj_per_ha: row.source_formula_gj_per_ha
    };
  }).filter(row => row.gj !== null);
  const overall = stats(rows.map(row => row.gj));
  const groupNames = [...new Set(rows.map(row => row.role))];
  const groupStats = groupNames.map(group => ({group, ...stats(rows.filter(row => row.role === group).map(row => row.gj))}));
  const derivedRows = [['observation_id','crop_species','crop_group_original','energy_role_manual','gj_per_ha','yield_tonnes_per_ha','energy_density_kj_per_100g','carbs_fraction','fats_fraction','protein_fraction','classification_basis','source_sheet','source_row','source_formula_gj_per_ha'], ...rows.map(row => [row.observation_id,row.name,row.original_group,row.role,row.gj,row.yield_tonnes_per_ha,row.energy_density_kj_per_100g,row.carbs_fraction,row.fats_fraction,row.protein_fraction,row.classification_basis,row.source_sheet,row.source_row,row.source_formula_gj_per_ha])];
  writeCsv('data/derived/crop-energy-observations.csv', derivedRows);
  writeCsv('data/derived/crop-classifications.csv', [['crop_species','energy_role','classification_basis'], ...rows.map(row => [row.name,row.role,row.classification_basis])]);
  writeCsv('outputs/tables/crop-energy-group-stats.csv', [['group','count','min_gj_per_ha','q1_gj_per_ha','median_gj_per_ha','q3_gj_per_ha','max_gj_per_ha','mean_gj_per_ha','standard_deviation','coefficient_of_variation','interquartile_range'], ...groupStats.map(row => [row.group,row.count,row.min,row.q1,row.median,row.q3,row.max,row.mean,row.standard_deviation,row.coefficient_of_variation,row.interquartile_range])]);
  writeJson('data/derived/crop-energy-analysis.json', {overall, groups: groupStats, observations: rows});
  ensureDir('outputs/charts');
  writeText('outputs/charts/crop-energy.svg', chart([...rows].sort((a, b) => b.gj - a.gj), overall.median));

  const largest = rows.reduce((a, b) => a.gj > b.gj ? a : b);
  const smallest = rows.reduce((a, b) => a.gj < b.gj ? a : b);
  const orderMagnitudeRatio = largest.gj / smallest.gj;
  const comparableCore = rows.filter(row => row.gj >= overall.q1 && row.gj <= overall.q3);
  const md = `# Crop-energy analysis

## Result

The extracted workbook provides **${overall.count} usable crop-yield observations** with recorded or formula-derived gross food energy. Values range from **${format(overall.min, 2)} to ${format(overall.max, 2)} GJ/ha**, with a median of **${format(overall.median, 2)} GJ/ha**, mean **${format(overall.mean, 2)} GJ/ha**, standard deviation **${format(overall.standard_deviation, 2)} GJ/ha**, coefficient of variation **${format(overall.coefficient_of_variation * 100, 1)}%**, and IQR **${format(overall.interquartile_range, 2)} GJ/ha**.

The minimum is ${smallest.name}; the maximum is ${largest.name}. The full range is ${format(orderMagnitudeRatio, 1)}×, so the source does **not** support a claim that every crop produces the same energy per hectare. It does support a more limited “same broad order of magnitude” observation for many observations: the middle 50% spans ${format(overall.q1, 2)}–${format(overall.q3, 2)} GJ/ha, while crop composition varies substantially.

The source workbook's groups are retained exactly. The energy_role field is a separate manual classification based primarily on the nutrient composition or crop identity; it is not an original workbook field and does not change the values.

## Overall distribution

| Statistic | GJ/ha |
|---|---:|
| Count | ${overall.count} |
| Minimum | ${format(overall.min, 2)} |
| Q1 | ${format(overall.q1, 2)} |
| Median | ${format(overall.median, 2)} |
| Q3 | ${format(overall.q3, 2)} |
| Maximum | ${format(overall.max, 2)} |
| Mean | ${format(overall.mean, 2)} |
| Standard deviation | ${format(overall.standard_deviation, 2)} |
| CV | ${format(overall.coefficient_of_variation * 100, 1)}% |
| IQR | ${format(overall.interquartile_range, 2)} |

## Manual role groups

| Group | n | Min | Median | Mean | Max |
|---|---:|---:|---:|---:|---:|
${groupStats.map(row => `| ${row.group} | ${row.count} | ${format(row.min, 2)} | ${format(row.median, 2)} | ${format(row.mean, 2)} | ${format(row.max, 2)} |`).join('\n')}

## Interpretation limits

These are workbook estimates, not a controlled agronomic trial. The entries mix trees, fruit, grains, roots and a perennial crop section; the yield horizon, maturity assumptions, harvest losses, storage losses, labour, land quality, climate, water, input intensity and edible fraction are not harmonized. The workbook also records gross food energy rather than a complete human nutrition or dietary-balance model. In particular, energy density is missing for bur oak, amaranth and several rows that have no yield observation, and edible fraction is not supplied as a separate source field.

The source formulas for GJ/ha are retained in data/source/crops.csv. For the rows where the workbook formula is visible, the arithmetic is yield tonnes/ha × 10,000 × kJ/100 g ÷ 1,000,000. This is a gross harvested-energy calculation, not net energy after cultivation, processing or storage.
`;
  writeText('outputs/crop-energy-analysis.md', md);
  return {overall, groups: groupStats, observations: rows};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) buildCropEnergy();
