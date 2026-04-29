import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import {
  buildGreyLandAccessReport,
  distancePointToLineKm,
  deriveOpportunityCategory
} from '../program/report/grey_land_access_report.mjs';

function fc(features) {
  return { type: 'FeatureCollection', features };
}

describe('grey land access report', () => {
  test('distance helper works for point-to-line threshold', () => {
    const d = distancePointToLineKm([-80.9, 44.5], { type: 'LineString', coordinates: [[-80.9, 44.49], [-80.9, 44.51]] });
    expect(d).toBeLessThan(0.2);
  });

  test('opportunity rules classify constrained, settlement, rural, and cooperative categories', () => {
    expect(deriveOpportunityCategory({
      landUseCategory: 'hazard',
      hazard: true,
      wetland: false,
      settlementAdjacent: false,
      roadAccessible: true,
      trailOrCyclingAccessible: false,
      transitAccessible: false,
      ruralBusinessNearby: false,
      publicFacilityNearby: false,
      managedForestAdjacent: false
    }).opportunityCategory).toBe('constrainedLand');

    expect(deriveOpportunityCategory({
      landUseCategory: 'settlement',
      hazard: false,
      wetland: false,
      settlementAdjacent: true,
      roadAccessible: true,
      trailOrCyclingAccessible: false,
      transitAccessible: false,
      ruralBusinessNearby: false,
      publicFacilityNearby: false,
      managedForestAdjacent: false
    }).opportunityCategory).toBe('settlementGardenOpportunity');

    expect(deriveOpportunityCategory({
      landUseCategory: 'agricultural',
      hazard: false,
      wetland: false,
      settlementAdjacent: false,
      roadAccessible: true,
      trailOrCyclingAccessible: false,
      transitAccessible: false,
      ruralBusinessNearby: false,
      publicFacilityNearby: false,
      managedForestAdjacent: false
    }).opportunityCategory).toBe('ruralFoodAccessOpportunity');

    expect(deriveOpportunityCategory({
      landUseCategory: 'rural',
      hazard: false,
      wetland: false,
      settlementAdjacent: false,
      roadAccessible: true,
      trailOrCyclingAccessible: true,
      transitAccessible: false,
      ruralBusinessNearby: false,
      publicFacilityNearby: false,
      managedForestAdjacent: false
    }).opportunityCategory).toBe('cooperativeLandAccessCandidate');
  });

  test('build report classifies and writes outputs from fixture', () => {
    const root = path.resolve('know/produce/land-access-fixture');
    const inputDir = path.join(root, 'input');
    const outputDir = path.join(root, 'output');
    fs.mkdirSync(inputDir, { recursive: true });
    fs.mkdirSync(outputDir, { recursive: true });

    fs.writeFileSync(path.join(inputDir, 'municipality-boundaries.geojson'), JSON.stringify(fc([
      { type: 'Feature', properties: { MUN_NAME: 'Owen Sound' }, geometry: { type: 'Polygon', coordinates: [[[-81,44],[-80.7,44],[-80.7,44.3],[-81,44.3],[-81,44]]] } },
      { type: 'Feature', properties: { MUN_NAME: 'West Grey' }, geometry: { type: 'Polygon', coordinates: [[[-81,44.3],[-80.7,44.3],[-80.7,44.6],[-81,44.6],[-81,44.3]]] } }
    ])));

    fs.writeFileSync(path.join(inputDir, 'settlement-boundaries.geojson'), JSON.stringify(fc([
      { type: 'Feature', properties: { NAME: 'Core' }, geometry: { type: 'Polygon', coordinates: [[[-80.95,44.05],[-80.85,44.05],[-80.85,44.15],[-80.95,44.15],[-80.95,44.05]]] } }
    ])));

    fs.writeFileSync(path.join(inputDir, 'official-plan-schedule-a-land-use.geojson'), JSON.stringify(fc([
      { type: 'Feature', properties: { Final_Type: 'Settlement Area' }, geometry: { type: 'Polygon', coordinates: [[[-80.96,44.04],[-80.84,44.04],[-80.84,44.16],[-80.96,44.16],[-80.96,44.04]]] } },
      { type: 'Feature', properties: { Final_Type: 'Agricultural' }, geometry: { type: 'Polygon', coordinates: [[[-80.96,44.16],[-80.84,44.16],[-80.84,44.28],[-80.96,44.28],[-80.96,44.16]]] } },
      { type: 'Feature', properties: { Final_Type: 'Hazard Lands' }, geometry: { type: 'Polygon', coordinates: [[[-80.96,44.28],[-80.84,44.28],[-80.84,44.36],[-80.96,44.36],[-80.96,44.28]]] } }
    ])));

    fs.writeFileSync(path.join(inputDir, 'road-centrelines-grey.geojson'), JSON.stringify(fc([
      { type: 'Feature', properties: { ROAD_NAME: 'A' }, geometry: { type: 'LineString', coordinates: [[-80.95,44.05],[-80.85,44.05]] } }
    ])));

    fs.writeFileSync(path.join(inputDir, 'lots-and-concessions-grey.geojson'), JSON.stringify(fc([
      { type: 'Feature', properties: { OBJECTID: 1, MUNICIPALITY: 'Owen Sound', LOT: '1', CONCESSION: '2', TOWNSHIP: 'X' }, geometry: { type: 'Polygon', coordinates: [[[-80.94,44.06],[-80.93,44.06],[-80.93,44.07],[-80.94,44.07],[-80.94,44.06]]] } },
      { type: 'Feature', properties: { OBJECTID: 2, LOT: '2', CONCESSION: '3', TOWNSHIP: 'X' }, geometry: { type: 'Polygon', coordinates: [[[-80.94,44.18],[-80.93,44.18],[-80.93,44.19],[-80.94,44.19],[-80.94,44.18]]] } },
      { type: 'Feature', properties: { OBJECTID: 3, LOT: '3', CONCESSION: '4', TOWNSHIP: 'X' }, geometry: { type: 'Polygon', coordinates: [[[-80.94,44.30],[-80.93,44.30],[-80.93,44.31],[-80.94,44.31],[-80.94,44.30]]] } }
    ])));

    fs.writeFileSync(path.join(inputDir, 'grey-transit-bus-stops.geojson'), JSON.stringify(fc([
      { type: 'Feature', properties: { id: 1 }, geometry: { type: 'Point', coordinates: [-80.93, 44.065] } }
    ])));
    fs.writeFileSync(path.join(inputDir, 'official-road-cycling-routes.geojson'), JSON.stringify(fc([
      { type: 'Feature', properties: { id: 1 }, geometry: { type: 'LineString', coordinates: [[-80.94,44.17],[-80.93,44.17]] } }
    ])));
    fs.writeFileSync(path.join(inputDir, 'county-trails.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputDir, 'cp-rail-trail.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputDir, 'hiking-trails.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputDir, 'managed-forest-boundary.geojson'), JSON.stringify(fc([
      { type: 'Feature', properties: { id: 1 }, geometry: { type: 'Polygon', coordinates: [[[-80.95,44.16],[-80.9,44.16],[-80.9,44.21],[-80.95,44.21],[-80.95,44.16]]] } }
    ])));
    fs.writeFileSync(path.join(inputDir, 'on-farm-rural-business-listing.geojson'), JSON.stringify(fc([
      { type: 'Feature', properties: { id: 1 }, geometry: { type: 'Point', coordinates: [-80.93, 44.185] } }
    ])));
    fs.writeFileSync(path.join(inputDir, 'public-facilities.geojson'), JSON.stringify(fc([
      { type: 'Feature', properties: { id: 1 }, geometry: { type: 'Point', coordinates: [-80.93, 44.185] } }
    ])));

    try {
      const { report, paths } = buildGreyLandAccessReport({ inputDir, outputDir });
      expect(report.assignment.totalLotConcessionFeatures).toBe(3);
      expect(report.assignment.assignedToMunicipalityCount).toBe(3);
      expect(report.assignment.assignedBySourcePropertyCount).toBe(1);
      expect(report.assignment.assignedByGeometryCount).toBe(2);
      const totalCategorized = Object.values(report.opportunityCategoryCounts).reduce((sum, v) => sum + Number(v || 0), 0);
      expect(totalCategorized).toBe(3);
      expect((report.opportunityCategoryCounts.constrainedLand ?? 0)).toBeGreaterThanOrEqual(1);

      const detail = fs.readFileSync(paths.detailCsvPath, 'utf8');
      expect(detail).toContain('limitingFactors');
      const markdown = fs.readFileSync(paths.markdownPath, 'utf8');
      expect(markdown).toContain('not ownership parcels');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('report command writes markdown/json/csv', () => {
    const run = spawnSync('node', ['command/report_grey_land_access.mjs'], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('total lots/concessions');
  });

  test('missing lots input includes explicit download warning and exits cleanly', () => {
    const root = path.resolve('know/produce/land-access-missing-lots');
    const inputDir = path.join(root, 'input');
    const outputDir = path.join(root, 'output');
    fs.mkdirSync(inputDir, { recursive: true });
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(inputDir, 'municipality-boundaries.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputDir, 'settlement-boundaries.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputDir, 'official-plan-schedule-a-land-use.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputDir, 'road-centrelines-grey.geojson'), JSON.stringify(fc([])));

    try {
      const { report, paths } = buildGreyLandAccessReport({ inputDir, outputDir });
      expect(report.assignment.totalLotConcessionFeatures).toBe(0);
      expect(report.warnings.some((w) => w.includes('Missing lots-and-concessions-grey.geojson'))).toBe(true);
      const markdown = fs.readFileSync(paths.markdownPath, 'utf8');
      expect(markdown).toContain('npm run grey:download-data -- --source=lots-and-concessions-grey');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
