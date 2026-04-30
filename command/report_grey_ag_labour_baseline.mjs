// SPDX-License-Identifier: AGPL-3.0-or-later
import path from 'node:path';
import { buildGreyAgLabourBaselineReport } from '../program/report/grey_ag_labour_baseline_report.mjs';

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    if (arg.startsWith('--produce-dir=')) out.produceDir = arg.split('=').slice(1).join('=');
  }
  return out;
}

try {
  const args = parseArgs(process.argv.slice(2));
  const built = buildGreyAgLabourBaselineReport({ produceDir: path.resolve(args.produceDir ?? 'know/produce') });
  const r = built.report;
  console.log(`agLabourDataStatus: ${r.agLabourDataStatus}`);
  console.log(`currentAgRelatedWorkers: ${r.currentAgRelatedWorkers}`);
  console.log(`currentCoreAgFTEEstimate: ${r.currentCoreAgFTEEstimate.toFixed(2)}`);
  console.log(`currentAgIndustryFTEEstimate: ${r.currentAgIndustryFTEEstimate.toFixed(2)}`);
  console.log(`currentBroadAgAdjacentFTEEstimate: ${r.currentBroadAgAdjacentFTEEstimate.toFixed(2)}`);
  console.log(`currentAgRelatedFTEEstimate: ${r.currentAgRelatedFTEEstimate.toFixed(2)}`);
  console.log(`agLabourScaleUpFactorLowFuel: ${(r.agLabourScaleUpFactorLowFuel ?? 0).toFixed(2)}`);
  console.log(`agLabourScaleUpFactorLowFuelIndustry: ${(r.agLabourScaleUpFactorLowFuelIndustry ?? 0).toFixed(2)}`);
  console.log(`agLabourScaleUpFactorLowFuelBroad: ${(r.agLabourScaleUpFactorLowFuelBroad ?? 0).toFixed(2)}`);
  console.log(`agLabourScaleUpFactorPerennialStaple: ${(r.agLabourScaleUpFactorPerennialStaple ?? 0).toFixed(2)}`);
  console.log(`agLabourScaleUpFactorHumanScale: ${(r.agLabourScaleUpFactorHumanScale ?? 0).toFixed(2)}`);
  if (Array.isArray(r.sanityFlags) && r.sanityFlags.length > 0) {
    console.log(`sanityFlags: ${r.sanityFlags.join(', ')}`);
  }
  console.log(`warnings: ${r.warnings.length}`);
  console.log(`markdown: ${built.paths.markdownPath}`);
  console.log(`json: ${built.paths.jsonPath}`);
  console.log(`csv: ${built.paths.csvPath}`);
} catch (error) {
  console.error(`ag-labour report failed: ${error.message}`);
  process.exit(1);
}
