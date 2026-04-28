// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  runAdaptation,
  runNoAdaptation,
  runAdaptationWithRailBasic,
  runAdaptationWithRailCorridor,
  runAdaptationWithRailFreightCorridor,
  runAdaptationWithRailFreightCorridorSmall,
  runAdaptationWithRailFreightCorridorMedium,
  runAdaptationWithRailFreightCorridorLarge,
  runAdaptationWithRailFreightCorridorHighDensity,
  runAdaptationWithElectrifiedRailCorridor,
  runAdaptationWithElectrifiedRailFreightCorridor
} from './scenario_helpers.mjs';

function pickScenario() {
  const arg = process.argv.find((item) => item.startsWith('--scenario='));
  const value = arg?.split('=')[1] ?? 'adaptation';
  if (value === 'no-adaptation') {
    return runNoAdaptation();
  }
  if (value === 'adaptation-with-rail-basic') {
    return runAdaptationWithRailBasic();
  }
  if (value === 'adaptation-with-rail-corridor') {
    return runAdaptationWithRailCorridor();
  }
  if (value === 'adaptation-with-rail-freight-corridor') {
    return runAdaptationWithRailFreightCorridor();
  }
  if (value === 'adaptation-with-rail-freight-corridor-small') {
    return runAdaptationWithRailFreightCorridorSmall();
  }
  if (value === 'adaptation-with-rail-freight-corridor-medium') {
    return runAdaptationWithRailFreightCorridorMedium();
  }
  if (value === 'adaptation-with-rail-freight-corridor-large') {
    return runAdaptationWithRailFreightCorridorLarge();
  }
  if (value === 'adaptation-with-rail-freight-corridor-high-density') {
    return runAdaptationWithRailFreightCorridorHighDensity();
  }
  if (value === 'adaptation-with-electrified-rail-corridor') {
    return runAdaptationWithElectrifiedRailCorridor();
  }
  if (value === 'adaptation-with-electrified-rail-freight-corridor') {
    return runAdaptationWithElectrifiedRailFreightCorridor();
  }
  return runAdaptation();
}

const { scenario, finalYear, constants } = pickScenario();

function fmt(num, digits = 2) {
  return Number(num ?? 0).toFixed(digits);
}

console.log('Scenario:', scenario.name);
console.log('Calibration Profile:', finalYear.calibrationProfile ?? 'baseline');
console.log('Scenario Scale:', finalYear.scenarioScale ?? 'medium');
console.log('Year:', finalYear.year);
console.log('');

console.log('Food');
console.log(`  localFoodCoverageRatio: ${fmt(finalYear.localFoodCoverageRatio)}`);
console.log(`  producedCalories: ${Math.round(finalYear.producedCalories)}`);
console.log(`  consumedCalories: ${Math.round(finalYear.consumedCalories)}`);
console.log(`  foodSurplusCalories: ${Math.round(finalYear.foodSurplusCalories)}`);
console.log(`  foodDeficitPerPerson: ${fmt(finalYear.foodDeficitPerPerson)}`);
console.log('');

console.log('Labour');
console.log(`  labourAvailableDays: ${Math.round(finalYear.labourAvailableDays)}`);
console.log(`  labourDemandFoodDays: ${Math.round(finalYear.labourDemandFoodDays)}`);
console.log(`  labourDemandFuelDays: ${Math.round(finalYear.labourDemandFuelDays)}`);
console.log(`  labourDemandMaintenanceDays: ${Math.round(finalYear.labourDemandMaintenanceDays)}`);
console.log(`  labourDemandCareDays: ${Math.round(finalYear.labourDemandCareDays)}`);
console.log(`  labourDemandTransportDays: ${Math.round(finalYear.labourDemandTransportDays)}`);
console.log(`  labourSuppliedFoodDays: ${Math.round(finalYear.labourSuppliedFoodDays)}`);
console.log(`  labourSuppliedFuelDays: ${Math.round(finalYear.labourSuppliedFuelDays)}`);
console.log(`  labourSuppliedMaintenanceDays: ${Math.round(finalYear.labourSuppliedMaintenanceDays)}`);
console.log(`  labourSuppliedCareDays: ${Math.round(finalYear.labourSuppliedCareDays)}`);
console.log(`  labourSuppliedTransportDays: ${Math.round(finalYear.labourSuppliedTransportDays)}`);
console.log(`  labourUnmetFoodDays: ${Math.round(finalYear.foodLabourUnmetDays)}`);
console.log(`  labourUnmetTransportDays: ${Math.round(finalYear.labourUnmetTransportDays)}`);
console.log(`  labourUnmetTotalDays: ${Math.round(finalYear.labourUnmetTotalDays)}`);
console.log(`  labourCoverageRatio: ${fmt(finalYear.labourCoverageRatio)}`);
console.log('');

