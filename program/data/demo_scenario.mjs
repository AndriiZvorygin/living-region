// SPDX-License-Identifier: AGPL-3.0-or-later
import { defaultConstants } from './default_constants.mjs';

function linearSeries(startYear, years, startValue, endValue) {
  const result = {};
  for (let i = 0; i < years; i += 1) {
    const year = startYear + i;
    const t = years <= 1 ? 1 : i / (years - 1);
    result[year] = startValue + (endValue - startValue) * t;
  }
  return result;
}

function buildBaseScenario() {
  const startYear = 2026;
  const years = 20;

  return {
    name: 'base',
    calibrationProfile: 'baseline',
    scaleVariant: 'medium',
    scaleMultipliers: {
      population: 1,
      stationCatchment: 1,
      jobs: 1,
      freightDemand: 1,
      productiveLandCatchment: 1,
      depotThroughput: 1,
      serviceFrequency: 1,
      railCapacity: 1
    },
    startYear,
    years,
    dieselAvailabilityByYear: linearSeries(startYear, years, 1, 0.5),
    fertilizerAvailabilityByYear: linearSeries(startYear, years, 1, 0.6),
    roadMaintenanceBudgetByYear: linearSeries(startYear, years, 1, 0.7),
    interestRateByYear: linearSeries(startYear, years, 0.04, 0.06),
    weatherByYear: {},
    annualCaloriesPerPerson: defaultConstants.annualCaloriesPerPerson,
    annualFirewoodKgPerHousehold: defaultConstants.annualFirewoodKgPerHousehold,
    baseCommuteCostPerKm: 0.45,
    baseFreightCostPerTonneKm: 0.75,
    populationPolicy: {
      allowStressMigration: true,
      forcedAnnualInMigration: 0,
      maxUrbanToRuralMovesPerYear: 999
    },
    constants: {},
    adaptation: {
      ruralOpportunityBoostByYear: linearSeries(startYear, years, 0, 0),
      vacantEdgeToFoodShareByYear: linearSeries(startYear, years, 0, 0),
      localFoodInvestmentByYear: linearSeries(startYear, years, 0, 0),
      socialCohesionBoostByYear: linearSeries(startYear, years, 0, 0),
      institutionalTrustBoostByYear: linearSeries(startYear, years, 0, 0),
      annualRetrofitRateByYear: linearSeries(startYear, years, 0.002, 0.002),
      heatingDemandReductionRateByYear: linearSeries(startYear, years, 0, 0.002),
      localBiomassMobilizationRateByYear: linearSeries(startYear, years, 0, 0.02),
      electrificationRateByYear: linearSeries(startYear, years, 0.001, 0.002),
      transportDemandReductionRateByYear: linearSeries(startYear, years, 0, 0.005),
      localTripSubstitutionRateByYear: linearSeries(startYear, years, 0, 0.01),
      annualLocalServiceBuildoutRateByYear: linearSeries(startYear, years, 0, 0.002),
      annualTripReductionRateByYear: linearSeries(startYear, years, 0, 0.003),
      annualModeShiftToWalkBikeRateByYear: linearSeries(startYear, years, 0, 0.002),
      annualModeShiftToBusRateByYear: linearSeries(startYear, years, 0, 0.0015),
      annualFreightLocalizationRateByYear: linearSeries(startYear, years, 0, 0.0015),
      annualDraftTransportAdoptionRateByYear: linearSeries(startYear, years, 0, 0.001),
      annualRailWaterFreightUseRateByYear: linearSeries(startYear, years, 0, 0.001),
      privateCarDependenceReductionRateByYear: linearSeries(startYear, years, 0, 0.002),
      annualStationCatchmentBuildoutRateByYear: linearSeries(startYear, years, 0, 0.001),
      annualRailFrequencyIncreaseRateByYear: linearSeries(startYear, years, 0, 0.001),
      annualRailCorridorTransitionRateByYear: linearSeries(startYear, years, 0, 0.001),
      freightPriorityForFoodAndFuel: false,
      preferredInfrastructureTypes: []
    },
    rail: {
      enableRail: false,
      electrifyRail: false,
      annualRailServiceBuildoutRateByYear: linearSeries(startYear, years, 0, 0),
      annualRailElectrificationRateByYear: linearSeries(startYear, years, 0, 0),
      railMaintenanceBudgetByYear: linearSeries(startYear, years, 0, 0),
      corridorBuildoutLevelByYear: linearSeries(startYear, years, 0, 0),
      freightAnchorBuildoutLevelByYear: linearSeries(startYear, years, 0, 0)
    }
  };
}

