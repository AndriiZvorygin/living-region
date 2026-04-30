// SPDX-License-Identifier: AGPL-3.0-or-later
import path from 'node:path';
import { buildGreyDwellingLandAccessReport } from '../program/report/grey_dwelling_land_access_report.mjs';

function parseArgs(argv = process.argv.slice(2)) {
  const opts = {};
  for (const arg of argv) {
    if (arg.startsWith('--input-dir=')) opts.inputDir = arg.slice('--input-dir='.length);
    else if (arg.startsWith('--produce-dir=')) opts.produceDir = arg.slice('--produce-dir='.length);
    else if (arg.startsWith('--output-dir=')) opts.produceDir = arg.slice('--output-dir='.length);
  }
  return opts;
}

try {
  const opts = parseArgs();
  const { report, paths } = buildGreyDwellingLandAccessReport({
    inputDir: path.resolve(opts.inputDir ?? 'know/input/gis'),
    produceDir: path.resolve(opts.produceDir ?? 'know/produce')
  });

  console.log(`population distribution source: ${report.populationDistributionSource}`);
  console.log(`total population: ${report.totalPopulation}`);
  console.log(`total dwellings: ${report.totalDwellings}`);
  console.log(`inside settlement population: ${report.insideSettlementPopulation}`);
  console.log(`outside settlement population: ${report.outsideSettlementPopulation}`);
  console.log(`estimated no-direct-land-access population: ${Number(report.estimatedPopulationNoDirectLandAccess).toFixed(2)}`);
  console.log(`estimated subsistence-potential population: ${Number(report.estimatedPopulationWithSubsistencePotential).toFixed(2)}`);
  console.log(`estimated smallholding-potential population: ${Number(report.estimatedPopulationWithSmallholdingPotential).toFixed(2)}`);
  console.log(`markdown: ${paths.markdownPath}`);
  console.log(`json: ${paths.jsonPath}`);
  console.log(`municipal csv: ${paths.municipalCsvPath}`);
  console.log(`threshold csv: ${paths.thresholdsCsvPath}`);
} catch (error) {
  console.error(`dwelling-land-access report failed: ${error.message}`);
  process.exit(1);
}
