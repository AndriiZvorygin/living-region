import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import {
  createDemoWorld,
  demoScenarioAdaptationWithRailBasic,
  demoScenarioAdaptationWithRailCorridor,
  demoScenarioAdaptationWithElectrifiedRailCorridor,
  runScenario,
  runYear,
  exportGeoJSON
} from '../program/index.mjs';

function finalYear(factory) {
  const world = createDemoWorld();
  const scenario = factory();
  return runScenario(world, scenario).years.at(-1);
}

describe('rail corridor demand and catchments', () => {
  test('station catchment population increase raises rail eligible demand', () => {
    const worldA = createDemoWorld();
    const scenarioA = demoScenarioAdaptationWithRailBasic();
    const base = runYear(worldA, scenarioA, scenarioA.startYear);

    const worldB = createDemoWorld();
    for (const infra of worldB.infrastructures) {
      if (['railStation', 'railHalt'].includes(infra.type)) {
        infra.walkCatchmentPeople *= 2;
        infra.bicycleCatchmentPeople *= 2;
        infra.catchmentRadiusKm += 1.2;
      }
    }
    const scenarioB = demoScenarioAdaptationWithRailBasic();
    const expanded = runYear(worldB, scenarioB, scenarioB.startYear);

    expect(expanded.catchmentPopulation).toBeGreaterThan(base.catchmentPopulation);
    expect(expanded.railPassengerKm).toBeGreaterThan(base.railPassengerKm);
  });

  test('poor station access suppresses rail demand even with high fuel prices', () => {
    const worldA = createDemoWorld();
    const scenarioA = demoScenarioAdaptationWithRailBasic();
    scenarioA.dieselAvailabilityByYear[scenarioA.startYear] = 0.35;
    const withAccess = runYear(worldA, scenarioA, scenarioA.startYear);

    const worldB = createDemoWorld();
    for (const patch of worldB.patches) {
      patch.metrics.walkAccessIndex = 0.05;
      patch.metrics.bicycleAccessIndex = 0.05;
      patch.metrics.localServiceAccessIndex = 0.1;
    }
    for (const infra of worldB.infrastructures) {
      if (['railStation', 'railHalt', 'freightSiding'].includes(infra.type)) {
        infra.catchmentRadiusKm = 0.5;
        infra.serviceFrequencyPerDay = 1;
      }
    }
    const scenarioB = demoScenarioAdaptationWithRailBasic();
    scenarioB.dieselAvailabilityByYear[scenarioB.startYear] = 0.35;
    const poorAccess = runYear(worldB, scenarioB, scenarioB.startYear);

    expect(withAccess.catchmentPopulation).toBeGreaterThan(poorAccess.catchmentPopulation);
    expect(withAccess.householdsWithViableRailAlternative).toBeGreaterThan(poorAccess.householdsWithViableRailAlternative);
    expect(withAccess.fuelPriceInducedRailPassengerKm).toBeGreaterThan(poorAccess.fuelPriceInducedRailPassengerKm);
  });

  test('corridor transition increases station area population jobs and freight potential', () => {
    const basic = finalYear(demoScenarioAdaptationWithRailBasic);
    const corridor = finalYear(demoScenarioAdaptationWithRailCorridor);

    expect(corridor.stationAreaPopulationAdded).toBeGreaterThan(basic.stationAreaPopulationAdded);
    expect(corridor.stationAreaJobsAdded).toBeGreaterThan(basic.stationAreaJobsAdded);
    expect(corridor.stationAreaFreightPotentialAdded).toBeGreaterThan(basic.stationAreaFreightPotentialAdded);
  });

  test('freight anchors increase rail freight tonne-km capture', () => {
    const worldA = createDemoWorld();
    const scenarioA = demoScenarioAdaptationWithRailBasic();
    const lowAnchor = runYear(worldA, scenarioA, scenarioA.startYear);

    const worldB = createDemoWorld();
    for (const infra of worldB.infrastructures) {
      if (['marketDepot', 'woodDepot', 'freightSiding'].includes(infra.type)) {
        infra.freightAnchorStrength = 0.95;
      }
    }
    const scenarioB = demoScenarioAdaptationWithRailCorridor();
    const highAnchor = runYear(worldB, scenarioB, scenarioB.startYear);

    expect(highAnchor.railEligibleFoodFreightTonneKm + highAnchor.railEligibleWoodFreightTonneKm).toBeGreaterThan(
      lowAnchor.railEligibleFoodFreightTonneKm + lowAnchor.railEligibleWoodFreightTonneKm
    );
    expect(highAnchor.railFreightTonneKm).toBeGreaterThanOrEqual(lowAnchor.railFreightTonneKm);
  });

  test('rail per-passenger cost falls as utilization rises', () => {
    const worldLow = createDemoWorld();
    const scenarioLow = demoScenarioAdaptationWithRailBasic();
    scenarioLow.rail.annualRailServiceBuildoutRateByYear[scenarioLow.startYear] = 0.002;
    const low = runYear(worldLow, scenarioLow, scenarioLow.startYear);

    const worldHigh = createDemoWorld();
    const scenarioHigh = demoScenarioAdaptationWithRailCorridor();
    scenarioHigh.rail.annualRailServiceBuildoutRateByYear[scenarioHigh.startYear] = 0.08;
    scenarioHigh.adaptation.annualStationCatchmentBuildoutRateByYear[scenarioHigh.startYear] = 0.05;
    const high = runYear(worldHigh, scenarioHigh, scenarioHigh.startYear);

    expect(high.railUtilizationRatio).toBeGreaterThanOrEqual(low.railUtilizationRatio);
    expect(high.railPassengerCostPerKmAtUtilization).toBeLessThanOrEqual(low.railPassengerCostPerKmAtUtilization);
  });

  test('corridor buildout has higher utilization than basic rail by final year', () => {
    const basic = finalYear(demoScenarioAdaptationWithRailBasic);
    const corridor = finalYear(demoScenarioAdaptationWithRailCorridor);
    expect(corridor.railUtilizationRatio).toBeGreaterThan(basic.railUtilizationRatio);
  });

  test('households outside catchment remain car dependent without alternatives', () => {
    const world = createDemoWorld();
    for (const infra of world.infrastructures) {
      if (['railStation', 'railHalt', 'freightSiding'].includes(infra.type)) {
        infra.catchmentRadiusKm = 0.2;
      }
    }
    const scenario = demoScenarioAdaptationWithRailBasic();
    const metrics = runYear(world, scenario, scenario.startYear);

    expect(metrics.householdsCarDependentNoAlternative).toBeGreaterThan(metrics.householdsWithViableRailAlternative);
  });

  test('fuel price induces rail demand only with viable alternatives', () => {
    const worldA = createDemoWorld();
    const scenarioA = demoScenarioAdaptationWithRailCorridor();
    worldA.markets[0].prices.dieselLitre = 2.9;
    const withAlternative = runYear(worldA, scenarioA, scenarioA.startYear);

    const worldB = createDemoWorld();
    worldB.infrastructures = worldB.infrastructures.filter((infra) => !['railStation', 'railHalt', 'freightSiding'].includes(infra.type));
    const scenarioB = demoScenarioAdaptationWithRailCorridor();
    worldB.markets[0].prices.dieselLitre = 2.9;
    const withoutAlternative = runYear(worldB, scenarioB, scenarioB.startYear);

    expect(withAlternative.fuelPriceInducedRailPassengerKm).toBeGreaterThan(withoutAlternative.fuelPriceInducedRailPassengerKm);
  });

  test('station GeoJSON export writes FeatureCollection', () => {
    const world = createDemoWorld();
    runScenario(world, demoScenarioAdaptationWithRailCorridor());
    const output = exportGeoJSON(world);

    expect(output.stations.type).toBe('FeatureCollection');
    expect(output.stations.features.length).toBeGreaterThan(0);
    expect(output.stations.features[0].properties).toHaveProperty('catchmentPopulation');
  });

  test('demo:compare-rail includes corridor scenarios and exits successfully', () => {
    const result = spawnSync('node', ['command/run_demo_compare_rail.mjs'], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Adaptation With Rail Basic');
    expect(result.stdout).toContain('Adaptation With Rail Corridor');
    expect(result.stdout).toContain('Adaptation With Rail Freight Corridor');
    expect(result.stdout).toContain('Adaptation With Electrified Rail Corridor');
    expect(result.stdout).toContain('Adaptation With Electrified Rail Freight Corridor');
  });

  test('electrified corridor shifts demand from diesel to electricity', () => {
    const dieselCorridor = finalYear(demoScenarioAdaptationWithRailCorridor);
    const electrifiedCorridor = finalYear(demoScenarioAdaptationWithElectrifiedRailCorridor);

    expect(electrifiedCorridor.railElectricityDemandKwh).toBeGreaterThanOrEqual(dieselCorridor.railElectricityDemandKwh);
    expect(electrifiedCorridor.railDieselDemandLitre).toBeLessThanOrEqual(dieselCorridor.railDieselDemandLitre);
  });
});