export function demoScenarioNoAdaptation() {
  const scenario = buildBaseScenario();
  scenario.name = 'no-adaptation';
  scenario.populationPolicy.maxUrbanToRuralMovesPerYear = 2;
  scenario.adaptation.ruralOpportunityBoostByYear = linearSeries(scenario.startYear, scenario.years, 0, 0.05);
  scenario.adaptation.annualRetrofitRateByYear = linearSeries(scenario.startYear, scenario.years, 0.001, 0.001);
  scenario.adaptation.heatingDemandReductionRateByYear = linearSeries(scenario.startYear, scenario.years, 0, 0.001);
  scenario.adaptation.localBiomassMobilizationRateByYear = linearSeries(scenario.startYear, scenario.years, 0, 0.01);
  scenario.adaptation.electrificationRateByYear = linearSeries(scenario.startYear, scenario.years, 0.0005, 0.001);
  scenario.adaptation.transportDemandReductionRateByYear = linearSeries(scenario.startYear, scenario.years, 0, 0.002);
  scenario.adaptation.localTripSubstitutionRateByYear = linearSeries(scenario.startYear, scenario.years, 0, 0.004);
  scenario.adaptation.annualLocalServiceBuildoutRateByYear = linearSeries(scenario.startYear, scenario.years, 0, 0.0008);
  scenario.adaptation.annualTripReductionRateByYear = linearSeries(scenario.startYear, scenario.years, 0, 0.001);
  scenario.adaptation.annualModeShiftToWalkBikeRateByYear = linearSeries(scenario.startYear, scenario.years, 0, 0.0008);
  scenario.adaptation.annualModeShiftToBusRateByYear = linearSeries(scenario.startYear, scenario.years, 0, 0.0006);
  scenario.adaptation.annualFreightLocalizationRateByYear = linearSeries(scenario.startYear, scenario.years, 0, 0.0005);
  scenario.adaptation.annualDraftTransportAdoptionRateByYear = linearSeries(scenario.startYear, scenario.years, 0, 0.0006);
  scenario.adaptation.annualRailWaterFreightUseRateByYear = linearSeries(scenario.startYear, scenario.years, 0, 0.0005);
  scenario.adaptation.privateCarDependenceReductionRateByYear = linearSeries(scenario.startYear, scenario.years, 0, 0.001);
  scenario.adaptation.annualStationCatchmentBuildoutRateByYear = linearSeries(scenario.startYear, scenario.years, 0, 0);
  scenario.adaptation.annualRailFrequencyIncreaseRateByYear = linearSeries(scenario.startYear, scenario.years, 0, 0);
  scenario.adaptation.annualRailCorridorTransitionRateByYear = linearSeries(scenario.startYear, scenario.years, 0, 0);
  scenario.adaptation.freightPriorityForFoodAndFuel = false;
  scenario.constants = {
    stress: {
      migrationWeights: {
        transport: 0.22
      }
    }
  };
  scenario.rail.enableRail = false;
  scenario.rail.electrifyRail = false;
  scenario.rail.railMaintenanceBudgetByYear = linearSeries(scenario.startYear, scenario.years, 0, 0);
  scenario.rail.corridorBuildoutLevelByYear = linearSeries(scenario.startYear, scenario.years, 0, 0);
  scenario.rail.freightAnchorBuildoutLevelByYear = linearSeries(scenario.startYear, scenario.years, 0, 0);
  return scenario;
}

