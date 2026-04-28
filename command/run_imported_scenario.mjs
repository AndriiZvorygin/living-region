// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { createWorld } from '../program/model/world.mjs';
import { runScenario } from '../program/simulation/run_scenario.mjs';
import {
  demoScenarioAdaptation,
  demoScenarioNoAdaptation,
  demoScenarioAdaptationWithRailFreightCorridor,
  demoScenarioAdaptationWithElectrifiedRailFreightCorridor
} from '../program/data/demo_scenario.mjs';

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

function scenarioFactory(name) {
  const map = {
    adaptation: demoScenarioAdaptation,
    'no-adaptation': demoScenarioNoAdaptation,
    'adaptation-with-rail-freight-corridor': demoScenarioAdaptationWithRailFreightCorridor,
    'adaptation-with-electrified-rail-freight-corridor': demoScenarioAdaptationWithElectrifiedRailFreightCorridor
  };
  return map[name] ?? demoScenarioAdaptationWithRailFreightCorridor;
}

const args = parseArgs(process.argv.slice(2));
const worldPath = path.resolve(args.world ?? 'know/produce/imported-world.json');
const scenarioName = args.scenario ?? 'adaptation-with-rail-freight-corridor';
const outputPath = path.resolve(args.output ?? 'know/produce/imported-scenario-metrics.json');

const payload = JSON.parse(fs.readFileSync(worldPath, 'utf8'));
const worldData = payload.world ?? payload;
const world = createWorld(worldData);
const scenario = scenarioFactory(scenarioName)();
if (payload.calibrationConstants) {
  scenario.constants = payload.calibrationConstants;
}

const result = runScenario(world, scenario);
const finalYear = result.years.at(-1);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify({
  scenario: scenario.name,
  worldPath,
  years: result.years
}, null, 2));

console.log(`Imported scenario metrics written: ${outputPath}`);
console.log(`scenario: ${scenario.name}`);
console.log(`year: ${finalYear.year}`);
console.log(`populationTotal: ${Math.round(finalYear.populationTotal ?? 0)}`);
console.log(`localFoodCoverageRatio: ${(finalYear.localFoodCoverageRatio ?? 0).toFixed(3)}`);
console.log(`railPassengerKm: ${Math.round(finalYear.railPassengerKm ?? 0)}`);
console.log(`railFreightTonneKm: ${Math.round(finalYear.railFreightTonneKm ?? 0)}`);
console.log(`railUtilizationRatio: ${(finalYear.railUtilizationRatio ?? 0).toFixed(3)}`);
console.log(`railBenefitCostRatio: ${(finalYear.railBenefitCostRatio ?? 0).toFixed(3)}`);
console.log(`railPublicSubsidyRequired: ${Math.round(finalYear.railPublicSubsidyRequired ?? 0)}`);
console.log(`warningCount: ${finalYear.warningCount ?? 0}`);
console.log(`criticalWarningCount: ${finalYear.criticalWarningCount ?? 0}`);