console.log('Stress');
console.log(`  foodStress: ${fmt(finalYear.averageFoodStress)}`);
console.log(`  fuelStress: ${fmt(finalYear.averageFuelStress)}`);
console.log(`  heatingFuelStress: ${fmt(finalYear.averageHeatingFuelStress)}`);
console.log(`  transportFuelStress: ${fmt(finalYear.averageTransportFuelStress)}`);
console.log(`  electricityStress: ${fmt(finalYear.averageElectricityStress)}`);
console.log(`  totalFuelStress: ${fmt(finalYear.averageTotalFuelStress)}`);
console.log(`  housingStress: ${fmt(finalYear.averageHousingStress)}`);
console.log(`  transportStress: ${fmt(finalYear.averageTransportStress)}`);
console.log(`  totalStress: ${fmt(finalYear.averageTotalStress)}`);
console.log(`  migrationPressure: ${fmt(finalYear.averageMigrationPressure)}`);
console.log('');

console.log('Energy');
console.log(`  heatDemandKwh: ${Math.round(finalYear.heatDemandKwh)}`);
console.log(`  woodHeatSupplyKwh: ${Math.round(finalYear.woodHeatSupplyKwh)}`);
console.log(`  electricHeatSupplyKwh: ${Math.round(finalYear.electricHeatSupplyKwh)}`);
console.log(`  fossilHeatSupplyKwh: ${Math.round(finalYear.fossilHeatSupplyKwh)}`);
console.log(`  heatingEnergyDeficitKwh: ${Math.round(finalYear.heatingEnergyDeficitKwh)}`);
console.log(`  transportFuelDemandLitre: ${Math.round(finalYear.transportFuelDemandLitre)}`);
console.log(`  transportFuelAvailableLitre: ${Math.round(finalYear.transportFuelAvailableLitre)}`);
console.log(`  transportFuelDeficitLitre: ${Math.round(finalYear.transportFuelDeficitLitre)}`);
console.log(`  electricityDemandKwh: ${Math.round(finalYear.electricityDemandKwh)}`);
console.log(`  electricityAvailableKwh: ${Math.round(finalYear.electricityAvailableKwh)}`);
console.log(`  electricityDeficitKwh: ${Math.round(finalYear.electricityDeficitKwh)}`);
console.log(`  sustainableBiomassHarvestKg: ${Math.round(finalYear.sustainableBiomassHarvestKg)}`);
console.log('');

console.log('Transport');
console.log(`  totalPassengerKmDemand: ${Math.round(finalYear.totalPassengerKmDemand)}`);
console.log(`  totalFreightTonneKmDemand: ${Math.round(finalYear.totalFreightTonneKmDemand)}`);
console.log(`  dieselPassengerKm: ${Math.round(finalYear.dieselPassengerKm)}`);
console.log(`  dieselFreightTonneKm: ${Math.round(finalYear.dieselFreightTonneKm)}`);
console.log(`  nonDieselPassengerKm: ${Math.round(finalYear.nonDieselPassengerKm)}`);
console.log(`  nonDieselFreightTonneKm: ${Math.round(finalYear.nonDieselFreightTonneKm)}`);
console.log(`  localizedPassengerKmAvoided: ${Math.round(finalYear.localizedPassengerKmAvoided)}`);
console.log(`  localizedFreightTonneKmAvoided: ${Math.round(finalYear.localizedFreightTonneKmAvoided)}`);
console.log(`  transportDieselDemandLitre: ${Math.round(finalYear.transportDieselDemandLitre)}`);
console.log(`  transportDieselAvailableLitre: ${Math.round(finalYear.transportDieselAvailableLitre)}`);
console.log(`  transportDieselDeficitLitre: ${Math.round(finalYear.transportDieselDeficitLitre)}`);
console.log(`  transportElectricityDemandKwh: ${Math.round(finalYear.transportElectricityDemandKwh)}`);
console.log(`  transportFodderDemandKg: ${Math.round(finalYear.transportFodderDemandKg)}`);
console.log(`  transportFodderDeficitKg: ${Math.round(finalYear.transportFodderDeficitKg)}`);
console.log(`  transportLabourDemandDays: ${Math.round(finalYear.transportLabourDemandDays)}`);
console.log(`  unmetPassengerKm: ${Math.round(finalYear.unmetPassengerKm)}`);
console.log(`  unmetFreightTonneKm: ${Math.round(finalYear.unmetFreightTonneKm)}`);
console.log('');

