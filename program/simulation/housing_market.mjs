// SPDX-License-Identifier: AGPL-3.0-or-later
import { average, clamp, safeDivide } from '../util/math.mjs';

function housingDefaults(constants) {
  const c = constants?.housing ?? {};
  return {
    minRentPerMonth: c.minRentPerMonth ?? 450,
    maxNormalRentPerMonth: c.maxNormalRentPerMonth ?? 3_500,
    warningRentPerMonth: c.warningRentPerMonth ?? 4_000,
    criticalRentPerMonth: c.criticalRentPerMonth ?? 8_000,
    maxAnnualRentGrowthRate: c.maxAnnualRentGrowthRate ?? 0.1,
    maxRentPressureMultiplier: c.maxRentPressureMultiplier ?? 2.4,
    targetVacancyRate: c.targetVacancyRate ?? 0.06,
    rentPressureSensitivity: c.rentPressureSensitivity ?? 0.07,
    transportStressRentDiscount: c.transportStressRentDiscount ?? 0.09,
    energyStressRentDiscount: c.energyStressRentDiscount ?? 0.07,
    serviceAccessRentPremium: c.serviceAccessRentPremium ?? 0.12,
    rentConvergenceRate: c.rentConvergenceRate ?? 0.4,
    targetHousingCostBurden: c.targetHousingCostBurden ?? 0.3
  };
}

// Monthly rent model. Inputs are explicitly monthly $ or dimensionless ratios.
export function calculateRentPerMonth({
  currentRentPerMonth,
  baseRentPerMonth,
  rentPressure,
  vacancyRate,
  serviceAccess,
  transportStress,
  buildingCondition,
  energyStress,
  constants
}) {
  const c = housingDefaults(constants);
  const safeCurrentRent = Math.max(c.minRentPerMonth, currentRentPerMonth ?? baseRentPerMonth ?? c.minRentPerMonth);
  const safeBaseRent = Math.max(c.minRentPerMonth, baseRentPerMonth ?? safeCurrentRent);

  const cappedRentPressure = clamp(rentPressure, 0.6, c.maxRentPressureMultiplier);
  const pressureMultiplier = 1 + (cappedRentPressure - 1) * c.rentPressureSensitivity;

  const vacancyDelta = safeDivide(c.targetVacancyRate - vacancyRate, Math.max(0.01, c.targetVacancyRate), 0);
  const vacancyMultiplier = clamp(1 + vacancyDelta * 0.08, 0.88, 1.18);

  const accessMultiplier = 1 + clamp(serviceAccess, 0, 1) * c.serviceAccessRentPremium;
  const stressDiscount = clamp(
    1 - transportStress * c.transportStressRentDiscount - energyStress * c.energyStressRentDiscount,
    0.8,
    1
  );
  const conditionMultiplier = clamp(0.8 + buildingCondition * 0.3, 0.8, 1.08);

  const targetRentPerMonth = clamp(
    safeBaseRent * pressureMultiplier * vacancyMultiplier * accessMultiplier * stressDiscount * conditionMultiplier,
    c.minRentPerMonth,
    c.maxNormalRentPerMonth
  );

  const unconstrained = safeCurrentRent + (targetRentPerMonth - safeCurrentRent) * c.rentConvergenceRate;
  const maxIncrease = safeCurrentRent * (1 + c.maxAnnualRentGrowthRate);
  const maxDecrease = safeCurrentRent * (1 - c.maxAnnualRentGrowthRate);
  const bounded = clamp(unconstrained, maxDecrease, maxIncrease);

  return clamp(bounded, c.minRentPerMonth, c.criticalRentPerMonth);
}

