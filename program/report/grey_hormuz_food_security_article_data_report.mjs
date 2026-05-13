// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';

function n(v, fallback = 0) { const x = Number(v); return Number.isFinite(x) ? x : fallback; }
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

const TARGETS = [
  { label: 'food for about 10,000 people', scenario: 'foodGap10' },
  { label: 'food for about 20,000 people', scenario: 'foodGap20' },
  { label: 'food for about 33,000 people', scenario: 'foodGap33' }
];

const MODES = ['lowInputAnnualField', 'marketGardenIntensive', 'handToolHouseholdGarden'];

export function buildGreyHormuzFoodSecurityArticleDataReport(options = {}) {
  const produceDir = path.resolve(options.produceDir ?? 'know/produce');
  fs.mkdirSync(produceDir, { recursive: true });
  const warnings = [];

  const currentShock = readJsonIfExists(path.join(produceDir, 'grey-current-system-shock-threshold.json'), warnings, 'current shock threshold', {});
  const trendProjection = readJsonIfExists(path.join(produceDir, 'grey-food-insecurity-trend-projection.json'), warnings, 'food insecurity trend projection', null);
  const foodPrice = readJsonIfExists(path.join(produceDir, 'grey-food-supply-demand-price.json'), warnings, 'food supply-demand price', {});
  const foodGap = readJsonIfExists(path.join(produceDir, 'grey-food-gap-replacement.json'), warnings, 'food gap replacement', {});
  const dwelling = readJsonIfExists(path.join(produceDir, 'grey-dwelling-land-access.json'), warnings, 'dwelling land access', {});
  const pop = readJsonIfExists(path.join(produceDir, 'grey-population-distribution.json'), warnings, 'population distribution', {});

  const population = n(pop.totalPopulationMatched, n(dwelling.totalPopulation, 100905));
  const measuredShare = n(currentShock.measuredFoodInsecurityAnchor?.defaultMeasuredFoodInsecurityShare, 0.25);
  const measuredBaseline = n(currentShock.measuredFoodInsecurityAnchor?.measuredFoodInsecurityEstimate, population * measuredShare);
  const trend2027Fallback = (currentShock.foodInsecurityTrendProjection ?? []).find((r) => r.trendScenario === 'central' && r.year === 2027) ?? null;
  const preferredTrend = trendProjection?.articlePreferredProjection ?? null;
  const trend2027People = preferredTrend
    ? n(preferredTrend.projected2027People, 0)
    : n(trend2027Fallback?.projectedFoodInsecurePeopleWithoutShock, 0);
  const trend2027Rate = preferredTrend
    ? n(preferredTrend.projected2027RatePct, 0) / 100
    : n(trend2027Fallback?.projectedMeasuredFoodInsecurityShareWithoutShock, 0);

  const passThrough = currentShock.passThroughScenarios ?? [];
  const bands = currentShock.currentDisruptionBands ?? [];
  const severeFraming = currentShock.severeSystemicInputLoss33Framing ?? {};

  const scenarioLookup = {
    currentDisruptionLow: { shock: 'fuelShock5', profile: 'linearConservative', foodPriceScenarioNoAdapt: null, foodPriceScenarioCombined: null },
    currentDisruptionModerate: { shock: 'fuelShock15', profile: 'policyBuffered', foodPriceScenarioNoAdapt: null, foodPriceScenarioCombined: null },
    currentDisruptionSevere: { shock: 'fuelShock20', profile: 'tightMarketNonlinear', foodPriceScenarioNoAdapt: 'shock20NoAdaptation', foodPriceScenarioCombined: 'shock20CombinedLocalResponse' },
    currentDisruptionExtreme: { shock: 'fuelShock30', profile: 'tightMarketNonlinear', foodPriceScenarioNoAdapt: null, foodPriceScenarioCombined: null }
  };

  const foodPriceRows = foodPrice.supplyDemandScenarios ?? [];
  const byScenario = (name) => foodPriceRows.find((r) => r.scenario === name) ?? null;

  const hormuzScenarios = bands.map((band) => {
    const map = scenarioLookup[band.scenario] ?? {};
    const pass = passThrough.find((r) => r.profile === map.profile && r.shockScenario === map.shock) ?? null;
    const noAdapt = map.foodPriceScenarioNoAdapt ? byScenario(map.foodPriceScenarioNoAdapt) : null;
    const combined = map.foodPriceScenarioCombined ? byScenario(map.foodPriceScenarioCombined) : null;

    const estimatedFoodInsecurity = n(pass?.calibratedFoodInsecurityEstimateUnderShock, n(noAdapt?.calibratedFoodInsecurityEstimate, measuredBaseline));
    const addedVsBaseline = Math.max(0, estimatedFoodInsecurity - measuredBaseline);
    const protectedByCombined = (noAdapt && combined)
      ? Math.max(0, n(noAdapt.calibratedFoodInsecurityEstimate) - n(combined.calibratedFoodInsecurityEstimate))
      : null;

    return {
      scenario: band.scenario,
      scenarioBand: band.bandLabel,
      oilDieselStressPct: band.fuelAvailabilityStressPct,
      lngNaturalGasStressPct: band.fuelAvailabilityStressPct,
      nitrogenFertilizerStressPct: band.fertilizerAvailabilityStressPct,
      sulfurPhosphateStressPct: band.fertilizerAvailabilityStressPct,
      shippingStressPct: band.shippingStressPct,
      estimatedFoodPricePressure: n(pass?.foodPriceIncreasePct, band.foodPricePressureIndex * 100),
      foodPricePressureIndex: n(band.foodPricePressureIndex, 0),
      estimatedGreyFoodInsecurity: estimatedFoodInsecurity,
      peopleAddedToFoodInsecurityVsBaseline: addedVsBaseline,
      peopleProtectedByCombinedLocalResponse: protectedByCombined,
      globalFoodProductionLossPct: n(band.globalFoodProductionLossPct, 0),
      localFoodAvailabilityStressPct: n(band.localFoodAvailabilityStressPct, 0),
      caveat: 'Current Hormuz disruption scenario band; severe/extreme cases are stress scenarios, not a forecast.'
    };
  });

  const matrix = foodGap.modalityReplacementMatrix ?? [];
  const foodGaps = foodGap.foodGapScenarios ?? [];
  const targets = TARGETS.map((target) => {
    const fg = foodGaps.find((s) => s.scenario === target.scenario) ?? {};
    const modes = Object.fromEntries(MODES.map((mode) => {
      const row = matrix.find((r) => r.scenario === target.scenario && r.modality === mode) ?? {};
      return [mode, {
        yearBasis: 'year1',
        requiredGrowers: n(row.requiredWorkersYear1, 0),
        landRequiredHa: n(row.requiredHaYear1, 0)
      }];
    }));
    return {
      target: target.label,
      scenario: target.scenario,
      requiredGJ: n(fg.foodGapGJ, 0),
      peopleFoodEquivalent: n(fg.foodGapPopulationEquivalent, 0),
      modes
    };
  });

  const strictLandAccess = {
    broadParcelOrYardAccessPopulation: n(dwelling.broadParcelOrYardAccessPopulation, 0),
    supplementalGardenAccessPopulation: n(dwelling.supplementalGardenAccessPopulation, 0),
    meaningfulHouseholdFoodAccessPopulation: n(dwelling.meaningfulHouseholdFoodAccessPopulation, 0),
    subsistencePotentialAccessPopulation: n(dwelling.subsistencePotentialAccessPopulation, 0),
    noMeaningfulFoodGrowingLandAccessPopulation: n(dwelling.noMeaningfulFoodGrowingLandAccessPopulation, 0),
    productionScaleAccessPopulation: n(dwelling.productionScaleAccessPopulation, 0),
    settlementConservativeRule: 'Settlement-area residents are treated as having no subsistence-potential food-growing access unless parcel-level usable-area evidence exists.'
  };

  const articleHeadlineFacts = [
    'Current Hormuz disruption is active and multi-input, not only oil.',
    `Measured-anchor food insecurity baseline estimate for Grey: ${measuredBaseline.toFixed(0)} people.`,
    preferredTrend
      ? `Regression-based no-new-shock 2027 trend projection for Grey: about ${trend2027People.toFixed(0)} people in food insecurity (range ${n(preferredTrend.rangeLowPeople, 0).toFixed(0)} to ${n(preferredTrend.rangeHighPeople, 0).toFixed(0)}).`
      : `No-new-shock 2027 trend fallback estimate for Grey: about ${trend2027People.toFixed(0)} people in food insecurity.`,
    `Residents with no meaningful food-growing land access (strict): ${strictLandAccess.noMeaningfulFoodGrowingLandAccessPopulation.toFixed(0)}.`,
    `Year 1 food for about 10,000 people requires about ${targets[0].modes.lowInputAnnualField.requiredGrowers.toFixed(0)} low-input field growers, ${targets[0].modes.marketGardenIntensive.requiredGrowers.toFixed(0)} market-garden growers, or ${targets[0].modes.handToolHouseholdGarden.requiredGrowers.toFixed(0)} household growers.`,
    `Year 1 food for about 33,000 people requires about ${targets[2].modes.lowInputAnnualField.requiredGrowers.toFixed(0)} low-input field growers, ${targets[2].modes.marketGardenIntensive.requiredGrowers.toFixed(0)} market-garden growers, or ${targets[2].modes.handToolHouseholdGarden.requiredGrowers.toFixed(0)} household growers.`
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    caveat: 'Scenario diagnostics, not forecasts.',
    notOnlyOilNote: 'The Hormuz disruption is not only an oil shock. It affects several upstream food-system inputs, including oil/diesel, LNG/natural gas, nitrogen fertilizer, sulfur/phosphate fertilizer, shipping, insurance, and rerouting.',
    currentFoodInsecurityBaseline: {
      canadaOntarioAnchorShare: measuredShare,
      greyCountyBaselineEstimate: measuredBaseline,
      trend2027CentralShare: trend2027Rate,
      trend2027CentralEstimate: trend2027People,
      sourceCaveat: 'External Canada/Ontario anchor and trend scenario applied to Grey; not a Grey-specific measured series.'
    },
    foodInsecurityTrendProjection: preferredTrend
      ? {
        source: path.join(produceDir, 'grey-food-insecurity-trend-projection.json'),
        preferred2027ProjectedPeople: n(preferredTrend.projected2027People, 0),
        preferred2027ProjectedRatePct: n(preferredTrend.projected2027RatePct, 0),
        rangeLowPeople: n(preferredTrend.rangeLowPeople, 0),
        rangeHighPeople: n(preferredTrend.rangeHighPeople, 0),
        method: preferredTrend.method,
        caveat: 'trend projection, not forecast; excludes current Hormuz shock'
      }
      : {
        source: null,
        preferred2027ProjectedPeople: trend2027People,
        preferred2027ProjectedRatePct: trend2027Rate * 100,
        rangeLowPeople: null,
        rangeHighPeople: null,
        method: 'fallback_current_shock_central_trend',
        caveat: 'trend projection fallback; run report:grey:food-insecurity-trend for regression-backed estimate'
      },
    hormuzCurrentDisruptionScenarios: hormuzScenarios,
    physicalLocalFoodResponseTargets: targets,
    strictLandAccess,
    articleHeadlineFacts,
    headlineMetrics: [
      {
        metric_id: 'grey_population_baseline',
        label: 'Grey population baseline',
        value: population,
        unit: 'people',
        status: 'measured',
        method: 'census_population_distribution_totalPopulationMatched',
        confidence: 'high',
        source_refs: [path.join(produceDir, 'grey-population-distribution.json')],
        scenario_refs: [],
        not_forecast: false
      },
      {
        metric_id: 'grey_food_insecurity_2027_baseline_people',
        label: 'Grey no-new-shock 2027 food insecurity baseline (people)',
        value: trend2027People,
        unit: 'people',
        status: 'scenario_output',
        method: preferredTrend ? `trend_projection:${preferredTrend.method}` : 'fallback_current_shock_central_trend',
        range: preferredTrend
          ? { low: n(preferredTrend.rangeLowPeople, 0), high: n(preferredTrend.rangeHighPeople, 0), unit: 'people' }
          : null,
        confidence: preferredTrend ? 'moderate' : 'low',
        source_refs: [
          path.join(produceDir, 'grey-food-insecurity-trend-projection.json'),
          path.join(produceDir, 'grey-current-system-shock-threshold.json')
        ],
        scenario_refs: ['baseline', 'hormuz_shock_low', 'hormuz_shock_central', 'hormuz_shock_high'],
        not_forecast: true
      },
      {
        metric_id: 'grey_food_insecurity_2027_baseline_rate_pct',
        label: 'Grey no-new-shock 2027 food insecurity baseline (rate)',
        value: trend2027Rate * 100,
        unit: '%',
        status: 'scenario_output',
        method: preferredTrend ? `trend_projection:${preferredTrend.method}` : 'fallback_current_shock_central_trend',
        range: preferredTrend
          ? { low: n(preferredTrend.rangeLowRatePct, 0), high: n(preferredTrend.rangeHighRatePct, 0), unit: '%' }
          : null,
        confidence: preferredTrend ? 'moderate' : 'low',
        source_refs: [
          path.join(produceDir, 'grey-food-insecurity-trend-projection.json'),
          path.join(produceDir, 'grey-current-system-shock-threshold.json')
        ],
        scenario_refs: ['baseline', 'hormuz_shock_low', 'hormuz_shock_central', 'hormuz_shock_high'],
        not_forecast: true
      },
      {
        metric_id: 'grey_no_meaningful_food_growing_land_access_population',
        label: 'Residents without meaningful food-growing land access',
        value: strictLandAccess.noMeaningfulFoodGrowingLandAccessPopulation,
        unit: 'people',
        status: 'proxy',
        method: 'census_db_plus_lot_concession_proxy_strict_definition',
        confidence: 'low_to_moderate',
        source_refs: [path.join(produceDir, 'grey-dwelling-land-access.json')],
        scenario_refs: [],
        not_forecast: false
      },
      {
        metric_id: 'food_for_10k_low_input_workers_year1',
        label: 'Year-1 low-input field growers for food-for-10k',
        value: n(targets[0]?.modes?.lowInputAnnualField?.requiredGrowers, 0),
        unit: 'workers',
        status: 'scenario_output',
        method: 'requiredGJ/(GJPerHaYear1*landHaPerWorker)',
        confidence: 'moderate',
        source_refs: [path.join(produceDir, 'grey-food-gap-replacement.json')],
        scenario_refs: ['foodGap10'],
        not_forecast: true
      },
      {
        metric_id: 'food_for_10k_market_garden_workers_year1',
        label: 'Year-1 market-garden growers for food-for-10k',
        value: n(targets[0]?.modes?.marketGardenIntensive?.requiredGrowers, 0),
        unit: 'workers',
        status: 'scenario_output',
        method: 'requiredGJ/(GJPerHaYear1*landHaPerWorker)',
        confidence: 'moderate',
        source_refs: [path.join(produceDir, 'grey-food-gap-replacement.json')],
        scenario_refs: ['foodGap10'],
        not_forecast: true
      },
      {
        metric_id: 'food_for_10k_household_growers_year1',
        label: 'Year-1 household growers for food-for-10k',
        value: n(targets[0]?.modes?.handToolHouseholdGarden?.requiredGrowers, 0),
        unit: 'workers',
        status: 'scenario_output',
        method: 'requiredGJ/(GJPerHaYear1*landHaPerWorker)',
        confidence: 'moderate',
        source_refs: [path.join(produceDir, 'grey-food-gap-replacement.json')],
        scenario_refs: ['foodGap10'],
        not_forecast: true
      },
      {
        metric_id: 'hormuz_current_disruption_severe_added_food_insecurity_people',
        label: 'People added to food insecurity in current-disruption severe band',
        value: n(hormuzScenarios.find((s) => s.scenario === 'currentDisruptionSevere')?.peopleAddedToFoodInsecurityVsBaseline, 0),
        unit: 'people',
        status: 'scenario_output',
        method: 'calibrated_food_insecurity_under_shock - baseline_anchor',
        confidence: 'low_to_moderate',
        source_refs: [path.join(produceDir, 'grey-current-system-shock-threshold.json')],
        scenario_refs: ['hormuz_shock_central'],
        not_forecast: true
      },
      {
        metric_id: 'food_for_33k_low_input_workers_year1',
        label: 'Year-1 low-input field growers for food-for-33k',
        value: n(targets[2]?.modes?.lowInputAnnualField?.requiredGrowers, 0),
        unit: 'workers',
        status: 'scenario_output',
        method: 'requiredGJ/(GJPerHaYear1*landHaPerWorker)',
        confidence: 'moderate',
        source_refs: [path.join(produceDir, 'grey-food-gap-replacement.json')],
        scenario_refs: ['foodGap33'],
        not_forecast: true
      },
      {
        metric_id: 'food_for_33k_market_garden_workers_year1',
        label: 'Year-1 market-garden growers for food-for-33k',
        value: n(targets[2]?.modes?.marketGardenIntensive?.requiredGrowers, 0),
        unit: 'workers',
        status: 'scenario_output',
        method: 'requiredGJ/(GJPerHaYear1*landHaPerWorker)',
        confidence: 'moderate',
        source_refs: [path.join(produceDir, 'grey-food-gap-replacement.json')],
        scenario_refs: ['foodGap33'],
        not_forecast: true
      },
      {
        metric_id: 'food_for_33k_household_growers_year1',
        label: 'Year-1 household growers for food-for-33k',
        value: n(targets[2]?.modes?.handToolHouseholdGarden?.requiredGrowers, 0),
        unit: 'workers',
        status: 'scenario_output',
        method: 'requiredGJ/(GJPerHaYear1*landHaPerWorker)',
        confidence: 'moderate',
        source_refs: [path.join(produceDir, 'grey-food-gap-replacement.json')],
        scenario_refs: ['foodGap33'],
        not_forecast: true
      }
    ],
    severeSystemicInputLoss33Framing: severeFraming,
    sourceFiles: {
      currentShockThreshold: path.join(produceDir, 'grey-current-system-shock-threshold.json'),
      foodInsecurityTrendProjection: path.join(produceDir, 'grey-food-insecurity-trend-projection.json'),
      foodSupplyDemandPrice: path.join(produceDir, 'grey-food-supply-demand-price.json'),
      foodGapReplacement: path.join(produceDir, 'grey-food-gap-replacement.json'),
      dwellingLandAccess: path.join(produceDir, 'grey-dwelling-land-access.json'),
      populationDistribution: path.join(produceDir, 'grey-population-distribution.json')
    },
    warnings
  };

  const md = [
    '# Grey County Current Hormuz Food Security Article Data',
    '',
    '## Current food insecurity baseline',
    `- anchor share (Canada/Ontario): ${(measuredShare * 100).toFixed(1)}%`,
    `- Grey baseline estimate: ${measuredBaseline.toFixed(0)} people`,
    `- 2027 no-new-shock trend estimate: ${trend2027People.toFixed(0)} people`,
    `- caveat: ${report.currentFoodInsecurityBaseline.sourceCaveat}`,
    '',
    '## Not only oil',
    report.notOnlyOilNote,
    '',
    '## Hormuz current-disruption scenarios',
    '| Scenario | Oil/diesel stress | LNG/natural gas stress | Nitrogen fertilizer stress | Sulfur/phosphate stress | Shipping stress | Estimated food-price pressure | Estimated Grey food insecurity | Added vs baseline | Protected by combined response |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...hormuzScenarios.map((s) => `| ${s.scenario} | ${s.oilDieselStressPct}% | ${s.lngNaturalGasStressPct}% | ${s.nitrogenFertilizerStressPct}% | ${s.sulfurPhosphateStressPct}% | ${s.shippingStressPct}% | ${s.estimatedFoodPricePressure.toFixed(1)}% | ${s.estimatedGreyFoodInsecurity.toFixed(0)} | ${s.peopleAddedToFoodInsecurityVsBaseline.toFixed(0)} | ${s.peopleProtectedByCombinedLocalResponse == null ? 'n/a' : s.peopleProtectedByCombinedLocalResponse.toFixed(0)} |`),
    '',
    '## Physical local food response targets',
    '| Target | Required GJ | People-equivalent | Low-input field growers (Y1) | Market-garden growers (Y1) | Household growers (Y1) |',
    '|---|---:|---:|---:|---:|---:|',
    ...targets.map((t) => `| ${t.target} | ${t.requiredGJ.toFixed(2)} | ${t.peopleFoodEquivalent.toFixed(2)} | ${t.modes.lowInputAnnualField.requiredGrowers.toFixed(2)} | ${t.modes.marketGardenIntensive.requiredGrowers.toFixed(2)} | ${t.modes.handToolHouseholdGarden.requiredGrowers.toFixed(2)} |`),
    '',
    '## Strict land access',
    `- noMeaningfulFoodGrowingLandAccessPopulation: ${strictLandAccess.noMeaningfulFoodGrowingLandAccessPopulation.toFixed(2)}`,
    `- meaningfulHouseholdFoodAccessPopulation: ${strictLandAccess.meaningfulHouseholdFoodAccessPopulation.toFixed(2)}`,
    `- subsistencePotentialAccessPopulation: ${strictLandAccess.subsistencePotentialAccessPopulation.toFixed(2)}`,
    `- productionScaleAccessPopulation: ${strictLandAccess.productionScaleAccessPopulation.toFixed(2)}`,
    `- rule: ${strictLandAccess.settlementConservativeRule}`,
    '',
    '## Headline facts',
    ...articleHeadlineFacts.map((f) => `- ${f}`),
    '',
    '## Caveat',
    '- Food-insecurity pressure estimates and physical production requirements are separate outputs and should not be merged into a single labour-to-headcount claim.'
  ].join('\n');

  const paths = {
    markdownPath: path.join(produceDir, 'grey-hormuz-food-security-article-data.md'),
    jsonPath: path.join(produceDir, 'grey-hormuz-food-security-article-data.json')
  };

  fs.writeFileSync(paths.markdownPath, md);
  fs.writeFileSync(paths.jsonPath, JSON.stringify(report, null, 2));

  // optional compact CSV for scenario bands
  const scenarioCsvPath = path.join(produceDir, 'grey-hormuz-food-security-article-data-scenarios.csv');
  fs.writeFileSync(scenarioCsvPath, toCsv(hormuzScenarios, [
    'scenario', 'scenarioBand', 'globalFoodProductionLossPct', 'localFoodAvailabilityStressPct',
    'oilDieselStressPct', 'lngNaturalGasStressPct', 'nitrogenFertilizerStressPct', 'sulfurPhosphateStressPct',
    'shippingStressPct', 'estimatedFoodPricePressure', 'estimatedGreyFoodInsecurity',
    'peopleAddedToFoodInsecurityVsBaseline', 'peopleProtectedByCombinedLocalResponse', 'caveat'
  ]));
  paths.scenariosCsvPath = scenarioCsvPath;

  return { report, paths };
}
