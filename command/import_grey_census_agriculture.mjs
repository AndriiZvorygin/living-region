// SPDX-License-Identifier: AGPL-3.0-or-later
import path from 'node:path';
import { importGreyCensusAgriculture } from '../program/data/grey_census_agriculture_import.mjs';

function parseArgs(argv) {
  const out = {
    censusAgDir: 'know/input/census-agriculture/2021',
    produceDir: 'know/produce'
  };
  for (const arg of argv) {
    if (arg.startsWith('--census-ag-dir=')) out.censusAgDir = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--produce-dir=')) out.produceDir = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--operators-work=')) out.operatorsWork = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--operators-demographics=')) out.operatorsDemographics = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--hired-labour=')) out.hiredLabour = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--community-profiles=')) out.communityProfiles = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--operators-work-table=')) out.operatorsWork = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--operators-age-table=')) out.operatorsDemographics = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--farms-table=')) out.communityProfiles = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--hired-labour-table=')) out.hiredLabour = arg.split('=').slice(1).join('=');
  }
  return out;
}

try {
  const args = parseArgs(process.argv.slice(2));
  const imported = importGreyCensusAgriculture({
    censusAgDir: path.resolve(args.censusAgDir),
    produceDir: path.resolve(args.produceDir),
    operatorsWork: args.operatorsWork ? path.resolve(args.operatorsWork) : undefined,
    operatorsDemographics: args.operatorsDemographics ? path.resolve(args.operatorsDemographics) : undefined,
    hiredLabour: args.hiredLabour ? path.resolve(args.hiredLabour) : undefined,
    communityProfiles: args.communityProfiles ? path.resolve(args.communityProfiles) : undefined
  });

  console.log(`geography level: ${imported.summary.geographyLevel}`);
  console.log(`numberOfFarmOperators: ${imported.summary.numberOfFarmOperators}`);
  console.log(`operatorsWithOffFarmWork: ${imported.summary.operatorsWithOffFarmWork}`);
  console.log(`hiredLabour: ${imported.summary.hiredLabour}`);
  console.log(`numberOfFarms: ${imported.summary.numberOfFarms}`);
  console.log(`hasFarmLabourData: ${imported.summary.dataStatus.hasFarmLabourData}`);
  console.log(`warnings: ${imported.summary.warnings.length}`);
  console.log(`json: ${imported.outputPaths.jsonPath}`);
  console.log(`csv: ${imported.outputPaths.csvPath}`);
} catch (error) {
  console.error(`census-ag import failed: ${error.message}`);
  process.exit(1);
}
