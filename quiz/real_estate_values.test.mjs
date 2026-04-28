import { describe, expect, test } from 'vitest';
import { demoScenarioAdaptation } from '../program/data/demo_scenario.mjs';
import { createDemoWorld } from '../program/data/demo_world.mjs';
import { runYear } from '../program/simulation/run_year.mjs';

describe('real estate values', () => {
  test('real estate values remain deterministic and positive', () => {
    const world = createDemoWorld();
    const scenario = demoScenarioAdaptation();

    const first = runYear(world, scenario, scenario.startYear);
    const second = runYear(world, scenario, scenario.startYear + 1);

    expect(first.averageEstimatedBuildingValue).toBeGreaterThan(0);
    expect(second.averageEstimatedBuildingValue).toBeGreaterThan(0);
    expect(Number.isFinite(second.averageEstimatedBuildingValue)).toBe(true);
  });

  test('high transport stress penalizes car-dependent suburban values', () => {
    const world = createDemoWorld();
    const scenario = demoScenarioAdaptation();
    scenario.dieselAvailabilityByYear[scenario.startYear] = 0.2;

    runYear(world, scenario, scenario.startYear);

    const suburban = world.buildings.find((building) => building.id === 'b-suburb-1');
    const downtown = world.buildings.find((building) => building.id === 'b-apt-1');

    const suburbanAdjustment = suburban?.metrics?.transportResilienceValueAdjustment ?? 0;
    const downtownAdjustment = downtown?.metrics?.transportResilienceValueAdjustment ?? 0;

    expect(suburbanAdjustment).toBeLessThan(downtownAdjustment);
  });

  test('walkable local-service buildings receive stronger transport resilience adjustment', () => {
    const stressedWorld = createDemoWorld();
    const stressedScenario = demoScenarioAdaptation();
    stressedScenario.dieselAvailabilityByYear[stressedScenario.startYear] = 0.2;
    runYear(stressedWorld, stressedScenario, stressedScenario.startYear);
    const village = stressedWorld.buildings.find((building) => building.id === 'b-village-mixed');
    const suburban = stressedWorld.buildings.find((building) => building.id === 'b-suburb-2');

    const villageAdjustment = village?.metrics?.transportResilienceValueAdjustment ?? -1;
    const suburbanAdjustment = suburban?.metrics?.transportResilienceValueAdjustment ?? 1;
    expect(villageAdjustment).toBeGreaterThan(suburbanAdjustment);
  });
});
