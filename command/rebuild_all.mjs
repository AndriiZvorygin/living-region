// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { buildGreyPopulationDistributionReport } from '../program/report/grey_population_distribution_report.mjs';
import { buildGreyDwellingLandAccessReport } from '../program/report/grey_dwelling_land_access_report.mjs';
import { buildGreyAgLabourBaselineReport } from '../program/report/grey_ag_labour_baseline_report.mjs';
import { buildGreyFoodSystemCalibration } from '../program/report/grey_food_system_calibration.mjs';
import { buildGreyCurrentSystemShockThresholdReport } from '../program/report/grey_current_system_shock_threshold_report.mjs';
import { buildGreyFoodGapReplacementReport } from '../program/report/grey_food_gap_replacement_report.mjs';
import { buildGreyFoodSupplyDemandPriceReport } from '../program/report/grey_food_supply_demand_price_report.mjs';
import { buildGreyFoodInsecurityTrendProjectionReport } from '../program/report/grey_food_insecurity_trend_projection_report.mjs';
import { buildGreyHormuzFoodSecurityArticleDataReport } from '../program/report/grey_hormuz_food_security_article_data_report.mjs';
import { validateSourceManifest } from '../program/reliability/source_manifest.mjs';
import { loadScenarioFiles } from '../program/reliability/scenario_contract.mjs';
import { validateMetricContract } from '../program/reliability/metric_contract.mjs';
import { runInvariantChecks } from '../program/reliability/invariants.mjs';

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    produceDir: 'output/rebuild/produce',
    qaDir: 'output/qa',
    inputDir: 'know/input/gis',
    manifestPath: 'know/source-manifest.json',
    scenariosDir: 'know/input/scenarios',
    metricRegistryPath: 'know/metric-registry.json'
  };
  for (const arg of argv) {
    if (arg.startsWith('--produce-dir=')) out.produceDir = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--qa-dir=')) out.qaDir = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--input-dir=')) out.inputDir = arg.split('=').slice(1).join('=');
  }
  return out;
}

const opts = parseArgs();
const produceDir = path.resolve(opts.produceDir);
const qaDir = path.resolve(opts.qaDir);
fs.rmSync(produceDir, { recursive: true, force: true });
fs.mkdirSync(produceDir, { recursive: true });
fs.mkdirSync(qaDir, { recursive: true });

const source = validateSourceManifest({ manifestPath: opts.manifestPath });
if (source.status !== 'pass') {
  console.error('source manifest validation failed');
  console.error(source.failures.join('\n'));
  process.exit(1);
}
const scenarios = loadScenarioFiles({ scenariosDir: opts.scenariosDir });
if (scenarios.status !== 'pass') {
  console.error('scenario validation failed');
  console.error(scenarios.failures.join('\n'));
  process.exit(1);
}

const built = [];
const inputDir = path.resolve(opts.inputDir);

buildGreyPopulationDistributionReport({ produceDir, inputDir });
built.push('grey-population-distribution');
buildGreyDwellingLandAccessReport({ produceDir, inputDir });
built.push('grey-dwelling-land-access');
buildGreyAgLabourBaselineReport({ produceDir });
built.push('grey-ag-labour-baseline');
buildGreyFoodSystemCalibration({ produceDir });
built.push('grey-food-calibration');
buildGreyCurrentSystemShockThresholdReport({ produceDir, scenariosDir: opts.scenariosDir });
built.push('grey-current-system-shock-threshold');
buildGreyFoodGapReplacementReport({ produceDir });
built.push('grey-food-gap-replacement');
buildGreyFoodSupplyDemandPriceReport({ produceDir });
built.push('grey-food-supply-demand-price');
buildGreyFoodInsecurityTrendProjectionReport({ produceDir });
built.push('grey-food-insecurity-trend-projection');
buildGreyHormuzFoodSecurityArticleDataReport({ produceDir });
built.push('grey-hormuz-food-security-article-data');

const metric = validateMetricContract({
  registryPath: opts.metricRegistryPath,
  reportPath: path.join(produceDir, 'grey-hormuz-food-security-article-data.json')
});
const invariants = runInvariantChecks({ produceDir });

const status = metric.status === 'pass' && invariants.status === 'pass' ? 'pass' : 'fail';
const summary = {
  status,
  generated_at: new Date().toISOString(),
  sources_checked: source.checked,
  sources_changed: source.changed,
  schema_failures: [],
  scenario_failures: scenarios.failures,
  metric_contract_failures: metric.failures,
  invariant_failures: invariants.failures,
  reports_built: built,
  warnings: [...(source.warnings ?? []), ...(scenarios.warnings ?? []), ...(metric.warnings ?? []), ...(invariants.warnings ?? [])]
};

const jsonPath = path.join(qaDir, 'rebuild-summary.json');
const mdPath = path.join(qaDir, 'rebuild-summary.md');
fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
fs.writeFileSync(mdPath, [
  '# Rebuild Summary',
  '',
  `- status: ${summary.status}`,
  `- reports built: ${summary.reports_built.length}`,
  `- metric failures: ${summary.metric_contract_failures.length}`,
  `- invariant failures: ${summary.invariant_failures.length}`,
  '',
  '## Reports built',
  ...summary.reports_built.map((x) => `- ${x}`),
  '',
  '## Failures',
  ...[...summary.metric_contract_failures, ...summary.invariant_failures].map((f) => `- ${f}`),
  '',
  '## Warnings',
  ...(summary.warnings.length ? summary.warnings.map((w) => `- ${w}`) : ['- none'])
].join('\n'));

console.log(`rebuild status: ${status}`);
console.log(`produce dir: ${produceDir}`);
console.log(`qa json: ${jsonPath}`);
console.log(`qa markdown: ${mdPath}`);
if (status !== 'pass') process.exit(1);
