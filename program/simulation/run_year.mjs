// SPDX-License-Identifier: AGPL-3.0-or-later
import { clamp, safeDivide, valueByYear } from '../util/math.mjs';
import { defaultConstants, mergeScenarioConstants } from '../data/default_constants.mjs';
import { applyCalibrationProfile } from '../data/calibration_profiles.mjs';
import { getSeasonContext } from './seasons.mjs';
import { growPlants } from './grow_plants.mjs';
import { allocateLabour } from './allocate_labour.mjs';
import { applyHouseholdConsumption } from './household_consumption.mjs';
import { calculateTransportCosts } from './transport_costs.mjs';
import { allocateTransport } from './transport_allocation.mjs';
import { updateHousingMarket } from './housing_market.mjs';
import { calculateEnergyBalance } from './energy_balance.mjs';
import { calculateHouseholdStress } from './household_stress.mjs';
import { updateRealEstateValues } from './real_estate_values.mjs';
import { updatePopulationDynamics } from './population_dynamics.mjs';
import { applyInfrastructureDecay } from './infrastructure_decay.mjs';
import { calculateSettlementMetrics } from './settlement_metrics.mjs';
import { applyRoadMaintenance } from './road_maintenance.mjs';
import { applyRailMaintenance } from './rail_maintenance.mjs';
import { applyRailElectrification } from './rail_electrification.mjs';
import { calculateNetworkCosts } from './network_costs.mjs';
import { calculateTransportEconomics } from './transport_economics.mjs';
import { calculateStationCatchments } from './station_catchments.mjs';
import { applyCorridorTransition } from './corridor_transition.mjs';
import { calculateFreightDemand } from './freight_demand.mjs';
import { allocateFreight } from './freight_allocation.mjs';
import { calculateBreakEvenDiagnostics } from './break_even_diagnostics.mjs';
import { evaluateUnitSanity } from './unit_sanity.mjs';

function consecutiveFoodDeficitYears(world) {
  let deficits = 0;
  for (let i = world.metricsByYear.length - 1; i >= 0; i -= 1) {
    if ((world.metricsByYear[i]?.foodSurplusCalories ?? 0) < 0) {
      deficits += 1;
      continue;
    }
    break;
  }
  return deficits;
}

