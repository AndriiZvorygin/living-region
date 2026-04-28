// SPDX-License-Identifier: AGPL-3.0-or-later
import { safeDivide } from '../util/math.mjs';

const MODE_COEFFICIENTS = {
  mechanizedIndustrial: { labourDaysPerHa: 20, fuelLitresPerHa: 125, inputCostPerHa: 900, toolCostPerHa: 70, machineryFixedCostPerHa: 500, storageCostPerGJ: 6, expectedFoodEnergyGJPerHa: 68 },
  lowInputMechanized: { labourDaysPerHa: 32, fuelLitresPerHa: 55, inputCostPerHa: 420, toolCostPerHa: 95, machineryFixedCostPerHa: 340, storageCostPerGJ: 5.2, expectedFoodEnergyGJPerHa: 50 },
  marketGardenLabourIntensive: { labourDaysPerHa: 135, fuelLitresPerHa: 15, inputCostPerHa: 280, toolCostPerHa: 190, machineryFixedCostPerHa: 70, storageCostPerGJ: 4.8, expectedFoodEnergyGJPerHa: 58 },
  householdGarden: { labourDaysPerHa: 180, fuelLitresPerHa: 4, inputCostPerHa: 160, toolCostPerHa: 140, machineryFixedCostPerHa: 18, storageCostPerGJ: 4.2, expectedFoodEnergyGJPerHa: 40 },
  cooperativeSmallFarm: { labourDaysPerHa: 92, fuelLitresPerHa: 24, inputCostPerHa: 260, toolCostPerHa: 150, machineryFixedCostPerHa: 140, storageCostPerGJ: 4.7, expectedFoodEnergyGJPerHa: 52 },
  perennialOrchardNut: { labourDaysPerHa: 50, fuelLitresPerHa: 18, inputCostPerHa: 240, toolCostPerHa: 100, machineryFixedCostPerHa: 85, storageCostPerGJ: 3.3, expectedFoodEnergyGJPerHa: 33 },
  mixedAgroforestry: { labourDaysPerHa: 62, fuelLitresPerHa: 11, inputCostPerHa: 190, toolCostPerHa: 92, machineryFixedCostPerHa: 68, storageCostPerGJ: 3.6, expectedFoodEnergyGJPerHa: 29 }
};

function costPerGJ(mode, labourValuePerDay, prices) {
  const perHaCost = mode.labourDaysPerHa * labourValuePerDay
    + mode.fuelLitresPerHa * prices.dieselPricePerLitre
    + mode.inputCostPerHa * prices.fertilizerCostIndex
    + mode.toolCostPerHa
    + mode.machineryFixedCostPerHa * prices.machineryCostIndex;
  return safeDivide(perHaCost, Math.max(1, mode.expectedFoodEnergyGJPerHa), 999_999) + mode.storageCostPerGJ;
}

function dieselBreakEvenPrice(baseMode, altMode, baseLabourValuePerDay, altLabourValuePerDay, prices) {
  const numerator = (altMode.labourDaysPerHa * altLabourValuePerDay - baseMode.labourDaysPerHa * baseLabourValuePerDay)
    + (altMode.inputCostPerHa - baseMode.inputCostPerHa) * prices.fertilizerCostIndex
    + (altMode.toolCostPerHa - baseMode.toolCostPerHa)
    + (altMode.machineryFixedCostPerHa - baseMode.machineryFixedCostPerHa) * prices.machineryCostIndex;
  const denominator = Math.max(1, baseMode.fuelLitresPerHa - altMode.fuelLitresPerHa);
  return safeDivide(numerator, denominator, prices.dieselPricePerLitre);
}

