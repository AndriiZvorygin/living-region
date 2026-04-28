// SPDX-License-Identifier: AGPL-3.0-or-later
import { runAdaptation, runNoAdaptation } from './scenario_helpers.mjs';

const noAdapt = runNoAdaptation().finalYear;
const adapt = runAdaptation().finalYear;

const rows = [
  {
    scenario: 'No Adaptation',
    population: Math.round(noAdapt.populationTotal),
    foodCoverage: Number(noAdapt.localFoodCoverageRatio.toFixed(2)),
    foodSurplusCalories: Math.round(noAdapt.foodSurplusCalories),
    averageStress: Number(noAdapt.averageTotalStress.toFixed(2)),
    transportFuelStress: Number(noAdapt.averageTransportFuelStress.toFixed(2)),
    roadMaintenanceDemandMoney: Math.round(noAdapt.roadMaintenanceDemandMoney),
    roadMaintenanceBacklogMoney: Math.round(noAdapt.roadMaintenanceBacklogMoney),
    roadConditionAverage: Number((noAdapt.roadConditionAverage ?? 0).toFixed(3)),
    railMaintenanceDemandMoney: Math.round(noAdapt.railMaintenanceDemandMoney ?? 0),
    railMaintenanceBacklogMoney: Math.round(noAdapt.railMaintenanceBacklogMoney ?? 0),
    railConditionAverage: Number((noAdapt.railConditionAverage ?? 0).toFixed(3)),
    railPassengerKm: Math.round(noAdapt.railPassengerKm ?? 0),
    railFreightTonneKm: Math.round(noAdapt.railFreightTonneKm ?? 0),
    railUtilizationRatio: Number((noAdapt.railUtilizationRatio ?? 0).toFixed(3)),
    transportDieselDemandLitre: Math.round(noAdapt.transportDieselDemandLitre ?? 0),
    nonDieselPassengerKm: Math.round(noAdapt.nonDieselPassengerKm ?? 0),
    gasolineBreakEvenPriceForTransitPerLitre: Number((noAdapt.gasolineBreakEvenPriceForTransitPerLitre ?? 0).toFixed(2)),
    privateIceCostPerKm: Number((noAdapt.privateIceCostPerKm ?? 0).toFixed(2)),
    publicTransitCostPerPassengerKm: Number((noAdapt.publicTransitCostPerPassengerKm ?? 0).toFixed(2)),
    averageCarDependenceCostBurden: Number((noAdapt.averageCarDependenceCostBurden ?? 0).toFixed(2)),
    avoidedRoadMaintenanceFromRailShift: Math.round(noAdapt.avoidedRoadMaintenanceFromRailShift ?? 0)
  },
  {
    scenario: 'Adaptation',
    population: Math.round(adapt.populationTotal),
    foodCoverage: Number(adapt.localFoodCoverageRatio.toFixed(2)),
    foodSurplusCalories: Math.round(adapt.foodSurplusCalories),
    averageStress: Number(adapt.averageTotalStress.toFixed(2)),
    transportFuelStress: Number(adapt.averageTransportFuelStress.toFixed(2)),
    roadMaintenanceDemandMoney: Math.round(adapt.roadMaintenanceDemandMoney),
    roadMaintenanceBacklogMoney: Math.round(adapt.roadMaintenanceBacklogMoney),
    roadConditionAverage: Number((adapt.roadConditionAverage ?? 0).toFixed(3)),
    railMaintenanceDemandMoney: Math.round(adapt.railMaintenanceDemandMoney ?? 0),
    railMaintenanceBacklogMoney: Math.round(adapt.railMaintenanceBacklogMoney ?? 0),
    railConditionAverage: Number((adapt.railConditionAverage ?? 0).toFixed(3)),
    railPassengerKm: Math.round(adapt.railPassengerKm ?? 0),
    railFreightTonneKm: Math.round(adapt.railFreightTonneKm ?? 0),
    railUtilizationRatio: Number((adapt.railUtilizationRatio ?? 0).toFixed(3)),
    transportDieselDemandLitre: Math.round(adapt.transportDieselDemandLitre ?? 0),
    nonDieselPassengerKm: Math.round(adapt.nonDieselPassengerKm ?? 0),
    gasolineBreakEvenPriceForTransitPerLitre: Number((adapt.gasolineBreakEvenPriceForTransitPerLitre ?? 0).toFixed(2)),
    privateIceCostPerKm: Number((adapt.privateIceCostPerKm ?? 0).toFixed(2)),
    publicTransitCostPerPassengerKm: Number((adapt.publicTransitCostPerPassengerKm ?? 0).toFixed(2)),
    averageCarDependenceCostBurden: Number((adapt.averageCarDependenceCostBurden ?? 0).toFixed(2)),
    avoidedRoadMaintenanceFromRailShift: Math.round(adapt.avoidedRoadMaintenanceFromRailShift ?? 0)
  }
];

console.table(rows);
