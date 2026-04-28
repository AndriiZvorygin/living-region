// SPDX-License-Identifier: AGPL-3.0-or-later
import { average, clamp, clamp01, safeDivide } from '../util/math.mjs';
import { getTransportModes, infrastructureAccessProfile, modeAvailability } from './transport_modes.mjs';

const RAIL_TYPES = new Set(['traditionalRail', 'electrifiedRail']);

function normalizeShares(shares) {
  const entries = Object.entries(shares).filter(([, value]) => value > 0);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (total <= 0) {
    return Object.fromEntries(entries.map(([key]) => [key, 0]));
  }
  return Object.fromEntries(entries.map(([key, value]) => [key, value / total]));
}

function addModeFlow(flows, modeName, passengerKm, freightTonneKm) {
  const current = flows[modeName] ?? { passengerKm: 0, freightTonneKm: 0 };
  flows[modeName] = {
    passengerKm: current.passengerKm + passengerKm,
    freightTonneKm: current.freightTonneKm + freightTonneKm
  };
}

function getRailSegments(world) {
  return world.networks.flatMap((network) => network.segments ?? []).filter((segment) => RAIL_TYPES.has(segment.type));
}

function railContext(world, scenario, transportDemand, context) {
  const transportConstants = context.constants?.transport ?? {};
  const corridorConstants = context.constants?.railCorridor ?? {};
  const railScenario = scenario.rail ?? {};
  const adaptation = context.adaptation ?? {};
  const stationCatchments = context.stationCatchments ?? {};

  const segments = getRailSegments(world);
  const railEnabled = railScenario.enableRail ?? false;
  const railElectrified = railScenario.electrifyRail ?? false;

  const railLengthKm = segments.reduce((sum, segment) => sum + segment.lengthKm, 0);
  const railConditionAverage = average(segments.map((segment) => segment.condition), railEnabled ? 0.62 : 0);
  const activeRightOfWayShare = segments.length > 0
    ? segments.filter((segment) => ['active', 'protected'].includes(segment.rightOfWayStatus)).length / segments.length
    : 0;

  const settlementAccess = average(world.settlements.map((item) => item.metrics?.railOrWaterFreightAccess ?? 0.25), 0.25);
  const railServiceReliability = clamp01(
    railConditionAverage * 0.58
    + settlementAccess * 0.2
    + activeRightOfWayShare * 0.12
    + clamp01((stationCatchments.averageServiceFrequencyPerDay ?? 0) / Math.max(1, corridorConstants.maximumServiceFrequencyPerDay ?? 16)) * 0.1
  );

  const totalPassengerKmDemand = transportDemand.totalPassengerKmDemand;
  const totalFreightTonneKmDemand = transportDemand.totalFreightTonneKmDemand;
  const densityIndicator = safeDivide(totalPassengerKmDemand + totalFreightTonneKmDemand * 22, Math.max(1, railLengthKm), 0);

  const densityThreshold = transportConstants.railDemandDensityThreshold ?? 5_000;
  const minimumCondition = transportConstants.railMinimumConditionForService ?? 0.35;
  const minimumReliability = transportConstants.railMinimumReliabilityForService ?? 0.5;

  const minimumRailPassengerKmForBasicService = corridorConstants.minimumRailPassengerKmForBasicService ?? 14_000;
  const minimumRailFreightTonneKmForBasicService = corridorConstants.minimumRailFreightTonneKmForBasicService ?? 900;
  const minimumRailUtilizationForCostAdvantage = corridorConstants.minimumRailUtilizationForCostAdvantage ?? 0.12;
  const utilizationPassengerWeight = corridorConstants.utilizationPassengerWeight ?? 0.45;
  const utilizationFreightWeight = corridorConstants.utilizationFreightWeight ?? 0.55;
  const railFrequencyElasticity = corridorConstants.railFrequencyElasticity ?? 0.12;
  const stationAccessPenalty = corridorConstants.stationAccessPenalty ?? 0.45;
  const transferPenaltyFactor = corridorConstants.transferPenalty ?? 0.12;

  const minimumServiceFrequencyPerDay = corridorConstants.minimumServiceFrequencyPerDay ?? 1;
  const maximumServiceFrequencyPerDay = corridorConstants.maximumServiceFrequencyPerDay ?? 16;
  const serviceFrequency = clamp(
    stationCatchments.averageServiceFrequencyPerDay ?? minimumServiceFrequencyPerDay,
    minimumServiceFrequencyPerDay,
    maximumServiceFrequencyPerDay
  );

  const frequencyFactor = clamp01(
    safeDivide(serviceFrequency - minimumServiceFrequencyPerDay, maximumServiceFrequencyPerDay - minimumServiceFrequencyPerDay, 0)
      * railFrequencyElasticity * 4
      + 0.55
  );

  const stationAccess = clamp01(
    (stationCatchments.viableRailHouseholdShare ?? 0) * 0.52
    + (stationCatchments.catchmentWalkAccessShare ?? 0) * 0.22
    + (stationCatchments.catchmentBicycleAccessShare ?? 0) * 0.16
    + (adaptation.annualStationCatchmentBuildoutRate ?? 0) * 6
  );

  const transferPenalty = clamp01(
    safeDivide(stationCatchments.averageTransferCostPerPassenger ?? 0, 6, 0) * transferPenaltyFactor
      + (1 - stationAccess) * stationAccessPenalty
  );

  const dieselPrice = world.markets[0]?.prices?.dieselLitre ?? 1.6;
  const pricePressure = clamp01((dieselPrice - 1.4) / 1.5);

  const enabledByCondition = railEnabled && railConditionAverage >= minimumCondition && railServiceReliability >= minimumReliability;
  const enabledByDensity = densityIndicator >= densityThreshold;

  const catchmentPassengerPotential = (stationCatchments.catchmentPopulation ?? 0) * 290;
  const basePassengerShare = clamp(0.06 + (adaptation.annualRailServiceBuildoutRate ?? 0) * 8, 0, 0.45);
  const passengerFromDemand = totalPassengerKmDemand * basePassengerShare * stationAccess * frequencyFactor * (1 - transferPenalty * 0.6);
  const passengerFromCatchment = catchmentPassengerPotential * 0.35 * stationAccess * frequencyFactor;

  const householdsWithViableRailAlternative = stationCatchments.householdsWithViableRailAlternative ?? 0;
  const householdsCarDependentNoAlternative = stationCatchments.householdsCarDependentNoAlternative ?? world.households.length;

  const fuelPriceInducedRailPassengerKm = (passengerFromDemand + passengerFromCatchment)
    * pricePressure
    * stationAccess
    * (0.18 + safeDivide(householdsWithViableRailAlternative, Math.max(1, world.households.length), 0) * 0.25);

  const desiredPassengerKm = Math.max(0, passengerFromDemand + passengerFromCatchment + fuelPriceInducedRailPassengerKm);

  const freightAnchorStrength = clamp01(
    (stationCatchments.freightAnchorStrength ?? 0)
    + (adaptation.rail?.freightAnchorBuildoutLevel ?? adaptation.annualRailWaterFreightUseRate ?? 0) * 3
  );

  const railEligibleFoodFreightTonneKm = Math.min(
    totalFreightTonneKmDemand * 0.35,
    (stationCatchments.catchmentFoodFreightPotential ?? 0) * (0.55 + freightAnchorStrength * 0.55)
  );
  const railEligibleWoodFreightTonneKm = Math.min(
    totalFreightTonneKmDemand * 0.2,
    (stationCatchments.catchmentWoodFreightPotential ?? 0) * (0.45 + freightAnchorStrength * 0.6)
  );
  const railEligibleMaterialsFreightTonneKm = Math.min(
    totalFreightTonneKmDemand * 0.25,
    (stationCatchments.catchmentRepairGoodsPotential ?? 0) * (0.5 + freightAnchorStrength * 0.45)
  );
  const railEligibleMarketFreightTonneKm = Math.min(
    totalFreightTonneKmDemand * 0.2,
    (stationCatchments.catchmentFreightTonnePotential ?? 0) * (0.28 + freightAnchorStrength * 0.35)
  );

  const railEligibleTotalFreight = Math.max(
    0,
    railEligibleFoodFreightTonneKm + railEligibleWoodFreightTonneKm + railEligibleMaterialsFreightTonneKm + railEligibleMarketFreightTonneKm
  );

  const desiredFreightTonneKm = railEligibleTotalFreight
    * frequencyFactor
    * stationAccess
    * (0.4 + freightAnchorStrength * 0.7)
    * (1 - transferPenalty * 0.5);

  const meetsBasicServiceThreshold = desiredPassengerKm >= minimumRailPassengerKmForBasicService
    || desiredFreightTonneKm >= minimumRailFreightTonneKmForBasicService;

  const totalPassengerCapacity = segments.reduce((sum, segment) => sum + segment.capacityPassengerKmPerYear, 0);
  const totalFreightCapacity = segments.reduce((sum, segment) => sum + segment.capacityTonneKmPerYear, 0);

  const railUnservedDemandDueToAccess = (desiredPassengerKm + desiredFreightTonneKm) * (1 - stationAccess) * 0.42;
  const railUnservedDemandDueToCondition = (desiredPassengerKm + desiredFreightTonneKm) * (1 - railServiceReliability) * 0.4;

  const canServe = enabledByCondition && enabledByDensity && meetsBasicServiceThreshold;

  const grossPassengerTarget = canServe
    ? Math.max(0, desiredPassengerKm - railUnservedDemandDueToAccess * 0.55 - railUnservedDemandDueToCondition * 0.5)
    : 0;
  const grossFreightTarget = canServe
    ? Math.max(0, desiredFreightTonneKm - railUnservedDemandDueToAccess * 0.45 - railUnservedDemandDueToCondition * 0.5)
    : 0;

  const railPassengerKm = Math.min(grossPassengerTarget, totalPassengerCapacity);
  const railFreightTonneKm = Math.min(grossFreightTarget, totalFreightCapacity);

  const passengerUtilizationRatio = clamp01(safeDivide(railPassengerKm, Math.max(1, totalPassengerCapacity), 0));
  const freightUtilizationRatio = clamp01(safeDivide(railFreightTonneKm, Math.max(1, totalFreightCapacity), 0));
  const weightedUtilizationRatio = clamp01(
    passengerUtilizationRatio * utilizationPassengerWeight
    + freightUtilizationRatio * utilizationFreightWeight
  );
  const railUtilizationRatio = weightedUtilizationRatio;

  const electrifiedCapacityShare = railLengthKm > 0
    ? safeDivide(segments.filter((segment) => segment.electrified).reduce((sum, segment) => sum + segment.lengthKm, 0), railLengthKm, 0)
    : 0;
  const effectiveElectrifiedShare = railElectrified ? electrifiedCapacityShare : 0;

  const railActiveForCostAdvantage = railUtilizationRatio >= minimumRailUtilizationForCostAdvantage;

  return {
    railEnabled,
    railElectrified,
    railServiceReliability,
    railConditionAverage,
    railPassengerKm,
    railFreightTonneKm,
    railUnservedDemandDueToAccess,
    railUnservedDemandDueToCondition,
    railUtilizationRatio,
    passengerUtilizationRatio,
    freightUtilizationRatio,
    weightedUtilizationRatio,
    railElectrifiedShare: effectiveElectrifiedShare,
    railLengthKm,
    densityIndicator,
    densityThreshold,
    totalPassengerCapacity,
    totalFreightCapacity,
    serviceFrequency,
    stationAccess,
    transferPenalty,
    railActiveForCostAdvantage,
    minimumRailUtilizationForCostAdvantage,
    minimumRailPassengerKmForBasicService,
    minimumRailFreightTonneKmForBasicService,
    railEligibleFoodFreightTonneKm,
    railEligibleWoodFreightTonneKm,
    railEligibleMaterialsFreightTonneKm,
    railEligibleMarketFreightTonneKm,
    railFreightCapturedTonneKm: railFreightTonneKm,
    fuelPriceInducedRailPassengerKm,
    householdsWithViableRailAlternative,
    householdsCarDependentNoAlternative,
    catchmentPopulation: stationCatchments.catchmentPopulation ?? 0,
    catchmentHouseholds: stationCatchments.catchmentHouseholds ?? 0,
    catchmentJobs: stationCatchments.catchmentJobs ?? 0,
    catchmentServiceCapacity: stationCatchments.catchmentServiceCapacity ?? 0,
    catchmentFreightTonnePotential: stationCatchments.catchmentFreightTonnePotential ?? 0,
    catchmentProductiveLandHa: stationCatchments.catchmentProductiveLandHa ?? 0,
    catchmentWalkAccessShare: stationCatchments.catchmentWalkAccessShare ?? 0,
    catchmentBicycleAccessShare: stationCatchments.catchmentBicycleAccessShare ?? 0
  };
}

