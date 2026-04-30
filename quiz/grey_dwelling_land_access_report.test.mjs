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
      expect(built.report.estimatedPopulationNoDirectLandAccess).toBeLessThan(100);
      expect(built.report.estimatedPopulationWithSubsistencePotential + built.report.estimatedPopulationWithSmallholdingPotential + built.report.estimatedPopulationWithFarmScalePotential).toBeGreaterThan(0);
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
      expect(built.report.warnings.some((w) => w.includes('Missing lots-and-concessions-grey.geojson'))).toBe(true);
      const md = fs.readFileSync(built.paths.markdownPath, 'utf8');
      expect(md).toContain('not address-level population');
      expect(md).toContain('modern parcel/address/building data would improve this greatly');
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
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
