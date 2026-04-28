// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { greyOpenDataManifest } from '../program/data/grey_open_data_manifest.mjs';
import { discoverLayerDownloadInfo } from '../program/gis/arcgis_hub_discovery.mjs';
import { downloadHubItemGeoJson } from '../program/gis/arcgis_hub_download.mjs';
import { downloadFeatureLayerAsGeoJson } from '../program/gis/arcgis_rest_download.mjs';

function parseArgs(argv) {
  const args = {};
  for (const item of argv) {
    if (!item.startsWith('--')) continue;
    const [k, v] = item.slice(2).split('=');
    args[k] = v ?? true;
  }
  return args;
}
function toBool(v, d = false) {
  if (v === undefined) return d;
  if (typeof v === 'boolean') return v;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

function normalizeFeatureCollection(candidate) {
  if (candidate?.type === 'FeatureCollection' && Array.isArray(candidate.features)) return candidate;
  if (Array.isArray(candidate?.features)) return { type: 'FeatureCollection', features: candidate.features };
  return { type: 'FeatureCollection', features: [] };
}

function normalizeServiceUrlAndLayerId(serviceUrl, layerId) {
  if (!serviceUrl) return { serviceUrl: null, layerId: layerId ?? null };
  const clean = serviceUrl.replace(/\/$/, '');
  const match = clean.match(/(.*\/(FeatureServer|MapServer))\/(\d+)$/i);
  if (!match) return { serviceUrl: clean, layerId: layerId ?? null };
  const baseServiceUrl = match[1];
  const parsedLayerId = Number(match[3]);
  return {
    serviceUrl: baseServiceUrl,
    layerId: layerId ?? (Number.isFinite(parsedLayerId) ? parsedLayerId : null)
  };
}

const args = parseArgs(process.argv.slice(2));
const dryRun = toBool(args['dry-run'], false);
const outDir = path.resolve(args.out ?? 'know/input/gis');
const sourceId = args.source ?? null;
const explicitServiceUrl = args['service-url'] ?? null;
const explicitItemId = args['item-id'] ?? null;
const explicitLayerId = args['layer-id'] !== undefined ? Number(args['layer-id']) : null;
const includeUnverified = toBool(args['include-unverified'], false);
const allowLargeDownload = toBool(args['allow-large-download'], false);
const secondaryOnly = toBool(args.secondary, false);
const allUseful = toBool(args['all-useful'], false);
const explicitWhere = args.where ?? null;
const explicitBbox = args.bbox ?? null;
const all = sourceId ? false : toBool(args.all, true);
const overridesPath = path.resolve('know/input/gis/source-overrides.json');
const overrides = fs.existsSync(overridesPath) ? JSON.parse(fs.readFileSync(overridesPath, 'utf8')) : {};

let selected = greyOpenDataManifest.filter((s) => (all ? true : s.id === sourceId));
if (selected.length === 0) {
  console.error('No matching sources.');
  process.exit(1);
}
if (all && !includeUnverified) {
  if (allUseful) {
    selected = selected.filter((s) => s.status !== 'webSummaryOnly');
  } else if (secondaryOnly) {
    selected = selected.filter((s) => !['municipality-boundaries', 'settlement-boundaries', 'official-plan-schedule-a-land-use', 'road-centrelines-grey'].includes(s.id));
  } else {
    selected = selected.filter((s) => s.verified);
  }
}

fs.mkdirSync(outDir, { recursive: true });
const manifestRows = [];

for (const source of selected) {
  if (sourceId && !source.verified && !includeUnverified) {
    console.warn(`warning: ${source.id} is unverified; using explicit source selection`);
  }

  const sourceWithOverride = {
    ...source,
    ...(overrides[source.id] ?? {})
  };

  const discovered = (sourceWithOverride.itemId || sourceWithOverride.serviceUrl || dryRun)
    ? { ...sourceWithOverride, layers: [], warnings: dryRun ? ['dry-run: discovery skipped'] : [] }
    : await discoverLayerDownloadInfo({ ...sourceWithOverride });

  if (!sourceId && allUseful && !dryRun) {
    const confidence = discovered.confidence ?? 0;
    const largeGuarded = source.largeDownloadGuarded || source.largeDataset;
    if ((source.verified !== true && confidence < 0.75) || source.status === 'webSummaryOnly' || source.expectedGeometryType === 'None') {
      console.log(`${source.id}: skipped (not verified and low-confidence or non-downloadable source)`);
      manifestRows.push({ id: source.id, ok: false, reason: 'not-useful-downloadable' });
      continue;
    }
    if (largeGuarded && !allowLargeDownload && !explicitWhere && !explicitBbox) {
      console.log(`${source.id}: skipped (large-download guarded; use --allow-large-download or filters)`);
      manifestRows.push({ id: source.id, ok: false, reason: 'large-download-guarded' });
      continue;
    }
  }

  const discoveredServiceUrl = explicitServiceUrl ?? discovered.serviceUrl ?? sourceWithOverride.serviceUrl ?? null;
  const itemId = explicitItemId ?? discovered.itemId ?? sourceWithOverride.itemId ?? null;
  let layerId = explicitLayerId ?? discovered.layerId ?? sourceWithOverride.layerId ?? null;
  let serviceUrl = discoveredServiceUrl;
  ({ serviceUrl, layerId } = normalizeServiceUrlAndLayerId(serviceUrl, layerId));
  if (layerId === null || layerId === undefined) layerId = 0;

  if (dryRun) {
    console.log(`[dry-run] ${source.id}: itemId=${itemId ?? 'n/a'} serviceUrl=${serviceUrl ?? 'n/a'} layerId=${layerId ?? 'n/a'}`);
    manifestRows.push({ id: source.id, dryRun: true, itemId: itemId ?? null, serviceUrl: serviceUrl ?? null, layerId, outputPath: path.join(outDir, `${source.id}.geojson`) });
    continue;
  }

  if (source.largeDataset && !allowLargeDownload && !explicitWhere && !explicitBbox) {
    console.log(`${source.id}: blocked (large dataset requires --allow-large-download or --where/--bbox filter)`);
    manifestRows.push({ id: source.id, ok: false, reason: 'large-download-blocked' });
    continue;
  }

  let downloadResult = null;
  if (itemId) {
    downloadResult = await downloadHubItemGeoJson({ hubBaseUrl: source.sourcePageUrl, itemId, layerId, serviceUrl });
  } else if (serviceUrl) {
    downloadResult = await downloadFeatureLayerAsGeoJson({ serviceUrl, layerId, where: explicitWhere ?? '1=1' });
    downloadResult = { ...downloadResult, mode: 'rest-only', ok: true };
  } else {
    console.log(`${source.id}: skipped (no itemId/serviceUrl discovered)`);
    manifestRows.push({ id: source.id, ok: false, reason: 'no itemId/serviceUrl' });
    continue;
  }

  const featureCollection = normalizeFeatureCollection(downloadResult.featureCollection);
  const outPath = path.join(outDir, `${source.id}.geojson`);
  fs.writeFileSync(outPath, JSON.stringify(featureCollection, null, 2));

  const geometrySummary = featureCollection.features
    .map((f) => f.geometry?.type ?? 'null')
    .reduce((acc, type) => {
      acc[type] = (acc[type] ?? 0) + 1;
      return acc;
    }, {});

  console.log(`${source.id}: features=${featureCollection.features.length} mode=${downloadResult.mode ?? 'unknown'}`);
  manifestRows.push({
    id: source.id,
    ok: true,
    mode: downloadResult.mode ?? 'unknown',
    itemId: itemId ?? null,
    serviceUrl: serviceUrl ?? null,
    layerId,
    outputPath: outPath,
    featureCount: featureCollection.features.length,
    geometrySummary,
    warnings: downloadResult.warnings ?? []
  });
}

const manifestPath = path.join(outDir, 'download-manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify({ generatedAt: new Date().toISOString(), dryRun, sources: manifestRows }, null, 2));
console.log(`written: ${manifestPath}`);
