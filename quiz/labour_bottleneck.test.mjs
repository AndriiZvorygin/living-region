import { describe, expect, test } from 'vitest';
import { demoScenarioAdaptation } from '../program/data/demo_scenario.mjs';
import { createDemoWorld } from '../program/data/demo_world.mjs';
import { runYear } from '../program/simulation/run_year.mjs';

describe('labour bottleneck', () => {
  test('percent labour metrics are internally consistent', () => {
    const world = createDemoWorld();
    const scenario = demoScenarioAdaptation();
    const result = runYear(world, scenario, scenario.startYear);

    expect(result.foodLabourDemandDays).toBeGreaterThanOrEqual(result.effectiveFoodLabourAvailableDays);
    expect(result.foodLabourDeficitDays).toBeCloseTo(result.foodLabourDemandDays - result.effectiveFoodLabourAvailableDays, 5);
    expect(result.foodLabourCoverageRatio).toBeCloseTo(result.effectiveFoodLabourAvailableDays / Math.max(1, result.foodLabourDemandDays), 5);
    expect(result.percentAvailableLabourDemandedByFood).toBeGreaterThanOrEqual(result.percentAvailableLabourSuppliedToFood);
    expect(result.percentTotalLabourDemandFromFood).toBeGreaterThan(0);
  });

  test('food labour deficit days is positive when demand exceeds effective labour', () => {
    const world = createDemoWorld();
    const scenario = demoScenarioAdaptation();

    for (const household of world.households) {
      household.people.workers = 1;
      household.state.health = 0.45;
    }

    const result = runYear(world, scenario, scenario.startYear);
    expect(result.foodLabourDeficitDays).toBeGreaterThan(0);
    expect(result.labourDeficitDays).toBeGreaterThan(0);
  });

  test('reduced diesel increases food labour demand unless planted area is zero', () => {
    const baselineWorld = createDemoWorld();
    const baselineScenario = demoScenarioAdaptation();
    const baseline = runYear(baselineWorld, baselineScenario, baselineScenario.startYear);

    const constrainedWorld = createDemoWorld();
    const constrainedScenario = demoScenarioAdaptation();
    constrainedScenario.dieselAvailabilityByYear[constrainedScenario.startYear] = 0.4;
    const constrained = runYear(constrainedWorld, constrainedScenario, constrainedScenario.startYear);

    expect(constrained.foodLabourDemandDays).toBeGreaterThanOrEqual(baseline.foodLabourDemandDays);
  });
});
