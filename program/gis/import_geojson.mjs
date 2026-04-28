// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { createWorld } from '../model/world.mjs';
import { createPatch } from '../model/patch.mjs';
import { createBuilding } from '../model/building.mjs';
import { createNetwork } from '../model/network.mjs';
import { createInfrastructure } from '../model/infrastructure.mjs';
import { createSettlement } from '../model/settlement.mjs';
import { createHousehold } from '../model/household.mjs';
import { createMarket } from '../model/market.mjs';
import { createPlantGroup } from '../model/plant_group.mjs';
import { buildValidationReport } from '../util/validation_report.mjs';

function asNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function loadFeatureCollection(filePath, warnings, required = false) {
  if (!fs.existsSync(filePath)) {
    if (required) {
      warnings.push({ severity: 'warning', code: 'geojson.layer.missing', message: `Missing required GeoJSON file: ${path.basename(filePath)}` });
    } else {
      warnings.push({ severity: 'info', code: 'geojson.layer.missing', message: `Optional GeoJSON file missing: ${path.basename(filePath)}` });
    }
    return { type: 'FeatureCollection', features: [] };
  }
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (raw.type !== 'FeatureCollection' || !Array.isArray(raw.features)) {
    warnings.push({ severity: 'warning', code: 'geojson.layer.invalid', message: `Invalid FeatureCollection: ${path.basename(filePath)}` });
    return { type: 'FeatureCollection', features: [] };
  }
  return raw;
}

function featureId(layer, feature, index) {
  return feature.id ?? feature.properties?.id ?? `${layer}-${index + 1}`;
}

function baseSourceProperties(properties, knownKeys) {
  const sourceProperties = {};
  for (const [key, value] of Object.entries(properties ?? {})) {
    if (!knownKeys.has(key)) {
      sourceProperties[key] = value;
    }
  }
  return sourceProperties;
}

function importPatches(collection) {
  return collection.features.map((feature, index) => {
    const properties = feature.properties ?? {};
    const known = new Set(['id', 'name', 'areaHa', 'landUse', 'zoning', 'ownershipType', 'nitrogen', 'phosphorus', 'potassium', 'carbon', 'moisture']);
    const patch = createPatch({
      id: featureId('patch', feature, index),
      name: properties.name ?? `Patch ${index + 1}`,
      areaHa: asNumber(properties.areaHa, 1),
      geometry: feature.geometry ?? null,
      landUse: properties.landUse ?? 'mixed',
      zoning: properties.zoning ?? 'mixed',
      ownershipType: properties.ownershipType ?? 'mixed',
      soil: {
        nitrogen: asNumber(properties.nitrogen, 0.5),
        phosphorus: asNumber(properties.phosphorus, 0.5),
        potassium: asNumber(properties.potassium, 0.5),
        carbon: asNumber(properties.carbon, 0.5),
        moisture: asNumber(properties.moisture, 0.5)
      }
    });
    patch.sourceProperties = baseSourceProperties(properties, known);
    return patch;
  });
}

function importBuildings(collection, patches) {
  const fallbackPatchId = patches[0]?.id ?? 'patch-1';
  return collection.features.map((feature, index) => {
    const properties = feature.properties ?? {};
    const known = new Set(['id', 'patchId', 'settlementId', 'type', 'dwellingUnits', 'occupiedUnits', 'floorAreaM2', 'condition', 'rentPerMonth', 'estimatedValue', 'heatDemandKwhPerYear', 'insulationLevel', 'heatingSystem', 'retrofitLevel']);
    const building = createBuilding({
      id: featureId('building', feature, index),
      patchId: properties.patchId ?? fallbackPatchId,
      settlementId: properties.settlementId ?? 'default',
      type: properties.type ?? 'dwelling',
      dwellingUnits: asNumber(properties.dwellingUnits, 0),
      occupiedUnits: asNumber(properties.occupiedUnits, 0),
      floorAreaM2: asNumber(properties.floorAreaM2, 100),
      condition: asNumber(properties.condition, 0.8),
      rentPerMonth: asNumber(properties.rentPerMonth, 500),
      estimatedValue: asNumber(properties.estimatedValue, 150_000),
      heatDemandKwhPerYear: asNumber(properties.heatDemandKwhPerYear, 18_000),
      insulationLevel: asNumber(properties.insulationLevel, 0.35),
      heatingSystem: properties.heatingSystem ?? 'mixed',
      retrofitLevel: asNumber(properties.retrofitLevel, 0)
    });
    building.geometry = feature.geometry ?? null;
    building.sourceProperties = baseSourceProperties(properties, known);
    return building;
  });
}

