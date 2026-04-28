// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { createWorld } from '../program/model/world.mjs';
import { generateGreyCountyWorld } from '../program/data/generate_grey_county_world.mjs';
import { runScenario } from '../program/simulation/run_scenario.mjs';
import { demoScenarioAdaptation, demoScenarioAdaptationWithRailFreightCorridor } from '../program/data/demo_scenario.mjs';

function parseArgs(argv) {
  const args = {};
  for (const item of argv) {
    if (!item.startsWith('--')) {
      continue;
    }
    const [key, value] = item.slice(2).split('=');
    args[key] = value ?? true;
  }
  return args;
}

function toBool(value, fallback = false) {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function scaleSuffix(scale) {
  return scale === 'full-county' ? '-full' : '';
}

const args = parseArgs(process.argv.slice(2));
const railMode = toBool(args.rail, false);
const requestedScale = args.scale ?? 'small';
const outputDir = path.resolve('know/produce');
fs.mkdirSync(outputDir, { recursive: true });

const generatedScale = requestedScale === 'full' ? 'full-county' : requestedScale;
const suffix = scaleSuffix(generatedScale);

const worldPath = railMode
  ? path.join(outputDir, `grey-county-seed-world-rail${suffix}.json`)
  : path.join(outputDir, `grey-county-seed-world${suffix}.json`);
const metricsPath = railMode
  ? path.join(outputDir, `grey-county-seed-rail${suffix}-metrics.json`)
  : path.join(outputDir, `grey-county-seed${suffix}-metrics.json`);

let worldData = null;
if (fs.existsSync(worldPath)) {
  worldData = JSON.parse(fs.readFileSync(worldPath, 'utf8'));
}

const needsRegeneration = !worldData
  || worldData.seedMeta?.scale !== generatedScale
  || Boolean(worldData.seedMeta?.includeRail) !== railMode;

let world;
if (needsRegeneration) {
  world = generateGreyCountyWorld({
    scale: generatedScale,
    includeRail: railMode,
    includeWaterFreight: railMode,
    includeSyntheticPolygons: true,
    seedName: railMode ? 'grey-county-seed-rail' : 'grey-county-seed'
  });
  fs.writeFileSync(worldPath, JSON.stringify(world, null, 2));
} else {
  world = createWorld(worldData);
  world.seedMeta = worldData.seedMeta;
}

const scenario = railMode
  ? demoScenarioAdaptationWithRailFreightCorridor()
  : demoScenarioAdaptation();

const result = runScenario(world, scenario);
const finalYear = result.years.at(-1);

fs.writeFileSync(metricsPath, JSON.stringify({
  scenario: scenario.name,
  worldPath,
  scale: world.seedMeta?.scale ?? generatedScale,
  years: result.years
}, null, 2));

console.log(`world: ${worldPath}`);
console.log(`metrics: ${metricsPath}`);
console.log(`scenario: ${scenario.name}`);
console.log(`scale: ${world.seedMeta?.scale ?? generatedScale}`);
console.log(`finalYear: ${finalYear.year}`);
console.log(`populationTotal: ${Math.round(finalYear.populationTotal ?? 0)}`);
console.log(`foodCoverage: ${(finalYear.localFoodCoverageRatio ?? 0).toFixed(3)}`);
console.log(`foodSurplusCalories: ${Math.round(finalYear.foodSurplusCalories ?? 0)}`);
console.log(`averageHouseholdStress: ${(finalYear.averageHouseholdStress ?? 0).toFixed(3)}`);
console.log('Housing:');
console.log(`  households: ${Math.round(finalYear.households ?? 0)}`);
console.log(`  dwellingUnits: ${Math.round(finalYear.dwellingUnits ?? 0)}`);
console.log(`  occupiedUnits: ${Math.round(finalYear.occupiedUnits ?? 0)}`);
console.log(`  vacantUnits: ${Math.round(finalYear.vacantUnits ?? 0)}`);
console.log(`  vacancyRate: ${(finalYear.housingVacancyRate ?? 0).toFixed(3)}`);
console.log(`  rentPressure: ${(finalYear.rentPressure ?? 0).toFixed(3)}`);
console.log(`  averageRent: ${(finalYear.averageRent ?? 0).toFixed(2)}`);
console.log(`  averageHousingCostBurden: ${(finalYear.averageHousingCostBurden ?? 0).toFixed(3)}`);
console.log(`  valueToMonthlyRentRatio: ${(finalYear.valueToMonthlyRentRatio ?? 0).toFixed(2)}`);
console.log(`  priceToAnnualRentRatio: ${(finalYear.priceToAnnualRentRatio ?? 0).toFixed(2)}`);

if (railMode) {
  console.log(`railPassengerKm: ${Math.round(finalYear.railPassengerKm ?? 0)}`);
  console.log(`railFreightTonneKm: ${Math.round(finalYear.railFreightTonneKm ?? 0)}`);
  console.log(`railUtilizationRatio: ${(finalYear.railUtilizationRatio ?? 0).toFixed(3)}`);
  console.log(`transportDieselDeficitLitre: ${Math.round(finalYear.transportDieselDeficitLitre ?? 0)}`);
  console.log(`roadMaintenanceBacklogMoney: ${Math.round(finalYear.roadMaintenanceBacklogMoney ?? 0)}`);
} else {
  console.log(`averageCommuteCost: ${(finalYear.averageCommuteCost ?? 0).toFixed(3)}`);
  console.log(`infrastructureAverageCondition: ${(finalYear.infrastructureAverageCondition ?? 0).toFixed(3)}`);
}

console.log(`warningCount: ${finalYear.warningCount ?? 0}`);
console.log(`criticalWarningCount: ${finalYear.criticalWarningCount ?? 0}`);