console.log('Freight Demand');
console.log(`  totalFreightTonnes: ${Math.round(finalYear.totalFreightTonnes ?? 0)}`);
console.log(`  totalFreightTonneKm: ${Math.round(finalYear.totalFreightTonneKmDemand ?? 0)}`);
console.log(`  essentialFreightTonneKm: ${Math.round(finalYear.essentialFreightTonneKm ?? 0)}`);
console.log(`  localFreightTonneKm: ${Math.round(finalYear.localFreightTonneKm ?? 0)}`);
console.log(`  longDistanceFreightTonneKm: ${Math.round(finalYear.longDistanceFreightTonneKm ?? 0)}`);
console.log(`  freightDemandReducedByRepairReuse: ${Math.round(finalYear.freightDemandReducedByRepairReuse ?? 0)}`);
console.log(`  freightDemandReducedByLocalProduction: ${Math.round(finalYear.freightDemandReducedByLocalProduction ?? 0)}`);
console.log(`  freightDemandReducedByStorageProcessing: ${Math.round(finalYear.freightDemandReducedByStorageProcessing ?? 0)}`);
console.log(`  freightDemandReducedByCompostLoop: ${Math.round(finalYear.freightDemandReducedByCompostLoop ?? 0)}`);
console.log('');

console.log('Freight Allocation');
console.log(`  railFreightCapturedTonneKm: ${Math.round(finalYear.railFreightCapturedTonneKm ?? 0)}`);
console.log(`  roadFreightAvoidedTonneKm: ${Math.round(finalYear.roadFreightAvoidedTonneKm ?? 0)}`);
console.log(`  heavyTruckTonneKmAvoidedByRail: ${Math.round(finalYear.heavyTruckTonneKmAvoidedByRail ?? 0)}`);
console.log(`  freightDieselDemandLitre: ${Math.round(finalYear.freightDieselDemandLitre ?? 0)}`);
console.log(`  freightElectricityDemandKwh: ${Math.round(finalYear.freightElectricityDemandKwh ?? 0)}`);
console.log(`  freightHandlingLabourDays: ${Math.round(finalYear.freightHandlingLabourDays ?? 0)}`);
console.log(`  freightSpoilageLossTonnes: ${fmt(finalYear.freightSpoilageLossTonnes ?? 0, 3)}`);
console.log(`  freightServiceReliability: ${fmt(finalYear.freightServiceReliability ?? 0, 3)}`);
console.log('');

console.log('Station Catchments');
console.log(`  catchmentPopulation: ${Math.round(finalYear.catchmentPopulation ?? 0)}`);
console.log(`  catchmentHouseholds: ${Math.round(finalYear.catchmentHouseholds ?? 0)}`);
console.log(`  catchmentJobs: ${Math.round(finalYear.catchmentJobs ?? 0)}`);
console.log(`  catchmentFreightTonnePotential: ${Math.round(finalYear.catchmentFreightTonnePotential ?? 0)}`);
console.log(`  catchmentProductiveLandHa: ${Math.round(finalYear.catchmentProductiveLandHa ?? 0)}`);
console.log(`  catchmentWalkAccessShare: ${fmt(finalYear.catchmentWalkAccessShare ?? 0)}`);
console.log(`  catchmentBicycleAccessShare: ${fmt(finalYear.catchmentBicycleAccessShare ?? 0)}`);
console.log(`  householdsWithViableRailAlternative: ${Math.round(finalYear.householdsWithViableRailAlternative ?? 0)}`);
console.log(`  householdsCarDependentNoAlternative: ${Math.round(finalYear.householdsCarDependentNoAlternative ?? 0)}`);
console.log('');

