// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';

function createSquarePolygon(index, offsetX = 0, offsetY = 0, size = 0.01) {
  const col = index % 4;
  const row = Math.floor(index / 4);
  const x = offsetX + col * size * 1.5;
  const y = offsetY + row * size * 1.5;

  return {
    type: 'Polygon',
    coordinates: [[
      [x, y],
      [x + size, y],
      [x + size, y + size],
      [x, y + size],
      [x, y]
    ]]
  };
}

function createLineString(index, offsetX = -79.75, offsetY = 43.5) {
  const row = Math.floor(index / 3);
  const col = index % 3;
  const startX = offsetX + col * 0.045;
  const startY = offsetY + row * 0.02;
  return {
    type: 'LineString',
    coordinates: [
      [startX, startY],
      [startX + 0.03, startY + 0.01]
    ]
  };
}

function patchToFeature(patch, index) {
  const geometry = patch.geometry ?? createSquarePolygon(index, -79.7, 43.5, 0.012);

  return {
    type: 'Feature',
    geometry,
    properties: {
      id: patch.id,
      name: patch.name,
      landUse: patch.landUse,
      areaHa: patch.areaHa,
      soil: {
        nitrogen: patch.soil.nitrogen,
        phosphorus: patch.soil.phosphorus,
        potassium: patch.soil.potassium,
        carbon: patch.soil.carbon,
        moisture: patch.soil.moisture
      },
      producedCalories: patch.metrics?.producedCalories ?? 0,
      labourDemandFoodDays: patch.metrics?.labourDemandFoodDays ?? 0,
      labourDeficitDays: patch.metrics?.labourDeficitDays ?? 0,
      freightCostToMarket: patch.metrics?.freightCostToMarket ?? 0,
      dominantPlantGroup: patch.metrics?.dominantPlantGroup ?? null,
      estimatedLandValue: patch.metrics?.estimatedLandValue ?? 0,
      developmentPressure: patch.metrics?.developmentPressure ?? 0,
      foodProductionPotential: patch.metrics?.foodProductionPotential ?? 0,
      transportAccess: patch.metrics?.transportAccess ?? 0,
      walkAccessIndex: patch.metrics?.walkAccessIndex ?? 0,
      bicycleAccessIndex: patch.metrics?.bicycleAccessIndex ?? 0,
      localServiceAccessIndex: patch.metrics?.localServiceAccessIndex ?? 0,
      freightAccessIndex: patch.metrics?.freightAccessIndex ?? 0,
      transportResilienceScore: patch.metrics?.transportResilienceScore ?? 0,
      sustainableBiomassHarvestKg: patch.metrics?.sustainableBiomassHarvestKg ?? 0,
      energyPotentialKwh: patch.metrics?.energyPotentialKwh ?? 0,
      transportFuelStressIndicator: patch.metrics?.transportFuelStressIndicator ?? 0
    }
  };
}

function buildingPointFromPatch(patch, index) {
  const geometry = patch?.geometry ?? createSquarePolygon(index, -79.7, 43.5, 0.012);
  const first = geometry.coordinates?.[0]?.[0] ?? [-79.7, 43.5];
  return {
    type: 'Point',
    coordinates: [first[0] + 0.002, first[1] + 0.002]
  };
}

function buildingToFeature(building, index, patchById) {
  const patch = patchById.get(building.patchId);
  return {
    type: 'Feature',
    geometry: buildingPointFromPatch(patch, index),
    properties: {
      id: building.id,
      type: building.type,
      dwellingUnits: building.dwellingUnits,
      occupiedUnits: building.occupiedUnits,
      rentPerMonth: building.rentPerMonth,
      estimatedValue: building.estimatedValue,
      condition: building.condition,
      heatDemandKwhPerYear: building.heatDemandKwhPerYear,
      effectiveHeatDemandKwh: building.metrics?.effectiveHeatDemandKwh ?? building.heatDemandKwhPerYear,
      insulationLevel: building.insulationLevel,
      retrofitLevel: building.retrofitLevel,
      heatingSystem: building.heatingSystem,
      energyStressIndicator: building.metrics?.energyStressIndicator ?? 0,
      carDependenceIndex: building.metrics?.carDependenceIndex ?? 0,
      localAccessIndex: building.metrics?.localAccessIndex ?? 0,
      transportStressIndicator: building.metrics?.transportStressIndicator ?? 0,
      transportResilienceValueAdjustment: building.metrics?.transportResilienceValueAdjustment ?? 0,
      housingStressIndicator: building.dwellingUnits > 0
        ? Math.max(0, (building.occupiedUnits - building.dwellingUnits) / Math.max(1, building.dwellingUnits))
        : 0
    }
  };
}

