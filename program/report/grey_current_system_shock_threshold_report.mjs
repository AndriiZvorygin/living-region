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

const SHOCK_PCTS = [0, 5, 10, 15, 20, 25, 30, 40, 50];
const MEALS_PER_GJ = 571.0; // approx 700 kcal meal equivalent

function thresholdAt(rows, fn) {
  const hit = rows.find(fn);
  return hit ? hit.scenario : null;
}

export function buildGreyCurrentSystemShockThresholdReport(options = {}) {
  const produceDir = path.resolve(options.produceDir ?? 'know/produce');
  fs.mkdirSync(produceDir, { recursive: true });
  const warnings = [];

  const foodCalibration = readJsonIfExists(path.join(produceDir, 'grey-food-calibration.json'), warnings, 'food calibration', {});
  const fuelShock = readJsonIfExists(path.join(produceDir, 'grey-fuel-fertilizer-shock.json'), warnings, 'fuel shock', {});
  const agLabour = readJsonIfExists(path.join(produceDir, 'grey-ag-labour-baseline.json'), warnings, 'ag labour baseline', {});
  const dwelling = readJsonIfExists(path.join(produceDir, 'grey-dwelling-land-access.json'), warnings, 'dwelling land access', {});
  const populationDist = readJsonIfExists(path.join(produceDir, 'grey-population-distribution.json'), warnings, 'population distribution', {});
  const transition = readJsonIfExists(path.join(produceDir, 'grey-transition-pathways.json'), warnings, 'transition pathways', {});
  const assessment = readJsonIfExists(path.join(produceDir, 'living-region-model-assessment.json'), warnings, 'assessment', {});

  const totalPopulation = n(populationDist.totalPopulationMatched, n(dwelling.totalPopulation, 100905));
  const totalDemandGJ = n(foodCalibration.foodDemandBaseline?.totalFoodDemandGJ, 379967.87);
  const localizedScenario = (foodCalibration.plausibilityScenarios ?? []).find((s) => s.scenario === 'localizedPresentTechBaseline') ?? {};
  const baseCoverage = n(localizedScenario.foodCoverage, 0.472);
  const baseNetGJ = n(localizedScenario.netFoodEnergyGJ, baseCoverage * totalDemandGJ);
  const currentAgIndustryFTE = n(agLabour.currentAgIndustryFTEEstimate, 3918.43);
  const baseFoodInsecurityShare = n(transition.assumptions?.currentFoodInsecurityShare, 0.25);
  const noDirectLandAccessPopulation = n(dwelling.estimatedPopulationNoDirectLandAccess, 7990);
  const subsistencePotentialPopulation = n(dwelling.estimatedPopulationWithSubsistencePotential, 54949);
  const importDependencyIndex = 0.86;

  const lagModel = {
    immediateMarketPriceSignalMonths: '0-1',
    fuelRetailPassThroughMonths: '1-3',
    foodDistributionPassThroughMonths: '2-6',
    fertilizerFarmInputPassThroughMonths: '3-12',
    plantingHarvestImpact: 'next growing season',
    foodBankHouseholdStressImpactMonths: '1-6',
    municipalBudgetServiceImpactMonths: '3-12'
  };

  const shockScenarios = SHOCK_PCTS.map((pct) => {
    const s = pct / 100;
    const fuelAvailabilityIndex = clamp(1 - s, 0.4, 1);
    const dieselPriceMultiplier = 1 + s * 2.6;
    const fertilizerPriceMultiplier = 1 + s * 1.8;
    const transportCostMultiplier = 1 + s * 1.9;
    const foodImportCostMultiplier = 1 + s * 1.5;
    const farmInputCostMultiplier = 1 + s * 1.7;
    const householdFoodPriceMultiplier = 1 + s * 1.25;
    const householdTransportCostMultiplier = 1 + s * 1.55;
    const lagMonthsToHouseholdImpact = clamp(1 + s * 6, 1, 7);
    const lagMonthsToFarmInputImpact = clamp(3 + s * 8, 3, 12);
    const lagMonthsToFoodBankImpact = clamp(1 + s * 5, 1, 6);
    const lagMonthsToMunicipalBudgetImpact = clamp(3 + s * 9, 3, 12);

    const netCoveragePenalty = s * 0.62;
    const foodCoverage = clamp(baseCoverage * (1 - netCoveragePenalty), 0.05, 2);
    const netFoodEnergyGJ = foodCoverage * totalDemandGJ;
    const foodSurplusGJ = netFoodEnergyGJ - totalDemandGJ;
    const additionalFoodAidNeedGJ = Math.max(0, -foodSurplusGJ);
    const additionalFoodAidNeedMealsEquivalent = additionalFoodAidNeedGJ * MEALS_PER_GJ;

    const averageFoodCostBurdenIndex = clamp(0.31 + (householdFoodPriceMultiplier - 1) * 0.7 + (1 - foodCoverage) * 0.3, 0, 1);
    const transportCostBurdenIndex = clamp(0.28 + (householdTransportCostMultiplier - 1) * 0.8, 0, 1);
    const combinedHouseholdStressIndex = clamp(averageFoodCostBurdenIndex * 0.55 + transportCostBurdenIndex * 0.35 + (1 - foodCoverage) * 0.25, 0, 1);

    const foodStressRiskShare = clamp(baseFoodInsecurityShare + (1 - foodCoverage) * 0.72 + (averageFoodCostBurdenIndex - 0.3) * 0.3 + (transportCostBurdenIndex - 0.28) * 0.2 + (noDirectLandAccessPopulation / Math.max(1, totalPopulation)) * 0.12, 0.08, 0.98);
    const foodInsecurityRiskShare = clamp(baseFoodInsecurityShare + (1 - foodCoverage) * 0.45 + (averageFoodCostBurdenIndex - 0.3) * 0.22 + (transportCostBurdenIndex - 0.28) * 0.12 + (noDirectLandAccessPopulation / Math.max(1, totalPopulation)) * 0.1, 0.05, 0.95);
    const severeFoodStressShare = clamp(foodInsecurityRiskShare * 0.33 + s * 0.08, 0.01, 0.65);
    const foodStressRiskPopulation = foodStressRiskShare * totalPopulation;
    const foodInsecurityRiskExposurePopulation = foodInsecurityRiskShare * totalPopulation;
    const severeFoodStressPopulation = severeFoodStressShare * totalPopulation;

    const foodBankPressureIndex = clamp((foodInsecurityRiskShare - baseFoodInsecurityShare) * 1.8 + s * 0.35, 0, 1);
    const municipalEmergencyPressureIndex = clamp(combinedHouseholdStressIndex * 0.5 + foodBankPressureIndex * 0.35 + s * 0.2, 0, 1);
    const foodWorkersNeededFTE = Math.max(0, currentAgIndustryFTE * (1 + s * 7.5));
    const agLabourGapExceedsCurrent = foodWorkersNeededFTE > currentAgIndustryFTE * 2;

    return {
      scenario: `fuelShock${pct}`,
      fuelShockPct: pct,
      fuelAvailabilityIndex,
      dieselPriceMultiplier,
      fertilizerPriceMultiplier,
      transportCostMultiplier,
      foodImportCostMultiplier,
      farmInputCostMultiplier,
      householdFoodPriceMultiplier,
      householdTransportCostMultiplier,
      lagMonthsToHouseholdImpact,
      lagMonthsToFarmInputImpact,
      lagMonthsToFoodBankImpact,
      lagMonthsToMunicipalBudgetImpact,
      lagMonthsToAcutePain: clamp(lagMonthsToHouseholdImpact + 1.5, 1, 12),
      averageFoodCostBurdenIndex,
      transportCostBurdenIndex,
      householdStressIndex: combinedHouseholdStressIndex,
      combinedHouseholdStressIndex,
      foodStressRiskPopulation,
      foodInsecurityRiskExposurePopulation,
      severeFoodStressPopulation,
      additionalFoodAidNeedGJ,
      additionalFoodAidNeedMealsEquivalent,
      foodBankPressureIndex,
      municipalEmergencyPressureIndex,
      foodCoverage,
      foodSurplusGJ,
      foodWorkersNeededFTE,
      agLabourGapExceedsCurrent,
      mainThresholdCrossed: 'none',
      notes: 'Current supply-chain-dependent system, no resilience package assumed.'
    };
  });

  const baseline = shockScenarios[0];
  for (const row of shockScenarios) {
    row.baselineFoodStressRiskPopulation = baseline.foodStressRiskPopulation;
    row.addedFoodStressRiskPopulationVsFuelShock0 = row.foodStressRiskPopulation - baseline.foodStressRiskPopulation;
    row.baselineFoodInsecurityRiskExposurePopulation = baseline.foodInsecurityRiskExposurePopulation;
    row.addedFoodInsecurityRiskExposureVsFuelShock0 = row.foodInsecurityRiskExposurePopulation - baseline.foodInsecurityRiskExposurePopulation;
    row.baselineSevereFoodStressPopulation = baseline.severeFoodStressPopulation;
    row.addedSevereFoodStressVsFuelShock0 = row.severeFoodStressPopulation - baseline.severeFoodStressPopulation;
  }

  const isShockNotBaseline = (r) => r.fuelShockPct > 0;
  const firstFoodInsecurityPlus10PctVsBaseline = thresholdAt(shockScenarios, (r) => isShockNotBaseline(r) && r.foodInsecurityRiskExposurePopulation >= baseline.foodInsecurityRiskExposurePopulation * 1.10);
  const firstFoodInsecurityPlus25PctVsBaseline = thresholdAt(shockScenarios, (r) => isShockNotBaseline(r) && r.foodInsecurityRiskExposurePopulation >= baseline.foodInsecurityRiskExposurePopulation * 1.25);
  const firstFoodInsecurityPlus50PctVsBaseline = thresholdAt(shockScenarios, (r) => isShockNotBaseline(r) && r.foodInsecurityRiskExposurePopulation >= baseline.foodInsecurityRiskExposurePopulation * 1.50);
  const firstSevereStressPlus10PctVsBaseline = thresholdAt(shockScenarios, (r) => isShockNotBaseline(r) && r.severeFoodStressPopulation >= baseline.severeFoodStressPopulation * 1.10);
  const firstSevereStressPlus25PctVsBaseline = thresholdAt(shockScenarios, (r) => isShockNotBaseline(r) && r.severeFoodStressPopulation >= baseline.severeFoodStressPopulation * 1.25);
  const firstSevereStressPlus50PctVsBaseline = thresholdAt(shockScenarios, (r) => isShockNotBaseline(r) && r.severeFoodStressPopulation >= baseline.severeFoodStressPopulation * 1.50);

  for (const row of shockScenarios) {
    let mainThresholdCrossed = 'none';
    if (row.fuelShockPct > 0) {
      if (row.municipalEmergencyPressureIndex >= 0.85) mainThresholdCrossed = 'municipal_emergency_pressure_0_85';
      else if (row.foodBankPressureIndex >= 0.85) mainThresholdCrossed = 'foodbank_pressure_0_85';
      else if (row.householdStressIndex >= 0.85) mainThresholdCrossed = 'household_stress_0_85';
      else if (row.severeFoodStressPopulation >= baseline.severeFoodStressPopulation * 1.50) mainThresholdCrossed = 'severe_stress_plus_50pct_vs_baseline';
      else if (row.severeFoodStressPopulation >= baseline.severeFoodStressPopulation * 1.25) mainThresholdCrossed = 'severe_stress_plus_25pct_vs_baseline';
      else if (row.severeFoodStressPopulation >= baseline.severeFoodStressPopulation * 1.10) mainThresholdCrossed = 'severe_stress_plus_10pct_vs_baseline';
      else if (row.foodInsecurityRiskExposurePopulation >= baseline.foodInsecurityRiskExposurePopulation * 1.50) mainThresholdCrossed = 'food_insecurity_plus_50pct_vs_baseline';
      else if (row.foodInsecurityRiskExposurePopulation >= baseline.foodInsecurityRiskExposurePopulation * 1.25) mainThresholdCrossed = 'food_insecurity_plus_25pct_vs_baseline';
      else if (row.foodInsecurityRiskExposurePopulation >= baseline.foodInsecurityRiskExposurePopulation * 1.10) mainThresholdCrossed = 'food_insecurity_plus_10pct_vs_baseline';
    }
    row.mainThresholdCrossed = mainThresholdCrossed;
  }
  const firstModerateStressShockLevel = thresholdAt(shockScenarios, (r) => r.householdStressIndex >= 0.5 || r.foodInsecurityRiskExposurePopulation >= baseline.foodInsecurityRiskExposurePopulation * 1.1);
  const firstSevereStressShockLevel = thresholdAt(shockScenarios, (r) => r.householdStressIndex >= 0.7 || r.foodInsecurityRiskExposurePopulation >= baseline.foodInsecurityRiskExposurePopulation * 1.25);
  const firstFoodBankCrisisShockLevel = thresholdAt(shockScenarios, (r) => r.foodBankPressureIndex >= 0.7);
  const firstMunicipalEmergencyShockLevel = thresholdAt(shockScenarios, (r) => r.municipalEmergencyPressureIndex >= 0.7);
  const firstLabourMobilizationShockLevel = thresholdAt(shockScenarios, (r) => r.agLabourGapExceedsCurrent);
  const firstFertilizerPlantingSeasonRiskLevel = thresholdAt(shockScenarios, (r) => r.fertilizerPriceMultiplier >= 1.4 || r.lagMonthsToFarmInputImpact >= 6);

  const currentSystemVulnerability = {
    importDependencyIndex,
    longDistanceSupplyChainExposure: 0.82,
    fuelDependentDistributionExposure: 0.84,
    fertilizerDependencyExposure: 0.78,
    centralizedProcessingExposure: 0.73,
    householdAffordabilityExposure: clamp(0.55 + (baseline.householdStressIndex * 0.25), 0, 1)
  };

  const shock20 = shockScenarios.find((s) => s.scenario === 'fuelShock20') ?? baseline;
  const secondaryAdaptationComparison = [
    { adaptation: 'noAdaptation', foodInsecurityRiskExposurePopulation: shock20.foodInsecurityRiskExposurePopulation, severeFoodStressPopulation: shock20.severeFoodStressPopulation, householdStressIndex: shock20.householdStressIndex },
    { adaptation: 'emergencyFoodAidOnly', foodInsecurityRiskExposurePopulation: shock20.foodInsecurityRiskExposurePopulation * 0.93, severeFoodStressPopulation: shock20.severeFoodStressPopulation * 0.9, householdStressIndex: clamp(shock20.householdStressIndex - 0.04, 0, 1) },
    { adaptation: 'storageAndDistributionStabilization', foodInsecurityRiskExposurePopulation: shock20.foodInsecurityRiskExposurePopulation * 0.86, severeFoodStressPopulation: shock20.severeFoodStressPopulation * 0.82, householdStressIndex: clamp(shock20.householdStressIndex - 0.09, 0, 1) },
    { adaptation: 'localResiliencePackage', foodInsecurityRiskExposurePopulation: shock20.foodInsecurityRiskExposurePopulation * 0.74, severeFoodStressPopulation: shock20.severeFoodStressPopulation * 0.68, householdStressIndex: clamp(shock20.householdStressIndex - 0.16, 0, 1) }
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    assumptions: {
      currentSystemPrimary: true,
      baseFoodInsecurityShareAssumption: baseFoodInsecurityShare,
      lagModelConfigurableAssumption: true
    },
    lagModel,
    shockScenarios,
    thresholdFindings: {
      baselineFoodStressRiskPopulation: baseline.foodStressRiskPopulation,
      baselineFoodInsecurityRiskExposurePopulation: baseline.foodInsecurityRiskExposurePopulation,
      baselineSevereFoodStressPopulation: baseline.severeFoodStressPopulation,
      firstFoodInsecurityPlus10PctVsBaseline,
      firstFoodInsecurityPlus25PctVsBaseline,
      firstFoodInsecurityPlus50PctVsBaseline,
      firstSevereStressPlus10PctVsBaseline,
      firstSevereStressPlus25PctVsBaseline,
      firstSevereStressPlus50PctVsBaseline,
      firstModerateStressShockLevel,
      firstSevereStressShockLevel,
      firstFoodBankCrisisShockLevel,
      firstMunicipalEmergencyShockLevel,
      firstLabourMobilizationShockLevel,
      firstFertilizerPlantingSeasonRiskLevel
    },
    currentSystemVulnerability,
    secondaryAdaptationComparison,
    caveats: [
      'This report models the current supply-chain-dependent system and does not assume local resilience already exists.',
      'Not a price forecast.',
      'Not an exact hunger forecast.',
      'Lag timing is scenario-based and configurable.'
    ],
    warnings,
    modelAssessmentReference: {
      presentOverallCredibilityScore: n(assessment.scorecard?.presentOverallCredibilityScore),
      presentFoodSystemScore: n(assessment.scorecard?.presentFoodSystemScore),
      subsistencePotentialPopulation
    }
  };

  const md = [
    '# Grey Current-System Fuel/Input Shock Thresholds',
    '',
    '## Bottom line',
    'This report asks when the current supply-chain-dependent system starts to create serious household and municipal stress. It does not assume local resilience already exists.',
    '',
    '## Why this matters',
    'Oil/fuel shocks do not hit households all at once. Effects move through inventories, shipping, refining, contracts, trucking, fertilizer, farm inputs, food distribution, and retail prices over weeks to months.',
    '',
    '## Current-system shock table',
    '| Scenario | Fuel shock | Food price pressure | Transport pressure | Food-stress exposure proxy | Severe stress proxy | Added food-insecurity exposure vs baseline | Lag to acute household impact | Main shock threshold crossed |',
    '|---|---:|---:|---:|---:|---:|---:|---|',
    ...shockScenarios.map((s) => `| ${s.scenario} | ${s.fuelShockPct}% | ${s.householdFoodPriceMultiplier.toFixed(2)}x | ${s.householdTransportCostMultiplier.toFixed(2)}x | ${s.foodInsecurityRiskExposurePopulation.toFixed(0)} | ${s.severeFoodStressPopulation.toFixed(0)} | ${s.addedFoodInsecurityRiskExposureVsFuelShock0.toFixed(0)} | ${s.lagMonthsToAcutePain.toFixed(1)} months | ${s.mainThresholdCrossed} |`),
    '',
    'Baseline stress is already present before any new fuel/input shock. The shock thresholds below measure additional stress relative to the fuelShock0 baseline.',
    '',
    '## Threshold findings',
    `- baseline food-stress exposure: ${baseline.foodStressRiskPopulation.toFixed(0)}`,
    `- baseline food-insecurity exposure: ${baseline.foodInsecurityRiskExposurePopulation.toFixed(0)}`,
    `- baseline severe stress: ${baseline.severeFoodStressPopulation.toFixed(0)}`,
    `- first +10% food-insecurity exposure threshold vs baseline: ${firstFoodInsecurityPlus10PctVsBaseline}`,
    `- first +25% food-insecurity exposure threshold vs baseline: ${firstFoodInsecurityPlus25PctVsBaseline}`,
    `- first +50% food-insecurity exposure threshold vs baseline: ${firstFoodInsecurityPlus50PctVsBaseline}`,
    `- first +10% severe stress threshold vs baseline: ${firstSevereStressPlus10PctVsBaseline}`,
    `- first +25% severe stress threshold vs baseline: ${firstSevereStressPlus25PctVsBaseline}`,
    `- first +50% severe stress threshold vs baseline: ${firstSevereStressPlus50PctVsBaseline}`,
    `- first moderate stress level: ${firstModerateStressShockLevel}`,
    `- first severe stress level: ${firstSevereStressShockLevel}`,
    `- first food bank pressure level: ${firstFoodBankCrisisShockLevel}`,
    `- first municipal pressure level: ${firstMunicipalEmergencyShockLevel}`,
    `- first farm input/planting risk level: ${firstFertilizerPlantingSeasonRiskLevel}`,
    '',
    '## Lag timeline',
    `- Month 0-1: immediate market price signal (${lagModel.immediateMarketPriceSignalMonths})`,
    `- Month 1-3: fuel retail pass-through (${lagModel.fuelRetailPassThroughMonths})`,
    `- Month 3-6: food distribution pass-through (${lagModel.foodDistributionPassThroughMonths})`,
    `- Month 6-12: fertilizer/input and municipal budget pressure (${lagModel.fertilizerFarmInputPassThroughMonths}; ${lagModel.municipalBudgetServiceImpactMonths})`,
    `- Next growing season: planting/harvest effects (${lagModel.plantingHarvestImpact})`,
    '',
    '## What this does and does not show',
    'Does show:',
    '- vulnerability thresholds in the current system',
    '- lagged household/municipal impacts',
    '- when adaptation becomes urgent',
    'Does not show:',
    '- exact price forecasts',
    '- exact hunger forecasts',
    '- guaranteed timing',
    '- official emergency projections',
    '',
    '## Why local resilience comes after this',
    'Local resilience is the response. First we need to identify when and where the current system becomes stressed.',
    '',
    '## Secondary adaptation comparison',
    '| Adaptation | Shock20 risk exposure | Shock20 severe stress | Shock20 household stress index |',
    '|---|---:|---:|---:|',
    ...secondaryAdaptationComparison.map((r) => `| ${r.adaptation} | ${r.foodInsecurityRiskExposurePopulation.toFixed(0)} | ${r.severeFoodStressPopulation.toFixed(0)} | ${r.householdStressIndex.toFixed(3)} |`)
  ].join('\n');

  const scenariosCsvRows = shockScenarios.map((s) => ({
    scenario: s.scenario,
    fuelShockPct: s.fuelShockPct,
    fuelAvailabilityIndex: s.fuelAvailabilityIndex,
    dieselPriceMultiplier: s.dieselPriceMultiplier,
    fertilizerPriceMultiplier: s.fertilizerPriceMultiplier,
    transportCostMultiplier: s.transportCostMultiplier,
    foodImportCostMultiplier: s.foodImportCostMultiplier,
    householdFoodPriceMultiplier: s.householdFoodPriceMultiplier,
    householdTransportCostMultiplier: s.householdTransportCostMultiplier,
    foodStressRiskPopulation: s.foodStressRiskPopulation,
    baselineFoodStressRiskPopulation: s.baselineFoodStressRiskPopulation,
    addedFoodStressRiskPopulationVsFuelShock0: s.addedFoodStressRiskPopulationVsFuelShock0,
    foodInsecurityRiskExposurePopulation: s.foodInsecurityRiskExposurePopulation,
    baselineFoodInsecurityRiskExposurePopulation: s.baselineFoodInsecurityRiskExposurePopulation,
    addedFoodInsecurityRiskExposureVsFuelShock0: s.addedFoodInsecurityRiskExposureVsFuelShock0,
    severeFoodStressPopulation: s.severeFoodStressPopulation,
    baselineSevereFoodStressPopulation: s.baselineSevereFoodStressPopulation,
    addedSevereFoodStressVsFuelShock0: s.addedSevereFoodStressVsFuelShock0,
    householdStressIndex: s.householdStressIndex,
    foodBankPressureIndex: s.foodBankPressureIndex,
    municipalEmergencyPressureIndex: s.municipalEmergencyPressureIndex,
    mainThresholdCrossed: s.mainThresholdCrossed,
    lagMonthsToHouseholdImpact: s.lagMonthsToHouseholdImpact,
    notes: s.notes
  }));

  const householdsCsvRows = shockScenarios.map((s) => ({
    scenario: s.scenario,
    foodStressRiskPopulation: s.foodStressRiskPopulation,
    baselineFoodStressRiskPopulation: s.baselineFoodStressRiskPopulation,
    addedFoodStressRiskPopulationVsFuelShock0: s.addedFoodStressRiskPopulationVsFuelShock0,
    foodInsecurityRiskExposurePopulation: s.foodInsecurityRiskExposurePopulation,
    baselineFoodInsecurityRiskExposurePopulation: s.baselineFoodInsecurityRiskExposurePopulation,
    addedFoodInsecurityRiskExposureVsFuelShock0: s.addedFoodInsecurityRiskExposureVsFuelShock0,
    severeFoodStressPopulation: s.severeFoodStressPopulation,
    baselineSevereFoodStressPopulation: s.baselineSevereFoodStressPopulation,
    addedSevereFoodStressVsFuelShock0: s.addedSevereFoodStressVsFuelShock0,
    additionalFoodAidNeedGJ: s.additionalFoodAidNeedGJ,
    additionalFoodAidNeedMealsEquivalent: s.additionalFoodAidNeedMealsEquivalent,
    foodBankPressureIndex: s.foodBankPressureIndex,
    municipalEmergencyPressureIndex: s.municipalEmergencyPressureIndex,
    lagMonthsToAcutePain: s.lagMonthsToAcutePain,
    caveat: 'Risk exposure proxy, not a forecasted hunger count.'
  }));

  const paths = {
    markdownPath: path.join(produceDir, 'grey-current-system-shock-threshold.md'),
    jsonPath: path.join(produceDir, 'grey-current-system-shock-threshold.json'),
    scenariosCsvPath: path.join(produceDir, 'grey-current-system-shock-threshold-scenarios.csv'),
    householdsCsvPath: path.join(produceDir, 'grey-current-system-shock-threshold-households.csv')
  };

  fs.writeFileSync(paths.markdownPath, md);
  fs.writeFileSync(paths.jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(paths.scenariosCsvPath, toCsv(scenariosCsvRows, [
    'scenario', 'fuelShockPct', 'fuelAvailabilityIndex', 'dieselPriceMultiplier', 'fertilizerPriceMultiplier',
    'transportCostMultiplier', 'foodImportCostMultiplier', 'householdFoodPriceMultiplier',
    'householdTransportCostMultiplier', 'foodStressRiskPopulation', 'baselineFoodStressRiskPopulation',
    'addedFoodStressRiskPopulationVsFuelShock0', 'foodInsecurityRiskExposurePopulation', 'baselineFoodInsecurityRiskExposurePopulation',
    'addedFoodInsecurityRiskExposureVsFuelShock0', 'severeFoodStressPopulation', 'baselineSevereFoodStressPopulation',
    'addedSevereFoodStressVsFuelShock0', 'householdStressIndex', 'foodBankPressureIndex',
    'municipalEmergencyPressureIndex', 'mainThresholdCrossed', 'lagMonthsToHouseholdImpact', 'notes'
  ]));
  fs.writeFileSync(paths.householdsCsvPath, toCsv(householdsCsvRows, [
    'scenario', 'foodStressRiskPopulation', 'baselineFoodStressRiskPopulation', 'addedFoodStressRiskPopulationVsFuelShock0',
    'foodInsecurityRiskExposurePopulation', 'baselineFoodInsecurityRiskExposurePopulation', 'addedFoodInsecurityRiskExposureVsFuelShock0',
    'severeFoodStressPopulation', 'baselineSevereFoodStressPopulation', 'addedSevereFoodStressVsFuelShock0',
    'additionalFoodAidNeedGJ', 'additionalFoodAidNeedMealsEquivalent', 'foodBankPressureIndex',
    'municipalEmergencyPressureIndex', 'lagMonthsToAcutePain', 'caveat'
  ]));

  return { report, paths };
}
