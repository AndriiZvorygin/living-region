// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { greyCountySeedNodes } from '../data/grey_county_seed_nodes.mjs';

const DEFAULTS = {
  foodWorkerDaysPerYear: 220,
  areaShares: {
    humanFood: 0.55,
    pastureFodder: 0.3,
    woodEnergy: 0.15
  },
  labourDaysByCategory: {
    urbanNoLand: 2,
    townVillage: 8,
    hamlet: 15,
    ruralNonFarm: 25,
    ruralProductive: 60,
    agriculturalLotAccess: 90
  },
  scenarios: [
    { scenario: 'currentMechanized', machinerySupportFactor: 1, fuelInputIndex: 1, labourDaysPerHumanFoodHa: 8, humanLabourMultiplier: 1, notes: 'Current mechanized baseline' },
    { scenario: 'reducedFuel', machinerySupportFactor: 0.75, fuelInputIndex: 0.75, labourDaysPerHumanFoodHa: 20, humanLabourMultiplier: 1.35, notes: 'Reduced fuel and machinery support' },
    { scenario: 'lowFuelMixed', machinerySupportFactor: 0.45, fuelInputIndex: 0.5, labourDaysPerHumanFoodHa: 45, humanLabourMultiplier: 1.9, notes: 'Low-fuel mixed human/mechanical mode' },
    { scenario: 'mostlyHumanScale', machinerySupportFactor: 0.2, fuelInputIndex: 0.25, labourDaysPerHumanFoodHa: 90, humanLabourMultiplier: 2.6, notes: 'Mostly human-scale production mode' }
  ]
};

const RURAL_PRIORITY = new Set(['West Grey', 'Grey Highlands', 'Southgate', 'Chatsworth', 'Georgian Bluffs', 'Meaford', 'The Blue Mountains']);

const HARVEST_SEASONS = ['earlySpring', 'lateSpring', 'earlySummer', 'lateSummer', 'autumn', 'lateAutumn', 'winterStored'];

const PRODUCTION_SYSTEMS = [
  {
    system: 'annualMechanized',
    establishmentYears: 1,
    designPlanningDaysPerHa: 2,
    establishmentLabourDaysPerHa: 6,
    soilPrepTillageDaysPerHa: 3,
    plantingSeedingDaysPerHa: 2,
    weedingMulchingDaysPerHa: 2,
    irrigationWaterDaysPerHa: 1,
    pestDiseaseMonitoringDaysPerHa: 1,
    pruningTrainingDaysPerHa: 0.5,
    processingStorageDaysPerGJ: 0.2,
    pathFenceToolMaintenanceDaysPerHa: 1,
    observationManagementDaysPerHa: 1.5,
    harvestLabourDaysPerGJ: 0.45,
    harvestWindowDays: 45,
    annualFoodEnergyGJPerHaAtMaturity: 28,
    maturityRampYears: 1,
    maturityCurve: 'flat',
    inputDependencyIndex: 0.85,
    machineryDependencyIndex: 0.9,
    skillRequirementIndex: 0.45,
    managementComplexityIndex: 0.35,
    seasonalPeakLabourMultiplier: 1.45,
    harvestDistribution: { autumn: 0.85, winterStored: 0.15 },
    notes: 'High machinery/input dependence; narrow harvest peak.'
  },
  {
    system: 'annualLowFuelEfficient',
    establishmentYears: 1,
    designPlanningDaysPerHa: 8,
    establishmentLabourDaysPerHa: 18,
    soilPrepTillageDaysPerHa: 18,
    plantingSeedingDaysPerHa: 16,
    weedingMulchingDaysPerHa: 30,
    irrigationWaterDaysPerHa: 8,
    pestDiseaseMonitoringDaysPerHa: 6,
    pruningTrainingDaysPerHa: 1.5,
    processingStorageDaysPerGJ: 0.7,
    pathFenceToolMaintenanceDaysPerHa: 6,
    observationManagementDaysPerHa: 14,
    harvestLabourDaysPerGJ: 1.4,
    harvestWindowDays: 55,
    annualFoodEnergyGJPerHaAtMaturity: 22,
    maturityRampYears: 1,
    maturityCurve: 'flat',
    inputDependencyIndex: 0.5,
    machineryDependencyIndex: 0.45,
    skillRequirementIndex: 0.5,
    managementComplexityIndex: 0.5,
    seasonalPeakLabourMultiplier: 1.55,
    harvestDistribution: { lateSummer: 0.1, autumn: 0.75, winterStored: 0.15 },
    notes: 'Efficient hand-scale annual field baseline with good layout and tool practice.'
  },
  {
    system: 'annualLowFuelHandScale',
    establishmentYears: 1,
    designPlanningDaysPerHa: 10,
    establishmentLabourDaysPerHa: 22,
    soilPrepTillageDaysPerHa: 30,
    plantingSeedingDaysPerHa: 25,
    weedingMulchingDaysPerHa: 60,
    irrigationWaterDaysPerHa: 12,
    pestDiseaseMonitoringDaysPerHa: 10,
    pruningTrainingDaysPerHa: 2,
    processingStorageDaysPerGJ: 0.9,
    pathFenceToolMaintenanceDaysPerHa: 8,
    observationManagementDaysPerHa: 12,
    harvestLabourDaysPerGJ: 1.8,
    harvestWindowDays: 50,
    annualFoodEnergyGJPerHaAtMaturity: 20,
    maturityRampYears: 1,
    maturityCurve: 'flat',
    inputDependencyIndex: 0.42,
    machineryDependencyIndex: 0.25,
    skillRequirementIndex: 0.55,
    managementComplexityIndex: 0.56,
    seasonalPeakLabourMultiplier: 1.62,
    harvestDistribution: { lateSummer: 0.08, autumn: 0.8, winterStored: 0.12 },
    notes: 'Low-fuel hand-scale annual with repeated soil prep/planting/weeding.'
  },
  {
    system: 'annualSmallToolOptimized',
    establishmentYears: 1,
    designPlanningDaysPerHa: 8,
    establishmentLabourDaysPerHa: 16,
    soilPrepTillageDaysPerHa: 11,
    plantingSeedingDaysPerHa: 10,
    weedingMulchingDaysPerHa: 16,
    irrigationWaterDaysPerHa: 5,
    pestDiseaseMonitoringDaysPerHa: 4,
    pruningTrainingDaysPerHa: 1,
    processingStorageDaysPerGJ: 0.55,
    pathFenceToolMaintenanceDaysPerHa: 4,
    observationManagementDaysPerHa: 9,
    harvestLabourDaysPerGJ: 1.0,
    harvestWindowDays: 60,
    annualFoodEnergyGJPerHaAtMaturity: 22,
    maturityRampYears: 1,
    maturityCurve: 'flat',
    inputDependencyIndex: 0.35,
    machineryDependencyIndex: 0.2,
    skillRequirementIndex: 0.72,
    managementComplexityIndex: 0.62,
    seasonalPeakLabourMultiplier: 1.38,
    harvestDistribution: { lateSpring: 0.06, earlySummer: 0.14, lateSummer: 0.24, autumn: 0.42, winterStored: 0.14 },
    notes: 'Upper-end optimized small-tool annual case (excellent layout/tools/skill), not ordinary hand-tool baseline.'
  },
  {
    system: 'marketGardenIntensive',
    establishmentYears: 1,
    establishmentLabourDaysPerHa: 70,
    maintenanceLabourDaysPerHa: 120,
    harvestLabourDaysPerGJ: 1.7,
    harvestWindowDays: 130,
    annualFoodEnergyGJPerHaAtMaturity: 34,
    maturityRampYears: 1,
    maturityCurve: 'flat',
    inputDependencyIndex: 0.55,
    machineryDependencyIndex: 0.3,
    skillRequirementIndex: 0.75,
    managementComplexityIndex: 0.82,
    seasonalPeakLabourMultiplier: 1.25,
    harvestDistribution: { lateSpring: 0.12, earlySummer: 0.18, lateSummer: 0.28, autumn: 0.32, lateAutumn: 0.1 },
    notes: 'Very labour-intensive with broad harvest season.'
  },
  {
    system: 'householdGarden',
    establishmentYears: 1,
    establishmentLabourDaysPerHa: 55,
    maintenanceLabourDaysPerHa: 95,
    harvestLabourDaysPerGJ: 2,
    harvestWindowDays: 120,
    annualFoodEnergyGJPerHaAtMaturity: 24,
    maturityRampYears: 1,
    maturityCurve: 'flat',
    inputDependencyIndex: 0.4,
    machineryDependencyIndex: 0.12,
    skillRequirementIndex: 0.55,
    managementComplexityIndex: 0.65,
    seasonalPeakLabourMultiplier: 1.2,
    harvestDistribution: { lateSpring: 0.1, earlySummer: 0.2, lateSummer: 0.25, autumn: 0.3, winterStored: 0.15 },
    notes: 'Low machinery, household-scale production.'
  },
  {
    system: 'youngPermaculture',
    establishmentYears: 4,
    designPlanningDaysPerHa: 28,
    establishmentLabourDaysPerHa: 180,
    soilPrepTillageDaysPerHa: 4,
    plantingSeedingDaysPerHa: 14,
    weedingMulchingDaysPerHa: 15,
    irrigationWaterDaysPerHa: 7,
    pestDiseaseMonitoringDaysPerHa: 8,
    pruningTrainingDaysPerHa: 10,
    processingStorageDaysPerGJ: 0.62,
    pathFenceToolMaintenanceDaysPerHa: 7,
    observationManagementDaysPerHa: 10,
    harvestLabourDaysPerGJ: 1.4,
    harvestWindowDays: 160,
    annualFoodEnergyGJPerHaAtMaturity: 20,
    maturityRampYears: 6,
    maturityCurve: 'sigmoid',
    inputDependencyIndex: 0.35,
    machineryDependencyIndex: 0.2,
    skillRequirementIndex: 0.82,
    managementComplexityIndex: 0.86,
    seasonalPeakLabourMultiplier: 1.15,
    harvestDistribution: { lateSpring: 0.08, earlySummer: 0.18, lateSummer: 0.22, autumn: 0.28, lateAutumn: 0.16, winterStored: 0.08 },
    notes: 'Front-loaded design/establishment burden before maturity.'
  },
  {
    system: 'maturePermacultureConservative',
    establishmentYears: 6,
    designPlanningDaysPerHa: 26,
    establishmentLabourDaysPerHa: 210,
    soilPrepTillageDaysPerHa: 1.5,
    plantingSeedingDaysPerHa: 3.5,
    weedingMulchingDaysPerHa: 7,
    irrigationWaterDaysPerHa: 4,
    pestDiseaseMonitoringDaysPerHa: 8,
    pruningTrainingDaysPerHa: 10,
    processingStorageDaysPerGJ: 0.68,
    pathFenceToolMaintenanceDaysPerHa: 8,
    observationManagementDaysPerHa: 10,
    harvestLabourDaysPerGJ: 1.2,
    harvestWindowDays: 185,
    annualFoodEnergyGJPerHaAtMaturity: 22,
    maturityRampYears: 8,
    maturityCurve: 'sigmoid',
    inputDependencyIndex: 0.22,
    machineryDependencyIndex: 0.14,
    skillRequirementIndex: 0.84,
    managementComplexityIndex: 0.88,
    seasonalPeakLabourMultiplier: 1.08,
    harvestDistribution: { earlySummer: 0.1, lateSummer: 0.25, autumn: 0.4, lateAutumn: 0.15, winterStored: 0.1 },
    notes: 'Conservative mature perennial case with high management demand.'
  },
  {
    system: 'maturePermacultureLowCare',
    establishmentYears: 6,
    designPlanningDaysPerHa: 24,
    establishmentLabourDaysPerHa: 190,
    soilPrepTillageDaysPerHa: 1,
    plantingSeedingDaysPerHa: 2.5,
    weedingMulchingDaysPerHa: 5,
    irrigationWaterDaysPerHa: 3,
    pestDiseaseMonitoringDaysPerHa: 7,
    pruningTrainingDaysPerHa: 8,
    processingStorageDaysPerGJ: 0.55,
    pathFenceToolMaintenanceDaysPerHa: 6,
    observationManagementDaysPerHa: 8,
    harvestLabourDaysPerGJ: 1.0,
    harvestWindowDays: 190,
    annualFoodEnergyGJPerHaAtMaturity: 23,
    maturityRampYears: 8,
    maturityCurve: 'sigmoid',
    inputDependencyIndex: 0.2,
    machineryDependencyIndex: 0.12,
    skillRequirementIndex: 0.83,
    managementComplexityIndex: 0.84,
    seasonalPeakLabourMultiplier: 1.06,
    harvestDistribution: { earlySummer: 0.1, lateSummer: 0.24, autumn: 0.38, lateAutumn: 0.16, winterStored: 0.12 },
    notes: 'Established perennial polyculture with reduced recurring soil/weed labour.'
  },
  {
    system: 'maturePermacultureHarvestIntensive',
    establishmentYears: 6,
    designPlanningDaysPerHa: 24,
    establishmentLabourDaysPerHa: 200,
    soilPrepTillageDaysPerHa: 1,
    plantingSeedingDaysPerHa: 2.5,
    weedingMulchingDaysPerHa: 5.5,
    irrigationWaterDaysPerHa: 3,
    pestDiseaseMonitoringDaysPerHa: 8,
    pruningTrainingDaysPerHa: 9,
    processingStorageDaysPerGJ: 0.8,
    pathFenceToolMaintenanceDaysPerHa: 6.5,
    observationManagementDaysPerHa: 8,
    harvestLabourDaysPerGJ: 1.35,
    harvestWindowDays: 175,
    annualFoodEnergyGJPerHaAtMaturity: 28,
    maturityRampYears: 8,
    maturityCurve: 'sigmoid',
    inputDependencyIndex: 0.22,
    machineryDependencyIndex: 0.14,
    skillRequirementIndex: 0.85,
    managementComplexityIndex: 0.87,
    seasonalPeakLabourMultiplier: 1.11,
    harvestDistribution: { earlySummer: 0.08, lateSummer: 0.24, autumn: 0.42, lateAutumn: 0.17, winterStored: 0.09 },
    notes: 'Mature perennial system where harvest and processing dominate labour.'
  },
  {
    system: 'maturePermacultureOptimisticEstablished',
    establishmentYears: 6,
    designPlanningDaysPerHa: 22,
    establishmentLabourDaysPerHa: 175,
    soilPrepTillageDaysPerHa: 0.8,
    plantingSeedingDaysPerHa: 2,
    weedingMulchingDaysPerHa: 3.5,
    irrigationWaterDaysPerHa: 2.5,
    pestDiseaseMonitoringDaysPerHa: 6,
    pruningTrainingDaysPerHa: 7,
    processingStorageDaysPerGJ: 0.48,
    pathFenceToolMaintenanceDaysPerHa: 5,
    observationManagementDaysPerHa: 7,
    harvestLabourDaysPerGJ: 0.9,
    harvestWindowDays: 195,
    annualFoodEnergyGJPerHaAtMaturity: 24,
    maturityRampYears: 7,
    maturityCurve: 'sigmoid',
    inputDependencyIndex: 0.18,
    machineryDependencyIndex: 0.1,
    skillRequirementIndex: 0.8,
    managementComplexityIndex: 0.8,
    seasonalPeakLabourMultiplier: 1.04,
    harvestDistribution: { lateSpring: 0.06, earlySummer: 0.12, lateSummer: 0.24, autumn: 0.34, lateAutumn: 0.16, winterStored: 0.08 },
    notes: 'Optimistic established mature perennial case.'
  },
  {
    system: 'orchardNutPolyculture',
    establishmentYears: 8,
    establishmentLabourDaysPerHa: 170,
    maintenanceLabourDaysPerHa: 20,
    harvestLabourDaysPerGJ: 1,
    harvestWindowDays: 120,
    annualFoodEnergyGJPerHaAtMaturity: 19,
    maturityRampYears: 10,
    maturityCurve: 'sigmoid',
    inputDependencyIndex: 0.2,
    machineryDependencyIndex: 0.18,
    skillRequirementIndex: 0.8,
    managementComplexityIndex: 0.8,
    seasonalPeakLabourMultiplier: 1.18,
    harvestDistribution: { lateSummer: 0.18, autumn: 0.56, lateAutumn: 0.16, winterStored: 0.1 },
    notes: 'Long maturity ramp with lower annual maintenance.'
  },
  {
    system: 'silvopasture',
    establishmentYears: 5,
    establishmentLabourDaysPerHa: 125,
    maintenanceLabourDaysPerHa: 16,
    harvestLabourDaysPerGJ: 1.2,
    harvestWindowDays: 170,
    annualFoodEnergyGJPerHaAtMaturity: 16,
    maturityRampYears: 7,
    maturityCurve: 'sigmoid',
    inputDependencyIndex: 0.26,
    machineryDependencyIndex: 0.22,
    skillRequirementIndex: 0.74,
    managementComplexityIndex: 0.72,
    seasonalPeakLabourMultiplier: 1.12,
    harvestDistribution: { lateSpring: 0.08, earlySummer: 0.2, lateSummer: 0.26, autumn: 0.28, lateAutumn: 0.1, winterStored: 0.08 },
    notes: 'Food/fodder-tree integration with slower ramp.'
  },
  {
    system: 'coppiceWoodFuel',
    establishmentYears: 6,
    establishmentLabourDaysPerHa: 105,
    maintenanceLabourDaysPerHa: 12,
    harvestLabourDaysPerGJ: 0.55,
    harvestWindowDays: 100,
    annualFoodEnergyGJPerHaAtMaturity: 11,
    maturityRampYears: 8,
    maturityCurve: 'sigmoid',
    inputDependencyIndex: 0.15,
    machineryDependencyIndex: 0.18,
    skillRequirementIndex: 0.64,
    managementComplexityIndex: 0.62,
    seasonalPeakLabourMultiplier: 1.25,
    harvestDistribution: { lateAutumn: 0.4, winterStored: 0.6 },
    notes: 'Wood-energy resilience layer; seasonal cut/store labour peak.'
  },
  {
    system: 'mixedPerennialStapleSystem',
    establishmentYears: 7,
    designPlanningDaysPerHa: 20,
    establishmentLabourDaysPerHa: 165,
    soilPrepTillageDaysPerHa: 1.2,
    plantingSeedingDaysPerHa: 3,
    weedingMulchingDaysPerHa: 4.5,
    irrigationWaterDaysPerHa: 2.5,
    pestDiseaseMonitoringDaysPerHa: 6.5,
    pruningTrainingDaysPerHa: 8.5,
    processingStorageDaysPerGJ: 0.56,
    pathFenceToolMaintenanceDaysPerHa: 5.5,
    observationManagementDaysPerHa: 7.5,
    harvestLabourDaysPerGJ: 0.9,
    harvestWindowDays: 175,
    annualFoodEnergyGJPerHaAtMaturity: 21,
    maturityRampYears: 9,
    maturityCurve: 'sigmoid',
    inputDependencyIndex: 0.24,
    machineryDependencyIndex: 0.16,
    skillRequirementIndex: 0.81,
    managementComplexityIndex: 0.85,
    seasonalPeakLabourMultiplier: 1.1,
    harvestDistribution: { earlySummer: 0.09, lateSummer: 0.23, autumn: 0.36, lateAutumn: 0.2, winterStored: 0.12 },
    notes: 'Perennial staple-focused mixed system.'
  },
  {
    system: 'perennialStapleLowCare',
    establishmentYears: 8,
    designPlanningDaysPerHa: 18,
    establishmentLabourDaysPerHa: 155,
    soilPrepTillageDaysPerHa: 1,
    plantingSeedingDaysPerHa: 2.2,
    weedingMulchingDaysPerHa: 4,
    irrigationWaterDaysPerHa: 2.2,
    pestDiseaseMonitoringDaysPerHa: 6,
    pruningTrainingDaysPerHa: 7.5,
    processingStorageDaysPerGJ: 0.5,
    pathFenceToolMaintenanceDaysPerHa: 5,
    observationManagementDaysPerHa: 7,
    harvestLabourDaysPerGJ: 0.82,
    harvestWindowDays: 185,
    annualFoodEnergyGJPerHaAtMaturity: 20,
    maturityRampYears: 10,
    maturityCurve: 'sigmoid',
    inputDependencyIndex: 0.2,
    machineryDependencyIndex: 0.12,
    skillRequirementIndex: 0.78,
    managementComplexityIndex: 0.79,
    seasonalPeakLabourMultiplier: 1.08,
    harvestDistribution: { earlySummer: 0.09, lateSummer: 0.22, autumn: 0.38, lateAutumn: 0.18, winterStored: 0.13 },
    notes: 'Perennial staple mix with lower recurring care and delayed maturity.'
  },
  {
    system: 'perennialStapleBulkLowCare',
    establishmentYears: 10,
    designPlanningDaysPerHa: 20,
    establishmentLabourDaysPerHa: 170,
    soilPrepTillageDaysPerHa: 0.8,
    plantingSeedingDaysPerHa: 1.8,
    weedingMulchingDaysPerHa: 3.2,
    irrigationWaterDaysPerHa: 2.0,
    pestDiseaseMonitoringDaysPerHa: 5.5,
    pruningTrainingDaysPerHa: 7.0,
    processingStorageDaysPerGJ: 0.42,
    pathFenceToolMaintenanceDaysPerHa: 5.2,
    observationManagementDaysPerHa: 7.0,
    harvestLabourDaysPerGJ: 0.62,
    harvestWindowDays: 170,
    annualFoodEnergyGJPerHaAtMaturity: 24,
    maturityRampYears: 12,
    maturityCurve: 'sigmoid',
    inputDependencyIndex: 0.18,
    machineryDependencyIndex: 0.1,
    skillRequirementIndex: 0.82,
    managementComplexityIndex: 0.76,
    seasonalPeakLabourMultiplier: 1.05,
    harvestDistribution: { earlySummer: 0.07, lateSummer: 0.2, autumn: 0.41, lateAutumn: 0.2, winterStored: 0.12 },
    notes: 'Mature staple/perennial bulk food and wood-energy orientation; delayed maturity with lower fiddly harvest labour.'
  }
];