function networkFeature(network, segment, index) {
  const geometry = segment.geometry ?? createLineString(index);
  return {
    type: 'Feature',
    geometry,
    properties: {
      networkId: network.id,
      id: segment.id,
      type: segment.type,
      lengthKm: segment.lengthKm,
      condition: segment.condition,
      maintenanceDemandMoney: segment.metrics?.maintenanceDemandMoney ?? 0,
      maintenanceBacklogMoney: segment.metrics?.maintenanceBacklogMoney ?? 0,
      capacityPassengerKmPerYear: segment.capacityPassengerKmPerYear,
      capacityTonneKmPerYear: segment.capacityTonneKmPerYear,
      railElectrified: segment.electrified,
      railUtilizationRatio: network.metrics?.railUtilizationRatio ?? 0,
      passengerUtilizationRatio: network.metrics?.passengerUtilizationRatio ?? 0,
      freightUtilizationRatio: network.metrics?.freightUtilizationRatio ?? 0,
      weightedUtilizationRatio: network.metrics?.weightedUtilizationRatio ?? 0,
      railPassengerCapacityKm: network.metrics?.railPassengerCapacityKm ?? 0,
      railFreightCapacityTonneKm: network.metrics?.railFreightCapacityTonneKm ?? 0,
      railBreakEvenUtilizationRatio: network.metrics?.railBreakEvenUtilizationRatio ?? 0,
      railBreakEvenMixedUtilization: network.metrics?.railBreakEvenMixedUtilization ?? 0,
      railCostPerPassengerKm: network.metrics?.railCostPerPassengerKm ?? 0,
      railCostPerTonneKm: network.metrics?.railCostPerTonneKm ?? 0,
      heavyTruckTonneKmAvoidedByRail: network.metrics?.heavyTruckTonneKmAvoidedByRail ?? 0,
      avoidedRoadMaintenanceFromRailShift: network.metrics?.avoidedRoadMaintenanceFromRailShift ?? 0,
      railBenefitCostRatio: network.metrics?.railBenefitCostRatio ?? 0,
      railCostRecoveryRatioWithAvoidedCosts: network.metrics?.railCostRecoveryRatioWithAvoidedCosts ?? 0,
      railNetCostAfterBenefits: network.metrics?.railNetCostAfterBenefits ?? 0,
      roadConditionStress: segment.metrics?.roadConditionStress ?? (1 - segment.condition),
      maintenancePriority: segment.metrics?.maintenancePriority ?? 0,
      rightOfWayStatus: segment.rightOfWayStatus,
      connectsSettlementIds: segment.connectsSettlementIds
    }
  };
}

function stationPointFromPatch(patch, index) {
  const geometry = patch?.geometry ?? createSquarePolygon(index, -79.7, 43.5, 0.012);
  const first = geometry.coordinates?.[0]?.[0] ?? [-79.7, 43.5];
  return {
    type: 'Point',
    coordinates: [first[0] + 0.004, first[1] + 0.004]
  };
}

function stationToFeature(station, index, patchById) {
  const patch = patchById.get(station.patchId);
  return {
    type: 'Feature',
    geometry: stationPointFromPatch(patch, index),
    properties: {
      id: station.id,
      type: station.type,
      networkId: station.networkId,
      settlementId: station.settlementId,
      serviceFrequencyPerDay: station.serviceFrequencyPerDay ?? 0,
      condition: station.condition ?? 0,
      freightAnchorStrength: station.freightAnchorStrength ?? 0,
      catchmentPopulation: station.metrics?.catchmentPopulation ?? 0,
      catchmentJobs: station.metrics?.catchmentJobs ?? 0,
      catchmentFreightTonnePotential: station.metrics?.catchmentFreightTonnePotential ?? 0,
      householdsWithViableRailAlternative: station.metrics?.catchmentHouseholds ?? 0,
      stationAreaTransitionPotential: station.metrics?.stationAreaTransitionPotential ?? 0,
      railUtilizationContribution: station.metrics?.catchmentServiceCapacity ?? 0,
      annualThroughputTonnes: station.metrics?.annualThroughputTonnes ?? station.annualThroughputTonnes ?? 0,
      railCapturePotential: station.railCapturePotential ?? 0,
      storageCapacityTonnes: station.storageCapacityTonnes ?? 0,
      anchorStrength: station.anchorStrength ?? station.freightAnchorStrength ?? 0,
      freightTonneKmCaptured: station.metrics?.freightTonneKmCaptured ?? 0,
      avoidedRoadTonneKm: station.metrics?.avoidedRoadTonneKm ?? 0,
      spoilageReductionValue: station.metrics?.spoilageReductionValue ?? 0,
      loadingLabourDays: station.metrics?.loadingLabourDays ?? 0,
      commodityTypes: station.commodityTypes ?? []
    }
  };
}

