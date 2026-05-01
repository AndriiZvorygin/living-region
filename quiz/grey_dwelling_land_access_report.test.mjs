import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import {
  buildGreyDwellingLandAccessReport,
  classifyLandAccessThreshold
} from '../program/report/grey_dwelling_land_access_report.mjs';
import { buildGreyLabourLandBaselineReport } from '../program/report/grey_labour_land_baseline_report.mjs';

function fc(features) {
  return { type: 'FeatureCollection', features };
}

describe('grey dwelling land access report', () => {
  test('threshold classification works', () => {
    expect(classifyLandAccessThreshold(0)).toBe('noDirectLandAccess');
    expect(classifyLandAccessThreshold(0.1)).toBe('gardenScaleAccess');
    expect(classifyLandAccessThreshold(0.3)).toBe('householdSubsistencePotential');
    expect(classifyLandAccessThreshold(2.2)).toBe('smallholdingPotential');
    expect(classifyLandAccessThreshold(5)).toBe('farmScalePotential');
  });

  test('report writes outputs and outside settlement does not imply access', () => {
    const root = path.resolve('know/produce/dwelling-land-access-fixture');
    const inputDir = path.join(root, 'input');
    const produceDir = path.join(root, 'produce');
    fs.mkdirSync(inputDir, { recursive: true });
    fs.mkdirSync(produceDir, { recursive: true });

    fs.writeFileSync(path.join(inputDir, 'municipality-boundaries.geojson'), JSON.stringify(fc([
      { type: 'Feature', properties: { MUN_NAME: 'West Grey' }, geometry: { type: 'Polygon', coordinates: [[[-81,44],[-80.5,44],[-80.5,44.6],[-81,44.6],[-81,44]]] } }
    ])));
    fs.writeFileSync(path.join(inputDir, 'settlement-boundaries.geojson'), JSON.stringify(fc([
      { type: 'Feature', properties: { NAME: 'Core' }, geometry: { type: 'Polygon', coordinates: [[[-80.95,44.05],[-80.85,44.05],[-80.85,44.15],[-80.95,44.15],[-80.95,44.05]]] } }
    ])));
    fs.writeFileSync(path.join(inputDir, 'official-plan-schedule-a-land-use.geojson'), JSON.stringify(fc([
      { type: 'Feature', properties: { Final_Type: 'Settlement Area' }, geometry: { type: 'Polygon', coordinates: [[[-80.95,44.04],[-80.84,44.04],[-80.84,44.16],[-80.95,44.16],[-80.95,44.04]]] } },
      { type: 'Feature', properties: { Final_Type: 'Agricultural' }, geometry: { type: 'Polygon', coordinates: [[[-80.95,44.16],[-80.84,44.16],[-80.84,44.3],[-80.95,44.3],[-80.95,44.16]]] } },
      { type: 'Feature', properties: { Final_Type: 'Hazard Lands' }, geometry: { type: 'Polygon', coordinates: [[[-80.95,44.3],[-80.84,44.3],[-80.84,44.4],[-80.95,44.4],[-80.95,44.3]]] } }
    ])));
    fs.writeFileSync(path.join(inputDir, 'lots-and-concessions-grey.geojson'), JSON.stringify(fc([
      { type: 'Feature', properties: { OBJECTID: 1, MUNICIPALITY: 'West Grey' }, geometry: { type: 'Polygon', coordinates: [[[-80.94,44.18],[-80.90,44.18],[-80.90,44.22],[-80.94,44.22],[-80.94,44.18]]] } },
      { type: 'Feature', properties: { OBJECTID: 2, MUNICIPALITY: 'West Grey' }, geometry: { type: 'Polygon', coordinates: [[[-80.94,44.32],[-80.93,44.32],[-80.93,44.33],[-80.94,44.33],[-80.94,44.32]]] } }
    ])));

    fs.writeFileSync(path.join(produceDir, 'grey-census-population-distribution.json'), JSON.stringify({
      totalPopulationMatched: 100,
      totalDwellingsMatched: 40,
      populationInsideSettlementBoundaries: 40,
      populationOutsideSettlementBoundaries: 60
    }));
    fs.writeFileSync(path.join(produceDir, 'grey-census-population-blocks.geojson'), JSON.stringify(fc([
      { type: 'Feature', properties: { geographyId: 'db1', municipalityName: 'West Grey', population: 40, dwellings: 20, insideSettlementBoundary: true }, geometry: { type: 'Polygon', coordinates: [[[-80.95,44.06],[-80.90,44.06],[-80.90,44.14],[-80.95,44.14],[-80.95,44.06]]] } },
      { type: 'Feature', properties: { geographyId: 'db2', municipalityName: 'West Grey', population: 60, dwellings: 20, insideSettlementBoundary: false }, geometry: { type: 'Polygon', coordinates: [[[-80.95,44.17],[-80.89,44.17],[-80.89,44.25],[-80.95,44.25],[-80.95,44.17]]] } }
    ])));

    try {
      const built = buildGreyDwellingLandAccessReport({ inputDir, produceDir });
      expect(fs.existsSync(built.paths.markdownPath)).toBe(true);
      expect(fs.existsSync(built.paths.jsonPath)).toBe(true);
      expect(fs.existsSync(built.paths.municipalCsvPath)).toBe(true);
      expect(fs.existsSync(built.paths.thresholdsCsvPath)).toBe(true);
      expect(built.report.totalPopulation).toBe(100);
      expect(built.report.broadParcelOrYardAccessPopulation).toBeGreaterThanOrEqual(0);
      expect(built.report.noMeaningfulFoodGrowingLandAccessPopulation).toBeGreaterThanOrEqual(0);
      expect(built.report.estimatedPopulationWithSubsistencePotential + built.report.estimatedPopulationWithSmallholdingPotential + built.report.estimatedPopulationWithFarmScalePotential).toBeGreaterThan(0);
      expect(built.report.subsistencePotentialAccessPopulation).toBeLessThanOrEqual(
        built.report.estimatedPopulationWithSubsistencePotential + built.report.estimatedPopulationWithSmallholdingPotential + built.report.estimatedPopulationWithFarmScalePotential
      );
      expect(built.report.landAccessDefinition.primaryArticleDefinition).toBe('meaningful_food_growing_access');
      expect(built.report.thresholdSensitivity.find((x) => x.thresholdScenario === 'permissive').populationAtOrAboveSubsistence)
        .toBeGreaterThanOrEqual(built.report.thresholdSensitivity.find((x) => x.thresholdScenario === 'conservative').populationAtOrAboveSubsistence);

      const md = fs.readFileSync(built.paths.markdownPath, 'utf8');
      expect(md).toContain('Outside settlement is not the same as land access');
      expect(md).toContain('not ownership parcels');
      expect(md).toContain('not legal access');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('constrained land reduces suitability and emits caveat when missing parcel/address data', () => {
    const root = path.resolve('know/produce/dwelling-land-access-missing');
    const inputDir = path.join(root, 'input');
    const produceDir = path.join(root, 'produce');
    fs.mkdirSync(inputDir, { recursive: true });
    fs.mkdirSync(produceDir, { recursive: true });

    fs.writeFileSync(path.join(inputDir, 'municipality-boundaries.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputDir, 'settlement-boundaries.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputDir, 'official-plan-schedule-a-land-use.geojson'), JSON.stringify(fc([])));

    try {
      const built = buildGreyDwellingLandAccessReport({ inputDir, produceDir });
      expect(built.report.dwellingLandAccessValid).toBe(false);
      expect(built.report.dataStatus).toBe('missing_required_lots');
      expect(built.report.estimatedPopulationNoDirectLandAccess).toBeNull();
      expect(built.report.noMeaningfulFoodGrowingLandAccessPopulation).toBeNull();
      expect(built.report.warnings.some((w) => w.includes('Missing lots-and-concessions-grey.geojson'))).toBe(true);
      const md = fs.readFileSync(built.paths.markdownPath, 'utf8');
      expect(md).toContain('invalid until lots-and-concessions-grey.geojson');
      expect(md).toContain('npm run grey:download-data -- --source=lots-and-concessions-grey');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('labour-land uses dwelling-land-access source when available and falls back otherwise', () => {
    const root = path.resolve('know/produce/dwelling-land-labour-source');
    const inputDir = path.join(root, 'input');
    const produceDir = path.join(root, 'produce');
    fs.mkdirSync(inputDir, { recursive: true });
    fs.mkdirSync(produceDir, { recursive: true });

    fs.writeFileSync(path.join(inputDir, 'lots-and-concessions-grey.geojson'), JSON.stringify(fc([
      { type: 'Feature', properties: { OBJECTID: 1 }, geometry: { type: 'Polygon', coordinates: [[[-80.9,44.1],[-80.89,44.1],[-80.89,44.11],[-80.9,44.11],[-80.9,44.1]]] } }
    ])));
    fs.writeFileSync(path.join(produceDir, 'grey-land-access-municipality-summary.csv'), 'municipalityName,lotConcessionFeatures,ruralFoodAccessOpportunity,cooperativeLandAccessCandidate,settlementGardenOpportunity,constrainedLand,lowAccessRural\nOwen Sound,1,0,0,0,1,0\n');

    const a = buildGreyLabourLandBaselineReport({ inputDir, produceDir });
    expect(a.report.assumptions.populationDistributionSource === 'municipalHeuristic' || a.report.assumptions.populationDistributionSource === 'censusSmallArea').toBe(true);

    fs.writeFileSync(path.join(produceDir, 'grey-dwelling-land-access.json'), JSON.stringify({
      estimatedPopulationNoDirectLandAccess: 30000,
      estimatedPopulationWithGardenScaleAccess: 5000,
      estimatedPopulationWithSubsistencePotential: 15000,
      estimatedPopulationWithSmallholdingPotential: 10000,
      estimatedPopulationWithFarmScalePotential: 5000
    }));

    const b = buildGreyLabourLandBaselineReport({ inputDir, produceDir });
    expect(b.report.assumptions.populationDistributionSource).toBe('censusSmallAreaWithDwellingLandAccessProxy');

    fs.rmSync(root, { recursive: true, force: true });
  });

  test('command writes report successfully on fixtures', () => {
    const root = path.resolve('know/produce/dwelling-land-access-command');
    const inputDir = path.join(root, 'input');
    const produceDir = path.join(root, 'produce');
    fs.mkdirSync(inputDir, { recursive: true });
    fs.mkdirSync(produceDir, { recursive: true });

    fs.writeFileSync(path.join(inputDir, 'municipality-boundaries.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputDir, 'settlement-boundaries.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputDir, 'official-plan-schedule-a-land-use.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputDir, 'lots-and-concessions-grey.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(produceDir, 'grey-census-population-distribution.json'), JSON.stringify({ totalPopulationMatched: 0, totalDwellingsMatched: 0 }));
    fs.writeFileSync(path.join(produceDir, 'grey-census-population-blocks.geojson'), JSON.stringify(fc([])));

    try {
      const run = spawnSync('node', [
        'command/report_grey_dwelling_land_access.mjs',
        `--input-dir=${inputDir}`,
        `--produce-dir=${produceDir}`
      ], { encoding: 'utf8' });
      expect(run.status).toBe(0);
      expect(run.stdout).toContain('population distribution source');
      expect(run.stderr).toContain('invalid until lots-and-concessions-grey.geojson');

      const strictRun = spawnSync('node', [
        'command/report_grey_dwelling_land_access.mjs',
        '--strict',
        `--input-dir=${inputDir}`,
        `--produce-dir=${produceDir}`
      ], { encoding: 'utf8' });
      expect(strictRun.status).not.toBe(0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('stale invalid cache is rebuilt when lots now exist and --use-cache is set', () => {
    const root = path.resolve('know/produce/dwelling-land-access-cache-guard');
    const inputDir = path.join(root, 'input');
    const produceDir = path.join(root, 'produce');
    fs.mkdirSync(inputDir, { recursive: true });
    fs.mkdirSync(produceDir, { recursive: true });

    fs.writeFileSync(path.join(inputDir, 'municipality-boundaries.geojson'), JSON.stringify(fc([
      { type: 'Feature', properties: { MUN_NAME: 'West Grey' }, geometry: { type: 'Polygon', coordinates: [[[-81,44],[-80.5,44],[-80.5,44.6],[-81,44.6],[-81,44]]] } }
    ])));
    fs.writeFileSync(path.join(inputDir, 'settlement-boundaries.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputDir, 'official-plan-schedule-a-land-use.geojson'), JSON.stringify(fc([
      { type: 'Feature', properties: { Final_Type: 'Agricultural' }, geometry: { type: 'Polygon', coordinates: [[[-80.95,44.16],[-80.84,44.16],[-80.84,44.3],[-80.95,44.3],[-80.95,44.16]]] } }
    ])));
    fs.writeFileSync(path.join(inputDir, 'lots-and-concessions-grey.geojson'), JSON.stringify(fc([
      { type: 'Feature', properties: { OBJECTID: 1, MUNICIPALITY: 'West Grey' }, geometry: { type: 'Polygon', coordinates: [[[-80.94,44.18],[-80.90,44.18],[-80.90,44.22],[-80.94,44.22],[-80.94,44.18]]] } }
    ])));
    fs.writeFileSync(path.join(produceDir, 'grey-census-population-distribution.json'), JSON.stringify({
      totalPopulationMatched: 50,
      totalDwellingsMatched: 20,
      populationInsideSettlementBoundaries: 10,
      populationOutsideSettlementBoundaries: 40
    }));
    fs.writeFileSync(path.join(produceDir, 'grey-census-population-blocks.geojson'), JSON.stringify(fc([
      { type: 'Feature', properties: { geographyId: 'db1', municipalityName: 'West Grey', population: 50, dwellings: 20, insideSettlementBoundary: false }, geometry: { type: 'Polygon', coordinates: [[[-80.95,44.17],[-80.89,44.17],[-80.89,44.25],[-80.95,44.25],[-80.95,44.17]]] } }
    ])));

    fs.writeFileSync(path.join(produceDir, 'grey-dwelling-land-access.json'), JSON.stringify({
      dwellingLandAccessValid: false,
      confidence: 'invalid_missing_lots',
      estimatedPopulationNoDirectLandAccess: 50
    }));

    try {
      const run = spawnSync('node', [
        'command/report_grey_dwelling_land_access.mjs',
        '--use-cache',
        `--input-dir=${inputDir}`,
        `--produce-dir=${produceDir}`
      ], { encoding: 'utf8' });
      expect(run.status).toBe(0);
      expect(run.stdout).toContain('cache mode: rebuilt');

      const saved = JSON.parse(fs.readFileSync(path.join(produceDir, 'grey-dwelling-land-access.json'), 'utf8'));
      expect(saved.dwellingLandAccessValid).toBe(true);
      expect(saved.estimatedPopulationWithSubsistencePotential).not.toBeNull();
      expect(saved.noMeaningfulFoodGrowingLandAccessPopulation).not.toBeNull();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('strict definition keeps settlement-heavy areas out of subsistence tier by default', () => {
    const root = path.resolve('know/produce/dwelling-land-access-strict-settlement');
    const inputDir = path.join(root, 'input');
    const produceDir = path.join(root, 'produce');
    fs.mkdirSync(inputDir, { recursive: true });
    fs.mkdirSync(produceDir, { recursive: true });

    fs.writeFileSync(path.join(inputDir, 'municipality-boundaries.geojson'), JSON.stringify(fc([
      { type: 'Feature', properties: { MUN_NAME: 'Owen Sound' }, geometry: { type: 'Polygon', coordinates: [[[-80.99,44.50],[-80.7,44.50],[-80.7,44.7],[-80.99,44.7],[-80.99,44.50]]] } }
    ])));
    fs.writeFileSync(path.join(inputDir, 'settlement-boundaries.geojson'), JSON.stringify(fc([
      { type: 'Feature', properties: { NAME: 'Core' }, geometry: { type: 'Polygon', coordinates: [[[-80.98,44.52],[-80.72,44.52],[-80.72,44.68],[-80.98,44.68],[-80.98,44.52]]] } }
    ])));
    fs.writeFileSync(path.join(inputDir, 'official-plan-schedule-a-land-use.geojson'), JSON.stringify(fc([
      { type: 'Feature', properties: { Final_Type: 'Settlement Area' }, geometry: { type: 'Polygon', coordinates: [[[-80.98,44.52],[-80.72,44.52],[-80.72,44.68],[-80.98,44.68],[-80.98,44.52]]] } }
    ])));
    fs.writeFileSync(path.join(inputDir, 'lots-and-concessions-grey.geojson'), JSON.stringify(fc([
      { type: 'Feature', properties: { OBJECTID: 1, MUNICIPALITY: 'Owen Sound' }, geometry: { type: 'Polygon', coordinates: [[[-80.90,44.56],[-80.80,44.56],[-80.80,44.66],[-80.90,44.66],[-80.90,44.56]]] } }
    ])));
    fs.writeFileSync(path.join(produceDir, 'grey-census-population-distribution.json'), JSON.stringify({
      totalPopulationMatched: 120,
      totalDwellingsMatched: 40,
      populationInsideSettlementBoundaries: 120,
      populationOutsideSettlementBoundaries: 0
    }));
    fs.writeFileSync(path.join(produceDir, 'grey-census-population-blocks.geojson'), JSON.stringify(fc([
      { type: 'Feature', properties: { geographyId: 'db1', municipalityName: 'Owen Sound', population: 120, dwellings: 40, insideSettlementBoundary: true }, geometry: { type: 'Polygon', coordinates: [[[-80.95,44.55],[-80.75,44.55],[-80.75,44.67],[-80.95,44.67],[-80.95,44.55]]] } }
    ])));

    try {
      const built = buildGreyDwellingLandAccessReport({ inputDir, produceDir });
      expect(built.report.subsistencePotentialAccessPopulation).toBe(0);
      expect(built.report.productionScaleAccessPopulation).toBe(0);
      expect(built.report.noMeaningfulFoodGrowingLandAccessPopulation).toBeGreaterThan(0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
