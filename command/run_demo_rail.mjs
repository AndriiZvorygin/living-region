// SPDX-License-Identifier: AGPL-3.0-or-later
import { createDemoWorld, demoScenarioAdaptationWithRail, runScenario } from '../program/index.mjs';

const world = createDemoWorld();
const scenario = demoScenarioAdaptationWithRail();

const { years } = runScenario(world, scenario);

const rows = years.map((item) => ({
  year: item.year,
  population: Math.round(item.populationTotal),
  foodCoverage: Number((item.localFoodCoverageRatio ?? 0).toFixed(2)),
  transportFuelStress: Number((item.averageTransportFuelStress ?? 0).toFixed(2)),
  roadBacklogM: Math.round((item.roadMaintenanceBacklogMoney ?? 0) / 1_000_000),
  railPassengerKm: Math.round(item.railPassengerKm ?? 0),
  railFreightTonneKm: Math.round(item.railFreightTonneKm ?? 0),
  railUtilization: Number((item.railUtilizationRatio ?? 0).toFixed(3)),
  dieselDeficitL: Math.round(item.transportDieselDeficitLitre ?? 0)
}));

console.table(rows);
