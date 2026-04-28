// SPDX-License-Identifier: AGPL-3.0-or-later
import { demoScenarioNoAdaptation, createDemoWorld, runScenario } from '../program/index.mjs';

const world = createDemoWorld();
const scenario = demoScenarioNoAdaptation();

const { years } = runScenario(world, scenario);

const rows = years.map((item) => ({
  year: item.year,
  population: Math.round(item.populationTotal),
  urbanPop: Math.round(item.populationUrban),
  ruralPop: Math.round(item.populationRural),
  localFoodCoverageRatio: Number(item.localFoodCoverageRatio.toFixed(2)),
  foodSurplusCalories: Math.round(item.foodSurplusCalories),
  percentAvailableLabourDemandedByFood: Number(item.percentAvailableLabourDemandedByFood.toFixed(2)),
  foodLabourUnmetDays: Math.round(item.foodLabourUnmetDays),
  averageHouseholdStress: Number(item.averageHouseholdStress.toFixed(2)),
  averageCommuteCost: Number(item.averageCommuteCost.toFixed(2)),
  averageRent: Number(item.averageRent.toFixed(2)),
  urbanToRuralMoves: item.urbanToRuralMoves,
  netMigration: item.netMigration,
  fuelDeficitKg: Math.round(item.fuelDeficitKg),
  infrastructureCondition: Number(item.infrastructureAverageCondition.toFixed(3))
}));

console.table(rows);
