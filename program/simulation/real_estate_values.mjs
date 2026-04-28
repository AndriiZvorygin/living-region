// SPDX-License-Identifier: AGPL-3.0-or-later
import { average, clamp, clamp01, safeDivide } from '../util/math.mjs';

function buildingTransportProfile(building, patch) {
  const walkableTypes = ['mixedUse', 'apartment', 'shop', 'institutional'];
  const productiveTypes = ['barn', 'warehouse', 'workshop'];

  const localAccessIndex = clamp01(
    (patch?.metrics?.walkAccessIndex ?? 0.3) * 0.45
    + (patch?.metrics?.localServiceAccessIndex ?? 0.3) * 0.35
    + (patch?.metrics?.transitAccessIndex ?? 0.25) * 0.2
  );

  const carDependenceIndex = clamp01(
    patch?.metrics?.carDependenceIndex
      ?? (building.type === 'dwelling' ? 0.72 : 0.45)
  );

  const freightResilience = clamp01(
    (patch?.metrics?.freightAccessIndex ?? 0.3) * 0.5
    + (patch?.metrics?.transportResilienceScore ?? 0.3) * 0.5
  );

  const walkabilityBonus = walkableTypes.includes(building.type) ? 0.12 : 0;
  const productiveLandBonus = productiveTypes.includes(building.type) ? 0.14 : 0;

  return {
    localAccessIndex,
    carDependenceIndex,
    freightResilience,
    walkabilityBonus,
    productiveLandBonus
  };
}

