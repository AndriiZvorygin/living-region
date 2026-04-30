// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const produceDirDefault = path.resolve('know/produce');

export function parseArgs(argv = process.argv.slice(2)) {
  const opts = {
    skipDownload: false,
    forceDownload: false,
    quick: false,
    json: false,
    continueOnError: false,
    strict: false
  };
  for (const arg of argv) {
    if (arg === '--skip-download') opts.skipDownload = true;
    else if (arg === '--force-download') opts.forceDownload = true;
    else if (arg === '--quick') opts.quick = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--continue-on-error') opts.continueOnError = true;
    else if (arg === '--strict') opts.strict = true;
  }
  if (opts.quick) opts.skipDownload = true;
  return opts;
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function cmd(script, args = []) {
  return { script, args };
}

export function buildCommandPlan(options = {}, fsState = {}) {
  const quick = Boolean(options.quick);
  const skipDownload = Boolean(options.skipDownload || quick);
  const forceDownload = Boolean(options.forceDownload);
  const worldExists = fsState.worldExists ?? exists(path.join(produceDirDefault, 'grey-open-data-world.json'));

  const plan = [];
  if (!skipDownload) {
    const args = ['--all-useful'];
    if (forceDownload) args.push('--force');
    plan.push(cmd('grey:download-data', args));
    const lotArgs = ['--source=lots-and-concessions-grey'];
    if (forceDownload) lotArgs.push('--force');
    plan.push(cmd('grey:download-data', lotArgs));
  }

  if (!(quick && worldExists)) {
    plan.push(cmd('grey:import-data'));
  }

  plan.push(cmd('report:grey:baseline'));
  plan.push(cmd('report:grey:secondary'));
  plan.push(cmd('report:grey:public-baseline'));
  plan.push(cmd('report:grey:land-access'));
  plan.push(cmd('report:grey:population-distribution'));
  plan.push(cmd('report:grey:dwelling-land-access', ['--no-cache']));
  plan.push(cmd('report:grey:labour-land'));
  plan.push(cmd('report:grey:farm-labour'));
  plan.push(cmd('report:grey:ag-labour'));
  plan.push(cmd('report:grey:food-calibration'));
  plan.push(cmd('report:grey:localization-access'));
  plan.push(cmd('report:model:assessment'));
  plan.push(cmd('grey:status'));
  return plan;
}

function runNpmScript(script, args = []) {
  return spawnSync('npm', ['run', script, ...(args.length ? ['--', ...args] : [])], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 30
  });
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

export function extractKeyIndicators(data = {}) {
  const assessment = data.assessment ?? {};
  const publicBaseline = data.publicBaseline ?? {};
  const landAccess = data.landAccess ?? {};
  const dwellingLandAccess = data.dwellingLandAccess ?? {};
  const dwellingValid = dwellingLandAccess.dwellingLandAccessValid !== false;
  const labourLand = data.labourLand ?? {};
  const farmLabour = data.farmLabour ?? {};
  const agLabour = data.agLabour ?? {};
  const foodCal = data.foodCalibration ?? {};
  const localization = data.localization ?? {};

  const scenarios = new Map((foodCal.plausibilityScenarios ?? []).map((s) => [s.scenario, s]));
  return {
    presentOverallCredibilityScore: Number(assessment.scorecard?.presentOverallCredibilityScore ?? 0),
    presentGeographyScore: Number(assessment.scorecard?.presentGeographyScore ?? 0),
    presentInfrastructureScore: Number(assessment.scorecard?.presentInfrastructureScore ?? 0),
    presentFoodSystemScore: Number(assessment.scorecard?.presentFoodSystemScore ?? 0),
    totalRoadKm: Number(publicBaseline.regionalIndicators?.totalRoadKm ?? 0),
    totalLotsConcessions: Number(landAccess.assignment?.totalLotConcessionFeatures ?? 0),
    foodCoveragePresentIndustrialFossilBaseline: Number(scenarios.get('presentIndustrialFossilBaseline')?.foodCoverage ?? 0),
    foodCoverageLocalizedPresentTechBaseline: Number(scenarios.get('localizedPresentTechBaseline')?.foodCoverage ?? 0),
    foodCoverageConstrainedLocalFoodBaseline: Number(scenarios.get('constrainedLocalFoodBaseline')?.foodCoverage ?? 0),
    lowFuelFoodCoverage: Number(foodCal.landEnoughDiagnostic?.lowFuelFoodCoverage ?? scenarios.get('lowFuelTransitionBaseline')?.foodCoverage ?? 0),
    estimatedNoDirectLandAccessPopulation: Number(labourLand.regionalIndicators?.estimatedNoDirectLandAccessPopulation ?? 0),
    estimatedRuralProductiveLandAccessPopulation: Number(labourLand.regionalIndicators?.estimatedRuralProductiveLandAccessPopulation ?? 0),
    productiveHaPerRuralAccessPerson: Number(labourLand.regionalIndicators?.productiveHaPerRuralAccessPerson ?? 0),
    dwellingLandAccessStatus: dwellingLandAccess.confidence ?? (dwellingValid ? 'valid' : 'invalid_missing_lots'),
    estimatedPopulationNoDirectLandAccess: dwellingValid ? Number(dwellingLandAccess.estimatedPopulationNoDirectLandAccess ?? 0) : null,
    estimatedPopulationWithSubsistencePotential: dwellingValid ? Number(dwellingLandAccess.estimatedPopulationWithSubsistencePotential ?? 0) : null,
    dwellingsAtOrAboveSubsistence: dwellingValid ? Number((dwellingLandAccess.thresholdSensitivity ?? []).find((x) => x.thresholdScenario === 'baseline')?.dwellingsAtOrAboveSubsistence ?? 0) : null,
    currentFarmOperators: Number(farmLabour.currentFarmOperators ?? 0),
    currentFarmLabourDataStatus: String(farmLabour.currentFarmLabourDataStatus ?? 'missing'),
    currentFarmLabourFTEEstimate: Number(farmLabour.currentFarmLabourFTEEstimate ?? 0),
    farmLabourScaleUpFactorLowFuel: Number(farmLabour.farmLabourScaleUpFactorLowFuel ?? 0),
    currentAgRelatedFTEEstimate: Number(agLabour.currentAgRelatedFTEEstimate ?? 0),
    agLabourDataStatus: String(agLabour.agLabourDataStatus ?? 'missing'),
    agLabourScaleUpFactorLowFuel: Number(agLabour.agLabourScaleUpFactorLowFuel ?? 0),
    topReadinessMunicipality: localization.regionalSummary?.highestReadinessMunicipalities?.[0]?.municipalityName ?? null,
    candidateNodeCount: Number((localization.candidateNodes ?? []).length)
  };
}

export function recommendNextActions(indicators = {}, data = {}, produceDir = produceDirDefault) {
  const actions = [];
  if ((indicators.presentFoodSystemScore ?? 0) < 0.7) {
    actions.push('Improve food calibration with soil/agricultural capability and Census of Agriculture data.');
  }
  if ((indicators.candidateNodeCount ?? 0) > 0) {
    actions.push('Review localization candidate nodes with local operators for feasibility and role fit.');
  }
  if (!exists(path.join(produceDir, 'grey-lot-fabric-reference.json'))) {
    actions.push('Add parcel/assessment fabric (if available) to improve land-access realism.');
  }
  const gaps = Array.isArray(data.assessment?.majorGaps) ? data.assessment.majorGaps : [];
  if (gaps.some((g) => String(g).toLowerCase().includes('address'))) {
    actions.push('Add address/building/population distribution data for present-baseline realism.');
  }
  return actions;
}

function buildSuiteSummaryMarkdown(summary) {
  const k = summary.keyIndicators;
  const lines = [
    '# Grey Report Suite Summary',
    '',
    `Generated: ${summary.generatedAt}`,
    '',
    `- Commands run: ${summary.commandResults.length}`,
    `- Commands passed: ${summary.commandResults.filter((r) => r.ok).length}`,
    `- Commands failed: ${summary.failedCount}`,
    `- Warnings detected: ${summary.warningCount}`,
    '',
    '## Key Indicators',
    `- presentOverallCredibilityScore: ${k.presentOverallCredibilityScore?.toFixed?.(3) ?? k.presentOverallCredibilityScore}`,
    `- presentGeographyScore: ${k.presentGeographyScore?.toFixed?.(3) ?? k.presentGeographyScore}`,
    `- presentInfrastructureScore: ${k.presentInfrastructureScore?.toFixed?.(3) ?? k.presentInfrastructureScore}`,
    `- presentFoodSystemScore: ${k.presentFoodSystemScore?.toFixed?.(3) ?? k.presentFoodSystemScore}`,
    `- totalRoadKm: ${k.totalRoadKm?.toFixed?.(2) ?? k.totalRoadKm}`,
    `- total lots/concessions: ${k.totalLotsConcessions}`,
    `- presentIndustrialFossilBaseline foodCoverage: ${k.foodCoveragePresentIndustrialFossilBaseline?.toFixed?.(3) ?? k.foodCoveragePresentIndustrialFossilBaseline}`,
    `- localizedPresentTechBaseline foodCoverage: ${k.foodCoverageLocalizedPresentTechBaseline?.toFixed?.(3) ?? k.foodCoverageLocalizedPresentTechBaseline}`,
    `- constrainedLocalFoodBaseline foodCoverage: ${k.foodCoverageConstrainedLocalFoodBaseline?.toFixed?.(3) ?? k.foodCoverageConstrainedLocalFoodBaseline}`,
    `- lowFuelFoodCoverage: ${k.lowFuelFoodCoverage?.toFixed?.(3) ?? k.lowFuelFoodCoverage}`,
    `- estimatedNoDirectLandAccessPopulation: ${k.estimatedNoDirectLandAccessPopulation}`,
    `- estimatedRuralProductiveLandAccessPopulation: ${k.estimatedRuralProductiveLandAccessPopulation}`,
    `- productiveHaPerRuralAccessPerson: ${k.productiveHaPerRuralAccessPerson?.toFixed?.(3) ?? k.productiveHaPerRuralAccessPerson}`,
    `- dwelling land access: ${k.dwellingLandAccessStatus ?? 'unknown'}`,
    `- estimatedPopulationNoDirectLandAccess (dwelling-threshold proxy): ${k.estimatedPopulationNoDirectLandAccess ?? 'invalid'}`,
    `- estimatedPopulationWithSubsistencePotential: ${k.estimatedPopulationWithSubsistencePotential ?? 'invalid'}`,
    `- dwellingsAtOrAboveSubsistence: ${k.dwellingsAtOrAboveSubsistence ?? 'invalid'}`,
    `- currentFarmOperators: ${k.currentFarmOperators}`,
    `- currentFarmLabourDataStatus: ${k.currentFarmLabourDataStatus}`,
    `- currentFarmLabourFTEEstimate: ${k.currentFarmLabourFTEEstimate}`,
    `- farmLabourScaleUpFactorLowFuel: ${k.farmLabourScaleUpFactorLowFuel?.toFixed?.(2) ?? k.farmLabourScaleUpFactorLowFuel}`,
    `- currentAgRelatedFTEEstimate: ${k.currentAgRelatedFTEEstimate}`,
    `- agLabourDataStatus: ${k.agLabourDataStatus}`,
    `- agLabourScaleUpFactorLowFuel: ${k.agLabourScaleUpFactorLowFuel?.toFixed?.(2) ?? k.agLabourScaleUpFactorLowFuel}`,
    `- top readiness municipality: ${k.topReadinessMunicipality ?? 'unknown'}`,
    `- candidate node count: ${k.candidateNodeCount}`,
    '',
    '## Next Recommended Actions',
    ...summary.nextRecommendedActions.map((a) => `- ${a}`)
  ];
  return lines.join('\n');
}

export function runGreyReportSuite(options = {}) {
  const produceDir = path.resolve(options.produceDir ?? 'know/produce');
  fs.mkdirSync(produceDir, { recursive: true });

  const commandResults = [];
  const warnings = [];

  const plan = buildCommandPlan(options);
  if (Array.isArray(options.mockCommandResults)) {
    commandResults.push(...options.mockCommandResults);
  } else {
    for (const step of plan) {
      const res = runNpmScript(step.script, step.args);
      const ok = res.status === 0;
      const output = `${res.stdout ?? ''}${res.stderr ?? ''}`;
      commandResults.push({
        script: step.script,
        args: step.args,
        ok,
        status: res.status,
        signal: res.signal,
        outputSample: output.slice(0, 1200)
      });
      if (!ok && !options.continueOnError) break;
    }
  }

  if (options.strict) {
    const cmdWarnings = commandResults
      .flatMap((r) => String(r.outputSample ?? '').split('\n'))
      .filter((line) => line.toLowerCase().includes('warning'));
    warnings.push(...cmdWarnings);
  }

  const publicBaseline = readJsonIfExists(path.join(produceDir, 'grey-public-baseline.json'), warnings, 'public baseline');
  const assessment = readJsonIfExists(path.join(produceDir, 'living-region-model-assessment.json'), warnings, 'model assessment');
  const landAccess = readJsonIfExists(path.join(produceDir, 'grey-land-access-baseline.json'), warnings, 'land access baseline');
  const dwellingLandAccess = readJsonIfExists(path.join(produceDir, 'grey-dwelling-land-access.json'), warnings, 'dwelling-land-access baseline');
  const labourLand = readJsonIfExists(path.join(produceDir, 'grey-labour-land-baseline.json'), warnings, 'labour-land baseline');
  const farmLabour = readJsonIfExists(path.join(produceDir, 'grey-farm-labour-baseline.json'), warnings, 'farm-labour baseline');
  const agLabour = readJsonIfExists(path.join(produceDir, 'grey-ag-labour-baseline.json'), warnings, 'ag-labour baseline');
  const foodCalibration = readJsonIfExists(path.join(produceDir, 'grey-food-calibration.json'), warnings, 'food calibration');
  const localization = readJsonIfExists(path.join(produceDir, 'grey-localization-access.json'), warnings, 'localization access');
  const secondary = readJsonIfExists(path.join(produceDir, 'grey-secondary-data-summary.json'), warnings, 'secondary data summary');

  const fileWarnings = [
    ...(publicBaseline?.warnings ?? []),
    ...(assessment?.warnings ?? []),
    ...(landAccess?.warnings ?? []),
    ...(dwellingLandAccess?.warnings ?? []),
    ...(labourLand?.warnings ?? []),
    ...(farmLabour?.warnings ?? []),
    ...(agLabour?.warnings ?? []),
    ...(foodCalibration?.warnings ?? []),
    ...(localization?.warnings ?? [])
  ];
  warnings.push(...fileWarnings);
  if (dwellingLandAccess && dwellingLandAccess.dwellingLandAccessValid === false) {
    warnings.push('dwelling land access: invalid_missing_lots');
  }

  const keyIndicators = extractKeyIndicators({
    publicBaseline,
    assessment,
    landAccess,
    dwellingLandAccess,
    labourLand,
    farmLabour,
    agLabour,
    foodCalibration,
    localization,
    secondary
  });

  const failedCount = commandResults.filter((r) => !r.ok).length;
  const warningCount = warnings.length;
  const nextRecommendedActions = recommendNextActions(keyIndicators, { assessment }, produceDir);

  const summary = {
    generatedAt: new Date().toISOString(),
    commandResults,
    warningCount,
    failedCount,
    keyIndicators,
    outputPaths: {
      suiteMarkdown: path.join(produceDir, 'grey-report-suite-summary.md'),
      suiteJson: path.join(produceDir, 'grey-report-suite-summary.json')
    },
    nextRecommendedActions,
    warnings
  };

  fs.writeFileSync(summary.outputPaths.suiteJson, JSON.stringify(summary, null, 2));
  fs.writeFileSync(summary.outputPaths.suiteMarkdown, buildSuiteSummaryMarkdown(summary));

  return summary;
}

function printSummary(summary) {
  const coreFromPublic = summary.keyIndicators;
  console.log('Grey Report Suite Summary');
  console.log(`- Commands run: ${summary.commandResults.length}`);
  console.log(`- Commands passed: ${summary.commandResults.filter((r) => r.ok).length}`);
  console.log(`- Commands failed: ${summary.failedCount}`);
  console.log(`- Warnings detected: ${summary.warningCount}`);
  console.log('- Core real layers loaded: municipal boundaries, settlement boundaries, land use, roads, lots/concessions');
  console.log('- Secondary layers loaded: transit, trails/cycling, managed forests, rural businesses, public facilities, structures, road condition');
  console.log('- Key indicators:');
  console.log(`  - presentOverallCredibilityScore: ${Number(coreFromPublic.presentOverallCredibilityScore).toFixed(3)}`);
  console.log(`  - presentGeographyScore: ${Number(coreFromPublic.presentGeographyScore).toFixed(3)}`);
  console.log(`  - presentInfrastructureScore: ${Number(coreFromPublic.presentInfrastructureScore).toFixed(3)}`);
  console.log(`  - presentFoodSystemScore: ${Number(coreFromPublic.presentFoodSystemScore).toFixed(3)}`);
  console.log(`  - totalRoadKm: ${Number(coreFromPublic.totalRoadKm).toFixed(2)}`);
  console.log(`  - total lots/concessions: ${coreFromPublic.totalLotsConcessions}`);
  console.log(`  - presentIndustrialFossilBaseline foodCoverage: ${Number(coreFromPublic.foodCoveragePresentIndustrialFossilBaseline).toFixed(3)}`);
  console.log(`  - localizedPresentTechBaseline foodCoverage: ${Number(coreFromPublic.foodCoverageLocalizedPresentTechBaseline).toFixed(3)}`);
  console.log(`  - constrainedLocalFoodBaseline foodCoverage: ${Number(coreFromPublic.foodCoverageConstrainedLocalFoodBaseline).toFixed(3)}`);
  console.log(`  - lowFuelFoodCoverage: ${Number(coreFromPublic.lowFuelFoodCoverage).toFixed(3)}`);
  console.log(`  - estimatedNoDirectLandAccessPopulation: ${coreFromPublic.estimatedNoDirectLandAccessPopulation}`);
  console.log(`  - estimatedRuralProductiveLandAccessPopulation: ${coreFromPublic.estimatedRuralProductiveLandAccessPopulation}`);
  console.log(`  - productiveHaPerRuralAccessPerson: ${Number(coreFromPublic.productiveHaPerRuralAccessPerson).toFixed(3)}`);
  console.log(`  - dwelling land access: ${coreFromPublic.dwellingLandAccessStatus ?? 'unknown'}`);
  console.log(`  - estimatedPopulationNoDirectLandAccess (dwelling-threshold proxy): ${coreFromPublic.estimatedPopulationNoDirectLandAccess ?? 'invalid'}`);
  console.log(`  - estimatedPopulationWithSubsistencePotential: ${coreFromPublic.estimatedPopulationWithSubsistencePotential ?? 'invalid'}`);
  console.log(`  - dwellingsAtOrAboveSubsistence: ${coreFromPublic.dwellingsAtOrAboveSubsistence ?? 'invalid'}`);
  console.log(`  - currentFarmOperators: ${coreFromPublic.currentFarmOperators}`);
  console.log(`  - currentFarmLabourDataStatus: ${coreFromPublic.currentFarmLabourDataStatus}`);
  console.log(`  - currentFarmLabourFTEEstimate: ${coreFromPublic.currentFarmLabourFTEEstimate}`);
  console.log(`  - farmLabourScaleUpFactorLowFuel: ${Number(coreFromPublic.farmLabourScaleUpFactorLowFuel).toFixed(2)}`);
  console.log(`  - currentAgRelatedFTEEstimate: ${coreFromPublic.currentAgRelatedFTEEstimate}`);
  console.log(`  - agLabourDataStatus: ${coreFromPublic.agLabourDataStatus}`);
  console.log(`  - agLabourScaleUpFactorLowFuel: ${Number(coreFromPublic.agLabourScaleUpFactorLowFuel).toFixed(2)}`);
  console.log(`  - top readiness municipality: ${coreFromPublic.topReadinessMunicipality ?? 'unknown'}`);
  console.log(`  - candidate node count: ${coreFromPublic.candidateNodeCount}`);
  console.log(`- summary markdown: ${summary.outputPaths.suiteMarkdown}`);
  console.log(`- summary json: ${summary.outputPaths.suiteJson}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs();
  const summary = runGreyReportSuite(options);
  printSummary(summary);

  const strictWarningFailure = options.strict && summary.warningCount > 0;
  const anyFailures = summary.failedCount > 0;
  if (anyFailures || strictWarningFailure) {
    process.exit(1);
  }
}
