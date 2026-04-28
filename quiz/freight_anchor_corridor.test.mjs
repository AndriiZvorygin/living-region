import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import {
  createDemoWorld,
  demoScenarioAdaptationWithRailCorridor,
  demoScenarioAdaptationWithRailFreightCorridor,
  demoScenarioAdaptationWithElectrifiedRailFreightCorridor,
  runScenario,
  runYear,
  exportGeoJSON
} from '../program/index.mjs';

function finalYear(factory) {
  const world = createDemoWorld();
  const scenario = factory();
  return runScenario(world, scenario).years.at(-1);
}

describe('freight anchors and multi-use rail corridor economics', () => {
  test('freight demand is generated from population and material flows', () => {
    const world = createDemoWorld();
    const scenario = demoScenarioAdaptationWithRailFreightCorridor();
    const year = runYear(world, scenario, scenario.startYear);

    expect(year.totalFreightTonnes).toBeGreaterThan(0);
    expect(year.totalFreightTonneKmDemand).toBeGreaterThan(0);
    expect(year.essentialFreightTonneKm).toBeGreaterThan(0);
  });

  test('local production and repair/reuse reduce freight demand in adaptation years', () => {
    const world = createDemoWorld();
    const scenario = demoScenarioAdaptationWithRailFreightCorridor();
    const year = runYear(world, scenario, scenario.startYear + 5);

    expect(year.freightDemandReducedByLocalProduction).toBeGreaterThan(0);
    expect(year.freightDemandReducedByRepairReuse).toBeGreaterThan(0);
  });

  test('freight corridor captures more rail freight than passenger-only corridor', () => {
    const base = finalYear(demoScenarioAdaptationWithRailCorridor);
    const freight = finalYear(demoScenarioAdaptationWithRailFreightCorridor);

    expect(freight.railFreightCapturedTonneKm).toBeGreaterThanOrEqual(base.railFreightCapturedTonneKm);
    expect(freight.railUtilizationRatio).toBeGreaterThanOrEqual(base.railUtilizationRatio);
  });

  test('high perishability has better rail capture with depot buildout', () => {
    const worldA = createDemoWorld();
    const scenarioA = demoScenarioAdaptationWithRailCorridor();
    const lowDepot = runYear(worldA, scenarioA, scenarioA.startYear);

    const worldB = createDemoWorld();
    for (const infra of worldB.infrastructures) {
      if (['coldStorageDepot', 'rootCellarDepot', 'marketDepot'].includes(infra.type)) {
        infra.anchorStrength = 0.95;
        infra.freightAnchorStrength = 0.95;
        infra.railCapturePotential = 0.9;
      }
    }
    const scenarioB = demoScenarioAdaptationWithRailFreightCorridor();
    const highDepot = runYear(worldB, scenarioB, scenarioB.startYear);

    expect(highDepot.railEligibleMarketFreightTonneKm).toBeGreaterThanOrEqual(lowDepot.railEligibleMarketFreightTonneKm);
  });

  test('rail freight shift reduces heavy truck pressure and road wear proxy', () => {
    const base = finalYear(demoScenarioAdaptationWithRailCorridor);
    const freight = finalYear(demoScenarioAdaptationWithRailFreightCorridor);

    expect(freight.heavyTruckTonneKmAvoidedByRail).toBeGreaterThanOrEqual(base.heavyTruckTonneKmAvoidedByRail);
    expect(freight.roadMaintenanceBacklogMoney).toBeLessThanOrEqual(base.roadMaintenanceBacklogMoney + 50000);
  });

  test('electrified freight rail shifts diesel demand toward electricity', () => {
    const diesel = finalYear(demoScenarioAdaptationWithRailFreightCorridor);
    const electric = finalYear(demoScenarioAdaptationWithElectrifiedRailFreightCorridor);

    expect(electric.freightElectricityDemandKwh).toBeGreaterThanOrEqual(diesel.freightElectricityDemandKwh);
    expect(electric.railDieselDemandLitre).toBeLessThanOrEqual(diesel.railDieselDemandLitre);
  });

  test('benefit-cost accounting separates direct recovery and avoided-cost recovery', () => {
    const year = finalYear(demoScenarioAdaptationWithRailFreightCorridor);
    expect(year.railCostRecoveryRatioWithAvoidedCosts).toBeGreaterThanOrEqual(year.railCostRecoveryRatioDirect);
    expect(year.railTotalBenefitEquivalent).toBeGreaterThanOrEqual(year.railPassengerRevenueEquivalent + year.railFreightRevenueEquivalent);
  });

  test('network and freight anchor geojson exports include freight fields', () => {
    const world = createDemoWorld();
    runScenario(world, demoScenarioAdaptationWithRailFreightCorridor());
    const exported = exportGeoJSON(world);

    expect(exported.networks.type).toBe('FeatureCollection');
    expect(exported.networks.features[0].properties).toHaveProperty('railBenefitCostRatio');
    expect(exported.freightAnchors.type).toBe('FeatureCollection');
    expect(exported.freightAnchors.features.length).toBeGreaterThan(0);
    expect(exported.freightAnchors.features[0].properties).toHaveProperty('commodityTypes');
  });

  test('demo compare rail includes freight corridor scenarios and exits', () => {
    const result = spawnSync('node', ['command/run_demo_compare_rail.mjs'], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Adaptation With Rail Freight Corridor');
    expect(result.stdout).toContain('Adaptation With Electrified Rail Freight Corridor');
  });
});
