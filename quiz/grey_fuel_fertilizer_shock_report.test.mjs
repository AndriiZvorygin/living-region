import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { buildGreyFuelFertilizerShockReport } from '../program/report/grey_fuel_fertilizer_shock_report.mjs';

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

describe('grey fuel/fertilizer shock report', () => {
  test('writes markdown/json/csv outputs and includes required decline scenarios', () => {
    const root = path.resolve('know/produce/fuel-shock-fixture');
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });

    writeJson(path.join(root, 'grey-food-calibration.json'), {
      totalFoodDemandGJ: 1000,
      humanFoodPriorityHa: 100,
      plausibilityScenarios: [
        { scenario: 'presentIndustrialFossilBaseline', candidateFoodHa: 200, netGJPerHa: 40, foodCoverage: 4.0, netFoodEnergyGJ: 4000 },
        { scenario: 'localizedPresentTechBaseline', candidateFoodHa: 100, netGJPerHa: 5, foodCoverage: 0.5, netFoodEnergyGJ: 500 },
        { scenario: 'constrainedLocalFoodBaseline', candidateFoodHa: 90, netGJPerHa: 3, foodCoverage: 0.27, netFoodEnergyGJ: 270 }
      ]
    });
    writeJson(path.join(root, 'grey-labour-land-baseline.json'), {
      regionalIndicators: { availableFoodWorkerFTE: 1200, estimatedHumanFoodProducingHa: 110 },
      productionSystemLeverage: [{ system: 'perennialStapleBulkLowCare', onLandManageableHaPerWorkerAtMaturity: 3.2 }],
      animalPowerScenarios: [{ animalPowerLeverageRatio: 0.2 }]
    });
    writeJson(path.join(root, 'grey-ag-labour-baseline.json'), { currentAgIndustryFTEEstimate: 4000 });
    writeJson(path.join(root, 'grey-dwelling-land-access.json'), {
      totalPopulation: 100000,
      outsideSettlementPopulation: 50000,
      estimatedPopulationWithSubsistencePotential: 55000
    });
    writeJson(path.join(root, 'grey-localization-access.json'), { foodCalibrationContext: { localizedPresentTechBaselineCoverage: 0.5 } });

    try {
      const built = buildGreyFuelFertilizerShockReport({ produceDir: root });
      expect(fs.existsSync(built.paths.markdownPath)).toBe(true);
      expect(fs.existsSync(built.paths.jsonPath)).toBe(true);
      expect(fs.existsSync(built.paths.scenariosCsvPath)).toBe(true);
      expect(fs.existsSync(built.paths.labourCsvPath)).toBe(true);

      const names = new Set(built.report.shockScenarios.map((s) => s.scenario));
      expect(names.has('decline5')).toBe(true);
      expect(names.has('decline10')).toBe(true);
      expect(names.has('decline20')).toBe(true);
      expect(names.has('decline40')).toBe(true);
      expect(names.has('decline60')).toBe(true);

      const shock10 = built.report.shockScenarios.find((s) => s.scenario === 'shock10');
      const shock40 = built.report.shockScenarios.find((s) => s.scenario === 'shock40');
      expect(shock40.foodCoverage).toBeLessThan(shock10.foodCoverage);
      expect(shock40.addedFoodWorkersNeededVsCurrent).toBeGreaterThanOrEqual(shock10.addedFoodWorkersNeededVsCurrent);

      const s20none = built.report.adaptationComparisons.find((r) => r.scenario === 'shock20' && r.adaptationPackage === 'none');
      const s20combo = built.report.adaptationComparisons.find((r) => r.scenario === 'shock20' && r.adaptationPackage === 'combinedResiliencePackage');
      expect(s20combo.foodCoverage).toBeGreaterThanOrEqual(s20none.foodCoverage);
      expect(built.report.thresholdWarnings.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('command exits successfully and writes outputs', () => {
    const root = path.resolve('know/produce/fuel-shock-command');
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    writeJson(path.join(root, 'grey-food-calibration.json'), { totalFoodDemandGJ: 1000, plausibilityScenarios: [] });
    writeJson(path.join(root, 'grey-labour-land-baseline.json'), { regionalIndicators: {} });
    writeJson(path.join(root, 'grey-ag-labour-baseline.json'), {});
    writeJson(path.join(root, 'grey-dwelling-land-access.json'), {});
    try {
      const run = spawnSync('node', ['command/report_grey_fuel_fertilizer_shock.mjs', `--produce-dir=${root}`], { encoding: 'utf8' });
      expect(run.status).toBe(0);
      expect(run.stdout).toContain('scenarios:');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