const PERMACULTURE_ADOPTION_SCENARIOS = [
  {
    scenario: 'noPerennialTransition',
    shareOfHumanFoodProducingHaTransitioned: 0,
    establishmentYears: 0,
    matureSystemShare: 0,
    orchardNutShare: 0,
    coppiceWoodFuelShare: 0,
    marketGardenShare: 0.18,
    annualStapleShare: 0.82,
    notes: 'Reference with annual-dominant production.'
  },
  {
    scenario: 'modestPermacultureTransition',
    shareOfHumanFoodProducingHaTransitioned: 0.2,
    establishmentYears: 6,
    matureSystemShare: 0.55,
    orchardNutShare: 0.2,
    coppiceWoodFuelShare: 0.1,
    marketGardenShare: 0.2,
    annualStapleShare: 0.5,
    notes: 'Partial perennial transition while retaining annual production.'
  },
  {
    scenario: 'strongPermacultureTransition',
    shareOfHumanFoodProducingHaTransitioned: 0.45,
    establishmentYears: 8,
    matureSystemShare: 0.6,
    orchardNutShare: 0.2,
    coppiceWoodFuelShare: 0.1,
    marketGardenShare: 0.15,
    annualStapleShare: 0.3,
    notes: 'Large perennial transition with mixed systems.'
  },
  {
    scenario: 'perennialStapleTransition',
    shareOfHumanFoodProducingHaTransitioned: 0.65,
    establishmentYears: 10,
    matureSystemShare: 0.5,
    orchardNutShare: 0.25,
    coppiceWoodFuelShare: 0.15,
    marketGardenShare: 0.1,
    annualStapleShare: 0.2,
    notes: 'Perennial staple-heavy transition over a longer ramp.'
  }
];

const DRAFT_ANIMAL_SYSTEMS = [
  {
    animalSystem: 'horseTeam',
    animalsPerTeam: 2,
    workDaysPerYear: 170,
    effectiveFieldHoursPerDay: 5.5,
    hectaresServicedPerYear: 42,
    humanHandlerDaysPerHa: 1.4,
    animalCareDaysPerYear: 220,
    feedEnergyGJPerAnimalYear: 36,
    hayPastureHaPerAnimal: 0.95,
    grainFeedHaPerAnimal: 0.2,
    beddingHaEquivalentPerAnimal: 0.08,
    waterNeedLitrePerAnimalDay: 35,
    overwinteringBurdenIndex: 0.62,
    veterinaryRiskIndex: 0.45,
    skillRequirementIndex: 0.72,
    capitalEquipmentIndex: 0.58,
    suitableTasks: ['hauling', 'cultivation', 'mowing', 'light tillage', 'cartage'],
    unsuitableOrLimitedTasks: ['deep tillage in wet soils', 'high-speed heavy freight'],
    notes: 'Balanced draft power; moderate feed and care burden.'
  },
  {
    animalSystem: 'oxenTeam',
    animalsPerTeam: 2,
    workDaysPerYear: 155,
    effectiveFieldHoursPerDay: 5,
    hectaresServicedPerYear: 36,
    humanHandlerDaysPerHa: 1.6,
    animalCareDaysPerYear: 230,
    feedEnergyGJPerAnimalYear: 32,
    hayPastureHaPerAnimal: 1.1,
    grainFeedHaPerAnimal: 0.12,
    beddingHaEquivalentPerAnimal: 0.1,
    waterNeedLitrePerAnimalDay: 40,
    overwinteringBurdenIndex: 0.66,
    veterinaryRiskIndex: 0.42,
    skillRequirementIndex: 0.7,
    capitalEquipmentIndex: 0.54,
    suitableTasks: ['hauling', 'cultivation', 'logging', 'mowing', 'cartage'],
    unsuitableOrLimitedTasks: ['fine market-garden cultivation', 'fast transport'],
    notes: 'Lower grain need, higher pasture and handling burden.'
  },
  {
    animalSystem: 'smallPonyOrMule',
    animalsPerTeam: 2,
    workDaysPerYear: 165,
    effectiveFieldHoursPerDay: 4.8,
    hectaresServicedPerYear: 28,
    humanHandlerDaysPerHa: 1.9,
    animalCareDaysPerYear: 210,
    feedEnergyGJPerAnimalYear: 24,
    hayPastureHaPerAnimal: 0.7,
    grainFeedHaPerAnimal: 0.15,
    beddingHaEquivalentPerAnimal: 0.06,
    waterNeedLitrePerAnimalDay: 25,
    overwinteringBurdenIndex: 0.55,
    veterinaryRiskIndex: 0.48,
    skillRequirementIndex: 0.68,
    capitalEquipmentIndex: 0.5,
    suitableTasks: ['hauling', 'light tillage', 'cartage', 'mowing'],
    unsuitableOrLimitedTasks: ['heavy logging', 'deep cultivation'],
    notes: 'Lower feed demand but lower field capacity.'
  },
  {
    animalSystem: 'mixedAnimalPowerCoop',
    animalsPerTeam: 2,
    workDaysPerYear: 180,
    effectiveFieldHoursPerDay: 5.6,
    hectaresServicedPerYear: 50,
    humanHandlerDaysPerHa: 1.25,
    animalCareDaysPerYear: 200,
    feedEnergyGJPerAnimalYear: 30,
    hayPastureHaPerAnimal: 0.9,
    grainFeedHaPerAnimal: 0.14,
    beddingHaEquivalentPerAnimal: 0.07,
    waterNeedLitrePerAnimalDay: 32,
    overwinteringBurdenIndex: 0.58,
    veterinaryRiskIndex: 0.43,
    skillRequirementIndex: 0.78,
    capitalEquipmentIndex: 0.64,
    suitableTasks: ['hauling', 'cultivation', 'logging', 'mowing', 'light tillage', 'cartage'],
    unsuitableOrLimitedTasks: ['continuous heavy tillage'],
    notes: 'Cooperative rotation improves utilization and handler efficiency.'
  }
];

const HAND_TOOL_CAPACITY_REFERENCE = [
  {
    system: 'intensiveMarketGardenHandTools',
    lowHaPerFullTimeWorker: 0.2,
    baselineHaPerFullTimeWorker: 0.4,
    highHaPerFullTimeWorker: 0.8,
    notes: 'High-value vegetables, dense plantings, frequent harvest, high management intensity.'
  },
  {
    system: 'handScaleAnnualStaples',
    lowHaPerFullTimeWorker: 0.5,
    baselineHaPerFullTimeWorker: 1.0,
    highHaPerFullTimeWorker: 1.5,
    notes: 'Low-fuel annual staple production with significant planting, weeding, and harvest bottlenecks.'
  },
  {
    system: 'efficientSmallScaleAnnualField',
    lowHaPerFullTimeWorker: 1.0,
    baselineHaPerFullTimeWorker: 1.5,
    highHaPerFullTimeWorker: 2.0,
    notes: 'Simpler crop mix, efficient layout, good hand tools/small tools, lower harvest frequency.'
  },
  {
    system: 'maturePerennialStapleLowCare',
    lowHaPerFullTimeWorker: 2.0,
    baselineHaPerFullTimeWorker: 3.5,
    highHaPerFullTimeWorker: 5.0,
    notes: 'Established perennial staple/tree-crop systems with processing partly centralized.'
  },
  {
    system: 'managedGrazingSilvopastureWoodlot',
    lowHaPerFullTimeWorker: 3.0,
    baselineHaPerFullTimeWorker: 6.0,
    highHaPerFullTimeWorker: 10.0,
    notes: 'Lower crop-handling intensity, but includes fencing, rotation, animal care, woodlot work.'
  }
];

const COMMUNITY_ANIMAL_POWER_SCENARIOS = [
  { scenario: 'oneDraftAnimalPer60People', peoplePerAnimal: 60, animalSystem: 'smallPonyOrMule', animalPurposeMode: 'dedicatedDraftOnly', notes: 'Small shared draft capacity per village-scale population.' },
  { scenario: 'oneDraftTeamPer120People', peoplePerAnimal: 60, animalSystem: 'horseTeam', animalPurposeMode: 'multiPurposeDairyOx', notes: 'Roughly one 2-animal draft team per 120 people.' },
  { scenario: 'churchOrVillageAnimalPowerCommons', peoplePerAnimal: 90, animalSystem: 'mixedAnimalPowerCoop', animalPurposeMode: 'multiPurposeMixedFarmAnimal', notes: 'Commons-based animal service for heavy seasonal tasks.' },
  { scenario: 'cooperativeHeavyWorkAnimalPool', peoplePerAnimal: 120, animalSystem: 'mixedAnimalPowerCoop', animalPurposeMode: 'multiPurposeBeefOx', notes: 'Co-op pool focused on bottleneck heavy work, not universal substitution.' },
  { scenario: 'oneSharedTeamPerVillageCluster', peoplePerAnimal: 150, animalSystem: 'horseTeam', animalPurposeMode: 'seasonalCustomTeamService', notes: 'One shared team serves a village cluster for peak bottlenecks.' },
  { scenario: 'customDraftServicePeakSeason', peoplePerAnimal: 220, animalSystem: 'mixedAnimalPowerCoop', animalPurposeMode: 'seasonalCustomTeamService', notes: 'Custom peak-season service with low owned-animal burden.' },
  { scenario: 'cooperativeSeasonalHeavyWorkPool', peoplePerAnimal: 180, animalSystem: 'mixedAnimalPowerCoop', animalPurposeMode: 'seasonalCustomTeamService', notes: 'Co-op seasonal heavy-work pool with mobile teams.' }
];

const COMMUNITY_ANIMAL_RATIO_SEARCH = [30, 45, 60, 90, 120, 180];

