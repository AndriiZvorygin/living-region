// SPDX-License-Identifier: AGPL-3.0-or-later
import path from 'node:path';
import { importGreyCensusPopulationLabour } from '../program/data/grey_census_population_labour_import.mjs';

function parseArgs(argv) {
  const out = { inputDir: 'know/input/census-population-labour/2021', produceDir: 'know/produce' };
  for (const arg of argv) {
    if (arg.startsWith('--input-dir=')) out.inputDir = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--produce-dir=')) out.produceDir = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--occupation-table=')) out.occupationTable = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--industry-table=')) out.industryTable = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--work-activity-table=')) out.workActivityTable = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--occupation-minor-industry-table=')) out.occupationMinorIndustryTable = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--class-worker-occupation-minor-table=')) out.classWorkerOccupationMinorTable = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--class-worker-industry-table=')) out.classWorkerIndustryTable = arg.split('=').slice(1).join('=');
  }
  return out;
}

try {
  const args = parseArgs(process.argv.slice(2));
  const imported = importGreyCensusPopulationLabour({
    inputDir: path.resolve(args.inputDir),
    produceDir: path.resolve(args.produceDir),
    occupationTable: args.occupationTable ? path.resolve(args.occupationTable) : undefined,
    industryTable: args.industryTable ? path.resolve(args.industryTable) : undefined,
    workActivityTable: args.workActivityTable ? path.resolve(args.workActivityTable) : undefined,
    occupationMinorIndustryTable: args.occupationMinorIndustryTable ? path.resolve(args.occupationMinorIndustryTable) : undefined,
    classWorkerOccupationMinorTable: args.classWorkerOccupationMinorTable ? path.resolve(args.classWorkerOccupationMinorTable) : undefined,
    classWorkerIndustryTable: args.classWorkerIndustryTable ? path.resolve(args.classWorkerIndustryTable) : undefined
  });

  console.log(`agLabourDataStatus: ${imported.summary.dataStatus.agLabourDataStatus}`);
  console.log(`currentAgRelatedWorkers: ${imported.summary.currentAgRelatedWorkers}`);
  console.log(`currentAgRelatedFTEEstimate: ${imported.summary.currentAgRelatedFTEEstimate.toFixed(2)}`);
  console.log(`coreAgriculturalWorkers: ${imported.summary.coreAgriculturalWorkers}`);
  console.log(`coreAgOccupationWorkers: ${imported.summary.coreAgOccupationWorkers ?? 0}`);
  console.log(`occupationSourceStatus: ${imported.summary.occupationSourceStatus ?? 'missing'}`);
  console.log(`currentAgLabourPreferredBasis: ${imported.summary.currentAgLabourPreferredBasis ?? 'industryProxy'}`);
  console.log(`agricultureIndustryWorkers: ${imported.summary.agricultureIndustryWorkers}`);
  console.log(`currentCoreAgFTEEstimate: ${imported.summary.currentCoreAgFTEEstimate.toFixed(2)}`);
  console.log(`currentAgIndustryFTEEstimate: ${imported.summary.currentAgIndustryFTEEstimate.toFixed(2)}`);
  console.log(`currentBroadAgAdjacentFTEEstimate: ${imported.summary.currentBroadAgAdjacentFTEEstimate.toFixed(2)}`);
  if (Array.isArray(imported.summary.sanityFlags) && imported.summary.sanityFlags.length > 0) {
    console.log(`sanityFlags: ${imported.summary.sanityFlags.join(', ')}`);
  }
  console.log(`warnings: ${imported.summary.warnings.length}`);
  console.log(`json: ${imported.outputPath}`);
  console.log(`diagnostics: ${imported.diagnosticsPath}`);
} catch (error) {
  console.error(`census-pop-labour import failed: ${error.message}`);
  process.exit(1);
}
