import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  normalizeName,
  detectLandUseField,
  mapOfficialPlanLandUseCategory,
  mapSettlementType
} from '../program/data/grey_land_use_mapping.mjs';
import { generateGreyCountyWorld } from '../program/data/generate_grey_county_world.mjs';

describe('grey open-data geometry mapping', () => {
  test('municipality name normalization supports matching', () => {
    expect(normalizeName('The Blue Mountains')).toBe(normalizeName('the blue mountains'));
    expect(normalizeName('Owen-Sound')).toBe(normalizeName('Owen Sound'));
  });

  test('land-use field detection works', () => {
    expect(detectLandUseField({ LAND_USE: 'Agricultural' })).toBe('LAND_USE');
    expect(detectLandUseField({ designation: 'Rural' })).toBe('designation');
  });

  test('land-use category mapping works', () => {
    expect(mapOfficialPlanLandUseCategory('Industrial Business Park Settlement Area')).toBe('industrialBusinessPark');
    expect(mapOfficialPlanLandUseCategory('Agricultural')).toBe('agricultural');
    expect(mapOfficialPlanLandUseCategory('Significant Wetland')).toBe('wetland');
  });

  test('settlement type mapping works', () => {
    expect(mapSettlementType('Primary')).toBe('primarySettlement');
    expect(mapSettlementType('Secondary')).toBe('secondarySettlement');
    expect(mapSettlementType('Hamlet')).toBe('hamlet');
  });

  test('open-data geometry generator falls back when files are missing', () => {
    const world = generateGreyCountyWorld({
      scale: 'small',
      useOpenDataGeometry: true,
      openDataInputDir: path.resolve('know/input/does-not-exist')
    });
    expect(world.seedMeta.geometrySource).toBe('grey-open-data');
    expect(world.seedMeta.summary.municipalityFeaturesMatched).toBe(0);
    expect((world.seedMeta.warnings ?? []).length).toBeGreaterThan(0);
  });

  test('open-data geometry generator imports real fixture features when present', () => {
    const dir = path.resolve('know/input/gis-geometry-fixture');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'municipality-boundaries.geojson'), JSON.stringify({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { MUN_NAME: 'Owen Sound' }, geometry: { type: 'Polygon', coordinates: [] } }]
    }));
    fs.writeFileSync(path.join(dir, 'settlement-boundaries.geojson'), JSON.stringify({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { NAME: 'Owen Sound', TYPE: 'Primary', MUNICIPAL: 'OS' }, geometry: { type: 'Polygon', coordinates: [] } }]
    }));
    fs.writeFileSync(path.join(dir, 'official-plan-schedule-a-land-use.geojson'), JSON.stringify({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { LAND_USE: 'Agricultural', MUNICIPAL: 'OS' }, geometry: { type: 'Polygon', coordinates: [] } }]
    }));
    fs.writeFileSync(path.join(dir, 'road-centrelines-grey.geojson'), JSON.stringify({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { ROAD_NAME: 'Main St', ORN_ROAD_CLASS: 5, JURIS_L: 'CITY OF OWEN SOUND', PAVED_STATUS: 2, SPEED_LIMI: 60, LANE_COUNT: 2 }, geometry: { type: 'LineString', coordinates: [[-80.9, 44.5], [-80.91, 44.51]] } }]
    }));

    try {
      const world = generateGreyCountyWorld({
        scale: 'small',
        useOpenDataGeometry: true,
        openDataInputDir: dir
      });
      expect(world.seedMeta.summary.municipalityFeaturesMatched).toBe(1);
      expect(world.seedMeta.summary.landUseFeaturesImported).toBe(1);
      expect(world.seedMeta.summary.landUseCategoryCounts.agricultural).toBe(1);
      expect(world.seedMeta.summary.roadSource).toBe('grey-open-data');
      expect(world.seedMeta.summary.roadClassCounts['5']).toBe(1);
      expect(world.seedMeta.summary.roadJurisdictionCounts['CITY OF OWEN SOUND']).toBe(1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('open-data world falls back to synthetic roads when road file missing', () => {
    const dir = path.resolve('know/input/gis-geometry-fixture-no-roads');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'municipality-boundaries.geojson'), JSON.stringify({ type: 'FeatureCollection', features: [] }));
    fs.writeFileSync(path.join(dir, 'settlement-boundaries.geojson'), JSON.stringify({ type: 'FeatureCollection', features: [] }));
    fs.writeFileSync(path.join(dir, 'official-plan-schedule-a-land-use.geojson'), JSON.stringify({ type: 'FeatureCollection', features: [] }));
    try {
      const world = generateGreyCountyWorld({ scale: 'small', useOpenDataGeometry: true, openDataInputDir: dir });
      expect(world.seedMeta.summary.roadSource).toBe('synthetic');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('import creates separate secondary collections', () => {
    const dir = path.resolve('know/input/gis-secondary-import-fixture');
    const outPath = path.resolve('know/produce/grey-open-data-world-secondary-test.json');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'municipality-boundaries.geojson'), JSON.stringify({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { MUN_NAME: 'Owen Sound' }, geometry: { type: 'Polygon', coordinates: [[[-81,44],[-80.8,44],[-80.8,44.2],[-81,44.2],[-81,44]]] } }]
    }));
    fs.writeFileSync(path.join(dir, 'settlement-boundaries.geojson'), JSON.stringify({ type: 'FeatureCollection', features: [] }));
    fs.writeFileSync(path.join(dir, 'official-plan-schedule-a-land-use.geojson'), JSON.stringify({ type: 'FeatureCollection', features: [] }));
    fs.writeFileSync(path.join(dir, 'road-centrelines-grey.geojson'), JSON.stringify({ type: 'FeatureCollection', features: [] }));
    fs.writeFileSync(path.join(dir, 'grey-transit-bus-stops.geojson'), JSON.stringify({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { NAME: 'Stop A' }, geometry: { type: 'Point', coordinates: [-80.9, 44.1] } }]
    }));
    fs.writeFileSync(path.join(dir, 'county-trails.geojson'), JSON.stringify({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { NAME: 'Trail A' }, geometry: { type: 'LineString', coordinates: [[-80.95,44.05],[-80.9,44.1]] } }]
    }));
    fs.writeFileSync(path.join(dir, 'lots-and-concessions-grey.geojson'), JSON.stringify({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { LOT: '12', CONCESSION: '3', TOWNSHIP: 'Owen Sound Township' },
        geometry: { type: 'Polygon', coordinates: [[[-80.95,44.05],[-80.9,44.05],[-80.9,44.1],[-80.95,44.1],[-80.95,44.05]]] }
      }]
    }));
    try {
      const run = spawnSync('node', ['command/import_grey_open_data.mjs', `--dir=${dir}`, `--out=${outPath}`], { encoding: 'utf8' });
      expect(run.status).toBe(0);
      const parsed = JSON.parse(fs.readFileSync(outPath, 'utf8'));
      expect(parsed.transitStops.length).toBe(1);
      expect(parsed.trails.length).toBe(1);
      expect(parsed.lotsAndConcessions.length).toBe(1);
      expect(parsed.lotsAndConcessions[0].sourceProperties.LOT).toBe('12');
      expect(parsed.lotsAndConcessions[0].municipalityId).toBeTruthy();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
      fs.rmSync(outPath, { force: true });
    }
  });

  test('seed:grey:open-data command exits successfully when downloaded files exist', () => {
    const required = [
      path.resolve('know/input/gis/municipality-boundaries.geojson'),
      path.resolve('know/input/gis/settlement-boundaries.geojson'),
      path.resolve('know/input/gis/official-plan-schedule-a-land-use.geojson')
    ];
    if (!required.every((file) => fs.existsSync(file))) {
      return;
    }
    const run = spawnSync('npm', ['run', 'seed:grey:open-data'], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('land-use category counts');
  });

  test('open-data seed summary includes category counts and warnings', () => {
    const run = spawnSync('npm', ['run', 'seed:grey:open-data'], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    const summaryPath = path.resolve('know/produce/grey-county-open-data-summary.json');
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    expect(summary.landUseCategoryCounts).toBeTruthy();
    expect(Array.isArray(summary.warnings)).toBe(true);
  });

  test('seed and demo secondary counts agree when open-data inputs exist', () => {
    const required = [
      path.resolve('know/input/gis/municipality-boundaries.geojson'),
      path.resolve('know/input/gis/settlement-boundaries.geojson'),
      path.resolve('know/input/gis/official-plan-schedule-a-land-use.geojson')
    ];
    if (!required.every((file) => fs.existsSync(file))) return;

    const seedRun = spawnSync('npm', ['run', 'seed:grey:open-data'], { encoding: 'utf8' });
    const demoRun = spawnSync('npm', ['run', 'demo:grey:open-data'], { encoding: 'utf8' });
    expect(seedRun.status).toBe(0);
    expect(demoRun.status).toBe(0);

    const parseCount = (stdout, key) => {
      const match = stdout.match(new RegExp(`${key}:\\s*([0-9]+(?:\\.[0-9]+)?)`));
      return match ? Number(match[1]) : null;
    };

    const keys = [
      'transitStopCount',
      'trailFeatureCount',
      'cyclingRouteFeatureCount',
      'managedForestFeatureCount',
      'ruralBusinessCount',
      'facilityCount',
      'roadStructureCount'
    ];
    for (const key of keys) {
      expect(parseCount(seedRun.stdout, key)).toBe(parseCount(demoRun.stdout, key));
    }
  });
});
