import { describe, expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createDemoWorld } from '../program/data/demo_world.mjs';
import { demoScenarioAdaptation } from '../program/data/demo_scenario.mjs';
import { runYear } from '../program/simulation/run_year.mjs';
import { generateGreyCountyWorld } from '../program/data/generate_grey_county_world.mjs';
import { updateHousingMarket } from '../program/simulation/housing_market.mjs';
import { evaluateUnitSanity } from '../program/simulation/unit_sanity.mjs';
import { defaultConstants } from '../program/data/default_constants.mjs';

function runGreyScenarioFull(rail = false) {
  const world = generateGreyCountyWorld({
    scale: 'full-county',
    includeRail: rail,
    includeWaterFreight: rail,
    includeSyntheticPolygons: true
  });
  const scenario = demoScenarioAdaptation();
  for (let i = 0; i < scenario.years; i += 1) {
    runYear(world, scenario, scenario.startYear + i);
  }
  return world.metricsByYear.at(-1);
}

describe('housing/rent unit correction', () => {
  test('Grey full seed generated average initial rent is between 900 and 1800', () => {
    const world = generateGreyCountyWorld({ scale: 'full-county' });
    const dwellings = world.buildings.filter((building) => building.dwellingUnits > 0);
    const avg = dwellings.reduce((sum, building) => sum + (building.baseRentPerMonth ?? building.rentPerMonth), 0) / Math.max(1, dwellings.length);
    expect(avg).toBeGreaterThanOrEqual(900);
    expect(avg).toBeLessThanOrEqual(1800);
  });

  test('demo grey full final average rent stays below 4000', () => {
    const finalYear = runGreyScenarioFull(false);
    expect(finalYear.averageRent).toBeLessThan(4000);
  });

  test('average rent does not directly use estimated value', () => {
    const worldA = createDemoWorld();
    const worldB = createDemoWorld();

    for (const building of worldB.buildings) {
      building.estimatedValue *= 1000;
    }

    const context = { constants: defaultConstants };
    const resultA = updateHousingMarket(worldA, context);
    const resultB = updateHousingMarket(worldB, context);

    expect(Math.abs(resultA.averageRent - resultB.averageRent)).toBeLessThan(1);
  });

  test('rent growth is capped year over year', () => {
    const world = createDemoWorld();
    const scenario = demoScenarioAdaptation();

    for (const building of world.buildings) {
      if (building.dwellingUnits > 0) {
        building.dwellingUnits = Math.max(1, Math.floor(building.dwellingUnits * 0.25));
      }
    }

    for (let i = 0; i < 4; i += 1) {
      runYear(world, scenario, scenario.startYear + i);
    }

    for (let i = 1; i < world.metricsByYear.length; i += 1) {
      const prev = world.metricsByYear[i - 1].averageRent;
      const curr = world.metricsByYear[i].averageRent;
      const growth = (curr - prev) / Math.max(1, prev);
      expect(growth).toBeLessThanOrEqual(defaultConstants.housing.maxAnnualRentGrowthRate + 0.0001);
    }
  });

  test('high rent pressure increases housing stress without absurd rent', () => {
    const world = createDemoWorld();
    const scenario = demoScenarioAdaptation();

    for (const building of world.buildings) {
      if (building.dwellingUnits > 0) {
        building.dwellingUnits = Math.max(1, Math.floor(building.dwellingUnits * 0.2));
      }
    }

    const result = runYear(world, scenario, scenario.startYear);
    expect(result.averageHousingStress).toBeGreaterThan(0.35);
    expect(result.averageRent).toBeLessThan(defaultConstants.housing.criticalRentPerMonth + 1);
  });

  test('households greater than dwelling units triggers warning', () => {
    const sanity = evaluateUnitSanity({
      households: 120,
      dwellingUnits: 100,
      averageRent: 1200,
      priceToAnnualRentRatio: 20,
      housingVacancyRate: 0.01,
      previousAverageRent: 1000,
      averageRentGrowthRate: 0.05
    }, defaultConstants);
    expect(sanity.warnings.some((warning) => warning.code === 'housing.units.shortfall')).toBe(true);
  });

  test('vacancy rate near zero triggers warning', () => {
    const sanity = evaluateUnitSanity({
      households: 100,
      dwellingUnits: 100,
      averageRent: 1200,
      priceToAnnualRentRatio: 20,
      housingVacancyRate: 0.005,
      previousAverageRent: 1000,
      averageRentGrowthRate: 0.05
    }, defaultConstants);
    expect(sanity.warnings.some((warning) => warning.code === 'housing.vacancy.low')).toBe(true);
  });

  test('critical rent warning triggers above critical threshold', () => {
    const sanity = evaluateUnitSanity({
      households: 100,
      dwellingUnits: 120,
      averageRent: 9000,
      priceToAnnualRentRatio: 20,
      housingVacancyRate: 0.08,
      previousAverageRent: 1000,
      averageRentGrowthRate: 0.05
    }, defaultConstants);
    expect(sanity.warnings.some((warning) => warning.code === 'housing.rent.critical_high')).toBe(true);
  });

  test('price to annual rent ratio warning triggers for extreme high values', () => {
    const sanity = evaluateUnitSanity({
      households: 100,
      dwellingUnits: 120,
      averageRent: 1200,
      priceToAnnualRentRatio: 75,
      housingVacancyRate: 0.08,
      previousAverageRent: 1000,
      averageRentGrowthRate: 0.05
    }, defaultConstants);
    expect(sanity.warnings.some((warning) => warning.code === 'housing.price_to_annual_rent.out_of_range')).toBe(true);
  });

  test('price to annual rent ratio warning triggers for extreme low values', () => {
    const sanity = evaluateUnitSanity({
      households: 100,
      dwellingUnits: 120,
      averageRent: 1200,
      priceToAnnualRentRatio: 5,
      housingVacancyRate: 0.08,
      previousAverageRent: 1000,
      averageRentGrowthRate: 0.05
    }, defaultConstants);
    expect(sanity.warnings.some((warning) => warning.code === 'housing.price_to_annual_rent.out_of_range')).toBe(true);
  });

  test('250000 value and 1250 monthly rent gives annual ratio around 16.67 with no warning', () => {
    const averageEstimatedBuildingValue = 250_000;
    const averageRent = 1_250;
    const priceToAnnualRentRatio = averageEstimatedBuildingValue / (averageRent * 12);
    expect(priceToAnnualRentRatio).toBeCloseTo(16.67, 2);

    const sanity = evaluateUnitSanity({
      households: 100,
      dwellingUnits: 120,
      averageRent,
      priceToAnnualRentRatio,
      valueToMonthlyRentRatio: averageEstimatedBuildingValue / averageRent,
      housingVacancyRate: 0.08,
      previousAverageRent: 1000,
      averageRentGrowthRate: 0.05
    }, defaultConstants);
    expect(sanity.warnings.some((warning) => warning.code === 'housing.price_to_annual_rent.out_of_range')).toBe(false);
  });

  test('monthly value to rent ratio around 200 does not trigger housing ratio warning', () => {
    const sanity = evaluateUnitSanity({
      households: 100,
      dwellingUnits: 120,
      averageRent: 1250,
      valueToMonthlyRentRatio: 200,
      priceToAnnualRentRatio: 16.67,
      housingVacancyRate: 0.08,
      previousAverageRent: 1000,
      averageRentGrowthRate: 0.05
    }, defaultConstants);
    expect(sanity.warnings.some((warning) => warning.code === 'housing.price_to_annual_rent.out_of_range')).toBe(false);
  });

  test('Grey inspect run has no housing price to annual rent warning under defaults', () => {
    const result = spawnSync('node', ['command/run_grey_county_seed_inspect.mjs'], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain('housing.price_to_annual_rent.out_of_range');
  });

  test('existing Grey rail full command still runs', () => {
    const result = spawnSync('node', ['command/run_grey_county_seed.mjs', '--rail=true', '--scale=full-county'], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('scenario: adaptation-with-rail-freight-corridor');
  });
});
