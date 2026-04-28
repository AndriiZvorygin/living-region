// SPDX-License-Identifier: AGPL-3.0-or-later
export function createAnimalGroup(input) {
  return {
    id: input.id,
    patchId: input.patchId,
    name: input.name,
    species: input.species ?? 'mixed',
    count: input.count ?? 0,
    feedDemandCalories: input.feedDemandCalories ?? 0,
    products: input.products ?? {}
  };
}
