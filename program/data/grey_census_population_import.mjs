// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { getGeometryCentroid, assignFeatureToPolygonByCentroid } from '../gis/spatial_assignment.mjs';
import { mapOfficialPlanLandUseCategory } from './grey_land_use_mapping.mjs';

export const KNOWN_GREY_POPULATION_2021 = 100905;

function n(v, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function normalizeName(v) {
  return String(v ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function pickCaseInsensitive(props, keys) {
  const p = props ?? {};
  const all = Object.keys(p);
  for (const key of keys) {
    const hit = all.find((k) => k.toLowerCase() === key.toLowerCase());
    if (!hit) continue;
    const value = p[hit];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return null;
}

function readGeoJsonFeatures(filePath, warnings, label, required = false) {
  if (!fs.existsSync(filePath)) {
    if (required) warnings.push(`Missing required ${label}: ${filePath}`);
    return [];
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed?.features) ? parsed.features : [];
  } catch (error) {
    warnings.push(`Failed to parse ${label}: ${filePath} (${error.message})`);
    return [];
  }
}

function parseCsv(text) {
  const rows = [];
  let i = 0;
  let field = '';
  let row = [];
  let inQuotes = false;
  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    if (row.length > 0) rows.push(row);
    row = [];
  };
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
      } else {
        field += ch;
      }
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      pushField();
      i += 1;
      continue;
    }
    if (ch === '\n') {
      pushField();
      pushRow();
      i += 1;
      continue;
    }
    if (ch === '\r') {
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  pushField();
  pushRow();
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => String(h ?? '').trim());
  return rows.slice(1).map((r) => {
    const out = {};
    for (let j = 0; j < headers.length; j += 1) out[headers[j]] = r[j] ?? '';
    return out;
  });
}

function readCsvRows(filePath, warnings, label) {
  if (!fs.existsSync(filePath)) {
    warnings.push(`Missing ${label}: ${filePath}`);
    return [];
  }
  try {
    return parseCsv(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    warnings.push(`Failed to parse ${label}: ${filePath} (${error.message})`);
    return [];
  }
}

function pointInPolygon(point, polygonCoordinates) {
  const [x, y] = point;
  let inside = false;
  const ring = polygonCoordinates?.[0] ?? [];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-12) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function containsPoint(geom, point) {
  if (!geom || !point) return false;
  if (geom.type === 'Polygon') return pointInPolygon(point, geom.coordinates);
  if (geom.type === 'MultiPolygon') return geom.coordinates.some((poly) => pointInPolygon(point, poly));
  return false;
}

function toRad(d) {
  return (d * Math.PI) / 180;
}

function haversineKm(a, b) {
  if (!a || !b) return Infinity;
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const p = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(p), Math.sqrt(1 - p));
}

function nearAny(point, features, thresholdKm) {
  for (const f of features) {
    const c = f._centroid ?? getGeometryCentroid(f.geometry);
    if (c && haversineKm(point, c) <= thresholdKm) return true;
  }
  return false;
}

function likelyGreyRow(row) {
  const values = Object.values(row).map((v) => normalizeName(v));
  return values.some((v) => v.includes('grey') && !v.includes('greyhound'));
}

function isOntarioGreyDguid(dguid) {
  const s = String(dguid ?? '');
  return s.startsWith('2021A000335') || s.startsWith('2021A000535') || s.startsWith('2021S0510');
}

function findId(row, keys) {
  return String(pickCaseInsensitive(row, keys) ?? '').trim();
}

function findPopulation(row) {
  return n(pickCaseInsensitive(row, ['POP', 'POP2021', 'Population', 'C1_COUNT_TOTAL', 'TOT_POP', 'P0010001']));
}

function findDwellings(row) {
  return n(pickCaseInsensitive(row, ['DWELLINGS', 'DWELL', 'TOTAL_DWELLINGS', 'C2_COUNT_TOTAL', 'DWELLS']));
}

function toCsv(rows, headers) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
}

