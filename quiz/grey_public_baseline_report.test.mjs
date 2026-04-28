import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { buildGreyPublicBaselineReport } from '../program/report/grey_public_baseline_report.mjs';

function writeGeoJson(filePath, count) {
  const features = Array.from({ length: count }, (_, i) => ({
    type: 'Feature',
    properties: { id: i + 1 },
    geometry: { type: 'Point', coordinates: [-80.9, 44.5] }
  }));
  fs.writeFileSync(filePath, JSON.stringify({ type: 'FeatureCollection', features }));
}

describe('grey public baseline report', () => {
  test('writes markdown/json/csv with required sections from minimal fixture', () => {
    const root = path.resolve('know/produce/public-baseline-fixture');
    const inputDir = path.join(root, 'input');
    const produceDir = path.join(root, 'produce');
    fs.mkdirSync(inputDir, { recursive: true });
    fs.mkdirSync(produceDir, { recursive: true });

    writeGeoJson(path.join(inputDir, 'municipality-boundaries.geojson'), 9);
    writeGeoJson(path.join(inputDir, 'settlement-boundaries.geojson'), 56);
    writeGeoJson(path.join(inputDir, 'official-plan-schedule-a-land-use.geojson'), 100);
    writeGeoJson(path.join(inputDir, 'road-centrelines-grey.geojson'), 200);
    writeGeoJson(path.join(inputDir, 'grey-transit-bus-stops.geojson'), 23);
    writeGeoJson(path.join(inputDir, 'grey-transit-routes.geojson'), 60);
    writeGeoJson(path.join(inputDir, 'official-road-cycling-routes.geojson'), 23);
    writeGeoJson(path.join(inputDir, 'county-trails.geojson'), 1);
    writeGeoJson(path.join(inputDir, 'cp-rail-trail.geojson'), 1);
    writeGeoJson(path.join(inputDir, 'hiking-trails.geojson'), 143);
    writeGeoJson(path.join(inputDir, 'managed-forest-boundary.geojson'), 45);
    writeGeoJson(path.join(inputDir, 'on-farm-rural-business-listing.geojson'), 197);
    writeGeoJson(path.join(inputDir, 'public-facilities.geojson'), 35);
    writeGeoJson(path.join(inputDir, 'bridges-culverts-structures.geojson'), 31);
    writeGeoJson(path.join(inputDir, 'road-condition.geojson'), 590);

    fs.writeFileSync(path.join(produceDir, 'grey-baseline-summary.json'), JSON.stringify({
      totalPopulation2021: 100905,
      totalLandAreaKm2: 4497.93,
      settlementBoundaryCount: 56,
      landUseFeatureCount: 100,
      totalRoadKm: 4741.82,
      roadKmPer1000Residents: 47.0,
      roadKmPerKm2: 1.06,
      roadFeatureCount: 6327,
      roadClassCounts: { '5': 5000 },
      roadJurisdictionCounts: { 'COUNTY OF GREY': 800 },
      pavedStatusCounts: { '2': 3000 }
    }, null, 2));

    fs.writeFileSync(path.join(produceDir, 'grey-baseline-municipality-summary.csv'), [
      'municipalityId,municipalityName,population2021,landAreaKm2,densityPerKm2,settlementFeatureCount,landUseFeatureCount,roadFeatureCount,roadKm,roadKmPer1000Residents,roadKmPerKm2,dominantRoadClasses,dominantRoadJurisdictions,dominantLandUseCategories',
      'owen-sound,Owen Sound,21612,24.21,892.7,5,30,100,85.2,3.9,3.5,5:80|3:20,CITY OF OWEN SOUND:100,settlement:20|hazard:10'
    ].join('\n'));

    fs.writeFileSync(path.join(produceDir, 'grey-secondary-data-summary.json'), JSON.stringify({ transitStopCount: 23 }, null, 2));
    fs.writeFileSync(path.join(produceDir, 'grey-gis-summary.json'), JSON.stringify({}, null, 2));
    fs.writeFileSync(path.join(produceDir, 'grey-county-open-data-metrics.json'), JSON.stringify({ years: [{ localFoodCoverageRatio: 0.724, foodSurplusGJ: -107763.23, averageRent: 1256.1, ruralTransitionPressureIndex: 0.45 }], seedMeta: { summary: { roadSource: 'grey-open-data' } } }, null, 2));

    try {
      const { report, paths } = buildGreyPublicBaselineReport({ inputDir, produceDir });
      expect(fs.existsSync(paths.markdownPath)).toBe(true);
      expect(fs.existsSync(paths.jsonPath)).toBe(true);
      expect(fs.existsSync(paths.municipalCsvPath)).toBe(true);

      const markdown = fs.readFileSync(paths.markdownPath, 'utf8');
      expect(markdown).toContain('real open-data facts');
      expect(markdown).toContain('modelled assumptions');

      const json = JSON.parse(fs.readFileSync(paths.jsonPath, 'utf8'));
      expect(json).toHaveProperty('generatedAt');
      expect(json).toHaveProperty('dataStatus');
      expect(json).toHaveProperty('coreLayers');
      expect(json).toHaveProperty('secondaryLayers');
      expect(json).toHaveProperty('regionalIndicators');
      expect(json).toHaveProperty('municipalityIndicators');
      expect(json).toHaveProperty('serviceAccessIndicators');
      expect(json).toHaveProperty('ruralTransitionRelevance');
      expect(json).toHaveProperty('missingOrSynthetic');
      expect(json).toHaveProperty('warnings');
      expect(json).toHaveProperty('sourceFiles');

      expect(report.serviceAccessIndicators.transitStopCount).toBe(23);

      const municipalCsv = fs.readFileSync(paths.municipalCsvPath, 'utf8');
      expect(municipalCsv.split('\n')[0]).toContain('municipalityName');
      expect(municipalCsv.split('\n')[0]).toContain('dominantRoadClasses');
      expect(municipalCsv.split('\n')[0]).toContain('dominantLandUseCategories');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('tolerates missing secondary files with warnings', () => {
    const root = path.resolve('know/produce/public-baseline-missing-fixture');
    const inputDir = path.join(root, 'input');
    const produceDir = path.join(root, 'produce');
    fs.mkdirSync(inputDir, { recursive: true });
    fs.mkdirSync(produceDir, { recursive: true });

    writeGeoJson(path.join(inputDir, 'municipality-boundaries.geojson'), 1);
    writeGeoJson(path.join(inputDir, 'settlement-boundaries.geojson'), 1);
    writeGeoJson(path.join(inputDir, 'official-plan-schedule-a-land-use.geojson'), 1);
    writeGeoJson(path.join(inputDir, 'road-centrelines-grey.geojson'), 1);
    fs.writeFileSync(path.join(produceDir, 'grey-baseline-summary.json'), JSON.stringify({ totalPopulation2021: 100, totalLandAreaKm2: 10 }, null, 2));
    fs.writeFileSync(path.join(produceDir, 'grey-baseline-municipality-summary.csv'), 'municipalityId,municipalityName\na,a');

    try {
      const { report } = buildGreyPublicBaselineReport({ inputDir, produceDir });
      expect(report.warnings.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('grey:status command exits successfully', () => {
    const run = spawnSync('node', ['command/grey_status.mjs'], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('Grey Model Status');
  });
});
