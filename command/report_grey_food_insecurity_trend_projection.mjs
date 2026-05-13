// SPDX-License-Identifier: AGPL-3.0-or-later
import path from 'node:path';
import { buildGreyFoodInsecurityTrendProjectionReport } from '../program/report/grey_food_insecurity_trend_projection_report.mjs';

function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (const arg of argv) {
    if (arg.startsWith('--produce-dir=')) out.produceDir = arg.split('=').slice(1).join('=');
  }
  return out;
}

try {
  const args = parseArgs();
  const built = buildGreyFoodInsecurityTrendProjectionReport({
    produceDir: path.resolve(args.produceDir ?? 'know/produce')
  });
  const p = built.report.articlePreferredProjection;
  console.log(`projectionYear: ${built.report.projectionYear}`);
  console.log(`method: ${p.method}`);
  console.log(`projected2027RatePct: ${p.projected2027RatePct.toFixed(2)}`);
  console.log(`projected2027People: ${p.projected2027People.toFixed(0)}`);
  console.log(`rangePeople: ${p.rangeLowPeople.toFixed(0)}-${p.rangeHighPeople.toFixed(0)}`);
  console.log(`json: ${built.paths.jsonPath}`);
  console.log(`markdown: ${built.paths.markdownPath}`);
  console.log(`series csv: ${built.paths.csvPath}`);
} catch (error) {
  console.error(`food insecurity trend projection report failed: ${error.message}`);
  process.exit(1);
}
