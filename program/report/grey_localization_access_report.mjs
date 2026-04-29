// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { greyCountySeedNodes } from '../data/grey_county_seed_nodes.mjs';
import { getGeometryCentroid, assignFeatureToPolygonByCentroid } from '../gis/spatial_assignment.mjs';

const NODE_TYPES = [
  'foodHubDistributionPoint',
  'foodProcessingStorageDepot',
  'grainMill',
  'nutShellingDryingHub',
  'coldStorage',
  'rootCellarDryStorage',
  'freezerDehydrationFermentationKitchen',
  'toolLibraryLightDuty',
  'toolLibraryRepairDepot',
  'coordinationEducationNode',
  'animalPowerDepot',
  'woodEnergyDepot',
  'transitMarketNode',
  'ruralFreightDepot',
  'ruralServiceNode'
];

const ACCESS_KM = {
  road: 0.5,
  transit: 2,
  trail: 1,
  business: 5,
  lot: 2,
  managedForest: 2,
  agriRural: 2,
  facility: 3,
  structure: 1.5,
  roadCondition: 2
};

const POSITIVE_KEYWORDS = [
  'depot', 'works yard', 'works', 'garage', 'industrial', 'business park', 'market', 'agricultural',
  'farm', 'warehouse', 'community centre', 'community center', 'arena', 'fairgrounds', 'repair', 'shop'
];

const NEGATIVE_HEAVY_KEYWORDS = ['gallery', 'museum', 'library', 'courthouse', 'office', 'administration'];

