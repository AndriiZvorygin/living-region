// SPDX-License-Identifier: AGPL-3.0-or-later
import { buildGreyLocalizationAccessReport } from '../program/report/grey_localization_access_report.mjs';

function parseArgs(argv = process.argv.slice(2)) {
  const opts = {};
  for (const arg of argv) {
    if (arg.startsWith('--input-dir=')) opts.inputDir = arg.slice('--input-dir='.length);
    if (arg.startsWith('--produce-dir=')) opts.produceDir = arg.slice('--produce-dir='.length);
  }
  return opts;
}

try {
  const { report, paths } = buildGreyLocalizationAccessReport(parseArgs());
  console.log(`municipalities: ${report.municipalLocalizationMetrics.length}`);
  console.log(`candidate nodes: ${report.candidateNodes.length}`);
  console.log(`highest readiness: ${report.regionalSummary.highestReadinessMunicipalities.map((m) => `${m.municipalityName} (${m.localizationReadinessScore.toFixed(3)})`).join(', ')}`);
  console.log(`warnings: ${report.warnings.length}`);
  console.log(`markdown: ${paths.markdownPath}`);
  console.log(`json: ${paths.jsonPath}`);
  console.log(`municipal csv: ${paths.municipalCsvPath}`);
  console.log(`candidate csv: ${paths.candidateCsvPath}`);
} catch (error) {
  console.error(`localization access report failed: ${error.message}`);
  process.exit(1);
}