export function calculateProductionCostThresholds(constants = {}, prices = {}) {
  const dieselPricePerLitre = prices.dieselPricePerLitre ?? 1.56;
  const fertilizerCostIndex = prices.fertilizerCostIndex ?? 1;
  const machineryCostIndex = prices.machineryCostIndex ?? 1;
  const wageOrLabourOpportunityCostPerDay = prices.wageOrLabourOpportunityCostPerDay ?? 130;
  const householdSubsistenceLabourValuePerDay = prices.householdSubsistenceLabourValuePerDay ?? Math.max(18, wageOrLabourOpportunityCostPerDay * 0.32);
  const cooperativeLabourValuePerDay = prices.cooperativeLabourValuePerDay ?? Math.max(28, wageOrLabourOpportunityCostPerDay * 0.5);
  const foodPricePerGJ = prices.foodPricePerGJ ?? 220;

  const labourValues = {
    marketWageLabour: wageOrLabourOpportunityCostPerDay,
    householdSubsistenceLabour: householdSubsistenceLabourValuePerDay,
    cooperativeLabour: cooperativeLabourValuePerDay
  };

  const productionCostPerGJByMode = {};
  let cheapestProductionMode = 'householdGarden';
  let cheapestCost = Number.POSITIVE_INFINITY;

  for (const [mode, coef] of Object.entries(MODE_COEFFICIENTS)) {
    const labourValue = mode === 'householdGarden'
      ? labourValues.householdSubsistenceLabour
      : (mode === 'cooperativeSmallFarm' ? labourValues.cooperativeLabour : labourValues.marketWageLabour);
    const modeCost = costPerGJ(coef, labourValue, { dieselPricePerLitre, fertilizerCostIndex, machineryCostIndex });
    productionCostPerGJByMode[mode] = Number.isFinite(modeCost) && modeCost > 0 ? modeCost : 999_999;
    if (productionCostPerGJByMode[mode] < cheapestCost) {
      cheapestCost = productionCostPerGJByMode[mode];
      cheapestProductionMode = mode;
    }
  }

  const dieselPriceThresholdForMarketGardenAtMarketWage = dieselBreakEvenPrice(
    MODE_COEFFICIENTS.mechanizedIndustrial,
    MODE_COEFFICIENTS.marketGardenLabourIntensive,
    labourValues.marketWageLabour,
    labourValues.marketWageLabour,
    { dieselPricePerLitre, fertilizerCostIndex, machineryCostIndex }
  );

  const dieselPriceThresholdForHouseholdGardenAtSubsistenceLabour = dieselBreakEvenPrice(
    MODE_COEFFICIENTS.lowInputMechanized,
    MODE_COEFFICIENTS.householdGarden,
    labourValues.marketWageLabour,
    labourValues.householdSubsistenceLabour,
    { dieselPricePerLitre, fertilizerCostIndex, machineryCostIndex }
  );

  const dieselPriceThresholdForCooperativeSmallFarm = dieselBreakEvenPrice(
    MODE_COEFFICIENTS.lowInputMechanized,
    MODE_COEFFICIENTS.cooperativeSmallFarm,
    labourValues.marketWageLabour,
    labourValues.cooperativeLabour,
    { dieselPricePerLitre, fertilizerCostIndex, machineryCostIndex }
  );

  const fertilizerCostThresholdForLowInput = safeDivide(
    (MODE_COEFFICIENTS.lowInputMechanized.labourDaysPerHa - MODE_COEFFICIENTS.mechanizedIndustrial.labourDaysPerHa) * labourValues.marketWageLabour
      + (MODE_COEFFICIENTS.lowInputMechanized.fuelLitresPerHa - MODE_COEFFICIENTS.mechanizedIndustrial.fuelLitresPerHa) * dieselPricePerLitre
      + (MODE_COEFFICIENTS.lowInputMechanized.machineryFixedCostPerHa - MODE_COEFFICIENTS.mechanizedIndustrial.machineryFixedCostPerHa) * machineryCostIndex,
    Math.max(1, MODE_COEFFICIENTS.mechanizedIndustrial.inputCostPerHa - MODE_COEFFICIENTS.lowInputMechanized.inputCostPerHa),
    1
  );

  const machineryCostThresholdForSmallScale = safeDivide(
    (MODE_COEFFICIENTS.cooperativeSmallFarm.labourDaysPerHa * labourValues.cooperativeLabour
      - MODE_COEFFICIENTS.lowInputMechanized.labourDaysPerHa * labourValues.marketWageLabour)
      + (MODE_COEFFICIENTS.cooperativeSmallFarm.fuelLitresPerHa - MODE_COEFFICIENTS.lowInputMechanized.fuelLitresPerHa) * dieselPricePerLitre
      + (MODE_COEFFICIENTS.cooperativeSmallFarm.inputCostPerHa - MODE_COEFFICIENTS.lowInputMechanized.inputCostPerHa) * fertilizerCostIndex,
    Math.max(1, MODE_COEFFICIENTS.lowInputMechanized.machineryFixedCostPerHa - MODE_COEFFICIENTS.cooperativeSmallFarm.machineryFixedCostPerHa),
    1
  );

  const foodPriceThresholdForHouseholdProduction = productionCostPerGJByMode.householdGarden;
  const breakEvenGardenAreaM2PerHousehold = safeDivide(8.2, MODE_COEFFICIENTS.householdGarden.expectedFoodEnergyGJPerHa, 0.2) * 10_000;
  const breakEvenFarmAccessHaPerHousehold = safeDivide(8.2, MODE_COEFFICIENTS.cooperativeSmallFarm.expectedFoodEnergyGJPerHa, 0.2);

  const labourIntensiveBeatsMechanized = productionCostPerGJByMode.householdGarden < productionCostPerGJByMode.lowInputMechanized
    || productionCostPerGJByMode.cooperativeSmallFarm < productionCostPerGJByMode.lowInputMechanized;

  return {
    productionCostPerGJByMode,
    cheapestProductionMode,
    labourIntensiveBeatsMechanized,
    dieselPriceThresholdForLabourIntensive: dieselPriceThresholdForMarketGardenAtMarketWage,
    dieselPriceThresholdForMarketGardenAtMarketWage,
    dieselPriceThresholdForHouseholdGardenAtSubsistenceLabour,
    dieselPriceThresholdForCooperativeSmallFarm,
    fertilizerCostThresholdForLowInput,
    machineryCostThresholdForSmallScale,
    foodPriceThresholdForHouseholdProduction,
    breakEvenGardenAreaM2PerHousehold,
    breakEvenFarmAccessHaPerHousehold,
    modeCoefficients: MODE_COEFFICIENTS,
    labourValues,
    foodPricePerGJ,
    fertilizerCostIndex,
    machineryCostIndex
  };
}
