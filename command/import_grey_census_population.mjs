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
    else if (arg.startsWith('--gaf=')) out.gafPath = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--boundaries=')) out.boundariesPath = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--db-boundaries=')) out.dbBoundariesPath = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--da-boundaries=')) out.daBoundariesPath = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--relationship=')) out.relationshipPath = arg.split('=').slice(1).join('=');
  }
  return out;
}

try {
  const args = parseArgs(process.argv.slice(2));
  const result = importGreyCensusPopulation({
    censusDir: path.resolve(args.censusDir),
    inputGisDir: path.resolve(args.inputGisDir),
    produceDir: path.resolve(args.produceDir),
    gafPath: args.gafPath ? path.resolve(args.gafPath) : undefined,
    boundariesPath: args.boundariesPath ? path.resolve(args.boundariesPath) : undefined,
    dbBoundariesPath: args.dbBoundariesPath ? path.resolve(args.dbBoundariesPath) : undefined,
    daBoundariesPath: args.daBoundariesPath ? path.resolve(args.daBoundariesPath) : undefined,
    relationshipPath: args.relationshipPath ? path.resolve(args.relationshipPath) : undefined
  });

  console.log(`geographic level: ${result.summary.geographicLevel}`);
  console.log(`matched population: ${result.summary.totalPopulationMatched}`);
  console.log(`matched dwellings: ${result.summary.totalDwellingsMatched}`);
  console.log(`known grey population: ${result.summary.knownGreyPopulation2021}`);
  console.log(`difference vs known: ${result.summary.matchDifferenceVsKnownGreyPopulation}`);
  console.log(`inside settlement population: ${result.summary.populationInsideSettlementBoundaries}`);
  console.log(`outside settlement population: ${result.summary.populationOutsideSettlementBoundaries}`);
  console.log(`detected files:`);
  for (const msg of result.detectedFiles ?? []) console.log(`  - ${msg}`);
  console.log(`warnings: ${result.summary.warnings.length}`);
  if (result.summary.totalPopulationMatched === 0) {
    console.log('No Census population rows were matched. This means the raw GAF/boundary files are missing or field names did not match. Run census:download-2021 with explicit file URLs or place GAF/boundary files in know/input/census/2021.');
  }
  console.log(`distribution: ${result.outputPaths.distributionPath}`);
  console.log(`blocks: ${result.outputPaths.blocksPath}`);
  console.log(`summary csv: ${result.outputPaths.csvPath}`);
} catch (error) {
  console.error(`census import failed: ${error.message}`);
  process.exit(1);
}
