import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { buildGreyCurrentSystemShockThresholdReport } from '../program/report/grey_current_system_shock_threshold_report.mjs';

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

describe('grey current-system shock threshold report', () => {
  test('writes outputs and stress rises monotonically under no adaptation', () => {
    const root = path.resolve('know/produce/current-shock-fixture');
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });

    writeJson(path.join(root, 'grey-food-calibration.json'), {
      foodDemandBaseline: { totalFoodDemandGJ: 1000 },
      plausibilityScenarios: [{ scenario: 'localizedPresentTechBaseline', foodCoverage: 0.5, netFoodEnergyGJ: 500 }]
    });
    writeJson(path.join(root, 'grey-ag-labour-baseline.json'), { currentAgIndustryFTEEstimate: 1000 });
    writeJson(path.join(root, 'grey-dwelling-land-access.json'), { estimatedPopulationNoDirectLandAccess: 8000, estimatedPopulationWithSubsistencePotential: 55000 });
    writeJson(path.join(root, 'grey-population-distribution.json'), { totalPopulationMatched: 100000 });
    writeJson(path.join(root, 'grey-transition-pathways.json'), { assumptions: { currentFoodInsecurityShare: 0.25 } });

    try {
      const built = buildGreyCurrentSystemShockThresholdReport({ produceDir: root });
      expect(fs.existsSync(built.paths.markdownPath)).toBe(true);
      expect(fs.existsSync(built.paths.jsonPath)).toBe(true);
      expect(fs.existsSync(built.paths.scenariosCsvPath)).toBe(true);
      expect(fs.existsSync(built.paths.householdsCsvPath)).toBe(true);

      const rows = built.report.shockScenarios;
      expect(rows.length).toBeGreaterThan(5);
      expect(rows[0].scenario).toBe('fuelShock0');
      expect(rows[0].mainThresholdCrossed).toBe('none');
      expect(rows[0].addedFoodInsecurityRiskExposureVsFuelShock0).toBeCloseTo(0, 6);
      expect(rows[0].addedSevereFoodStressVsFuelShock0).toBeCloseTo(0, 6);
      for (let i = 1; i < rows.length; i += 1) {
        expect(rows[i].foodInsecurityRiskExposurePopulation).toBeGreaterThanOrEqual(rows[i - 1].foodInsecurityRiskExposurePopulation);
        expect(rows[i].householdStressIndex).toBeGreaterThanOrEqual(rows[i - 1].householdStressIndex);
        expect(rows[i].addedFoodInsecurityRiskExposureVsFuelShock0).toBeGreaterThanOrEqual(rows[i - 1].addedFoodInsecurityRiskExposureVsFuelShock0);
      }
      expect(built.report.thresholdFindings.firstFoodInsecurityPlus10PctVsBaseline).not.toBe('fuelShock0');
      expect(built.report.thresholdFindings.firstFoodInsecurityPlus25PctVsBaseline).not.toBe('fuelShock0');
      expect(built.report.thresholdFindings.firstFoodInsecurityPlus50PctVsBaseline).not.toBe('fuelShock0');
      expect(built.report.thresholdFindings.firstModerateStressShockLevel).toBeTruthy();
      expect(built.report.thresholdFindings.firstSevereStressShockLevel).toBeTruthy();
      expect(String(built.report.lagModel.immediateMarketPriceSignalMonths)).toContain('0-1');
      expect(String(built.report.lagModel.fuelRetailPassThroughMonths)).toContain('1-3');
      expect(String(built.report.lagModel.foodDistributionPassThroughMonths)).toContain('2-6');
      expect(String(built.report.lagModel.fertilizerFarmInputPassThroughMonths)).toContain('3-12');
      expect(String(built.report.lagModel.plantingHarvestImpact)).toContain('next');

      const md = fs.readFileSync(built.paths.markdownPath, 'utf8');
      expect(md).toContain('does not assume local resilience already exists');
      expect(md).toContain('relative to the fuelShock0 baseline');
      expect(md).toContain('## Secondary adaptation comparison');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('command exits successfully', () => {
    const root = path.resolve('know/produce/current-shock-cmd-fixture');
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    writeJson(path.join(root, 'grey-food-calibration.json'), { foodDemandBaseline: { totalFoodDemandGJ: 1000 }, plausibilityScenarios: [] });
    try {
      const run = spawnSync('node', ['command/report_grey_current_system_shock_threshold.mjs', `--produce-dir=${root}`], { encoding: 'utf8' });
      expect(run.status).toBe(0);
      expect(run.stdout).toContain('firstModerateStressShockLevel');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
