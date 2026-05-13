import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { kcalToGJ } from '../program/report/grey_food_gap_replacement_report.mjs';
import { buildGreyFoodInsecurityTrendProjectionReport } from '../program/report/grey_food_insecurity_trend_projection_report.mjs';

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

describe('grey food insecurity trend projection report', () => {
  test('builds projection with transparent methods and 2027 output', () => {
    const root = path.resolve('know/produce/fi-trend-projection-fixture');
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    writeJson(path.join(root, 'grey-population-distribution.json'), { totalPopulationMatched: 100905 });

    try {
      expect(kcalToGJ(900000)).toBeCloseTo(3.7656, 4);

      const built = buildGreyFoodInsecurityTrendProjectionReport({ produceDir: root });
      expect(fs.existsSync(built.paths.jsonPath)).toBe(true);
      expect(fs.existsSync(built.paths.markdownPath)).toBe(true);
      expect(fs.existsSync(built.paths.csvPath)).toBe(true);

      const r = built.report;
      expect(r.sourceSeries.length).toBeGreaterThanOrEqual(5);
      expect(r.projectionYear).toBe(2027);

      for (const methodKey of ['linear', 'quadratic', 'cappedQuadratic', 'recentSlope']) {
        const m = r.methods[methodKey];
        expect(m).toBeTruthy();
        expect(m.projected2027RatePct).toBeGreaterThanOrEqual(0);
        expect(m.projected2027RatePct).toBeLessThanOrEqual(100);
      }

      const pref = r.articlePreferredProjection;
      expect(pref.method).toBeTruthy();
      expect(pref.projected2027People).toBeCloseTo((pref.projected2027RatePct / 100) * r.projectionPopulation, 2);
      expect(String(pref.caveat).toLowerCase()).toContain('not forecast');

      const has2025 = r.sourceSeries.find((s) => s.year === 2025);
      expect(has2025).toBeTruthy();
      expect(has2025.foodInsecurityRatePct).toBe(24.0);
      const hasGeoLabel = r.sourceSeries.some((s) => /canada|ten provinces|ontario/i.test(String(s.geography)));
      expect(hasGeoLabel).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('command runs', () => {
    const root = path.resolve('know/produce/fi-trend-projection-cmd');
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    writeJson(path.join(root, 'grey-population-distribution.json'), { totalPopulationMatched: 100905 });
    try {
      const run = spawnSync('node', ['command/report_grey_food_insecurity_trend_projection.mjs', `--produce-dir=${root}`], { encoding: 'utf8' });
      expect(run.status).toBe(0);
      expect(run.stdout).toContain('projected2027People');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