function n(v, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function esc(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function toCsv(rows, headers) {
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
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

function readGeoFeatures(filePath, warnings, label) {
  const parsed = readJsonIfExists(filePath, warnings, label, { features: [] });
  return Array.isArray(parsed?.features) ? parsed.features : [];
}

function normalizeName(v) {
  return String(v ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function pickCaseInsensitive(props, keys) {
  const p = props ?? {};
  const all = Object.keys(p);
  for (const key of keys) {
    const hit = all.find((k) => k.toLowerCase() === key.toLowerCase());
    if (hit && p[hit] !== undefined && p[hit] !== null && String(p[hit]).trim() !== '') return String(p[hit]).trim();
  }
  return null;
}

function normMunicipality(value) {
  return normalizeName(value)
    .replace(/^(township|town|city|municipality)\s+of\s+/, '')
    .replace(/^the\s+/, '')
    .trim();
}

function toRad(d) {
  return (d * Math.PI) / 180;
}

function haversineKm(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length < 2 || b.length < 2) return Infinity;
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const sa = Math.sin(dLat / 2);
  const sb = Math.sin(dLon / 2);
  const c = sa * sa + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sb * sb;
  return 2 * R * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

function withCentroid(feature) {
  return { ...feature, _centroid: getGeometryCentroid(feature?.geometry ?? null) };
}

function countNearby(point, features, km) {
  let c = 0;
  for (const f of features) {
    const p = f._centroid;
    if (!p) continue;
    if (haversineKm(point, p) <= km) c += 1;
  }
  return c;
}

function hasNearby(point, features, km) {
  for (const f of features) {
    const p = f._centroid;
    if (!p) continue;
    if (haversineKm(point, p) <= km) return true;
  }
  return false;
}

function parseCsvRows(csvText) {
  const lines = String(csvText ?? '').trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const row = {};
    for (let i = 0; i < headers.length; i += 1) row[headers[i]] = cols[i] ?? '';
    return row;
  });
}

function roadByMunicipalityFromCsv(produceDir, warnings) {
  const csvPath = path.join(produceDir, 'grey-baseline-municipality-summary.csv');
  if (!fs.existsSync(csvPath)) {
    warnings.push(`Missing municipal baseline CSV: ${csvPath}`);
    return new Map();
  }
  try {
    const rows = parseCsvRows(fs.readFileSync(csvPath, 'utf8'));
    const out = new Map();
    for (const row of rows) {
      out.set(row.municipalityName, {
        roadKm: n(row.roadKm),
        roadKmPer1000Residents: n(row.roadKmPer1000Residents)
      });
    }
    return out;
  } catch (error) {
    warnings.push(`Failed to parse municipal baseline CSV: ${error.message}`);
    return new Map();
  }
}

function classifyFacilityType(name, sourceKind, properties) {
  const joined = normalizeName([name, pickCaseInsensitive(properties, ['TYPE', 'CATEGORY', 'FACILITY', 'USE', 'CLASS'])].filter(Boolean).join(' '));
  if (sourceKind === 'ruralBusiness') return 'ruralBusiness';
  if (joined.includes('depot') || joined.includes('works yard') || joined.includes('warehouse') || joined.includes('garage')) return 'depot';
  if (joined.includes('industrial') || joined.includes('business park')) return 'industrial';
  if (joined.includes('market') || joined.includes('fair')) return 'market';
  if (joined.includes('community centre') || joined.includes('community center') || joined.includes('arena')) return 'communityFacility';
  if (joined.includes('library')) return 'library';
  if (joined.includes('gallery') || joined.includes('museum')) return 'cultural';
  if (joined.includes('office') || joined.includes('admin') || joined.includes('courthouse')) return 'administrative';
  return sourceKind === 'settlement' ? 'settlementNode' : 'publicFacility';
}

function keywordScore(text, words) {
  const s = normalizeName(text);
  let hits = 0;
  for (const w of words) if (s.includes(w)) hits += 1;
  return hits;
}

function roleSuitability(type, ctx) {
  const isCivicWeakHeavy = ctx.facilityType === 'library' || ctx.facilityType === 'cultural' || ctx.facilityType === 'administrative';
  const positiveSignal = ctx.facilityPositiveKeywords > 0 || ctx.facilityType === 'depot' || ctx.facilityType === 'industrial' || ctx.sourceKind === 'ruralBusiness';
  const settlementEdge = ctx.settlementEdge;

  let score = 0.35;
  let caution = '';

  if (['foodHubDistributionPoint', 'transitMarketNode'].includes(type)) {
    score = 0.45 + (ctx.sourceKind === 'ruralBusiness' ? 0.2 : 0) + (ctx.facilityType === 'market' || ctx.facilityType === 'communityFacility' ? 0.2 : 0) + (settlementEdge ? 0.1 : 0);
    if (isCivicWeakHeavy) {
      score -= 0.12;
      caution = 'Civic anchor may be better for coordination than distribution logistics.';
    }
  } else if (['foodProcessingStorageDepot', 'grainMill', 'nutShellingDryingHub', 'coldStorage', 'rootCellarDryStorage', 'freezerDehydrationFermentationKitchen', 'ruralFreightDepot'].includes(type)) {
    score = 0.32 + (positiveSignal ? 0.3 : 0) + (settlementEdge ? 0.15 : 0) + (ctx.nearAgriRural > 0 ? 0.12 : 0);
    if (isCivicWeakHeavy) {
      score -= 0.22;
      caution = 'Civic/cultural building is weak fit for bulk processing/freight role.';
    }
  } else if (['toolLibraryRepairDepot', 'toolLibraryLightDuty'].includes(type)) {
    score = 0.4 + (positiveSignal ? 0.22 : 0) + (ctx.facilityType === 'communityFacility' ? 0.1 : 0);
    if (type === 'toolLibraryLightDuty' && (ctx.facilityType === 'library' || ctx.facilityType === 'cultural')) score += 0.15;
    if (type === 'toolLibraryRepairDepot' && isCivicWeakHeavy) {
      score -= 0.1;
      caution = 'Light-duty lending may fit better than repair-depot use.';
    }
  } else if (type === 'coordinationEducationNode') {
    score = 0.55 + (ctx.facilityType === 'library' || ctx.facilityType === 'cultural' || ctx.facilityType === 'communityFacility' ? 0.2 : 0) + (ctx.nearTransit ? 0.1 : 0);
  } else if (['woodEnergyDepot', 'animalPowerDepot'].includes(type)) {
    score = 0.28 + (ctx.nearManagedForest ? 0.26 : 0) + (ctx.nearLots > 2 ? 0.12 : 0) + (positiveSignal ? 0.1 : 0) + (settlementEdge ? 0.1 : 0);
    if (isCivicWeakHeavy) {
      score -= 0.18;
      caution = 'Dense civic site is weak fit for heavy depot role.';
    }
  } else if (type === 'ruralServiceNode') {
    score = 0.45 + (ctx.sourceKind === 'ruralBusiness' ? 0.15 : 0) + (ctx.nearTransit ? 0.05 : 0);
  }

  score -= Math.min(0.2, ctx.facilityNegativeKeywords * 0.08);
  return { roleFitScore: clamp01(score), caution };
}

function buildScores(type, ctx) {
  const accessScore = clamp01(
    0.35 * (ctx.nearRoad ? 1 : 0) +
    0.2 * (ctx.nearTransit ? 1 : 0) +
    0.15 * (ctx.nearTrail ? 1 : 0) +
    0.15 * Math.min(1, ctx.nearBusinesses / 3) +
    0.15 * Math.min(1, Math.log10(1 + ctx.population) / 5)
  );

  const logisticsScore = clamp01(
    0.32 * (ctx.nearRoad ? 1 : 0) +
    0.22 * (ctx.settlementEdge ? 1 : 0) +
    0.18 * Math.min(1, ctx.nearAgriRural / 3) +
    0.12 * Math.min(1, ctx.nearLots / 8) +
    0.1 * (ctx.facilityPositiveKeywords > 0 ? 1 : 0) +
    0.06 * (ctx.nearStructure ? 1 : 0)
  );

  const landAccessScore = clamp01(
    0.45 * Math.min(1, ctx.nearLots / 12) +
    0.35 * Math.min(1, ctx.nearAgriRural / 6) +
    0.2 * (ctx.nearManagedForest ? 1 : 0)
  );

  const { roleFitScore, caution } = roleSuitability(type, ctx);

  let finalScore = clamp01(
    0.45 * roleFitScore +
    0.25 * accessScore +
    0.2 * logisticsScore +
    0.1 * landAccessScore
  );

  // Role-specific down-weights
  if (['foodProcessingStorageDepot', 'grainMill', 'nutShellingDryingHub', 'coldStorage', 'ruralFreightDepot', 'woodEnergyDepot', 'animalPowerDepot'].includes(type) && ctx.coreUrbanNoLogisticsSignal) {
    finalScore *= 0.72;
  }
  if (type === 'coordinationEducationNode' && ctx.facilityType === 'library') finalScore = clamp01(finalScore + 0.12);
  if (type === 'toolLibraryLightDuty' && (ctx.facilityType === 'library' || ctx.facilityType === 'cultural')) finalScore = clamp01(finalScore + 0.08);

  return { roleFitScore, accessScore, logisticsScore, landAccessScore, finalScore, caution };
}

function confidenceLabel(score) {
  if (score >= 0.75) return 'high';
  if (score >= 0.5) return 'moderate';
  return 'low';
}

function recommendedRole(type) {
  const map = {
    foodHubDistributionPoint: 'Local aggregation and distribution point',
    foodProcessingStorageDepot: 'Processing/storage depot candidate',
    grainMill: 'Grain milling candidate',
    nutShellingDryingHub: 'Nut shelling and drying support',
    coldStorage: 'Cold storage and seasonal buffering',
    rootCellarDryStorage: 'Root cellar and dry-goods storage',
    freezerDehydrationFermentationKitchen: 'Preservation and shared kitchen processing',
    toolLibraryLightDuty: 'Light-duty tool lending and coordination',
    toolLibraryRepairDepot: 'Tool repair and maintenance depot',
    coordinationEducationNode: 'Coordination, training, and education node',
    animalPowerDepot: 'Shared heavy-work and animal-power support',
    woodEnergyDepot: 'Wood-energy staging and distribution',
    transitMarketNode: 'Transit-linked market exchange node',
    ruralFreightDepot: 'Rural freight and transfer depot',
    ruralServiceNode: 'General rural service and coordination node'
  };
  return map[type] ?? 'Localization service node candidate';
}

function mainConstraintForMunicipality(row) {
  const gaps = [];
  if (row.candidateStorageProcessingScore < 0.45) gaps.push('storage-processing access');
  if (row.candidateToolLibraryScore < 0.45) gaps.push('tool-repair support');
  if (row.ruralFoodAccessOpportunityCount > 0 && row.candidateFoodHubScore < 0.45) gaps.push('food hub / depot linkage');
  if (row.candidateWoodEnergyDepotScore < 0.4 && row.managedForestFeatureCount > 0) gaps.push('wood-energy coordination');
  return gaps[0] ?? 'no dominant constraint identified';
}

export function buildGreyLocalizationAccessReport(options = {}) {
  const inputDir = path.resolve(options.inputDir ?? 'know/input/gis');
  const produceDir = path.resolve(options.produceDir ?? 'know/produce');
  fs.mkdirSync(produceDir, { recursive: true });
  const warnings = [];

  const sourceFiles = {
    municipalityBoundaries: path.join(inputDir, 'municipality-boundaries.geojson'),
    settlementBoundaries: path.join(inputDir, 'settlement-boundaries.geojson'),
    officialPlanLandUse: path.join(inputDir, 'official-plan-schedule-a-land-use.geojson'),
    roads: path.join(inputDir, 'road-centrelines-grey.geojson'),
    lotsAndConcessions: path.join(inputDir, 'lots-and-concessions-grey.geojson'),
    transitStops: path.join(inputDir, 'grey-transit-bus-stops.geojson'),
    cyclingRoutes: path.join(inputDir, 'official-road-cycling-routes.geojson'),
    countyTrails: path.join(inputDir, 'county-trails.geojson'),
    cpRailTrail: path.join(inputDir, 'cp-rail-trail.geojson'),
    hikingTrails: path.join(inputDir, 'hiking-trails.geojson'),
    ruralBusinesses: path.join(inputDir, 'on-farm-rural-business-listing.geojson'),
    publicFacilities: path.join(inputDir, 'public-facilities.geojson'),
    managedForest: path.join(inputDir, 'managed-forest-boundary.geojson'),
    structures: path.join(inputDir, 'bridges-culverts-structures.geojson'),
    roadCondition: path.join(inputDir, 'road-condition.geojson'),
    publicBaseline: path.join(produceDir, 'grey-public-baseline.json'),
    landAccessBaseline: path.join(produceDir, 'grey-land-access-baseline.json'),
    labourLandBaseline: path.join(produceDir, 'grey-labour-land-baseline.json'),
    foodCalibration: path.join(produceDir, 'grey-food-calibration.json'),
    openDataWorld: path.join(produceDir, 'grey-open-data-world.json')
  };

  const municipalityFeatures = readGeoFeatures(sourceFiles.municipalityBoundaries, warnings, 'municipality boundaries').map(withCentroid);
  const settlementFeatures = readGeoFeatures(sourceFiles.settlementBoundaries, warnings, 'settlement boundaries').map(withCentroid);
  const landUseFeatures = readGeoFeatures(sourceFiles.officialPlanLandUse, warnings, 'official plan land use').map(withCentroid);
  const roadFeatures = readGeoFeatures(sourceFiles.roads, warnings, 'roads').map(withCentroid);
  const lots = readGeoFeatures(sourceFiles.lotsAndConcessions, warnings, 'lots and concessions').map(withCentroid);
  const transitStops = readGeoFeatures(sourceFiles.transitStops, warnings, 'transit stops').map(withCentroid);
  const cyclingRoutes = readGeoFeatures(sourceFiles.cyclingRoutes, warnings, 'cycling routes').map(withCentroid);
  const countyTrails = readGeoFeatures(sourceFiles.countyTrails, warnings, 'county trails').map(withCentroid);
  const cpRailTrail = readGeoFeatures(sourceFiles.cpRailTrail, warnings, 'cp rail trail').map(withCentroid);
  const hikingTrails = readGeoFeatures(sourceFiles.hikingTrails, warnings, 'hiking trails').map(withCentroid);
  const ruralBusinesses = readGeoFeatures(sourceFiles.ruralBusinesses, warnings, 'rural businesses').map(withCentroid);
  const publicFacilities = readGeoFeatures(sourceFiles.publicFacilities, warnings, 'public facilities').map(withCentroid);
  const managedForest = readGeoFeatures(sourceFiles.managedForest, warnings, 'managed forest').map(withCentroid);
  const structures = readGeoFeatures(sourceFiles.structures, warnings, 'structures').map(withCentroid);
  const roadCondition = readGeoFeatures(sourceFiles.roadCondition, warnings, 'road condition').map(withCentroid);

  readJsonIfExists(sourceFiles.publicBaseline, warnings, 'public baseline', {});
  const landAccess = readJsonIfExists(sourceFiles.landAccessBaseline, warnings, 'land-access baseline', {});
  const labourLand = readJsonIfExists(sourceFiles.labourLandBaseline, warnings, 'labour-land baseline', {});
  const foodCalibration = readJsonIfExists(sourceFiles.foodCalibration, warnings, 'food calibration', {});
  readJsonIfExists(sourceFiles.openDataWorld, warnings, 'open-data world', {});

  const roadByMunicipality = roadByMunicipalityFromCsv(produceDir, warnings);
  const trails = [...cyclingRoutes, ...countyTrails, ...cpRailTrail, ...hikingTrails];
  const agriRuralLand = landUseFeatures.filter((f) => {
    const raw = pickCaseInsensitive(f.properties, ['LANDUSE', 'LAND_USE', 'DESIGNATION', 'OP_DES', 'SCHED_A', 'CATEGORY', 'TYPE', 'NAME']);
    const s = normalizeName(raw);
    return s.includes('agric') || s.includes('rural') || s.includes('industrial') || s.includes('business park');
  });

  const muniSeedByNorm = new Map(greyCountySeedNodes.map((m) => [normMunicipality(m.municipalityName), m]));
  const muniPolygons = municipalityFeatures
    .map((f) => {
      const raw = pickCaseInsensitive(f.properties, ['MUNICIPAL', 'MUN_NAME', 'MUNICIPALITY', 'MUNICIPAL_N', 'NAME']);
      const seed = raw ? muniSeedByNorm.get(normMunicipality(raw)) : null;
      return {
        ...f,
        municipalityName: seed?.municipalityName ?? raw ?? null,
        municipalityId: seed?.municipalityId ?? null,
        population2021: n(seed?.population2021)
      };
    })
    .filter((f) => Boolean(f.municipalityName));

  const municipal = new Map(greyCountySeedNodes.map((m) => [m.municipalityName, {
    municipalityName: m.municipalityName,
    population2021: n(m.population2021),
    settlementFeatureCount: 0,
    transitStopCount: 0,
    trailFeatureCount: 0,
    cyclingRouteFeatureCount: 0,
    ruralBusinessCount: 0,
    publicFacilityCount: 0,
    lotsConcessionsCount: 0,
    ruralFoodAccessOpportunityCount: 0,
    cooperativeLandAccessCandidateCount: 0,
    managedForestFeatureCount: 0,
    roadKm: n(roadByMunicipality.get(m.municipalityName)?.roadKm),
    roadKmPer1000Residents: n(roadByMunicipality.get(m.municipalityName)?.roadKmPer1000Residents),
    candidateFoodHubScore: 0,
    candidateToolLibraryScore: 0,
    candidateStorageProcessingScore: 0,
    candidateWoodEnergyDepotScore: 0,
    localizationReadinessScore: 0,
    mainConstraint: ''
  }]));

  function assignMunicipality(feature) {
    const raw = pickCaseInsensitive(feature?.properties, ['MUNICIPAL', 'MUN_NAME', 'MUNICIPALITY', 'MUNICIPAL_N', 'NAME_MUNI']);
    if (raw) {
      const seed = muniSeedByNorm.get(normMunicipality(raw));
      if (seed) return seed.municipalityName;
    }
    const hit = assignFeatureToPolygonByCentroid(feature, muniPolygons, { methodName: 'geometryCentroid' });
    return hit?.matched?.municipalityName ?? null;
  }

  for (const f of lots) {
    const m = assignMunicipality(f);
    const row = m ? municipal.get(m) : null;
    if (row) row.lotsConcessionsCount += 1;
  }
  for (const f of settlementFeatures) {
    const m = assignMunicipality(f);
    const row = m ? municipal.get(m) : null;
    if (row) row.settlementFeatureCount += 1;
  }
  for (const f of transitStops) {
    const m = assignMunicipality(f);
    const row = m ? municipal.get(m) : null;
    if (row) row.transitStopCount += 1;
  }
  for (const f of trails) {
    const m = assignMunicipality(f);
    const row = m ? municipal.get(m) : null;
    if (row) row.trailFeatureCount += 1;
  }
  for (const f of cyclingRoutes) {
    const m = assignMunicipality(f);
    const row = m ? municipal.get(m) : null;
    if (row) row.cyclingRouteFeatureCount += 1;
  }
  for (const f of ruralBusinesses) {
    const m = assignMunicipality(f);
    const row = m ? municipal.get(m) : null;
    if (row) row.ruralBusinessCount += 1;
  }
  for (const f of publicFacilities) {
    const m = assignMunicipality(f);
    const row = m ? municipal.get(m) : null;
    if (row) row.publicFacilityCount += 1;
  }
  for (const f of managedForest) {
    const m = assignMunicipality(f);
    const row = m ? municipal.get(m) : null;
    if (row) row.managedForestFeatureCount += 1;
  }

  const regionalRuralFoodAccess = n(landAccess?.opportunityCategoryCounts?.ruralFoodAccessOpportunity);
  const regionalCoopAccess = n(landAccess?.opportunityCategoryCounts?.cooperativeLandAccessCandidate);
  const totalLots = Math.max(1, [...municipal.values()].reduce((s, r) => s + r.lotsConcessionsCount, 0));
  for (const row of municipal.values()) {
    const share = row.lotsConcessionsCount / totalLots;
    row.ruralFoodAccessOpportunityCount = Math.round(regionalRuralFoodAccess * share);
    row.cooperativeLandAccessCandidateCount = Math.round(regionalCoopAccess * share);
  }

  const basePlaces = [];
  let idCounter = 1;

  for (const s of settlementFeatures) {
    if (!s._centroid) continue;
    basePlaces.push({
      placeId: `settlement-${idCounter++}`,
      sourceKind: 'settlement',
      municipalityName: assignMunicipality(s),
      name: pickCaseInsensitive(s.properties, ['SETTL_NAME', 'SETTLEMENT', 'NAME', 'COMMUNITY']) ?? `Settlement ${idCounter}`,
      point: s._centroid,
      properties: s.properties ?? {}
    });
  }
  for (const f of publicFacilities) {
    if (!f._centroid) continue;
    basePlaces.push({
      placeId: `facility-${idCounter++}`,
      sourceKind: 'facility',
      municipalityName: assignMunicipality(f),
      name: pickCaseInsensitive(f.properties, ['NAME', 'FACILITY', 'SITE_NAME']) ?? `Facility ${idCounter}`,
      point: f._centroid,
      properties: f.properties ?? {}
    });
  }
  for (const f of ruralBusinesses) {
    if (!f._centroid) continue;
    basePlaces.push({
      placeId: `business-${idCounter++}`,
      sourceKind: 'ruralBusiness',
      municipalityName: assignMunicipality(f),
      name: pickCaseInsensitive(f.properties, ['NAME', 'BUSINESS', 'ORG_NAME']) ?? `Business ${idCounter}`,
      point: f._centroid,
      properties: f.properties ?? {}
    });
  }

  const candidateNodes = [];
  let candidateId = 1;

  for (const place of basePlaces) {
    const municipalityRow = municipal.get(place.municipalityName) ?? null;
    const population = n(municipalityRow?.population2021);

    const nearRoad = hasNearby(place.point, roadFeatures, ACCESS_KM.road);
    const nearTransit = hasNearby(place.point, transitStops, ACCESS_KM.transit);
    const nearTrail = hasNearby(place.point, trails, ACCESS_KM.trail);
    const nearBusinesses = countNearby(place.point, ruralBusinesses, ACCESS_KM.business);
    const nearLots = countNearby(place.point, lots, ACCESS_KM.lot);
    const nearAgriRural = countNearby(place.point, agriRuralLand, ACCESS_KM.agriRural);
    const nearManagedForest = hasNearby(place.point, managedForest, ACCESS_KM.managedForest);
    const nearStructure = hasNearby(place.point, structures, ACCESS_KM.structure);
    const nearRoadCondition = hasNearby(place.point, roadCondition, ACCESS_KM.roadCondition);

    const facilityType = classifyFacilityType(place.name, place.sourceKind, place.properties);
    const joinedProps = `${place.name} ${JSON.stringify(place.properties ?? {})}`;
    const facilityPositiveKeywords = keywordScore(joinedProps, POSITIVE_KEYWORDS);
    const facilityNegativeKeywords = keywordScore(joinedProps, NEGATIVE_HEAVY_KEYWORDS);

    const settlementEdge = nearAgriRural > 0 || nearLots > 4;
    const coreUrbanNoLogisticsSignal = !settlementEdge && facilityPositiveKeywords === 0 && (facilityType === 'library' || facilityType === 'cultural' || facilityType === 'administrative');

    const base = {
      nearRoad,
      nearTransit,
      nearTrail,
      nearBusinesses,
      nearLots,
      nearAgriRural,
      nearManagedForest,
      nearStructure,
      nearRoadCondition,
      population,
      sourceKind: place.sourceKind,
      facilityType,
      facilityPositiveKeywords,
      facilityNegativeKeywords,
      settlementEdge,
      coreUrbanNoLogisticsSignal
    };

    for (const type of NODE_TYPES) {
      const scored = buildScores(type, base);
      const confidence = confidenceLabel(scored.finalScore);
      const row = {
        candidateId: `node-${candidateId++}`,
        municipalityName: place.municipalityName ?? 'Unassigned',
        settlementOrFacilityName: place.name,
        candidateType: type,
        candidateRoleSuitability: confidenceLabel(scored.roleFitScore),
        candidateFacilityType: facilityType,
        roleFitScore: scored.roleFitScore,
        accessScore: scored.accessScore,
        logisticsScore: scored.logisticsScore,
        landAccessScore: scored.landAccessScore,
        finalScore: scored.finalScore,
        score: scored.finalScore,
        confidence,
        nearbyRoadAccess: nearRoad,
        nearbyTransit: nearTransit,
        nearbyTrailOrCycling: nearTrail,
        nearbyRuralBusinesses: nearBusinesses,
        nearbyFoodAccessLots: nearLots,
        nearbyManagedForest: nearManagedForest,
        recommendedRole: recommendedRole(type),
        caution: scored.caution || '',
        notes: place.sourceKind === 'settlement'
          ? 'Candidate derived from settlement node.'
          : 'Candidate derived from existing facility/business location.'
      };
      candidateNodes.push(row);
    }
  }

  function topCandidates(type, count = 5) {
    return candidateNodes
      .filter((c) => c.candidateType === type)
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, count)
      .map((c) => ({
        candidateId: c.candidateId,
        municipalityName: c.municipalityName,
        name: c.settlementOrFacilityName,
        score: c.finalScore,
        confidence: c.confidence,
        facilityType: c.candidateFacilityType
      }));
  }

  for (const row of municipal.values()) {
    const nodeRows = candidateNodes.filter((c) => c.municipalityName === row.municipalityName);
    const maxType = (types) => {
      let max = 0;
      for (const r of nodeRows) {
        if (types.includes(r.candidateType)) max = Math.max(max, r.finalScore);
      }
      return max;
    };
    row.candidateFoodHubScore = maxType(['foodHubDistributionPoint', 'transitMarketNode']);
    row.candidateToolLibraryScore = maxType(['toolLibraryLightDuty', 'toolLibraryRepairDepot', 'coordinationEducationNode']);
    row.candidateStorageProcessingScore = maxType(['foodProcessingStorageDepot', 'grainMill', 'nutShellingDryingHub', 'coldStorage', 'rootCellarDryStorage', 'freezerDehydrationFermentationKitchen']);
    row.candidateWoodEnergyDepotScore = maxType(['woodEnergyDepot', 'animalPowerDepot', 'ruralFreightDepot']);

    const transitFactor = clamp01(row.transitStopCount / 5);
    const serviceFactor = clamp01((row.publicFacilityCount + row.ruralBusinessCount) / 12);
    const accessFactor = clamp01((row.candidateFoodHubScore + row.candidateToolLibraryScore + row.candidateStorageProcessingScore + row.candidateWoodEnergyDepotScore) / 4);
    row.localizationReadinessScore = clamp01(0.35 * accessFactor + 0.25 * transitFactor + 0.2 * serviceFactor + 0.2 * clamp01(row.roadKmPer1000Residents / 60));
    row.mainConstraint = mainConstraintForMunicipality(row);
  }

  const municipalRows = [...municipal.values()]
    .sort((a, b) => b.localizationReadinessScore - a.localizationReadinessScore)
    .map((r) => ({ ...r, localizationReadinessScore: clamp01(r.localizationReadinessScore) }));

  const localizationInfrastructureGaps = [
    'Local storage/processing nodes are uneven and not yet organized county-wide.',
    'Tool-library and repair capacity is likely thin in lower-scoring municipalities.',
    'Food-hub/depot linkage to rural food-access areas is incomplete.',
    'Candidate nodes are spatial/access diagnostics; ownership and feasibility are not established.'
  ];

  const regionalSummary = {
    highestReadinessMunicipalities: municipalRows.slice(0, 3).map((m) => ({ municipalityName: m.municipalityName, localizationReadinessScore: m.localizationReadinessScore })),
    lowestReadinessMunicipalities: municipalRows.slice(-3).map((m) => ({ municipalityName: m.municipalityName, localizationReadinessScore: m.localizationReadinessScore })),
    topFoodHubCandidates: topCandidates('foodHubDistributionPoint'),
    topStorageProcessingCandidates: [
      ...topCandidates('foodProcessingStorageDepot', 3),
      ...topCandidates('coldStorage', 2)
    ].sort((a, b) => b.score - a.score).slice(0, 5),
    topToolLibraryCandidates: topCandidates('toolLibraryRepairDepot'),
    topWoodEnergyDepotCandidates: topCandidates('woodEnergyDepot'),
    topCoordinationEducationCandidates: topCandidates('coordinationEducationNode'),
    localizationInfrastructureGaps
  };

  const report = {
    generatedAt: new Date().toISOString(),
    warnings,
    sourceFiles,
    regionalSummary,
    municipalLocalizationMetrics: municipalRows,
    candidateNodes,
    infrastructureGaps: localizationInfrastructureGaps,
    foodCalibrationContext: {
      localizedPresentTechBaselineCoverage: n(foodCalibration?.plausibilityScenarios?.find?.((x) => x.scenario === 'localizedPresentTechBaseline')?.foodCoverage),
      constrainedLocalFoodBaselineCoverage: n(foodCalibration?.plausibilityScenarios?.find?.((x) => x.scenario === 'constrainedLocalFoodBaseline')?.foodCoverage),
      lowFuelTransitionBaselineCoverage: n(foodCalibration?.plausibilityScenarios?.find?.((x) => x.scenario === 'lowFuelTransitionBaseline')?.foodCoverage)
    },
    labourLandContext: {
      availableFoodWorkerFTE: n(labourLand?.regionalIndicators?.availableFoodWorkerFTE),
      lowFuelFoodWorkersNeeded: n(labourLand?.regionalIndicators?.lowFuelFoodWorkersNeeded)
    }
  };

  const markdown = [
    '# Grey County Localization Access Baseline',
    '',
    '## What this is',
    'This report identifies where existing open-data features suggest candidate locations for local food, storage, processing, tool, repair, transport, and wood-energy infrastructure.',
    '',
    '## Why it matters',
    'Grey County may have enough land-base potential under present industrial inputs, but localization depends on settlement/service nodes, processing, storage, transport, and access infrastructure.',
    '',
    '## Regional summary',
    `- Highest readiness municipalities: ${regionalSummary.highestReadinessMunicipalities.map((x) => `${x.municipalityName} (${x.localizationReadinessScore.toFixed(3)})`).join('; ')}`,
    `- Lowest readiness municipalities: ${regionalSummary.lowestReadinessMunicipalities.map((x) => `${x.municipalityName} (${x.localizationReadinessScore.toFixed(3)})`).join('; ')}`,
    '',
    '## Municipal readiness table',
    '| Municipality | Readiness | Food hub score | Tool-library score | Storage-processing score | Wood-energy score | Main constraint |',
    '|---|---:|---:|---:|---:|---:|---|',
    ...municipalRows.map((m) => `| ${m.municipalityName} | ${m.localizationReadinessScore.toFixed(3)} | ${m.candidateFoodHubScore.toFixed(3)} | ${m.candidateToolLibraryScore.toFixed(3)} | ${m.candidateStorageProcessingScore.toFixed(3)} | ${m.candidateWoodEnergyDepotScore.toFixed(3)} | ${m.mainConstraint} |`),
    '',
    '## Candidate nodes',
    '| Candidate | Municipality | Type | Final score | Role fit | Confidence | Facility type | Role |',
    '|---|---|---|---:|---:|---|---|---|',
    ...candidateNodes.sort((a, b) => b.finalScore - a.finalScore).slice(0, 25).map((c) => `| ${c.settlementOrFacilityName} | ${c.municipalityName} | ${c.candidateType} | ${c.finalScore.toFixed(3)} | ${c.roleFitScore.toFixed(3)} | ${c.confidence} | ${c.candidateFacilityType} | ${c.recommendedRole} |`),
    '',
    '## Food-system localization needs',
    `- localizedPresentTechBaseline foodCoverage: ${report.foodCalibrationContext.localizedPresentTechBaselineCoverage.toFixed(3)}`,
    `- constrainedLocalFoodBaseline foodCoverage: ${report.foodCalibrationContext.constrainedLocalFoodBaselineCoverage.toFixed(3)}`,
    '- Storage, processing, and depot infrastructure remain necessary to convert land potential into local self-reliance.',
    '- Local crop-mix and distribution organization is still a major constraint.',
    '',
    '## Rural-transition support',
    '- Candidate nodes can support land-access activation through tools, repair, co-op depots, and off-farm processing.',
    '- Animal-power and shared heavy-work support are candidate functions, not confirmed facilities.',
    '- Settlement-service links and access infrastructure shape whether labour can be redirected effectively.',
    '',
    '## Caveats',
    '- Candidate nodes are suggestions from spatial/access indicators.',
    '- Candidate scores are role-specific. Civic/public buildings may be strong coordination or education nodes but weak logistics/processing depots.',
    '- They are not ownership or feasibility claims.',
    '- This is not a capital plan or engineering study.',
    '- Missing real service inventories may affect results.',
    ...(warnings.length ? ['', '## Warnings', ...warnings.map((w) => `- ${w}`)] : [])
  ].join('\n');

  const markdownPath = path.join(produceDir, 'grey-localization-access.md');
  const jsonPath = path.join(produceDir, 'grey-localization-access.json');
  const municipalCsvPath = path.join(produceDir, 'grey-localization-access-municipal.csv');
  const candidateCsvPath = path.join(produceDir, 'grey-localization-access-candidate-nodes.csv');

  fs.writeFileSync(markdownPath, markdown);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(municipalCsvPath, toCsv(municipalRows, [
    'municipalityName', 'population2021', 'settlementFeatureCount', 'transitStopCount', 'trailFeatureCount', 'cyclingRouteFeatureCount',
    'ruralBusinessCount', 'publicFacilityCount', 'lotsConcessionsCount', 'ruralFoodAccessOpportunityCount', 'cooperativeLandAccessCandidateCount',
    'managedForestFeatureCount', 'roadKm', 'roadKmPer1000Residents', 'candidateFoodHubScore', 'candidateToolLibraryScore',
    'candidateStorageProcessingScore', 'candidateWoodEnergyDepotScore', 'localizationReadinessScore', 'mainConstraint'
  ]));
  fs.writeFileSync(candidateCsvPath, toCsv(candidateNodes, [
    'candidateId', 'municipalityName', 'settlementOrFacilityName', 'candidateType', 'candidateRoleSuitability', 'candidateFacilityType',
    'roleFitScore', 'accessScore', 'logisticsScore', 'landAccessScore', 'finalScore', 'score', 'confidence', 'nearbyRoadAccess',
    'nearbyTransit', 'nearbyTrailOrCycling', 'nearbyRuralBusinesses', 'nearbyFoodAccessLots', 'nearbyManagedForest',
    'recommendedRole', 'caution', 'notes'
  ]));

  return {
    report,
    paths: {
      markdownPath,
      jsonPath,
      municipalCsvPath,
      candidateCsvPath
    }
  };
}
