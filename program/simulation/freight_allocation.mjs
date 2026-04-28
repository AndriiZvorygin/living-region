// SPDX-License-Identifier: AGPL-3.0-or-later
import { clamp, clamp01, safeDivide } from '../util/math.mjs';

const FREIGHT_ANCHOR_TYPES = new Set([
  'freightSiding',
  'intermodalDepot',
  'marketDepot',
  'grainElevator',
  'woodDepot',
  'coldStorageDepot',
  'repairDepot',
  'grainDepot',
  'rootCellarDepot',
  'woodFuelDepot',
  'timberSiding',
  'farmInputDepot',
  'nurseryStockDepot',
  'repairMaterialsDepot',
  'compostTransferDepot',
  'constructionMaterialsDepot',
  'emergencySupplyDepot'
]);

function hasColdStorage(anchors) {
  return anchors.some((anchor) => ['coldStorageDepot', 'rootCellarDepot'].includes(anchor.type));
}

function anchorStats(anchors, commodity) {
  const relevant = anchors.filter((anchor) => {
    const types = anchor.commodityTypes ?? [];
    return types.length === 0 || types.includes(commodity);
  });
  const throughput = relevant.reduce((sum, anchor) => sum + (anchor.annualThroughputTonnes ?? 0), 0);
  const railCapturePotential = relevant.reduce((sum, anchor) => sum + (anchor.railCapturePotential ?? 0), 0);
  const roadCapturePotential = relevant.reduce((sum, anchor) => sum + (anchor.roadCapturePotential ?? 0), 0);
  const loadingEfficiency = relevant.reduce((sum, anchor) => sum + (anchor.loadingEfficiency ?? 0), 0);
  const spoilageReduction = relevant.reduce((sum, anchor) => sum + (anchor.spoilageReduction ?? 0), 0);
  const anchorStrength = relevant.reduce((sum, anchor) => sum + (anchor.anchorStrength ?? 0), 0);
  const loadingLabourDaysPerTonne = relevant.reduce((sum, anchor) => sum + (anchor.loadingLabourDaysPerTonne ?? 0), 0);

  return {
    throughput,
    railCapturePotential,
    roadCapturePotential,
    loadingEfficiency,
    spoilageReduction,
    anchorStrength,
    loadingLabourDaysPerTonne,
    count: relevant.length
  };
}

function updateMap(map, key, value) {
  map[key] = (map[key] ?? 0) + value;
}

