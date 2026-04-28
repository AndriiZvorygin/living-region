// SPDX-License-Identifier: AGPL-3.0-or-later
import { clamp, safeDivide } from '../util/math.mjs';

const RAIL_TYPES = new Set(['traditionalRail', 'electrifiedRail']);

function railSegments(world) {
  return world.networks.flatMap((network) => network.segments ?? []).filter((segment) => RAIL_TYPES.has(segment.type));
}

export function applyRailElectrification(world, context) {
  const constants = context.constants?.railElectrification ?? {};
  const scenarioRail = context.rail ?? {};
  const segments = railSegments(world);

  const railEnabled = scenarioRail.enableRail ?? false;
  const electrifyRail = scenarioRail.electrifyRail ?? false;
  const annualRate = scenarioRail.annualRailElectrificationRate ?? 0;

  const electrificationCapitalCostPerKm = constants.electrificationCapitalCostPerKm ?? 620_000;
  const electrificationMaintenanceCostPerKmPerYear = constants.electrificationMaintenanceCostPerKmPerYear ?? 7_500;
  const electrificationEnergyKwhPerTrainKm = constants.electrificationEnergyKwhPerTrainKm ?? 13;
  const substationCostPerUnit = constants.substationCostPerUnit ?? 3_200_000;
  const activationThresholdProgress = constants.activationThresholdProgress ?? 0.92;

  let annualElectrificationCapital = 0;
  let annualElectrificationMaintenance = 0;

  for (const segment of segments) {
    if (!railEnabled) {
      segment.electrified = false;
      segment.electricTractionAvailable = false;
      segment.dieselTractionAvailable = true;
      segment.electrificationStatus = 'none';
      segment.electrificationProgress = 0;
      continue;
    }

    if (!electrifyRail || segment.type === 'waterRoute') {
      segment.electrificationStatus = segment.electrified ? 'active' : 'none';
      continue;
    }

    if (segment.type === 'traditionalRail' && segment.rightOfWayStatus !== 'missing' && segment.rightOfWayStatus !== 'abandoned') {
      segment.electrificationStatus = segment.electrificationProgress > 0 ? 'planned' : 'planned';
      const previousProgress = segment.electrificationProgress ?? 0;
      segment.electrificationProgress = clamp(previousProgress + annualRate, 0, 1);

      const deltaProgress = Math.max(0, segment.electrificationProgress - previousProgress);
      annualElectrificationCapital += deltaProgress * segment.lengthKm * (segment.electrificationCapitalCostPerKm ?? electrificationCapitalCostPerKm);
      annualElectrificationCapital += deltaProgress * (segment.substationRequirement ?? 0) * substationCostPerUnit;

      if (segment.electrificationProgress >= activationThresholdProgress) {
        segment.electrified = true;
        segment.electricTractionAvailable = true;
        segment.dieselTractionAvailable = true;
        segment.electrificationStatus = 'active';
      }
    }

    if (segment.electrified) {
      annualElectrificationMaintenance += segment.lengthKm * (segment.electrificationMaintenanceCostPerKmPerYear ?? electrificationMaintenanceCostPerKmPerYear);
      segment.electrificationEnergyKwhPerTrainKm = segment.electrificationEnergyKwhPerTrainKm ?? electrificationEnergyKwhPerTrainKm;
    }
  }

  const electrifiedLengthKm = segments.filter((segment) => segment.electrified).reduce((sum, segment) => sum + segment.lengthKm, 0);
  const railLengthKm = segments.reduce((sum, segment) => sum + segment.lengthKm, 0);
  const electrifiedShare = safeDivide(electrifiedLengthKm, railLengthKm, 0);

  return {
    railEnabled,
    railElectrified: electrifyRail,
    annualElectrificationCapital,
    annualElectrificationMaintenance,
    electrifiedLengthKm,
    railLengthKm,
    electrifiedShare
  };
}
