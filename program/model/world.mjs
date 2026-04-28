// SPDX-License-Identifier: AGPL-3.0-or-later
import { validateWorld } from '../util/validate.mjs';

export function createWorld(input) {
  const world = {
    year: input.year ?? null,
    patches: input.patches ?? [],
    plantGroups: input.plantGroups ?? [],
    households: input.households ?? [],
    buildings: input.buildings ?? [],
    infrastructures: input.infrastructures ?? [],
    settlements: input.settlements ?? [],
    networks: input.networks ?? [],
    markets: input.markets ?? [],
    metricsByYear: input.metricsByYear ?? []
  };
  validateWorld(world);
  return world;
}

export function cloneWorld(world) {
  return structuredClone(world);
}
