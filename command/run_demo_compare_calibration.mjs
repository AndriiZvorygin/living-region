// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { runNamedScenario } from './scenario_helpers.mjs';
import { demoScenarioAdaptationWithRailFreightCorridorMedium } from '../program/data/demo_scenario.mjs';

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

function runProfile(profile) {
  const result = runNamedScenario(() => {
    const scenario = demoScenarioAdaptationWithRailFreightCorridorMedium();
    scenario.calibrationProfile = profile;
    return scenario;
  });
  return result.finalYear;
}

const rows = profiles.map((profile) => {
  const year = runProfile(profile);
  return {
    profile,
    railBenefitCostRatio: Number((year.railBenefitCostRatio ?? 0).toFixed(3)),
    railCostRecoveryRatioWithAvoidedCosts: Number((year.railCostRecoveryRatioWithAvoidedCosts ?? 0).toFixed(3)),
    railBreakEvenMixedUtilization: Number((year.railBreakEvenMixedUtilization ?? 0).toFixed(3)),
    railPublicSubsidyRequired: Math.round(year.railPublicSubsidyRequired ?? 0),
    mixedScaleMultiplierNeeded: Number((year.mixedScaleMultiplierNeeded ?? 0).toFixed(2)),
    warningCount: year.warningCount ?? 0
  };
});

console.table(rows);

const outputDir = path.resolve('know/produce');
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, 'demo-rail-calibration-compare.json');
fs.writeFileSync(outputPath, JSON.stringify(rows, null, 2));
