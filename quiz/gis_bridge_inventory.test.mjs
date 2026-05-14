import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { buildLandAccessGroundtruthSummary } from '../program/reliability/land_access_groundtruth_intake.mjs';

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function square(x0, y0, x1, y1) {
  return {
    type: 'Polygon',
    coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]]
  };
}

describe('GIS inventory and bridge', () => {
  test('inventory detects GeoJSON fields/counts and produce GeoJSON is not primary source', () => {
    const root = path.resolve('know/produce/gis-bridge-fixture-inventory');
    fs.rmSync(root, { recursive: true, force: true });

    const gisDir = path.join(root, 'gis');
    const produceDir = path.join(root, 'produce');
    const qaDir = path.join(root, 'qa');
    const calibrationDir = path.join(root, 'calibration');
    const manifestPath = path.join(root, 'source-manifest.json');

    writeJson(path.join(gisDir, 'municipality-boundaries.geojson'), {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { MUNI_NAME: 'Test Muni' }, geometry: square(-81, 44, -80, 45) }]
    });
    writeJson(path.join(gisDir, 'lots-and-concessions-grey.geojson'), {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { OBJECTID: 1, LOT: 'LOT 1', CONCESSION: '1', TOWNSHIP: 'X', ShapeSTArea: 1000 }, geometry: square(-80.9, 44.1, -80.8, 44.2) }]
    });
    writeJson(path.join(produceDir, 'derived.geojson'), {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { id: 1 }, geometry: { type: 'Point', coordinates: [-80.5, 44.5] } }]
    });

    writeJson(manifestPath, { schema_version: '1.0.0', entries: [] });

    fs.mkdirSync(calibrationDir, { recursive: true });
    fs.writeFileSync(path.join(calibrationDir, 'parcels.csv'), 'parcel_id,municipality,land_area_m2,zoning_or_land_use,assessment_class,has_residential_use,source_ref,quality_tier,notes\n');
    fs.writeFileSync(path.join(calibrationDir, 'address-points.csv'), 'address_id,civic_address,municipality,latitude,longitude,source_ref,quality_tier,notes\n');
    fs.writeFileSync(path.join(calibrationDir, 'building-footprints.csv'), 'building_id,municipality,centroid_latitude,centroid_longitude,footprint_area_m2,building_type,source_ref,quality_tier,notes\n');
    fs.writeFileSync(path.join(calibrationDir, 'parcel-address-linkage.csv'), 'parcel_id,address_id,building_id,linkage_method,linkage_confidence,source_ref,quality_tier,notes\n');

    execSync(`node command/bridge_existing_gis_to_land_access_contracts.mjs --gis-dir=${gisDir} --produce-dir=${produceDir} --qa-dir=${qaDir} --calibration-dir=${calibrationDir} --manifest=${manifestPath}`, { stdio: 'pipe' });

    const inv = JSON.parse(fs.readFileSync(path.join(qaDir, 'gis-source-inventory.json'), 'utf8'));
    const lots = inv.items.find((x) => x.path.endsWith('lots-and-concessions-grey.geojson'));
    expect(lots.feature_count).toBe(1);
    expect(lots.fields).toContain('LOT');

    const derived = inv.items.find((x) => x.path.endsWith('derived.geojson'));
    expect(derived.primary_source_eligible).toBe(false);
  });

  test('bridge script does not overwrite manual rows', () => {
    const root = path.resolve('know/produce/gis-bridge-fixture-no-overwrite');
    fs.rmSync(root, { recursive: true, force: true });

    const gisDir = path.join(root, 'gis');
    const produceDir = path.join(root, 'produce');
    const qaDir = path.join(root, 'qa');
    const calibrationDir = path.join(root, 'calibration');
    const manifestPath = path.join(root, 'source-manifest.json');

    writeJson(path.join(gisDir, 'municipality-boundaries.geojson'), {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { MUNI_NAME: 'Test Muni' }, geometry: square(-81, 44, -80, 45) }]
    });
    writeJson(path.join(gisDir, 'lots-and-concessions-grey.geojson'), {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { OBJECTID: 1, LOT: 'LOT 1', CONCESSION: '1', TOWNSHIP: 'X', ShapeSTArea: 1000 }, geometry: square(-80.9, 44.1, -80.8, 44.2) }]
    });

    writeJson(manifestPath, {
      schema_version: '1.0.0',
      entries: [{
        source_id: 'grey_gis_lots_and_concessions_grey',
        title: 'lots',
        source_class: 'external_snapshot',
        local_path: path.relative(path.resolve('.'), path.join(gisDir, 'lots-and-concessions-grey.geojson')),
        content_hash: 'placeholder',
        schema_version: '1.0'
      }]
    });
    // fix hash
    const lotsPath = path.join(gisDir, 'lots-and-concessions-grey.geojson');
    const hash = `sha256:${crypto.createHash('sha256').update(fs.readFileSync(lotsPath)).digest('hex')}`;
    const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    m.entries[0].content_hash = hash;
    fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2));

    fs.mkdirSync(calibrationDir, { recursive: true });
    const manualRow = 'manual-1,Grey,100,res,res,true,manual_src,direct_local,manual\n';
    fs.writeFileSync(path.join(calibrationDir, 'parcels.csv'), `parcel_id,municipality,land_area_m2,zoning_or_land_use,assessment_class,has_residential_use,source_ref,quality_tier,notes\n${manualRow}`);
    fs.writeFileSync(path.join(calibrationDir, 'address-points.csv'), 'address_id,civic_address,municipality,latitude,longitude,source_ref,quality_tier,notes\n');
    fs.writeFileSync(path.join(calibrationDir, 'building-footprints.csv'), 'building_id,municipality,centroid_latitude,centroid_longitude,footprint_area_m2,building_type,source_ref,quality_tier,notes\n');
    fs.writeFileSync(path.join(calibrationDir, 'parcel-address-linkage.csv'), 'parcel_id,address_id,building_id,linkage_method,linkage_confidence,source_ref,quality_tier,notes\n');

    execSync(`node command/bridge_existing_gis_to_land_access_contracts.mjs --gis-dir=${gisDir} --produce-dir=${produceDir} --qa-dir=${qaDir} --calibration-dir=${calibrationDir} --manifest=${manifestPath} --apply`, { stdio: 'pipe' });

    const out = fs.readFileSync(path.join(calibrationDir, 'parcels.csv'), 'utf8');
    expect(out.includes('manual-1')).toBe(true);
    const lines = out.trim().split(/\r?\n/);
    expect(lines.length).toBe(2);
  });

  test('lot fabric without linkage yields partial_groundtruth, not direct', () => {
    const root = path.resolve('know/produce/gis-bridge-fixture-partial');
    fs.rmSync(root, { recursive: true, force: true });

    const gisDir = path.join(root, 'gis');
    const produceDir = path.join(root, 'produce');
    const qaDir = path.join(root, 'qa');
    const calibrationDir = path.join(root, 'calibration');
    const schemaDir = path.join(root, 'schema');
    const manifestPath = path.join(root, 'source-manifest.json');

    writeJson(path.join(gisDir, 'municipality-boundaries.geojson'), {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { MUNI_NAME: 'Test Muni' }, geometry: square(-81, 44, -80, 45) }]
    });
    writeJson(path.join(gisDir, 'lots-and-concessions-grey.geojson'), {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { OBJECTID: 1, LOT: 'LOT 1', CONCESSION: '1', TOWNSHIP: 'X', ShapeSTArea: 1000 }, geometry: square(-80.9, 44.1, -80.8, 44.2) }]
    });

    writeJson(manifestPath, { schema_version: '1.0.0', entries: [] });

    fs.mkdirSync(calibrationDir, { recursive: true });
    fs.writeFileSync(path.join(calibrationDir, 'parcels.csv'), 'parcel_id,municipality,land_area_m2,zoning_or_land_use,assessment_class,has_residential_use,source_ref,quality_tier,notes\n');
    fs.writeFileSync(path.join(calibrationDir, 'address-points.csv'), 'address_id,civic_address,municipality,latitude,longitude,source_ref,quality_tier,notes\n');
    fs.writeFileSync(path.join(calibrationDir, 'building-footprints.csv'), 'building_id,municipality,centroid_latitude,centroid_longitude,footprint_area_m2,building_type,source_ref,quality_tier,notes\n');
    fs.writeFileSync(path.join(calibrationDir, 'parcel-address-linkage.csv'), 'parcel_id,address_id,building_id,linkage_method,linkage_confidence,source_ref,quality_tier,notes\n');

    fs.mkdirSync(schemaDir, { recursive: true });
    writeJson(path.join(schemaDir, 'address-points.schema.json'), { ok: true });
    writeJson(path.join(schemaDir, 'building-footprints.schema.json'), { ok: true });
    writeJson(path.join(schemaDir, 'parcels.schema.json'), { ok: true });
    writeJson(path.join(schemaDir, 'parcel-address-linkage.schema.json'), { ok: true });

    execSync(`node command/bridge_existing_gis_to_land_access_contracts.mjs --gis-dir=${gisDir} --produce-dir=${produceDir} --qa-dir=${qaDir} --calibration-dir=${calibrationDir} --manifest=${manifestPath} --apply`, { stdio: 'pipe' });

    const summary = buildLandAccessGroundtruthSummary({
      inputDir: calibrationDir,
      schemaDir,
      produceDir,
      sourceManifestPath: manifestPath
    });
    expect(summary.status).toBe('pass');
    expect(summary.summary.landAccessGroundtruthStatus).toBe('partial_groundtruth');
  });
});
