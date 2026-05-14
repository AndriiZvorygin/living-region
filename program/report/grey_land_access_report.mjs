// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { greyCountySeedNodes } from '../data/grey_county_seed_nodes.mjs';
import { mapOfficialPlanLandUseCategory, normalizeName, extractLandUseRawValue } from '../data/grey_land_use_mapping.mjs';
import { getGeometryCentroid, pointInPolygon, pointInMultiPolygon, assignFeatureToPolygonByCentroid } from '../gis/spatial_assignment.mjs';

const ACCESS_THRESHOLDS_KM = {
  road: 0.5,
  trailCycling: 1,
  transit: 2,
  ruralBusiness: 5,
  publicFacility: 5,
  managedForest: 1,
  settlementNear: 1
};

function readGeoJsonFeaturesSafe(filePath, warnings, required = false) {
  if (!fs.existsSync(filePath)) {
    warnings.push(`Missing file: ${filePath}`);
    return required ? [] : [];
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed?.features) ? parsed.features : [];
  } catch (error) {
    warnings.push(`Failed to parse file: ${filePath} (${error.message})`);
    return [];
  }
}

function csvEscape(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function toCsv(rows, headers) {
  return [headers.join(','), ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(','))].join('\n');
}

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function containsPointInFeature(point, feature) {
  const geom = feature?.geometry;
  if (!point || !geom) return false;
  if (geom.type === 'Polygon') return pointInPolygon(point, geom);
  if (geom.type === 'MultiPolygon') return pointInMultiPolygon(point, geom);
  return false;
}

function pickCaseInsensitive(props, keys) {
  const all = Object.keys(props ?? {});
  for (const key of keys) {
    const hit = all.find((k) => k.toLowerCase() === key.toLowerCase());
    if (hit && props[hit] !== undefined && props[hit] !== null && String(props[hit]).trim() !== '') return String(props[hit]).trim();
  }
  return null;
}

function normMunicipalityName(value) {
  return normalizeName(value)
    .replace(/^(township|town|city|municipality)\s+of\s+/, '')
    .replace(/^the\s+/, '')
    .trim();
}

export function haversineDistanceKm(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length < 2 || b.length < 2) return Infinity;
  const [lonA, latA] = a;
  const [lonB, latB] = b;
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(latB - latA);
  const dLon = toRad(lonB - lonA);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const c = s1 * s1 + Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * s2 * s2;
  return 2 * R * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

function toLocalKm(point, refLat) {
  const x = point[0] * 111.32 * Math.cos((refLat * Math.PI) / 180);
  const y = point[1] * 110.57;
  return [x, y];
}

function distancePointToSegmentKm(point, a, b) {
  const refLat = point[1];
  const [px, py] = toLocalKm(point, refLat);
  const [ax, ay] = toLocalKm(a, refLat);
  const [bx, by] = toLocalKm(b, refLat);
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const denom = abx * abx + aby * aby;
  if (denom <= 1e-12) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / denom));
  const cx = ax + t * abx;
  const cy = ay + t * aby;
  return Math.hypot(px - cx, py - cy);
}

export function distancePointToLineKm(point, lineString) {
  const coords = lineString?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return Infinity;
  let min = Infinity;
  for (let i = 1; i < coords.length; i += 1) {
    const d = distancePointToSegmentKm(point, coords[i - 1], coords[i]);
    if (d < min) min = d;
  }
  return min;
}

function distancePointToPolygonBoundaryKm(point, polygon) {
  const rings = polygon?.coordinates;
  if (!Array.isArray(rings) || rings.length === 0) return Infinity;
  let min = Infinity;
  for (const ring of rings) {
    if (!Array.isArray(ring) || ring.length < 2) continue;
    for (let i = 1; i < ring.length; i += 1) {
      const d = distancePointToSegmentKm(point, ring[i - 1], ring[i]);
      if (d < min) min = d;
    }
  }
  return min;
}

