// SPDX-License-Identifier: AGPL-3.0-or-later

function count(value) {
  return Array.isArray(value) ? value.length : 0;
}

function pickNumber(value, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

export function summarizeGreySecondaryCollections(world = {}) {
  const summary = world?.seedMeta?.summary ?? {};

  const transitStopCount = count(world.transitStops) || pickNumber(summary.transitStopCount, 0);
  const transitRouteCount = count(world.transitRoutes) || pickNumber(summary.transitRouteCount, 0);
  const cyclingRouteFeatureCount = count(world.cyclingRoutes) || pickNumber(summary.cyclingRouteFeatureCount, 0);
  const trailFeatureCount = count(world.trails) || pickNumber(summary.trailFeatureCount, 0);
  const managedForestFeatureCount = count(world.forestAreas) || pickNumber(summary.managedForestFeatureCount, 0);
  const hazardousForestFeatureCount = count(world.riskAreas) || pickNumber(summary.hazardousForestFeatureCount, 0);
  const ruralBusinessCount = count(world.ruralBusinesses) || pickNumber(summary.ruralBusinessCount, 0);
  const facilityCount = count(world.facilities) || pickNumber(summary.facilityCount, 0);
  const roadStructureCount = count(world.roadStructures) || pickNumber(summary.roadStructureCount, 0);
  const roadConditionFeatureCount = pickNumber(summary.roadConditionFeatureCount, 0);
  const roadProjectCount = count(world.roadProjects) || pickNumber(summary.roadProjectCount, 0);
  const populationEstimateRecordCount = count(world.populationEstimates) || pickNumber(summary.populationEstimateRecordCount, pickNumber(summary.populationEstimateRecords, 0));

  const domains = [
    transitStopCount + transitRouteCount > 0,
    trailFeatureCount + cyclingRouteFeatureCount > 0,
    managedForestFeatureCount > 0,
    ruralBusinessCount > 0,
    facilityCount > 0,
    roadStructureCount + roadConditionFeatureCount + roadProjectCount > 0
  ];
  const secondaryDataCoverageScore = domains.filter(Boolean).length / domains.length;

  return {
    transitStopCount,
    transitRouteCount,
    trailFeatureCount,
    cyclingRouteFeatureCount,
    managedForestFeatureCount,
    hazardousForestFeatureCount,
    ruralBusinessCount,
    facilityCount,
    roadStructureCount,
    roadConditionFeatureCount,
    roadProjectCount,
    populationEstimateRecordCount,
    secondaryDataCoverageScore
  };
}