function freightAnchorToFeature(anchor, index, patchById) {
  const patch = patchById.get(anchor.patchId);
  return {
    type: 'Feature',
    geometry: stationPointFromPatch(patch, index),
    properties: {
      id: anchor.id,
      type: anchor.type,
      commodityTypes: anchor.commodityTypes ?? [],
      annualThroughputTonnes: anchor.annualThroughputTonnes ?? 0,
      railCapturePotential: anchor.railCapturePotential ?? 0,
      storageCapacityTonnes: anchor.storageCapacityTonnes ?? 0,
      anchorStrength: anchor.anchorStrength ?? anchor.freightAnchorStrength ?? 0,
      freightTonneKmCaptured: anchor.metrics?.freightTonneKmCaptured ?? 0,
      avoidedRoadTonneKm: anchor.metrics?.avoidedRoadTonneKm ?? 0,
      spoilageReductionValue: anchor.metrics?.spoilageReductionValue ?? 0,
      loadingLabourDays: anchor.metrics?.loadingLabourDays ?? 0
    }
  };
}

export function exportGeoJSON(world) {
  const patchById = new Map(world.patches.map((patch) => [patch.id, patch]));
  const networkFeatures = [];
  const stationFeatures = [];
  let networkIndex = 0;
  for (const network of world.networks) {
    for (const segment of network.segments ?? []) {
      networkFeatures.push(networkFeature(network, segment, networkIndex));
      networkIndex += 1;
    }
  }
  const stationTypes = new Set([
    'railStation',
    'railHalt',
    'freightSiding',
    'intermodalDepot',
    'marketDepot',
    'grainElevator',
    'woodDepot',
    'coldStorageDepot',
    'repairDepot',
    'grainDepot',
    'rootCellarDepot',
    'woodFuelDepot',
    'timberSiding',
    'farmInputDepot',
    'nurseryStockDepot',
    'repairMaterialsDepot',
    'compostTransferDepot',
    'constructionMaterialsDepot',
    'emergencySupplyDepot'
  ]);
  const freightAnchorTypes = new Set([
    'grainDepot',
    'rootCellarDepot',
    'coldStorageDepot',
    'woodFuelDepot',
    'timberSiding',
    'farmInputDepot',
    'nurseryStockDepot',
    'repairMaterialsDepot',
    'compostTransferDepot',
    'constructionMaterialsDepot',
    'emergencySupplyDepot'
  ]);
  for (const [index, station] of world.infrastructures.filter((item) => stationTypes.has(item.type)).entries()) {
    stationFeatures.push(stationToFeature(station, index, patchById));
  }
  const freightAnchorFeatures = [];
  for (const [index, anchor] of world.infrastructures.filter((item) => freightAnchorTypes.has(item.type)).entries()) {
    freightAnchorFeatures.push(freightAnchorToFeature(anchor, index, patchById));
  }

  return {
    patches: {
      type: 'FeatureCollection',
      features: world.patches.map((patch, index) => patchToFeature(patch, index))
    },
    buildings: {
      type: 'FeatureCollection',
      features: world.buildings.map((building, index) => buildingToFeature(building, index, patchById))
    },
    networks: {
      type: 'FeatureCollection',
      features: networkFeatures
    },
    stations: {
      type: 'FeatureCollection',
      features: stationFeatures
    },
    freightAnchors: {
      type: 'FeatureCollection',
      features: freightAnchorFeatures
    }
  };
}

export function writeGeoJSON(world, outputDir) {
  const collections = exportGeoJSON(world);
  fs.mkdirSync(outputDir, { recursive: true });

  const patchesPath = path.join(outputDir, 'demo-patches-final.geojson');
  const buildingsPath = path.join(outputDir, 'demo-buildings-final.geojson');
  const networksPath = path.join(outputDir, 'demo-networks-final.geojson');
  const stationsPath = path.join(outputDir, 'demo-stations-final.geojson');
  const freightAnchorsPath = path.join(outputDir, 'demo-freight-anchors-final.geojson');

  fs.writeFileSync(patchesPath, JSON.stringify(collections.patches, null, 2));
  fs.writeFileSync(buildingsPath, JSON.stringify(collections.buildings, null, 2));
  fs.writeFileSync(networksPath, JSON.stringify(collections.networks, null, 2));
  fs.writeFileSync(stationsPath, JSON.stringify(collections.stations, null, 2));
  fs.writeFileSync(freightAnchorsPath, JSON.stringify(collections.freightAnchors, null, 2));

  return {
    patchesPath,
    buildingsPath,
    networksPath,
    stationsPath,
    freightAnchorsPath,
    collections
  };
}