const ANIMAL_PURPOSE_MODES = {
  dedicatedDraftOnly: {
    draftCostAllocationShare: 1.0,
    manureFertilityCreditGJEquivalentPerAnimal: 0.0,
    milkOrMeatFoodEnergyCreditGJPerAnimal: 0.0,
    pastureManagementCreditPerAnimal: 0.0,
    fertilityInputDisplacementValuePerAnimal: 0.0,
    seasonalServiceOwnedAnimalShare: 1.0,
    seasonalServiceAccessConstraint: 0.05
  },
  multiPurposeDairyOx: {
    draftCostAllocationShare: 0.55,
    manureFertilityCreditGJEquivalentPerAnimal: 3.0,
    milkOrMeatFoodEnergyCreditGJPerAnimal: 6.0,
    pastureManagementCreditPerAnimal: 1.2,
    fertilityInputDisplacementValuePerAnimal: 1.8,
    seasonalServiceOwnedAnimalShare: 0.9,
    seasonalServiceAccessConstraint: 0.08
  },
  multiPurposeBeefOx: {
    draftCostAllocationShare: 0.68,
    manureFertilityCreditGJEquivalentPerAnimal: 2.5,
    milkOrMeatFoodEnergyCreditGJPerAnimal: 4.5,
    pastureManagementCreditPerAnimal: 1.0,
    fertilityInputDisplacementValuePerAnimal: 1.4,
    seasonalServiceOwnedAnimalShare: 0.9,
    seasonalServiceAccessConstraint: 0.09
  },
  multiPurposeMixedFarmAnimal: {
    draftCostAllocationShare: 0.6,
    manureFertilityCreditGJEquivalentPerAnimal: 2.8,
    milkOrMeatFoodEnergyCreditGJPerAnimal: 5.0,
    pastureManagementCreditPerAnimal: 1.3,
    fertilityInputDisplacementValuePerAnimal: 1.5,
    seasonalServiceOwnedAnimalShare: 0.85,
    seasonalServiceAccessConstraint: 0.07
  },
  seasonalCustomTeamService: {
    draftCostAllocationShare: 0.48,
    manureFertilityCreditGJEquivalentPerAnimal: 1.8,
    milkOrMeatFoodEnergyCreditGJPerAnimal: 2.0,
    pastureManagementCreditPerAnimal: 0.8,
    fertilityInputDisplacementValuePerAnimal: 1.0,
    seasonalServiceOwnedAnimalShare: 0.35,
    seasonalServiceAccessConstraint: 0.16
  }
};