function importNetworks(collection) {
  const grouped = new Map();
  for (const [index, feature] of collection.features.entries()) {
    const properties = feature.properties ?? {};
    const networkId = properties.networkId ?? properties.id ?? `network-${index + 1}`;
    if (!grouped.has(networkId)) {
      grouped.set(networkId, {
        id: networkId,
        type: properties.networkType ?? properties.type ?? 'localRoad',
        nodes: [],
        edges: [],
        segments: []
      });
    }
    const network = grouped.get(networkId);
    network.segments.push({
      id: featureId('segment', feature, index),
      type: properties.type ?? network.type,
      lengthKm: asNumber(properties.lengthKm, 1),
      condition: asNumber(properties.condition, 0.8),
      capacityPassengerKmPerYear: asNumber(properties.capacityPassengerKmPerYear, 200_000),
      capacityTonneKmPerYear: asNumber(properties.capacityTonneKmPerYear, 80_000),
      maintenanceCostPerKmPerYear: asNumber(properties.maintenanceCostPerKmPerYear, 4_000),
      maintenanceLabourDaysPerKmPerYear: asNumber(properties.maintenanceLabourDaysPerKmPerYear, 8),
      maintenanceMaterialsKgPerKmPerYear: asNumber(properties.maintenanceMaterialsKgPerKmPerYear, 500),
      capitalRenewalCostPerKm: asNumber(properties.capitalRenewalCostPerKm, 100_000),
      bridgeOrCulvertFactor: asNumber(properties.bridgeOrCulvertFactor, 1),
      winterMaintenanceFactor: asNumber(properties.winterMaintenanceFactor, 1),
      climateStressFactor: asNumber(properties.climateStressFactor, 1),
      rightOfWayStatus: properties.rightOfWayStatus ?? 'active',
      electrified: Boolean(properties.railElectrified ?? false),
      geometry: feature.geometry ?? null,
      sourceProperties: properties
    });
  }
  return Array.from(grouped.values()).map((item) => createNetwork(item));
}

