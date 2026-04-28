// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { greyCountySeedNodes } from '../data/grey_county_seed_nodes.mjs';
import { extractLandUseRawValue, extractMunicipalityHint, mapOfficialPlanLandUseCategory, normalizeName } from '../data/grey_land_use_mapping.mjs';
import { assignFeatureToPolygonByCentroid } from '../gis/spatial_assignment.mjs';

function readFeatures(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing required input: ${filePath}`);
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return Array.isArray(parsed?.features) ? parsed.features : [];
}

function asCsv(rows, headers) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((row) => headers.map((h) => esc(row[h])).join(','))].join('\n');
}

function bucket(value, unknown = 'unknown') {
  const v = value === null || value === undefined || String(value).trim() === '' ? unknown : String(value).trim();
  return v;
}

function canonicalMunicipality(value) {
  return normalizeName(value)
    .replace(/^(township|town|city|municipality)\s+of\s+/, '')
    .replace(/^the\s+/, '')
    .trim();
}

function pickRoadValue(props, keys) {
  const allKeys = Object.keys(props ?? {});
  for (const key of keys) {
    const hit = allKeys.find((k) => k.toLowerCase() === key.toLowerCase());
    if (hit && props[hit] !== undefined && props[hit] !== null && String(props[hit]).trim() !== '') return props[hit];
  }
  return null;
}

function kmFromRoadFeature(feature) {
  const p = feature.properties ?? {};
  const kmDirect = Number(p.LENGTH_KM ?? p.LENGTH ?? 0);
  if (Number.isFinite(kmDirect) && kmDirect > 0 && kmDirect < 500) return kmDirect;
  const meters = Number(p.ROAD_LENGT ?? p.ShapeSTLength ?? p.Shape_STLength__ ?? 0);
  if (Number.isFinite(meters) && meters > 0) return meters / 1000;
  return 0;
}

export function buildGreyBaselineReport(options = {}) {
  const inputDir = path.resolve(options.inputDir ?? 'know/input/gis');
  const outputDir = path.resolve(options.outputDir ?? 'know/produce');
  fs.mkdirSync(outputDir, { recursive: true });

  const municipalities = readFeatures(path.join(inputDir, 'municipality-boundaries.geojson'));
  const settlements = readFeatures(path.join(inputDir, 'settlement-boundaries.geojson'));
  const landUse = readFeatures(path.join(inputDir, 'official-plan-schedule-a-land-use.geojson'));
  const roadsPath = fs.existsSync(path.join(inputDir, 'road-centrelines-grey.geojson'))
    ? path.join(inputDir, 'road-centrelines-grey.geojson')
    : path.join(inputDir, 'road-centrelines-orn.geojson');
  const roads = readFeatures(roadsPath);

  const warnings = [];
  const muniByNorm = new Map(greyCountySeedNodes.map((n) => [canonicalMunicipality(n.municipalityName), n]));
  const municipalPolygons = municipalities
    .map((feature) => {
      const p = feature.properties ?? {};
      const muniRaw = p.MUNICIPAL ?? p.MUNICIPALITY ?? p.MUN_NAME ?? p.MUNI_NAME ?? p.NAME ?? null;
      const node = muniByNorm.get(canonicalMunicipality(muniRaw));
      return node ? { ...feature, municipalityId: node.municipalityId, municipalityName: node.municipalityName } : null;
    })
    .filter(Boolean);
  const muniStats = new Map(greyCountySeedNodes.map((n) => [n.municipalityId, {
    municipalityId: n.municipalityId,
    municipalityName: n.municipalityName,
    population2021: n.population2021,
    landAreaKm2: n.landAreaKm2,
    densityPerKm2: n.densityPerKm2,
    settlementFeatureCount: 0,
    landUseFeatureCount: 0,
    roadFeatureCount: 0,
    roadKm: 0,
    pavedRoadKm: 0,
    unpavedRoadKm: 0,
    agriculturalFeatureCount: 0,
    ruralFeatureCount: 0,
    hazardFeatureCount: 0,
    wetlandFeatureCount: 0,
    settlementLandUseFeatureCount: 0,
    landUseCategoryCounts: {},
    roadClassByCount: {},
    roadJurisdictionByCount: {}
  }]));

  let settlementAssigned = 0;
  for (const f of settlements) {
    const p = f.properties ?? {};
    const muniRaw = p.MUNICIPAL ?? p.MUNICIPALITY ?? p.MUN_NAME ?? null;
    const muniNode = muniByNorm.get(canonicalMunicipality(muniRaw));
    if (!muniNode) continue;
    settlementAssigned += 1;
    muniStats.get(muniNode.municipalityId).settlementFeatureCount += 1;
  }

  let landUseAssigned = 0;
  let landUseAssignedBySource = 0;
  let landUseAssignedByGeometry = 0;
  for (const f of landUse) {
    const p = f.properties ?? {};
    const raw = extractLandUseRawValue(p);
    const category = mapOfficialPlanLandUseCategory(raw);
    const muniHint = extractMunicipalityHint(p);
    let muniNode = muniByNorm.get(canonicalMunicipality(muniHint));
    let assignedByGeometry = false;
    if (!muniNode) {
      const centroidAssign = assignFeatureToPolygonByCentroid(f, municipalPolygons);
      if (centroidAssign.matched?.municipalityId) {
        muniNode = greyCountySeedNodes.find((n) => n.municipalityId === centroidAssign.matched.municipalityId) ?? null;
        assignedByGeometry = Boolean(muniNode);
      }
    }
    if (!muniNode) continue;
    landUseAssigned += 1;
    if (assignedByGeometry) landUseAssignedByGeometry += 1;
    else landUseAssignedBySource += 1;
    const m = muniStats.get(muniNode.municipalityId);
    m.landUseFeatureCount += 1;
    m.landUseCategoryCounts[category] = (m.landUseCategoryCounts[category] ?? 0) + 1;
    if (category === 'agricultural') m.agriculturalFeatureCount += 1;
    if (category === 'rural') m.ruralFeatureCount += 1;
    if (category === 'hazard') m.hazardFeatureCount += 1;
    if (category === 'wetland') m.wetlandFeatureCount += 1;
    if (category === 'settlement' || category === 'primarySettlement' || category === 'secondarySettlement' || category === 'hamlet') m.settlementLandUseFeatureCount += 1;
  }

  let roadAssigned = 0;
  let roadAssignedBySourcePropertyCount = 0;
  let roadAssignedByGeometryCount = 0;
  const roadClassCounts = {};
  const roadJurisdictionCounts = {};
  const pavedStatusCounts = {};
  const speedLimitCounts = {};
  const laneCountCounts = {};
  const roadRollup = new Map();

  for (const f of roads) {
    const p = f.properties ?? {};
    const roadClass = bucket(pickRoadValue(p, ['ORN_ROAD_CLASS', 'ROAD_CLASS', 'CLASS', 'FUNCTIONAL_CLASS', 'TYPE']));
    const jurisdiction = bucket(pickRoadValue(p, ['JURIS_L', 'JURISDICTION', 'OWNER', 'ROAD_AUTHORITY', 'MUNICIPAL', 'COUNTY']));
    const paved = bucket(pickRoadValue(p, ['PAVED_STATUS', 'SURFACE', 'PAVEMENT']));
    const speed = bucket(pickRoadValue(p, ['SPEED_LIMI', 'SPEED_LIMIT', 'SPEED']));
    const lanes = bucket(pickRoadValue(p, ['LANE_COUNT', 'LANES']));
    const km = kmFromRoadFeature(f);

    roadClassCounts[roadClass] = (roadClassCounts[roadClass] ?? 0) + 1;
    roadJurisdictionCounts[jurisdiction] = (roadJurisdictionCounts[jurisdiction] ?? 0) + 1;
    pavedStatusCounts[paved] = (pavedStatusCounts[paved] ?? 0) + 1;
    speedLimitCounts[speed] = (speedLimitCounts[speed] ?? 0) + 1;
    laneCountCounts[lanes] = (laneCountCounts[lanes] ?? 0) + 1;

    const key = `${roadClass}||${jurisdiction}||${paved}||${speed}||${lanes}`;
    const row = roadRollup.get(key) ?? { roadClass, jurisdiction, pavedStatus: paved, speedLimit: speed, laneCount: lanes, featureCount: 0, totalKm: 0 };
    row.featureCount += 1;
    row.totalKm += km;
    roadRollup.set(key, row);

    const muniHint = pickRoadValue(p, ['MUNICIPAL', 'MUNICIPALITY', 'MUN_NAME', 'JURIS_L', 'COUNTY']);
    let muniNode = muniByNorm.get(canonicalMunicipality(muniHint));
    let assignedByGeometry = false;
    if (!muniNode) {
      const centroidAssign = assignFeatureToPolygonByCentroid(f, municipalPolygons);
      if (centroidAssign.matched?.municipalityId) {
        muniNode = greyCountySeedNodes.find((n) => n.municipalityId === centroidAssign.matched.municipalityId) ?? null;
        assignedByGeometry = Boolean(muniNode);
      }
    }
    if (!muniNode) continue;
    roadAssigned += 1;
    if (assignedByGeometry) roadAssignedByGeometryCount += 1;
    else roadAssignedBySourcePropertyCount += 1;
    const m = muniStats.get(muniNode.municipalityId);
    m.roadFeatureCount += 1;
    m.roadKm += km;
    m.roadClassByCount[roadClass] = (m.roadClassByCount[roadClass] ?? 0) + 1;
    m.roadJurisdictionByCount[jurisdiction] = (m.roadJurisdictionByCount[jurisdiction] ?? 0) + 1;
    if (/pav/i.test(paved) || /asphalt|hard/i.test(paved)) m.pavedRoadKm += km;
    if (/unpav|gravel|dirt/i.test(paved)) m.unpavedRoadKm += km;
  }

  const totalPopulation2021 = greyCountySeedNodes.reduce((s, n) => s + n.population2021, 0);
  const totalLandAreaKm2 = greyCountySeedNodes.reduce((s, n) => s + n.landAreaKm2, 0);
  const roadFeatureCount = roads.length;

  const municipalityRows = [...muniStats.values()].map((m) => {
    const topLandUseCategories = Object.entries(m.landUseCategoryCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k}:${v}`).join('|');
    const dominantRoadClasses = Object.entries(m.roadClassByCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k}:${v}`).join('|');
    const dominantRoadJurisdictions = Object.entries(m.roadJurisdictionByCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k}:${v}`).join('|');
    return {
      ...m,
      roadKmPer1000Residents: m.population2021 > 0 ? (m.roadKm / m.population2021) * 1000 : 0,
      roadKmPerKm2: m.landAreaKm2 > 0 ? m.roadKm / m.landAreaKm2 : 0,
      topLandUseCategories,
      landUseAssignedFeatureCount: m.landUseFeatureCount,
      dominantLandUseCategories: topLandUseCategories,
      dominantRoadClasses,
      dominantRoadJurisdictions
    };
  });

  const landUseAssignmentMethod = landUseAssignedBySource > 0 && landUseAssignedByGeometry > 0
    ? 'mixed'
    : landUseAssignedByGeometry > 0
      ? 'geometryCentroid'
      : landUseAssignedBySource > 0
        ? 'sourceProperty'
        : 'unassigned';
  const roadAssignmentMethod = roadAssignedBySourcePropertyCount > 0 && roadAssignedByGeometryCount > 0
    ? 'mixed'
    : roadAssignedByGeometryCount > 0
      ? 'geometryCentroid'
      : roadAssignedBySourcePropertyCount > 0
        ? 'sourceProperty'
        : 'unassigned';
  const landUseUnassignedCount = landUse.length - landUseAssigned;
  const roadUnassignedCount = roads.length - roadAssigned;
  if (landUseUnassignedCount > 0 || roadUnassignedCount > 0) {
    warnings.push('Municipality assignment incomplete; source property-based assignment used.');
  }

  const landUseCategoryCounts = {};
  const landUseRows = [];
  for (const f of landUse) {
    const p = f.properties ?? {};
    const rawDesignation = bucket(extractLandUseRawValue(p));
    const category = mapOfficialPlanLandUseCategory(rawDesignation);
    const muniHint = extractMunicipalityHint(p);
    let muni = bucket(muniHint, 'unassigned');
    if (muni === 'unassigned') {
      const centroidAssign = assignFeatureToPolygonByCentroid(f, municipalPolygons);
      muni = centroidAssign.matched?.municipalityName ?? 'unassigned';
    }
    const key = `${category}||${rawDesignation}||${muni}`;
    let row = landUseRows.find((r) => r._key === key);
    if (!row) {
      row = { _key: key, mappedLandUseCategory: category, rawDesignation, municipalityName: muni, featureCount: 0, notes: '' };
      landUseRows.push(row);
    }
    row.featureCount += 1;
    landUseCategoryCounts[category] = (landUseCategoryCounts[category] ?? 0) + 1;
  }

  const roadRows = [...roadRollup.values()];
  const regionalRoadKm = roadRows.reduce((s, r) => s + r.totalKm, 0);
  const totalRoadKm = regionalRoadKm;
  for (const row of roadRows) {
    row.shareOfRoadKm = regionalRoadKm > 0 ? row.totalKm / regionalRoadKm : 0;
    row.estimatedMaintenanceCostPerKm = 7500;
    row.estimatedAnnualMaintenanceDemand = row.totalKm * row.estimatedMaintenanceCostPerKm;
  }

  const assignmentDiagnostics = {
    landUseAssignmentMethod,
    landUseAssignedToMunicipalityCount: landUseAssigned,
    landUseUnassignedCount,
    roadAssignedBySourcePropertyCount,
    roadAssignedByGeometryCount,
    roadUnassignedCount,
    roadAssignmentMethod,
    centroidAssignmentWarning: landUseAssignedByGeometry > 0 || roadAssignedByGeometryCount > 0
      ? 'Centroid-based assignment used for some features; this is not full geometry overlay.'
      : null
  };

  const summary = {
    totalPopulation2021,
    totalLandAreaKm2,
    totalRoadKm,
    roadFeatureCount,
    roadKmPer1000Residents: totalPopulation2021 > 0 ? (totalRoadKm / totalPopulation2021) * 1000 : 0,
    roadKmPerKm2: totalLandAreaKm2 > 0 ? totalRoadKm / totalLandAreaKm2 : 0,
    settlementBoundaryCount: settlements.length,
    landUseFeatureCount: landUse.length,
    landUseCategoryCounts,
    roadClassCounts,
    roadJurisdictionCounts,
    pavedStatusCounts,
    speedLimitCounts,
    laneCountCounts,
    warnings,
    assignmentCompleteness: assignmentDiagnostics,
    assignmentDiagnostics
  };

  const municipalityCsvPath = path.join(outputDir, 'grey-baseline-municipality-summary.csv');
  fs.writeFileSync(municipalityCsvPath, asCsv(municipalityRows, [
    'municipalityId','municipalityName','population2021','landAreaKm2','densityPerKm2','settlementFeatureCount','landUseFeatureCount','landUseAssignedFeatureCount','roadFeatureCount','roadKm','roadKmPer1000Residents','roadKmPerKm2','pavedRoadKm','unpavedRoadKm','topLandUseCategories','dominantLandUseCategories','agriculturalFeatureCount','ruralFeatureCount','hazardFeatureCount','wetlandFeatureCount','settlementLandUseFeatureCount','dominantRoadClasses','dominantRoadJurisdictions'
  ]));

  const roadsCsvPath = path.join(outputDir, 'grey-baseline-roads-summary.csv');
  fs.writeFileSync(roadsCsvPath, asCsv(roadRows, [
    'roadClass','jurisdiction','pavedStatus','speedLimit','laneCount','featureCount','totalKm','shareOfRoadKm','estimatedMaintenanceCostPerKm','estimatedAnnualMaintenanceDemand'
  ]));

  const landUseCsvPath = path.join(outputDir, 'grey-baseline-land-use-summary.csv');
  fs.writeFileSync(landUseCsvPath, asCsv(landUseRows.map((r) => ({ ...r, notes: r.municipalityName === 'unassigned' ? 'municipality assignment incomplete' : '' })), [
    'mappedLandUseCategory','rawDesignation','featureCount','municipalityName','notes'
  ]));

  const summaryPath = path.join(outputDir, 'grey-baseline-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  return {
    summary,
    paths: { municipalityCsvPath, roadsCsvPath, landUseCsvPath, summaryPath }
  };
}
