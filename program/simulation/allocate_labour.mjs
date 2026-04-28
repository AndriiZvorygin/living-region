// SPDX-License-Identifier: AGPL-3.0-or-later
import { average, clamp, safeDivide } from '../util/math.mjs';

export function allocateLabour(world, production, context) {
  const labourConstants = context.constants?.labour ?? {};
  const workDaysPerWorker = labourConstants.workDaysPerWorker ?? 220;
  const careDaysPerDependent = labourConstants.careDaysPerDependent ?? 25;
  const fuelLabourDaysPerHousehold = labourConstants.fuelLabourDaysPerHousehold ?? 10;
  const dieselMechanizationPenalty = labourConstants.dieselMechanizationPenalty ?? 0.8;
  const machinePowerRelief = labourConstants.machinePowerRelief ?? 0.6;
  const fuelLabourDieselPenalty = labourConstants.fuelLabourDieselPenalty ?? 2.2;
  const transportLabourDemandDays = context.transportLabourDemandDays ?? labourConstants.transportLabourDemandDays ?? 0;

  const labourAvailableDays = world.households.reduce((sum, household) => {
    const healthFactor = clamp(household.state.health, 0.4, 1);
    return sum + (household.people.workers * workDaysPerWorker * healthFactor);
  }, 0);

  const averageMachinePower = average(world.households.map((household) => household.access.machinePower), 0.3);
  const dieselScarcity = 1 - context.dieselAvailability;
  const foodLabourMechanizationPenalty = 1 + (dieselScarcity * dieselMechanizationPenalty * (1 - averageMachinePower * machinePowerRelief));

  const foodLabourDemandDays = production.labourDemandFoodDays * foodLabourMechanizationPenalty;
  const labourDemandFuelDays = world.households.length * fuelLabourDaysPerHousehold * (1 + (1 - context.dieselAvailability) * fuelLabourDieselPenalty);
  const labourDemandMaintenanceDays = world.infrastructures.reduce((sum, infrastructure) => sum + infrastructure.maintenance.labourDaysPerYear, 0);
  const labourDemandCareDays = world.households.reduce((sum, household) => sum + household.people.dependents * careDaysPerDependent, 0);
  const labourDemandTransportDays = transportLabourDemandDays;

  const totalLabourDemandDays = foodLabourDemandDays + labourDemandFuelDays + labourDemandMaintenanceDays + labourDemandCareDays + labourDemandTransportDays;
  const supplyRatio = clamp(safeDivide(labourAvailableDays, totalLabourDemandDays, 1), 0, 1);

  const foodLabourSuppliedDays = foodLabourDemandDays * supplyRatio;
  const suppliedMaintenanceDays = labourDemandMaintenanceDays * supplyRatio;
  const suppliedFuelDays = labourDemandFuelDays * supplyRatio;
  const suppliedCareDays = labourDemandCareDays * supplyRatio;
  const suppliedTransportDays = labourDemandTransportDays * supplyRatio;

  const foodHarvestFactor = clamp(safeDivide(foodLabourSuppliedDays, foodLabourDemandDays, 1), 0, 1);
  const labourDeficitDays = Math.max(0, totalLabourDemandDays - labourAvailableDays);
  const foodLabourUnmetDays = Math.max(0, foodLabourDemandDays - foodLabourSuppliedDays);
  const labourUnmetTransportDays = Math.max(0, labourDemandTransportDays - suppliedTransportDays);

  const percentAvailableLabourDemandedByFood = labourAvailableDays > 0 ? (foodLabourDemandDays / labourAvailableDays) * 100 : 0;
  const percentAvailableLabourSuppliedToFood = labourAvailableDays > 0 ? (foodLabourSuppliedDays / labourAvailableDays) * 100 : 0;
  const percentTotalLabourDemandFromFood = totalLabourDemandDays > 0 ? (foodLabourDemandDays / totalLabourDemandDays) * 100 : 0;
  // Kept for compact reporting compatibility; explicitly defined as supplied food labour
  // as a share of available labour.
  const percentLabourInFood = percentAvailableLabourSuppliedToFood;
  const percentLabourInMaintenance = labourAvailableDays > 0 ? (suppliedMaintenanceDays / labourAvailableDays) * 100 : 0;
  const labourCoverageRatio = safeDivide(labourAvailableDays, totalLabourDemandDays, 1);

  return {
    labourAvailableDays,
    labourCoverageRatio,
    totalLabourDemandDays,
    foodLabourDemandDays,
    foodLabourSuppliedDays,
    foodLabourUnmetDays,
    percentAvailableLabourDemandedByFood,
    percentAvailableLabourSuppliedToFood,
    percentTotalLabourDemandFromFood,
    labourDemandFuelDays,
    labourDemandMaintenanceDays,
    labourDemandCareDays,
    labourDemandTransportDays,
    labourUnmetTransportDays,
    labourDeficitDays,
    percentLabourInFood,
    percentLabourInMaintenance,
    suppliedFoodDays: foodLabourSuppliedDays,
    suppliedFuelDays,
    suppliedMaintenanceDays,
    suppliedCareDays,
    suppliedTransportDays,
    foodHarvestFactor
  };
}
