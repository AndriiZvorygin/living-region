// SPDX-License-Identifier: AGPL-3.0-or-later
import { clamp, safeDivide } from '../util/math.mjs';

export function calculateBreakEvenDiagnostics(context) {
  const annualFixedCost = context.railFixedCostAnnual ?? 0;
  const annualVariableCost = context.railVariableCostAnnual ?? 0;
  const railTotalCost = context.railTotalCost ?? (annualFixedCost + annualVariableCost);

  const railPassengerRevenueEquivalent = context.railPassengerRevenueEquivalent ?? 0;
  const railFreightRevenueEquivalent = context.railFreightRevenueEquivalent ?? 0;
  const railAvoidedRoadMaintenanceValue = context.railAvoidedRoadMaintenanceValue ?? 0;
  const railAvoidedDieselValue = context.railAvoidedDieselValue ?? 0;
  const railSpoilageReductionValue = context.railSpoilageReductionValue ?? 0;
  const railTotalBenefitEquivalent = context.railTotalBenefitEquivalent ?? 0;

  const currentPassengerKm = context.railPassengerKm ?? 0;
  const currentFreightTonneKm = context.railFreightTonneKm ?? 0;

  const directRevenuePerPassengerKm = safeDivide(railPassengerRevenueEquivalent, Math.max(1, currentPassengerKm), 0);
  const directRevenuePerFreightTonneKm = safeDivide(railFreightRevenueEquivalent, Math.max(1, currentFreightTonneKm), 0);

  const avoidedCostPerPassengerKm = safeDivide(
    railAvoidedRoadMaintenanceValue * 0.35 + railAvoidedDieselValue * 0.45,
    Math.max(1, currentPassengerKm),
    0
  );
  const avoidedCostPerFreightTonneKm = safeDivide(
    railAvoidedRoadMaintenanceValue * 0.65 + railAvoidedDieselValue * 0.55 + railSpoilageReductionValue,
    Math.max(1, currentFreightTonneKm),
    0
  );

  const effectiveBenefitPerPassengerKm = directRevenuePerPassengerKm + avoidedCostPerPassengerKm;
  const effectiveBenefitPerFreightTonneKm = directRevenuePerFreightTonneKm + avoidedCostPerFreightTonneKm;

  const requiredPassengerKmIfPassengerOnly = Math.max(
    0,
    safeDivide(railTotalCost, Math.max(0.000001, effectiveBenefitPerPassengerKm), 0)
  );
  const requiredFreightTonneKmIfFreightOnly = Math.max(
    0,
    safeDivide(railTotalCost, Math.max(0.000001, effectiveBenefitPerFreightTonneKm), 0)
  );

  const railPassengerCapacityKm = context.railPassengerCapacityKm ?? 1;
  const railFreightCapacityTonneKm = context.railFreightCapacityTonneKm ?? 1;
  const requiredMixedUtilization = clamp(
    safeDivide(
      requiredPassengerKmIfPassengerOnly + requiredFreightTonneKmIfFreightOnly * 16,
      Math.max(1, railPassengerCapacityKm + railFreightCapacityTonneKm * 16),
      1
    ),
    0,
    4
  );

  const passengerScaleMultiplierNeeded = currentPassengerKm > 0
    ? requiredPassengerKmIfPassengerOnly / currentPassengerKm
    : 999;
  const freightScaleMultiplierNeeded = currentFreightTonneKm > 0
    ? requiredFreightTonneKmIfFreightOnly / currentFreightTonneKm
    : 999;
  const mixedScaleMultiplierNeeded = clamp(
    safeDivide(
      requiredMixedUtilization,
      Math.max(0.0001, context.weightedUtilizationRatio ?? context.railUtilizationRatio ?? 0),
      999
    ),
    0,
    999
  );

  return {
    annualFixedCost,
    annualVariableCost,
    directRevenuePerPassengerKm,
    directRevenuePerFreightTonneKm,
    avoidedCostPerPassengerKm,
    avoidedCostPerFreightTonneKm,
    effectiveBenefitPerPassengerKm,
    effectiveBenefitPerFreightTonneKm,
    requiredPassengerKmIfPassengerOnly,
    requiredFreightTonneKmIfFreightOnly,
    requiredMixedUtilization,
    currentPassengerKm,
    currentFreightTonneKm,
    passengerScaleMultiplierNeeded,
    freightScaleMultiplierNeeded,
    mixedScaleMultiplierNeeded,
    railTotalBenefitEquivalent
  };
}
