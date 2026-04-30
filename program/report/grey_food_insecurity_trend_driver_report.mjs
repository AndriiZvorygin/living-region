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

export function buildGreyFoodInsecurityTrendDriverReport(options = {}) {
  const produceDir = path.resolve(options.produceDir ?? 'know/produce');
  fs.mkdirSync(produceDir, { recursive: true });
  const warnings = [];

  const currentShock = readJsonIfExists(path.join(produceDir, 'grey-current-system-shock-threshold.json'), warnings, 'current shock threshold', {});
  const foodPrice = readJsonIfExists(path.join(produceDir, 'grey-food-supply-demand-price.json'), warnings, 'food price', {});
  const agLabour = readJsonIfExists(path.join(produceDir, 'grey-ag-labour-baseline.json'), warnings, 'ag labour', {});
  const dwelling = readJsonIfExists(path.join(produceDir, 'grey-dwelling-land-access.json'), warnings, 'dwelling land access', {});
  const foodCal = readJsonIfExists(path.join(produceDir, 'grey-food-calibration.json'), warnings, 'food calibration', {});
  const suite = readJsonIfExists(path.join(produceDir, 'grey-report-suite-summary.json'), warnings, 'suite summary', {});

  const population = n(foodCal.population2021, n(dwelling.totalPopulation, 100905));
  const anchors = [
    { region: 'Ten provinces', year: 2019, share: 0.168, sourceLabel: 'PROOF Food Insecurity', sourceUrl: 'https://proof.utoronto.ca/food-insecurity/' },
    { region: 'Ten provinces', year: 2023, share: 0.229, sourceLabel: 'PROOF Food Insecurity', sourceUrl: 'https://proof.utoronto.ca/food-insecurity/' },
    { region: 'Ten provinces', year: 2024, share: 0.255, sourceLabel: 'PROOF Food Insecurity', sourceUrl: 'https://proof.utoronto.ca/food-insecurity/' },
    { region: 'Ontario households', year: 2019, share: 0.171, sourceLabel: 'PROOF Food Insecurity', sourceUrl: 'https://proof.utoronto.ca/food-insecurity/' },
    { region: 'Ontario households', year: 2023, share: 0.242, sourceLabel: 'PROOF Food Insecurity', sourceUrl: 'https://proof.utoronto.ca/food-insecurity/' },
    { region: 'Canada people', year: 2025, share: 0.240, sourceLabel: 'PROOF Food Insecurity', sourceUrl: 'https://proof.utoronto.ca/food-insecurity/' },
    { region: 'Global moderate/severe FI', year: 2024, share: null, value: 2300000000, sourceLabel: 'SOFI 2025', sourceUrl: 'https://www.fao.org/publications/sofi' },
    { region: 'Global hunger', year: 2024, share: null, value: 673000000, sourceLabel: 'SOFI 2025', sourceUrl: 'https://www.fao.org/publications/sofi' },
    { region: 'Global severe FI crises', year: 2025, share: null, value: 266000000, sourceLabel: 'Global Report on Food Crises 2026', sourceUrl: 'https://www.fsinplatform.org/global-report-food-crises-2026' }
  ];

  const baselineTrend2019To2024PctPointChange = 0.255 - 0.168;
  const annualizedTrendPctPoints = baselineTrend2019To2024PctPointChange / 5;
  const projected2027TrendCentral = 0.30;

  const drivers = [
    ['foodPriceInflationPressure', 'Food prices rising faster than incomes', 'measured', 0.20, 0.24, 0.30, 'moderate'],
    ['rentHousingCrowdingOutFood', 'Housing costs crowd out food budgets', 'proxy', 0.12, 0.16, 0.22, 'moderate'],
    ['fuelTransportCostPressure', 'Fuel/transport pass-through into food basket', 'proxy', 0.08, 0.11, 0.15, 'moderate'],
    ['farmInputCostPressure', 'Fertilizer/input cost pass-through', 'proxy', 0.05, 0.08, 0.12, 'low_to_moderate'],
    ['landConsolidationAndProducerAccess', 'Farm consolidation and producer entry barriers', 'missingData', 0.03, 0.06, 0.10, 'low'],
    ['labourMarketIncomeStress', 'Income insecurity and wage lag', 'proxy', 0.07, 0.10, 0.15, 'moderate'],
    ['socialAssistanceAdequacyGap', 'Benefit inadequacy vs food costs', 'proxy', 0.05, 0.07, 0.11, 'low_to_moderate'],
    ['longSupplyChainExposure', 'Long supply-chain exposure to shocks', 'proxy', 0.05, 0.08, 0.12, 'low_to_moderate'],
    ['lowerSurplusEnergyPurchasingPowerProxy', 'Lower surplus energy raises system-wide cost pressure', 'proxy', 0.03, 0.06, 0.10, 'low'],
    ['localProcessingStorageGap', 'Weak local processing/storage buffers', 'proxy', 0.04, 0.07, 0.10, 'low_to_moderate'],
    ['debtInterestCostPressure', 'Debt-servicing pressure on households', 'assumption', 0.03, 0.05, 0.08, 'low'],
    ['globalFoodPricePressure', 'Global commodity price pressure transmits into local food affordability', 'measured/proxy', 0.08, 0.12, 0.18, 'moderate']
  ].map(([driverId, description, evidenceStatus, low, central, high, confidence]) => ({
    driverId,
    description,
    direction: 'increases food insecurity risk',
    evidenceStatus,
    currentDataAvailable: evidenceStatus === 'missingData' ? 'partial_or_missing' : 'partial',
    assumedContributionShareLow: low,
    assumedContributionShareCentral: central,
    assumedContributionShareHigh: high,
    confidence,
    dataNeededToImprove: driverId === 'landConsolidationAndProducerAccess'
      ? 'Load Census of Agriculture historical farm count, average farm size, and farm operator trend tables.'
      : (driverId === 'globalFoodPricePressure'
        ? 'Load FAO Food Price Index and IHME/OWID malnutrition mortality time series for correlation diagnostics.'
        : 'Add local time-series data and identify independent covariates.')
  }));

  const centralSum = drivers.reduce((a, d) => a + d.assumedContributionShareCentral, 0);
  const explainableTrendShare = Math.min(1, centralSum);
  const unexplainedTrendShare = clamp(1 - explainableTrendShare, 0, 1);

  const topDrivers = [...drivers]
    .sort((a, b) => b.assumedContributionShareCentral - a.assumedContributionShareCentral)
    .slice(0, 5)
    .map((d) => d.driverId);

  const landConsolidationDataStatus = drivers.find((d) => d.driverId === 'landConsolidationAndProducerAccess')?.evidenceStatus ?? 'missingData';

  const report = {
    generatedAt: new Date().toISOString(),
    assumptions: {
      trendSourceStatus: 'external Canada/Ontario and global anchors; Grey-specific attribution not yet causal-calibrated',
      attributionDiagnosticNotCausalProof: true,
      globalFoodPriceIndexTrendStatus: 'not_loaded_timeseries',
      globalMalnutritionMortalityTrendStatus: 'not_loaded_timeseries',
      correlationStatus: 'not yet quantified',
      nextDataTask: 'Load FAO Food Price Index and IHME/OWID malnutrition deaths/rates for correlation diagnostics.'
    },
    trendAnchors: anchors,
    baselineTrend2019To2024PctPointChange,
    annualizedTrendPctPoints,
    projected2027TrendCentral,
    driverContributionMatrix: drivers,
    explainableTrendShare,
    unexplainedTrendShare,
    topDrivers,
    landConsolidationDataStatus,
    lowerSurplusEnergyStatus: 'proxy/assumption',
    globalFoodPriceChannel: {
      mechanism: 'global commodity prices -> import food costs -> retail food basket -> low-income household affordability -> food insecurity',
      notes: 'Global food price pressure is amplified for poorer countries and poorer households. Malnutrition outcomes are linked to multiple drivers including conflict, drought, aid, income, health systems, and governance.'
    },
    caveats: [
      'Attribution diagnostic, not causal proof.',
      'Not a forecast.',
      'Malnutrition deaths are not a direct food-price index.',
      'Land consolidation effects are not yet quantified for Grey without historical Census of Agriculture tables.'
    ],
    warnings
  };

  const md = [
    '# Grey Food Insecurity Trend Driver Diagnostic',
    '',
    '## Bottom line',
    'Food insecurity was already rising before the current fuel/input shock. This report separates baseline trend pressure from shock-added pressure.',
    '',
    '## Historical trend anchors',
    '| Region | Year | Food insecurity share/value | Source |',
    '| --- | ---: | ---: | --- |',
    ...anchors.map((a) => `| ${a.region} | ${a.year} | ${a.share == null ? a.value.toLocaleString('en-CA') : (a.share * 100).toFixed(1) + '%'} | ${a.sourceLabel} |`),
    '',
    '## Global food-price pressure',
    'Global food prices and global nutrition stress are part of the background trend. Elevated food inflation reduces purchasing power and makes healthy diets less affordable, especially for poorer households. This is not the same as proving a one-to-one causal link between food prices and malnutrition deaths, but it is an important pressure channel.',
    'Malnutrition deaths are not a direct food-price index. They also reflect conflict, drought, health systems, aid, income, sanitation, maternal health, and governance.',
    '',
    '## Candidate drivers',
    '| Driver | Evidence status | Central contribution | Confidence | Data needed |',
    '| --- | --- | ---: | --- | --- |',
    ...drivers.map((d) => `| ${d.driverId} | ${d.evidenceStatus} | ${(d.assumedContributionShareCentral * 100).toFixed(1)}% | ${d.confidence} | ${d.dataNeededToImprove} |`),
    '',
    '## What this does not prove',
    '- attribution diagnostic, not causal proof',
    '- not a forecast',
    '- not a substitute for local income/rent/food-bank data',
    '- land consolidation is not yet quantified unless Census Ag historical data is loaded',
    '',
    '## Next data priorities',
    '- Grey/Ontario food bank and soup kitchen usage',
    '- local rent/income distribution',
    '- Census Ag historical farm count/size/operators',
    '- food price basket',
    '- farm input/fertilizer cost trend',
    '- transport/fuel cost trend'
  ].join('\n') + '\n';

  const markdownPath = path.join(produceDir, 'grey-food-insecurity-trend-drivers.md');
  const jsonPath = path.join(produceDir, 'grey-food-insecurity-trend-drivers.json');
  const csvPath = path.join(produceDir, 'grey-food-insecurity-trend-drivers.csv');

  fs.writeFileSync(markdownPath, md);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(csvPath, `${toCsv(drivers.map((d) => ({
    driverId: d.driverId,
    evidenceStatus: d.evidenceStatus,
    centralContributionShare: d.assumedContributionShareCentral,
    confidence: d.confidence,
    dataNeededToImprove: d.dataNeededToImprove
  })), ['driverId', 'evidenceStatus', 'centralContributionShare', 'confidence', 'dataNeededToImprove'])}\n`);

  return { report, paths: { markdownPath, jsonPath, csvPath } };
}
