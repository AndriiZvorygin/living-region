import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { buildEvidenceQualityAudit } from '../program/reliability/evidence_quality_audit.mjs';

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

describe('evidence quality audit', () => {
  test('generated-only source chain cannot become article_grade and scenario claims carry caveat', () => {
    const root = path.resolve('know/produce/evidence-audit-fixture');
    const produceDir = path.join(root, 'produce');
    const qaDir = path.join(root, 'qa');
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(produceDir, { recursive: true });

    writeJson(path.join(root, 'source-manifest.json'), {
      entries: [{ source_id: 's1', source_class: 'manual_curated_input', local_path: 'know/input-example/calibration/population.csv', content_hash: 'sha256:x', schema_version: '1.0', title: 'x' }]
    });
    writeJson(path.join(root, 'metric-registry.json'), {
      metrics: [{ metric_id: 'm1', allowed_statuses: ['scenario_output'], requires_method: true, requires_range: false, requires_confidence: true, requires_not_forecast_flag: true, requires_scenario_refs: true }]
    });

    writeJson(path.join(produceDir, 'grey-hormuz-food-security-article-data.json'), {
      sourceFiles: {},
      articleHeadlineFacts: ['This indicates trend-extension estimate under this assumption.'],
      headlineMetrics: [{
        metric_id: 'm1', label: 'm1', value: 1, unit: 'people', status: 'scenario_output', method: 'x', confidence: 'low', source_refs: [path.join(produceDir, 'generated.json')], scenario_refs: ['hormuz_shock_low'], not_forecast: true
      }]
    });
    writeJson(path.join(produceDir, 'grey-hormuz-food-security-article-data.md'), '# A\n- trend-extension estimate\n');
    writeJson(path.join(produceDir, 'grey-food-insecurity-trend-projection.md'), '# B\n');
    writeJson(path.join(produceDir, 'grey-current-system-shock-threshold.md'), '# C\n');
    writeJson(path.join(produceDir, 'grey-plain-english-briefing.md'), '# D\n');

    const out = buildEvidenceQualityAudit({
      produceDir,
      qaDir,
      metricRegistryPath: path.join(root, 'metric-registry.json'),
      sourceManifestPath: path.join(root, 'source-manifest.json')
    });

    expect(out.status).toBe('pass');
    const inv = JSON.parse(fs.readFileSync(path.join(qaDir, 'claim-inventory.json'), 'utf8'));
    const metricClaim = inv.claims.find((c) => c.claim_id === 'metric:m1');
    expect(metricClaim.public_use).not.toBe('article_grade');
    expect(metricClaim.caveat.toLowerCase()).toContain('not a forecast');

    fs.rmSync(root, { recursive: true, force: true });
  });

  test('risky wording is detected and headline metric inventory coverage exists', () => {
    const root = path.resolve('know/produce/evidence-audit-wording-fixture');
    const produceDir = path.join(root, 'produce');
    const qaDir = path.join(root, 'qa');
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(produceDir, { recursive: true });

    writeJson(path.join(root, 'source-manifest.json'), { entries: [] });
    writeJson(path.join(root, 'metric-registry.json'), {
      metrics: [{ metric_id: 'm2', allowed_statuses: ['proxy'], requires_method: true, requires_range: false, requires_confidence: true, requires_not_forecast_flag: false, requires_scenario_refs: false }]
    });

    writeJson(path.join(produceDir, 'grey-hormuz-food-security-article-data.json'), {
      sourceFiles: {},
      articleHeadlineFacts: ['This demonstrates that something will rise.'],
      headlineMetrics: [{ metric_id: 'm2', label: 'm2', value: 2, unit: 'people', status: 'proxy', method: 'x', confidence: 'low', source_refs: ['know/input-example/calibration/population.csv'], scenario_refs: [] }]
    });
    fs.writeFileSync(path.join(produceDir, 'grey-hormuz-food-security-article-data.md'), '# X\n- will rise\n');
    fs.writeFileSync(path.join(produceDir, 'grey-food-insecurity-trend-projection.md'), '# Y\n');
    fs.writeFileSync(path.join(produceDir, 'grey-current-system-shock-threshold.md'), '# Z\n');
    fs.writeFileSync(path.join(produceDir, 'grey-plain-english-briefing.md'), '# Q\n');

    const out = buildEvidenceQualityAudit({
      produceDir,
      qaDir,
      metricRegistryPath: path.join(root, 'metric-registry.json'),
      sourceManifestPath: path.join(root, 'source-manifest.json')
    });

    expect(out.warnings.length).toBeGreaterThan(0);
    const inventory = JSON.parse(fs.readFileSync(path.join(qaDir, 'claim-inventory.json'), 'utf8'));
    expect(inventory.claims.some((c) => c.claim_id === 'metric:m2')).toBe(true);

    fs.rmSync(root, { recursive: true, force: true });
  });
});
