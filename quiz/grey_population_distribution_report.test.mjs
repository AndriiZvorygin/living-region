import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { importGreyCensusPopulation } from '../program/data/grey_census_population_import.mjs';
import { buildGreyPopulationDistributionReport } from '../program/report/grey_population_distribution_report.mjs';
import { buildGreyLandAccessReport } from '../program/report/grey_land_access_report.mjs';
import { extractDownloadLinksFromHtml, extractCkanResourceLinks } from '../command/download_canada_census_2021.mjs';

function fc(features) {
  return { type: 'FeatureCollection', features };
}

describe('grey census population distribution', () => {
  test('imports fixture census blocks and totals population', async () => {
    const root = path.resolve('know/produce/census-fixture');
    const inputGisDir = path.join(root, 'gis');
    const censusDir = path.join(root, 'census');
    const produceDir = path.join(root, 'produce');
    fs.mkdirSync(inputGisDir, { recursive: true });
    fs.mkdirSync(censusDir, { recursive: true });
    fs.mkdirSync(produceDir, { recursive: true });

    fs.writeFileSync(path.join(inputGisDir, 'municipality-boundaries.geojson'), JSON.stringify(fc([
      { type: 'Feature', properties: { MUN_NAME: 'Owen Sound' }, geometry: { type: 'Polygon', coordinates: [[[-81,44],[-80.7,44],[-80.7,44.3],[-81,44.3],[-81,44]]] } }
    ])));
    fs.writeFileSync(path.join(inputGisDir, 'settlement-boundaries.geojson'), JSON.stringify(fc([
      { type: 'Feature', properties: { SETTL_NAME: 'Core' }, geometry: { type: 'Polygon', coordinates: [[[-80.96,44.04],[-80.88,44.04],[-80.88,44.12],[-80.96,44.12],[-80.96,44.04]]] } }
    ])));
    fs.writeFileSync(path.join(inputGisDir, 'official-plan-schedule-a-land-use.geojson'), JSON.stringify(fc([
      { type: 'Feature', properties: { LANDUSE: 'Agricultural' }, geometry: { type: 'Polygon', coordinates: [[[-80.99,44.1],[-80.8,44.1],[-80.8,44.25],[-80.99,44.25],[-80.99,44.1]]] } }
    ])));
    fs.writeFileSync(path.join(inputGisDir, 'road-centrelines-grey.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputGisDir, 'grey-transit-bus-stops.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputGisDir, 'official-road-cycling-routes.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputGisDir, 'county-trails.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputGisDir, 'cp-rail-trail.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputGisDir, 'hiking-trails.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputGisDir, 'on-farm-rural-business-listing.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputGisDir, 'public-facilities.geojson'), JSON.stringify(fc([])));

    fs.writeFileSync(path.join(censusDir, 'dissemination-block-boundaries.geojson'), JSON.stringify(fc([
      { type: 'Feature', properties: { DBUID: '1001' }, geometry: { type: 'Polygon', coordinates: [[[-80.95,44.05],[-80.92,44.05],[-80.92,44.08],[-80.95,44.08],[-80.95,44.05]]] } },
      { type: 'Feature', properties: { DBUID: '1002' }, geometry: { type: 'Polygon', coordinates: [[[-80.94,44.13],[-80.91,44.13],[-80.91,44.16],[-80.94,44.16],[-80.94,44.13]]] } }
    ])));
    fs.writeFileSync(path.join(censusDir, 'geographic-attribute-file.csv'), [
      'DBUID,POP,DWELLINGS,DGUID',
      '1001,120,60,2021A00033500001',
      '1002,80,40,2021A00033500002'
    ].join('\n'));
    fs.writeFileSync(path.join(censusDir, 'dissemination-geographies-relationship-file.csv'), [
      'DBUID,CSD_NAME',
      '1001,Grey',
      '1002,Grey'
    ].join('\n'));

    try {
      const result = await importGreyCensusPopulation({ censusDir, inputGisDir, produceDir });
      expect(result.summary.totalPopulationMatched).toBe(200);
      expect(result.summary.totalDwellingsMatched).toBe(100);
      expect(result.summary.disseminationBlockCount).toBe(2);
      expect(fs.existsSync(path.join(produceDir, 'grey-census-population-distribution.json'))).toBe(true);
      expect(fs.existsSync(path.join(produceDir, 'grey-census-population-blocks.geojson'))).toBe(true);
      expect(fs.existsSync(path.join(produceDir, 'grey-census-population-summary.csv'))).toBe(true);

      const report = buildGreyPopulationDistributionReport({ produceDir, inputGisDir });
      expect(report.report.totalPopulationMatched).toBe(200);
      expect(report.report.populationDistributionSource).toBe('censusSmallArea');
      expect(fs.existsSync(report.paths.markdownPath)).toBe(true);
      expect(fs.existsSync(report.paths.jsonPath)).toBe(true);
      expect(fs.existsSync(report.paths.municipalCsvPath)).toBe(true);
      expect(fs.existsSync(report.paths.contextCsvPath)).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('missing census files produce warnings and fallback status', async () => {
    const root = path.resolve('know/produce/census-fixture-missing');
    const inputGisDir = path.join(root, 'gis');
    const censusDir = path.join(root, 'census');
    const produceDir = path.join(root, 'produce');
    fs.mkdirSync(inputGisDir, { recursive: true });
    fs.mkdirSync(censusDir, { recursive: true });
    fs.mkdirSync(produceDir, { recursive: true });

    fs.writeFileSync(path.join(inputGisDir, 'municipality-boundaries.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputGisDir, 'settlement-boundaries.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputGisDir, 'official-plan-schedule-a-land-use.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputGisDir, 'road-centrelines-grey.geojson'), JSON.stringify(fc([])));

    try {
      const result = await importGreyCensusPopulation({ censusDir, inputGisDir, produceDir });
      expect(result.summary.totalPopulationMatched).toBe(0);
      expect(result.summary.warnings.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('download link parser extracts candidate file URLs from StatCan-like HTML', () => {
    const html = [
      '<html><body>',
      '<a href="/files/census/gaf_2021.csv">GAF CSV</a>',
      '<a href="https://example.ca/guide/reference-guide.pdf">Guide</a>',
      '<a href="/files/census/db_boundaries_2021.zip">DB ZIP</a>',
      '</body></html>'
    ].join('');
    const links = extractDownloadLinksFromHtml(html, 'https://www12.statcan.gc.ca/example/page.html');
    expect(links.some((l) => l.url.includes('gaf_2021.csv'))).toBe(true);
    expect(links.some((l) => l.url.includes('db_boundaries_2021.zip'))).toBe(true);
  });

  test('CKAN package_show parser extracts resource links', () => {
    const payload = {
      success: true,
      result: {
        resources: [
          { name: 'GAF CSV', url: 'https://example.ca/92-151-X2021001_eng.csv' },
          { name: 'Guide', url: 'https://example.ca/92-151-g2021001-eng.htm' }
        ]
      }
    };
    const links = extractCkanResourceLinks(payload);
    expect(links.some((l) => l.url.includes('.csv'))).toBe(true);
    expect(links.some((l) => l.url.includes('92-151-X2021001'))).toBe(true);
  });

  test('imports GAF-only table and filters Grey rows by municipality/CSD hints', async () => {
    const root = path.resolve('know/produce/census-gaf-only');
    const inputGisDir = path.join(root, 'gis');
    const censusDir = path.join(root, 'census');
    const produceDir = path.join(root, 'produce');
    fs.mkdirSync(inputGisDir, { recursive: true });
    fs.mkdirSync(censusDir, { recursive: true });
    fs.mkdirSync(produceDir, { recursive: true });

    fs.writeFileSync(path.join(inputGisDir, 'municipality-boundaries.geojson'), JSON.stringify(fc([
      { type: 'Feature', properties: { MUN_NAME: 'Owen Sound' }, geometry: { type: 'Polygon', coordinates: [[[-81,44],[-80.7,44],[-80.7,44.3],[-81,44.3],[-81,44]]] } }
    ])));
    fs.writeFileSync(path.join(inputGisDir, 'settlement-boundaries.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputGisDir, 'official-plan-schedule-a-land-use.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputGisDir, 'road-centrelines-grey.geojson'), JSON.stringify(fc([])));

    fs.writeFileSync(path.join(censusDir, 'gaf_2021.csv'), [
      'DbUid,pOp,dWeLLings,Csd_Name,Cd_name',
      '2001,50,20,Owen Sound,Grey',
      '2002,80,30,West Grey,Grey',
      '2003,900,300,Toronto,Toronto'
    ].join('\n'));

    try {
      const result = await importGreyCensusPopulation({ censusDir, inputGisDir, produceDir });
      expect(result.summary.geographicLevel).toBe('gafTableOnly');
      expect(result.summary.totalPopulationMatched).toBe(130);
      expect(result.summary.totalDwellingsMatched).toBe(50);
      expect(result.summary.warnings.some((w) => w.includes('No Census geometry GeoJSON found'))).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('zero-match import writes GAF header diagnostics', async () => {
    const root = path.resolve('know/produce/census-gaf-zero-match');
    const inputGisDir = path.join(root, 'gis');
    const censusDir = path.join(root, 'census');
    const produceDir = path.join(root, 'produce');
    fs.mkdirSync(inputGisDir, { recursive: true });
    fs.mkdirSync(censusDir, { recursive: true });
    fs.mkdirSync(produceDir, { recursive: true });
    fs.writeFileSync(path.join(inputGisDir, 'municipality-boundaries.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(censusDir, 'gaf_2021.csv'), [
      'DBUID,POP,DWELLINGS,CSD_NAME,CD_NAME',
      '1,10,5,Toronto,Toronto'
    ].join('\n'));
    try {
      const result = await importGreyCensusPopulation({ censusDir, inputGisDir, produceDir });
      expect(result.summary.totalPopulationMatched).toBe(0);
      const diagnosticsPath = path.join(produceDir, 'grey-census-gaf-header-diagnostics.json');
      expect(fs.existsSync(diagnosticsPath)).toBe(true);
      const parsed = JSON.parse(fs.readFileSync(diagnosticsPath, 'utf8'));
      expect(Array.isArray(parsed.diagnostics.headers)).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('land access report flags census source when distribution file exists', () => {
    const root = path.resolve('know/produce/census-land-access-source');
    const inputDir = path.join(root, 'input');
    const outputDir = path.join(root, 'output');
    fs.mkdirSync(inputDir, { recursive: true });
    fs.mkdirSync(outputDir, { recursive: true });

    fs.writeFileSync(path.join(inputDir, 'municipality-boundaries.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputDir, 'settlement-boundaries.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputDir, 'official-plan-schedule-a-land-use.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputDir, 'road-centrelines-grey.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputDir, 'lots-and-concessions-grey.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputDir, 'grey-transit-bus-stops.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputDir, 'official-road-cycling-routes.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputDir, 'county-trails.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputDir, 'cp-rail-trail.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputDir, 'hiking-trails.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputDir, 'managed-forest-boundary.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputDir, 'on-farm-rural-business-listing.geojson'), JSON.stringify(fc([])));
    fs.writeFileSync(path.join(inputDir, 'public-facilities.geojson'), JSON.stringify(fc([])));

    fs.writeFileSync(path.join(outputDir, 'grey-census-population-distribution.json'), JSON.stringify({
      populationDistributionSource: 'censusSmallArea',
      totalPopulationMatched: 100905
    }, null, 2));

    try {
      const built = buildGreyLandAccessReport({ inputDir, outputDir });
      expect(built.report.populationDistributionSource).toBe('censusSmallArea');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('population distribution report command exits successfully', () => {
    const run = spawnSync('node', ['command/report_grey_population_distribution.mjs'], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('population source');
  });
});
