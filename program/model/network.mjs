// SPDX-License-Identifier: AGPL-3.0-or-later
const VALID_NETWORK_TYPES = new Set([
  'localRoad',
  'collectorRoad',
  'arterialRoad',
  'highway',
  'gravelRoad',
  'trailCartPath',
  'traditionalRail',
  'electrifiedRail',
  'waterRoute',
  'road',
  'trail',
  'rail',
  'water'
]);

function normalizeType(type) {
  if (VALID_NETWORK_TYPES.has(type)) {
    return type;
  }
  return 'localRoad';
}

function normalizeSegment(segment, fallbackType) {
  const type = normalizeType(segment.type ?? fallbackType);
  return {
    id: segment.id,
    type,
    lengthKm: segment.lengthKm ?? 1,
    condition: segment.condition ?? 0.8,
    capacityPassengerKmPerYear: segment.capacityPassengerKmPerYear ?? 250_000,
    capacityTonneKmPerYear: segment.capacityTonneKmPerYear ?? 100_000,
    maintenanceCostPerKmPerYear: segment.maintenanceCostPerKmPerYear ?? 4_000,
    maintenanceLabourDaysPerKmPerYear: segment.maintenanceLabourDaysPerKmPerYear ?? 8,
    maintenanceMaterialsKgPerKmPerYear: segment.maintenanceMaterialsKgPerKmPerYear ?? 450,
    capitalRenewalCostPerKm: segment.capitalRenewalCostPerKm ?? 75_000,
    bridgeOrCulvertFactor: segment.bridgeOrCulvertFactor ?? 1,
    winterMaintenanceFactor: segment.winterMaintenanceFactor ?? 1,
    climateStressFactor: segment.climateStressFactor ?? 1,
    rightOfWayStatus: segment.rightOfWayStatus ?? 'active',
    electrified: segment.electrified ?? false,
    electricTractionAvailable: segment.electricTractionAvailable ?? false,
    dieselTractionAvailable: segment.dieselTractionAvailable ?? true,
    maxSpeedKmh: segment.maxSpeedKmh ?? 60,
    stopsOrSidings: segment.stopsOrSidings ?? 0,
    connectsSettlementIds: segment.connectsSettlementIds ?? [],
    notes: segment.notes ?? '',
    electrificationCapitalCostPerKm: segment.electrificationCapitalCostPerKm ?? 600_000,
    electrificationMaintenanceCostPerKmPerYear: segment.electrificationMaintenanceCostPerKmPerYear ?? 7_500,
    electrificationEnergyKwhPerTrainKm: segment.electrificationEnergyKwhPerTrainKm ?? 13,
    electrificationStatus: segment.electrificationStatus ?? (segment.electrified ? 'active' : 'none'),
    electrificationProgress: segment.electrificationProgress ?? (segment.electrified ? 1 : 0),
    substationRequirement: segment.substationRequirement ?? 0,
    gridReliabilityFactor: segment.gridReliabilityFactor ?? 0.85,
    geometry: segment.geometry ?? null,
    metrics: segment.metrics ?? {}
  };
}

export function createNetwork(input) {
  const type = normalizeType(input.type ?? 'localRoad');
  const segments = Array.isArray(input.segments) && input.segments.length > 0
    ? input.segments.map((segment, index) => normalizeSegment({ ...segment, id: segment.id ?? `${input.id}-segment-${index + 1}` }, type))
    : [normalizeSegment({
      id: `${input.id}-segment-1`,
      type,
      lengthKm: input.lengthKm ?? 4,
      condition: input.metrics?.averageCondition ?? 0.8,
      capacityPassengerKmPerYear: input.metrics?.capacityPassengerKmPerYear ?? 400_000,
      capacityTonneKmPerYear: input.metrics?.capacityTonneKmPerYear ?? 220_000,
      maintenanceCostPerKmPerYear: input.metrics?.maintenanceCostPerKmPerYear ?? 4_000,
      maintenanceLabourDaysPerKmPerYear: input.metrics?.maintenanceLabourDaysPerKmPerYear ?? 8,
      maintenanceMaterialsKgPerKmPerYear: input.metrics?.maintenanceMaterialsKgPerKmPerYear ?? 450,
      capitalRenewalCostPerKm: input.metrics?.capitalRenewalCostPerKm ?? 75_000,
      bridgeOrCulvertFactor: input.metrics?.bridgeOrCulvertFactor ?? 1,
      winterMaintenanceFactor: input.metrics?.winterMaintenanceFactor ?? 1,
      climateStressFactor: input.metrics?.climateStressFactor ?? 1,
      rightOfWayStatus: 'active',
      electrified: type === 'electrifiedRail',
      electricTractionAvailable: type === 'electrifiedRail',
      dieselTractionAvailable: type !== 'electrifiedRail',
      maxSpeedKmh: input.metrics?.maxSpeedKmh ?? 60,
      stopsOrSidings: input.metrics?.stopsOrSidings ?? 0,
      connectsSettlementIds: input.nodes ?? [],
      notes: ''
    }, type)] ;

  const totalLengthKm = segments.reduce((sum, segment) => sum + segment.lengthKm, 0);

  return {
    id: input.id,
    type,
    nodes: input.nodes ?? [],
    edges: input.edges ?? [],
    segments,
    metrics: {
      averageCondition: input.metrics?.averageCondition ?? 0.8,
      freightCostPerTonneKm: input.metrics?.freightCostPerTonneKm ?? 0.6,
      commuteCostPerKm: input.metrics?.commuteCostPerKm ?? 0.2,
      maintenanceBacklog: input.metrics?.maintenanceBacklog ?? 0,
      totalLengthKm,
      railServiceReliability: input.metrics?.railServiceReliability ?? 0.8,
      railUtilizationRatio: input.metrics?.railUtilizationRatio ?? 0,
      roadConditionStress: input.metrics?.roadConditionStress ?? 0,
      maintenancePriority: input.metrics?.maintenancePriority ?? 0.5
    }
  };
}
