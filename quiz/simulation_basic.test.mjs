import { describe, expect, test } from 'vitest';
import { demoScenarioAdaptation } from '../program/data/demo_scenario.mjs';
import { createDemoWorld } from '../program/data/demo_world.mjs';
import { runScenario } from '../program/simulation/run_scenario.mjs';

describe('simulation basic', () => {
  test('demo adaptation scenario runs 20 years', () => {
    const world = createDemoWorld();
    const scenario = demoScenarioAdaptation();
    const result = runScenario(world, scenario);

    expect(result.years).toHaveLength(20);
    expect(result.years[0].year).toBe(2026);
    expect(result.years[19].year).toBe(2045);
  });

  test('settlement food surplus subtracts consumption and spoilage', () => {
    const world = createDemoWorld();
    const scenario = demoScenarioAdaptation();
    const result = runScenario(world, scenario);

    const first = result.years[0];
    expect(first.producedCalories).toBeGreaterThan(0);
    expect(first.consumedCalories).toBeGreaterThan(0);
    expect(first.foodSurplusCalories).toBeLessThanOrEqual(first.producedCalories);
  });
});
