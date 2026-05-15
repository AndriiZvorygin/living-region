// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    produceDir: 'know/produce',
    qaDir: 'output/qa',
    articleSupportDir: 'output/article-support',
    sourceManifestPath: 'know/source-manifest.json',
    metricRegistryPath: 'know/metric-registry.json',
    scenariosDir: 'know/input/scenarios',
    releaseDir: `output/release/article-data-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`
  };
  for (const arg of argv) {
    if (arg.startsWith('--produce-dir=')) out.produceDir = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--qa-dir=')) out.qaDir = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--article-support-dir=')) out.articleSupportDir = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--source-manifest=')) out.sourceManifestPath = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--metric-registry=')) out.metricRegistryPath = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--scenarios-dir=')) out.scenariosDir = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--release-dir=')) out.releaseDir = arg.split('=').slice(1).join('=');
  }
  return out;
}

function cp(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function sha256File(filePath) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function commitHash() {
  try { return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(); }
  catch { return 'unknown'; }
}

const opts = parseArgs();
const releaseDir = path.resolve(opts.releaseDir);
fs.mkdirSync(releaseDir, { recursive: true });

const requiredFiles = [
  { path: path.join(opts.articleSupportDir, 'grey-food-security-evidence-packet.md'), category: 'article_support', notes: 'Human-readable article evidence packet.' },
  { path: path.join(opts.articleSupportDir, 'grey-food-security-evidence-packet.json'), category: 'article_support', notes: 'Structured article evidence packet.' },
  { path: path.join(opts.qaDir, 'claim-inventory.json'), category: 'qa_evidence_audit', notes: 'Claim-level classification and readiness.' },
  { path: path.join(opts.qaDir, 'claim-inventory.md'), category: 'qa_evidence_audit', notes: 'Claim inventory markdown view.' },
  { path: path.join(opts.qaDir, 'red-team-claims.md'), category: 'qa_evidence_audit', notes: 'Red-team claim review.' },
  { path: path.join(opts.qaDir, 'article-readiness-summary.md'), category: 'qa_evidence_audit', notes: 'Article readiness and caveat summary.' },
  { path: path.join(opts.qaDir, 'local-calibration-readiness-delta.md'), category: 'qa_evidence_audit', notes: 'Calibration readiness delta.' },
  { path: path.join(opts.qaDir, 'local-source-candidates.md'), category: 'qa_evidence_audit', notes: 'Local source candidates inventory.' },
  { path: path.join(opts.qaDir, 'local-source-priority.md'), category: 'qa_evidence_audit', notes: 'Local source priority ranking.' },
  { path: path.join(opts.qaDir, 'gis-source-inventory.md'), category: 'qa_evidence_audit', notes: 'GIS source inventory report.' },
  { path: path.join(opts.qaDir, 'gis-bridge-candidates.md'), category: 'qa_evidence_audit', notes: 'GIS bridge candidates report.' },
  { path: path.join(opts.produceDir, 'local-calibration-summary.md'), category: 'derived_data', notes: 'Local calibration summary markdown.' },
  { path: path.join(opts.produceDir, 'local-calibration-summary.json'), category: 'derived_data', notes: 'Local calibration summary JSON.' },
  { path: path.join(opts.produceDir, 'land-access-groundtruth-summary.md'), category: 'derived_data', notes: 'Land-access groundtruth summary markdown.' },
  { path: path.join(opts.produceDir, 'land-access-groundtruth-summary.json'), category: 'derived_data', notes: 'Land-access groundtruth summary JSON.' },
  { path: path.join(opts.produceDir, 'grey-land-access-gis-overlay-summary.md'), category: 'derived_data', notes: 'Land-access GIS overlay summary markdown.' },
  { path: path.join(opts.produceDir, 'grey-land-access-gis-overlay-summary.json'), category: 'derived_data', notes: 'Land-access GIS overlay summary JSON.' },
  { path: opts.sourceManifestPath, category: 'contracts_sources', notes: 'Source provenance manifest.' },
  { path: opts.metricRegistryPath, category: 'contracts_metrics', notes: 'Metric contract registry.' },
  { path: path.join(opts.scenariosDir, 'baseline.json'), category: 'assumptions_scenarios', notes: 'Baseline scenario assumptions.' },
  { path: path.join(opts.scenariosDir, 'hormuz_shock_low.json'), category: 'assumptions_scenarios', notes: 'Low shock scenario assumptions.' },
  { path: path.join(opts.scenariosDir, 'hormuz_shock_central.json'), category: 'assumptions_scenarios', notes: 'Central shock scenario assumptions.' },
  { path: path.join(opts.scenariosDir, 'hormuz_shock_high.json'), category: 'assumptions_scenarios', notes: 'High shock scenario assumptions.' },
  { path: path.join(opts.qaDir, 'rebuild-summary.json'), category: 'qa_core', notes: 'Rebuild QA summary JSON.' },
  { path: path.join(opts.qaDir, 'rebuild-summary.md'), category: 'qa_core', notes: 'Rebuild QA summary markdown.' }
];

const optionalFiles = [
  { path: path.join(opts.qaDir, 'wording-risk-report.json'), category: 'qa_evidence_audit', notes: 'Wording risk scan output.' },
  { path: path.join(opts.qaDir, 'local-source-candidates.json'), category: 'qa_evidence_audit', notes: 'Local source candidates JSON.' },
  { path: path.join(opts.qaDir, 'gis-source-inventory.json'), category: 'qa_evidence_audit', notes: 'GIS source inventory JSON.' },
  { path: path.join(opts.qaDir, 'gis-bridge-candidates.json'), category: 'qa_evidence_audit', notes: 'GIS bridge candidates JSON.' },
  { path: path.join(opts.produceDir, 'grey-hormuz-food-security-article-data.md'), category: 'derived_data', notes: 'Article data markdown.' },
  { path: path.join(opts.produceDir, 'grey-hormuz-food-security-article-data.json'), category: 'derived_data', notes: 'Article data JSON.' }
];

const failures = [];
const warnings = [];
const copiedEntries = [];

for (const item of requiredFiles) {
  const src = path.resolve(item.path);
  if (!fs.existsSync(src)) {
    failures.push(`Missing required release file: ${item.path}`);
    continue;
  }
  const rel = item.path.replace(/^\.\/?/, '');
  const dst = path.join(releaseDir, rel);
  cp(src, dst);
  copiedEntries.push({
    path: rel,
    category: item.category,
    required_for_article_support: true,
    sha256: sha256File(src),
    notes: item.notes
  });
}

for (const item of optionalFiles) {
  const src = path.resolve(item.path);
  if (!fs.existsSync(src)) {
    warnings.push(`Missing optional release file: ${item.path}`);
    continue;
  }
  const rel = item.path.replace(/^\.\/?/, '');
  const dst = path.join(releaseDir, rel);
  cp(src, dst);
  copiedEntries.push({
    path: rel,
    category: item.category,
    required_for_article_support: false,
    sha256: sha256File(src),
    notes: item.notes
  });
}

const commit = commitHash();
const assumptionsMd = [
  '# Assumptions',
  '',
  'Scenarios are explicit files under `know/input/scenarios/` and are marked `status: scenario_assumption` and `not_forecast: true`.',
  'See included scenario JSON files for value/range/unit/confidence/notes/source_refs.'
].join('\n');
const assumptionsPath = path.join(releaseDir, 'assumptions.md');
fs.writeFileSync(assumptionsPath, assumptionsMd);
copiedEntries.push({
  path: 'assumptions.md',
  category: 'release_metadata',
  required_for_article_support: true,
  sha256: sha256File(assumptionsPath),
  notes: 'Scenario assumptions explainer for release bundle.'
});

const changelogMd = [
  '# Changelog',
  '',
  `- release generated at: ${new Date().toISOString()}`,
  `- commit: ${commit}`,
  '- release includes article-support packet, QA evidence audit artifacts, land-access GIS overlay summary, and calibration summaries.'
].join('\n');
const changelogPath = path.join(releaseDir, 'changelog.md');
fs.writeFileSync(changelogPath, changelogMd);
copiedEntries.push({
  path: 'changelog.md',
  category: 'release_metadata',
  required_for_article_support: true,
  sha256: sha256File(changelogPath),
  notes: 'Release changelog with generation timestamp and commit hash.'
});

const commitPath = path.join(releaseDir, 'commit-hash.txt');
fs.writeFileSync(commitPath, `${commit}\n`);
copiedEntries.push({
  path: 'commit-hash.txt',
  category: 'release_metadata',
  required_for_article_support: true,
  sha256: sha256File(commitPath),
  notes: 'Commit hash for reproducibility trace.'
});

const indexMd = [
  '# Release Bundle Index',
  '',
  '## What this bundle is',
  '- A self-contained article data support bundle with provenance, assumptions, QA, and caveats.',
  '- Calculations are not recomputed here; this package collects validated outputs.',
  '',
  '## Public article support files',
  '- `output/article-support/grey-food-security-evidence-packet.md`',
  '- `output/article-support/grey-food-security-evidence-packet.json`',
  '',
  '## QA and evidence audit files',
  '- `output/qa/claim-inventory.json` / `.md`',
  '- `output/qa/red-team-claims.md`',
  '- `output/qa/article-readiness-summary.md`',
  '- `output/qa/rebuild-summary.json` / `.md`',
  '- `output/qa/local-calibration-readiness-delta.md`',
  '- `output/qa/local-source-candidates.md`',
  '- `output/qa/local-source-priority.md`',
  '- `output/qa/gis-source-inventory.md`',
  '- `output/qa/gis-bridge-candidates.md`',
  '',
  '## Raw/derived data highlights',
  '- `know/produce/local-calibration-summary.md` / `.json`',
  '- `know/produce/land-access-groundtruth-summary.md` / `.json`',
  '- `know/produce/grey-land-access-gis-overlay-summary.md` / `.json`',
  '',
  '## Assumptions and scenarios',
  '- `know/source-manifest.json`',
  '- `know/metric-registry.json`',
  '- `know/input/scenarios/*.json`',
  '- `assumptions.md`',
  '',
  '## Current caveat status',
  '- Land access: partial_groundtruth lot-fabric overlay, not household-level parcel-address-building proof.',
  '- Scenario outputs: trend/shock values are scenario diagnostics, not forecasts.',
  '- Worker estimates: planning-scale scenario outputs with explicit assumptions.',
  '',
  '## Release metadata',
  '- `release-manifest.json` contains file-level hashes and categories.',
  '- `commit-hash.txt` records the source commit used for this bundle.'
].join('\n');
const indexPath = path.join(releaseDir, 'INDEX.md');
fs.writeFileSync(indexPath, indexMd);
copiedEntries.push({
  path: 'INDEX.md',
  category: 'release_metadata',
  required_for_article_support: true,
  sha256: sha256File(indexPath),
  notes: 'Human-readable map of release bundle contents and caveat status.'
});

const releaseManifest = {
  generated_at: new Date().toISOString(),
  release_dir: releaseDir,
  commit_hash: commit,
  status: failures.length ? 'fail' : 'pass',
  warnings,
  files: copiedEntries
};
const manifestPath = path.join(releaseDir, 'release-manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(releaseManifest, null, 2));

console.log(`release dir: ${releaseDir}`);
console.log(`files copied: ${copiedEntries.length}`);
if (warnings.length) {
  console.warn(`warnings: ${warnings.length}`);
  for (const w of warnings) console.warn(`- ${w}`);
}
if (failures.length) {
  console.error('release bundle failed completeness check');
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}
