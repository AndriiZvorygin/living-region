import { describe, expect, test } from 'vitest';
import { createDemoWorld } from '../program/data/demo_world.mjs';
import { demoScenarioAdaptation, demoScenarioNoAdaptation } from '../program/data/demo_scenario.mjs';
import { runScenario } from '../program/index.mjs';
import { runYear } from '../program/simulation/run_year.mjs';

function finalYear(factory) {
  const world = createDemoWorld();
  const scenario = factory();
  return runScenario(world, scenario).years.at(-1);
}

describe('transport allocation realism', () => {
  test('adaptation shifts more passenger travel into non-diesel modes', () => {
    const noAdapt = finalYear(demoScenarioNoAdaptation);
    const adapt = finalYear(demoScenarioAdaptation);

    expect(adapt.nonDieselPassengerKm).toBeGreaterThan(noAdapt.nonDieselPassengerKm);
    expect(adapt.localizedPassengerKmAvoided).toBeGreaterThan(noAdapt.localizedPassengerKmAvoided);
  });

  test('adaptation reduces transport diesel demand by final year', () => {
    const noAdapt = finalYear(demoScenarioNoAdaptation);
    const adapt = finalYear(demoScenarioAdaptation);

    expect(adapt.transportDieselDemandLitre).toBeLessThan(noAdapt.transportDieselDemandLitre);
  });

  test('diesel prioritization protects freight more than passenger demand', () => {
    const world = createDemoWorld();
    const scenario = demoScenarioAdaptation();
    scenario.dieselAvailabilityByYear[scenario.startYear] = 0.25;
    scenario.adaptation.freightPriorityForFoodAndFuel = true;

    const metrics = runYear(world, scenario, scenario.startYear);
    const passengerUnmetShare = metrics.totalPassengerKmDemand > 0
      ? metrics.unmetPassengerKm / metrics.totalPassengerKmDemand
      : 0;
    const freightUnmetShare = metrics.totalFreightTonneKmDemand > 0
      ? metrics.unmetFreightTonneKm / metrics.totalFreightTonneKmDemand
      : 0;

    expect(freightUnmetShare).toBeLessThan(passengerUnmetShare);
  });

  test('animal draft and cart transport consume fodder and labour', () => {
    const world = createDemoWorld();
    const scenario = demoScenarioAdaptation();
    scenario.adaptation.annualDraftTransportAdoptionRateByYear[scenario.startYear] = 0.2;

    const metrics = runYear(world, scenario, scenario.startYear);

    expect(metrics.transportFodderDemandKg).toBeGreaterThan(0);
    expect(metrics.transportLabourDemandDays).toBeGreaterThan(0);
  });

  test('fodder deficit limits draft transport capacity', () => {
    const worldA = createDemoWorld();
    const scenarioA = demoScenarioAdaptation();
    scenarioA.adaptation.annualDraftTransportAdoptionRateByYear[scenarioA.startYear] = 0.6;
    scenarioA.adaptation.privateCarDependenceReductionRateByYear[scenarioA.startYear] = 0.25;
    scenarioA.dieselAvailabilityByYear[scenarioA.startYear] = 0.35;
    const withFodder = runYear(worldA, scenarioA, scenarioA.startYear);

    const worldB = createDemoWorld();
    for (const group of worldB.plantGroups) {
      if (group.functionalType === 'grassland') {
        group.areaShare = 0.02;
        group.traits.yields.biomassKgPerHaAtMaturity *= 0.05;
      }
    }
    const scenarioB = demoScenarioAdaptation();
    scenarioB.adaptation.annualDraftTransportAdoptionRateByYear[scenarioB.startYear] = 0.6;
    scenarioB.adaptation.privateCarDependenceReductionRateByYear[scenarioB.startYear] = 0.25;
    scenarioB.dieselAvailabilityByYear[scenarioB.startYear] = 0.35;
    const fodderConstrained = runYear(worldB, scenarioB, scenarioB.startYear);

    expect(fodderConstrained.fodderProducedKg).toBeLessThan(withFodder.fodderProducedKg);
    expect(fodderConstrained.transportFodderDemandKg).toBeGreaterThan(0);
    expect(fodderConstrained.transportFodderDeficitKg).toBeGreaterThanOrEqual(withFodder.transportFodderDeficitKg);
    expect(fodderConstrained.nonDieselFreightTonneKm).toBeLessThanOrEqual(withFodder.nonDieselFreightTonneKm);
  });

  test('rail or water access reduces diesel freight demand', () => {
    const worldA = createDemoWorld();
    const scenarioA = demoScenarioAdaptation();
    scenarioA.adaptation.annualRailWaterFreightUseRateByYear[scenarioA.startYear] = 0.25;
    const withAccess = runYear(worldA, scenarioA, scenarioA.startYear);

    const worldB = createDemoWorld();
    worldB.infrastructures = worldB.infrastructures.filter((item) => !['rail', 'water'].includes(item.type));
    const scenarioB = demoScenarioAdaptation();
    scenarioB.adaptation.annualRailWaterFreightUseRateByYear[scenarioB.startYear] = 0.25;
    const withoutAccess = runYear(worldB, scenarioB, scenarioB.startYear);

    expect(withAccess.transportDieselDemandLitre).toBeLessThan(withoutAccess.transportDieselDemandLitre);
  });
});
