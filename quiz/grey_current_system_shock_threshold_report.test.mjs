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
      expect(fs.existsSync(built.paths.trendCsvPath)).toBe(true);
      expect(fs.existsSync(built.paths.passThroughCsvPath)).toBe(true);

      const rows = built.report.shockScenarios;
      expect(rows.length).toBeGreaterThan(5);
      expect(rows[0].scenario).toBe('fuelShock0');
      expect(rows[0].mainThresholdCrossed).toBe('none');
      expect(rows[0].addedFoodInsecurityVulnerabilityVsFuelShock0).toBeCloseTo(0, 6);
      expect(rows[0].addedSevereFoodStressVsFuelShock0).toBeCloseTo(0, 6);
      expect(rows[0].measuredFoodInsecurityBaselineEstimate / 100000).toBeCloseTo(0.25, 6);
      expect(rows[0].modelVulnerabilityBaselineEstimate).toBeGreaterThan(rows[0].measuredFoodInsecurityBaselineEstimate);
      const central2027 = built.report.foodInsecurityTrendProjection.find((r) => r.trendScenario === 'central' && r.year === 2027);
      expect(central2027.projectedMeasuredFoodInsecurityShareWithoutShock).toBeCloseTo(0.30, 6);
      const central2027Shock20 = built.report.shockOverlayOnTrend.find((r) => r.trendScenario === 'central' && r.year === 2027 && r.fuelShockScenario === 'fuelShock20');
      expect(central2027Shock20.projectedMeasuredFoodInsecurityShareWithShock).toBeGreaterThan(central2027.projectedMeasuredFoodInsecurityShareWithoutShock);
      expect(central2027Shock20.addedPeopleVsTrendBaseline).toBeGreaterThan(0);
      const linear5 = built.report.passThroughScenarios.find((r) => r.profile === 'linearConservative' && r.shockScenario === 'fuelShock5');
      const nonlinear5 = built.report.passThroughScenarios.find((r) => r.profile === 'tightMarketNonlinear' && r.shockScenario === 'fuelShock5');
      expect(nonlinear5.fuelPriceIncreasePct).toBeGreaterThan(linear5.fuelPriceIncreasePct);
      const centralFood5 = built.report.passThroughScenarios.find((r) => r.profile === 'policyBuffered' && r.shockScenario === 'fuelShock5');
      expect(centralFood5.foodPriceIncreasePct).toBeGreaterThanOrEqual(9);
      const linear20 = built.report.passThroughScenarios.find((r) => r.profile === 'linearConservative' && r.shockScenario === 'fuelShock20');
      const nonlinear20 = built.report.passThroughScenarios.find((r) => r.profile === 'tightMarketNonlinear' && r.shockScenario === 'fuelShock20');
      expect(nonlinear20.calibratedFoodInsecurityEstimateUnderShock).toBeGreaterThan(linear20.calibratedFoodInsecurityEstimateUnderShock);
      expect(built.report.thresholdFindingsByProfile.tightMarketNonlinear).toBeTruthy();
      expect(built.report.hormuzCurrentMultiInputDisruption2026).toBeTruthy();
      expect(built.report.hormuzCurrentMultiInputDisruption2026.oilDieselConstraintPct).toBeGreaterThan(0);
      expect(built.report.hormuzCurrentMultiInputDisruption2026.lngNaturalGasConstraintPct).toBeGreaterThan(0);
      expect(built.report.hormuzCurrentMultiInputDisruption2026.nitrogenFertilizerConstraintPct).toBeGreaterThan(0);
      expect(built.report.hormuzCurrentMultiInputDisruption2026.sulfurPhosphateConstraintPct).toBeGreaterThan(0);
      expect(built.report.hormuzCurrentMultiInputDisruption2026.shippingInsuranceReroutingConstraintPct).toBeGreaterThan(0);
      const extremeBand = (built.report.currentDisruptionBands ?? []).find((b) => b.scenario === 'currentDisruptionExtreme');
      expect(extremeBand.globalFoodProductionLossPct).toBe(30);
      expect(String(extremeBand.notes).toLowerCase()).toContain('not a forecast');
      expect(built.report.localEmergencyFoodDemandContext.baselineStressAlreadyHigh).toBe(false);
      for (let i = 1; i < rows.length; i += 1) {
        expect(rows[i].foodInsecurityVulnerabilityPopulation).toBeGreaterThanOrEqual(rows[i - 1].foodInsecurityVulnerabilityPopulation);
        expect(rows[i].householdStressIndex).toBeGreaterThanOrEqual(rows[i - 1].householdStressIndex);
        expect(rows[i].addedFoodInsecurityVulnerabilityVsFuelShock0).toBeGreaterThanOrEqual(rows[i - 1].addedFoodInsecurityVulnerabilityVsFuelShock0);
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
      expect(md).toContain('current Hormuz disruption');
      expect(md).toContain('not only an oil shock');
      expect(md).toContain('relative to the fuelShock0 baseline');
      expect(md).toContain('broader vulnerability band');
      expect(md).toContain('trend scenario, not forecast');
      expect(md).toContain('Physical supply decline and retail price impact are not the same');
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

  test('local soup kitchen observation sets high-baseline flag', () => {
    const root = path.resolve('know/produce/current-shock-local-context');
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    writeJson(path.join(root, 'grey-food-calibration.json'), { foodDemandBaseline: { totalFoodDemandGJ: 1000 }, plausibilityScenarios: [] });
    try {
      const built = buildGreyCurrentSystemShockThresholdReport({ produceDir: root, localSoupKitchenMealsPerDay: 1000 });
      expect(built.report.localEmergencyFoodDemandContext.baselineStressAlreadyHigh).toBe(true);
      expect(String(built.report.localEmergencyFoodDemandContext.sourceStatus)).toContain('needs validation');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
