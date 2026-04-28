// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { createWorld } from '../program/model/world.mjs';
import { generateGreyCountyWorld } from '../program/data/generate_grey_county_world.mjs';
import { runScenario } from '../program/simulation/run_scenario.mjs';
import { demoScenarioAdaptation, demoScenarioAdaptationWithRailFreightCorridor } from '../program/data/demo_scenario.mjs';

function parseArgs(argv) {
  const args = {};
  for (const item of argv) {
    if (!item.startsWith('--')) {
      continue;
    }
    const [key, value] = item.slice(2).split('=');
    args[key] = value ?? true;
  }
  return args;
}

function toBool(value, fallback = false) {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function fmt(value, digits = 2) {
  return Number(value ?? 0).toFixed(digits);
}

function scaleSuffix(scale) {
  return scale === 'full-county' ? '-full' : '';
}

const args = parseArgs(process.argv.slice(2));
const railMode = toBool(args.rail, false);
const scale = args.scale ?? 'small';
const outputDir = path.resolve('know/produce');

const suffix = scaleSuffix(scale);
const worldPath = railMode
  ? path.join(outputDir, `grey-county-seed-world-rail${suffix}.json`)
  : path.join(outputDir, `grey-county-seed-world${suffix}.json`);

let world;
if (fs.existsSync(worldPath)) {
  const data = JSON.parse(fs.readFileSync(worldPath, 'utf8'));
  world = createWorld(data);
  world.seedMeta = data.seedMeta;
} else {
  world = generateGreyCountyWorld({
    scale,
    includeRail: railMode,
    includeWaterFreight: railMode,
    includeSyntheticPolygons: true
  });
}

const scenario = railMode
  ? demoScenarioAdaptationWithRailFreightCorridor()
  : demoScenarioAdaptation();

const result = runScenario(world, scenario);
const finalYear = result.years.at(-1);

console.log('Scenario:', scenario.name);
console.log('Scale:', scale);
console.log('Year:', finalYear.year);
console.log('');

console.log('Housing');
console.log(`  households: ${Math.round(finalYear.households ?? 0)}`);
console.log(`  dwellingUnits: ${Math.round(finalYear.dwellingUnits ?? 0)}`);
console.log(`  occupiedUnits: ${Math.round(finalYear.occupiedUnits ?? 0)}`);
console.log(`  vacantUnits: ${Math.round(finalYear.vacantUnits ?? 0)}`);
console.log(`  vacancyRate: ${fmt(finalYear.housingVacancyRate)}`);
console.log(`  rentPressure: ${fmt(finalYear.rentPressure ?? 0)}`);
console.log(`  baseAverageRent: ${fmt(finalYear.baseAverageRent ?? 0)}`);
console.log(`  averageRent: ${fmt(finalYear.averageRent ?? 0)}`);
console.log(`  averageAnnualHousingCost: ${fmt(finalYear.averageAnnualHousingCost ?? 0)}`);
console.log(`  averageHouseholdIncome: ${fmt(finalYear.averageHouseholdIncome ?? 0)}`);
console.log(`  averageHousingCostBurden: ${fmt(finalYear.averageHousingCostBurden ?? 0)}`);
console.log(`  householdsHousingStressed: ${Math.round(finalYear.householdsHousingStressed ?? 0)}`);
console.log(`  householdsExceedingUnits: ${Math.round(finalYear.householdsExceedingUnits ?? 0)}`);
console.log(`  averageEstimatedValue: ${fmt(finalYear.averageEstimatedValue ?? finalYear.averageEstimatedBuildingValue ?? 0)}`);
console.log(`  valueToMonthlyRentRatio: ${fmt(finalYear.valueToMonthlyRentRatio ?? 0)}`);
console.log(`  priceToAnnualRentRatio: ${fmt(finalYear.priceToAnnualRentRatio ?? 0)}`);
console.log(`  averageRentGrowthRate: ${fmt(finalYear.averageRentGrowthRate ?? 0, 3)}`);
console.log('');

if (railMode) {
  console.log('Rail');
  console.log(`  railPassengerKm: ${Math.round(finalYear.railPassengerKm ?? 0)}`);
  console.log(`  railFreightTonneKm: ${Math.round(finalYear.railFreightTonneKm ?? 0)}`);
  console.log(`  railUtilizationRatio: ${fmt(finalYear.railUtilizationRatio ?? 0, 3)}`);
  console.log('');
}

console.log('Population Settlement Form');
console.log(`  populationTotal: ${Math.round(finalYear.populationTotal ?? 0)}`);
console.log(`  urbanPopulation: ${Math.round(finalYear.urbanPopulation ?? 0)}`);
console.log(`  townPopulation: ${Math.round(finalYear.townPopulation ?? 0)}`);
console.log(`  villagePopulation: ${Math.round(finalYear.villagePopulation ?? 0)}`);
console.log(`  ruralPopulation: ${Math.round(finalYear.ruralPopulation ?? 0)}`);
console.log(`  urbanShare: ${fmt(finalYear.urbanShare ?? 0, 3)}`);
console.log(`  townShare: ${fmt(finalYear.townShare ?? 0, 3)}`);
console.log(`  villageShare: ${fmt(finalYear.villageShare ?? 0, 3)}`);
console.log(`  ruralShare: ${fmt(finalYear.ruralShare ?? 0, 3)}`);
console.log('');

console.log('Rural Transition');
console.log(`  farmAccessPopulation: ${Math.round(finalYear.farmAccessPopulation ?? 0)}`);
console.log(`  gardenAccessPopulation: ${Math.round(finalYear.gardenAccessPopulation ?? 0)}`);
console.log(`  noLandAccessPopulation: ${Math.round(finalYear.noLandAccessPopulation ?? 0)}`);
console.log(`  landAccessHouseholds: ${Math.round(finalYear.landAccessHouseholds ?? 0)}`);
console.log(`  noLandAccessHouseholds: ${Math.round(finalYear.noLandAccessHouseholds ?? 0)}`);
console.log(`  foodProducingHouseholds: ${Math.round(finalYear.foodProducingHouseholds ?? 0)}`);
console.log(`  householdsIncreasingFoodProduction: ${Math.round(finalYear.householdsIncreasingFoodProduction ?? 0)}`);
console.log(`  urbanToRuralFoodAccessMoves: ${Math.round(finalYear.urbanToRuralFoodAccessMoves ?? 0)}`);
console.log(`  unmetLandAccessDemandHouseholds: ${Math.round(finalYear.unmetLandAccessDemandHouseholds ?? 0)}`);
console.log('');

console.log('Rural Transition Pressure');
console.log(`  ruralTransitionPressureIndex: ${fmt(finalYear.ruralTransitionPressureIndex ?? 0, 3)}`);
console.log(`  foodAffordabilityStress: ${fmt(finalYear.foodAffordabilityStress ?? 0, 3)}`);
console.log(`  transportFuelStress: ${fmt(finalYear.transportFuelStress ?? 0, 3)}`);
console.log(`  housingStress: ${fmt(finalYear.housingStress ?? 0, 3)}`);
console.log(`  inputCostStress: ${fmt(finalYear.inputCostStress ?? 0, 3)}`);
console.log(`  machineryCostStress: ${fmt(finalYear.machineryCostStress ?? 0, 3)}`);
console.log(`  landAccessOpportunity: ${fmt(finalYear.landAccessOpportunity ?? 0, 3)}`);
console.log(`  householdsAtGardenTrigger: ${Math.round(finalYear.householdsAtGardenTrigger ?? 0)}`);
console.log(`  householdsAtCoopTrigger: ${Math.round(finalYear.householdsAtCoopTrigger ?? 0)}`);
console.log(`  householdsAtRelocationTrigger: ${Math.round(finalYear.householdsAtRelocationTrigger ?? 0)}`);
console.log(`  householdsBlockedByNoLandAccess: ${Math.round(finalYear.householdsBlockedByNoLandAccess ?? 0)}`);
console.log(`  potentialAddedFoodEnergyGJIfLandAccessMet: ${fmt(finalYear.potentialAddedFoodEnergyGJIfLandAccessMet ?? 0, 2)}`);
console.log('');

console.log('Food Labour');
console.log(`  foodLabourDemandDays: ${Math.round(finalYear.foodLabourDemandDays ?? 0)}`);
console.log(`  rawFoodLabourAvailableDays: ${Math.round(finalYear.rawFoodLabourAvailableDays ?? 0)}`);
console.log(`  effectiveFoodLabourAvailableDays: ${Math.round(finalYear.effectiveFoodLabourAvailableDays ?? 0)}`);
console.log(`  skillAdjustedFoodLabourAvailableDays: ${Math.round(finalYear.skillAdjustedFoodLabourAvailableDays ?? 0)}`);
console.log(`  foodLabourDeficitDays: ${Math.round(finalYear.foodLabourDeficitDays ?? 0)}`);
console.log(`  foodLabourCoverageRatio: ${fmt(finalYear.foodLabourCoverageRatio ?? 0, 3)}`);
console.log(`  foodLabourShareOfTotalLabour: ${fmt(finalYear.foodLabourShareOfTotalLabour ?? 0, 3)}`);
console.log(`  mechanizedLabourSubstitutionDays: ${Math.round(finalYear.mechanizedLabourSubstitutionDays ?? 0)}`);
console.log(`  manualLabourSubstitutionNeededDays: ${Math.round(finalYear.manualLabourSubstitutionNeededDays ?? 0)}`);
console.log('');

console.log('Production Cost Thresholds');
console.log(`  foodPricePerGJ: ${fmt(finalYear.foodPricePerGJ ?? 0, 2)}`);
console.log(`  productionCostPerGJByMode: ${JSON.stringify(finalYear.productionCostPerGJByMode ?? {})}`);
console.log(`  cheapestProductionMode: ${finalYear.cheapestProductionMode ?? 'n/a'}`);
console.log(`  labourIntensiveBeatsMechanized: ${Boolean(finalYear.labourIntensiveBeatsMechanized)}`);
console.log(`  dieselPriceThresholdForLabourIntensive: ${fmt(finalYear.dieselPriceThresholdForLabourIntensive ?? 0, 2)}`);
console.log(`  dieselPriceThresholdForMarketGardenAtMarketWage: ${fmt(finalYear.dieselPriceThresholdForMarketGardenAtMarketWage ?? 0, 2)}`);
console.log(`  dieselPriceThresholdForHouseholdGardenAtSubsistenceLabour: ${fmt(finalYear.dieselPriceThresholdForHouseholdGardenAtSubsistenceLabour ?? 0, 2)}`);
console.log(`  dieselPriceThresholdForCooperativeSmallFarm: ${fmt(finalYear.dieselPriceThresholdForCooperativeSmallFarm ?? 0, 2)}`);
console.log(`  fertilizerCostThresholdForLowInput: ${fmt(finalYear.fertilizerCostThresholdForLowInput ?? 0, 2)}`);
console.log(`  machineryCostThresholdForSmallScale: ${fmt(finalYear.machineryCostThresholdForSmallScale ?? 0, 2)}`);
console.log(`  breakEvenGardenAreaM2PerHousehold: ${fmt(finalYear.breakEvenGardenAreaM2PerHousehold ?? 0, 1)}`);
console.log(`  breakEvenFarmAccessHaPerHousehold: ${fmt(finalYear.breakEvenFarmAccessHaPerHousehold ?? 0, 3)}`);
console.log('');

console.log('Food Affordability');
console.log(`  householdAnnualFoodEnergyNeedGJ: ${fmt(finalYear.householdAnnualFoodEnergyNeedGJ ?? 0, 2)}`);
console.log(`  householdFoodCost: ${fmt(finalYear.householdFoodCost ?? 0, 2)}`);
console.log(`  householdFoodCostBurden: ${fmt(finalYear.householdFoodCostBurden ?? 0, 3)}`);
console.log(`  foodAffordabilityStress: ${fmt(finalYear.foodAffordabilityStress ?? 0, 3)}`);
console.log(`  householdsFoodCostBurdenHigh: ${Math.round(finalYear.householdsFoodCostBurdenHigh ?? 0)}`);
console.log(`  householdsFoodInsecureRisk: ${Math.round(finalYear.householdsFoodInsecureRisk ?? 0)}`);
console.log(`  foodPriceThresholdForHighBurden: ${fmt(finalYear.foodPriceThresholdForHighBurden ?? 0, 2)}`);
console.log(`  foodPriceThresholdForSevereBurden: ${fmt(finalYear.foodPriceThresholdForSevereBurden ?? 0, 2)}`);
console.log(`  currentFoodPriceAsShareOfHighBurdenThreshold: ${fmt(finalYear.currentFoodPriceAsShareOfHighBurdenThreshold ?? 0, 3)}`);
console.log(`  currentFoodPriceAsShareOfSevereBurdenThreshold: ${fmt(finalYear.currentFoodPriceAsShareOfSevereBurdenThreshold ?? 0, 3)}`);
console.log('');

console.log('Warnings');
console.log(`  warningCount: ${Math.round(finalYear.warningCount ?? 0)}`);
console.log(`  criticalWarningCount: ${Math.round(finalYear.criticalWarningCount ?? 0)}`);
for (const warning of (finalYear.sanityWarnings ?? []).slice(0, 6)) {
  console.log(`  - ${warning.code} [${warning.severity}] ${warning.metricPath}`);
}
for (const warningCode of (finalYear.classificationWarnings ?? [])) {
  console.log(`  - ${warningCode} [warning] classification`);
}