console.log('Corridor Transition');
console.log(`  stationAreaPopulationAdded: ${Math.round(finalYear.stationAreaPopulationAdded ?? 0)}`);
console.log(`  stationAreaHousingUnitsAdded: ${Math.round(finalYear.stationAreaHousingUnitsAdded ?? 0)}`);
console.log(`  stationAreaJobsAdded: ${Math.round(finalYear.stationAreaJobsAdded ?? 0)}`);
console.log(`  stationAreaServiceCapacityAdded: ${Math.round(finalYear.stationAreaServiceCapacityAdded ?? 0)}`);
console.log(`  stationAreaFreightPotentialAdded: ${Math.round(finalYear.stationAreaFreightPotentialAdded ?? 0)}`);
console.log(`  hectaresTransitionedNearStations: ${fmt(finalYear.hectaresTransitionedNearStations ?? 0)}`);
console.log('');

console.log('Road Maintenance');
console.log(`  roadMaintenanceDemandMoney: ${Math.round(finalYear.roadMaintenanceDemandMoney)}`);
console.log(`  roadMaintenanceBudgetMoney: ${Math.round(finalYear.roadMaintenanceBudgetMoney)}`);
console.log(`  roadMaintenanceBacklogMoney: ${Math.round(finalYear.roadMaintenanceBacklogMoney)}`);
console.log(`  roadMaintenanceCoverageRatio: ${fmt(finalYear.roadMaintenanceCoverageRatio)}`);
console.log(`  roadConditionAverage: ${fmt(finalYear.roadConditionAverage, 3)}`);
console.log(`  roadConditionAverageByType: ${JSON.stringify(finalYear.roadConditionAverageByType ?? {})}`);
console.log(`  heavyTruckTonneKm: ${Math.round(finalYear.heavyTruckTonneKm ?? 0)}`);
console.log(`  vehicleKm: ${Math.round(finalYear.vehicleKm ?? 0)}`);
console.log('');

console.log('Rail');
console.log(`  railEnabled: ${Boolean(finalYear.railEnabled)}`);
console.log(`  railElectrified: ${Boolean(finalYear.railElectrified)}`);
console.log(`  railMaintenanceDemandMoney: ${Math.round(finalYear.railMaintenanceDemandMoney ?? 0)}`);
console.log(`  railMaintenanceBudgetMoney: ${Math.round(finalYear.railMaintenanceBudgetMoney ?? 0)}`);
console.log(`  railMaintenanceBacklogMoney: ${Math.round(finalYear.railMaintenanceBacklogMoney ?? 0)}`);
console.log(`  railMaintenanceCoverageRatio: ${fmt(finalYear.railMaintenanceCoverageRatio ?? 0)}`);
console.log(`  railConditionAverage: ${fmt(finalYear.railConditionAverage ?? 0, 3)}`);
console.log(`  railServiceReliability: ${fmt(finalYear.railServiceReliability ?? 0, 3)}`);
console.log(`  railPassengerKm: ${Math.round(finalYear.railPassengerKm ?? 0)}`);
console.log(`  railFreightTonneKm: ${Math.round(finalYear.railFreightTonneKm ?? 0)}`);
console.log(`  railUtilizationRatio: ${fmt(finalYear.railUtilizationRatio ?? 0, 3)}`);
console.log(`  passengerUtilizationRatio: ${fmt(finalYear.passengerUtilizationRatio ?? 0, 3)}`);
console.log(`  freightUtilizationRatio: ${fmt(finalYear.freightUtilizationRatio ?? 0, 3)}`);
console.log(`  weightedUtilizationRatio: ${fmt(finalYear.weightedUtilizationRatio ?? 0, 3)}`);
console.log(`  railPassengerCapacityKm: ${Math.round(finalYear.railPassengerCapacityKm ?? 0)}`);
console.log(`  railFreightCapacityTonneKm: ${Math.round(finalYear.railFreightCapacityTonneKm ?? 0)}`);
console.log(`  railDieselDemandLitre: ${Math.round(finalYear.railDieselDemandLitre ?? 0)}`);
console.log(`  railElectricityDemandKwh: ${Math.round(finalYear.railElectricityDemandKwh ?? 0)}`);
console.log('');

