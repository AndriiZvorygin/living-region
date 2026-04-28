// SPDX-License-Identifier: AGPL-3.0-or-later
import { clamp01 } from '../util/math.mjs';

const ROAD_TYPES = ['road', 'bridge'];
const TRAIL_TYPES = ['trail'];
const RAIL_TYPES = ['rail'];
const WATER_TYPES = ['water'];
const POWER_TYPES = ['powerLine'];

function countByType(infrastructures, types) {
  return infrastructures.filter((infrastructure) => types.includes(infrastructure.type)).length;
}

export function getTransportModes(constants) {
  return constants?.transport?.modes ?? {};
}

export function modeAvailability(mode, access) {
  if (!mode) {
    return 0;
  }

  const required = mode.infrastructureRequired ?? [];
  if (required.length === 0) {
    return 1;
  }

  let availability = 1;
  for (const requirement of required) {
    availability *= access[requirement] ?? 0;
  }
  return clamp01(availability);
}

export function infrastructureAccessProfile(world) {
  const infrastructures = world.infrastructures ?? [];
  const roads = countByType(infrastructures, ROAD_TYPES);
  const trails = countByType(infrastructures, TRAIL_TYPES);
  const infraRail = countByType(infrastructures, RAIL_TYPES);
  const infraWater = countByType(infrastructures, WATER_TYPES);
  const power = countByType(infrastructures, POWER_TYPES);

  const segments = (world.networks ?? []).flatMap((network) => network.segments ?? []);
  const networkRoad = segments.filter((segment) => ['localRoad', 'collectorRoad', 'arterialRoad', 'highway', 'gravelRoad'].includes(segment.type)).length;
  const networkTrail = segments.filter((segment) => segment.type === 'trailCartPath').length;
  const networkRail = segments.filter((segment) => ['traditionalRail', 'electrifiedRail'].includes(segment.type)).length;
  const networkWater = segments.filter((segment) => segment.type === 'waterRoute').length;

  const roadTotal = roads + networkRoad;
  const trailTotal = trails + networkTrail;
  const total = Math.max(1, infrastructures.length);
  const segmentTotal = Math.max(1, segments.length);
  const infraRailShare = infraRail / total;
  const infraWaterShare = infraWater / total;
  const networkRailShare = networkRail / segmentTotal;
  const networkWaterShare = networkWater / segmentTotal;

  return {
    road: clamp01((roadTotal / Math.max(1, total + segments.length)) * 4.4 + 0.1),
    trail: clamp01((trailTotal / Math.max(1, total + segments.length)) * 5.2 + 0.2),
    // Corridor access needs both network connectivity and local infrastructure.
    rail: clamp01(infraRailShare * 3.2 + networkRailShare * 1.6),
    water: clamp01(infraWaterShare * 3 + networkWaterShare * 1.4),
    powerLine: clamp01((power / total) * 3.8 + 0.25)
  };
}