function readJson(filePath, warnings) {
  if (!fs.existsSync(filePath)) {
    warnings.push(`Missing file: ${filePath}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    warnings.push(`Failed to parse file: ${filePath} (${error.message})`);
    return null;
  }
}

function readCsv(filePath, warnings) {
  if (!fs.existsSync(filePath)) {
    warnings.push(`Missing file: ${filePath}`);
    return [];
  }
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return [];
  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const row = {};
    for (let i = 0; i < headers.length; i += 1) row[headers[i]] = cols[i] ?? '';
    return row;
  });
}

function esc(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function toCsv(rows, headers) {
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
}

function n(v, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function roundInt(x) {
  return Math.max(0, Math.round(x));
}

function sum(obj) {
  return Object.values(obj).reduce((a, b) => a + n(b), 0);
}

function normalizeHarvestDistribution(dist = {}) {
  const normalized = Object.fromEntries(HARVEST_SEASONS.map((s) => [s, 0]));
  for (const [key, value] of Object.entries(dist)) {
    if (key in normalized) normalized[key] = Math.max(0, n(value));
  }
  const total = sum(normalized);
  if (total <= 0) {
    normalized.autumn = 1;
    return normalized;
  }
  for (const key of HARVEST_SEASONS) normalized[key] /= total;
  return normalized;
}

export function estimatePopulationCategories(input) {
  const {
    population2021,
    municipalityName,
    municipalityType,
    densityPerKm2,
    settlementFeatureCount,
    productiveLotConcessionCount,
    settlementGardenOpportunityCount,
    cooperativeLandAccessCandidateCount,
    constrainedLandCount
  } = input;

  let urbanBase = municipalityType === 'city' ? 0.74 : municipalityType === 'town' ? 0.5 : 0.2;
  if ((municipalityName ?? '') === 'Owen Sound') urbanBase = 0.86;
  if ((municipalityName ?? '') === 'Hanover') urbanBase = 0.8;
  if (RURAL_PRIORITY.has(municipalityName)) urbanBase -= 0.08;
  urbanBase += clamp01((densityPerKm2 - 80) / 800) * 0.18;
  urbanBase = clamp01(urbanBase);

  const settlementIntensity = clamp01(settlementFeatureCount / 10);
  const lotAccessSignal = productiveLotConcessionCount > 0
    ? clamp01((productiveLotConcessionCount + cooperativeLandAccessCandidateCount) / (productiveLotConcessionCount + constrainedLandCount + settlementGardenOpportunityCount + 1))
    : 0;

  let noDirectLandAccessShare = clamp01(urbanBase * 0.65 + settlementIntensity * 0.18 - lotAccessSignal * 0.22);
  if ((municipalityName ?? '') === 'Owen Sound' || (municipalityName ?? '') === 'Hanover') {
    noDirectLandAccessShare = Math.max(noDirectLandAccessShare, 0.62);
  }

  const pUrban = noDirectLandAccessShare;
  const remaining = Math.max(0, 1 - pUrban);
  let pTownVillage = remaining * (0.25 + settlementIntensity * 0.1);
  let pHamlet = remaining * (0.1 + (1 - urbanBase) * 0.05);
  let pAgLot = remaining * (0.2 + lotAccessSignal * 0.2);
  let pRuralProductive = remaining * (0.18 + lotAccessSignal * 0.22);

  const subTotal = pTownVillage + pHamlet + pAgLot + pRuralProductive;
  if (subTotal > remaining && subTotal > 0) {
    const scale = remaining / subTotal;
    pTownVillage *= scale;
    pHamlet *= scale;
    pAgLot *= scale;
    pRuralProductive *= scale;
  }

  const noDirectLandAccessPopulation = roundInt(population2021 * pUrban);
  let townVillageSettlementPopulation = roundInt(population2021 * pTownVillage);
  let hamletSettlementPopulation = roundInt(population2021 * pHamlet);
  let agriculturalLotAccessPopulation = roundInt(population2021 * pAgLot);
  let ruralProductiveLandAccessPopulation = roundInt(population2021 * pRuralProductive);

  let provisionalWithoutRuralNonFarm = noDirectLandAccessPopulation + townVillageSettlementPopulation + hamletSettlementPopulation
    + agriculturalLotAccessPopulation + ruralProductiveLandAccessPopulation;
  if (provisionalWithoutRuralNonFarm > population2021) {
    let overflow = provisionalWithoutRuralNonFarm - population2021;
    const adjustable = [
      { key: 'ruralProductiveLandAccessPopulation', value: ruralProductiveLandAccessPopulation },
      { key: 'agriculturalLotAccessPopulation', value: agriculturalLotAccessPopulation },
      { key: 'townVillageSettlementPopulation', value: townVillageSettlementPopulation },
      { key: 'hamletSettlementPopulation', value: hamletSettlementPopulation }
    ].sort((a, b) => b.value - a.value);
    for (const bucket of adjustable) {
      if (overflow <= 0) break;
      const dec = Math.min(overflow, bucket.value);
      if (bucket.key === 'ruralProductiveLandAccessPopulation') ruralProductiveLandAccessPopulation -= dec;
      if (bucket.key === 'agriculturalLotAccessPopulation') agriculturalLotAccessPopulation -= dec;
      if (bucket.key === 'townVillageSettlementPopulation') townVillageSettlementPopulation -= dec;
      if (bucket.key === 'hamletSettlementPopulation') hamletSettlementPopulation -= dec;
      overflow -= dec;
    }
    provisionalWithoutRuralNonFarm = noDirectLandAccessPopulation + townVillageSettlementPopulation + hamletSettlementPopulation
      + agriculturalLotAccessPopulation + ruralProductiveLandAccessPopulation;
  }

  const ruralNonFarmPopulation = Math.max(0, population2021 - provisionalWithoutRuralNonFarm);
  const urbanSettlementPopulation = noDirectLandAccessPopulation;

  return {
    urbanSettlementPopulation,
    townVillageSettlementPopulation,
    hamletSettlementPopulation,
    ruralNonFarmPopulation,
    ruralProductiveLandAccessPopulation,
    agriculturalLotAccessPopulation,
    noDirectLandAccessPopulation,
    method: 'heuristicEstimate',
    confidence: 0.55
  };
}

function evaluateProductionSystem(system, context) {
  const {
    foodWorkerDaysPerYear,
    lowFuelAnnualBaseline,
    annualReferenceLabourDaysPerHa,
    annualReferencePeakHarvestShare
  } = context;

  const harvestDistribution = normalizeHarvestDistribution(system.harvestDistribution);
  const peakHarvestShare = Math.max(...Object.values(harvestDistribution));
  const nonZero = Object.values(harvestDistribution).filter((v) => v > 0).length;
  const concentrationHerfindahl = Object.values(harvestDistribution).reduce((acc, v) => acc + v * v, 0);
  const harvestConcentrationIndex = clamp01(concentrationHerfindahl);
  const rollingHarvestAdvantage = clamp01(1 - peakHarvestShare);
  const seasonalLabourSmoothingFactor = clamp01(1 - (peakHarvestShare - (1 / Math.max(nonZero, 1)) * 0.5));

  let recurringNonHarvestLabourDaysPerHa =
    n(system.soilPrepTillageDaysPerHa) +
    n(system.plantingSeedingDaysPerHa) +
    n(system.weedingMulchingDaysPerHa) +
    n(system.irrigationWaterDaysPerHa) +
    n(system.pestDiseaseMonitoringDaysPerHa) +
    n(system.pruningTrainingDaysPerHa) +
    n(system.pathFenceToolMaintenanceDaysPerHa) +
    n(system.observationManagementDaysPerHa);
  if (recurringNonHarvestLabourDaysPerHa === 0 && n(system.maintenanceLabourDaysPerHa) > 0) {
    recurringNonHarvestLabourDaysPerHa = n(system.maintenanceLabourDaysPerHa);
  }
  const harvestLabourDaysPerHa = n(system.annualFoodEnergyGJPerHaAtMaturity) * (n(system.harvestLabourDaysPerGJ) + n(system.fieldPackingHandlingDaysPerGJ));
  const processingStorageLabourDaysPerHa = n(system.annualFoodEnergyGJPerHaAtMaturity) * n(system.processingStorageDaysPerGJ);
  const labourDaysPerHaAtYear1 = n(system.designPlanningDaysPerHa) + n(system.establishmentLabourDaysPerHa)
    + recurringNonHarvestLabourDaysPerHa + (harvestLabourDaysPerHa * 0.25) + (processingStorageLabourDaysPerHa * 0.2);
  const onLandLabourDaysPerHaAtMaturity = recurringNonHarvestLabourDaysPerHa + harvestLabourDaysPerHa;
  const regionalProcessingLabourDaysPerHaAtMaturity = processingStorageLabourDaysPerHa
    + n(system.annualFoodEnergyGJPerHaAtMaturity) * (n(system.millingShellingPressingDaysPerGJ) + n(system.dryingCuringFreezingDaysPerGJ) + n(system.distributionDepotDaysPerGJ));
  const totalSystemLabourDaysPerHaAtMaturity = onLandLabourDaysPerHaAtMaturity + regionalProcessingLabourDaysPerHaAtMaturity;
  const labourDaysPerHaAtMaturity = totalSystemLabourDaysPerHaAtMaturity;

  const totalSystemFoodEnergyGJPerLabourDayAtMaturity = labourDaysPerHaAtMaturity > 0
    ? system.annualFoodEnergyGJPerHaAtMaturity / labourDaysPerHaAtMaturity : 0;
  const onLandFoodEnergyGJPerLabourDayAtMaturity = onLandLabourDaysPerHaAtMaturity > 0
    ? system.annualFoodEnergyGJPerHaAtMaturity / onLandLabourDaysPerHaAtMaturity : 0;
  const onLandManageableHaPerWorkerAtMaturity = onLandLabourDaysPerHaAtMaturity > 0 ? foodWorkerDaysPerYear / onLandLabourDaysPerHaAtMaturity : 0;
  const systemManageableHaPerWorkerAtMaturity = labourDaysPerHaAtMaturity > 0 ? foodWorkerDaysPerYear / labourDaysPerHaAtMaturity : 0;
  const manageableHaPerWorkerAtMaturity = systemManageableHaPerWorkerAtMaturity;

  const peakLabourDaysPerHarvestWindow = labourDaysPerHaAtMaturity * peakHarvestShare * system.seasonalPeakLabourMultiplier;
  const establishmentLabourDeficitDays = Math.max(0, n(system.establishmentLabourDaysPerHa) - annualReferenceLabourDaysPerHa);

  const labourReductionAtMaturity = annualReferenceLabourDaysPerHa - labourDaysPerHaAtMaturity;
  const manageableHaMultiplierVsLowFuelAnnual = lowFuelAnnualBaseline.manageableHaPerWorkerAtMaturity > 0
    ? manageableHaPerWorkerAtMaturity / lowFuelAnnualBaseline.manageableHaPerWorkerAtMaturity : 0;
  const peakLabourReductionVsAnnual = annualReferencePeakHarvestShare - peakHarvestShare;
  const inputDependencyReductionVsAnnual = lowFuelAnnualBaseline.inputDependencyIndex - system.inputDependencyIndex;
  const foodEnergyGJPerHaRatioVsAnnual = lowFuelAnnualBaseline.annualFoodEnergyGJPerHaAtMaturity > 0
    ? system.annualFoodEnergyGJPerHaAtMaturity / lowFuelAnnualBaseline.annualFoodEnergyGJPerHaAtMaturity : 0;
  const foodEnergyGJPerLabourDayRatioVsAnnual = lowFuelAnnualBaseline.foodEnergyGJPerLabourDayAtMaturity > 0
    ? totalSystemFoodEnergyGJPerLabourDayAtMaturity / lowFuelAnnualBaseline.foodEnergyGJPerLabourDayAtMaturity : 0;

  const yearsUntilNetLabourAdvantage = labourReductionAtMaturity > 0
    ? Math.max(1, Math.ceil(n(system.establishmentLabourDaysPerHa) / labourReductionAtMaturity))
    : null;
  const yearsUntilFoodEnergyMaturity = system.maturityRampYears;
  const transitionDipGJ = Math.max(0, lowFuelAnnualBaseline.annualFoodEnergyGJPerHaAtMaturity * 0.2 * Math.min(1, system.establishmentYears / 8));
  const establishmentBottleneckWarning = n(system.establishmentLabourDaysPerHa) > 120 || system.skillRequirementIndex > 0.75;

  const soilPrepReductionPct = annualReferenceLabourDaysPerHa > 0
    ? ((n(lowFuelAnnualBaseline.soilPrepTillageDaysPerHa) - n(system.soilPrepTillageDaysPerHa)) / Math.max(1e-9, n(lowFuelAnnualBaseline.soilPrepTillageDaysPerHa))) * 100 : 0;
  const plantingSeedingReductionPct = annualReferenceLabourDaysPerHa > 0
    ? ((n(lowFuelAnnualBaseline.plantingSeedingDaysPerHa) - n(system.plantingSeedingDaysPerHa)) / Math.max(1e-9, n(lowFuelAnnualBaseline.plantingSeedingDaysPerHa))) * 100 : 0;
  const weedingMulchingReductionPct = annualReferenceLabourDaysPerHa > 0
    ? ((n(lowFuelAnnualBaseline.weedingMulchingDaysPerHa) - n(system.weedingMulchingDaysPerHa)) / Math.max(1e-9, n(lowFuelAnnualBaseline.weedingMulchingDaysPerHa))) * 100 : 0;
  const harvestLabourChangePct = ((harvestLabourDaysPerHa - n(lowFuelAnnualBaseline.harvestLabourDaysPerHa)) / Math.max(1e-9, n(lowFuelAnnualBaseline.harvestLabourDaysPerHa))) * 100;
  const processingStorageChangePct = ((processingStorageLabourDaysPerHa - n(lowFuelAnnualBaseline.processingStorageLabourDaysPerHa)) / Math.max(1e-9, n(lowFuelAnnualBaseline.processingStorageLabourDaysPerHa))) * 100;
  const recurringNonHarvestReductionPct = ((n(lowFuelAnnualBaseline.recurringNonHarvestLabourDaysPerHa) - recurringNonHarvestLabourDaysPerHa) / Math.max(1e-9, n(lowFuelAnnualBaseline.recurringNonHarvestLabourDaysPerHa))) * 100;
  const totalLabourReductionPct = ((annualReferenceLabourDaysPerHa - labourDaysPerHaAtMaturity) / Math.max(1e-9, annualReferenceLabourDaysPerHa)) * 100;

  return {
    ...system,
    labourDaysPerHaAtYear1,
    labourDaysPerHaAtMaturity,
    onLandLabourDaysPerHaAtMaturity,
    regionalProcessingLabourDaysPerHaAtMaturity,
    totalSystemLabourDaysPerHaAtMaturity,
    recurringNonHarvestLabourDaysPerHa,
    harvestLabourDaysPerHa,
    processingStorageLabourDaysPerHa,
    foodEnergyGJPerLabourDayAtMaturity: totalSystemFoodEnergyGJPerLabourDayAtMaturity,
    onLandFoodEnergyGJPerLabourDayAtMaturity,
    totalSystemFoodEnergyGJPerLabourDayAtMaturity,
    manageableHaPerWorkerAtMaturity,
    onLandManageableHaPerWorkerAtMaturity,
    systemManageableHaPerWorkerAtMaturity,
    peakLabourDaysPerHarvestWindow,
    seasonalLabourSmoothingFactor,
    externalInputDependencyIndex: system.inputDependencyIndex,
    skillBottleneckIndex: clamp01((system.skillRequirementIndex + system.managementComplexityIndex) / 2),
    harvestConcentrationIndex,
    peakHarvestShare,
    rollingHarvestAdvantage,
    labourSmoothingMultiplier: 1 - rollingHarvestAdvantage * 0.35,
    establishmentLabourDeficitDays,
    yearsUntilNetLabourAdvantage,
    yearsUntilFoodEnergyMaturity,
    transitionDipGJ,
    establishmentBottleneckWarning,
    labourReductionAtMaturity,
    manageableHaMultiplierVsLowFuelAnnual,
    peakLabourReductionVsAnnual,
    inputDependencyReductionVsAnnual,
    foodEnergyGJPerHaRatioVsAnnual,
    foodEnergyGJPerLabourDayRatioVsAnnual,
    soilPrepReductionPct,
    plantingSeedingReductionPct,
    weedingMulchingReductionPct,
    harvestLabourChangePct,
    processingStorageChangePct,
    recurringNonHarvestReductionPct,
    totalLabourReductionPct,
    harvestDistribution
  };
}

function buildPermacultureScenarioRows(args) {
  const {
    regional,
    foodWorkerDaysPerYear,
    lowFuelRequiredLabourDays,
    lowFuelAvailableLabourDays,
    systemById
  } = args;

  const maturePermaculture = systemById.get('maturePermacultureLowCare');
  const orchardNutPolyculture = systemById.get('orchardNutPolyculture');
  const coppiceWoodFuel = systemById.get('coppiceWoodFuel');
  const marketGardenIntensive = systemById.get('marketGardenIntensive');
  const annualLowFuel = systemById.get('annualLowFuelEfficient');

  return PERMACULTURE_ADOPTION_SCENARIOS.map((scenario) => {
    const transitionedHa = regional.estimatedHumanFoodProducingHa * scenario.shareOfHumanFoodProducingHaTransitioned;
    const annualHa = regional.estimatedHumanFoodProducingHa - transitionedHa;

    const transitionedComponents = [
      { share: scenario.matureSystemShare, system: maturePermaculture },
      { share: scenario.orchardNutShare, system: orchardNutPolyculture },
      { share: scenario.coppiceWoodFuelShare, system: coppiceWoodFuel },
      { share: scenario.marketGardenShare, system: marketGardenIntensive }
    ];

    const transitionedShareSum = transitionedComponents.reduce((a, b) => a + b.share, 0);
    const normalizedTransitionedComponents = transitionedComponents.map((c) => ({ ...c, share: transitionedShareSum > 0 ? c.share / transitionedShareSum : 0 }));

    const matureTransitionLabourDays = normalizedTransitionedComponents.reduce((acc, c) => {
      if (!c.system) return acc;
      const ha = transitionedHa * c.share;
      return acc + ha * c.system.labourDaysPerHaAtMaturity;
    }, 0);

    const transitionedFoodGJ = normalizedTransitionedComponents.reduce((acc, c) => {
      if (!c.system) return acc;
      const ha = transitionedHa * c.share;
      return acc + ha * c.system.annualFoodEnergyGJPerHaAtMaturity;
    }, 0);

    const annualFoodHaMixShare = clamp01(scenario.annualStapleShare + (1 - scenario.shareOfHumanFoodProducingHaTransitioned) * 0.1);
    const annualMixSystem = annualLowFuel;
    const annualLabourDays = annualHa * annualMixSystem.labourDaysPerHaAtMaturity * (0.9 + annualFoodHaMixShare * 0.2);
    const annualFoodGJ = annualHa * annualMixSystem.annualFoodEnergyGJPerHaAtMaturity;

    const establishmentLabourDays = normalizedTransitionedComponents.reduce((acc, c) => {
      if (!c.system) return acc;
      const ha = transitionedHa * c.share;
      return acc + ha * c.system.establishmentLabourDaysPerHa;
    }, 0);

    const totalLabourDaysAtMaturity = matureTransitionLabourDays + annualLabourDays;
    const totalFoodEnergyGJAtMaturity = transitionedFoodGJ + annualFoodGJ;
    const foodWorkerFTEAtMaturity = totalLabourDaysAtMaturity / foodWorkerDaysPerYear;
    const labourDeficitDaysAtMaturity = Math.max(0, totalLabourDaysAtMaturity - lowFuelAvailableLabourDays);
    const effectiveProductiveHaPerWorker = foodWorkerFTEAtMaturity > 0 ? regional.estimatedHumanFoodProducingHa / foodWorkerFTEAtMaturity : 0;
    const lowFuelHaPerWorker = lowFuelRequiredLabourDays > 0 ? regional.estimatedHumanFoodProducingHa / (lowFuelRequiredLabourDays / foodWorkerDaysPerYear) : 0;
    const permacultureLeverageMultiplier = lowFuelHaPerWorker > 0 ? effectiveProductiveHaPerWorker / lowFuelHaPerWorker : 1;
    const yearsUntilMaturity = scenario.establishmentYears;

    return {
      scenario: scenario.scenario,
      transitionedHa,
      establishmentLabourDays,
      matureMaintenanceLabourDays: matureTransitionLabourDays,
      matureHarvestLabourDays: maturedHarvestDaysEstimate(normalizedTransitionedComponents, transitionedHa),
      totalLabourDaysAtMaturity,
      totalFoodEnergyGJAtMaturity,
      foodWorkerFTEAtMaturity,
      labourDeficitDaysAtMaturity,
      effectiveProductiveHaPerWorker,
      permacultureLeverageMultiplier,
      yearsUntilMaturity,
      caveats: 'Transition requires establishment labour, skill, and time; not magic yield.',
      notes: scenario.notes
    };
  });
}

function maturedHarvestDaysEstimate(components, transitionedHa) {
  return components.reduce((acc, c) => {
    if (!c.system) return acc;
    const ha = transitionedHa * c.share;
    return acc + ha * c.system.annualFoodEnergyGJPerHaAtMaturity * c.system.harvestLabourDaysPerGJ;
  }, 0);
}

function buildAnimalPowerScenarios(args) {
  const { regional, availableFoodLabourDays, foodWorkerDaysPerYear, lowFuelScenario, systemById } = args;
  const lowFuelHumanOnly = systemById.get('annualLowFuelHandScale');
  const perennialStaples = systemById.get('perennialStapleBulkLowCare') ?? systemById.get('perennialStapleLowCare');
  const productiveHa = regional.estimatedHumanFoodProducingHa;
  const scenarioDefs = [
    { scenario: 'lowFuelHumanOnly', animalSystem: null, transitionPerennial: false },
    { scenario: 'lowFuelWithHorseTeams', animalSystem: 'horseTeam', transitionPerennial: false },
    { scenario: 'lowFuelWithOxenTeams', animalSystem: 'oxenTeam', transitionPerennial: false },
    { scenario: 'lowFuelWithMixedAnimalPower', animalSystem: 'mixedAnimalPowerCoop', transitionPerennial: false },
    { scenario: 'lowFuelWithPerennialStaples', animalSystem: null, transitionPerennial: true },
    { scenario: 'lowFuelWithPerennialStaplesAndAnimalPower', animalSystem: 'mixedAnimalPowerCoop', transitionPerennial: true }
  ];

  const rows = [];
  for (const def of scenarioDefs) {
    const prodSystem = def.transitionPerennial ? perennialStaples : lowFuelHumanOnly;
    const baseFoodGJ = productiveHa * n(prodSystem?.annualFoodEnergyGJPerHaAtMaturity, 0);
    let feedHaRequired = 0;
    let hayPastureHaRequired = 0;
    let grainFeedHaRequired = 0;
    let beddingHaEquivalentRequired = 0;
    let animalFeedEnergyGJ = 0;
    let teamsNeeded = 0;
    let animalsNeeded = 0;
    let dieselDisplacedLitre = 0;
    let humanLabourReducedDays = 0;
    let animalCareLabourDays = 0;
    let machinerySupportReplacedShare = 0;
    let animalSystem = null;
    if (def.animalSystem) {
      animalSystem = DRAFT_ANIMAL_SYSTEMS.find((s) => s.animalSystem === def.animalSystem);
      teamsNeeded = Math.max(0, Math.ceil(productiveHa / Math.max(1, n(animalSystem.hectaresServicedPerYear, 1))));
      animalsNeeded = teamsNeeded * n(animalSystem.animalsPerTeam, 0);
      hayPastureHaRequired = animalsNeeded * n(animalSystem.hayPastureHaPerAnimal, 0);
      grainFeedHaRequired = animalsNeeded * n(animalSystem.grainFeedHaPerAnimal, 0);
      beddingHaEquivalentRequired = animalsNeeded * n(animalSystem.beddingHaEquivalentPerAnimal, 0);
      feedHaRequired = hayPastureHaRequired + grainFeedHaRequired + beddingHaEquivalentRequired;
      animalFeedEnergyGJ = animalsNeeded * n(animalSystem.feedEnergyGJPerAnimalYear, 0);
      machinerySupportReplacedShare = Math.min(0.55, teamsNeeded * 0.01);
      dieselDisplacedLitre = productiveHa * machinerySupportReplacedShare * 24;
      humanLabourReducedDays = productiveHa * 9 * machinerySupportReplacedShare;
      animalCareLabourDays = teamsNeeded * n(animalSystem.animalCareDaysPerYear, 0);
    }
    const feedFromPastureFodderHa = hayPastureHaRequired + beddingHaEquivalentRequired;
    const feedFromHumanFoodCropHa = grainFeedHaRequired;
    const feedCompetitionWithHumanFoodGJ = feedFromHumanFoodCropHa * n(prodSystem?.annualFoodEnergyGJPerHaAtMaturity, 0);
    const netHumanFoodHaAfterFeed = Math.max(0, productiveHa - feedFromHumanFoodCropHa);
    const feedLandShareOfProductiveHa = productiveHa > 0 ? feedHaRequired / productiveHa : 0;
    const foodEnergyOpportunityCostGJ = feedCompetitionWithHumanFoodGJ;
    const netFoodEnergyAfterAnimalFeedGJ = Math.max(0, baseFoodGJ - foodEnergyOpportunityCostGJ);

    const requiredHumanFoodLabourDays = netHumanFoodHaAfterFeed * n(prodSystem?.onLandLabourDaysPerHaAtMaturity, 0);
    const regionalProcessingLabourDays = netHumanFoodHaAfterFeed * n(prodSystem?.regionalProcessingLabourDaysPerHaAtMaturity, 0);
    const netHumanLabourChangeDays = animalCareLabourDays - humanLabourReducedDays;
    const totalHumanLabourDays = requiredHumanFoodLabourDays + regionalProcessingLabourDays + animalCareLabourDays - humanLabourReducedDays;
    const labourDeficitDays = Math.max(0, totalHumanLabourDays - availableFoodLabourDays);
    const requiredHumanFTE = totalHumanLabourDays / foodWorkerDaysPerYear;

    rows.push({
      scenario: def.scenario,
      animalSystem: def.animalSystem ?? 'none',
      productiveHa,
      feedHaRequired,
      hayPastureHaRequired,
      grainFeedHaRequired,
      beddingHaEquivalentRequired,
      feedFromPastureFodderHa,
      feedFromHumanFoodCropHa,
      feedCompetitionWithHumanFoodGJ,
      netHumanFoodHaAfterFeed,
      feedLandShareOfProductiveHa,
      foodEnergyOpportunityCostGJ,
      netFoodEnergyAfterAnimalFeedGJ,
      requiredHumanFoodLabourDays,
      animalCareLabourDays,
      totalHumanLabourDays,
      availableFoodLabourDays,
      labourDeficitDays,
      requiredHumanFTE,
      animalTeamsNeeded: teamsNeeded,
      animalsNeeded,
      animalFeedEnergyGJ,
      dieselDisplacedLitre,
      machinerySupportReplacedShare,
      humanLabourReducedDays,
      netHumanLabourChangeDays,
      netLabourDaysPerHaWithAnimalPower: productiveHa > 0 ? totalHumanLabourDays / productiveHa : 0,
      haManagedPerHumanWorkerWithAnimalPower: requiredHumanFTE > 0 ? productiveHa / requiredHumanFTE : 0,
      fossilFuelLeverageReplacedByAnimalPower: machinerySupportReplacedShare,
      animalPowerLeverageRatio: lowFuelScenario.requiredFoodWorkerFTE > 0 ? (lowFuelScenario.requiredFoodWorkerFTE / Math.max(1e-9, requiredHumanFTE)) : 0,
      notes: animalSystem ? animalSystem.notes : 'Human-only low-fuel baseline'
    });
  }
  return rows;
}

function estimateHeavyWorkDemandDays(productiveHa) {
  return productiveHa * 11.5;
}

function buildHeavyWorkTaskBreakdown(productiveHa, coverage) {
  const tasks = [
    { task: 'primaryTillageOrBedPrep', humanOnlyDaysPerHa: 2.3, animalAssistFactor: 0.42, tonneKmPerHa: 0.08, seasonalWindow: 'spring' },
    { task: 'compostManureHauling', humanOnlyDaysPerHa: 1.8, animalAssistFactor: 0.48, tonneKmPerHa: 0.2, seasonalWindow: 'spring-autumn' },
    { task: 'harvestDepotHauling', humanOnlyDaysPerHa: 1.6, animalAssistFactor: 0.52, tonneKmPerHa: 0.18, seasonalWindow: 'summer-autumn' },
    { task: 'firewoodLogHauling', humanOnlyDaysPerHa: 1.2, animalAssistFactor: 0.45, tonneKmPerHa: 0.28, seasonalWindow: 'autumn-winter' },
    { task: 'waterHauling', humanOnlyDaysPerHa: 0.7, animalAssistFactor: 0.5, tonneKmPerHa: 0.05, seasonalWindow: 'summer' },
    { task: 'hayMowingRaking', humanOnlyDaysPerHa: 1.6, animalAssistFactor: 0.44, tonneKmPerHa: 0.14, seasonalWindow: 'summer' },
    { task: 'localFreightCartage', humanOnlyDaysPerHa: 1.3, animalAssistFactor: 0.47, tonneKmPerHa: 0.22, seasonalWindow: 'year-round' }
  ];
  return tasks.map((t) => {
    const humanOnlyLabourDays = productiveHa * t.humanOnlyDaysPerHa;
    const labourSavedDays = humanOnlyLabourDays * t.animalAssistFactor * coverage;
    const animalAssistedLabourDays = Math.max(0, humanOnlyLabourDays - labourSavedDays);
    const tonneKmSupported = productiveHa * t.tonneKmPerHa * coverage * 100;
    return { ...t, humanOnlyLabourDays, animalAssistedLabourDays, labourSavedDays, tonneKmSupported };
  });
}

function buildCommunityAnimalPowerScenarios(args) {
  const { regional, systemById } = args;
  const productiveHa = regional.estimatedHumanFoodProducingHa;
  const people = regional.totalPopulation2021;
  const lowFuelHand = systemById.get('annualLowFuelHandScale');
  const baseFoodGJPerHa = n(lowFuelHand?.annualFoodEnergyGJPerHaAtMaturity, 0);
  const baseHeavyWorkDemandDays = estimateHeavyWorkDemandDays(productiveHa);
  const baseHumanHeavyWorkOnlyDays = baseHeavyWorkDemandDays * 1.15;
  const baseHumanLabourDays = productiveHa * n(lowFuelHand?.onLandLabourDaysPerHaAtMaturity, 0);

  const rows = COMMUNITY_ANIMAL_POWER_SCENARIOS.map((def) => {
    const animalSystem = DRAFT_ANIMAL_SYSTEMS.find((s) => s.animalSystem === def.animalSystem);
    const mode = ANIMAL_PURPOSE_MODES[def.animalPurposeMode] ?? ANIMAL_PURPOSE_MODES.dedicatedDraftOnly;
    const animalsNeededGross = Math.max(1, Math.round(people / Math.max(1, n(def.peoplePerAnimal, 60))));
    const ownedAnimalsNeeded = Math.max(1, Math.round(animalsNeededGross * n(mode.seasonalServiceOwnedAnimalShare, 1)));
    const serviceTeamsNeeded = Math.max(1, Math.ceil((animalsNeededGross - ownedAnimalsNeeded) / Math.max(1, n(animalSystem?.animalsPerTeam, 2))));
    const teamsNeeded = Math.max(1, Math.ceil(ownedAnimalsNeeded / Math.max(1, n(animalSystem?.animalsPerTeam, 2)))) + serviceTeamsNeeded;
    const animalsNeeded = ownedAnimalsNeeded + (serviceTeamsNeeded * n(animalSystem?.animalsPerTeam, 2));

    const hayPastureHaRequired = animalsNeeded * n(animalSystem?.hayPastureHaPerAnimal, 0);
    const grainFeedHaRequired = animalsNeeded * n(animalSystem?.grainFeedHaPerAnimal, 0);
    const beddingHaEquivalentRequired = animalsNeeded * n(animalSystem?.beddingHaEquivalentPerAnimal, 0);
    const feedHaRequired = hayPastureHaRequired + grainFeedHaRequired + beddingHaEquivalentRequired;
    const feedFromPastureFodderHa = hayPastureHaRequired + beddingHaEquivalentRequired;
    const feedFromHumanFoodCropHa = grainFeedHaRequired;
    const feedFromMarginalOrNonHumanFoodLandHa = feedFromPastureFodderHa * 0.7;
    const feedCompetitionWithHumanFoodShare = feedHaRequired > 0 ? feedFromHumanFoodCropHa / feedHaRequired : 0;

    const heavyWorkCapacityDays = teamsNeeded * n(animalSystem?.workDaysPerYear, 0) * 0.78;
    const heavyWorkCoverage = clamp01(baseHeavyWorkDemandDays > 0 ? heavyWorkCapacityDays / baseHeavyWorkDemandDays : 0);
    const taskBreakdown = buildHeavyWorkTaskBreakdown(productiveHa, heavyWorkCoverage);
    const heavyWorkLabourSavedDays = taskBreakdown.reduce((s, t) => s + t.labourSavedDays, 0);
    const heavyWorkWithAnimalPowerDays = Math.max(0, baseHumanHeavyWorkOnlyDays - heavyWorkLabourSavedDays);
    const heavyWorkBottleneckReductionPct = baseHumanHeavyWorkOnlyDays > 0
      ? ((baseHumanHeavyWorkOnlyDays - heavyWorkWithAnimalPowerDays) / baseHumanHeavyWorkOnlyDays) * 100 : 0;

    const transportHeavyLoadsEnabledTonneKm = teamsNeeded * n(animalSystem?.workDaysPerYear, 0) * 2.4;
    const plowingOrBedPrepHaEnabled = teamsNeeded * n(animalSystem?.hectaresServicedPerYear, 0) * 0.45;
    const firewoodHaulingBenefit = teamsNeeded * 85;
    const manureHaulingBenefit = teamsNeeded * 110;
    const heavyLoadsTonneKmSupported = transportHeavyLoadsEnabledTonneKm + firewoodHaulingBenefit + manureHaulingBenefit;

    const additionalProductiveHaEnabled = productiveHa * 0.045 * heavyWorkCoverage;
    const additionalFoodEnergyEnabledGJ = additionalProductiveHaEnabled * baseFoodGJPerHa * (1 - 0.3 * feedCompetitionWithHumanFoodShare);
    const animalCareLabourDays = teamsNeeded * n(animalSystem?.animalCareDaysPerYear, 0);
    const humanLabourSavedDays = heavyWorkLabourSavedDays + (additionalProductiveHaEnabled * 4.5);
    const netLabourBenefitDays = humanLabourSavedDays - animalCareLabourDays;
    const netHumanLabourChangeDays = animalCareLabourDays - humanLabourSavedDays;

    const animalFeedEnergyGJ = animalsNeeded * n(animalSystem?.feedEnergyGJPerAnimalYear, 0);
    const foodEnergyOpportunityCostGJ = feedFromHumanFoodCropHa * baseFoodGJPerHa;
    const netFoodEnergyAfterAnimalFeedGJ = (productiveHa * baseFoodGJPerHa) + additionalFoodEnergyEnabledGJ - foodEnergyOpportunityCostGJ;
    const netFoodEnergyBenefitGJ = additionalFoodEnergyEnabledGJ - foodEnergyOpportunityCostGJ;
    const manureFertilityCreditGJEquivalent = animalsNeeded * n(mode.manureFertilityCreditGJEquivalentPerAnimal, 0);
    const milkOrMeatFoodEnergyCreditGJ = animalsNeeded * n(mode.milkOrMeatFoodEnergyCreditGJPerAnimal, 0);
    const pastureManagementCredit = animalsNeeded * n(mode.pastureManagementCreditPerAnimal, 0);
    const fertilityInputDisplacementValue = animalsNeeded * n(mode.fertilityInputDisplacementValuePerAnimal, 0);
    const coProductCreditGJEquivalent = manureFertilityCreditGJEquivalent + milkOrMeatFoodEnergyCreditGJ + pastureManagementCredit + fertilityInputDisplacementValue;
    const draftCostAllocationShare = n(mode.draftCostAllocationShare, 1);
    const cappedCredit = Math.min(coProductCreditGJEquivalent, animalFeedEnergyGJ * 0.85);
    const netLabourBenefitDaysDraftOnly = netLabourBenefitDays;
    const netFoodEnergyBenefitGJDraftOnly = netFoodEnergyBenefitGJ;
    const netBenefitScoreDraftOnly = netLabourBenefitDaysDraftOnly * 0.5 + netFoodEnergyBenefitGJDraftOnly * 0.5;
    const allocatedCareBurden = animalCareLabourDays * draftCostAllocationShare;
    const allocatedFeedPenaltyGJ = foodEnergyOpportunityCostGJ * draftCostAllocationShare;
    const netLabourBenefitDaysAllocated = humanLabourSavedDays - allocatedCareBurden;
    const netFoodEnergyBenefitGJAllocated = additionalFoodEnergyEnabledGJ - allocatedFeedPenaltyGJ + cappedCredit;
    const netBenefitScoreAllocated = netLabourBenefitDaysAllocated * 0.5 + netFoodEnergyBenefitGJAllocated * 0.5;
    const peakSeasonWorkDays = teamsNeeded * n(animalSystem?.workDaysPerYear, 0) * (0.35 + n(mode.seasonalServiceAccessConstraint, 0.1));
    const heavyWorkServedHa = plowingOrBedPrepHaEnabled + (additionalProductiveHaEnabled * 0.5);
    const heavyWorkServedHouseholds = Math.max(1, Math.round(people / 2.4 * (0.18 + 0.45 * heavyWorkCoverage)));
    const annualCareBurdenChargedToCommunity = allocatedCareBurden;
    const careBurdenPerHousehold = annualCareBurdenChargedToCommunity / Math.max(1, people / 2.4);
    const serviceAccessConstraint = n(mode.seasonalServiceAccessConstraint, 0.1);
    const dieselDisplacedLitre = teamsNeeded * n(animalSystem?.workDaysPerYear, 0) * 7.8;
    const animalPowerFavourabilityIndex = clamp01(
      (0.45 * clamp01((netLabourBenefitDaysAllocated + 2000) / 5000))
      + (0.35 * clamp01((netFoodEnergyBenefitGJAllocated + 500) / 2000))
      + (0.2 * (1 - feedCompetitionWithHumanFoodShare))
    );
    const peopleServed = animalsNeeded * n(def.peoplePerAnimal, 0);

    return {
      scenario: def.scenario,
      animalPurposeMode: def.animalPurposeMode ?? 'dedicatedDraftOnly',
      peoplePerAnimal: n(def.peoplePerAnimal, 0),
      peopleServed,
      animalSystem: def.animalSystem,
      animalsNeeded,
      ownedAnimalsNeeded,
      serviceTeamsNeeded,
      teamsNeeded,
      feedHaRequired,
      hayPastureHaRequired,
      grainFeedHaRequired,
      beddingHaEquivalentRequired,
      feedFromPastureFodderHa,
      feedFromMarginalOrNonHumanFoodLandHa,
      feedFromHumanFoodCropHa,
      feedCompetitionWithHumanFoodShare,
      animalPowerFavourabilityIndex,
      animalCareLabourDays,
      annualCareBurdenChargedToCommunity,
      careBurdenPerHousehold,
      serviceAccessConstraint,
      heavyWorkDemandDays: baseHeavyWorkDemandDays,
      heavyWorkHumanOnlyDays: baseHumanHeavyWorkOnlyDays,
      heavyWorkWithAnimalPowerDays,
      heavyWorkBottleneckReductionPct,
      heavyWorkLabourSavedDays,
      heavyWorkTasks: taskBreakdown,
      humanLabourSavedDays,
      netLabourBenefitDays,
      netHumanLabourChangeDays,
      transportHeavyLoadsEnabledTonneKm,
      heavyLoadsTonneKmSupported,
      peakSeasonWorkDays,
      plowingOrBedPrepHaEnabled,
      heavyWorkServedHa,
      heavyWorkServedHouseholds,
      firewoodHaulingBenefit,
      manureHaulingBenefit,
      additionalProductiveHaEnabled,
      additionalFoodEnergyEnabledGJ,
      foodEnergyOpportunityCostGJ,
      netFoodEnergyAfterAnimalFeedGJ,
      netFoodEnergyBenefitGJ,
      manureFertilityCreditGJEquivalent,
      milkOrMeatFoodEnergyCreditGJ,
      pastureManagementCredit,
      fertilityInputDisplacementValue,
      coProductCreditGJEquivalent: cappedCredit,
      draftCostAllocationShare,
      netLabourBenefitDaysDraftOnly,
      netFoodEnergyBenefitGJDraftOnly,
      netBenefitScoreDraftOnly,
      netLabourBenefitDaysAllocated,
      netFoodEnergyBenefitGJAllocated,
      netBenefitScoreAllocated,
      animalFeedEnergyGJ,
      dieselDisplacedLitre,
      netBenefitScore: netBenefitScoreAllocated,
      haManagedPerHumanWorkerWithAnimalPower: Math.max(0, productiveHa + additionalProductiveHaEnabled) / Math.max(1e-9, (baseHumanLabourDays + netHumanLabourChangeDays) / 220),
      notes: def.notes
    };
  });

  return rows;
}

function buildAnimalPowerOptimumSearch(args) {
  const { regional, systemById } = args;
  const productiveHa = regional.estimatedHumanFoodProducingHa;
  const people = regional.totalPopulation2021;
  const baseSystem = DRAFT_ANIMAL_SYSTEMS.find((s) => s.animalSystem === 'mixedAnimalPowerCoop');
  const lowFuelHand = systemById.get('annualLowFuelHandScale');
  const baseFoodGJPerHa = n(lowFuelHand?.annualFoodEnergyGJPerHaAtMaturity, 0);
  const heavyWorkDemandDays = estimateHeavyWorkDemandDays(productiveHa);

  const rows = COMMUNITY_ANIMAL_RATIO_SEARCH.map((ratio) => {
    const mode = ANIMAL_PURPOSE_MODES.multiPurposeMixedFarmAnimal;
    const animalsNeeded = Math.max(1, Math.round(people / Math.max(1, ratio)));
    const teamsNeeded = Math.max(1, Math.ceil(animalsNeeded / Math.max(1, n(baseSystem?.animalsPerTeam, 2))));
    const hayPastureHaRequired = animalsNeeded * n(baseSystem?.hayPastureHaPerAnimal, 0);
    const grainFeedHaRequired = animalsNeeded * n(baseSystem?.grainFeedHaPerAnimal, 0);
    const beddingHaEquivalentRequired = animalsNeeded * n(baseSystem?.beddingHaEquivalentPerAnimal, 0);
    const feedHaRequired = hayPastureHaRequired + grainFeedHaRequired + beddingHaEquivalentRequired;
    const heavyWorkCoverage = clamp01((teamsNeeded * n(baseSystem?.workDaysPerYear, 0) * 0.78) / Math.max(1e-9, heavyWorkDemandDays));
    const humanLabourSavedDays = heavyWorkDemandDays * 0.62 * heavyWorkCoverage;
    const animalCareLabourDays = teamsNeeded * n(baseSystem?.animalCareDaysPerYear, 0);
    const netLabourBenefitDays = humanLabourSavedDays - animalCareLabourDays;
    const additionalProductiveHaEnabled = productiveHa * 0.045 * heavyWorkCoverage;
    const additionalFoodEnergyEnabledGJ = additionalProductiveHaEnabled * baseFoodGJPerHa;
    const foodEnergyOpportunityCostGJ = grainFeedHaRequired * baseFoodGJPerHa;
    const netFoodEnergyBenefitGJ = additionalFoodEnergyEnabledGJ - foodEnergyOpportunityCostGJ;
    const netBenefitScore = netLabourBenefitDays * 0.5 + netFoodEnergyBenefitGJ * 0.5;
    const allocatedCare = animalCareLabourDays * n(mode.draftCostAllocationShare, 0.6);
    const allocatedFeedPenalty = foodEnergyOpportunityCostGJ * n(mode.draftCostAllocationShare, 0.6);
    const credit = Math.min(
      animalsNeeded * (
        n(mode.manureFertilityCreditGJEquivalentPerAnimal, 0)
        + n(mode.milkOrMeatFoodEnergyCreditGJPerAnimal, 0)
        + n(mode.pastureManagementCreditPerAnimal, 0)
        + n(mode.fertilityInputDisplacementValuePerAnimal, 0)
      ),
      (animalsNeeded * n(baseSystem?.feedEnergyGJPerAnimalYear, 0)) * 0.85
    );
    const netLabourBenefitDaysAllocated = humanLabourSavedDays - allocatedCare;
    const netFoodEnergyBenefitGJAllocated = additionalFoodEnergyEnabledGJ - allocatedFeedPenalty + credit;
    const netBenefitScoreAllocated = netLabourBenefitDaysAllocated * 0.5 + netFoodEnergyBenefitGJAllocated * 0.5;
    return {
      peoplePerAnimal: ratio,
      animalsNeeded,
      teamsNeeded,
      feedHaRequired,
      additionalProductiveHaEnabled,
      humanLabourSavedDays,
      animalCareLabourDays,
      netLabourBenefitDays,
      foodEnergyOpportunityCostGJ,
      additionalFoodEnergyEnabledGJ,
      netFoodEnergyBenefitGJ,
      netBenefitScore,
      netLabourBenefitDaysAllocated,
      netFoodEnergyBenefitGJAllocated,
      netBenefitScoreAllocated
    };
  });

  const recommended = rows.reduce((best, row) => (best && best.netBenefitScore >= row.netBenefitScore ? best : row), null);
  const recommendedAllocated = rows.reduce((best, row) => (best && best.netBenefitScoreAllocated >= row.netBenefitScoreAllocated ? best : row), null);
  return { rows, recommended, recommendedAllocated };
}

export function buildGreyLabourLandBaselineReport(options = {}) {
  const produceDir = path.resolve(options.produceDir ?? 'know/produce');
  const inputDir = path.resolve(options.inputDir ?? 'know/input/gis');
  const defaults = { ...DEFAULTS, ...(options.defaults ?? {}) };
  fs.mkdirSync(produceDir, { recursive: true });

  const warnings = [];

  const landAccessJsonPath = path.join(produceDir, 'grey-land-access-baseline.json');
  const landAccessMunicipalCsvPath = path.join(produceDir, 'grey-land-access-municipality-summary.csv');
  const lotsPath = path.join(inputDir, 'lots-and-concessions-grey.geojson');

  const landAccess = readJson(landAccessJsonPath, warnings);
  const landAccessMunicipalRows = readCsv(landAccessMunicipalCsvPath, warnings);
  const lotsGeo = readJson(lotsPath, warnings);

  if (!lotsGeo || !Array.isArray(lotsGeo.features) || lotsGeo.features.length === 0) {
    warnings.push('Missing lots-and-concessions-grey.geojson. Run: npm run grey:download-data -- --source=lots-and-concessions-grey');
  }

  const byMunicipalityLandAccess = new Map();
  for (const row of landAccessMunicipalRows) byMunicipalityLandAccess.set(row.municipalityName, row);

  const municipalityRows = [];
  const areaShares = defaults.areaShares;

  for (const node of greyCountySeedNodes) {
    const m = byMunicipalityLandAccess.get(node.municipalityName) ?? {};

    const productiveLotConcessionCount = n(m.ruralFoodAccessOpportunity ?? 0) + n(m.cooperativeLandAccessCandidate ?? 0) + n(m.settlementGardenOpportunity ?? 0);
    const ruralFoodAccessOpportunityCount = n(m.ruralFoodAccessOpportunity ?? 0);
    const cooperativeLandAccessCandidateCount = n(m.cooperativeLandAccessCandidate ?? 0);
    const settlementGardenOpportunityCount = n(m.settlementGardenOpportunity ?? 0);
    const constrainedLandCount = n(m.constrainedLand ?? 0);
    const lowAccessRuralCount = n(m.lowAccessRural ?? 0);

    const population = node.population2021;
    const categories = estimatePopulationCategories({
      population2021: population,
      municipalityName: node.municipalityName,
      municipalityType: node.municipalityType,
      densityPerKm2: node.densityPerKm2,
      settlementFeatureCount: n(m.settlementLots ?? 0),
      productiveLotConcessionCount,
      settlementGardenOpportunityCount,
      cooperativeLandAccessCandidateCount,
      constrainedLandCount
    });

    const totalLots = n(m.lotConcessionFeatures ?? 0);
    const productiveShare = totalLots > 0 ? clamp01(productiveLotConcessionCount / totalLots) : clamp01((node.urbanShare ? (1 - node.urbanShare) * 0.55 : 0.3));
    const constrainedShare = totalLots > 0 ? clamp01(constrainedLandCount / totalLots) : 0;

    const estimatedProductiveLandHa = Math.max(0, node.landAreaKm2 * 100 * productiveShare * (1 - constrainedShare * 0.4));
    const estimatedHumanFoodProducingHa = estimatedProductiveLandHa * areaShares.humanFood;
    const estimatedPastureFodderHa = estimatedProductiveLandHa * areaShares.pastureFodder;
    const estimatedWoodEnergyHa = estimatedProductiveLandHa * areaShares.woodEnergy;

    const ruralAccessPopulation = categories.ruralProductiveLandAccessPopulation + categories.agriculturalLotAccessPopulation;
    const noDirectLandAccessShare = population > 0 ? categories.noDirectLandAccessPopulation / population : 0;
    const constrainedLotsShare = totalLots > 0 ? constrainedLandCount / totalLots : 0;

    const availableFoodLabourDaysByCategory = {
      urbanNoLand: categories.noDirectLandAccessPopulation * defaults.labourDaysByCategory.urbanNoLand,
      townVillage: categories.townVillageSettlementPopulation * defaults.labourDaysByCategory.townVillage,
      hamlet: categories.hamletSettlementPopulation * defaults.labourDaysByCategory.hamlet,
      ruralNonFarm: categories.ruralNonFarmPopulation * defaults.labourDaysByCategory.ruralNonFarm,
      ruralProductive: categories.ruralProductiveLandAccessPopulation * defaults.labourDaysByCategory.ruralProductive,
      agriculturalLotAccess: categories.agriculturalLotAccessPopulation * defaults.labourDaysByCategory.agriculturalLotAccess
    };

    const availableFoodLabourDays = Object.values(availableFoodLabourDaysByCategory).reduce((s, v) => s + v, 0);
    const availableFoodWorkerFTE = availableFoodLabourDays / defaults.foodWorkerDaysPerYear;

    municipalityRows.push({
      municipalityName: node.municipalityName,
      population2021: population,
      urbanSettlementPopulation: categories.urbanSettlementPopulation,
      townVillageSettlementPopulation: categories.townVillageSettlementPopulation,
      hamletSettlementPopulation: categories.hamletSettlementPopulation,
      ruralNonFarmPopulation: categories.ruralNonFarmPopulation,
      ruralProductiveLandAccessPopulation: categories.ruralProductiveLandAccessPopulation,
      agriculturalLotAccessPopulation: categories.agriculturalLotAccessPopulation,
      noDirectLandAccessPopulation: categories.noDirectLandAccessPopulation,
      noDirectLandAccessShare,
      productiveLotConcessionCount,
      ruralFoodAccessOpportunityCount,
      cooperativeLandAccessCandidateCount,
      settlementGardenOpportunityCount,
      constrainedLandCount,
      lowAccessRuralCount,
      estimatedProductiveLandHa,
      estimatedHumanFoodProducingHa,
      estimatedPastureFodderHa,
      estimatedWoodEnergyHa,
      productiveHaPerPerson: population > 0 ? estimatedProductiveLandHa / population : 0,
      productiveHaPerRuralAccessPerson: ruralAccessPopulation > 0 ? estimatedProductiveLandHa / ruralAccessPopulation : 0,
      ruralAccessPeoplePerProductiveHa: estimatedProductiveLandHa > 0 ? ruralAccessPopulation / estimatedProductiveLandHa : 0,
      totalPeoplePerProductiveHa: estimatedProductiveLandHa > 0 ? population / estimatedProductiveLandHa : 0,
      foodProducingHouseholdsEstimate: Math.round(ruralAccessPopulation / (node.averageHouseholdSizeEstimate || 2.4)),
      productiveLotsPer1000Residents: population > 0 ? (productiveLotConcessionCount / population) * 1000 : 0,
      ruralFoodAccessLotsPer1000Residents: population > 0 ? (ruralFoodAccessOpportunityCount / population) * 1000 : 0,
      constrainedLotsShare,
      availableFoodLabourDaysByCategory,
      availableFoodLabourDays,
      availableFoodWorkerFTE,
      labourAccessConfidence: categories.confidence,
      areaMethod: 'censusAreaWeightedByLotOpportunityShare',
      notes: 'Population split is heuristicEstimate; lots/concessions are not ownership parcels.'
    });
  }

  const regional = municipalityRows.reduce((acc, row) => {
    acc.totalPopulation2021 += row.population2021;
    acc.estimatedNoDirectLandAccessPopulation += row.noDirectLandAccessPopulation;
    acc.estimatedRuralProductiveLandAccessPopulation += row.ruralProductiveLandAccessPopulation + row.agriculturalLotAccessPopulation;
    acc.estimatedProductiveLandHa += row.estimatedProductiveLandHa;
    acc.estimatedHumanFoodProducingHa += row.estimatedHumanFoodProducingHa;
    acc.estimatedPastureFodderHa += row.estimatedPastureFodderHa;
    acc.estimatedWoodEnergyHa += row.estimatedWoodEnergyHa;
    acc.totalAvailableFoodLabourDays += row.availableFoodLabourDays;
    return acc;
  }, {
    totalPopulation2021: 0,
    estimatedNoDirectLandAccessPopulation: 0,
    estimatedRuralProductiveLandAccessPopulation: 0,
    estimatedProductiveLandHa: 0,
    estimatedHumanFoodProducingHa: 0,
    estimatedPastureFodderHa: 0,
    estimatedWoodEnergyHa: 0,
    totalAvailableFoodLabourDays: 0
  });

  regional.productiveHaPerPerson = regional.totalPopulation2021 > 0 ? regional.estimatedProductiveLandHa / regional.totalPopulation2021 : 0;
  regional.productiveHaPerRuralAccessPerson = regional.estimatedRuralProductiveLandAccessPopulation > 0
    ? regional.estimatedProductiveLandHa / regional.estimatedRuralProductiveLandAccessPopulation : 0;
  regional.availableFoodWorkerFTE = regional.totalAvailableFoodLabourDays / defaults.foodWorkerDaysPerYear;

  const scenarios = defaults.scenarios.map((s) => {
    const requiredFoodLabourDays = regional.estimatedHumanFoodProducingHa * s.labourDaysPerHumanFoodHa * s.humanLabourMultiplier;
    const availableFoodLabourDays = regional.totalAvailableFoodLabourDays;
    const labourDeficitDays = Math.max(0, requiredFoodLabourDays - availableFoodLabourDays);
    const requiredFoodWorkerFTE = requiredFoodLabourDays / defaults.foodWorkerDaysPerYear;
    const availableFoodWorkerFTE = availableFoodLabourDays / defaults.foodWorkerDaysPerYear;
    const productiveHaPerFoodWorker = requiredFoodWorkerFTE > 0 ? regional.estimatedHumanFoodProducingHa / requiredFoodWorkerFTE : 0;
    const foodWorkersNeededPer100Ha = regional.estimatedHumanFoodProducingHa > 0 ? (requiredFoodWorkerFTE / regional.estimatedHumanFoodProducingHa) * 100 : 0;

    return {
      ...s,
      requiredFoodLabourDays,
      availableFoodLabourDays,
      labourDeficitDays,
      requiredFoodWorkerFTE,
      availableFoodWorkerFTE,
      productiveHaPerFoodWorker,
      foodWorkersNeededPer100Ha,
      additionalHumansNeededVsCurrent: 0,
      additionalFoodLabourDaysNeededVsCurrent: 0,
      fossilFuelLeverageRatio: 1,
      notes: s.notes
    };
  });

  const current = scenarios.find((s) => s.scenario === 'currentMechanized') ?? scenarios[0];
  const lowFuelScenario = scenarios.find((s) => s.scenario === 'lowFuelMixed') ?? scenarios[2] ?? scenarios[0];

  for (const s of scenarios) {
    s.additionalFoodLabourDaysNeededVsCurrent = Math.max(0, s.requiredFoodLabourDays - current.requiredFoodLabourDays);
    s.additionalHumansNeededVsCurrent = Math.max(0, s.requiredFoodWorkerFTE - current.requiredFoodWorkerFTE);
    s.fossilFuelLeverageRatio = s.productiveHaPerFoodWorker > 0 ? current.productiveHaPerFoodWorker / s.productiveHaPerFoodWorker : 0;
  }

  for (const row of municipalityRows) {
    row.currentMechanizedRequiredFoodLabourDays = row.estimatedHumanFoodProducingHa * current.labourDaysPerHumanFoodHa * current.humanLabourMultiplier;
    row.lowFuelRequiredFoodLabourDays = row.estimatedHumanFoodProducingHa * lowFuelScenario.labourDaysPerHumanFoodHa * lowFuelScenario.humanLabourMultiplier;
    row.lowFuelLabourDeficitDays = Math.max(0, row.lowFuelRequiredFoodLabourDays - row.availableFoodLabourDays);
    row.lowFuelFoodWorkersNeeded = row.lowFuelRequiredFoodLabourDays / defaults.foodWorkerDaysPerYear;
    row.additionalHumansNeededVsCurrent = Math.max(0,
      row.lowFuelRequiredFoodLabourDays / defaults.foodWorkerDaysPerYear - row.currentMechanizedRequiredFoodLabourDays / defaults.foodWorkerDaysPerYear);
  }

  const annualLowFuelBase = {
    ...PRODUCTION_SYSTEMS.find((s) => s.system === 'annualLowFuelEfficient')
  };
  const annualLowFuelHandBase = {
    ...PRODUCTION_SYSTEMS.find((s) => s.system === 'annualLowFuelHandScale')
  };
  const annualSmallToolOptimizedBase = {
    ...PRODUCTION_SYSTEMS.find((s) => s.system === 'annualSmallToolOptimized')
  };
  const baseReferenceLabourDaysPerHa =
    n(annualLowFuelBase.soilPrepTillageDaysPerHa) +
    n(annualLowFuelBase.plantingSeedingDaysPerHa) +
    n(annualLowFuelBase.weedingMulchingDaysPerHa) +
    n(annualLowFuelBase.irrigationWaterDaysPerHa) +
    n(annualLowFuelBase.pestDiseaseMonitoringDaysPerHa) +
    n(annualLowFuelBase.pruningTrainingDaysPerHa) +
    n(annualLowFuelBase.pathFenceToolMaintenanceDaysPerHa) +
    n(annualLowFuelBase.observationManagementDaysPerHa) +
    n(annualLowFuelBase.annualFoodEnergyGJPerHaAtMaturity) * (n(annualLowFuelBase.harvestLabourDaysPerGJ) + n(annualLowFuelBase.processingStorageDaysPerGJ));
  const annualLowFuelEvaluated = evaluateProductionSystem(annualLowFuelBase, {
    foodWorkerDaysPerYear: defaults.foodWorkerDaysPerYear,
    lowFuelAnnualBaseline: {
      ...annualLowFuelBase,
      recurringNonHarvestLabourDaysPerHa: baseReferenceLabourDaysPerHa - n(annualLowFuelBase.annualFoodEnergyGJPerHaAtMaturity) * (n(annualLowFuelBase.harvestLabourDaysPerGJ) + n(annualLowFuelBase.processingStorageDaysPerGJ)),
      harvestLabourDaysPerHa: n(annualLowFuelBase.annualFoodEnergyGJPerHaAtMaturity) * n(annualLowFuelBase.harvestLabourDaysPerGJ),
      processingStorageLabourDaysPerHa: n(annualLowFuelBase.annualFoodEnergyGJPerHaAtMaturity) * n(annualLowFuelBase.processingStorageDaysPerGJ),
      manageableHaPerWorkerAtMaturity: defaults.foodWorkerDaysPerYear / baseReferenceLabourDaysPerHa,
      foodEnergyGJPerLabourDayAtMaturity: annualLowFuelBase.annualFoodEnergyGJPerHaAtMaturity / baseReferenceLabourDaysPerHa,
      inputDependencyIndex: annualLowFuelBase.inputDependencyIndex,
      annualFoodEnergyGJPerHaAtMaturity: annualLowFuelBase.annualFoodEnergyGJPerHaAtMaturity
    },
    annualReferenceLabourDaysPerHa: baseReferenceLabourDaysPerHa,
    annualReferencePeakHarvestShare: Math.max(...Object.values(normalizeHarvestDistribution(annualLowFuelBase.harvestDistribution)))
  });

  const productionSystemLeverage = PRODUCTION_SYSTEMS.map((system) => evaluateProductionSystem(system, {
    foodWorkerDaysPerYear: defaults.foodWorkerDaysPerYear,
    lowFuelAnnualBaseline: annualLowFuelEvaluated,
    annualReferenceLabourDaysPerHa: annualLowFuelEvaluated.labourDaysPerHaAtMaturity,
    annualReferencePeakHarvestShare: annualLowFuelEvaluated.peakHarvestShare
  }));
  const annualLowFuelHandEvaluated = evaluateProductionSystem(annualLowFuelHandBase, {
    foodWorkerDaysPerYear: defaults.foodWorkerDaysPerYear,
    lowFuelAnnualBaseline: annualLowFuelEvaluated,
    annualReferenceLabourDaysPerHa: annualLowFuelEvaluated.labourDaysPerHaAtMaturity,
    annualReferencePeakHarvestShare: annualLowFuelEvaluated.peakHarvestShare
  });
  const annualSmallToolOptimizedEvaluated = evaluateProductionSystem(annualSmallToolOptimizedBase, {
    foodWorkerDaysPerYear: defaults.foodWorkerDaysPerYear,
    lowFuelAnnualBaseline: annualLowFuelEvaluated,
    annualReferenceLabourDaysPerHa: annualLowFuelEvaluated.labourDaysPerHaAtMaturity,
    annualReferencePeakHarvestShare: annualLowFuelEvaluated.peakHarvestShare
  });
  for (const system of productionSystemLeverage) {
    system.manageableHaMultiplierVsAnnualLowFuelEfficient = annualLowFuelEvaluated.manageableHaPerWorkerAtMaturity > 0
      ? system.manageableHaPerWorkerAtMaturity / annualLowFuelEvaluated.manageableHaPerWorkerAtMaturity : 0;
    system.manageableHaMultiplierVsAnnualLowFuelHandScale = annualLowFuelHandEvaluated.manageableHaPerWorkerAtMaturity > 0
      ? system.manageableHaPerWorkerAtMaturity / annualLowFuelHandEvaluated.manageableHaPerWorkerAtMaturity : 0;
    system.onLandManageableHaMultiplierVsAnnualLowFuelEfficient = annualLowFuelEvaluated.onLandManageableHaPerWorkerAtMaturity > 0
      ? system.onLandManageableHaPerWorkerAtMaturity / annualLowFuelEvaluated.onLandManageableHaPerWorkerAtMaturity : 0;
    system.totalSystemManageableHaMultiplierVsAnnualLowFuelEfficient = annualLowFuelEvaluated.systemManageableHaPerWorkerAtMaturity > 0
      ? system.systemManageableHaPerWorkerAtMaturity / annualLowFuelEvaluated.systemManageableHaPerWorkerAtMaturity : 0;
    system.onLandManageableHaMultiplierVsAnnualLowFuelHandScale = annualLowFuelHandEvaluated.onLandManageableHaPerWorkerAtMaturity > 0
      ? system.onLandManageableHaPerWorkerAtMaturity / annualLowFuelHandEvaluated.onLandManageableHaPerWorkerAtMaturity : 0;
    system.totalSystemManageableHaMultiplierVsAnnualLowFuelHandScale = annualLowFuelHandEvaluated.systemManageableHaPerWorkerAtMaturity > 0
      ? system.systemManageableHaPerWorkerAtMaturity / annualLowFuelHandEvaluated.systemManageableHaPerWorkerAtMaturity : 0;
    system.onLandManageableHaMultiplierVsAnnualSmallToolOptimized = annualSmallToolOptimizedEvaluated.onLandManageableHaPerWorkerAtMaturity > 0
      ? system.onLandManageableHaPerWorkerAtMaturity / annualSmallToolOptimizedEvaluated.onLandManageableHaPerWorkerAtMaturity : 0;
    system.totalSystemManageableHaMultiplierVsAnnualSmallToolOptimized = annualSmallToolOptimizedEvaluated.systemManageableHaPerWorkerAtMaturity > 0
      ? system.systemManageableHaPerWorkerAtMaturity / annualSmallToolOptimizedEvaluated.systemManageableHaPerWorkerAtMaturity : 0;
    system.totalLabourReductionPctVsAnnualLowFuelEfficient = ((annualLowFuelEvaluated.labourDaysPerHaAtMaturity - system.labourDaysPerHaAtMaturity)
      / Math.max(1e-9, annualLowFuelEvaluated.labourDaysPerHaAtMaturity)) * 100;
    system.totalLabourReductionPctVsAnnualLowFuelHandScale = ((annualLowFuelHandEvaluated.labourDaysPerHaAtMaturity - system.labourDaysPerHaAtMaturity)
      / Math.max(1e-9, annualLowFuelHandEvaluated.labourDaysPerHaAtMaturity)) * 100;
    system.processingInfrastructureNeeded = 'mill|sheller|dryer|coldStorage|press|foodHub';
  }
  const matureConservative = productionSystemLeverage.find((s) => s.system === 'maturePermacultureConservative');
  const matureBaseline = productionSystemLeverage.find((s) => s.system === 'maturePermacultureLowCare');
  const matureOptimistic = productionSystemLeverage.find((s) => s.system === 'maturePermacultureOptimisticEstablished');
  const maturePermacultureSensitivity = {
    manageableHaPerWorkerLow: matureConservative?.manageableHaPerWorkerAtMaturity ?? 0,
    manageableHaPerWorkerBase: matureBaseline?.manageableHaPerWorkerAtMaturity ?? 0,
    manageableHaPerWorkerHigh: matureOptimistic?.manageableHaPerWorkerAtMaturity ?? 0,
    multiplierRangeVsAnnualLowFuelHandScale: [
      matureConservative?.manageableHaMultiplierVsAnnualLowFuelHandScale ?? 0,
      matureBaseline?.manageableHaMultiplierVsAnnualLowFuelHandScale ?? 0,
      matureOptimistic?.manageableHaMultiplierVsAnnualLowFuelHandScale ?? 0
    ],
    multiplierRangeVsAnnualLowFuelEfficient: [
      matureConservative?.manageableHaMultiplierVsAnnualLowFuelEfficient ?? 0,
      matureBaseline?.manageableHaMultiplierVsAnnualLowFuelEfficient ?? 0,
      matureOptimistic?.manageableHaMultiplierVsAnnualLowFuelEfficient ?? 0
    ]
  };

  const systemById = new Map(productionSystemLeverage.map((s) => [s.system, s]));

  const permacultureAdoptionScenarios = buildPermacultureScenarioRows({
    regional,
    foodWorkerDaysPerYear: defaults.foodWorkerDaysPerYear,
    lowFuelRequiredLabourDays: lowFuelScenario.requiredFoodLabourDays,
    lowFuelAvailableLabourDays: lowFuelScenario.availableFoodLabourDays,
    systemById
  });

  const handToolCapacityReference = HAND_TOOL_CAPACITY_REFERENCE.map((r) => ({
    ...r,
    lowLabourDaysPerHa: defaults.foodWorkerDaysPerYear / r.highHaPerFullTimeWorker,
    baselineLabourDaysPerHa: defaults.foodWorkerDaysPerYear / r.baselineHaPerFullTimeWorker,
    highLabourDaysPerHa: defaults.foodWorkerDaysPerYear / r.lowHaPerFullTimeWorker
  }));

  const harvestWindowDiagnostics = {
    annualLowFuelEfficient: {
      peakHarvestShare: annualLowFuelEvaluated.peakHarvestShare,
      harvestConcentrationIndex: annualLowFuelEvaluated.harvestConcentrationIndex,
      rollingHarvestAdvantage: annualLowFuelEvaluated.rollingHarvestAdvantage
    },
    annualSmallToolOptimized: {
      manageableHaPerWorker: systemById.get('annualSmallToolOptimized')?.systemManageableHaPerWorkerAtMaturity ?? 0,
      referenceSystem: 'efficientSmallScaleAnnualField',
      inReferenceRange: (() => {
        const ref = handToolCapacityReference.find((r) => r.system === 'efficientSmallScaleAnnualField');
        const x = systemById.get('annualSmallToolOptimized')?.systemManageableHaPerWorkerAtMaturity ?? 0;
        return x >= ref.lowHaPerFullTimeWorker && x <= ref.highHaPerFullTimeWorker;
      })(),
      classification: 'optimizedSmallToolUpperEnd'
    },
    annualLowFuelHandScale: {
      peakHarvestShare: annualLowFuelHandEvaluated.peakHarvestShare,
      harvestConcentrationIndex: annualLowFuelHandEvaluated.harvestConcentrationIndex,
      rollingHarvestAdvantage: annualLowFuelHandEvaluated.rollingHarvestAdvantage
    },
    maturePermacultureLowCare: {
      peakHarvestShare: systemById.get('maturePermacultureLowCare')?.peakHarvestShare ?? 0,
      harvestConcentrationIndex: systemById.get('maturePermacultureLowCare')?.harvestConcentrationIndex ?? 0,
      rollingHarvestAdvantage: systemById.get('maturePermacultureLowCare')?.rollingHarvestAdvantage ?? 0
    }
  };

  const regionalProcessingLabourDemandDays = productionSystemLeverage.reduce((acc, s) => {
    if (s.system !== 'annualLowFuelEfficient') return acc;
    return acc + (regional.estimatedHumanFoodProducingHa * s.regionalProcessingLabourDaysPerHaAtMaturity);
  }, 0);
  const regionalProcessingWorkerFTE = regionalProcessingLabourDemandDays / defaults.foodWorkerDaysPerYear;
  const assumedRegionalProcessingAvailableFTE = Math.max(10, Math.round(regional.availableFoodWorkerFTE * 0.12));
  const regionalProcessingCapacityGapFTE = Math.max(0, regionalProcessingWorkerFTE - assumedRegionalProcessingAvailableFTE);
  const processingInfrastructureNeeded = ['mill', 'sheller', 'dryer', 'coldStorage', 'press', 'foodHub'];
  const currentModelHandToolComparison = {
    annualLowFuelHandScale: {
      manageableHaPerWorker: systemById.get('annualLowFuelHandScale')?.systemManageableHaPerWorkerAtMaturity ?? 0,
      referenceSystem: 'handScaleAnnualStaples',
      inReferenceRange: (() => {
        const ref = handToolCapacityReference.find((r) => r.system === 'handScaleAnnualStaples');
        const x = systemById.get('annualLowFuelHandScale')?.systemManageableHaPerWorkerAtMaturity ?? 0;
        return x >= ref.lowHaPerFullTimeWorker && x <= ref.highHaPerFullTimeWorker;
      })()
    },
    annualLowFuelEfficient: {
      manageableHaPerWorker: systemById.get('annualLowFuelEfficient')?.systemManageableHaPerWorkerAtMaturity ?? 0,
      referenceSystem: 'efficientSmallScaleAnnualField',
      inReferenceRange: (() => {
        const ref = handToolCapacityReference.find((r) => r.system === 'efficientSmallScaleAnnualField');
        const x = systemById.get('annualLowFuelEfficient')?.systemManageableHaPerWorkerAtMaturity ?? 0;
        return x >= ref.lowHaPerFullTimeWorker && x <= ref.highHaPerFullTimeWorker;
      })()
    },
    annualSmallToolOptimized: {
      manageableHaPerWorker: systemById.get('annualSmallToolOptimized')?.systemManageableHaPerWorkerAtMaturity ?? 0,
      referenceSystem: 'efficientSmallScaleAnnualField',
      inReferenceRange: (() => {
        const ref = handToolCapacityReference.find((r) => r.system === 'efficientSmallScaleAnnualField');
        const x = systemById.get('annualSmallToolOptimized')?.systemManageableHaPerWorkerAtMaturity ?? 0;
        return x >= ref.lowHaPerFullTimeWorker && x <= ref.highHaPerFullTimeWorker;
      })(),
      classification: 'optimizedSmallToolUpperEnd'
    },
    perennialStapleBulkLowCareOnLand: {
      manageableHaPerWorker: systemById.get('perennialStapleBulkLowCare')?.onLandManageableHaPerWorkerAtMaturity ?? 0,
      referenceSystem: 'maturePerennialStapleLowCare',
      inReferenceRange: (() => {
        const ref = handToolCapacityReference.find((r) => r.system === 'maturePerennialStapleLowCare');
        const x = systemById.get('perennialStapleBulkLowCare')?.onLandManageableHaPerWorkerAtMaturity ?? 0;
        return x >= ref.lowHaPerFullTimeWorker && x <= ref.highHaPerFullTimeWorker;
      })()
    }
  };
  const animalPowerSystems = DRAFT_ANIMAL_SYSTEMS;
  const animalPowerScenarios = buildAnimalPowerScenarios({
    regional,
    availableFoodLabourDays: regional.totalAvailableFoodLabourDays,
    foodWorkerDaysPerYear: defaults.foodWorkerDaysPerYear,
    lowFuelScenario,
    systemById
  });
  const animalFeedLandTradeoffs = animalPowerScenarios.map((s) => ({
    scenario: s.scenario,
    animalSystem: s.animalSystem,
    feedHaRequired: s.feedHaRequired,
    feedFromPastureFodderHa: s.feedFromPastureFodderHa,
    feedFromHumanFoodCropHa: s.feedFromHumanFoodCropHa,
    feedCompetitionWithHumanFoodGJ: s.feedCompetitionWithHumanFoodGJ
  }));
  const communityAnimalPowerScenarios = buildCommunityAnimalPowerScenarios({ regional, systemById });
  const animalPowerOptimumSearch = buildAnimalPowerOptimumSearch({ regional, systemById });
  const recommendedAnimalPowerRatio = animalPowerOptimumSearch.recommended;
  const recommendedAnimalPowerRatioAllocated = animalPowerOptimumSearch.recommendedAllocated;
  const animalPowerFavourabilityNotes = 'Animal power is most favourable when feed competition with human-food land is low and usage is focused on heavy-work bottlenecks.';

  const json = {
    generatedAt: new Date().toISOString(),
    assumptions: {
      populationDistributionMethod: 'heuristicEstimate',
      areaMethod: 'censusAreaWeightedByLotOpportunityShare',
      labourDaysByCategory: defaults.labourDaysByCategory,
      foodWorkerDaysPerYear: defaults.foodWorkerDaysPerYear,
      caveat: 'Lots and concessions are not ownership parcels; this is a coarse baseline estimate.',
      annualSmallToolOptimizedDefinition: 'Human-scale production with excellent layout and tools (wheel hoes, broadforks, seeders, carts, tarps, drip irrigation, scythes, hand trucks, shared tool libraries), strong skill, and low weed pressure; not ordinary hand hoeing and not tractor mechanization.'
    },
    warnings,
    regionalIndicators: {
      ...regional,
      lowFuelFoodWorkersNeeded: lowFuelScenario.requiredFoodWorkerFTE,
      lowFuelLabourDeficitDays: lowFuelScenario.labourDeficitDays,
      fossilFuelLeverageRatio: lowFuelScenario.fossilFuelLeverageRatio
    },
    municipalityIndicators: municipalityRows,
    scenarios,
    productionSystemLeverage,
    permacultureAdoptionScenarios,
    harvestWindowDiagnostics,
    maturePermacultureSensitivity,
    regionalProcessing: {
      regionalProcessingLabourDemandDays,
      regionalProcessingWorkerFTE,
      assumedRegionalProcessingAvailableFTE,
      regionalProcessingCapacityGapFTE,
      processingCanBeCentralized: true,
      processingInfrastructureNeeded
    },
    animalPowerSystems,
    animalPowerScenarios,
    animalFeedLandTradeoffs,
    communityAnimalPowerScenarios,
    animalPowerOptimumSearch: animalPowerOptimumSearch.rows,
    recommendedAnimalPowerRatio,
    recommendedAnimalPowerRatioAllocated,
    animalPowerFavourabilityNotes,
    handToolCapacityReference,
    currentModelHandToolComparison,
    caveats: [
      'lots/concessions are not ownership parcels',
      'no address-point population distribution yet',
      'population distribution is heuristic',
      'productive hectares are estimated from census area and lot opportunity shares',
      'labour assumptions are coarse scenario diagnostics',
      'perennial/permaculture is modelled as labour-profile change, not magic yield',
      'annualSmallToolOptimized is a human-scale, highly optimized small-tool case (not ordinary hand hoeing, not tractor mechanization)'
    ]
  };

  const jsonPath = path.join(produceDir, 'grey-labour-land-baseline.json');
  fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2));

  const municipalityCsvPath = path.join(produceDir, 'grey-labour-land-municipality-summary.csv');
  fs.writeFileSync(municipalityCsvPath, toCsv(municipalityRows, [
    'municipalityName','population2021','urbanSettlementPopulation','townVillageSettlementPopulation','hamletSettlementPopulation','ruralNonFarmPopulation','ruralProductiveLandAccessPopulation','agriculturalLotAccessPopulation','noDirectLandAccessPopulation','noDirectLandAccessShare','productiveLotConcessionCount','ruralFoodAccessOpportunityCount','cooperativeLandAccessCandidateCount','constrainedLandCount','estimatedProductiveLandHa','productiveHaPerPerson','productiveHaPerRuralAccessPerson','ruralAccessPeoplePerProductiveHa','availableFoodLabourDays','availableFoodWorkerFTE','currentMechanizedRequiredFoodLabourDays','lowFuelRequiredFoodLabourDays','lowFuelLabourDeficitDays','lowFuelFoodWorkersNeeded','additionalHumansNeededVsCurrent','notes'
  ]));

  const scenarioCsvPath = path.join(produceDir, 'grey-labour-land-scenarios.csv');
  fs.writeFileSync(scenarioCsvPath, toCsv(animalPowerScenarios, [
    'scenario','productiveHa','feedHaRequired','netHumanFoodHaAfterFeed','requiredHumanFoodLabourDays','animalCareLabourDays','totalHumanLabourDays','availableFoodLabourDays','labourDeficitDays','requiredHumanFTE','animalTeamsNeeded','animalsNeeded','dieselDisplacedLitre','foodEnergyOpportunityCostGJ','netFoodEnergyAfterAnimalFeedGJ','notes'
  ]));

  const permacultureSystemsCsvPath = path.join(produceDir, 'grey-labour-land-permaculture-systems.csv');
  fs.writeFileSync(permacultureSystemsCsvPath, toCsv(productionSystemLeverage, [
    'system','establishmentYears','establishmentLabourDaysPerHa','soilPrepTillageDaysPerHa','plantingSeedingDaysPerHa','weedingMulchingDaysPerHa','harvestLabourDaysPerHa','processingStorageLabourDaysPerHa','onLandLabourDaysPerHaAtMaturity','regionalProcessingLabourDaysPerHaAtMaturity','totalSystemLabourDaysPerHaAtMaturity','annualFoodEnergyGJPerHaAtMaturity','onLandFoodEnergyGJPerLabourDayAtMaturity','totalSystemFoodEnergyGJPerLabourDayAtMaturity','onLandManageableHaPerWorkerAtMaturity','systemManageableHaPerWorkerAtMaturity','harvestWindowDays','peakHarvestShare','rollingHarvestAdvantage','onLandManageableHaMultiplierVsAnnualLowFuelEfficient','totalSystemManageableHaMultiplierVsAnnualLowFuelEfficient','onLandManageableHaMultiplierVsAnnualLowFuelHandScale','totalSystemManageableHaMultiplierVsAnnualLowFuelHandScale','yearsUntilNetLabourAdvantage','processingInfrastructureNeeded','notes'
  ]));

  const permacultureScenariosCsvPath = path.join(produceDir, 'grey-labour-land-permaculture-scenarios.csv');
  fs.writeFileSync(permacultureScenariosCsvPath, toCsv(permacultureAdoptionScenarios, [
    'scenario','transitionedHa','establishmentLabourDays','totalLabourDaysAtMaturity','totalFoodEnergyGJAtMaturity','foodWorkerFTEAtMaturity','labourDeficitDaysAtMaturity','effectiveProductiveHaPerWorker','permacultureLeverageMultiplier','yearsUntilMaturity','caveats'
  ]));

  const animalPowerScenariosCsvPath = path.join(produceDir, 'grey-labour-land-animal-power-scenarios.csv');
  fs.writeFileSync(animalPowerScenariosCsvPath, toCsv(animalPowerScenarios, [
    'scenario','animalSystem','animalTeamsNeeded','animalsNeeded','feedHaRequired','hayPastureHaRequired','grainFeedHaRequired','feedLandShareOfProductiveHa','animalFeedEnergyGJ','foodEnergyOpportunityCostGJ','dieselDisplacedLitre','humanLabourReducedDays','animalCareLabourDays','netHumanLabourChangeDays','netHumanFoodHaAfterFeed','netFoodEnergyAfterAnimalFeedGJ','requiredHumanFTE','labourDeficitDays','notes'
  ]));

  const communityAnimalPowerCsvPath = path.join(produceDir, 'grey-labour-land-community-animal-power.csv');
  fs.writeFileSync(communityAnimalPowerCsvPath, toCsv(communityAnimalPowerScenarios, [
    'scenario','animalPurposeMode','peoplePerAnimal','animalsNeeded','ownedAnimalsNeeded','serviceTeamsNeeded','teamsNeeded','feedHaRequired','feedCompetitionWithHumanFoodShare','draftCostAllocationShare','coProductCreditGJEquivalent','humanLabourSavedDays','animalCareLabourDays','netLabourBenefitDaysDraftOnly','netFoodEnergyBenefitGJDraftOnly','netBenefitScoreDraftOnly','netLabourBenefitDaysAllocated','netFoodEnergyBenefitGJAllocated','netBenefitScoreAllocated','additionalProductiveHaEnabled','additionalFoodEnergyEnabledGJ','foodEnergyOpportunityCostGJ','animalPowerFavourabilityIndex','peakSeasonWorkDays','careBurdenPerHousehold','notes'
  ]));

  const handToolCapacityCsvPath = path.join(produceDir, 'grey-labour-land-hand-tool-capacity.csv');
  fs.writeFileSync(handToolCapacityCsvPath, toCsv(handToolCapacityReference, [
    'system','lowHaPerFullTimeWorker','baselineHaPerFullTimeWorker','highHaPerFullTimeWorker','lowLabourDaysPerHa','baselineLabourDaysPerHa','highLabourDaysPerHa','notes'
  ]));

  const markdown = [
    '# Grey County Labour-to-Productive-Land Baseline',
    '',
    '## What this is',
    'This report estimates how people are distributed relative to productive land access using Census population, settlement boundaries, Official Plan land use, and lots/concessions.',
    '',
    '## Why it matters',
    'Fossil fuels and machinery let fewer people manage more hectares. As fuel/input/machinery support declines, human labour per hectare must rise.',
    '',
    '## Key regional indicators',
    `- totalPopulation2021: ${regional.totalPopulation2021}`,
    `- estimatedNoDirectLandAccessPopulation: ${regional.estimatedNoDirectLandAccessPopulation}`,
    `- estimatedRuralProductiveLandAccessPopulation: ${regional.estimatedRuralProductiveLandAccessPopulation}`,
    `- estimatedProductiveLandHa: ${regional.estimatedProductiveLandHa.toFixed(2)}`,
    `- productiveHaPerPerson: ${regional.productiveHaPerPerson.toFixed(4)}`,
    `- productiveHaPerRuralAccessPerson: ${regional.productiveHaPerRuralAccessPerson.toFixed(4)}`,
    `- availableFoodWorkerFTE: ${regional.availableFoodWorkerFTE.toFixed(2)}`,
    `- lowFuelFoodWorkersNeeded: ${lowFuelScenario.requiredFoodWorkerFTE.toFixed(2)}`,
    `- lowFuelLabourDeficitDays: ${lowFuelScenario.labourDeficitDays.toFixed(2)}`,
    `- fossilFuelLeverageRatio: ${lowFuelScenario.fossilFuelLeverageRatio.toFixed(3)}`,
    '',
    '## Municipality comparison',
    '| Municipality | Population | No direct land access share | Productive land access population | Estimated productive ha | Productive ha per rural-access person | Available food worker FTE | Low-fuel worker need | Low-fuel labour deficit |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...municipalityRows.map((r) => `| ${r.municipalityName} | ${r.population2021} | ${r.noDirectLandAccessShare.toFixed(3)} | ${(r.ruralProductiveLandAccessPopulation + r.agriculturalLotAccessPopulation)} | ${r.estimatedProductiveLandHa.toFixed(2)} | ${r.productiveHaPerRuralAccessPerson.toFixed(3)} | ${r.availableFoodWorkerFTE.toFixed(2)} | ${r.lowFuelFoodWorkersNeeded.toFixed(2)} | ${r.lowFuelLabourDeficitDays.toFixed(2)} |`),
    '',
    '## Mechanization scenarios',
    '| Scenario | Machinery support | Fuel input index | Labour days per human-food ha | Required labour days | Available labour days | Labour deficit days | Required worker FTE | Available worker FTE | Productive ha per worker | Workers per 100 ha | Additional humans vs current | Fossil fuel leverage ratio |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...scenarios.map((s) => `| ${s.scenario} | ${s.machinerySupportFactor.toFixed(2)} | ${s.fuelInputIndex.toFixed(2)} | ${s.labourDaysPerHumanFoodHa.toFixed(2)} | ${s.requiredFoodLabourDays.toFixed(2)} | ${s.availableFoodLabourDays.toFixed(2)} | ${s.labourDeficitDays.toFixed(2)} | ${s.requiredFoodWorkerFTE.toFixed(2)} | ${s.availableFoodWorkerFTE.toFixed(2)} | ${s.productiveHaPerFoodWorker.toFixed(4)} | ${s.foodWorkersNeededPer100Ha.toFixed(4)} | ${s.additionalHumansNeededVsCurrent.toFixed(2)} | ${s.fossilFuelLeverageRatio.toFixed(3)} |`),
    '',
    '## Perennial and permaculture labour leverage',
    'Perennial systems can reduce recurring labour and smooth seasonal peaks once established, but require design, establishment labour, time to maturity, and skill. This is a labour-profile change model, not magic yield.',
    'Post-harvest processing is separated from on-land labour. Shelling, milling, drying, pressing, freezing, packing, and storage can be done at regional food hubs or co-op facilities. Land-worker metrics show how much land can be managed on the land; total-system metrics still count processing labour that must happen somewhere in the county.',
    '',
    '| System | Soil prep | Planting | Weeding | Harvest | Processing | On-land labour/ha | Processing labour/ha | Total system labour/ha | On-land ha/worker | Total-system ha/worker | Multiplier vs hand-scale annual | Main caveat |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|',
    ...productionSystemLeverage.map((s) => `| ${s.system} | ${n(s.soilPrepTillageDaysPerHa).toFixed(2)} | ${n(s.plantingSeedingDaysPerHa).toFixed(2)} | ${n(s.weedingMulchingDaysPerHa).toFixed(2)} | ${s.harvestLabourDaysPerHa.toFixed(2)} | ${s.processingStorageLabourDaysPerHa.toFixed(2)} | ${s.onLandLabourDaysPerHaAtMaturity.toFixed(2)} | ${s.regionalProcessingLabourDaysPerHaAtMaturity.toFixed(2)} | ${s.totalSystemLabourDaysPerHaAtMaturity.toFixed(2)} | ${s.onLandManageableHaPerWorkerAtMaturity.toFixed(3)} | ${s.systemManageableHaPerWorkerAtMaturity.toFixed(3)} | ${s.totalSystemManageableHaMultiplierVsAnnualLowFuelHandScale.toFixed(3)} | ${s.establishmentBottleneckWarning ? 'Establishment labour and skill' : 'Harvest concentration and processing'} |`),
    '',
    `Sensitivity (mature permaculture manageable ha/worker low/base/high): ${maturePermacultureSensitivity.manageableHaPerWorkerLow.toFixed(3)} / ${maturePermacultureSensitivity.manageableHaPerWorkerBase.toFixed(3)} / ${maturePermacultureSensitivity.manageableHaPerWorkerHigh.toFixed(3)}`,
    `Multiplier vs annualLowFuelEfficient (low/base/high): ${maturePermacultureSensitivity.multiplierRangeVsAnnualLowFuelEfficient.map((x) => x.toFixed(3)).join(' / ')}`,
    `Multiplier vs annualLowFuelHandScale (low/base/high): ${maturePermacultureSensitivity.multiplierRangeVsAnnualLowFuelHandScale.map((x) => x.toFixed(3)).join(' / ')}`,
    'The multiplier depends heavily on the annual baseline definition. Gains are usually smaller versus efficient annual systems and larger versus hand-scale annual systems with repeated soil prep and weeding.',
    'Perennial staple bulk scenarios represent mature tree-crop/storage-oriented systems, not immediate garden output; establishment time and delayed yields remain significant constraints.',
    '',
    '## Animal power and feed-land tradeoffs',
    'Draft animals can substitute for some fuel/machinery work, especially hauling, cultivation, mowing, logging, and cartage. But this is not free energy: animals require feed land, daily care, handling skill, equipment, and overwintering.',
    '| System | Animals needed | Feed ha required | Feed-land share | Human labour change | Diesel displaced | Net food-energy opportunity cost | Main bottleneck |',
    '|---|---:|---:|---:|---:|---:|---:|---|',
    ...animalPowerScenarios.map((s) => `| ${s.scenario} (${s.animalSystem}) | ${s.animalsNeeded.toFixed(0)} | ${s.feedHaRequired.toFixed(2)} | ${s.feedLandShareOfProductiveHa.toFixed(3)} | ${s.netHumanLabourChangeDays.toFixed(2)} | ${s.dieselDisplacedLitre.toFixed(2)} | ${s.foodEnergyOpportunityCostGJ.toFixed(2)} | feed land + care labour + seasonal limits |`),
    '',
    '## Community-scale animal power',
    'A shared animal-power model may be more realistic than full tractor replacement. One animal or team serving a church, village, or co-op can handle heavy work while keeping feed-land burden moderate. The optimum depends on feed source, labour saved, land enabled, and care burden.',
    '| Scenario | People served/animal | Animals | Feed ha | Labour saved | Animal care labour | Net food-energy benefit | Favourability |',
    '|---|---:|---:|---:|---:|---:|---:|---:|',
    ...communityAnimalPowerScenarios.map((s) => `| ${s.scenario} (${s.animalPurposeMode}) | ${s.peoplePerAnimal.toFixed(0)} | ${s.animalsNeeded.toFixed(0)} | ${s.feedHaRequired.toFixed(2)} | ${s.humanLabourSavedDays.toFixed(2)} | ${s.animalCareLabourDays.toFixed(2)} | ${s.netFoodEnergyBenefitGJAllocated.toFixed(2)} | ${s.animalPowerFavourabilityIndex.toFixed(3)} |`),
    `Recommended ratio by draft-only accounting: 1 animal per ${(recommendedAnimalPowerRatio?.peoplePerAnimal ?? 0)} people (score ${(recommendedAnimalPowerRatio?.netBenefitScore ?? 0).toFixed(2)}).`,
    `Recommended ratio by allocated multi-purpose accounting: 1 animal per ${(recommendedAnimalPowerRatioAllocated?.peoplePerAnimal ?? 0)} people (score ${(recommendedAnimalPowerRatioAllocated?.netBenefitScoreAllocated ?? 0).toFixed(2)}).`,
    '### Multi-purpose and seasonal animal power',
    'Draft animals are not free energy. But in some rural systems they may also provide manure/fertility, milk/meat, pasture cycling, and resilience. This report shows both strict draft-only accounting and allocated multi-purpose accounting. Seasonal/custom team service can reduce the need for every village/church/co-op to carry year-round animal care.',
    '',
    '## Hand-tool land-tending capacity',
    'There is no single correct number. Capacity depends on crop type, intensity, harvest frequency, soil condition, tools, skill, layout, irrigation, weed pressure, processing arrangements, and whether the system is annual or perennial.',
    '| System | Low ha/person | Baseline ha/person | High ha/person | Baseline labour days/ha | Notes |',
    '|---|---:|---:|---:|---:|---|',
    ...handToolCapacityReference.map((r) => `| ${r.system} | ${r.lowHaPerFullTimeWorker.toFixed(2)} | ${r.baselineHaPerFullTimeWorker.toFixed(2)} | ${r.highHaPerFullTimeWorker.toFixed(2)} | ${r.baselineLabourDaysPerHa.toFixed(2)} | ${r.notes} |`),
    '',
    'Model annual baselines are calibrated to these hand-tool reference ranges. `annualSmallToolOptimized` is an upper-end optimized small-tool case, not ordinary hand-tool production.',
    '`annualSmallToolOptimized` means human-scale production with excellent layout and tools (wheel hoes, broadforks, seeders, carts, tarps, drip irrigation, scythes, hand trucks, shared tool libraries), skilled labour, and low weed pressure; not ordinary hand hoeing and not tractor mechanization.',
    `Current annualLowFuelHandScale manageable ha/worker: ${currentModelHandToolComparison.annualLowFuelHandScale.manageableHaPerWorker.toFixed(3)} (${currentModelHandToolComparison.annualLowFuelHandScale.inReferenceRange ? 'inside' : 'outside'} handScaleAnnualStaples range)`,
    `Current annualLowFuelEfficient manageable ha/worker: ${currentModelHandToolComparison.annualLowFuelEfficient.manageableHaPerWorker.toFixed(3)} (${currentModelHandToolComparison.annualLowFuelEfficient.inReferenceRange ? 'inside' : 'outside'} efficientSmallScaleAnnualField range)`,
    `Current annualSmallToolOptimized manageable ha/worker: ${currentModelHandToolComparison.annualSmallToolOptimized.manageableHaPerWorker.toFixed(3)} (${currentModelHandToolComparison.annualSmallToolOptimized.inReferenceRange ? 'inside' : 'outside'} efficientSmallScaleAnnualField range; optimized upper-end case)`,
    `Current perennialStapleBulkLowCare on-land manageable ha/worker: ${currentModelHandToolComparison.perennialStapleBulkLowCareOnLand.manageableHaPerWorker.toFixed(3)} (${currentModelHandToolComparison.perennialStapleBulkLowCareOnLand.inReferenceRange ? 'inside' : 'outside'} maturePerennialStapleLowCare range)`,
    `perennialStapleBulkLowCare on-land multipliers: vs annualLowFuelHandScale ${((systemById.get('perennialStapleBulkLowCare')?.onLandManageableHaMultiplierVsAnnualLowFuelHandScale) ?? 0).toFixed(3)}, vs annualLowFuelEfficient ${((systemById.get('perennialStapleBulkLowCare')?.onLandManageableHaMultiplierVsAnnualLowFuelEfficient) ?? 0).toFixed(3)}, vs annualSmallToolOptimized ${((systemById.get('perennialStapleBulkLowCare')?.onLandManageableHaMultiplierVsAnnualSmallToolOptimized) ?? 0).toFixed(3)}`,
    '',
    '## Caveats',
    '- lots/concessions are not ownership parcels',
    '- no address-point population distribution yet',
    '- population distribution is heuristic',
    '- productive hectares are estimated from census area and lot opportunity shares',
    '- labour assumptions are coarse scenario diagnostics',
    '- output is a scenario baseline, not a farm-capacity study',
    '- perennial/permaculture requires establishment labour and skill; this is not magic yield',
    '- animal power is not free energy: feed land, care labour, and overwintering burdens are explicit',
    ...(warnings.length > 0 ? ['', '## Warnings', ...warnings.map((w) => `- ${w}`)] : [])
  ].join('\n');

  const markdownPath = path.join(produceDir, 'grey-labour-land-baseline.md');
  fs.writeFileSync(markdownPath, markdown);

  return {
    report: json,
    paths: { markdownPath, jsonPath, municipalityCsvPath, scenarioCsvPath, permacultureSystemsCsvPath, permacultureScenariosCsvPath, animalPowerScenariosCsvPath, communityAnimalPowerCsvPath, handToolCapacityCsvPath }
  };
}
