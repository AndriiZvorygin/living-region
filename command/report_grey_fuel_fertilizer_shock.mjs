// SPDX-License-Identifier: AGPL-3.0-or-later
import path from 'node:path';
import { buildGreyFuelFertilizerShockReport } from '../program/report/grey_fuel_fertilizer_shock_report.mjs';

function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (const arg of argv) {
    if (arg.startsWith('--produce-dir=')) out.produceDir = arg.split('=').slice(1).join('=');
  }
  return out;
}

try {
  const args = parseArgs();
  const built = buildGreyFuelFertilizerShockReport({ produceDir: path.resolve(args.produceDir ?? 'know/produce') });
  const report = built.report;
  const shock20 = report.shockScenarios.find((s) => s.scenario === 'shock20');
  const shock20Combined = report.adaptationComparisons.find((r) => r.scenario === 'shock20' && r.adaptationPackage === 'combinedResiliencePackage');
  console.log(`scenarios: ${report.shockScenarios.length}`);
  if (shock20) {
    console.log(`shock20 foodCoverage: ${shock20.foodCoverage.toFixed(3)}`);
    console.log(`shock20 addedFoodWorkersNeeded: ${shock20.addedFoodWorkersNeededVsCurrent.toFixed(2)}`);
    console.log(`shock20 agLabourScaleUpFactor: ${(shock20.agLabourScaleUpFactor ?? 0).toFixed(2)}`);
  }
  if (shock20Combined) {
    console.log(`shock20 combinedResiliencePackage foodCoverage: ${shock20Combined.foodCoverage.toFixed(3)}`);
  }
  console.log(`warnings: ${report.thresholdWarnings.length}`);
  console.log(`markdown: ${built.paths.markdownPath}`);
  console.log(`json: ${built.paths.jsonPath}`);
  console.log(`scenario csv: ${built.paths.scenariosCsvPath}`);
  console.log(`labour csv: ${built.paths.labourCsvPath}`);
} catch (error) {
  console.error(`fuel-shock report failed: ${error.message}`);
  process.exit(1);
}
