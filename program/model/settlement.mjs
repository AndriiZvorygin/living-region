// SPDX-License-Identifier: AGPL-3.0-or-later
export function createSettlement(input) {
  return {
    id: input.id,
    name: input.name,
    patchIds: input.patchIds ?? [],
    householdIds: input.householdIds ?? [],
    buildingIds: input.buildingIds ?? [],
    infrastructureIds: input.infrastructureIds ?? [],
    populationUrban: input.populationUrban ?? 0,
    populationRural: input.populationRural ?? 0,
    socialCohesion: input.socialCohesion ?? 0.7,
    institutionalTrust: input.institutionalTrust ?? 0.6,
    metrics: input.metrics ?? {}
  };
}
