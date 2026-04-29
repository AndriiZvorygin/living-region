// SPDX-License-Identifier: AGPL-3.0-or-later
import path from 'node:path';
import { importGreyCensusPopulation } from '../program/data/grey_census_population_import.mjs';

function parseArgs(argv) {
  const out = {
    censusDir: 'know/input/census/2021',
    inputGisDir: 'know/input/gis',
    produceDir: 'know/produce'
  };
  for (const arg of argv) {
    if (arg.startsWith('--census-dir=')) out.censusDir = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--input-gis-dir=')) out.inputGisDir = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--produce-dir=')) out.produceDir = arg.split('=').slice(1).join('=');
  }
  return out;
}

try {
  const args = parseArgs(process.argv.slice(2));
  const result = importGreyCensusPopulation({
    censusDir: path.resolve(args.censusDir),
    inputGisDir: path.resolve(args.inputGisDir),
    produceDir: path.resolve(args.produceDir)
  });

  console.log(`geographic level: ${result.summary.geographicLevel}`);
  console.log(`matched population: ${result.summary.totalPopulationMatched}`);
  console.log(`matched dwellings: ${result.summary.totalDwellingsMatched}`);
  console.log(`known grey population: ${result.summary.knownGreyPopulation2021}`);
  console.log(`difference vs known: ${result.summary.matchDifferenceVsKnownGreyPopulation}`);
  console.log(`inside settlement population: ${result.summary.populationInsideSettlementBoundaries}`);
  console.log(`outside settlement population: ${result.summary.populationOutsideSettlementBoundaries}`);
  console.log(`warnings: ${result.summary.warnings.length}`);
  console.log(`distribution: ${result.outputPaths.distributionPath}`);
  console.log(`blocks: ${result.outputPaths.blocksPath}`);
  console.log(`summary csv: ${result.outputPaths.csvPath}`);
} catch (error) {
  console.error(`census import failed: ${error.message}`);
  process.exit(1);
}
