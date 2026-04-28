import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { generateGreyCountyWorld } from '../program/data/generate_grey_county_world.mjs';
import { demoScenarioAdaptation } from '../program/data/demo_scenario.mjs';
import { runScenario } from '../program/simulation/run_scenario.mjs';
import { calculateProductionCostThresholds } from '../program/simulation/production_cost_thresholds.mjs';

function finalYear() {
  const world = generateGreyCountyWorld({ scale: 'small', includeRail: false, includeSyntheticPolygons: true });
  const scenario = demoScenarioAdaptation();
  return runScenario(world, scenario).years.at(-1);
}

function runFinalYearWithScenarioMutator(mutator) {
  const world = generateGreyCountyWorld({ scale: 'small', includeRail: false, includeSyntheticPolygons: true });
  const scenario = demoScenarioAdaptation();
  if (mutator) {
    mutator(world, scenario);
  }
  return runScenario(world, scenario).years.at(-1);
}

describe('rural transition metrics', () => {
  test('grey seed has nonzero urban population with Owen Sound/Hanover contexts', () => {
    const m = finalYear();
    expect(m.urbanPopulation).toBeGreaterThan(0);
  });

  test('population form and land-access categories reconcile to total population', () => {
    const m = finalYear();
    expect(m.populationTotal).toBe(m.urbanPopulation + m.townPopulation + m.villagePopulation + m.ruralPopulation);
    expect(m.populationTotal).toBe(m.farmAccessPopulation + m.gardenAccessPopulation + m.noLandAccessPopulation);
  });

  test('food labour deficit/coverage uses effective labour over demand', () => {
    const m = finalYear();
    expect(m.effectiveFoodLabourAvailableDays).toBeGreaterThan(0);
    expect(m.foodLabourCoverageRatio).toBeCloseTo(
      m.effectiveFoodLabourAvailableDays / Math.max(1, m.foodLabourDemandDays),
      3
    );
    const expectedDeficit = Math.max(0, m.foodLabourDemandDays - m.effectiveFoodLabourAvailableDays);
    expect(m.foodLabourDeficitDays).toBeCloseTo(expectedDeficit, 3);
  });

  test('production thresholds include market-wage, household-subsistence, and cooperative variants', () => {
    const base = calculateProductionCostThresholds({}, {
      dieselPricePerLitre: 1.4,
      fertilizerCostIndex: 1,
      machineryCostIndex: 1,
      wageOrLabourOpportunityCostPerDay: 130,
      foodPricePerGJ: 220
    });
    const shock = calculateProductionCostThresholds({}, {
      dieselPricePerLitre: 3.4,
      fertilizerCostIndex: 1.7,
      machineryCostIndex: 1.4,
      wageOrLabourOpportunityCostPerDay: 130,
      foodPricePerGJ: 220
    });

    for (const value of Object.values(base.productionCostPerGJByMode)) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
    expect(base.dieselPriceThresholdForMarketGardenAtMarketWage).toBeGreaterThan(0);
    expect(base.dieselPriceThresholdForHouseholdGardenAtSubsistenceLabour).toBeGreaterThan(0);
    expect(base.dieselPriceThresholdForCooperativeSmallFarm).toBeGreaterThan(0);
    expect(base.dieselPriceThresholdForHouseholdGardenAtSubsistenceLabour).toBeLessThan(base.dieselPriceThresholdForMarketGardenAtMarketWage);
    expect(base.dieselPriceThresholdForCooperativeSmallFarm).toBeLessThan(base.dieselPriceThresholdForMarketGardenAtMarketWage);
    expect(shock.dieselPriceThresholdForHouseholdGardenAtSubsistenceLabour).toBeGreaterThan(0);
  });

  test('food affordability stress rises with food price', () => {
    const world = generateGreyCountyWorld({ scale: 'small', includeRail: false, includeSyntheticPolygons: true });
    const scenario = demoScenarioAdaptation();
    scenario.constants = { market: { baselineFoodPricePerGJ: 600 } };
    const pricey = runScenario(world, scenario).years.at(-1);

    const world2 = generateGreyCountyWorld({ scale: 'small', includeRail: false, includeSyntheticPolygons: true });
    const scenario2 = demoScenarioAdaptation();
    scenario2.constants = { market: { baselineFoodPricePerGJ: 120 } };
    const cheap = runScenario(world2, scenario2).years.at(-1);

    expect(pricey.foodAffordabilityStress).toBeGreaterThan(cheap.foodAffordabilityStress);
  });

  test('combined rural transition pressure rises with food price', () => {
    const high = runFinalYearWithScenarioMutator((_, scenario) => {
      scenario.constants = { market: { baselineFoodPricePerGJ: 700 } };
    });
    const low = runFinalYearWithScenarioMutator((_, scenario) => {
      scenario.constants = { market: { baselineFoodPricePerGJ: 140 } };
    });
    expect(high.ruralTransitionPressureIndex).toBeGreaterThan(low.ruralTransitionPressureIndex);
  });

  test('combined rural transition pressure rises with fertilizer and machinery stress', () => {
    const stressed = runFinalYearWithScenarioMutator((_, scenario) => {
      scenario.fertilizerAvailabilityByYear = { [scenario.startYear]: 0.45 };
      scenario.dieselAvailabilityByYear = { [scenario.startYear]: 0.45 };
    });
    const baseline = finalYear();
    expect(stressed.inputCostStress + stressed.machineryCostStress).toBeGreaterThan(baseline.inputCostStress + baseline.machineryCostStress);
    expect(stressed.ruralTransitionPressureIndex).toBeGreaterThanOrEqual(baseline.ruralTransitionPressureIndex);
  });

  test('land access converts pressure into stronger production response', () => {
    const lowAccess = runFinalYearWithScenarioMutator((world, scenario) => {
      scenario.constants = { market: { baselineFoodPricePerGJ: 700 } };
      for (const household of world.households) {
        household.landAccessType = 'none';
        household.productiveLandAccessHa = 0;
      }
    });
    const withAccess = runFinalYearWithScenarioMutator((world, scenario) => {
      scenario.constants = { market: { baselineFoodPricePerGJ: 700 } };
      for (let i = 0; i < world.households.length; i += 1) {
        if (i % 2 === 0) {
          world.households[i].landAccessType = 'garden';
          world.households[i].productiveLandAccessHa = 0.08;
        }
      }
    });
    expect(withAccess.householdsIncreasingFoodProduction).toBeGreaterThanOrEqual(lowAccess.householdsIncreasingFoodProduction);
    expect(withAccess.potentialAddedFoodEnergyGJIfLandAccessMet).toBeLessThanOrEqual(lowAccess.potentialAddedFoodEnergyGJIfLandAccessMet);
  });

  test('no-land-access households show blocked demand and co-op access lowers blocked demand', () => {
    const blocked = runFinalYearWithScenarioMutator((world, scenario) => {
      scenario.constants = { market: { baselineFoodPricePerGJ: 700 } };
      for (const household of world.households) {
        household.landAccessType = 'none';
        household.productiveLandAccessHa = 0;
      }
    });
    const coop = runFinalYearWithScenarioMutator((world, scenario) => {
      scenario.constants = { market: { baselineFoodPricePerGJ: 700 } };
      for (let i = 0; i < world.households.length; i += 1) {
        world.households[i].landAccessType = i % 3 === 0 ? 'cooperative' : 'none';
        world.households[i].productiveLandAccessHa = i % 3 === 0 ? 0.12 : 0;
      }
    });
    expect(blocked.householdsBlockedByNoLandAccess).toBeGreaterThan(0);
    expect(coop.householdsBlockedByNoLandAccess).toBeLessThan(blocked.householdsBlockedByNoLandAccess);
  });

  test('compare-food command exits and reports diagnostic differences', () => {
    const result = spawnSync('node', ['command/run_grey_compare_food.mjs'], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Diagnostics:');
    expect(result.stdout).toContain('foodLabourDeficitDifference');
    expect(result.stdout).toContain('netFoodAvailableGJPerPerson');
    expect(result.stdout).toContain('Normalized To No-Rail Population:');
  });

  test('rural transition csv writes expected columns', () => {
    const result = spawnSync('node', ['command/run_grey_county_seed.mjs', '--scale=full-county'], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    const csvPath = path.resolve('know/produce/grey-county-rural-transition-summary.csv');
    const text = fs.readFileSync(csvPath, 'utf8');
    expect(text).toContain('municipalityId,municipalityName,population,urbanPopulation,townPopulation,villagePopulation,ruralPopulation');
    expect(text).toContain('rawFoodLabourAvailableDays,effectiveFoodLabourAvailableDays,foodLabourDemandDays,foodLabourDeficitDays');
    expect(text).toContain('dieselPriceThresholdForHouseholdGardenAtSubsistenceLabour');
  });
});
