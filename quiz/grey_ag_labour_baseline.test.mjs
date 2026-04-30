import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { importGreyCensusPopulationLabour } from '../program/data/grey_census_population_labour_import.mjs';
import { buildGreyAgLabourBaselineReport } from '../program/report/grey_ag_labour_baseline_report.mjs';

function write(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text);
}

describe('grey ag labour baseline', () => {
  test('import fixture occupation/industry CSVs and computes FTE + scale-up factors', () => {
    const root = path.resolve('know/produce/ag-labour-fixture');
    const inputDir = path.join(root, 'input');
    const produceDir = path.join(root, 'produce');
    fs.mkdirSync(inputDir, { recursive: true });
    fs.mkdirSync(produceDir, { recursive: true });

    write(path.join(inputDir, '98100449.csv'), [
      'GEO,Occupation,VALUE',
      'Grey,Managers in agriculture,150',
      'Grey,General farm workers,250',
      'Grey,Nursery and greenhouse labourers,100',
      'Grey,Landscaping and grounds maintenance labourers,80',
      'Other,General farm workers,9999'
    ].join('\n'));
    write(path.join(inputDir, '98100456.csv'), [
      'GEO,Industry,VALUE',
      'Grey,Agriculture, forestry, fishing and hunting,600',
      'Other,Agriculture, forestry, fishing and hunting,9999'
    ].join('\n'));
    write(path.join(inputDir, '98100471.csv'), [
      'GEO,Characteristics,VALUE',
      'Grey,Part-time workers,20',
      'Grey,Part year workers,30'
    ].join('\n'));

    write(path.join(produceDir, 'grey-labour-land-baseline.json'), JSON.stringify({
      regionalIndicators: { estimatedHumanFoodProducingHa: 2000 },
      scenarios: [
        { scenario: 'lowFuelMixed', requiredFoodWorkerFTE: 1200 },
        { scenario: 'mostlyHumanScale', requiredFoodWorkerFTE: 2200 },
        { scenario: 'currentMechanized', requiredFoodWorkerFTE: 300 }
      ],
      productionSystemLeverage: [
        { system: 'annualLowFuelEfficient', totalSystemLabourDaysPerHaAtMaturity: 150 },
        { system: 'annualLowFuelHandScale', totalSystemLabourDaysPerHaAtMaturity: 220 },
        { system: 'perennialStapleBulkLowCare', totalSystemLabourDaysPerHaAtMaturity: 90 }
      ]
    }, null, 2));

    try {
      const imported = importGreyCensusPopulationLabour({ inputDir, produceDir });
      expect(imported.summary.currentAgRelatedWorkers).toBeGreaterThan(0);
      expect(imported.summary.currentAgRelatedFTEEstimate).toBeGreaterThan(0);
      expect(imported.summary.dataStatus.agLabourDataStatus).toBe('available');
      expect(fs.existsSync(path.join(produceDir, 'grey-ag-labour-import-diagnostics.json'))).toBe(true);

      const built = buildGreyAgLabourBaselineReport({ produceDir });
      expect(fs.existsSync(built.paths.markdownPath)).toBe(true);
      expect(fs.existsSync(built.paths.jsonPath)).toBe(true);
      expect(fs.existsSync(built.paths.csvPath)).toBe(true);
      expect(built.report.agLabourScaleUpFactorLowFuel).toBeGreaterThan(0);
      expect(built.report.agLabourGapFTELowFuel).toBeGreaterThanOrEqual(0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('double-count protection excludes totals/subtotals and keeps narrow rows', () => {
    const root = path.resolve('know/produce/ag-labour-double-count');
    const inputDir = path.join(root, 'input');
    const produceDir = path.join(root, 'produce');
    fs.mkdirSync(inputDir, { recursive: true });
    fs.mkdirSync(produceDir, { recursive: true });

    write(path.join(inputDir, '98100449.csv'), [
      'GEO,Occupation - Unit group - National Occupational Classification (NOC) 2021 (516),Gender (3),Age (15A),VALUE',
      'Grey,Total - Occupation - Unit group - National Occupational Classification (NOC) 2021,Total - Gender,Total - Age,9999',
      'Grey,Managers in agriculture,Total - Gender,Total - Age,100',
      'Grey,Managers in agriculture,Male+,Total - Age,90',
      'Grey,General farm workers,Total - Gender,Total - Age,200',
      'Grey,Nursery and greenhouse labourers,Total - Gender,Total - Age,50',
      'Grey,Landscaping and grounds maintenance labourers,Total - Gender,Total - Age,80'
    ].join('\n'));
    write(path.join(inputDir, '98100456.csv'), [
      'GEO,Occupation - Broad category - National Occupational Classification (NOC) 2021 (11),Gender (3),Statistics (3),Place of work status (5):Total - Place of work status[1],Industry - Sectors - North American Industry Classification System (NAICS) 2017 (21),VALUE',
      'Grey,Total - Occupation - Broad category - National Occupational Classification (NOC) 2021,Total - Gender,Count,Total - Place of work status,Total - Industry - Sectors - North American Industry Classification System (NAICS) 2017,5000',
      'Grey,Total - Occupation - Broad category - National Occupational Classification (NOC) 2021,Total - Gender,Count,Total - Place of work status,"11 Agriculture, forestry, fishing and hunting",700',
      'Grey,Total - Occupation - Broad category - National Occupational Classification (NOC) 2021,Total - Gender,Count,Worked at home,"11 Agriculture, forestry, fishing and hunting",400',
      'Grey,Total - Occupation - Broad category - National Occupational Classification (NOC) 2021,Male+,Count,Total - Place of work status,"11 Agriculture, forestry, fishing and hunting",350'
    ].join('\n'));
    write(path.join(inputDir, '98100471.csv'), [
      'GEO,Occupation - Broad category - National Occupational Classification (NOC) 2021 (11),Age (15A),Gender (3),Place of work status (7),Characteristics,VALUE',
      'Grey,Total - Occupation - Broad category - National Occupational Classification (NOC) 2021,Total - Age,Total - Gender,Total - Place of work status,Worked full year full time,1000',
      'Grey,Total - Occupation - Broad category - National Occupational Classification (NOC) 2021,Total - Age,Total - Gender,Total - Place of work status,Worked part year and/or part time,300'
    ].join('\n'));

    try {
      const imported = importGreyCensusPopulationLabour({ inputDir, produceDir });
      expect(imported.summary.coreAgriculturalWorkers).toBe(350);
      expect(imported.summary.agricultureIndustryWorkers).toBe(700);
      expect(imported.summary.currentAgRelatedWorkers).toBe(350);
      expect(imported.summary.totalAgRelatedBroadWorkers).toBe(780);
      expect(imported.summary.currentCoreAgFTEEstimate).toBeGreaterThan(0);
      expect(imported.summary.currentCoreAgFTEEstimate).toBeLessThan(imported.summary.currentAgIndustryFTEEstimate);
      expect(imported.diagnostics.rowInclusion.rowsExcludedTotalsSubtotals).toBeGreaterThan(0);
      expect(imported.summary.sanityFlags.length).toBe(0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('minor-group proxy basis loads from 98-10-0594 style table when unit-group rows are unavailable', () => {
    const root = path.resolve('know/produce/ag-labour-minor-proxy');
    const inputDir = path.join(root, 'input');
    const produceDir = path.join(root, 'produce');
    fs.mkdirSync(inputDir, { recursive: true });
    fs.mkdirSync(produceDir, { recursive: true });

    write(path.join(inputDir, '98100594.csv'), [
      'GEO,Occupation - Minor group - National Occupational Classification (NOC) 2021 (45),Labour force status (5),Gender (3),Age (15A),VALUE',
      'Grey,Total - Occupation - Minor group - National Occupational Classification (NOC) 2021,Total - Labour force status,Total - Gender,Total - Age,9999',
      'Grey,Managers in agriculture,Total - Labour force status,Total - Gender,Total - Age,120',
      'Grey,General farm workers,Total - Labour force status,Total - Gender,Total - Age,220',
      'Grey,Nursery and greenhouse labourers,Total - Labour force status,Total - Gender,Total - Age,80',
      'Grey,General farm workers,Male+,Total - Gender,Total - Age,111'
    ].join('\n'));
    write(path.join(inputDir, '98100456.csv'), [
      'GEO,Occupation - Broad category - National Occupational Classification (NOC) 2021 (11),Gender (3),Statistics (3),Place of work status (5):Total - Place of work status[1],Industry - Sectors - North American Industry Classification System (NAICS) 2017 (21),VALUE',
      'Grey,Total - Occupation - Broad category - National Occupational Classification (NOC) 2021,Total - Gender,Count,Total - Place of work status,"11 Agriculture, forestry, fishing and hunting",700'
    ].join('\n'));
    write(path.join(inputDir, '98100471.csv'), [
      'GEO,Occupation - Broad category - National Occupational Classification (NOC) 2021 (11),Age (15A),Gender (3),Place of work status (7),Characteristics,VALUE',
      'Grey,Total - Occupation - Broad category - National Occupational Classification (NOC) 2021,Total - Age,Total - Gender,Total - Place of work status,Worked full year full time,900'
    ].join('\n'));

    try {
      const imported = importGreyCensusPopulationLabour({ inputDir, produceDir });
      expect(imported.summary.coreAgOccupationWorkers).toBe(0);
      expect(imported.summary.minorGroupCoreAgProxyWorkers).toBe(420);
      expect(imported.summary.coreAgriculturalWorkers).toBe(420);
      expect(imported.summary.occupationSourceStatus).toBe('minorGroupProxyLoaded');
      expect(imported.summary.currentAgLabourPreferredBasis).toBe('minorGroupCoreAgProxy');
      expect(imported.summary.agricultureIndustryWorkers).toBe(700);
      expect(imported.summary.currentCoreAgFTEEstimate).toBeGreaterThan(0);
      expect(imported.summary.currentCoreAgFTEEstimate).toBeLessThan(imported.summary.currentAgIndustryFTEEstimate);

      const built = buildGreyAgLabourBaselineReport({ produceDir });
      expect(built.report.currentAgLabourPreferredBasis).toBe('minorGroupCoreAgProxy');
      expect(built.report.minorGroupCoreAgProxyWorkers).toBe(420);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('missing files warn but do not crash', () => {
    const root = path.resolve('know/produce/ag-labour-missing');
    const inputDir = path.join(root, 'input');
    const produceDir = path.join(root, 'produce');
    fs.mkdirSync(produceDir, { recursive: true });
    write(path.join(produceDir, 'grey-labour-land-baseline.json'), JSON.stringify({ scenarios: [] }, null, 2));

    try {
      const imported = importGreyCensusPopulationLabour({ inputDir, produceDir });
      expect(imported.summary.currentAgRelatedWorkers).toBe(0);
      expect(imported.summary.warnings.length).toBeGreaterThan(0);

      const built = buildGreyAgLabourBaselineReport({ produceDir });
      expect(built.report.agLabourDataStatus).toBe('missing');
      expect(built.report.warnings.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('sanity flag is emitted when only broad proxy is available', () => {
    const root = path.resolve('know/produce/ag-labour-sanity-flag');
    const inputDir = path.join(root, 'input');
    const produceDir = path.join(root, 'produce');
    fs.mkdirSync(inputDir, { recursive: true });
    fs.mkdirSync(produceDir, { recursive: true });

    write(path.join(inputDir, '98100456.csv'), [
      'GEO,Occupation - Broad category - National Occupational Classification (NOC) 2021 (11),Gender (3),Statistics (3),Place of work status (5):Total - Place of work status[1],Industry - Sectors - North American Industry Classification System (NAICS) 2017 (21),VALUE',
      'Grey,Total - Occupation - Broad category - National Occupational Classification (NOC) 2021,Total - Gender,Count,Total - Place of work status,"11 Agriculture, forestry, fishing and hunting",3000'
    ].join('\n'));

    try {
      const imported = importGreyCensusPopulationLabour({ inputDir, produceDir });
      expect(imported.summary.coreAgriculturalWorkers).toBe(0);
      expect(imported.summary.agricultureIndustryWorkers).toBe(3000);
      expect(imported.summary.sanityFlags).toContain('core_ag_labour_missing_using_broad_proxy');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('report command exits successfully', () => {
    const run = spawnSync('node', ['command/report_grey_ag_labour_baseline.mjs'], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('agLabourDataStatus');
  });
});
