// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { runNamedScenario } from './scenario_helpers.mjs';
import {
  demoScenarioAdaptationWithRailFreightCorridorSmall,
  demoScenarioAdaptationWithRailFreightCorridorMedium,
  demoScenarioAdaptationWithRailFreightCorridorLarge,
  demoScenarioAdaptationWithRailFreightCorridorHighDensity
} from '../program/data/demo_scenario.mjs';

const scaleFactories = {
  small: demoScenarioAdaptationWithRailFreightCorridorSmall,
  medium: demoScenarioAdaptationWithRailFreightCorridorMedium,
  large: demoScenarioAdaptationWithRailFreightCorridorLarge,
  highDensity: demoScenarioAdaptationWithRailFreightCorridorHighDensity
};

const profiles = [
  'conservative',
  'baseline',
  'optimisticRail',
  'highFuelCost',
  'highRoadMaintenanceBurden',
  'lowRailFixedCost',
  'highFreightValue',
  'highDensityCorridor'
];

const rows = [];
for (const [scenarioScale, factory] of Object.entries(scaleFactories)) {
  for (const profile of profiles) {
    const result = runNamedScenario(() => {
      const scenario = factory();
      scenario.calibrationProfile = profile;
      return scenario;
    });
    const item = result.finalYear;
    rows.push({
      scenarioScale,
      profile,
      railPassengerKm: Math.round(item.railPassengerKm ?? 0),
      railFreightTonneKm: Math.round(item.railFreightTonneKm ?? 0),
      railUtilizationRatio: Number((item.railUtilizationRatio ?? 0).toFixed(3)),
      railCostPerPassengerKm: Number((item.railPassengerCostPerKmAtUtilization ?? 0).toFixed(3)),
      railCostPerTonneKm: Number((item.railFreightCostPerTonneKmAtUtilization ?? 0).toFixed(3)),
      railBenefitCostRatio: Number((item.railBenefitCostRatio ?? 0).toFixed(3)),
      railCostRecoveryRatioWithAvoidedCosts: Number((item.railCostRecoveryRatioWithAvoidedCosts ?? 0).toFixed(3)),
      railBreakEvenMixedUtilization: Number((item.railBreakEvenMixedUtilization ?? 0).toFixed(3)),
      railPublicSubsidyRequired: Math.round(item.railPublicSubsidyRequired ?? 0),
      warningCount: item.warningCount ?? 0,
      criticalWarningCount: item.criticalWarningCount ?? 0
    });
  }
}

console.table(rows);

const outputDir = path.resolve('know/produce');
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, 'rail-sensitivity.json');
fs.writeFileSync(outputPath, JSON.stringify(rows, null, 2));
