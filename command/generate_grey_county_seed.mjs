// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { generateGreyCountyWorld } from '../program/data/generate_grey_county_world.mjs';
import { exportGeoJSON } from '../program/gis/export_geojson.mjs';

function parseArgs(argv) {
  const args = {};
  for (const item of argv) {
    if (!item.startsWith('--')) {
      continue;
    }
    const [key, value] = item.slice(2).split('=');
    args[key] = value ?? true;
  }
  return args;
}

function toBool(value, fallback = false) {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function scaleSuffix(scale) {
  return scale === 'full-county' ? '-full' : '';
}

const args = parseArgs(process.argv.slice(2));
const scale = args.scale ?? 'small';
const includeRail = toBool(args.rail, false);
const includeWaterFreight = toBool(args.water, false);
const includeSyntheticPolygons = !toBool(args.noPolygons, false);
const keepFullLandArea = toBool(args.keepFullLandArea, false);

const world = generateGreyCountyWorld({
  scale,
  includeRail,
  includeWaterFreight,
  includeSyntheticPolygons,
  keepFullLandArea,
  seedName: 'grey-county-seed'
});

const outputDir = path.resolve('know/produce');
fs.mkdirSync(outputDir, { recursive: true });

const suffix = scaleSuffix(world.seedMeta.scale);
const worldPath = path.join(outputDir, `grey-county-seed-world${suffix}.json`);
fs.writeFileSync(worldPath, JSON.stringify(world, null, 2));

const geo = exportGeoJSON(world);
const patchesPath = path.join(outputDir, `grey-county-seed-patches${suffix}.geojson`);
const networksPath = path.join(outputDir, `grey-county-seed-networks${suffix}.geojson`);
const stationsPath = path.join(outputDir, `grey-county-seed-stations${suffix}.geojson`);
const anchorsPath = path.join(outputDir, `grey-county-seed-freight-anchors${suffix}.geojson`);
const municipalSummaryPath = path.join(outputDir, 'grey-county-seed-municipal-summary.csv');

fs.writeFileSync(patchesPath, JSON.stringify(geo.patches, null, 2));
fs.writeFileSync(networksPath, JSON.stringify(geo.networks, null, 2));
if (includeRail) {
  fs.writeFileSync(stationsPath, JSON.stringify(geo.stations, null, 2));
}
if (geo.freightAnchors.features.length > 0) {
  fs.writeFileSync(anchorsPath, JSON.stringify(geo.freightAnchors, null, 2));
}
fs.writeFileSync(municipalSummaryPath, world.seedMeta.summaryCsvText);

const summary = world.seedMeta.summary;

console.log(`Grey County seed world written: ${worldPath}`);
console.log(`patches GeoJSON: ${patchesPath}`);
console.log(`networks GeoJSON: ${networksPath}`);
if (includeRail) {
  console.log(`stations GeoJSON: ${stationsPath}`);
}
if (geo.freightAnchors.features.length > 0) {
  console.log(`freight anchors GeoJSON: ${anchorsPath}`);
}
console.log(`municipal summary CSV: ${municipalSummaryPath}`);
console.log(`settlements: ${world.settlements.length}`);
console.log(`municipalities: ${world.seedMeta.censusValidation.summary.municipalityCount}`);
console.log(`populationScaleMultiplier: ${world.seedMeta.scaling.populationScaleMultiplier}`);
console.log(`areaScaleMultiplier: ${world.seedMeta.scaling.areaScaleMultiplier}`);
console.log(`syntheticPopulation: ${summary.syntheticPopulation}`);
console.log(`expectedScaledPopulation: ${Math.round(summary.expectedScaledPopulation)}`);
console.log(`populationScaleError: ${Math.round(summary.populationScaleError)}`);
console.log(`totalSyntheticPatchAreaHa: ${Math.round(summary.totalSyntheticPatchAreaHa)}`);
console.log(`expectedScaledAreaHa: ${Math.round(summary.expectedScaledAreaHa)}`);
console.log(`areaScaleError: ${Math.round(summary.areaScaleError)}`);
console.log(`households: ${summary.households}`);
console.log(`dwellingUnits: ${summary.dwellingUnits}`);
console.log(`vacancyRate: ${summary.vacancyRate.toFixed(4)}`);
console.log(`roadSegments: ${summary.roadSegments}`);
console.log(`railSegments: ${summary.railSegments}`);
console.log(`waterSegments: ${summary.waterSegments}`);
console.log(`stations: ${summary.stations}`);
console.log(`freightAnchors: ${summary.freightAnchors}`);
console.log('warning: synthetic coordinate-seeded geometry using census-scaled population/area; replace with real GIS boundaries and centrelines for planning-grade analysis.');
