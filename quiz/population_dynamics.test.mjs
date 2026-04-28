import { describe, expect, test } from 'vitest';
import { demoScenarioAdaptation } from '../program/data/demo_scenario.mjs';
import { createDemoWorld } from '../program/data/demo_world.mjs';
import { runYear } from '../program/simulation/run_year.mjs';

describe('population dynamics', () => {
  test('high urban stress with rural opportunity can produce urban-to-rural moves', () => {
    const world = createDemoWorld();
    const scenario = demoScenarioAdaptation();

    for (const household of world.households) {
      if (household.settlementId === 'town') {
        household.preferences.landAccessDesire = 0.95;
        household.preferences.ruralPreference = 0.9;
        household.preferences.urbanPreference = 0.2;
      }
    }

    const result = runYear(world, scenario, scenario.startYear);
    expect(result.urbanToRuralMoves).toBeGreaterThan(0);
    expect(result.populationRural).toBeGreaterThan(0);
  });

  test('sustained severe stress reduces net migration or increases out-migration', () => {
    const world = createDemoWorld();
    const scenario = demoScenarioAdaptation();

    for (let y = 0; y < 5; y += 1) {
      const year = scenario.startYear + y;
      scenario.dieselAvailabilityByYear[year] = 0.35;
      scenario.fertilizerAvailabilityByYear[year] = 0.45;
      scenario.roadMaintenanceBudgetByYear[year] = 0.45;
      const metrics = runYear(world, scenario, year);
      if (y === 4) {
        expect(metrics.outMigration >= metrics.inMigration || metrics.netMigration <= 0).toBe(true);
      }
    }
  });
});
