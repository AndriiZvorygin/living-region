// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import {
  getGeometryCentroid,
  pointInPolygon,
  pointInMultiPolygon,
  assignFeatureToPolygonByCentroid
} from '../gis/spatial_assignment.mjs';
import { extractLandUseRawValue, mapOfficialPlanLandUseCategory } from '../data/grey_land_use_mapping.mjs';
import { greyCountySeedNodes } from '../data/grey_county_seed_nodes.mjs';

const DEFAULT_THRESHOLDS = {
  gardenThresholdHaPerDwelling: 0.05,
  subsistenceThresholdHaPerDwelling: 0.25,
  strongSubsistenceThresholdHaPerDwelling: 1.0,
  smallholdingThresholdHaPerDwelling: 2.0,
  farmScaleThresholdHaPerDwelling: 4.0
};

const SENSITIVITY_SCENARIOS = {
  permissive: { gardenThresholdHaPerDwelling: 0.04, subsistenceThresholdHaPerDwelling: 0.2, smallholdingThresholdHaPerDwelling: 1.5, farmScaleThresholdHaPerDwelling: 3.0 },
  baseline: { gardenThresholdHaPerDwelling: 0.05, subsistenceThresholdHaPerDwelling: 0.25, smallholdingThresholdHaPerDwelling: 2.0, farmScaleThresholdHaPerDwelling: 4.0 },
  conservative: { gardenThresholdHaPerDwelling: 0.1, subsistenceThresholdHaPerDwelling: 0.5, smallholdingThresholdHaPerDwelling: 3.0, farmScaleThresholdHaPerDwelling: 6.0 }
};

