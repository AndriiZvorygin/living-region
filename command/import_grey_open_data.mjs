// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { assignFeatureToPolygonByCentroid } from '../program/gis/spatial_assignment.mjs';

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

function pickCaseInsensitive(props, keys) {
  const all = Object.keys(props ?? {});
  for (const key of keys) {
    const found = all.find((k) => k.toLowerCase() === key.toLowerCase());
    if (found && props[found] !== undefined && props[found] !== null && String(props[found]).trim() !== '') return props[found];
  }
  return null;
}

function normalizeName(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/^(township|town|city|municipality)\s+of\s+/, '')
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const warnings = [];
const municipalityFeatures = readGeoJson('municipality-boundaries.geojson', warnings);
const settlementFeatures = readGeoJson('settlement-boundaries.geojson', warnings);
const landUseFeatures = readGeoJson('official-plan-schedule-a-land-use.geojson', warnings);
const roadFeatures = fs.existsSync(path.join(sourceDir, 'road-centrelines-grey.geojson'))
  ? readGeoJson('road-centrelines-grey.geojson', warnings)
  : readGeoJson('road-centrelines.geojson', warnings);
const lotFeaturesLegacy = readGeoJson('lot-fabric-improved.geojson', warnings);
const secondarySourceFiles = [
  { sourceId: 'grey-transit-bus-stops', file: 'grey-transit-bus-stops.geojson', collection: 'transitStops' },
  { sourceId: 'grey-transit-routes', file: 'grey-transit-routes.geojson', collection: 'transitRoutes' },
  { sourceId: 'official-road-cycling-routes', file: 'official-road-cycling-routes.geojson', collection: 'cyclingRoutes' },
  { sourceId: 'county-trails', file: 'county-trails.geojson', collection: 'trails' },
  { sourceId: 'cp-rail-trail', file: 'cp-rail-trail.geojson', collection: 'trails' },
  { sourceId: 'hiking-trails', file: 'hiking-trails.geojson', collection: 'trails' },
  { sourceId: 'tom-thomson-trail', file: 'tom-thomson-trail.geojson', collection: 'trails' },
  { sourceId: 'managed-forest-boundary', file: 'managed-forest-boundary.geojson', collection: 'forestAreas' },
  { sourceId: 'hazardous-forest-types-wildfire', file: 'hazardous-forest-types-wildfire.geojson', collection: 'riskAreas' },
  { sourceId: 'on-farm-rural-business-listing', file: 'on-farm-rural-business-listing.geojson', collection: 'ruralBusinesses' },
  { sourceId: 'population-estimates-2011-2041', file: 'population-estimates-2011-2041.geojson', collection: 'populationEstimates' },
  { sourceId: 'public-facilities', file: 'public-facilities.geojson', collection: 'facilities' },
  { sourceId: 'community-facilities', file: 'community-facilities.geojson', collection: 'facilities' },
  { sourceId: 'libraries', file: 'libraries.geojson', collection: 'facilities' },
  { sourceId: 'arenas-community-centres', file: 'arenas-community-centres.geojson', collection: 'facilities' },
  { sourceId: 'works-yards-depots', file: 'works-yards-depots.geojson', collection: 'facilities' },
  { sourceId: 'emergency-services', file: 'emergency-services.geojson', collection: 'facilities' },
  { sourceId: 'bridges-culverts-structures', file: 'bridges-culverts-structures.geojson', collection: 'roadStructures' },
  { sourceId: 'road-projects-construction-resurfacing', file: 'road-projects-construction-resurfacing.geojson', collection: 'roadProjects' },
  { sourceId: 'road-condition', file: 'road-condition.geojson', collection: 'roadProjects' },
  { sourceId: 'lots-and-concessions-grey', file: 'lots-and-concessions-grey.geojson', collection: 'lotsAndConcessions' },
  { sourceId: 'lot-fabric-improved-lio', file: 'lot-fabric-improved-lio.geojson', collection: 'lotFabric' }
];

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
  lotsAndConcessions: [],
  lotFabric: mapFeatures(lotFeaturesLegacy, (feature, props, index) => ({
    id: pickString(props, ['OBJECTID', 'id', 'ID']) ?? `lot-${index + 1}`,
    lot: pickString(props, ['LOT', 'LOT_NO']) ?? null,
    concession: pickString(props, ['CONCESSION', 'CON_NO']) ?? null,
    geometry: feature.geometry ?? null,
    sourceProperties: props
  })),
  transitStops: [],
  transitRoutes: [],
  cyclingRoutes: [],
  trails: [],
  forestAreas: [],
  riskAreas: [],
  ruralBusinesses: [],
  populationEstimates: [],
  facilities: [],
  roadStructures: [],
  roadProjects: [],
  warnings
};

