// SPDX-License-Identifier: AGPL-3.0-or-later
import { average, clamp, clamp01, safeDivide } from '../util/math.mjs';

function heatingSystemShares(system) {
  if (system === 'wood') {
    return { wood: 1, electric: 0, fossil: 0 };
  }
  if (system === 'electric') {
    return { wood: 0, electric: 1, fossil: 0 };
  }
  if (system === 'gas' || system === 'oil') {
    return { wood: 0, electric: 0, fossil: 1 };
  }
  return { wood: 0.35, electric: 0.3, fossil: 0.35 };
}

function buildingHeatDemand(building) {
  return building.baseHeatDemandKwhPerYear ?? building.heatDemandKwhPerYear ?? 18_000;
}

export function calculateEnergyBalance(world, context) {
  const constants = context.constants?.energy ?? {};
  const adaptation = context.adaptation ?? {};
  const transport = context.transport ?? {};

  const kwhPerKgSeasonedFirewood = constants.kwhPerKgSeasonedFirewood ?? 4.2;
  const kwhPerLitreDiesel = constants.kwhPerLitreDiesel ?? 10.7;
  const householdElectricityKwhPerPerson = constants.householdElectricityKwhPerPerson ?? 1_300;
  const electricGridAvailabilityBase = constants.electricGridAvailabilityBase ?? 0.9;
  const biomassHarvestEfficiency = constants.biomassHarvestEfficiency ?? 0.82;
  const sustainableWoodHarvestShare = constants.sustainableWoodHarvestShare ?? 0.65;
  const maxAnnualWoodHarvestShareOfStandingBiomass = constants.maxAnnualWoodHarvestShareOfStandingBiomass ?? 0.55;
  const adaptationEmergencyHarvestCarbonPenalty = constants.adaptationEmergencyHarvestCarbonPenalty ?? 0.015;

  const heatDemandReductionRate = adaptation.heatingDemandReductionRate ?? 0;
  const localBiomassMobilizationRate = adaptation.localBiomassMobilizationRate ?? 0;

  let heatDemandKwh = 0;
  let woodHeatDemandKwh = 0;
  let electricHeatDemandKwh = 0;
  let fossilHeatDemandKwh = 0;
  let electricityBaseDemandKwh = 0;

  const effectiveHeatDemands = [];

  for (const building of world.buildings) {
    if (!Object.hasOwn(building, 'baseHeatDemandKwhPerYear')) {
      building.baseHeatDemandKwhPerYear = building.heatDemandKwhPerYear;
    }

    const baseHeat = buildingHeatDemand(building);
    const occupiedShare = building.dwellingUnits > 0
      ? safeDivide(building.occupiedUnits, building.dwellingUnits, 0)
      : 1;

    const effectiveHeatDemandKwh = baseHeat
      * (1 - 0.45 * building.insulationLevel)
      * (1 - 0.35 * building.retrofitLevel)
      * (1 - heatDemandReductionRate)
      * Math.max(0.2, occupiedShare);

    building.metrics = {
      ...building.metrics,
      effectiveHeatDemandKwh
    };

    const shares = heatingSystemShares(building.heatingSystem);
    heatDemandKwh += effectiveHeatDemandKwh;
    woodHeatDemandKwh += effectiveHeatDemandKwh * shares.wood;
    electricHeatDemandKwh += effectiveHeatDemandKwh * shares.electric;
    fossilHeatDemandKwh += effectiveHeatDemandKwh * shares.fossil;
    effectiveHeatDemands.push(effectiveHeatDemandKwh);
  }

  const populationTotal = world.households.reduce((sum, household) => sum + household.people.total, 0);
  electricityBaseDemandKwh = populationTotal * householdElectricityKwhPerPerson;

  const electricityDemandKwh = electricityBaseDemandKwh + electricHeatDemandKwh;
  const gridAvailability = electricGridAvailabilityBase * (0.75 + 0.25 * context.dieselAvailability);
  const electricityAvailableKwh = electricityDemandKwh * gridAvailability;
  const electricityDeficitKwh = Math.max(0, electricityDemandKwh - electricityAvailableKwh);

  const totalWoodProducedKg = context.producedWoodKg;
  const biomassHarvestKg = totalWoodProducedKg * biomassHarvestEfficiency * (1 + localBiomassMobilizationRate);
  const sustainableBiomassHarvestKg = Math.min(
    biomassHarvestKg,
    totalWoodProducedKg * sustainableWoodHarvestShare,
    totalWoodProducedKg * maxAnnualWoodHarvestShareOfStandingBiomass
  );
  const sustainableWoodHeatKwh = sustainableBiomassHarvestKg * kwhPerKgSeasonedFirewood;

  const residualWoodPotentialKg = Math.max(0, biomassHarvestKg - sustainableBiomassHarvestKg);
  const emergencyWoodHeatKwh = residualWoodPotentialKg * kwhPerKgSeasonedFirewood;

  const woodHeatSupplyKwh = Math.min(woodHeatDemandKwh, sustainableWoodHeatKwh + emergencyWoodHeatKwh * 0.35);
  const fossilHeatAvailableKwh = fossilHeatDemandKwh * (0.55 + 0.45 * context.dieselAvailability);
  const fossilHeatSupplyKwh = Math.min(fossilHeatDemandKwh, fossilHeatAvailableKwh);

  const electricityRatio = electricityDemandKwh > 0
    ? safeDivide(electricityAvailableKwh, electricityDemandKwh, 1)
    : 1;
  const electricHeatSupplyKwh = electricHeatDemandKwh * electricityRatio;

  const totalHeatSupplyKwh = woodHeatSupplyKwh + fossilHeatSupplyKwh + electricHeatSupplyKwh;
  const heatingEnergyDeficitKwh = Math.max(0, heatDemandKwh - totalHeatSupplyKwh);

  if (residualWoodPotentialKg > 0) {
    const penalty = adaptationEmergencyHarvestCarbonPenalty * safeDivide(residualWoodPotentialKg, Math.max(1, totalWoodProducedKg), 0);
    for (const patch of world.patches) {
      if (patch.landUse === 'woodland' || patch.landUse === 'cropland' || patch.landUse === 'mixed') {
        patch.soil.carbon = clamp(patch.soil.carbon - penalty * 0.1, 0.1, 1);
      }
    }
  }

  let patchWoodSum = 0;
  for (const patch of world.patches) {
    const producedWoodKg = patch.metrics?.producedWoodKg ?? 0;
    patchWoodSum += producedWoodKg;
  }

  for (const patch of world.patches) {
    const producedWoodKg = patch.metrics?.producedWoodKg ?? 0;
    const patchShare = patchWoodSum > 0 ? producedWoodKg / patchWoodSum : 0;
    const patchSustainableBiomassHarvestKg = sustainableBiomassHarvestKg * patchShare;

    patch.metrics = {
      ...patch.metrics,
      sustainableBiomassHarvestKg: patchSustainableBiomassHarvestKg,
      energyPotentialKwh: patchSustainableBiomassHarvestKg * kwhPerKgSeasonedFirewood,
      transportFuelStressIndicator: clamp01(
        safeDivide(transport.transportDieselDeficitLitre ?? 0, transport.transportDieselDemandLitre ?? 0, 0)
        + (1 - (patch.metrics?.transportAccess ?? 0)) * 0.4
      ),
      transportResilienceScore: clamp01(
        (patch.metrics?.walkAccessIndex ?? 0.3) * 0.25
        + (patch.metrics?.localServiceAccessIndex ?? 0.3) * 0.25
        + (patch.metrics?.freightAccessIndex ?? 0.3) * 0.2
        + (patch.metrics?.energyPotentialKwh ?? 0) / 250_000 * 0.15
        + (1 - safeDivide(transport.unmetFreightTonneKm ?? 0, transport.totalFreightTonneKmDemand ?? 1, 0)) * 0.15
      )
    };
  }

  const transportDieselDemandLitre = transport.transportDieselDemandLitre ?? 0;
  const transportDieselAvailableLitre = transport.transportDieselAvailableLitre ?? 0;
  const transportDieselDeficitLitre = transport.transportDieselDeficitLitre ?? 0;
  const transportElectricityDemandKwh = transport.transportElectricityDemandKwh ?? 0;
  const transportFodderDemandKg = transport.transportFodderDemandKg ?? 0;
  const transportFodderDeficitKg = transport.transportFodderDeficitKg ?? 0;
  const transportLabourDemandDays = transport.transportLabourDemandDays ?? 0;
  const unmetPassengerKm = transport.unmetPassengerKm ?? 0;
  const unmetFreightTonneKm = transport.unmetFreightTonneKm ?? 0;

  return {
    heatDemandKwh,
    woodHeatSupplyKwh,
    electricHeatSupplyKwh,
    fossilHeatSupplyKwh,
    transportFuelDemandLitre: transportDieselDemandLitre,
    transportFuelAvailableLitre: transportDieselAvailableLitre,
    transportFuelDeficitLitre: transportDieselDeficitLitre,
    transportDieselDemandLitre,
    transportDieselAvailableLitre,
    transportDieselDeficitLitre,
    transportElectricityDemandKwh,
    transportFodderDemandKg,
    transportFodderDeficitKg,
    transportLabourDemandDays,
    unmetPassengerKm,
    unmetFreightTonneKm,
    totalPassengerKmDemand: transport.totalPassengerKmDemand ?? 0,
    totalFreightTonneKmDemand: transport.totalFreightTonneKmDemand ?? 0,
    localizedPassengerKmAvoided: transport.localizedPassengerKmAvoided ?? 0,
    localizedFreightTonneKmAvoided: transport.localizedFreightTonneKmAvoided ?? 0,
    dieselPassengerKm: transport.dieselPassengerKm ?? 0,
    dieselFreightTonneKm: transport.dieselFreightTonneKm ?? 0,
    nonDieselPassengerKm: transport.nonDieselPassengerKm ?? 0,
    nonDieselFreightTonneKm: transport.nonDieselFreightTonneKm ?? 0,
    electricityDemandKwh,
    electricityAvailableKwh,
    biomassHarvestKg,
    sustainableBiomassHarvestKg,
    heatingEnergyDeficitKwh,
    electricityDeficitKwh,
    averageEffectiveHeatDemandKwh: average(effectiveHeatDemands, 0),
    heatingFuelDeficitPressure: safeDivide(heatingEnergyDeficitKwh, heatDemandKwh, 0),
    transportFuelDeficitPressure: safeDivide(transportDieselDeficitLitre, transportDieselDemandLitre, 0),
    electricityDeficitPressure: safeDivide(electricityDeficitKwh, electricityDemandKwh, 0),
    dieselEnergyAvailableKwh: transportDieselAvailableLitre * kwhPerLitreDiesel,
    heatingOilEquivalentAvailableKwh: fossilHeatAvailableKwh,
    fodderProducedKg: context.producedFodderKg ?? 0,
    fodderDemandKg: transport.transportFodderDemandKg ?? 0,
    fodderDeficitKg: transport.transportFodderDeficitKg ?? 0
  };
}
