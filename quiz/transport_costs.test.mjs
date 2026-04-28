import { describe, expect, test } from 'vitest';
import { demoScenarioAdaptation } from '../program/data/demo_scenario.mjs';
import { createDemoWorld } from '../program/data/demo_world.mjs';
import { runYear } from '../program/simulation/run_year.mjs';

describe('transport costs', () => {
  test('reduced diesel increases transport stress', () => {
    const worldA = createDemoWorld();
    const scenarioA = demoScenarioAdaptation();
    scenarioA.dieselAvailabilityByYear[scenarioA.startYear] = 1;
    const highDiesel = runYear(worldA, scenarioA, scenarioA.startYear);

    const worldB = createDemoWorld();
    const scenarioB = demoScenarioAdaptation();
    scenarioB.dieselAvailabilityByYear[scenarioB.startYear] = 0.4;
    const lowDiesel = runYear(worldB, scenarioB, scenarioB.startYear);

    expect(lowDiesel.transportStress).toBeGreaterThan(highDiesel.transportStress);
    expect(lowDiesel.averageCommuteCost).toBeGreaterThan(highDiesel.averageCommuteCost);
  });

  test('poor road condition increases freight and commute costs', () => {
    const goodWorld = createDemoWorld();
    const goodScenario = demoScenarioAdaptation();
    const good = runYear(goodWorld, goodScenario, goodScenario.startYear);

    const badWorld = createDemoWorld();
    for (const infra of badWorld.infrastructures) {
      if (['road', 'rail', 'trail', 'bridge'].includes(infra.type)) {
        infra.condition = 0.25;
      }
    }
    const badScenario = demoScenarioAdaptation();
    const bad = runYear(badWorld, badScenario, badScenario.startYear);

    expect(bad.averageFreightCost).toBeGreaterThan(good.averageFreightCost);
    expect(bad.averageCommuteCost).toBeGreaterThan(good.averageCommuteCost);
  });
});