function importInfrastructure(collection, fallbackPatchId, typeFallback) {
  return collection.features.map((feature, index) => {
    const properties = feature.properties ?? {};
    const infra = createInfrastructure({
      id: featureId(typeFallback, feature, index),
      patchId: properties.patchId ?? fallbackPatchId,
      networkId: properties.networkId ?? null,
      settlementId: properties.settlementId ?? 'default',
      stationId: properties.stationId ?? null,
      type: properties.type ?? typeFallback,
      condition: asNumber(properties.condition, 0.75),
      catchmentRadiusKm: asNumber(properties.catchmentRadiusKm, 2),
      walkCatchmentPeople: asNumber(properties.walkCatchmentPeople, 0),
      bicycleCatchmentPeople: asNumber(properties.bicycleCatchmentPeople, 0),
      parkAndRideCatchmentPeople: asNumber(properties.parkAndRideCatchmentPeople, 0),
      freightCatchmentHa: asNumber(properties.freightCatchmentHa, 0),
      passengerCapacityPerYear: asNumber(properties.passengerCapacityPerYear, 0),
      freightCapacityTonnePerYear: asNumber(properties.freightCapacityTonnePerYear, 0),
      serviceFrequencyPerDay: asNumber(properties.serviceFrequencyPerDay, 0),
      loadingLabourDaysPerTonne: asNumber(properties.loadingLabourDaysPerTonne, 0),
      transferCostPerPassenger: asNumber(properties.transferCostPerPassenger, 0),
      transferCostPerTonne: asNumber(properties.transferCostPerTonne, 0),
      localAccessBonus: asNumber(properties.localAccessBonus, 0),
      developmentAttraction: asNumber(properties.developmentAttraction, 0),
      freightAnchorStrength: asNumber(properties.freightAnchorStrength, 0),
      commodityTypes: Array.isArray(properties.commodityTypes)
        ? properties.commodityTypes
        : (typeof properties.commodityTypes === 'string' ? properties.commodityTypes.split('|').map((x) => x.trim()).filter(Boolean) : []),
      annualThroughputTonnes: asNumber(properties.annualThroughputTonnes, 0),
      railCapturePotential: asNumber(properties.railCapturePotential, 0),
      roadCapturePotential: asNumber(properties.roadCapturePotential, 0),
      storageCapacityTonnes: asNumber(properties.storageCapacityTonnes, 0),
      spoilageReduction: asNumber(properties.spoilageReduction, 0),
      loadingEfficiency: asNumber(properties.loadingEfficiency, 0),
      anchorStrength: asNumber(properties.anchorStrength, asNumber(properties.freightAnchorStrength, 0)),
      maintenanceCostPerYear: asNumber(properties.maintenanceCostPerYear, 0),
      serviceFrequencyRequirement: asNumber(properties.serviceFrequencyRequirement, 0)
    });
    infra.geometry = feature.geometry ?? null;
    infra.sourceProperties = properties;
    return infra;
  });
}

function buildSettlements(patches, buildings, infrastructures, populationRows) {
  const ids = new Set(['default']);
  for (const building of buildings) {
    ids.add(building.settlementId ?? 'default');
  }
  for (const infra of infrastructures) {
    if (infra.settlementId) {
      ids.add(infra.settlementId);
    }
  }
  const bySettlement = new Map();
  for (const id of ids) {
    bySettlement.set(id, {
      id,
      name: id === 'default' ? 'Default Settlement' : id,
      patchIds: [],
      householdIds: [],
      buildingIds: [],
      infrastructureIds: [],
      populationUrban: 0,
      populationRural: 0
    });
  }
  for (const patch of patches) {
    bySettlement.get('default').patchIds.push(patch.id);
  }
  for (const building of buildings) {
    bySettlement.get(building.settlementId ?? 'default').buildingIds.push(building.id);
  }
  for (const infra of infrastructures) {
    bySettlement.get(infra.settlementId ?? 'default').infrastructureIds.push(infra.id);
  }
  const populationBySettlement = new Map((populationRows ?? []).map((row) => [row.settlementId, row]));
  for (const [id, settlement] of bySettlement.entries()) {
    const row = populationBySettlement.get(id);
    if (row) {
      settlement.populationUrban = asNumber(row.populationUrban, 0);
      settlement.populationRural = asNumber(row.populationRural, 0);
    }
  }
  return Array.from(bySettlement.values()).map((input) => createSettlement(input));
}

function buildHouseholds(settlements, buildings, populationRows) {
  const households = [];
  const buildingBySettlement = new Map();
  for (const settlement of settlements) {
    buildingBySettlement.set(settlement.id, buildings.filter((item) => item.settlementId === settlement.id && item.dwellingUnits > 0));
  }
  const populationBySettlement = new Map((populationRows ?? []).map((row) => [row.settlementId, row]));
  for (const settlement of settlements) {
    const row = populationBySettlement.get(settlement.id);
    const buildingsLocal = buildingBySettlement.get(settlement.id);
    const householdCount = Math.max(1, asNumber(row?.households, buildingsLocal.length || 1));
    const avgSize = Math.max(1, asNumber(row?.averageHouseholdSize, 3));
    for (let i = 0; i < householdCount; i += 1) {
      const building = buildingsLocal[i % Math.max(1, buildingsLocal.length)] ?? buildings[0];
      households.push(createHousehold({
        id: `hh-${settlement.id}-${i + 1}`,
        settlementId: settlement.id,
        homeBuildingId: building?.id,
        people: {
          total: Math.round(avgSize),
          workers: Math.max(1, Math.round(avgSize * 0.6)),
          dependents: Math.max(0, Math.round(avgSize * 0.4))
        }
      }));
    }
  }
  return households;
}

