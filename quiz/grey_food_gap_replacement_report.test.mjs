import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { PERSON_FOOD_GJ_PER_YEAR, buildGreyFoodGapReplacementReport, kcalToGJ } from '../program/report/grey_food_gap_replacement_report.mjs';

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

describe('grey food gap replacement report', () => {
  test('dimensional helpers compute expected food-energy conversions', () => {
    expect(kcalToGJ(900000)).toBeCloseTo(3.7656, 4);
    expect(PERSON_FOOD_GJ_PER_YEAR).toBeCloseTo(3.7656, 4);
  });

  test('writes outputs and models gap replacement dynamics', () => {
    const root = path.resolve('know/produce/food-gap-fixture');
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });

    writeJson(path.join(root, 'grey-food-calibration.json'), {
      totalFoodDemandGJ: 1000,
      annualFoodEnergyGJPerPerson: 4,
      population2021: 100,
      humanFoodPriorityHa: 200
    });
    writeJson(path.join(root, 'grey-ag-labour-baseline.json'), { currentAgIndustryFTEEstimate: 40 });
    writeJson(path.join(root, 'grey-dwelling-land-access.json'), {
      totalPopulation: 100,
      estimatedPopulationWithSubsistencePotential: 60,
      thresholdSensitivity: [{ thresholdScenario: 'baseline', dwellingsAtOrAboveSubsistence: 25 }]
    });

    try {
      const built = buildGreyFoodGapReplacementReport({ produceDir: root });
      expect(fs.existsSync(built.paths.markdownPath)).toBe(true);
      expect(fs.existsSync(built.paths.jsonPath)).toBe(true);
      expect(fs.existsSync(built.paths.scenariosCsvPath)).toBe(true);
      expect(fs.existsSync(built.paths.modalitiesCsvPath)).toBe(true);
      expect(fs.existsSync(built.paths.timelineCsvPath)).toBe(true);

      const report = built.report;
      const fg33 = report.foodGapScenarios.find((s) => s.scenario === 'foodGap33');
      expect(fg33.foodGapGJ).toBeCloseTo(330, 6);

      const hand = report.modalityReplacementMatrix.find((r) => r.scenario === 'foodGap20' && r.modality === 'handToolHouseholdGarden');
      const lowInput = report.modalityReplacementMatrix.find((r) => r.scenario === 'foodGap20' && r.modality === 'lowInputAnnualField');
      expect(hand.requiredWorkersYear1).toBeGreaterThan(lowInput.requiredWorkersYear1);

      const perennial = report.modalityReplacementMatrix.find((r) => r.scenario === 'foodGap20' && r.modality === 'perennialStapleBulkLowCare');
      expect(perennial.requiredHaYear1).toBeGreaterThan(perennial.requiredHaYear10);

      const market = report.modalityReplacementMatrix.find((r) => r.scenario === 'foodGap20' && r.modality === 'marketGardenIntensive');
      const annual = report.modalityReplacementMatrix.find((r) => r.scenario === 'foodGap20' && r.modality === 'handToolAnnualStaples');
      expect(market.requiredWorkersYear1).toBeGreaterThan(0);
      const marketDef = report.productionModalities.find((m) => m.modality === 'marketGardenIntensive');
      const annualDef = report.productionModalities.find((m) => m.modality === 'handToolAnnualStaples');
      expect(marketDef.calorieReplacementEfficiency).toBeLessThan(annualDef.calorieReplacementEfficiency);
      expect(marketDef.foodEnergyGJPerWorkerAtMaturity).toBeGreaterThan(0);
      expect(marketDef.landHaPerWorker).toBeGreaterThan(0);
      expect(marketDef.peopleFedEquivalentPerWorkerAtMaturity).toBeCloseTo(
        marketDef.foodEnergyGJPerWorkerAtMaturity / PERSON_FOOD_GJ_PER_YEAR,
        6
      );

      const grazingDef = report.productionModalities.find((m) => m.modality === 'managedGrazingBeefPastureComparison');
      expect(grazingDef).toBeTruthy();
      expect(grazingDef.comparisonOnly).toBe(true);
      expect(grazingDef.notPrimaryCalorieReplacement).toBe(true);
      expect(grazingDef.netFoodEnergyGJPerHaAtMaturity).toBeGreaterThan(0);
      expect(grazingDef.foodEnergyGJPerWorkerAtMaturity).toBeGreaterThan(0);

      const pkg = report.mixedReplacementPackages.find((p) => p.scenario === 'foodGap33' && p.package === 'tenYearResiliencePackage');
      expect(pkg.year10CoverageOfGap).toBeGreaterThanOrEqual(pkg.year1CoverageOfGap);
      const emergencyPkg = report.mixedReplacementPackages.find((p) => p.scenario === 'foodGap33' && p.package === 'emergencyYear1Package');
      expect(emergencyPkg.byYear[1].localProductionCoverageShare).toBeLessThan(1);
      expect(emergencyPkg.byYear[1].year1CoverageType).toBe('production plus emergency measures');
      expect(emergencyPkg.byYear[1].dependsOnEmergencyImports).toBe(true);
      expect(emergencyPkg.byYear[1].storageLossReductionCoverageShare).toBeGreaterThan(0);
      expect(emergencyPkg.byYear[1].emergencyAidOrRationingCoverageShare).toBeGreaterThan(0);
      expect(emergencyPkg.byYear[1].unmetGapShare).toBeGreaterThan(0);
      expect(emergencyPkg.byYear[10].localProductionCoverageShare).toBeGreaterThan(emergencyPkg.byYear[1].localProductionCoverageShare);
      expect(emergencyPkg.byYear[10].year1CoverageType).toBe('new local production only');

      const timelineY1 = report.timelineDiagnostics.find((r) => r.scenario === 'foodGap33' && r.package === 'emergencyYear1Package' && r.year === 1);
      expect(timelineY1.localProductionCoverageShare).toBeGreaterThan(0);
      expect(timelineY1.emergencyAidOrRationingCoverageShare).toBeGreaterThan(0);

      const severe = report.foodGapScenarios.find((s) => s.scenario === 'severeSystemicInputLoss33');
      expect(severe.sourceStatus).toContain('assumption');
      expect(severe.globalFoodProductionLossShare).toBeCloseTo(0.33, 6);
      expect(severe.localFoodAvailabilityLossShare).toBeLessThan(0.33);
      expect(String(severe.interpretation)).toContain('global');

      const md = fs.readFileSync(built.paths.markdownPath, 'utf8');
      expect(md).toContain('severe scenario assumption, not a forecast');
      expect(md).toContain('not the same as Grey County having one-third less local food');
      expect(md).toContain('Grazing and beef systems can be valuable');
      expect(md).toContain('not be treated as high-calorie replacement systems');
      expect(md).toContain('substitution scenarios');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('command runs', () => {
    const root = path.resolve('know/produce/food-gap-cmd-fixture');
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    writeJson(path.join(root, 'grey-food-calibration.json'), { totalFoodDemandGJ: 1000, annualFoodEnergyGJPerPerson: 4, population2021: 100, humanFoodPriorityHa: 200 });
    try {
      const run = spawnSync('node', ['command/report_grey_food_gap_replacement.mjs', `--produce-dir=${root}`], { encoding: 'utf8' });
      expect(run.status).toBe(0);
      expect(run.stdout).toContain('foodGap33');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
