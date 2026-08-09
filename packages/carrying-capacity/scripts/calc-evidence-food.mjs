import {pathToFileURL} from 'node:url';
import {readCsv, number, stats, round, writeCsv, writeJson} from './model-utils.mjs';

const COMPOSITION = Object.fromEntries(readCsv('data/source/current-food-composition.csv').map(row => [row.food_id, row]));

export function calculateFoodYield(row) {
  const composition = COMPOSITION[row.composition_id];
  if (!composition || number(row.mean_yield_t_ha) === null) return {...row, food_gj_ha: null, protein_kg_ha: null, fat_kg_ha: null, carbohydrate_kg_ha: null};
  const yieldT = number(row.mean_yield_t_ha);
  const edibleYieldT = yieldT * (number(row.usable_fraction) ?? 1);
  const kJ = number(composition.energy_kj_per_100g);
  return {
    ...row,
    edible_yield_t_ha: round(edibleYieldT, 6),
    food_gj_ha: round(edibleYieldT * kJ * 0.01, 6),
    // One tonne contains 10,000 portions of 100 g; divide the resulting grams by 1,000.
    protein_kg_ha: round(edibleYieldT * number(composition.protein_g_per_100g) * 10, 6),
    fat_kg_ha: round(edibleYieldT * number(composition.fat_g_per_100g) * 10, 6),
    carbohydrate_kg_ha: round(edibleYieldT * number(composition.carbohydrate_g_per_100g) * 10, 6),
    energy_density_kj_per_100g: kJ,
    source_composition: composition.source
  };
}

export function calculateFoodEvidence() {
  const sourceRows = readCsv('data/source/evidence-food-yields.csv');
  const rows = sourceRows.map(calculateFoodYield);
  const usable = rows.filter(row => number(row.food_gj_ha) !== null);
  const canonical = usable.filter(row => row.canonical_eligible === 'yes');
  const lowInput = canonical.filter(row => ['near-zero', 'low'].includes(row.input_intensity));
  const byCategory = rows => Object.fromEntries([...new Set(rows.map(row => row.category))].map(category => [category, stats(rows.filter(row => row.category === category).map(row => number(row.food_gj_ha)).filter(v => v !== null))]));
  const result = {
    source: 'data/source/evidence-food-yields.csv + data/source/current-food-composition.csv',
    all_usable_observations: stats(usable.map(row => number(row.food_gj_ha))),
    canonical_eligible_observations: stats(canonical.map(row => number(row.food_gj_ha))),
    low_input_observations: stats(lowInput.map(row => number(row.food_gj_ha))),
    category_stats_low_input: byCategory(lowInput),
    category_stats_canonical: byCategory(canonical),
    rows,
    limitations: [
      'The central low-input rows are explicit modelled syntheses, not a hidden claim that Ontario zero-input yield trials exist.',
      'Commercial Ontario averages remain available as a high-input comparison but are excluded from the low-input central distribution.',
      'No defensible comparable ordinary Grey-Bruce low-input edible yield series was found for chestnut, walnut, apple or carrot; they remain diversity and research-gap rows.',
      'Food-energy statistics are not a complete nutritional sufficiency proof; micronutrients, amino-acid balance, seasonality and labour remain outside this first quantitative pass.'
    ]
  };
  writeJson('data/derived/evidence-food-yields.json', result);
  writeCsv('data/derived/evidence-food-yields.csv', [
    ['id','crop','category','mean_yield_t_ha','edible_yield_t_ha','food_gj_ha','protein_kg_ha','fat_kg_ha','carbohydrate_kg_ha','input_intensity','canonical_eligible','evidence_type','source','notes'],
    ...rows.map(row => [row.id,row.crop,row.category,row.mean_yield_t_ha,row.edible_yield_t_ha,row.food_gj_ha,row.protein_kg_ha,row.fat_kg_ha,row.carbohydrate_kg_ha,row.input_intensity,row.canonical_eligible,row.evidence_type,row.source,row.notes])
  ]);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) calculateFoodEvidence();
