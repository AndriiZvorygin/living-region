import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function writeJson(filePath, data) {
  write(filePath, JSON.stringify(data, null, 2));
}

function makeRequiredFixture(root) {
  const produceDir = path.join(root, 'produce');
  const qaDir = path.join(root, 'qa');
  const articleSupportDir = path.join(root, 'article-support');
  const scenarioDir = path.join(root, 'scenarios');
  const metaDir = path.join(root, 'meta');

  write(path.join(articleSupportDir, 'grey-food-security-evidence-packet.md'), '# packet');
  writeJson(path.join(articleSupportDir, 'grey-food-security-evidence-packet.json'), { ok: true });

  writeJson(path.join(qaDir, 'claim-inventory.json'), { claims: [] });
  write(path.join(qaDir, 'claim-inventory.md'), '# claims');
  write(path.join(qaDir, 'red-team-claims.md'), '# red');
  write(path.join(qaDir, 'article-readiness-summary.md'), '# ready');
  write(path.join(qaDir, 'local-calibration-readiness-delta.md'), '# delta');
  write(path.join(qaDir, 'local-source-candidates.md'), '# candidates');
  write(path.join(qaDir, 'local-source-priority.md'), '# priority');
  write(path.join(qaDir, 'gis-source-inventory.md'), '# gis inv');
  write(path.join(qaDir, 'gis-bridge-candidates.md'), '# gis bridge');
  writeJson(path.join(qaDir, 'rebuild-summary.json'), { status: 'pass' });
  write(path.join(qaDir, 'rebuild-summary.md'), '# rebuild');

  write(path.join(produceDir, 'local-calibration-summary.md'), '# local cal');
  writeJson(path.join(produceDir, 'local-calibration-summary.json'), { ok: true });
  write(path.join(produceDir, 'land-access-groundtruth-summary.md'), '# land gt');
  writeJson(path.join(produceDir, 'land-access-groundtruth-summary.json'), { landAccessGroundtruthStatus: 'partial_groundtruth' });
  write(path.join(produceDir, 'grey-land-access-gis-overlay-summary.md'), '# overlay');
  writeJson(path.join(produceDir, 'grey-land-access-gis-overlay-summary.json'), { lotFabricFeatureCount: 10 });

  writeJson(path.join(metaDir, 'source-manifest.json'), { entries: [] });
  writeJson(path.join(metaDir, 'metric-registry.json'), { metrics: [] });

  writeJson(path.join(scenarioDir, 'baseline.json'), { scenario_id: 'baseline' });
  writeJson(path.join(scenarioDir, 'hormuz_shock_low.json'), { scenario_id: 'hormuz_shock_low' });
  writeJson(path.join(scenarioDir, 'hormuz_shock_central.json'), { scenario_id: 'hormuz_shock_central' });
  writeJson(path.join(scenarioDir, 'hormuz_shock_high.json'), { scenario_id: 'hormuz_shock_high' });

  return { produceDir, qaDir, articleSupportDir, scenarioDir, metaDir };
}

describe('release article data bundle', () => {
  test('release includes article support packet, QA outputs, overlay summaries, INDEX and release-manifest', () => {
    const root = path.resolve('know/produce/release-bundle-fixture');
    fs.rmSync(root, { recursive: true, force: true });
    const { produceDir, qaDir, articleSupportDir, scenarioDir, metaDir } = makeRequiredFixture(root);
    const releaseDir = path.join(root, 'release');

    const run = spawnSync('node', [
      'command/release_article_data.mjs',
      `--produce-dir=${produceDir}`,
      `--qa-dir=${qaDir}`,
      `--article-support-dir=${articleSupportDir}`,
      `--source-manifest=${path.join(metaDir, 'source-manifest.json')}`,
      `--metric-registry=${path.join(metaDir, 'metric-registry.json')}`,
      `--scenarios-dir=${scenarioDir}`,
      `--release-dir=${releaseDir}`
    ], { encoding: 'utf8' });
    expect(run.status).toBe(0);

    const indexPath = path.join(releaseDir, 'INDEX.md');
    const manifestPath = path.join(releaseDir, 'release-manifest.json');
    expect(fs.existsSync(indexPath)).toBe(true);
    expect(fs.existsSync(manifestPath)).toBe(true);

    const index = fs.readFileSync(indexPath, 'utf8');
    expect(index).toContain('grey-food-security-evidence-packet.md');
    expect(index).toContain('claim-inventory.json');
    expect(index).toContain('partial_groundtruth');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const files = manifest.files.map((f) => f.path);
    expect(files.some((p) => p.endsWith('grey-food-security-evidence-packet.json'))).toBe(true);
    expect(files.some((p) => p.endsWith('claim-inventory.json'))).toBe(true);
    expect(files.some((p) => p.endsWith('land-access-groundtruth-summary.json'))).toBe(true);
    expect(files.some((p) => p.endsWith('grey-land-access-gis-overlay-summary.json'))).toBe(true);
    expect(manifest.files.every((f) => typeof f.sha256 === 'string' && f.sha256.startsWith('sha256:'))).toBe(true);

    fs.rmSync(root, { recursive: true, force: true });
  });

  test('missing required article-support packet fails release', () => {
    const root = path.resolve('know/produce/release-bundle-fixture-missing');
    fs.rmSync(root, { recursive: true, force: true });
    const { produceDir, qaDir, articleSupportDir, scenarioDir, metaDir } = makeRequiredFixture(root);
    const releaseDir = path.join(root, 'release');

    fs.rmSync(path.join(articleSupportDir, 'grey-food-security-evidence-packet.json'), { force: true });

    const run = spawnSync('node', [
      'command/release_article_data.mjs',
      `--produce-dir=${produceDir}`,
      `--qa-dir=${qaDir}`,
      `--article-support-dir=${articleSupportDir}`,
      `--source-manifest=${path.join(metaDir, 'source-manifest.json')}`,
      `--metric-registry=${path.join(metaDir, 'metric-registry.json')}`,
      `--scenarios-dir=${scenarioDir}`,
      `--release-dir=${releaseDir}`
    ], { encoding: 'utf8' });

    expect(run.status).not.toBe(0);
    expect((run.stderr + run.stdout).includes('Missing required release file')).toBe(true);
    fs.rmSync(root, { recursive: true, force: true });
  });
});
