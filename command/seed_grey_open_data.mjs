// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { generateGreyCountyWorld } from '../program/data/generate_grey_county_world.mjs';

const outputDir = path.resolve('know/produce');
fs.mkdirSync(outputDir, { recursive: true });

const world = generateGreyCountyWorld({
  scale: 'full-county',
  includeRail: false,
  includeWaterFreight: false,
  includeSyntheticPolygons: true,
  useOpenDataGeometry: true,
  seedName: 'grey-county-open-data-seed'
});

const worldPath = path.join(outputDir, 'grey-county-open-data-world.json');
const municipalitiesPath = path.join(outputDir, 'grey-county-open-data-municipalities.geojson');
const settlementsPath = path.join(outputDir, 'grey-county-open-data-settlements.geojson');
const landUsePath = path.join(outputDir, 'grey-county-open-data-land-use.geojson');
const summaryPath = path.join(outputDir, 'grey-county-open-data-summary.json');

const municipalityFeatures = (world.seedMeta.openDataGeometry?.municipalityBoundaries ?? []).map((item) => ({
  type: 'Feature',
  geometry: item.geometry,
  properties: {
    municipalityId: item.municipalityId,
    municipalityName: item.municipalityName,
    geometrySource: 'grey-open-data',
    ...(item.sourceProperties ?? {})
  }
}));

const settlementFeatures = (world.seedMeta.openDataGeometry?.settlementBoundaries ?? []).map((item) => ({
  type: 'Feature',
  geometry: item.geometry,
  properties: {
    id: item.id,
    municipalityId: item.municipalityId,
    settlementName: item.settlementName,
    settlementType: item.settlementType,
    settlementTypeRaw: item.settlementTypeRaw,
    ...(item.sourceProperties ?? {})
  }
}));

const landUseFeatures = (world.seedMeta.openDataGeometry?.landUsePatches ?? []).map((item) => ({
  type: 'Feature',
  geometry: item.geometry,
  properties: {
    id: item.id,
    municipalityId: item.municipalityId,
    category: item.category,
    rawLandUse: item.rawLandUse,
    ...(item.sourceProperties ?? {})
  }
}));

fs.writeFileSync(worldPath, JSON.stringify(world, null, 2));
fs.writeFileSync(municipalitiesPath, JSON.stringify({ type: 'FeatureCollection', features: municipalityFeatures }, null, 2));
fs.writeFileSync(settlementsPath, JSON.stringify({ type: 'FeatureCollection', features: settlementFeatures }, null, 2));
fs.writeFileSync(landUsePath, JSON.stringify({ type: 'FeatureCollection', features: landUseFeatures }, null, 2));

const summary = {
  generatedAt: new Date().toISOString(),
  worldPath,
  municipalityFeaturesMatched: world.seedMeta.summary.municipalityFeaturesMatched,
  settlementFeaturesImported: world.seedMeta.summary.settlementFeaturesImported,
  landUseFeaturesImported: world.seedMeta.summary.landUseFeaturesImported,
  realLandUseFeatureCount: world.seedMeta.summary.realLandUseFeatureCount,
  landUseCategoryCounts: world.seedMeta.summary.landUseCategoryCounts,
  unclassifiedLandUseCount: world.seedMeta.summary.unclassifiedLandUseCount,
  unassignedMunicipalityLandUseCount: world.seedMeta.summary.unassignedMunicipalityLandUseCount,
  warnings: world.seedMeta.warnings ?? [],
  note: 'Roads remain synthetic/unverified in this open-data geometry mode.'
};
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

console.log(`world: ${worldPath}`);
console.log(`municipalities geojson: ${municipalitiesPath}`);
console.log(`settlements geojson: ${settlementsPath}`);
console.log(`land-use geojson: ${landUsePath}`);
console.log(`summary: ${summaryPath}`);
console.log(`municipality features matched: ${summary.municipalityFeaturesMatched}`);
console.log(`settlement features imported: ${summary.settlementFeaturesImported}`);
console.log(`land-use features imported: ${summary.landUseFeaturesImported}`);
console.log(`land-use category counts: ${JSON.stringify(summary.landUseCategoryCounts)}`);
console.log(`warnings: ${summary.warnings.length}`);
for (const warning of summary.warnings) {
  console.log(`  - ${warning}`);
}
console.log('road source: synthetic (road centrelines unverified)');
