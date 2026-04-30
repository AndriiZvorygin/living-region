// SPDX-License-Identifier: AGPL-3.0-or-later
import path from 'node:path';
import { buildGreyFarmLabourBaselineReport } from '../program/report/grey_farm_labour_baseline_report.mjs';

function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (const arg of argv) {
    if (arg.startsWith('--produce-dir=')) out.produceDir = arg.slice('--produce-dir='.length);
  }
  return out;
}

try {
  const args = parseArgs();
  const { report, paths } = buildGreyFarmLabourBaselineReport({
    produceDir: path.resolve(args.produceDir ?? 'know/produce')
  });

  console.log(`currentFarmLabourDataStatus: ${report.currentFarmLabourDataStatus}`);
  console.log(`currentFarmOperators: ${report.currentFarmOperators}`);
  console.log(`currentFarmOperatorsFTEEstimate: ${report.currentFarmOperatorsFTEEstimate.toFixed(2)}`);
  console.log(`currentHiredFarmLabourFTEEstimate: ${report.currentHiredFarmLabourFTEEstimate.toFixed(2)}`);
  console.log(`currentFarmLabourFTEEstimate: ${report.currentFarmLabourFTEEstimate.toFixed(2)}`);
  console.log(`requiredLowFuelFoodWorkerFTE: ${report.requiredLowFuelFoodWorkerFTE.toFixed(2)}`);
  console.log(`mostlyHumanScaleFoodWorkersNeeded: ${report.mostlyHumanScaleFoodWorkersNeeded.toFixed(2)}`);
  console.log(`perennialStapleFoodWorkersNeeded: ${report.perennialStapleFoodWorkersNeeded.toFixed(2)}`);
  console.log(`farmLabourScaleUpFactorLowFuel: ${(report.farmLabourScaleUpFactorLowFuel ?? 0).toFixed(2)}`);
  console.log(`farmLabourScaleUpFactorHumanScale: ${(report.farmLabourScaleUpFactorHumanScale ?? 0).toFixed(2)}`);
  console.log(`farmLabourGapVsLowFuelScenarios: ${report.farmLabourGapVsLowFuelScenarios.toFixed(2)}`);
  console.log(`warnings: ${report.warnings.length}`);
  console.log(`markdown: ${paths.markdownPath}`);
  console.log(`json: ${paths.jsonPath}`);
  console.log(`csv: ${paths.csvPath}`);
} catch (error) {
  console.error(`farm-labour report failed: ${error.message}`);
  process.exit(1);
}
