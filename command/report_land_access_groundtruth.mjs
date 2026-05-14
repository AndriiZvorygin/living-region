// SPDX-License-Identifier: AGPL-3.0-or-later
import path from 'node:path';
import { buildLandAccessGroundtruthSummary } from '../program/reliability/land_access_groundtruth_intake.mjs';

try {
  const produceDir = path.resolve('know/produce');
  const result = buildLandAccessGroundtruthSummary({
    inputDir: 'know/input/local-calibration',
    schemaDir: 'know/schema/local-calibration',
    produceDir,
    sourceManifestPath: 'know/source-manifest.json'
  });
  if (result.status !== 'pass') {
    console.error('land-access groundtruth summary failed');
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(`json: ${result.paths.jsonPath}`);
  console.log(`markdown: ${result.paths.mdPath}`);
  console.log(`groundtruth status: ${result.summary.landAccessGroundtruthStatus}`);
  for (const warning of result.warnings) console.warn(`warning: ${warning}`);
} catch (error) {
  console.error(`land-access groundtruth summary command failed: ${error.message}`);
  process.exit(1);
}
