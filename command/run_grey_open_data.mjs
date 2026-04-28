// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { runScenario } from '../program/simulation/run_scenario.mjs';
import { generateGreyCountyWorld } from '../program/data/generate_grey_county_world.mjs';
import { demoScenarioAdaptation } from '../program/data/demo_scenario.mjs';

const outputDir = path.resolve('know/produce');
fs.mkdirSync(outputDir, { recursive: true });

const world = generateGreyCountyWorld({
  scale: 'full-county',
  includeRail: false,
  includeWaterFreight: false,
  includeSyntheticPolygons: true,
  useOpenDataGeometry: true,
  seedName: 'grey-county-open-data-seed'
});

const scenario = demoScenarioAdaptation();
const result = runScenario(world, scenario);
const finalYear = result.years.at(-1);

const metricsPath = path.join(outputDir, 'grey-county-open-data-metrics.json');
fs.writeFileSync(metricsPath, JSON.stringify({
  scenario: scenario.name,
  years: result.years,
  seedMeta: world.seedMeta
}, null, 2));

console.log(`final foodCoverage: ${(finalYear.localFoodCoverageRatio ?? 0).toFixed(3)}`);
console.log(`foodSurplusGJ: ${(finalYear.foodSurplusGJ ?? 0).toFixed(2)}`);
console.log(`averageRent: ${(finalYear.averageRent ?? 0).toFixed(2)}`);
console.log(`ruralTransitionPressureIndex: ${(finalYear.ruralTransitionPressureIndex ?? 0).toFixed(3)}`);
console.log(`municipality count: ${world.seedMeta.summary.municipalityFeaturesMatched}`);
console.log(`settlement feature count: ${world.seedMeta.summary.settlementFeaturesImported}`);
console.log(`land-use feature count: ${world.seedMeta.summary.landUseFeaturesImported}`);
console.log('road source: synthetic');
console.log(`warnings: ${(world.seedMeta.warnings ?? []).length}`);
for (const warning of (world.seedMeta.warnings ?? [])) {
  console.log(`  - ${warning}`);
}
console.log(`metrics: ${metricsPath}`);
