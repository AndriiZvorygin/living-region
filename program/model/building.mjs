// SPDX-License-Identifier: AGPL-3.0-or-later
export function createBuilding(input) {
  const rentPerMonth = input.rentPerMonth ?? 500;
  return {
    id: input.id,
    patchId: input.patchId,
    settlementId: input.settlementId,
    type: input.type,
    dwellingUnits: input.dwellingUnits ?? 0,
    occupiedUnits: input.occupiedUnits ?? 0,
    floorAreaM2: input.floorAreaM2 ?? 0,
    condition: input.condition ?? 0.8,
    // Monthly dollars per dwelling unit (not annual, not capital value).
    rentPerMonth,
    // Baseline monthly rent anchor used by bounded yearly updates.
    baseRentPerMonth: input.baseRentPerMonth ?? rentPerMonth,
    estimatedValue: input.estimatedValue ?? 120_000,
    energyUse: input.energyUse ?? 1,
    heatDemandKwhPerYear: input.heatDemandKwhPerYear ?? 18_000,
    insulationLevel: input.insulationLevel ?? 0.35,
    heatingSystem: input.heatingSystem ?? 'mixed',
    householdEnergyStorage: input.householdEnergyStorage ?? null,
    retrofitLevel: input.retrofitLevel ?? 0,
    maintenanceNeed: input.maintenanceNeed ?? 0.2,
    effects: {
      storageCalories: input.effects?.storageCalories ?? 0,
      productionCapacity: input.effects?.productionCapacity ?? 0,
      serviceCapacity: input.effects?.serviceCapacity ?? 0
    }
  };
}
