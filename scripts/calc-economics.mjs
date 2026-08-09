import {pathToFileURL} from 'node:url';
import {round, writeCsv, writeJson} from './model-utils.mjs';

export const economicProducts = [
  {id: 'greenhouse_vegetables', product: 'greenhouse vegetables', unit: 'kg', price_cad: 8, variable_cost_cad: 5, source: 'configurable ARC direct-sale scenario', notes: 'Illustrative margin; replace with current Owen Sound farmgate records.'},
  {id: 'seedlings', product: 'seedlings', unit: 'plant', price_cad: 4, variable_cost_cad: 1.5, source: 'configurable ARC direct-sale scenario', notes: 'Illustrative margin; local nursery price survey required.'},
  {id: 'berries', product: 'berries', unit: 'kg', price_cad: 6, variable_cost_cad: 3.5, source: 'configurable ARC direct-sale scenario', notes: 'Illustrative margin; crop, grade and channel vary widely.'},
  {id: 'firewood', product: 'seasoned firewood', unit: 'full cord', price_cad: 250, variable_cost_cad: 150, source: 'configurable ARC direct-sale scenario', notes: 'Illustrative margin; delivery and drying labour are not fully modelled.'},
  {id: 'nursery_stock', product: 'nursery stock', unit: 'plant', price_cad: 25, variable_cost_cad: 14, source: 'configurable ARC direct-sale scenario', notes: 'Illustrative margin; species and size mix are unresolved.'},
  {id: 'organic_wheat', product: 'organic soft red winter wheat', unit: 'bushel', price_cad: 13, variable_cost_cad: 10, source: 'https://datawrapper.dwcdn.net/Oa49e/6/dataset.csv', notes: '2022 OCO spot-price range midpoint; not a current guaranteed price and costs are a configurable placeholder.'}
];

export function calculateEconomicTargets(products = economicProducts, targets = [1000, 2000, 3000, 5000]) {
  return products.map(product => ({...product, net_margin_cad_per_unit: round(product.price_cad - product.variable_cost_cad, 2), required_units_by_target: Object.fromEntries(targets.map(target => [String(target), round(target / (product.price_cad - product.variable_cost_cad), 3)]))}));
}

export function buildEconomics() {
  const output = {status: 'separate illustrative cash-flow module; not biological carrying-capacity evidence', targets_cad_year: [1000,2000,3000,5000], source_notes: ['OMAFRA cost-of-production budgets are planning tools, not guarantees: https://www.ontario.ca/page/guide-cost-production-budgeting', 'OCO grain price data last available in this checked-in source is 2022; local current farmgate/direct-sale data remains required.'], products: calculateEconomicTargets()};
  writeJson('data/derived/economic-output.json', output);
  writeCsv('data/derived/economic-output.csv', [['product','unit','price_cad','variable_cost_cad','net_margin_cad_per_unit','target_1000_units','target_2000_units','target_3000_units','target_5000_units','source','notes'], ...output.products.map(row => [row.product,row.unit,row.price_cad,row.variable_cost_cad,row.net_margin_cad_per_unit,row.required_units_by_target['1000'],row.required_units_by_target['2000'],row.required_units_by_target['3000'],row.required_units_by_target['5000'],row.source,row.notes])]);
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) buildEconomics();
