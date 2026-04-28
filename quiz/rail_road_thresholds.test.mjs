import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import {
  createDemoWorld,
  demoScenarioNoAdaptation,
  demoScenarioAdaptation,
  demoScenarioAdaptationWithRail,
  demoScenarioAdaptationWithElectrifiedRail,
  runScenario,
  runYear,
  exportGeoJSON
} from '../program/index.mjs';

describe('rail road threshold realism', () => {
  test('road maintenance backlog grows when budget below demand', () => {
    const world = createDemoWorld();
    const scenario = demoScenarioNoAdaptation();
    scenario.roadMaintenanceBudgetByYear[scenario.startYear] = 0.4;

    const yearOne = runYear(world, scenario, scenario.startYear);
    const yearTwo = runYear(world, scenario, scenario.startYear + 1);

    expect(yearOne.roadMaintenanceBacklogMoney).toBeGreaterThan(0);
    expect(yearTwo.roadMaintenanceBacklogMoney).toBeGreaterThan(yearOne.roadMaintenanceBacklogMoney);
  });

  test('rail allocation requires enabled rail and adequate condition', () => {
    const worldA = createDemoWorld();
    const disabled = runYear(worldA, demoScenarioAdaptation(), 2026);
    expect(disabled.railPassengerKm).toBe(0);

    const worldB = createDemoWorld();
    const scenarioB = demoScenarioAdaptationWithRail();
    for (const network of worldB.networks) {
      for (const segment of network.segments ?? []) {
        if (segment.type === 'traditionalRail' || segment.type === 'electrifiedRail') {
          segment.condition = 0.2;
        }
      }
    }
    const lowCondition = runYear(worldB, scenarioB, scenarioB.startYear);
    expect(lowCondition.railPassengerKm).toBe(0);
  });

  test('rail freight shift reduces heavy truck tonne-km pressure', () => {
    const noRail = runScenario(createDemoWorld(), demoScenarioAdaptation()).years.at(-1);
    const withRail = runScenario(createDemoWorld(), demoScenarioAdaptationWithRail()).years.at(-1);

    expect(withRail.heavyTruckTonneKm).toBeLessThan(noRail.heavyTruckTonneKm);
    expect(withRail.avoidedRoadMaintenanceFromRailShift).toBeGreaterThanOrEqual(0);
  });

  test('electrified rail shifts rail energy demand from diesel to electricity', () => {
    const dieselRail = runScenario(createDemoWorld(), demoScenarioAdaptationWithRail()).years.at(-1);
    const electricRail = runScenario(createDemoWorld(), demoScenarioAdaptationWithElectrifiedRail()).years.at(-1);

    expect(electricRail.railElectricityDemandKwh).toBeGreaterThanOrEqual(dieselRail.railElectricityDemandKwh);
    expect(electricRail.railDieselDemandLitre).toBeLessThanOrEqual(dieselRail.railDieselDemandLitre);
  });

  test('rail utilization threshold influences cost favourability metrics', () => {
    const worldLow = createDemoWorld();
    const scenarioLow = demoScenarioAdaptationWithRail();
    scenarioLow.rail.annualRailServiceBuildoutRateByYear[scenarioLow.startYear] = 0.001;
    const low = runYear(worldLow, scenarioLow, scenarioLow.startYear);

    const worldHigh = createDemoWorld();
    const scenarioHigh = demoScenarioAdaptationWithRail();
    scenarioHigh.rail.annualRailServiceBuildoutRateByYear[scenarioHigh.startYear] = 0.05;
    const high = runYear(worldHigh, scenarioHigh, scenarioHigh.startYear);

    expect(high.railUtilizationRatio).toBeGreaterThanOrEqual(low.railUtilizationRatio);
  });

  test('gasoline break-even price is deterministic and finite', () => {
    const first = runYear(createDemoWorld(), demoScenarioAdaptationWithRail(), 2026);
    const second = runYear(createDemoWorld(), demoScenarioAdaptationWithRail(), 2026);

    expect(first.gasolineBreakEvenPriceForTransitPerLitre).toBeCloseTo(second.gasolineBreakEvenPriceForTransitPerLitre, 8);
    expect(Number.isFinite(first.gasolineBreakEvenPriceForTransitPerLitre)).toBe(true);
  });

  test('network GeoJSON export includes road and rail properties', () => {
    const world = createDemoWorld();
    runScenario(world, demoScenarioAdaptationWithRail());
    const exported = exportGeoJSON(world);

    expect(exported.networks.type).toBe('FeatureCollection');
    expect(exported.networks.features.length).toBeGreaterThan(0);
    const sample = exported.networks.features[0].properties;
    expect(sample).toHaveProperty('type');
    expect(sample).toHaveProperty('maintenanceDemandMoney');
    expect(sample).toHaveProperty('railElectrified');
  });

  test('demo:compare-rail exits successfully', () => {
    const result = spawnSync('node', ['command/run_demo_compare_rail.mjs'], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('No Adaptation');
    expect(result.stdout).toContain('Adaptation With Rail Basic');
    expect(result.stdout).toContain('Adaptation With Rail Corridor');
    expect(result.stdout).toContain('Adaptation With Rail Freight Corridor');
    expect(result.stdout).toContain('Adaptation With Electrified Rail Corridor');
    expect(result.stdout).toContain('Adaptation With Electrified Rail Freight Corridor');
  });
});