export function minDistanceToFeatureKm(point, feature) {
  const geom = feature?.geometry;
  if (!geom || !point) return Infinity;
  if (geom.type === 'Point') return haversineDistanceKm(point, geom.coordinates);
  if (geom.type === 'LineString') return distancePointToLineKm(point, geom);
  if (geom.type === 'MultiLineString') {
    let min = Infinity;
    for (const coords of geom.coordinates ?? []) {
      min = Math.min(min, distancePointToLineKm(point, { type: 'LineString', coordinates: coords }));
    }
    return min;
  }
  if (geom.type === 'Polygon') {
    if (pointInPolygon(point, geom)) return 0;
    return distancePointToPolygonBoundaryKm(point, geom);
  }
  if (geom.type === 'MultiPolygon') {
    if (pointInMultiPolygon(point, geom)) return 0;
    let min = Infinity;
    for (const coords of geom.coordinates ?? []) {
      min = Math.min(min, distancePointToPolygonBoundaryKm(point, { type: 'Polygon', coordinates: coords }));
    }
    return min;
  }
  return Infinity;
}

export function minDistanceToFeaturesKm(point, features) {
  let min = Infinity;
  for (const f of features) {
    const d = minDistanceToFeatureKm(point, f);
    if (d < min) min = d;
  }
  return min;
}

export function deriveOpportunityCategory(data) {
  const limiting = [];
  if (data.hazard) limiting.push('hazard');
  if (data.wetland) limiting.push('wetland');
  if (!data.roadAccessible) limiting.push('noNearbyRoad');
  if (!data.settlementAdjacent) limiting.push('farFromSettlement');
  if (!(data.trailOrCyclingAccessible || data.transitAccessible || data.ruralBusinessNearby || data.publicFacilityNearby)) limiting.push('noServiceAccess');
  if (data.landUseCategory === 'unknown') limiting.push('unknownLandUse');

  let opportunityCategory = 'unknown';
  if (data.hazard || data.wetland) {
    opportunityCategory = 'constrainedLand';
  } else if ((data.landUseCategory === 'settlement' || data.settlementAdjacent) && data.roadAccessible) {
    opportunityCategory = 'settlementGardenOpportunity';
  } else if ((data.landUseCategory === 'agricultural' || data.landUseCategory === 'rural') && data.roadAccessible) {
    if (data.settlementAdjacent || data.trailOrCyclingAccessible || data.ruralBusinessNearby || data.publicFacilityNearby) {
      opportunityCategory = 'cooperativeLandAccessCandidate';
    } else {
      opportunityCategory = 'ruralFoodAccessOpportunity';
    }
  } else if ((data.landUseCategory === 'rural' || data.landUseCategory === 'agricultural' || data.managedForestAdjacent || data.landUseCategory === 'recreation')
      && (data.roadAccessible || data.trailOrCyclingAccessible)) {
    opportunityCategory = 'woodEnergyOrForestResilienceCandidate';
  } else if ((data.landUseCategory === 'rural' || data.landUseCategory === 'agricultural') && !data.roadAccessible
      && !(data.trailOrCyclingAccessible || data.transitAccessible || data.ruralBusinessNearby || data.publicFacilityNearby)) {
    opportunityCategory = 'lowAccessRural';
  }

  return { opportunityCategory, limitingFactors: limiting };
}

