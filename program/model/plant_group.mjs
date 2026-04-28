// SPDX-License-Identifier: AGPL-3.0-or-later
export function createPlantGroup(input) {
  return {
    id: input.id,
    patchId: input.patchId,
    name: input.name,
    functionalType: input.functionalType ?? 'crop',
    areaShare: input.areaShare ?? 1,
    ageYears: input.ageYears ?? 1,
    traits: {
      perennial: input.traits?.perennial ?? false,
      maturityYears: input.traits?.maturityYears ?? 1,
      rootDepth: input.traits?.rootDepth ?? 0.5,
      canopyHeight: input.traits?.canopyHeight ?? 1,
      shadeTolerance: input.traits?.shadeTolerance ?? 0.5,
      droughtTolerance: input.traits?.droughtTolerance ?? 0.5,
      nitrogenFixing: input.traits?.nitrogenFixing ?? false,
      labour: {
        establishDaysPerHa: input.traits?.labour?.establishDaysPerHa ?? 5,
        annualCareDaysPerHa: input.traits?.labour?.annualCareDaysPerHa ?? 8,
        harvestDaysPerTonne: input.traits?.labour?.harvestDaysPerTonne ?? 0.5
      },
      yields: {
        caloriesPerHaAtMaturity: input.traits?.yields?.caloriesPerHaAtMaturity ?? 1_500_000,
        biomassKgPerHaAtMaturity: input.traits?.yields?.biomassKgPerHaAtMaturity ?? 6_000,
        woodKgPerHaAtMaturity: input.traits?.yields?.woodKgPerHaAtMaturity ?? 0,
        fertilityContribution: input.traits?.yields?.fertilityContribution ?? 0
      },
      soilEffects: {
        nitrogenDelta: input.traits?.soilEffects?.nitrogenDelta ?? 0,
        carbonDelta: input.traits?.soilEffects?.carbonDelta ?? 0,
        erosionProtection: input.traits?.soilEffects?.erosionProtection ?? 0.3
      }
    }
  };
}
