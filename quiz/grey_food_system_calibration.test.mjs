import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { buildGreyFoodSystemCalibration } from '../program/report/grey_food_system_calibration.mjs';

function fc(features) {
  return { type: 'FeatureCollection', features };
}

describe('grey food system calibration', () => {
  test('command writes Markdown/JSON/CSV and contains caveat', () => {
    const root = path.resolve('know/produce/food-calibration-fixture');
    const produceDir = root;
    const inputDir = path.join(root, 'input');
    fs.mkdirSync(produceDir, { recursive: true });
    fs.mkdirSync(inputDir, { recursive: true });

    fs.writeFileSync(path.join(produceDir, 'grey-public-baseline.json'), JSON.stringify({
      regionalIndicators: { population2021: 100905 }
    }, null, 2));
    fs.writeFileSync(path.join(produceDir, 'grey-land-access-baseline.json'), JSON.stringify({ assignment: { totalLotConcessionFeatures: 100 } }, null, 2));
    fs.writeFileSync(path.join(produceDir, 'grey-labour-land-baseline.json'), JSON.stringify({
      regionalIndicators: { availableFoodWorkerFTE: 1000, lowFuelFoodWorkersNeeded: 1200, productiveHaPerRuralAccessPerson: 2.1 },
      handToolCapacityReference: [{ system: 'x' }]
    }, null, 2));
    fs.writeFileSync(path.join(produceDir, 'grey-county-open-data-metrics.json'), JSON.stringify({ years: [{ localFoodCoverageRatio: 0.7 }] }, null, 2));

    fs.writeFileSync(path.join(inputDir, 'official-plan-schedule-a-land-use.geojson'), JSON.stringify(fc([
      { type: 'Feature', properties: { LANDUSE: 'Agricultural' }, geometry: null },
      { type: 'Feature', properties: { LANDUSE: 'Rural' }, geometry: null },
      { type: 'Feature', properties: { LANDUSE: 'Settlement Area' }, geometry: null },
      { type: 'Feature', properties: { LANDUSE: 'Hazard Lands' }, geometry: null }
    ])));
    fs.writeFileSync(path.join(inputDir, 'managed-forest-boundary.geojson'), JSON.stringify(fc([{ type: 'Feature', properties: {}, geometry: null }])));
    fs.writeFileSync(path.join(inputDir, 'on-farm-rural-business-listing.geojson'), JSON.stringify(fc([{ type: 'Feature', properties: {}, geometry: null }])));

    try {
      const { report, paths } = buildGreyFoodSystemCalibration({ produceDir, inputDir });
      expect(fs.existsSync(paths.markdownPath)).toBe(true);
      expect(fs.existsSync(paths.jsonPath)).toBe(true);
      expect(fs.existsSync(paths.landSummaryCsvPath)).toBe(true);
      expect(fs.existsSync(paths.sensitivityCsvPath)).toBe(true);
      expect(fs.existsSync(paths.driversCsvPath)).toBe(true);
      expect(fs.existsSync(paths.baselineComparisonCsvPath)).toBe(true);

      for (const p of report.yieldProfiles) {
        expect(Number.isFinite(p.grossFoodEnergyGJPerHa)).toBe(true);
        expect(Number.isFinite(p.netFoodEnergyGJPerHa)).toBe(true);
      }

      const demand = report.foodDemandBaseline.totalPopulation * report.foodDemandBaseline.annualFoodEnergyGJPerPerson;
      expect(report.foodDemandBaseline.totalFoodDemandGJ).toBeCloseTo(demand, 6);

      const current = report.plausibilityScenarios.find((x) => x.scenario === 'constrainedLocalFoodBaseline');
      expect(current.foodCoverage).toBeCloseTo(current.netFoodEnergyGJ / report.foodDemandBaseline.totalFoodDemandGJ, 6);
      expect(report.selfCoverageThresholds.additionalNetFoodEnergyGJNeeded).toBeCloseTo(
        Math.max(0, report.selfCoverageThresholds.requiredNetFoodEnergyGJForSelfCoverage - current.netFoodEnergyGJ),
        6
      );

      const scenarios = report.plausibilityScenarios.map((s) => s.scenario);
      expect(scenarios).toContain('presentIndustrialFossilBaseline');
      expect(scenarios).toContain('localizedPresentTechBaseline');
      expect(scenarios).toContain('constrainedLocalFoodBaseline');
      expect(scenarios).toContain('lowFuelTransitionBaseline');
      const lowFuelAssumptions = report.scenarioAssumptions?.lowFuelTransitionBaseline;
      expect(Number.isFinite(lowFuelAssumptions?.fuelAvailabilityIndex)).toBe(true);
      expect(Number.isFinite(lowFuelAssumptions?.fertilizerAvailabilityIndex)).toBe(true);
      expect(Number.isFinite(lowFuelAssumptions?.machinerySupportFactor)).toBe(true);
      expect(Number.isFinite(lowFuelAssumptions?.inputConstraintFactor)).toBe(true);

      const markdown = fs.readFileSync(paths.markdownPath, 'utf8');
      expect(markdown).toContain('not a farm production forecast');
      expect(markdown).toContain('not a measured food-capacity claim');
      expect(markdown).toContain('Present potential versus transition constraints');
      expect(typeof report.landEnoughDiagnostic.landBaseEnoughUnderPresentInputs).toBe('boolean');
      expect(report.plausibilityScenarios.some((s) => s.scenario === 'currentModelAssumption')).toBe(false);
      const constrained = report.plausibilityScenarios.find((s) => s.scenario === 'constrainedLocalFoodBaseline');
      expect(String(constrained?.interpretation ?? '').toLowerCase()).toContain('not measured');

      expect(Number.isFinite(report.selfCoverageThresholds.requiredYieldMultiplierAtCurrentLand)).toBe(true);
      const drivers = report.sensitivityDrivers;
      expect(drivers.length).toBeGreaterThan(0);
      for (let i = 1; i < drivers.length; i += 1) {
        expect(Math.abs(drivers[i - 1].foodCoverageDelta)).toBeGreaterThanOrEqual(Math.abs(drivers[i].foodCoverageDelta));
      }

      const baselineComparisonCsv = fs.readFileSync(paths.baselineComparisonCsvPath, 'utf8').split('\n')[0];
      expect(baselineComparisonCsv).toContain('fossilInputSupport');
      expect(baselineComparisonCsv).toContain('supplyChainDependence');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('missing files produce warnings and do not crash', () => {
    const root = path.resolve('know/produce/food-calibration-missing');
    fs.mkdirSync(root, { recursive: true });
    try {
      const { report } = buildGreyFoodSystemCalibration({ produceDir: root, inputDir: path.join(root, 'input') });
      expect(report.warnings.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('report command exits successfully', () => {
    const root = path.resolve('know/produce/food-calibration-command-fixture');
    const produceDir = root;
    const inputDir = path.join(root, 'input');
    fs.mkdirSync(produceDir, { recursive: true });
    fs.mkdirSync(inputDir, { recursive: true });

    fs.writeFileSync(path.join(produceDir, 'grey-public-baseline.json'), JSON.stringify({
      regionalIndicators: { population2021: 100905 }
    }, null, 2));
    fs.writeFileSync(path.join(inputDir, 'official-plan-schedule-a-land-use.geojson'), JSON.stringify(fc([
      { type: 'Feature', properties: { LANDUSE: 'Agricultural' }, geometry: null }
    ])));

    try {
      const run = spawnSync(
        'node',
        [
          'command/report_grey_food_calibration.mjs',
          `--produce-dir=${produceDir}`,
          `--input-dir=${inputDir}`
        ],
        { encoding: 'utf8', timeout: 30000 }
      );
      expect(run.status).toBe(0);
      expect(run.stdout).toContain('totalFoodDemandGJ');
      expect(run.stdout).toContain('drivers csv');
      expect(run.stdout).toContain('presentIndustrialFossilBaseline foodCoverage');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
