// SPDX-License-Identifier: AGPL-3.0-or-later
import path from 'node:path';
import { createDemoScenario, createDemoWorld, runScenario, writeGeoJSON } from '../program/index.mjs';

const world = createDemoWorld();
const scenario = createDemoScenario();
runScenario(world, scenario);

const outputDir = path.resolve('know/produce');
const result = writeGeoJSON(world, outputDir);

console.log('Wrote GeoJSON files:');
console.log(result.patchesPath);
console.log(result.buildingsPath);
console.log(result.networksPath);
console.log(result.stationsPath);
console.log(result.freightAnchorsPath);
