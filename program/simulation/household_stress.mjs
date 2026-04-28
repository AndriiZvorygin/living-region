// SPDX-License-Identifier: AGPL-3.0-or-later
import { average, clamp01 } from '../util/math.mjs';

function incomeOf(household) {
  return household.income.wageIncome
    + household.income.farmIncome
    + household.income.transferIncome
    + household.income.enterpriseIncome;
}

function dominantStressReason(household) {
  const entries = [
    ['food', household.state.foodStress],
    ['fuel', household.state.fuelStress],
    ['housing', household.state.housingStress],
    ['transport', household.state.transportStress]
  ].sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

function heatingSensitivity(system) {
  if (system === 'wood') {
    return 1;
  }
  if (system === 'electric') {
    return 0.9;
  }
  if (system === 'gas' || system === 'oil') {
    return 1.05;
  }
  return 0.95;
}

export function calculateHouseholdStress(world, scenario, context) {
  const stressConstants = context.constants?.stress ?? {};
  const migrationWeights = stressConstants.migrationWeights ?? {};
  const fuelComponentWeights = stressConstants.fuelComponentWeights ?? {};

  const annualCaloriesPerPerson = scenario.annualCaloriesPerPerson ?? context.constants.annualCaloriesPerPerson;
  const annualFirewoodKgPerHousehold = scenario.annualFirewoodKgPerHousehold ?? context.constants.annualFirewoodKgPerHousehold;
  const householdElectricityKwhPerPerson = context.constants?.energy?.householdElectricityKwhPerPerson ?? 1_300;

  const targetRentBurden = stressConstants.targetRentBurden ?? 0.3;
  const targetFoodBurden = stressConstants.targetFoodBurden ?? 0.2;
  const targetFuelBurden = stressConstants.targetFuelBurden ?? 0.1;
  const targetTransportBurden = stressConstants.targetTransportBurden ?? 0.15;
  const targetElectricityBurden = stressConstants.targetElectricityBurden ?? 0.08;
  const foodReserveTargetMonths = stressConstants.foodReserveTargetMonths ?? 3;
  const fuelReserveTargetMonths = stressConstants.fuelReserveTargetMonths ?? 4;
  const foodReserveShortfallWeight = stressConstants.foodReserveShortfallWeight ?? 0.6;
  const fuelReserveShortfallWeight = stressConstants.fuelReserveShortfallWeight ?? 0.5;
  const transportSystemStressWeight = stressConstants.transportSystemStressWeight ?? 0.35;

  const heatingFuelWeight = fuelComponentWeights.heating ?? 0.45;
  const transportFuelWeight = fuelComponentWeights.transport ?? 0.35;
  const electricityFuelWeight = fuelComponentWeights.electricity ?? 0.2;

  const migrationFoodWeight = migrationWeights.food ?? 0.35;
  const migrationHousingWeight = migrationWeights.housing ?? 0.25;
  const migrationTransportWeight = migrationWeights.transport ?? 0.2;
  const migrationFuelWeight = migrationWeights.fuel ?? 0.15;
  const migrationSocialRelief = migrationWeights.socialCohesionRelief ?? 0.1;
  const migrationLandRelief = migrationWeights.landAccessRelief ?? 0.1;

  const heatingDeficitPressure = context.energy?.heatingFuelDeficitPressure ?? 0;
  const transportFuelDeficitPressure = context.energy?.transportFuelDeficitPressure ?? 0;
  const electricityDeficitPressure = context.energy?.electricityDeficitPressure ?? 0;
  const unmetPassengerPressure = context.energy?.totalPassengerKmDemand > 0
    ? (context.energy.unmetPassengerKm ?? 0) / context.energy.totalPassengerKmDemand
    : 0;
  const unmetFreightPressure = context.energy?.totalFreightTonneKmDemand > 0
    ? (context.energy.unmetFreightTonneKm ?? 0) / context.energy.totalFreightTonneKmDemand
    : 0;
  const transportFodderPressure = context.energy?.transportFodderDemandKg > 0
    ? (context.energy.transportFodderDeficitKg ?? 0) / context.energy.transportFodderDemandKg
    : 0;
  const transportLabourPressure = context.energy?.transportLabourDemandDays > 0
    ? Math.min(1, (context.energy.transportLabourDemandDays ?? 0) / Math.max(1, world.households.length * 160))
    : 0;
  const averageEffectiveHeatDemand = context.energy?.averageEffectiveHeatDemandKwh ?? 1;

  const buildingById = new Map(world.buildings.map((building) => [building.id, building]));

  for (const household of world.households) {
    const totalIncome = Math.max(1, incomeOf(household));
    const settlement = world.settlements.find((candidate) => candidate.id === household.settlementId);
    const homeBuilding = buildingById.get(household.homeBuildingId);

    const annualFoodNeedCalories = household.people.total * annualCaloriesPerPerson;
    const foodTargetReserve = Math.max(1, annualFoodNeedCalories * (foodReserveTargetMonths / 12));
    const foodReserveCoverage = clamp01(household.reserves.calories / foodTargetReserve);
    const foodReserveShortfall = 1 - foodReserveCoverage;

    const annualFuelNeedKg = annualFirewoodKgPerHousehold;
    const fuelTargetReserve = Math.max(1, annualFuelNeedKg * (fuelReserveTargetMonths / 12));
    const fuelReserveCoverage = clamp01(household.reserves.firewoodKg / fuelTargetReserve);
    const fuelReserveShortfall = 1 - fuelReserveCoverage;

    const foodCostBurden = household.expenses.food / totalIncome;
    const fuelCostBurden = household.expenses.fuel / totalIncome;
    const rentBurden = household.expenses.housing / totalIncome;
    const electricityCostBurden = (household.people.total * householdElectricityKwhPerPerson * (world.markets[0]?.prices.electricityKwh ?? 0.2)) / totalIncome;

    const foodStress = clamp01(
      foodCostBurden / targetFoodBurden
      + context.localFoodDeficitPressure
      + foodReserveShortfall * foodReserveShortfallWeight
    );

    const effectiveHeatDemandKwh = homeBuilding?.metrics?.effectiveHeatDemandKwh ?? homeBuilding?.heatDemandKwhPerYear ?? 18_000;
    const heatDemandFactor = clamp01(effectiveHeatDemandKwh / Math.max(1, averageEffectiveHeatDemand));
    const systemSensitivity = heatingSensitivity(homeBuilding?.heatingSystem ?? 'mixed');

    const heatingFuelStress = clamp01(
      heatingDeficitPressure * (0.7 + 0.6 * heatDemandFactor) * systemSensitivity
      + (fuelCostBurden / targetFuelBurden) * 0.3
    );

    const transportFuelStress = clamp01(
      transportFuelDeficitPressure * (0.75 + 0.45 * household.access.vehicleAccess)
      + context.transportSystemStress * transportSystemStressWeight
      + unmetPassengerPressure * 0.18
      + unmetFreightPressure * 0.12
      + transportFodderPressure * 0.08
      + transportLabourPressure * 0.08
    );

    const electricityStress = clamp01(
      electricityDeficitPressure * (homeBuilding?.heatingSystem === 'electric' ? 1.1 : 0.85)
      + electricityCostBurden / targetElectricityBurden
    );

    const totalFuelStress = clamp01(
      heatingFuelWeight * heatingFuelStress
      + transportFuelWeight * transportFuelStress
      + electricityFuelWeight * electricityStress
    );

    const fuelStress = totalFuelStress;

    const housingStress = clamp01(rentBurden / targetRentBurden);

    const commuteToleranceCost = totalIncome * targetTransportBurden * (0.7 + household.preferences.commuteTolerance);
    const transportStress = clamp01(
      household.expenses.transport / Math.max(1, commuteToleranceCost)
      + context.transportSystemStress * transportSystemStressWeight
    );

    const landAccessResilience = clamp01(
      household.access.landHa * 0.08
      + household.access.tools * 0.25
      + household.access.draftPower * 0.25
      + household.access.machinePower * 0.2
    );

    const socialCohesion = settlement?.socialCohesion ?? 0.5;

    const migrationPressure = clamp01(
      migrationFoodWeight * foodStress
      + migrationHousingWeight * housingStress
      + migrationTransportWeight * transportStress
      + migrationFuelWeight * fuelStress
      - migrationSocialRelief * socialCohesion
      - migrationLandRelief * landAccessResilience
    );

    const totalStress = clamp01((foodStress + fuelStress + housingStress + transportStress) / 4);

    household.state.foodStress = foodStress;
    household.state.heatingFuelStress = heatingFuelStress;
    household.state.transportFuelStress = transportFuelStress;
    household.state.electricityStress = electricityStress;
    household.state.totalFuelStress = totalFuelStress;
    household.state.fuelStress = fuelStress;
    household.state.housingStress = housingStress;
    household.state.transportStress = transportStress;
    household.state.migrationPressure = migrationPressure;
    household.state.totalStress = totalStress;
    household.state.dominantStressReason = dominantStressReason(household);

    if (homeBuilding) {
      homeBuilding.metrics = {
        ...homeBuilding.metrics,
        energyStressIndicator: clamp01((heatingFuelStress + transportFuelStress + electricityStress) / 3)
      };
    }
  }

  const averageFoodStress = average(world.households.map((household) => household.state.foodStress), 0);
  const averageFuelStress = average(world.households.map((household) => household.state.fuelStress), 0);
  const averageHeatingFuelStress = average(world.households.map((household) => household.state.heatingFuelStress), 0);
  const averageTransportFuelStress = average(world.households.map((household) => household.state.transportFuelStress), 0);
  const averageElectricityStress = average(world.households.map((household) => household.state.electricityStress), 0);
  const averageTotalFuelStress = average(world.households.map((household) => household.state.totalFuelStress), 0);
  const averageHousingStress = average(world.households.map((household) => household.state.housingStress), 0);
  const averageTransportStress = average(world.households.map((household) => household.state.transportStress), 0);
  const averageMigrationPressure = average(world.households.map((household) => household.state.migrationPressure), 0);
  const averageTotalStress = average(world.households.map((household) => household.state.totalStress), 0);

  return {
    averageFoodStress,
    averageFuelStress,
    averageHeatingFuelStress,
    averageTransportFuelStress,
    averageElectricityStress,
    averageTotalFuelStress,
    averageHousingStress,
    averageTransportStress,
    averageMigrationPressure,
    averageTotalStress,
    averageHouseholdStress: averageTotalStress
  };
}