export function importGreyCensusPopulation(options = {}) {
  const censusDir = path.resolve(options.censusDir ?? 'know/input/census/2021');
  const inputGisDir = path.resolve(options.inputGisDir ?? 'know/input/gis');
  const produceDir = path.resolve(options.produceDir ?? 'know/produce');
  fs.mkdirSync(produceDir, { recursive: true });
  const warnings = [];

  const municipalityFeatures = readGeoJsonFeatures(path.join(inputGisDir, 'municipality-boundaries.geojson'), warnings, 'municipal boundaries', true);
  const settlementFeatures = readGeoJsonFeatures(path.join(inputGisDir, 'settlement-boundaries.geojson'), warnings, 'settlement boundaries');
  const landUseFeatures = readGeoJsonFeatures(path.join(inputGisDir, 'official-plan-schedule-a-land-use.geojson'), warnings, 'land use');
  const roadFeatures = readGeoJsonFeatures(path.join(inputGisDir, 'road-centrelines-grey.geojson'), warnings, 'roads');
  const transitFeatures = readGeoJsonFeatures(path.join(inputGisDir, 'grey-transit-bus-stops.geojson'), warnings, 'transit stops');
  const trailFeatures = [
    ...readGeoJsonFeatures(path.join(inputGisDir, 'official-road-cycling-routes.geojson'), warnings, 'cycling routes'),
    ...readGeoJsonFeatures(path.join(inputGisDir, 'county-trails.geojson'), warnings, 'county trails'),
    ...readGeoJsonFeatures(path.join(inputGisDir, 'cp-rail-trail.geojson'), warnings, 'cp rail trail'),
    ...readGeoJsonFeatures(path.join(inputGisDir, 'hiking-trails.geojson'), warnings, 'hiking trails')
  ];
  const ruralBusinessFeatures = readGeoJsonFeatures(path.join(inputGisDir, 'on-farm-rural-business-listing.geojson'), warnings, 'rural businesses');
  const facilityFeatures = readGeoJsonFeatures(path.join(inputGisDir, 'public-facilities.geojson'), warnings, 'public facilities');

  const blocksGeoCandidates = [
    'dissemination-block-boundaries.geojson',
    'census-2021-dissemination-block-boundaries.geojson',
    'grey-census-db-boundaries.geojson'
  ];
  const daGeoCandidates = [
    'dissemination-area-boundaries.geojson',
    'census-2021-dissemination-area-boundaries.geojson'
  ];
  const attrCandidates = [
    'geographic-attribute-file.csv',
    'census-2021-geographic-attribute-file.csv'
  ];
  const relCandidates = [
    'dissemination-geographies-relationship-file.csv',
    'census-2021-dissemination-geographies-relationship-file.csv'
  ];

  const findExisting = (list) => list.map((f) => path.join(censusDir, f)).find((f) => fs.existsSync(f)) ?? null;
  const blockPath = findExisting(blocksGeoCandidates);
  const daPath = findExisting(daGeoCandidates);
  const attrPath = findExisting(attrCandidates);
  const relPath = findExisting(relCandidates);

  if (!attrPath) warnings.push(`Missing Census attribute CSV in ${censusDir}. Expected one of: ${attrCandidates.join(', ')}`);
  const geometries = blockPath
    ? readGeoJsonFeatures(blockPath, warnings, 'dissemination block boundaries')
    : readGeoJsonFeatures(daPath ?? '', warnings, 'dissemination area boundaries');
  const geographicLevel = blockPath ? 'disseminationBlock' : (daPath ? 'disseminationArea' : 'none');

  if (geometries.length === 0) {
    warnings.push(`No Census geometry loaded from ${censusDir}. Add dissemination-block or dissemination-area GeoJSON.`);
  }

  const attrRows = attrPath ? readCsvRows(attrPath, warnings, 'geographic attribute file') : [];
  const relRows = relPath ? readCsvRows(relPath, warnings, 'relationship file') : [];
  const relById = new Map();
  for (const row of relRows) {
    const key = findId(row, ['DBUID', 'DBUID_2021', 'DBUID2021', 'UID', 'DBuid']);
    if (key) relById.set(key, row);
  }

  const attrById = new Map();
  for (const row of attrRows) {
    const key = findId(row, ['DBUID', 'DBUID_2021', 'DBUID2021', 'UID', 'DGUID', 'DB_UID']);
    if (!key) continue;
    attrById.set(key, row);
  }

  const muniGeom = municipalityFeatures.map((f) => {
    const municipalityName = String(pickCaseInsensitive(f.properties, ['MUNICIPAL', 'MUN_NAME', 'MUNICIPALITY', 'NAME']) ?? 'unknown');
    return { ...f, municipalityName };
  });
  const settlementGeom = settlementFeatures.map((f) => ({
    ...f,
    settlementName: String(pickCaseInsensitive(f.properties, ['SETTL_NAME', 'NAME', 'Settlement']) ?? 'unknown')
  }));

  const markCentroids = (arr) => arr.map((f) => ({ ...f, _centroid: getGeometryCentroid(f.geometry) }));
  const roads = markCentroids(roadFeatures);
  const transits = markCentroids(transitFeatures);
  const trails = markCentroids(trailFeatures);
  const businesses = markCentroids(ruralBusinessFeatures);
  const facilities = markCentroids(facilityFeatures);

  const featureOut = [];
  let totalPopulationMatched = 0;
  let totalDwellingsMatched = 0;
  let insideSettlementPopulation = 0;
  let outsideSettlementPopulation = 0;
  let unassignedBlocks = 0;

  for (const feature of geometries) {
    const centroid = getGeometryCentroid(feature.geometry);
    if (!centroid) continue;
    const geoId = String(pickCaseInsensitive(feature.properties, ['DBUID', 'DBUID_2021', 'DBUID2021', 'UID', 'DGUID']) ?? '');
    const attr = attrById.get(geoId) ?? null;
    const rel = relById.get(geoId) ?? null;
    const pop = findPopulation(attr ?? feature.properties ?? {});
    const dwellings = findDwellings(attr ?? feature.properties ?? {});

    const muniHit = assignFeatureToPolygonByCentroid({ geometry: feature.geometry }, muniGeom, {
      getId: (m) => m.municipalityName
    });
    const municipalityName = muniHit?.polygon?.municipalityName ?? null;

    const settlementHit = settlementGeom.find((s) => containsPoint(s.geometry, centroid)) ?? null;
    const landUseHit = assignFeatureToPolygonByCentroid({ geometry: feature.geometry }, landUseFeatures, {
      getId: (lu) => String(pickCaseInsensitive(lu.properties, ['LANDUSE', 'LAND_USE', 'DESIGNATION', 'OP_DES', 'SCHED_A', 'CATEGORY', 'TYPE', 'NAME']) ?? '')
    });
    const landUseRaw = landUseHit?.id ?? '';
    const landUseCategory = mapOfficialPlanLandUseCategory(landUseRaw).category;

    const nearRoad = nearAny(centroid, roads, 0.5);
    const nearTransit = nearAny(centroid, transits, 2);
    const nearTrailOrCycling = nearAny(centroid, trails, 1);
    const nearRuralBusiness = nearAny(centroid, businesses, 5);
    const nearPublicFacility = nearAny(centroid, facilities, 5);
    const nearAgriculturalRuralLand = ['agricultural', 'rural'].includes(landUseCategory);

    const relGrey = rel ? likelyGreyRow(rel) : false;
    const isGreyByAttr = isOntarioGreyDguid(pickCaseInsensitive(attr ?? {}, ['DGUID', 'DGUID_2021'])) || likelyGreyRow(attr ?? {});
    const isGreyByGeometry = Boolean(municipalityName);
    const isGrey = isGreyByGeometry || relGrey || isGreyByAttr;
    if (!isGrey) continue;

    if (!municipalityName) unassignedBlocks += 1;
    if (settlementHit) insideSettlementPopulation += pop;
    else outsideSettlementPopulation += pop;
    totalPopulationMatched += pop;
    totalDwellingsMatched += dwellings;

    featureOut.push({
      type: 'Feature',
      properties: {
        geographyId: geoId || null,
        geographicLevel,
        population: pop,
        dwellings,
        municipalityName,
        insideSettlementBoundary: Boolean(settlementHit),
        settlementName: settlementHit?.settlementName ?? null,
        landUseCategory,
        nearRoad,
        nearTransitStop: nearTransit,
        nearTrailOrCycling,
        nearRuralBusiness,
        nearPublicFacility,
        nearRuralFoodAccessOpportunity: nearAgriculturalRuralLand
      },
      geometry: feature.geometry
    });
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    populationDistributionSource: featureOut.length > 0 ? 'censusSmallArea' : 'municipalHeuristic',
    geographicLevel,
    disseminationBlockCount: geographicLevel === 'disseminationBlock' ? featureOut.length : 0,
    disseminationAreaCount: geographicLevel === 'disseminationArea' ? featureOut.length : 0,
    totalPopulationMatched,
    totalDwellingsMatched,
    knownGreyPopulation2021: KNOWN_GREY_POPULATION_2021,
    matchDifferenceVsKnownGreyPopulation: totalPopulationMatched - KNOWN_GREY_POPULATION_2021,
    unmatchedPopulationOrBlocks: Math.max(0, KNOWN_GREY_POPULATION_2021 - totalPopulationMatched),
    populationInsideSettlementBoundaries: insideSettlementPopulation,
    populationOutsideSettlementBoundaries: outsideSettlementPopulation,
    warnings
  };

  const byMunicipality = new Map();
  for (const f of featureOut) {
    const m = f.properties.municipalityName ?? 'unassigned';
    const row = byMunicipality.get(m) ?? {
      municipalityName: m,
      population: 0,
      dwellings: 0,
      insideSettlementPopulation: 0,
      outsideSettlementPopulation: 0
    };
    row.population += n(f.properties.population);
    row.dwellings += n(f.properties.dwellings);
    if (f.properties.insideSettlementBoundary) row.insideSettlementPopulation += n(f.properties.population);
    else row.outsideSettlementPopulation += n(f.properties.population);
    byMunicipality.set(m, row);
  }

  const geoJsonOut = { type: 'FeatureCollection', features: featureOut };
  const distributionPath = path.join(produceDir, 'grey-census-population-distribution.json');
  const blocksPath = path.join(produceDir, 'grey-census-population-blocks.geojson');
  const csvPath = path.join(produceDir, 'grey-census-population-summary.csv');

  fs.writeFileSync(distributionPath, JSON.stringify({
    ...summary,
    municipalPopulation: Array.from(byMunicipality.values())
  }, null, 2));
  fs.writeFileSync(blocksPath, JSON.stringify(geoJsonOut, null, 2));
  fs.writeFileSync(csvPath, toCsv(Array.from(byMunicipality.values()), [
    'municipalityName',
    'population',
    'dwellings',
    'insideSettlementPopulation',
    'outsideSettlementPopulation'
  ]));

  return {
    summary,
    features: featureOut,
    outputPaths: { distributionPath, blocksPath, csvPath }
  };
}