console.log('Rail Economics');
console.log(`  railFixedCostAnnual: ${Math.round(finalYear.railFixedCostAnnual ?? 0)}`);
console.log(`  railVariableCostAnnual: ${Math.round(finalYear.railVariableCostAnnual ?? 0)}`);
console.log(`  railPassengerCostPerKmAtUtilization: ${fmt(finalYear.railPassengerCostPerKmAtUtilization ?? 0, 3)}`);
console.log(`  railFreightCostPerTonneKmAtUtilization: ${fmt(finalYear.railFreightCostPerTonneKmAtUtilization ?? 0, 3)}`);
console.log(`  railBreakEvenUtilizationRatio: ${fmt(finalYear.railBreakEvenUtilizationRatio ?? 0, 3)}`);
console.log(`  railCostRecoveryRatio: ${fmt(finalYear.railCostRecoveryRatio ?? 0, 3)}`);
console.log(`  railPublicSubsidyRequired: ${Math.round(finalYear.railPublicSubsidyRequired ?? 0)}`);
console.log(`  railCostPerRiderYear: ${Math.round(finalYear.railCostPerRiderYear ?? 0)}`);
console.log(`  fuelPriceInducedRailPassengerKm: ${Math.round(finalYear.fuelPriceInducedRailPassengerKm ?? 0)}`);
console.log('');

console.log('Rail Corridor Economics');
console.log(`  railPassengerRevenueEquivalent: ${Math.round(finalYear.railPassengerRevenueEquivalent ?? 0)}`);
console.log(`  railFreightRevenueEquivalent: ${Math.round(finalYear.railFreightRevenueEquivalent ?? 0)}`);
console.log(`  railAvoidedRoadMaintenanceValue: ${Math.round(finalYear.railAvoidedRoadMaintenanceValue ?? 0)}`);
console.log(`  railAvoidedDieselValue: ${Math.round(finalYear.railAvoidedDieselValue ?? 0)}`);
console.log(`  railSpoilageReductionValue: ${Math.round(finalYear.railSpoilageReductionValue ?? 0)}`);
console.log(`  railTotalBenefitEquivalent: ${Math.round(finalYear.railTotalBenefitEquivalent ?? 0)}`);
console.log(`  railTotalCost: ${Math.round(finalYear.railTotalCost ?? 0)}`);
console.log(`  railNetCostAfterBenefits: ${Math.round(finalYear.railNetCostAfterBenefits ?? 0)}`);
console.log(`  railBenefitCostRatio: ${fmt(finalYear.railBenefitCostRatio ?? 0, 3)}`);
console.log(`  railCostRecoveryRatioDirect: ${fmt(finalYear.railCostRecoveryRatioDirect ?? 0, 3)}`);
console.log(`  railCostRecoveryRatioWithAvoidedCosts: ${fmt(finalYear.railCostRecoveryRatioWithAvoidedCosts ?? 0, 3)}`);
console.log(`  railBreakEvenFreightTonneKm: ${Math.round(finalYear.railBreakEvenFreightTonneKm ?? 0)}`);
console.log(`  railBreakEvenPassengerKm: ${Math.round(finalYear.railBreakEvenPassengerKm ?? 0)}`);
console.log(`  railBreakEvenMixedUtilization: ${fmt(finalYear.railBreakEvenMixedUtilization ?? 0, 3)}`);
console.log('');

console.log('Sanity Warnings');
console.log(`  warningCount: ${Math.round(finalYear.warningCount ?? 0)}`);
console.log(`  criticalWarningCount: ${Math.round(finalYear.criticalWarningCount ?? 0)}`);
const topWarnings = (finalYear.sanityWarnings ?? []).slice(0, 3);
if (topWarnings.length === 0) {
  console.log('  top warnings: none');
} else {
  for (const item of topWarnings) {
    console.log(`  - ${item.code} [${item.severity}] value=${fmt(item.value ?? 0, 3)} threshold=${fmt(item.threshold ?? 0, 3)}`);
  }
}
console.log('');

