// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { summarizeGreySecondaryCollections } from '../data/grey_secondary_counts.mjs';

function readGeoJson(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return Array.isArray(parsed?.features) ? parsed.features : [];
}

function lineLengthApproxKm(geometry) {
  const lines = geometry?.type === 'LineString' ? [geometry.coordinates] : geometry?.type === 'MultiLineString' ? geometry.coordinates : [];
  let sum = 0;
  for (const line of lines) {
    for (let i = 1; i < (line?.length ?? 0); i += 1) {
      const [x1, y1] = line[i - 1] ?? [];
      const [x2, y2] = line[i] ?? [];
      if ([x1, y1, x2, y2].every((v) => Number.isFinite(v))) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        sum += Math.sqrt(dx * dx + dy * dy) * 111;
      }
    }
  }
  return sum;
}

export function buildGreySecondaryDataReport(options = {}) {
  const inputDir = path.resolve(options.inputDir ?? 'know/input/gis');
  const outputDir = path.resolve(options.outputDir ?? 'know/produce');
  fs.mkdirSync(outputDir, { recursive: true });

  const sourceMap = [
    ['grey-transit-bus-stops', 'transitStops'],
    ['grey-transit-routes', 'transitRoutes'],
    ['official-road-cycling-routes', 'cyclingRoutes'],
    ['county-trails', 'trails'],
    ['cp-rail-trail', 'trails'],
    ['hiking-trails', 'trails'],
    ['tom-thomson-trail', 'trails'],
    ['managed-forest-boundary', 'forestAreas'],
    ['hazardous-forest-types-wildfire', 'riskAreas'],
    ['on-farm-rural-business-listing', 'ruralBusinesses'],
    ['population-estimates-2011-2041', 'populationEstimates'],
    ['public-facilities', 'facilities'],
    ['community-facilities', 'facilities'],
    ['libraries', 'facilities'],
    ['arenas-community-centres', 'facilities'],
    ['works-yards-depots', 'facilities'],
    ['emergency-services', 'facilities'],
    ['bridges-culverts-structures', 'roadStructures'],
    ['road-projects-construction-resurfacing', 'roadProjects'],
    ['road-condition', 'roadProjects'],
    ['lots-and-concessions-grey', 'lotFabric'],
    ['lot-fabric-improved-lio', 'lotFabric']
  ];

  const counts = {};
  let downloadedSourceCount = 0;
  let trailsLengthKm = 0;
  let cyclingLengthKm = 0;
  const rows = [];

  for (const [sourceId, mappedType] of sourceMap) {
    const features = readGeoJson(path.join(inputDir, `${sourceId}.geojson`));
    if (features.length > 0) downloadedSourceCount += 1;
    counts[sourceId] = features.length;
    for (const feature of features) {
      if (mappedType === 'trails') trailsLengthKm += lineLengthApproxKm(feature.geometry);
      if (mappedType === 'cyclingRoutes') cyclingLengthKm += lineLengthApproxKm(feature.geometry);
    }
    rows.push({ sourceId, mappedType, featureCount: features.length });
  }

  const summary = {
    downloadedSourceCount,
    featureCountsBySource: counts,
    transitStopCount: counts['grey-transit-bus-stops'] ?? 0,
    trailFeatureCount: (counts['county-trails'] ?? 0) + (counts['cp-rail-trail'] ?? 0) + (counts['hiking-trails'] ?? 0) + (counts['tom-thomson-trail'] ?? 0),
    trailLengthKmApprox: trailsLengthKm,
    cyclingRouteFeatureCount: counts['official-road-cycling-routes'] ?? 0,
    cyclingRouteLengthKmApprox: cyclingLengthKm,
    managedForestFeatureCount: counts['managed-forest-boundary'] ?? 0,
    hazardousForestFeatureCount: counts['hazardous-forest-types-wildfire'] ?? 0,
    ruralBusinessCount: counts['on-farm-rural-business-listing'] ?? 0,
    facilityCount: (counts['public-facilities'] ?? 0) + (counts['community-facilities'] ?? 0) + (counts['libraries'] ?? 0) + (counts['arenas-community-centres'] ?? 0) + (counts['works-yards-depots'] ?? 0) + (counts['emergency-services'] ?? 0),
    structuresProjectsCount: (counts['bridges-culverts-structures'] ?? 0) + (counts['road-projects-construction-resurfacing'] ?? 0) + (counts['road-condition'] ?? 0),
    lotsAndConcessionsFeatureCount: counts['lots-and-concessions-grey'] ?? 0,
    populationEstimateRecords: counts['population-estimates-2011-2041'] ?? 0,
    municipalityAssignmentCompleteness: 'pending-import-level-check',
    warnings: ['Length estimates use simple geometry approximation when source length fields are unavailable.']
  };
  const normalized = summarizeGreySecondaryCollections({
    seedMeta: { summary },
    transitStops: readGeoJson(path.join(inputDir, 'grey-transit-bus-stops.geojson')),
    transitRoutes: readGeoJson(path.join(inputDir, 'grey-transit-routes.geojson')),
    cyclingRoutes: readGeoJson(path.join(inputDir, 'official-road-cycling-routes.geojson')),
    trails: [
      ...readGeoJson(path.join(inputDir, 'county-trails.geojson')),
      ...readGeoJson(path.join(inputDir, 'cp-rail-trail.geojson')),
      ...readGeoJson(path.join(inputDir, 'hiking-trails.geojson')),
      ...readGeoJson(path.join(inputDir, 'tom-thomson-trail.geojson'))
    ],
    forestAreas: readGeoJson(path.join(inputDir, 'managed-forest-boundary.geojson')),
    riskAreas: readGeoJson(path.join(inputDir, 'hazardous-forest-types-wildfire.geojson')),
    ruralBusinesses: readGeoJson(path.join(inputDir, 'on-farm-rural-business-listing.geojson')),
    facilities: [
      ...readGeoJson(path.join(inputDir, 'public-facilities.geojson')),
      ...readGeoJson(path.join(inputDir, 'community-facilities.geojson')),
      ...readGeoJson(path.join(inputDir, 'libraries.geojson')),
      ...readGeoJson(path.join(inputDir, 'arenas-community-centres.geojson')),
      ...readGeoJson(path.join(inputDir, 'works-yards-depots.geojson')),
      ...readGeoJson(path.join(inputDir, 'emergency-services.geojson'))
    ],
    roadStructures: readGeoJson(path.join(inputDir, 'bridges-culverts-structures.geojson')),
    roadProjects: [
      ...readGeoJson(path.join(inputDir, 'road-projects-construction-resurfacing.geojson')),
      ...readGeoJson(path.join(inputDir, 'road-condition.geojson'))
    ],
    populationEstimates: readGeoJson(path.join(inputDir, 'population-estimates-2011-2041.geojson'))
  });
  Object.assign(summary, normalized, { populationEstimateRecords: normalized.populationEstimateRecordCount });

  const jsonPath = path.join(outputDir, 'grey-secondary-data-summary.json');
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));

  const csvPath = path.join(outputDir, 'grey-secondary-data-summary.csv');
  const csv = ['sourceId,mappedType,featureCount', ...rows.map((r) => `${r.sourceId},${r.mappedType},${r.featureCount}`)].join('\n');
  fs.writeFileSync(csvPath, csv);

  return { summary, paths: { jsonPath, csvPath } };
}