export function updateHousingMarket(world, context) {
  const constants = context.constants ?? {};
  const c = housingDefaults(constants);

  const householdCount = world.households.length;
  const population = world.households.reduce((sum, household) => sum + household.people.total, 0);
  const targetHouseholdSize = 2.8;
  const requiredUnits = population / targetHouseholdSize;

  const residentialBuildings = world.buildings.filter((building) => building.dwellingUnits > 0);
  const totalUnits = residentialBuildings.reduce((sum, building) => sum + building.dwellingUnits, 0);
  const occupiedUnits = residentialBuildings.reduce((sum, building) => sum + Math.min(building.occupiedUnits, building.dwellingUnits), 0);
  const vacantUnits = Math.max(0, totalUnits - occupiedUnits);
  const vacancyRate = totalUnits > 0 ? vacantUnits / totalUnits : 0;

  const avgMarketAccess = average(world.households.map((household) => household.access.marketAccess), 0.5);
  const avgServiceAccess = average(world.infrastructures.map((infra) => infra.effects.serviceAccessBonus), 0.2);
  const avgEmploymentAccess = average(world.households.map((household) => household.skills.trade), 0.5);
  const avgTransportStress = average(world.households.map((household) => household.state.transportStress), 0.2);
  const avgFoodFuelStress = average(world.households.map((household) => (household.state.foodStress + household.state.fuelStress) / 2), 0.2);
  const avgInfrastructure = average(world.infrastructures.map((infra) => infra.condition), 0.7);
  const avgEnergyStress = average(world.households.map((household) => household.state.totalFuelStress ?? household.state.fuelStress), 0.2);
  const inMigrationPressure = clamp(average(world.households.map((household) => household.state.migrationPressure), 0.1), 0, 1.5);

  const demandGrowthFactor = clamp(
    1
      + 0.2 * inMigrationPressure
      + 0.13 * avgMarketAccess
      + 0.11 * avgServiceAccess
      + 0.07 * avgEmploymentAccess
      - 0.18 * avgTransportStress
      - 0.15 * avgFoodFuelStress
      - 0.08 * (1 - avgInfrastructure),
    0.78,
    1.35
  );

  const housingDemand = Math.max(1, requiredUnits * demandGrowthFactor);
  // Dimensionless pressure; high values indicate shortage and should impact stress,
  // but rent growth remains bounded by maxAnnualRentGrowthRate.
  const rentPressure = housingDemand / Math.max(1, vacantUnits);
  const cappedRentPressure = clamp(rentPressure, 0.5, c.maxRentPressureMultiplier);

  for (const building of residentialBuildings) {
    building.baseRentPerMonth = building.baseRentPerMonth ?? building.rentPerMonth ?? c.minRentPerMonth;
    const oldRent = building.rentPerMonth ?? building.baseRentPerMonth;
    const newRent = calculateRentPerMonth({
      currentRentPerMonth: oldRent,
      baseRentPerMonth: building.baseRentPerMonth,
      rentPressure: cappedRentPressure,
      vacancyRate,
      serviceAccess: avgServiceAccess,
      transportStress: avgTransportStress,
      buildingCondition: building.condition ?? 0.7,
      energyStress: avgEnergyStress,
      constants
    });
    building.rentPerMonth = newRent;
    building.metrics = {
      ...(building.metrics ?? {}),
      annualRentGrowthRate: safeDivide(newRent - oldRent, Math.max(1, oldRent), 0),
      rentPressure,
      cappedRentPressure,
      vacancyRate
    };
  }

  const buildingById = new Map(world.buildings.map((building) => [building.id, building]));
  const householdIncomes = [];
  const householdHousingBurdens = [];
  let householdsHousingStressed = 0;
  for (const household of world.households) {
    const home = buildingById.get(household.homeBuildingId);
    const rentPerMonth = home?.rentPerMonth ?? c.minRentPerMonth;
    const annualHousingCost = rentPerMonth * 12;
    household.expenses.housing = annualHousingCost;
    const annualIncome = Math.max(1, household.income.wageIncome
      + household.income.farmIncome
      + household.income.transferIncome
      + household.income.enterpriseIncome);
    const burden = annualHousingCost / annualIncome;
    householdIncomes.push(annualIncome);
    householdHousingBurdens.push(burden);
    if (burden > c.targetHousingCostBurden) {
      householdsHousingStressed += 1;
    }
  }

  const occupiedWeightedRent = residentialBuildings.reduce(
    (sum, building) => sum + building.rentPerMonth * Math.max(0, Math.min(building.occupiedUnits, building.dwellingUnits)),
    0
  );
  const occupiedUnitWeight = Math.max(1, occupiedUnits);
  // Monthly dollars per occupied rental-equivalent dwelling unit.
  const averageRent = occupiedWeightedRent / occupiedUnitWeight;
  const baseAverageRent = residentialBuildings.length > 0
    ? average(residentialBuildings.map((building) => building.baseRentPerMonth ?? building.rentPerMonth), c.minRentPerMonth)
    : c.minRentPerMonth;
  const averageAnnualHousingCost = averageRent * 12;
  const averageHouseholdIncome = average(householdIncomes, 0);
  const averageHousingCostBurden = average(householdHousingBurdens, 0);
  const averageEstimatedBuildingValue = average(
    residentialBuildings.map((building) => building.estimatedValue ?? 0),
    0
  );
  const occupiedWeightedEstimatedValuePerDwelling = residentialBuildings.reduce((sum, building) => {
    const occupied = Math.max(0, Math.min(building.occupiedUnits, building.dwellingUnits));
    const valuePerDwelling = safeDivide(building.estimatedValue ?? 0, Math.max(1, building.dwellingUnits), 0);
    return sum + valuePerDwelling * occupied;
  }, 0);
  // Capital value per occupied dwelling-equivalent unit; comparable to monthly rent-per-dwelling.
  const averageEstimatedValue = safeDivide(occupiedWeightedEstimatedValuePerDwelling, occupiedUnitWeight, 0);
  // Capital value divided by one month of rent (raw diagnostic only).
  const valueToMonthlyRentRatio = safeDivide(averageEstimatedValue, Math.max(1, averageRent), 0);
  // Main valuation diagnostic: price-to-annual-rent ratio (dimensionless).
  const priceToAnnualRentRatio = safeDivide(averageEstimatedValue, Math.max(1, averageAnnualHousingCost), 0);
  const householdsExceedingUnits = Math.max(0, householdCount - totalUnits);

  return {
    housingDemand,
    occupiedUnits,
    vacantUnits,
    vacantDwellingUnits: vacantUnits,
    rentPressure,
    baseAverageRent,
    averageRent,
    averageAnnualHousingCost,
    averageHouseholdIncome,
    averageHousingCostBurden,
    householdsHousingStressed,
    householdsExceedingUnits,
    totalUnits,
    households: householdCount,
    dwellingUnits: totalUnits,
    valueToMonthlyRentRatio,
    priceToAnnualRentRatio,
    // Backward-compatible alias. Prefer `priceToAnnualRentRatio`.
    valueToRentRatio: priceToAnnualRentRatio,
    averageEstimatedValue,
    averageEstimatedBuildingValue,
    housingVacancyRate: vacancyRate
  };
}