export function updateRealEstateValues(world, context) {
  const patchById = new Map(world.patches.map((patch) => [patch.id, patch]));

  const infrastructureCondition = average(world.infrastructures.map((infrastructure) => infrastructure.condition), 0.7);
  const serviceAccess = average(world.infrastructures.map((infrastructure) => infrastructure.effects.serviceAccessBonus), 0.2);
  const marketAccess = average(world.households.map((household) => household.access.marketAccess), 0.5);
  const transportCostPenalty = clamp(context.averageCommuteCost / 20, 0, 1.5);
  const energyCostBurden = clamp((world.markets[0]?.prices.dieselLitre ?? 1.5) / 2.2, 0.4, 1.8);
  const transportFuelStress = context.energy?.transportFuelDeficitPressure ?? 0;
  const heatingFuelStress = context.energy?.heatingFuelDeficitPressure ?? 0;
  const unmetPassengerPressure = safeDivide(context.transport?.unmetPassengerKm ?? 0, context.transport?.totalPassengerKmDemand ?? 1, 0);
  const unmetFreightPressure = safeDivide(context.transport?.unmetFreightTonneKm ?? 0, context.transport?.totalFreightTonneKmDemand ?? 1, 0);

  const roadConditionAverage = context.roadMaintenance?.roadConditionAverage ?? 0.7;
  const roadBacklogPressure = safeDivide(context.roadMaintenance?.roadMaintenanceBacklogMoney ?? 0, Math.max(1, context.roadMaintenance?.roadMaintenanceDemandMoney ?? 1), 0);
  const railReliability = context.railMaintenance?.railServiceReliability ?? 0;
  const railEnabled = context.transport?.railEnabled ?? false;
  const averageCarDependenceCostBurden = context.transportEconomics?.averageCarDependenceCostBurden ?? 1;

  for (const building of world.buildings) {
    const patch = patchById.get(building.patchId);
    const nearbyProductivity = patch?.metrics?.foodProductionPotential ?? 0;
    const productivityFactor = clamp(nearbyProductivity / 1_500_000, 0, 1.2);
    const housingDemandFactor = clamp(context.rentPressure, 0.7, 2);

    const baseValue = Math.max(50_000, building.floorAreaM2 * 1_000);
    const conditionFactor = clamp(0.5 + building.condition * 0.8, 0.4, 1.4);
    const insulationBonus = building.insulationLevel * 0.14 + building.retrofitLevel * 0.18;
    const energyIntensityPenalty = clamp(
      ((building.metrics?.effectiveHeatDemandKwh ?? building.heatDemandKwhPerYear) / Math.max(1, building.floorAreaM2)) / 120,
      0,
      1.2
    );

    const profile = buildingTransportProfile(building, patch);

    const railAccessValueAdjustment = clamp(
      (railEnabled ? 1 : 0) * railReliability * ((patch?.metrics?.transitAccessIndex ?? 0.25) * 0.2 + (building.type === 'mixedUse' || building.type === 'shop' ? 0.08 : 0)),
      -0.1,
      0.3
    );

    const roadMaintenanceValueAdjustment = clamp(
      roadConditionAverage * 0.18 - roadBacklogPressure * (0.12 + profile.carDependenceIndex * 0.2),
      -0.35,
      0.2
    );

    const privateVehicleCostBurdenAdjustment = clamp(
      -averageCarDependenceCostBurden * profile.carDependenceIndex * 0.16,
      -0.45,
      0
    );

    const transportResilienceValueAdjustment = clamp(
      profile.walkabilityBonus
      + profile.freightResilience * 0.18
      + railAccessValueAdjustment
      - profile.carDependenceIndex * transportFuelStress * 0.22
      - unmetPassengerPressure * profile.carDependenceIndex * 0.12
      - unmetFreightPressure * (building.type === 'barn' || building.type === 'warehouse' ? 0.2 : 0.06),
      -0.45,
      0.45
    );

    const localAccessValueAdjustment = clamp(
      profile.localAccessIndex * 0.22
      - transportCostPenalty * profile.carDependenceIndex * 0.16,
      -0.35,
      0.35
    );

    const productiveLandValueAdjustment = clamp(
      productivityFactor * 0.24
      + profile.productiveLandBonus
      + (patch?.metrics?.energyPotentialKwh ?? 0) / 400_000 * 0.08,
      -0.2,
      0.45
    );

    const multiplier = clamp(
      0.55
      + 0.2 * serviceAccess
      + 0.2 * marketAccess
      + 0.18 * infrastructureCondition
      + 0.15 * productivityFactor
      + 0.18 * housingDemandFactor
      + insulationBonus
      + transportResilienceValueAdjustment
      + localAccessValueAdjustment
      + productiveLandValueAdjustment
      + roadMaintenanceValueAdjustment
      + privateVehicleCostBurdenAdjustment
      - 0.2 * transportCostPenalty
      - 0.15 * energyCostBurden
      - 0.1 * heatingFuelStress
      - 0.12 * energyIntensityPenalty,
      0.35,
      2.6
    );

    building.estimatedValue = baseValue * conditionFactor * multiplier;
    building.metrics = {
      ...building.metrics,
      carDependenceIndex: profile.carDependenceIndex,
      localAccessIndex: profile.localAccessIndex,
      transportStressIndicator: clamp01(transportFuelStress * 0.6 + unmetPassengerPressure * 0.4),
      railAccessValueAdjustment,
      roadMaintenanceValueAdjustment,
      privateVehicleCostBurdenAdjustment,
      transportResilienceValueAdjustment,
      localAccessValueAdjustment,
      productiveLandValueAdjustment
    };

    if (patch) {
      patch.metrics = {
        ...patch.metrics,
        estimatedLandValue: clamp((patch.metrics.estimatedLandValue ?? 0) + (building.estimatedValue / Math.max(1, patch.areaHa)), 500, 800_000),
        developmentPressure: clamp((patch.metrics.developmentPressure ?? 0) + housingDemandFactor * 0.1 + serviceAccess * 0.1 - transportCostPenalty * 0.05, 0, 2)
      };
    }
  }

  const averageEstimatedBuildingValue = average(world.buildings.map((building) => building.estimatedValue), 0);

  return {
    averageEstimatedBuildingValue
  };
}
