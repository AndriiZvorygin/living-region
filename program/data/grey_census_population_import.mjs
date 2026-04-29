// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { getGeometryCentroid, assignFeatureToPolygonByCentroid } from '../gis/spatial_assignment.mjs';
import { mapOfficialPlanLandUseCategory } from './grey_land_use_mapping.mjs';

export const KNOWN_GREY_POPULATION_2021 = 100905;

const GREY_MUNICIPALITY_NAME_HINTS = [
  'owen sound',
  'west grey',
  'meaford',
  'georgian bluffs',
  'grey highlands',
  'the blue mountains',
  'southgate',
  'hanover',
  'chatsworth'
];

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
  if (!filePath || !fs.existsSync(filePath)) {
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

function parseDelimited(text, delimiter = ',') {
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
    if (ch === delimiter) {
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

function readDelimitedRows(filePath, warnings, label) {
  if (!filePath || !fs.existsSync(filePath)) {
    warnings.push(`Missing ${label}: ${filePath}`);
    return [];
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const tabRows = parseDelimited(raw, '\t');
    if (tabRows.length > 0 && Object.keys(tabRows[0]).length > 1) return tabRows;
    return parseDelimited(raw, ',');
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

function findId(row, keys) {
  return String(pickCaseInsensitive(row, keys) ?? '').trim();
}

function findPopulation(row) {
  return n(pickCaseInsensitive(row, ['POP', 'POP2021', 'Population', 'C1_COUNT_TOTAL', 'TOT_POP', 'P0010001']));
}

function findDwellings(row) {
  return n(pickCaseInsensitive(row, ['DWELLINGS', 'DWELL', 'TOTAL_DWELLINGS', 'C2_COUNT_TOTAL', 'DWELLS']));
}

function isOntarioGreyDguid(dguid) {
  const s = String(dguid ?? '');
  return s.startsWith('2021A000335') || s.startsWith('2021A000535') || s.startsWith('2021S0510');
}

function isLikelyGreyRow(row) {
  const values = Object.values(row ?? {}).map((v) => normalizeName(v));
  if (values.some((v) => v.includes('grey') && !v.includes('greyhound'))) return true;
  if (values.some((v) => GREY_MUNICIPALITY_NAME_HINTS.some((m) => v.includes(m)))) return true;
  return false;
}

function guessMunicipalityNameFromRow(row) {
  const explicit = pickCaseInsensitive(row, ['MUNICIPALITY', 'MUN_NAME', 'CSDNAME', 'CSD_NAME', 'CSDNAME_ENG', 'MUNICIPAL']);
  if (explicit) return String(explicit).trim();
  const values = Object.values(row ?? {}).map((v) => String(v ?? '').trim()).filter(Boolean);
  const byHint = values.find((v) => GREY_MUNICIPALITY_NAME_HINTS.some((m) => normalizeName(v).includes(m)));
  return byHint ?? null;
}

function rowFieldDiagnostics(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return { headers: [], sampledFields: {} };
  const headers = Object.keys(rows[0]);
  const selectedHeaders = headers.filter((h) => /cd|csd|pop|dwell|dguid|db|da/i.test(h)).slice(0, 30);
  const sampledFields = {};
  for (const h of selectedHeaders) {
    sampledFields[h] = [...new Set(rows.slice(0, 100).map((r) => String(r[h] ?? '').trim()).filter(Boolean))].slice(0, 10);
  }
  return { headers: headers.slice(0, 30), sampledFields };
}

function toCsv(rows, headers) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
}

function findByPatterns(dir, patterns) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).map((f) => path.join(dir, f));
  const found = files.find((f) => {
    const nrm = normalizeName(path.basename(f));
    return patterns.every((p) => nrm.includes(p));
  });
  return found ?? null;
}

function findByPatternsWithExt(dir, patterns, extensions) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).map((f) => path.join(dir, f));
  const found = files.find((f) => {
    const base = normalizeName(path.basename(f));
    const ext = path.extname(base);
    return patterns.every((p) => base.includes(p)) && extensions.includes(ext);
  });
  return found ?? null;
}

