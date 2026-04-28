import { describe, expect, test } from 'vitest';
import { demoScenarioAdaptation, demoScenarioNoAdaptation } from '../program/data/demo_scenario.mjs';
import { createDemoWorld } from '../program/data/demo_world.mjs';
import { runScenario } from '../program/simulation/run_scenario.mjs';

describe('stress feedback', () => {
  test('sustained food deficit increases average household stress', () => {
    const world = createDemoWorld();
    const scenario = demoScenarioNoAdaptation();

    const { years } = runScenario(world, scenario);
    expect(years[years.length - 1].averageHouseholdStress).toBeGreaterThan(years[0].averageHouseholdStress);
  });

  test('adaptation scenario improves final stress or food coverage over no adaptation', () => {
    const noAdaptWorld = createDemoWorld();
    const noAdaptScenario = demoScenarioNoAdaptation();
    const noAdapt = runScenario(noAdaptWorld, noAdaptScenario).years.at(-1);

    const adaptWorld = createDemoWorld();
    const adaptScenario = demoScenarioAdaptation();
    const adapt = runScenario(adaptWorld, adaptScenario).years.at(-1);

    const betterStress = adapt.averageHouseholdStress < noAdapt.averageHouseholdStress;
    const betterFoodCoverage = adapt.localFoodCoverageRatio > noAdapt.localFoodCoverageRatio;

    expect(betterStress || betterFoodCoverage).toBe(true);
  });
});
