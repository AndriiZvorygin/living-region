// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';

function n(v, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function esc(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function toCsv(rows, headers) {
  return [headers.join(','), ...rows.map((row) => headers.map((h) => esc(row[h])).join(','))].join('\n');
}

function readJsonIfExists(filePath, warnings, label, fallback = null) {
  if (!fs.existsSync(filePath)) {
    warnings.push(`Missing ${label}: ${filePath}`);
    return fallback;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    warnings.push(`Failed to parse ${label}: ${filePath} (${error.message})`);
    return fallback;
  }
}

function readGeoFeaturesIfExists(filePath, warnings, label) {
  const parsed = readJsonIfExists(filePath, warnings, label, { features: [] });
  return Array.isArray(parsed?.features) ? parsed.features : [];
}

export function buildGreyPopulationDistributionReport(options = {}) {
  const produceDir = path.resolve(options.produceDir ?? 'know/produce');
  const inputGisDir = path.resolve(options.inputGisDir ?? 'know/input/gis');
  fs.mkdirSync(produceDir, { recursive: true });
  const warnings = [];

  const censusDistributionPath = path.join(produceDir, 'grey-census-population-distribution.json');
  const censusBlocksPath = path.join(produceDir, 'grey-census-population-blocks.geojson');
  const labourLandPath = path.join(produceDir, 'grey-labour-land-baseline.json');

  const censusDistribution = readJsonIfExists(censusDistributionPath, warnings, 'census population distribution', {});
  const censusBlocks = readGeoFeaturesIfExists(censusBlocksPath, warnings, 'census population blocks');
  const labourLand = readJsonIfExists(labourLandPath, warnings, 'labour-land baseline', {});
  const transitFeatures = readGeoFeaturesIfExists(path.join(inputGisDir, 'grey-transit-bus-stops.geojson'), warnings, 'transit stops');
  const trailFeatures = readGeoFeaturesIfExists(path.join(inputGisDir, 'official-road-cycling-routes.geojson'), warnings, 'cycling routes');
  const ruralBusinessFeatures = readGeoFeaturesIfExists(path.join(inputGisDir, 'on-farm-rural-business-listing.geojson'), warnings, 'rural businesses');
  const facilities = readGeoFeaturesIfExists(path.join(inputGisDir, 'public-facilities.geojson'), warnings, 'public facilities');

  const totals = {
    populationInsideSettlementBoundaries: 0,
    populationOutsideSettlementBoundaries: 0,
    populationNearAgriculturalRuralLand: 0,
    populationNearTransit: 0,
    populationNearTrailsCycling: 0,
    populationNearRuralBusinesses: 0,
    populationNearPublicFacilities: 0,
    noDirectLandAccessPopulationEstimate: 0,
    productiveLandAccessPopulationEstimate: 0
  };

  const municipal = new Map();
  for (const feature of censusBlocks) {
    const props = feature.properties ?? {};
    const pop = n(props.population);
    const muni = String(props.municipalityName ?? 'unassigned');
    const row = municipal.get(muni) ?? {
      municipalityName: muni,
      population: 0,
      insideSettlementPopulation: 0,
      outsideSettlementPopulation: 0,
      nearTransitPopulation: 0,
      nearTrailOrCyclingPopulation: 0,
      nearRuralBusinessPopulation: 0,
      nearPublicFacilityPopulation: 0,
      nearAgriculturalRuralLandPopulation: 0
    };
    row.population += pop;
    if (props.insideSettlementBoundary) {
      row.insideSettlementPopulation += pop;
      totals.populationInsideSettlementBoundaries += pop;
      totals.noDirectLandAccessPopulationEstimate += pop;
    } else {
      row.outsideSettlementPopulation += pop;
      totals.populationOutsideSettlementBoundaries += pop;
      totals.productiveLandAccessPopulationEstimate += pop;
    }
    if (props.nearTransitStop) {
      row.nearTransitPopulation += pop;
      totals.populationNearTransit += pop;
    }
    if (props.nearTrailOrCycling) {
      row.nearTrailOrCyclingPopulation += pop;
      totals.populationNearTrailsCycling += pop;
    }
    if (props.nearRuralBusiness) {
      row.nearRuralBusinessPopulation += pop;
      totals.populationNearRuralBusinesses += pop;
    }
    if (props.nearPublicFacility) {
      row.nearPublicFacilityPopulation += pop;
      totals.populationNearPublicFacilities += pop;
    }
    if (props.landUseCategory === 'agricultural' || props.landUseCategory === 'rural') {
      row.nearAgriculturalRuralLandPopulation += pop;
      totals.populationNearAgriculturalRuralLand += pop;
    }
    municipal.set(muni, row);
  }

  const totalPopulationMatched = n(censusDistribution.totalPopulationMatched);
  const heuristicNoDirect = n(labourLand?.regionalIndicators?.estimatedNoDirectLandAccessPopulation);
  const heuristicRuralAccess = n(labourLand?.regionalIndicators?.estimatedRuralProductiveLandAccessPopulation);
  const ruralPopulationEstimate = totals.populationOutsideSettlementBoundaries;
  const urbanTownVillagePopulationEstimate = totals.populationInsideSettlementBoundaries;

  const comparison = {
    heuristicNoDirectLandAccessPopulation: heuristicNoDirect,
    heuristicRuralProductiveLandAccessPopulation: heuristicRuralAccess,
    censusNoDirectLandAccessPopulationEstimate: totals.noDirectLandAccessPopulationEstimate,
    censusProductiveLandAccessPopulationEstimate: totals.productiveLandAccessPopulationEstimate,
    noDirectDifference: totals.noDirectLandAccessPopulationEstimate - heuristicNoDirect,
    productiveAccessDifference: totals.productiveLandAccessPopulationEstimate - heuristicRuralAccess
  };

  const report = {
    generatedAt: new Date().toISOString(),
    populationDistributionSource: totalPopulationMatched > 0 ? 'censusSmallArea' : 'municipalHeuristic',
    disseminationBlockCount: n(censusDistribution.disseminationBlockCount),
    disseminationAreaCount: n(censusDistribution.disseminationAreaCount),
    totalPopulationMatched,
    totalDwellingsMatched: n(censusDistribution.totalDwellingsMatched),
    matchDifferenceVsKnownGreyPopulation: n(censusDistribution.matchDifferenceVsKnownGreyPopulation),
    ruralPopulationEstimate,
    urbanTownVillagePopulationEstimate,
    ...totals,
    comparisonToPreviousHeuristic: comparison,
    contextCounts: {
      transitStops: transitFeatures.length,
      trailOrCyclingFeatures: trailFeatures.length,
      ruralBusinessFeatures: ruralBusinessFeatures.length,
      publicFacilityFeatures: facilities.length
    },
    warnings
  };

  if (report.totalPopulationMatched <= 0) {
    warnings.push('No matched Census small-area population found. Run: npm run census:import-grey-population after placing Census boundary/attribute files in know/input/census/2021.');
  }

  const municipalRows = Array.from(municipal.values()).sort((a, b) => b.population - a.population);
  const contextRows = censusBlocks.map((feature) => ({
    geographyId: feature.properties?.geographyId ?? '',
    municipalityName: feature.properties?.municipalityName ?? '',
    population: n(feature.properties?.population),
    insideSettlementBoundary: feature.properties?.insideSettlementBoundary ? 'true' : 'false',
    settlementName: feature.properties?.settlementName ?? '',
    landUseCategory: feature.properties?.landUseCategory ?? '',
    nearRoad: feature.properties?.nearRoad ? 'true' : 'false',
    nearTransitStop: feature.properties?.nearTransitStop ? 'true' : 'false',
    nearTrailOrCycling: feature.properties?.nearTrailOrCycling ? 'true' : 'false',
    nearRuralBusiness: feature.properties?.nearRuralBusiness ? 'true' : 'false',
    nearPublicFacility: feature.properties?.nearPublicFacility ? 'true' : 'false',
    nearRuralFoodAccessOpportunity: feature.properties?.nearRuralFoodAccessOpportunity ? 'true' : 'false'
  }));

  const markdown = [
    '# Grey County Population Distribution Baseline',
    '',
    '## What this is',
    'This report uses aggregate 2021 Census small-area geography to improve population distribution diagnostics inside Grey County municipalities. It is not individual-level location data.',
    '',
    '## Summary',
    `- Population distribution source: ${report.populationDistributionSource}`,
    `- Total population matched: ${report.totalPopulationMatched}`,
    `- Total dwellings matched: ${report.totalDwellingsMatched}`,
    `- Difference vs known Grey 2021 population: ${report.matchDifferenceVsKnownGreyPopulation}`,
    `- Population inside settlement boundaries: ${report.populationInsideSettlementBoundaries}`,
    `- Population outside settlement boundaries: ${report.populationOutsideSettlementBoundaries}`,
    '',
    '## Context indicators',
    `- Population near transit: ${report.populationNearTransit}`,
    `- Population near trails/cycling: ${report.populationNearTrailsCycling}`,
    `- Population near rural businesses: ${report.populationNearRuralBusinesses}`,
    `- Population near public facilities: ${report.populationNearPublicFacilities}`,
    `- Population near agricultural/rural land: ${report.populationNearAgriculturalRuralLand}`,
    '',
    '## Comparison to prior heuristic split',
    `- Heuristic no-direct-land-access: ${comparison.heuristicNoDirectLandAccessPopulation}`,
    `- Census no-direct-land-access estimate: ${comparison.censusNoDirectLandAccessPopulationEstimate}`,
    `- Heuristic rural productive-access: ${comparison.heuristicRuralProductiveLandAccessPopulation}`,
    `- Census productive-access estimate: ${comparison.censusProductiveLandAccessPopulationEstimate}`,
    '',
    '## Caveat',
    'This is aggregate Census geography (blocks/areas), not household-level ownership, legal access, or exact person locations.',
    '',
    '## Warnings',
    ...(warnings.length > 0 ? warnings.map((w) => `- ${w}`) : ['- none'])
  ].join('\n');

  const paths = {
    markdownPath: path.join(produceDir, 'grey-population-distribution.md'),
    jsonPath: path.join(produceDir, 'grey-population-distribution.json'),
    municipalCsvPath: path.join(produceDir, 'grey-population-distribution-municipal.csv'),
    contextCsvPath: path.join(produceDir, 'grey-population-distribution-context.csv')
  };

  fs.writeFileSync(paths.markdownPath, markdown);
  fs.writeFileSync(paths.jsonPath, JSON.stringify({ ...report, municipalRows }, null, 2));
  fs.writeFileSync(paths.municipalCsvPath, toCsv(municipalRows, [
    'municipalityName',
    'population',
    'insideSettlementPopulation',
    'outsideSettlementPopulation',
    'nearTransitPopulation',
    'nearTrailOrCyclingPopulation',
    'nearRuralBusinessPopulation',
    'nearPublicFacilityPopulation',
    'nearAgriculturalRuralLandPopulation'
  ]));
  fs.writeFileSync(paths.contextCsvPath, toCsv(contextRows, [
    'geographyId',
    'municipalityName',
    'population',
    'insideSettlementBoundary',
    'settlementName',
    'landUseCategory',
    'nearRoad',
    'nearTransitStop',
    'nearTrailOrCycling',
    'nearRuralBusiness',
    'nearPublicFacility',
    'nearRuralFoodAccessOpportunity'
  ]));

  return { report, paths };
}
