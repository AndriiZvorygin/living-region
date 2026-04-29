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
  const presentIndustrial = report.plausibilityScenarios.find((x) => x.scenario === 'presentIndustrialFossilBaseline');
  const localizedPresentTech = report.plausibilityScenarios.find((x) => x.scenario === 'localizedPresentTechBaseline');
  const constrainedLocal = report.plausibilityScenarios.find((x) => x.scenario === 'constrainedLocalFoodBaseline');
  console.log(`totalFoodDemandGJ: ${baseline.totalFoodDemandGJ.toFixed(2)}`);
  console.log(`foodRelevantLandHa: ${report.landBaseSummary.foodRelevantLandHa.toFixed(2)}`);
  console.log(`humanFoodPriorityHa: ${report.landBaseSummary.humanFoodPriorityHa.toFixed(2)}`);
  if (presentIndustrial) {
    console.log(`presentIndustrialFossilBaseline foodCoverage: ${presentIndustrial.foodCoverage.toFixed(3)}`);
  }
  if (localizedPresentTech) {
    console.log(`localizedPresentTechBaseline foodCoverage: ${localizedPresentTech.foodCoverage.toFixed(3)}`);
  }
  if (constrainedLocal) {
    console.log(`constrainedLocalFoodBaseline foodCoverage: ${constrainedLocal.foodCoverage.toFixed(3)}`);
    console.log(`constrainedLocalFoodBaseline foodSurplusGJ: ${constrainedLocal.foodSurplusGJ.toFixed(2)}`);
  }
  console.log(`requiredYieldMultiplierAtCurrentLand: ${report.selfCoverageThresholds.requiredYieldMultiplierAtCurrentLand.toFixed(3)}`);
  console.log(`warnings: ${report.warnings.length}`);
  console.log(`markdown: ${paths.markdownPath}`);
  console.log(`json: ${paths.jsonPath}`);
  console.log(`land summary csv: ${paths.landSummaryCsvPath}`);
  console.log(`sensitivity csv: ${paths.sensitivityCsvPath}`);
  console.log(`drivers csv: ${paths.driversCsvPath}`);
  console.log(`baseline comparison csv: ${paths.baselineComparisonCsvPath}`);
} catch (error) {
  console.error(`food calibration report failed: ${error.message}`);
  process.exit(1);
}
