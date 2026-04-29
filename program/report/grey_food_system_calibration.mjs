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
    labourAvailableFTE
  } = context;
  const totalPopulation = greyCountySeedNodes.reduce((s, m) => s + n(m.population2021), 0);
  const totalFoodDemandGJ = totalPopulation * ANNUAL_FOOD_ENERGY_GJ_PER_PERSON;
  const rows = [];
  const profiles = new Map(YIELD_PROFILES.map((p) => [p.profile, p]));
  const defs = [
    { scenario: 'currentModelAssumption', profile: 'baselineAnnualStaples', candidateShare: 0.55, lossFactor: 1, labourFactor: 1, perennialShare: 0 },
    { scenario: 'conservativeAnnualStaples', profile: 'conservativeAnnualStaples', candidateShare: 0.5, lossFactor: 1.05, labourFactor: 1.05, perennialShare: 0 },
    { scenario: 'baselineAnnualStaples', profile: 'baselineAnnualStaples', candidateShare: 0.58, lossFactor: 1, labourFactor: 1, perennialShare: 0 },
    { scenario: 'perennialTransitionMature', profile: 'perennialStapleMature', candidateShare: 0.52, lossFactor: 0.95, labourFactor: 0.85, perennialShare: 0.5 },
    { scenario: 'mixedResilienceFoodSystem', profile: 'mixedPermacultureMature', candidateShare: 0.62, lossFactor: 0.95, labourFactor: 0.9, perennialShare: 0.45 },
    { scenario: 'highLocalProduction', profile: 'highAnnualStaples', candidateShare: 0.75, lossFactor: 0.9, labourFactor: 1.15, perennialShare: 0.25 }
  ];

  for (const d of defs) {
    const p = profiles.get(d.profile);
    const candidateFoodHa = humanFoodPriorityHa * d.candidateShare;
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
      limitingFactor
    });
  }
  return { rows, totalFoodDemandGJ, totalPopulation };
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
  const officialLandUsePath = path.join(inputDir, 'official-plan-schedule-a-land-use.geojson');
  const managedForestPath = path.join(inputDir, 'managed-forest-boundary.geojson');
  const ruralBusinessPath = path.join(inputDir, 'on-farm-rural-business-listing.geojson');

  const publicBaseline = readJsonIfExists(publicBaselinePath, warnings, 'public baseline');
  const landAccess = readJsonIfExists(landAccessPath, warnings, 'land-access baseline');
  const labourLand = readJsonIfExists(labourLandPath, warnings, 'labour-land baseline');
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

  const { rows: sensitivityRows, totalFoodDemandGJ, totalPopulation } = buildSensitivityRows({
    ...landSummary,
    labourAvailableFTE
  });

  const coverageByScenario = Object.fromEntries(sensitivityRows.map((r) => [r.scenario, r.foodCoverage]));
  const currentMetricsYear = Array.isArray(metrics?.years) ? metrics.years.at(-1) : null;
  const currentModelAssumption = sensitivityRows.find((r) => r.scenario === 'currentModelAssumption');

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
      caveat: 'This is calibration scaffolding, not a farm production forecast.'
    },
    sourcePaths: {
      publicBaselinePath,
      landAccessPath,
      labourLandPath,
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
    coverageByScenario,
    labourCrossCheck: {
      availableFoodWorkerFTE: labourAvailableFTE,
      lowFuelFoodWorkersNeeded,
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
      calibratedCurrentAssumptionFoodCoverage: currentModelAssumption?.foodCoverage ?? null
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
    'perennialMaturityShare','fossilInputConstraintFactor','limitingFactor'
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
    '## Labour cross-check',
    `- availableFoodWorkerFTE: ${labourAvailableFTE.toFixed(2)}`,
    `- lowFuelFoodWorkersNeeded: ${lowFuelFoodWorkersNeeded.toFixed(2)}`,
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
      sensitivityCsvPath
    }
  };
}
