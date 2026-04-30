// SPDX-License-Identifier: AGPL-3.0-or-later
import path from 'node:path';
import { buildGreyFoodInsecurityTrendDriverReport } from '../program/report/grey_food_insecurity_trend_driver_report.mjs';

function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (const arg of argv) {
    if (arg.startsWith('--produce-dir=')) out.produceDir = arg.split('=').slice(1).join('=');
  }
  return out;
}

try {
  const args = parseArgs();
  const built = buildGreyFoodInsecurityTrendDriverReport({ produceDir: path.resolve(args.produceDir ?? 'know/produce') });
  const r = built.report;
  console.log(`projected2027TrendCentral: ${(r.projected2027TrendCentral * 100).toFixed(1)}%`);
  console.log(`topTrendDrivers: ${r.topDrivers.join(', ')}`);
  console.log(`landConsolidationDataStatus: ${r.landConsolidationDataStatus}`);
  console.log(`unexplainedTrendShare: ${r.unexplainedTrendShare.toFixed(3)}`);
  console.log(`markdown: ${built.paths.markdownPath}`);
  console.log(`json: ${built.paths.jsonPath}`);
  console.log(`csv: ${built.paths.csvPath}`);
} catch (error) {
  console.error(`food insecurity trend driver report failed: ${error.message}`);
  process.exit(1);
}
