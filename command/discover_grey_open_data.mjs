// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { greyOpenDataManifest } from '../program/data/grey_open_data_manifest.mjs';
import { discoverLayerDownloadInfo } from '../program/gis/arcgis_hub_discovery.mjs';

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
const dryRun = toBool(args['dry-run'], false);
const sourceFilter = args.source ?? null;
const printCandidates = toBool(args.candidates, false);
const outputDir = path.resolve('know/produce');
fs.mkdirSync(outputDir, { recursive: true });
const overridesPath = path.resolve('know/input/gis/source-overrides.json');
const overrides = fs.existsSync(overridesPath) ? JSON.parse(fs.readFileSync(overridesPath, 'utf8')) : {};

const results = [];
for (const source of greyOpenDataManifest.filter((s) => !sourceFilter || s.id === sourceFilter)) {
  const mergedSource = {
    ...source,
    ...(overrides[source.id] ?? {})
  };
  if (dryRun) {
    results.push({
      id: mergedSource.id,
      name: mergedSource.name,
      sourcePageUrl: mergedSource.sourcePageUrl,
      itemId: mergedSource.itemId,
      serviceUrl: mergedSource.serviceUrl,
      layerId: mergedSource.layerId,
      layers: [],
      candidates: [],
      confidence: 1,
      warnings: ['dry-run: discovery skipped'],
      ok: true
    });
  } else {
    const discovered = await discoverLayerDownloadInfo({ ...mergedSource });
    results.push(discovered);
  }
}

for (const item of results) {
  console.log(`${item.id}: ${item.name}`);
  console.log(`  status: ${item.ok ? 'ok' : 'not-found'}`);
  console.log(`  sourcePage: ${item.sourcePageUrl}`);
  console.log(`  candidates: ${(item.candidates ?? []).length}`);
  console.log(`  itemId: ${item.itemId ?? 'n/a'}`);
  console.log(`  selectedTitle: ${item.itemMetadataSummary?.title ?? item.selectedCandidate?.title ?? 'n/a'}`);
  console.log(`  selectedOwner: ${item.itemMetadataSummary?.owner ?? item.selectedCandidate?.owner ?? 'n/a'}`);
  console.log(`  selectedType: ${item.itemMetadataSummary?.type ?? item.selectedCandidate?.type ?? 'n/a'}`);
  console.log(`  serviceUrl: ${item.serviceUrl ?? 'n/a'}`);
  console.log(`  layerId: ${item.layerId ?? 'n/a'}`);
  console.log(`  layerName: ${item.layerName ?? 'n/a'}`);
  console.log(`  layers: ${(item.layers ?? []).map((x) => `${x.id}:${x.name}`).join(', ') || 'none'}`);
  console.log(`  fields: ${(item.serviceFieldNames ?? []).join(', ') || 'none'}`);
  console.log(`  semanticFields: ${JSON.stringify(item.semanticFieldGuesses ?? {})}`);
  console.log(`  confidence: ${Number(item.confidence ?? 0).toFixed(2)}`);
  if (printCandidates && (item.candidates ?? []).length > 0) {
    for (const candidate of item.candidates.slice(0, 10)) {
      console.log(`  candidate: ${candidate.id} | ${candidate.title ?? 'n/a'} | owner=${candidate.owner ?? 'n/a'} | type=${candidate.type ?? 'n/a'} | score=${candidate.score ?? 0}`);
    }
  }
  if ((item.warnings ?? []).length > 0) {
    for (const warning of item.warnings) {
      console.log(`  warning: ${warning}`);
    }
  }
}

const outPath = path.join(outputDir, 'grey-open-data-discovery.json');
fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), dryRun, sources: results }, null, 2));
console.log(`written: ${outPath}`);

const fieldInventoryPath = path.join(outputDir, 'grey-field-inventory.json');
fs.writeFileSync(fieldInventoryPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  sources: results.map((item) => ({
    id: item.id,
    name: item.name,
    fieldNames: item.serviceFieldNames ?? [],
    semanticFieldGuesses: item.semanticFieldGuesses ?? {}
  }))
}, null, 2));
console.log(`written: ${fieldInventoryPath}`);
