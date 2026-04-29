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
    expect(c.noDirectLandAccessPopulation).toBeGreaterThanOrEqual(c.urbanSettlementPopulation);
  });

  test('urban municipalities have higher noDirectLandAccessShare than rural under defaults', () => {
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

  test('report writes markdown/json/csv and scenarios respond to machinery decline', () => {
    const { report, paths } = buildGreyLabourLandBaselineReport();
    expect(fs.existsSync(paths.markdownPath)).toBe(true);
    expect(fs.existsSync(paths.jsonPath)).toBe(true);
    expect(fs.existsSync(paths.municipalityCsvPath)).toBe(true);
    expect(fs.existsSync(paths.scenarioCsvPath)).toBe(true);

    const current = report.scenarios.find((s) => s.scenario === 'currentMechanized');
    const lowFuel = report.scenarios.find((s) => s.scenario === 'lowFuelMixed');
    expect(lowFuel.requiredFoodLabourDays).toBeGreaterThan(current.requiredFoodLabourDays);
    expect(lowFuel.fossilFuelLeverageRatio).toBeGreaterThan(1);

    const markdown = fs.readFileSync(paths.markdownPath, 'utf8');
    expect(markdown).toContain('lots/concessions are not ownership parcels');
  });

  test('missing lots file emits clear warning', () => {
    const root = path.resolve('know/produce/labour-land-missing-fixture');
    const inputDir = path.join(root, 'input');
    const produceDir = path.join(root, 'produce');
    fs.mkdirSync(inputDir, { recursive: true });
    fs.mkdirSync(produceDir, { recursive: true });
    fs.writeFileSync(path.join(inputDir, 'municipality-boundaries.geojson'), JSON.stringify({ type: 'FeatureCollection', features: [] }));
    fs.writeFileSync(path.join(inputDir, 'settlement-boundaries.geojson'), JSON.stringify({ type: 'FeatureCollection', features: [] }));
    fs.writeFileSync(path.join(inputDir, 'official-plan-schedule-a-land-use.geojson'), JSON.stringify({ type: 'FeatureCollection', features: [] }));

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
