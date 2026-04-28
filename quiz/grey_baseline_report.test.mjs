import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { buildGreyBaselineReport } from '../program/report/grey_baseline_report.mjs';

function writeGeoJson(filePath, features) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify({ type: 'FeatureCollection', features }, null, 2));
}

describe('grey baseline report', () => {
  test('baseline report reads fixture roads and counts total km', () => {
    const inputDir = path.resolve('know/input/gis-baseline-fixture-1');
    const outputDir = path.resolve('know/produce/baseline-fixture-1');
    writeGeoJson(path.join(inputDir, 'municipality-boundaries.geojson'), []);
    writeGeoJson(path.join(inputDir, 'settlement-boundaries.geojson'), []);
    writeGeoJson(path.join(inputDir, 'official-plan-schedule-a-land-use.geojson'), []);
    writeGeoJson(path.join(inputDir, 'road-centrelines-grey.geojson'), [
      { type: 'Feature', properties: { LENGTH_KM: 1.5, ORN_ROAD_CLASS: 'A' }, geometry: null },
      { type: 'Feature', properties: { LENGTH_KM: 2.5, ORN_ROAD_CLASS: 'A' }, geometry: null }
    ]);
    try {
      const { summary } = buildGreyBaselineReport({ inputDir, outputDir });
      expect(summary.totalRoadKm).toBeCloseTo(4.0, 6);
      expect(summary.roadClassCounts.A).toBe(2);
    } finally {
      fs.rmSync(inputDir, { recursive: true, force: true });
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  test('road km per 1000 residents and km2 are calculated', () => {
    const inputDir = path.resolve('know/input/gis-baseline-fixture-2');
    const outputDir = path.resolve('know/produce/baseline-fixture-2');
    writeGeoJson(path.join(inputDir, 'municipality-boundaries.geojson'), []);
    writeGeoJson(path.join(inputDir, 'settlement-boundaries.geojson'), []);
    writeGeoJson(path.join(inputDir, 'official-plan-schedule-a-land-use.geojson'), []);
    writeGeoJson(path.join(inputDir, 'road-centrelines-grey.geojson'), [
      { type: 'Feature', properties: { LENGTH_KM: 100 }, geometry: null }
    ]);
    try {
      const { summary } = buildGreyBaselineReport({ inputDir, outputDir });
      expect(summary.roadKmPer1000Residents).toBeGreaterThan(0);
      expect(summary.roadKmPerKm2).toBeGreaterThan(0);
    } finally {
      fs.rmSync(inputDir, { recursive: true, force: true });
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  test('land-use category summary groups correctly and assignment warnings are emitted', () => {
    const inputDir = path.resolve('know/input/gis-baseline-fixture-3');
    const outputDir = path.resolve('know/produce/baseline-fixture-3');
    writeGeoJson(path.join(inputDir, 'municipality-boundaries.geojson'), []);
    writeGeoJson(path.join(inputDir, 'settlement-boundaries.geojson'), []);
    writeGeoJson(path.join(inputDir, 'official-plan-schedule-a-land-use.geojson'), [
      { type: 'Feature', properties: { LAND_USE: 'Agricultural' }, geometry: null },
      { type: 'Feature', properties: { LAND_USE: 'Rural' }, geometry: null }
    ]);
    writeGeoJson(path.join(inputDir, 'road-centrelines-grey.geojson'), []);
    try {
      const { summary } = buildGreyBaselineReport({ inputDir, outputDir });
      expect(summary.landUseCategoryCounts.agricultural).toBe(1);
      expect(summary.landUseCategoryCounts.rural).toBe(1);
      expect((summary.warnings ?? []).length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(inputDir, { recursive: true, force: true });
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  test('land-use and roads without municipality property assign by centroid', () => {
    const inputDir = path.resolve('know/input/gis-baseline-fixture-4');
    const outputDir = path.resolve('know/produce/baseline-fixture-4');
    writeGeoJson(path.join(inputDir, 'municipality-boundaries.geojson'), [
      { type: 'Feature', properties: { MUN_NAME: 'Owen Sound' }, geometry: { type: 'Polygon', coordinates: [[[-81, 44], [-80.8, 44], [-80.8, 44.2], [-81, 44.2], [-81, 44]]] } }
    ]);
    writeGeoJson(path.join(inputDir, 'settlement-boundaries.geojson'), []);
    writeGeoJson(path.join(inputDir, 'official-plan-schedule-a-land-use.geojson'), [
      { type: 'Feature', properties: { LAND_USE: 'Agricultural' }, geometry: { type: 'Polygon', coordinates: [[[-80.95, 44.05], [-80.9, 44.05], [-80.9, 44.1], [-80.95, 44.1], [-80.95, 44.05]]] } }
    ]);
    writeGeoJson(path.join(inputDir, 'road-centrelines-grey.geojson'), [
      { type: 'Feature', properties: { ROAD_LENGT: 1000, ORN_ROAD_CLASS: 5, JURIS_L: 'CITY OF OWEN SOUND', PAVED_STATUS: 2, SPEED_LIMI: 80, LANE_COUNT: 2 }, geometry: { type: 'LineString', coordinates: [[-80.99, 44.01], [-80.91, 44.12]] } }
    ]);
    try {
      const { summary } = buildGreyBaselineReport({ inputDir, outputDir });
      expect(summary.assignmentDiagnostics.landUseAssignedToMunicipalityCount).toBe(1);
      expect(summary.assignmentDiagnostics.roadAssignedByGeometryCount + summary.assignmentDiagnostics.roadAssignedBySourcePropertyCount).toBe(1);
      expect(summary.roadClassCounts['5']).toBe(1);
    } finally {
      fs.rmSync(inputDir, { recursive: true, force: true });
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  test('report command exits successfully with real inputs', () => {
    const run = spawnSync('npm', ['run', 'report:grey:baseline'], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('output summary:');
  });

  test('missing input files produce clear errors', () => {
    const run = spawnSync('node', ['-e', "import { buildGreyBaselineReport } from './program/report/grey_baseline_report.mjs'; try { buildGreyBaselineReport({ inputDir: 'know/input/does-not-exist' }); process.exit(0); } catch (e) { console.log(e.message); process.exit(1); }"] , { encoding: 'utf8' });
    expect(run.status).toBe(1);
    expect(run.stdout + run.stderr).toContain('Missing required input');
  });
});
