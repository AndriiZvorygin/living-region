// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (const item of argv) {
    if (!item.startsWith('--')) continue;
    const [k, v] = item.slice(2).split('=');
    args[k] = v ?? true;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const sourceDir = path.resolve(args.dir ?? 'know/input/gis');
const outputPath = path.resolve(args.out ?? 'know/produce/grey-open-data-world.json');

function readGeoJson(fileName, warnings) {
  const fullPath = path.join(sourceDir, fileName);
  if (!fs.existsSync(fullPath)) {
    warnings.push(`missing source file: ${fileName}`);
    return [];
  }
  const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  return Array.isArray(parsed?.features) ? parsed.features : [];
}

function pickString(props, keys) {
  for (const key of keys) {
    const value = props[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value);
    }
  }
  return null;
}

function mapFeatures(features, mapper) {
  return features.map((feature, index) => {
    const sourceProperties = feature?.properties ?? {};
    return mapper(feature, sourceProperties, index);
  });
}

const warnings = [];
const municipalityFeatures = readGeoJson('municipality-boundaries.geojson', warnings);
const settlementFeatures = readGeoJson('settlement-boundaries.geojson', warnings);
const landUseFeatures = readGeoJson('official-plan-schedule-a-land-use.geojson', warnings);
const roadFeatures = readGeoJson('road-centrelines.geojson', warnings);
const lotFeatures = readGeoJson('lot-fabric-improved.geojson', warnings);

const world = {
  generatedAt: new Date().toISOString(),
  sourceDir,
  municipalityBoundaries: mapFeatures(municipalityFeatures, (feature, props, index) => ({
    id: pickString(props, ['OBJECTID', 'OBJECTID_1', 'id', 'ID']) ?? `municipality-${index + 1}`,
    name: pickString(props, ['MUNI_NAME', 'MUNICIPALITY', 'MUNIC_NAME', 'NAME', 'name']) ?? `Municipality ${index + 1}`,
    geometry: feature.geometry ?? null,
    sourceProperties: props
  })),
  settlementBoundaries: mapFeatures(settlementFeatures, (feature, props, index) => ({
    id: pickString(props, ['OBJECTID', 'id', 'ID']) ?? `settlement-${index + 1}`,
    name: pickString(props, ['SETTLEMENT', 'SETTL_NAME', 'NAME', 'name']) ?? `Settlement ${index + 1}`,
    settlementType: pickString(props, ['TYPE', 'SETTL_TYPE', 'CATEGORY', 'CLASS']) ?? null,
    geometry: feature.geometry ?? null,
    sourceProperties: props
  })),
  landUsePatches: mapFeatures(landUseFeatures, (feature, props, index) => ({
    id: pickString(props, ['OBJECTID', 'id', 'ID']) ?? `landuse-${index + 1}`,
    designation: pickString(props, ['LANDUSE', 'LAND_USE', 'DESIGNATION', 'CATEGORY', 'CLASS']) ?? 'unspecified',
    geometry: feature.geometry ?? null,
    sourceProperties: props
  })),
  roadCentrelines: mapFeatures(roadFeatures, (feature, props, index) => ({
    id: pickString(props, ['OBJECTID', 'id', 'ID']) ?? `road-${index + 1}`,
    roadName: pickString(props, ['ROAD_NAME', 'NAME', 'STREET']) ?? null,
    roadClass: pickString(props, ['ROAD_CLASS', 'CLASS', 'TYPE']) ?? null,
    geometry: feature.geometry ?? null,
    sourceProperties: props
  })),
  lotFabric: mapFeatures(lotFeatures, (feature, props, index) => ({
    id: pickString(props, ['OBJECTID', 'id', 'ID']) ?? `lot-${index + 1}`,
    lot: pickString(props, ['LOT', 'LOT_NO']) ?? null,
    concession: pickString(props, ['CONCESSION', 'CON_NO']) ?? null,
    geometry: feature.geometry ?? null,
    sourceProperties: props
  })),
  warnings
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(world, null, 2));

console.log(`municipality boundary features: ${world.municipalityBoundaries.length}`);
console.log(`settlement boundary features: ${world.settlementBoundaries.length}`);
console.log(`land-use features: ${world.landUsePatches.length}`);
console.log(`road features: ${world.roadCentrelines.length}`);
console.log(`lots/fabric features: ${world.lotFabric.length}`);
console.log(`warnings: ${warnings.length}`);
for (const warning of warnings) {
  console.log(`  - ${warning}`);
}
console.log(`output: ${outputPath}`);