export function discoverCensusInputFiles(options = {}) {
  const censusDir = path.resolve(options.censusDir ?? 'know/input/census/2021');
  const explicit = options.files ?? {};
  const discovered = {
    censusDir,
    geographicAttributeFile: explicit.gaf
      ?? findByPatternsWithExt(censusDir, ['geographic', 'attribute'], ['.csv', '.txt'])
      ?? findByPatternsWithExt(censusDir, ['gaf'], ['.csv', '.txt'])
      ?? findByPatternsWithExt(censusDir, ['attribute'], ['.csv', '.txt']),
    disseminationBlockBoundaryGeoJson: explicit.boundaries ?? explicit.dbBoundaries ?? findByPatterns(censusDir, ['dissemination', 'block', '.geojson']) ?? findByPatterns(censusDir, ['db', '.geojson']),
    disseminationAreaBoundaryGeoJson: explicit.daBoundaries ?? findByPatterns(censusDir, ['dissemination', 'area', '.geojson']) ?? findByPatterns(censusDir, ['da', '.geojson']),
    relationshipFile: explicit.relationship
      ?? findByPatternsWithExt(censusDir, ['relationship'], ['.csv', '.txt'])
      ?? findByPatternsWithExt(censusDir, ['dissemination', 'geographies'], ['.csv', '.txt']),
    shapefileZip: findByPatterns(censusDir, ['dissemination', 'block', '.zip']) ?? findByPatterns(censusDir, ['db', '.zip']),
    shapefileDirectory: fs.existsSync(path.join(censusDir, 'shapefiles')) ? path.join(censusDir, 'shapefiles') : null
  };
  return discovered;
}

function buildGafRows(attrRows, relById, municipalityFeatures, warnings) {
  const muniGeom = municipalityFeatures.map((f) => {
    const municipalityName = String(pickCaseInsensitive(f.properties, ['MUNICIPAL', 'MUN_NAME', 'MUNICIPALITY', 'NAME']) ?? 'unknown');
    return { ...f, municipalityName };
  });

  const rows = [];
  let totalPopulationMatched = 0;
  let totalDwellingsMatched = 0;
  let unassigned = 0;

  for (const row of attrRows) {
    const id = findId(row, ['DBUID', 'DBUID_2021', 'DBUID2021', 'UID', 'DB_UID', 'DGUID']);
    const rel = id ? relById.get(id) : null;
    const pop = findPopulation(row);
    const dwellings = findDwellings(row);
    const dguid = pickCaseInsensitive(row, ['DGUID', 'DGUID_2021']);
    const municipalityName = guessMunicipalityNameFromRow(row) ?? guessMunicipalityNameFromRow(rel);
    const cdName = String(pickCaseInsensitive(row, ['CDNAME', 'CD_NAME']) ?? pickCaseInsensitive(rel ?? {}, ['CDNAME', 'CD_NAME']) ?? '');
    const csdName = String(pickCaseInsensitive(row, ['CSDNAME', 'CSD_NAME']) ?? pickCaseInsensitive(rel ?? {}, ['CSDNAME', 'CSD_NAME']) ?? '');
    const isGrey = isOntarioGreyDguid(dguid)
      || normalizeName(cdName) === 'grey'
      || GREY_MUNICIPALITY_NAME_HINTS.some((m) => normalizeName(csdName).includes(m))
      || isLikelyGreyRow(row)
      || isLikelyGreyRow(rel);
    if (!isGrey) continue;

    const mappedMunicipality = municipalityName
      ? muniGeom.find((m) => normalizeName(m.municipalityName).includes(normalizeName(municipalityName))
        || normalizeName(municipalityName).includes(normalizeName(m.municipalityName)))
      : null;

    if (!mappedMunicipality) unassigned += 1;

    rows.push({
      type: 'Feature',
      properties: {
        geographyId: id || null,
        geographicLevel: 'gafTableOnly',
        population: pop,
        dwellings,
        municipalityName: mappedMunicipality?.municipalityName ?? municipalityName ?? null,
        insideSettlementBoundary: null,
        settlementName: null,
        landUseCategory: null,
        nearRoad: null,
        nearTransitStop: null,
        nearTrailOrCycling: null,
        nearRuralBusiness: null,
        nearPublicFacility: null,
        nearRuralFoodAccessOpportunity: null
      },
      geometry: null
    });
    totalPopulationMatched += pop;
    totalDwellingsMatched += dwellings;
  }

  if (rows.length === 0) {
    warnings.push('No Census population rows were matched. This means the raw GAF/boundary files are missing or field names did not match. Run census:download-2021 with explicit file URLs or place GAF/boundary files in know/input/census/2021.');
  }

  return { rows, totalPopulationMatched, totalDwellingsMatched, unassigned };
}