function n(v, fallback = 0) { const x = Number(v); return Number.isFinite(x) ? x : fallback; }
function normName(v) {
  return String(v ?? '')
    .toLowerCase()
    .replace(/^(township|town|city|municipality)\s+of\s+/, '')
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
function esc(v) { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; }
function toCsv(rows, headers) { return [headers.join(','), ...rows.map((row) => headers.map((h) => esc(row[h])).join(','))].join('\n'); }

function readJsonIfExists(filePath, warnings, label, fallback = null) {
  if (!fs.existsSync(filePath)) { warnings.push(`Missing ${label}: ${filePath}`); return fallback; }
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch (error) { warnings.push(`Failed to parse ${label}: ${filePath} (${error.message})`); return fallback; }
}
function readGeoFeaturesIfExists(filePath, warnings, label) {
  const parsed = readJsonIfExists(filePath, warnings, label, { features: [] });
  return Array.isArray(parsed?.features) ? parsed.features : [];
}

function isPointInFeature(point, feature) {
  const geom = feature?.geometry;
  if (!point || !geom) return false;
  if (geom.type === 'Polygon') return pointInPolygon(point, geom);
  if (geom.type === 'MultiPolygon') return pointInMultiPolygon(point, geom);
  return false;
}

function haversineDistanceKm(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return Infinity;
  const [lonA, latA] = a;
  const [lonB, latB] = b;
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(latB - latA);
  const dLon = toRad(lonB - lonA);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function toLocalKm([lon, lat], refLat) {
  const x = lon * 111.32 * Math.cos((refLat * Math.PI) / 180);
  const y = lat * 110.57;
  return [x, y];
}
function ringAreaKm2(ring) {
  if (!Array.isArray(ring) || ring.length < 4) return 0;
  const refLat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const pts = ring.map((p) => toLocalKm(p, refLat));
  let sum = 0;
  for (let i = 0; i < pts.length - 1; i += 1) sum += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
  return Math.abs(sum) / 2;
}

export function polygonAreaHaApprox(geometry) {
  if (!geometry || geometry.type !== 'Polygon' || !Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) return 0;
  const outer = ringAreaKm2(geometry.coordinates[0]);
  const holes = geometry.coordinates.slice(1).reduce((s, r) => s + ringAreaKm2(r), 0);
  return Math.max(0, (outer - holes) * 100);
}
export function multipolygonAreaHaApprox(geometry) {
  if (!geometry || geometry.type !== 'MultiPolygon' || !Array.isArray(geometry.coordinates)) return 0;
  return geometry.coordinates.reduce((s, coords) => s + polygonAreaHaApprox({ type: 'Polygon', coordinates: coords }), 0);
}
function featureAreaHaApprox(feature) {
  const g = feature?.geometry;
  if (!g) return 0;
  if (g.type === 'Polygon') return polygonAreaHaApprox(g);
  if (g.type === 'MultiPolygon') return multipolygonAreaHaApprox(g);
  return 0;
}

function classifySuitability({ landUseCategory, constrainedShareEstimate, insideSettlement }) {
  if (constrainedShareEstimate >= 0.6 || landUseCategory === 'hazard' || landUseCategory === 'wetland') return 'constrained';
  if (landUseCategory === 'agricultural' || landUseCategory === 'rural') return constrainedShareEstimate <= 0.2 ? 'high' : 'moderate';
  if (landUseCategory === 'settlement') return insideSettlement ? 'low' : 'moderate';
  if (landUseCategory === 'unknown') return 'unknown';
  return 'low';
}

export function classifyLandAccessThreshold(productiveHaPerDwelling, thresholds = DEFAULT_THRESHOLDS) {
  if (!Number.isFinite(productiveHaPerDwelling) || productiveHaPerDwelling <= 0) return 'noDirectLandAccess';
  if (productiveHaPerDwelling >= thresholds.farmScaleThresholdHaPerDwelling) return 'farmScalePotential';
  if (productiveHaPerDwelling >= thresholds.smallholdingThresholdHaPerDwelling) return 'smallholdingPotential';
  if (productiveHaPerDwelling >= thresholds.subsistenceThresholdHaPerDwelling) return 'householdSubsistencePotential';
  if (productiveHaPerDwelling >= thresholds.gardenThresholdHaPerDwelling) return 'gardenScaleAccess';
  return 'noDirectLandAccess';
}

function allocatePopulationAcrossLots(dbFeature, lotsForDb, thresholds, landUseFeatures, settlementFeatures, municipalityAreaHaPerLotFallback = 0) {
  const pop = n(dbFeature.properties?.population);
  const dwellings = Math.max(1, n(dbFeature.properties?.dwellings));
  if (lotsForDb.length === 0) {
    return [{
      geographyId: dbFeature.properties?.geographyId ?? '',
      municipalityName: dbFeature.properties?.municipalityName ?? 'unassigned',
      dwellings,
      population: pop,
      thresholdClass: 'noDirectLandAccess',
      productiveHaPerDwelling: 0,
      constrainedShareEstimate: 1,
      productiveSuitabilityClass: 'unknown',
      insideSettlementBoundary: !!dbFeature.properties?.insideSettlementBoundary
    }];
  }

  const areaWeights = lotsForDb.map((lot) => {
    let areaHa = featureAreaHaApprox(lot);
    if (areaHa <= 0 && municipalityAreaHaPerLotFallback > 0) areaHa = municipalityAreaHaPerLotFallback;
    return Math.max(0.0001, areaHa);
  });
  const totalArea = areaWeights.reduce((s, v) => s + v, 0);

  return lotsForDb.map((lot, idx) => {
    const share = totalArea > 0 ? areaWeights[idx] / totalArea : 1 / lotsForDb.length;
    const lotDwellings = Math.max(0.25, dwellings * share);
    const lotPopulation = pop * share;
    const lotCentroid = getGeometryCentroid(lot.geometry);

    const landUseFeature = assignFeatureToPolygonByCentroid(
      { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: lotCentroid } },
      landUseFeatures
    );
    const landUseCategory = landUseFeature
      ? mapOfficialPlanLandUseCategory(extractLandUseRawValue(landUseFeature.properties ?? {}))
      : 'unknown';

    const insideSettlement = settlementFeatures.some((s) => isPointInFeature(lotCentroid, s));
    const constrainedShareEstimate = (landUseCategory === 'hazard' || landUseCategory === 'wetland') ? 0.8 : 0.1;
    const suitability = classifySuitability({ landUseCategory, constrainedShareEstimate, insideSettlement });

    const rawHa = areaWeights[idx];
    const suitabilityFactor = suitability === 'high' ? 1 : suitability === 'moderate' ? 0.65 : suitability === 'low' ? 0.25 : suitability === 'constrained' ? 0.05 : 0.2;
    const productiveHaEstimate = rawHa * (1 - constrainedShareEstimate) * suitabilityFactor;
    const productiveHaPerDwelling = lotDwellings > 0 ? productiveHaEstimate / lotDwellings : 0;
    const thresholdClass = classifyLandAccessThreshold(productiveHaPerDwelling, thresholds);

    return {
      geographyId: dbFeature.properties?.geographyId ?? '',
      municipalityName: dbFeature.properties?.municipalityName ?? 'unassigned',
      dwellings: lotDwellings,
      population: lotPopulation,
      thresholdClass,
      productiveHaPerDwelling,
      constrainedShareEstimate,
      productiveSuitabilityClass: suitability,
      insideSettlementBoundary: insideSettlement
    };
  });
}

function summarizeThresholds(rows) {
  const out = {
    noDirectLandAccess: { dwellings: 0, population: 0 },
    gardenScaleAccess: { dwellings: 0, population: 0 },
    householdSubsistencePotential: { dwellings: 0, population: 0 },
    smallholdingPotential: { dwellings: 0, population: 0 },
    farmScalePotential: { dwellings: 0, population: 0 }
  };
  for (const row of rows) {
    const bucket = out[row.thresholdClass] ?? out.noDirectLandAccess;
    bucket.dwellings += n(row.dwellings);
    bucket.population += n(row.population);
  }
  return out;
}

function initAccessTiers() {
  return {
    noPracticalFoodGrowingLandAccess: { dwellings: 0, population: 0 },
    supplementalGardenAccess: { dwellings: 0, population: 0 },
    meaningfulHouseholdFoodAccess: { dwellings: 0, population: 0 },
    subsistencePotentialAccess: { dwellings: 0, population: 0 },
    productionScaleAccess: { dwellings: 0, population: 0 }
  };
}

function summarizeStrictAccessTiers(rows, thresholds = DEFAULT_THRESHOLDS) {
  const out = initAccessTiers();
  for (const row of rows) {
    const dwellings = n(row.dwellings);
    const population = n(row.population);
    const productive = n(row.productiveHaPerDwelling);
    const insideSettlement = !!row.insideSettlementBoundary;

    let tier = 'noPracticalFoodGrowingLandAccess';
    if (productive <= 0) {
      tier = 'noPracticalFoodGrowingLandAccess';
    } else if (insideSettlement) {
      // Conservative article-facing rule: settlement residents are not treated as
      // subsistence-potential without parcel-level usable-area evidence.
      tier = productive >= thresholds.gardenThresholdHaPerDwelling
        ? 'supplementalGardenAccess'
        : 'noPracticalFoodGrowingLandAccess';
    } else if (productive >= thresholds.smallholdingThresholdHaPerDwelling) {
      tier = 'productionScaleAccess';
    } else if (productive >= thresholds.strongSubsistenceThresholdHaPerDwelling) {
      tier = 'subsistencePotentialAccess';
    } else if (productive >= thresholds.subsistenceThresholdHaPerDwelling) {
      tier = 'meaningfulHouseholdFoodAccess';
    } else if (productive >= thresholds.gardenThresholdHaPerDwelling) {
      tier = 'supplementalGardenAccess';
    }

    out[tier].dwellings += dwellings;
    out[tier].population += population;
  }
  return out;
}

function applyThresholdSensitivity(rows) {
  return Object.entries(SENSITIVITY_SCENARIOS).map(([thresholdScenario, config]) => {
    const recalc = rows.map((r) => ({ ...r, thresholdClass: classifyLandAccessThreshold(r.productiveHaPerDwelling, config) }));
    const sum = summarizeThresholds(recalc);
    return {
      thresholdScenario,
      gardenThresholdHa: config.gardenThresholdHaPerDwelling,
      subsistenceThresholdHa: config.subsistenceThresholdHaPerDwelling,
      smallholdingThresholdHa: config.smallholdingThresholdHaPerDwelling,
      farmScaleThresholdHa: config.farmScaleThresholdHaPerDwelling,
      dwellingsAtOrAboveSubsistence: sum.householdSubsistencePotential.dwellings + sum.smallholdingPotential.dwellings + sum.farmScalePotential.dwellings,
      populationAtOrAboveSubsistence: sum.householdSubsistencePotential.population + sum.smallholdingPotential.population + sum.farmScalePotential.population,
      dwellingsAtOrAboveSmallholding: sum.smallholdingPotential.dwellings + sum.farmScalePotential.dwellings,
      populationAtOrAboveSmallholding: sum.smallholdingPotential.population + sum.farmScalePotential.population,
      noDirectLandAccessPopulation: sum.noDirectLandAccess.population
    };
  });
}

export function buildGreyDwellingLandAccessReport(options = {}) {
  const produceDir = path.resolve(options.produceDir ?? 'know/produce');
  const inputDir = path.resolve(options.inputDir ?? 'know/input/gis');
  const thresholds = { ...DEFAULT_THRESHOLDS, ...(options.thresholds ?? {}) };
  fs.mkdirSync(produceDir, { recursive: true });

  const warnings = [];
  const censusDistribution = readJsonIfExists(path.join(produceDir, 'grey-census-population-distribution.json'), warnings, 'census population distribution', {});
  const censusBlocks = readGeoFeaturesIfExists(path.join(produceDir, 'grey-census-population-blocks.geojson'), warnings, 'census population blocks');
  const lots = readGeoFeaturesIfExists(path.join(inputDir, 'lots-and-concessions-grey.geojson'), warnings, 'lots and concessions');
  const landUseFeatures = readGeoFeaturesIfExists(path.join(inputDir, 'official-plan-schedule-a-land-use.geojson'), warnings, 'land-use');
  const settlementFeatures = readGeoFeaturesIfExists(path.join(inputDir, 'settlement-boundaries.geojson'), warnings, 'settlements');
  const municipalityFeatures = readGeoFeaturesIfExists(path.join(inputDir, 'municipality-boundaries.geojson'), warnings, 'municipalities');
  const landAccess = readJsonIfExists(path.join(produceDir, 'grey-land-access-baseline.json'), warnings, 'land-access baseline', null);

  const missingLots = lots.length === 0;
  if (missingLots) warnings.push('Missing lots-and-concessions-grey.geojson. Run: npm run grey:download-data -- --source=lots-and-concessions-grey');
  if (censusBlocks.length === 0) warnings.push('Missing census blocks. Run: npm run census:import-grey-population');

  if (missingLots) {
    const invalidReport = {
      generatedAt: new Date().toISOString(),
      dataStatus: 'missing_required_lots',
      dwellingLandAccessValid: false,
      confidence: 'invalid_missing_lots',
      populationDistributionSource: n(censusDistribution.totalPopulationMatched) > 0 ? 'censusSmallAreaWithDwellingLandAccessProxy' : 'municipalHeuristic',
      areaMethod: 'unavailable_missing_lots',
      totalPopulation: n(censusDistribution.totalPopulationMatched),
      totalDwellings: n(censusDistribution.totalDwellingsMatched),
      insideSettlementPopulation: n(censusDistribution.populationInsideSettlementBoundaries),
      outsideSettlementPopulation: n(censusDistribution.populationOutsideSettlementBoundaries),
      insideSettlementDwellings: null,
      outsideSettlementDwellings: null,
      estimatedDwellingsWithGardenScaleAccess: null,
      estimatedDwellingsWithSubsistencePotential: null,
      estimatedDwellingsWithSmallholdingPotential: null,
      estimatedDwellingsWithFarmScalePotential: null,
      estimatedPopulationWithGardenScaleAccess: null,
      estimatedPopulationWithSubsistencePotential: null,
      estimatedPopulationWithSmallholdingPotential: null,
      estimatedPopulationWithFarmScalePotential: null,
      estimatedPopulationNoDirectLandAccess: null,
      broadParcelOrYardAccessPopulation: null,
      supplementalGardenAccessPopulation: null,
      meaningfulHouseholdFoodAccessPopulation: null,
      subsistencePotentialAccessPopulation: null,
      noMeaningfulFoodGrowingLandAccessPopulation: null,
      productionScaleAccessPopulation: null,
      broadLegacyEstimate: null,
      strictFoodGrowingAccessEstimate: null,
      landAccessDefinition: {
        primaryArticleDefinition: 'meaningful_food_growing_access',
        availableDefinitions: ['broad_parcel_access', 'meaningful_food_growing_access', 'subsistence_potential_access'],
        selectedForCurrentSummary: 'meaningful_food_growing_access'
      },
      thresholdSensitivity: [],
      municipalitySummary: [],
      landAccessBaselineOpportunityCounts: landAccess?.opportunityCategoryCounts ?? {},
      warnings: [
        ...warnings,
        'Dwelling-land-access report is invalid until lots-and-concessions-grey.geojson is downloaded.',
        'Recovery command: npm run grey:download-data -- --source=lots-and-concessions-grey'
      ]
    };

    const markdownInvalid = [
      '# Grey Dwelling-to-Land-Access Threshold Baseline',
      '',
      '## What this is',
      'This estimates how Census dwellings/population relate to lot/concession land-access proxies.',
      '',
      '## Key warning',
      'Outside settlement is not the same as land access.',
      '',
      '## Report status',
      '- dataStatus: missing_required_lots',
      '- dwellingLandAccessValid: false',
      '- confidence: invalid_missing_lots',
      '',
      'Dwelling-land-access report is invalid until lots-and-concessions-grey.geojson is downloaded.',
      '',
      'Run:',
      '```bash',
      'npm run grey:download-data -- --source=lots-and-concessions-grey',
      '```',
      '',
      '## Caveats',
      '- not ownership parcels',
      '- not legal access',
      '- not address-level population',
      '- not exact dwelling-to-lot matching',
      '- lots/concessions are historical fabric, not assessment parcels',
      '- modern parcel/address/building data would improve this greatly',
      '',
      '## Warnings',
      ...invalidReport.warnings.map((w) => `- ${w}`)
    ].join('\n');

    const municipalCsvHeaders = [
      'municipalityName', 'population', 'dwellings', 'insideSettlementPopulation', 'outsideSettlementPopulation',
      'outsideSettlementDwellings', 'dwellingsGardenScale', 'dwellingsSubsistencePotential',
      'dwellingsSmallholdingPotential', 'dwellingsFarmScalePotential', 'productiveHaPerDwellingMedianEstimate',
      'constrainedLotShare', 'notes'
    ];
    const thresholdCsvHeaders = [
      'thresholdScenario', 'gardenThresholdHa', 'subsistenceThresholdHa', 'smallholdingThresholdHa',
      'farmScaleThresholdHa', 'dwellingsAtOrAboveSubsistence', 'populationAtOrAboveSubsistence',
      'dwellingsAtOrAboveSmallholding', 'populationAtOrAboveSmallholding', 'noDirectLandAccessPopulation'
    ];

    const jsonPath = path.join(produceDir, 'grey-dwelling-land-access.json');
    const mdPath = path.join(produceDir, 'grey-dwelling-land-access.md');
    const municipalCsvPath = path.join(produceDir, 'grey-dwelling-land-access-municipal.csv');
    const thresholdsCsvPath = path.join(produceDir, 'grey-dwelling-land-access-thresholds.csv');

    fs.writeFileSync(jsonPath, JSON.stringify(invalidReport, null, 2));
    fs.writeFileSync(mdPath, markdownInvalid);
    fs.writeFileSync(municipalCsvPath, toCsv([], municipalCsvHeaders));
    fs.writeFileSync(thresholdsCsvPath, toCsv([], thresholdCsvHeaders));
    return {
      report: invalidReport,
      paths: { markdownPath: mdPath, jsonPath, municipalCsvPath, thresholdsCsvPath }
    };
  }

  const lotsByMunicipality = new Map();
  for (const lot of lots) {
    const centroid = getGeometryCentroid(lot.geometry);
    const muni = assignFeatureToPolygonByCentroid({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: centroid } }, municipalityFeatures);
    const municipalityName = muni?.properties?.MUN_NAME ?? muni?.properties?.MUNICIPALITY ?? lot.properties?.MUNICIPALITY ?? 'unassigned';
    const key = normName(municipalityName);
    if (!lotsByMunicipality.has(key)) lotsByMunicipality.set(key, []);
    lotsByMunicipality.get(key).push(lot);
  }

  const municipalFallbackAreaHaPerLot = new Map();
  let fallbackAreaGlobal = 0;
  let fallbackAreaCount = 0;
  for (const node of greyCountySeedNodes) {
    const key = normName(node.municipalityName);
    const lotCount = Math.max(1, (lotsByMunicipality.get(key) ?? []).length);
    const area = (n(node.landAreaKm2) * 100) / lotCount;
    municipalFallbackAreaHaPerLot.set(key, area);
    if (area > 0) {
      fallbackAreaGlobal += area;
      fallbackAreaCount += 1;
    }
  }
  fallbackAreaGlobal = fallbackAreaCount > 0 ? fallbackAreaGlobal / fallbackAreaCount : 1;

  const rows = [];
  for (const block of censusBlocks) {
    const centroid = getGeometryCentroid(block.geometry);
    const insideLots = lots.filter((lot) => isPointInFeature(centroid, lot));
    const candidates = insideLots.length > 0 ? insideLots : (() => {
      const m = normName(block.properties?.municipalityName ?? 'unassigned');
      const muniLots = lotsByMunicipality.get(m) ?? [];
      if (muniLots.length > 0) return muniLots;
      return lots;
    })();
    const selected = candidates.length <= 6
      ? candidates
      : [...candidates]
        .map((lot) => ({ lot, d: haversineDistanceKm(centroid, getGeometryCentroid(lot.geometry)) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 6)
        .map((x) => x.lot);

    const fallbackArea = municipalFallbackAreaHaPerLot.get(normName(block.properties?.municipalityName ?? '')) ?? fallbackAreaGlobal;
    const allocations = allocatePopulationAcrossLots(block, selected, thresholds, landUseFeatures, settlementFeatures, fallbackArea);
    rows.push(...allocations);
  }

  const thresholdSummary = summarizeThresholds(rows);
  const strictTierSummary = summarizeStrictAccessTiers(rows, thresholds);
  const population = n(censusDistribution.totalPopulationMatched);
  const dwellings = n(censusDistribution.totalDwellingsMatched);

  const municipalMap = new Map();
  for (const row of rows) {
    const key = row.municipalityName || 'unassigned';
    const m = municipalMap.get(key) ?? {
      municipalityName: key,
      population: 0,
      dwellings: 0,
      outsideSettlementPopulation: 0,
      outsideSettlementDwellings: 0,
      dwellingsGardenScale: 0,
      dwellingsSubsistencePotential: 0,
      dwellingsSmallholdingPotential: 0,
      dwellingsFarmScalePotential: 0,
      productiveValues: [],
      constrainedLotShareAccum: 0,
      count: 0,
      notes: 'Threshold estimate using Census DB aggregate + lot/concession proxy.'
    };
    m.population += n(row.population);
    m.dwellings += n(row.dwellings);
    if (!row.insideSettlementBoundary) {
      m.outsideSettlementPopulation += n(row.population);
      m.outsideSettlementDwellings += n(row.dwellings);
    }
    if (row.thresholdClass === 'gardenScaleAccess') m.dwellingsGardenScale += n(row.dwellings);
    if (row.thresholdClass === 'householdSubsistencePotential') m.dwellingsSubsistencePotential += n(row.dwellings);
    if (row.thresholdClass === 'smallholdingPotential') m.dwellingsSmallholdingPotential += n(row.dwellings);
    if (row.thresholdClass === 'farmScalePotential') m.dwellingsFarmScalePotential += n(row.dwellings);
    m.productiveValues.push(n(row.productiveHaPerDwelling));
    m.constrainedLotShareAccum += n(row.constrainedShareEstimate);
    m.count += 1;
    municipalMap.set(key, m);
  }

  const municipalityRows = Array.from(municipalMap.values()).map((m) => {
    const sorted = [...m.productiveValues].sort((a, b) => a - b);
    const mid = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    return {
      municipalityName: m.municipalityName,
      population: Number(m.population.toFixed(2)),
      dwellings: Number(m.dwellings.toFixed(2)),
      insideSettlementPopulation: Number((m.population - m.outsideSettlementPopulation).toFixed(2)),
      outsideSettlementPopulation: Number(m.outsideSettlementPopulation.toFixed(2)),
      outsideSettlementDwellings: Number(m.outsideSettlementDwellings.toFixed(2)),
      dwellingsGardenScale: Number(m.dwellingsGardenScale.toFixed(2)),
      dwellingsSubsistencePotential: Number(m.dwellingsSubsistencePotential.toFixed(2)),
      dwellingsSmallholdingPotential: Number(m.dwellingsSmallholdingPotential.toFixed(2)),
      dwellingsFarmScalePotential: Number(m.dwellingsFarmScalePotential.toFixed(2)),
      productiveHaPerDwellingMedianEstimate: Number(mid.toFixed(4)),
      constrainedLotShare: m.count > 0 ? Number((m.constrainedLotShareAccum / m.count).toFixed(4)) : 0,
      notes: m.notes
    };
  }).sort((a, b) => b.population - a.population);

  const thresholdSensitivity = applyThresholdSensitivity(rows);

  const report = {
    generatedAt: new Date().toISOString(),
    dataStatus: 'ok',
    dwellingLandAccessValid: true,
    confidence: 'low_to_moderate',
    populationDistributionSource: population > 0 ? 'censusSmallAreaWithDwellingLandAccessProxy' : 'municipalHeuristic',
    areaMethod: 'polygonAreaHaApproxFromWGS84WithMunicipalFallback',
    totalPopulation: population,
    totalDwellings: dwellings,
    insideSettlementPopulation: n(censusDistribution.populationInsideSettlementBoundaries),
    insideSettlementDwellings: rows.filter((r) => r.insideSettlementBoundary).reduce((s, r) => s + n(r.dwellings), 0),
    outsideSettlementPopulation: n(censusDistribution.populationOutsideSettlementBoundaries),
    outsideSettlementDwellings: rows.filter((r) => !r.insideSettlementBoundary).reduce((s, r) => s + n(r.dwellings), 0),
    estimatedDwellingsWithGardenScaleAccess: thresholdSummary.gardenScaleAccess.dwellings,
    estimatedDwellingsWithSubsistencePotential: thresholdSummary.householdSubsistencePotential.dwellings,
    estimatedDwellingsWithSmallholdingPotential: thresholdSummary.smallholdingPotential.dwellings,
    estimatedDwellingsWithFarmScalePotential: thresholdSummary.farmScalePotential.dwellings,
    estimatedPopulationWithGardenScaleAccess: thresholdSummary.gardenScaleAccess.population,
    estimatedPopulationWithSubsistencePotential: thresholdSummary.householdSubsistencePotential.population,
    estimatedPopulationWithSmallholdingPotential: thresholdSummary.smallholdingPotential.population,
    estimatedPopulationWithFarmScalePotential: thresholdSummary.farmScalePotential.population,
    estimatedPopulationNoDirectLandAccess: thresholdSummary.noDirectLandAccess.population,
    broadParcelOrYardAccessPopulation:
      thresholdSummary.gardenScaleAccess.population +
      thresholdSummary.householdSubsistencePotential.population +
      thresholdSummary.smallholdingPotential.population +
      thresholdSummary.farmScalePotential.population,
    supplementalGardenAccessPopulation: strictTierSummary.supplementalGardenAccess.population,
    meaningfulHouseholdFoodAccessPopulation: strictTierSummary.meaningfulHouseholdFoodAccess.population,
    subsistencePotentialAccessPopulation: strictTierSummary.subsistencePotentialAccess.population,
    productionScaleAccessPopulation: strictTierSummary.productionScaleAccess.population,
    noMeaningfulFoodGrowingLandAccessPopulation:
      strictTierSummary.noPracticalFoodGrowingLandAccess.population +
      strictTierSummary.supplementalGardenAccess.population,
    broadLegacyEstimate: {
      landAccessDefinition: 'broad_parcel_access',
      estimatedPopulationNoDirectLandAccess: thresholdSummary.noDirectLandAccess.population,
      estimatedPopulationWithGardenScaleAccess: thresholdSummary.gardenScaleAccess.population,
      estimatedPopulationWithSubsistencePotential:
        thresholdSummary.householdSubsistencePotential.population +
        thresholdSummary.smallholdingPotential.population +
        thresholdSummary.farmScalePotential.population
    },
    strictFoodGrowingAccessEstimate: {
      landAccessDefinition: 'meaningful_food_growing_access',
      noPracticalFoodGrowingLandAccessPopulation: strictTierSummary.noPracticalFoodGrowingLandAccess.population,
      supplementalGardenAccessPopulation: strictTierSummary.supplementalGardenAccess.population,
      meaningfulHouseholdFoodAccessPopulation: strictTierSummary.meaningfulHouseholdFoodAccess.population,
      subsistencePotentialAccessPopulation: strictTierSummary.subsistencePotentialAccess.population,
      productionScaleAccessPopulation: strictTierSummary.productionScaleAccess.population,
      noMeaningfulFoodGrowingLandAccessPopulation:
        strictTierSummary.noPracticalFoodGrowingLandAccess.population +
        strictTierSummary.supplementalGardenAccess.population
    },
    landAccessDefinition: {
      primaryArticleDefinition: 'meaningful_food_growing_access',
      availableDefinitions: ['broad_parcel_access', 'meaningful_food_growing_access', 'subsistence_potential_access'],
      selectedForCurrentSummary: 'meaningful_food_growing_access',
      settlementRule:
        'Settlement-area dwellings are not counted as subsistence-potential access without parcel-level usable-area evidence.'
    },
    thresholds,
    thresholdSensitivity,
    comparisonToLandAccessBaseline: {
      previousHeuristicNoDirectLandAccessPopulation: n(landAccess?.populationContext?.noDirectLandAccessPopulationEstimate),
      previousHeuristicProductiveLandAccessPopulation: n(landAccess?.populationContext?.productiveLandAccessPopulationEstimate)
    },
    warnings
  };

  const markdown = [
    '# Grey Dwelling-to-Land-Access Threshold Baseline',
    '',
    '## What this is',
    'This report estimates how aggregate Census dwellings/population relate to lot/concession land-access proxies and scenario thresholds.',
    '',
    '## Key warning',
    'Outside settlement is not the same as land access. This report estimates likely land-access thresholds using aggregate Census geography and lot/concession fabric.',
    '',
    '## Regional findings',
    `- total population: ${report.totalPopulation}`,
    `- total dwellings: ${report.totalDwellings}`,
    `- inside settlement population: ${report.insideSettlementPopulation}`,
    `- outside settlement population: ${report.outsideSettlementPopulation}`,
    `- inside settlement dwellings: ${report.insideSettlementDwellings.toFixed(2)}`,
    `- outside settlement dwellings: ${report.outsideSettlementDwellings.toFixed(2)}`,
    `- estimated population no direct land access: ${report.estimatedPopulationNoDirectLandAccess.toFixed(2)}`,
    `- broad parcel/yard access population (legacy broad): ${report.broadParcelOrYardAccessPopulation.toFixed(2)}`,
    `- supplemental garden access population (strict): ${report.supplementalGardenAccessPopulation.toFixed(2)}`,
    `- meaningful household food access population (strict): ${report.meaningfulHouseholdFoodAccessPopulation.toFixed(2)}`,
    `- subsistence-potential access population (strict): ${report.subsistencePotentialAccessPopulation.toFixed(2)}`,
    `- production-scale access population (strict): ${report.productionScaleAccessPopulation.toFixed(2)}`,
    `- no meaningful food-growing access population (strict): ${report.noMeaningfulFoodGrowingLandAccessPopulation.toFixed(2)}`,
    '',
    '## Municipality comparison',
    '| Municipality | Population | Dwellings | Outside settlement population | Subsistence potential dwellings | Smallholding potential dwellings | Farm-scale potential dwellings |',
    '|---|---:|---:|---:|---:|---:|---:|',
    ...municipalityRows.slice(0, 12).map((m) => `| ${m.municipalityName} | ${m.population.toFixed(0)} | ${m.dwellings.toFixed(0)} | ${m.outsideSettlementPopulation.toFixed(0)} | ${m.dwellingsSubsistencePotential.toFixed(1)} | ${m.dwellingsSmallholdingPotential.toFixed(1)} | ${m.dwellingsFarmScalePotential.toFixed(1)} |`),
    '',
    '## Threshold sensitivity',
    '| Scenario | Subsistence threshold (ha/dwelling) | Dwellings at/above subsistence | Population at/above subsistence |',
    '|---|---:|---:|---:|',
    ...thresholdSensitivity.map((s) => `| ${s.thresholdScenario} | ${s.subsistenceThresholdHa} | ${s.dwellingsAtOrAboveSubsistence.toFixed(2)} | ${s.populationAtOrAboveSubsistence.toFixed(2)} |`),
    '',
    '## Caveats',
    '- land access in this report means usable area for meaningful food growing, not merely yard/parcel presence',
    '- not ownership parcels',
    '- not legal access',
    '- not address-level population',
    '- not exact dwelling-to-lot matching',
    '- lots/concessions are historical fabric, not assessment parcels',
    '- modern parcel/address/building data would improve this greatly',
    '',
    '## Data needed to improve',
    '- modern parcel/assessment fabric',
    '- address points',
    '- building footprints',
    '- dwelling unit counts by parcel/building',
    '- property/land-use constraints',
    '- tenancy/ownership information where legally and ethically available',
    '',
    '## Warnings',
    ...(warnings.length ? warnings.map((w) => `- ${w}`) : ['- none'])
  ].join('\n');

  const paths = {
    markdownPath: path.join(produceDir, 'grey-dwelling-land-access.md'),
    jsonPath: path.join(produceDir, 'grey-dwelling-land-access.json'),
    municipalCsvPath: path.join(produceDir, 'grey-dwelling-land-access-municipal.csv'),
    thresholdsCsvPath: path.join(produceDir, 'grey-dwelling-land-access-thresholds.csv')
  };

  fs.writeFileSync(paths.markdownPath, markdown);
  fs.writeFileSync(paths.jsonPath, JSON.stringify({ ...report, municipalityRows }, null, 2));
  fs.writeFileSync(paths.municipalCsvPath, toCsv(municipalityRows, [
    'municipalityName','population','dwellings','insideSettlementPopulation','outsideSettlementPopulation','outsideSettlementDwellings','dwellingsGardenScale','dwellingsSubsistencePotential','dwellingsSmallholdingPotential','dwellingsFarmScalePotential','productiveHaPerDwellingMedianEstimate','constrainedLotShare','notes'
  ]));
  fs.writeFileSync(paths.thresholdsCsvPath, toCsv(thresholdSensitivity, [
    'thresholdScenario','gardenThresholdHa','subsistenceThresholdHa','smallholdingThresholdHa','farmScaleThresholdHa','dwellingsAtOrAboveSubsistence','populationAtOrAboveSubsistence','dwellingsAtOrAboveSmallholding','populationAtOrAboveSmallholding','noDirectLandAccessPopulation'
  ]));

  return { report, paths, municipalityRows, thresholdSensitivity };
}
