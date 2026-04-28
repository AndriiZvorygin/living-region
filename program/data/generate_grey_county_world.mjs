// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { createWorld } from '../model/world.mjs';
import { createPatch } from '../model/patch.mjs';
import { createPlantGroup } from '../model/plant_group.mjs';
import { createHousehold } from '../model/household.mjs';
import { createBuilding } from '../model/building.mjs';
import { createInfrastructure } from '../model/infrastructure.mjs';
import { createSettlement } from '../model/settlement.mjs';
import { createNetwork } from '../model/network.mjs';
import { createMarket } from '../model/market.mjs';
import { greyCountySeedNodes } from './grey_county_seed_nodes.mjs';
import { validateGreyCountySeedTotals } from './grey_county_census_summary.mjs';
import {
  normalizeName,
  extractMunicipalityName,
  extractSettlementFields,
  extractLandUseRawValue,
  extractMunicipalityHint,
  mapOfficialPlanLandUseCategory
} from './grey_land_use_mapping.mjs';

const SCALE_PRESETS = {
  tiny: { populationScaleMultiplier: 0.005, areaScaleMultiplier: 0.005 },
  small: { populationScaleMultiplier: 0.02, areaScaleMultiplier: 0.02 },
  medium: { populationScaleMultiplier: 0.1, areaScaleMultiplier: 0.1 },
  'county-lite': { populationScaleMultiplier: 0.5, areaScaleMultiplier: 0.5 },
  'full-county': { populationScaleMultiplier: 1, areaScaleMultiplier: 1 }
};

const SCALE_ALIASES = {
  full: 'full-county',
  countyLite: 'county-lite',
  countylite: 'county-lite'
};

const BASE_PATCH_SHARES = {
  settlementCore: 0.015,
  olderResidential: 0.025,
  edgeResidential: 0.035,
  marketGardenBelt: 0.05,
  croplandCatchment: 0.36,
  pastureCatchment: 0.2,
  orchardNutBelt: 0.08,
  woodlotCatchment: 0.17,
  wetlandMarginal: 0.065
};

const ROAD_LINKS = [
  ['owen-sound', 'georgian-bluffs'],
  ['owen-sound', 'chatsworth'],
  ['chatsworth', 'grey-highlands'],
  ['grey-highlands', 'southgate'],
  ['grey-highlands', 'meaford'],
  ['meaford', 'blue-mountains'],
  ['owen-sound', 'meaford'],
  ['chatsworth', 'west-grey'],
  ['west-grey', 'hanover'],
  ['west-grey', 'grey-highlands']
];

const OPTIONAL_ROAD_LINKS = [
  ['southgate', 'west-grey'],
  ['blue-mountains', 'southgate']
];

const RAIL_LINKS = [
  ['owen-sound', 'meaford'],
  ['meaford', 'blue-mountains'],
  ['owen-sound', 'chatsworth'],
  ['chatsworth', 'grey-highlands'],
  ['grey-highlands', 'southgate']
];

const WATER_LINKS = [
  ['owen-sound', 'meaford'],
  ['meaford', 'blue-mountains']
];

