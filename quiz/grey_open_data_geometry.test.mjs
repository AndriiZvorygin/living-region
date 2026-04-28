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

    try {
      const world = generateGreyCountyWorld({
        scale: 'small',
        useOpenDataGeometry: true,
        openDataInputDir: dir
      });
      expect(world.seedMeta.summary.municipalityFeaturesMatched).toBe(1);
      expect(world.seedMeta.summary.landUseFeaturesImported).toBe(1);
      expect(world.seedMeta.summary.landUseCategoryCounts.agricultural).toBe(1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
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
});
