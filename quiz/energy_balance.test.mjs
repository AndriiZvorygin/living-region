import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { createDemoWorld } from '../program/data/demo_world.mjs';
import { demoScenarioAdaptation, demoScenarioNoAdaptation } from '../program/data/demo_scenario.mjs';
import { runScenario } from '../program/simulation/run_scenario.mjs';
import { runYear } from '../program/simulation/run_year.mjs';
import { exportGeoJSON } from '../program/gis/export_geojson.mjs';

describe('energy balance', () => {
  test('energy balance calculates heating deficit when demand exceeds supply', () => {
    const world = createDemoWorld();
    const scenario = demoScenarioNoAdaptation();
    scenario.dieselAvailabilityByYear[scenario.startYear] = 0.2;
    scenario.constants = {
      ...scenario.constants,
      energy: {
        electricGridAvailabilityBase: 0.45,
        sustainableWoodHarvestShare: 0.2,
        biomassHarvestEfficiency: 0.3
      }
    };

    const metrics = runYear(world, scenario, scenario.startYear);
    expect(metrics.heatingEnergyDeficitKwh).toBeGreaterThan(0);
  });

  test('adaptation reduces heat demand or transport fuel demand by final year', () => {
    const noAdaptWorld = createDemoWorld();
    const noAdapt = runScenario(noAdaptWorld, demoScenarioNoAdaptation()).years.at(-1);

    const adaptWorld = createDemoWorld();
    const adapt = runScenario(adaptWorld, demoScenarioAdaptation()).years.at(-1);

    expect(
      adapt.heatDemandKwh < noAdapt.heatDemandKwh
      || adapt.transportFuelDemandLitre < noAdapt.transportFuelDemandLitre
    ).toBe(true);
  });

  test('sustainable biomass harvest is bounded by available wood production', () => {
    const world = createDemoWorld();
    const scenario = demoScenarioAdaptation();
    const metrics = runYear(world, scenario, scenario.startYear);

    expect(metrics.sustainableBiomassHarvestKg).toBeLessThanOrEqual(metrics.biomassHarvestKg);
  });

  test('fuel stress aggregate matches weighted components', () => {
    const world = createDemoWorld();
    const scenario = demoScenarioAdaptation();
    const metrics = runYear(world, scenario, scenario.startYear);

    const recomposed = (metrics.averageHeatingFuelStress * 0.45)
      + (metrics.averageTransportFuelStress * 0.35)
      + (metrics.averageElectricityStress * 0.2);

    expect(metrics.averageTotalFuelStress).toBeCloseTo(recomposed, 4);
    expect(metrics.averageFuelStress).toBeCloseTo(metrics.averageTotalFuelStress, 4);
  });

  test('high heat demand and low fuel availability increases household total stress', () => {
    const worldA = createDemoWorld();
    const scenarioA = demoScenarioNoAdaptation();
    const baseline = runYear(worldA, scenarioA, scenarioA.startYear);

    const worldB = createDemoWorld();
    for (const building of worldB.buildings) {
      building.heatDemandKwhPerYear *= 1.7;
      building.insulationLevel = 0.1;
      building.retrofitLevel = 0;
    }
    const scenarioB = demoScenarioNoAdaptation();
    scenarioB.dieselAvailabilityByYear[scenarioB.startYear] = 0.35;
    const stressed = runYear(worldB, scenarioB, scenarioB.startYear);

    expect(stressed.averageTotalStress).toBeGreaterThan(baseline.averageTotalStress);
  });

  test('retrofits reduce effective heat demand', () => {
    const world = createDemoWorld();
    const scenario = demoScenarioAdaptation();
    const first = runYear(world, scenario, scenario.startYear);
    const final = runScenario(world, scenario).years.at(-1);

    expect(final.heatDemandKwh).toBeLessThan(first.heatDemandKwh);
  });

  test('energy metrics appear in export metrics JSON', () => {
    const result = spawnSync('node', ['command/export_metrics.mjs'], { encoding: 'utf8' });
    expect(result.status).toBe(0);

    const adaptationPath = path.resolve('know/produce/demo-adaptation-metrics.json');
    const payload = JSON.parse(fs.readFileSync(adaptationPath, 'utf8'));
    const final = payload.years[payload.years.length - 1];

    expect(final).toHaveProperty('heatDemandKwh');
    expect(final).toHaveProperty('transportFuelDeficitLitre');
    expect(final).toHaveProperty('transportDieselDemandLitre');
    expect(final).toHaveProperty('totalPassengerKmDemand');
    expect(final).toHaveProperty('averageTotalFuelStress');
  });

  test('energy balance uses transport allocation diesel demand', () => {
    const world = createDemoWorld();
    const scenario = demoScenarioAdaptation();
    const metrics = runYear(world, scenario, scenario.startYear);

    expect(metrics.transportDieselDemandLitre).toBeCloseTo(metrics.transportFuelDemandLitre, 6);
    expect(metrics.unmetPassengerKm).toBeGreaterThanOrEqual(0);
    expect(metrics.unmetFreightTonneKm).toBeGreaterThanOrEqual(0);
  });

  test('GeoJSON building export includes energy fields', () => {
    const world = createDemoWorld();
    runScenario(world, demoScenarioAdaptation());
    const exported = exportGeoJSON(world);
    const firstBuilding = exported.buildings.features[0]?.properties;
    const firstPatch = exported.patches.features[0]?.properties;

    expect(firstBuilding).toHaveProperty('heatDemandKwhPerYear');
    expect(firstBuilding).toHaveProperty('effectiveHeatDemandKwh');
    expect(firstBuilding).toHaveProperty('heatingSystem');
    expect(firstBuilding).toHaveProperty('carDependenceIndex');
    expect(firstBuilding).toHaveProperty('transportResilienceValueAdjustment');
    expect(firstPatch).toHaveProperty('sustainableBiomassHarvestKg');
    expect(firstPatch).toHaveProperty('energyPotentialKwh');
    expect(firstPatch).toHaveProperty('walkAccessIndex');
    expect(firstPatch).toHaveProperty('transportResilienceScore');
  });
});
