// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';

function n(v, fallback = 0) { const x = Number(v); return Number.isFinite(x) ? x : fallback; }

function readJsonIfExists(filePath, warnings, label, fallback = null) {
  if (!fs.existsSync(filePath)) {
    warnings.push(`Missing ${label}: ${filePath}`);
    return fallback;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    warnings.push(`Failed to parse ${label}: ${filePath} (${error.message})`);
    return fallback;
  }
}

export function buildGreyPlainEnglishBriefingReport(options = {}) {
  const produceDir = path.resolve(options.produceDir ?? 'know/produce');
  fs.mkdirSync(produceDir, { recursive: true });
  const warnings = [];

  const suite = readJsonIfExists(path.join(produceDir, 'grey-report-suite-summary.json'), warnings, 'suite summary', {});
  const assessment = readJsonIfExists(path.join(produceDir, 'living-region-model-assessment.json'), warnings, 'model assessment', {});
  const publicBaseline = readJsonIfExists(path.join(produceDir, 'grey-public-baseline.json'), warnings, 'public baseline', {});
  const population = readJsonIfExists(path.join(produceDir, 'grey-population-distribution.json'), warnings, 'population distribution', {});
  const dwelling = readJsonIfExists(path.join(produceDir, 'grey-dwelling-land-access.json'), warnings, 'dwelling land access', {});
  const agLabour = readJsonIfExists(path.join(produceDir, 'grey-ag-labour-baseline.json'), warnings, 'ag labour baseline', {});
  const foodCal = readJsonIfExists(path.join(produceDir, 'grey-food-calibration.json'), warnings, 'food calibration', {});
  const fuelShock = readJsonIfExists(path.join(produceDir, 'grey-fuel-fertilizer-shock.json'), warnings, 'fuel shock', {});
  const transition = readJsonIfExists(path.join(produceDir, 'grey-transition-pathways.json'), warnings, 'transition pathways', {});
  const localization = readJsonIfExists(path.join(produceDir, 'grey-localization-access.json'), warnings, 'localization access', {});
  const landAccess = readJsonIfExists(path.join(produceDir, 'grey-land-access-baseline.json'), warnings, 'land access baseline', {});
  const labourLand = readJsonIfExists(path.join(produceDir, 'grey-labour-land-baseline.json'), warnings, 'labour-land baseline', {});

  const scenarios = new Map((foodCal.plausibilityScenarios ?? []).map((s) => [s.scenario, s]));
  const foodScenarioAssumptions = foodCal.scenarioAssumptions ?? {};
  const fuelScenarioAssumptions = fuelShock.scenarioAssumptions ?? {};
  const shock20 = (fuelShock.shockScenarios ?? []).find((s) => s.scenario === 'shock20') ?? {};
  const shock40 = (fuelShock.shockScenarios ?? []).find((s) => s.scenario === 'shock40') ?? {};
  const shock20Combined = (fuelShock.adaptationComparisons ?? []).find((s) => s.scenario === 'shock20' && s.adaptationPackage === 'combinedResiliencePackage') ?? {};
  const lowFuelFoodWorkersNeeded = n(labourLand.regionalIndicators?.lowFuelFoodWorkersNeeded, 0);
  const currentAgIndustryFTEEstimate = n(agLabour.currentAgIndustryFTEEstimate, 3918.43);

  const numbers = {
    population2021: n(publicBaseline.regionalIndicators?.population2021, 100905),
    dwellings: n(population.totalDwellingsMatched, 50183),
    municipalities: n(publicBaseline.coreLayers?.find?.((x) => x.id === 'municipality-boundaries')?.featureCount, 9),
    settlements: n(publicBaseline.regionalIndicators?.settlementBoundaryCount, 56),
    roadKm: n(publicBaseline.regionalIndicators?.totalRoadKm, 4794.16),
    lotsConcessions: n(suite.keyIndicators?.totalLotsConcessions, n(landAccess.assignment?.totalLotConcessionFeatures, 10137)),
    insideSettlementPopulation: n(population.populationInsideSettlementBoundaries, 49882),
    outsideSettlementPopulation: n(population.populationOutsideSettlementBoundaries, 51023),
    noDirectLandAccessPopulation: n(dwelling.estimatedPopulationNoDirectLandAccess, 7990),
    subsistencePotentialPopulation: n(dwelling.estimatedPopulationWithSubsistencePotential, 54949),
    dwellingsAtSubsistence: n((dwelling.thresholdSensitivity ?? []).find((x) => x.thresholdScenario === 'baseline')?.dwellingsAtOrAboveSubsistence, 28311),
    presentIndustrialCoverage: n(scenarios.get('presentIndustrialFossilBaseline')?.foodCoverage, 4.617),
    localizedPresentCoverage: n(scenarios.get('localizedPresentTechBaseline')?.foodCoverage, 0.472),
    constrainedCoverage: n(scenarios.get('constrainedLocalFoodBaseline')?.foodCoverage, 0.277),
    lowFuelCoverage: n(foodCal.landEnoughDiagnostic?.lowFuelFoodCoverage, 0.167),
    agricultureIndustryWorkers: n(agLabour.agricultureIndustryWorkers, 4721),
    currentAgIndustryFTEEstimate,
    lowFuelLabourScaleUpFactor: n(agLabour.agLabourScaleUpFactorLowFuelIndustry, 10.42),
    shock20Coverage: n(shock20.foodCoverage, 0.355),
    shock20AddedWorkers: n(shock20.addedFoodWorkersNeededVsCurrent, 26930.46),
    shock20ScaleUp: n(shock20.agLabourScaleUpFactor, 7.87),
    shock20CombinedCoverage: n(shock20Combined.foodCoverage, 0.441),
    shock40Coverage: n(shock40.foodCoverage, 0.289),
    shock40AddedWorkers: n(shock40.addedFoodWorkersNeededVsCurrent, 31537.88),
    shock20NoChangeRisk: n(transition.suiteKeyResults?.shock20NoChangeFoodInsecureRiskPopulation2030, 69385),
    shock20StrongRisk: n(transition.suiteKeyResults?.shock20StrongAdaptationFoodInsecureRiskPopulation2030, 51094),
    shock20AvoidedRisk: n(transition.suiteKeyResults?.avoidedFoodInsecureRiskVsNoChange2030, 18291),
    severeNoChangeQol: n(transition.suiteKeyResults?.severeDecline2050NoChangeQualityOfLifeIndex, 0.345),
    severeFullQol: n(transition.suiteKeyResults?.severeDecline2050FullRuralTransitionQualityOfLifeIndex, 0.870)
  };

  const findings = [
    {
      title: 'Gross land-base potential appears high under present industrial input assumptions.',
      details: `presentIndustrialFossilBaseline foodCoverage is ${numbers.presentIndustrialCoverage.toFixed(3)}. This is land-base potential under current machinery/fuel/input assumptions, not current local self-reliance.`
    },
    {
      title: 'Local food self-reliance is much lower than gross potential.',
      details: `localizedPresentTechBaseline is ${numbers.localizedPresentCoverage.toFixed(3)}, constrainedLocalFoodBaseline is ${numbers.constrainedCoverage.toFixed(3)}, and low-fuel coverage is ${numbers.lowFuelCoverage.toFixed(3)}.`
    },
    {
      title: 'Population is almost evenly split inside vs outside settlement boundaries (Census DB based).',
      details: `Inside settlement: ${numbers.insideSettlementPopulation.toLocaleString('en-CA')}; outside settlement: ${numbers.outsideSettlementPopulation.toLocaleString('en-CA')}.`
    },
    {
      title: 'Outside settlement is not the same as usable land access.',
      details: `Dwelling-land proxy estimates no direct land access at about ${numbers.noDirectLandAccessPopulation.toLocaleString('en-CA')} and subsistence-potential population around ${numbers.subsistencePotentialPopulation.toLocaleString('en-CA')}.`
    },
    {
      title: 'Agricultural labour remains a major transition bottleneck.',
      details: `Agriculture-industry workers: ${numbers.agricultureIndustryWorkers.toLocaleString('en-CA')}; current ag-industry FTE estimate: ${numbers.currentAgIndustryFTEEstimate.toFixed(0)}; low-fuel labour scale-up factor: about ${numbers.lowFuelLabourScaleUpFactor.toFixed(2)}x.`
    },
    {
      title: 'Fuel/fertilizer shocks are serious but not all-or-nothing.',
      details: `Shock20 foodCoverage is ${numbers.shock20Coverage.toFixed(3)} with ${numbers.shock20AddedWorkers.toFixed(0)} added workers needed; combined resilience package raises shock20 coverage to ${numbers.shock20CombinedCoverage.toFixed(3)}.`
    },
    {
      title: 'Global shock assumptions are not the same as direct local crop loss.',
      details: 'A one-third global food production loss scenario is treated as global price/import competition and affordability stress pressure, not automatic one-third local production loss in Grey.'
    },
    {
      title: 'Adaptation pathways reduce risk exposure and can improve quality of life.',
      details: `Shock20 no-change risk exposure (2030): ${numbers.shock20NoChangeRisk.toLocaleString('en-CA')}; strong adaptation: ${numbers.shock20StrongRisk.toLocaleString('en-CA')}; avoided exposure: ${numbers.shock20AvoidedRisk.toLocaleString('en-CA')}. Severe-decline 2050 quality-of-life index: no-change ${numbers.severeNoChangeQol.toFixed(3)} vs full rural transition ${numbers.severeFullQol.toFixed(3)}.`
    }
  ];

  const scenarioLabourRows = [
    {
      scenario: 'lowFuelTransitionBaseline',
      source: 'labourLandBaselineFTE',
      fuelAvailabilityIndex: n(foodScenarioAssumptions.lowFuelTransitionBaseline?.fuelAvailabilityIndex),
      fertilizerAvailabilityIndex: n(foodScenarioAssumptions.lowFuelTransitionBaseline?.fertilizerAvailabilityIndex),
      machinerySupportFactor: n(foodScenarioAssumptions.lowFuelTransitionBaseline?.machinerySupportFactor),
      transportFuelAvailabilityIndex: n(foodScenarioAssumptions.lowFuelTransitionBaseline?.transportFuelAvailabilityIndex),
      netGJPerHa: n(foodScenarioAssumptions.lowFuelTransitionBaseline?.netGJPerHa),
      foodCoverage: n(foodScenarioAssumptions.lowFuelTransitionBaseline?.foodCoverage),
      foodWorkersNeededFTE: lowFuelFoodWorkersNeeded > 0 ? lowFuelFoodWorkersNeeded : n(foodScenarioAssumptions.lowFuelTransitionBaseline?.foodWorkersNeededFTE),
      addedFoodWorkersNeeded: Math.max(0, (lowFuelFoodWorkersNeeded > 0 ? lowFuelFoodWorkersNeeded : n(foodScenarioAssumptions.lowFuelTransitionBaseline?.foodWorkersNeededFTE)) - currentAgIndustryFTEEstimate),
      currentAgIndustryFTEEstimate,
      agLabourScaleUpFactor: n(agLabour.agLabourScaleUpFactorLowFuelIndustry)
    },
    {
      scenario: 'shock20',
      source: 'fuelShockFTE',
      fuelAvailabilityIndex: n(fuelScenarioAssumptions.shock20?.fuelAvailabilityIndex),
      fertilizerAvailabilityIndex: n(fuelScenarioAssumptions.shock20?.fertilizerAvailabilityIndex),
      machinerySupportFactor: n(fuelScenarioAssumptions.shock20?.machinerySupportFactor),
      transportFuelAvailabilityIndex: n(fuelScenarioAssumptions.shock20?.transportFuelAvailabilityIndex),
      netGJPerHa: n(fuelScenarioAssumptions.shock20?.effectiveNetGJPerHa),
      foodCoverage: n(fuelScenarioAssumptions.shock20?.foodCoverage),
      foodWorkersNeededFTE: n(fuelScenarioAssumptions.shock20?.foodWorkersNeededFTE),
      addedFoodWorkersNeeded: n(shock20.addedFoodWorkersNeededVsCurrent),
      currentAgIndustryFTEEstimate,
      agLabourScaleUpFactor: n(shock20.agLabourScaleUpFactor)
    },
    {
      scenario: 'shock40',
      source: 'fuelShockFTE',
      fuelAvailabilityIndex: n(fuelScenarioAssumptions.shock40?.fuelAvailabilityIndex),
      fertilizerAvailabilityIndex: n(fuelScenarioAssumptions.shock40?.fertilizerAvailabilityIndex),
      machinerySupportFactor: n(fuelScenarioAssumptions.shock40?.machinerySupportFactor),
      transportFuelAvailabilityIndex: n(fuelScenarioAssumptions.shock40?.transportFuelAvailabilityIndex),
      netGJPerHa: n(fuelScenarioAssumptions.shock40?.effectiveNetGJPerHa),
      foodCoverage: n(fuelScenarioAssumptions.shock40?.foodCoverage),
      foodWorkersNeededFTE: n(fuelScenarioAssumptions.shock40?.foodWorkersNeededFTE),
      addedFoodWorkersNeeded: n(shock40.addedFoodWorkersNeededVsCurrent),
      currentAgIndustryFTEEstimate,
      agLabourScaleUpFactor: n(shock40.agLabourScaleUpFactor)
    },
    {
      scenario: 'combinedResiliencePackage (shock20)',
      source: 'fuelShockAdaptationDelta',
      fuelAvailabilityIndex: n(fuelScenarioAssumptions.shock20?.fuelAvailabilityIndex),
      fertilizerAvailabilityIndex: n(fuelScenarioAssumptions.shock20?.fertilizerAvailabilityIndex),
      machinerySupportFactor: n(fuelScenarioAssumptions.shock20?.machinerySupportFactor),
      transportFuelAvailabilityIndex: n(fuelScenarioAssumptions.shock20?.transportFuelAvailabilityIndex),
      netGJPerHa: n(fuelScenarioAssumptions.shock20?.effectiveNetGJPerHa),
      foodCoverage: n(fuelScenarioAssumptions.combinedResiliencePackage?.foodCoverage),
      foodWorkersNeededFTE: n(fuelScenarioAssumptions.combinedResiliencePackage?.requiredNewFoodWorkers) + currentAgIndustryFTEEstimate,
      addedFoodWorkersNeeded: n(fuelScenarioAssumptions.combinedResiliencePackage?.requiredNewFoodWorkers),
      currentAgIndustryFTEEstimate,
      agLabourScaleUpFactor: currentAgIndustryFTEEstimate > 0
        ? (n(fuelScenarioAssumptions.combinedResiliencePackage?.requiredNewFoodWorkers) + currentAgIndustryFTEEstimate) / currentAgIndustryFTEEstimate
        : 0
    }
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    title: 'Living Region Grey County: Early Findings from the First Real-Data Baseline',
    oneParagraphSummary:
      'Living Region now combines real Grey County open data, Census small-area population geography, land-use and road data, lots/concessions reference fabric, food-energy assumptions, labour estimates, and shock scenarios to explore how land, food, transport, labour, and local infrastructure interact.',
    realDataBackedNow: {
      population2021: numbers.population2021,
      dwellings: numbers.dwellings,
      municipalityBoundaryCount: numbers.municipalities,
      settlementBoundaryCount: numbers.settlements,
      totalRoadKm: numbers.roadKm,
      lotsConcessionsFeatureCount: numbers.lotsConcessions,
      censusDbMatchPopulation: n(population.totalPopulationMatched, numbers.population2021),
      insideSettlementPopulation: numbers.insideSettlementPopulation,
      outsideSettlementPopulation: numbers.outsideSettlementPopulation,
      supportingLayersStatus: 'Transit, trails, cycling, facilities, rural businesses, managed forest, road condition, and related layers are loaded where available.'
    },
    keyNumbers: numbers,
    scenarioLabourRows,
    scenarioAssumptions: {
      presentIndustrialFossilBaseline: foodScenarioAssumptions.presentIndustrialFossilBaseline ?? null,
      localizedPresentTechBaseline: foodScenarioAssumptions.localizedPresentTechBaseline ?? null,
      constrainedLocalFoodBaseline: foodScenarioAssumptions.constrainedLocalFoodBaseline ?? null,
      lowFuelTransitionBaseline: foodScenarioAssumptions.lowFuelTransitionBaseline ?? null,
      shock20: fuelScenarioAssumptions.shock20 ?? null,
      shock40: fuelScenarioAssumptions.shock40 ?? null,
      combinedResiliencePackage: fuelScenarioAssumptions.combinedResiliencePackage ?? null
    },
    findings,
    whatThisMeansInPlainLanguage: [
      'The land base itself is probably not the main limiting factor.',
      'A severe global food shock does not automatically mean the same percent loss in local Grey production; near-term pressure is mostly price/import affordability.',
      'The current food system is organized around long supply chains and external market orientation.',
      'Local resilience depends on storage, processing, distribution, labour, tools/repair, land access, and training capacity.',
      'Starting earlier lowers the chance of a disruptive transition.',
      'Perennials, depots, tool libraries, and training are multi-year efforts.'
    ],
    modelUseNow: [
      'baseline reporting',
      'scenario comparison',
      'identifying bottlenecks',
      'testing assumptions and sensitivity',
      'prioritizing data gaps',
      'public planning discussion support'
    ],
    shouldNotUseYet: [
      'official forecasts',
      'exact farm-capacity claims',
      'parcel ownership or legal-access claims',
      'precise hunger forecasts',
      'exact budget estimates',
      'engineering/capital-plan decisions'
    ],
    biggestDataGaps: [
      'current parcel/assessment fabric',
      'address points/building footprints and dwelling units by parcel',
      'CD-level agriculture occupation minor-group rows (98-10-0594-01) and related class-of-worker tables',
      'Census of Agriculture farm-operator rows',
      'soil/crop/ag capability calibration',
      'measured local processing/storage capacity',
      'traffic and freight flow data',
      'road/bridge maintenance cost calibration',
      'household income/rent distribution'
    ],
    recommendedNextSteps: [
      'Validate parcel and land-access assumptions with improved parcel/assessment datasets.',
      'Load CD-level minor-group occupation rows (98-10-0594-01) with 98-10-0591-01/98-10-0592-01 and Census of Agriculture tables.',
      'Improve soil/crop/yield calibration.',
      'Review candidate food hub/storage/tool/depot nodes with local expertise.',
      'Use transition pathways to compare no-change, moderate adaptation, and strong adaptation choices.'
    ],
    caveats: [
      'This is early diagnostic modelling, not an official forecast.',
      'Risk-exposure outputs are not direct hunger forecasts.',
      'Lots/concessions are historical land-structure references, not ownership parcels.',
      'Quality-of-life index is a scenario composite indicator, not a direct survey score.'
    ],
    sourceFiles: [
      'grey-report-suite-summary.json',
      'living-region-model-assessment.json',
      'grey-public-baseline.json',
      'grey-population-distribution.json',
      'grey-dwelling-land-access.json',
      'grey-ag-labour-baseline.json',
      'grey-food-calibration.json',
      'grey-fuel-fertilizer-shock.json',
      'grey-transition-pathways.json',
      'grey-localization-access.json',
      'grey-land-access-baseline.json',
      'grey-labour-land-baseline.json'
    ],
    warnings
  };

  const md = [
    '# Living Region Grey County: Early Findings',
    '',
    '## One-paragraph summary',
    report.oneParagraphSummary,
    '',
    '## What is real data-backed now',
    `- 2021 population: ${numbers.population2021.toLocaleString('en-CA')}`,
    `- Dwellings: ${numbers.dwellings.toLocaleString('en-CA')}`,
    `- Municipal boundaries: ${numbers.municipalities}`,
    `- Settlement boundaries: ${numbers.settlements}`,
    `- Road network: about ${numbers.roadKm.toLocaleString('en-CA', { maximumFractionDigits: 2 })} km`,
    `- Lots/concessions: ${numbers.lotsConcessions.toLocaleString('en-CA')}`,
    `- Census DB geometry matched population: ${n(population.totalPopulationMatched, numbers.population2021).toLocaleString('en-CA')}`,
    `- Inside settlement population: ${numbers.insideSettlementPopulation.toLocaleString('en-CA')}`,
    `- Outside settlement population: ${numbers.outsideSettlementPopulation.toLocaleString('en-CA')}`,
    '- Transit/trails/cycling/facilities/rural business/managed forest/road condition layers are loaded where available.',
    '',
    '## Main findings so far',
    ...findings.flatMap((f, idx) => [`### Finding ${idx + 1}`, f.title, f.details, '']),
    '## Scenario assumption snapshot',
    'A named scenario is only meaningful if its assumptions are visible.',
    '| Scenario | Fuel availability | Fertilizer availability | Machinery support | Transport support | Net GJ/ha | Food coverage | foodWorkersNeededFTE | addedFoodWorkersNeeded | currentAgIndustryFTEEstimate | agLabourScaleUpFactor | Interpretation |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|',
    ...scenarioLabourRows.map((r) => `| ${r.scenario} | ${r.fuelAvailabilityIndex.toFixed(2)} | ${r.fertilizerAvailabilityIndex.toFixed(2)} | ${r.machinerySupportFactor.toFixed(2)} | ${r.transportFuelAvailabilityIndex.toFixed(2)} | ${r.netGJPerHa.toFixed(2)} | ${r.foodCoverage.toFixed(3)} | ${r.foodWorkersNeededFTE.toFixed(2)} | ${r.addedFoodWorkersNeeded.toFixed(2)} | ${r.currentAgIndustryFTEEstimate.toFixed(2)} | ${r.agLabourScaleUpFactor.toFixed(2)} | ${r.source} |`,
    ),
    '',
    '## What this means in plain language',
    ...report.whatThisMeansInPlainLanguage.map((x) => `- ${x}`),
    '',
    '## What the model can be used for now',
    ...report.modelUseNow.map((x) => `- ${x}`),
    '',
    '## What it should not be used for yet',
    ...report.shouldNotUseYet.map((x) => `- ${x}`),
    '',
    '## Biggest remaining data gaps',
    ...report.biggestDataGaps.map((x) => `- ${x}`),
    '',
    '## Recommended next steps',
    '1. Validate parcel/land-access assumptions with better parcel or assessment data if available.',
    '2. Load core agricultural occupation and Census of Agriculture tables.',
    '3. Improve soil/crop/yield calibration.',
    '4. Review candidate food hub/storage/tool/depot sites with local knowledge.',
    '5. Use transition pathway report to compare no-change, moderate adaptation, and strong adaptation.',
    '',
    '## Caveats',
    ...report.caveats.map((x) => `- ${x}`),
    '',
    '## Warnings',
    ...(report.warnings.length ? report.warnings.map((x) => `- ${x}`) : ['- none'])
  ].join('\n');

  const email = [
    'Subject: Living Region Grey County – Early Findings (Real-Data Baseline)',
    '',
    'Living Region now has a first real-data baseline for Grey County that combines Census small-area population geography, municipal/settlement/land-use/road layers, lots-concessions reference fabric, and scenario diagnostics for food, labour, transport, and resilience.',
    '',
    `The main high-level result is that Grey appears to have strong gross land-base potential under present industrial-input assumptions (food coverage ${numbers.presentIndustrialCoverage.toFixed(3)}), but much lower local self-reliance under localized and constrained assumptions (about ${numbers.localizedPresentCoverage.toFixed(3)} and ${numbers.constrainedCoverage.toFixed(3)}). The low-fuel transition baseline here is explicitly parameterized at fuel availability about ${n(foodScenarioAssumptions.lowFuelTransitionBaseline?.fuelAvailabilityIndex).toFixed(2)}, fertilizer availability about ${n(foodScenarioAssumptions.lowFuelTransitionBaseline?.fertilizerAvailabilityIndex).toFixed(2)}, and machinery support about ${n(foodScenarioAssumptions.lowFuelTransitionBaseline?.machinerySupportFactor).toFixed(2)} (food coverage ${numbers.lowFuelCoverage.toFixed(3)}). In plain terms, land alone is not the main bottleneck; system organization is.`,
    '',
    `Population distribution is now grounded in Census dissemination blocks: ${numbers.insideSettlementPopulation.toLocaleString('en-CA')} inside settlement boundaries and ${numbers.outsideSettlementPopulation.toLocaleString('en-CA')} outside. The new dwelling-land proxy also shows outside-settlement does not automatically mean land access: about ${numbers.noDirectLandAccessPopulation.toLocaleString('en-CA')} people are still estimated as no-direct-access, while about ${numbers.subsistencePotentialPopulation.toLocaleString('en-CA')} are in a subsistence-potential band (proxy estimate, not parcel ownership).`,
    '',
    `Labour remains a major issue. Current agriculture-industry labour is about ${numbers.currentAgIndustryFTEEstimate.toFixed(0)} FTE-equivalent (industry proxy). The low-fuel transition baseline uses the labour-land value of about ${scenarioLabourRows.find((r) => r.scenario === 'lowFuelTransitionBaseline')?.foodWorkersNeededFTE.toFixed(0)} total food workers needed FTE, with about ${scenarioLabourRows.find((r) => r.scenario === 'lowFuelTransitionBaseline')?.addedFoodWorkersNeeded.toFixed(0)} added workers versus current ag-industry FTE. In the fuel shock diagnostics, shock20 is about ${scenarioLabourRows.find((r) => r.scenario === 'shock20')?.foodWorkersNeededFTE.toFixed(0)} total food workers needed FTE and about ${scenarioLabourRows.find((r) => r.scenario === 'shock20')?.addedFoodWorkersNeeded.toFixed(0)} added workers needed.`,
    '',
    `Transition pathways now compare no-change vs stronger adaptation over time. For shock20 in 2030, no-change risk exposure is about ${numbers.shock20NoChangeRisk.toLocaleString('en-CA')} versus ${numbers.shock20StrongRisk.toLocaleString('en-CA')} under strong adaptation (about ${numbers.shock20AvoidedRisk.toLocaleString('en-CA')} avoided exposure in this model). Under severe decline by 2050, quality-of-life index is much higher under full transition (${numbers.severeFullQol.toFixed(3)}) than no-change (${numbers.severeNoChangeQol.toFixed(3)}), while still explicitly not treated as a perfect outcome.`,
    '',
    'This is early diagnostic modelling, not an official forecast. It is best used for comparing assumptions, identifying bottlenecks, and planning next data/calibration priorities (parcel/access detail, core ag occupation rows, Census of Agriculture, soil/crop calibration, and local processing/storage capacity).'
  ].join('\n\n');

  const paths = {
    markdownPath: path.join(produceDir, 'grey-plain-english-briefing.md'),
    jsonPath: path.join(produceDir, 'grey-plain-english-briefing.json'),
    emailSummaryPath: path.join(produceDir, 'grey-plain-english-email-summary.md')
  };
  fs.writeFileSync(paths.markdownPath, md);
  fs.writeFileSync(paths.jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(paths.emailSummaryPath, email);

  return { report, paths };
}
