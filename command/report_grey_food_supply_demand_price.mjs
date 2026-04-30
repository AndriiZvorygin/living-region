// SPDX-License-Identifier: AGPL-3.0-or-later
import path from 'node:path';
import { buildGreyFoodSupplyDemandPriceReport } from '../program/report/grey_food_supply_demand_price_report.mjs';

function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (const arg of argv) {
    if (arg.startsWith('--produce-dir=')) out.produceDir = arg.split('=').slice(1).join('=');
  }
  return out;
}

try {
  const args = parseArgs();
  const built = buildGreyFoodSupplyDemandPriceReport({ produceDir: path.resolve(args.produceDir ?? 'know/produce') });
  const report = built.report;
  const s20No = report.keyResults.shock20NoAdaptation;
  const s20Combined = report.keyResults.shock20CombinedLocalResponse;
  const severeCombined = report.keyResults.severeSystemicInputLoss33CombinedResponse;
  if (s20No) console.log(`shock20 no-adaptation foodPriceMultiplierEstimate: ${s20No.foodPriceMultiplierEstimate.toFixed(3)}`);
  if (s20Combined) console.log(`shock20 combined local response foodPriceMultiplierEstimate: ${s20Combined.foodPriceMultiplierEstimate.toFixed(3)}`);
  if (s20Combined) console.log(`shock20 foodInsecurityAvoidedVsNoAdaptation: ${s20Combined.foodInsecurityAvoidedVsNoAdaptation.toFixed(0)}`);
  if (severeCombined) console.log(`severeSystemicInputLoss33 combined response supplyDemandRatio: ${severeCombined.supplyDemandRatio.toFixed(3)}`);
  if (s20Combined) console.log(`noDirectLandAccessRemainingVulnerable: ${s20Combined.noDirectLandAccessRemainingVulnerable.toFixed(0)}`);
  console.log(`markdown: ${built.paths.markdownPath}`);
  console.log(`json: ${built.paths.jsonPath}`);
  console.log(`scenarios csv: ${built.paths.scenariosCsvPath}`);
  console.log(`households csv: ${built.paths.householdsCsvPath}`);
} catch (error) {
  console.error(`food supply-demand-price report failed: ${error.message}`);
  process.exit(1);
}
