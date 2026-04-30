// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';

function n(v, fallback = 0) { const x = Number(v); return Number.isFinite(x) ? x : fallback; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function esc(v) { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; }
function toCsv(rows, headers) { return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n'); }

function readJsonIfExists(filePath, warnings, label, fallback = null) {
  if (!fs.existsSync(filePath)) {
    warnings.push(`Missing ${label}: ${filePath}`);
    return fallback;
  }
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch (error) {
    warnings.push(`Failed to parse ${label}: ${filePath} (${error.message})`);
    return fallback;
  }
}

const MEALS_PER_GJ = 571.0;

const FOOD_GAP_SCENARIOS = [
  { scenario: 'foodGap5', foodAvailabilityLossShare: 0.05, assumedCause: 'fuel/logistics', sourceStatus: 'model scenario' },
  { scenario: 'foodGap10', foodAvailabilityLossShare: 0.10, assumedCause: 'fuel+fertilizer+logistics', sourceStatus: 'model scenario' },
  { scenario: 'foodGap20', foodAvailabilityLossShare: 0.20, assumedCause: 'combined fuel/fertilizer/input/transport stress', sourceStatus: 'model scenario' },
  { scenario: 'foodGap33', foodAvailabilityLossShare: 0.33, assumedCause: 'combined systemic input loss', sourceStatus: 'model scenario' },
  {
    scenario: 'severeSystemicInputLoss33',
    foodAvailabilityLossShare: 0.33,
    globalFoodProductionLossShare: 0.33,
    localFoodAvailabilityLossShare: 0.12,
    importPricePressureMultiplier: 1.55,
    localProductionShockShare: 0.08,
    tradeCompetitionIndex: 0.85,
    householdAffordabilityTransmissionShare: 0.72,
    poorCountryDisproportionateImpactNote: 'Global shock harms poorer countries and lower-income households first and hardest.',
    assumedCause: 'fuel+fertilizer+sulfur/phosphate+nitrogen/logistics combined disruption',
    sourceStatus: 'severe global scenario assumption, not forecast',
    interpretation: 'global price/availability shock, not direct local crop failure'
  },
  { scenario: 'extremeFoodGap50', foodAvailabilityLossShare: 0.50, assumedCause: 'extreme multi-input loss', sourceStatus: 'model scenario' }
];

const MODALITIES = [
  {
    modality: 'marketGardenIntensive',
    netFoodEnergyGJPerHaAtMaturity: 22,
    usefulFoodEnergyGJPerHaYear1: 14,
    usefulFoodEnergyGJPerHaYear3: 20,
    usefulFoodEnergyGJPerHaYear5: 22,
    usefulFoodEnergyGJPerHaYear10: 22,
    labourFTEPerHaYear1: 1.8,
    labourFTEPerHaAtMaturity: 1.4,
    yearsToMeaningfulYield: 1,
    yearsToMaturity: 3,
    inputDependencyIndex: 0.45,
    skillRequirementIndex: 0.75,
    storageProcessingRequirementIndex: 0.6,
    calorieReplacementEfficiency: 0.45,
    nutritionReplacementValue: 0.95,
    confidence: 'moderate',
    bestRole: 'fast fresh food + local sales'
  },
  {
    modality: 'handToolHouseholdGarden',
    netFoodEnergyGJPerHaAtMaturity: 13,
    usefulFoodEnergyGJPerHaYear1: 8,
    usefulFoodEnergyGJPerHaYear3: 11,
    usefulFoodEnergyGJPerHaYear5: 13,
    usefulFoodEnergyGJPerHaYear10: 13,
    labourFTEPerHaYear1: 2.4,
    labourFTEPerHaAtMaturity: 2.0,
    yearsToMeaningfulYield: 1,
    yearsToMaturity: 3,
    inputDependencyIndex: 0.2,
    skillRequirementIndex: 0.55,
    storageProcessingRequirementIndex: 0.35,
    calorieReplacementEfficiency: 0.35,
    nutritionReplacementValue: 0.9,
    confidence: 'moderate',
    bestRole: 'fast household contribution'
  },
  {
    modality: 'handToolAnnualStaples',
    netFoodEnergyGJPerHaAtMaturity: 17,
    usefulFoodEnergyGJPerHaYear1: 9,
    usefulFoodEnergyGJPerHaYear3: 14,
    usefulFoodEnergyGJPerHaYear5: 17,
    usefulFoodEnergyGJPerHaYear10: 17,
    labourFTEPerHaYear1: 1.9,
    labourFTEPerHaAtMaturity: 1.5,
    yearsToMeaningfulYield: 1,
    yearsToMaturity: 4,
    inputDependencyIndex: 0.3,
    skillRequirementIndex: 0.7,
    storageProcessingRequirementIndex: 0.65,
    calorieReplacementEfficiency: 0.8,
    nutritionReplacementValue: 0.6,
    confidence: 'low_to_moderate',
    bestRole: 'calorie-oriented annuals'
  },
  {
    modality: 'lowInputAnnualField',
    netFoodEnergyGJPerHaAtMaturity: 19,
    usefulFoodEnergyGJPerHaYear1: 11,
    usefulFoodEnergyGJPerHaYear3: 16,
    usefulFoodEnergyGJPerHaYear5: 19,
    usefulFoodEnergyGJPerHaYear10: 19,
    labourFTEPerHaYear1: 0.9,
    labourFTEPerHaAtMaturity: 0.7,
    yearsToMeaningfulYield: 1,
    yearsToMaturity: 4,
    inputDependencyIndex: 0.35,
    skillRequirementIndex: 0.7,
    storageProcessingRequirementIndex: 0.7,
    calorieReplacementEfficiency: 0.85,
    nutritionReplacementValue: 0.7,
    confidence: 'low_to_moderate',
    bestRole: 'mid-speed staple calories'
  },
  {
    modality: 'maturePermaculturePolyculture',
    netFoodEnergyGJPerHaAtMaturity: 15,
    usefulFoodEnergyGJPerHaYear1: 2,
    usefulFoodEnergyGJPerHaYear3: 6,
    usefulFoodEnergyGJPerHaYear5: 10,
    usefulFoodEnergyGJPerHaYear10: 15,
    labourFTEPerHaYear1: 1.1,
    labourFTEPerHaAtMaturity: 0.45,
    yearsToMeaningfulYield: 3,
    yearsToMaturity: 10,
    inputDependencyIndex: 0.18,
    skillRequirementIndex: 0.8,
    storageProcessingRequirementIndex: 0.55,
    calorieReplacementEfficiency: 0.65,
    nutritionReplacementValue: 0.92,
    confidence: 'low',
    bestRole: 'long-term mixed resilience'
  },
  {
    modality: 'perennialStapleBulkLowCare',
    netFoodEnergyGJPerHaAtMaturity: 18,
    usefulFoodEnergyGJPerHaYear1: 1,
    usefulFoodEnergyGJPerHaYear3: 4,
    usefulFoodEnergyGJPerHaYear5: 8,
    usefulFoodEnergyGJPerHaYear10: 14,
    labourFTEPerHaYear1: 0.7,
    labourFTEPerHaAtMaturity: 0.28,
    yearsToMeaningfulYield: 5,
    yearsToMaturity: 15,
    inputDependencyIndex: 0.12,
    skillRequirementIndex: 0.75,
    storageProcessingRequirementIndex: 0.6,
    calorieReplacementEfficiency: 0.88,
    nutritionReplacementValue: 0.7,
    confidence: 'low',
    bestRole: 'long-horizon staple resilience'
  },
  {
    modality: 'greenhouseSeasonExtension',
    netFoodEnergyGJPerHaAtMaturity: 24,
    usefulFoodEnergyGJPerHaYear1: 18,
    usefulFoodEnergyGJPerHaYear3: 22,
    usefulFoodEnergyGJPerHaYear5: 24,
    usefulFoodEnergyGJPerHaYear10: 24,
    labourFTEPerHaYear1: 1.6,
    labourFTEPerHaAtMaturity: 1.3,
    yearsToMeaningfulYield: 1,
    yearsToMaturity: 2,
    inputDependencyIndex: 0.7,
    skillRequirementIndex: 0.72,
    storageProcessingRequirementIndex: 0.5,
    calorieReplacementEfficiency: 0.3,
    nutritionReplacementValue: 0.93,
    confidence: 'low_to_moderate',
    bestRole: 'season extension / nutrition'
  },
  {
    modality: 'mixedResiliencePackage',
    netFoodEnergyGJPerHaAtMaturity: 17,
    usefulFoodEnergyGJPerHaYear1: 10,
    usefulFoodEnergyGJPerHaYear3: 14,
    usefulFoodEnergyGJPerHaYear5: 16,
    usefulFoodEnergyGJPerHaYear10: 17,
    labourFTEPerHaYear1: 1.1,
    labourFTEPerHaAtMaturity: 0.8,
    yearsToMeaningfulYield: 1,
    yearsToMaturity: 8,
    inputDependencyIndex: 0.34,
    skillRequirementIndex: 0.78,
    storageProcessingRequirementIndex: 0.75,
    calorieReplacementEfficiency: 0.75,
    nutritionReplacementValue: 0.9,
    confidence: 'moderate',
    bestRole: 'blended bridge approach'
  }
].map((m) => ({ ...m, landHaPerWorker: m.labourFTEPerHaAtMaturity > 0 ? 1 / m.labourFTEPerHaAtMaturity : 0 }));

const BLENDED_PACKAGES = [
  {
    package: 'emergencyYear1Package',
    shares: {
      handToolHouseholdGarden: 0.40,
      marketGardenIntensive: 0.30,
      lowInputAnnualField: 0.20,
      greenhouseSeasonExtension: 0.10
    }
  },
  {
    package: 'threeYearStabilizationPackage',
    shares: {
      handToolHouseholdGarden: 0.25,
      marketGardenIntensive: 0.25,
      lowInputAnnualField: 0.35,
      maturePermaculturePolyculture: 0.15
    }
  },
  {
    package: 'tenYearResiliencePackage',
    shares: {
      handToolHouseholdGarden: 0.10,
      marketGardenIntensive: 0.15,
      lowInputAnnualField: 0.25,
      perennialStapleBulkLowCare: 0.50
    }
  },
  {
    package: 'twentyYearPerennialResiliencePackage',
    shares: {
      lowInputAnnualField: 0.10,
      marketGardenIntensive: 0.20,
      maturePermaculturePolyculture: 0.25,
      perennialStapleBulkLowCare: 0.45
    }
  }
];

const YEAR1_RAMP_CONSTRAINTS = {
  year1MaxNewMarketGardenHa: 1800,
  year1MaxNewHouseholdGardenParticipation: 0.28,
  year1TrainingConstraint: 0.70,
  year1ToolSeedIrrigationConstraint: 0.72,
  year1LandAccessConstraint: 0.80,
  year1CoordinationConstraint: 0.74,
  year1NewProductionCoverageCap: 0.60
};

function usefulGjPerHa(modality, year) {
  if (year <= 1) return modality.usefulFoodEnergyGJPerHaYear1;
  if (year <= 3) return modality.usefulFoodEnergyGJPerHaYear3;
  if (year <= 5) return modality.usefulFoodEnergyGJPerHaYear5;
  if (year <= 10) return modality.usefulFoodEnergyGJPerHaYear10;
  return modality.netFoodEnergyGJPerHaAtMaturity;
}

function labourFtePerHa(modality, year) {
  if (year <= 1) return modality.labourFTEPerHaYear1;
  if (year <= 5) return modality.labourFTEPerHaYear1 * 0.75 + modality.labourFTEPerHaAtMaturity * 0.25;
  return modality.labourFTEPerHaAtMaturity;
}

export function buildGreyFoodGapReplacementReport(options = {}) {
  const produceDir = path.resolve(options.produceDir ?? 'know/produce');
  fs.mkdirSync(produceDir, { recursive: true });
  const warnings = [];

  const foodCalibration = readJsonIfExists(path.join(produceDir, 'grey-food-calibration.json'), warnings, 'food calibration', {});
  const labourLand = readJsonIfExists(path.join(produceDir, 'grey-labour-land-baseline.json'), warnings, 'labour-land baseline', {});
  const agLabour = readJsonIfExists(path.join(produceDir, 'grey-ag-labour-baseline.json'), warnings, 'ag labour baseline', {});
  const dwelling = readJsonIfExists(path.join(produceDir, 'grey-dwelling-land-access.json'), warnings, 'dwelling land access baseline', {});
  const currentShock = readJsonIfExists(path.join(produceDir, 'grey-current-system-shock-threshold.json'), warnings, 'current shock threshold', {});
  const fuelShock = readJsonIfExists(path.join(produceDir, 'grey-fuel-fertilizer-shock.json'), warnings, 'fuel/fertilizer shock', {});

  const totalDemandGJ = n(foodCalibration.totalFoodDemandGJ, n(foodCalibration.foodDemandBaseline?.totalFoodDemandGJ, 379967.87));
  const annualFoodEnergyGJPerPerson = n(foodCalibration.annualFoodEnergyGJPerPerson, 3.7656);
  const population = n(foodCalibration.population2021, n(dwelling.totalPopulation, 100905));
  const currentAgIndustryFTEEstimate = n(agLabour.currentAgIndustryFTEEstimate, 3918.43);
  const subsistencePotentialPopulation = n(dwelling.estimatedPopulationWithSubsistencePotential, 54949);
  const dwellingsAtOrAboveSubsistence = n((dwelling.thresholdSensitivity ?? []).find((x) => x.thresholdScenario === 'baseline')?.dwellingsAtOrAboveSubsistence, 28310.66);
  const candidateLandHa = n(foodCalibration.humanFoodPriorityHa, n(foodCalibration.foodRelevantLandHa, 18056.83));

  const scenarios = FOOD_GAP_SCENARIOS.map((s) => {
    const localLossShare = s.localFoodAvailabilityLossShare ?? s.foodAvailabilityLossShare;
    const foodGapGJ = totalDemandGJ * localLossShare;
    return {
      ...s,
      localFoodAvailabilityLossShare: localLossShare,
      foodGapGJ,
      foodGapMealsEquivalent: foodGapGJ * MEALS_PER_GJ,
      foodGapPopulationEquivalent: annualFoodEnergyGJPerPerson > 0 ? (foodGapGJ / annualFoodEnergyGJPerPerson) : 0
    };
  });

  const modalityReplacementMatrix = [];
  for (const scenario of scenarios) {
    for (const modality of MODALITIES) {
      const gjYear1 = Math.max(0.001, usefulGjPerHa(modality, 1));
      const gjYear3 = Math.max(0.001, usefulGjPerHa(modality, 3));
      const gjYear5 = Math.max(0.001, usefulGjPerHa(modality, 5));
      const gjYear10 = Math.max(0.001, usefulGjPerHa(modality, 10));
      const gjMaturity = Math.max(0.001, usefulGjPerHa(modality, 99));

      const requiredHaYear1 = scenario.foodGapGJ / gjYear1;
      const requiredHaYear3 = scenario.foodGapGJ / gjYear3;
      const requiredHaYear5 = scenario.foodGapGJ / gjYear5;
      const requiredHaYear10 = scenario.foodGapGJ / gjYear10;
      const requiredHaAtMaturity = scenario.foodGapGJ / gjMaturity;

      const requiredWorkersYear1 = requiredHaYear1 * labourFtePerHa(modality, 1);
      const requiredWorkersYear3 = requiredHaYear3 * labourFtePerHa(modality, 3);
      const requiredWorkersYear5 = requiredHaYear5 * labourFtePerHa(modality, 5);
      const requiredWorkersYear10 = requiredHaYear10 * labourFtePerHa(modality, 10);
      const requiredWorkersAtMaturity = requiredHaAtMaturity * labourFtePerHa(modality, 99);

      const requiredNewWorkersVsCurrentAgIndustry = Math.max(0, requiredWorkersYear1 - currentAgIndustryFTEEstimate);
      const shareOfSubsistencePotentialPopulationNeeded = subsistencePotentialPopulation > 0 ? requiredWorkersYear1 / subsistencePotentialPopulation : null;
      const shareOfDwellingsAtOrAboveSubsistenceNeeded = dwellingsAtOrAboveSubsistence > 0 ? requiredWorkersYear1 / dwellingsAtOrAboveSubsistence : null;

      modalityReplacementMatrix.push({
        scenario: scenario.scenario,
        modality: modality.modality,
        requiredHaYear1,
        requiredHaYear3,
        requiredHaYear5,
        requiredHaYear10,
        requiredHaAtMaturity,
        requiredWorkersYear1,
        requiredWorkersYear3,
        requiredWorkersYear5,
        requiredWorkersYear10,
        requiredWorkersAtMaturity,
        requiredNewWorkersVsCurrentAgIndustry,
        shareOfSubsistencePotentialPopulationNeeded,
        shareOfDwellingsAtOrAboveSubsistenceNeeded,
        landFeasibilityFlag: requiredHaYear1 <= candidateLandHa ? 'plausible' : 'strained',
        labourFeasibilityFlag: requiredWorkersYear1 <= (subsistencePotentialPopulation * 0.5) ? 'plausible' : 'strained',
        timeFeasibilityFlag: modality.yearsToMeaningfulYield <= 1 ? 'immediate' : (modality.yearsToMeaningfulYield <= 3 ? 'near_term' : 'delayed'),
        yearsToMeaningfulYield: modality.yearsToMeaningfulYield,
        yearsToMaturity: modality.yearsToMaturity,
        confidence: modality.confidence
      });
    }
  }

  const mixedReplacementPackages = [];
  for (const scenario of scenarios) {
    for (const pkg of BLENDED_PACKAGES) {
      const years = [1, 3, 5, 10, 20];
      const byYear = {};
      for (const year of years) {
        let blendedGjPerHa = 0;
        let blendedLabourPerHa = 0;
        let perennialContribution = 0;
        for (const [modalityName, share] of Object.entries(pkg.shares)) {
          const modality = MODALITIES.find((m) => m.modality === modalityName);
          if (!modality) continue;
          const gj = usefulGjPerHa(modality, year);
          blendedGjPerHa += gj * share;
          blendedLabourPerHa += labourFtePerHa(modality, year) * share;
          if (modalityName.includes('perennial') || modalityName.includes('Permaculture')) {
            perennialContribution += gj * share;
          }
        }
        blendedGjPerHa = Math.max(0.001, blendedGjPerHa);
        const blendedRequiredHa = scenario.foodGapGJ / blendedGjPerHa;
        const blendedRequiredWorkers = blendedRequiredHa * blendedLabourPerHa;
        const theoreticalCoverageShare = clamp((candidateLandHa * blendedGjPerHa) / Math.max(1, scenario.foodGapGJ), 0, 1);
        let localProductionCoverageShare = theoreticalCoverageShare;
        let storageLossReductionCoverageShare = 0;
        let emergencyAidOrRationingCoverageShare = 0;
        let unmetGapShare = clamp(1 - theoreticalCoverageShare, 0, 1);
        let year1CoverageType = 'new local production only';
        let dependsOnEmergencyImports = false;
        let dependsOnStoredFood = false;
        let dependsOnRapidLabourMobilization = false;
        let confidence = 'moderate';

        if (year === 1) {
          const marketGardenShare = n(pkg.shares.marketGardenIntensive, 0);
          const householdGardenShare = n(pkg.shares.handToolHouseholdGarden, 0);
          const marketGardenModality = MODALITIES.find((m) => m.modality === 'marketGardenIntensive');
          const marketGardenHaNeed = scenario.foodGapGJ * marketGardenShare / Math.max(0.001, usefulGjPerHa(marketGardenModality, 1));
          const marketGardenHaScale = marketGardenShare > 0
            ? clamp(YEAR1_RAMP_CONSTRAINTS.year1MaxNewMarketGardenHa / Math.max(1, marketGardenHaNeed), 0, 1)
            : 1;
          const householdParticipationScale = householdGardenShare > 0
            ? clamp(YEAR1_RAMP_CONSTRAINTS.year1MaxNewHouseholdGardenParticipation / householdGardenShare, 0, 1)
            : 1;
          const organizationalScale = YEAR1_RAMP_CONSTRAINTS.year1TrainingConstraint
            * YEAR1_RAMP_CONSTRAINTS.year1ToolSeedIrrigationConstraint
            * YEAR1_RAMP_CONSTRAINTS.year1LandAccessConstraint
            * YEAR1_RAMP_CONSTRAINTS.year1CoordinationConstraint;
          const year1Scale = Math.min(
            YEAR1_RAMP_CONSTRAINTS.year1NewProductionCoverageCap,
            marketGardenHaScale,
            householdParticipationScale,
            organizationalScale
          );

          localProductionCoverageShare = clamp(theoreticalCoverageShare * year1Scale, 0, YEAR1_RAMP_CONSTRAINTS.year1NewProductionCoverageCap);
          storageLossReductionCoverageShare = clamp((1 - localProductionCoverageShare) * 0.16, 0, 0.18);
          emergencyAidOrRationingCoverageShare = clamp((1 - localProductionCoverageShare - storageLossReductionCoverageShare) * 0.52, 0, 0.65);
          unmetGapShare = clamp(1 - localProductionCoverageShare - storageLossReductionCoverageShare - emergencyAidOrRationingCoverageShare, 0, 1);

          year1CoverageType = 'production plus emergency measures';
          dependsOnEmergencyImports = emergencyAidOrRationingCoverageShare > 0.15;
          dependsOnStoredFood = storageLossReductionCoverageShare > 0.05;
          dependsOnRapidLabourMobilization = localProductionCoverageShare > 0.35;
          confidence = 'low_to_moderate';
        }

        const gapCoveredShare = clamp(localProductionCoverageShare + storageLossReductionCoverageShare + emergencyAidOrRationingCoverageShare, 0, 1);
        byYear[year] = {
          blendedRequiredHa,
          blendedRequiredWorkers,
          theoreticalCoverageShare,
          localProductionCoverageShare,
          storageLossReductionCoverageShare,
          emergencyAidOrRationingCoverageShare,
          unmetGapShare,
          year1CoverageType,
          dependsOnEmergencyImports,
          dependsOnStoredFood,
          dependsOnRapidLabourMobilization,
          confidence,
          gapCoveredShare,
          remainingGapGJ: Math.max(0, scenario.foodGapGJ * unmetGapShare),
          cumulativePerennialMaturityContribution: perennialContribution,
          emergencyFoodNeedRemaining: Math.max(0, scenario.foodGapGJ * (unmetGapShare + emergencyAidOrRationingCoverageShare))
        };
      }

      mixedReplacementPackages.push({
        scenario: scenario.scenario,
        package: pkg.package,
        blendedRequiredHa: byYear[10].blendedRequiredHa,
        blendedRequiredWorkers: byYear[10].blendedRequiredWorkers,
        year1CoverageOfGap: byYear[1].gapCoveredShare,
        year3CoverageOfGap: byYear[3].gapCoveredShare,
        year5CoverageOfGap: byYear[5].gapCoveredShare,
        year10CoverageOfGap: byYear[10].gapCoveredShare,
        maturityCoverageOfGap: byYear[20].gapCoveredShare,
        mainBottleneck: byYear[1].blendedRequiredWorkers > (subsistencePotentialPopulation * 0.5) ? 'labour' : (byYear[1].blendedRequiredHa > candidateLandHa ? 'land' : 'organization'),
        byYear
      });
    }
  }

  const timelineDiagnostics = [];
  for (const scenarioName of ['foodGap33', 'severeSystemicInputLoss33']) {
    for (const pkgName of ['emergencyYear1Package', 'threeYearStabilizationPackage', 'tenYearResiliencePackage', 'twentyYearPerennialResiliencePackage']) {
      const found = mixedReplacementPackages.find((p) => p.scenario === scenarioName && p.package === pkgName);
      if (!found) continue;
      for (const year of [1, 3, 5, 10, 20]) {
        const yr = found.byYear[year];
        timelineDiagnostics.push({
          scenario: scenarioName,
          package: pkgName,
          year,
          gapCoveredShare: yr.gapCoveredShare,
          localProductionCoverageShare: yr.localProductionCoverageShare,
          storageLossReductionCoverageShare: yr.storageLossReductionCoverageShare,
          emergencyAidOrRationingCoverageShare: yr.emergencyAidOrRationingCoverageShare,
          unmetGapShare: yr.unmetGapShare,
          year1CoverageType: yr.year1CoverageType,
          dependsOnEmergencyImports: yr.dependsOnEmergencyImports,
          dependsOnStoredFood: yr.dependsOnStoredFood,
          dependsOnRapidLabourMobilization: yr.dependsOnRapidLabourMobilization,
          confidence: yr.confidence,
          remainingGapGJ: yr.remainingGapGJ,
          requiredWorkers: yr.blendedRequiredWorkers,
          cumulativePerennialContribution: yr.cumulativePerennialMaturityContribution,
          emergencyFoodNeedRemaining: yr.emergencyFoodNeedRemaining
        });
      }
    }
  }

  const assumptions = {
    population,
    totalFoodDemandGJ: totalDemandGJ,
    annualFoodEnergyGJPerPerson,
    currentAgIndustryFTEEstimate,
    subsistencePotentialPopulation,
    dwellingsAtOrAboveSubsistence,
    candidateLandHa,
    year1RampConstraints: YEAR1_RAMP_CONSTRAINTS,
    severeSystemicInputLoss33: 'Scenario assumption only; not a forecast.',
    severeSystemicInputLoss33Interpretation: 'Global price/import shock channel dominates near-term local impact; not automatic one-third local production loss.',
    sourceStatus: 'user-provided/systemic diagnosis assumption, needs external calibration'
  };

  const caveats = [
    'A one-third global food/input loss scenario is a severe assumption, not a forecast.',
    'A one-third global food production loss is not the same as Grey County having one-third less local food; near-term impact is mainly price/import/affordability stress.',
    'Labour and land replacement numbers are scenario diagnostics, not implementation plans.',
    'Modalities differ by calorie replacement speed; fast nutrition systems are not always fast staple systems.',
    'Storage, processing, logistics, and skills can bind before land area.'
  ];

  const scenarioRows = scenarios.map((s) => ({
    scenario: s.scenario,
    foodAvailabilityLossShare: s.foodAvailabilityLossShare,
    foodGapGJ: s.foodGapGJ,
    foodGapPopulationEquivalent: s.foodGapPopulationEquivalent,
    assumedCause: s.assumedCause,
    sourceStatus: s.sourceStatus
  }));

  const modalityRows = modalityReplacementMatrix.map((r) => ({
    scenario: r.scenario,
    modality: r.modality,
    requiredHaYear1: r.requiredHaYear1,
    requiredWorkersYear1: r.requiredWorkersYear1,
    requiredHaYear5: r.requiredHaYear5,
    requiredWorkersYear5: r.requiredWorkersYear5,
    requiredHaAtMaturity: r.requiredHaAtMaturity,
    requiredWorkersAtMaturity: r.requiredWorkersAtMaturity,
    shareOfSubsistencePotentialPopulationNeeded: r.shareOfSubsistencePotentialPopulationNeeded,
    landFeasibilityFlag: r.landFeasibilityFlag,
    labourFeasibilityFlag: r.labourFeasibilityFlag,
    timeFeasibilityFlag: r.timeFeasibilityFlag
  }));

  const report = {
    generatedAt: new Date().toISOString(),
    sourceFiles: {
      foodCalibration: path.join(produceDir, 'grey-food-calibration.json'),
      labourLand: path.join(produceDir, 'grey-labour-land-baseline.json'),
      agLabour: path.join(produceDir, 'grey-ag-labour-baseline.json'),
      dwellingLandAccess: path.join(produceDir, 'grey-dwelling-land-access.json'),
      currentShockThreshold: path.join(produceDir, 'grey-current-system-shock-threshold.json'),
      fuelShock: path.join(produceDir, 'grey-fuel-fertilizer-shock.json')
    },
    assumptions,
    caveats,
    warnings,
    foodGapScenarios: scenarios,
    productionModalities: MODALITIES,
    modalityReplacementMatrix,
    mixedReplacementPackages,
    timelineDiagnostics,
    keyResults: {
      foodGap10: modalityReplacementMatrix.find((r) => r.scenario === 'foodGap10' && r.modality === 'lowInputAnnualField') ?? null,
      foodGap20: modalityReplacementMatrix.find((r) => r.scenario === 'foodGap20' && r.modality === 'lowInputAnnualField') ?? null,
      foodGap33: modalityReplacementMatrix.find((r) => r.scenario === 'foodGap33' && r.modality === 'lowInputAnnualField') ?? null,
      foodGap33EmergencyYear1Package: mixedReplacementPackages.find((p) => p.scenario === 'foodGap33' && p.package === 'emergencyYear1Package') ?? null,
      foodGap33TenYearResiliencePackage: mixedReplacementPackages.find((p) => p.scenario === 'foodGap33' && p.package === 'tenYearResiliencePackage') ?? null,
      severeSystemicInputLoss33MainBottleneck: mixedReplacementPackages.find((p) => p.scenario === 'severeSystemicInputLoss33' && p.package === 'tenYearResiliencePackage')?.mainBottleneck ?? null
    }
  };

  const markdownLines = [
    '# Grey Food Gap Replacement by Production Modality',
    '',
    '## Bottom line',
    'This report estimates how many additional local producers are needed to replace food lost from fuel/fertilizer/input shocks, by production modality.',
    '',
    '## Important caveat',
    'A one-third global food production loss is a severe scenario assumption, not a forecast. It is included because systemic input disruption can affect oil, nitrogen, sulfur/phosphate fertilizer, shipping, processing, and packaging at the same time.',
    'A one-third global food production loss is not the same as Grey County having one-third less local food. In Grey, the main near-term channel is higher prices, tighter trade, import competition, and household affordability stress.',
    '',
    '## Food gap scenarios',
    '| Scenario | Food availability loss | GJ gap | Population-equivalent gap | Source status |',
    '| --- | ---: | ---: | ---: | --- |',
    ...scenarioRows.map((s) => `| ${s.scenario} | ${(s.foodAvailabilityLossShare * 100).toFixed(1)}% | ${s.foodGapGJ.toFixed(0)} | ${s.foodGapPopulationEquivalent.toFixed(0)} | ${s.sourceStatus} |`),
    '',
    '## Production modality assumptions',
    '| Modality | Useful year 1? | Years to maturity | GJ/ha maturity | Workers/ha maturity | Input dependence | Best role |',
    '| --- | --- | ---: | ---: | ---: | ---: | --- |',
    ...MODALITIES.map((m) => `| ${m.modality} | ${m.yearsToMeaningfulYield <= 1 ? 'Yes' : 'Delayed'} | ${m.yearsToMaturity} | ${m.netFoodEnergyGJPerHaAtMaturity.toFixed(2)} | ${m.labourFTEPerHaAtMaturity.toFixed(2)} | ${m.inputDependencyIndex.toFixed(2)} | ${m.bestRole} |`),
    '',
    '## Replacement needs by modality',
    '| Scenario | Modality | Required ha (year 1) | Required workers (year 1) | Years to useful yield | Feasibility notes |',
    '| --- | --- | ---: | ---: | ---: | --- |',
    ...modalityRows.filter((r) => ['foodGap10', 'foodGap20', 'foodGap33'].includes(r.scenario)).slice(0, 30).map((r) => `| ${r.scenario} | ${r.modality} | ${r.requiredHaYear1.toFixed(0)} | ${r.requiredWorkersYear1.toFixed(0)} | ${modalityReplacementMatrix.find((x) => x.scenario === r.scenario && x.modality === r.modality)?.yearsToMeaningfulYield ?? ''} | land=${r.landFeasibilityFlag}, labour=${r.labourFeasibilityFlag}, time=${r.timeFeasibilityFlag} |`),
    '',
    '## Mixed replacement packages',
    '| Package | Year 1 local production | Year 1 emergency bridging | Year 1 unmet gap | Year 5 gap covered | Year 10 gap covered | Workers needed (year 10) | Main bottleneck |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
    ...mixedReplacementPackages.filter((p) => p.scenario === 'foodGap33').map((p) => `| ${p.package} | ${(n(p.byYear?.[1]?.localProductionCoverageShare) * 100).toFixed(1)}% | ${((n(p.byYear?.[1]?.storageLossReductionCoverageShare) + n(p.byYear?.[1]?.emergencyAidOrRationingCoverageShare)) * 100).toFixed(1)}% | ${(n(p.byYear?.[1]?.unmetGapShare) * 100).toFixed(1)}% | ${(p.year5CoverageOfGap * 100).toFixed(1)}% | ${(p.year10CoverageOfGap * 100).toFixed(1)}% | ${p.blendedRequiredWorkers.toFixed(0)} | ${p.mainBottleneck} |`),
    '',
    'Year 1 is emergency bridging, not mature local replacement. Perennial systems are a 5-20 year resilience strategy, not an immediate shock response. Low-input annuals and market gardens can respond faster, but are constrained by labour, training, tools, seed, irrigation, land access, and coordination.',
    '',
    '## What helps fastest',
    '- emergency food aid/import substitution/rationing',
    '- household gardens for fresh food',
    '- market gardens for vegetables',
    '- low-input annual staples for calories',
    '- storage/loss reduction and local processing',
    '',
    '## What helps long-term',
    '- perennial staple systems and orchard/nut/coppice systems',
    '- soil-building low-input systems',
    '- trained local food workforce',
    '- local processing/storage/depot network',
    '',
    '## Practical interpretation',
    'Market gardens are fast but labour intensive and not enough for staple calories. Perennials are powerful but delayed. Annual staples can fill calories sooner but need labour/tools/storage. The realistic answer is mixed packages over time.'
  ];

  const markdown = `${markdownLines.join('\n')}\n`;

  const markdownPath = path.join(produceDir, 'grey-food-gap-replacement.md');
  const jsonPath = path.join(produceDir, 'grey-food-gap-replacement.json');
  const scenariosCsvPath = path.join(produceDir, 'grey-food-gap-replacement-scenarios.csv');
  const modalitiesCsvPath = path.join(produceDir, 'grey-food-gap-replacement-modalities.csv');
  const timelineCsvPath = path.join(produceDir, 'grey-food-gap-replacement-timeline.csv');

  fs.writeFileSync(markdownPath, markdown);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(scenariosCsvPath, `${toCsv(scenarioRows, [
    'scenario',
    'foodAvailabilityLossShare',
    'foodGapGJ',
    'foodGapPopulationEquivalent',
    'assumedCause',
    'sourceStatus'
  ])}\n`);
  fs.writeFileSync(modalitiesCsvPath, `${toCsv(modalityRows, [
    'scenario',
    'modality',
    'requiredHaYear1',
    'requiredWorkersYear1',
    'requiredHaYear5',
    'requiredWorkersYear5',
    'requiredHaAtMaturity',
    'requiredWorkersAtMaturity',
    'shareOfSubsistencePotentialPopulationNeeded',
    'landFeasibilityFlag',
    'labourFeasibilityFlag',
    'timeFeasibilityFlag'
  ])}\n`);
  fs.writeFileSync(timelineCsvPath, `${toCsv(timelineDiagnostics, [
    'scenario',
    'package',
    'year',
    'gapCoveredShare',
    'localProductionCoverageShare',
    'storageLossReductionCoverageShare',
    'emergencyAidOrRationingCoverageShare',
    'unmetGapShare',
    'year1CoverageType',
    'dependsOnEmergencyImports',
    'dependsOnStoredFood',
    'dependsOnRapidLabourMobilization',
    'confidence',
    'remainingGapGJ',
    'requiredWorkers',
    'cumulativePerennialContribution',
    'emergencyFoodNeedRemaining'
  ])}\n`);

  return {
    report,
    paths: {
      markdownPath,
      jsonPath,
      scenariosCsvPath,
      modalitiesCsvPath,
      timelineCsvPath
    }
  };
}