function applyScenarioAdaptation(world, scenario, year) {
  const adaptation = scenario.adaptation ?? {};
  const railScenario = scenario.rail ?? {};
  const landShiftShare = valueByYear(adaptation.vacantEdgeToFoodShareByYear, year, 0);
  const localFoodInvestmentBoost = valueByYear(adaptation.localFoodInvestmentByYear, year, 0);
  const socialCohesionBoost = valueByYear(adaptation.socialCohesionBoostByYear, year, 0);
  const institutionalTrustBoost = valueByYear(adaptation.institutionalTrustBoostByYear, year, 0);
  const annualRetrofitRate = valueByYear(adaptation.annualRetrofitRateByYear, year, 0);
  const heatingDemandReductionRate = valueByYear(adaptation.heatingDemandReductionRateByYear, year, 0);
  const localBiomassMobilizationRate = valueByYear(adaptation.localBiomassMobilizationRateByYear, year, 0);
  const electrificationRate = valueByYear(adaptation.electrificationRateByYear, year, 0);
  const transportDemandReductionRate = valueByYear(adaptation.transportDemandReductionRateByYear, year, 0);
  const localTripSubstitutionRate = valueByYear(adaptation.localTripSubstitutionRateByYear, year, 0);
  const annualLocalServiceBuildoutRate = valueByYear(adaptation.annualLocalServiceBuildoutRateByYear, year, 0);
  const annualTripReductionRate = valueByYear(adaptation.annualTripReductionRateByYear, year, 0);
  const annualModeShiftToWalkBikeRate = valueByYear(adaptation.annualModeShiftToWalkBikeRateByYear, year, 0);
  const annualModeShiftToBusRate = valueByYear(adaptation.annualModeShiftToBusRateByYear, year, 0);
  const annualFreightLocalizationRate = valueByYear(adaptation.annualFreightLocalizationRateByYear, year, 0);
  const annualDraftTransportAdoptionRate = valueByYear(adaptation.annualDraftTransportAdoptionRateByYear, year, 0);
  const annualRailWaterFreightUseRate = valueByYear(adaptation.annualRailWaterFreightUseRateByYear, year, 0);
  const privateCarDependenceReductionRate = valueByYear(adaptation.privateCarDependenceReductionRateByYear, year, 0);
  const annualStationCatchmentBuildoutRate = valueByYear(adaptation.annualStationCatchmentBuildoutRateByYear, year, 0);
  const annualRailFrequencyIncreaseRate = valueByYear(adaptation.annualRailFrequencyIncreaseRateByYear, year, 0);
  const annualRailCorridorTransitionRate = valueByYear(adaptation.annualRailCorridorTransitionRateByYear, year, 0);

  const annualRailServiceBuildoutRate = valueByYear(railScenario.annualRailServiceBuildoutRateByYear, year, 0);
  const annualRailElectrificationRate = valueByYear(railScenario.annualRailElectrificationRateByYear, year, 0);
  const railMaintenanceBudgetScale = valueByYear(railScenario.railMaintenanceBudgetByYear, year, railScenario.enableRail ? 0.75 : 0);
  const corridorBuildoutLevel = valueByYear(railScenario.corridorBuildoutLevelByYear, year, 0);
  const freightAnchorBuildoutLevel = valueByYear(railScenario.freightAnchorBuildoutLevelByYear, year, 0);

  const marketGarden = world.plantGroups.find((group) => group.id === 'pg-gardens');
  const vacantRegrowth = world.plantGroups.find((group) => group.id === 'pg-vacant-regrowth');
  const villageGardens = world.plantGroups.find((group) => group.id === 'pg-village-gardens');

  if (vacantRegrowth && marketGarden) {
    const shiftedShare = clamp(landShiftShare, 0, 0.35);
    vacantRegrowth.areaShare = clamp(0.45 - shiftedShare, 0.1, 0.9);
    if (villageGardens) {
      villageGardens.areaShare = clamp(0.38 + shiftedShare * 0.8, 0.2, 0.9);
    }
  }

  for (const group of world.plantGroups) {
    const isLocalFoodGroup = ['pg-gardens', 'pg-village-gardens', 'pg-orchard'].includes(group.id);
    if (!isLocalFoodGroup) {
      continue;
    }
    const baseCalories = group.traits.yields.baseCaloriesPerHaAtMaturity ?? group.traits.yields.caloriesPerHaAtMaturity;
    group.traits.yields.baseCaloriesPerHaAtMaturity = baseCalories;
    group.traits.yields.caloriesPerHaAtMaturity = baseCalories * (1 + localFoodInvestmentBoost);
  }

  for (const settlement of world.settlements) {
    settlement.socialCohesion = clamp(settlement.socialCohesion + socialCohesionBoost, 0.2, 1);
    settlement.institutionalTrust = clamp(settlement.institutionalTrust + institutionalTrustBoost, 0.2, 1);
  }

  for (const building of world.buildings) {
    building.retrofitLevel = clamp((building.retrofitLevel ?? 0) + annualRetrofitRate, 0, 1);
    building.insulationLevel = clamp((building.insulationLevel ?? 0.3) + annualRetrofitRate * 0.7, 0, 1);
    if (!Object.hasOwn(building, 'baseHeatDemandKwhPerYear')) {
      building.baseHeatDemandKwhPerYear = building.heatDemandKwhPerYear;
    }
    building.heatDemandKwhPerYear = Math.max(
      3_000,
      building.baseHeatDemandKwhPerYear * (1 - heatingDemandReductionRate)
    );

    if (building.heatingSystem === 'oil' || building.heatingSystem === 'gas') {
      if (building.retrofitLevel > 0.58 && electrificationRate > 0.008) {
        building.heatingSystem = 'electric';
      } else if (building.retrofitLevel > 0.28 && electrificationRate > 0.003) {
        building.heatingSystem = 'mixed';
      }
    } else if (building.heatingSystem === 'wood' && electrificationRate > 0.01 && building.retrofitLevel > 0.65) {
      building.heatingSystem = 'mixed';
    }
  }

  for (const infrastructure of world.infrastructures) {
    if (!Object.hasOwn(infrastructure, 'baseFreightAnchorStrength')) {
      infrastructure.baseFreightAnchorStrength = infrastructure.freightAnchorStrength ?? 0;
    }
    if (!Object.hasOwn(infrastructure, 'baseAnnualThroughputTonnes')) {
      infrastructure.baseAnnualThroughputTonnes = infrastructure.annualThroughputTonnes ?? 0;
    }
    if (!Object.hasOwn(infrastructure, 'baseServiceFrequencyPerDay')) {
      infrastructure.baseServiceFrequencyPerDay = infrastructure.serviceFrequencyPerDay ?? 0;
    }

    infrastructure.freightAnchorStrength = clamp(
      infrastructure.baseFreightAnchorStrength + freightAnchorBuildoutLevel * 0.35,
      0,
      1
    );
    infrastructure.anchorStrength = infrastructure.freightAnchorStrength;
    infrastructure.annualThroughputTonnes = Math.max(
      infrastructure.baseAnnualThroughputTonnes,
      infrastructure.baseAnnualThroughputTonnes * (1 + freightAnchorBuildoutLevel * 1.2)
    );
    infrastructure.serviceFrequencyPerDay = Math.max(
      infrastructure.baseServiceFrequencyPerDay,
      infrastructure.baseServiceFrequencyPerDay * (1 + annualRailServiceBuildoutRate * 2.5 + annualRailFrequencyIncreaseRate * 1.8)
    );
  }

  return {
    preferredInfrastructureTypes: adaptation.preferredInfrastructureTypes ?? [],
    ruralOpportunityBoost: valueByYear(adaptation.ruralOpportunityBoostByYear, year, 0),
    annualRetrofitRate,
    heatingDemandReductionRate,
    localBiomassMobilizationRate,
    electrificationRate,
    transportDemandReductionRate,
    localTripSubstitutionRate,
    annualLocalServiceBuildoutRate,
    annualTripReductionRate,
    annualModeShiftToWalkBikeRate,
    annualModeShiftToBusRate,
    annualFreightLocalizationRate,
    annualDraftTransportAdoptionRate,
    annualRailWaterFreightUseRate,
    annualRailServiceBuildoutRate,
    annualRailElectrificationRate,
    privateCarDependenceReductionRate,
    annualStationCatchmentBuildoutRate,
    annualRailFrequencyIncreaseRate,
    annualRailCorridorTransitionRate,
    rail: {
      enableRail: railScenario.enableRail ?? false,
      electrifyRail: railScenario.electrifyRail ?? false,
      annualRailServiceBuildoutRate,
      annualRailElectrificationRate,
      railMaintenanceBudgetScale,
      corridorBuildoutLevel,
      freightAnchorBuildoutLevel
    },
    freightPriorityForFoodAndFuel: adaptation.freightPriorityForFoodAndFuel ?? false
  };
}

