import { describe, expect, test } from 'vitest';
import { defaultConstants, mergeScenarioConstants } from '../program/data/default_constants.mjs';

describe('constants merge', () => {
  test('scenario constants override selected defaults while preserving others', () => {
    const merged = mergeScenarioConstants(defaultConstants, {
      stress: {
        targetRentBurden: 0.4
      },
      population: {
        birthRateBase: 0.01
      }
    });

    expect(merged.stress.targetRentBurden).toBe(0.4);
    expect(merged.population.birthRateBase).toBe(0.01);
    expect(merged.stress.targetFoodBurden).toBe(defaultConstants.stress.targetFoodBurden);
    expect(merged.labour.workDaysPerWorker).toBe(defaultConstants.labour.workDaysPerWorker);
  });
});
