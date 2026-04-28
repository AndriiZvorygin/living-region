// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { greyOpenDataManifest } from '../program/data/grey_open_data_manifest.mjs';

const inputDir = path.resolve('know/input/gis');

function hasFileForSource(sourceId) {
  const candidates = [
    `${sourceId}.geojson`,
    sourceId === 'road-centrelines-grey' ? 'road-centrelines-grey.geojson' : null,
    sourceId === 'road-centrelines-orn' ? 'road-centrelines-orn.geojson' : null,
    sourceId === 'municipality-boundaries' ? 'municipality-boundaries.geojson' : null,
    sourceId === 'settlement-boundaries' ? 'settlement-boundaries.geojson' : null,
    sourceId === 'official-plan-schedule-a-land-use' ? 'official-plan-schedule-a-land-use.geojson' : null
  ].filter(Boolean);
  for (const file of candidates) {
    const p = path.join(inputDir, file);
    if (fs.existsSync(p)) {
      const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
      const features = Array.isArray(parsed?.features) ? parsed.features.length : 0;
      return { found: true, file: p, featureCount: features };
    }
  }
  return { found: false, file: null, featureCount: 0 };
}

const coreIds = new Set(['municipality-boundaries', 'settlement-boundaries', 'official-plan-schedule-a-land-use', 'road-centrelines-grey']);
const downloadedSecondary = [];
const discoveredNotDownloaded = [];
const unverified = [];
const largeGuarded = [];
const missingNoCandidate = [];

console.log('Core layers:');
for (const id of coreIds) {
  const source = greyOpenDataManifest.find((s) => s.id === id);
  const file = hasFileForSource(id);
  console.log(`  - ${id}: ${file.found ? `downloaded (${file.featureCount})` : 'missing'} | targetLayer=${source?.targetLayer ?? 'n/a'} | impact=${file.found ? 'real' : 'synthetic'}`);
}

for (const source of greyOpenDataManifest.filter((s) => !coreIds.has(s.id))) {
  const file = hasFileForSource(source.id);
  if (file.found) downloadedSecondary.push({ source, file });
  else if (source.status === 'webSummaryOnly') discoveredNotDownloaded.push({ source, reason: 'web summary only' });
  else if (source.itemId || source.serviceUrl || source.selectedTitle) discoveredNotDownloaded.push({ source, reason: 'discovered not downloaded' });
  else missingNoCandidate.push(source);
  if (!source.verified) unverified.push(source);
  if (source.largeDownloadGuarded || source.largeDataset) largeGuarded.push(source);
}

console.log('Useful secondary layers downloaded:');
for (const item of downloadedSecondary) {
  console.log(`  - ${item.source.id}: ${item.file.featureCount} | targetLayer=${item.source.targetLayer} | impact=real-input-available`);
}
console.log('Useful secondary layers discovered but not downloaded:');
for (const item of discoveredNotDownloaded) {
  console.log(`  - ${item.source.id}: ${item.reason} | targetLayer=${item.source.targetLayer}`);
}
console.log('Unverified sources:');
for (const source of unverified) console.log(`  - ${source.id}: status=${source.status}`);
console.log('Large-download guarded sources:');
for (const source of largeGuarded) console.log(`  - ${source.id}`);
console.log('Missing/no-candidate sources:');
for (const source of missingNoCandidate) console.log(`  - ${source.id}`);

const roadsReal = hasFileForSource('road-centrelines-grey').found || hasFileForSource('road-centrelines-orn').found;
console.log('real vs synthetic model status:');
console.log(`  - municipal boundaries: ${hasFileForSource('municipality-boundaries').found ? 'real' : 'synthetic'}`);
console.log(`  - settlement boundaries: ${hasFileForSource('settlement-boundaries').found ? 'real' : 'synthetic'}`);
console.log(`  - land use: ${hasFileForSource('official-plan-schedule-a-land-use').found ? 'real' : 'synthetic'}`);
console.log(`  - roads: ${roadsReal ? 'real' : 'synthetic'}`);
