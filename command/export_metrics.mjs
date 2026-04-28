// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import {
  runAdaptation,
  runNoAdaptation,
  runAdaptationWithRailBasic,
  runAdaptationWithRailCorridor,
  runAdaptationWithRailFreightCorridor,
  runAdaptationWithElectrifiedRailCorridor,
  runAdaptationWithElectrifiedRailFreightCorridor,
  runNamedScenario
} from './scenario_helpers.mjs';
import {
  demoScenarioAdaptationWithRailFreightCorridorSmall,
  demoScenarioAdaptationWithRailFreightCorridorMedium,
  demoScenarioAdaptationWithRailFreightCorridorLarge,
  demoScenarioAdaptationWithRailFreightCorridorHighDensity
} from '../program/data/demo_scenario.mjs';

const outputDir = path.resolve('know/produce');
fs.mkdirSync(outputDir, { recursive: true });

const adaptation = runAdaptation();
const noAdaptation = runNoAdaptation();
const adaptationWithRailBasic = runAdaptationWithRailBasic();
const adaptationWithRailCorridor = runAdaptationWithRailCorridor();
const adaptationWithRailFreightCorridor = runAdaptationWithRailFreightCorridor();
const adaptationWithElectrifiedRailCorridor = runAdaptationWithElectrifiedRailCorridor();
const adaptationWithElectrifiedRailFreightCorridor = runAdaptationWithElectrifiedRailFreightCorridor();

const compareFinal = {
  adaptation: adaptation.finalYear,
  noAdaptation: noAdaptation.finalYear,
  adaptationWithRailBasic: adaptationWithRailBasic.finalYear,
  adaptationWithRailCorridor: adaptationWithRailCorridor.finalYear,
  adaptationWithRailFreightCorridor: adaptationWithRailFreightCorridor.finalYear,
  adaptationWithElectrifiedRailCorridor: adaptationWithElectrifiedRailCorridor.finalYear,
  adaptationWithElectrifiedRailFreightCorridor: adaptationWithElectrifiedRailFreightCorridor.finalYear
};

const adaptationPath = path.join(outputDir, 'demo-adaptation-metrics.json');
const noAdaptationPath = path.join(outputDir, 'demo-no-adaptation-metrics.json');
const adaptationWithRailBasicPath = path.join(outputDir, 'demo-adaptation-with-rail-basic-metrics.json');
const adaptationWithRailCorridorPath = path.join(outputDir, 'demo-adaptation-with-rail-corridor-metrics.json');
const adaptationWithRailFreightCorridorPath = path.join(outputDir, 'demo-adaptation-with-rail-freight-corridor-metrics.json');
const adaptationWithElectrifiedRailCorridorPath = path.join(outputDir, 'demo-adaptation-with-electrified-rail-corridor-metrics.json');
const adaptationWithElectrifiedRailFreightCorridorPath = path.join(outputDir, 'demo-adaptation-with-electrified-rail-freight-corridor-metrics.json');
const adaptationWithRailLegacyPath = path.join(outputDir, 'demo-adaptation-with-rail-metrics.json');
const adaptationWithElectrifiedRailLegacyPath = path.join(outputDir, 'demo-adaptation-with-electrified-rail-metrics.json');
const comparePath = path.join(outputDir, 'demo-compare-final.json');
const calibrationComparePath = path.join(outputDir, 'demo-rail-calibration-compare.json');
const sensitivityPath = path.join(outputDir, 'rail-sensitivity.json');

fs.writeFileSync(adaptationPath, JSON.stringify({ scenario: adaptation.scenario.name, years: adaptation.years }, null, 2));
fs.writeFileSync(noAdaptationPath, JSON.stringify({ scenario: noAdaptation.scenario.name, years: noAdaptation.years }, null, 2));
fs.writeFileSync(adaptationWithRailBasicPath, JSON.stringify({ scenario: adaptationWithRailBasic.scenario.name, years: adaptationWithRailBasic.years }, null, 2));
fs.writeFileSync(adaptationWithRailCorridorPath, JSON.stringify({ scenario: adaptationWithRailCorridor.scenario.name, years: adaptationWithRailCorridor.years }, null, 2));
fs.writeFileSync(adaptationWithRailFreightCorridorPath, JSON.stringify({ scenario: adaptationWithRailFreightCorridor.scenario.name, years: adaptationWithRailFreightCorridor.years }, null, 2));
fs.writeFileSync(adaptationWithElectrifiedRailCorridorPath, JSON.stringify({ scenario: adaptationWithElectrifiedRailCorridor.scenario.name, years: adaptationWithElectrifiedRailCorridor.years }, null, 2));
fs.writeFileSync(adaptationWithElectrifiedRailFreightCorridorPath, JSON.stringify({ scenario: adaptationWithElectrifiedRailFreightCorridor.scenario.name, years: adaptationWithElectrifiedRailFreightCorridor.years }, null, 2));
fs.writeFileSync(adaptationWithRailLegacyPath, JSON.stringify({ scenario: adaptationWithRailBasic.scenario.name, years: adaptationWithRailBasic.years }, null, 2));
fs.writeFileSync(adaptationWithElectrifiedRailLegacyPath, JSON.stringify({ scenario: adaptationWithElectrifiedRailCorridor.scenario.name, years: adaptationWithElectrifiedRailCorridor.years }, null, 2));
fs.writeFileSync(comparePath, JSON.stringify(compareFinal, null, 2));

