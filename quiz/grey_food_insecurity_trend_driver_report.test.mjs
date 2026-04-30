import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { buildGreyFoodInsecurityTrendDriverReport } from '../program/report/grey_food_insecurity_trend_driver_report.mjs';

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

describe('grey food insecurity trend driver report', () => {
  test('writes outputs and includes trend/driver diagnostics', () => {
    const root = path.resolve('know/produce/fi-trend-fixture');
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    writeJson(path.join(root, 'grey-current-system-shock-threshold.json'), {});
    writeJson(path.join(root, 'grey-food-supply-demand-price.json'), {});
    writeJson(path.join(root, 'grey-dwelling-land-access.json'), { totalPopulation: 1000 });

    try {
      const built = buildGreyFoodInsecurityTrendDriverReport({ produceDir: root });
      expect(fs.existsSync(built.paths.markdownPath)).toBe(true);
      expect(fs.existsSync(built.paths.jsonPath)).toBe(true);
      expect(fs.existsSync(built.paths.csvPath)).toBe(true);

      const r = built.report;
      expect(r.trendAnchors.length).toBeGreaterThan(3);
      expect(r.projected2027TrendCentral).toBeCloseTo(0.30, 6);
      expect(r.explainableTrendShare).toBeLessThanOrEqual(1);
      expect(r.unexplainedTrendShare).toBeGreaterThanOrEqual(0);

      const land = r.driverContributionMatrix.find((d) => d.driverId === 'landConsolidationAndProducerAccess');
      expect(land.evidenceStatus).toBe('missingData');
      const energy = r.driverContributionMatrix.find((d) => d.driverId === 'lowerSurplusEnergyPurchasingPowerProxy');
      expect(energy.evidenceStatus).toBe('proxy');
      const global = r.driverContributionMatrix.find((d) => d.driverId === 'globalFoodPricePressure');
      expect(global).toBeTruthy();
      expect(String(global.evidenceStatus)).toContain('measured');

      const md = fs.readFileSync(built.paths.markdownPath, 'utf8');
      expect(md).toContain('attribution diagnostic, not causal proof');
      expect(md).toContain('Malnutrition deaths are not a direct food-price index');
      expect(String(r.assumptions.nextDataTask)).toContain('FAO Food Price Index');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('command runs', () => {
    const root = path.resolve('know/produce/fi-trend-cmd-fixture');
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    try {
      const run = spawnSync('node', ['command/report_grey_food_insecurity_trends.mjs', `--produce-dir=${root}`], { encoding: 'utf8' });
      expect(run.status).toBe(0);
      expect(run.stdout).toContain('projected2027TrendCentral');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
