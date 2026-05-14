// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { validateSourceManifest } from '../program/reliability/source_manifest.mjs';
import { loadScenarioFiles } from '../program/reliability/scenario_contract.mjs';
import { validateMetricContract } from '../program/reliability/metric_contract.mjs';
import { runInvariantChecks } from '../program/reliability/invariants.mjs';
import { buildEvidenceQualityAudit } from '../program/reliability/evidence_quality_audit.mjs';

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    produceDir: 'know/produce',
    qaDir: 'output/qa',
    manifestPath: 'know/source-manifest.json',
    scenariosDir: 'know/input/scenarios',
    metricRegistryPath: 'know/metric-registry.json',
    articleReportPath: 'know/produce/grey-hormuz-food-security-article-data.json'
  };
  for (const arg of argv) {
    if (arg.startsWith('--produce-dir=')) out.produceDir = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--qa-dir=')) out.qaDir = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--manifest=')) out.manifestPath = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--scenarios-dir=')) out.scenariosDir = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--metric-registry=')) out.metricRegistryPath = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--article-report=')) out.articleReportPath = arg.split('=').slice(1).join('=');
  }
  return out;
}

function tryCommitHash() {
  try { return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(); }
  catch { return null; }
}

const opts = parseArgs();
const qaDir = path.resolve(opts.qaDir);
fs.mkdirSync(qaDir, { recursive: true });

const source = validateSourceManifest({ manifestPath: opts.manifestPath });
const scenarios = loadScenarioFiles({ scenariosDir: opts.scenariosDir });
const metric = validateMetricContract({ registryPath: opts.metricRegistryPath, reportPath: opts.articleReportPath, scenariosDir: opts.scenariosDir });
const invariants = runInvariantChecks({ produceDir: opts.produceDir });
const evidence = buildEvidenceQualityAudit({
  produceDir: opts.produceDir,
  qaDir,
  metricRegistryPath: opts.metricRegistryPath,
  sourceManifestPath: opts.manifestPath
});

const status = [source.status, scenarios.status, metric.status, invariants.status, evidence.status].every((s) => s === 'pass') ? 'pass' : 'fail';

const summary = {
  status,
  generated_at: new Date().toISOString(),
  commit_hash: tryCommitHash(),
  sources_checked: source.checked ?? 0,
  sources_changed: source.changed ?? 0,
  schema_failures: [...(source.failures ?? []), ...(scenarios.failures ?? [])],
  scenario_failures: scenarios.failures ?? [],
  metric_contract_failures: metric.failures ?? [],
  invariant_failures: invariants.failures ?? [],
  evidence_failures: evidence.failures ?? [],
  reports_built: [
    path.resolve(opts.produceDir, 'grey-current-system-shock-threshold.json'),
    path.resolve(opts.produceDir, 'grey-food-gap-replacement.json'),
    path.resolve(opts.produceDir, 'grey-food-supply-demand-price.json'),
    path.resolve(opts.produceDir, 'grey-food-insecurity-trend-projection.json'),
    path.resolve(opts.produceDir, 'grey-hormuz-food-security-article-data.json')
  ].filter((p) => fs.existsSync(p)),
  warnings: [
    ...(source.warnings ?? []),
    ...(scenarios.warnings ?? []),
    ...(metric.warnings ?? []),
    ...(invariants.warnings ?? []),
    ...(evidence.warnings ?? [])
  ],
  details: {
    source,
    scenarios: { status: scenarios.status, checked: scenarios.scenarios.length },
    metric,
    invariants,
    evidence
  }
};

const jsonPath = path.join(qaDir, 'rebuild-summary.json');
const mdPath = path.join(qaDir, 'rebuild-summary.md');
fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));

const md = [
  '# Rebuild QA Summary',
  '',
  `- status: ${summary.status}`,
  `- generated_at: ${summary.generated_at}`,
  `- commit_hash: ${summary.commit_hash ?? 'unknown'}`,
  `- sources_checked: ${summary.sources_checked}`,
  `- sources_changed: ${summary.sources_changed}`,
  `- schema_failures: ${summary.schema_failures.length}`,
  `- scenario_failures: ${summary.scenario_failures.length}`,
  `- metric_contract_failures: ${summary.metric_contract_failures.length}`,
  `- invariant_failures: ${summary.invariant_failures.length}`,
  `- evidence_failures: ${summary.evidence_failures.length}`,
  `- reports_built: ${summary.reports_built.length}`,
  `- warnings: ${summary.warnings.length}`,
  '',
  '## Failures',
  ...[
    ...summary.schema_failures,
    ...summary.scenario_failures,
    ...summary.metric_contract_failures,
    ...summary.invariant_failures,
    ...summary.evidence_failures
  ].map((f) => `- ${f}`),
  '',
  '## Warnings',
  ...(summary.warnings.length ? summary.warnings.map((w) => `- ${w}`) : ['- none'])
].join('\n');

fs.writeFileSync(mdPath, md);

console.log(`qa status: ${summary.status}`);
console.log(`qa json: ${jsonPath}`);
console.log(`qa markdown: ${mdPath}`);
if (summary.status !== 'pass') process.exit(1);