export function allocateTransport(world, scenario, transportDemand, context) {
  const constants = context.constants ?? {};
  const transportConstants = constants.transport ?? {};
  const adaptation = context.adaptation ?? {};
  const energyConstants = constants.energy ?? {};
  const modes = getTransportModes(constants);

  const annualModeShiftToWalkBikeRate = adaptation.annualModeShiftToWalkBikeRate ?? 0;
  const annualModeShiftToBusRate = adaptation.annualModeShiftToBusRate ?? 0;
  const annualDraftTransportAdoptionRate = adaptation.annualDraftTransportAdoptionRate ?? 0;
  const annualRailWaterFreightUseRate = adaptation.annualRailWaterFreightUseRate ?? 0;
  const privateCarDependenceReductionRate = adaptation.privateCarDependenceReductionRate ?? 0;
  const transportDemandReductionRate = adaptation.transportDemandReductionRate ?? 0;
  const localTripSubstitutionRate = adaptation.localTripSubstitutionRate ?? 0;
  const freightPriorityForFoodAndFuel = adaptation.freightPriorityForFoodAndFuel ?? false;

  const essentialPassengerShare = transportConstants.essentialPassengerShare ?? 0.62;
  const essentialFreightShare = transportConstants.essentialFreightShare ?? 0.74;
  const dieselPriorityFreightShare = transportConstants.dieselPriorityFreightShare ?? 0.65;
  const dieselPriorityBoostForEssentialFreight = transportConstants.dieselPriorityBoostForEssentialFreight ?? 0.2;

  const infrastructureAccess = infrastructureAccessProfile(world);
  const avgRoadCondition = transportDemand.roadCondition ?? 0.7;
  const avgTripDistanceKm = average(world.settlements.map((item) => item.metrics?.averageTripDistanceKm ?? 4), 4);

  const passengerDemandBase = transportDemand.totalPassengerKmDemand * Math.max(0.5, 1 - transportDemandReductionRate * 0.8 - localTripSubstitutionRate * 0.6);
  const freightDemandBase = transportDemand.totalFreightTonneKmDemand * Math.max(0.55, 1 - transportDemandReductionRate * 0.4);

  const rail = railContext(
    world,
    scenario,
    {
      ...transportDemand,
      totalPassengerKmDemand: passengerDemandBase,
      totalFreightTonneKmDemand: freightDemandBase
    },
    {
      constants,
      adaptation,
      stationCatchments: context.stationCatchments
    }
  );

  const railPassengerPerTrainKm = transportConstants.railPassengerPerTrainKm ?? 180;
  const railTonnesPerTrainKm = transportConstants.railTonnesPerTrainKm ?? 700;

  const railTrainKmPassenger = safeDivide(rail.railPassengerKm, Math.max(1, railPassengerPerTrainKm), 0);
  const railTrainKmFreight = safeDivide(rail.railFreightTonneKm, Math.max(1, railTonnesPerTrainKm), 0);
  const railTrainKm = railTrainKmPassenger + railTrainKmFreight;

  const railMode = modes.rail ?? { dieselLitrePerPassengerKm: 0.018, dieselLitrePerTonneKm: 0.028 };
  const railDieselDemandLitre = (rail.railPassengerKm * (railMode.dieselLitrePerPassengerKm ?? 0.018)
    + rail.railFreightTonneKm * (railMode.dieselLitrePerTonneKm ?? 0.028))
    * (1 - rail.railElectrifiedShare);
  const railElectricityDemandKwh = (railTrainKm * average(getRailSegments(world).map((segment) => segment.electrificationEnergyKwhPerTrainKm ?? 13), 13))
    * rail.railElectrifiedShare;

  const remainingPassengerDemand = Math.max(0, passengerDemandBase - rail.railPassengerKm);
  const remainingFreightDemand = Math.max(0, freightDemandBase - rail.railFreightTonneKm);

  const distanceSuitability = {
    walk: clamp01(1 - avgTripDistanceKm / 7),
    bicycle: clamp01(1 - Math.max(0, avgTripDistanceKm - 4) / 14),
    cart: clamp01(1 - Math.max(0, avgTripDistanceKm - 8) / 20),
    animalDraft: clamp01(1 - Math.max(0, avgTripDistanceKm - 10) / 24),
    car: 1,
    truck: 1,
    bus: clamp01(1 - Math.max(0, avgTripDistanceKm - 12) / 30),
    water: clamp01(avgTripDistanceKm / 28),
    electricLightVehicle: clamp01(1 - Math.max(0, avgTripDistanceKm - 9) / 18)
  };

  const accessibility = {
    walk: average(world.patches.map((patch) => patch.metrics?.walkAccessIndex ?? 0.3), 0.3),
    bicycle: average(world.patches.map((patch) => patch.metrics?.bicycleAccessIndex ?? 0.3), 0.3),
    bus: average(world.patches.map((patch) => patch.metrics?.transitAccessIndex ?? 0.25), 0.25),
    water: clamp01(
      infrastructureAccess.water * 0.62
      + average(world.settlements.map((item) => item.metrics?.railOrWaterFreightAccess ?? 0), 0) * 0.38
    ),
    rail: infrastructureAccess.rail,
    freight: average(world.patches.map((patch) => patch.metrics?.freightAccessIndex ?? 0.3), 0.3),
    draft: average(world.households.map((household) => household.access.draftPower ?? 0.2), 0.2),
    vehicle: average(world.households.map((household) => household.access.vehicleAccess ?? 0.4), 0.4),
    power: infrastructureAccess.powerLine
  };

  const dieselPrice = world.markets[0]?.prices?.dieselLitre ?? 1.6;
  const pricePressure = clamp01((dieselPrice - 1.4) / 1.5);
  const viableRailShare = safeDivide(rail.householdsWithViableRailAlternative, Math.max(1, world.households.length), 0);
  const fuelPriceInducedBusPassengerKm = remainingPassengerDemand * pricePressure * accessibility.bus * viableRailShare * 0.16;

  const passengerShares = normalizeShares({
    walk: (0.18 + annualModeShiftToWalkBikeRate * 1.4) * accessibility.walk * distanceSuitability.walk,
    bicycle: (0.12 + annualModeShiftToWalkBikeRate * 1.3) * accessibility.bicycle * distanceSuitability.bicycle,
    cart: (0.015 + annualDraftTransportAdoptionRate * 0.25) * accessibility.draft * distanceSuitability.cart,
    animalDraft: (0.02 + annualDraftTransportAdoptionRate * 0.55) * accessibility.draft * distanceSuitability.animalDraft,
    bus: (0.1 + annualModeShiftToBusRate * 1.4 + safeDivide(fuelPriceInducedBusPassengerKm, Math.max(1, remainingPassengerDemand), 0) * 0.35)
      * accessibility.bus * distanceSuitability.bus,
    electricLightVehicle: (0.03 + (adaptation.electrificationRate ?? 0) * 2.2) * accessibility.power * distanceSuitability.electricLightVehicle,
    car: (0.5 - privateCarDependenceReductionRate * 2.1 - pricePressure * viableRailShare * 0.18) * accessibility.vehicle,
    water: 0.004 * accessibility.water * distanceSuitability.water
  });

  const freightShares = normalizeShares({
    truck: (0.72 - privateCarDependenceReductionRate * 0.65)
      * (1 - accessibility.water * 0.28 - accessibility.rail * 0.24 * (0.6 + annualRailWaterFreightUseRate * 2))
      * accessibility.freight,
    water: (0.05 + annualRailWaterFreightUseRate * 1.2) * accessibility.water,
    cart: (0.005 + annualDraftTransportAdoptionRate * 0.9) * accessibility.draft,
    animalDraft: (0.01 + annualDraftTransportAdoptionRate * 1.2) * accessibility.draft,
    electricLightVehicle: (0.03 + (adaptation.electrificationRate ?? 0) * 1.1) * accessibility.power,
    car: 0.01 * accessibility.vehicle
  });

  const modeFlows = {};
  for (const [modeName, share] of Object.entries(passengerShares)) {
    addModeFlow(modeFlows, modeName, remainingPassengerDemand * share, 0);
  }
  for (const [modeName, share] of Object.entries(freightShares)) {
    addModeFlow(modeFlows, modeName, 0, remainingFreightDemand * share);
  }

  let nonRailDieselDemandLitre = 0;
  let nonRailElectricityDemandKwh = 0;
  let transportFodderDemandKg = 0;
  let transportLabourDemandDays = 0;

  for (const [modeName, flow] of Object.entries(modeFlows)) {
    const mode = modes[modeName];
    if (!mode) {
      continue;
    }

    const requiredAccess = modeAvailability(mode, infrastructureAccess);
    const roadFactor = clamp01(1 - (1 - avgRoadCondition) * (mode.roadConditionSensitivity ?? 0.3));
    const availabilityFactor = requiredAccess * roadFactor;

    flow.passengerKm *= availabilityFactor;
    flow.freightTonneKm *= availabilityFactor;

    nonRailDieselDemandLitre += flow.passengerKm * (mode.dieselLitrePerPassengerKm ?? 0);
    nonRailDieselDemandLitre += flow.freightTonneKm * (mode.dieselLitrePerTonneKm ?? 0);

    nonRailElectricityDemandKwh += flow.passengerKm * (mode.electricityKwhPerPassengerKm ?? 0);
    nonRailElectricityDemandKwh += flow.freightTonneKm * (mode.electricityKwhPerTonneKm ?? 0);

    transportFodderDemandKg += flow.freightTonneKm * (mode.fodderKgPerTonneKm ?? 0);

    transportLabourDemandDays += (flow.passengerKm / 1_000) * (mode.labourDaysPer1000PassengerKm ?? 0);
    transportLabourDemandDays += (flow.freightTonneKm / 1_000) * (mode.labourDaysPer1000TonneKm ?? 0);
  }

  const transportDieselDemandLitre = nonRailDieselDemandLitre + railDieselDemandLitre;
  const transportElectricityDemandKwh = nonRailElectricityDemandKwh + railElectricityDemandKwh;

  const dieselAvailability = context.dieselAvailability ?? 1;
  const transportDieselAvailableLitre = transportDieselDemandLitre * dieselAvailability;

  const electricityBase = energyConstants.electricGridAvailabilityBase ?? 0.9;
  const electrificationBoost = adaptation.electrificationRate ?? 0;
  const transportElectricityAvailableKwh = transportElectricityDemandKwh
    * electricityBase
    * (0.5 + 0.5 * accessibility.power)
    * (0.7 + electrificationBoost * 8);

  const fodderProducedKg = context.producedFodderKg ?? 0;
  const transportFodderAvailableKg = fodderProducedKg * (0.45 + annualDraftTransportAdoptionRate * 2.5);

  const nonRailDieselPassengerDemandLitre = Object.entries(modeFlows).reduce((sum, [modeName, flow]) => {
    const mode = modes[modeName];
    return sum + flow.passengerKm * (mode?.dieselLitrePerPassengerKm ?? 0);
  }, 0);

  const nonRailDieselFreightDemandLitre = Object.entries(modeFlows).reduce((sum, [modeName, flow]) => {
    const mode = modes[modeName];
    return sum + flow.freightTonneKm * (mode?.dieselLitrePerTonneKm ?? 0);
  }, 0);

  const dieselPassengerDemandLitre = nonRailDieselPassengerDemandLitre + railDieselDemandLitre * 0.45;
  const dieselFreightDemandLitre = nonRailDieselFreightDemandLitre + railDieselDemandLitre * 0.55;

  let dieselPassengerServeRatio = 1;
  let dieselFreightServeRatio = 1;

  if (transportDieselDemandLitre > transportDieselAvailableLitre) {
    if (freightPriorityForFoodAndFuel) {
      const priorityFreightShare = clamp01(dieselPriorityFreightShare + dieselPriorityBoostForEssentialFreight);
      const freightTarget = transportDieselAvailableLitre * priorityFreightShare;
      const freightServed = Math.min(dieselFreightDemandLitre, freightTarget);
      const remaining = Math.max(0, transportDieselAvailableLitre - freightServed);
      const passengerServed = Math.min(dieselPassengerDemandLitre, remaining + Math.max(0, freightTarget - freightServed));
      dieselFreightServeRatio = safeDivide(freightServed, dieselFreightDemandLitre, 1);
      dieselPassengerServeRatio = safeDivide(passengerServed, dieselPassengerDemandLitre, 1);
    } else {
      const sharedRatio = safeDivide(transportDieselAvailableLitre, transportDieselDemandLitre, 0);
      dieselFreightServeRatio = sharedRatio;
      dieselPassengerServeRatio = sharedRatio;
    }
  }

  const electricityServeRatio = transportElectricityDemandKwh > 0
    ? Math.min(1, safeDivide(transportElectricityAvailableKwh, transportElectricityDemandKwh, 1))
    : 1;

  const fodderServeRatio = transportFodderDemandKg > 0
    ? Math.min(1, safeDivide(transportFodderAvailableKg, transportFodderDemandKg, 1))
    : 1;

  let dieselPassengerKm = 0;
  let dieselFreightTonneKm = 0;
  let nonDieselPassengerKm = 0;
  let nonDieselFreightTonneKm = 0;
  let heavyTruckTonneKm = 0;

  for (const [modeName, flow] of Object.entries(modeFlows)) {
    const mode = modes[modeName];
    if (!mode) {
      continue;
    }

    const dieselBased = (mode.dieselLitrePerPassengerKm ?? 0) > 0 || (mode.dieselLitrePerTonneKm ?? 0) > 0;
    const electricBased = (mode.electricityKwhPerPassengerKm ?? 0) > 0 || (mode.electricityKwhPerTonneKm ?? 0) > 0;
    const fodderBased = (mode.fodderKgPerTonneKm ?? 0) > 0;

    const passengerFactor = dieselBased ? dieselPassengerServeRatio : (electricBased ? electricityServeRatio : 1);

    let freightFactor = 1;
    if (dieselBased) {
      freightFactor *= dieselFreightServeRatio;
    }
    if (electricBased) {
      freightFactor *= electricityServeRatio;
    }
    if (fodderBased) {
      freightFactor *= fodderServeRatio;
    }

    const servedPassengerKm = flow.passengerKm * passengerFactor;
    const servedFreightTonneKm = flow.freightTonneKm * freightFactor;

    if (dieselBased) {
      dieselPassengerKm += servedPassengerKm;
      dieselFreightTonneKm += servedFreightTonneKm;
      if (modeName === 'truck') {
        heavyTruckTonneKm += servedFreightTonneKm;
      }
    } else {
      nonDieselPassengerKm += servedPassengerKm;
      nonDieselFreightTonneKm += servedFreightTonneKm;
    }
  }

  const railDieselPassengerKm = rail.railPassengerKm * (1 - rail.railElectrifiedShare) * dieselPassengerServeRatio;
  const railDieselFreightTonneKm = rail.railFreightTonneKm * (1 - rail.railElectrifiedShare) * dieselFreightServeRatio;
  const railElectricPassengerKm = rail.railPassengerKm * rail.railElectrifiedShare * electricityServeRatio;
  const railElectricFreightTonneKm = rail.railFreightTonneKm * rail.railElectrifiedShare * electricityServeRatio;

  dieselPassengerKm += railDieselPassengerKm;
  dieselFreightTonneKm += railDieselFreightTonneKm;
  nonDieselPassengerKm += railElectricPassengerKm;
  nonDieselFreightTonneKm += railElectricFreightTonneKm;

  const railPassengerKmServed = railDieselPassengerKm + railElectricPassengerKm;
  const railFreightTonneKmServed = railDieselFreightTonneKm + railElectricFreightTonneKm;

  const totalPassengerKmServed = dieselPassengerKm + nonDieselPassengerKm;
  const totalFreightTonneKmServed = dieselFreightTonneKm + nonDieselFreightTonneKm;

  const totalPassengerKmDemand = passengerDemandBase;
  const totalFreightTonneKmDemand = freightDemandBase;

  const unmetPassengerKm = Math.max(0, totalPassengerKmDemand - totalPassengerKmServed);
  const unmetFreightTonneKm = Math.max(0, totalFreightTonneKmDemand - totalFreightTonneKmServed);

  const transportDieselDeficitLitre = Math.max(0, transportDieselDemandLitre - transportDieselAvailableLitre);
  const transportElectricityDeficitKwh = Math.max(0, transportElectricityDemandKwh - transportElectricityAvailableKwh);
  const transportFodderDeficitKg = Math.max(0, transportFodderDemandKg - transportFodderAvailableKg);

  const essentialPassengerKm = totalPassengerKmDemand * essentialPassengerShare;
  const essentialFreightTonneKm = totalFreightTonneKmDemand * essentialFreightShare;
  const unmetEssentialPassengerKm = Math.max(0, essentialPassengerKm - Math.min(essentialPassengerKm, totalPassengerKmServed));
  const unmetEssentialFreightTonneKm = Math.max(0, essentialFreightTonneKm - Math.min(essentialFreightTonneKm, totalFreightTonneKmServed));

  const transportFuelStress = clamp01(
    safeDivide(transportDieselDeficitLitre, Math.max(1, transportDieselDemandLitre), 0) * 0.42
    + safeDivide(unmetEssentialPassengerKm, Math.max(1, essentialPassengerKm), 0) * 0.18
    + safeDivide(unmetEssentialFreightTonneKm, Math.max(1, essentialFreightTonneKm), 0) * 0.24
    + safeDivide(transportFodderDeficitKg, Math.max(1, transportFodderDemandKg), 0) * 0.07
    + safeDivide(transportLabourDemandDays, Math.max(1, world.households.length * 130), 0) * 0.09
  );

  const vehicleKm = dieselPassengerKm * 0.62 + nonDieselPassengerKm * 0.35;
  const heavyTruckTonneKmAvoidedByRail = rail.railFreightTonneKm;

  return {
    totalPassengerKmDemand,
    totalFreightTonneKmDemand,
    localizedPassengerKmAvoided: transportDemand.localizedPassengerKmAvoided,
    localizedFreightTonneKmAvoided: transportDemand.localizedFreightTonneKmAvoided,
    dieselPassengerKm,
    dieselFreightTonneKm,
    nonDieselPassengerKm,
    nonDieselFreightTonneKm,
    railPassengerKm: railPassengerKmServed,
    railFreightTonneKm: railFreightTonneKmServed,
    railDieselDemandLitre,
    railElectricityDemandKwh,
    railUnservedDemandDueToAccess: rail.railUnservedDemandDueToAccess,
    railUnservedDemandDueToCondition: rail.railUnservedDemandDueToCondition,
    railUtilizationRatio: rail.railUtilizationRatio,
    passengerUtilizationRatio: rail.passengerUtilizationRatio,
    freightUtilizationRatio: rail.freightUtilizationRatio,
    weightedUtilizationRatio: rail.weightedUtilizationRatio,
    railPassengerCapacityKm: rail.totalPassengerCapacity,
    railFreightCapacityTonneKm: rail.totalFreightCapacity,
    railServiceReliability: rail.railServiceReliability,
    railConditionAverage: rail.railConditionAverage,
    railEnabled: rail.railEnabled,
    railElectrified: rail.railElectrified,
    railElectrifiedShare: rail.railElectrifiedShare,
    railTrainKm,
    railActiveForCostAdvantage: rail.railActiveForCostAdvantage,
    minimumRailUtilizationForCostAdvantage: rail.minimumRailUtilizationForCostAdvantage,
    transportDieselDemandLitre,
    transportDieselAvailableLitre,
    transportDieselDeficitLitre,
    transportElectricityDemandKwh,
    transportElectricityDeficitKwh,
    transportFodderDemandKg,
    transportFodderDeficitKg,
    transportLabourDemandDays,
    unmetPassengerKm,
    unmetFreightTonneKm,
    fodderProducedKg,
    fodderDemandKg: transportFodderDemandKg,
    fodderDeficitKg: transportFodderDeficitKg,
    transportFuelStress,
    dieselAvailabilityAllocationPassenger: dieselPassengerServeRatio,
    dieselAvailabilityAllocationFreight: dieselFreightServeRatio,
    dieselPassengerDemandLitre,
    dieselFreightDemandLitre,
    essentialPassengerKm,
    essentialFreightTonneKm,
    unmetEssentialPassengerKm,
    unmetEssentialFreightTonneKm,
    heavyTruckTonneKm,
    heavyTruckTonneKmAvoidedByRail,
    vehicleKm,
    railEligibleFoodFreightTonneKm: rail.railEligibleFoodFreightTonneKm,
    railEligibleWoodFreightTonneKm: rail.railEligibleWoodFreightTonneKm,
    railEligibleMaterialsFreightTonneKm: rail.railEligibleMaterialsFreightTonneKm,
    railEligibleMarketFreightTonneKm: rail.railEligibleMarketFreightTonneKm,
    railFreightCapturedTonneKm: rail.railFreightCapturedTonneKm,
    fuelPriceInducedRailPassengerKm: rail.fuelPriceInducedRailPassengerKm,
    fuelPriceInducedBusPassengerKm,
    householdsWithViableRailAlternative: rail.householdsWithViableRailAlternative,
    householdsCarDependentNoAlternative: rail.householdsCarDependentNoAlternative,
    catchmentPopulation: rail.catchmentPopulation,
    catchmentHouseholds: rail.catchmentHouseholds,
    catchmentJobs: rail.catchmentJobs,
    catchmentServiceCapacity: rail.catchmentServiceCapacity,
    catchmentFreightTonnePotential: rail.catchmentFreightTonnePotential,
    catchmentProductiveLandHa: rail.catchmentProductiveLandHa,
    catchmentWalkAccessShare: rail.catchmentWalkAccessShare,
    catchmentBicycleAccessShare: rail.catchmentBicycleAccessShare
  };
}
