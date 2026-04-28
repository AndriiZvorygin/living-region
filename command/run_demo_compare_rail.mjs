// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  runNoAdaptation,
  runAdaptation,
  runAdaptationWithRailBasic,
  runAdaptationWithRailCorridor,
  runAdaptationWithRailFreightCorridor,
  runAdaptationWithElectrifiedRailCorridor,
  runAdaptationWithElectrifiedRailFreightCorridor
} from './scenario_helpers.mjs';

function summary(label, item) {
  return {
    scenario: label,
    population: Math.round(item.populationTotal),
    foodCoverage: Number((item.localFoodCoverageRatio ?? 0).toFixed(2)),
    transportFuelStress: Number((item.averageTransportFuelStress ?? 0).toFixed(2)),
    railUtilizationRatio: Number((item.railUtilizationRatio ?? 0).toFixed(3)),
    railPassengerKm: Math.round(item.railPassengerKm ?? 0),
    railFreightTonneKm: Math.round(item.railFreightTonneKm ?? 0),
    railBenefitCostRatio: Number((item.railBenefitCostRatio ?? 0).toFixed(3)),
    railCostRecoveryRatioDirect: Number((item.railCostRecoveryRatioDirect ?? item.railCostRecoveryRatio ?? 0).toFixed(3)),
    railCostRecoveryRatioWithAvoidedCosts: Number((item.railCostRecoveryRatioWithAvoidedCosts ?? 0).toFixed(3)),
    railAvoidedRoadMaintenanceValue: Math.round(item.railAvoidedRoadMaintenanceValue ?? 0),
    railAvoidedDieselValue: Math.round(item.railAvoidedDieselValue ?? 0),
    railTotalBenefitEquivalent: Math.round(item.railTotalBenefitEquivalent ?? 0),
    railNetCostAfterBenefits: Math.round(item.railNetCostAfterBenefits ?? 0),
    catchmentPopulation: Math.round(item.catchmentPopulation ?? 0),
    householdsWithViableRailAlternative: Math.round(item.householdsWithViableRailAlternative ?? 0),
    householdsCarDependentNoAlternative: Math.round(item.householdsCarDependentNoAlternative ?? 0),
    stationAreaPopulationAdded: Math.round(item.stationAreaPopulationAdded ?? 0),
    stationAreaJobsAdded: Math.round(item.stationAreaJobsAdded ?? 0),
    heavyTruckTonneKmAvoidedByRail: Math.round(item.heavyTruckTonneKmAvoidedByRail ?? 0),
    freightSpoilageLossTonnes: Number((item.freightSpoilageLossTonnes ?? 0).toFixed(2)),
    railBreakEvenFreightTonneKm: Math.round(item.railBreakEvenFreightTonneKm ?? 0),
    railBreakEvenMixedUtilization: Number((item.railBreakEvenMixedUtilization ?? 0).toFixed(3)),
    mixedScaleMultiplierNeeded: Number((item.mixedScaleMultiplierNeeded ?? 0).toFixed(2)),
    warningCount: item.warningCount ?? 0,
    criticalWarningCount: item.criticalWarningCount ?? 0,
    roadMaintenanceBacklogMoney: Math.round(item.roadMaintenanceBacklogMoney ?? 0)
  };
}

const rows = [
  summary('No Adaptation', runNoAdaptation().finalYear),
  summary('Adaptation', runAdaptation().finalYear),
  summary('Adaptation With Rail Basic', runAdaptationWithRailBasic().finalYear),
  summary('Adaptation With Rail Corridor', runAdaptationWithRailCorridor().finalYear),
  summary('Adaptation With Rail Freight Corridor', runAdaptationWithRailFreightCorridor().finalYear),
  summary('Adaptation With Electrified Rail Corridor', runAdaptationWithElectrifiedRailCorridor().finalYear),
  summary('Adaptation With Electrified Rail Freight Corridor', runAdaptationWithElectrifiedRailFreightCorridor().finalYear)
];

console.table(rows);
