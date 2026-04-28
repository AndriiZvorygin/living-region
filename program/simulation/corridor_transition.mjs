// SPDX-License-Identifier: AGPL-3.0-or-later
import { clamp01 } from '../util/math.mjs';

function isTransitionCandidate(patch) {
  return ['vacant', 'mixed', 'residential', 'commercial', 'industrial', 'cropland'].includes(patch.landUse);
}

function patchNearStationFactor(patch) {
  const distance = patch.distance.nearestSettlementKm * 0.6 + patch.distance.nearestRoadKm * 0.5;
  return clamp01(1 - distance / 6);
}

export function applyCorridorTransition(world, context) {
  const adaptation = context.adaptation ?? {};
  const rail = context.rail ?? {};
  const stationCatchments = context.stationCatchments ?? { stationCount: 0, freightAnchorStrength: 0 };
  const constants = context.constants?.railCorridor ?? {};

  if (!rail.enableRail || stationCatchments.stationCount <= 0) {
    return {
      stationAreaPopulationAdded: 0,
      stationAreaHousingUnitsAdded: 0,
      stationAreaJobsAdded: 0,
      stationAreaServiceCapacityAdded: 0,
      stationAreaFreightPotentialAdded: 0,
      hectaresTransitionedNearStations: 0
    };
  }

  const transitionRate = adaptation.annualRailCorridorTransitionRate ?? 0;
  const maxTransitionShare = constants.maxHectaresTransitionSharePerYear ?? 0.05;
  const effectiveTransitionShare = clamp01(transitionRate * 3 + (rail.corridorBuildoutLevel ?? 0) * 0.04);

  let hectaresTransitionedNearStations = 0;
  let stationAreaPopulationAdded = 0;
  let stationAreaHousingUnitsAdded = 0;
  let stationAreaJobsAdded = 0;
  let stationAreaServiceCapacityAdded = 0;
  let stationAreaFreightPotentialAdded = 0;

  for (const patch of world.patches) {
    if (!isTransitionCandidate(patch)) {
      continue;
    }

    const proximity = patchNearStationFactor(patch);
    if (proximity <= 0.2) {
      continue;
    }

    const walkAccess = patch.metrics?.walkAccessIndex ?? 0.3;
    const serviceCoverage = patch.metrics?.localServiceAccessIndex ?? 0.3;
    const trustFactor = (world.settlements.find((settlement) => settlement.patchIds.includes(patch.id))?.institutionalTrust ?? 0.5);
    const suitability = clamp01(
      proximity * 0.45
      + walkAccess * 0.2
      + serviceCoverage * 0.2
      + trustFactor * 0.1
      + stationCatchments.freightAnchorStrength * 0.05
    );

    const transitionedHa = patch.areaHa * maxTransitionShare * effectiveTransitionShare * suitability;
    if (transitionedHa <= 0.01) {
      continue;
    }

    hectaresTransitionedNearStations += transitionedHa;

    const housingUnitsAdded = transitionedHa * (patch.landUse === 'residential' || patch.landUse === 'mixed' ? 1.6 : 0.8);
    const jobsAdded = transitionedHa * (0.6 + stationCatchments.freightAnchorStrength * 0.9);
    const serviceCapacityAdded = transitionedHa * 0.08;
    const freightPotentialAdded = transitionedHa * (1.3 + stationCatchments.freightAnchorStrength * 1.2);

    stationAreaHousingUnitsAdded += housingUnitsAdded;
    stationAreaJobsAdded += jobsAdded;
    stationAreaServiceCapacityAdded += serviceCapacityAdded;
    stationAreaFreightPotentialAdded += freightPotentialAdded;
    stationAreaPopulationAdded += housingUnitsAdded * 2.1;

    patch.metrics = {
      ...patch.metrics,
      developmentPressure: (patch.metrics?.developmentPressure ?? 0.2) + suitability * 0.08,
      localServiceAccessIndex: clamp01((patch.metrics?.localServiceAccessIndex ?? 0.3) + serviceCapacityAdded * 0.01),
      walkAccessIndex: clamp01((patch.metrics?.walkAccessIndex ?? 0.3) + suitability * 0.02),
      freightAccessIndex: clamp01((patch.metrics?.freightAccessIndex ?? 0.3) + freightPotentialAdded * 0.003),
      transportResilienceScore: clamp01((patch.metrics?.transportResilienceScore ?? 0.4) + suitability * 0.03)
    };
  }

  // Apply compact-housing increment to existing residential stock near corridor settlements.
  for (const building of world.buildings) {
    if (!['dwelling', 'apartment', 'mixedUse'].includes(building.type)) {
      continue;
    }
    const patch = world.patches.find((item) => item.id === building.patchId);
    if (!patch) {
      continue;
    }
    const proximity = patchNearStationFactor(patch);
    if (proximity < 0.35) {
      continue;
    }

    const unitGrowth = effectiveTransitionShare * proximity * (building.type === 'apartment' ? 1.1 : 0.45);
    building.dwellingUnits += unitGrowth;
    building.occupiedUnits = Math.min(building.dwellingUnits, building.occupiedUnits + unitGrowth * 0.6);
  }

  return {
    stationAreaPopulationAdded,
    stationAreaHousingUnitsAdded,
    stationAreaJobsAdded,
    stationAreaServiceCapacityAdded,
    stationAreaFreightPotentialAdded,
    hectaresTransitionedNearStations
  };
}
