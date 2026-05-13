// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    produceDir: 'know/produce',
    qaDir: 'output/qa',
    releaseDir: `output/release/article-data-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`
  };
  for (const arg of argv) {
    if (arg.startsWith('--produce-dir=')) out.produceDir = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--qa-dir=')) out.qaDir = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--release-dir=')) out.releaseDir = arg.split('=').slice(1).join('=');
  }
  return out;
}

function cp(src, dst) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  return true;
}

function commitHash() {
  try { return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(); }
  catch { return 'unknown'; }
}

const opts = parseArgs();
const releaseDir = path.resolve(opts.releaseDir);
fs.mkdirSync(releaseDir, { recursive: true });

const files = [
  'know/source-manifest.json',
  'know/metric-registry.json',
  'know/input/scenarios/baseline.json',
  'know/input/scenarios/hormuz_shock_low.json',
  'know/input/scenarios/hormuz_shock_central.json',
  'know/input/scenarios/hormuz_shock_high.json',
  path.join(opts.qaDir, 'rebuild-summary.json'),
  path.join(opts.qaDir, 'rebuild-summary.md'),
  path.join(opts.produceDir, 'grey-hormuz-food-security-article-data.json'),
  path.join(opts.produceDir, 'grey-hormuz-food-security-article-data.md'),
  path.join(opts.produceDir, 'grey-food-insecurity-trend-projection.json'),
  path.join(opts.produceDir, 'grey-food-gap-replacement.json'),
  path.join(opts.produceDir, 'grey-food-supply-demand-price.json')
];

const copied = [];
for (const f of files) {
  const src = path.resolve(f);
  const dst = path.join(releaseDir, f.replace(/^\.?\/?/, ''));
  if (cp(src, dst)) copied.push(f);
}

const assumptionsMd = [
  '# Assumptions',
  '',
  'Scenarios are explicit files under `know/input/scenarios/` and are marked `status: scenario_assumption` and `not_forecast: true`.',
  'See included scenario JSON files for value/range/unit/confidence/notes/source_refs.'
].join('\n');
fs.writeFileSync(path.join(releaseDir, 'assumptions.md'), assumptionsMd);

const changelogMd = [
  '# Changelog',
  '',
  `- release generated at: ${new Date().toISOString()}`,
  `- commit: ${commitHash()}`,
  '- reliability spine bundle generated for article-data use.'
].join('\n');
fs.writeFileSync(path.join(releaseDir, 'changelog.md'), changelogMd);

console.log(`release dir: ${releaseDir}`);
console.log(`files copied: ${copied.length}`);