export function allocateFreight(world, scenario, freightDemand, context) {
  const constants = context.constants ?? {};
  const transportConstants = constants.transport ?? {};
  const modes = transportConstants.modes ?? {};
  const railEnabled = context.railEnabled ?? false;
  const railElectrifiedShare = context.railElectrifiedShare ?? 0;
  const railCondition = context.railConditionAverage ?? 0.6;
  const railReliability = context.railServiceReliability ?? 0.55;
  const dieselAvailability = context.dieselAvailability ?? 1;
  const adaptation = context.adaptation ?? {};
  const stationCatchments = context.stationCatchments ?? {};

  const anchors = world.infrastructures.filter((infra) => FREIGHT_ANCHOR_TYPES.has(infra.type));
  const coldStorage = hasColdStorage(anchors);

  const roadFreightTonneKmByCommodity = {};
  const railFreightTonneKmByCommodity = {};
  const localFreightTonneKmByCommodity = {};
  const unmetFreightTonneKmByCommodity = {};
  const railEligibleFreightByCommodity = {};
  const freightTonneKmCapturedByAnchor = {};

  let roadFreightAvoidedTonneKm = 0;
  let railFreightCapturedTonneKm = 0;
  let heavyTruckTonneKmAvoidedByRail = 0;
  let freightDieselDemandLitre = 0;
  let freightElectricityDemandKwh = 0;
  let freightHandlingLabourDays = 0;
  let freightSpoilageLossTonnes = 0;
  let unmetFreightTonneKm = 0;
  let dieselRoadFreightTonneKm = 0;
  let localModeFreightTonneKm = 0;
  let nonDieselFreightTonneKm = 0;
  let transportFodderDemandKg = 0;
  let totalRailFreightCapacityTonneKm = 0;

  const railSegments = world.networks
    .flatMap((network) => network.segments ?? [])
    .filter((segment) => ['traditionalRail', 'electrifiedRail'].includes(segment.type));
  totalRailFreightCapacityTonneKm = railSegments.reduce((sum, segment) => sum + (segment.capacityTonneKmPerYear ?? 0), 0);

  const truckDiesel = modes.truck?.dieselLitrePerTonneKm ?? 0.13;
  const railDiesel = modes.rail?.dieselLitrePerTonneKm ?? 0.028;
  const railElectric = modes.rail?.electricityKwhPerTonneKm ?? 0.045;
  const cartFodder = modes.cart?.fodderKgPerTonneKm ?? 1.05;
  const draftFodder = modes.animalDraft?.fodderKgPerTonneKm ?? 0.85;
  const localRoadDiesel = (modes.truck?.dieselLitrePerTonneKm ?? 0.13) * 0.58;

  const fuelPriority = adaptation.freightPriorityForFoodAndFuel ?? false;
  const fuelPressure = clamp01(1 - dieselAvailability);

  for (const [commodity, demand] of Object.entries(freightDemand.freightDemandByCommodity ?? {})) {
    const stats = anchorStats(anchors, commodity);
    const railSuitabilityBase = demand.railSuitability ?? 0.4;
    const roadSuitabilityBase = demand.roadSuitability ?? 0.8;
    const perishability = demand.perishability ?? 0.2;
    const essentiality = demand.essentiality ?? 0.4;

    const coldChainFactor = coldStorage ? 1 : (1 - perishability * 0.7);
    const serviceFrequencyFactor = clamp01((stationCatchments.averageServiceFrequencyPerDay ?? 0) / 8);
    const catchmentFactor = clamp01(stationCatchments.viableRailHouseholdShare ?? 0);
    const anchorFactor = clamp01(safeDivide(stats.anchorStrength, Math.max(1, stats.count), 0));
    const throughputFactor = clamp01(safeDivide(stats.throughput, Math.max(1, demand.annualTonnes), 0));

    const railOpportunity = clamp01(
      railSuitabilityBase * 0.42
      + railCondition * 0.14
      + railReliability * 0.14
      + serviceFrequencyFactor * 0.1
      + catchmentFactor * 0.06
      + anchorFactor * 0.08
      + throughputFactor * 0.06
    ) * coldChainFactor;

    const railEnabledFactor = railEnabled ? 1 : 0;
    const railShare = clamp01(
      railOpportunity
      * railEnabledFactor
      * (0.55 + (adaptation.annualRailWaterFreightUseRate ?? 0) * 4)
      * (1 - (demand.storageNeed ?? 0.2) * 0.08)
    );

    const localShare = clamp01(
      safeDivide(demand.localTonneKm, Math.max(1, demand.tonneKmDemand), 0) * 0.65
      + (adaptation.annualFreightLocalizationRate ?? 0) * 2.4
      + (adaptation.localTripSubstitutionRate ?? 0) * 0.8
    );
    const effectiveLocalShare = clamp(localShare, 0, 0.8);

    const roadShare = clamp01(
      roadSuitabilityBase * (1 - railShare * 0.65) * (1 - effectiveLocalShare * 0.5)
      + (fuelPriority && essentiality > 0.7 ? 0.08 : 0)
    );

    const normalized = railShare + effectiveLocalShare + roadShare;
    const scale = normalized > 0 ? (1 / normalized) : 0;

    const railTonneKmTarget = demand.tonneKmDemand * railShare * scale;
    const localTonneKmTarget = demand.tonneKmDemand * effectiveLocalShare * scale;
    const roadTonneKmTarget = demand.tonneKmDemand * roadShare * scale;

    const maxRailByCapacity = totalRailFreightCapacityTonneKm > 0
      ? Math.min(railTonneKmTarget, totalRailFreightCapacityTonneKm * 0.55)
      : 0;
    const railTonneKm = Math.max(0, maxRailByCapacity);
    const localTonneKm = Math.max(0, localTonneKmTarget);
    const roadTonneKm = Math.max(0, roadTonneKmTarget);
    const unmetTonneKm = Math.max(0, demand.tonneKmDemand - railTonneKm - localTonneKm - roadTonneKm);

    railEligibleFreightByCommodity[commodity] = railTonneKmTarget;
    railFreightTonneKmByCommodity[commodity] = railTonneKm;
    roadFreightTonneKmByCommodity[commodity] = roadTonneKm;
    localFreightTonneKmByCommodity[commodity] = localTonneKm;
    unmetFreightTonneKmByCommodity[commodity] = unmetTonneKm;

    const anchorCapture = railTonneKm * clamp01(safeDivide(stats.railCapturePotential, Math.max(1, stats.count), 0) * 1.25);
    freightTonneKmCapturedByAnchor[commodity] = anchorCapture;

    const railDieselTonneKm = railTonneKm * (1 - railElectrifiedShare);
    const railElectricTonneKm = railTonneKm * railElectrifiedShare;
    const localDieselTonneKm = localTonneKm * 0.32;
    const localDraftTonneKm = localTonneKm * 0.68;

    freightDieselDemandLitre += railDieselTonneKm * railDiesel;
    freightDieselDemandLitre += roadTonneKm * truckDiesel;
    freightDieselDemandLitre += localDieselTonneKm * localRoadDiesel;
    freightElectricityDemandKwh += railElectricTonneKm * Math.max(railElectric, 0.035);
    transportFodderDemandKg += localDraftTonneKm * (draftFodder * 0.7 + cartFodder * 0.3);

    const tonnesHandled = demand.annualTonnes * (1 - safeDivide(unmetTonneKm, Math.max(1, demand.tonneKmDemand), 0));
    freightHandlingLabourDays += tonnesHandled
      * ((demand.handlingLabourDaysPerTonne ?? 0.08) + safeDivide(stats.loadingLabourDaysPerTonne, Math.max(1, stats.count), 0));

    const travelDelayDays = 0.5 + fuelPressure * 1.8 + (1 - railReliability) * 0.6;
    const spoilageRisk = (demand.spoilageRiskPerDay ?? 0.01) * (1 - stats.spoilageReduction);
    freightSpoilageLossTonnes += tonnesHandled * perishability * spoilageRisk * travelDelayDays;

    railFreightCapturedTonneKm += railTonneKm;
    roadFreightAvoidedTonneKm += localTonneKm + railTonneKm * 0.8;
    heavyTruckTonneKmAvoidedByRail += railTonneKm * (0.72 + essentiality * 0.18);
    unmetFreightTonneKm += unmetTonneKm;
    dieselRoadFreightTonneKm += roadTonneKm;
    localModeFreightTonneKm += localTonneKm;
    nonDieselFreightTonneKm += railElectricTonneKm + localDraftTonneKm;
  }

  const freightServiceReliability = clamp01(
    railReliability * 0.35
    + clamp01(1 - fuelPressure) * 0.25
    + clamp01(1 - safeDivide(unmetFreightTonneKm, Math.max(1, freightDemand.totalFreightTonneKm), 0)) * 0.25
    + clamp01(1 - safeDivide(freightSpoilageLossTonnes, Math.max(1, freightDemand.totalFreightTonnes), 0)) * 0.15
  );

  return {
    roadFreightTonneKmByCommodity,
    railFreightTonneKmByCommodity,
    localFreightTonneKmByCommodity,
    unmetFreightTonneKmByCommodity,
    railEligibleFreightByCommodity,
    freightTonneKmCapturedByAnchor,
    railFreightCapturedTonneKm,
    roadFreightAvoidedTonneKm,
    heavyTruckTonneKmAvoidedByRail,
    freightDieselDemandLitre,
    freightElectricityDemandKwh,
    freightHandlingLabourDays,
    freightSpoilageLossTonnes,
    freightServiceReliability,
    unmetFreightTonneKm,
    dieselRoadFreightTonneKm,
    localModeFreightTonneKm,
    nonDieselFreightTonneKm,
    transportFodderDemandKg,
    totalRailFreightCapacityTonneKm
  };
}
