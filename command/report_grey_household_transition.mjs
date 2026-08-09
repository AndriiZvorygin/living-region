// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import {buildCarryingCapacityReport} from '../packages/carrying-capacity/src/index.mjs';

const produce = path.resolve('know/produce');
fs.mkdirSync(produce, {recursive: true});
const summary = buildCarryingCapacityReport();
const transition = summary.canonical.food_forest_transition;
fs.writeFileSync(path.join(produce, 'grey-household-transition.json'), JSON.stringify({
  report_version: '1.0.0',
  scope: 'canonical ARC household transition applied as the Grey planning baseline',
  source: 'packages/carrying-capacity/outputs/summary.json',
  transition
}, null, 2) + '\n');
fs.copyFileSync(path.join('packages/carrying-capacity', 'outputs', 'household-transition-scenarios.md'), path.join(produce, 'grey-household-transition.md'));
console.log(`grey household transition JSON: ${path.join(produce, 'grey-household-transition.json')}`);
console.log(`grey household transition Markdown: ${path.join(produce, 'grey-household-transition.md')}`);
