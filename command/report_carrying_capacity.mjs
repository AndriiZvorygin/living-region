// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import {buildCarryingCapacityReport, PACKAGE_ROOT} from '../packages/carrying-capacity/src/index.mjs';

const produce = path.resolve('know/produce');
fs.mkdirSync(produce, {recursive: true});
const result = buildCarryingCapacityReport();
const copies = [
  ['outputs/summary.json', 'carrying-capacity-summary.json'],
  ['outputs/evidence-based-headline-results.md', 'carrying-capacity-headline-results.md'],
  ['outputs/recommended-land-guideline.md', 'carrying-capacity-recommended-land-guideline.md'],
  ['outputs/food-forest-transition.md', 'carrying-capacity-food-forest-transition.md'],
  ['outputs/mature-food-system-canonical.md', 'carrying-capacity-mature-food-system.md'],
  ['outputs/ageing-in-place-labour.md', 'carrying-capacity-ageing-in-place-labour.md']
];
for (const [source, target] of copies) fs.copyFileSync(path.join(PACKAGE_ROOT, source), path.join(produce, target));
console.log(`carrying-capacity model: ${result.canonical ? 'canonical outputs rebuilt' : 'outputs rebuilt'}`);
console.log(`json: ${path.join(produce, 'carrying-capacity-summary.json')}`);
console.log(`headline: ${path.join(produce, 'carrying-capacity-headline-results.md')}`);
