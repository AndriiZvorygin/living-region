// SPDX-License-Identifier: AGPL-3.0-or-later
import { average, clamp, clamp01, safeDivide } from '../util/math.mjs';

function getCommodityProfiles(constants) {
  return constants?.freightCommodities ?? {};
}

function localProductionIndicator(world, commodity) {
  const productiveLandUses = new Set(['cropland', 'pasture', 'woodland', 'mixed', 'vacant']);
  const productiveArea = world.patches
    .filter((patch) => productiveLandUses.has(patch.landUse))
    .reduce((sum, patch) => sum + patch.areaHa, 0);
  const totalArea = world.patches.reduce((sum, patch) => sum + patch.areaHa, 0);
  const patchProductiveShare = safeDivide(productiveArea, Math.max(1, totalArea), 0);

  if (['woodFuel', 'timber'].includes(commodity)) {
    const woodlandArea = world.patches
      .filter((patch) => patch.landUse === 'woodland')
      .reduce((sum, patch) => sum + patch.areaHa, 0);
    return clamp01(safeDivide(woodlandArea, Math.max(1, totalArea), 0) * 1.8);
  }
  if (['foodStaples', 'freshFood', 'nurseryStock', 'compostWaste', 'farmInputs'].includes(commodity)) {
    return clamp01(patchProductiveShare * 1.15);
  }
  return clamp01(patchProductiveShare * 0.75);
}

export function calculateFreightDemand(world, scenario, context) {
  const constants = context.constants ?? {};
  const adaptation = context.adaptation ?? {};
  const profiles = getCommodityProfiles(constants);
  const scaleMultipliers = scenario.scaleMultipliers ?? {};
  const freightDemandMultiplier = scaleMultipliers.freightDemand ?? 1;

  const population = world.households.reduce((sum, household) => sum + household.people.total, 0);
  const households = world.households.length;
  const avgTripDistanceKm = average(
    world.settlements.map((item) => item.metrics?.averageTripDistanceKm ?? 4),
    4
  );

  const repairReuseFactor = clamp01((adaptation.annualLocalServiceBuildoutRate ?? 0) * 8 + (adaptation.annualTripReductionRate ?? 0) * 3);
  const localProductionFactor = clamp01((adaptation.annualFreightLocalizationRate ?? 0) * 8 + (adaptation.localTripSubstitutionRate ?? 0) * 2);
  const storageProcessingFactor = clamp01((adaptation.localBiomassMobilizationRate ?? 0) * 5 + (adaptation.annualRailCorridorTransitionRate ?? 0) * 4);
  const compostLoopFactor = clamp01((adaptation.annualDraftTransportAdoptionRate ?? 0) * 4 + (adaptation.annualFreightLocalizationRate ?? 0) * 3);

  const freightDemandByCommodity = {};
  let totalFreightTonnes = 0;
  let totalFreightTonneKm = 0;
  let essentialFreightTonneKm = 0;
  let localFreightTonneKm = 0;
  let longDistanceFreightTonneKm = 0;

  let freightDemandReducedByRepairReuse = 0;
  let freightDemandReducedByLocalProduction = 0;
  let freightDemandReducedByStorageProcessing = 0;
  let freightDemandReducedByCompostLoop = 0;

  for (const [commodity, profile] of Object.entries(profiles)) {
    const annualTonnesBase = ((profile.baseTonnesPerPerson ?? 0) * population
      + (profile.baseTonnesPerHousehold ?? 0) * households
      + (profile.baseTonnesPerBuilding ?? 0) * world.buildings.length)
      * freightDemandMultiplier;

    const localIndicator = localProductionIndicator(world, commodity);
    const localProductionShare = clamp01((profile.localProductionShare ?? 0) + localIndicator * 0.4 + localProductionFactor * 0.35);
    const localKmFactor = clamp(0.28 + localProductionShare * 0.55, 0.2, 0.9);
    const routeDistanceKm = Math.max(1.5, avgTripDistanceKm * (1 + (profile.storageNeed ?? 0.2) * 0.7 + (profile.perishability ?? 0.2) * 0.45));

    const reducedByRepair = annualTonnesBase * repairReuseFactor * (profile.repairReuseElasticity ?? 0.08);
    const reducedByLocal = annualTonnesBase * localProductionFactor * (profile.localProductionElasticity ?? 0.12);
    const reducedByStorage = annualTonnesBase * storageProcessingFactor * (profile.storageElasticity ?? 0.06);
    const reducedByCompost = annualTonnesBase * compostLoopFactor * (profile.compostElasticity ?? 0.04);

    const annualTonnes = Math.max(
      0,
      annualTonnesBase * (profile.seasonalPeakFactor ?? 1)
        - reducedByRepair
        - reducedByLocal
        - reducedByStorage
        - reducedByCompost
    );

    const tonneKm = annualTonnes * routeDistanceKm;
    const localTonneKm = tonneKm * localKmFactor;
    const longDistanceTonneKmValue = Math.max(0, tonneKm - localTonneKm);

    const avoidableTonneKm = reducedByRepair * routeDistanceKm
      + reducedByLocal * routeDistanceKm
      + reducedByStorage * routeDistanceKm
      + reducedByCompost * routeDistanceKm;

    freightDemandByCommodity[commodity] = {
      annualTonnes,
      tonneKmDemand: tonneKm,
      localTonneKm,
      longDistanceTonneKm: longDistanceTonneKmValue,
      avoidableTonneKm,
      essentiality: profile.essentiality ?? 0.4,
      perishability: profile.perishability ?? 0.2,
      storageNeed: profile.storageNeed ?? 0.2,
      railSuitability: profile.railSuitability ?? 0.4,
      roadSuitability: profile.roadSuitability ?? 0.8,
      handlingLabourDaysPerTonne: profile.handlingLabourDaysPerTonne ?? 0.08,
      spoilageRiskPerDay: profile.spoilageRiskPerDay ?? 0.01,
      valuePerTonne: profile.valuePerTonne ?? 500,
      localProductionShare
    };

    totalFreightTonnes += annualTonnes;
    totalFreightTonneKm += tonneKm;
    essentialFreightTonneKm += tonneKm * (profile.essentiality ?? 0.4);
    localFreightTonneKm += localTonneKm;
    longDistanceFreightTonneKm += longDistanceTonneKmValue;
    freightDemandReducedByRepairReuse += reducedByRepair * routeDistanceKm;
    freightDemandReducedByLocalProduction += reducedByLocal * routeDistanceKm;
    freightDemandReducedByStorageProcessing += reducedByStorage * routeDistanceKm;
    freightDemandReducedByCompostLoop += reducedByCompost * routeDistanceKm;
  }

  const avoidableFreightTonneKm = freightDemandReducedByRepairReuse
    + freightDemandReducedByLocalProduction
    + freightDemandReducedByStorageProcessing
    + freightDemandReducedByCompostLoop;

  return {
    freightDemandByCommodity,
    totalFreightTonnes,
    totalFreightTonneKm,
    essentialFreightTonneKm,
    localFreightTonneKm,
    longDistanceFreightTonneKm,
    avoidableFreightTonneKm,
    freightDemandReducedByRepairReuse,
    freightDemandReducedByLocalProduction,
    freightDemandReducedByStorageProcessing,
    freightDemandReducedByCompostLoop
  };
}
