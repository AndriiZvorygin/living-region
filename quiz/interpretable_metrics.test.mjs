import { describe, expect, test } from 'vitest';
import { demoScenarioAdaptation } from '../program/data/demo_scenario.mjs';
import { createDemoWorld } from '../program/data/demo_world.mjs';
import { runYear } from '../program/simulation/run_year.mjs';

describe('interpretable metrics', () => {
  test('stress components combine consistently into averageTotalStress', () => {
    const world = createDemoWorld();
    const scenario = demoScenarioAdaptation();
    const metrics = runYear(world, scenario, scenario.startYear);

    const recomposed = (
      metrics.averageFoodStress
      + metrics.averageFuelStress
      + metrics.averageHousingStress
      + metrics.averageTransportStress
    ) / 4;

    expect(metrics.averageTotalStress).toBeCloseTo(recomposed, 5);
    expect(metrics.averageHouseholdStress).toBeCloseTo(metrics.averageTotalStress, 5);
  });

  test('migration accounting closes population balance', () => {
    const world = createDemoWorld();
    const scenario = demoScenarioAdaptation();
    const metrics = runYear(world, scenario, scenario.startYear);

    const expectedEnding = metrics.startingPopulation
      + metrics.births
      - metrics.deaths
      + metrics.inMigration
      - metrics.outMigration;

    expect(metrics.endingPopulation).toBe(expectedEnding);
    expect(metrics.populationTotal).toBe(metrics.endingPopulation);
  });

  test('out-migration reason buckets are bounded by out-migration', () => {
    const world = createDemoWorld();
    const scenario = demoScenarioAdaptation();

    for (let i = 0; i < 8; i += 1) {
      const year = scenario.startYear + i;
      scenario.dieselAvailabilityByYear[year] = 0.35;
      scenario.fertilizerAvailabilityByYear[year] = 0.45;
      scenario.roadMaintenanceBudgetByYear[year] = 0.4;
    }

    const metrics = runYear(world, scenario, scenario.startYear + 7);
    const reasonTotal = metrics.outMigrationFoodStress
      + metrics.outMigrationFuelStress
      + metrics.outMigrationHousingStress
      + metrics.outMigrationTransportStress;

    expect(reasonTotal).toBeLessThanOrEqual(metrics.outMigration);
  });
});
