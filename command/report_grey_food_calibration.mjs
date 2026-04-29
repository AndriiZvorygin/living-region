// SPDX-License-Identifier: AGPL-3.0-or-later
import { buildGreyFoodSystemCalibration } from '../program/report/grey_food_system_calibration.mjs';

function parseArgs(argv = process.argv.slice(2)) {
  const opts = {};
  for (const arg of argv) {
    if (arg.startsWith('--produce-dir=')) {
      opts.produceDir = arg.slice('--produce-dir='.length);
    } else if (arg.startsWith('--input-dir=')) {
      opts.inputDir = arg.slice('--input-dir='.length);
    }
  }
  return opts;
}

try {
  const options = parseArgs();
  const { report, paths } = buildGreyFoodSystemCalibration(options);
  const baseline = report.foodDemandBaseline;
  const current = report.plausibilityScenarios.find((x) => x.scenario === 'currentModelAssumption');
  console.log(`totalFoodDemandGJ: ${baseline.totalFoodDemandGJ.toFixed(2)}`);
  console.log(`foodRelevantLandHa: ${report.landBaseSummary.foodRelevantLandHa.toFixed(2)}`);
  console.log(`humanFoodPriorityHa: ${report.landBaseSummary.humanFoodPriorityHa.toFixed(2)}`);
  if (current) {
    console.log(`currentModelAssumption foodCoverage: ${current.foodCoverage.toFixed(3)}`);
    console.log(`currentModelAssumption foodSurplusGJ: ${current.foodSurplusGJ.toFixed(2)}`);
  }
  console.log(`warnings: ${report.warnings.length}`);
  console.log(`markdown: ${paths.markdownPath}`);
  console.log(`json: ${paths.jsonPath}`);
  console.log(`land summary csv: ${paths.landSummaryCsvPath}`);
  console.log(`sensitivity csv: ${paths.sensitivityCsvPath}`);
} catch (error) {
  console.error(`food calibration report failed: ${error.message}`);
  process.exit(1);
}