export function demoScenarioAdaptation() {
  const scenario = buildBaseScenario();
  scenario.name = 'adaptation';
  scenario.adaptation.ruralOpportunityBoostByYear = linearSeries(scenario.startYear, scenario.years, 0.05, 0.32);
  scenario.adaptation.vacantEdgeToFoodShareByYear = linearSeries(scenario.startYear, scenario.years, 0, 0.2);
  scenario.adaptation.localFoodInvestmentByYear = linearSeries(scenario.startYear, scenario.years, 0.02, 0.18);
  scenario.adaptation.socialCohesionBoostByYear = linearSeries(scenario.startYear, scenario.years, 0.001, 0.004);
  scenario.adaptation.institutionalTrustBoostByYear = linearSeries(scenario.startYear, scenario.years, 0.001, 0.003);
  scenario.adaptation.annualRetrofitRateByYear = linearSeries(scenario.startYear, scenario.years, 0.01, 0.015);
  scenario.adaptation.heatingDemandReductionRateByYear = linearSeries(scenario.startYear, scenario.years, 0.004, 0.008);
  scenario.adaptation.localBiomassMobilizationRateByYear = linearSeries(scenario.startYear, scenario.years, 0.04, 0.1);
  scenario.adaptation.electrificationRateByYear = linearSeries(scenario.startYear, scenario.years, 0.005, 0.012);
  scenario.adaptation.transportDemandReductionRateByYear = linearSeries(scenario.startYear, scenario.years, 0.01, 0.03);
  scenario.adaptation.localTripSubstitutionRateByYear = linearSeries(scenario.startYear, scenario.years, 0.015, 0.05);
  scenario.adaptation.annualLocalServiceBuildoutRateByYear = linearSeries(scenario.startYear, scenario.years, 0.004, 0.012);
  scenario.adaptation.annualTripReductionRateByYear = linearSeries(scenario.startYear, scenario.years, 0.006, 0.02);
  scenario.adaptation.annualModeShiftToWalkBikeRateByYear = linearSeries(scenario.startYear, scenario.years, 0.006, 0.018);
  scenario.adaptation.annualModeShiftToBusRateByYear = linearSeries(scenario.startYear, scenario.years, 0.003, 0.012);
  scenario.adaptation.annualFreightLocalizationRateByYear = linearSeries(scenario.startYear, scenario.years, 0.004, 0.016);
  scenario.adaptation.annualDraftTransportAdoptionRateByYear = linearSeries(scenario.startYear, scenario.years, 0.003, 0.012);
  scenario.adaptation.annualRailWaterFreightUseRateByYear = linearSeries(scenario.startYear, scenario.years, 0.003, 0.018);
  scenario.adaptation.privateCarDependenceReductionRateByYear = linearSeries(scenario.startYear, scenario.years, 0.004, 0.02);
  scenario.adaptation.annualStationCatchmentBuildoutRateByYear = linearSeries(scenario.startYear, scenario.years, 0.004, 0.015);
  scenario.adaptation.annualRailFrequencyIncreaseRateByYear = linearSeries(scenario.startYear, scenario.years, 0.004, 0.012);
  scenario.adaptation.annualRailCorridorTransitionRateByYear = linearSeries(scenario.startYear, scenario.years, 0.003, 0.014);
  scenario.adaptation.freightPriorityForFoodAndFuel = true;
  scenario.adaptation.preferredInfrastructureTypes = ['rootCellar', 'marketHall', 'mill'];
  scenario.populationPolicy.maxUrbanToRuralMovesPerYear = 8;
  scenario.constants = {
    labour: {
      transportLabourDemandDays: 0
    }
  };
  scenario.rail.enableRail = false;
  scenario.rail.electrifyRail = false;
  scenario.rail.railMaintenanceBudgetByYear = linearSeries(scenario.startYear, scenario.years, 0, 0);
  scenario.rail.corridorBuildoutLevelByYear = linearSeries(scenario.startYear, scenario.years, 0, 0);
  scenario.rail.freightAnchorBuildoutLevelByYear = linearSeries(scenario.startYear, scenario.years, 0, 0);
  return scenario;
}

