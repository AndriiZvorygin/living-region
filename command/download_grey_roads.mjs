// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { manifestById } from '../program/data/grey_open_data_manifest.mjs';
import { discoverLayerDownloadInfo } from '../program/gis/arcgis_hub_discovery.mjs';
import { downloadFeatureLayerAsGeoJson } from '../program/gis/arcgis_rest_download.mjs';
import { downloadHubItemGeoJson } from '../program/gis/arcgis_hub_download.mjs';

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

const args = parseArgs(process.argv.slice(2));
const allowLarge = toBool(args['allow-large-download'], false);
const outDir = path.resolve('know/input/gis');
fs.mkdirSync(outDir, { recursive: true });

async function downloadBySource(sourceId, outputFile) {
  const source = manifestById(sourceId);
  if (!source) return { ok: false, reason: `missing manifest source ${sourceId}` };
  if (source.largeDataset && !allowLarge) {
    return { ok: false, reason: `${sourceId} blocked: add --allow-large-download or filter` };
  }
  const discovered = (source.itemId || source.serviceUrl)
    ? source
    : await discoverLayerDownloadInfo(source);

  const itemId = discovered.itemId ?? source.itemId;
  const serviceUrl = discovered.serviceUrl ?? source.serviceUrl;
  const layerId = discovered.layerId ?? source.layerId ?? 0;

  let result;
  if (itemId) {
    result = await downloadHubItemGeoJson({ hubBaseUrl: source.sourcePageUrl, itemId, layerId, serviceUrl });
  } else if (serviceUrl) {
    result = await downloadFeatureLayerAsGeoJson({ serviceUrl, layerId, where: source.defaultWhere ?? '1=1' });
  } else {
    return { ok: false, reason: `${sourceId} has no itemId/serviceUrl` };
  }

  const fc = result.featureCollection ?? { type: 'FeatureCollection', features: [] };
  fs.writeFileSync(path.join(outDir, outputFile), JSON.stringify(fc, null, 2));
  return { ok: true, sourceId, output: path.join(outDir, outputFile), featureCount: fc.features?.length ?? 0, itemId, serviceUrl, layerId };
}

let primary = await downloadBySource('road-centrelines-grey', 'road-centrelines-grey.geojson');
if (!primary.ok) {
  console.log(`grey roads primary failed: ${primary.reason}`);
  const fallback = await downloadBySource('road-centrelines-orn', 'road-centrelines-orn.geojson');
  if (!fallback.ok) {
    console.log(`orn fallback failed: ${fallback.reason}`);
    process.exit(1);
  }
  primary = fallback;
}

console.log(`downloaded: ${primary.output}`);
console.log(`featureCount: ${primary.featureCount}`);
console.log(`itemId: ${primary.itemId ?? 'n/a'}`);
console.log(`serviceUrl: ${primary.serviceUrl ?? 'n/a'}`);
console.log(`layerId: ${primary.layerId ?? 'n/a'}`);
