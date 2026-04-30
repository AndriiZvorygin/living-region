// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { greyCountySeedNodes } from '../data/grey_county_seed_nodes.mjs';

const ANNUAL_FOOD_ENERGY_GJ_PER_PERSON = 3.7656;

const YIELD_PROFILES = [
  { profile: 'conservativeAnnualStaples', grossFoodEnergyGJPerHa: 10, lossShare: 0.3, inputDependencyIndex: 0.55, labourIntensityIndex: 0.7, maturityYears: 1, confidence: 'moderate', notes: 'Conservative annual staples baseline.' },
  { profile: 'baselineAnnualStaples', grossFoodEnergyGJPerHa: 14, lossShare: 0.25, inputDependencyIndex: 0.6, labourIntensityIndex: 0.65, maturityYears: 1, confidence: 'moderate', notes: 'Baseline annual staples assumption.' },
  { profile: 'highAnnualStaples', grossFoodEnergyGJPerHa: 18, lossShare: 0.2, inputDependencyIndex: 0.7, labourIntensityIndex: 0.6, maturityYears: 1, confidence: 'low', notes: 'Upper annual staples envelope.' },
  { profile: 'marketGardenVegetableEquivalent', grossFoodEnergyGJPerHa: 22, lossShare: 0.28, inputDependencyIndex: 0.5, labourIntensityIndex: 0.9, maturityYears: 1, confidence: 'low', notes: 'Market-garden equivalent energy proxy.' },
  { profile: 'perennialStapleYoung', grossFoodEnergyGJPerHa: 8, lossShare: 0.22, inputDependencyIndex: 0.3, labourIntensityIndex: 0.7, maturityYears: 5, confidence: 'low', notes: 'Perennial young system with delayed output.' },
  { profile: 'perennialStapleMature', grossFoodEnergyGJPerHa: 16, lossShare: 0.2, inputDependencyIndex: 0.25, labourIntensityIndex: 0.5, maturityYears: 10, confidence: 'low', notes: 'Mature perennial staple envelope.' },
  { profile: 'orchardNutMature', grossFoodEnergyGJPerHa: 14, lossShare: 0.18, inputDependencyIndex: 0.22, labourIntensityIndex: 0.45, maturityYears: 10, confidence: 'low', notes: 'Mature orchard/nut envelope.' },
  { profile: 'mixedPermacultureMature', grossFoodEnergyGJPerHa: 15, lossShare: 0.2, inputDependencyIndex: 0.2, labourIntensityIndex: 0.55, maturityYears: 8, confidence: 'low', notes: 'Mixed mature perennial system.' },
  { profile: 'pastureFodderHumanFoodEquivalent', grossFoodEnergyGJPerHa: 6, lossShare: 0.35, inputDependencyIndex: 0.2, labourIntensityIndex: 0.35, maturityYears: 1, confidence: 'low', notes: 'Pasture/fodder indirect human-food equivalent proxy.' },
  { profile: 'woodEnergyCoppice', grossFoodEnergyGJPerHa: 9, lossShare: 0.18, inputDependencyIndex: 0.18, labourIntensityIndex: 0.4, maturityYears: 7, confidence: 'low', notes: 'Wood-energy coppice envelope.' }
].map((p) => ({ ...p, netFoodEnergyGJPerHa: p.grossFoodEnergyGJPerHa * (1 - p.lossShare) }));

function exists(filePath) {
  return fs.existsSync(filePath);
}

