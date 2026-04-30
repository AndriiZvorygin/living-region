// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';

function n(v, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function esc(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function toCsv(rows, headers) {
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
}

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

export function buildGreyFarmLabourBaselineReport(options = {}) {
  const produceDir = path.resolve(options.produceDir ?? 'know/produce');
  fs.mkdirSync(produceDir, { recursive: true });
  const warnings = [];

  const ag = readJsonIfExists(path.join(produceDir, 'grey-census-agriculture-baseline.json'), warnings, 'census agriculture baseline', {});
  const labourLand = readJsonIfExists(path.join(produceDir, 'grey-labour-land-baseline.json'), warnings, 'labour-land baseline', {});

  const lowFuel = (labourLand.scenarios ?? []).find((s) => s.scenario === 'lowFuelMixed') ?? (labourLand.scenarios ?? [])[0] ?? {};
  const currentMechanized = (labourLand.scenarios ?? []).find((s) => s.scenario === 'currentMechanized') ?? {};
  const mostlyHumanScale = (labourLand.scenarios ?? []).find((s) => s.scenario === 'mostlyHumanScale') ?? {};
  const annualLowFuelEfficient = (labourLand.productionSystemLeverage ?? []).find((s) => s.system === 'annualLowFuelEfficient') ?? {};
  const annualLowFuelHandScale = (labourLand.productionSystemLeverage ?? []).find((s) => s.system === 'annualLowFuelHandScale') ?? {};
  const perennialStapleBulkLowCare = (labourLand.productionSystemLeverage ?? []).find((s) => s.system === 'perennialStapleBulkLowCare') ?? {};
  const requiredLowFuelFTE = n(lowFuel.requiredFoodWorkerFTE);
  const currentFarmOperators = n(ag.numberOfFarmOperators);
  const currentFarmOperatorsFTEEstimate = n(ag.currentFarmOperatorsFTEEstimate, currentFarmOperators * 0.75);
  const currentHiredFarmLabourFTEEstimate = n(ag.currentHiredFarmLabourFTEEstimate, n(ag.hiredLabour) * 0.45);
  const currentFarmLabourFTEEstimate = n(ag.currentFarmLabourFTEEstimate, currentFarmOperatorsFTEEstimate + currentHiredFarmLabourFTEEstimate);
  const currentFarmLabourDataStatus = currentFarmOperators > 0 ? 'available' : 'missing';
  const farmLabourGapVsLowFuelScenarios = Math.max(0, requiredLowFuelFTE - currentFarmOperators);
  const annualLowFuelEfficientFTE = n(annualLowFuelEfficient.totalSystemLabourDaysPerHaAtMaturity) > 0
    ? (n(labourLand.regionalIndicators?.estimatedHumanFoodProducingHa) * n(annualLowFuelEfficient.totalSystemLabourDaysPerHaAtMaturity)) / 220
    : 0;
  const annualLowFuelHandScaleFTE = n(annualLowFuelHandScale.totalSystemLabourDaysPerHaAtMaturity) > 0
    ? (n(labourLand.regionalIndicators?.estimatedHumanFoodProducingHa) * n(annualLowFuelHandScale.totalSystemLabourDaysPerHaAtMaturity)) / 220
    : 0;
  const perennialStapleFTE = n(perennialStapleBulkLowCare.totalSystemLabourDaysPerHaAtMaturity) > 0
    ? (n(labourLand.regionalIndicators?.estimatedHumanFoodProducingHa) * n(perennialStapleBulkLowCare.totalSystemLabourDaysPerHaAtMaturity)) / 220
    : 0;
  const mostlyHumanScaleFTE = n(mostlyHumanScale.requiredFoodWorkerFTE);

  const scenarioComparison = [
    { scenario: 'currentMechanized', foodWorkersNeeded: n(currentMechanized.requiredFoodWorkerFTE) },
    { scenario: 'annualLowFuelEfficient', foodWorkersNeeded: annualLowFuelEfficientFTE },
    { scenario: 'annualLowFuelHandScale', foodWorkersNeeded: annualLowFuelHandScaleFTE },
    { scenario: 'perennialStapleBulkLowCare', foodWorkersNeeded: perennialStapleFTE },
    { scenario: 'mostlyHumanScale', foodWorkersNeeded: mostlyHumanScaleFTE }
  ].map((row) => ({
    ...row,
    currentFarmLabourFTEEstimate,
    gapFTE: Math.max(0, row.foodWorkersNeeded - currentFarmLabourFTEEstimate),
    scaleUpFactor: currentFarmLabourFTEEstimate > 0 ? row.foodWorkersNeeded / currentFarmLabourFTEEstimate : null
  }));

  const report = {
    generatedAt: new Date().toISOString(),
    geographyLevel: ag.geographyLevel ?? 'unknown',
    currentFarmOperators,
    currentFarmOperatorsFTEEstimate,
    currentHiredFarmLabourFTEEstimate,
    currentFarmLabourFTEEstimate,
    currentFarmLabourDataStatus,
    operatorsWithOffFarmWork: n(ag.operatorsWithOffFarmWork),
    hiredLabour: n(ag.hiredLabour),
    numberOfFarms: n(ag.numberOfFarms),
    averageFarmSize: n(ag.averageFarmSize),
    landInCrops: n(ag.landInCrops),
    landInPasture: n(ag.landInPasture),
    requiredLowFuelFoodWorkerFTE: requiredLowFuelFTE,
    farmLabourGapVsLowFuelScenarios,
    lowFuelFoodWorkersNeeded: requiredLowFuelFTE,
    mostlyHumanScaleFoodWorkersNeeded: mostlyHumanScaleFTE,
    perennialStapleFoodWorkersNeeded: perennialStapleFTE,
    farmLabourScaleUpFactorLowFuel: currentFarmLabourFTEEstimate > 0 ? requiredLowFuelFTE / currentFarmLabourFTEEstimate : null,
    farmLabourScaleUpFactorHumanScale: currentFarmLabourFTEEstimate > 0 ? mostlyHumanScaleFTE / currentFarmLabourFTEEstimate : null,
    scenarioComparison,
    operatorToLowFuelNeedRatio: requiredLowFuelFTE > 0 ? currentFarmOperators / requiredLowFuelFTE : 0,
    coverage: ag.coverage ?? 'unknown',
    warnings: [...warnings, ...(ag.warnings ?? [])]
  };

  const csvRows = [
    { metric: 'currentFarmOperators', value: report.currentFarmOperators },
    { metric: 'operatorsWithOffFarmWork', value: report.operatorsWithOffFarmWork },
    { metric: 'hiredLabour', value: report.hiredLabour },
    { metric: 'requiredLowFuelFoodWorkerFTE', value: report.requiredLowFuelFoodWorkerFTE },
    { metric: 'farmLabourGapVsLowFuelScenarios', value: report.farmLabourGapVsLowFuelScenarios },
    { metric: 'operatorToLowFuelNeedRatio', value: report.operatorToLowFuelNeedRatio }
  ];

  const markdown = [
    '# Grey Farm Labour Baseline',
    '',
    '## What this is',
    'This report summarizes available Census of Agriculture baseline counts for current farm operators and labour context, and compares them against low-fuel food-labour scenario demand.',
    '',
    `- geographyLevel: ${report.geographyLevel}`,
    `- currentFarmOperators: ${report.currentFarmOperators}`,
    `- operatorsWithOffFarmWork: ${report.operatorsWithOffFarmWork}`,
    `- hiredLabour: ${report.hiredLabour}`,
    `- numberOfFarms: ${report.numberOfFarms}`,
    `- currentFarmOperatorsFTEEstimate: ${report.currentFarmOperatorsFTEEstimate.toFixed(2)}`,
    `- currentHiredFarmLabourFTEEstimate: ${report.currentHiredFarmLabourFTEEstimate.toFixed(2)}`,
    `- currentFarmLabourFTEEstimate: ${report.currentFarmLabourFTEEstimate.toFixed(2)}`,
    `- requiredLowFuelFoodWorkerFTE: ${report.requiredLowFuelFoodWorkerFTE.toFixed(2)}`,
    `- mostlyHumanScaleFoodWorkersNeeded: ${report.mostlyHumanScaleFoodWorkersNeeded.toFixed(2)}`,
    `- perennialStapleFoodWorkersNeeded: ${report.perennialStapleFoodWorkersNeeded.toFixed(2)}`,
    `- farmLabourScaleUpFactorLowFuel: ${(report.farmLabourScaleUpFactorLowFuel ?? 0).toFixed(2)}`,
    `- farmLabourScaleUpFactorHumanScale: ${(report.farmLabourScaleUpFactorHumanScale ?? 0).toFixed(2)}`,
    `- farmLabourGapVsLowFuelScenarios: ${report.farmLabourGapVsLowFuelScenarios.toFixed(2)}`,
    '',
    '## Comparison to Living Region scenarios',
    '| Scenario | Food workers needed | Current farm labour FTE estimate | Gap FTE | Scale-up factor |',
    '|---|---:|---:|---:|---:|',
    ...scenarioComparison.map((s) => `| ${s.scenario} | ${s.foodWorkersNeeded.toFixed(2)} | ${s.currentFarmLabourFTEEstimate.toFixed(2)} | ${s.gapFTE.toFixed(2)} | ${(s.scaleUpFactor ?? 0).toFixed(2)} |`),
    '',
    '## Caveat',
    'This baseline uses aggregate farm/operator data and does not represent parcel-level or household-level labour assignment.',
    '',
    '## Warnings',
    ...(report.warnings.length ? report.warnings.map((w) => `- ${w}`) : ['- none'])
  ].join('\n');

  const jsonPath = path.join(produceDir, 'grey-farm-labour-baseline.json');
  const mdPath = path.join(produceDir, 'grey-farm-labour-baseline.md');
  const csvPath = path.join(produceDir, 'grey-farm-labour-baseline.csv');

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(mdPath, markdown);
  fs.writeFileSync(csvPath, toCsv(csvRows, ['metric', 'value']));

  return { report, paths: { jsonPath, markdownPath: mdPath, csvPath } };
}
