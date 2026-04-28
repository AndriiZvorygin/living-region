import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { parseCsv } from '../program/data/import_calibration_csv.mjs';
import { loadCalibrationBundle } from '../program/data/calibration_bundle.mjs';
import { importGeoJsonWorld } from '../program/gis/import_geojson.mjs';
import { buildValidationReport } from '../program/util/validation_report.mjs';

function mkTempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
}

describe('import region workflow', () => {
  test('CSV parser handles quoted commas and comments', () => {
    const csv = `# heading\nname,value\n\"alpha, one\",42\n beta,7\n`;
    const parsed = parseCsv(csv);
    expect(parsed.headers).toEqual(['name', 'value']);
    expect(parsed.rows[0].name).toBe('alpha, one');
    expect(parsed.rows[0].value).toBe(42);
    expect(parsed.rows[1].name).toBe('beta');
  });

  test('calibration bundle merges available files and warns on missing files', () => {
    const temp = mkTempDir('living-region-cal');
    fs.mkdirSync(path.join(temp, 'calibration'), { recursive: true });
    fs.writeFileSync(
      path.join(temp, 'calibration', 'road-maintenance.csv'),
      'networkType,maintenanceCostPerKmPerYear,winterMaintenanceFactor,bridgeOrCulvertFactor,climateStressFactor\nlocalRoad,5000,1.1,1.0,1.1\n'
    );

    const bundle = loadCalibrationBundle(temp);
    expect(bundle.loadedFiles.length).toBe(1);
    expect(bundle.constants.roadMaintenance.byNetworkType.localRoad.maintenanceCostPerKmPerYear).toBe(5000);
    expect(bundle.warnings.some((w) => w.code === 'calibration.csv.missing')).toBe(true);
  });

  test('GeoJSON import converts sample layers and preserves sourceProperties', () => {
    const inputDir = path.resolve('know/input-example');
    const populationRows = loadCalibrationBundle(inputDir).tables.population.rows;
    const imported = importGeoJsonWorld(inputDir, { populationRows });

    expect(imported.world.patches.length).toBeGreaterThan(0);
    expect(imported.world.buildings.length).toBeGreaterThan(0);
    expect(imported.world.networks.length).toBeGreaterThan(0);
    expect(imported.world.infrastructures.length).toBeGreaterThan(0);

    const patchTown = imported.world.patches.find((p) => p.id === 'patch-town');
    expect(patchTown.sourceProperties.municipalWard).toBe('A');
  });

  test('validation report catches missing references', () => {
    const report = buildValidationReport({
      patches: [{ id: 'p1', areaHa: 10, geometry: null }],
      buildings: [{ id: 'b1', patchId: 'p2', condition: 0.9 }],
      networks: [{ id: 'n1', type: 'traditionalRail', segments: [{ id: 's1', lengthKm: 2, condition: 0.8 }] }],
      infrastructures: [{ id: 'i1', type: 'grainDepot', patchId: 'p1', networkId: null, stationId: null, condition: 0.8 }],
      households: [{ id: 'h1', homeBuildingId: 'missing' }]
    });

    expect(report.errors.some((e) => e.code === 'building.patch.unknown')).toBe(true);
    expect(report.warnings.some((w) => w.code === 'freight_anchor.unlinked')).toBe(true);
    expect(report.warnings.some((w) => w.code === 'rail.network.no_station')).toBe(true);
  });

  test('import:region writes imported-world.json from input-example', () => {
    const out = path.resolve('know/produce/imported-world-test.json');
    const result = spawnSync('node', ['command/import_region.mjs', '--input=know/input-example', `--output=${out}`], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(fs.existsSync(out)).toBe(true);

    const parsed = JSON.parse(fs.readFileSync(out, 'utf8'));
    expect(parsed.world).toBeTruthy();
    expect(parsed.world.patches.length).toBeGreaterThan(0);
    expect(parsed.calibrationLoadedFiles.length).toBeGreaterThan(0);
  });

  test('demo:imported runs on imported-world.json', () => {
    const worldPath = path.resolve('know/produce/imported-world-test.json');
    if (!fs.existsSync(worldPath)) {
      const importResult = spawnSync('node', ['command/import_region.mjs', '--input=know/input-example', `--output=${worldPath}`], { encoding: 'utf8' });
      expect(importResult.status).toBe(0);
    }

    const result = spawnSync('node', ['command/run_imported_scenario.mjs', `--world=${worldPath}`, '--scenario=adaptation-with-rail-freight-corridor'], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Imported scenario metrics written:');
  });

  test('imported world export remains deterministic', () => {
    const outA = path.resolve('know/produce/imported-world-det-a.json');
    const outB = path.resolve('know/produce/imported-world-det-b.json');

    const runA = spawnSync('node', ['command/import_region.mjs', '--input=know/input-example', `--output=${outA}`], { encoding: 'utf8' });
    const runB = spawnSync('node', ['command/import_region.mjs', '--input=know/input-example', `--output=${outB}`], { encoding: 'utf8' });

    expect(runA.status).toBe(0);
    expect(runB.status).toBe(0);

    const a = fs.readFileSync(outA, 'utf8');
    const b = fs.readFileSync(outB, 'utf8');
    expect(a).toBe(b);
  });
});
