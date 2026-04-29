// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { generateGreyCountyWorld } from '../program/data/generate_grey_county_world.mjs';
import { summarizeGreySecondaryCollections } from '../program/data/grey_secondary_counts.mjs';

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

if (fs.existsSync(summaryPath) && fs.existsSync(worldPath)) {
  try {
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    console.log(`world: ${worldPath}`);
    console.log(`municipalities geojson: ${municipalitiesPath}`);
    console.log(`settlements geojson: ${settlementsPath}`);
    console.log(`land-use geojson: ${landUsePath}`);
    console.log(`summary: ${summaryPath}`);
    console.log(`municipality features matched: ${summary.municipalityFeaturesMatched ?? 0}`);
    console.log(`settlement features imported: ${summary.settlementFeaturesImported ?? 0}`);
    console.log(`land-use features imported: ${summary.landUseFeaturesImported ?? 0}`);
    console.log(`land-use category counts: ${JSON.stringify(summary.landUseCategoryCounts ?? {})}`);
    console.log(`roadSource: ${summary.roadSource ?? 'synthetic'}`);
    console.log(`roadFeatureCount: ${summary.roadFeatureCount ?? 0}`);
    console.log(`totalRoadKm: ${Number(summary.totalRoadKm ?? 0).toFixed(2)}`);
    console.log(`roadClassCounts: ${JSON.stringify(summary.roadClassCounts ?? {})}`);
    console.log(`roadJurisdictionCounts: ${JSON.stringify(summary.roadJurisdictionCounts ?? {})}`);
    console.log(`roadFieldsDetected: ${JSON.stringify(summary.roadFieldsDetected ?? {})}`);
    console.log(`transitStopCount: ${summary.transitStopCount ?? 0}`);
    console.log(`trailFeatureCount: ${summary.trailFeatureCount ?? 0}`);
    console.log(`cyclingRouteFeatureCount: ${summary.cyclingRouteFeatureCount ?? 0}`);
    console.log(`managedForestFeatureCount: ${summary.managedForestFeatureCount ?? 0}`);
    console.log(`ruralBusinessCount: ${summary.ruralBusinessCount ?? 0}`);
    console.log(`facilityCount: ${summary.facilityCount ?? 0}`);
    console.log(`roadStructureCount: ${summary.roadStructureCount ?? 0}`);
    console.log(`secondaryDataCoverageScore: ${(summary.secondaryDataCoverageScore ?? 0).toFixed(3)}`);
    console.log(`warnings: ${(summary.warnings ?? []).length}`);
    for (const warning of (summary.warnings ?? [])) console.log(`  - ${warning}`);
    console.log(`road source note: ${summary.note ?? ''}`);
    process.exit(0);
  } catch {
    // fall through to full regeneration
  }
}

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

const secondarySummary = summarizeGreySecondaryCollections(world);
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
  roadSource: world.seedMeta.summary.roadSource,
  roadFeatureCount: world.seedMeta.summary.roadFeatureCount,
  totalRoadKm: world.seedMeta.summary.totalRoadKm,
  roadClassCounts: world.seedMeta.summary.roadClassCounts,
  roadJurisdictionCounts: world.seedMeta.summary.roadJurisdictionCounts,
  roadFieldsDetected: world.seedMeta.summary.roadFieldsDetected,
  ...secondarySummary,
  warnings: world.seedMeta.warnings ?? [],
  note: (world.seedMeta.summary.roadSource === 'grey-open-data')
    ? 'Road centrelines imported from Grey open data.'
    : 'Roads remain synthetic/unverified in this open-data geometry mode.'
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
console.log(`roadSource: ${summary.roadSource ?? 'synthetic'}`);
console.log(`roadFeatureCount: ${summary.roadFeatureCount ?? 0}`);
console.log(`totalRoadKm: ${Number(summary.totalRoadKm ?? 0).toFixed(2)}`);
console.log(`roadClassCounts: ${JSON.stringify(summary.roadClassCounts ?? {})}`);
console.log(`roadJurisdictionCounts: ${JSON.stringify(summary.roadJurisdictionCounts ?? {})}`);
console.log(`roadFieldsDetected: ${JSON.stringify(summary.roadFieldsDetected ?? {})}`);
console.log(`transitStopCount: ${summary.transitStopCount ?? 0}`);
console.log(`trailFeatureCount: ${summary.trailFeatureCount ?? 0}`);
console.log(`cyclingRouteFeatureCount: ${summary.cyclingRouteFeatureCount ?? 0}`);
console.log(`managedForestFeatureCount: ${summary.managedForestFeatureCount ?? 0}`);
console.log(`ruralBusinessCount: ${summary.ruralBusinessCount ?? 0}`);
console.log(`facilityCount: ${summary.facilityCount ?? 0}`);
console.log(`roadStructureCount: ${summary.roadStructureCount ?? 0}`);
console.log(`secondaryDataCoverageScore: ${(summary.secondaryDataCoverageScore ?? 0).toFixed(3)}`);
console.log(`warnings: ${summary.warnings.length}`);
for (const warning of summary.warnings) {
  console.log(`  - ${warning}`);
}
console.log(`road source note: ${summary.note}`);
