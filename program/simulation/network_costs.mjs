// SPDX-License-Identifier: AGPL-3.0-or-later
import { average, clamp, safeDivide } from '../util/math.mjs';

const ROAD_TYPES = new Set(['localRoad', 'collectorRoad', 'arterialRoad', 'highway', 'gravelRoad', 'trailCartPath']);
const RAIL_TYPES = new Set(['traditionalRail', 'electrifiedRail']);

function allSegments(world) {
  return world.networks.flatMap((network) => network.segments ?? []);
}

function byTypes(world, typeSet) {
  return allSegments(world).filter((segment) => typeSet.has(segment.type));
}

export function summarizeNetworkConditions(world) {
  const segments = allSegments(world);
  const roadSegments = byTypes(world, ROAD_TYPES);
  const railSegments = byTypes(world, RAIL_TYPES);

  return {
    roadConditionAverage: average(roadSegments.map((segment) => segment.condition), 0.7),
    railConditionAverage: average(railSegments.map((segment) => segment.condition), 0.65),
    roadLengthKm: roadSegments.reduce((sum, segment) => sum + segment.lengthKm, 0),
    railLengthKm: railSegments.reduce((sum, segment) => sum + segment.lengthKm, 0),
    totalLengthKm: segments.reduce((sum, segment) => sum + segment.lengthKm, 0)
  };
}

export function calculateNetworkCosts(context) {
  const roadDemandMoney = context.roadMaintenanceDemandMoney ?? 0;
  const railDemandMoney = context.railMaintenanceDemandMoney ?? 0;
  const passengerKm = context.totalPassengerKmDemand ?? 0;
  const freightTonneKm = context.totalFreightTonneKmDemand ?? 0;
  const railPassengerKm = context.railPassengerKm ?? 0;
  const railFreightTonneKm = context.railFreightTonneKm ?? 0;
  const heavyTruckTonneKm = context.heavyTruckTonneKm ?? 0;

  const roadPassengerEquivalent = Math.max(1, passengerKm + freightTonneKm * 0.4);
  const railPassengerEquivalent = Math.max(1, railPassengerKm + railFreightTonneKm * 0.35);

  const roadCostPerPassengerKm = roadDemandMoney / roadPassengerEquivalent;
  const roadCostPerTonneKm = roadDemandMoney / Math.max(1, freightTonneKm);
  const railCostPerPassengerKm = railDemandMoney / railPassengerEquivalent;
  const railCostPerTonneKm = railDemandMoney / Math.max(1, railFreightTonneKm);

  const heavyTruckTonneKmAvoidedByRail = Math.max(0, railFreightTonneKm * 0.62);
  const avoidedRoadMaintenanceFromRailShift = heavyTruckTonneKmAvoidedByRail * clamp(
    safeDivide(roadDemandMoney, Math.max(1, heavyTruckTonneKm), 0),
    0,
    1.8
  );

  return {
    roadCostPerPassengerKm,
    roadCostPerTonneKm,
    railCostPerPassengerKm,
    railCostPerTonneKm,
    heavyTruckTonneKmAvoidedByRail,
    avoidedRoadMaintenanceFromRailShift
  };
}
