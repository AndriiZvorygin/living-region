// SPDX-License-Identifier: AGPL-3.0-or-later
import path from 'node:path';
import { buildGreyFoodGapReplacementReport } from '../program/report/grey_food_gap_replacement_report.mjs';

function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (const arg of argv) {
    if (arg.startsWith('--produce-dir=')) out.produceDir = arg.split('=').slice(1).join('=');
  }
  return out;
}

try {
  const args = parseArgs();
  const built = buildGreyFoodGapReplacementReport({ produceDir: path.resolve(args.produceDir ?? 'know/produce') });
  const report = built.report;
  const g10 = report.keyResults.foodGap10;
  const g20 = report.keyResults.foodGap20;
  const g33 = report.keyResults.foodGap33;
  const pkg1 = report.keyResults.foodGap33EmergencyYear1Package;
  const pkg10 = report.keyResults.foodGap33TenYearResiliencePackage;
  console.log(`scenarios: ${report.foodGapScenarios.length}`);
  if (g10) console.log(`foodGap10 lowInputAnnualField requiredWorkersYear1: ${g10.requiredWorkersYear1.toFixed(2)}`);
  if (g20) console.log(`foodGap20 lowInputAnnualField requiredWorkersYear1: ${g20.requiredWorkersYear1.toFixed(2)}`);
  if (g33) console.log(`foodGap33 lowInputAnnualField requiredWorkersYear1: ${g33.requiredWorkersYear1.toFixed(2)}`);
  if (pkg1) console.log(`foodGap33 emergencyYear1 gapCoveredShare: ${(pkg1.year1CoverageOfGap * 100).toFixed(1)}%`);
  if (pkg10) console.log(`foodGap33 tenYearResilience gapCoveredShare: ${(pkg10.year10CoverageOfGap * 100).toFixed(1)}%`);
  console.log(`severeSystemicInputLoss33 main bottleneck: ${report.keyResults.severeSystemicInputLoss33MainBottleneck}`);
  console.log(`markdown: ${built.paths.markdownPath}`);
  console.log(`json: ${built.paths.jsonPath}`);
  console.log(`scenarios csv: ${built.paths.scenariosCsvPath}`);
  console.log(`modalities csv: ${built.paths.modalitiesCsvPath}`);
  console.log(`timeline csv: ${built.paths.timelineCsvPath}`);
} catch (error) {
  console.error(`food gap replacement report failed: ${error.message}`);
  process.exit(1);
}
