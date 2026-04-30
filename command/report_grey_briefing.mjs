// SPDX-License-Identifier: AGPL-3.0-or-later
import path from 'node:path';
import { buildGreyPlainEnglishBriefingReport } from '../program/report/grey_plain_english_briefing_report.mjs';

function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (const arg of argv) {
    if (arg.startsWith('--produce-dir=')) out.produceDir = arg.split('=').slice(1).join('=');
  }
  return out;
}

try {
  const args = parseArgs();
  const built = buildGreyPlainEnglishBriefingReport({
    produceDir: path.resolve(args.produceDir ?? 'know/produce')
  });
  const report = built.report;
  console.log(`title: ${report.title}`);
  console.log(`findings: ${report.findings.length}`);
  console.log(`population2021: ${report.keyNumbers.population2021}`);
  console.log(`presentIndustrialFossilBaseline foodCoverage: ${report.keyNumbers.presentIndustrialCoverage.toFixed(3)}`);
  console.log(`localizedPresentTechBaseline foodCoverage: ${report.keyNumbers.localizedPresentCoverage.toFixed(3)}`);
  console.log(`shock20 foodCoverage: ${report.keyNumbers.shock20Coverage.toFixed(3)}`);
  console.log(`markdown: ${built.paths.markdownPath}`);
  console.log(`json: ${built.paths.jsonPath}`);
  console.log(`email summary: ${built.paths.emailSummaryPath}`);
} catch (error) {
  console.error(`briefing report failed: ${error.message}`);
  process.exit(1);
}
