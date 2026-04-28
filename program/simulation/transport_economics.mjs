// SPDX-License-Identifier: AGPL-3.0-or-later
import { average, clamp, safeDivide } from '../util/math.mjs';

function fuelPrice(world) {
  return {
    gasoline: world.markets[0]?.prices?.dieselLitre ?? 1.6,
    diesel: world.markets[0]?.prices?.dieselLitre ?? 1.6,
    electricity: world.markets[0]?.prices?.electricityKwh ?? 0.2
  };
}

export function calculateTransportEconomics(world, context) {
  const constants = context.constants?.transportEconomics ?? {};
  const railCorridor = context.constants?.railCorridor ?? {};
  const prices = fuelPrice(world);

  const privateIce = constants.privateIce ?? {};
  const privateEv = constants.privateEv ?? {};
  const busDiesel = constants.busDiesel ?? {};
  const busElectric = constants.busElectric ?? {};
  const railDiesel = constants.railDiesel ?? {};
  const railElectric = constants.railElectric ?? {};

  const annualVehicleKm = privateIce.annualVehicleKm ?? 16_000;
  const fuelLitresPerKm = privateIce.fuelLitresPerKm ?? 0.085;
  const maintenanceCostPerKm = privateIce.maintenanceCostPerKm ?? 0.12;
  const insuranceAnnual = privateIce.insuranceAnnual ?? 1_850;
  const depreciationAnnual = privateIce.depreciationAnnual ?? 3_500;
  const financeOrCapitalAnnual = privateIce.financeOrCapitalAnnual ?? 2_100;
  const parkingAnnual = privateIce.parkingAnnual ?? 650;
  const roadExternalCostPerKm = privateIce.roadExternalCostPerKm ?? 0.04;

  const fixedVehicleCostAnnual = insuranceAnnual + depreciationAnnual + financeOrCapitalAnnual + parkingAnnual;
  const insuranceCostPerKm = safeDivide(insuranceAnnual, annualVehicleKm, 0);
  const fixedVehicleCostPerKm = safeDivide(fixedVehicleCostAnnual, annualVehicleKm, 0);

  const privateIceCostPerKm = fixedVehicleCostPerKm
    + fuelLitresPerKm * prices.gasoline
    + maintenanceCostPerKm
    + insuranceCostPerKm
    + roadExternalCostPerKm;

  const privateEvCostPerKm = safeDivide(
    (privateEv.insuranceAnnual ?? 1_920)
      + (privateEv.depreciationAnnual ?? 3_900)
      + (privateEv.financeOrCapitalAnnual ?? 2_300)
      + (privateEv.parkingAnnual ?? 650),
    privateEv.annualVehicleKm ?? annualVehicleKm,
    0
  )
    + (privateEv.electricityKwhPerKm ?? 0.19) * prices.electricity
    + (privateEv.maintenanceCostPerKm ?? 0.08);

  const publicTransitCostPerPassengerKm = (busDiesel.operatingCostPerPassengerKm ?? 0.44)
    + (busDiesel.maintenanceCostPerPassengerKm ?? 0.14)
    + (busDiesel.capitalAmortizationPerPassengerKm ?? 0.11);
  const publicTransitElectricCostPerPassengerKm = (busElectric.operatingCostPerPassengerKm ?? 0.39)
    + (busElectric.maintenanceCostPerPassengerKm ?? 0.13)
    + (busElectric.capitalAmortizationPerPassengerKm ?? 0.13);

  const railPassengerKm = context.railPassengerKm ?? 0;
  const railFreightTonneKm = context.railFreightTonneKm ?? 0;
  const railElectrifiedShare = context.railElectrifiedShare ?? 0;

  const railPassengerVariableCostPerKm = (railDiesel.operatingCostPerPassengerKm ?? 0.36)
    * (1 - railElectrifiedShare)
    + (railElectric.operatingCostPerPassengerKm ?? 0.29) * railElectrifiedShare
    + (railDiesel.maintenanceCostPerPassengerKm ?? 0.12) * (1 - railElectrifiedShare)
    + (railElectric.maintenanceCostPerPassengerKm ?? 0.13) * railElectrifiedShare
    + (railDiesel.capitalAmortizationPerPassengerKm ?? 0.15) * (1 - railElectrifiedShare)
    + (railElectric.capitalAmortizationPerPassengerKm ?? 0.18) * railElectrifiedShare;

  const railFreightVariableCostPerTonneKm = (railDiesel.operatingCostPerTonneKm ?? 0.095)
    * (1 - railElectrifiedShare)
    + (railElectric.operatingCostPerTonneKm ?? 0.082) * railElectrifiedShare;

  const railFixedCostAnnual = (railCorridor.railFixedBaseAnnual ?? 420_000) + (context.railMaintenanceDemandMoney ?? 0);
  const railVariableCostAnnual = railPassengerKm * railPassengerVariableCostPerKm + railFreightTonneKm * railFreightVariableCostPerTonneKm;

  const demandWeightedUnits = Math.max(1, railPassengerKm + railFreightTonneKm * 24);
  const passengerFixedAllocation = railFixedCostAnnual * safeDivide(railPassengerKm, demandWeightedUnits, 0.6);
  const freightFixedAllocation = railFixedCostAnnual - passengerFixedAllocation;

  const railPassengerCostPerKmAtUtilization = railPassengerKm > 0
    ? (passengerFixedAllocation + railPassengerKm * railPassengerVariableCostPerKm) / railPassengerKm
    : railPassengerVariableCostPerKm + 50;
  const railFreightCostPerTonneKmAtUtilization = railFreightTonneKm > 0
    ? (freightFixedAllocation + railFreightTonneKm * railFreightVariableCostPerTonneKm) / railFreightTonneKm
    : railFreightVariableCostPerTonneKm + 2;

  const railCostPerPassengerKm = railPassengerCostPerKmAtUtilization;
  const railCostPerTonneKm = railFreightCostPerTonneKmAtUtilization;

  const railFarePerPassengerKm = railCorridor.railFarePerPassengerKm ?? 0.21;
  const railFreightFeePerTonneKm = railCorridor.railFreightFeePerTonneKm ?? 0.055;
  const railPassengerRevenueEquivalent = railPassengerKm * railFarePerPassengerKm;
  const railFreightRevenueEquivalent = railFreightTonneKm * railFreightFeePerTonneKm;
  const railDirectRevenueEquivalent = railPassengerRevenueEquivalent + railFreightRevenueEquivalent;

  const railAvoidedRoadMaintenanceValue = context.avoidedRoadMaintenanceFromRailShift ?? 0;
  const dieselSavedLitres = (context.freightDieselDemandLitre ?? 0) * 0.35;
  const railAvoidedDieselValue = dieselSavedLitres * (railCorridor.freightBenefitValuePerDieselLitreAvoided ?? 1.6);
  const railSpoilageReductionValue = (context.freightSpoilageLossTonnes ?? 0)
    * (railCorridor.freightBenefitValuePerTonneSpoilageAvoided ?? 420)
    * 0.55;
  const railEmergencySupplyResilienceValue = (context.freightAllocation?.railFreightTonneKmByCommodity?.emergencySupplies ?? 0)
    * (railCorridor.emergencySupplyResilienceValuePerTonneKm ?? 0.18);

  const railTotalBenefitEquivalent = railDirectRevenueEquivalent
    + railAvoidedRoadMaintenanceValue
    + railAvoidedDieselValue
    + railSpoilageReductionValue
    + railEmergencySupplyResilienceValue;

  const railTotalCost = railFixedCostAnnual + railVariableCostAnnual;
  const railNetCostAfterBenefits = railTotalCost - railTotalBenefitEquivalent;
  const railBenefitCostRatio = safeDivide(railTotalBenefitEquivalent, Math.max(1, railTotalCost), 0);

  const railCostRecoveryRatioDirect = safeDivide(railDirectRevenueEquivalent, Math.max(1, railTotalCost), 0);
  const railCostRecoveryRatioWithAvoidedCosts = safeDivide(railTotalBenefitEquivalent, Math.max(1, railTotalCost), 0);
  const railPublicSubsidyRequired = Math.max(0, railTotalCost - railDirectRevenueEquivalent);

  const railCapacityReferencePassengerKm = railCorridor.railCapacityReferencePassengerKm ?? 1_500_000;
  const railCapacityReferenceFreightTonneKm = railCorridor.railCapacityReferenceFreightTonneKm ?? 3_000_000;
  const railBreakEvenUtilizationRatio = clamp(
    safeDivide(
      railFixedCostAnnual,
      Math.max(1, railCapacityReferencePassengerKm * railPassengerVariableCostPerKm
        + railCapacityReferenceFreightTonneKm * railFreightVariableCostPerTonneKm),
      1
    ),
    0,
    1.5
  );

  const railBreakEvenFreightTonneKm = Math.max(
    0,
    safeDivide(
      Math.max(0, railFixedCostAnnual - railPassengerRevenueEquivalent),
      Math.max(0.001, railFreightFeePerTonneKm - railFreightVariableCostPerTonneKm),
      railCorridor.railBreakEvenFreightReferenceTonneKm ?? 280_000
    )
  );
  const railBreakEvenPassengerKm = Math.max(
    0,
    safeDivide(
      Math.max(0, railFixedCostAnnual - railFreightRevenueEquivalent),
      Math.max(0.001, railFarePerPassengerKm - railPassengerVariableCostPerKm),
      railCorridor.railBreakEvenPassengerReferenceKm ?? 460_000
    )
  );
  const railBreakEvenMixedUtilization = clamp(
    safeDivide(
      railBreakEvenPassengerKm + railBreakEvenFreightTonneKm * 16,
      Math.max(1, railCapacityReferencePassengerKm + railCapacityReferenceFreightTonneKm * 16),
      1
    ),
    0,
    2
  );

  const averageRailTripKm = railCorridor.averageRailTripKm ?? 22;
  const estimatedRiders = Math.max(1, safeDivide(railPassengerKm, averageRailTripKm, 0));
  const railCostPerRiderYear = safeDivide(railTotalCost, estimatedRiders, 0);

  const thresholdNumerator = publicTransitCostPerPassengerKm
    - fixedVehicleCostPerKm
    - maintenanceCostPerKm
    - insuranceCostPerKm
    - roadExternalCostPerKm;
  const gasolineBreakEvenPriceForTransitPerLitre = fuelLitresPerKm > 0 ? thresholdNumerator / fuelLitresPerKm : null;
  const railThresholdNumerator = railCostPerPassengerKm
    - fixedVehicleCostPerKm
    - maintenanceCostPerKm
    - insuranceCostPerKm
    - roadExternalCostPerKm;
  const dieselBreakEvenPriceForRailPerLitre = fuelLitresPerKm > 0 ? railThresholdNumerator / fuelLitresPerKm : null;

  const householdPassengerKm = safeDivide(context.totalPassengerKmDemand ?? 0, Math.max(1, world.households.length), 0);
  const householdAnnualPrivateVehicleCost = householdPassengerKm * privateIceCostPerKm;
  const householdAnnualTransitEquivalentCost = householdPassengerKm * Math.min(publicTransitCostPerPassengerKm, railCostPerPassengerKm);

  const averageCarDependence = average(world.buildings.map((item) => item.metrics?.carDependenceIndex ?? 0.6), 0.6);
  const carDependenceCostBurden = clamp(
    safeDivide(householdAnnualPrivateVehicleCost, Math.max(1, householdAnnualTransitEquivalentCost), 1) * averageCarDependence,
    0,
    4
  );

  const viableAlternatives = context.householdsWithViableRailAlternative ?? 0;
  const carDependentNoAlternative = context.householdsCarDependentNoAlternative ?? world.households.length;
  const viableShare = safeDivide(viableAlternatives, Math.max(1, world.households.length), 0);
  const privateVehicleCostBurdenWithAlternative = carDependenceCostBurden * (0.78 + (1 - viableShare) * 0.15);
  const privateVehicleCostBurdenWithoutAlternative = carDependenceCostBurden * (1.05 + (1 - viableShare) * 0.2);

  return {
    privateIceCostPerKm,
    privateEvCostPerKm,
    publicTransitCostPerPassengerKm,
    publicTransitElectricCostPerPassengerKm,
    railCostPerPassengerKm,
    railCostPerTonneKm,
    railPassengerCostPerKmAtUtilization,
    railFreightCostPerTonneKmAtUtilization,
    railFixedCostAnnual,
    railVariableCostAnnual,
    railBreakEvenUtilizationRatio,
    railCostRecoveryRatioDirect,
    railCostRecoveryRatioWithAvoidedCosts,
    railCostRecoveryRatio: railCostRecoveryRatioDirect,
    railPublicSubsidyRequired,
    railCostPerRiderYear,
    roadCostPerPassengerKm: context.roadCostPerPassengerKm ?? 0,
    roadCostPerTonneKm: context.roadCostPerTonneKm ?? 0,
    railPassengerRevenueEquivalent,
    railFreightRevenueEquivalent,
    railAvoidedRoadMaintenanceValue,
    railAvoidedDieselValue,
    railSpoilageReductionValue,
    railEmergencySupplyResilienceValue,
    railTotalBenefitEquivalent,
    railTotalCost,
    railNetCostAfterBenefits,
    railBenefitCostRatio,
    railBreakEvenFreightTonneKm,
    railBreakEvenPassengerKm,
    railBreakEvenMixedUtilization,
    gasolineBreakEvenPriceForTransitPerLitre,
    dieselBreakEvenPriceForRailPerLitre,
    householdAnnualPrivateVehicleCost,
    householdAnnualTransitEquivalentCost,
    carDependenceCostBurden,
    averageCarDependenceCostBurden: carDependenceCostBurden,
    householdsWithViableRailAlternative: viableAlternatives,
    householdsCarDependentNoAlternative: carDependentNoAlternative,
    privateVehicleCostBurdenWithAlternative,
    privateVehicleCostBurdenWithoutAlternative,
    fuelPriceInducedRailPassengerKm: context.fuelPriceInducedRailPassengerKm ?? 0,
    fuelPriceInducedBusPassengerKm: context.fuelPriceInducedBusPassengerKm ?? 0,
    privateVehicleCostComponents: {
      fixedVehicleCostAnnual,
      maintenanceCostPerKm,
      insuranceCostPerKm,
      fuelLitresPerKm,
      gasolinePricePerLitre: prices.gasoline
    }
  };
}
