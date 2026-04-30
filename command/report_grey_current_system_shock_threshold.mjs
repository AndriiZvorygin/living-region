// SPDX-License-Identifier: AGPL-3.0-or-later
import path from 'node:path';
import { buildGreyCurrentSystemShockThresholdReport } from '../program/report/grey_current_system_shock_threshold_report.mjs';

function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (const arg of argv) {
    if (arg.startsWith('--produce-dir=')) out.produceDir = arg.split('=').slice(1).join('=');
  }
  return out;
}

try {
  const args = parseArgs();
  const built = buildGreyCurrentSystemShockThresholdReport({
    produceDir: path.resolve(args.produceDir ?? 'know/produce')
  });
  const report = built.report;
  const shock20 = report.shockScenarios.find((s) => s.scenario === 'fuelShock20');
  const central2027 = (report.foodInsecurityTrendProjection ?? []).find((r) => r.trendScenario === 'central' && r.year === 2027);
  const central2027Shock20 = (report.shockOverlayOnTrend ?? []).find((r) => r.trendScenario === 'central' && r.year === 2027 && r.fuelShockScenario === 'fuelShock20');
  console.log(`scenarios: ${report.shockScenarios.length}`);
  console.log(`firstModerateStressShockLevel: ${report.thresholdFindings.firstModerateStressShockLevel}`);
  console.log(`firstSevereStressShockLevel: ${report.thresholdFindings.firstSevereStressShockLevel}`);
  if (central2027) {
    console.log(`centralTrend2027 measuredShareWithoutShock: ${(central2027.projectedMeasuredFoodInsecurityShareWithoutShock * 100).toFixed(1)}%`);
  }
  if (central2027Shock20) {
    console.log(`centralTrend2027 withShock20 measuredShare: ${(central2027Shock20.projectedMeasuredFoodInsecurityShareWithShock * 100).toFixed(1)}%`);
    console.log(`centralTrend2027 shock20 addedPeopleVsTrendBaseline: ${central2027Shock20.addedPeopleVsTrendBaseline.toFixed(0)}`);
  }
  if (shock20) {
    console.log(`shock20 foodInsecurityRiskExposurePopulation: ${shock20.foodInsecurityRiskExposurePopulation.toFixed(2)}`);
    console.log(`shock20 lagMonthsToAcutePain: ${shock20.lagMonthsToAcutePain.toFixed(2)}`);
  }
  console.log(`markdown: ${built.paths.markdownPath}`);
  console.log(`json: ${built.paths.jsonPath}`);
  console.log(`scenarios csv: ${built.paths.scenariosCsvPath}`);
  console.log(`households csv: ${built.paths.householdsCsvPath}`);
  console.log(`trend csv: ${built.paths.trendCsvPath}`);
  console.log(`pass-through csv: ${built.paths.passThroughCsvPath}`);
} catch (error) {
  console.error(`current shock threshold report failed: ${error.message}`);
  process.exit(1);
}
