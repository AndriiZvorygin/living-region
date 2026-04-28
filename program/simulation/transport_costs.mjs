// SPDX-License-Identifier: AGPL-3.0-or-later
import { average, clamp } from '../util/math.mjs';

const ROAD_TYPES = new Set(['localRoad', 'collectorRoad', 'arterialRoad', 'highway', 'gravelRoad', 'trailCartPath']);
const ROAD_INFRA_TYPES = new Set(['road', 'bridge', 'trail']);

function averageRoadCondition(world) {
  const roadSegments = world.networks.flatMap((network) => network.segments ?? []).filter((segment) => ROAD_TYPES.has(segment.type));
  const segmentCondition = average(roadSegments.map((segment) => segment.condition), 0.7);
  const roadInfra = world.infrastructures.filter((item) => ROAD_INFRA_TYPES.has(item.type));
  const infrastructureCondition = average(roadInfra.map((item) => item.condition), 0.7);

  if (roadSegments.length === 0 && roadInfra.length === 0) {
    return 0.7;
  }
  if (roadSegments.length === 0) {
    return infrastructureCondition;
  }
  if (roadInfra.length === 0) {
    return segmentCondition;
  }

  // Blend network and infrastructure conditions so tests and scenarios that adjust either still affect accessibility.
  return (segmentCondition * 0.78) + (infrastructureCondition * 0.22);
}

