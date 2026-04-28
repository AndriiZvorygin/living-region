import { describe, expect, test } from 'vitest';
import { demoScenarioAdaptation } from '../program/data/demo_scenario.mjs';
import { createDemoWorld } from '../program/data/demo_world.mjs';
import { runYear } from '../program/simulation/run_year.mjs';

describe('housing market', () => {
  test('high rent pressure increases household housing stress', () => {
    const world = createDemoWorld();
    const scenario = demoScenarioAdaptation();

    for (const building of world.buildings) {
      if (building.dwellingUnits > 0) {
        building.dwellingUnits = Math.max(1, Math.floor(building.dwellingUnits * 0.35));
      }
    }

    runYear(world, scenario, scenario.startYear);

    const averageHousingStress = world.households.reduce((sum, household) => sum + household.state.housingStress, 0) / world.households.length;
    expect(averageHousingStress).toBeGreaterThan(0.35);
  });
});
