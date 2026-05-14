import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { buildLandAccessGroundtruthSummary } from '../program/reliability/land_access_groundtruth_intake.mjs';

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function writeJson(filePath, obj) {
  write(filePath, JSON.stringify(obj, null, 2));
}

function setupSchemas(base) {
  const schemaDir = path.join(base, 'schema');
  writeJson(path.join(schemaDir, 'address-points.schema.json'), { ok: true });
  writeJson(path.join(schemaDir, 'building-footprints.schema.json'), { ok: true });
  writeJson(path.join(schemaDir, 'parcels.schema.json'), { ok: true });
  writeJson(path.join(schemaDir, 'parcel-address-linkage.schema.json'), { ok: true });
  return schemaDir;
}

describe('land access groundtruth intake contracts', () => {
  test('invalid latitude/longitude, land area, linkage method/confidence, and source_ref fail', () => {
    const root = path.resolve('know/produce/land-groundtruth-fixture-invalid');
    fs.rmSync(root, { recursive: true, force: true });
    const inputDir = path.join(root, 'input');
    const schemaDir = setupSchemas(root);
    const produceDir = path.join(root, 'produce');

    write(path.join(inputDir, 'address-points.csv'), [
      'address_id,civic_address,municipality,latitude,longitude,source_ref,quality_tier,notes',
      'a1,1 Main,Grey,95,-81,,direct_local,bad lat and missing source'
    ].join('\n'));

    write(path.join(inputDir, 'building-footprints.csv'), [
      'building_id,municipality,centroid_latitude,centroid_longitude,footprint_area_m2,building_type,source_ref,quality_tier,notes',
      'b1,Grey,44.5,-80.9,120,house,src1,direct_local,ok'
    ].join('\n'));

    write(path.join(inputDir, 'parcels.csv'), [
      'parcel_id,municipality,land_area_m2,zoning_or_land_use,assessment_class,has_residential_use,source_ref,quality_tier,notes',
      'p1,Grey,-10,residential,res,true,src1,direct_local,bad area'
    ].join('\n'));

    write(path.join(inputDir, 'parcel-address-linkage.csv'), [
      'parcel_id,address_id,building_id,linkage_method,linkage_confidence,source_ref,quality_tier,notes',
      'p1,a1,b1,bad_method,bad_conf,src1,direct_local,bad linkage fields'
    ].join('\n'));

    writeJson(path.join(root, 'source-manifest.json'), { entries: [{ source_id: 'src1', local_path: 'x', source_class: 'manual_curated_input' }] });

    const out = buildLandAccessGroundtruthSummary({
      inputDir,
      schemaDir,
      produceDir,
      sourceManifestPath: path.join(root, 'source-manifest.json')
    });
    expect(out.status).toBe('fail');
    expect(out.failures.some((f) => f.includes('invalid latitude'))).toBe(true);
    expect(out.failures.some((f) => f.includes('source_ref'))).toBe(true);
    expect(out.failures.some((f) => f.includes('invalid land_area_m2'))).toBe(true);
    expect(out.failures.some((f) => f.includes('invalid linkage_method'))).toBe(true);
    expect(out.failures.some((f) => f.includes('invalid linkage_confidence'))).toBe(true);
  });

  test('header-only files produce zero-count summary with limitations', () => {
    const root = path.resolve('know/produce/land-groundtruth-fixture-empty');
    fs.rmSync(root, { recursive: true, force: true });
    const inputDir = path.join(root, 'input');
    const schemaDir = setupSchemas(root);
    const produceDir = path.join(root, 'produce');

    write(path.join(inputDir, 'address-points.csv'), 'address_id,civic_address,municipality,latitude,longitude,source_ref,quality_tier,notes\n');
    write(path.join(inputDir, 'building-footprints.csv'), 'building_id,municipality,centroid_latitude,centroid_longitude,footprint_area_m2,building_type,source_ref,quality_tier,notes\n');
    write(path.join(inputDir, 'parcels.csv'), 'parcel_id,municipality,land_area_m2,zoning_or_land_use,assessment_class,has_residential_use,source_ref,quality_tier,notes\n');
    write(path.join(inputDir, 'parcel-address-linkage.csv'), 'parcel_id,address_id,building_id,linkage_method,linkage_confidence,source_ref,quality_tier,notes\n');
    writeJson(path.join(root, 'source-manifest.json'), { entries: [] });

    const out = buildLandAccessGroundtruthSummary({
      inputDir,
      schemaDir,
      produceDir,
      sourceManifestPath: path.join(root, 'source-manifest.json')
    });
    expect(out.status).toBe('pass');
    expect(out.summary.landAccessGroundtruthStatus).toBe('no_groundtruth');
    expect(out.summary.address_count).toBe(0);
    expect(out.summary.limitations.length).toBeGreaterThan(0);
  });

  test('source-backed direct_local linked parcels can produce direct_groundtruth status', () => {
    const root = path.resolve('know/produce/land-groundtruth-fixture-direct');
    fs.rmSync(root, { recursive: true, force: true });
    const inputDir = path.join(root, 'input');
    const schemaDir = setupSchemas(root);
    const produceDir = path.join(root, 'produce');

    write(path.join(inputDir, 'address-points.csv'), [
      'address_id,civic_address,municipality,latitude,longitude,source_ref,quality_tier,notes',
      'a1,1 Main,Grey,44.50,-80.90,src_land,direct_local,ok',
      'a2,2 Main,Grey,44.51,-80.91,src_land,direct_local,ok'
    ].join('\n'));
    write(path.join(inputDir, 'building-footprints.csv'), [
      'building_id,municipality,centroid_latitude,centroid_longitude,footprint_area_m2,building_type,source_ref,quality_tier,notes',
      'b1,Grey,44.50,-80.90,100,house,src_land,direct_local,ok',
      'b2,Grey,44.51,-80.91,110,house,src_land,direct_local,ok'
    ].join('\n'));
    write(path.join(inputDir, 'parcels.csv'), [
      'parcel_id,municipality,land_area_m2,zoning_or_land_use,assessment_class,has_residential_use,source_ref,quality_tier,notes',
      'p1,Grey,1000,residential,res,true,src_land,direct_local,ok',
      'p2,Grey,900,residential,res,true,src_land,direct_local,ok'
    ].join('\n'));
    write(path.join(inputDir, 'parcel-address-linkage.csv'), [
      'parcel_id,address_id,building_id,linkage_method,linkage_confidence,source_ref,quality_tier,notes',
      'p1,a1,b1,source_provided,high,src_land,direct_local,ok',
      'p2,a2,b2,source_provided,high,src_land,direct_local,ok'
    ].join('\n'));
    writeJson(path.join(root, 'source-manifest.json'), {
      entries: [{ source_id: 'src_land', local_path: 'know/source/local-calibration/land.csv', source_class: 'manual_curated_input' }]
    });

    const out = buildLandAccessGroundtruthSummary({
      inputDir,
      schemaDir,
      produceDir,
      sourceManifestPath: path.join(root, 'source-manifest.json')
    });
    expect(out.status).toBe('pass');
    expect(out.summary.landAccessGroundtruthStatus).toBe('direct_groundtruth');
  });
});
