// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';

function n(v, fallback = 0) { const x = Number(v); return Number.isFinite(x) ? x : fallback; }
function esc(v) { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; }
function toCsv(rows, headers) { return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n'); }

function readJsonIfExists(filePath, warnings, label, fallback = null) {
  if (!fs.existsSync(filePath)) { warnings.push(`Missing ${label}: ${filePath}`); return fallback; }
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch (error) { warnings.push(`Failed to parse ${label}: ${filePath} (${error.message})`); return fallback; }
}

export function buildGreyAgLabourBaselineReport(options = {}) {
  const produceDir = path.resolve(options.produceDir ?? 'know/produce');
  fs.mkdirSync(produceDir, { recursive: true });
  const warnings = [];

  const agLabour = readJsonIfExists(path.join(produceDir, 'grey-census-population-labour-baseline.json'), warnings, 'census population labour baseline', {});
  const agLabourDiagnostics = readJsonIfExists(path.join(produceDir, 'grey-ag-labour-import-diagnostics.json'), warnings, 'ag labour import diagnostics', {});
  const labourLand = readJsonIfExists(path.join(produceDir, 'grey-labour-land-baseline.json'), warnings, 'labour-land baseline', {});
  const censusAg = readJsonIfExists(path.join(produceDir, 'grey-census-agriculture-baseline.json'), warnings, 'census agriculture baseline', {});

  const scenarios = labourLand.scenarios ?? [];
  const lowFuel = scenarios.find((s) => s.scenario === 'lowFuelMixed') ?? {};
  const mostlyHuman = scenarios.find((s) => s.scenario === 'mostlyHumanScale') ?? {};
  const perennialNeeded = n((labourLand.productionSystemLeverage ?? []).find((s) => s.system === 'perennialStapleBulkLowCare')?.totalSystemLabourDaysPerHaAtMaturity) > 0
    ? (n(labourLand.regionalIndicators?.estimatedHumanFoodProducingHa) * n((labourLand.productionSystemLeverage ?? []).find((s) => s.system === 'perennialStapleBulkLowCare')?.totalSystemLabourDaysPerHaAtMaturity)) / 220
    : 0;

  const currentAgRelatedWorkers = n(agLabour.currentAgRelatedWorkers);
  const currentCoreAgFTEEstimate = n(agLabour.currentCoreAgFTEEstimate);
  const currentAgIndustryFTEEstimate = n(agLabour.currentAgIndustryFTEEstimate);
  const currentBroadAgAdjacentFTEEstimate = n(agLabour.currentBroadAgAdjacentFTEEstimate);
  const currentAgRelatedFTEEstimate = currentCoreAgFTEEstimate;
  const scaleCore = (need) => currentCoreAgFTEEstimate > 0 ? need / currentCoreAgFTEEstimate : null;
  const scaleIndustry = (need) => currentAgIndustryFTEEstimate > 0 ? need / currentAgIndustryFTEEstimate : null;
  const scaleBroad = (need) => currentBroadAgAdjacentFTEEstimate > 0 ? need / currentBroadAgAdjacentFTEEstimate : null;

  const comparisons = [
    { scenario: 'currentMechanized', workersNeeded: n(scenarios.find((s) => s.scenario === 'currentMechanized')?.requiredFoodWorkerFTE) },
    { scenario: 'annualLowFuelEfficient', workersNeeded: (n(labourLand.regionalIndicators?.estimatedHumanFoodProducingHa) * n((labourLand.productionSystemLeverage ?? []).find((s) => s.system === 'annualLowFuelEfficient')?.totalSystemLabourDaysPerHaAtMaturity)) / 220 },
    { scenario: 'annualLowFuelHandScale', workersNeeded: (n(labourLand.regionalIndicators?.estimatedHumanFoodProducingHa) * n((labourLand.productionSystemLeverage ?? []).find((s) => s.system === 'annualLowFuelHandScale')?.totalSystemLabourDaysPerHaAtMaturity)) / 220 },
    { scenario: 'perennialStapleBulkLowCare', workersNeeded: perennialNeeded },
    { scenario: 'mostlyHumanScale', workersNeeded: n(mostlyHuman.requiredFoodWorkerFTE) }
  ].map((x) => ({
    ...x,
    currentAgRelatedFTEEstimate,
    gapFTE: Math.max(0, x.workersNeeded - currentAgRelatedFTEEstimate),
    scaleUpFactor: currentAgRelatedFTEEstimate > 0 ? x.workersNeeded / currentAgRelatedFTEEstimate : null
  }));

  const report = {
    generatedAt: new Date().toISOString(),
    agLabourDataStatus: agLabour?.dataStatus?.agLabourDataStatus ?? 'missing',
    geographyLevel: agLabour?.geographyLevel ?? 'unknown',
    currentAgRelatedWorkers,
    currentAgRelatedFTEEstimate,
    currentCoreAgFTEEstimate,
    currentAgIndustryFTEEstimate,
    currentBroadAgAdjacentFTEEstimate,
    currentAdjacentLandBasedFTEEstimate: n(agLabour.currentAdjacentLandBasedFTEEstimate),
    coreAgriculturalWorkers: n(agLabour.coreAgriculturalWorkers),
    agricultureIndustryWorkers: n(agLabour.agricultureIndustryWorkers),
    farmManagersOperatorsOccupation: n(agLabour.farmManagersOperatorsOccupation),
    farmLabourersOccupation: n(agLabour.farmLabourersOccupation),
    greenhouseNurseryWorkers: n(agLabour.greenhouseNurseryWorkers),
    adjacentLandBasedWorkers: n(agLabour.adjacentLandBasedWorkers),
    landscapingGroundsWorkers: n(agLabour.landscapingGroundsWorkers),
    forestryWorkers: n(agLabour.forestryWorkers),
    totalAgRelatedBroadWorkers: n(agLabour.totalAgRelatedBroadWorkers),
    lowFuelFoodWorkersNeeded: n(lowFuel.requiredFoodWorkerFTE),
    perennialStapleFoodWorkersNeeded: perennialNeeded,
    mostlyHumanScaleFoodWorkersNeeded: n(mostlyHuman.requiredFoodWorkerFTE),
    agLabourScaleUpFactorLowFuel: scaleCore(n(lowFuel.requiredFoodWorkerFTE)),
    agLabourScaleUpFactorPerennialStaple: scaleCore(perennialNeeded),
    agLabourScaleUpFactorHumanScale: scaleCore(n(mostlyHuman.requiredFoodWorkerFTE)),
    agLabourScaleUpFactorLowFuelIndustry: scaleIndustry(n(lowFuel.requiredFoodWorkerFTE)),
    agLabourScaleUpFactorLowFuelBroad: scaleBroad(n(lowFuel.requiredFoodWorkerFTE)),
    agLabourGapFTELowFuel: Math.max(0, n(lowFuel.requiredFoodWorkerFTE) - currentAgRelatedFTEEstimate),
    agLabourGapFTEPerennialStaple: Math.max(0, perennialNeeded - currentAgRelatedFTEEstimate),
    agLabourGapFTEHumanScale: Math.max(0, n(mostlyHuman.requiredFoodWorkerFTE) - currentAgRelatedFTEEstimate),
    censusAgricultureComplement: {
      farmOperators: n(censusAg.numberOfFarmOperators),
      farmOperatorsFTEEstimate: n(censusAg.currentFarmOperatorsFTEEstimate)
    },
    importDiagnostics: agLabourDiagnostics,
    sanityFlags: agLabour.sanityFlags ?? [],
    comparisons,
    warnings: [...warnings, ...(agLabour.warnings ?? [])]
  };

  const markdown = [
    '# Grey Agricultural Labour Baseline',
    '',
    '## What this is',
    'Uses Census of Population occupation/industry data to estimate current ag-related labour in Grey County.',
    '',
    '## Census of Population vs Census of Agriculture',
    '- Census of Population estimates workers by occupation/industry.',
    '- Census of Agriculture estimates farm operators and farm operations.',
    '- They are complementary and not interchangeable.',
    '',
    '## Current ag-related labour',
    `- agLabourDataStatus: ${report.agLabourDataStatus}`,
    `- currentAgRelatedWorkers (core worker count): ${report.currentAgRelatedWorkers}`,
    `- currentCoreAgFTEEstimate: ${report.currentCoreAgFTEEstimate.toFixed(2)}`,
    `- currentAgIndustryFTEEstimate: ${report.currentAgIndustryFTEEstimate.toFixed(2)}`,
    `- currentBroadAgAdjacentFTEEstimate: ${report.currentBroadAgAdjacentFTEEstimate.toFixed(2)}`,
    `- coreAgriculturalWorkers: ${report.coreAgriculturalWorkers}`,
    `- agricultureIndustryWorkers: ${report.agricultureIndustryWorkers}`,
    `- landscapingGroundsWorkers: ${report.landscapingGroundsWorkers}`,
    `- totalAgRelatedBroadWorkers: ${report.totalAgRelatedBroadWorkers}`,
    '',
    '## Comparison to Living Region scenarios',
    '| Scenario | Workers needed | Core ag FTE | Industry ag FTE | Broad ag+adjacent FTE | Gap FTE (core) | Scale-up core |',
    '|---|---:|---:|---:|---:|---:|---:|',
    ...comparisons.map((c) => `| ${c.scenario} | ${c.workersNeeded.toFixed(2)} | ${currentCoreAgFTEEstimate.toFixed(2)} | ${currentAgIndustryFTEEstimate.toFixed(2)} | ${currentBroadAgAdjacentFTEEstimate.toFixed(2)} | ${c.gapFTE.toFixed(2)} | ${(c.scaleUpFactor ?? 0).toFixed(2)} |`),
    '',
    '## Caveats',
    '- broad ag-related categories are not the same as current food-production labour',
    '- current farm labour FTE should use the narrowest defensible category (core agricultural workers)',
    '- occupation does not equal local-food production',
    '- commodity/export/feed production differs from local food production',
    '- counts are people, not exact FTE',
    '- seasonal and informal labour may be missed',
    '- place of residence vs place of work differs by table',
    '- Census of Agriculture is still needed for farm-operator detail',
    '',
    '## Sanity flags',
    ...(report.sanityFlags.length ? report.sanityFlags.map((w) => `- ${w}`) : ['- none']),
    '',
    '## Warnings',
    ...(report.warnings.length ? report.warnings.map((w) => `- ${w}`) : ['- none'])
  ].join('\n');

  const csvRows = comparisons.map((c) => ({
    scenario: c.scenario,
    workersNeeded: c.workersNeeded,
    currentCoreAgFTEEstimate,
    currentAgIndustryFTEEstimate,
    currentBroadAgAdjacentFTEEstimate,
    gapFTE: c.gapFTE,
    scaleUpFactor: c.scaleUpFactor ?? ''
  }));

  const jsonPath = path.join(produceDir, 'grey-ag-labour-baseline.json');
  const mdPath = path.join(produceDir, 'grey-ag-labour-baseline.md');
  const csvPath = path.join(produceDir, 'grey-ag-labour-baseline.csv');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(mdPath, markdown);
  fs.writeFileSync(csvPath, toCsv(csvRows, ['scenario', 'workersNeeded', 'currentCoreAgFTEEstimate', 'currentAgIndustryFTEEstimate', 'currentBroadAgAdjacentFTEEstimate', 'gapFTE', 'scaleUpFactor']));

  return { report, paths: { jsonPath, markdownPath: mdPath, csvPath } };
}
