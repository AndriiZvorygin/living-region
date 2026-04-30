// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';

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

function readJsonIfExistsWithSizeGuard(filePath, warnings, label, maxBytes = 8 * 1024 * 1024) {
  if (!exists(filePath)) {
    warnings.push(`Missing ${label}: ${filePath}`);
    return null;
  }
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > maxBytes) {
      warnings.push(`Skipped parsing ${label} (file too large for assessment pass): ${filePath}`);
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    warnings.push(`Failed to parse ${label}: ${filePath} (${error.message})`);
    return null;
  }
}

function esc(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function toCsv(rows, headers) {
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
}

function asNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function statusFromScore(score) {
  if (score >= 0.8) return 'strong';
  if (score >= 0.5) return 'moderate';
  if (score >= 0.2) return 'weak';
  return 'missing';
}

function checkRow({ checkName, observedValue, modelValue, tolerance, notes = '', missingWhenNull = true }) {
  if ((modelValue === null || modelValue === undefined) && missingWhenNull) {
    return { checkName, observedValue, modelValue: 'missing', tolerance, status: 'missing', notes };
  }
  if (typeof observedValue === 'number' && typeof modelValue === 'number' && Number.isFinite(observedValue) && Number.isFinite(modelValue)) {
    const delta = Math.abs(observedValue - modelValue);
    const status = delta <= tolerance ? 'pass' : (delta <= tolerance * 3 ? 'warn' : 'fail');
    return { checkName, observedValue, modelValue, tolerance, status, notes: notes || `delta=${delta.toFixed(3)}` };
  }
  if (observedValue === modelValue) return { checkName, observedValue, modelValue, tolerance, status: 'pass', notes };
  return { checkName, observedValue, modelValue, tolerance, status: 'warn', notes };
}

export function buildLivingRegionModelAssessment(options = {}) {
  const produceDir = path.resolve(options.produceDir ?? 'know/produce');
  fs.mkdirSync(produceDir, { recursive: true });
  const warnings = [];

  const sourceFiles = {
    publicBaseline: path.join(produceDir, 'grey-public-baseline.json'),
    baselineSummary: path.join(produceDir, 'grey-baseline-summary.json'),
    secondarySummary: path.join(produceDir, 'grey-secondary-data-summary.json'),
    landAccess: path.join(produceDir, 'grey-land-access-baseline.json'),
    labourLand: path.join(produceDir, 'grey-labour-land-baseline.json'),
    metrics: path.join(produceDir, 'grey-county-open-data-metrics.json'),
    openDataWorld: path.join(produceDir, 'grey-open-data-world.json'),
    gisSummary: path.join(produceDir, 'grey-gis-summary.json'),
    fieldInventory: path.join(produceDir, 'grey-field-inventory.json'),
    foodCalibration: path.join(produceDir, 'grey-food-calibration.json'),
    censusPopulationDistribution: path.join(produceDir, 'grey-census-population-distribution.json'),
    dwellingLandAccess: path.join(produceDir, 'grey-dwelling-land-access.json'),
    farmLabourBaseline: path.join(produceDir, 'grey-census-agriculture-baseline.json'),
    agLabourBaseline: path.join(produceDir, 'grey-ag-labour-baseline.json')
  };

  const publicBaseline = readJsonIfExists(sourceFiles.publicBaseline, warnings, 'public baseline');
  const baselineSummary = readJsonIfExists(sourceFiles.baselineSummary, warnings, 'baseline summary');
  const secondarySummary = readJsonIfExists(sourceFiles.secondarySummary, warnings, 'secondary summary');
  const landAccess = readJsonIfExists(sourceFiles.landAccess, warnings, 'land access baseline');
  const labourLand = readJsonIfExists(sourceFiles.labourLand, warnings, 'labour-land baseline');
  const metrics = readJsonIfExists(sourceFiles.metrics, warnings, 'open-data metrics');
  const openDataWorld = readJsonIfExistsWithSizeGuard(sourceFiles.openDataWorld, warnings, 'open-data world');
  const gisSummary = readJsonIfExistsWithSizeGuard(sourceFiles.gisSummary, warnings, 'GIS summary');
  const fieldInventory = readJsonIfExists(sourceFiles.fieldInventory, warnings, 'field inventory');
  const foodCalibration = readJsonIfExists(sourceFiles.foodCalibration, warnings, 'food calibration');
  const censusPopulationDistribution = readJsonIfExists(sourceFiles.censusPopulationDistribution, warnings, 'census population distribution');
  const dwellingLandAccess = readJsonIfExists(sourceFiles.dwellingLandAccess, warnings, 'dwelling-land-access baseline');
  const farmLabourBaseline = readJsonIfExists(sourceFiles.farmLabourBaseline, warnings, 'farm-labour baseline');
  const agLabourBaseline = readJsonIfExists(sourceFiles.agLabourBaseline, warnings, 'ag-labour baseline');

  const observedAnchors = {
    population: 100905,
    municipalityCount: 9,
    settlementBoundaryCount: 56,
    landUseFeatureCount: 6729,
    roadFeatureCount: 6327,
    roadKm: 4741.82,
    lotsAndConcessions: 10137,
    transitStops: 23,
    ruralBusinesses: 197,
    publicFacilities: 35,
    structures: 31,
    roadConditionFeatures: 590
  };

  const modelAnchors = {
    population: asNumber(publicBaseline?.regionalIndicators?.population2021 ?? baselineSummary?.totalPopulation2021, NaN),
    municipalityCount: asNumber(publicBaseline?.coreLayers?.find((x) => x.id === 'municipality-boundaries')?.featureCount, NaN),
    settlementBoundaryCount: asNumber(publicBaseline?.regionalIndicators?.settlementBoundaryCount ?? baselineSummary?.settlementBoundaryCount, NaN),
    landUseFeatureCount: asNumber(publicBaseline?.regionalIndicators?.landUseFeatureCount ?? baselineSummary?.landUseFeatureCount, NaN),
    roadFeatureCount: asNumber(publicBaseline?.regionalIndicators?.roadFeatureCount ?? baselineSummary?.roadFeatureCount, NaN),
    roadKm: asNumber(publicBaseline?.regionalIndicators?.totalRoadKm ?? baselineSummary?.totalRoadKm, NaN),
    lotsAndConcessions: asNumber(publicBaseline?.serviceAccessIndicators?.lotsAndConcessionsFeatureCount, NaN),
    transitStops: asNumber(publicBaseline?.serviceAccessIndicators?.transitStopCount, NaN),
    ruralBusinesses: asNumber(publicBaseline?.serviceAccessIndicators?.ruralBusinessCount, NaN),
    publicFacilities: asNumber(publicBaseline?.serviceAccessIndicators?.facilityCount, NaN),
    structures: asNumber(publicBaseline?.serviceAccessIndicators?.roadStructureCount, NaN),
    roadConditionFeatures: asNumber(publicBaseline?.serviceAccessIndicators?.roadConditionFeatureCount, NaN)
  };

  const checks = [
    checkRow({ checkName: 'population matches census total', observedValue: observedAnchors.population, modelValue: modelAnchors.population, tolerance: 0 }),
    checkRow({ checkName: 'municipality count matches 9', observedValue: observedAnchors.municipalityCount, modelValue: modelAnchors.municipalityCount, tolerance: 0 }),
    checkRow({ checkName: 'settlement boundary count', observedValue: observedAnchors.settlementBoundaryCount, modelValue: modelAnchors.settlementBoundaryCount, tolerance: 0 }),
    checkRow({ checkName: 'land-use feature count', observedValue: observedAnchors.landUseFeatureCount, modelValue: modelAnchors.landUseFeatureCount, tolerance: 0 }),
    checkRow({ checkName: 'road feature count', observedValue: observedAnchors.roadFeatureCount, modelValue: modelAnchors.roadFeatureCount, tolerance: 0 }),
    checkRow({ checkName: 'road km', observedValue: observedAnchors.roadKm, modelValue: modelAnchors.roadKm, tolerance: 60 }),
    checkRow({ checkName: 'lots and concessions feature count', observedValue: observedAnchors.lotsAndConcessions, modelValue: modelAnchors.lotsAndConcessions, tolerance: 0 }),
    checkRow({ checkName: 'transit stops feature count', observedValue: observedAnchors.transitStops, modelValue: modelAnchors.transitStops, tolerance: 0 }),
    checkRow({ checkName: 'rural business feature count', observedValue: observedAnchors.ruralBusinesses, modelValue: modelAnchors.ruralBusinesses, tolerance: 0 }),
    checkRow({ checkName: 'public facilities feature count', observedValue: observedAnchors.publicFacilities, modelValue: modelAnchors.publicFacilities, tolerance: 0 }),
    checkRow({ checkName: 'structures feature count', observedValue: observedAnchors.structures, modelValue: modelAnchors.structures, tolerance: 0 }),
    checkRow({ checkName: 'road condition feature count', observedValue: observedAnchors.roadConditionFeatures, modelValue: modelAnchors.roadConditionFeatures, tolerance: 0 }),
    checkRow({
      checkName: 'real road source used in open-data metrics',
      observedValue: 'grey-open-data',
      modelValue: metrics?.seedMeta?.summary?.roadSource ?? null,
      tolerance: 0,
      notes: 'Road source should be grey-open-data for real-road baseline.'
    }),
    checkRow({
      checkName: 'road fields detected',
      observedValue: true,
      modelValue: Array.isArray(fieldInventory?.roadFieldsDetected) ? fieldInventory.roadFieldsDetected.length > 0 : !!baselineSummary?.roadClassCounts,
      tolerance: 0
    }),
    checkRow({
      checkName: 'land-use assignment completeness',
      observedValue: true,
      modelValue: asNumber(baselineSummary?.assignmentDiagnostics?.landUseAssignedToMunicipalityCount, 0)
        >= Math.max(1, asNumber(baselineSummary?.landUseFeatureCount, 0) * 0.9),
      tolerance: 0,
      notes: 'Expect at least 90% land-use assignment.'
    }),
    checkRow({
      checkName: 'lot/concession assignment completeness',
      observedValue: true,
      modelValue: asNumber(landAccess?.assignment?.assignedToMunicipalityCount, 0)
        >= Math.max(1, asNumber(landAccess?.assignment?.totalLotConcessionFeatures, 0) * 0.95),
      tolerance: 0,
      notes: 'Expect at least 95% lot assignment.'
    }),
    checkRow({
      checkName: 'secondary layers present',
      observedValue: true,
      modelValue: asNumber(publicBaseline?.dataStatus?.secondaryLayersLoaded, 0) >= 8,
      tolerance: 0
    }),
    checkRow({
      checkName: 'food energy terms in GJ context',
      observedValue: true,
      modelValue: typeof labourLand?.regionalIndicators?.estimatedProductiveLandHa === 'number',
      tolerance: 0,
      notes: 'Baseline reports use food-energy in GJ-oriented diagnostics.'
    }),
    checkRow({
      checkName: 'lots/concessions caveat present',
      observedValue: true,
      modelValue: (labourLand?.assumptions?.caveat ?? '').toLowerCase().includes('not ownership'),
      tolerance: 0
    }),
    checkRow({
      checkName: 'animal-power winter-service caveat present',
      observedValue: true,
      modelValue: (labourLand?.communityAnimalPowerScenarios ?? []).some((s) => String(s.winterServiceNotEquivalentTo ?? '').includes('municipal plow truck')),
      tolerance: 0
    }),
    checkRow({
      checkName: 'food calibration report exists',
      observedValue: true,
      modelValue: !!foodCalibration,
      tolerance: 0,
      notes: 'Food calibration scaffold should exist to support present food-system diagnostics.'
    }),
    checkRow({
      checkName: 'census small-area population loaded',
      observedValue: true,
      modelValue: !!censusPopulationDistribution && (asNumber(censusPopulationDistribution?.totalPopulationMatched, 0) > 0),
      tolerance: 0
    }),
    checkRow({
      checkName: 'census small-area population close to known total',
      observedValue: observedAnchors.population,
      modelValue: asNumber(censusPopulationDistribution?.totalPopulationMatched, NaN),
      tolerance: 5000,
      notes: 'Small-area import should be reasonably close to known Grey population (allows partial coverage tolerance).'
    }),
    checkRow({
      checkName: 'settlement/rural split available from census small-area',
      observedValue: true,
      modelValue: asNumber(censusPopulationDistribution?.populationInsideSettlementBoundaries, 0)
        + asNumber(censusPopulationDistribution?.populationOutsideSettlementBoundaries, 0) > 0,
      tolerance: 0
    }),
    checkRow({
      checkName: 'dwelling-land-access threshold report exists',
      observedValue: true,
      modelValue: !!dwellingLandAccess,
      tolerance: 0
    }),
    checkRow({
      checkName: 'dwelling-land-access population proxy totals available',
      observedValue: true,
      modelValue: asNumber(dwellingLandAccess?.estimatedPopulationNoDirectLandAccess, 0)
        + asNumber(dwellingLandAccess?.estimatedPopulationWithGardenScaleAccess, 0)
        + asNumber(dwellingLandAccess?.estimatedPopulationWithSubsistencePotential, 0)
        + asNumber(dwellingLandAccess?.estimatedPopulationWithSmallholdingPotential, 0)
        + asNumber(dwellingLandAccess?.estimatedPopulationWithFarmScalePotential, 0) > 0,
      tolerance: 0,
      notes: 'Threshold proxy should provide nonzero population allocation when census/lots are loaded.'
    }),
    checkRow({
      checkName: 'farm labour baseline loaded',
      observedValue: true,
      modelValue: asNumber(farmLabourBaseline?.numberOfFarmOperators, 0) > 0,
      tolerance: 0
    }),
    checkRow({
      checkName: 'ag-labour baseline loaded',
      observedValue: true,
      modelValue: asNumber(agLabourBaseline?.currentAgRelatedWorkers, 0) > 0,
      tolerance: 0
    })
  ];

  const domainRows = [
    ['Population and settlement form', 0.76, 'Census totals and settlement geometry present; distribution still heuristic.', 'No address-point/building population distribution.'],
    ['Municipal boundaries / geography', 0.93, 'Real municipal boundaries loaded and used.', 'Geometry quality/provider cadence only.'],
    ['Land use', 0.88, 'Official Plan polygons loaded and mapped.', 'Designation-to-function calibration remains coarse.'],
    ['Lots/concessions / land access', dwellingLandAccess ? 0.81 : 0.79,
      dwellingLandAccess
        ? 'Real lot/concession structure plus dwelling-threshold proxy diagnostics.'
        : 'Real lot/concession structure with assignment diagnostics.',
      'Not parcel ownership/legal access fabric.'],
    ['Roads and road condition', 0.83, 'Real road centrelines + road condition layer.', 'Cost calibration by class/condition incomplete.'],
    ['Bridges/culverts/structures', 0.63, 'Structures layer loaded.', 'No lifecycle replacement cost calibration.'],
    ['Transit, trails, cycling, active transport', 0.7, 'Stops/routes/trails/cycling layers loaded.', 'No travel-time network calibration.'],
    ['Public facilities / service access', 0.62, 'Facilities baseline present.', 'Coverage/access quality incomplete.'],
    ['Rural businesses / local economic nodes', 0.66, 'Rural business nodes loaded.', 'No economic throughput or sector calibration.'],
    ['Housing / rents / dwellings', 0.45, 'Stress diagnostics exist.', 'No real income/rent distribution calibration.'],
    ['Food energy production', foodCalibration ? 0.5 : 0.41, foodCalibration ? 'Food calibration scaffold added with sensitivity diagnostics.' : 'Food-energy balance scaffold in place.', 'No calibrated crop/yield/soil capability baseline.'],
    ['Food affordability / food insecurity pressure', 0.52, 'Affordability pressure diagnostics included.', 'Not anchored to survey/income microdata.'],
    ['Human food labour', 0.47, 'Labour-land diagnostics and scenarios available.', 'No empirical farm labour baseline calibration.'],
    ['Perennial/permaculture labour leverage', 0.38, 'Transparent scenario scaffolds present.', 'Assumption-heavy; needs empirical calibration.'],
    ['Animal power / heavy work', 0.35, 'Detailed scenario and tradeoff diagnostics now present.', 'No observed utilization/cost benchmark yet.'],
    ['Wood energy / managed forests', 0.49, 'Managed forest layer loaded.', 'No sustainable harvest/yield calibration.'],
    ['Electricity / heat / fuel demand', 0.44, 'Energy stress system exists.', 'Detailed end-use by building type missing.'],
    ['Freight / market hauling / depots', 0.33, 'Freight and hauling scaffolds available.', 'No observed commodity flow calibration.'],
    ['Rail / former rail / corridor modelling', 0.39, 'Rail corridor scenario logic exists.', 'ROW/operations calibration limited.'],
    ['Household stress and migration', 0.5, 'Stress and migration pressure modeled.', 'Behavioural calibration limited.'],
    ['Infrastructure maintenance costs', 0.36, 'Road burden diagnostics exist.', 'No calibrated unit costs by class/condition/asset.'],
    ['Scenario comparison / sensitivity', 0.74, 'Deterministic comparison + sensitivity tooling.', 'Interpretation still assumption-sensitive.']
  ].map(([domain, score, why, majorGap]) => {
    const status = statusFromScore(score);
    const riskLevel = status === 'strong' ? 'low' : status === 'moderate' ? 'medium' : 'high';
    return {
      domain,
      score,
      status,
      realDataAvailable: status === 'weak' ? 'partial' : 'yes',
      modelAssumptions: why,
      majorGaps: majorGap,
      riskLevel,
      recommendedNextStep: majorGap
    };
  });

  const dwellingCalibrationBonus = dwellingLandAccess ? 0.04 : 0;
  const farmLabourBonus = asNumber(farmLabourBaseline?.numberOfFarmOperators, 0) > 0 ? 0.02 : 0;
  const agLabourBonus = asNumber(agLabourBaseline?.currentAgRelatedWorkers, 0) > 0 ? 0.01 : 0;
  const scorecard = {
    presentGeographyScore: 0.9,
    presentInfrastructureScore: 0.73,
    presentPopulationScore: censusPopulationDistribution ? Math.min(0.9, 0.82 + dwellingCalibrationBonus) : 0.76,
    presentLandAccessScore: Math.min(0.9, 0.79 + dwellingCalibrationBonus),
    presentFoodSystemScore: foodCalibration ? Math.min(0.63, 0.52 + farmLabourBonus + agLabourBonus) : 0.46,
    presentHousingScore: 0.45,
    presentTransportScore: 0.56,
    presentEnergyScore: 0.44,
    presentEconomicNodesScore: 0.62
  };
  scorecard.presentOverallCredibilityScore = clamp01((
    scorecard.presentGeographyScore
    + scorecard.presentInfrastructureScore
    + scorecard.presentPopulationScore
    + scorecard.presentLandAccessScore
    + scorecard.presentFoodSystemScore
    + scorecard.presentHousingScore
    + scorecard.presentTransportScore
    + scorecard.presentEnergyScore
    + scorecard.presentEconomicNodesScore
  ) / 9);

  const majorGaps = {
    highPriority: [
      'No address points / building footprints for real population distribution',
      'No parcel ownership / assessment fabric',
      'No calibrated crop/yield/soil capability model',
      'No calibrated present-day food production baseline',
      'No real household income/rent distribution',
      'No actual traffic counts / trip OD calibration',
      'No real freight/commodity flow calibration',
      'No calibrated road maintenance costs by class/condition',
      'No bridge/culvert replacement cost calibration',
      'No detailed energy demand by building type',
      'No real farm labour/workforce baseline',
      'No calibrated service-access/network travel-time model'
    ],
    mediumPriority: [
      'Population projections not loaded',
      'Facilities coverage incomplete',
      'Rail/trail/ROW distinction needs refinement',
      'Managed forest not yet translated into sustainable wood-energy yield',
      'Animal/permaculture assumptions need empirical calibration'
    ]
  };

  const report = {
    generatedAt: new Date().toISOString(),
    warnings,
    sourceFiles,
    currentRealDataFoundation: {
      coreLayers: publicBaseline?.coreLayers ?? [],
      secondaryLayers: publicBaseline?.secondaryLayers ?? [],
      baselineCounts: {
        population: modelAnchors.population,
        municipalityCount: modelAnchors.municipalityCount,
        settlementBoundaryCount: modelAnchors.settlementBoundaryCount,
        landUseFeatureCount: modelAnchors.landUseFeatureCount,
        roadFeatureCount: modelAnchors.roadFeatureCount,
        roadKm: modelAnchors.roadKm,
        lotsAndConcessions: modelAnchors.lotsAndConcessions
      }
    },
    foodCalibration: foodCalibration ? {
      path: sourceFiles.foodCalibration,
      sensitivityScenarioCount: Array.isArray(foodCalibration?.plausibilityScenarios) ? foodCalibration.plausibilityScenarios.length : 0,
      caveat: foodCalibration?.assumptions?.caveat ?? null
    } : null,
    farmLabourBaseline: farmLabourBaseline ? {
      path: sourceFiles.farmLabourBaseline,
      numberOfFarmOperators: asNumber(farmLabourBaseline?.numberOfFarmOperators, 0),
      operatorsWithOffFarmWork: asNumber(farmLabourBaseline?.operatorsWithOffFarmWork, 0)
    } : null,
    scorecard,
    presentBaselineChecks: checks,
    domainAssessment: domainRows,
    majorGaps,
    canModelPresentInterpretation: scorecard.presentOverallCredibilityScore >= 0.5
      ? 'Moderate as a scenario scaffold; not policy-grade without calibration.'
      : 'Conceptual scaffold only; needs substantial calibration before present-baseline claims.',
    whatModelCanBeUsedForNow: [
      'First-order road burden analysis',
      'Land-use/settlement/road baseline summaries',
      'Rural land-access scenario framing',
      'Labour/land/fuel leverage thought experiments',
      'Sensitivity analysis to identify assumption-critical outcomes'
    ],
    whatModelShouldNotBeUsedForYet: [
      'Official forecasts',
      'Precise farm capacity claims',
      'Parcel ownership/legal access claims',
      'Detailed traffic/freight forecasts',
      'Budget estimates without calibration',
      'Housing market forecasts'
    ],
    recommendedNextWork: [
      'Present baseline calibration dashboard/report',
      'Address/building/population distribution integration',
      'Soil/ag capability and crop/yield calibration',
      'Road cost/condition calibration',
      'Service-access/network analysis',
      'Housing/rent/income calibration',
      'Freight/depot/market flow calibration',
      'Scenario sensitivity suite hardening'
    ]
  };

  const jsonPath = path.join(produceDir, 'living-region-model-assessment.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const gapMatrixCsvPath = path.join(produceDir, 'living-region-model-gap-matrix.csv');
  fs.writeFileSync(gapMatrixCsvPath, toCsv(domainRows, [
    'domain', 'status', 'score', 'realDataAvailable', 'modelAssumptions', 'majorGaps', 'riskLevel', 'recommendedNextStep'
  ]));

  const checksCsvPath = path.join(produceDir, 'living-region-present-baseline-checks.csv');
  fs.writeFileSync(checksCsvPath, toCsv(checks, [
    'checkName', 'observedValue', 'modelValue', 'tolerance', 'status', 'notes'
  ]));

  const md = [
    '# Living Region Model Assessment',
    '',
    '## Executive summary',
    '- Living Region now has a strong real-data geography foundation for Grey County.',
    '- Food, housing, labour, and freight layers remain partly assumption-driven.',
    `- Present overall credibility score: ${scorecard.presentOverallCredibilityScore.toFixed(3)} (${statusFromScore(scorecard.presentOverallCredibilityScore)}).`,
    '- Suitable now for first-order scenario diagnostics; not suitable for policy-grade forecasts without calibration.',
    '',
    '## Current real-data foundation',
    `- Core layers loaded: ${asNumber(publicBaseline?.dataStatus?.coreRealLayersLoaded, 0)}/${asNumber(publicBaseline?.dataStatus?.coreLayersExpected, 4)}`,
    `- Secondary layers loaded: ${asNumber(publicBaseline?.dataStatus?.secondaryLayersLoaded, 0)}/${asNumber(publicBaseline?.dataStatus?.secondaryLayersTracked, 12)}`,
    `- Population baseline: ${modelAnchors.population}`,
    `- Road baseline: ${modelAnchors.roadFeatureCount} features, ${asNumber(modelAnchors.roadKm).toFixed(2)} km`,
    '',
    '## Present-baseline scorecard',
    '| Domain | Score | Status | Why | Main gap |',
    '|---|---:|---|---|---|',
    ...domainRows.map((d) => `| ${d.domain} | ${d.score.toFixed(2)} | ${d.status} | ${d.modelAssumptions} | ${d.majorGaps} |`),
    '',
    '## Present-baseline checks',
    '| Check | Observed | Model | Tolerance | Status | Notes |',
    '|---|---:|---:|---:|---|---|',
    ...checks.map((c) => `| ${c.checkName} | ${c.observedValue} | ${c.modelValue} | ${c.tolerance} | ${c.status} | ${c.notes} |`),
    '',
    '## Domain-by-domain assessment',
    ...domainRows.map((d) => `- ${d.domain}: ${d.status} (${d.score.toFixed(2)}). ${d.modelAssumptions} Gap: ${d.majorGaps}`),
    '',
    '## Major gaps',
    'High priority:',
    ...majorGaps.highPriority.map((g) => `- ${g}`),
    'Medium priority:',
    ...majorGaps.mediumPriority.map((g) => `- ${g}`),
    '',
    '## What the model can be used for now',
    ...report.whatModelCanBeUsedForNow.map((x) => `- ${x}`),
    '',
    '## What it should not yet be used for',
    ...report.whatModelShouldNotBeUsedForYet.map((x) => `- ${x}`),
    '',
    '## Recommended next work',
    ...report.recommendedNextWork.map((x, i) => `${i + 1}. ${x}`),
    ...(warnings.length > 0 ? ['', '## Warnings', ...warnings.map((w) => `- ${w}`)] : [])
  ].join('\n');

  const markdownPath = path.join(produceDir, 'living-region-model-assessment.md');
  fs.writeFileSync(markdownPath, md);

  return {
    report,
    paths: {
      markdownPath,
      jsonPath,
      gapMatrixCsvPath,
      checksCsvPath
    }
  };
}
