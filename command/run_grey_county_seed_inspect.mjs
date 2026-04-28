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

function fmt(value, digits = 2) {
  return Number(value ?? 0).toFixed(digits);
}

function scaleSuffix(scale) {
  return scale === 'full-county' ? '-full' : '';
}

const args = parseArgs(process.argv.slice(2));
const railMode = toBool(args.rail, false);
const scale = args.scale ?? 'small';
const outputDir = path.resolve('know/produce');

const suffix = scaleSuffix(scale);
const worldPath = railMode
  ? path.join(outputDir, `grey-county-seed-world-rail${suffix}.json`)
  : path.join(outputDir, `grey-county-seed-world${suffix}.json`);

let world;
if (fs.existsSync(worldPath)) {
  const data = JSON.parse(fs.readFileSync(worldPath, 'utf8'));
  world = createWorld(data);
  world.seedMeta = data.seedMeta;
} else {
  world = generateGreyCountyWorld({
    scale,
    includeRail: railMode,
    includeWaterFreight: railMode,
    includeSyntheticPolygons: true
  });
}

const scenario = railMode
  ? demoScenarioAdaptationWithRailFreightCorridor()
  : demoScenarioAdaptation();

const result = runScenario(world, scenario);
const finalYear = result.years.at(-1);

console.log('Scenario:', scenario.name);
console.log('Scale:', scale);
console.log('Year:', finalYear.year);
console.log('');

console.log('Housing');
console.log(`  households: ${Math.round(finalYear.households ?? 0)}`);
console.log(`  dwellingUnits: ${Math.round(finalYear.dwellingUnits ?? 0)}`);
console.log(`  occupiedUnits: ${Math.round(finalYear.occupiedUnits ?? 0)}`);
console.log(`  vacantUnits: ${Math.round(finalYear.vacantUnits ?? 0)}`);
console.log(`  vacancyRate: ${fmt(finalYear.housingVacancyRate)}`);
console.log(`  rentPressure: ${fmt(finalYear.rentPressure ?? 0)}`);
console.log(`  baseAverageRent: ${fmt(finalYear.baseAverageRent ?? 0)}`);
console.log(`  averageRent: ${fmt(finalYear.averageRent ?? 0)}`);
console.log(`  averageAnnualHousingCost: ${fmt(finalYear.averageAnnualHousingCost ?? 0)}`);
console.log(`  averageHouseholdIncome: ${fmt(finalYear.averageHouseholdIncome ?? 0)}`);
console.log(`  averageHousingCostBurden: ${fmt(finalYear.averageHousingCostBurden ?? 0)}`);
console.log(`  householdsHousingStressed: ${Math.round(finalYear.householdsHousingStressed ?? 0)}`);
console.log(`  householdsExceedingUnits: ${Math.round(finalYear.householdsExceedingUnits ?? 0)}`);
console.log(`  averageEstimatedValue: ${fmt(finalYear.averageEstimatedValue ?? finalYear.averageEstimatedBuildingValue ?? 0)}`);
console.log(`  valueToMonthlyRentRatio: ${fmt(finalYear.valueToMonthlyRentRatio ?? 0)}`);
console.log(`  priceToAnnualRentRatio: ${fmt(finalYear.priceToAnnualRentRatio ?? 0)}`);
console.log(`  averageRentGrowthRate: ${fmt(finalYear.averageRentGrowthRate ?? 0, 3)}`);
console.log('');

if (railMode) {
  console.log('Rail');
  console.log(`  railPassengerKm: ${Math.round(finalYear.railPassengerKm ?? 0)}`);
  console.log(`  railFreightTonneKm: ${Math.round(finalYear.railFreightTonneKm ?? 0)}`);
  console.log(`  railUtilizationRatio: ${fmt(finalYear.railUtilizationRatio ?? 0, 3)}`);
  console.log('');
}

console.log('Warnings');
console.log(`  warningCount: ${Math.round(finalYear.warningCount ?? 0)}`);
console.log(`  criticalWarningCount: ${Math.round(finalYear.criticalWarningCount ?? 0)}`);
for (const warning of (finalYear.sanityWarnings ?? []).slice(0, 6)) {
  console.log(`  - ${warning.code} [${warning.severity}] ${warning.metricPath}`);
}