export function demoScenarioAdaptationWithRailBasic() {
  const scenario = demoScenarioAdaptation();
  scenario.name = 'adaptation-with-rail-basic';
  scenario.rail.enableRail = true;
  scenario.rail.electrifyRail = false;
  scenario.rail.annualRailServiceBuildoutRateByYear = linearSeries(scenario.startYear, scenario.years, 0.01, 0.028);
  scenario.rail.annualRailElectrificationRateByYear = linearSeries(scenario.startYear, scenario.years, 0, 0);
  scenario.rail.railMaintenanceBudgetByYear = linearSeries(scenario.startYear, scenario.years, 0.62, 0.9);
  scenario.rail.corridorBuildoutLevelByYear = linearSeries(scenario.startYear, scenario.years, 0.02, 0.16);
  scenario.rail.freightAnchorBuildoutLevelByYear = linearSeries(scenario.startYear, scenario.years, 0.02, 0.12);
  scenario.adaptation.annualStationCatchmentBuildoutRateByYear = linearSeries(scenario.startYear, scenario.years, 0.003, 0.008);
  scenario.adaptation.annualRailFrequencyIncreaseRateByYear = linearSeries(scenario.startYear, scenario.years, 0.003, 0.008);
  scenario.adaptation.annualRailCorridorTransitionRateByYear = linearSeries(scenario.startYear, scenario.years, 0.002, 0.006);
  return scenario;
}

export function demoScenarioAdaptationWithRailCorridor() {
  const scenario = demoScenarioAdaptationWithRailBasic();
  scenario.name = 'adaptation-with-rail-corridor';
  scenario.rail.corridorBuildoutLevelByYear = linearSeries(scenario.startYear, scenario.years, 0.12, 0.6);
  scenario.rail.freightAnchorBuildoutLevelByYear = linearSeries(scenario.startYear, scenario.years, 0.1, 0.58);
  scenario.rail.annualRailServiceBuildoutRateByYear = linearSeries(scenario.startYear, scenario.years, 0.016, 0.05);
  scenario.adaptation.annualStationCatchmentBuildoutRateByYear = linearSeries(scenario.startYear, scenario.years, 0.01, 0.04);
  scenario.adaptation.annualRailFrequencyIncreaseRateByYear = linearSeries(scenario.startYear, scenario.years, 0.01, 0.04);
  scenario.adaptation.annualRailCorridorTransitionRateByYear = linearSeries(scenario.startYear, scenario.years, 0.008, 0.03);
  scenario.adaptation.privateCarDependenceReductionRateByYear = linearSeries(scenario.startYear, scenario.years, 0.007, 0.04);
  scenario.adaptation.annualLocalServiceBuildoutRateByYear = linearSeries(scenario.startYear, scenario.years, 0.006, 0.02);
  return scenario;
}

export function demoScenarioAdaptationWithElectrifiedRailCorridor() {
  const scenario = demoScenarioAdaptationWithRailCorridor();
  scenario.name = 'adaptation-with-electrified-rail-corridor';
  scenario.rail.electrifyRail = true;
  scenario.rail.annualRailElectrificationRateByYear = linearSeries(scenario.startYear, scenario.years, 0.06, 0.12);
  scenario.rail.railMaintenanceBudgetByYear = linearSeries(scenario.startYear, scenario.years, 0.66, 0.96);
  scenario.adaptation.electrificationRateByYear = linearSeries(scenario.startYear, scenario.years, 0.01, 0.03);
  return scenario;
}

