import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';

describe('CLI inspect/manifest/export', () => {
  test('demo:inspect exits successfully', () => {
    const result = spawnSync('node', ['command/run_demo_inspect.mjs'], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Stress');
    expect(result.stdout).toContain('Transport');
    expect(result.stdout).toContain('Migration');
    expect(result.stdout).toContain('transportDieselDemandLitre');
  });

  test('scenario:manifest exits successfully', () => {
    const result = spawnSync('node', ['command/run_scenario_manifest.mjs'], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('"name": "no-adaptation"');
    expect(result.stdout).toContain('"name": "adaptation"');
  });

  test('export:metrics writes valid JSON with yearly arrays', () => {
    const result = spawnSync('node', ['command/export_metrics.mjs'], { encoding: 'utf8' });
    expect(result.status).toBe(0);

    const adaptationPath = path.resolve('know/produce/demo-adaptation-metrics.json');
    const noAdaptationPath = path.resolve('know/produce/demo-no-adaptation-metrics.json');
    const comparePath = path.resolve('know/produce/demo-compare-final.json');

    const adaptation = JSON.parse(fs.readFileSync(adaptationPath, 'utf8'));
    const noAdaptation = JSON.parse(fs.readFileSync(noAdaptationPath, 'utf8'));
    const compare = JSON.parse(fs.readFileSync(comparePath, 'utf8'));

    expect(Array.isArray(adaptation.years)).toBe(true);
    expect(Array.isArray(noAdaptation.years)).toBe(true);
    expect(adaptation.years.length).toBeGreaterThan(0);
    expect(noAdaptation.years.length).toBeGreaterThan(0);
    expect(compare).toHaveProperty('adaptation');
    expect(compare).toHaveProperty('noAdaptation');
  });
});
