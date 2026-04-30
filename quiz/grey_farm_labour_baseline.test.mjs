import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { importGreyCensusAgriculture } from '../program/data/grey_census_agriculture_import.mjs';
import { buildGreyFarmLabourBaselineReport } from '../program/report/grey_farm_labour_baseline_report.mjs';

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

describe('grey farm labour baseline', () => {
  test('Census Ag import supports fixture CSV/manual file and sums operators', () => {
    const root = path.resolve('know/produce/farm-labour-fixture');
    const censusAgDir = path.join(root, 'input');
    const produceDir = path.join(root, 'produce');
    fs.mkdirSync(censusAgDir, { recursive: true });
    fs.mkdirSync(produceDir, { recursive: true });

    write(path.join(censusAgDir, '32-10-0382.csv'), [
      'GEO,Characteristics,VALUE',
      'Grey,Total farm operators,1000',
      'Grey,Operators with off-farm work,350',
      'NotGrey,Total farm operators,9999'
    ].join('\n'));

    write(path.join(censusAgDir, '32-10-0381.csv'), [
      'GEO,Characteristics,VALUE',
      'Grey,Under 35 years,120',
      'Grey,35 to 54 years,500'
    ].join('\n'));

    write(path.join(censusAgDir, 'hired-labour.csv'), [
      'GEO,Characteristics,VALUE',
      'Grey,Hired labour persons,220'
    ].join('\n'));

    write(path.join(produceDir, 'grey-labour-land-baseline.json'), JSON.stringify({ scenarios: [{ scenario: 'lowFuelMixed', requiredFoodWorkerFTE: 2000 }] }, null, 2));

    try {
      const imported = importGreyCensusAgriculture({ censusAgDir, produceDir });
      expect(imported.summary.numberOfFarmOperators).toBeGreaterThan(0);
      expect(imported.summary.operatorsWithOffFarmWork).toBeGreaterThan(0);
      expect(imported.summary.dataStatus.hasFarmLabourData).toBe(true);

      const built = buildGreyFarmLabourBaselineReport({ produceDir });
      expect(fs.existsSync(built.paths.jsonPath)).toBe(true);
      expect(fs.existsSync(built.paths.markdownPath)).toBe(true);
      expect(fs.existsSync(built.paths.csvPath)).toBe(true);
      expect(built.report.currentFarmOperators).toBeGreaterThan(0);
      expect(built.report.requiredLowFuelFoodWorkerFTE).toBeGreaterThan(0);
      expect(built.report.farmLabourGapVsLowFuelScenarios).toBeGreaterThanOrEqual(0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('missing Census Ag files produce warnings but report still writes', () => {
    const root = path.resolve('know/produce/farm-labour-missing');
    const produceDir = path.join(root, 'produce');
    fs.mkdirSync(produceDir, { recursive: true });
    write(path.join(produceDir, 'grey-labour-land-baseline.json'), JSON.stringify({ scenarios: [{ scenario: 'lowFuelMixed', requiredFoodWorkerFTE: 100 }] }, null, 2));

    try {
      const imported = importGreyCensusAgriculture({ censusAgDir: path.join(root, 'none'), produceDir });
      expect(imported.summary.numberOfFarmOperators).toBe(0);
      const built = buildGreyFarmLabourBaselineReport({ produceDir });
      expect(built.report.currentFarmLabourDataStatus).toBe('missing');
      expect(built.report.warnings.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('farm labour report command exits successfully', () => {
    const run = spawnSync('node', ['command/report_grey_farm_labour_baseline.mjs'], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('currentFarmLabourDataStatus');
  });
});
