// SPDX-License-Identifier: AGPL-3.0-or-later
import { defaultConstants, mergeScenarioConstants } from '../program/data/default_constants.mjs';
import { applyCalibrationProfile } from '../program/data/calibration_profiles.mjs';
import {
  demoScenarioAdaptation,
  demoScenarioNoAdaptation,
  demoScenarioAdaptationWithRailBasic,
  demoScenarioAdaptationWithRailCorridor,
  demoScenarioAdaptationWithElectrifiedRailCorridor,
  demoScenarioAdaptationWithRailFreightCorridor,
  demoScenarioAdaptationWithElectrifiedRailFreightCorridor,
  demoScenarioAdaptationWithRailFreightCorridorSmall,
  demoScenarioAdaptationWithRailFreightCorridorMedium,
  demoScenarioAdaptationWithRailFreightCorridorLarge,
  demoScenarioAdaptationWithRailFreightCorridorHighDensity
} from '../program/data/demo_scenario.mjs';

function manifest(scenario) {
  const calibratedDefaults = applyCalibrationProfile(defaultConstants, scenario.calibrationProfile ?? 'baseline');
  const constants = mergeScenarioConstants(calibratedDefaults, scenario.constants ?? {});
  const finalYear = scenario.startYear + scenario.years - 1;

  return {
    name: scenario.name,
    startYear: scenario.startYear,
    years: scenario.years,
    dieselFinalAvailability: scenario.dieselAvailabilityByYear[finalYear],
    fertilizerFinalAvailability: scenario.fertilizerAvailabilityByYear[finalYear],
    roadMaintenanceFinalBudget: scenario.roadMaintenanceBudgetByYear[finalYear],
    rail: scenario.rail,
    populationPolicy: scenario.populationPolicy,
    adaptation: scenario.adaptation,
    scaleVariant: scenario.scaleVariant,
    scaleMultipliers: scenario.scaleMultipliers,
    calibrationProfile: scenario.calibrationProfile ?? 'baseline',
    constants
  };
}

const manifests = [
  manifest(demoScenarioNoAdaptation()),
  manifest(demoScenarioAdaptation()),
  manifest(demoScenarioAdaptationWithRailBasic()),
  manifest(demoScenarioAdaptationWithRailCorridor()),
  manifest(demoScenarioAdaptationWithRailFreightCorridor()),
  manifest(demoScenarioAdaptationWithRailFreightCorridorSmall()),
  manifest(demoScenarioAdaptationWithRailFreightCorridorMedium()),
  manifest(demoScenarioAdaptationWithRailFreightCorridorLarge()),
  manifest(demoScenarioAdaptationWithRailFreightCorridorHighDensity()),
  manifest(demoScenarioAdaptationWithElectrifiedRailCorridor()),
  manifest(demoScenarioAdaptationWithElectrifiedRailFreightCorridor())
];
for (const item of manifests) {
  console.log(JSON.stringify(item, null, 2));
}
