import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  extractArcgisItemIdFromHtml,
  extractServiceUrlFromHtml,
  rankArcgisCandidates,
  chooseLayerFromService,
  discoverLayerDownloadInfo
} from '../program/gis/arcgis_hub_discovery.mjs';
import {
  buildQueryUrl,
  chunkObjectIds,
  mergeFeatureCollections
} from '../program/gis/arcgis_rest_download.mjs';
import { greyOpenDataManifest, validateGreyOpenDataManifest } from '../program/data/grey_open_data_manifest.mjs';
import { buildGreySecondaryDataReport } from '../program/report/grey_secondary_data_report.mjs';

describe('grey open data tools', () => {
  test('extract itemId and serviceUrl from ArcGIS-style html', () => {
    const html = `
      <script>var x = {"itemId":"0123456789abcdef0123456789abcdef"}</script>
      <meta content="https://example.com/arcgis/rest/services/MyLayer/FeatureServer">
    `;
    expect(extractArcgisItemIdFromHtml(html)).toBe('0123456789abcdef0123456789abcdef');
    expect(extractServiceUrlFromHtml(html)).toBe('https://example.com/arcgis/rest/services/MyLayer/FeatureServer');
  });

  test('build ArcGIS query URL correctly', () => {
    const url = buildQueryUrl('https://x/y/FeatureServer/0', {
      where: '1=1',
      outFields: '*',
      returnGeometry: true,
      f: 'geojson'
    });
    expect(url).toContain('/query?');
    expect(url).toContain('where=1%3D1');
    expect(url).toContain('f=geojson');
  });

  test('chunk object ids', () => {
    const chunks = chunkObjectIds([1, 2, 3, 4, 5], 2);
    expect(chunks).toEqual([[1, 2], [3, 4], [5]]);
  });

  test('merge feature collections', () => {
    const merged = mergeFeatureCollections([
      { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: null, properties: { a: 1 } }] },
      { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: null, properties: { b: 2 } }] }
    ]);
    expect(merged.type).toBe('FeatureCollection');
    expect(merged.features).toHaveLength(2);
  });

  test('manifest validates required fields', () => {
    const result = validateGreyOpenDataManifest(greyOpenDataManifest);
    expect(result.valid).toBe(true);
  });

  test('verified manifest sources are recognized', () => {
    const verified = greyOpenDataManifest.filter((s) => s.verified).map((s) => s.id);
    expect(verified).toEqual(expect.arrayContaining([
      'municipality-boundaries',
      'settlement-boundaries',
      'official-plan-schedule-a-land-use'
    ]));
  });

  test('manifest includes secondary useful data sources', () => {
    const ids = greyOpenDataManifest.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining([
      'grey-transit-bus-stops',
      'official-road-cycling-routes',
      'managed-forest-boundary',
      'on-farm-rural-business-listing',
      'bridges-culverts-structures',
      'lot-fabric-improved-lio',
      'lots-and-concessions-grey'
    ]));
  });

  test('discovery parses item page URL with item id', () => {
    const html = '<a href=\"https://maps.grey.ca/items/0ac029841e5848e0b4596827a30c3cf7\">Item</a>';
    expect(extractArcgisItemIdFromHtml(html)).toBe('0ac029841e5848e0b4596827a30c3cf7');
  });

  test('rank candidates prefers better title/type/access matches', () => {
    const source = {
      sourcePageUrl: 'https://maps.grey.ca/datasets/grey::municipality-boundary-2/about',
      expectedTitleTerms: ['municipality', 'boundary'],
      expectedOwnerTerms: ['grey'],
      expectedUrlTerms: ['featureserver']
    };
    const ranked = rankArcgisCandidates({
      source,
      candidates: [
        { id: 'a', title: 'Random Layer', owner: 'someone', type: 'CSV', access: 'private', url: '' },
        { id: 'b', title: 'Grey Municipality Boundary', owner: 'GreyCounty', type: 'Feature Service', access: 'public', url: 'https://x/FeatureServer' }
      ]
    });
    expect(ranked[0].id).toBe('b');
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  test('Grey County Roads outranks Road Transfers for road-centrelines', () => {
    const source = {
      id: 'road-centrelines-grey',
      sourcePageUrl: 'https://maps.grey.ca/datasets/grey-county-roads-/about',
      preferredItemId: '0aebf6c0c6c5420f8161d3123756aa74',
      expectedTitleTerms: ['grey', 'county', 'roads'],
      expectedOwnerTerms: ['grey'],
      expectedUrlTerms: ['road', 'featureserver']
    };
    const ranked = rankArcgisCandidates({
      source,
      candidates: [
        { id: 'x', title: 'Road Transfers', owner: 'grey', type: 'Feature Service', access: 'public', url: 'https://x/FeatureServer' },
        { id: '0aebf6c0c6c5420f8161d3123756aa74', title: 'Grey County Roads', owner: 'grey', type: 'Feature Service', access: 'public', url: 'https://x/FeatureServer' }
      ]
    });
    expect(ranked[0].title).toMatch(/Grey County Roads/i);
  });

  test('ranking prefers Grey-owned trail/transit sources over unrelated owners', () => {
    const source = {
      id: 'county-trails',
      sourcePageUrl: 'https://maps.grey.ca/pages/open-data',
      expectedTitleTerms: ['trail', 'county'],
      expectedOwnerTerms: ['grey'],
      expectedUrlTerms: ['feature']
    };
    const ranked = rankArcgisCandidates({
      source,
      candidates: [
        { id: 'a', title: 'County Trails', owner: 'random_city', type: 'Feature Service', access: 'public', url: 'https://other/FeatureServer' },
        { id: 'b', title: 'County Trails', owner: 'service_grey', type: 'Feature Service', access: 'public', url: 'https://maps.grey.ca/FeatureServer' }
      ]
    });
    expect(ranked[0].id).toBe('b');
  });

  test('lot fabric ranking prefers Ontario/LIO-style owner over municipal copy', () => {
    const source = {
      id: 'lot-fabric-improved-lio',
      sourcePageUrl: 'https://geohub.lio.gov.on.ca/datasets/lot-fabric-improved/',
      expectedTitleTerms: ['lot', 'fabric', 'improved'],
      expectedOwnerTerms: ['ontario', 'lio'],
      expectedUrlTerms: ['feature']
    };
    const ranked = rankArcgisCandidates({
      source,
      candidates: [
        { id: 'a', title: 'Lot Fabric Improved', owner: 'shahir.alam@peelregion.ca_RegionofPeel', type: 'Feature Service', access: 'public', url: 'https://peel/FeatureServer' },
        { id: 'b', title: 'Lot Fabric Improved', owner: 'lio_ontario', type: 'Feature Service', access: 'public', url: 'https://geohub.lio.gov.on.ca/FeatureServer' }
      ]
    });
    expect(ranked[0].id).toBe('b');
  });

  test('service inspection chooses expected geometry/type layer', () => {
    const result = chooseLayerFromService(
      {
        layers: [
          { id: 0, name: 'Road Network', geometryType: 'esriGeometryPolyline' },
          { id: 1, name: 'Municipality Boundary', geometryType: 'esriGeometryPolygon' }
        ]
      },
      { expectedGeometryType: 'Polygon', expectedTitleTerms: ['municipality', 'boundary'] }
    );
    expect(result.selectedLayerId).toBe(1);
    expect(result.selectedLayerName).toContain('Municipality');
  });

  test('discovery can use search+item metadata to produce serviceUrl', async () => {
    const source = {
      id: 'municipality-boundaries',
      name: 'Municipality Boundary',
      sourcePageUrl: 'https://maps.grey.ca/datasets/grey::municipality-boundary-2/about',
      itemId: null,
      serviceUrl: null,
      layerId: null,
      searchQueries: ['title:"Municipality Boundary" Grey'],
      expectedTitleTerms: ['municipality', 'boundary'],
      expectedOwnerTerms: ['grey'],
      expectedUrlTerms: ['featureserver'],
      expectedGeometryType: 'Polygon'
    };

    const fetchImpl = async (url) => {
      if (String(url).includes('/datasets/')) {
        return { ok: true, status: 200, text: async () => '<html>no item id</html>' };
      }
      if (String(url).includes('/sharing/rest/search')) {
        return { ok: true, status: 200, json: async () => ({ results: [{ id: '0123456789abcdef0123456789abcdef', title: 'Grey Municipality Boundary', owner: 'GreyCounty', type: 'Feature Service', access: 'public' }] }) };
      }
      if (String(url).includes('/sharing/rest/content/items/')) {
        return { ok: true, status: 200, json: async () => ({ id: '0123456789abcdef0123456789abcdef', title: 'Grey Municipality Boundary', owner: 'GreyCounty', type: 'Feature Service', access: 'public', url: 'https://example.com/arcgis/rest/services/Muni/FeatureServer' }) };
      }
      if (String(url).includes('/FeatureServer?f=json')) {
        return { ok: true, status: 200, json: async () => ({ layers: [{ id: 0, name: 'Municipality Boundary', geometryType: 'esriGeometryPolygon' }] }) };
      }
      return { ok: false, status: 404, text: async () => '', json: async () => ({}) };
    };

    const discovered = await discoverLayerDownloadInfo(source, { fetchImpl });
    expect(discovered.itemId).toBe('0123456789abcdef0123456789abcdef');
    expect(discovered.serviceUrl).toContain('FeatureServer');
    expect(discovered.layerId).toBe(0);
  });

  test('low-confidence discovery warns but does not crash', async () => {
    const source = {
      id: 'x',
      name: 'X',
      sourcePageUrl: 'https://maps.grey.ca/pages/open-data',
      searchQueries: ['title:"Road" "Grey County"'],
      expectedTitleTerms: ['road'],
      expectedOwnerTerms: ['grey'],
      expectedUrlTerms: ['featureserver'],
      expectedGeometryType: 'LineString'
    };
    const fetchImpl = async (url) => {
      if (String(url).includes('/pages/open-data')) return { ok: true, status: 200, text: async () => '<html>none</html>' };
      if (String(url).includes('/sharing/rest/search')) return { ok: true, status: 200, json: async () => ({ results: [{ id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', title: 'Unrelated', owner: 'abc', type: 'Map Service', access: 'public' }] }) };
      if (String(url).includes('/sharing/rest/content/items/')) return { ok: true, status: 200, json: async () => ({ id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', title: 'Unrelated', type: 'Map Service' }) };
      return { ok: false, status: 404, json: async () => ({}) };
    };
    const discovered = await discoverLayerDownloadInfo(source, { fetchImpl });
    expect(discovered.ok).toBe(true);
    expect(discovered.warnings.some((w) => /low-confidence/i.test(w))).toBe(true);
  });

  test('discovery and download commands support dry-run', () => {
    const discover = spawnSync('node', ['command/discover_grey_open_data.mjs', '--dry-run'], { encoding: 'utf8' });
    const download = spawnSync('node', ['command/download_grey_open_data.mjs', '--dry-run', '--all'], { encoding: 'utf8' });
    expect(discover.status).toBe(0);
    expect(download.status).toBe(0);
    expect(discover.stdout).toContain('written:');
    expect(download.stdout).toContain('written:');
  });

  test('override file wins over search in dry-run command output', () => {
    const overridePath = path.resolve('know/input/gis/source-overrides.json');
    fs.mkdirSync(path.dirname(overridePath), { recursive: true });
    fs.writeFileSync(overridePath, JSON.stringify({
      'municipality-boundaries': { itemId: 'feedfeedfeedfeedfeedfeedfeedfeed', serviceUrl: 'https://override/FeatureServer', layerId: 0 }
    }, null, 2));
    try {
      const discover = spawnSync('node', ['command/discover_grey_open_data.mjs', '--dry-run', '--source=municipality-boundaries'], { encoding: 'utf8' });
      expect(discover.status).toBe(0);
      expect(discover.stdout).toContain('itemId: feedfeedfeedfeedfeedfeedfeedfeed');
    } finally {
      fs.rmSync(overridePath, { force: true });
    }
  });

  test('explicit CLI service-url/layer-id override works in download dry-run', () => {
    const run = spawnSync('node', [
      'command/download_grey_open_data.mjs',
      '--dry-run',
      '--source=municipality-boundaries',
      '--service-url=https://manual.example/FeatureServer',
      '--layer-id=0'
    ], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('serviceUrl=https://manual.example/FeatureServer');
    expect(run.stdout).toContain('layerId=0');
  });

  test('default download plan excludes unverified sources', () => {
    const run = spawnSync('node', ['command/download_grey_open_data.mjs', '--dry-run'], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('municipality-boundaries');
    expect(run.stdout).not.toContain('road-centrelines');
    expect(run.stdout).not.toContain('lot-fabric-improved');
  });

  test('include-unverified includes unverified sources', () => {
    const run = spawnSync('node', ['command/download_grey_open_data.mjs', '--dry-run', '--include-unverified'], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('road-centrelines');
    expect(run.stdout).toContain('lot-fabric-improved');
  });

  test('all-useful skips unverified low-confidence/guarded in dry-run by default', () => {
    const run = spawnSync('node', ['command/download_grey_open_data.mjs', '--all-useful', '--dry-run'], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('municipality-boundaries');
  });

  test('explicit unverified source emits warning', () => {
    const run = spawnSync('node', ['command/download_grey_open_data.mjs', '--dry-run', '--source=road-centrelines-grey'], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    const merged = `${run.stdout}\n${run.stderr}`;
    expect(merged).toContain('unverified');
  });

  test('ORN fallback is marked large/provincewide unless filtered', () => {
    const source = greyOpenDataManifest.find((s) => s.id === 'road-centrelines-orn');
    expect(source?.largeDataset).toBe(true);
  });

  test('large download safeguard blocks unfiltered provincewide download', () => {
    const run = spawnSync('node', ['command/download_grey_open_data.mjs', '--source=road-centrelines-orn'], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('blocked');
  });

  test('data-status command exits successfully', () => {
    const run = spawnSync('node', ['command/grey_data_status.mjs'], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('real vs synthetic model status');
  });

  test('data-status reports lots-and-concessions-grey when downloaded', () => {
    const filePath = path.resolve('know/input/gis/lots-and-concessions-grey.geojson');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { LOT: '1', CONCESSION: '2' }, geometry: { type: 'Polygon', coordinates: [[[-80.9,44.4],[-80.8,44.4],[-80.8,44.5],[-80.9,44.5],[-80.9,44.4]]] } }]
    }));
    try {
      const run = spawnSync('node', ['command/grey_data_status.mjs'], { encoding: 'utf8' });
      expect(run.status).toBe(0);
      expect(run.stdout).toContain('lots-and-concessions-grey');
    } finally {
      fs.rmSync(filePath, { force: true });
    }
  });

  test('lot/concession fields are detected by summarize command', () => {
    const inputDir = path.resolve('know/input/gis-lot-fixture');
    const outPath = path.resolve('know/produce/grey-gis-summary-lot-fixture.json');
    fs.mkdirSync(inputDir, { recursive: true });
    fs.writeFileSync(path.join(inputDir, 'lots-and-concessions-grey.geojson'), JSON.stringify({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { LOT: '12', CONCESSION: '3', TOWNSHIP: 'Artemesia', MUNICIPALITY: 'Grey Highlands' }, geometry: { type: 'Polygon', coordinates: [[[-80.9,44.4],[-80.8,44.4],[-80.8,44.5],[-80.9,44.5],[-80.9,44.4]]] } }]
    }));
    try {
      const run = spawnSync('node', ['command/summarize_grey_gis.mjs', `--dir=${inputDir}`, `--out=${outPath}`], { encoding: 'utf8' });
      expect(run.status).toBe(0);
      const summary = JSON.parse(fs.readFileSync(outPath, 'utf8'));
      const file = summary.files.find((f) => f.file === 'lots-and-concessions-grey.geojson');
      expect(file.semanticFieldGuesses.lotField).toBe('LOT');
      expect(file.semanticFieldGuesses.concessionField).toBe('CONCESSION');
    } finally {
      fs.rmSync(inputDir, { recursive: true, force: true });
      fs.rmSync(outPath, { force: true });
    }
  });

  test('LIO fallback remains guarded and is not used when Grey source explicitly requested', () => {
    const run = spawnSync('node', ['command/download_grey_open_data.mjs', '--dry-run', '--source=lots-and-concessions-grey'], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('lots-and-concessions-grey');
    expect(run.stdout).not.toContain('lot-fabric-improved-lio');
  });

  test('secondary report summarizes feature counts', () => {
    const inputDir = path.resolve('know/input/gis-secondary-fixture');
    const outputDir = path.resolve('know/produce/secondary-fixture');
    fs.mkdirSync(inputDir, { recursive: true });
    fs.writeFileSync(path.join(inputDir, 'grey-transit-bus-stops.geojson'), JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } }] }));
    fs.writeFileSync(path.join(inputDir, 'county-trails.geojson'), JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[0, 0], [0.01, 0.01]] } }] }));
    try {
      const { summary } = buildGreySecondaryDataReport({ inputDir, outputDir });
      expect(summary.transitStopCount).toBe(1);
      expect(summary.trailFeatureCount).toBe(1);
    } finally {
      fs.rmSync(inputDir, { recursive: true, force: true });
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  test('candidates option prints candidate lines in non-dry-run mode', () => {
    const discover = spawnSync('node', ['command/discover_grey_open_data.mjs', '--source=municipality-boundaries', '--candidates'], { encoding: 'utf8' });
    expect(discover.status).toBe(0);
    expect(discover.stdout).toContain('candidates:');
  });

  test('summarize command reads fixture geojson and reports feature count/properties', () => {
    const baseDir = path.resolve('know/input/gis-test-summary');
    const outPath = path.resolve('know/produce/grey-gis-summary-test.json');
    fs.mkdirSync(baseDir, { recursive: true });
    fs.writeFileSync(path.join(baseDir, 'fixture.geojson'), JSON.stringify({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { NAME: 'A', TYPE: 'x' }, geometry: { type: 'Point', coordinates: [-80, 44] } },
        { type: 'Feature', properties: { NAME: 'B' }, geometry: { type: 'Point', coordinates: [-81, 45] } }
      ]
    }, null, 2));
    try {
      const run = spawnSync('node', ['command/summarize_grey_gis.mjs', `--dir=${baseDir}`, `--out=${outPath}`], { encoding: 'utf8' });
      expect(run.status).toBe(0);
      expect(run.stdout).toContain('features: 2');
      const parsed = JSON.parse(fs.readFileSync(outPath, 'utf8'));
      expect(parsed.files[0].featureCount).toBe(2);
      expect(parsed.files[0].topPropertyKeys.map((k) => k.key)).toContain('NAME');
    } finally {
      fs.rmSync(baseDir, { recursive: true, force: true });
      fs.rmSync(outPath, { force: true });
    }
  });

  test('import maps municipality/settlement/land-use layers and preserves sourceProperties', () => {
    const baseDir = path.resolve('know/input/gis-test-import');
    const outPath = path.resolve('know/produce/grey-open-data-world-test.json');
    fs.mkdirSync(baseDir, { recursive: true });
    fs.writeFileSync(path.join(baseDir, 'municipality-boundaries.geojson'), JSON.stringify({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { MUNI_NAME: 'Owen Sound', OBJECTID: 1 }, geometry: { type: 'Polygon', coordinates: [] } }]
    }));
    fs.writeFileSync(path.join(baseDir, 'settlement-boundaries.geojson'), JSON.stringify({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { SETTL_NAME: 'Chatsworth', TYPE: 'village', OBJECTID: 2 }, geometry: { type: 'Polygon', coordinates: [] } }]
    }));
    fs.writeFileSync(path.join(baseDir, 'official-plan-schedule-a-land-use.geojson'), JSON.stringify({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { LAND_USE: 'Agricultural', OBJECTID: 3 }, geometry: { type: 'Polygon', coordinates: [] } }]
    }));
    try {
      const run = spawnSync('node', ['command/import_grey_open_data.mjs', `--dir=${baseDir}`, `--out=${outPath}`], { encoding: 'utf8' });
      expect(run.status).toBe(0);
      const parsed = JSON.parse(fs.readFileSync(outPath, 'utf8'));
      expect(parsed.municipalityBoundaries).toHaveLength(1);
      expect(parsed.settlementBoundaries).toHaveLength(1);
      expect(parsed.landUsePatches).toHaveLength(1);
      expect(parsed.municipalityBoundaries[0].sourceProperties.MUNI_NAME).toBe('Owen Sound');
      expect(parsed.landUsePatches[0].sourceProperties.LAND_USE).toBe('Agricultural');
    } finally {
      fs.rmSync(baseDir, { recursive: true, force: true });
      fs.rmSync(outPath, { force: true });
    }
  });
});
