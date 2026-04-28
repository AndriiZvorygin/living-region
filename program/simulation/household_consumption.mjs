// SPDX-License-Identifier: AGPL-3.0-or-later
import { clamp } from '../util/math.mjs';

const BASE_SPOILAGE_RATE = 0.08;

export function applyHouseholdConsumption(world, scenario, context) {
  const populationTotal = world.households.reduce((sum, household) => sum + household.people.total, 0);
  const annualCaloriesPerPerson = scenario.annualCaloriesPerPerson ?? context.constants?.annualCaloriesPerPerson ?? 900_000;
  const annualFirewoodKgPerHousehold = scenario.annualFirewoodKgPerHousehold ?? context.constants?.annualFirewoodKgPerHousehold ?? 4_500;

  const consumedCalories = populationTotal * annualCaloriesPerPerson;
  const firewoodDemandKg = world.households.length * annualFirewoodKgPerHousehold;

  const spoilageReduction = world.infrastructures.reduce((sum, infrastructure) => sum + infrastructure.effects.spoilageReduction, 0);
  const spoilageRate = clamp(BASE_SPOILAGE_RATE - spoilageReduction, 0.01, 0.2);

  const caloriesAfterSpoilage = context.effectiveProducedCalories * (1 - spoilageRate);
  const foodSurplusCalories = caloriesAfterSpoilage - consumedCalories;

  const firewoodAvailableKg = context.producedWoodKg + world.households.reduce((sum, household) => sum + household.reserves.firewoodKg, 0);
  const fuelDeficitKg = Math.max(0, firewoodDemandKg - firewoodAvailableKg);

  for (const household of world.households) {
    const foodExpense = household.people.total * annualCaloriesPerPerson * (world.markets[0]?.prices.foodCalories ?? 0.0004);
    const fuelExpense = annualFirewoodKgPerHousehold * (world.markets[0]?.prices.firewoodKg ?? 0.2);

    household.expenses.food = foodExpense;
    household.expenses.fuel = fuelExpense;

    household.reserves.calories = Math.max(0, household.reserves.calories + (foodSurplusCalories / world.households.length));
    household.reserves.firewoodKg = Math.max(0, household.reserves.firewoodKg - (annualFirewoodKgPerHousehold - context.producedWoodKg / world.households.length));
  }

  const localFoodCoverageRatio = consumedCalories > 0 ? context.effectiveProducedCalories / consumedCalories : 1;
  const localFoodDeficitPressure = consumedCalories > 0 ? clamp(-foodSurplusCalories / consumedCalories, 0, 1) : 0;
  const fuelDeficitPressure = firewoodDemandKg > 0 ? clamp(fuelDeficitKg / firewoodDemandKg, 0, 1) : 0;
  const foodDeficitPerPerson = populationTotal > 0 ? Math.max(0, -foodSurplusCalories) / populationTotal : 0;

  return {
    populationTotal,
    consumedCalories,
    foodSurplusCalories,
    fuelDeficitKg,
    spoilageRate,
    localFoodCoverageRatio,
    localFoodDeficitPressure,
    fuelDeficitPressure,
    foodDeficitPerPerson
  };
}
