import { describe, expect, test } from 'vitest';
import { demoScenarioAdaptation } from '../program/data/demo_scenario.mjs';
import { createDemoWorld } from '../program/data/demo_world.mjs';
import { runYear } from '../program/simulation/run_year.mjs';

describe('settlement metrics', () => {
  test('regional metrics include labour and resilience diagnostics', () => {
    const world = createDemoWorld();
    const scenario = demoScenarioAdaptation();
    const metrics = runYear(world, scenario, scenario.startYear);

    expect(metrics).toHaveProperty('producedCalories');
    expect(metrics).toHaveProperty('foodSurplusCalories');
    expect(metrics).toHaveProperty('percentAvailableLabourDemandedByFood');
    expect(metrics).toHaveProperty('foodLabourUnmetDays');
    expect(metrics).toHaveProperty('localFoodCoverageRatio');
    expect(metrics).toHaveProperty('averageHouseholdStress');
    expect(metrics.soilCarbonAverage).toBeGreaterThan(0);
  });
});
