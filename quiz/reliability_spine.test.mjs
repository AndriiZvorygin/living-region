import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { validateSourceManifest } from '../program/reliability/source_manifest.mjs';
import { loadScenarioFiles } from '../program/reliability/scenario_contract.mjs';
import { validateMetricContract } from '../program/reliability/metric_contract.mjs';
import { runInvariantChecks } from '../program/reliability/invariants.mjs';

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

describe('reliability spine contracts', () => {
  test('source manifest fails on hash mismatch', () => {
    const root = path.resolve('know/produce/reliability-source-fixture');
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    const local = path.join(root, 'a.txt');
    fs.writeFileSync(local, 'hello');
    const manifest = {
      schema_version: '1.0.0',
      entries: [{ source_id: 'a', title: 'a', local_path: local, content_hash: 'sha256:deadbeef', schema_version: '1.0' }]
    };
    const manifestPath = path.join(root, 'source-manifest.json');
    writeJson(manifestPath, manifest);

    const r = validateSourceManifest({ manifestPath });
    expect(r.status).toBe('fail');
    expect(r.failures.join('\n')).toContain('hash mismatch');
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('scenario contract fails without not_forecast true', () => {
    const root = path.resolve('know/produce/reliability-scenario-fixture');
    fs.rmSync(root, { recursive: true, force: true });
    const scenariosDir = path.join(root, 'scenarios');
    fs.mkdirSync(scenariosDir, { recursive: true });
    writeJson(path.join(scenariosDir, 'bad.json'), {
      scenario_id: 'bad',
      status: 'scenario_assumption',
      assumptions: {
        x: { value: 1, range: [0, 2], unit: '%', confidence: 'low', notes: '', source_refs: [] }
      }
    });
    const r = loadScenarioFiles({ scenariosDir });
    expect(r.status).toBe('fail');
    expect(r.failures.join('\n')).toContain('not_forecast=true');
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('scenario contract fails when assumption is missing range', () => {
    const root = path.resolve('know/produce/reliability-scenario-range-fixture');
    fs.rmSync(root, { recursive: true, force: true });
    const scenariosDir = path.join(root, 'scenarios');
    fs.mkdirSync(scenariosDir, { recursive: true });
    writeJson(path.join(scenariosDir, 'bad.json'), {
      scenario_id: 'bad',
      status: 'scenario_assumption',
      not_forecast: true,
      assumptions: {
        x: { value: 1, unit: '%', confidence: 'low', notes: '', source_refs: [] }
      }
    });
    const r = loadScenarioFiles({ scenariosDir });
    expect(r.status).toBe('fail');
    expect(r.failures.join('\n')).toContain('missing range');
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('metric contract fails when headline metrics miss required fields', () => {
    const root = path.resolve('know/produce/reliability-metric-fixture');
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    writeJson(path.join(root, 'metric-registry.json'), {
      metrics: [{
        metric_id: 'm1',
        allowed_statuses: ['scenario_output'],
        requires_method: true,
        requires_range: true,
        requires_confidence: true,
        requires_not_forecast_flag: true
      }]
    });
    writeJson(path.join(root, 'report.json'), { headlineMetrics: [{ metric_id: 'm1', status: 'scenario_output' }] });
    const r = validateMetricContract({ registryPath: path.join(root, 'metric-registry.json'), reportPath: path.join(root, 'report.json') });
    expect(r.status).toBe('fail');
    expect(r.failures.length).toBeGreaterThan(0);
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('metric contract fails for missing confidence/source_refs/scenario_refs when required', () => {
    const root = path.resolve('know/produce/reliability-metric-required-fixture');
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    const scenariosDir = path.join(root, 'scenarios');
    fs.mkdirSync(scenariosDir, { recursive: true });
    writeJson(path.join(scenariosDir, 's1.json'), {
      scenario_id: 's1',
      status: 'scenario_assumption',
      not_forecast: true,
      assumptions: { a: { value: 1, range: [0, 2], unit: '%', confidence: 'low', notes: '', source_refs: [] } }
    });
    writeJson(path.join(root, 'metric-registry.json'), {
      metrics: [{
        metric_id: 'm1',
        allowed_statuses: ['scenario_output'],
        requires_method: true,
        requires_range: false,
        requires_confidence: true,
        requires_not_forecast_flag: true,
        requires_scenario_refs: true
      }]
    });
    writeJson(path.join(root, 'report.json'), {
      headlineMetrics: [{ metric_id: 'm1', status: 'scenario_output', method: 'x', not_forecast: true }]
    });
    const r = validateMetricContract({
      registryPath: path.join(root, 'metric-registry.json'),
      reportPath: path.join(root, 'report.json'),
      scenariosDir
    });
    expect(r.status).toBe('fail');
    const text = r.failures.join('\n');
    expect(text).toContain('missing confidence');
    expect(text).toContain('missing source_refs');
    expect(text).toContain('missing scenario_refs');
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('invariant checker catches deliberate cross-report inconsistency', () => {
    const root = path.resolve('know/produce/reliability-invariant-fixture');
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });

    writeJson(path.join(root, 'grey-population-distribution.json'), { totalPopulationMatched: 1000 });
    writeJson(path.join(root, 'grey-dwelling-land-access.json'), { totalPopulation: 1005 });
    writeJson(path.join(root, 'grey-food-insecurity-trend-projection.json'), { articlePreferredProjection: { projected2027People: 300 } });
    writeJson(path.join(root, 'grey-hormuz-food-security-article-data.json'), {
      foodInsecurityTrendProjection: { preferred2027ProjectedPeople: 400 },
      currentFoodInsecurityBaseline: { trend2027CentralEstimate: 401, trend2027CentralShare: 0.401 },
      strictLandAccess: { noMeaningfulFoodGrowingLandAccessPopulation: 99 },
      physicalLocalFoodResponseTargets: [{ scenario: 'foodGap10', modes: { lowInputAnnualField: { requiredGrowers: 1 }, marketGardenIntensive: { requiredGrowers: 2 }, handToolHouseholdGarden: { requiredGrowers: 3 } } }],
      hormuzCurrentDisruptionScenarios: [{ scenario: 'a' }]
    });
    fs.writeFileSync(path.join(root, 'grey-hormuz-food-security-article-data.md'), 'placeholder markdown without tokens');
    fs.writeFileSync(path.join(root, 'grey-hormuz-food-security-article-data-scenarios.csv'), 'scenario\nb\n');
    writeJson(path.join(root, 'grey-food-gap-replacement.json'), {
      modalityReplacementMatrix: [
        { scenario: 'foodGap10', modality: 'lowInputAnnualField', requiredWorkersYear1: 10 },
        { scenario: 'foodGap10', modality: 'marketGardenIntensive', requiredWorkersYear1: 20 },
        { scenario: 'foodGap10', modality: 'handToolHouseholdGarden', requiredWorkersYear1: 30 }
      ]
    });

    const r = runInvariantChecks({ produceDir: root, tolerancePopulation: 0.1, toleranceWorkers: 0.1 });
    expect(r.status).toBe('fail');
    expect(r.failures.length).toBeGreaterThan(0);
    fs.rmSync(root, { recursive: true, force: true });
  });
});