export function runYear(world, scenario, year) {
  const calibratedDefaults = applyCalibrationProfile(defaultConstants, scenario.calibrationProfile ?? 'baseline');
  const constants = mergeScenarioConstants(calibratedDefaults, scenario.constants ?? {});

  const marketConstants = constants.market ?? {};
  const primaryMarket = world.markets[0];
  if (primaryMarket) {
    if (!Object.hasOwn(primaryMarket, 'basePrices')) {
      primaryMarket.basePrices = { ...primaryMarket.prices };
    }
    primaryMarket.prices.dieselLitre = primaryMarket.basePrices.dieselLitre * (marketConstants.dieselPriceMultiplier ?? 1);
    primaryMarket.prices.electricityKwh = primaryMarket.basePrices.electricityKwh * (marketConstants.electricityPriceMultiplier ?? 1);
  }

  const dieselAvailability = valueByYear(scenario.dieselAvailabilityByYear, year, 1);
  const fertilizerAvailability = valueByYear(scenario.fertilizerAvailabilityByYear, year, 1);
  const roadMaintenanceBudgetScale = valueByYear(scenario.roadMaintenanceBudgetByYear, year, 1);

  const adaptationState = applyScenarioAdaptation(world, scenario, year);
  const seasonal = getSeasonContext(scenario, year);

  const production = growPlants(world, {
    ...seasonal,
    fertilizerAvailability,
    constants
  });

  const railElectrification = applyRailElectrification(world, {
    constants,
    rail: adaptationState.rail
  });

  const stationCatchments = calculateStationCatchments(world, {
    constants,
    adaptation: adaptationState,
    rail: adaptationState.rail
  });

  const corridorTransition = applyCorridorTransition(world, {
    constants,
    adaptation: adaptationState,
    rail: adaptationState.rail,
    stationCatchments
  });

  const transport = calculateTransportCosts(world, scenario, {
    dieselAvailability,
    constants,
    adaptation: adaptationState
  });

  const freightDemand = calculateFreightDemand(world, scenario, {
    constants,
    adaptation: adaptationState,
    transport,
    production
  });

  const passengerTransportInput = {
    ...transport,
    totalFreightTonneKmDemand: 0,
    foodFreightTonneKm: 0,
    fuelFreightTonneKm: 0,
    materialsFreightTonneKm: 0,
    marketFreightTonneKm: 0,
    localizedFreightTonneKmAvoided: 0
  };

  const transportAllocation = allocateTransport(world, scenario, passengerTransportInput, {
    constants,
    adaptation: adaptationState,
    dieselAvailability,
    producedFodderKg: production.producedFodderKg,
    stationCatchments,
    corridorTransition
  });

  const freightAllocation = allocateFreight(world, scenario, freightDemand, {
    constants,
    adaptation: adaptationState,
    dieselAvailability,
    railEnabled: transportAllocation.railEnabled,
    railElectrifiedShare: transportAllocation.railElectrifiedShare,
    railConditionAverage: transportAllocation.railConditionAverage,
    railServiceReliability: transportAllocation.railServiceReliability,
    stationCatchments
  });

  for (const infra of world.infrastructures) {
    const commodityTypes = infra.commodityTypes ?? [];
    const throughput = infra.annualThroughputTonnes ?? 0;
    const firstCommodity = commodityTypes[0] ?? null;
    const captured = firstCommodity ? (freightAllocation.freightTonneKmCapturedByAnchor[firstCommodity] ?? 0) : 0;
    infra.metrics = {
      ...(infra.metrics ?? {}),
      annualThroughputTonnes: throughput,
      freightTonneKmCaptured: captured,
      avoidedRoadTonneKm: captured * 0.8,
      spoilageReductionValue: (infra.spoilageReduction ?? 0) * captured * 0.3,
      loadingLabourDays: throughput * (infra.loadingLabourDaysPerTonne ?? 0),
      commodityTypes
    };
  }

  const combinedRailFreightTonneKm = freightAllocation.railFreightCapturedTonneKm;
  const combinedRailPassengerKm = transportAllocation.railPassengerKm;
  const railPassengerCapacityKm = transportAllocation.railPassengerCapacityKm ?? 1;
  const railFreightCapacityTonneKm = transportAllocation.railFreightCapacityTonneKm ?? 1;
  const utilizationPassengerWeight = constants.railCorridor?.utilizationPassengerWeight ?? 0.45;
  const utilizationFreightWeight = constants.railCorridor?.utilizationFreightWeight ?? 0.55;
  const passengerUtilizationRatio = clamp(safeDivide(combinedRailPassengerKm, Math.max(1, railPassengerCapacityKm), 0), 0, 1);
  const freightUtilizationRatio = clamp(safeDivide(combinedRailFreightTonneKm, Math.max(1, railFreightCapacityTonneKm), 0), 0, 1);
  const weightedUtilizationRatio = clamp(
    passengerUtilizationRatio * utilizationPassengerWeight + freightUtilizationRatio * utilizationFreightWeight,
    0,
    1
  );
  const combinedRailUtilizationRatio = weightedUtilizationRatio;

  const combinedTransport = {
    ...transportAllocation,
    totalFreightTonneKmDemand: freightDemand.totalFreightTonneKm,
    localizedFreightTonneKmAvoided: freightDemand.avoidableFreightTonneKm,
    dieselFreightTonneKm: freightAllocation.dieselRoadFreightTonneKm + combinedRailFreightTonneKm * (1 - (transportAllocation.railElectrifiedShare ?? 0)),
    nonDieselFreightTonneKm: freightAllocation.nonDieselFreightTonneKm,
    transportDieselDemandLitre: transportAllocation.transportDieselDemandLitre + freightAllocation.freightDieselDemandLitre,
    transportDieselAvailableLitre: (transportAllocation.transportDieselDemandLitre + freightAllocation.freightDieselDemandLitre) * dieselAvailability,
    transportDieselDeficitLitre: Math.max(0, (transportAllocation.transportDieselDemandLitre + freightAllocation.freightDieselDemandLitre) * (1 - dieselAvailability)),
    transportElectricityDemandKwh: transportAllocation.transportElectricityDemandKwh + freightAllocation.freightElectricityDemandKwh,
    transportFodderDemandKg: transportAllocation.transportFodderDemandKg + freightAllocation.transportFodderDemandKg,
    unmetFreightTonneKm: freightAllocation.unmetFreightTonneKm,
    railFreightTonneKm: combinedRailFreightTonneKm,
    railUtilizationRatio: combinedRailUtilizationRatio,
    passengerUtilizationRatio,
    freightUtilizationRatio,
    weightedUtilizationRatio,
    railPassengerCapacityKm,
    railFreightCapacityTonneKm,
    railFreightCapturedTonneKm: combinedRailFreightTonneKm,
    heavyTruckTonneKm: freightAllocation.dieselRoadFreightTonneKm,
    heavyTruckTonneKmAvoidedByRail: freightAllocation.heavyTruckTonneKmAvoidedByRail,
    freightDemandByCommodity: freightDemand.freightDemandByCommodity,
    freightAllocationByCommodity: {
      road: freightAllocation.roadFreightTonneKmByCommodity,
      rail: freightAllocation.railFreightTonneKmByCommodity,
      local: freightAllocation.localFreightTonneKmByCommodity,
      unmet: freightAllocation.unmetFreightTonneKmByCommodity
    },
    freightDieselDemandLitre: freightAllocation.freightDieselDemandLitre,
    freightElectricityDemandKwh: freightAllocation.freightElectricityDemandKwh,
    freightHandlingLabourDays: freightAllocation.freightHandlingLabourDays,
    freightSpoilageLossTonnes: freightAllocation.freightSpoilageLossTonnes,
    freightServiceReliability: freightAllocation.freightServiceReliability,
    roadFreightAvoidedTonneKm: freightAllocation.roadFreightAvoidedTonneKm
  };
  combinedTransport.transportFuelStress = clamp(
    (combinedTransport.transportFuelStress ?? 0) * 0.6
      + safeDivide(freightAllocation.unmetFreightTonneKm, Math.max(1, freightDemand.totalFreightTonneKm), 0) * 0.2
      + safeDivide(freightAllocation.freightDieselDemandLitre * (1 - dieselAvailability), Math.max(1, freightAllocation.freightDieselDemandLitre), 0) * 0.2,
    0,
    1
  );

  const labour = allocateLabour(world, production, {
    dieselAvailability,
    constants,
    transportLabourDemandDays: combinedTransport.transportLabourDemandDays + freightAllocation.freightHandlingLabourDays
  });

  const productionConstants = constants.production ?? {};
  const energyConstraintBase = productionConstants.energyConstraintBase ?? 0.65;
  const energyConstraintDieselWeight = productionConstants.energyConstraintDieselWeight ?? 0.35;
  const energyConstraintMin = productionConstants.energyConstraintMin ?? 0.45;

  const energyConstraintFactor = clamp(energyConstraintBase + dieselAvailability * energyConstraintDieselWeight, energyConstraintMin, 1);
  const effectiveProducedCalories = production.producedCalories * labour.foodHarvestFactor * energyConstraintFactor;

  for (const patch of world.patches) {
    patch.metrics = {
      ...patch.metrics,
      producedCalories: patch.metrics.producedCalories * labour.foodHarvestFactor * energyConstraintFactor,
      labourDeficitDays: Math.max(0, patch.metrics.labourDemandFoodDays * (1 - labour.foodHarvestFactor))
    };
  }

  const previousAverageRent = world.metricsByYear.at(-1)?.averageRent ?? null;
  const housing = updateHousingMarket(world, {
    ...transport,
    constants
  });
  const averageRentGrowthRate = previousAverageRent && previousAverageRent > 0
    ? (housing.averageRent - previousAverageRent) / previousAverageRent
    : 0;

  const consumption = applyHouseholdConsumption(world, scenario, {
    constants,
    effectiveProducedCalories,
    producedWoodKg: production.producedWoodKg
  });

  const energy = calculateEnergyBalance(world, {
    constants,
    adaptation: adaptationState,
    producedWoodKg: production.producedWoodKg,
    producedFodderKg: production.producedFodderKg,
    averageFreightCost: transport.averageFreightCost,
    dieselAvailability,
    transport: combinedTransport
  });

  const transportSystemStress = clamp(
    transport.transportStress * 0.45 + combinedTransport.transportFuelStress * 0.55,
    0,
    1
  );

  const stress = calculateHouseholdStress(world, scenario, {
    constants,
    localFoodDeficitPressure: consumption.localFoodDeficitPressure,
    localFoodCoverageRatio: consumption.localFoodCoverageRatio,
    fuelDeficitPressure: consumption.fuelDeficitPressure,
    transportSystemStress,
    energy
  });

  const infra = applyInfrastructureDecay(world, {
    constants,
    suppliedMaintenanceDays: labour.suppliedMaintenanceDays,
    roadMaintenanceBudget: roadMaintenanceBudgetScale,
    preferredInfrastructureTypes: adaptationState.preferredInfrastructureTypes
  });

  const roadMaintenance = applyRoadMaintenance(world, {
    constants,
    heavyTruckTonneKm: combinedTransport.heavyTruckTonneKm,
    vehicleKm: combinedTransport.vehicleKm,
    roadMaintenanceBudgetScale,
    previousRoadBacklogMoney: world.metricsByYear.at(-1)?.roadMaintenanceBacklogMoney ?? 0
  });

  const railMaintenance = applyRailMaintenance(world, {
    constants,
    railEnabled: combinedTransport.railEnabled,
    railPassengerKm: combinedRailPassengerKm,
    railFreightTonneKm: combinedRailFreightTonneKm,
    railTrainKm: combinedTransport.railTrainKm,
    railMaintenanceBudgetScale: adaptationState.rail.railMaintenanceBudgetScale,
    previousRailBacklogMoney: world.metricsByYear.at(-1)?.railMaintenanceBacklogMoney ?? 0
  });

  const networkCosts = calculateNetworkCosts({
    roadMaintenanceDemandMoney: roadMaintenance.roadMaintenanceDemandMoney,
    railMaintenanceDemandMoney: railMaintenance.railMaintenanceDemandMoney,
    totalPassengerKmDemand: combinedTransport.totalPassengerKmDemand,
    totalFreightTonneKmDemand: combinedTransport.totalFreightTonneKmDemand,
    railPassengerKm: combinedRailPassengerKm,
    railFreightTonneKm: combinedRailFreightTonneKm,
    heavyTruckTonneKm: combinedTransport.heavyTruckTonneKm
  });

  const transportEconomics = calculateTransportEconomics(world, {
    constants,
    totalPassengerKmDemand: combinedTransport.totalPassengerKmDemand,
    railElectrifiedShare: combinedTransport.railElectrifiedShare,
    railPassengerKm: combinedRailPassengerKm,
    railFreightTonneKm: combinedRailFreightTonneKm,
    railUtilizationRatio: combinedRailUtilizationRatio,
    railMaintenanceDemandMoney: railMaintenance.railMaintenanceDemandMoney,
    railEnabled: combinedTransport.railEnabled,
    householdsWithViableRailAlternative: combinedTransport.householdsWithViableRailAlternative,
    householdsCarDependentNoAlternative: combinedTransport.householdsCarDependentNoAlternative,
    fuelPriceInducedRailPassengerKm: combinedTransport.fuelPriceInducedRailPassengerKm,
    fuelPriceInducedBusPassengerKm: combinedTransport.fuelPriceInducedBusPassengerKm,
    freightDieselDemandLitre: combinedTransport.freightDieselDemandLitre,
    freightSpoilageLossTonnes: combinedTransport.freightSpoilageLossTonnes,
    railFreightCapturedTonneKm: combinedTransport.railFreightCapturedTonneKm,
    freightDemand: freightDemand,
    freightAllocation: freightAllocation,
    ...networkCosts
  });

  const breakEvenDiagnostics = calculateBreakEvenDiagnostics({
    ...transportEconomics,
    railPassengerKm: combinedRailPassengerKm,
    railFreightTonneKm: combinedRailFreightTonneKm,
    railPassengerCapacityKm,
    railFreightCapacityTonneKm,
    weightedUtilizationRatio
  });

  const realEstate = updateRealEstateValues(world, {
    averageCommuteCost: transport.averageCommuteCost,
    rentPressure: housing.rentPressure,
    energy,
    transport: combinedTransport,
    roadMaintenance,
    railMaintenance,
    transportEconomics
  });

  const deficitYears = consecutiveFoodDeficitYears(world) + (consumption.foodSurplusCalories < 0 ? 1 : 0);

  const population = updatePopulationDynamics(world, {
    constants,
    populationPolicy: scenario.populationPolicy,
    localFoodCoverageRatio: consumption.localFoodCoverageRatio,
    consecutiveFoodDeficitYears: deficitYears,
    housingVacancyRate: housing.housingVacancyRate,
    ruralOpportunityBoost: adaptationState.ruralOpportunityBoost
  });

  const labourUnmetTotalDays = Math.max(0, labour.totalLabourDemandDays - labour.labourAvailableDays);

  const sanityResult = evaluateUnitSanity({
    ...transportEconomics,
    ...breakEvenDiagnostics,
    railPassengerCapacityKm,
    railFreightCapacityTonneKm,
    roadMaintenanceBacklogMoney: roadMaintenance.roadMaintenanceBacklogMoney,
    roadMaintenanceDemandMoney: roadMaintenance.roadMaintenanceDemandMoney,
    localFoodCoverageRatio: consumption.localFoodCoverageRatio,
    netMigration: population.netMigration,
    unmetPassengerKm: combinedTransport.unmetPassengerKm,
    totalPassengerKmDemand: combinedTransport.totalPassengerKmDemand,
    unmetFreightTonneKm: combinedTransport.unmetFreightTonneKm,
    totalFreightTonneKmDemand: combinedTransport.totalFreightTonneKmDemand,
    electricityDeficitKwh: energy.electricityDeficitKwh,
    electricityDemandKwh: energy.electricityDemandKwh,
    heatingEnergyDeficitKwh: energy.heatingEnergyDeficitKwh,
    heatDemandKwh: energy.heatDemandKwh,
    averageRent: housing.averageRent,
    previousAverageRent,
    averageRentGrowthRate,
    housingVacancyRate: housing.housingVacancyRate,
    households: housing.households,
    dwellingUnits: housing.dwellingUnits,
    valueToMonthlyRentRatio: housing.valueToMonthlyRentRatio,
    priceToAnnualRentRatio: housing.priceToAnnualRentRatio,
    valueToRentRatio: housing.valueToRentRatio,
    hasRentGrowthOverride: Boolean(scenario?.constants?.housing?.maxAnnualRentGrowthRate)
  }, constants);

  const metrics = calculateSettlementMetrics(world, scenario, year, {
    producedCalories: effectiveProducedCalories,
    consumedCalories: consumption.consumedCalories,
    foodSurplusCalories: consumption.foodSurplusCalories,
    percentAvailableLabourDemandedByFood: labour.percentAvailableLabourDemandedByFood,
    percentAvailableLabourSuppliedToFood: labour.percentAvailableLabourSuppliedToFood,
    percentTotalLabourDemandFromFood: labour.percentTotalLabourDemandFromFood,
    foodLabourDemandDays: labour.foodLabourDemandDays,
    foodLabourSuppliedDays: labour.foodLabourSuppliedDays,
    foodLabourUnmetDays: labour.foodLabourUnmetDays,
    labourAvailableDays: labour.labourAvailableDays,
    labourDemandFuelDays: labour.labourDemandFuelDays,
    labourDemandMaintenanceDays: labour.labourDemandMaintenanceDays,
    labourDemandCareDays: labour.labourDemandCareDays,
    labourDemandTransportDays: labour.labourDemandTransportDays,
    labourUnmetTransportDays: labour.labourUnmetTransportDays,
    labourSuppliedFuelDays: labour.suppliedFuelDays,
    labourSuppliedMaintenanceDays: labour.suppliedMaintenanceDays,
    labourSuppliedCareDays: labour.suppliedCareDays,
    labourSuppliedTransportDays: labour.suppliedTransportDays,
    labourUnmetTotalDays,
    labourDeficitDays: labour.labourDeficitDays,
    labourCoverageRatio: labour.labourCoverageRatio,
    maintenanceCoverageRatio: infra.maintenanceCoverageRatio,
    heatDemandKwh: energy.heatDemandKwh,
    woodHeatSupplyKwh: energy.woodHeatSupplyKwh,
    electricHeatSupplyKwh: energy.electricHeatSupplyKwh,
    fossilHeatSupplyKwh: energy.fossilHeatSupplyKwh,
    heatingEnergyDeficitKwh: energy.heatingEnergyDeficitKwh,
    transportFuelDemandLitre: energy.transportFuelDemandLitre,
    transportFuelAvailableLitre: energy.transportFuelAvailableLitre,
    transportFuelDeficitLitre: energy.transportFuelDeficitLitre,
    transportDieselDemandLitre: energy.transportDieselDemandLitre,
    transportDieselAvailableLitre: energy.transportDieselAvailableLitre,
    transportDieselDeficitLitre: energy.transportDieselDeficitLitre,
    transportElectricityDemandKwh: energy.transportElectricityDemandKwh,
    transportFodderDemandKg: energy.transportFodderDemandKg,
    transportFodderDeficitKg: energy.transportFodderDeficitKg,
    transportLabourDemandDays: energy.transportLabourDemandDays,
    unmetPassengerKm: energy.unmetPassengerKm,
    unmetFreightTonneKm: energy.unmetFreightTonneKm,
    electricityDemandKwh: energy.electricityDemandKwh,
    electricityAvailableKwh: energy.electricityAvailableKwh,
    electricityDeficitKwh: energy.electricityDeficitKwh,
    biomassHarvestKg: energy.biomassHarvestKg,
    sustainableBiomassHarvestKg: energy.sustainableBiomassHarvestKg,
    fodderProducedKg: energy.fodderProducedKg,
    fodderDemandKg: energy.fodderDemandKg,
    fodderDeficitKg: energy.fodderDeficitKg,
    totalPassengerKmDemand: energy.totalPassengerKmDemand,
    totalFreightTonneKmDemand: energy.totalFreightTonneKmDemand,
    localizedPassengerKmAvoided: energy.localizedPassengerKmAvoided,
    localizedFreightTonneKmAvoided: energy.localizedFreightTonneKmAvoided,
    dieselPassengerKm: energy.dieselPassengerKm,
    dieselFreightTonneKm: energy.dieselFreightTonneKm,
    nonDieselPassengerKm: energy.nonDieselPassengerKm,
    nonDieselFreightTonneKm: energy.nonDieselFreightTonneKm,
    railPassengerKm: combinedRailPassengerKm,
    railFreightTonneKm: combinedRailFreightTonneKm,
    railPassengerCapacityKm,
    railFreightCapacityTonneKm,
    passengerUtilizationRatio,
    freightUtilizationRatio,
    weightedUtilizationRatio,
    railDieselDemandLitre: combinedTransport.railDieselDemandLitre,
    railElectricityDemandKwh: combinedTransport.railElectricityDemandKwh,
    railUnservedDemandDueToAccess: combinedTransport.railUnservedDemandDueToAccess,
    railUnservedDemandDueToCondition: combinedTransport.railUnservedDemandDueToCondition,
    railUtilizationRatio: combinedRailUtilizationRatio,
    railServiceReliability: railMaintenance.railServiceReliability,
    railEnabled: combinedTransport.railEnabled,
    railElectrified: combinedTransport.railElectrified,
    railEligibleFoodFreightTonneKm: freightAllocation.railEligibleFreightByCommodity?.foodStaples ?? 0,
    railEligibleWoodFreightTonneKm: freightAllocation.railEligibleFreightByCommodity?.woodFuel ?? 0,
    railEligibleMaterialsFreightTonneKm: (freightAllocation.railEligibleFreightByCommodity?.repairGoods ?? 0) + (freightAllocation.railEligibleFreightByCommodity?.constructionMaterials ?? 0),
    railEligibleMarketFreightTonneKm: freightAllocation.railEligibleFreightByCommodity?.freshFood ?? 0,
    railFreightCapturedTonneKm: combinedRailFreightTonneKm,
    totalFreightTonnes: freightDemand.totalFreightTonnes,
    essentialFreightTonneKm: freightDemand.essentialFreightTonneKm,
    localFreightTonneKm: freightDemand.localFreightTonneKm,
    longDistanceFreightTonneKm: freightDemand.longDistanceFreightTonneKm,
    avoidableFreightTonneKm: freightDemand.avoidableFreightTonneKm,
    freightDemandReducedByRepairReuse: freightDemand.freightDemandReducedByRepairReuse,
    freightDemandReducedByLocalProduction: freightDemand.freightDemandReducedByLocalProduction,
    freightDemandReducedByStorageProcessing: freightDemand.freightDemandReducedByStorageProcessing,
    freightDemandReducedByCompostLoop: freightDemand.freightDemandReducedByCompostLoop,
    roadFreightAvoidedTonneKm: freightAllocation.roadFreightAvoidedTonneKm,
    freightDieselDemandLitre: freightAllocation.freightDieselDemandLitre,
    freightElectricityDemandKwh: freightAllocation.freightElectricityDemandKwh,
    freightHandlingLabourDays: freightAllocation.freightHandlingLabourDays,
    freightSpoilageLossTonnes: freightAllocation.freightSpoilageLossTonnes,
    freightServiceReliability: freightAllocation.freightServiceReliability,
    catchmentPopulation: stationCatchments.catchmentPopulation,
    catchmentHouseholds: stationCatchments.catchmentHouseholds,
    catchmentJobs: stationCatchments.catchmentJobs,
    catchmentServiceCapacity: stationCatchments.catchmentServiceCapacity,
    catchmentFreightTonnePotential: stationCatchments.catchmentFreightTonnePotential,
    catchmentProductiveLandHa: stationCatchments.catchmentProductiveLandHa,
    catchmentWalkAccessShare: stationCatchments.catchmentWalkAccessShare,
    catchmentBicycleAccessShare: stationCatchments.catchmentBicycleAccessShare,
    householdsWithViableRailAlternative: stationCatchments.householdsWithViableRailAlternative,
    householdsCarDependentNoAlternative: stationCatchments.householdsCarDependentNoAlternative,
    stationAreaPopulationAdded: corridorTransition.stationAreaPopulationAdded,
    stationAreaHousingUnitsAdded: corridorTransition.stationAreaHousingUnitsAdded,
    stationAreaJobsAdded: corridorTransition.stationAreaJobsAdded,
    stationAreaServiceCapacityAdded: corridorTransition.stationAreaServiceCapacityAdded,
    stationAreaFreightPotentialAdded: corridorTransition.stationAreaFreightPotentialAdded,
    hectaresTransitionedNearStations: corridorTransition.hectaresTransitionedNearStations,
    roadMaintenanceDemandMoney: roadMaintenance.roadMaintenanceDemandMoney,
    roadMaintenanceBudgetMoney: roadMaintenance.roadMaintenanceBudgetMoney,
    roadMaintenanceBacklogMoney: roadMaintenance.roadMaintenanceBacklogMoney,
    roadMaintenanceCoverageRatio: roadMaintenance.roadMaintenanceCoverageRatio,
    roadConditionAverage: roadMaintenance.roadConditionAverage,
    roadConditionAverageByType: roadMaintenance.roadConditionAverageByType,
    roadMaintenanceDemandLabourDays: roadMaintenance.roadMaintenanceDemandLabourDays,
    roadMaintenanceDemandMaterialsKg: roadMaintenance.roadMaintenanceDemandMaterialsKg,
    railMaintenanceDemandMoney: railMaintenance.railMaintenanceDemandMoney,
    railMaintenanceBudgetMoney: railMaintenance.railMaintenanceBudgetMoney,
    railMaintenanceBacklogMoney: railMaintenance.railMaintenanceBacklogMoney,
    railMaintenanceCoverageRatio: railMaintenance.railMaintenanceCoverageRatio,
    railConditionAverage: railMaintenance.railConditionAverage,
    railMaintenanceDemandLabourDays: railMaintenance.railMaintenanceDemandLabourDays,
    railMaintenanceDemandMaterialsKg: railMaintenance.railMaintenanceDemandMaterialsKg,
    roadCostPerPassengerKm: networkCosts.roadCostPerPassengerKm,
    roadCostPerTonneKm: networkCosts.roadCostPerTonneKm,
    railCostPerPassengerKm: networkCosts.railCostPerPassengerKm,
    railCostPerTonneKm: networkCosts.railCostPerTonneKm,
    avoidedRoadMaintenanceFromRailShift: networkCosts.avoidedRoadMaintenanceFromRailShift,
    heavyTruckTonneKmAvoidedByRail: networkCosts.heavyTruckTonneKmAvoidedByRail,
    heavyTruckTonneKm: combinedTransport.heavyTruckTonneKm,
    vehicleKm: combinedTransport.vehicleKm,
    privateIceCostPerKm: transportEconomics.privateIceCostPerKm,
    publicTransitCostPerPassengerKm: transportEconomics.publicTransitCostPerPassengerKm,
    railEconomicsCostPerPassengerKm: transportEconomics.railCostPerPassengerKm,
    railPassengerCostPerKmAtUtilization: transportEconomics.railPassengerCostPerKmAtUtilization,
    railFreightCostPerTonneKmAtUtilization: transportEconomics.railFreightCostPerTonneKmAtUtilization,
    railFixedCostAnnual: transportEconomics.railFixedCostAnnual,
    railVariableCostAnnual: transportEconomics.railVariableCostAnnual,
    railBreakEvenUtilizationRatio: transportEconomics.railBreakEvenUtilizationRatio,
    railCostRecoveryRatio: transportEconomics.railCostRecoveryRatioDirect,
    railCostRecoveryRatioDirect: transportEconomics.railCostRecoveryRatioDirect,
    railCostRecoveryRatioWithAvoidedCosts: transportEconomics.railCostRecoveryRatioWithAvoidedCosts,
    railPublicSubsidyRequired: transportEconomics.railPublicSubsidyRequired,
    railPassengerRevenueEquivalent: transportEconomics.railPassengerRevenueEquivalent,
    railFreightRevenueEquivalent: transportEconomics.railFreightRevenueEquivalent,
    railAvoidedRoadMaintenanceValue: transportEconomics.railAvoidedRoadMaintenanceValue,
    railAvoidedDieselValue: transportEconomics.railAvoidedDieselValue,
    railSpoilageReductionValue: transportEconomics.railSpoilageReductionValue,
    railTotalBenefitEquivalent: transportEconomics.railTotalBenefitEquivalent,
    railTotalCost: transportEconomics.railTotalCost,
    railNetCostAfterBenefits: transportEconomics.railNetCostAfterBenefits,
    railBenefitCostRatio: transportEconomics.railBenefitCostRatio,
    railBreakEvenFreightTonneKm: transportEconomics.railBreakEvenFreightTonneKm,
    railBreakEvenPassengerKm: transportEconomics.railBreakEvenPassengerKm,
    railBreakEvenMixedUtilization: transportEconomics.railBreakEvenMixedUtilization,
    railCostPerRiderYear: transportEconomics.railCostPerRiderYear,
    annualFixedCost: breakEvenDiagnostics.annualFixedCost,
    annualVariableCost: breakEvenDiagnostics.annualVariableCost,
    directRevenuePerPassengerKm: breakEvenDiagnostics.directRevenuePerPassengerKm,
    directRevenuePerFreightTonneKm: breakEvenDiagnostics.directRevenuePerFreightTonneKm,
    avoidedCostPerPassengerKm: breakEvenDiagnostics.avoidedCostPerPassengerKm,
    avoidedCostPerFreightTonneKm: breakEvenDiagnostics.avoidedCostPerFreightTonneKm,
    effectiveBenefitPerPassengerKm: breakEvenDiagnostics.effectiveBenefitPerPassengerKm,
    effectiveBenefitPerFreightTonneKm: breakEvenDiagnostics.effectiveBenefitPerFreightTonneKm,
    requiredPassengerKmIfPassengerOnly: breakEvenDiagnostics.requiredPassengerKmIfPassengerOnly,
    requiredFreightTonneKmIfFreightOnly: breakEvenDiagnostics.requiredFreightTonneKmIfFreightOnly,
    requiredMixedUtilization: breakEvenDiagnostics.requiredMixedUtilization,
    currentPassengerKm: breakEvenDiagnostics.currentPassengerKm,
    currentFreightTonneKm: breakEvenDiagnostics.currentFreightTonneKm,
    passengerScaleMultiplierNeeded: breakEvenDiagnostics.passengerScaleMultiplierNeeded,
    freightScaleMultiplierNeeded: breakEvenDiagnostics.freightScaleMultiplierNeeded,
    mixedScaleMultiplierNeeded: breakEvenDiagnostics.mixedScaleMultiplierNeeded,
    sanityWarnings: sanityResult.warnings,
    warningCount: sanityResult.warningCount,
    criticalWarningCount: sanityResult.criticalWarningCount,
    calibrationProfile: scenario.calibrationProfile ?? 'baseline',
    scenarioScale: scenario.scaleVariant ?? 'medium',
    fuelPriceInducedRailPassengerKm: transportEconomics.fuelPriceInducedRailPassengerKm,
    fuelPriceInducedBusPassengerKm: transportEconomics.fuelPriceInducedBusPassengerKm,
    privateVehicleCostBurdenWithAlternative: transportEconomics.privateVehicleCostBurdenWithAlternative,
    privateVehicleCostBurdenWithoutAlternative: transportEconomics.privateVehicleCostBurdenWithoutAlternative,
    gasolineBreakEvenPriceForTransitPerLitre: transportEconomics.gasolineBreakEvenPriceForTransitPerLitre,
    dieselBreakEvenPriceForRailPerLitre: transportEconomics.dieselBreakEvenPriceForRailPerLitre,
    householdAnnualPrivateVehicleCost: transportEconomics.householdAnnualPrivateVehicleCost,
    householdAnnualTransitEquivalentCost: transportEconomics.householdAnnualTransitEquivalentCost,
    averageCarDependenceCostBurden: transportEconomics.averageCarDependenceCostBurden,
    averageHeatingFuelStress: stress.averageHeatingFuelStress,
    averageTransportFuelStress: stress.averageTransportFuelStress,
    averageElectricityStress: stress.averageElectricityStress,
    averageTotalFuelStress: stress.averageTotalFuelStress,
    fuelDeficitKg: consumption.fuelDeficitKg,
    localFoodCoverageRatio: consumption.localFoodCoverageRatio,
    foodDeficitPerPerson: consumption.foodDeficitPerPerson,
    averageFoodStress: stress.averageFoodStress,
    averageFuelStress: stress.averageFuelStress,
    averageHousingStress: stress.averageHousingStress,
    averageTransportStress: stress.averageTransportStress,
    averageMigrationPressure: stress.averageMigrationPressure,
    averageTotalStress: stress.averageTotalStress,
    averageHouseholdStress: stress.averageHouseholdStress,
    averageCommuteCost: transport.averageCommuteCost,
    averageFreightCost: transport.averageFreightCost,
    rentPressure: housing.rentPressure,
    averageRent: housing.averageRent,
    baseAverageRent: housing.baseAverageRent,
    averageAnnualHousingCost: housing.averageAnnualHousingCost,
    averageHouseholdIncome: housing.averageHouseholdIncome,
    averageHousingCostBurden: housing.averageHousingCostBurden,
    householdsHousingStressed: housing.householdsHousingStressed,
    householdsExceedingUnits: housing.householdsExceedingUnits,
    households: housing.households,
    dwellingUnits: housing.dwellingUnits,
    occupiedUnits: housing.occupiedUnits,
    vacantUnits: housing.vacantUnits,
    valueToMonthlyRentRatio: housing.valueToMonthlyRentRatio,
    priceToAnnualRentRatio: housing.priceToAnnualRentRatio,
    valueToRentRatio: housing.valueToRentRatio,
    averageRentGrowthRate,
    housingVacancyRate: housing.housingVacancyRate,
    averageEstimatedValue: housing.averageEstimatedValue,
    averageEstimatedBuildingValue: realEstate.averageEstimatedBuildingValue,
    populationUrban: population.populationUrban,
    populationRural: population.populationRural,
    populationTotal: population.populationTotal,
    startingPopulation: population.startingPopulation,
    births: population.births,
    deaths: population.deaths,
    urbanToRuralMoves: population.urbanToRuralMoves,
    ruralToUrbanMoves: population.ruralToUrbanMoves,
    inMigration: population.inMigration,
    outMigration: population.outMigration,
    netMigration: population.netMigration,
    endingPopulation: population.endingPopulation,
    outMigrationFoodStress: population.outMigrationFoodStress,
    outMigrationFuelStress: population.outMigrationFuelStress,
    outMigrationHousingStress: population.outMigrationHousingStress,
    outMigrationTransportStress: population.outMigrationTransportStress,
    infrastructureAverageCondition: infra.infrastructureAverageCondition
  });

  world.year = year;
  world.metricsByYear.push(metrics);
  world.stationCatchments = stationCatchments;
  world.corridorTransition = corridorTransition;

  const latestRailMetrics = {
    railUtilizationRatio: metrics.railUtilizationRatio,
    passengerUtilizationRatio: metrics.passengerUtilizationRatio,
    freightUtilizationRatio: metrics.freightUtilizationRatio,
    weightedUtilizationRatio: metrics.weightedUtilizationRatio,
    railPassengerCapacityKm: metrics.railPassengerCapacityKm,
    railFreightCapacityTonneKm: metrics.railFreightCapacityTonneKm,
    railBreakEvenUtilizationRatio: metrics.railBreakEvenUtilizationRatio,
    railBreakEvenMixedUtilization: metrics.railBreakEvenMixedUtilization,
    railCostPerPassengerKm: metrics.railPassengerCostPerKmAtUtilization,
    railCostPerTonneKm: metrics.railFreightCostPerTonneKmAtUtilization,
    heavyTruckTonneKmAvoidedByRail: metrics.heavyTruckTonneKmAvoidedByRail,
    avoidedRoadMaintenanceFromRailShift: metrics.avoidedRoadMaintenanceFromRailShift,
    railBenefitCostRatio: metrics.railBenefitCostRatio,
    railCostRecoveryRatioWithAvoidedCosts: metrics.railCostRecoveryRatioWithAvoidedCosts,
    railNetCostAfterBenefits: metrics.railNetCostAfterBenefits
  };
  for (const network of world.networks) {
    network.metrics = {
      ...(network.metrics ?? {}),
      ...latestRailMetrics
    };
  }

  const market = world.markets[0];
  if (market) {
    market.demand.foodCalories = consumption.consumedCalories;
    market.supply.foodCalories = effectiveProducedCalories;
    market.demand.housingUnits = housing.housingDemand;
    market.supply.housingUnits = housing.vacantDwellingUnits;
    market.demand.labourDays = labour.totalLabourDemandDays;
    market.supply.labourDays = labour.labourAvailableDays;
  }

  return {
    ...metrics,
    constants,
    energy,
    transportStress: transportSystemStress,
    roadMaintenanceBacklog: roadMaintenance.roadMaintenanceBacklogMoney,
    maintenanceDemandMoney: infra.maintenanceDemandMoney,
    maintenanceBacklog: infra.maintenanceBacklog,
    householdsFoodSecure: population.householdsFoodSecure,
    householdsHousingSecure: population.householdsHousingSecure,
    spoilageRate: consumption.spoilageRate,
    consecutiveFoodDeficitYears: deficitYears,
    railElectrification
  };
}
