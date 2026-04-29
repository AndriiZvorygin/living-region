// SPDX-License-Identifier: AGPL-3.0-or-later
import { buildGreyPopulationDistributionReport } from '../program/report/grey_population_distribution_report.mjs';

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    if (arg.startsWith('--produce-dir=')) out.produceDir = arg.split('=').slice(1).join('=');
    if (arg.startsWith('--input-gis-dir=')) out.inputGisDir = arg.split('=').slice(1).join('=');
  }
  return out;
}

try {
  const args = parseArgs(process.argv.slice(2));
  const { report, paths } = buildGreyPopulationDistributionReport(args);
  console.log(`population source: ${report.populationDistributionSource}`);
  console.log(`population matched: ${report.totalPopulationMatched}`);
  console.log(`inside settlement: ${report.populationInsideSettlementBoundaries}`);
  console.log(`outside settlement: ${report.populationOutsideSettlementBoundaries}`);
  console.log(`difference vs known: ${report.matchDifferenceVsKnownGreyPopulation}`);
  console.log(`warnings: ${report.warnings.length}`);
  console.log(`markdown: ${paths.markdownPath}`);
  console.log(`json: ${paths.jsonPath}`);
  console.log(`municipal csv: ${paths.municipalCsvPath}`);
  console.log(`context csv: ${paths.contextCsvPath}`);
} catch (error) {
  console.error(`report failed: ${error.message}`);
  process.exit(1);
}
