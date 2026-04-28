// SPDX-License-Identifier: AGPL-3.0-or-later
export function createInfrastructure(input) {
  return {
    id: input.id,
    patchId: input.patchId,
    networkId: input.networkId ?? null,
    settlementId: input.settlementId ?? null,
    type: input.type,
    condition: input.condition ?? 0.8,
    capacity: input.capacity ?? 1,
    catchmentRadiusKm: input.catchmentRadiusKm ?? 0,
    walkCatchmentPeople: input.walkCatchmentPeople ?? 0,
    bicycleCatchmentPeople: input.bicycleCatchmentPeople ?? 0,
    parkAndRideCatchmentPeople: input.parkAndRideCatchmentPeople ?? 0,
    freightCatchmentHa: input.freightCatchmentHa ?? 0,
    passengerCapacityPerYear: input.passengerCapacityPerYear ?? 0,
    freightCapacityTonnePerYear: input.freightCapacityTonnePerYear ?? 0,
    serviceFrequencyPerDay: input.serviceFrequencyPerDay ?? 0,
    loadingLabourDaysPerTonne: input.loadingLabourDaysPerTonne ?? 0,
    transferCostPerPassenger: input.transferCostPerPassenger ?? 0,
    transferCostPerTonne: input.transferCostPerTonne ?? 0,
    localAccessBonus: input.localAccessBonus ?? 0,
    developmentAttraction: input.developmentAttraction ?? 0,
    freightAnchorStrength: input.freightAnchorStrength ?? 0,
    commodityTypes: input.commodityTypes ?? [],
    annualThroughputTonnes: input.annualThroughputTonnes ?? 0,
    railCapturePotential: input.railCapturePotential ?? 0,
    roadCapturePotential: input.roadCapturePotential ?? 0,
    storageCapacityTonnes: input.storageCapacityTonnes ?? 0,
    spoilageReduction: input.spoilageReduction ?? 0,
    loadingEfficiency: input.loadingEfficiency ?? 0,
    anchorStrength: input.anchorStrength ?? input.freightAnchorStrength ?? 0,
    maintenanceCostPerYear: input.maintenanceCostPerYear ?? input.maintenance?.moneyPerYear ?? 0,
    serviceFrequencyRequirement: input.serviceFrequencyRequirement ?? 0,
    stationId: input.stationId ?? null,
    effects: {
      transportCostReduction: input.effects?.transportCostReduction ?? 0,
      spoilageReduction: input.effects?.spoilageReduction ?? 0,
      processingLabourReduction: input.effects?.processingLabourReduction ?? 0,
      storageCalories: input.effects?.storageCalories ?? 0,
      serviceAccessBonus: input.effects?.serviceAccessBonus ?? 0
    },
    maintenance: {
      labourDaysPerYear: input.maintenance?.labourDaysPerYear ?? 10,
      materialKgPerYear: input.maintenance?.materialKgPerYear ?? 100,
      moneyPerYear: input.maintenance?.moneyPerYear ?? 1_000
    }
  };
}