export function demoScenarioAdaptationWithRailFreightCorridor() {
  const scenario = demoScenarioAdaptationWithRailCorridor();
  scenario.name = 'adaptation-with-rail-freight-corridor';
  scenario.rail.freightAnchorBuildoutLevelByYear = linearSeries(scenario.startYear, scenario.years, 0.22, 0.88);
  scenario.rail.corridorBuildoutLevelByYear = linearSeries(scenario.startYear, scenario.years, 0.2, 0.72);
  scenario.rail.annualRailServiceBuildoutRateByYear = linearSeries(scenario.startYear, scenario.years, 0.02, 0.06);
  scenario.adaptation.annualRailCorridorTransitionRateByYear = linearSeries(scenario.startYear, scenario.years, 0.012, 0.04);
  scenario.adaptation.annualFreightLocalizationRateByYear = linearSeries(scenario.startYear, scenario.years, 0.006, 0.024);
  scenario.adaptation.annualRailWaterFreightUseRateByYear = linearSeries(scenario.startYear, scenario.years, 0.01, 0.04);
  scenario.adaptation.freightPriorityForFoodAndFuel = true;
  return scenario;
}

export function demoScenarioAdaptationWithElectrifiedRailFreightCorridor() {
  const scenario = demoScenarioAdaptationWithRailFreightCorridor();
  scenario.name = 'adaptation-with-electrified-rail-freight-corridor';
  scenario.rail.electrifyRail = true;
  scenario.rail.annualRailElectrificationRateByYear = linearSeries(scenario.startYear, scenario.years, 0.08, 0.16);
  scenario.adaptation.electrificationRateByYear = linearSeries(scenario.startYear, scenario.years, 0.012, 0.034);
  return scenario;
}

function withScale(baseScenario, scaleVariant, multipliers) {
  return {
    ...baseScenario,
    name: `${baseScenario.name}-${scaleVariant}`,
    scaleVariant,
    scaleMultipliers: {
      ...baseScenario.scaleMultipliers,
      ...multipliers
    }
  };
}

export function demoScenarioAdaptationWithRailFreightCorridorSmall() {
  return withScale(demoScenarioAdaptationWithRailFreightCorridor(), 'small', {
    population: 0.75,
    stationCatchment: 0.8,
    jobs: 0.8,
    freightDemand: 0.7,
    productiveLandCatchment: 0.85,
    depotThroughput: 0.7,
    serviceFrequency: 0.85,
    railCapacity: 0.8
  });
}

export function demoScenarioAdaptationWithRailFreightCorridorMedium() {
  return withScale(demoScenarioAdaptationWithRailFreightCorridor(), 'medium', {
    population: 1,
    stationCatchment: 1,
    jobs: 1,
    freightDemand: 1,
    productiveLandCatchment: 1,
    depotThroughput: 1,
    serviceFrequency: 1,
    railCapacity: 1
  });
}

export function demoScenarioAdaptationWithRailFreightCorridorLarge() {
  return withScale(demoScenarioAdaptationWithRailFreightCorridor(), 'large', {
    population: 1.8,
    stationCatchment: 1.7,
    jobs: 1.6,
    freightDemand: 1.9,
    productiveLandCatchment: 1.4,
    depotThroughput: 1.9,
    serviceFrequency: 1.35,
    railCapacity: 1.45
  });
}

export function demoScenarioAdaptationWithRailFreightCorridorHighDensity() {
  const scenario = withScale(demoScenarioAdaptationWithRailFreightCorridor(), 'high-density', {
    population: 1.35,
    stationCatchment: 1.6,
    jobs: 1.45,
    freightDemand: 1.5,
    productiveLandCatchment: 1.25,
    depotThroughput: 1.55,
    serviceFrequency: 1.5,
    railCapacity: 1.2
  });
  scenario.calibrationProfile = 'highDensityCorridor';
  return scenario;
}

// Backward-compatible names retained for existing callers.
export function demoScenarioAdaptationWithRail() {
  // Use corridor buildout as the default "with rail" path so legacy callers
  // see meaningful rail-enabled freight/passenger dynamics.
  return demoScenarioAdaptationWithRailCorridor();
}

export function demoScenarioAdaptationWithElectrifiedRail() {
  return demoScenarioAdaptationWithElectrifiedRailCorridor();
}

export function createDemoScenario() {
  return demoScenarioAdaptation();
}