function readJsonIfExists(filePath, warnings, label) {
  if (!exists(filePath)) {
    warnings.push(`Missing ${label}: ${filePath}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    warnings.push(`Failed to parse ${label}: ${filePath} (${error.message})`);
    return null;
  }
}

function readGeoJsonFeatures(filePath, warnings, label) {
  const parsed = readJsonIfExists(filePath, warnings, label);
  return Array.isArray(parsed?.features) ? parsed.features : [];
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

function classifyLandUse(raw) {
  const s = String(raw ?? '').toLowerCase();
  if (!s) return 'unknown';
  if (s.includes('agric')) return 'agricultural';
  if (s.includes('rural')) return 'rural';
  if (s.includes('settlement') || s.includes('urban') || s.includes('residential')) return 'settlement';
  if (s.includes('wetland')) return 'wetland';
  if (s.includes('hazard')) return 'hazard';
  if (s.includes('forest') || s.includes('heritage') || s.includes('natural')) return 'managedForest';
  return 'unknown';
}

function featureCountByClass(landUseFeatures) {
  const counts = {
    agricultural: 0,
    rural: 0,
    settlement: 0,
    managedForest: 0,
    hazard: 0,
    wetland: 0,
    constrained: 0,
    unknown: 0
  };
  for (const f of landUseFeatures) {
    const p = f.properties ?? {};
    const raw = p.LANDUSE ?? p.LAND_USE ?? p.DESIGNATION ?? p.OP_DES ?? p.SCHED_A ?? p.CATEGORY ?? p.TYPE ?? p.Final_Type ?? p.NAME ?? '';
    const c = classifyLandUse(raw);
    counts[c] = (counts[c] ?? 0) + 1;
    if (c === 'hazard' || c === 'wetland') counts.constrained += 1;
  }
  return counts;
}

function buildSensitivityRows(context) {
  const {
    foodRelevantLandHa,
    humanFoodPriorityHa,
    annualStapleCandidateHa,
    perennialStapleCandidateHa,
    marketGardenCandidateHa,
    labourAvailableFTE,
    estimatedAgriculturalHa,
    estimatedRuralFoodPotentialHa
  } = context;
  const totalPopulation = greyCountySeedNodes.reduce((s, m) => s + n(m.population2021), 0);
  const totalFoodDemandGJ = totalPopulation * ANNUAL_FOOD_ENERGY_GJ_PER_PERSON;
  const rows = [];
  const profiles = new Map(YIELD_PROFILES.map((p) => [p.profile, p]));
  const defs = [
    {
      scenario: 'presentIndustrialFossilBaseline',
      profile: 'highAnnualStaples',
      candidateShare: 1,
      candidateLandHaOverride: estimatedAgriculturalHa + estimatedRuralFoodPotentialHa * 0.82,
      lossFactor: 0.92,
      labourFactor: 0.92,
      perennialShare: 0.06,
      fossilInputSupport: 'high',
      supplyChainDependence: 'high',
      mainBottleneck: 'localCropMixAndSupplyChainOrientation',
      interpretation: 'Gross land-base potential under present industrial inputs; not actual local self-reliance.'
    },
    {
      scenario: 'localizedPresentTechBaseline',
      profile: 'baselineAnnualStaples',
      candidateShare: 0.86,
      candidateLandHaOverride: humanFoodPriorityHa * 0.86,
      lossFactor: 0.95,
      labourFactor: 0.95,
      perennialShare: 0.22,
      fossilInputSupport: 'high',
      supplyChainDependence: 'moderate-high',
      mainBottleneck: 'processingStorageAndCropMixRedirection',
      interpretation: 'Current technology with local/regional food orientation and stronger local processing.'
    },
    {
      scenario: 'constrainedLocalFoodBaseline',
      profile: 'baselineAnnualStaples',
      candidateShare: 0.55,
      candidateLandHaOverride: humanFoodPriorityHa * 0.55,
      lossFactor: 1,
      labourFactor: 1,
      perennialShare: 0,
      fossilInputSupport: 'reduced',
      supplyChainDependence: 'moderate',
      mainBottleneck: 'candidateLandAndLabourAccess',
      interpretation: 'Constrained local resilience assumption; diagnostic for transition pressure, not measured present production.'
    },
    {
      scenario: 'lowFuelTransitionBaseline',
      profile: 'conservativeAnnualStaples',
      candidateShare: 0.5,
      candidateLandHaOverride: humanFoodPriorityHa * 0.5,
      lossFactor: 1.07,
      labourFactor: 1.1,
      perennialShare: 0.1,
      fossilInputSupport: 'low',
      supplyChainDependence: 'low-moderate',
      mainBottleneck: 'labourInputsAndMachineryConstraints',
      interpretation: 'Low-fuel transition with tighter diesel/input/machinery support and higher labour burden.'
    },
    {
      scenario: 'perennialLowFuelTransition',
      profile: 'perennialStapleMature',
      candidateShare: 0.52,
      candidateLandHaOverride: humanFoodPriorityHa * 0.52,
      lossFactor: 0.96,
      labourFactor: 0.88,
      perennialShare: 0.55,
      fossilInputSupport: 'low',
      supplyChainDependence: 'low-moderate',
      mainBottleneck: 'maturityDelayAndProcessingBuildout',
      interpretation: 'Low-fuel transition with mature perennial share partially easing recurring labour.'
    },
    {
      scenario: 'foodResilienceMaximumPlausible',
      profile: 'highAnnualStaples',
      candidateShare: 0.92,
      candidateLandHaOverride: humanFoodPriorityHa * 0.92,
      lossFactor: 0.88,
      labourFactor: 1.02,
      perennialShare: 0.45,
      fossilInputSupport: 'moderate',
      supplyChainDependence: 'moderate',
      mainBottleneck: 'coordinationAndInfrastructureScaleup',
      interpretation: 'Upper-bound local resilience envelope assuming strong land, labour, and processing coordination.'
    }
  ];

  for (const d of defs) {
    const p = profiles.get(d.profile);
    const candidateFoodHa = n(d.candidateLandHaOverride, humanFoodPriorityHa * d.candidateShare);
    const profileNet = p.netFoodEnergyGJPerHa / d.lossFactor;
    const perennialAdj = d.perennialShare > 0 ? (perennialStapleCandidateHa / Math.max(1, candidateFoodHa)) * 0.08 : 0;
    const marketAdj = (marketGardenCandidateHa / Math.max(1, candidateFoodHa)) * 0.03;
    const netFoodEnergyGJ = candidateFoodHa * profileNet * (1 + perennialAdj + marketAdj);
    const foodCoverage = totalFoodDemandGJ > 0 ? netFoodEnergyGJ / totalFoodDemandGJ : 0;
    const foodSurplusGJ = netFoodEnergyGJ - totalFoodDemandGJ;
    const requiredHaForSelfCoverage = profileNet > 0 ? totalFoodDemandGJ / profileNet : Infinity;
    const shareOfCandidateLandRequired = candidateFoodHa > 0 ? requiredHaForSelfCoverage / candidateFoodHa : Infinity;
    const labourRequiredFTE = (candidateFoodHa * (0.85 + p.labourIntensityIndex * 1.2) * d.labourFactor) / 220;
    const limitingFactor = labourRequiredFTE > labourAvailableFTE
      ? (requiredHaForSelfCoverage > foodRelevantLandHa ? 'bothConstrained' : 'labourConstrained')
      : (requiredHaForSelfCoverage > foodRelevantLandHa ? 'landConstrained' : 'balanced');
    rows.push({
      scenario: d.scenario,
      yieldProfile: d.profile,
      candidateFoodHa,
      netFoodEnergyGJ,
      netGJPerHa: profileNet,
      foodCoverage,
      foodSurplusGJ,
      requiredHaForSelfCoverage,
      shareOfCandidateLandRequired,
      labourRequiredFTE,
      labourAvailableFTE,
      lossShare: p.lossShare,
      candidateLandShare: d.candidateShare,
      perennialMaturityShare: d.perennialShare,
      fossilInputConstraintFactor: d.lossFactor,
      machinerySupportFactor: d.labourFactor <= 1 ? 1 : 1 / d.labourFactor,
      inputConstraintFactor: 1 / d.lossFactor,
      labourConstraintFactor: d.labourFactor,
      candidateLandBasis: d.scenario === 'presentIndustrialFossilBaseline'
        ? 'agricultural + suitable rural land under present industrial input assumptions'
        : 'human-food-priority and transition candidate land',
      fossilInputSupport: d.fossilInputSupport,
      supplyChainDependence: d.supplyChainDependence,
      mainBottleneck: d.mainBottleneck,
      interpretation: d.interpretation,
      limitingFactor
    });
  }
  return { rows, totalFoodDemandGJ, totalPopulation };
}

function buildSensitivityDriverAnalysis(sensitivityRows) {
  const baseline = sensitivityRows.find((r) => r.scenario === 'constrainedLocalFoodBaseline') ?? sensitivityRows[0];
  const deltas = sensitivityRows
    .filter((r) => r !== baseline)
    .map((r) => ({
      scenario: r.scenario,
      foodCoverageDelta: r.foodCoverage - baseline.foodCoverage,
      foodSurplusGJDelta: r.foodSurplusGJ - baseline.foodSurplusGJ,
      netFoodEnergyGJDelta: r.netFoodEnergyGJ - baseline.netFoodEnergyGJ,
      limitingFactorChange: `${baseline.limitingFactor} -> ${r.limitingFactor}`,
      candidateLandHaDelta: r.candidateFoodHa - baseline.candidateFoodHa,
      yieldGJPerHaDelta: (r.netFoodEnergyGJ / Math.max(1, r.candidateFoodHa)) - (baseline.netFoodEnergyGJ / Math.max(1, baseline.candidateFoodHa)),
      lossShareDelta: r.lossShare - baseline.lossShare,
      labourConstraintDelta: r.labourRequiredFTE - baseline.labourRequiredFTE,
      maturityConstraintDelta: r.perennialMaturityShare - baseline.perennialMaturityShare
    }));

  const driverCandidates = [
    { driver: 'candidate land share', baselineValue: baseline.candidateLandShare, changedValue: Math.max(...sensitivityRows.map((r) => r.candidateLandShare)), scenario: sensitivityRows.find((r) => r.candidateLandShare === Math.max(...sensitivityRows.map((x) => x.candidateLandShare)))?.scenario ?? baseline.scenario },
    { driver: 'yield profile', baselineValue: baseline.yieldProfile, changedValue: sensitivityRows.find((r) => r.yieldProfile !== baseline.yieldProfile)?.yieldProfile ?? baseline.yieldProfile, scenario: sensitivityRows.find((r) => r.yieldProfile !== baseline.yieldProfile)?.scenario ?? baseline.scenario },
    { driver: 'loss share', baselineValue: baseline.lossShare, changedValue: Math.min(...sensitivityRows.map((r) => r.lossShare)), scenario: sensitivityRows.find((r) => r.lossShare === Math.min(...sensitivityRows.map((x) => x.lossShare)))?.scenario ?? baseline.scenario },
    { driver: 'perennial maturity share', baselineValue: baseline.perennialMaturityShare, changedValue: Math.max(...sensitivityRows.map((r) => r.perennialMaturityShare)), scenario: sensitivityRows.find((r) => r.perennialMaturityShare === Math.max(...sensitivityRows.map((x) => x.perennialMaturityShare)))?.scenario ?? baseline.scenario },
    { driver: 'labour availability', baselineValue: baseline.labourAvailableFTE, changedValue: baseline.labourAvailableFTE, scenario: baseline.scenario },
    { driver: 'input/fossil constraint factor', baselineValue: baseline.fossilInputConstraintFactor, changedValue: Math.max(...sensitivityRows.map((r) => r.fossilInputConstraintFactor)), scenario: sensitivityRows.find((r) => r.fossilInputConstraintFactor === Math.max(...sensitivityRows.map((x) => x.fossilInputConstraintFactor)))?.scenario ?? baseline.scenario }
  ];

  const drivers = driverCandidates.map((d) => {
    const scenario = sensitivityRows.find((r) => r.scenario === d.scenario) ?? baseline;
    const foodCoverageDelta = scenario.foodCoverage - baseline.foodCoverage;
    const foodSurplusGJDelta = scenario.foodSurplusGJ - baseline.foodSurplusGJ;
    return {
      driver: d.driver,
      baselineValue: d.baselineValue,
      changedValue: d.changedValue,
      scenario: scenario.scenario,
      foodCoverageDelta,
      foodSurplusGJDelta,
      interpretation: foodCoverageDelta >= 0
        ? `Increases coverage by ${foodCoverageDelta.toFixed(3)}`
        : `Decreases coverage by ${Math.abs(foodCoverageDelta).toFixed(3)}`
    };
  }).sort((a, b) => Math.abs(b.foodCoverageDelta) - Math.abs(a.foodCoverageDelta));

  return { baseline, deltas, drivers };
}

function buildSelfCoverageThresholds({ baselineScenario, totalFoodDemandGJ, humanFoodPriorityHa }) {
  const baselineNetPerHa = baselineScenario.netFoodEnergyGJ / Math.max(1, baselineScenario.candidateFoodHa);
  const requiredNetFoodEnergyGJForSelfCoverage = totalFoodDemandGJ;
  const additionalNetFoodEnergyGJNeeded = Math.max(0, requiredNetFoodEnergyGJForSelfCoverage - baselineScenario.netFoodEnergyGJ);
  const requiredNetGJPerHumanFoodPriorityHa = requiredNetFoodEnergyGJForSelfCoverage / Math.max(1, humanFoodPriorityHa);
  const requiredHumanFoodPriorityHaAtCurrentYield = requiredNetFoodEnergyGJForSelfCoverage / Math.max(0.0001, baselineNetPerHa);
  const requiredCandidateLandShareAtCurrentYield = requiredHumanFoodPriorityHaAtCurrentYield / Math.max(1, humanFoodPriorityHa);
  const requiredYieldMultiplierAtCurrentLand = requiredNetFoodEnergyGJForSelfCoverage / Math.max(1, baselineScenario.netFoodEnergyGJ);
  const requiredLossReductionForSelfCoverage = 1 - (baselineScenario.lossShare / Math.max(0.0001, requiredYieldMultiplierAtCurrentLand));
  const requiredPerennialMatureShareForSelfCoverage = Math.min(1, Math.max(0, baselineScenario.perennialMaturityShare + (requiredYieldMultiplierAtCurrentLand - 1) * 0.7));
  return {
    requiredNetFoodEnergyGJForSelfCoverage,
    additionalNetFoodEnergyGJNeeded,
    requiredNetGJPerHumanFoodPriorityHa,
    requiredHumanFoodPriorityHaAtCurrentYield,
    requiredCandidateLandShareAtCurrentYield,
    requiredYieldMultiplierAtCurrentLand,
    requiredLossReductionForSelfCoverage,
    requiredPerennialMatureShareForSelfCoverage
  };
}

export function buildGreyFoodSystemCalibration(options = {}) {
  const produceDir = path.resolve(options.produceDir ?? 'know/produce');
  const inputDir = path.resolve(options.inputDir ?? 'know/input/gis');
  fs.mkdirSync(produceDir, { recursive: true });
  const warnings = [];

  const publicBaselinePath = path.join(produceDir, 'grey-public-baseline.json');
  const landAccessPath = path.join(produceDir, 'grey-land-access-baseline.json');
  const labourLandPath = path.join(produceDir, 'grey-labour-land-baseline.json');
  const metricsPath = path.join(produceDir, 'grey-county-open-data-metrics.json');
  const farmLabourPath = path.join(produceDir, 'grey-census-agriculture-baseline.json');
  const officialLandUsePath = path.join(inputDir, 'official-plan-schedule-a-land-use.geojson');
  const managedForestPath = path.join(inputDir, 'managed-forest-boundary.geojson');
  const ruralBusinessPath = path.join(inputDir, 'on-farm-rural-business-listing.geojson');

  const publicBaseline = readJsonIfExists(publicBaselinePath, warnings, 'public baseline');
  const landAccess = readJsonIfExists(landAccessPath, warnings, 'land-access baseline');
  const labourLand = readJsonIfExists(labourLandPath, warnings, 'labour-land baseline');
  const farmLabour = readJsonIfExists(farmLabourPath, warnings, 'farm-labour baseline');
  const metrics = readJsonIfExists(metricsPath, warnings, 'open-data metrics');
  const landUseFeatures = readGeoJsonFeatures(officialLandUsePath, warnings, 'Official Plan land use');
  const managedForestFeatures = readGeoJsonFeatures(managedForestPath, warnings, 'managed forest');
  const ruralBusinessFeatures = readGeoJsonFeatures(ruralBusinessPath, warnings, 'rural businesses');

  const counts = featureCountByClass(landUseFeatures);
  const totalLandUseFeatures = Math.max(1, landUseFeatures.length);
  const totalAreaHa = greyCountySeedNodes.reduce((s, m) => s + n(m.landAreaKm2) * 100, 0);
  const areaMethod = 'censusAreaWeightedByLandUseFeatureShare';
  const est = (className) => totalAreaHa * (n(counts[className]) / totalLandUseFeatures);

  const estimatedAgriculturalHa = est('agricultural');
  const estimatedRuralFoodPotentialHa = est('rural');
  const estimatedSettlementGardenHa = est('settlement') * 0.18;
  const estimatedManagedForestHa = Math.max(est('managedForest'), managedForestFeatures.length * 8);
  const constrainedHazardWetlandHa = est('constrained');
  const foodRelevantLandHa = Math.max(0, estimatedAgriculturalHa + estimatedRuralFoodPotentialHa + estimatedSettlementGardenHa - constrainedHazardWetlandHa * 0.35);
  const humanFoodPriorityHa = foodRelevantLandHa * 0.62;
  const perennialStapleCandidateHa = foodRelevantLandHa * 0.26;
  const annualStapleCandidateHa = foodRelevantLandHa * 0.46;
  const marketGardenCandidateHa = foodRelevantLandHa * 0.1;
  const woodEnergyCandidateHa = Math.max(0, estimatedManagedForestHa * 0.55);

  const landSummary = {
    estimatedAgriculturalHa,
    estimatedRuralFoodPotentialHa,
    estimatedSettlementGardenHa,
    estimatedManagedForestHa,
    constrainedHazardWetlandHa,
    foodRelevantLandHa,
    humanFoodPriorityHa,
    perennialStapleCandidateHa,
    annualStapleCandidateHa,
    marketGardenCandidateHa,
    woodEnergyCandidateHa,
    areaMethod
  };

  const labourAvailableFTE = n(labourLand?.regionalIndicators?.availableFoodWorkerFTE, 0);
  const lowFuelFoodWorkersNeeded = n(labourLand?.regionalIndicators?.lowFuelFoodWorkersNeeded, 0);
  const productiveHaPerRuralAccessPerson = n(labourLand?.regionalIndicators?.productiveHaPerRuralAccessPerson, 0);
  const handToolReference = labourLand?.handToolCapacityReference ?? [];
  const currentFarmOperators = n(farmLabour?.numberOfFarmOperators, 0);

  const { rows: sensitivityRows, totalFoodDemandGJ, totalPopulation } = buildSensitivityRows({
    ...landSummary,
    labourAvailableFTE
  });
  const sensitivityDriverAnalysis = buildSensitivityDriverAnalysis(sensitivityRows);
  const selfCoverageThresholds = buildSelfCoverageThresholds({
    baselineScenario: sensitivityDriverAnalysis.baseline,
    totalFoodDemandGJ,
    humanFoodPriorityHa
  });
  const reachesSelfCoverageScenarios = sensitivityRows.filter((r) => r.foodCoverage >= 1).map((r) => r.scenario);

  const coverageByScenario = Object.fromEntries(sensitivityRows.map((r) => [r.scenario, r.foodCoverage]));
  const currentMetricsYear = Array.isArray(metrics?.years) ? metrics.years.at(-1) : null;
  const constrainedLocalFoodBaseline = sensitivityRows.find((r) => r.scenario === 'constrainedLocalFoodBaseline');
  const presentIndustrialFossilBaseline = sensitivityRows.find((r) => r.scenario === 'presentIndustrialFossilBaseline');
  const localizedPresentTechBaseline = sensitivityRows.find((r) => r.scenario === 'localizedPresentTechBaseline');
  const lowFuelTransitionBaseline = sensitivityRows.find((r) => r.scenario === 'lowFuelTransitionBaseline');

  const grossLandBaseFoodPotentialGJ = n(presentIndustrialFossilBaseline?.netFoodEnergyGJ);
  const grossLandBaseFoodCoverage = totalFoodDemandGJ > 0 ? grossLandBaseFoodPotentialGJ / totalFoodDemandGJ : 0;
  const localSustainabilityFoodCoverage = n(localizedPresentTechBaseline?.foodCoverage);
  const lowFuelFoodCoverage = n(lowFuelTransitionBaseline?.foodCoverage);
  const landEnoughDiagnostic = {
    grossLandBaseFoodPotentialGJ,
    grossLandBaseFoodCoverage,
    localSustainabilityFoodCoverage,
    lowFuelFoodCoverage,
    landBaseEnoughUnderPresentInputs: grossLandBaseFoodCoverage >= 1,
    transitionConstrainedByLabourOrInputs: lowFuelFoodCoverage < localSustainabilityFoodCoverage,
    currentSystemLocalSelfRelianceGap: Math.max(0, grossLandBaseFoodCoverage - localSustainabilityFoodCoverage),
    interpretation: [
      grossLandBaseFoodCoverage >= 1
        ? 'land base appears sufficient under present industrial input assumptions'
        : 'land base appears insufficient for full self-coverage even under present industrial input assumptions',
      'local self-reliance remains lower when crop mix, storage, processing, and distribution are not redirected',
      'low-fuel transition capacity is lower because labour, inputs, and maturity constraints become binding'
    ]
  };

  const diagnostics = {
    landSufficientButLabourConstrained: sensitivityRows.some((r) => r.limitingFactor === 'labourConstrained'),
    labourSufficientButLandConstrained: sensitivityRows.some((r) => r.limitingFactor === 'landConstrained'),
    bothConstrained: sensitivityRows.some((r) => r.limitingFactor === 'bothConstrained'),
    inputDependencyWarning: YIELD_PROFILES.some((p) => p.inputDependencyIndex > 0.65),
    maturationDelayWarning: YIELD_PROFILES.some((p) => p.maturityYears >= 8)
  };

  const demandByMunicipality = greyCountySeedNodes.map((m) => ({
    municipalityId: m.municipalityId,
    municipalityName: m.municipalityName,
    population: n(m.population2021),
    foodDemandGJ: n(m.population2021) * ANNUAL_FOOD_ENERGY_GJ_PER_PERSON
  }));

  const report = {
    generatedAt: new Date().toISOString(),
    warnings,
    assumptions: {
      annualFoodEnergyGJPerPerson: ANNUAL_FOOD_ENERGY_GJ_PER_PERSON,
      areaMethod,
      caveat: 'This is calibration scaffolding, not a measured food-capacity claim and not a farm production forecast.'
    },
    sourcePaths: {
      publicBaselinePath,
      landAccessPath,
      labourLandPath,
      farmLabourPath,
      metricsPath,
      officialLandUsePath,
      managedForestPath,
      ruralBusinessPath
    },
    landBaseSummary: {
      ...landSummary,
      landUseFeatureCounts: counts,
      managedForestFeatureCount: managedForestFeatures.length,
      ruralBusinessFeatureCount: ruralBusinessFeatures.length
    },
    yieldProfiles: YIELD_PROFILES,
    foodDemandBaseline: {
      annualFoodEnergyGJPerPerson: ANNUAL_FOOD_ENERGY_GJ_PER_PERSON,
      totalPopulation,
      totalFoodDemandGJ,
      demandByMunicipality
    },
    plausibilityScenarios: sensitivityRows,
    foodBaselineComparison: sensitivityRows.map((r) => ({
      scenario: r.scenario,
      fossilInputSupport: r.fossilInputSupport,
      supplyChainDependence: r.supplyChainDependence,
      candidateLandHa: r.candidateFoodHa,
      netGJPerHa: r.netGJPerHa,
      netFoodEnergyGJ: r.netFoodEnergyGJ,
      foodCoverage: r.foodCoverage,
      foodSurplusGJ: r.foodSurplusGJ,
      mainBottleneck: r.mainBottleneck,
      interpretation: r.interpretation
    })),
    landEnoughDiagnostic,
    presentPotentialVsTransitionConstraints: {
      presentIndustrialFossilBaseline: presentIndustrialFossilBaseline ?? null,
      localizedPresentTechBaseline: localizedPresentTechBaseline ?? null,
      constrainedLocalFoodBaseline: constrainedLocalFoodBaseline ?? null,
      lowFuelTransitionBaseline: lowFuelTransitionBaseline ?? null
    },
    sensitivityDeltasVsCurrent: sensitivityDriverAnalysis.deltas,
    sensitivityDrivers: sensitivityDriverAnalysis.drivers,
    selfCoverageThresholds,
    foodCoverageInterpretation: {
      whyCurrentLow: [
        'candidate food-priority land is a subset of total county land',
        'net GJ/ha assumptions are conservative in baseline',
        'loss/input/labour/maturity factors reduce usable output'
      ],
      reachesSelfCoverageScenarios,
      statement: reachesSelfCoverageScenarios.length > 0
        ? `Some scenarios reach self-coverage: ${reachesSelfCoverageScenarios.join(', ')}`
        : 'No current sensitivity scenario reaches foodCoverage >= 1.0.'
    },
    coverageByScenario,
    labourCrossCheck: {
      availableFoodWorkerFTE: labourAvailableFTE,
      currentFarmOperators,
      lowFuelFoodWorkersNeeded,
      farmLabourGapVsLowFuel: Math.max(0, lowFuelFoodWorkersNeeded - currentFarmOperators),
      productiveHaPerRuralAccessPerson,
      handToolCapacityReferenceCount: handToolReference.length,
      landSufficientButLabourConstrained: diagnostics.landSufficientButLabourConstrained,
      labourSufficientButLandConstrained: diagnostics.labourSufficientButLandConstrained,
      bothConstrained: diagnostics.bothConstrained,
      inputDependencyWarning: diagnostics.inputDependencyWarning,
      maturationDelayWarning: diagnostics.maturationDelayWarning
    },
    comparisonToCurrentModel: {
      currentScenarioFoodCoverage: currentMetricsYear?.localFoodCoverageRatio ?? null,
      calibratedConstrainedLocalFoodBaselineCoverage: constrainedLocalFoodBaseline?.foodCoverage ?? null
    },
    majorUncertainties: [
      'soil capability not yet included',
      'existing crop mix not calibrated',
      'livestock/feed not fully calibrated',
      'actual farm labour not loaded',
      'parcel ownership/legal access absent',
      'food imports/exports not fully modelled',
      'processing/depot infrastructure not fully modelled'
    ],
    recommendedNextData: [
      'soil capability / CLI class',
      'Census of Agriculture data',
      'crop inventory / AAFC land cover',
      'farm labour statistics',
      'local food processing/depot data',
      'parcel/assessment fabric'
    ]
  };

  const jsonPath = path.join(produceDir, 'grey-food-calibration.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const landSummaryCsvPath = path.join(produceDir, 'grey-food-calibration-land-summary.csv');
  fs.writeFileSync(landSummaryCsvPath, toCsv([{
    ...landSummary,
    agriculturalFeatureCount: counts.agricultural,
    ruralFeatureCount: counts.rural,
    settlementFeatureCount: counts.settlement,
    managedForestFeatureCount: managedForestFeatures.length,
    hazardFeatureCount: counts.hazard,
    wetlandFeatureCount: counts.wetland,
    constrainedFeatureCount: counts.constrained,
    unknownFeatureCount: counts.unknown
  }], [
    'estimatedAgriculturalHa','estimatedRuralFoodPotentialHa','estimatedSettlementGardenHa','estimatedManagedForestHa',
    'constrainedHazardWetlandHa','foodRelevantLandHa','humanFoodPriorityHa','perennialStapleCandidateHa','annualStapleCandidateHa',
    'marketGardenCandidateHa','woodEnergyCandidateHa','areaMethod','agriculturalFeatureCount','ruralFeatureCount',
    'settlementFeatureCount','managedForestFeatureCount','hazardFeatureCount','wetlandFeatureCount','constrainedFeatureCount','unknownFeatureCount'
  ]));

  const sensitivityCsvPath = path.join(produceDir, 'grey-food-calibration-sensitivity.csv');
  fs.writeFileSync(sensitivityCsvPath, toCsv(sensitivityRows, [
    'scenario','yieldProfile','candidateFoodHa','netFoodEnergyGJ','foodCoverage','foodSurplusGJ','requiredHaForSelfCoverage',
    'shareOfCandidateLandRequired','labourRequiredFTE','labourAvailableFTE','lossShare','candidateLandShare',
    'perennialMaturityShare','fossilInputConstraintFactor','fossilInputSupport','supplyChainDependence','mainBottleneck','limitingFactor'
  ]));

  const baselineComparisonCsvPath = path.join(produceDir, 'grey-food-calibration-baseline-comparison.csv');
  fs.writeFileSync(baselineComparisonCsvPath, toCsv(report.foodBaselineComparison, [
    'scenario','fossilInputSupport','supplyChainDependence','candidateLandHa','netGJPerHa','netFoodEnergyGJ','foodCoverage','foodSurplusGJ','mainBottleneck','interpretation'
  ]));

  const driversCsvPath = path.join(produceDir, 'grey-food-calibration-drivers.csv');
  fs.writeFileSync(driversCsvPath, toCsv(sensitivityDriverAnalysis.drivers, [
    'driver','baselineValue','changedValue','foodCoverageDelta','foodSurplusGJDelta','interpretation'
  ]));

  const markdown = [
    '# Grey County Food-System Calibration',
    '',
    '## What this is',
    'This report calibrates food-energy assumptions against real Grey land-use and labour-access baselines.',
    '',
    '## What it is not',
    'This is not a farm production forecast, not a crop plan, and not a claim that all candidate land is legally available.',
    '',
    '## Land base',
    `- estimatedAgriculturalHa: ${estimatedAgriculturalHa.toFixed(2)}`,
    `- estimatedRuralFoodPotentialHa: ${estimatedRuralFoodPotentialHa.toFixed(2)}`,
    `- estimatedSettlementGardenHa: ${estimatedSettlementGardenHa.toFixed(2)}`,
    `- estimatedManagedForestHa: ${estimatedManagedForestHa.toFixed(2)}`,
    `- constrainedHazardWetlandHa: ${constrainedHazardWetlandHa.toFixed(2)}`,
    `- foodRelevantLandHa: ${foodRelevantLandHa.toFixed(2)}`,
    `- areaMethod: ${areaMethod}`,
    '',
    '## Food demand',
    `- annualFoodEnergyGJPerPerson: ${ANNUAL_FOOD_ENERGY_GJ_PER_PERSON}`,
    `- totalPopulation: ${totalPopulation}`,
    `- totalFoodDemandGJ: ${totalFoodDemandGJ.toFixed(2)}`,
    '',
    '## Yield profiles',
    '| Profile | Gross GJ/ha | Net GJ/ha | Loss share | Input dependency | Labour intensity | Maturity years | Confidence |',
    '|---|---:|---:|---:|---:|---:|---:|---|',
    ...YIELD_PROFILES.map((p) => `| ${p.profile} | ${p.grossFoodEnergyGJPerHa.toFixed(2)} | ${p.netFoodEnergyGJPerHa.toFixed(2)} | ${p.lossShare.toFixed(2)} | ${p.inputDependencyIndex.toFixed(2)} | ${p.labourIntensityIndex.toFixed(2)} | ${p.maturityYears} | ${p.confidence} |`),
    '',
    '## Food coverage sensitivity',
    '| Scenario | Candidate food ha | Net food GJ | Food coverage | Food surplus GJ | Required ha for self coverage | Candidate share required | Labour required FTE | Labour available FTE | Limiting factor |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---|',
    ...sensitivityRows.map((r) => `| ${r.scenario} | ${r.candidateFoodHa.toFixed(2)} | ${r.netFoodEnergyGJ.toFixed(2)} | ${r.foodCoverage.toFixed(3)} | ${r.foodSurplusGJ.toFixed(2)} | ${r.requiredHaForSelfCoverage.toFixed(2)} | ${r.shareOfCandidateLandRequired.toFixed(3)} | ${r.labourRequiredFTE.toFixed(2)} | ${r.labourAvailableFTE.toFixed(2)} | ${r.limitingFactor} |`),
    '',
    '## Present potential versus transition constraints',
    'A county can have enough land in a gross present-industrial sense while still lacking local food self-reliance when crop mix, processing, storage, and distribution are not locally aligned.',
    '| Scenario | Fossil/input support | Supply-chain dependence | Candidate land ha | Net GJ/ha | Food coverage | Main bottleneck | Interpretation |',
    '|---|---|---|---:|---:|---:|---|---|',
    ...report.foodBaselineComparison.map((r) => `| ${r.scenario} | ${r.fossilInputSupport} | ${r.supplyChainDependence} | ${r.candidateLandHa.toFixed(2)} | ${r.netGJPerHa.toFixed(2)} | ${r.foodCoverage.toFixed(3)} | ${r.mainBottleneck} | ${r.interpretation} |`),
    `- grossLandBaseFoodCoverage: ${landEnoughDiagnostic.grossLandBaseFoodCoverage.toFixed(3)}`,
    `- localSustainabilityFoodCoverage: ${landEnoughDiagnostic.localSustainabilityFoodCoverage.toFixed(3)}`,
    `- lowFuelFoodCoverage: ${landEnoughDiagnostic.lowFuelFoodCoverage.toFixed(3)}`,
    `- landBaseEnoughUnderPresentInputs: ${landEnoughDiagnostic.landBaseEnoughUnderPresentInputs}`,
    '',
    '## Why current food coverage is low',
    '- Candidate food-priority land is much smaller than total county land.',
    '- Baseline net food-energy yield assumptions are conservative and losses matter.',
    '- Labour/maturity/input constraints reduce usable output in practical scenarios.',
    '- This is a scenario diagnostic, not a measured food-capacity claim.',
    '',
    '## What would move the number most?',
    '| Driver | Food coverage delta | Food surplus delta GJ | Interpretation |',
    '|---|---:|---:|---|',
    ...sensitivityDriverAnalysis.drivers.map((d) => `| ${d.driver} | ${d.foodCoverageDelta.toFixed(3)} | ${d.foodSurplusGJDelta.toFixed(2)} | ${d.interpretation} |`),
    '',
    `- requiredNetFoodEnergyGJForSelfCoverage: ${selfCoverageThresholds.requiredNetFoodEnergyGJForSelfCoverage.toFixed(2)}`,
    `- additionalNetFoodEnergyGJNeeded: ${selfCoverageThresholds.additionalNetFoodEnergyGJNeeded.toFixed(2)}`,
    `- requiredNetGJPerHumanFoodPriorityHa: ${selfCoverageThresholds.requiredNetGJPerHumanFoodPriorityHa.toFixed(3)}`,
    `- requiredHumanFoodPriorityHaAtCurrentYield: ${selfCoverageThresholds.requiredHumanFoodPriorityHaAtCurrentYield.toFixed(2)}`,
    `- requiredCandidateLandShareAtCurrentYield: ${selfCoverageThresholds.requiredCandidateLandShareAtCurrentYield.toFixed(3)}`,
    `- requiredYieldMultiplierAtCurrentLand: ${selfCoverageThresholds.requiredYieldMultiplierAtCurrentLand.toFixed(3)}`,
    reachesSelfCoverageScenarios.length > 0
      ? `- Scenarios reaching foodCoverage >= 1.0: ${reachesSelfCoverageScenarios.join(', ')}`
      : '- No current scenario reaches foodCoverage >= 1.0.',
    '',
    '## Labour cross-check',
    `- availableFoodWorkerFTE: ${labourAvailableFTE.toFixed(2)}`,
    `- currentFarmOperators (Census Ag baseline): ${currentFarmOperators.toFixed(2)}`,
    `- lowFuelFoodWorkersNeeded: ${lowFuelFoodWorkersNeeded.toFixed(2)}`,
    `- farmLabourGapVsLowFuel: ${Math.max(0, lowFuelFoodWorkersNeeded - currentFarmOperators).toFixed(2)}`,
    `- productiveHaPerRuralAccessPerson: ${productiveHaPerRuralAccessPerson.toFixed(3)}`,
    `- landSufficientButLabourConstrained: ${diagnostics.landSufficientButLabourConstrained}`,
    `- labourSufficientButLandConstrained: ${diagnostics.labourSufficientButLandConstrained}`,
    `- bothConstrained: ${diagnostics.bothConstrained}`,
    '',
    '## Major uncertainties',
    ...report.majorUncertainties.map((u) => `- ${u}`),
    '',
    '## Recommended next data',
    ...report.recommendedNextData.map((u) => `- ${u}`),
    ...(warnings.length > 0 ? ['', '## Warnings', ...warnings.map((w) => `- ${w}`)] : [])
  ].join('\n');

  const markdownPath = path.join(produceDir, 'grey-food-calibration.md');
  fs.writeFileSync(markdownPath, markdown);

  return {
    report,
    paths: {
      markdownPath,
      jsonPath,
      landSummaryCsvPath,
      sensitivityCsvPath,
      driversCsvPath,
      baselineComparisonCsvPath
    }
  };
}