console.log('Rail Break-even Diagnostics');
console.log(`  annualFixedCost: ${Math.round(finalYear.annualFixedCost ?? 0)}`);
console.log(`  annualVariableCost: ${Math.round(finalYear.annualVariableCost ?? 0)}`);
console.log(`  effectiveBenefitPerPassengerKm: ${fmt(finalYear.effectiveBenefitPerPassengerKm ?? 0, 4)}`);
console.log(`  effectiveBenefitPerFreightTonneKm: ${fmt(finalYear.effectiveBenefitPerFreightTonneKm ?? 0, 4)}`);
console.log(`  requiredPassengerKmIfPassengerOnly: ${Math.round(finalYear.requiredPassengerKmIfPassengerOnly ?? 0)}`);
console.log(`  requiredFreightTonneKmIfFreightOnly: ${Math.round(finalYear.requiredFreightTonneKmIfFreightOnly ?? 0)}`);
console.log(`  currentPassengerKm: ${Math.round(finalYear.currentPassengerKm ?? 0)}`);
console.log(`  currentFreightTonneKm: ${Math.round(finalYear.currentFreightTonneKm ?? 0)}`);
console.log(`  passengerScaleMultiplierNeeded: ${fmt(finalYear.passengerScaleMultiplierNeeded ?? 0, 3)}`);
console.log(`  freightScaleMultiplierNeeded: ${fmt(finalYear.freightScaleMultiplierNeeded ?? 0, 3)}`);
console.log(`  mixedScaleMultiplierNeeded: ${fmt(finalYear.mixedScaleMultiplierNeeded ?? 0, 3)}`);
console.log('');

console.log('Transport Economics');
console.log(`  privateIceCostPerKm: ${fmt(finalYear.privateIceCostPerKm ?? 0, 3)}`);
console.log(`  publicTransitCostPerPassengerKm: ${fmt(finalYear.publicTransitCostPerPassengerKm ?? 0, 3)}`);
console.log(`  railCostPerPassengerKm: ${fmt(finalYear.railEconomicsCostPerPassengerKm ?? finalYear.railCostPerPassengerKm ?? 0, 3)}`);
console.log(`  householdAnnualPrivateVehicleCost: ${Math.round(finalYear.householdAnnualPrivateVehicleCost ?? 0)}`);
console.log(`  householdAnnualTransitEquivalentCost: ${Math.round(finalYear.householdAnnualTransitEquivalentCost ?? 0)}`);
console.log(`  gasolineBreakEvenPriceForTransitPerLitre: ${fmt(finalYear.gasolineBreakEvenPriceForTransitPerLitre ?? 0, 3)}`);
console.log(`  dieselBreakEvenPriceForRailPerLitre: ${fmt(finalYear.dieselBreakEvenPriceForRailPerLitre ?? 0, 3)}`);
console.log(`  averageCarDependenceCostBurden: ${fmt(finalYear.averageCarDependenceCostBurden ?? 0, 3)}`);
console.log('');

console.log('Migration');
console.log(`  startingPopulation: ${Math.round(finalYear.startingPopulation)}`);
console.log(`  births: ${Math.round(finalYear.births)}`);
console.log(`  deaths: ${Math.round(finalYear.deaths)}`);
console.log(`  inMigration: ${Math.round(finalYear.inMigration)}`);
console.log(`  outMigration: ${Math.round(finalYear.outMigration)}`);
console.log(`  netMigration: ${Math.round(finalYear.netMigration)}`);
console.log(`  urbanToRuralMoves: ${Math.round(finalYear.urbanToRuralMoves)}`);
console.log(`  ruralToUrbanMoves: ${Math.round(finalYear.ruralToUrbanMoves)}`);
console.log(`  endingPopulation: ${Math.round(finalYear.endingPopulation)}`);
console.log(`  outMigrationFoodStress: ${Math.round(finalYear.outMigrationFoodStress)}`);
console.log(`  outMigrationFuelStress: ${Math.round(finalYear.outMigrationFuelStress)}`);
console.log(`  outMigrationHousingStress: ${Math.round(finalYear.outMigrationHousingStress)}`);
console.log(`  outMigrationTransportStress: ${Math.round(finalYear.outMigrationTransportStress)}`);
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

console.log('Housing + Infrastructure');
console.log(`  infrastructureCondition: ${fmt(finalYear.infrastructureAverageCondition, 3)}`);
console.log(`  maintenanceCoverageRatio: ${fmt(finalYear.maintenanceCoverageRatio)}`);
console.log('');

console.log('Constants (selected)');
console.log(`  annualCaloriesPerPerson: ${constants.annualCaloriesPerPerson}`);
console.log(`  annualFirewoodKgPerHousehold: ${constants.annualFirewoodKgPerHousehold}`);
console.log(`  dieselMechanizationPenalty: ${constants.labour.dieselMechanizationPenalty}`);
console.log(`  targetRentBurden: ${constants.stress.targetRentBurden}`);
console.log(`  birthRateBase: ${constants.population.birthRateBase}`);
console.log(`  deathRateBase: ${constants.population.deathRateBase}`);
