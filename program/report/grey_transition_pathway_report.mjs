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

const DECLINE_PATHS = {
  baselineNoShock: { 2025: 1.00, 2030: 0.95, 2040: 0.85, 2050: 0.75 },
  moderateDecline: { 2025: 1.00, 2030: 0.90, 2040: 0.75, 2050: 0.60 },
  severeDecline: { 2025: 1.00, 2030: 0.80, 2040: 0.60, 2050: 0.40 },
  abruptShock20: { 2025: 1.00, 2026: 0.80, 2030: 0.78, 2040: 0.65, 2050: 0.50 },
  shock20PartialRecovery: { 2025: 1.00, 2026: 0.80, 2028: 0.90, 2035: 0.78, 2050: 0.55 }
};

const ADAPTATION_PATHWAYS = {
  noChange: {
    yearsToBenefit: 0,
    immediateBenefit: 0,
    longTermBenefit: 0.02,
    foodCoverageBoost: 0,
    labourMobilizationCapacity: 0.05,
    lossReduction: 0.00,
    localProcessingBoost: 0.00,
    importDependencyReduction: 0.00,
    householdStressReduction: 0.00,
    qualityOfLifeBoost: 0.00
  },
  emergencyReaction: {
    yearsToBenefit: 0.5,
    immediateBenefit: 0.08,
    longTermBenefit: 0.10,
    foodCoverageBoost: 0.08,
    labourMobilizationCapacity: 0.10,
    lossReduction: 0.05,
    localProcessingBoost: 0.03,
    importDependencyReduction: 0.04,
    householdStressReduction: 0.08,
    qualityOfLifeBoost: 0.03
  },
  moderateAdaptation: {
    yearsToBenefit: 1.0,
    immediateBenefit: 0.10,
    longTermBenefit: 0.18,
    foodCoverageBoost: 0.14,
    labourMobilizationCapacity: 0.22,
    lossReduction: 0.10,
    localProcessingBoost: 0.12,
    importDependencyReduction: 0.10,
    householdStressReduction: 0.12,
    qualityOfLifeBoost: 0.10
  },
  strongAdaptation: {
    yearsToBenefit: 2.0,
    immediateBenefit: 0.10,
    longTermBenefit: 0.28,
    foodCoverageBoost: 0.20,
    labourMobilizationCapacity: 0.35,
    lossReduction: 0.16,
    localProcessingBoost: 0.20,
    importDependencyReduction: 0.18,
    householdStressReduction: 0.18,
    qualityOfLifeBoost: 0.18
  },
  fullRuralTransition: {
    yearsToBenefit: 3.0,
    immediateBenefit: 0.07,
    longTermBenefit: 0.40,
    foodCoverageBoost: 0.30,
    labourMobilizationCapacity: 0.55,
    lossReduction: 0.22,
    localProcessingBoost: 0.30,
    importDependencyReduction: 0.30,
    householdStressReduction: 0.24,
    qualityOfLifeBoost: 0.28
  }
};

const YEARS = [2025, 2026, 2028, 2030, 2035, 2040, 2050];

function interpolatePath(pathDef, year) {
  const keys = Object.keys(pathDef).map(Number).sort((a, b) => a - b);
  if (year <= keys[0]) return pathDef[keys[0]];
  if (year >= keys[keys.length - 1]) return pathDef[keys[keys.length - 1]];
  for (let i = 0; i < keys.length - 1; i += 1) {
    const a = keys[i];
    const b = keys[i + 1];
    if (year >= a && year <= b) {
      const t = (year - a) / (b - a);
      return pathDef[a] + (pathDef[b] - pathDef[a]) * t;
    }
  }
  return pathDef[keys[keys.length - 1]];
}

function adaptationProgress(year, yearsToBenefit) {
  if (yearsToBenefit <= 0) return 1;
  const dt = year - 2025;
  return clamp(dt / Math.max(1, yearsToBenefit * 5), 0, 1);
}

