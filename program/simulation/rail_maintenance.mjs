// SPDX-License-Identifier: AGPL-3.0-or-later
import { average, clamp, safeDivide } from '../util/math.mjs';

const RAIL_TYPES = new Set(['traditionalRail', 'electrifiedRail']);

function railSegments(world) {
  return world.networks.flatMap((network) => network.segments ?? []).filter((segment) => RAIL_TYPES.has(segment.type));
}

export function applyRailMaintenance(world, context) {
  const constants = context.constants?.railMaintenance ?? {};
  const railSegmentsList = railSegments(world);
  const backlogPrevious = context.previousRailBacklogMoney ?? 0;

  const freightTonneKm = context.railFreightTonneKm ?? 0;
  const passengerKm = context.railPassengerKm ?? 0;
  const trainKm = context.railTrainKm ?? 0;
  const budgetScale = context.railMaintenanceBudgetScale ?? 0;
  const railEnabled = context.railEnabled ?? false;

  const deferredBacklogPenalty = constants.deferredBacklogPenalty ?? 0.18;
  const freightWearFactor = constants.freightWearFactor ?? 0.00000055;
  const passengerWearFactor = constants.passengerWearFactor ?? 0.00000012;
  const electrificationOverheadMultiplier = constants.electrificationOverheadMultiplier ?? 1.16;
  const conditionDecayBase = constants.conditionDecayBase ?? 0.012;
  const conditionRecoveryFactor = constants.conditionRecoveryFactor ?? 0.02;
  const reliabilityConditionWeight = constants.reliabilityConditionWeight ?? 0.62;
  const reliabilityCoverageWeight = constants.reliabilityCoverageWeight ?? 0.24;
  const reliabilityRightOfWayWeight = constants.reliabilityRightOfWayWeight ?? 0.14;

  let railMaintenanceDemandMoney = 0;
  let railMaintenanceDemandLabourDays = 0;
  let railMaintenanceDemandMaterialsKg = 0;

  for (const segment of railSegmentsList) {
    const usageMultiplier = 1
      + freightTonneKm * freightWearFactor
      + passengerKm * passengerWearFactor
      + safeDivide(trainKm, 90_000, 0) * 0.2;
    const electrificationMultiplier = segment.electrified ? electrificationOverheadMultiplier : 1;
    const backlogMultiplier = 1 + safeDivide(backlogPrevious, 6_000_000, 0) * deferredBacklogPenalty;
    const demandMultiplier = Math.max(0.45, usageMultiplier * electrificationMultiplier * backlogMultiplier);

    railMaintenanceDemandMoney += segment.lengthKm * segment.maintenanceCostPerKmPerYear * demandMultiplier;
    railMaintenanceDemandLabourDays += segment.lengthKm * segment.maintenanceLabourDaysPerKmPerYear * demandMultiplier;
    railMaintenanceDemandMaterialsKg += segment.lengthKm * segment.maintenanceMaterialsKgPerKmPerYear * demandMultiplier;
  }

  const railMaintenanceBudgetMoney = railEnabled ? railMaintenanceDemandMoney * budgetScale : 0;
  const railMaintenanceCoverageRatio = railMaintenanceDemandMoney > 0
    ? clamp(safeDivide(railMaintenanceBudgetMoney, railMaintenanceDemandMoney, 0), 0, 1.1)
    : 1;
  const railMaintenanceBacklogMoney = Math.max(0, railMaintenanceDemandMoney - railMaintenanceBudgetMoney) + backlogPrevious * 0.4;

  const rightOfWayShare = railSegmentsList.length > 0
    ? railSegmentsList.filter((segment) => ['active', 'protected'].includes(segment.rightOfWayStatus)).length / railSegmentsList.length
    : 0;

  for (const segment of railSegmentsList) {
    const decay = conditionDecayBase * (1 + (1 - railMaintenanceCoverageRatio) * 1.1);
    const recovery = conditionRecoveryFactor * Math.max(0, railMaintenanceCoverageRatio - 0.5);
    segment.condition = clamp(segment.condition + recovery - decay, 0.08, 1);
    segment.metrics = {
      ...segment.metrics,
      maintenanceDemandMoney: segment.lengthKm * segment.maintenanceCostPerKmPerYear,
      maintenanceBacklogMoney: railMaintenanceBacklogMoney * safeDivide(segment.lengthKm, Math.max(1, railSegmentsList.reduce((sum, item) => sum + item.lengthKm, 0)), 0),
      maintenancePriority: clamp((1 - segment.condition) * 0.65 + (segment.electrified ? 0.2 : 0.05) + (segment.rightOfWayStatus !== 'active' ? 0.15 : 0), 0, 1)
    };
  }

  const railConditionAverage = average(railSegmentsList.map((segment) => segment.condition), railEnabled ? 0.6 : 0);
  const railServiceReliability = railEnabled
    ? clamp(
      railConditionAverage * reliabilityConditionWeight
      + railMaintenanceCoverageRatio * reliabilityCoverageWeight
      + rightOfWayShare * reliabilityRightOfWayWeight,
      0,
      1
    )
    : 0;

  return {
    railMaintenanceDemandMoney,
    railMaintenanceDemandLabourDays,
    railMaintenanceDemandMaterialsKg,
    railMaintenanceBudgetMoney,
    railMaintenanceBacklogMoney,
    railMaintenanceCoverageRatio,
    railConditionAverage,
    railServiceReliability,
    railEnabled
  };
}
