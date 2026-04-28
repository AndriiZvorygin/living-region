// SPDX-License-Identifier: AGPL-3.0-or-later
export function createPatch(input) {
  return {
    id: input.id,
    name: input.name,
    areaHa: input.areaHa,
    geometry: input.geometry ?? null,
    landUse: input.landUse,
    zoning: input.zoning ?? 'mixed',
    ownershipType: input.ownershipType ?? 'private',
    soil: {
      nitrogen: input.soil?.nitrogen ?? 0.5,
      phosphorus: input.soil?.phosphorus ?? 0.5,
      potassium: input.soil?.potassium ?? 0.5,
      carbon: input.soil?.carbon ?? 0.5,
      moisture: input.soil?.moisture ?? 0.5
    },
    conditions: {
      sun: input.conditions?.sun ?? 0.8,
      slope: input.conditions?.slope ?? 0.1,
      waterAccess: input.conditions?.waterAccess ?? 0.8,
      access: input.conditions?.access ?? 0.8
    },
    distance: {
      nearestRoadKm: input.distance?.nearestRoadKm ?? 1,
      nearestSettlementKm: input.distance?.nearestSettlementKm ?? 1,
      nearestMarketKm: input.distance?.nearestMarketKm ?? 1
    },
    plantGroupIds: input.plantGroupIds ?? [],
    buildingIds: input.buildingIds ?? [],
    infrastructureIds: input.infrastructureIds ?? [],
    metrics: input.metrics ?? {}
  };
}
