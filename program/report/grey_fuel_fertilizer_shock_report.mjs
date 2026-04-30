// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';

function n(v, fallback = 0) { const x = Number(v); return Number.isFinite(x) ? x : fallback; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function esc(v) { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; }
function toCsv(rows, headers) { return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n'); }

function readJsonIfExists(filePath, warnings, label, fallback = null) {
  if (!fs.existsSync(filePath)) { warnings.push(`Missing ${label}: ${filePath}`); return fallback; }
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch (error) { warnings.push(`Failed to parse ${label}: ${filePath} (${error.message})`); return fallback; }
}

const SHOCK_SCENARIOS = [
  { scenario: 'baselinePresent', family: 'gradualDecline', fuelAvailabilityIndex: 1.00, fertilizerAvailabilityIndex: 1.00, adaptationLevel: 'none' },
  { scenario: 'decline5', family: 'gradualDecline', fuelAvailabilityIndex: 0.95, fertilizerAvailabilityIndex: 0.97, adaptationLevel: 'emergencyConservation' },
  { scenario: 'decline10', family: 'gradualDecline', fuelAvailabilityIndex: 0.90, fertilizerAvailabilityIndex: 0.94, adaptationLevel: 'emergencyConservation' },
  { scenario: 'decline15', family: 'gradualDecline', fuelAvailabilityIndex: 0.85, fertilizerAvailabilityIndex: 0.91, adaptationLevel: 'localizationPush' },
  { scenario: 'decline20', family: 'gradualDecline', fuelAvailabilityIndex: 0.80, fertilizerAvailabilityIndex: 0.88, adaptationLevel: 'localizationPush' },
  { scenario: 'decline30', family: 'gradualDecline', fuelAvailabilityIndex: 0.70, fertilizerAvailabilityIndex: 0.80, adaptationLevel: 'labourMobilization' },
  { scenario: 'decline40', family: 'gradualDecline', fuelAvailabilityIndex: 0.60, fertilizerAvailabilityIndex: 0.72, adaptationLevel: 'perennialTransition' },
  { scenario: 'decline60', family: 'gradualDecline', fuelAvailabilityIndex: 0.40, fertilizerAvailabilityIndex: 0.55, adaptationLevel: 'fullResiliencePackage' },

  { scenario: 'shock10', family: 'abruptShock', fuelAvailabilityIndex: 0.90, fertilizerAvailabilityIndex: 0.92, adaptationLevel: 'emergencyConservation' },
  { scenario: 'shock15', family: 'abruptShock', fuelAvailabilityIndex: 0.85, fertilizerAvailabilityIndex: 0.87, adaptationLevel: 'emergencyConservation' },
  { scenario: 'shock20', family: 'abruptShock', fuelAvailabilityIndex: 0.80, fertilizerAvailabilityIndex: 0.82, adaptationLevel: 'localizationPush' },
  { scenario: 'shock30', family: 'abruptShock', fuelAvailabilityIndex: 0.70, fertilizerAvailabilityIndex: 0.74, adaptationLevel: 'labourMobilization' },
  { scenario: 'shock40', family: 'abruptShock', fuelAvailabilityIndex: 0.60, fertilizerAvailabilityIndex: 0.66, adaptationLevel: 'perennialTransition' },

  { scenario: 'shock20_recoverTo10', family: 'abruptRecovery', fuelAvailabilityIndex: 0.90, fertilizerAvailabilityIndex: 0.90, adaptationLevel: 'localizationPush' },
  { scenario: 'shock30_recoverTo15', family: 'abruptRecovery', fuelAvailabilityIndex: 0.85, fertilizerAvailabilityIndex: 0.85, adaptationLevel: 'labourMobilization' },
  { scenario: 'shock40_recoverTo20', family: 'abruptRecovery', fuelAvailabilityIndex: 0.80, fertilizerAvailabilityIndex: 0.80, adaptationLevel: 'perennialTransition' },

  { scenario: 'fuel20_fertilizer10', family: 'combinedFuelFertilizerShock', fuelAvailabilityIndex: 0.80, fertilizerAvailabilityIndex: 0.90, adaptationLevel: 'localizationPush' },
  { scenario: 'fuel20_fertilizer20', family: 'combinedFuelFertilizerShock', fuelAvailabilityIndex: 0.80, fertilizerAvailabilityIndex: 0.80, adaptationLevel: 'labourMobilization' },
  { scenario: 'fuel30_fertilizer20', family: 'combinedFuelFertilizerShock', fuelAvailabilityIndex: 0.70, fertilizerAvailabilityIndex: 0.80, adaptationLevel: 'perennialTransition' },
  { scenario: 'fuel40_fertilizer30', family: 'combinedFuelFertilizerShock', fuelAvailabilityIndex: 0.60, fertilizerAvailabilityIndex: 0.70, adaptationLevel: 'fullResiliencePackage' }
];

const ADAPTATION_PACKAGES = [
  { adaptationPackage: 'none', foodBonus: 0, labourRelief: 0, transportRelief: 0, yearsToBenefit: 0, confidence: 'moderate' },
  { adaptationPackage: 'emergencyFuelConservation', foodBonus: 0.03, labourRelief: 0.02, transportRelief: 0.06, yearsToBenefit: 0.25, confidence: 'moderate' },
  { adaptationPackage: 'localDepotStoragePush', foodBonus: 0.07, labourRelief: 0.03, transportRelief: 0.12, yearsToBenefit: 0.75, confidence: 'low_to_moderate' },
  { adaptationPackage: 'gardenSmallholdingMobilization', foodBonus: 0.12, labourRelief: -0.04, transportRelief: 0.05, yearsToBenefit: 1.0, confidence: 'low_to_moderate' },
  { adaptationPackage: 'agLabourMobilization', foodBonus: 0.09, labourRelief: 0.10, transportRelief: 0.04, yearsToBenefit: 1.0, confidence: 'low' },
  { adaptationPackage: 'perennialStapleAcceleration', foodBonus: 0.15, labourRelief: 0.12, transportRelief: 0.03, yearsToBenefit: 3.0, confidence: 'low' },
  { adaptationPackage: 'combinedResiliencePackage', foodBonus: 0.24, labourRelief: 0.18, transportRelief: 0.15, yearsToBenefit: 2.0, confidence: 'low' }
];

function determineWarnings({ foodCoverage, labourGapFTE, currentAgIndustryFTEEstimate, labourMobilizationShareOfSubsistencePotentialPopulation, fertilizerAvailabilityIndex, transportFuelAvailabilityIndex, adaptationPackage, family }) {
  const warnings = [];
  if (foodCoverage < 0.75) warnings.push('food_coverage_below_0_75');
  if (foodCoverage < 0.5) warnings.push('food_coverage_below_0_50');
  if (labourGapFTE > currentAgIndustryFTEEstimate) warnings.push('labour_gap_above_current_ag_industry');
  if (labourMobilizationShareOfSubsistencePotentialPopulation > 1.0) warnings.push('labour_gap_above_subsistence_access_capacity');
  if (fertilizerAvailabilityIndex < 0.75) warnings.push('fertilizer_shock_high');
  if (transportFuelAvailabilityIndex < 0.75) warnings.push('transport_shock_high');
  if (adaptationPackage === 'perennialStapleAcceleration' || adaptationPackage === 'combinedResiliencePackage') warnings.push('adaptation_delay_warning');
  if (family === 'abruptShock' && foodCoverage < 0.65) warnings.push('abrupt_shock_exceeds_gradual_transition_capacity');
  return warnings;
}

function limitingFactorFromScores(scores) {
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'mixedConstraints';
}

export function buildGreyFuelFertilizerShockReport(options = {}) {
  const produceDir = path.resolve(options.produceDir ?? 'know/produce');
  fs.mkdirSync(produceDir, { recursive: true });
  const warnings = [];

  const foodCalibration = readJsonIfExists(path.join(produceDir, 'grey-food-calibration.json'), warnings, 'food calibration', {});
  const labourLand = readJsonIfExists(path.join(produceDir, 'grey-labour-land-baseline.json'), warnings, 'labour-land baseline', {});
  const agLabour = readJsonIfExists(path.join(produceDir, 'grey-ag-labour-baseline.json'), warnings, 'ag labour baseline', {});
  const dwelling = readJsonIfExists(path.join(produceDir, 'grey-dwelling-land-access.json'), warnings, 'dwelling land access baseline', {});
  const localization = readJsonIfExists(path.join(produceDir, 'grey-localization-access.json'), warnings, 'localization access baseline', {});

  const scenarios = foodCalibration.plausibilityScenarios ?? [];
  const presentIndustrial = scenarios.find((s) => s.scenario === 'presentIndustrialFossilBaseline') ?? {};
  const presentTech = scenarios.find((s) => s.scenario === 'localizedPresentTechBaseline') ?? {};
  const constrainedBaseline = scenarios.find((s) => s.scenario === 'constrainedLocalFoodBaseline') ?? {};

  const totalDemand = n(
    foodCalibration.totalFoodDemandGJ,
    n(foodCalibration.foodDemandBaseline?.totalFoodDemandGJ, 1)
  );
  const presentTechCoverage = n(presentTech.foodCoverage, 0.472);
  const constrainedCoverage = n(constrainedBaseline.foodCoverage, 0.277);
  const candidateFoodHaBase = n(presentTech.candidateFoodHa, n(foodCalibration.humanFoodPriorityHa, 18056.83));
  const netGJPerHaBase = n(presentTech.netGJPerHa, 10);
  const presentTechNetGJ = n(presentTech.netFoodEnergyGJ, presentTechCoverage * totalDemand);
  const constrainedNetGJ = n(constrainedBaseline.netFoodEnergyGJ, constrainedCoverage * totalDemand);
  const currentAgIndustryFTEEstimate = n(agLabour.currentAgIndustryFTEEstimate, 3918.43);
  const subsistencePopulation = n(dwelling.estimatedPopulationWithSubsistencePotential);
  const outsideSettlementPopulation = n(dwelling.outsideSettlementPopulation);
  const population = n(dwelling.totalPopulation, n(foodCalibration.population2021, 100905));
  const availableFoodWorkerFTE = n(labourLand.regionalIndicators?.availableFoodWorkerFTE, 0);
  const productiveHa = n(labourLand.regionalIndicators?.estimatedHumanFoodProducingHa, n(foodCalibration.humanFoodPriorityHa, 18056.83));
  const perennialLeverage = n((labourLand.productionSystemLeverage ?? []).find((x) => x.system === 'perennialStapleBulkLowCare')?.onLandManageableHaPerWorkerAtMaturity, 3.5);
  const railRelief = n(localization?.foodCalibrationContext?.localizedPresentTechBaselineCoverage, 0) > 0 ? 0.25 : 0.1;
  const animalRelief = n((labourLand.animalPowerScenarios ?? [])[0]?.animalPowerLeverageRatio, 0.1);

  const shockScenarios = SHOCK_SCENARIOS.map((base) => {
    const fuelDecline = 1 - base.fuelAvailabilityIndex;
    const fertDecline = 1 - base.fertilizerAvailabilityIndex;
    const transportFuelAvailabilityIndex = clamp(base.fuelAvailabilityIndex - 0.02, 0.2, 1);
    const dieselPriceMultiplier = 1 + (fuelDecline * 2.4);
    const fertilizerPriceMultiplier = 1 + (fertDecline * 2.8);
    const machinerySupportFactor = clamp(base.fuelAvailabilityIndex * 0.92, 0.2, 1);
    const inputConstraintFactor = clamp(0.55 * base.fuelAvailabilityIndex + 0.45 * base.fertilizerAvailabilityIndex, 0.2, 1);
    const fertilizerStress = 1 - base.fertilizerAvailabilityIndex;
    const inputCostStress = (dieselPriceMultiplier - 1) * 0.5 + (fertilizerPriceMultiplier - 1) * 0.5;
    const transportPenalty = clamp((1 - transportFuelAvailabilityIndex) * 0.35, 0, 0.3);
    const adaptationBaseline = ADAPTATION_PACKAGES.find((p) => p.adaptationPackage === ({
      none: 'none',
      emergencyConservation: 'emergencyFuelConservation',
      localizationPush: 'localDepotStoragePush',
      labourMobilization: 'agLabourMobilization',
      perennialTransition: 'perennialStapleAcceleration',
      fullResiliencePackage: 'combinedResiliencePackage'
    }[base.adaptationLevel] ?? 'none'));
    const adaptationFoodBonus = adaptationBaseline?.foodBonus ?? 0;
    const candidateFoodHa = candidateFoodHaBase * (1 - (fertilizerStress * 0.08) + adaptationFoodBonus * 0.2);
    const effectiveNetGJPerHa = netGJPerHaBase
      * (0.55 + 0.45 * machinerySupportFactor)
      * (0.5 + 0.5 * inputConstraintFactor)
      * (1 - transportPenalty)
      * (1 + adaptationFoodBonus);
    const netFoodEnergyGJ = Math.max(0, candidateFoodHa * effectiveNetGJPerHa);
    const foodCoverage = totalDemand > 0 ? netFoodEnergyGJ / totalDemand : 0;
    const foodSurplusGJ = netFoodEnergyGJ - totalDemand;
    const labourPenalty = clamp((1 - machinerySupportFactor) * 1.2 + (1 - inputConstraintFactor) * 0.4, 0, 1.5);
    const foodWorkersNeededFTE = Math.max(
      0,
      (productiveHa / Math.max(0.25, perennialLeverage)) * (1 + labourPenalty - (adaptationBaseline?.labourRelief ?? 0))
    );
    const addedFoodWorkersNeededVsCurrent = Math.max(0, foodWorkersNeededFTE - currentAgIndustryFTEEstimate);
    const agLabourScaleUpFactor = currentAgIndustryFTEEstimate > 0 ? foodWorkersNeededFTE / currentAgIndustryFTEEstimate : null;
    const labourGapFTE = Math.max(0, foodWorkersNeededFTE - availableFoodWorkerFTE);
    const addedWorkersPer1000Residents = population > 0 ? (addedFoodWorkersNeededVsCurrent / population) * 1000 : 0;
    const labourMobilizationShareOfSubsistencePotentialPopulation = subsistencePopulation > 0 ? addedFoodWorkersNeededVsCurrent / subsistencePopulation : null;
    const labourMobilizationShareOfOutsideSettlementPopulation = outsideSettlementPopulation > 0 ? addedFoodWorkersNeededVsCurrent / outsideSettlementPopulation : null;

    const limitingFactor = limitingFactorFromScores({
      fuel: fuelDecline,
      fertilizer: fertDecline * 1.1,
      transport: 1 - transportFuelAvailabilityIndex,
      labour: labourGapFTE > 0 ? labourGapFTE / Math.max(1, foodWorkersNeededFTE) : 0.05
    });

    const scenarioWarnings = determineWarnings({
      foodCoverage,
      labourGapFTE,
      currentAgIndustryFTEEstimate,
      labourMobilizationShareOfSubsistencePotentialPopulation: n(labourMobilizationShareOfSubsistencePotentialPopulation),
      fertilizerAvailabilityIndex: base.fertilizerAvailabilityIndex,
      transportFuelAvailabilityIndex,
      adaptationPackage: adaptationBaseline?.adaptationPackage ?? 'none',
      family: base.family
    });

    return {
      ...base,
      dieselPriceMultiplier,
      fertilizerPriceMultiplier,
      machinerySupportFactor,
      transportFuelAvailabilityIndex,
      inputConstraintFactor,
      effectiveNetGJPerHa,
      candidateFoodHa,
      netFoodEnergyGJ,
      foodCoverage,
      foodSurplusGJ,
      foodCoverageDeltaVsPresentTech: foodCoverage - presentTechCoverage,
      foodCoverageDeltaVsConstrainedBaseline: foodCoverage - constrainedCoverage,
      foodWorkersNeededFTE,
      addedFoodWorkersNeededVsCurrent,
      agLabourScaleUpFactor,
      addedWorkersPer1000Residents,
      labourMobilizationShareOfSubsistencePotentialPopulation,
      labourMobilizationShareOfOutsideSettlementPopulation,
      labourGapFTE,
      fertilizerStress,
      nitrogenInputStress: fertilizerStress * 0.9,
      inputCostStress,
      lowInputTransitionNeed: clamp(fertilizerStress + fuelDecline * 0.5, 0, 1),
      compostManureNutrientGapProxy: clamp(fertilizerStress * 0.7, 0, 1),
      perennialLowInputOffsetPotential: clamp(adaptationFoodBonus + (1 - inputConstraintFactor) * 0.3, 0, 1),
      transportDieselDeficitLitre: Math.max(0, (1 - transportFuelAvailabilityIndex) * 10_000_000),
      localFreightStress: clamp((1 - transportFuelAvailabilityIndex) * 1.1, 0, 1),
      marketHaulingStress: clamp((1 - transportFuelAvailabilityIndex) * 1.2, 0, 1),
      depotNeedIndex: clamp((1 - transportFuelAvailabilityIndex) * 0.6 + (1 - foodCoverage) * 0.3, 0, 1),
      railFreightReliefPotential: railRelief,
      animalPowerHeavyWorkReliefPotential: clamp(animalRelief, 0, 1),
      limitingFactor,
      warnings: scenarioWarnings
    };
  });

  const adaptationComparisons = [];
  for (const baseScenario of shockScenarios.filter((s) => ['shock20', 'shock30', 'fuel20_fertilizer20'].includes(s.scenario))) {
    for (const pkg of ADAPTATION_PACKAGES) {
      const coverage = clamp(baseScenario.foodCoverage * (1 + pkg.foodBonus), 0, 5);
      const workersNeeded = Math.max(0, baseScenario.foodWorkersNeededFTE * (1 - pkg.labourRelief));
      const addedWorkers = Math.max(0, workersNeeded - currentAgIndustryFTEEstimate);
      const labourGapFTE = Math.max(0, workersNeeded - availableFoodWorkerFTE);
      adaptationComparisons.push({
        scenario: baseScenario.scenario,
        adaptationPackage: pkg.adaptationPackage,
        foodCoverage: coverage,
        labourGapFTE,
        requiredNewFoodWorkers: addedWorkers,
        demandOnSubsistenceAccessPopulation: subsistencePopulation > 0 ? addedWorkers / subsistencePopulation : null,
        yearsToBenefit: pkg.yearsToBenefit,
        confidence: pkg.confidence
      });
    }
  }

  const shock20 = shockScenarios.find((s) => s.scenario === 'shock20') ?? null;
  const shock20Combined = adaptationComparisons.find((r) => r.scenario === 'shock20' && r.adaptationPackage === 'combinedResiliencePackage') ?? null;

  const report = {
    generatedAt: new Date().toISOString(),
    baselineAssumptions: {
      presentIndustrialFossilBaselineCoverage: n(presentIndustrial.foodCoverage),
      localizedPresentTechBaselineCoverage: presentTechCoverage,
      constrainedLocalFoodBaselineCoverage: constrainedCoverage,
      totalFoodDemandGJ: totalDemand,
      currentAgIndustryFTEEstimate,
      currentAgLabourBasis: currentAgIndustryFTEEstimate > 0 ? 'industryProxy' : 'broadProxy',
      estimatedPopulationWithSubsistencePotential: subsistencePopulation,
      outsideSettlementPopulation
    },
    scenarioFamilies: {
      gradualDecline: SHOCK_SCENARIOS.filter((x) => x.family === 'gradualDecline').map((x) => x.scenario),
      abruptShock: SHOCK_SCENARIOS.filter((x) => x.family === 'abruptShock').map((x) => x.scenario),
      abruptRecovery: SHOCK_SCENARIOS.filter((x) => x.family === 'abruptRecovery').map((x) => x.scenario),
      combinedFuelFertilizerShock: SHOCK_SCENARIOS.filter((x) => x.family === 'combinedFuelFertilizerShock').map((x) => x.scenario)
    },
    shockScenarios,
    adaptationComparisons,
    labourMobilizationDiagnostics: shockScenarios.map((s) => ({
      scenario: s.scenario,
      currentAgIndustryFTEEstimate,
      foodWorkersNeededFTE: s.foodWorkersNeededFTE,
      addedFoodWorkersNeeded: s.addedFoodWorkersNeededVsCurrent,
      labourGapFTE: s.labourGapFTE,
      addedWorkersPer1000Residents: s.addedWorkersPer1000Residents,
      labourMobilizationShareOfSubsistencePotentialPopulation: s.labourMobilizationShareOfSubsistencePotentialPopulation,
      labourMobilizationShareOfOutsideSettlementPopulation: s.labourMobilizationShareOfOutsideSettlementPopulation,
      confidence: s.adaptationLevel === 'none' ? 'moderate' : 'low_to_moderate'
    })),
    thresholdWarnings: Array.from(new Set(shockScenarios.flatMap((s) => s.warnings))),
    keyResults: {
      shock20FoodCoverage: n(shock20?.foodCoverage),
      shock20AddedFoodWorkersNeeded: n(shock20?.addedFoodWorkersNeededVsCurrent),
      shock20AgLabourScaleUpFactor: n(shock20?.agLabourScaleUpFactor),
      shock20CombinedResiliencePackageFoodCoverage: n(shock20Combined?.foodCoverage)
    },
    caveats: [
      'not a fuel price forecast',
      'not a fertilizer nutrient budget',
      'not an official food forecast',
      'scenario diagnostic only',
      'price response, rationing, imports, exports, debt, and policy are not fully modelled'
    ],
    warnings
  };

  const scenarioCsvRows = shockScenarios.map((s) => ({
    scenario: s.scenario,
    family: s.family,
    fuelAvailabilityIndex: s.fuelAvailabilityIndex,
    dieselPriceMultiplier: s.dieselPriceMultiplier,
    fertilizerAvailabilityIndex: s.fertilizerAvailabilityIndex,
    fertilizerPriceMultiplier: s.fertilizerPriceMultiplier,
    machinerySupportFactor: s.machinerySupportFactor,
    inputConstraintFactor: s.inputConstraintFactor,
    foodCoverage: s.foodCoverage,
    foodSurplusGJ: s.foodSurplusGJ,
    foodWorkersNeededFTE: s.foodWorkersNeededFTE,
    addedFoodWorkersNeededVsCurrent: s.addedFoodWorkersNeededVsCurrent,
    agLabourScaleUpFactor: s.agLabourScaleUpFactor,
    limitingFactor: s.limitingFactor,
    warnings: s.warnings.join('|')
  }));

  const labourCsvRows = adaptationComparisons.map((r) => ({
    scenario: r.scenario,
    adaptationPackage: r.adaptationPackage,
    currentAgIndustryFTEEstimate,
    foodWorkersNeededFTE: r.requiredNewFoodWorkers + currentAgIndustryFTEEstimate,
    addedFoodWorkersNeeded: r.requiredNewFoodWorkers,
    labourGapFTE: r.labourGapFTE,
    addedWorkersPer1000Residents: population > 0 ? (r.requiredNewFoodWorkers / population) * 1000 : 0,
    labourMobilizationShareOfSubsistencePotentialPopulation: r.demandOnSubsistenceAccessPopulation,
    labourMobilizationShareOfOutsideSettlementPopulation: outsideSettlementPopulation > 0 ? r.requiredNewFoodWorkers / outsideSettlementPopulation : null,
    confidence: r.confidence
  }));

  const markdown = [
    '# Grey Fuel and Fertilizer Shock Gradation Report',
    '',
    '## What this is',
    'Scenario diagnostics for gradual and abrupt fuel/fertilizer/input shocks and adaptation responses.',
    '',
    '## Why gradation matters',
    'Real shocks are not all-or-nothing. A 10-20% shock can arrive abruptly, while longer decline may unfold over years.',
    '',
    '## Baseline assumptions',
    `- localizedPresentTechBaseline foodCoverage: ${presentTechCoverage.toFixed(3)}`,
    `- constrainedLocalFoodBaseline foodCoverage: ${constrainedCoverage.toFixed(3)}`,
    `- total food demand GJ: ${totalDemand.toFixed(2)}`,
    `- currentAgIndustryFTEEstimate: ${currentAgIndustryFTEEstimate.toFixed(2)}`,
    '',
    '## Shock scenario table',
    '| Scenario | Fuel availability | Fertilizer availability | Food coverage | Food surplus/deficit GJ | Food workers needed | Added workers | Scale-up factor | Main constraint |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---|',
    ...shockScenarios.map((s) => `| ${s.scenario} | ${s.fuelAvailabilityIndex.toFixed(2)} | ${s.fertilizerAvailabilityIndex.toFixed(2)} | ${s.foodCoverage.toFixed(3)} | ${s.foodSurplusGJ.toFixed(2)} | ${s.foodWorkersNeededFTE.toFixed(2)} | ${s.addedFoodWorkersNeededVsCurrent.toFixed(2)} | ${(s.agLabourScaleUpFactor ?? 0).toFixed(2)} | ${s.limitingFactor} |`),
    '',
    '## Adaptation package comparison',
    '| Scenario | Adaptation package | Food coverage | Labour gap FTE | Required new workers | Demand on subsistence-access population | Years to benefit |',
    '|---|---|---:|---:|---:|---:|---:|',
    ...adaptationComparisons.map((r) => `| ${r.scenario} | ${r.adaptationPackage} | ${r.foodCoverage.toFixed(3)} | ${r.labourGapFTE.toFixed(2)} | ${r.requiredNewFoodWorkers.toFixed(2)} | ${(n(r.demandOnSubsistenceAccessPopulation) * 100).toFixed(2)}% | ${r.yearsToBenefit.toFixed(2)} |`),
    '',
    '## Labour mobilization requirement',
    `- current ag industry FTE: ${currentAgIndustryFTEEstimate.toFixed(2)}`,
    `- shock20 food workers needed: ${n(shock20?.foodWorkersNeededFTE).toFixed(2)}`,
    `- shock20 added workers needed: ${n(shock20?.addedFoodWorkersNeededVsCurrent).toFixed(2)}`,
    `- shock20 share of subsistence-potential population: ${(n(shock20?.labourMobilizationShareOfSubsistencePotentialPopulation) * 100).toFixed(2)}%`,
    '',
    '## What changes fastest',
    '- Under abrupt shocks, fertilizer/input stress and labour mobilization needs rise first.',
    '- Under deeper decline, transport logistics and storage/depot constraints become co-binding.',
    '',
    '## Caveats',
    ...report.caveats.map((c) => `- ${c}`)
  ].join('\n');

  const jsonPath = path.join(produceDir, 'grey-fuel-fertilizer-shock.json');
  const mdPath = path.join(produceDir, 'grey-fuel-fertilizer-shock.md');
  const scenariosCsvPath = path.join(produceDir, 'grey-fuel-fertilizer-shock-scenarios.csv');
  const labourCsvPath = path.join(produceDir, 'grey-fuel-fertilizer-shock-labour.csv');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(mdPath, markdown);
  fs.writeFileSync(
    scenariosCsvPath,
    toCsv(scenarioCsvRows, [
      'scenario', 'family', 'fuelAvailabilityIndex', 'dieselPriceMultiplier', 'fertilizerAvailabilityIndex', 'fertilizerPriceMultiplier',
      'machinerySupportFactor', 'inputConstraintFactor', 'foodCoverage', 'foodSurplusGJ',
      'foodWorkersNeededFTE', 'addedFoodWorkersNeededVsCurrent', 'agLabourScaleUpFactor', 'limitingFactor', 'warnings'
    ])
  );
  fs.writeFileSync(
    labourCsvPath,
    toCsv(labourCsvRows, [
      'scenario', 'adaptationPackage', 'currentAgIndustryFTEEstimate', 'foodWorkersNeededFTE',
      'addedFoodWorkersNeeded', 'labourGapFTE', 'addedWorkersPer1000Residents',
      'labourMobilizationShareOfSubsistencePotentialPopulation',
      'labourMobilizationShareOfOutsideSettlementPopulation', 'confidence'
    ])
  );

  return {
    report,
    paths: { jsonPath, markdownPath: mdPath, scenariosCsvPath, labourCsvPath }
  };
}
