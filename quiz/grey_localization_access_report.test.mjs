import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { buildGreyLocalizationAccessReport } from '../program/report/grey_localization_access_report.mjs';

function writeGeo(filePath, features) {
  fs.writeFileSync(filePath, JSON.stringify({ type: 'FeatureCollection', features }, null, 2));
}

function pointFeature(id, x, y, props = {}) {
  return { type: 'Feature', properties: { id, ...props }, geometry: { type: 'Point', coordinates: [x, y] } };
}

function polyFeature(id, minX, minY, maxX, maxY, props = {}) {
  return {
    type: 'Feature',
    properties: { id, ...props },
    geometry: {
      type: 'Polygon',
      coordinates: [[[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY], [minX, minY]]]
    }
  };
}

describe('grey localization access report', () => {
  test('command writes markdown/json/csv and role-specific scores are finite', () => {
    const root = path.resolve('know/produce/localization-access-fixture');
    const inputDir = path.join(root, 'input');
    const produceDir = path.join(root, 'produce');
    fs.mkdirSync(inputDir, { recursive: true });
    fs.mkdirSync(produceDir, { recursive: true });

    const muni = [
      polyFeature(1, -81.2, 44.4, -80.8, 44.8, { MUNICIPAL: 'Owen Sound' }),
      polyFeature(2, -80.8, 44.4, -80.4, 44.8, { MUNICIPAL: 'West Grey' })
    ];
    writeGeo(path.join(inputDir, 'municipality-boundaries.geojson'), muni);
    writeGeo(path.join(inputDir, 'settlement-boundaries.geojson'), [
      polyFeature(1, -81.1, 44.5, -81.0, 44.6, { SETTL_NAME: 'Core A' }),
      polyFeature(2, -80.95, 44.5, -80.85, 44.6, { SETTL_NAME: 'Edge B' })
    ]);
    writeGeo(path.join(inputDir, 'official-plan-schedule-a-land-use.geojson'), [
      polyFeature(1, -81.2, 44.45, -80.9, 44.7, { LANDUSE: 'Agricultural' }),
      polyFeature(2, -80.9, 44.45, -80.6, 44.7, { LANDUSE: 'Rural' }),
      polyFeature(3, -81.02, 44.52, -80.88, 44.64, { LANDUSE: 'Industrial Business Park' })
    ]);
    writeGeo(path.join(inputDir, 'road-centrelines-grey.geojson'), [pointFeature(1, -81.05, 44.55), pointFeature(2, -80.92, 44.56)]);
    writeGeo(path.join(inputDir, 'lots-and-concessions-grey.geojson'), [pointFeature(1, -81.03, 44.56), pointFeature(2, -80.9, 44.57), pointFeature(3, -80.91, 44.575)]);
    writeGeo(path.join(inputDir, 'grey-transit-bus-stops.geojson'), [pointFeature(1, -81.04, 44.56)]);
    writeGeo(path.join(inputDir, 'official-road-cycling-routes.geojson'), [pointFeature(1, -81.06, 44.57)]);
    writeGeo(path.join(inputDir, 'county-trails.geojson'), [pointFeature(1, -81.07, 44.57)]);
    writeGeo(path.join(inputDir, 'cp-rail-trail.geojson'), [pointFeature(1, -81.08, 44.58)]);
    writeGeo(path.join(inputDir, 'hiking-trails.geojson'), [pointFeature(1, -81.08, 44.59)]);
    writeGeo(path.join(inputDir, 'on-farm-rural-business-listing.geojson'), [
      pointFeature(1, -80.91, 44.56, { NAME: 'Farm Depot Market' })
    ]);
    writeGeo(path.join(inputDir, 'public-facilities.geojson'), [
      pointFeature(1, -81.0, 44.55, { NAME: 'Tom Thomson Art Gallery', TYPE: 'Gallery' }),
      pointFeature(2, -81.005, 44.552, { NAME: 'Owen Sound Public Library', TYPE: 'Library' })
    ]);
    writeGeo(path.join(inputDir, 'managed-forest-boundary.geojson'), [polyFeature(1, -80.94, 44.5, -80.84, 44.64)]);
    writeGeo(path.join(inputDir, 'bridges-culverts-structures.geojson'), [pointFeature(1, -81.1, 44.6)]);
    writeGeo(path.join(inputDir, 'road-condition.geojson'), [pointFeature(1, -81.1, 44.61)]);

    fs.writeFileSync(path.join(produceDir, 'grey-baseline-municipality-summary.csv'), [
      'municipalityId,municipalityName,population2021,roadKm,roadKmPer1000Residents',
      'owen-sound,Owen Sound,21612,85.2,3.9',
      'west-grey,West Grey,13131,250,19.0'
    ].join('\n'));

    fs.writeFileSync(path.join(produceDir, 'grey-land-access-baseline.json'), JSON.stringify({
      opportunityCategoryCounts: { ruralFoodAccessOpportunity: 100, cooperativeLandAccessCandidate: 40 }
    }, null, 2));
    fs.writeFileSync(path.join(produceDir, 'grey-labour-land-baseline.json'), JSON.stringify({
      regionalIndicators: { availableFoodWorkerFTE: 1000, lowFuelFoodWorkersNeeded: 1200 }
    }, null, 2));
    fs.writeFileSync(path.join(produceDir, 'grey-food-calibration.json'), JSON.stringify({
      plausibilityScenarios: [
        { scenario: 'localizedPresentTechBaseline', foodCoverage: 0.47 },
        { scenario: 'constrainedLocalFoodBaseline', foodCoverage: 0.27 },
        { scenario: 'lowFuelTransitionBaseline', foodCoverage: 0.16 }
      ]
    }, null, 2));

    try {
      const { report, paths } = buildGreyLocalizationAccessReport({ inputDir, produceDir });
      expect(fs.existsSync(paths.markdownPath)).toBe(true);
      expect(fs.existsSync(paths.jsonPath)).toBe(true);
      expect(fs.existsSync(paths.municipalCsvPath)).toBe(true);
      expect(fs.existsSync(paths.candidateCsvPath)).toBe(true);

      expect(report.candidateNodes.length).toBeGreaterThan(0);
      for (const c of report.candidateNodes) {
        expect(Number.isFinite(c.finalScore)).toBe(true);
        expect(Number.isFinite(c.roleFitScore)).toBe(true);
      }
      for (const m of report.municipalLocalizationMetrics) {
        expect(m.localizationReadinessScore).toBeGreaterThanOrEqual(0);
        expect(m.localizationReadinessScore).toBeLessThanOrEqual(1);
      }

      // Library/gallery should not top storage processing when rural business/depot signal exists.
      const topStorage = report.regionalSummary.topStorageProcessingCandidates[0];
      expect(normalize(topStorage?.name)).not.toContain('library');
      expect(normalize(topStorage?.name)).not.toContain('gallery');

      // Library can still be a coordination/education node.
      const topCoord = report.regionalSummary.topCoordinationEducationCandidates.map((x) => normalize(x.name)).join(' | ');
      expect(topCoord.includes('library') || topCoord.includes('gallery')).toBe(true);

      // Wood energy should show managed-forest/rural context and remain finite.
      const topWood = report.regionalSummary.topWoodEnergyDepotCandidates[0];
      expect(Number.isFinite(topWood.score)).toBe(true);

      const md = fs.readFileSync(paths.markdownPath, 'utf8');
      expect(md).toContain('role-specific');
      expect(md).toContain('not ownership or feasibility claims');

      const header = fs.readFileSync(paths.candidateCsvPath, 'utf8').split('\n')[0];
      expect(header).toContain('roleFitScore');
      expect(header).toContain('caution');
      expect(header).toContain('candidateFacilityType');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('missing optional files warn but report still succeeds', () => {
    const root = path.resolve('know/produce/localization-access-missing-fixture');
    const inputDir = path.join(root, 'input');
    const produceDir = path.join(root, 'produce');
    fs.mkdirSync(inputDir, { recursive: true });
    fs.mkdirSync(produceDir, { recursive: true });
    writeGeo(path.join(inputDir, 'municipality-boundaries.geojson'), [polyFeature(1, -81.2, 44.4, -80.8, 44.8, { MUNICIPAL: 'Owen Sound' })]);

    try {
      const { report } = buildGreyLocalizationAccessReport({ inputDir, produceDir });
      expect(report.warnings.length).toBeGreaterThan(0);
      expect(report.warnings.join('\n')).toContain('Missing lots and concessions');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('command exits successfully', () => {
    const root = path.resolve('know/produce/localization-access-command-fixture');
    const inputDir = path.join(root, 'input');
    const produceDir = path.join(root, 'produce');
    fs.mkdirSync(inputDir, { recursive: true });
    fs.mkdirSync(produceDir, { recursive: true });
    writeGeo(path.join(inputDir, 'municipality-boundaries.geojson'), [polyFeature(1, -81.2, 44.4, -80.8, 44.8, { MUNICIPAL: 'Owen Sound' })]);
    writeGeo(path.join(inputDir, 'settlement-boundaries.geojson'), [polyFeature(1, -81.1, 44.5, -81.0, 44.6, { SETTL_NAME: 'Core' })]);
    writeGeo(path.join(inputDir, 'official-plan-schedule-a-land-use.geojson'), [polyFeature(1, -81.2, 44.45, -80.9, 44.7, { LANDUSE: 'Agricultural' })]);
    writeGeo(path.join(inputDir, 'road-centrelines-grey.geojson'), [pointFeature(1, -81.05, 44.55)]);
    writeGeo(path.join(inputDir, 'public-facilities.geojson'), [pointFeature(1, -81.04, 44.56, { NAME: 'Community Centre', TYPE: 'Community Centre' })]);
    try {
      const run = spawnSync(
        'node',
        ['command/report_grey_localization_access.mjs', `--input-dir=${inputDir}`, `--produce-dir=${produceDir}`],
        { encoding: 'utf8' }
      );
      expect(run.status).toBe(0);
      expect(run.stdout).toContain('candidate nodes');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

function normalize(v) {
  return String(v ?? '').toLowerCase();
}