export function buildGreyLandAccessReport(options = {}) {
  const inputDir = path.resolve(options.inputDir ?? 'know/input/gis');
  const outputDir = path.resolve(options.outputDir ?? 'know/produce');
  fs.mkdirSync(outputDir, { recursive: true });
  const warnings = [];
  const censusPopulationDistributionPath = path.join(outputDir, 'grey-census-population-distribution.json');
  let populationDistributionSource = 'municipalHeuristic';
  if (fs.existsSync(censusPopulationDistributionPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(censusPopulationDistributionPath, 'utf8'));
      if (parsed?.populationDistributionSource === 'censusSmallArea' || Number(parsed?.totalPopulationMatched) > 0) {
        populationDistributionSource = 'censusSmallArea';
      }
    } catch (error) {
      warnings.push(`Failed to parse census population distribution: ${error.message}`);
    }
  }

  const lotFeatures = readGeoJsonFeaturesSafe(path.join(inputDir, 'lots-and-concessions-grey.geojson'), warnings);
  if (lotFeatures.length === 0) {
    warnings.push('Missing lots-and-concessions-grey.geojson. Run: npm run grey:download-data -- --source=lots-and-concessions-grey');
  }
  const municipalityFeatures = readGeoJsonFeaturesSafe(path.join(inputDir, 'municipality-boundaries.geojson'), warnings);
  const settlementFeatures = readGeoJsonFeaturesSafe(path.join(inputDir, 'settlement-boundaries.geojson'), warnings);
  const landUseFeatures = readGeoJsonFeaturesSafe(path.join(inputDir, 'official-plan-schedule-a-land-use.geojson'), warnings);
  const roadFeatures = readGeoJsonFeaturesSafe(path.join(inputDir, 'road-centrelines-grey.geojson'), warnings);

  const transitStops = readGeoJsonFeaturesSafe(path.join(inputDir, 'grey-transit-bus-stops.geojson'), warnings);
  const cyclingRoutes = readGeoJsonFeaturesSafe(path.join(inputDir, 'official-road-cycling-routes.geojson'), warnings);
  const countyTrails = readGeoJsonFeaturesSafe(path.join(inputDir, 'county-trails.geojson'), warnings);
  const cpRailTrail = readGeoJsonFeaturesSafe(path.join(inputDir, 'cp-rail-trail.geojson'), warnings);
  const hikingTrails = readGeoJsonFeaturesSafe(path.join(inputDir, 'hiking-trails.geojson'), warnings);
  const managedForest = readGeoJsonFeaturesSafe(path.join(inputDir, 'managed-forest-boundary.geojson'), warnings);
  const ruralBusinesses = readGeoJsonFeaturesSafe(path.join(inputDir, 'on-farm-rural-business-listing.geojson'), warnings);
  const publicFacilities = readGeoJsonFeaturesSafe(path.join(inputDir, 'public-facilities.geojson'), warnings);

  const trailsAndCycling = [...cyclingRoutes, ...countyTrails, ...cpRailTrail, ...hikingTrails];

  const muniByNorm = new Map(greyCountySeedNodes.map((n) => [normMunicipalityName(n.municipalityName), n]));
  const muniPolygons = municipalityFeatures
    .map((feature) => {
      const rawName = pickCaseInsensitive(feature.properties, ['MUNICIPAL', 'MUN_NAME', 'MUNICIPALITY', 'NAME']);
      const node = rawName ? muniByNorm.get(normMunicipalityName(rawName)) : null;
      return {
        ...feature,
        municipalityName: node?.municipalityName ?? rawName ?? null,
        municipalityId: node?.municipalityId ?? null
      };
    })
    .filter((f) => Boolean(f.municipalityName));

  const municipalityRows = new Map(greyCountySeedNodes.map((n) => [n.municipalityName, {
    municipalityName: n.municipalityName,
    lotConcessionFeatures: 0,
    agriculturalLots: 0,
    ruralLots: 0,
    settlementLots: 0,
    hazardLots: 0,
    wetlandLots: 0,
    roadAccessibleLots: 0,
    trailOrCyclingAccessibleLots: 0,
    transitAccessibleLots: 0,
    ruralBusinessNearbyLots: 0,
    publicFacilityNearbyLots: 0,
    settlementGardenOpportunity: 0,
    ruralFoodAccessOpportunity: 0,
    cooperativeLandAccessCandidate: 0,
    woodEnergyOrForestResilienceCandidate: 0,
    constrainedLand: 0,
    lowAccessRural: 0,
    unknown: 0,
    unassignedLots: 0,
    notes: ''
  }]));

  const townshipCounts = {};
  const opportunityCounts = {};
  const constraintCounts = { hazard: 0, wetland: 0 };
  let assignedToMunicipalityCount = 0;
  let assignedBySourcePropertyCount = 0;
  let assignedByGeometryCount = 0;

  const detailRows = [];
  const lotFabricAreaByMunicipalityM2 = {};
  const lotFabricAreaByLandUseClassM2 = {};
  let lotsInsideSettlementCount = 0;
  let lotsOutsideSettlementCount = 0;
  let lotFabricAreaInsideSettlementM2 = 0;
  let lotFabricAreaOutsideSettlementM2 = 0;

  const safePointFeatures = (features) => features.filter((f) => Array.isArray(getGeometryCentroid(f.geometry)));
  const transitPoints = safePointFeatures(transitStops).map((f) => ({ ...f, __centroid: getGeometryCentroid(f.geometry) }));
  const ruralBizPoints = safePointFeatures(ruralBusinesses).map((f) => ({ ...f, __centroid: getGeometryCentroid(f.geometry) }));
  const facilityPoints = safePointFeatures(publicFacilities).map((f) => ({ ...f, __centroid: getGeometryCentroid(f.geometry) }));

  for (let i = 0; i < lotFeatures.length; i += 1) {
    const feature = lotFeatures[i];
    const props = feature.properties ?? {};
    const centroid = getGeometryCentroid(feature.geometry);
    if (!Array.isArray(centroid)) continue;

    const lot = pickCaseInsensitive(props, ['LOT', 'LOT_NO', 'LOT_NUMBER', 'LOTNUM']);
    const concession = pickCaseInsensitive(props, ['CONCESSION', 'CON_NO', 'CONCESSION_NO', 'SHORT_CON']);
    const township = pickCaseInsensitive(props, ['TOWNSHIP', 'GEOGRAPHIC_TOWNSHIP']);
    const lotAreaM2 = toNumber(pickCaseInsensitive(props, ['ShapeSTArea', 'SHAPESTArea', 'area', 'AREA']), 0);

    townshipCounts[township ?? 'unknown'] = (townshipCounts[township ?? 'unknown'] ?? 0) + 1;

    const sourceMuni = pickCaseInsensitive(props, ['MUNICIPALITY', 'MUNICIPAL', 'MUN_NAME']);
    let municipalityName = null;
    let municipalityId = null;
    let assignmentMethod = 'unassigned';

    if (sourceMuni) {
      const node = muniByNorm.get(normMunicipalityName(sourceMuni));
      if (node) {
        municipalityName = node.municipalityName;
        municipalityId = node.municipalityId;
        assignmentMethod = 'sourceProperty';
        assignedBySourcePropertyCount += 1;
      }
    }
    if (!municipalityName) {
      const assigned = assignFeatureToPolygonByCentroid(feature, muniPolygons);
      if (assigned.matched?.municipalityName) {
        municipalityName = assigned.matched.municipalityName;
        municipalityId = assigned.matched.municipalityId;
        assignmentMethod = 'geometryCentroid';
        assignedByGeometryCount += 1;
      }
    }

    if (municipalityName) assignedToMunicipalityCount += 1;

    let landUseCategory = 'unknown';
    let settlementAdjacent = false;

    for (const lu of landUseFeatures) {
      if (containsPointInFeature(centroid, lu)) {
        landUseCategory = mapOfficialPlanLandUseCategory(extractLandUseRawValue(lu.properties));
        break;
      }
    }

    for (const s of settlementFeatures) {
      if (containsPointInFeature(centroid, s)) {
        settlementAdjacent = true;
        break;
      }
    }
    if (!settlementAdjacent && settlementFeatures.length > 0) {
      const nearSettlement = minDistanceToFeaturesKm(centroid, settlementFeatures) <= ACCESS_THRESHOLDS_KM.settlementNear;
      settlementAdjacent = nearSettlement;
    }

    const roadAccessible = roadFeatures.length > 0 && minDistanceToFeaturesKm(centroid, roadFeatures) <= ACCESS_THRESHOLDS_KM.road;
    const trailOrCyclingAccessible = trailsAndCycling.length > 0 && minDistanceToFeaturesKm(centroid, trailsAndCycling) <= ACCESS_THRESHOLDS_KM.trailCycling;
    const transitAccessible = transitPoints.length > 0 && Math.min(...transitPoints.map((p) => haversineDistanceKm(centroid, p.__centroid))) <= ACCESS_THRESHOLDS_KM.transit;
    const ruralBusinessNearby = ruralBizPoints.length > 0 && Math.min(...ruralBizPoints.map((p) => haversineDistanceKm(centroid, p.__centroid))) <= ACCESS_THRESHOLDS_KM.ruralBusiness;
    const publicFacilityNearby = facilityPoints.length > 0 && Math.min(...facilityPoints.map((p) => haversineDistanceKm(centroid, p.__centroid))) <= ACCESS_THRESHOLDS_KM.publicFacility;
    const managedForestAdjacent = managedForest.length > 0 && minDistanceToFeaturesKm(centroid, managedForest) <= ACCESS_THRESHOLDS_KM.managedForest;

    const hazard = landUseCategory === 'hazard';
    const wetland = landUseCategory === 'wetland';
    if (hazard) constraintCounts.hazard += 1;
    if (wetland) constraintCounts.wetland += 1;

    const { opportunityCategory, limitingFactors } = deriveOpportunityCategory({
      landUseCategory,
      settlementAdjacent,
      roadAccessible,
      trailOrCyclingAccessible,
      transitAccessible,
      ruralBusinessNearby,
      publicFacilityNearby,
      managedForestAdjacent,
      hazard,
      wetland
    });

    opportunityCounts[opportunityCategory] = (opportunityCounts[opportunityCategory] ?? 0) + 1;
    lotFabricAreaByLandUseClassM2[landUseCategory] = (lotFabricAreaByLandUseClassM2[landUseCategory] ?? 0) + lotAreaM2;
    if (settlementAdjacent) {
      lotsInsideSettlementCount += 1;
      lotFabricAreaInsideSettlementM2 += lotAreaM2;
    } else {
      lotsOutsideSettlementCount += 1;
      lotFabricAreaOutsideSettlementM2 += lotAreaM2;
    }

    const muniRow = municipalityName ? municipalityRows.get(municipalityName) : null;
    if (muniRow) {
      muniRow.lotConcessionFeatures += 1;
      if (landUseCategory === 'agricultural') muniRow.agriculturalLots += 1;
      if (landUseCategory === 'rural') muniRow.ruralLots += 1;
      if (landUseCategory === 'settlement') muniRow.settlementLots += 1;
      if (hazard) muniRow.hazardLots += 1;
      if (wetland) muniRow.wetlandLots += 1;
      if (roadAccessible) muniRow.roadAccessibleLots += 1;
      if (trailOrCyclingAccessible) muniRow.trailOrCyclingAccessibleLots += 1;
      if (transitAccessible) muniRow.transitAccessibleLots += 1;
      if (ruralBusinessNearby) muniRow.ruralBusinessNearbyLots += 1;
      if (publicFacilityNearby) muniRow.publicFacilityNearbyLots += 1;
      if (Object.hasOwn(muniRow, opportunityCategory)) muniRow[opportunityCategory] += 1;
      else muniRow.unknown += 1;
      lotFabricAreaByMunicipalityM2[municipalityName] = (lotFabricAreaByMunicipalityM2[municipalityName] ?? 0) + lotAreaM2;
    }

    detailRows.push({
      id: pickCaseInsensitive(props, ['OBJECTID', 'ID']) ?? `lot-${i + 1}`,
      municipalityName: municipalityName ?? '',
      township: township ?? '',
      concession: concession ?? '',
      lot: lot ?? '',
      lotAreaM2,
      landUseCategory,
      settlementAdjacent,
      opportunityCategory,
      roadAccessible,
      trailOrCyclingAccessible,
      transitAccessible,
      ruralBusinessNearby,
      publicFacilityNearby,
      managedForestAdjacent,
      limitingFactors: limitingFactors.join('|'),
      assignmentMethod
    });
  }

  const unassignedLotConcessionCount = lotFeatures.length - assignedToMunicipalityCount;
  if (unassignedLotConcessionCount > 0) {
    warnings.push('Some lot/concession features could not be assigned to a municipality.');
  }

  const municipalitySummaryRows = [...municipalityRows.values()].map((row) => {
    if (row.lotConcessionFeatures === 0) {
      row.unassignedLots = 0;
      row.notes = 'No assigned lot/concession features in this pass.';
    }
    return row;
  });

  const lotConcessionCountByMunicipality = Object.fromEntries(
    municipalitySummaryRows.filter((r) => r.lotConcessionFeatures > 0).map((r) => [r.municipalityName, r.lotConcessionFeatures])
  );

  const report = {
    generatedAt: new Date().toISOString(),
    populationDistributionSource,
    caveat: 'Lots and Concessions is a lot-fabric grounded proxy layer, not parcel ownership, household-level access, title, or legal access rights.',
    evidenceTiers: {
      measuredGroundedLotFabric: {
        status: 'measured',
        basis: 'lots-and-concessions-grey.geojson feature and area counts',
        caveat: 'Partial ground-truth layer; does not identify household-level access.'
      },
      overlayDerived: {
        status: 'overlay',
        basis: 'lot centroid overlay with settlement boundaries and Official Plan land-use classes',
        caveat: 'Overlay outputs are spatial diagnostics, not parcel-address-building linkage.'
      },
      populationProxy: {
        status: 'proxy',
        basis: 'Census/dwelling proxy reports outside this module',
        caveat: 'Population-level land-access inference remains proxy until parcel-address-building linkage exists.'
      },
      scenarioAssumptions: {
        status: 'scenario_assumption',
        basis: 'thresholds/proximity rules',
        caveat: 'Deterministic access thresholds are model assumptions.'
      }
    },
    dataUsed: {
      municipalityFeatures: municipalityFeatures.length,
      settlementFeatures: settlementFeatures.length,
      landUseFeatures: landUseFeatures.length,
      roadFeatures: roadFeatures.length,
      lotConcessionFeatures: lotFeatures.length,
      transitStops: transitStops.length,
      cyclingRoutes: cyclingRoutes.length,
      trails: countyTrails.length + cpRailTrail.length + hikingTrails.length,
      managedForest: managedForest.length,
      ruralBusinesses: ruralBusinesses.length,
      publicFacilities: publicFacilities.length
    },
    assignment: {
      totalLotConcessionFeatures: lotFeatures.length,
      assignedToMunicipalityCount,
      unassignedLotConcessionCount,
      assignedBySourcePropertyCount,
      assignedByGeometryCount,
      lotConcessionCountByMunicipality,
      lotConcessionCountByTownshipSource: townshipCounts
    },
    opportunityCategoryCounts: opportunityCounts,
    constraintCounts,
    thresholdsKm: ACCESS_THRESHOLDS_KM,
    landAccessClaimReadiness: {
      status: 'partial_groundtruth',
      rationale: 'Lot-fabric and overlays are grounded, but address points, building footprints, parcel-address linkage, household/unit counts, and tenure/access rights are not linked.',
      householdLevelClaimAllowed: false
    },
    warnings
  };

  const jsonPath = path.join(outputDir, 'grey-land-access-baseline.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const municipalityCsvPath = path.join(outputDir, 'grey-land-access-municipality-summary.csv');
  fs.writeFileSync(municipalityCsvPath, toCsv(municipalitySummaryRows, [
    'municipalityName','lotConcessionFeatures','agriculturalLots','ruralLots','settlementLots','hazardLots','wetlandLots','roadAccessibleLots','trailOrCyclingAccessibleLots','transitAccessibleLots','ruralBusinessNearbyLots','publicFacilityNearbyLots','settlementGardenOpportunity','ruralFoodAccessOpportunity','cooperativeLandAccessCandidate','woodEnergyOrForestResilienceCandidate','constrainedLand','lowAccessRural','unknown','unassignedLots','notes'
  ]));

  const detailCsvPath = path.join(outputDir, 'grey-land-access-lot-detail.csv');
  fs.writeFileSync(detailCsvPath, toCsv(detailRows, [
    'id','municipalityName','township','concession','lot','lotAreaM2','landUseCategory','settlementAdjacent','opportunityCategory','roadAccessible','trailOrCyclingAccessible','transitAccessible','ruralBusinessNearby','publicFacilityNearby','managedForestAdjacent','limitingFactors','assignmentMethod'
  ]));

  const overlaySummary = {
    generatedAt: new Date().toISOString(),
    sourceStatus: 'lot_fabric_grounded_proxy_overlay',
    lotFabricFeatureCount: lotFeatures.length,
    lotFabricAreaByMunicipalityM2,
    lotFabricAreaByLandUseClassM2,
    lotsInsideSettlementCount,
    lotsOutsideSettlementCount,
    lotFabricAreaInsideSettlementM2,
    lotFabricAreaOutsideSettlementM2,
    lotsByLandUseClassCount: Object.fromEntries(
      Object.entries(detailRows.reduce((acc, r) => {
        acc[r.landUseCategory] = (acc[r.landUseCategory] ?? 0) + 1;
        return acc;
      }, {}))
    ),
    lotsByOpportunityCategoryCount: opportunityCounts,
    limitations: [
      'Lot-fabric grounded proxy only; not parcel ownership or legal access.',
      'No parcel-address-building linkage in this overlay summary.',
      'No household/unit counts linked to lot features.',
      'Do not treat these overlays as household-level access proof.'
    ]
  };
  const overlayJsonPath = path.join(outputDir, 'grey-land-access-gis-overlay-summary.json');
  const overlayMarkdownPath = path.join(outputDir, 'grey-land-access-gis-overlay-summary.md');
  fs.writeFileSync(overlayJsonPath, JSON.stringify(overlaySummary, null, 2));
  fs.writeFileSync(overlayMarkdownPath, [
    '# Grey Land-Access GIS Overlay Summary',
    '',
    '## What this is',
    '- Lot-fabric grounded proxy summary from existing Grey GIS layers.',
    '- Partial ground-truth layer: does not yet identify household-level access.',
    '',
    '## Core counts',
    `- lot-fabric feature count: ${overlaySummary.lotFabricFeatureCount}`,
    `- lots inside settlement boundaries: ${overlaySummary.lotsInsideSettlementCount}`,
    `- lots outside settlement boundaries: ${overlaySummary.lotsOutsideSettlementCount}`,
    `- lot-fabric area inside settlement (m2): ${overlaySummary.lotFabricAreaInsideSettlementM2.toFixed(2)}`,
    `- lot-fabric area outside settlement (m2): ${overlaySummary.lotFabricAreaOutsideSettlementM2.toFixed(2)}`,
    '',
    '## Evidence tier caveat',
    '- This is a lot-fabric grounded proxy and overlay diagnostic.',
    '- It does not prove household-level land access.',
    '- Parcel-address-building linkage is still required before article-grade household access claims.'
  ].join('\n'));

  const topMunicipalities = [...municipalitySummaryRows]
    .sort((a, b) => b.lotConcessionFeatures - a.lotConcessionFeatures)
    .slice(0, 5)
    .map((m) => `${m.municipalityName}:${m.lotConcessionFeatures}`)
    .join(', ');

  const markdown = [
    '# Grey County Land-Access Baseline',
    '',
    '## What this is',
    '- A baseline report using the real Grey County Lots and Concessions layer and related open data.',
    '- Intended for rural-transition land-access diagnostics, not ownership interpretation.',
    '',
    '## Important limitation',
    '- Lots and Concessions is a lot-fabric grounded proxy, not ownership parcels, not title, and not legal access rights.',
    '- This layer is partial ground-truth and does not yet identify household-level access.',
    ...(lotFeatures.length === 0 ? ['- Missing lots-and-concessions-grey.geojson. Run: `npm run grey:download-data -- --source=lots-and-concessions-grey`'] : []),
    '',
    '## Data used',
    `- Lots and concessions features: ${lotFeatures.length}`,
    `- Municipality boundaries: ${municipalityFeatures.length}`,
    `- Settlement boundaries: ${settlementFeatures.length}`,
    `- Official Plan land use: ${landUseFeatures.length}`,
    `- Road centrelines: ${roadFeatures.length}`,
    `- Transit stops: ${transitStops.length}`,
    `- Cycling routes: ${cyclingRoutes.length}`,
    `- Trails (county + CP + hiking): ${countyTrails.length + cpRailTrail.length + hikingTrails.length}`,
    `- Managed forest: ${managedForest.length}`,
    `- Rural businesses: ${ruralBusinesses.length}`,
    `- Public facilities: ${publicFacilities.length}`,
    '',
    '## Regional summary',
    `- totalLotConcessionFeatures: ${lotFeatures.length}`,
    `- assignedToMunicipalityCount: ${assignedToMunicipalityCount}`,
    `- unassignedLotConcessionCount: ${unassignedLotConcessionCount}`,
    `- top municipalities by lot count: ${topMunicipalities || 'none'}`,
    '',
    '## Municipality summary',
    'See: `know/produce/grey-land-access-municipality-summary.csv`',
    'See also: `know/produce/grey-land-access-gis-overlay-summary.json`',
    '',
    '## Opportunity categories',
    ...Object.entries(opportunityCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '## Constraint categories',
    `- hazard: ${constraintCounts.hazard}`,
    `- wetland: ${constraintCounts.wetland}`,
    '',
    '## Access indicators',
    `- roadAccessible threshold: ${ACCESS_THRESHOLDS_KM.road} km`,
    `- trailOrCyclingAccessible threshold: ${ACCESS_THRESHOLDS_KM.trailCycling} km`,
    `- transitAccessible threshold: ${ACCESS_THRESHOLDS_KM.transit} km`,
    `- ruralBusinessNearby threshold: ${ACCESS_THRESHOLDS_KM.ruralBusiness} km`,
    `- publicFacilityNearby threshold: ${ACCESS_THRESHOLDS_KM.publicFacility} km`,
    '',
    '## Caveats and next data needed',
    '- This is centroid/proximity-based, coarse, and deterministic.',
    '- Overlay quality depends on source geometry and naming consistency.',
    '- This report does not identify households with/without land; it is not parcel-address-building linkage.',
    '- Requires parcel-address-building linkage before article-grade household land-access claims.',
    '- Add parcel ownership/access rights data separately if available.',
    '- Add calibrated access/travel impedance for stronger accessibility diagnostics.'
  ].join('\n');

  const markdownPath = path.join(outputDir, 'grey-land-access-baseline.md');
  fs.writeFileSync(markdownPath, markdown);

  return {
    report,
    paths: {
      markdownPath,
      jsonPath,
      municipalityCsvPath,
      detailCsvPath,
      overlayJsonPath,
      overlayMarkdownPath
    }
  };
}