export function calculateTransportCosts(world, scenario, context) {
  const transportConstants = context.constants?.transport ?? {};
  const adaptation = context.adaptation ?? {};
  const stressCommuteScale = transportConstants.stressCommuteScale ?? 10;
  const stressRoadWeight = transportConstants.stressRoadWeight ?? 0.6;
  const stressDieselWeight = transportConstants.stressDieselWeight ?? 0.4;

  const roadCondition = averageRoadCondition(world);
  const dieselPrice = world.markets[0]?.prices.dieselLitre ?? 1.5;
  const dieselAvailability = context.dieselAvailability;

  const baseCommute = scenario.baseCommuteCostPerKm;
  const baseFreight = scenario.baseFreightCostPerTonneKm;

  const roadPenalty = 1 + (1 - roadCondition) * 1.25;
  const dieselPenalty = 1 + (1 - dieselAvailability) * 1.7;
  const fuelPricePenalty = 0.7 + (dieselPrice / 1.5);

  const buildingById = new Map(world.buildings.map((building) => [building.id, building]));
  const patchById = new Map(world.patches.map((patch) => [patch.id, patch]));
  const settlementByPatch = new Map();
  for (const settlement of world.settlements) {
    for (const patchId of settlement.patchIds) {
      settlementByPatch.set(patchId, settlement);
    }
  }

  let commuteCostSum = 0;
  let householdCount = 0;
  let commutingPassengerKm = 0;
  let householdAccessPassengerKm = 0;
  let careServicePassengerKm = 0;

  for (const household of world.households) {
    const homeBuilding = buildingById.get(household.homeBuildingId);
    const homePatch = homeBuilding ? patchById.get(homeBuilding.patchId) : null;
    const commuteDistanceKm = homePatch ? (homePatch.distance.nearestSettlementKm + homePatch.distance.nearestMarketKm * 0.6) : 2;
    const localService = homePatch?.metrics?.localServiceAccessIndex ?? 0.4;

    const accessibilityFactor = clamp(1 - (household.access.transitAccess * 0.2 + household.access.vehicleAccess * 0.15 + localService * 0.1), 0.5, 1.12);
    const commuteCost = baseCommute * commuteDistanceKm * roadPenalty * dieselPenalty * fuelPricePenalty * accessibilityFactor;

    household.expenses.transport = commuteCost * 220;
    commuteCostSum += commuteCost;
    householdCount += 1;

    const tripReductionFactor = Math.max(0.5, 1 - (adaptation.annualTripReductionRate ?? 0) * 0.85);
    const localSubstitutionFactor = Math.max(0.45, 1 - (adaptation.localTripSubstitutionRate ?? 0) * 0.9);
    const demandReductionFactor = Math.max(0.5, 1 - (adaptation.transportDemandReductionRate ?? 0) * 0.75);

    commutingPassengerKm += household.people.workers * commuteDistanceKm * 220 * tripReductionFactor * demandReductionFactor;
    householdAccessPassengerKm += household.people.total * (commuteDistanceKm * 0.65 + 1.2) * 52 * localSubstitutionFactor * demandReductionFactor;
    careServicePassengerKm += household.people.dependents * (commuteDistanceKm * 0.55 + 0.8) * 80 * localSubstitutionFactor * demandReductionFactor;
  }

  let freightCostSum = 0;
  let foodFreightTonneKm = 0;
  let fuelFreightTonneKm = 0;
  let materialsFreightTonneKm = 0;
  let marketFreightTonneKm = 0;

  for (const patch of world.patches) {
    const infraReduction = world.infrastructures
      .filter((infrastructure) => infrastructure.patchId === patch.id)
      .reduce((sum, infrastructure) => sum + infrastructure.effects.transportCostReduction, 0);

    const effectiveReduction = clamp(infraReduction, 0, 0.72);
    const distanceKm = patch.distance.nearestMarketKm;
    const freightCost = baseFreight * distanceKm * roadPenalty * dieselPenalty * (1 - effectiveReduction);

    patch.metrics = {
      ...patch.metrics,
      freightCostToMarket: freightCost,
      transportAccess: clamp((1 / (1 + freightCost)) * 3 + roadCondition * 0.5, 0, 1)
    };

    freightCostSum += freightCost;

    const freightDistanceKm = Math.max(0.5, patch.distance.nearestMarketKm);
    const isFoodPatch = ['cropland', 'pasture', 'mixed', 'vacant', 'woodland'].includes(patch.landUse);
    const isFuelPatch = ['woodland', 'pasture'].includes(patch.landUse);
    const productiveTonnes = patch.areaHa * (isFoodPatch ? 0.75 : 0.18);

    foodFreightTonneKm += productiveTonnes * freightDistanceKm;
    fuelFreightTonneKm += (isFuelPatch ? patch.areaHa * 0.28 : patch.areaHa * 0.05) * freightDistanceKm;
    materialsFreightTonneKm += (patch.buildingIds.length * 0.75 + patch.infrastructureIds.length * 0.45) * freightDistanceKm;
    marketFreightTonneKm += productiveTonnes * freightDistanceKm * 0.35;
  }

  for (const settlement of world.settlements) {
    const patches = settlement.patchIds.map((patchId) => patchById.get(patchId)).filter(Boolean);
    const walkableShare = average(patches.map((patch) => patch.metrics?.walkAccessIndex ?? 0.3), 0.3);
    const localServiceCoverage = average(patches.map((patch) => patch.metrics?.localServiceAccessIndex ?? 0.3), 0.3);
    const villageServiceCoverage = settlement.id === 'village' ? localServiceCoverage : localServiceCoverage * 0.86;
    const railOrWaterFreightAccess = average(patches.map((patch) => patch.metrics?.freightAccessIndex ?? 0.2), 0.2)
      + (settlement.id === 'town' || settlement.id === 'village' ? 0.1 : 0);
    const marketGardenProximity = average(
      patches.map((patch) => patch.metrics?.dominantPlantGroup === 'Intensive Market Gardens' ? 1 : 1 - Math.min(1, patch.distance.nearestMarketKm / 10)),
      0.2
    );
    const averageTripDistanceKm = average(
      patches.map((patch) => patch.distance.nearestSettlementKm + patch.distance.nearestMarketKm * 0.45),
      3
    );

    settlement.metrics = {
      ...settlement.metrics,
      walkableShare,
      localServiceCoverage: clamp(localServiceCoverage + (adaptation.annualLocalServiceBuildoutRate ?? 0) * 5, 0, 1),
      villageServiceCoverage,
      railOrWaterFreightAccess: clamp(railOrWaterFreightAccess, 0, 1),
      marketGardenProximity,
      averageTripDistanceKm
    };
  }

  const averageCommuteCost = householdCount > 0 ? commuteCostSum / householdCount : 0;
  const averageFreightCost = world.patches.length > 0 ? freightCostSum / world.patches.length : 0;
  const totalPassengerKmDemand = commutingPassengerKm + householdAccessPassengerKm + careServicePassengerKm;
  const totalFreightTonneKmDemand = foodFreightTonneKm + fuelFreightTonneKm + materialsFreightTonneKm + marketFreightTonneKm;
  const localizedPassengerKmAvoided = totalPassengerKmDemand * clamp((adaptation.localTripSubstitutionRate ?? 0) * 0.35 + (adaptation.annualTripReductionRate ?? 0) * 0.4, 0, 0.45);
  const localizedFreightTonneKmAvoided = totalFreightTonneKmDemand * clamp((adaptation.annualFreightLocalizationRate ?? 0) * 0.55 + (adaptation.localBiomassMobilizationRate ?? 0) * 0.2, 0, 0.5);
  const transportStress = clamp(
    (averageCommuteCost / stressCommuteScale)
      + ((1 - roadCondition) * stressRoadWeight)
      + ((1 - dieselAvailability) * stressDieselWeight),
    0,
    1
  );

  const roadMaintenanceBacklog = world.metricsByYear.at(-1)?.roadMaintenanceBacklogMoney
    ?? world.networks.reduce((sum, network) => sum + (network.metrics?.maintenanceBacklog ?? 0), 0);

  return {
    averageCommuteCost,
    averageFreightCost,
    transportStress,
    roadMaintenanceBacklog,
    roadCondition,
    roadConditionAverage: roadCondition,
    commutingPassengerKm,
    householdAccessPassengerKm,
    careServicePassengerKm,
    foodFreightTonneKm,
    fuelFreightTonneKm,
    materialsFreightTonneKm,
    marketFreightTonneKm,
    totalPassengerKmDemand: Math.max(0, totalPassengerKmDemand - localizedPassengerKmAvoided),
    totalFreightTonneKmDemand: Math.max(0, totalFreightTonneKmDemand - localizedFreightTonneKmAvoided),
    localizedPassengerKmAvoided,
    localizedFreightTonneKmAvoided
  };
}