function mainBottleneck({ foodCoverage, labourGapFTE, transportFuelStress, fertilizerStress }) {
  const scores = {
    food: clamp(1 - foodCoverage, 0, 1),
    labour: clamp(labourGapFTE / 50000, 0, 1),
    transport: clamp(transportFuelStress, 0, 1),
    fertilizer: clamp(fertilizerStress, 0, 1)
  };
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'mixed';
}

export function buildGreyTransitionPathwayReport(options = {}) {
  const produceDir = path.resolve(options.produceDir ?? 'know/produce');
  fs.mkdirSync(produceDir, { recursive: true });
  const warnings = [];

  const fuelShock = readJsonIfExists(path.join(produceDir, 'grey-fuel-fertilizer-shock.json'), warnings, 'fuel shock report', {});
  const foodCalibration = readJsonIfExists(path.join(produceDir, 'grey-food-calibration.json'), warnings, 'food calibration', {});
  const labourLand = readJsonIfExists(path.join(produceDir, 'grey-labour-land-baseline.json'), warnings, 'labour-land baseline', {});
  const agLabour = readJsonIfExists(path.join(produceDir, 'grey-ag-labour-baseline.json'), warnings, 'ag-labour baseline', {});
  const dwelling = readJsonIfExists(path.join(produceDir, 'grey-dwelling-land-access.json'), warnings, 'dwelling-land-access baseline', {});
  const localization = readJsonIfExists(path.join(produceDir, 'grey-localization-access.json'), warnings, 'localization-access baseline', {});

  const presentTech = (foodCalibration.plausibilityScenarios ?? []).find((x) => x.scenario === 'localizedPresentTechBaseline') ?? {};
  const constrained = (foodCalibration.plausibilityScenarios ?? []).find((x) => x.scenario === 'constrainedLocalFoodBaseline') ?? {};

  const baseCoverage = n(presentTech.foodCoverage, 0.472);
  const constrainedCoverage = n(constrained.foodCoverage, 0.277);
  const totalDemandGJ = n(foodCalibration.foodDemandBaseline?.totalFoodDemandGJ, 379967.87);
  const currentAgIndustryFTEEstimate = n(agLabour.currentAgIndustryFTEEstimate, 3918.43);
  const population = n(dwelling.totalPopulation, 100905);
  const outsideSettlementPopulation = n(dwelling.outsideSettlementPopulation, 51023);
  const subsistencePotentialPopulation = n(dwelling.estimatedPopulationWithSubsistencePotential, 54949);
  const noDirectLandAccessPopulation = n(dwelling.estimatedPopulationNoDirectLandAccess, 7990);
  const currentFoodInsecurityShare = n(options.currentFoodInsecurityShare, 0.25);

  const baselineUrbanHousingStress = n(options.baselineUrbanHousingStress, 0.62);
  const baselineUrbanIsolationStress = n(options.baselineUrbanIsolationStress, 0.48);
  const baselineUrbanAddictionCrisisExposure = n(options.baselineUrbanAddictionCrisisExposure, 0.35);
  const baselineUrbanCrimeStress = n(options.baselineUrbanCrimeStress, 0.28);
  const baselineUrbanFoodInsecurityStress = n(options.baselineUrbanFoodInsecurityStress, 0.30);
  const baselineMeaningfulWorkDeficit = n(options.baselineMeaningfulWorkDeficit, 0.42);

  const depotBase = n(localization.regionalSummary?.localizationInfrastructureGaps?.length, 6) / 10;

  const scenarioRows = [];
  const timelineRows = [];
  const humanImpactRows = [];

  for (const [declinePath, pathDef] of Object.entries(DECLINE_PATHS)) {
    for (const [adaptationPathway, cfg] of Object.entries(ADAPTATION_PATHWAYS)) {
      for (const year of YEARS) {
        const fuelAvailabilityIndex = interpolatePath(pathDef, year);
        const fertilizerAvailabilityIndex = clamp(fuelAvailabilityIndex + 0.05, 0.25, 1);
        const declineDepth = 1 - fuelAvailabilityIndex;
        const fertilizerStress = 1 - fertilizerAvailabilityIndex;
        const transportFuelStress = clamp(declineDepth * 1.15, 0, 1);
        const prog = adaptationProgress(year, cfg.yearsToBenefit);
        const adaptEffect = cfg.immediateBenefit * clamp((year - 2025) / 2, 0, 1) + cfg.longTermBenefit * prog;
        const perennialDelayPenalty = adaptationPathway === 'fullRuralTransition' ? clamp((2030 - year) / 10, 0, 0.12) : 0;

        const foodCoverage = clamp(
          baseCoverage
          * (0.55 + 0.45 * fuelAvailabilityIndex)
          * (0.6 + 0.4 * fertilizerAvailabilityIndex)
          * (1 - 0.25 * transportFuelStress)
          * (1 + cfg.foodCoverageBoost * prog)
          + adaptEffect
          - perennialDelayPenalty,
          0.05,
          2.5
        );

        const foodSurplusGJ = (foodCoverage - 1) * totalDemandGJ;
        const foodGapGJ = Math.max(0, -foodSurplusGJ);
        const additionalFoodAidNeedGJ = foodGapGJ * (1 - cfg.lossReduction * prog);

        const requiredFTEBase = n((fuelShock.shockScenarios ?? []).find((x) => x.scenario === 'shock20')?.foodWorkersNeededFTE, 30849);
        const foodWorkersNeededFTE = Math.max(
          0,
          requiredFTEBase
            * (0.55 + 0.45 * (1 / Math.max(0.35, fuelAvailabilityIndex)))
            * (0.7 + 0.3 * (1 / Math.max(0.4, fertilizerAvailabilityIndex)))
            * (1 - cfg.labourMobilizationCapacity * prog * 0.4)
        );
        const addedFoodWorkersNeeded = Math.max(0, foodWorkersNeededFTE - currentAgIndustryFTEEstimate);
        const labourMobilizationCapacityPeople = subsistencePotentialPopulation * cfg.labourMobilizationCapacity * clamp(prog + 0.25, 0, 1);
        const labourGapFTE = Math.max(0, addedFoodWorkersNeeded - labourMobilizationCapacityPeople);
        const agLabourScaleUpFactor = currentAgIndustryFTEEstimate > 0 ? foodWorkersNeededFTE / currentAgIndustryFTEEstimate : null;
        const shareOfSubsistencePotentialPopulationMobilized = subsistencePotentialPopulation > 0 ? addedFoodWorkersNeeded / subsistencePotentialPopulation : null;

        const householdFoodCostBurdenIndex = clamp(
          baselineUrbanFoodInsecurityStress + (1 - foodCoverage) * 0.6 + transportFuelStress * 0.2 - cfg.householdStressReduction * prog,
          0, 1
        );
        const housingStressIndex = clamp(
          Math.max(baselineUrbanHousingStress, n(labourLand.regionalIndicators?.housingStressIndex, 0.45)) + declineDepth * 0.1 - cfg.householdStressReduction * 0.25 * prog,
          0, 1
        );
        const foodStressIndex = clamp((1 - foodCoverage) * 0.9 + householdFoodCostBurdenIndex * 0.4, 0, 1);
        const socialParticipationIndex = clamp(0.45 + cfg.qualityOfLifeBoost * 0.7 * prog + cfg.labourMobilizationCapacity * 0.2 * prog - baselineUrbanIsolationStress * 0.15 - declineDepth * 0.1, 0, 1);
        const localResilienceIndex = clamp(0.25 + cfg.localProcessingBoost * prog + cfg.importDependencyReduction * prog + cfg.lossReduction * prog - declineDepth * 0.15, 0, 1);

        const materialComfortIndex = clamp(0.78 - declineDepth * 0.5 + cfg.householdStressReduction * 0.25 * prog, 0, 1);
        const foodSecurityIndex = clamp(foodCoverage / 1.05, 0, 1);
        const housingSecurityIndex = clamp(1 - housingStressIndex * 0.9, 0, 1);
        const transportAccessIndex = clamp(0.82 - transportFuelStress * 0.45 + cfg.localProcessingBoost * 0.15 * prog, 0, 1);
        const healthServiceAccessIndex = clamp(0.74 - declineDepth * 0.22 + cfg.localProcessingBoost * 0.06 * prog, 0, 1);
        const meaningfulWorkIndex = clamp(0.42 + cfg.labourMobilizationCapacity * 0.5 * prog + cfg.qualityOfLifeBoost * 0.25 * prog - baselineMeaningfulWorkDeficit * 0.25, 0, 1);
        const safetyStabilityIndex = clamp(0.62 + cfg.householdStressReduction * 0.25 * prog + cfg.importDependencyReduction * 0.2 * prog - baselineUrbanCrimeStress * 0.2 - declineDepth * 0.15, 0, 1);
        const urbanCrisisExposureReductionIndex = clamp(
          0.18 + cfg.qualityOfLifeBoost * 0.45 * prog + cfg.importDependencyReduction * 0.25 * prog
          - baselineUrbanAddictionCrisisExposure * 0.1
          - baselineUrbanIsolationStress * 0.08,
          0, 1
        );
        const physicalLabourBurdenIndex = clamp(0.2 + declineDepth * 0.4 + (addedFoodWorkersNeeded / Math.max(1, population)) * 1.6 - cfg.labourMobilizationCapacity * 0.18 * prog, 0, 1);
        const transitionStressIndex = clamp(0.22 + declineDepth * 0.3 + (adaptationPathway === 'fullRuralTransition' ? 0.12 : 0.06) - cfg.householdStressReduction * 0.22 * prog, 0, 1);

        const householdStressIndex = clamp(
          foodStressIndex * 0.33
          + (1 - housingSecurityIndex) * 0.20
          + (1 - transportAccessIndex) * 0.13
          + physicalLabourBurdenIndex * 0.18
          + transitionStressIndex * 0.16,
          0, 1
        );

        const qolRawBase = clamp(
          materialComfortIndex * 0.10
          + foodSecurityIndex * 0.14
          + housingSecurityIndex * 0.12
          + transportAccessIndex * 0.08
          + healthServiceAccessIndex * 0.08
          + socialParticipationIndex * 0.12
          + meaningfulWorkIndex * 0.12
          + localResilienceIndex * 0.11
          + safetyStabilityIndex * 0.08
          + urbanCrisisExposureReductionIndex * 0.08
          - physicalLabourBurdenIndex * 0.04
          - transitionStressIndex * 0.04,
          0, 1
        );
        const transitionWellbeingBonus = clamp(
          cfg.qualityOfLifeBoost * prog * 0.45
          + cfg.importDependencyReduction * prog * 0.18
          + socialParticipationIndex * 0.08
          + meaningfulWorkIndex * 0.08
          + urbanCrisisExposureReductionIndex * 0.12
          - transitionStressIndex * 0.05,
          0, 0.32
        );
        const qolRaw = clamp(qolRawBase + transitionWellbeingBonus, 0, 1);
        const maxQualityOfLifeUnderDecline = clamp(0.90 - declineDepth * 0.05, 0.82, 0.90);
        const qualityOfLifeIndex = clamp(Math.min(qolRaw, maxQualityOfLifeUnderDecline), 0, 1);

        const adaptationFoodAidOffset = cfg.lossReduction * prog * 0.15;
        const localStorageProcessingOffset = cfg.localProcessingBoost * prog * 0.12;
        const foodStressRiskShare = clamp(
          currentFoodInsecurityShare
          + (1 - foodCoverage) * 0.75
          + householdFoodCostBurdenIndex * 0.33
          + transportFuelStress * 0.20
          + (noDirectLandAccessPopulation / Math.max(1, population)) * 0.24
          - adaptationFoodAidOffset
          - localStorageProcessingOffset,
          0.08,
          0.98
        );
        const foodInsecurityRiskShare = clamp(
          currentFoodInsecurityShare
          + (1 - foodCoverage) * 0.45
          + householdFoodCostBurdenIndex * 0.18
          + transportFuelStress * 0.10
          + (noDirectLandAccessPopulation / Math.max(1, population)) * 0.12
          - adaptationFoodAidOffset * 0.9
          - localStorageProcessingOffset * 0.9,
          0.05,
          0.95
        );
        const severeFoodStressShare = clamp(foodInsecurityRiskShare * 0.33 + Math.max(0, (1 - foodCoverage) * 0.20), 0.01, 0.65);
        const foodStressRiskPopulation = foodStressRiskShare * population;
        const foodInsecurityRiskExposurePopulation = foodInsecurityRiskShare * population;
        const severeFoodStressPopulation = severeFoodStressShare * population;
        const highStressPopulation = householdStressIndex * population * 0.7;
        const severeStressPopulation = householdStressIndex * population * 0.35;

        const importDependencyIndex = clamp(0.8 - cfg.importDependencyReduction * prog + (1 - foodCoverage) * 0.2, 0, 1);
        const localFoodEconomyRetentionIndex = clamp(0.2 + cfg.localProcessingBoost * prog + cfg.foodCoverageBoost * prog * 0.35 - declineDepth * 0.05, 0, 1);
        const localProcessingNeedIndex = clamp(depotBase + (1 - foodCoverage) * 0.4 - cfg.localProcessingBoost * prog * 0.5, 0, 1);
        const roadTransportDependencyIndex = clamp(0.9 - cfg.importDependencyReduction * prog * 0.35 + transportFuelStress * 0.08, 0, 1);
        const communityResilienceScore = clamp(localResilienceIndex * 0.65 + socialParticipationIndex * 0.35, 0, 1);

        const depotNeedIndex = clamp((1 - foodCoverage) * 0.5 + transportFuelStress * 0.3 - cfg.localProcessingBoost * prog * 0.3, 0, 1);
        const storageProcessingNeedIndex = clamp((1 - foodCoverage) * 0.45 + foodGapGJ / Math.max(1, totalDemandGJ) * 0.25 - cfg.lossReduction * prog * 0.3, 0, 1);
        const toolLibraryNeedIndex = clamp(declineDepth * 0.35 + addedFoodWorkersNeeded / Math.max(1, population) * 5, 0, 1);
        const landAccessProgrammeNeedIndex = clamp(shareOfSubsistencePotentialPopulationMobilized ?? 0, 0, 1);
        const trainingNeedIndex = clamp((addedFoodWorkersNeeded / Math.max(1, population)) * 8 + (1 - cfg.labourMobilizationCapacity) * 0.3, 0, 1);

        const warningsRow = [];
        if (foodCoverage < 0.75) warningsRow.push('food_coverage_below_0_75');
        if (foodCoverage < 0.50) warningsRow.push('food_coverage_below_0_50');
        if (labourGapFTE > currentAgIndustryFTEEstimate) warningsRow.push('labour_gap_above_current_ag_industry');
        if ((shareOfSubsistencePotentialPopulationMobilized ?? 0) > 1.0) warningsRow.push('labour_gap_above_subsistence_access_capacity');
        if (fertilizerStress > 0.3) warningsRow.push('fertilizer_shock_high');
        if (transportFuelStress > 0.35) warningsRow.push('transport_shock_high');
        if (adaptationPathway === 'fullRuralTransition' || adaptationPathway === 'strongAdaptation') warningsRow.push('adaptation_delay_warning');
        if (declinePath.includes('abrupt') && year <= 2030 && householdStressIndex > 0.65) warningsRow.push('abrupt_shock_exceeds_gradual_transition_capacity');

        const row = {
          declinePath,
          adaptationPathway,
          year,
          fuelAvailabilityIndex,
          fertilizerAvailabilityIndex,
          foodCoverage,
          foodSurplusGJ,
          foodGapGJ,
          additionalFoodAidNeedGJ,
          foodStressRiskPopulation,
          foodInsecurityRiskExposurePopulation,
          foodInsecureRiskPopulationEstimate: foodInsecurityRiskExposurePopulation,
          severeFoodStressPopulation,
          foodWorkersNeededFTE,
          currentAgIndustryFTEEstimate,
          addedFoodWorkersNeeded,
          labourGapFTE,
          agLabourScaleUpFactor,
          shareOfSubsistencePotentialPopulationMobilized,
          labourMobilizationShareOfOutsideSettlementPopulation: outsideSettlementPopulation > 0 ? addedFoodWorkersNeeded / outsideSettlementPopulation : null,
          householdFoodCostBurdenIndex,
          transportFuelStress,
          heatingEnergyStress: clamp(declineDepth * 0.45 - cfg.householdStressReduction * prog * 0.1, 0, 1),
          householdStressIndex,
          highStressPopulation,
          severeStressPopulation,
          materialComfortIndex,
          foodSecurityIndex,
          housingSecurityIndex,
          transportAccessIndex,
          healthServiceAccessIndex,
          socialParticipationIndex,
          meaningfulWorkIndex,
          safetyStabilityIndex,
          urbanCrisisExposureReductionIndex,
          physicalLabourBurdenIndex,
          transitionStressIndex,
          maxQualityOfLifeUnderDecline,
          localFoodEconomyRetentionIndex,
          importDependencyIndex,
          localProcessingNeedIndex,
          roadTransportDependencyIndex,
          communityResilienceScore,
          qualityOfLifeIndex,
          depotNeedIndex,
          storageProcessingNeedIndex,
          toolLibraryNeedIndex,
          landAccessProgrammeNeedIndex,
          trainingNeedIndex,
          localResilienceIndex,
          mainBottleneck: mainBottleneck({ foodCoverage, labourGapFTE, transportFuelStress, fertilizerStress }),
          warnings: warningsRow.join('|')
        };
        scenarioRows.push(row);
        timelineRows.push({
          declinePath,
          adaptationPathway,
          year,
          foodCoverage,
          foodInsecurityRiskExposurePopulation,
          addedFoodWorkersNeeded,
          qualityOfLifeIndex,
          localResilienceIndex
        });
      }

      const y2030 = scenarioRows.find((r) => r.declinePath === declinePath && r.adaptationPathway === adaptationPathway && r.year === 2030);
      const y2050 = scenarioRows.find((r) => r.declinePath === declinePath && r.adaptationPathway === adaptationPathway && r.year === 2050);
      const y2050NoChange = scenarioRows.find((r) => r.declinePath === declinePath && r.adaptationPathway === 'noChange' && r.year === 2050);

      humanImpactRows.push({
        declinePath,
        adaptationPathway,
        foodInsecureRiskPopulation2030: n(y2030?.foodInsecurityRiskExposurePopulation),
        severeFoodStressPopulation2030: n(y2030?.severeFoodStressPopulation),
        highStressPopulation2030: n(y2030?.highStressPopulation),
        foodInsecureRiskPopulation2050: n(y2050?.foodInsecurityRiskExposurePopulation),
        severeFoodStressPopulation2050: n(y2050?.severeFoodStressPopulation),
        highStressPopulation2050: n(y2050?.highStressPopulation),
        avoidedFoodInsecureRiskVsNoChange: Math.max(0, n(y2050NoChange?.foodInsecurityRiskExposurePopulation) - n(y2050?.foodInsecurityRiskExposurePopulation)),
        avoidedSevereStressVsNoChange: Math.max(0, n(y2050NoChange?.severeStressPopulation) - n(y2050?.severeStressPopulation))
      });
    }
  }

  const scenarioMatrix = Object.keys(DECLINE_PATHS).flatMap((declinePath) => Object.keys(ADAPTATION_PATHWAYS).map((adaptationPathway) => {
    const y2030 = scenarioRows.find((r) => r.declinePath === declinePath && r.adaptationPathway === adaptationPathway && r.year === 2030);
    const y2050 = scenarioRows.find((r) => r.declinePath === declinePath && r.adaptationPathway === adaptationPathway && r.year === 2050);
    return {
      declinePath,
      adaptationPathway,
      foodCoverage2030: n(y2030?.foodCoverage),
      foodInsecureRiskPopulation2030: n(y2030?.foodInsecurityRiskExposurePopulation),
      labourGapFTE2030: n(y2030?.labourGapFTE),
      qualityOfLife2050: n(y2050?.qualityOfLifeIndex),
      mainBottleneck: y2050?.mainBottleneck ?? y2030?.mainBottleneck ?? 'mixed'
    };
  }));

  const shock20NoChange2030 = scenarioRows.find((r) => r.declinePath === 'abruptShock20' && r.adaptationPathway === 'noChange' && r.year === 2030);
  const shock20Strong2030 = scenarioRows.find((r) => r.declinePath === 'abruptShock20' && r.adaptationPathway === 'strongAdaptation' && r.year === 2030);
  const severe2050NoChange = scenarioRows.find((r) => r.declinePath === 'severeDecline' && r.adaptationPathway === 'noChange' && r.year === 2050);
  const severe2050Full = scenarioRows.find((r) => r.declinePath === 'severeDecline' && r.adaptationPathway === 'fullRuralTransition' && r.year === 2050);

  const report = {
    generatedAt: new Date().toISOString(),
    assumptions: {
      declinePathsAreScenariosNotForecasts: true,
      currentFoodInsecurityShare,
      sourceStatus: 'assumption unless local statistic loaded',
      riskModelBasis: 'risk-exposure proxy from food coverage, food cost burden, transport stress, land-access context, and adaptation offsets',
      riskClamps: {
        foodStressRiskShareMin: 0.08,
        foodStressRiskShareMax: 0.98,
        foodInsecurityRiskShareMin: 0.05,
        foodInsecurityRiskShareMax: 0.95
      },
      totalPopulation: population,
      noDirectLandAccessPopulation,
      subsistencePotentialPopulation,
      outsideSettlementPopulation,
      baselineUrbanHousingStress,
      baselineUrbanIsolationStress,
      baselineUrbanAddictionCrisisExposure,
      baselineUrbanCrimeStress,
      baselineUrbanFoodInsecurityStress,
      baselineMeaningfulWorkDeficit
    },
    declinePaths: DECLINE_PATHS,
    adaptationPathways: ADAPTATION_PATHWAYS,
    scenarioMatrix,
    scenarioRows,
    humanImpactComparison: humanImpactRows,
    timingDiagnostics: {
      emergencyReactionYearsToBenefit: ADAPTATION_PATHWAYS.emergencyReaction.yearsToBenefit,
      moderateAdaptationYearsToBenefit: ADAPTATION_PATHWAYS.moderateAdaptation.yearsToBenefit,
      strongAdaptationYearsToBenefit: ADAPTATION_PATHWAYS.strongAdaptation.yearsToBenefit,
      fullRuralTransitionYearsToBenefit: ADAPTATION_PATHWAYS.fullRuralTransition.yearsToBenefit
    },
    suiteKeyResults: {
      shock20NoChangeFoodInsecureRiskPopulation2030: n(shock20NoChange2030?.foodInsecurityRiskExposurePopulation),
      shock20StrongAdaptationFoodInsecureRiskPopulation2030: n(shock20Strong2030?.foodInsecurityRiskExposurePopulation),
      avoidedFoodInsecureRiskVsNoChange2030: Math.max(0, n(shock20NoChange2030?.foodInsecurityRiskExposurePopulation) - n(shock20Strong2030?.foodInsecurityRiskExposurePopulation)),
      severeDecline2050NoChangeQualityOfLifeIndex: n(severe2050NoChange?.qualityOfLifeIndex),
      severeDecline2050FullRuralTransitionQualityOfLifeIndex: n(severe2050Full?.qualityOfLifeIndex)
    },
    caveats: [
      'Decline paths are scenarios, not forecasts.',
      'Not a price forecast.',
      'Not a hunger forecast. Risk outputs are exposure proxies, not direct predictions of hunger counts.',
      'Current food insecurity share is configurable unless a local statistic is loaded.',
      'Simplified household stress model.',
      'Scenario diagnostic only.',
      'Adaptation can improve quality of life relative to fragile urban/suburban stress baselines, but it does not create perfect conditions; constraints and hardship still remain.'
    ],
    warnings
  };

  const md = [
    '# Grey Transition Pathway Comparison',
    '',
    '## What this is',
    'Compares how different fuel/input decline paths and adaptation choices affect food security, labour needs, household stress, and local resilience.',
    '',
    '## Important caveat',
    'Decline paths are scenarios, not forecasts.',
    '',
    'Food risk outputs are scenario risk-exposure proxies, not direct hunger forecasts.',
    '',
    '## Executive summary',
    `- shock20 noChange (2030) food-insecurity risk exposure population: ${n(shock20NoChange2030?.foodInsecurityRiskExposurePopulation).toFixed(0)}`,
    `- shock20 strongAdaptation (2030) food-insecurity risk exposure population: ${n(shock20Strong2030?.foodInsecurityRiskExposurePopulation).toFixed(0)}`,
    `- avoided food-insecurity risk exposure vs noChange: ${Math.max(0, n(shock20NoChange2030?.foodInsecurityRiskExposurePopulation) - n(shock20Strong2030?.foodInsecurityRiskExposurePopulation)).toFixed(0)}`,
    `- severeDecline 2050 noChange quality of life: ${n(severe2050NoChange?.qualityOfLifeIndex).toFixed(3)}`,
    `- severeDecline 2050 fullRuralTransition quality of life: ${n(severe2050Full?.qualityOfLifeIndex).toFixed(3)}`,
    '',
    '## Scenario matrix',
    '| Decline path | Adaptation pathway | 2030 food coverage | 2030 food-insecure risk | 2030 labour gap | 2050 quality of life | Main bottleneck |',
    '|---|---|---:|---:|---:|---:|---|',
    ...scenarioMatrix.map((r) => `| ${r.declinePath} | ${r.adaptationPathway} | ${r.foodCoverage2030.toFixed(3)} | ${r.foodInsecureRiskPopulation2030.toFixed(0)} | ${r.labourGapFTE2030.toFixed(0)} | ${r.qualityOfLife2050.toFixed(3)} | ${r.mainBottleneck} |`),
    '',
    '## Timing matters',
    '- Emergency measures help quickly but have limited ceiling.',
    '- Perennial and deeper structural adaptation has delayed but larger benefit.',
    '',
    '## Caveats',
    '- Adaptation can improve quality of life relative to fragile urban/suburban stressors, but this is not a utopia/perfect-conditions claim.',
    ...report.caveats.map((c) => `- ${c}`)
  ].join('\n');

  const paths = {
    markdownPath: path.join(produceDir, 'grey-transition-pathways.md'),
    jsonPath: path.join(produceDir, 'grey-transition-pathways.json'),
    scenariosCsvPath: path.join(produceDir, 'grey-transition-pathways-scenarios.csv'),
    humanImpactCsvPath: path.join(produceDir, 'grey-transition-pathways-human-impact.csv'),
    timelineCsvPath: path.join(produceDir, 'grey-transition-pathways-timeline.csv')
  };

  fs.writeFileSync(paths.markdownPath, md);
  fs.writeFileSync(paths.jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(paths.scenariosCsvPath, toCsv(scenarioRows, [
    'declinePath', 'adaptationPathway', 'year', 'fuelAvailabilityIndex', 'fertilizerAvailabilityIndex',
    'foodCoverage', 'foodSurplusGJ', 'foodStressRiskPopulation', 'foodInsecurityRiskExposurePopulation', 'severeFoodStressPopulation',
    'addedFoodWorkersNeeded', 'labourGapFTE', 'householdStressIndex', 'localResilienceIndex',
    'qualityOfLifeIndex', 'mainBottleneck', 'warnings'
  ]));
  fs.writeFileSync(paths.humanImpactCsvPath, toCsv(humanImpactRows, [
    'declinePath', 'adaptationPathway', 'foodInsecureRiskPopulation2030', 'severeFoodStressPopulation2030',
    'highStressPopulation2030', 'foodInsecureRiskPopulation2050', 'severeFoodStressPopulation2050',
    'highStressPopulation2050', 'avoidedFoodInsecureRiskVsNoChange', 'avoidedSevereStressVsNoChange'
  ]));
  fs.writeFileSync(paths.timelineCsvPath, toCsv(timelineRows, [
    'declinePath', 'adaptationPathway', 'year', 'foodCoverage', 'foodInsecurityRiskExposurePopulation',
    'addedFoodWorkersNeeded', 'qualityOfLifeIndex', 'localResilienceIndex'
  ]));

  return { report, paths };
}
