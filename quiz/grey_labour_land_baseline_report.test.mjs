import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { buildGreyLabourLandBaselineReport, estimatePopulationCategories } from '../program/report/grey_labour_land_baseline_report.mjs';

describe('grey labour-land baseline report', () => {
  test('population categories sum to municipality population', () => {
    const c = estimatePopulationCategories({
      population2021: 1000,
      municipalityName: 'West Grey',
      municipalityType: 'municipality',
      densityPerKm2: 15,
      settlementFeatureCount: 4,
      productiveLotConcessionCount: 100,
      settlementGardenOpportunityCount: 20,
      cooperativeLandAccessCandidateCount: 30,
      constrainedLandCount: 10
    });
    const sum = c.urbanSettlementPopulation + c.townVillageSettlementPopulation + c.hamletSettlementPopulation
      + c.ruralNonFarmPopulation + c.ruralProductiveLandAccessPopulation + c.agriculturalLotAccessPopulation;
    expect(sum).toBe(1000);
  });

  test('urban municipalities have higher noDirectLandAccess than rural under defaults', () => {
    const urban = estimatePopulationCategories({
      population2021: 1000,
      municipalityName: 'Owen Sound',
      municipalityType: 'city',
      densityPerKm2: 900,
      settlementFeatureCount: 8,
      productiveLotConcessionCount: 10,
      settlementGardenOpportunityCount: 2,
      cooperativeLandAccessCandidateCount: 2,
      constrainedLandCount: 2
    });
    const rural = estimatePopulationCategories({
      population2021: 1000,
      municipalityName: 'West Grey',
      municipalityType: 'municipality',
      densityPerKm2: 15,
      settlementFeatureCount: 2,
      productiveLotConcessionCount: 120,
      settlementGardenOpportunityCount: 20,
      cooperativeLandAccessCandidateCount: 20,
      constrainedLandCount: 10
    });
    expect(urban.noDirectLandAccessPopulation).toBeGreaterThan(rural.noDirectLandAccessPopulation);
    expect(rural.ruralProductiveLandAccessPopulation + rural.agriculturalLotAccessPopulation).toBeGreaterThan(
      urban.ruralProductiveLandAccessPopulation + urban.agriculturalLotAccessPopulation
    );
  });

  test('task-level permaculture leverage diagnostics are present', () => {
    const { report, paths } = buildGreyLabourLandBaselineReport();
    expect(fs.existsSync(paths.markdownPath)).toBe(true);
    expect(fs.existsSync(paths.jsonPath)).toBe(true);
    expect(fs.existsSync(paths.municipalityCsvPath)).toBe(true);
    expect(fs.existsSync(paths.scenarioCsvPath)).toBe(true);
    expect(fs.existsSync(paths.permacultureSystemsCsvPath)).toBe(true);
    expect(fs.existsSync(paths.permacultureScenariosCsvPath)).toBe(true);

    const lowFuelEfficient = report.productionSystemLeverage.find((s) => s.system === 'annualLowFuelEfficient');
    const lowFuelHand = report.productionSystemLeverage.find((s) => s.system === 'annualLowFuelHandScale');
    const maturePermaculture = report.productionSystemLeverage.find((s) => s.system === 'maturePermacultureLowCare');
    const maturePermacultureHarvestIntensive = report.productionSystemLeverage.find((s) => s.system === 'maturePermacultureHarvestIntensive');
    const perennialStapleBulkLowCare = report.productionSystemLeverage.find((s) => s.system === 'perennialStapleBulkLowCare');
    const youngPermaculture = report.productionSystemLeverage.find((s) => s.system === 'youngPermaculture');
    const annualMechanized = report.productionSystemLeverage.find((s) => s.system === 'annualMechanized');

    expect(maturePermaculture.soilPrepTillageDaysPerHa).toBeLessThan(lowFuelEfficient.soilPrepTillageDaysPerHa);
    expect(maturePermaculture.plantingSeedingDaysPerHa).toBeLessThan(lowFuelEfficient.plantingSeedingDaysPerHa);
    expect(maturePermaculture.recurringNonHarvestLabourDaysPerHa).toBeLessThan(lowFuelHand.recurringNonHarvestLabourDaysPerHa);
    expect(maturePermacultureHarvestIntensive.harvestLabourDaysPerHa).toBeGreaterThan(0);
    expect(perennialStapleBulkLowCare.harvestLabourDaysPerGJ).toBeLessThan(maturePermacultureHarvestIntensive.harvestLabourDaysPerGJ);
    expect(perennialStapleBulkLowCare.onLandLabourDaysPerHaAtMaturity).toBeLessThan(perennialStapleBulkLowCare.totalSystemLabourDaysPerHaAtMaturity);
    expect(perennialStapleBulkLowCare.regionalProcessingLabourDaysPerHaAtMaturity).toBeGreaterThan(0);
    expect(perennialStapleBulkLowCare.onLandManageableHaPerWorkerAtMaturity).toBeGreaterThan(perennialStapleBulkLowCare.systemManageableHaPerWorkerAtMaturity);
    expect(perennialStapleBulkLowCare.systemManageableHaPerWorkerAtMaturity).toBeGreaterThan(lowFuelHand.systemManageableHaPerWorkerAtMaturity);
    expect(perennialStapleBulkLowCare.yearsUntilFoodEnergyMaturity).toBeGreaterThan(0);
    expect(maturePermaculture.peakHarvestShare).toBeLessThan(annualMechanized.peakHarvestShare);
    expect(maturePermaculture.manageableHaMultiplierVsAnnualLowFuelHandScale).toBeGreaterThan(
      maturePermaculture.manageableHaMultiplierVsAnnualLowFuelEfficient
    );
    expect(maturePermaculture.yearsUntilNetLabourAdvantage).toBeGreaterThan(0);
    expect(report.maturePermacultureSensitivity.manageableHaPerWorkerLow).toBeLessThanOrEqual(
      report.maturePermacultureSensitivity.manageableHaPerWorkerBase
    );
    expect(report.maturePermacultureSensitivity.manageableHaPerWorkerBase).toBeLessThanOrEqual(
      report.maturePermacultureSensitivity.manageableHaPerWorkerHigh
    );

    const strongTransition = report.permacultureAdoptionScenarios.find((s) => s.scenario === 'strongPermacultureTransition');
    expect(strongTransition.establishmentLabourDays).toBeGreaterThan(0);
    expect(strongTransition.totalLabourDaysAtMaturity).toBeGreaterThan(0);

    const markdown = fs.readFileSync(paths.markdownPath, 'utf8');
    expect(markdown).toContain('System | Soil prep | Planting | Weeding | Harvest | Processing | On-land labour/ha | Processing labour/ha | Total system labour/ha');
    expect(markdown).toContain('Post-harvest processing is separated from on-land labour');
    expect(markdown).toContain('Perennial staple bulk scenarios represent mature tree-crop/storage-oriented systems');
    expect(markdown).toContain('not magic yield');
    expect(markdown).toContain('requires establishment labour and skill');
  });

  test('missing lots file emits clear warning', () => {
    const root = path.resolve('know/produce/labour-land-missing-fixture');
    const inputDir = path.join(root, 'input');
    const produceDir = path.join(root, 'produce');
    fs.mkdirSync(inputDir, { recursive: true });
    fs.mkdirSync(produceDir, { recursive: true });
    fs.writeFileSync(path.join(inputDir, 'municipality-boundaries.geojson'), JSON.stringify({ type: 'FeatureCollection', features: [] }));

    try {
      const { report } = buildGreyLabourLandBaselineReport({ inputDir, produceDir });
      expect(report.warnings.some((w) => w.includes('npm run grey:download-data -- --source=lots-and-concessions-grey'))).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('report command exits successfully', () => {
    const run = spawnSync('node', ['command/report_grey_labour_land_baseline.mjs'], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('totalPopulation2021');
  });
});
