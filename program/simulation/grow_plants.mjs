// SPDX-License-Identifier: AGPL-3.0-or-later
import { calculatePlantGroupProduction } from './land_productivity.mjs';

export function growPlants(world, context) {
  const patchById = new Map(world.patches.map((patch) => [patch.id, patch]));
  const patchOutputs = new Map();

  for (const patch of world.patches) {
    patchOutputs.set(patch.id, {
      producedCalories: 0,
      producedBiomassKg: 0,
      producedWoodKg: 0,
      producedFodderKg: 0,
      labourDemandFoodDays: 0,
      foodProductionPotential: 0,
      dominantPlantGroup: null
    });
  }

  for (const group of world.plantGroups) {
    const patch = patchById.get(group.patchId);
    if (!patch) {
      continue;
    }

    const result = calculatePlantGroupProduction(group, patch, context);
    const patchOutput = patchOutputs.get(patch.id);

    patchOutput.producedCalories += result.grossCalories;
    patchOutput.producedBiomassKg += result.grossBiomassKg;
    patchOutput.producedWoodKg += result.grossWoodKg;
    const fodderShare = ['grassland', 'pasture', 'mixed', 'regrowth'].includes(group.functionalType) ? 0.45 : 0.08;
    patchOutput.producedFodderKg += result.grossBiomassKg * fodderShare;
    patchOutput.labourDemandFoodDays += result.labourDemandFoodDays;
    patchOutput.foodProductionPotential += patch.areaHa * group.areaShare * group.traits.yields.caloriesPerHaAtMaturity;

    if (!patchOutput.dominantPlantGroup || result.grossCalories > (patchOutput.dominantPlantGroupCalories ?? 0)) {
      patchOutput.dominantPlantGroup = group.name;
      patchOutput.dominantPlantGroupCalories = result.grossCalories;
    }
  }

  let producedCalories = 0;
  let producedBiomassKg = 0;
  let producedWoodKg = 0;
  let producedFodderKg = 0;
  let labourDemandFoodDays = 0;

  for (const patch of world.patches) {
    const output = patchOutputs.get(patch.id);
    producedCalories += output.producedCalories;
    producedBiomassKg += output.producedBiomassKg;
    producedWoodKg += output.producedWoodKg;
    producedFodderKg += output.producedFodderKg;
    labourDemandFoodDays += output.labourDemandFoodDays;

    patch.metrics = {
      ...patch.metrics,
      producedCalories: output.producedCalories,
      producedBiomassKg: output.producedBiomassKg,
      producedWoodKg: output.producedWoodKg,
      producedFodderKg: output.producedFodderKg,
      labourDemandFoodDays: output.labourDemandFoodDays,
      foodProductionPotential: output.foodProductionPotential,
      dominantPlantGroup: output.dominantPlantGroup
    };
  }

  return {
    producedCalories,
    producedBiomassKg,
    producedWoodKg,
    producedFodderKg,
    labourDemandFoodDays
  };
}