function buildPlantGroups(patches) {
  const productive = new Set(['cropland', 'pasture', 'woodland', 'mixed', 'vacant']);
  return patches
    .filter((patch) => productive.has(patch.landUse))
    .map((patch, index) => createPlantGroup({
      id: `pg-${index + 1}`,
      patchId: patch.id,
      name: `${patch.name} Plants`,
      functionalType: patch.landUse,
      areaShare: 0.7
    }));
}

function buildMarkets(settlements) {
  const targetSettlement = settlements[0]?.id ?? 'default';
  return [
    createMarket({
      id: `market-${targetSettlement}`,
      settlementId: targetSettlement
    })
  ];
}

export function importGeoJsonWorld(inputDir, options = {}) {
  const gisDir = path.join(inputDir, 'gis');
  const warnings = [];
  const patchesFc = loadFeatureCollection(path.join(gisDir, 'patches.geojson'), warnings, true);
  const buildingsFc = loadFeatureCollection(path.join(gisDir, 'buildings.geojson'), warnings, false);
  const networksFc = loadFeatureCollection(path.join(gisDir, 'networks.geojson'), warnings, false);
  const stationsFc = loadFeatureCollection(path.join(gisDir, 'stations.geojson'), warnings, false);
  const anchorsFc = loadFeatureCollection(path.join(gisDir, 'freight-anchors.geojson'), warnings, false);

  const patches = importPatches(patchesFc);
  const buildings = importBuildings(buildingsFc, patches);
  if (buildings.length === 0) {
    buildings.push(createBuilding({
      id: 'building-default-1',
      patchId: patches[0]?.id ?? 'patch-1',
      settlementId: 'default',
      type: 'dwelling',
      dwellingUnits: 1,
      occupiedUnits: 1,
      floorAreaM2: 90
    }));
  }
  const networks = importNetworks(networksFc);
  const fallbackPatchId = patches[0]?.id ?? 'patch-1';
  const stationInfra = importInfrastructure(stationsFc, fallbackPatchId, 'railStation');
  const anchorInfra = importInfrastructure(anchorsFc, fallbackPatchId, 'grainDepot');
  const infrastructures = [...stationInfra, ...anchorInfra];

  const populationRows = options.populationRows ?? [];
  const settlements = buildSettlements(patches, buildings, infrastructures, populationRows);
  const households = buildHouseholds(settlements, buildings, populationRows);
  const plantGroups = buildPlantGroups(patches);
  const markets = buildMarkets(settlements);

  const patchById = new Map(patches.map((item) => [item.id, item]));
  for (const plant of plantGroups) {
    patchById.get(plant.patchId)?.plantGroupIds.push(plant.id);
  }
  for (const building of buildings) {
    patchById.get(building.patchId)?.buildingIds.push(building.id);
  }
  for (const infra of infrastructures) {
    patchById.get(infra.patchId)?.infrastructureIds.push(infra.id);
  }
  for (const settlement of settlements) {
    settlement.householdIds = households.filter((hh) => hh.settlementId === settlement.id).map((hh) => hh.id);
  }

  const world = createWorld({
    patches,
    buildings,
    networks,
    infrastructures,
    settlements,
    households,
    plantGroups,
    markets,
    metricsByYear: []
  });
  const validation = buildValidationReport(world);
  return { world, warnings, validation };
}
