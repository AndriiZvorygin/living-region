// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { runScenario } from '../program/simulation/run_scenario.mjs';
import { generateGreyCountyWorld } from '../program/data/generate_grey_county_world.mjs';
import { demoScenarioAdaptation } from '../program/data/demo_scenario.mjs';
import { summarizeGreySecondaryCollections } from '../program/data/grey_secondary_counts.mjs';

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
console.log(`road source: ${world.seedMeta.summary.roadSource ?? 'synthetic'}`);
console.log(`roadFeatureCount: ${world.seedMeta.summary.roadFeatureCount ?? 0}`);
console.log(`totalRoadKm: ${Number(world.seedMeta.summary.totalRoadKm ?? 0).toFixed(2)}`);
console.log(`roadClassCounts: ${JSON.stringify(world.seedMeta.summary.roadClassCounts ?? {})}`);
console.log(`roadJurisdictionCounts: ${JSON.stringify(world.seedMeta.summary.roadJurisdictionCounts ?? {})}`);
console.log(`roadFieldsDetected: ${JSON.stringify(world.seedMeta.summary.roadFieldsDetected ?? {})}`);
const secondarySummary = summarizeGreySecondaryCollections(world);
console.log(`transitStopCount: ${secondarySummary.transitStopCount}`);
console.log(`trailFeatureCount: ${secondarySummary.trailFeatureCount}`);
console.log(`cyclingRouteFeatureCount: ${secondarySummary.cyclingRouteFeatureCount}`);
console.log(`managedForestFeatureCount: ${secondarySummary.managedForestFeatureCount}`);
console.log(`ruralBusinessCount: ${secondarySummary.ruralBusinessCount}`);
console.log(`facilityCount: ${secondarySummary.facilityCount}`);
console.log(`roadStructureCount: ${secondarySummary.roadStructureCount}`);
console.log(`secondaryDataCoverageScore: ${secondarySummary.secondaryDataCoverageScore.toFixed(3)}`);
console.log(`warnings: ${(world.seedMeta.warnings ?? []).length}`);
for (const warning of (world.seedMeta.warnings ?? [])) {
  console.log(`  - ${warning}`);
}
console.log(`metrics: ${metricsPath}`);
