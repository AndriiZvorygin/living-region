// SPDX-License-Identifier: AGPL-3.0-or-later
import { defaultConstants, mergeScenarioConstants } from '../program/data/default_constants.mjs';
import { applyCalibrationProfile } from '../program/data/calibration_profiles.mjs';
import {
  createDemoWorld,
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
  demoScenarioAdaptationWithRailFreightCorridorHighDensity,
  demoScenarioAdaptationWithRail,
  demoScenarioAdaptationWithElectrifiedRail,
  runScenario
} from '../program/index.mjs';

function applyScenarioScale(world, scenario) {
  const scale = scenario.scaleMultipliers ?? {};
  const populationMul = scale.population ?? 1;
  const stationCatchmentMul = scale.stationCatchment ?? 1;
  const jobsMul = scale.jobs ?? 1;
  const productiveLandMul = scale.productiveLandCatchment ?? 1;
  const depotThroughputMul = scale.depotThroughput ?? 1;
  const serviceFrequencyMul = scale.serviceFrequency ?? 1;
  const railCapacityMul = scale.railCapacity ?? 1;

  for (const household of world.households) {
    const total = Math.max(1, Math.round(household.people.total * populationMul));
    const workers = Math.max(1, Math.min(total, Math.round(household.people.workers * Math.max(populationMul, jobsMul))));
    household.people.total = total;
    household.people.workers = workers;
    household.people.dependents = Math.max(0, total - workers);
  }

  for (const infra of world.infrastructures) {
    infra.walkCatchmentPeople = Math.round((infra.walkCatchmentPeople ?? 0) * stationCatchmentMul);
    infra.bicycleCatchmentPeople = Math.round((infra.bicycleCatchmentPeople ?? 0) * stationCatchmentMul);
    infra.parkAndRideCatchmentPeople = Math.round((infra.parkAndRideCatchmentPeople ?? 0) * stationCatchmentMul);
    infra.freightCatchmentHa = (infra.freightCatchmentHa ?? 0) * productiveLandMul;
    infra.annualThroughputTonnes = (infra.annualThroughputTonnes ?? 0) * depotThroughputMul;
    infra.serviceFrequencyPerDay = (infra.serviceFrequencyPerDay ?? 0) * serviceFrequencyMul;
  }

  for (const network of world.networks) {
    for (const segment of network.segments ?? []) {
      if (segment.type === 'traditionalRail' || segment.type === 'electrifiedRail') {
        segment.capacityPassengerKmPerYear *= railCapacityMul;
        segment.capacityTonneKmPerYear *= railCapacityMul;
      }
    }
  }
}

export function runNamedScenario(factory) {
  const world = createDemoWorld();
  const scenario = factory();
  applyScenarioScale(world, scenario);
  const result = runScenario(world, scenario);
  const calibratedDefaults = applyCalibrationProfile(defaultConstants, scenario.calibrationProfile ?? 'baseline');
  const constants = mergeScenarioConstants(calibratedDefaults, scenario.constants ?? {});
  return {
    world,
    scenario,
    constants,
    years: result.years,
    finalYear: result.years[result.years.length - 1]
  };
}

export function runAdaptation() {
  return runNamedScenario(demoScenarioAdaptation);
}

export function runNoAdaptation() {
  return runNamedScenario(demoScenarioNoAdaptation);
}

export function runAdaptationWithRail() {
  return runNamedScenario(demoScenarioAdaptationWithRail);
}

export function runAdaptationWithElectrifiedRail() {
  return runNamedScenario(demoScenarioAdaptationWithElectrifiedRail);
}

export function runAdaptationWithRailBasic() {
  return runNamedScenario(demoScenarioAdaptationWithRailBasic);
}

export function runAdaptationWithRailCorridor() {
  return runNamedScenario(demoScenarioAdaptationWithRailCorridor);
}

export function runAdaptationWithElectrifiedRailCorridor() {
  return runNamedScenario(demoScenarioAdaptationWithElectrifiedRailCorridor);
}

export function runAdaptationWithRailFreightCorridor() {
  return runNamedScenario(demoScenarioAdaptationWithRailFreightCorridor);
}

export function runAdaptationWithElectrifiedRailFreightCorridor() {
  return runNamedScenario(demoScenarioAdaptationWithElectrifiedRailFreightCorridor);
}

export function runAdaptationWithRailFreightCorridorSmall() {
  return runNamedScenario(demoScenarioAdaptationWithRailFreightCorridorSmall);
}

export function runAdaptationWithRailFreightCorridorMedium() {
  return runNamedScenario(demoScenarioAdaptationWithRailFreightCorridorMedium);
}

export function runAdaptationWithRailFreightCorridorLarge() {
  return runNamedScenario(demoScenarioAdaptationWithRailFreightCorridorLarge);
}

export function runAdaptationWithRailFreightCorridorHighDensity() {
  return runNamedScenario(demoScenarioAdaptationWithRailFreightCorridorHighDensity);
}