const RAIL_STATION_MUNICIPALITIES = new Set(['owen-sound', 'meaford', 'blue-mountains', 'chatsworth', 'grey-highlands', 'southgate']);
const ORCHARD_MUNICIPALITIES = new Set(['blue-mountains', 'meaford', 'grey-highlands', 'southgate']);
const HIGH_DENSITY_MUNICIPALITIES = new Set(['owen-sound', 'hanover']);

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function haversineKm(latA, lonA, latB, lonB) {
  const earthRadiusKm = 6_371;
  const dLat = toRadians(latB - latA);
  const dLon = toRadians(lonB - lonA);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(latA)) * Math.cos(toRadians(latB)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function geometryLengthKm(geometry) {
  if (!geometry?.type) return 0;
  const lines = geometry.type === 'LineString'
    ? [geometry.coordinates]
    : geometry.type === 'MultiLineString'
      ? geometry.coordinates
      : [];
  let length = 0;
  for (const line of lines) {
    for (let i = 1; i < (line?.length ?? 0); i += 1) {
      const [lonA, latA] = line[i - 1];
      const [lonB, latB] = line[i];
      if ([lonA, latA, lonB, latB].every((v) => Number.isFinite(v))) {
        length += haversineKm(latA, lonA, latB, lonB);
      }
    }
  }
  return length;
}

function kmToLatDeg(km) {
  return km / 111;
}

function kmToLonDeg(km, lat) {
  const cosLat = Math.max(0.2, Math.cos(toRadians(lat)));
  return km / (111 * cosLat);
}

function makeSquarePolygon(lat, lon, areaHa, offsetKmX, offsetKmY) {
  const areaKm2 = Math.max(0.0001, areaHa / 100);
  const sideKm = Math.sqrt(areaKm2);
  const halfLatDeg = kmToLatDeg(sideKm / 2);
  const halfLonDeg = kmToLonDeg(sideKm / 2, lat);
  const centerLat = lat + kmToLatDeg(offsetKmY);
  const centerLon = lon + kmToLonDeg(offsetKmX, lat);

  return {
    type: 'Polygon',
    coordinates: [[
      [centerLon - halfLonDeg, centerLat - halfLatDeg],
      [centerLon + halfLonDeg, centerLat - halfLatDeg],
      [centerLon + halfLonDeg, centerLat + halfLatDeg],
      [centerLon - halfLonDeg, centerLat + halfLatDeg],
      [centerLon - halfLonDeg, centerLat - halfLatDeg]
    ]]
  };
}

function normalizeScale(scale) {
  const key = SCALE_ALIASES[scale] ?? scale;
  return SCALE_PRESETS[key] ? key : 'small';
}

function defaultVacancyTarget(node) {
  if (node.municipalityId === 'blue-mountains') {
    return 1.25;
  }
  if (HIGH_DENSITY_MUNICIPALITIES.has(node.municipalityId)) {
    return 1.06;
  }
  if (node.municipalityType === 'township') {
    return 1.14;
  }
  return 1.1;
}

function municipalityBaseRentPerMonth(node) {
  const map = {
    'owen-sound': 1_300,
    hanover: 1_200,
    'blue-mountains': 1_600,
    meaford: 1_300,
    'georgian-bluffs': 1_200,
    'west-grey': 1_100,
    'grey-highlands': 1_100,
    southgate: 1_100,
    chatsworth: 1_050
  };
  return map[node.municipalityId] ?? 1_150;
}

function densityAdjustedShares(node) {
  const densityNorm = Math.max(0, Math.min(1, node.densityPerKm2 / 900));
  const shares = { ...BASE_PATCH_SHARES };

  const urbanBoost = densityNorm * 0.12;
  shares.settlementCore += urbanBoost * 0.32;
  shares.olderResidential += urbanBoost * 0.33;
  shares.edgeResidential += urbanBoost * 0.35;

  const ruralReduce = urbanBoost;
  shares.croplandCatchment -= ruralReduce * 0.35;
  shares.pastureCatchment -= ruralReduce * 0.24;
  shares.woodlotCatchment -= ruralReduce * 0.24;
  shares.wetlandMarginal -= ruralReduce * 0.17;

  if (ORCHARD_MUNICIPALITIES.has(node.municipalityId)) {
    shares.orchardNutBelt += 0.03;
    shares.croplandCatchment -= 0.02;
    shares.pastureCatchment -= 0.01;
  }

  if (node.municipalityId === 'blue-mountains') {
    shares.edgeResidential += 0.02;
    shares.settlementCore += 0.01;
    shares.woodlotCatchment -= 0.015;
    shares.pastureCatchment -= 0.015;
  }

  if (HIGH_DENSITY_MUNICIPALITIES.has(node.municipalityId)) {
    shares.settlementCore += 0.03;
    shares.olderResidential += 0.03;
    shares.croplandCatchment -= 0.025;
    shares.pastureCatchment -= 0.02;
    shares.woodlotCatchment -= 0.015;
  }

  const positiveEntries = Object.entries(shares).map(([key, value]) => [key, Math.max(0.005, value)]);
  const total = positiveEntries.reduce((sum, [, value]) => sum + value, 0);

  return Object.fromEntries(positiveEntries.map(([key, value]) => [key, value / total]));
}

function patchOffsets() {
  return {
    settlementCore: [0, 0],
    olderResidential: [1.1, 0.1],
    edgeResidential: [2, -0.35],
    marketGardenBelt: [1.45, 1.4],
    croplandCatchment: [3.2, 1.8],
    pastureCatchment: [3.2, -1.9],
    orchardNutBelt: [2.5, 2.7],
    woodlotCatchment: [-2.7, 1.7],
    wetlandMarginal: [-3.1, -1.8]
  };
}

function patchLandUse(patchType) {
  if (patchType.includes('Residential')) {
    return 'residential';
  }
  if (patchType === 'settlementCore') {
    return 'mixed';
  }
  if (patchType === 'pastureCatchment') {
    return 'pasture';
  }
  if (patchType === 'woodlotCatchment') {
    return 'woodland';
  }
  if (patchType === 'wetlandMarginal') {
    return 'wetland';
  }
  return 'cropland';
}

function patchZoning(landUse) {
  if (landUse === 'residential') {
    return 'residential';
  }
  if (landUse === 'mixed') {
    return 'mixedUse';
  }
  if (landUse === 'wetland') {
    return 'ecology';
  }
  return 'agriculture';
}

function generateMunicipalityTargets(nodes, options) {
  const scaleKey = normalizeScale(options.scale ?? 'small');
  const preset = SCALE_PRESETS[scaleKey];
  const keepFullLandArea = options.keepFullLandArea ?? false;

  const populationScaleMultiplier = options.populationScaleMultiplier ?? preset.populationScaleMultiplier;
  const areaScaleMultiplier = options.areaScaleMultiplier ?? (keepFullLandArea ? 1 : preset.areaScaleMultiplier);

  const targets = nodes.map((node) => {
    const scaledPopulation = Math.round(node.population2021 * populationScaleMultiplier);
    const scaledAreaHa = node.landAreaKm2 * 100 * areaScaleMultiplier;
    const averageHouseholdSize = node.averageHouseholdSizeEstimate ?? (HIGH_DENSITY_MUNICIPALITIES.has(node.municipalityId) ? 2.35 : 2.45);
    const generatedHouseholds = Math.max(1, Math.round(scaledPopulation / averageHouseholdSize));
    const vacancyTarget = defaultVacancyTarget(node);
    const generatedDwellingUnits = Math.max(1, Math.ceil(generatedHouseholds * vacancyTarget));
    const generatedVacantUnits = Math.max(0, generatedDwellingUnits - generatedHouseholds);
    const generatedVacancyRate = generatedDwellingUnits > 0
      ? generatedVacantUnits / generatedDwellingUnits
      : 0;

    return {
      municipalityId: node.municipalityId,
      scaledPopulation,
      scaledAreaHa,
      generatedHouseholds,
      generatedDwellingUnits,
      generatedVacantUnits,
      generatedVacancyRate,
      averageHouseholdSize,
      vacancyTarget
    };
  });

  const expectedScaledPopulation = nodes.reduce((sum, node) => sum + node.population2021 * populationScaleMultiplier, 0);
  const expectedScaledAreaHa = nodes.reduce((sum, node) => sum + node.landAreaKm2 * 100 * areaScaleMultiplier, 0);
  const syntheticPopulation = targets.reduce((sum, target) => sum + target.scaledPopulation, 0);
  const syntheticAreaHa = targets.reduce((sum, target) => sum + target.scaledAreaHa, 0);

  return {
    scaleKey,
    populationScaleMultiplier,
    areaScaleMultiplier,
    keepFullLandArea,
    targets,
    expectedScaledPopulation,
    expectedScaledAreaHa,
    syntheticPopulation,
    syntheticAreaHa,
    populationScaleError: syntheticPopulation - expectedScaledPopulation,
    areaScaleError: syntheticAreaHa - expectedScaledAreaHa
  };
}

function makePatchId(municipalityId, patchType) {
  return `patch-${municipalityId}-${patchType}`;
}

function makeBuildingId(municipalityId, key) {
  return `building-${municipalityId}-${key}`;
}

function makeInfrastructureId(municipalityId, key) {
  return `infra-${municipalityId}-${key}`;
}

function buildRoadSegments(nodesByMunicipalityId, includeOptionalLinks, roadWiggleFactor = 1.2) {
  const links = [...ROAD_LINKS, ...(includeOptionalLinks ? OPTIONAL_ROAD_LINKS : [])];
  return links.map(([fromId, toId]) => {
    const from = nodesByMunicipalityId.get(fromId);
    const to = nodesByMunicipalityId.get(toId);
    const km = haversineKm(from.lat, from.lon, to.lat, to.lon) * roadWiggleFactor;
    const arterial = HIGH_DENSITY_MUNICIPALITIES.has(fromId)
      || HIGH_DENSITY_MUNICIPALITIES.has(toId)
      || from.role.includes('ServiceCentre')
      || to.role.includes('ServiceCentre');

    return {
      id: `road-${fromId}-${toId}`,
      type: arterial ? 'arterialRoad' : 'collectorRoad',
      lengthKm: km,
      condition: arterial ? 0.74 : 0.72,
      capacityPassengerKmPerYear: arterial ? 2_400_000 : 1_100_000,
      capacityTonneKmPerYear: arterial ? 1_350_000 : 680_000,
      maintenanceCostPerKmPerYear: arterial ? 9_600 : 6_400,
      maintenanceLabourDaysPerKmPerYear: arterial ? 12 : 9,
      maintenanceMaterialsKgPerKmPerYear: arterial ? 720 : 520,
      capitalRenewalCostPerKm: arterial ? 118_000 : 92_000,
      bridgeOrCulvertFactor: 1.12,
      winterMaintenanceFactor: 1.24,
      climateStressFactor: 1.2,
      rightOfWayStatus: 'active',
      electrified: false,
      electricTractionAvailable: false,
      dieselTractionAvailable: true,
      maxSpeedKmh: arterial ? 80 : 65,
      stopsOrSidings: 0,
      connectsSettlementIds: [fromId, toId],
      notes: 'Synthetic road link generated from settlement service-node anchors.'
    };
  });
}

function buildRailSegments(nodesByMunicipalityId) {
  return RAIL_LINKS.map(([fromId, toId]) => {
    const from = nodesByMunicipalityId.get(fromId);
    const to = nodesByMunicipalityId.get(toId);
    const km = haversineKm(from.lat, from.lon, to.lat, to.lon) * 1.08;

    return {
      id: `rail-${fromId}-${toId}`,
      type: 'traditionalRail',
      lengthKm: km,
      condition: 0.66,
      capacityPassengerKmPerYear: 2_900_000,
      capacityTonneKmPerYear: 4_600_000,
      maintenanceCostPerKmPerYear: 13_800,
      maintenanceLabourDaysPerKmPerYear: 14,
      maintenanceMaterialsKgPerKmPerYear: 940,
      capitalRenewalCostPerKm: 172_000,
      bridgeOrCulvertFactor: 1.08,
      winterMaintenanceFactor: 1.14,
      climateStressFactor: 1.15,
      rightOfWayStatus: 'protected',
      electrified: false,
      electricTractionAvailable: false,
      dieselTractionAvailable: true,
      maxSpeedKmh: 90,
      stopsOrSidings: 2,
      connectsSettlementIds: [fromId, toId],
      notes: 'Synthetic corridor for scenario testing; replace with actual rail ROW data before public claims.'
    };
  });
}

function buildWaterSegments(nodesByMunicipalityId) {
  return WATER_LINKS.map(([fromId, toId]) => {
    const from = nodesByMunicipalityId.get(fromId);
    const to = nodesByMunicipalityId.get(toId);
    const km = haversineKm(from.lat, from.lon, to.lat, to.lon) * 1.05;

    return {
      id: `water-${fromId}-${toId}`,
      type: 'waterRoute',
      lengthKm: km,
      condition: 0.72,
      capacityPassengerKmPerYear: 480_000,
      capacityTonneKmPerYear: 1_800_000,
      maintenanceCostPerKmPerYear: 4_900,
      maintenanceLabourDaysPerKmPerYear: 6,
      maintenanceMaterialsKgPerKmPerYear: 330,
      capitalRenewalCostPerKm: 62_000,
      bridgeOrCulvertFactor: 1,
      winterMaintenanceFactor: 1.06,
      climateStressFactor: 1.08,
      rightOfWayStatus: 'active',
      electrified: false,
      electricTractionAvailable: false,
      dieselTractionAvailable: true,
      maxSpeedKmh: 40,
      stopsOrSidings: 1,
      connectsSettlementIds: [fromId, toId],
      notes: 'Synthetic near-shore freight corridor for resilience testing.'
    };
  });
}

function generateMunicipalityPatchAreas(node, targetAreaHa) {
  const shares = densityAdjustedShares(node);
  const areas = {};
  for (const [patchType, share] of Object.entries(shares)) {
    areas[patchType] = targetAreaHa * share;
  }
  return areas;
}

function buildPlantGroups(node, patchAreas) {
  const groups = [];
  const pushGroup = (key, patchType, functionalType, areaShare, ageYears, traits) => {
    groups.push(createPlantGroup({
      id: `plant-${node.municipalityId}-${key}`,
      patchId: makePatchId(node.municipalityId, patchType),
      name: `${node.nodeName} ${key.replace(/-/g, ' ')}`,
      functionalType,
      areaShare,
      ageYears,
      traits
    }));
  };

  pushGroup('market-gardens', 'marketGardenBelt', 'market-garden', 0.86, 1, {
    maturityYears: 1,
    labour: { annualCareDaysPerHa: 30, harvestDaysPerTonne: 1.8 },
    yields: { caloriesPerHaAtMaturity: 2_600_000, biomassKgPerHaAtMaturity: 10_000, woodKgPerHaAtMaturity: 0 }
  });

  pushGroup('annual-grain', 'croplandCatchment', 'annual-crop', 0.56, 1, {
    maturityYears: 1,
    labour: { annualCareDaysPerHa: 13, harvestDaysPerTonne: 0.72 },
    yields: { caloriesPerHaAtMaturity: 2_250_000, biomassKgPerHaAtMaturity: 8_700, woodKgPerHaAtMaturity: 0 }
  });

  pushGroup('root-crops', 'croplandCatchment', 'annual-crop', 0.3, 1, {
    maturityYears: 1,
    labour: { annualCareDaysPerHa: 21, harvestDaysPerTonne: 1.2 },
    yields: { caloriesPerHaAtMaturity: 2_900_000, biomassKgPerHaAtMaturity: 11_600, woodKgPerHaAtMaturity: 0 }
  });

  pushGroup('pasture-clover', 'pastureCatchment', 'grassland', 0.83, 3, {
    perennial: true,
    maturityYears: 2,
    labour: { annualCareDaysPerHa: 7, harvestDaysPerTonne: 0.35 },
    yields: { caloriesPerHaAtMaturity: 820_000, biomassKgPerHaAtMaturity: 5_400, woodKgPerHaAtMaturity: 0 }
  });

  pushGroup('woodlot-coppice', 'woodlotCatchment', 'forest', 0.9, 9, {
    perennial: true,
    maturityYears: 8,
    labour: { annualCareDaysPerHa: 3, harvestDaysPerTonne: 0.26 },
    yields: { caloriesPerHaAtMaturity: 250_000, biomassKgPerHaAtMaturity: 4_000, woodKgPerHaAtMaturity: 6_400 }
  });

  if (ORCHARD_MUNICIPALITIES.has(node.municipalityId) && patchAreas.orchardNutBelt > 0) {
    pushGroup('orchard-nut', 'orchardNutBelt', 'orchard', 0.76, 6, {
      perennial: true,
      maturityYears: 5,
      labour: { annualCareDaysPerHa: 14, harvestDaysPerTonne: 1.35 },
      yields: { caloriesPerHaAtMaturity: 1_900_000, biomassKgPerHaAtMaturity: 7_300, woodKgPerHaAtMaturity: 900 }
    });
  }

  return groups;
}

function createMunicipalSummaryCsv(summaryRows) {
  const headers = [
    'municipalityId',
    'municipalityName',
    'nodeName',
    'population2021',
    'landAreaKm2',
    'densityPerKm2',
    'scaledPopulation',
    'scaledAreaHa',
    'generatedHouseholds',
    'generatedDwellingUnits',
    'generatedVacancyRate',
    'settlementPatchAreaHa',
    'croplandPatchAreaHa',
    'pasturePatchAreaHa',
    'woodlotPatchAreaHa',
    'roadKm',
    'railKm'
  ];

  const lines = [headers.join(',')];
  for (const row of summaryRows) {
    lines.push([
      row.municipalityId,
      row.municipalityName,
      row.nodeName,
      row.population2021,
      row.landAreaKm2,
      row.densityPerKm2,
      row.scaledPopulation,
      row.scaledAreaHa,
      row.generatedHouseholds,
      row.generatedDwellingUnits,
      Number(row.generatedVacancyRate.toFixed(4)),
      Number(row.settlementPatchAreaHa.toFixed(2)),
      Number(row.croplandPatchAreaHa.toFixed(2)),
      Number(row.pasturePatchAreaHa.toFixed(2)),
      Number(row.woodlotPatchAreaHa.toFixed(2)),
      Number(row.roadKm.toFixed(2)),
      Number(row.railKm.toFixed(2))
    ].join(','));
  }

  return lines.join('\n');
}

function classifyLandAccess(node, index, patchAreas) {
  const isUrbanCore = node.urbanShare > 0.72;
  const isTownship = node.municipalityType === 'township';
  const cycle = index % 10;

  if (isUrbanCore) {
    if (cycle < 6) {
      return { type: 'none', ha: 0, gardenM2: 40 + cycle * 8 };
    }
    if (cycle < 9) {
      return { type: 'garden', ha: 0.015 + cycle * 0.001, gardenM2: 120 + cycle * 20 };
    }
    return { type: 'allotment', ha: 0.03, gardenM2: 300 };
  }

  if (isTownship) {
    if (cycle < 4) {
      return { type: 'farm', ha: Math.max(0.4, patchAreas.croplandCatchment * 0.0008), gardenM2: 600 };
    }
    if (cycle < 7) {
      return { type: 'common', ha: Math.max(0.15, patchAreas.pastureCatchment * 0.0004), gardenM2: 380 };
    }
    if (cycle < 9) {
      return { type: 'garden', ha: 0.06, gardenM2: 480 };
    }
    return { type: 'cooperative', ha: 0.12, gardenM2: 420 };
  }

  if (cycle < 4) {
    return { type: 'garden', ha: 0.05, gardenM2: 460 };
  }
  if (cycle < 7) {
    return { type: 'farm', ha: Math.max(0.18, patchAreas.marketGardenBelt * 0.0009), gardenM2: 520 };
  }
  if (cycle < 9) {
    return { type: 'cooperative', ha: 0.1, gardenM2: 350 };
  }
  return { type: 'none', ha: 0, gardenM2: 60 };
}

function classifyHouseholdContext(node, index, landAccessType) {
  const cycle = index % 10;
  const highDensity = node.municipalityId === 'owen-sound' || node.municipalityId === 'hanover';
  if (highDensity && cycle < 6) {
    return 'urbanCore';
  }
  if (['meaford', 'blue-mountains', 'west-grey', 'grey-highlands', 'southgate'].includes(node.municipalityId) && cycle < 4) {
    return 'townCore';
  }
  if (['georgian-bluffs', 'chatsworth'].includes(node.municipalityId) && cycle < 4) {
    return 'villageCore';
  }
  if (landAccessType === 'farm') {
    return 'farmstead';
  }
  if (landAccessType === 'common' || landAccessType === 'cooperative') {
    return 'common/cooperative';
  }
  if (landAccessType === 'none') {
    return 'settlementEdge';
  }
  return 'ruralResidential';
}

function safeReadGeoJsonFeatures(filePath, warnings, label) {
  try {
    if (!fs.existsSync(filePath)) {
      warnings.push(`open-data geometry missing: ${label} (${filePath})`);
      return [];
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed?.features) ? parsed.features : [];
  } catch (error) {
    warnings.push(`open-data geometry read failed: ${label} (${error.message})`);
    return [];
  }
}

function mapMunicipalityCodeHintToId(value) {
  const code = String(value ?? '').trim().toUpperCase();
  const map = {
    WG: 'west-grey',
    BM: 'blue-mountains',
    GH: 'grey-highlands',
    SG: 'southgate',
    GB: 'georgian-bluffs',
    MF: 'meaford',
    CS: 'chatsworth',
    OS: 'owen-sound',
    HAN: 'hanover'
  };
  return map[code] ?? null;
}

function canonicalMunicipalityName(value) {
  return normalizeName(value)
    .replace(/^(township|town|city|municipality)\s+of\s+/, '')
    .replace(/^the\s+/, '')
    .trim();
}

function loadGreyOpenDataGeometry(inputDir, nodesByMunicipalityId) {
  const warnings = [];
  const municipalitiesPath = path.join(inputDir, 'municipality-boundaries.geojson');
  const settlementsPath = path.join(inputDir, 'settlement-boundaries.geojson');
  const landUsePath = path.join(inputDir, 'official-plan-schedule-a-land-use.geojson');

  const municipalityFeatures = safeReadGeoJsonFeatures(municipalitiesPath, warnings, 'municipality-boundaries');
  const settlementFeatures = safeReadGeoJsonFeatures(settlementsPath, warnings, 'settlement-boundaries');
  const landUseFeatures = safeReadGeoJsonFeatures(landUsePath, warnings, 'official-plan-schedule-a-land-use');

  const municipalityById = new Map();
  const municipalityWarnings = [];
  for (const feature of municipalityFeatures) {
    const properties = feature?.properties ?? {};
    const municipalityName = extractMunicipalityName(properties);
    const normalized = canonicalMunicipalityName(municipalityName);
    const node = [...nodesByMunicipalityId.values()]
      .find((candidate) => canonicalMunicipalityName(candidate.municipalityName) === normalized);
    if (!node) {
      municipalityWarnings.push(`unmatched municipality feature: ${municipalityName ?? 'unknown'}`);
      continue;
    }
    municipalityById.set(node.municipalityId, {
      municipalityId: node.municipalityId,
      municipalityName: node.municipalityName,
      geometry: feature.geometry ?? null,
      sourceProperties: properties
    });
  }

  const settlementByMunicipalityId = new Map();
  const mappedSettlements = settlementFeatures.map((feature, index) => {
    const properties = feature?.properties ?? {};
    const extracted = extractSettlementFields(properties);
    const municipalityHint = extracted.municipalityName;
    const municipalityId = mapMunicipalityCodeHintToId(municipalityHint)
      ?? [...nodesByMunicipalityId.values()].find((candidate) => normalizeName(candidate.municipalityName) === normalizeName(municipalityHint))?.municipalityId
      ?? null;
    const mapped = {
      id: `open-settlement-${index + 1}`,
      municipalityId,
      settlementName: extracted.settlementName ?? `Settlement ${index + 1}`,
      settlementType: extracted.settlementType,
      settlementTypeRaw: extracted.settlementTypeRaw,
      geometry: feature.geometry ?? null,
      sourceProperties: properties
    };
    if (municipalityId) {
      const list = settlementByMunicipalityId.get(municipalityId) ?? [];
      list.push(mapped);
      settlementByMunicipalityId.set(municipalityId, list);
    }
    return mapped;
  });

  const landUseCategoryCounts = {};
  let unclassifiedLandUseCount = 0;
  let unassignedMunicipalityLandUseCount = 0;
  const mappedLandUse = landUseFeatures.map((feature, index) => {
    const properties = feature?.properties ?? {};
    const rawLandUse = extractLandUseRawValue(properties);
    const category = mapOfficialPlanLandUseCategory(rawLandUse);
    if (category === 'unknown') unclassifiedLandUseCount += 1;
    landUseCategoryCounts[category] = (landUseCategoryCounts[category] ?? 0) + 1;
    const municipalityHint = extractMunicipalityHint(properties);
    const municipalityId = mapMunicipalityCodeHintToId(municipalityHint)
      ?? [...nodesByMunicipalityId.values()].find((candidate) => normalizeName(candidate.municipalityName) === normalizeName(municipalityHint))?.municipalityId
      ?? null;
    if (!municipalityId) unassignedMunicipalityLandUseCount += 1;
    return {
      id: `open-landuse-${index + 1}`,
      municipalityId,
      rawLandUse: rawLandUse === null || rawLandUse === undefined ? null : String(rawLandUse),
      category,
      geometry: feature.geometry ?? null,
      sourceProperties: properties
    };
  });

  warnings.push(...municipalityWarnings);

  return {
    municipalityFeatures,
    settlementFeatures: mappedSettlements,
    landUseFeatures: mappedLandUse,
    municipalityById,
    settlementByMunicipalityId,
    warnings,
    metrics: {
      realLandUseFeatureCount: mappedLandUse.length,
      landUseCategoryCounts,
      unclassifiedLandUseCount,
      unassignedMunicipalityLandUseCount
    }
  };
}

function loadGreyRoads(inputDir, warnings) {
  const roadsPath = path.join(inputDir, 'road-centrelines-grey.geojson');
  if (!fs.existsSync(roadsPath)) {
    warnings.push(`open-data roads missing: ${roadsPath}`);
    return { features: [], roadSource: 'synthetic' };
  }
  const parsed = JSON.parse(fs.readFileSync(roadsPath, 'utf8'));
  const features = Array.isArray(parsed?.features) ? parsed.features : [];
  return { features, roadSource: 'grey-open-data' };
}

function loadSecondaryLayerCounts(inputDir) {
  const sourceIds = [
    'grey-transit-bus-stops',
    'grey-transit-routes',
    'official-road-cycling-routes',
    'county-trails',
    'cp-rail-trail',
    'hiking-trails',
    'tom-thomson-trail',
    'managed-forest-boundary',
    'hazardous-forest-types-wildfire',
    'on-farm-rural-business-listing',
    'public-facilities',
    'community-facilities',
    'libraries',
    'arenas-community-centres',
    'works-yards-depots',
    'emergency-services',
    'bridges-culverts-structures',
    'road-projects-construction-resurfacing'
  ];
  const counts = {};
  for (const id of sourceIds) {
    const filePath = path.join(inputDir, `${id}.geojson`);
    if (!fs.existsSync(filePath)) {
      counts[id] = 0;
      continue;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      counts[id] = Array.isArray(parsed?.features) ? parsed.features.length : 0;
    } catch {
      counts[id] = 0;
    }
  }
  return counts;
}

export function generateGreyCountyWorld(options = {}) {
  const includeRail = options.includeRail ?? false;
  const includeWaterFreight = options.includeWaterFreight ?? false;
  const includeSyntheticPolygons = options.includeSyntheticPolygons ?? true;
  const seedName = options.seedName ?? 'grey-county-seed-census-scaled';
  const baseYear = options.baseYear ?? 2026;
  const roadWiggleFactor = options.roadWiggleFactor ?? 1.2;
  const useOpenDataGeometry = options.useOpenDataGeometry ?? false;
  const useOpenDataRoads = options.useOpenDataRoads ?? useOpenDataGeometry;
  const openDataInputDir = path.resolve(options.openDataInputDir ?? 'know/input/gis');

  const seedValidation = validateGreyCountySeedTotals(greyCountySeedNodes);
  if (!seedValidation.valid) {
    throw new Error(`Grey County seed nodes failed census validation: ${seedValidation.errors.map((error) => error.message).join('; ')}`);
  }

  const nodes = greyCountySeedNodes.map((node) => ({ ...node }));
  const nodesByMunicipalityId = new Map(nodes.map((node) => [node.municipalityId, node]));
  const openDataGeometry = useOpenDataGeometry
    ? loadGreyOpenDataGeometry(openDataInputDir, nodesByMunicipalityId)
    : null;
  const roadWarnings = [];
  const openDataRoads = useOpenDataRoads ? loadGreyRoads(openDataInputDir, roadWarnings) : { features: [], roadSource: 'synthetic' };
  const secondaryCounts = useOpenDataGeometry ? loadSecondaryLayerCounts(openDataInputDir) : {};

  const scaling = generateMunicipalityTargets(nodes, options);
  const targetByMunicipalityId = new Map(scaling.targets.map((target) => [target.municipalityId, target]));

  const patchOffsetByType = patchOffsets();

  const patches = [];
  const buildings = [];
  const infrastructures = [];
  const households = [];
  const plantGroups = [];
  const settlements = [];
  const markets = [];

  const municipalitySummaryRows = [];

  for (const node of nodes) {
    const target = targetByMunicipalityId.get(node.municipalityId);
    const patchAreas = generateMunicipalityPatchAreas(node, target.scaledAreaHa);
    const settlementId = node.municipalityId;

    const municipalityPatchIds = [];
    for (const [patchType, areaHa] of Object.entries(patchAreas)) {
      const landUse = patchLandUse(patchType);
      const [offsetX, offsetY] = patchOffsetByType[patchType];
      const realMunicipalityGeometry = openDataGeometry?.municipalityById.get(node.municipalityId)?.geometry ?? null;
      const settlementCandidates = openDataGeometry?.settlementByMunicipalityId.get(node.municipalityId) ?? [];
      const settlementGeometry = settlementCandidates.length > 0 ? settlementCandidates[0].geometry : null;
      const patchGeometry = useOpenDataGeometry
        ? (patchType.includes('Residential') || patchType === 'settlementCore'
          ? (settlementGeometry ?? realMunicipalityGeometry)
          : (realMunicipalityGeometry ?? (includeSyntheticPolygons ? makeSquarePolygon(node.lat, node.lon, areaHa, offsetX, offsetY) : null)))
        : (includeSyntheticPolygons ? makeSquarePolygon(node.lat, node.lon, areaHa, offsetX, offsetY) : null);

      const patch = createPatch({
        id: makePatchId(node.municipalityId, patchType),
        name: `${node.nodeName} ${patchType}`,
        areaHa,
        geometry: patchGeometry,
        landUse,
        zoning: patchZoning(landUse),
        ownershipType: 'mixed',
        soil: {
          nitrogen: landUse === 'cropland' ? 0.68 : 0.54,
          phosphorus: landUse === 'cropland' ? 0.62 : 0.5,
          potassium: landUse === 'cropland' ? 0.64 : 0.52,
          carbon: landUse === 'woodland' ? 0.78 : 0.56,
          moisture: landUse === 'wetland' ? 0.9 : 0.62
        },
        conditions: {
          sun: landUse === 'woodland' ? 0.68 : 0.84,
          slope: landUse === 'wetland' ? 0.04 : 0.1,
          waterAccess: landUse === 'wetland' ? 0.96 : 0.74,
          access: landUse === 'residential' || landUse === 'mixed' ? 0.88 : 0.56
        },
        distance: {
          nearestRoadKm: landUse === 'residential' || landUse === 'mixed' ? 0.25 : 1.2,
          nearestSettlementKm: landUse === 'residential' || landUse === 'mixed' ? 0.2 : 1.8,
          nearestMarketKm: landUse === 'residential' || landUse === 'mixed' ? 0.4 : 2.4
        },
        metrics: {
          walkAccessIndex: landUse === 'residential' || landUse === 'mixed' ? 0.78 : 0.35,
          bicycleAccessIndex: landUse === 'residential' || landUse === 'mixed' ? 0.72 : 0.42,
          transitAccessIndex: HIGH_DENSITY_MUNICIPALITIES.has(node.municipalityId) ? 0.7 : 0.38,
          localServiceAccessIndex: landUse === 'residential' || landUse === 'mixed' ? 0.82 : 0.4,
          freightAccessIndex: 0.45 + node.railPotential * 0.25,
          transportResilienceScore: 0.36 + node.serviceLevel * 0.35 + node.railPotential * 0.18
        }
      });

      patch.sourceProperties = {
        syntheticGeometry: !useOpenDataGeometry,
        geometrySource: useOpenDataGeometry ? 'grey-open-data' : 'synthetic',
        sourceTag: node.sourceTag,
        municipalityId: node.municipalityId,
        municipalityName: node.municipalityName,
        nodeName: node.nodeName,
        note: useOpenDataGeometry
          ? 'Geometry from Grey open-data municipality/settlement layers; census scaling retained for population/area.'
          : 'Service-node anchored synthetic polygon. Replace with municipal/parcels GIS for calibrated runs.'
      };

      patches.push(patch);
      municipalityPatchIds.push(patch.id);
    }

    const householdCount = target.generatedHouseholds;
    const dwellingUnitsTarget = target.generatedDwellingUnits;
    const densityNorm = Math.max(0, Math.min(1, node.densityPerKm2 / 900));

    const apartmentUnits = Math.round(dwellingUnitsTarget * (HIGH_DENSITY_MUNICIPALITIES.has(node.municipalityId) ? 0.44 : (node.municipalityType === 'town' ? 0.28 : 0.16)));
    const olderUnits = Math.round(dwellingUnitsTarget * (0.26 + densityNorm * 0.1));
    const edgeUnits = Math.max(0, dwellingUnitsTarget - apartmentUnits - olderUnits);

    const baseRentPerMonth = municipalityBaseRentPerMonth(node);
    const buildingTemplates = [
      {
        key: 'apartments',
        patchType: 'settlementCore',
        type: 'apartment',
        dwellingUnits: Math.max(0, apartmentUnits),
        floorAreaM2: Math.max(260, apartmentUnits * 70),
        heatDemandKwhPerYear: Math.max(7_000, apartmentUnits * 2_900),
        insulationLevel: 0.44,
        heatingSystem: 'electric',
        retrofitLevel: 0.2,
        rentPerMonth: Math.round(baseRentPerMonth * 1.08)
      },
      {
        key: 'older-housing',
        patchType: 'olderResidential',
        type: 'dwelling',
        dwellingUnits: Math.max(1, olderUnits),
        floorAreaM2: Math.max(180, olderUnits * 108),
        heatDemandKwhPerYear: Math.max(9_000, olderUnits * 4_700),
        insulationLevel: 0.33,
        heatingSystem: 'mixed',
        retrofitLevel: 0.11,
        rentPerMonth: Math.round(baseRentPerMonth * 1.0)
      },
      {
        key: 'edge-housing',
        patchType: 'edgeResidential',
        type: 'dwelling',
        dwellingUnits: Math.max(1, edgeUnits),
        floorAreaM2: Math.max(200, edgeUnits * 118),
        heatDemandKwhPerYear: Math.max(11_000, edgeUnits * 5_300),
        insulationLevel: 0.28,
        heatingSystem: 'oil',
        retrofitLevel: 0.07,
        rentPerMonth: Math.round(baseRentPerMonth * 0.92)
      },
      {
        key: 'local-market',
        patchType: 'settlementCore',
        type: 'shop',
        dwellingUnits: 0,
        floorAreaM2: Math.round(340 + target.scaledPopulation * 0.01),
        heatDemandKwhPerYear: Math.round(16_000 + target.scaledPopulation * 0.22),
        insulationLevel: 0.37,
        heatingSystem: 'mixed',
        retrofitLevel: 0.12,
        rentPerMonth: Math.round(baseRentPerMonth * 1.12)
      },
      {
        key: 'school-care-hub',
        patchType: 'settlementCore',
        type: 'institutional',
        dwellingUnits: 0,
        floorAreaM2: Math.round(420 + target.scaledPopulation * 0.014),
        heatDemandKwhPerYear: Math.round(18_000 + target.scaledPopulation * 0.21),
        insulationLevel: 0.39,
        heatingSystem: 'electric',
        retrofitLevel: 0.13,
        rentPerMonth: 0
      },
      {
        key: 'repair-workshop',
        patchType: 'edgeResidential',
        type: 'workshop',
        dwellingUnits: 0,
        floorAreaM2: Math.round(250 + patchAreas.croplandCatchment * 0.004),
        heatDemandKwhPerYear: Math.round(12_500 + patchAreas.croplandCatchment * 0.08),
        insulationLevel: 0.31,
        heatingSystem: 'mixed',
        retrofitLevel: 0.09,
        rentPerMonth: 0
      },
      {
        key: 'storage-hub',
        patchType: 'marketGardenBelt',
        type: 'warehouse',
        dwellingUnits: 0,
        floorAreaM2: Math.round(300 + patchAreas.croplandCatchment * 0.005),
        heatDemandKwhPerYear: Math.round(9_000 + patchAreas.marketGardenBelt * 0.1),
        insulationLevel: 0.27,
        heatingSystem: 'wood',
        retrofitLevel: 0.07,
        rentPerMonth: 0
      }
    ];

    if (node.serviceLevel >= 0.62) {
      buildingTemplates.push({
        key: 'village-work-hub',
        patchType: 'settlementCore',
        type: 'mixedUse',
        dwellingUnits: Math.max(2, Math.round(target.generatedDwellingUnits * 0.025)),
        floorAreaM2: Math.round(360 + target.scaledPopulation * 0.005),
        heatDemandKwhPerYear: Math.round(15_000 + target.scaledPopulation * 0.08),
        insulationLevel: 0.35,
        heatingSystem: 'mixed',
        retrofitLevel: 0.1,
        rentPerMonth: Math.round(baseRentPerMonth * 0.95)
      });
    }

    if (node.municipalityId === 'blue-mountains') {
      buildingTemplates.push({
        key: 'seasonal-housing-placeholder',
        patchType: 'edgeResidential',
        type: 'mixedUse',
        dwellingUnits: Math.max(2, Math.round(target.generatedDwellingUnits * 0.04)),
        floorAreaM2: Math.round(500 + target.scaledPopulation * 0.004),
        heatDemandKwhPerYear: Math.round(18_000 + target.scaledPopulation * 0.05),
        insulationLevel: 0.34,
        heatingSystem: 'mixed',
        retrofitLevel: 0.09,
        rentPerMonth: Math.round(baseRentPerMonth * 1.18)
      });
    }

    const settlementBuildingIds = [];
    const residentialBuildingIds = [];
    let occupiedUnitsRemaining = target.generatedHouseholds;

    for (const template of buildingTemplates) {
      const occupiedUnits = template.dwellingUnits > 0
        ? Math.max(0, Math.min(template.dwellingUnits, occupiedUnitsRemaining))
        : 0;
      occupiedUnitsRemaining -= occupiedUnits;

      const building = createBuilding({
        id: makeBuildingId(node.municipalityId, template.key),
        patchId: makePatchId(node.municipalityId, template.patchType),
        settlementId,
        type: template.type,
        dwellingUnits: template.dwellingUnits,
        occupiedUnits,
        floorAreaM2: template.floorAreaM2,
        condition: 0.71 + node.serviceLevel * 0.2,
        rentPerMonth: template.rentPerMonth,
        baseRentPerMonth: template.rentPerMonth,
        estimatedValue: Math.round(template.floorAreaM2 * (900 + node.serviceLevel * 430)),
        heatDemandKwhPerYear: template.heatDemandKwhPerYear,
        insulationLevel: template.insulationLevel,
        heatingSystem: template.heatingSystem,
        retrofitLevel: template.retrofitLevel,
        effects: {
          storageCalories: template.type === 'warehouse' ? Math.round(100_000 + target.scaledPopulation * 4) : 0,
          productionCapacity: template.type === 'workshop' ? 0.34 : 0,
          serviceCapacity: template.type === 'institutional' ? 0.65 : (template.type === 'shop' ? 0.52 : 0)
        }
      });

      building.sourceProperties = {
        synthetic: true,
        municipalityId: node.municipalityId,
        censusScaledPopulation: target.scaledPopulation,
        sourceTag: node.sourceTag
      };

      buildings.push(building);
      settlementBuildingIds.push(building.id);
      if (building.dwellingUnits > 0) {
        residentialBuildingIds.push(building.id);
      }
    }

    const infraTemplates = [
      {
        key: 'local-market',
        type: 'marketHall',
        patchType: 'settlementCore',
        capacity: 0.5 + node.serviceLevel * 0.36,
        effects: { transportCostReduction: 0.08, serviceAccessBonus: 0.18 }
      },
      {
        key: 'school-care-hub',
        type: 'school',
        patchType: 'settlementCore',
        capacity: 0.45 + node.serviceLevel * 0.35,
        effects: { serviceAccessBonus: 0.2 }
      },
      {
        key: 'repair-workshop',
        type: 'mill',
        patchType: 'edgeResidential',
        capacity: 0.32 + node.serviceLevel * 0.3,
        effects: { processingLabourReduction: 0.09, serviceAccessBonus: 0.08 }
      },
      {
        key: 'storage-hub',
        type: 'rootCellar',
        patchType: 'marketGardenBelt',
        capacity: 0.3 + node.serviceLevel * 0.26,
        effects: { spoilageReduction: 0.03, storageCalories: Math.round(95_000 + patchAreas.marketGardenBelt * 1.2), serviceAccessBonus: 0.05 }
      }
    ];

    const freightAnchorTemplates = [];
    if (node.municipalityId === 'owen-sound') {
      freightAnchorTemplates.push(
        { key: 'market-depot', type: 'marketDepot', commodities: ['foodStaples', 'freshFood', 'householdGoods'], patchType: 'settlementCore', strength: 0.76 },
        { key: 'cold-storage-depot', type: 'coldStorageDepot', commodities: ['freshFood'], patchType: 'marketGardenBelt', strength: 0.74 },
        { key: 'emergency-supply-depot', type: 'emergencySupplyDepot', commodities: ['emergencySupplies'], patchType: 'settlementCore', strength: 0.66 },
        { key: 'harbour-depot-placeholder', type: 'intermodalDepot', commodities: ['timber', 'constructionMaterials'], patchType: 'settlementCore', strength: 0.68 }
      );
    }

    if (['meaford', 'blue-mountains'].includes(node.municipalityId)) {
      freightAnchorTemplates.push(
        { key: 'food-aggregation-depot', type: 'marketDepot', commodities: ['foodStaples', 'freshFood'], patchType: 'marketGardenBelt', strength: 0.63 },
        { key: 'cold-storage-depot', type: 'coldStorageDepot', commodities: ['freshFood', 'nurseryStock'], patchType: 'marketGardenBelt', strength: 0.62 }
      );
      if (includeRail) {
        freightAnchorTemplates.push({ key: 'rail-depot', type: 'freightSiding', commodities: ['foodStaples', 'woodFuel'], patchType: 'croplandCatchment', strength: 0.61 });
      }
    }

    if (['hanover', 'west-grey', 'grey-highlands', 'southgate'].includes(node.municipalityId)) {
      freightAnchorTemplates.push(
        { key: 'farm-input-depot', type: 'farmInputDepot', commodities: ['farmInputs'], patchType: 'croplandCatchment', strength: 0.54 },
        { key: 'repair-materials-depot', type: 'repairMaterialsDepot', commodities: ['repairGoods', 'constructionMaterials'], patchType: 'edgeResidential', strength: 0.52 },
        { key: 'market-depot', type: 'marketDepot', commodities: ['householdGoods', 'foodStaples'], patchType: 'settlementCore', strength: 0.56 }
      );
    }

    if (['georgian-bluffs', 'chatsworth'].includes(node.municipalityId)) {
      freightAnchorTemplates.push(
        { key: 'wood-fuel-depot', type: 'woodFuelDepot', commodities: ['woodFuel', 'timber'], patchType: 'woodlotCatchment', strength: 0.5 },
        { key: 'local-storage-depot', type: 'rootCellarDepot', commodities: ['freshFood', 'foodStaples'], patchType: 'marketGardenBelt', strength: 0.46 }
      );
    }

    if (node.serviceLevel < 0.7) {
      freightAnchorTemplates.push(
        { key: 'compost-transfer-depot', type: 'compostTransferDepot', commodities: ['compostWaste'], patchType: 'pastureCatchment', strength: 0.41 },
        { key: 'nursery-stock-depot', type: 'nurseryStockDepot', commodities: ['nurseryStock'], patchType: 'orchardNutBelt', strength: 0.4 }
      );
    }

    const municipalityInfrastructures = [];

    for (const template of infraTemplates) {
      municipalityInfrastructures.push(createInfrastructure({
        id: makeInfrastructureId(node.municipalityId, template.key),
        patchId: makePatchId(node.municipalityId, template.patchType),
        settlementId,
        type: template.type,
        condition: 0.68 + node.serviceLevel * 0.2,
        capacity: template.capacity,
        effects: template.effects,
        maintenance: {
          labourDaysPerYear: Math.round(8 + node.serviceLevel * 8 + target.scaledPopulation / 50_000),
          materialKgPerYear: Math.round(160 + target.scaledAreaHa / 800),
          moneyPerYear: Math.round(2_500 + target.scaledPopulation * 0.08)
        }
      }));
    }

    for (const template of freightAnchorTemplates) {
      const throughputTonnes = Math.max(
        80,
        Math.round(target.scaledPopulation * 0.12 + target.scaledAreaHa * 0.004 + (patchAreas.croplandCatchment + patchAreas.marketGardenBelt) * 0.01)
      );

      municipalityInfrastructures.push(createInfrastructure({
        id: makeInfrastructureId(node.municipalityId, template.key),
        patchId: makePatchId(node.municipalityId, template.patchType),
        settlementId,
        networkId: includeRail ? 'network-grey-rail' : null,
        type: template.type,
        condition: 0.64 + node.serviceLevel * 0.2,
        commodityTypes: template.commodities,
        annualThroughputTonnes: throughputTonnes,
        railCapturePotential: Math.min(0.8, 0.3 + node.railPotential * 0.45),
        roadCapturePotential: Math.max(0.2, 0.95 - (0.3 + node.railPotential * 0.45) * 0.7),
        storageCapacityTonnes: Math.round(throughputTonnes * 0.32),
        spoilageReduction: template.type.includes('Storage') ? 0.24 : 0.09,
        loadingEfficiency: 0.5 + template.strength * 0.24,
        loadingLabourDaysPerTonne: 0.1,
        catchmentRadiusKm: 3.8,
        serviceFrequencyRequirement: 1,
        anchorStrength: template.strength,
        freightAnchorStrength: template.strength,
        maintenance: {
          labourDaysPerYear: Math.round(10 + throughputTonnes / 1_000),
          materialKgPerYear: Math.round(220 + throughputTonnes / 8),
          moneyPerYear: Math.round(3_300 + throughputTonnes * 2.6)
        }
      }));
    }

    if (includeRail && RAIL_STATION_MUNICIPALITIES.has(node.municipalityId)) {
      const catchmentPopulation = Math.round(target.scaledPopulation * (0.28 + node.serviceLevel * 0.34));
      const catchmentProductiveLandHa = Math.round((patchAreas.croplandCatchment + patchAreas.pastureCatchment + patchAreas.marketGardenBelt) * (0.4 + node.railPotential * 0.35));
      const catchmentFreightTonnePotential = Math.round((target.scaledPopulation * 0.08 + catchmentProductiveLandHa * 0.015) * (0.7 + node.railPotential * 0.3));

      municipalityInfrastructures.push(createInfrastructure({
        id: makeInfrastructureId(node.municipalityId, 'rail-station'),
        patchId: makePatchId(node.municipalityId, 'settlementCore'),
        settlementId,
        networkId: 'network-grey-rail',
        type: node.serviceLevel > 0.68 ? 'railStation' : 'railHalt',
        condition: 0.65 + node.railPotential * 0.24,
        catchmentRadiusKm: 2.6 + node.serviceLevel,
        walkCatchmentPeople: Math.round(catchmentPopulation * 0.46),
        bicycleCatchmentPeople: Math.round(catchmentPopulation * 0.32),
        parkAndRideCatchmentPeople: Math.round(catchmentPopulation * 0.22),
        freightCatchmentHa: catchmentProductiveLandHa,
        passengerCapacityPerYear: Math.round(catchmentPopulation * 180),
        freightCapacityTonnePerYear: Math.round(catchmentFreightTonnePotential * 1.7),
        serviceFrequencyPerDay: Math.max(1, Math.round(1 + node.railPotential * 3)),
        loadingLabourDaysPerTonne: 0.09,
        transferCostPerPassenger: 2.3,
        transferCostPerTonne: 3.7,
        localAccessBonus: 0.14 + node.serviceLevel * 0.2,
        developmentAttraction: 0.18 + node.railPotential * 0.25,
        freightAnchorStrength: 0.24 + node.railPotential * 0.3,
        effects: { transportCostReduction: 0.14, serviceAccessBonus: 0.12 },
        maintenance: { labourDaysPerYear: 14, materialKgPerYear: 320, moneyPerYear: 4_600 },
        metrics: {
          catchmentPopulation,
          catchmentFreightTonnePotential,
          catchmentProductiveLandHa
        }
      }));
    }

    if (includeWaterFreight && ['owen-sound', 'meaford', 'blue-mountains'].includes(node.municipalityId)) {
      const waterCatchmentFreight = Math.round((target.scaledPopulation * 0.05 + patchAreas.croplandCatchment * 0.012) * (0.6 + node.waterFreightPotential * 0.4));
      municipalityInfrastructures.push(createInfrastructure({
        id: makeInfrastructureId(node.municipalityId, 'water-freight-node'),
        patchId: makePatchId(node.municipalityId, 'settlementCore'),
        settlementId,
        networkId: 'network-grey-water',
        type: 'intermodalDepot',
        condition: 0.66 + node.waterFreightPotential * 0.2,
        catchmentRadiusKm: 3.4,
        walkCatchmentPeople: Math.round(target.scaledPopulation * 0.11),
        bicycleCatchmentPeople: Math.round(target.scaledPopulation * 0.14),
        parkAndRideCatchmentPeople: Math.round(target.scaledPopulation * 0.07),
        freightCatchmentHa: Math.round((patchAreas.croplandCatchment + patchAreas.marketGardenBelt) * 0.42),
        passengerCapacityPerYear: Math.round(target.scaledPopulation * 30),
        freightCapacityTonnePerYear: Math.round(waterCatchmentFreight * 1.8),
        serviceFrequencyPerDay: 1,
        loadingLabourDaysPerTonne: 0.11,
        transferCostPerPassenger: 3,
        transferCostPerTonne: 2.9,
        localAccessBonus: 0.11,
        developmentAttraction: 0.21,
        freightAnchorStrength: 0.42,
        effects: { transportCostReduction: 0.16, serviceAccessBonus: 0.07 },
        maintenance: { labourDaysPerYear: 11, materialKgPerYear: 280, moneyPerYear: 3_900 }
      }));
    }

    for (const infra of municipalityInfrastructures) {
      infra.sourceProperties = {
        ...(infra.sourceProperties ?? {}),
        synthetic: true,
        municipalityId: node.municipalityId,
        municipalityName: node.municipalityName,
        sourceTag: node.sourceTag
      };
      infrastructures.push(infra);
    }

    const municipalityPlantGroups = buildPlantGroups(node, patchAreas);
    plantGroups.push(...municipalityPlantGroups);

    const householdIds = [];
    const homePool = residentialBuildingIds.length > 0
      ? residentialBuildingIds
      : settlementBuildingIds;
    let remainingPopulationToAssign = target.scaledPopulation;
    let municipalityFarmAccessPopulation = 0;
    let municipalityGardenAccessPopulation = 0;
    let municipalityNoLandAccessPopulation = 0;
    let municipalityLandAccessHouseholds = 0;
    let municipalityFoodProducingHouseholds = 0;

    for (let i = 0; i < target.generatedHouseholds; i += 1) {
      const homeBuildingId = homePool[i % homePool.length];
      const householdsRemaining = target.generatedHouseholds - i;
      const avgRemaining = householdsRemaining > 0 ? remainingPopulationToAssign / householdsRemaining : 1;
      const minFeasible = Math.max(1, remainingPopulationToAssign - (householdsRemaining - 1) * 6);
      const maxFeasible = Math.min(6, remainingPopulationToAssign - (householdsRemaining - 1));
      const householdSize = Math.max(minFeasible, Math.min(maxFeasible, Math.round(avgRemaining)));
      remainingPopulationToAssign -= householdSize;
      const workers = Math.max(1, Math.min(householdSize, Math.round(householdSize * (0.56 + node.serviceLevel * 0.15))));
      const dependents = Math.max(0, householdSize - workers);
      const landAccess = classifyLandAccess(node, i, patchAreas);
      const farmLikeAccess = ['farm', 'common', 'cooperative'].includes(landAccess.type);
      const gardenLikeAccess = ['garden', 'allotment'].includes(landAccess.type);
      const householdContext = classifyHouseholdContext(node, i, landAccess.type);

      const household = createHousehold({
        id: `household-${node.municipalityId}-${i + 1}`,
        settlementId,
        homeBuildingId,
        people: { total: householdSize, workers, dependents },
        income: {
          wageIncome: Math.round(31_000 + node.serviceLevel * 16_000 + (i % 5) * 2_100),
          farmIncome: Math.round((1 - node.urbanShare) * 8_800 + (i % 3) * 700),
          transferIncome: 2_100,
          enterpriseIncome: Math.round(node.serviceLevel * 2_900)
        },
        skills: {
          farming: Math.min(0.95, 0.24 + (1 - node.urbanShare) * 0.66),
          forestry: Math.min(0.95, 0.2 + (node.municipalityType === 'township' ? 0.24 : 0.12)),
          repair: Math.min(0.95, 0.34 + node.serviceLevel * 0.38),
          preserving: Math.min(0.95, 0.28 + (1 - node.urbanShare) * 0.36),
          trade: Math.min(0.95, 0.34 + node.serviceLevel * 0.4),
          care: Math.min(0.95, 0.4 + node.serviceLevel * 0.3)
        },
        access: {
          landHa: Number(Math.max(0, landAccess.ha).toFixed(3)),
          tools: Math.min(1, 0.42 + node.serviceLevel * 0.3),
          vehicleAccess: Math.min(1, 0.36 + (1 - node.serviceLevel) * 0.46),
          transitAccess: Math.min(1, 0.24 + node.serviceLevel * 0.65),
          draftPower: Math.min(1, 0.08 + (1 - node.urbanShare) * 0.42),
          machinePower: Math.min(1, 0.18 + node.serviceLevel * 0.34),
          marketAccess: Math.min(1, 0.33 + node.serviceLevel * 0.56)
        },
        landAccessType: landAccess.type,
        householdContext,
        productiveLandAccessHa: Number(landAccess.ha.toFixed(3)),
        gardenAccessM2: Math.round(landAccess.gardenM2),
        distanceToProductiveLandKm: landAccess.type === 'none' ? 2.8 : (gardenLikeAccess ? 0.6 : 1.4),
        foodProductionSkill: Math.min(0.98, 0.24 + (1 - node.urbanShare) * 0.66 + (farmLikeAccess ? 0.1 : 0)),
        availableFoodProductionLabourDays: Math.round(workers * (farmLikeAccess ? 105 : (gardenLikeAccess ? 75 : 22))),
        toolAccessLevel: Math.min(1, 0.4 + node.serviceLevel * 0.3 + (gardenLikeAccess ? 0.06 : 0)),
        inputAccessLevel: Math.min(1, 0.33 + node.serviceLevel * 0.56),
        machineryAccessLevel: Math.min(1, 0.14 + node.serviceLevel * 0.32 + (farmLikeAccess ? 0.18 : 0)),
        reserves: {
          calories: Math.round(37_000 + (1 - node.urbanShare) * 16_000),
          firewoodKg: Math.round(440 + (1 - node.urbanShare) * 880),
          cash: Math.round(1_500 + node.serviceLevel * 2_050)
        },
        preferences: {
          urbanPreference: Math.min(0.95, node.urbanShare * 0.92 + (i % 3 === 0 ? 0.04 : 0)),
          ruralPreference: Math.max(0.05, 1 - Math.min(0.95, node.urbanShare * 0.92 + (i % 3 === 0 ? 0.04 : 0))),
          commuteTolerance: Math.min(0.95, 0.45 + node.serviceLevel * 0.28),
          landAccessDesire: Math.min(0.95, 0.3 + (1 - node.urbanShare) * 0.46)
        },
        state: {
          health: Math.min(0.95, 0.72 + node.serviceLevel * 0.18),
          morale: Math.min(0.95, 0.64 + node.serviceLevel * 0.2)
        }
      });

      households.push(household);
      householdIds.push(household.id);
      if (landAccess.type === 'none') {
        municipalityNoLandAccessPopulation += householdSize;
      } else {
        municipalityLandAccessHouseholds += 1;
        municipalityFoodProducingHouseholds += 1;
        if (farmLikeAccess) {
          municipalityFarmAccessPopulation += householdSize;
        } else {
          municipalityGardenAccessPopulation += householdSize;
        }
      }
    }

    const actualPopulation = households
      .filter((item) => item.settlementId === settlementId)
      .reduce((sum, household) => sum + household.people.total, 0);

    const populationUrban = Math.round(actualPopulation * node.urbanShare);
    const populationRural = Math.max(0, actualPopulation - populationUrban);

    settlements.push(createSettlement({
      id: settlementId,
      name: node.municipalityName,
      patchIds: municipalityPatchIds,
      householdIds,
      buildingIds: settlementBuildingIds,
      infrastructureIds: municipalityInfrastructures.map((infra) => infra.id),
      populationUrban,
      populationRural,
      socialCohesion: Math.min(0.92, 0.58 + node.serviceLevel * 0.26),
      institutionalTrust: Math.min(0.9, 0.55 + node.serviceLevel * 0.24)
    }));

    markets.push(createMarket({
      id: `market-${settlementId}`,
      settlementId,
      prices: {
        foodCalories: 0.00042,
        firewoodKg: 0.23,
        dieselLitre: 1.56,
        electricityKwh: 0.2,
        rentUnit: Math.round(620 + node.serviceLevel * 530),
        landHa: Math.round(1_800 + node.serviceLevel * 1_250),
        labourDay: Math.round(95 + node.serviceLevel * 48)
      }
    }));

    municipalitySummaryRows.push({
      municipalityId: node.municipalityId,
      municipalityName: node.municipalityName,
      nodeName: node.nodeName,
      population2021: node.population2021,
      landAreaKm2: node.landAreaKm2,
      densityPerKm2: node.densityPerKm2,
      scaledPopulation: target.scaledPopulation,
      scaledAreaHa: target.scaledAreaHa,
      generatedHouseholds: target.generatedHouseholds,
      generatedDwellingUnits: target.generatedDwellingUnits,
      generatedVacancyRate: target.generatedVacancyRate,
      farmAccessPopulation: municipalityFarmAccessPopulation,
      gardenAccessPopulation: municipalityGardenAccessPopulation,
      noLandAccessPopulation: municipalityNoLandAccessPopulation,
      landAccessHouseholds: municipalityLandAccessHouseholds,
      foodProducingHouseholds: municipalityFoodProducingHouseholds,
      geometrySource: useOpenDataGeometry ? 'grey-open-data' : 'synthetic',
      realGeometryMatched: Boolean(openDataGeometry?.municipalityById.get(node.municipalityId)),
      realGeometry: openDataGeometry?.municipalityById.get(node.municipalityId)?.geometry ?? null,
      sourceProperties: openDataGeometry?.municipalityById.get(node.municipalityId)?.sourceProperties ?? null,
      settlementPatchAreaHa: patchAreas.settlementCore + patchAreas.olderResidential + patchAreas.edgeResidential,
      croplandPatchAreaHa: patchAreas.croplandCatchment + patchAreas.marketGardenBelt + patchAreas.orchardNutBelt,
      pasturePatchAreaHa: patchAreas.pastureCatchment,
      woodlotPatchAreaHa: patchAreas.woodlotCatchment,
      roadKm: 0,
      railKm: 0
    });
  }

  let roadSegments = buildRoadSegments(nodesByMunicipalityId, scaling.scaleKey !== 'tiny', roadWiggleFactor);
  let roadFeatureCount = 0;
  let totalRoadKm = roadSegments.reduce((sum, s) => sum + (s.lengthKm ?? 0), 0);
  const roadClassCounts = {};
  const roadJurisdictionCounts = {};
  const roadFieldsDetected = {};
  if (useOpenDataRoads && openDataRoads.features.length > 0) {
    const features = openDataRoads.features;
    roadFeatureCount = features.length;
    const propertyKeys = new Set();
    const pickRoad = (props, keys) => {
      const all = Object.keys(props ?? {});
      for (const key of keys) {
        const hit = all.find((k) => k.toLowerCase() === key.toLowerCase());
        if (hit && props[hit] !== undefined && props[hit] !== null && String(props[hit]).trim() !== '') return props[hit];
      }
      return null;
    };
    roadSegments = features.map((feature, index) => {
      const props = feature?.properties ?? {};
      for (const key of Object.keys(props)) propertyKeys.add(key);
      const roadName = pickRoad(props, ['ROAD_NAME', 'RoadName', 'ROADNAME', 'NAME']);
      const roadClass = pickRoad(props, ['ORN_ROAD_CLASS', 'ROAD_CLASS', 'CLASS', 'FUNCTIONAL_CLASS', 'TYPE']) ?? 'unknown';
      const jurisdiction = pickRoad(props, ['JURIS_L', 'JURISDICTION', 'OWNER', 'ROAD_AUTHORITY', 'MUNICIPAL', 'COUNTY']) ?? 'unknown';
      const speedLimit = Number(pickRoad(props, ['SPEED_LIMI', 'SPEED_LIMIT', 'SPEED', 'POSTED_SPEED']) ?? 0) || null;
      const sourceLength = Number(props.LENGTH_KM ?? props.LENGTH ?? props.Shape_STLength__ ?? 0);
      const lengthKm = sourceLength > 0 && sourceLength < 500 ? sourceLength : geometryLengthKm(feature.geometry);
      roadClassCounts[String(roadClass)] = (roadClassCounts[String(roadClass)] ?? 0) + 1;
      roadJurisdictionCounts[String(jurisdiction)] = (roadJurisdictionCounts[String(jurisdiction)] ?? 0) + 1;
      return {
        id: `road-open-${index + 1}`,
        type: 'collectorRoad',
        lengthKm: Math.max(0.01, lengthKm || 0.01),
        condition: 0.72,
        capacityPassengerKmPerYear: 1_500_000,
        capacityTonneKmPerYear: 900_000,
        maintenanceCostPerKmPerYear: 7_500,
        maintenanceLabourDaysPerKmPerYear: 10,
        maintenanceMaterialsKgPerKmPerYear: 580,
        capitalRenewalCostPerKm: 100_000,
        bridgeOrCulvertFactor: 1.1,
        winterMaintenanceFactor: 1.2,
        climateStressFactor: 1.2,
        rightOfWayStatus: 'active',
        electrified: false,
        electricTractionAvailable: false,
        dieselTractionAvailable: true,
        maxSpeedKmh: speedLimit ?? 70,
        stopsOrSidings: 0,
        connectsSettlementIds: [],
        roadName,
        roadClass,
        jurisdiction,
        surface: pickRoad(props, ['PAVED_STATUS', 'SURFACE', 'PAVEMENT']),
        sourceProperties: props,
        geometry: feature.geometry ?? null
      };
    });
    totalRoadKm = roadSegments.reduce((sum, s) => sum + (s.lengthKm ?? 0), 0);
    roadFieldsDetected.roadNameField = [...propertyKeys].find((k) => /road.*name|name|street/i.test(k)) ?? null;
    roadFieldsDetected.roadClassField = [...propertyKeys].find((k) => /class|functional|type/i.test(k)) ?? null;
    roadFieldsDetected.jurisdictionField = [...propertyKeys].find((k) => /juris|owner|municip|county/i.test(k)) ?? null;
    roadFieldsDetected.surfaceField = [...propertyKeys].find((k) => /surface|pave/i.test(k)) ?? null;
    roadFieldsDetected.speedField = [...propertyKeys].find((k) => /speed|limit/i.test(k)) ?? null;
    roadFieldsDetected.lanesField = [...propertyKeys].find((k) => /lane/i.test(k)) ?? null;
  }
  const railSegments = includeRail ? buildRailSegments(nodesByMunicipalityId) : [];
  const waterSegments = includeWaterFreight ? buildWaterSegments(nodesByMunicipalityId) : [];

  const networks = [
    createNetwork({
      id: 'network-grey-roads',
      type: 'collectorRoad',
      nodes: nodes.map((node) => node.municipalityId),
      segments: roadSegments,
      metrics: {
        averageCondition: 0.73,
        freightCostPerTonneKm: 0.8,
        commuteCostPerKm: 0.29
      }
    })
  ];

  if (includeRail) {
    networks.push(createNetwork({
      id: 'network-grey-rail',
      type: 'traditionalRail',
      nodes: Array.from(RAIL_STATION_MUNICIPALITIES.values()),
      segments: railSegments,
      metrics: {
        averageCondition: 0.66,
        freightCostPerTonneKm: 0.5,
        commuteCostPerKm: 0.2,
        railServiceReliability: 0.63
      }
    }));
  }

  if (includeWaterFreight) {
    networks.push(createNetwork({
      id: 'network-grey-water',
      type: 'waterRoute',
      nodes: ['owen-sound', 'meaford', 'blue-mountains'],
      segments: waterSegments,
      metrics: {
        averageCondition: 0.72,
        freightCostPerTonneKm: 0.42,
        commuteCostPerKm: 0.25
      }
    }));
  }

  const summaryByMunicipalityId = new Map(municipalitySummaryRows.map((row) => [row.municipalityId, row]));
  for (const segment of roadSegments) {
    for (const municipalityId of segment.connectsSettlementIds) {
      const row = summaryByMunicipalityId.get(municipalityId);
      if (row) {
        row.roadKm += segment.lengthKm / segment.connectsSettlementIds.length;
      }
    }
  }
  for (const segment of railSegments) {
    for (const municipalityId of segment.connectsSettlementIds) {
      const row = summaryByMunicipalityId.get(municipalityId);
      if (row) {
        row.railKm += segment.lengthKm / segment.connectsSettlementIds.length;
      }
    }
  }

  const patchById = new Map(patches.map((patch) => [patch.id, patch]));
  for (const plantGroup of plantGroups) {
    patchById.get(plantGroup.patchId)?.plantGroupIds.push(plantGroup.id);
  }
  for (const building of buildings) {
    patchById.get(building.patchId)?.buildingIds.push(building.id);
  }
  for (const infrastructure of infrastructures) {
    patchById.get(infrastructure.patchId)?.infrastructureIds.push(infrastructure.id);
  }

  const world = createWorld({
    year: baseYear,
    patches,
    plantGroups,
    households,
    buildings,
    infrastructures,
    settlements,
    networks,
    markets,
    metricsByYear: []
  });

  const totalSyntheticPatchAreaHa = patches.reduce((sum, patch) => sum + patch.areaHa, 0);
  const syntheticPopulation = households.reduce((sum, household) => sum + household.people.total, 0);
  const householdsCount = scaling.targets.reduce((sum, target) => sum + target.generatedHouseholds, 0);
  const dwellingUnitsCount = scaling.targets.reduce((sum, target) => sum + target.generatedDwellingUnits, 0);
  const generatedVacancyRate = dwellingUnitsCount > 0 ? (dwellingUnitsCount - householdsCount) / dwellingUnitsCount : 0;

  world.seedMeta = {
    seedName,
    scale: scaling.scaleKey,
    includeRail,
    includeWaterFreight,
    includeSyntheticPolygons,
    useOpenDataGeometry,
    syntheticGeometry: !useOpenDataGeometry,
    geometrySource: useOpenDataGeometry ? 'grey-open-data' : 'synthetic',
    sourceTag: 'grey-county-census-seed-v2021',
    openDataInputDir: useOpenDataGeometry ? openDataInputDir : null,
    scaling,
    censusValidation: seedValidation,
    municipalities: municipalitySummaryRows,
    openDataGeometry: useOpenDataGeometry ? {
      municipalityBoundaries: Array.from(openDataGeometry?.municipalityById.values() ?? []),
      settlementBoundaries: openDataGeometry?.settlementFeatures ?? [],
      landUsePatches: openDataGeometry?.landUseFeatures ?? [],
      warnings: [...(openDataGeometry?.warnings ?? []), ...roadWarnings]
    } : null,
    summaryCsvText: createMunicipalSummaryCsv(municipalitySummaryRows),
    summary: {
      municipalities: nodes.length,
      syntheticPopulation,
      expectedScaledPopulation: scaling.expectedScaledPopulation,
      populationScaleError: scaling.populationScaleError,
      totalSyntheticPatchAreaHa,
      expectedScaledAreaHa: scaling.expectedScaledAreaHa,
      areaScaleError: scaling.areaScaleError,
      households: householdsCount,
      dwellingUnits: dwellingUnitsCount,
      vacancyRate: generatedVacancyRate,
      roadSegments: roadSegments.length,
      roadSource: useOpenDataRoads ? openDataRoads.roadSource : 'synthetic',
      roadFeatureCount: roadFeatureCount || roadSegments.length,
      totalRoadKm,
      roadClassCounts,
      roadJurisdictionCounts,
      roadFieldsDetected,
      roadMaintenanceDemandMoney: totalRoadKm * 7500,
      maintenanceCostPerRoadKmAverage: totalRoadKm > 0 ? 7500 : 0,
      roadKmPerResident: syntheticPopulation > 0 ? totalRoadKm / syntheticPopulation : 0,
      roadKmPerSettlementArea: nodes.length > 0 ? totalRoadKm / nodes.length : 0,
      transitStopCount: secondaryCounts['grey-transit-bus-stops'] ?? 0,
      trailFeatureCount: (secondaryCounts['county-trails'] ?? 0) + (secondaryCounts['cp-rail-trail'] ?? 0) + (secondaryCounts['hiking-trails'] ?? 0) + (secondaryCounts['tom-thomson-trail'] ?? 0),
      cyclingRouteFeatureCount: secondaryCounts['official-road-cycling-routes'] ?? 0,
      managedForestFeatureCount: secondaryCounts['managed-forest-boundary'] ?? 0,
      ruralBusinessCount: secondaryCounts['on-farm-rural-business-listing'] ?? 0,
      facilityCount: (secondaryCounts['public-facilities'] ?? 0) + (secondaryCounts['community-facilities'] ?? 0) + (secondaryCounts['libraries'] ?? 0) + (secondaryCounts['arenas-community-centres'] ?? 0) + (secondaryCounts['works-yards-depots'] ?? 0) + (secondaryCounts['emergency-services'] ?? 0),
      roadStructureCount: secondaryCounts['bridges-culverts-structures'] ?? 0,
      secondaryDataCoverageScore: Math.min(1, [
        secondaryCounts['grey-transit-bus-stops'] ?? 0,
        secondaryCounts['official-road-cycling-routes'] ?? 0,
        secondaryCounts['managed-forest-boundary'] ?? 0,
        secondaryCounts['on-farm-rural-business-listing'] ?? 0,
        secondaryCounts['public-facilities'] ?? 0,
        secondaryCounts['bridges-culverts-structures'] ?? 0
      ].filter((v) => v > 0).length / 6),
      railSegments: railSegments.length,
      waterSegments: waterSegments.length,
      municipalityFeaturesMatched: useOpenDataGeometry ? (openDataGeometry?.municipalityById.size ?? 0) : 0,
      settlementFeaturesImported: useOpenDataGeometry ? (openDataGeometry?.settlementFeatures.length ?? 0) : 0,
      landUseFeaturesImported: useOpenDataGeometry ? (openDataGeometry?.landUseFeatures.length ?? 0) : 0,
      realLandUseFeatureCount: useOpenDataGeometry ? (openDataGeometry?.metrics.realLandUseFeatureCount ?? 0) : 0,
      landUseCategoryCounts: useOpenDataGeometry ? (openDataGeometry?.metrics.landUseCategoryCounts ?? {}) : {},
      unclassifiedLandUseCount: useOpenDataGeometry ? (openDataGeometry?.metrics.unclassifiedLandUseCount ?? 0) : 0,
      unassignedMunicipalityLandUseCount: useOpenDataGeometry ? (openDataGeometry?.metrics.unassignedMunicipalityLandUseCount ?? 0) : 0,
      stations: infrastructures.filter((item) => ['railStation', 'railHalt', 'freightSiding'].includes(item.type) && item.networkId === 'network-grey-rail').length,
      freightAnchors: infrastructures.filter((item) => ['grainDepot', 'rootCellarDepot', 'coldStorageDepot', 'woodFuelDepot', 'timberSiding', 'farmInputDepot', 'nurseryStockDepot', 'repairMaterialsDepot', 'compostTransferDepot', 'constructionMaterialsDepot', 'emergencySupplyDepot', 'marketDepot', 'intermodalDepot'].includes(item.type)).length
    },
    warnings: useOpenDataGeometry ? [...(openDataGeometry?.warnings ?? []), ...roadWarnings] : roadWarnings,
    notes: useOpenDataGeometry
      ? 'Municipal/settlement/land-use geometry imported from Grey open data where available; census population/land-area scaling retained; roads remain synthetic until verified centrelines are added.'
      : 'Synthetic coordinate-seeded geometry with census-scaled municipality population and land area. Replace with real municipal boundaries/parcels/centrelines for production calibration.'
  };

  return world;
}
