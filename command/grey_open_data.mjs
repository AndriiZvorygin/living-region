// SPDX-License-Identifier: AGPL-3.0-or-later
import { greyOpenDataManifest, validateGreyOpenDataManifest } from '../program/data/grey_open_data_manifest.mjs';

const validation = validateGreyOpenDataManifest(greyOpenDataManifest);
console.log(`Grey open-data sources: ${greyOpenDataManifest.length}`);
console.log(`manifestValid: ${validation.valid}`);
for (const source of greyOpenDataManifest) {
  console.log(`- ${source.id}: ${source.name} [${source.status}]`);
}
if (!validation.valid) {
  console.log('manifestErrors:');
  for (const err of validation.errors) {
    console.log(`  - ${err.id ?? err.index}: ${err.message}`);
  }
}