export function importGreyCensusPopulation(options = {}) {
  const censusDir = path.resolve(options.censusDir ?? 'know/input/census/2021');
  const inputGisDir = path.resolve(options.inputGisDir ?? 'know/input/gis');
  const produceDir = path.resolve(options.produceDir ?? 'know/produce');
  const files = discoverCensusInputFiles({
    censusDir,
    files: {
      gaf: options.gafPath,
      boundaries: options.boundariesPath,
      dbBoundaries: options.dbBoundariesPath,
      daBoundaries: options.daBoundariesPath,
      relationship: options.relationshipPath
    }
  });

  fs.mkdirSync(produceDir, { recursive: true });
  const warnings = [];
  const discoveredMessages = [];

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

  const attrPath = files.geographicAttributeFile;
  const blockPath = files.disseminationBlockBoundaryGeoJson;
  const daPath = files.disseminationAreaBoundaryGeoJson;
  const relPath = files.relationshipFile;

  discoveredMessages.push(`gaf: ${attrPath ?? 'missing'}`);
  discoveredMessages.push(`db boundaries: ${blockPath ?? 'missing'}`);
  discoveredMessages.push(`da boundaries: ${daPath ?? 'missing'}`);
  discoveredMessages.push(`relationship: ${relPath ?? 'missing'}`);
  if (files.shapefileZip) discoveredMessages.push(`shapefile zip detected (not auto-parsed): ${files.shapefileZip}`);
  if (files.shapefileDirectory) discoveredMessages.push(`shapefile directory detected (not auto-parsed): ${files.shapefileDirectory}`);

  if (!attrPath) warnings.push(`Missing Census attribute CSV/TXT in ${censusDir}. Add a GAF file (name containing "gaf" or "attribute").`);
  if (!blockPath && !daPath) {
    warnings.push(`No Census geometry GeoJSON found in ${censusDir}. Add DB/DA GeoJSON. If you only have SHP/ZIP, convert with ogr2ogr first.`);
    if (files.shapefileZip || files.shapefileDirectory) {
      warnings.push('Geometry conversion hint: ogr2ogr -f GeoJSON know/input/census/2021/dissemination-block-boundaries.geojson <input_shp_or_gpkg>');
    }
  }

  const attrRows = attrPath ? readDelimitedRows(attrPath, warnings, 'geographic attribute file') : [];
  const gafDiagnostics = rowFieldDiagnostics(attrRows);
  const relRows = relPath ? readDelimitedRows(relPath, warnings, 'relationship file') : [];
  const relById = new Map();
  for (const row of relRows) {
    const key = findId(row, ['DBUID', 'DBUID_2021', 'DBUID2021', 'UID', 'DBuid', 'DB_UID', 'DGUID']);
    if (key) relById.set(key, row);
  }

  const geometries = blockPath
    ? readGeoJsonFeatures(blockPath, warnings, 'dissemination block boundaries')
    : readGeoJsonFeatures(daPath, warnings, 'dissemination area boundaries');
  const geographicLevel = blockPath ? 'disseminationBlock' : (daPath ? 'disseminationArea' : 'gafTableOnly');

  const attrById = new Map();
  for (const row of attrRows) {
    const key = findId(row, ['DBUID', 'DBUID_2021', 'DBUID2021', 'UID', 'DGUID', 'DB_UID', 'DAUID', 'DAUID_2021']);
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

  let featureOut = [];
  let totalPopulationMatched = 0;
  let totalDwellingsMatched = 0;
  let insideSettlementPopulation = 0;
  let outsideSettlementPopulation = 0;
  let unassignedBlocks = 0;

  if (geometries.length > 0) {
    for (const feature of geometries) {
      const centroid = getGeometryCentroid(feature.geometry);
      if (!centroid) continue;
      const geoId = String(pickCaseInsensitive(feature.properties, ['DBUID', 'DBUID_2021', 'DBUID2021', 'UID', 'DGUID', 'DAUID']) ?? '');
      const attr = attrById.get(geoId) ?? null;
      const rel = relById.get(geoId) ?? null;
      const pop = findPopulation(attr ?? feature.properties ?? {});
      const dwellings = findDwellings(attr ?? feature.properties ?? {});

      const muniHit = assignFeatureToPolygonByCentroid({ geometry: feature.geometry }, muniGeom, {
        getId: (m) => m.municipalityName
      });
      const municipalityName = muniHit?.polygon?.municipalityName ?? guessMunicipalityNameFromRow(attr) ?? guessMunicipalityNameFromRow(rel) ?? null;

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

      const isGrey = Boolean(muniHit?.polygon)
        || isOntarioGreyDguid(pickCaseInsensitive(attr ?? feature.properties ?? {}, ['DGUID', 'DGUID_2021']))
        || normalizeName(String(pickCaseInsensitive(attr ?? {}, ['CDNAME', 'CD_NAME']) ?? '')) === 'grey'
        || GREY_MUNICIPALITY_NAME_HINTS.some((m) => normalizeName(String(pickCaseInsensitive(attr ?? {}, ['CSDNAME', 'CSD_NAME']) ?? '')).includes(m))
        || isLikelyGreyRow(attr)
        || isLikelyGreyRow(rel);
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
  } else {
    const gafOnly = buildGafRows(attrRows, relById, municipalityFeatures, warnings);
    featureOut = gafOnly.rows;
    totalPopulationMatched = gafOnly.totalPopulationMatched;
    totalDwellingsMatched = gafOnly.totalDwellingsMatched;
    unassignedBlocks = gafOnly.unassigned;
  }

  if (totalPopulationMatched <= 0) {
    warnings.push('No Census population rows were matched. This means the raw GAF/boundary files are missing or field names did not match. Run census:download-2021 with explicit file URLs or place GAF/boundary files in know/input/census/2021.');
    const diagnosticsPath = path.join(produceDir, 'grey-census-gaf-header-diagnostics.json');
    fs.writeFileSync(diagnosticsPath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      attrPath: attrPath ?? null,
      rowCount: attrRows.length,
      diagnostics: gafDiagnostics
    }, null, 2));
    warnings.push(`Wrote GAF header diagnostics: ${diagnosticsPath}`);
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
    unassignedBlocks,
    detectedFiles: discoveredMessages,
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
    if (f.properties.insideSettlementBoundary === true) row.insideSettlementPopulation += n(f.properties.population);
    if (f.properties.insideSettlementBoundary === false) row.outsideSettlementPopulation += n(f.properties.population);
    byMunicipality.set(m, row);
  }

  const geoJsonOut = { type: 'FeatureCollection', features: featureOut.filter((f) => f.geometry) };
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
    outputPaths: { distributionPath, blocksPath, csvPath },
    detectedFiles: discoveredMessages
  };
}