const calibrationProfiles = [
  'conservative',
  'baseline',
  'optimisticRail',
  'highFuelCost',
  'highRoadMaintenanceBurden',
  'lowRailFixedCost',
  'highFreightValue',
  'highDensityCorridor'
];

const calibrationRows = calibrationProfiles.map((profile) => {
  const result = runNamedScenario(() => {
    const scenario = demoScenarioAdaptationWithRailFreightCorridorMedium();
    scenario.calibrationProfile = profile;
    return scenario;
  });
  const item = result.finalYear;
  return {
    profile,
    railBenefitCostRatio: item.railBenefitCostRatio ?? 0,
    railCostRecoveryRatioWithAvoidedCosts: item.railCostRecoveryRatioWithAvoidedCosts ?? 0,
    railBreakEvenMixedUtilization: item.railBreakEvenMixedUtilization ?? 0,
    railPublicSubsidyRequired: item.railPublicSubsidyRequired ?? 0,
    mixedScaleMultiplierNeeded: item.mixedScaleMultiplierNeeded ?? 0,
    warningCount: item.warningCount ?? 0
  };
});
fs.writeFileSync(calibrationComparePath, JSON.stringify(calibrationRows, null, 2));

const scaleFactories = {
  small: demoScenarioAdaptationWithRailFreightCorridorSmall,
  medium: demoScenarioAdaptationWithRailFreightCorridorMedium,
  large: demoScenarioAdaptationWithRailFreightCorridorLarge,
  highDensity: demoScenarioAdaptationWithRailFreightCorridorHighDensity
};
const sensitivityRows = [];
for (const [scenarioScale, factory] of Object.entries(scaleFactories)) {
  for (const profile of calibrationProfiles) {
    const result = runNamedScenario(() => {
      const scenario = factory();
      scenario.calibrationProfile = profile;
      return scenario;
    });
    const item = result.finalYear;
    sensitivityRows.push({
      scenarioScale,
      profile,
      railPassengerKm: item.railPassengerKm ?? 0,
      railFreightTonneKm: item.railFreightTonneKm ?? 0,
      railUtilizationRatio: item.railUtilizationRatio ?? 0,
      railCostPerPassengerKm: item.railPassengerCostPerKmAtUtilization ?? 0,
      railCostPerTonneKm: item.railFreightCostPerTonneKmAtUtilization ?? 0,
      railBenefitCostRatio: item.railBenefitCostRatio ?? 0,
      railCostRecoveryRatioWithAvoidedCosts: item.railCostRecoveryRatioWithAvoidedCosts ?? 0,
      railBreakEvenMixedUtilization: item.railBreakEvenMixedUtilization ?? 0,
      railPublicSubsidyRequired: item.railPublicSubsidyRequired ?? 0,
      warningCount: item.warningCount ?? 0,
      criticalWarningCount: item.criticalWarningCount ?? 0
    });
  }
}
fs.writeFileSync(sensitivityPath, JSON.stringify(sensitivityRows, null, 2));

console.log('Wrote metrics files:');
console.log(adaptationPath);
console.log(noAdaptationPath);
console.log(adaptationWithRailBasicPath);
console.log(adaptationWithRailCorridorPath);
console.log(adaptationWithRailFreightCorridorPath);
console.log(adaptationWithElectrifiedRailCorridorPath);
console.log(adaptationWithElectrifiedRailFreightCorridorPath);
console.log(adaptationWithRailLegacyPath);
console.log(adaptationWithElectrifiedRailLegacyPath);
console.log(comparePath);
console.log(calibrationComparePath);
console.log(sensitivityPath);