const muniFeaturesWithName = world.municipalityBoundaries.map((m, i) => ({
  type: 'Feature',
  geometry: m.geometry,
  municipalityId: m.id,
  municipalityName: m.name,
  properties: municipalityFeatures[i]?.properties ?? {}
}));
const muniByName = new Map(world.municipalityBoundaries.map((m) => [normalizeName(m.name), m]));

for (const entry of secondarySourceFiles) {
  const features = readGeoJson(entry.file, warnings);
  for (const [index, feature] of features.entries()) {
    const props = feature?.properties ?? {};
    const muniHint = pickCaseInsensitive(props, ['MUNICIPAL', 'MUNICIPALITY', 'MUN_NAME', 'JURIS_L', 'COUNTY']);
    let municipality = muniByName.get(normalizeName(muniHint));
    let assignmentMethod = 'sourceProperty';
    if (!municipality) {
      const assigned = assignFeatureToPolygonByCentroid(feature, muniFeaturesWithName);
      municipality = assigned.matched ? { id: assigned.matched.municipalityId, name: assigned.matched.municipalityName } : null;
      assignmentMethod = municipality ? 'geometryCentroid' : 'unassigned';
    }
    const base = {
      id: `${entry.sourceId}-${index + 1}`,
      sourceId: entry.sourceId,
      mappedType: entry.collection,
      municipalityId: municipality?.id ?? null,
      municipalityName: municipality?.name ?? null,
      assignmentMethod,
      geometry: feature.geometry ?? null,
      sourceProperties: props,
      confidence: assignmentMethod === 'unassigned' ? 0.2 : (assignmentMethod === 'geometryCentroid' ? 0.7 : 0.9),
      warnings: assignmentMethod === 'unassigned' ? ['municipality assignment missing'] : []
    };
    if (entry.sourceId === 'lots-and-concessions-grey') {
      base.lot = pickString(props, ['LOT', 'LOT_NO', 'LOT_NUMBER', 'LOTNUM']) ?? null;
      base.concession = pickString(props, ['CONCESSION', 'CON_NO', 'CONCESSION_NO']) ?? null;
      base.township = pickString(props, ['TOWNSHIP', 'GEOGRAPHIC_TOWNSHIP', 'MUNICIPAL']) ?? null;
      base.municipality = pickString(props, ['MUNICIPALITY', 'MUNICIPAL', 'MUN_NAME']) ?? null;
    }
    world[entry.collection].push(base);
  }
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(world, null, 2));

console.log(`municipality boundary features: ${world.municipalityBoundaries.length}`);
console.log(`settlement boundary features: ${world.settlementBoundaries.length}`);
console.log(`land-use features: ${world.landUsePatches.length}`);
console.log(`road features: ${world.roadCentrelines.length}`);
console.log(`lots/fabric features: ${world.lotFabric.length}`);
console.log(`lots and concessions features: ${world.lotsAndConcessions.length}`);
console.log(`transit stops: ${world.transitStops.length}`);
console.log(`transit routes: ${world.transitRoutes.length}`);
console.log(`cycling routes: ${world.cyclingRoutes.length}`);
console.log(`trails: ${world.trails.length}`);
console.log(`forest areas: ${world.forestAreas.length}`);
console.log(`risk areas: ${world.riskAreas.length}`);
console.log(`rural businesses: ${world.ruralBusinesses.length}`);
console.log(`population estimates: ${world.populationEstimates.length}`);
console.log(`facilities: ${world.facilities.length}`);
console.log(`road structures: ${world.roadStructures.length}`);
console.log(`road projects: ${world.roadProjects.length}`);
console.log(`warnings: ${warnings.length}`);
for (const warning of warnings) {
  console.log(`  - ${warning}`);
}
console.log(`output: ${outputPath}`);
