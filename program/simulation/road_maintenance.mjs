// SPDX-License-Identifier: AGPL-3.0-or-later
import { average, clamp, safeDivide } from '../util/math.mjs';

const ROAD_TYPES = new Set(['localRoad', 'collectorRoad', 'arterialRoad', 'highway', 'gravelRoad', 'trailCartPath']);

function roadSegments(world) {
  return world.networks.flatMap((network) => network.segments ?? []).filter((segment) => ROAD_TYPES.has(segment.type));
}

export function applyRoadMaintenance(world, context) {
  const constants = context.constants?.roadMaintenance ?? {};
  const segments = roadSegments(world);
  const backlogPrevious = context.previousRoadBacklogMoney ?? 0;

  const heavyTruckTonneKm = context.heavyTruckTonneKm ?? 0;
  const vehicleKm = context.vehicleKm ?? 0;
  const budgetScale = context.roadMaintenanceBudgetScale ?? 1;

  const deferredBacklogPenalty = constants.deferredBacklogPenalty ?? 0.22;
  const backlogCatchupEfficiency = constants.backlogCatchupEfficiency ?? 0.45;
  const heavyTruckWearFactor = constants.heavyTruckWearFactor ?? 0.0000012;
  const freezeThawStressMultiplier = constants.freezeThawStressMultiplier ?? 0.28;
  const bridgeStressMultiplier = constants.bridgeStressMultiplier ?? 0.2;
  const winterServiceMultiplier = constants.winterServiceMultiplier ?? 0.22;
  const conditionDecayBase = constants.conditionDecayBase ?? 0.018;
  const conditionRecoveryFactor = constants.conditionRecoveryFactor ?? 0.025;

  let roadMaintenanceDemandMoney = 0;
  let roadMaintenanceDemandLabourDays = 0;
  let roadMaintenanceDemandMaterialsKg = 0;

  for (const segment of segments) {
    const heavyWear = 1 + heavyTruckTonneKm * heavyTruckWearFactor;
    const stressMultiplier = 1
      + (segment.climateStressFactor - 1) * freezeThawStressMultiplier
      + (segment.bridgeOrCulvertFactor - 1) * bridgeStressMultiplier
      + (segment.winterMaintenanceFactor - 1) * winterServiceMultiplier;

    const demandMultiplier = Math.max(0.7, heavyWear * stressMultiplier + safeDivide(backlogPrevious, 4_000_000, 0) * deferredBacklogPenalty);

    roadMaintenanceDemandMoney += segment.lengthKm * segment.maintenanceCostPerKmPerYear * demandMultiplier;
    roadMaintenanceDemandLabourDays += segment.lengthKm * segment.maintenanceLabourDaysPerKmPerYear * demandMultiplier;
    roadMaintenanceDemandMaterialsKg += segment.lengthKm * segment.maintenanceMaterialsKgPerKmPerYear * demandMultiplier;
  }

  const roadMaintenanceBudgetMoney = roadMaintenanceDemandMoney * budgetScale;
  const roadMaintenanceCoverageRatio = clamp(safeDivide(roadMaintenanceBudgetMoney, roadMaintenanceDemandMoney, 1), 0, 1.15);
  const unmetCurrentDemand = Math.max(0, roadMaintenanceDemandMoney - roadMaintenanceBudgetMoney);
  const surplusBudget = Math.max(0, roadMaintenanceBudgetMoney - roadMaintenanceDemandMoney);
  const backlogReduction = surplusBudget * backlogCatchupEfficiency;
  const roadMaintenanceBacklogMoney = Math.max(0, backlogPrevious + unmetCurrentDemand - backlogReduction);

  const conditionDeltas = [];
  for (const segment of segments) {
    const vehicleWearPenalty = (vehicleKm / Math.max(1, segments.length)) * 0.00000025;
    const decay = conditionDecayBase * (1 + (1 - roadMaintenanceCoverageRatio) + vehicleWearPenalty);
    const recovery = conditionRecoveryFactor * Math.max(0, roadMaintenanceCoverageRatio - 0.6);
    const conditionDelta = recovery - decay;
    segment.condition = clamp(segment.condition + conditionDelta, 0.12, 1);
    segment.metrics = {
      ...segment.metrics,
      maintenanceDemandMoney: segment.lengthKm * segment.maintenanceCostPerKmPerYear,
      maintenanceBacklogMoney: roadMaintenanceBacklogMoney * safeDivide(segment.lengthKm, Math.max(1, segments.reduce((sum, item) => sum + item.lengthKm, 0)), 0),
      roadConditionStress: 1 - segment.condition,
      maintenancePriority: clamp((1 - segment.condition) * 0.7 + segment.bridgeOrCulvertFactor * 0.2 + segment.climateStressFactor * 0.1, 0, 1)
    };
    conditionDeltas.push(conditionDelta);
  }

  const roadConditionAverageByType = {};
  for (const type of ROAD_TYPES) {
    const typed = segments.filter((segment) => segment.type === type);
    if (typed.length > 0) {
      roadConditionAverageByType[type] = average(typed.map((segment) => segment.condition), 0.7);
    }
  }

  const roadConditionAverage = average(segments.map((segment) => segment.condition), 0.7);
  const roadConditionDelta = average(conditionDeltas, 0);

  return {
    roadMaintenanceDemandMoney,
    roadMaintenanceDemandLabourDays,
    roadMaintenanceDemandMaterialsKg,
    roadMaintenanceBudgetMoney,
    roadMaintenanceBacklogMoney,
    roadMaintenanceCoverageRatio,
    roadConditionDelta,
    roadConditionAverageByType,
    roadConditionAverage,
    heavyTruckTonneKm,
    vehicleKm
  };
}
