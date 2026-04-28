// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { greyOpenDataManifest } from '../program/data/grey_open_data_manifest.mjs';
import { discoverLayerDownloadInfo } from '../program/gis/arcgis_hub_discovery.mjs';

const outputDir = path.resolve('know/produce');
fs.mkdirSync(outputDir, { recursive: true });

const results = [];
for (const source of greyOpenDataManifest) {
  if (source.status === 'webSummaryOnly') {
    results.push({ id: source.id, name: source.name, status: source.status, ok: true, candidates: [], warnings: ['web summary source'] });
    continue;
  }
  const discovered = await discoverLayerDownloadInfo(source);
  results.push(discovered);
}

const discoveryPath = path.join(outputDir, 'grey-open-data-discovery.json');
fs.writeFileSync(discoveryPath, JSON.stringify({ generatedAt: new Date().toISOString(), sources: results }, null, 2));

const candidateIds = new Set(['road-structures', 'road-projects', 'rail-trails-row', 'public-facilities', 'asset-management-summary']);
const candidates = results
  .filter((x) => candidateIds.has(x.id) || !x.ok || (x.candidates ?? []).length > 0)
  .map((x) => ({
    id: x.id,
    name: x.name,
    status: x.ok ? 'candidate-found' : 'not-found',
    candidateCount: (x.candidates ?? []).length,
    confidenceScore: x.confidenceScore ?? 0,
    confidence: x.confidence ?? 0,
    itemId: x.itemId ?? null,
    serviceUrl: x.serviceUrl ?? null,
    layerId: x.layerId ?? null,
    layerName: x.layerName ?? null,
    owner: x.itemMetadataSummary?.owner ?? x.selectedCandidate?.owner ?? null,
    type: x.itemMetadataSummary?.type ?? x.selectedCandidate?.type ?? null,
    access: x.itemMetadataSummary?.access ?? x.selectedCandidate?.access ?? null,
    verificationStatus: x.ok ? 'needsVerification' : 'missing',
    topCandidates: (x.candidates ?? []).slice(0, 5),
    selected: x.selectedCandidate ?? null,
    warnings: x.warnings ?? []
  }));

const candidatesPath = path.join(outputDir, 'grey-additional-data-candidates.json');
fs.writeFileSync(candidatesPath, JSON.stringify({ generatedAt: new Date().toISOString(), sources: candidates }, null, 2));

console.log(`written: ${discoveryPath}`);
console.log(`written: ${candidatesPath}`);
for (const item of results) {
  console.log(`${item.id}: ${item.itemId ?? 'n/a'} | ${item.serviceUrl ?? 'n/a'} | candidates=${(item.candidates ?? []).length}`);
}
