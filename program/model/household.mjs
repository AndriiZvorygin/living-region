// SPDX-License-Identifier: AGPL-3.0-or-later
export function createHousehold(input) {
  return {
    id: input.id,
    settlementId: input.settlementId,
    homeBuildingId: input.homeBuildingId,
    people: {
      total: input.people?.total ?? 3,
      workers: input.people?.workers ?? 2,
      dependents: input.people?.dependents ?? 1
    },
    income: {
      wageIncome: input.income?.wageIncome ?? 0,
      farmIncome: input.income?.farmIncome ?? 0,
      transferIncome: input.income?.transferIncome ?? 0,
      enterpriseIncome: input.income?.enterpriseIncome ?? 0
    },
    expenses: {
      food: input.expenses?.food ?? 0,
      housing: input.expenses?.housing ?? 0,
      transport: input.expenses?.transport ?? 0,
      fuel: input.expenses?.fuel ?? 0,
      taxes: input.expenses?.taxes ?? 0,
      debt: input.expenses?.debt ?? 0
    },
    skills: {
      farming: input.skills?.farming ?? 0.5,
      forestry: input.skills?.forestry ?? 0.5,
      repair: input.skills?.repair ?? 0.5,
      preserving: input.skills?.preserving ?? 0.5,
      trade: input.skills?.trade ?? 0.5,
      care: input.skills?.care ?? 0.5
    },
    access: {
      landHa: input.access?.landHa ?? 0,
      tools: input.access?.tools ?? 0.5,
      vehicleAccess: input.access?.vehicleAccess ?? 0.5,
      transitAccess: input.access?.transitAccess ?? 0.5,
      draftPower: input.access?.draftPower ?? 0.2,
      machinePower: input.access?.machinePower ?? 0.2,
      marketAccess: input.access?.marketAccess ?? 0.5
    },
    reserves: {
      calories: input.reserves?.calories ?? 50_000,
      firewoodKg: input.reserves?.firewoodKg ?? 500,
      cash: input.reserves?.cash ?? 1_000
    },
    preferences: {
      urbanPreference: input.preferences?.urbanPreference ?? 0.5,
      ruralPreference: input.preferences?.ruralPreference ?? 0.5,
      commuteTolerance: input.preferences?.commuteTolerance ?? 0.5,
      landAccessDesire: input.preferences?.landAccessDesire ?? 0.5
    },
    state: {
      health: input.state?.health ?? 0.8,
      morale: input.state?.morale ?? 0.7,
      housingStress: input.state?.housingStress ?? 0,
      foodStress: input.state?.foodStress ?? 0,
      fuelStress: input.state?.fuelStress ?? 0,
      heatingFuelStress: input.state?.heatingFuelStress ?? 0,
      transportFuelStress: input.state?.transportFuelStress ?? 0,
      electricityStress: input.state?.electricityStress ?? 0,
      totalFuelStress: input.state?.totalFuelStress ?? 0,
      transportStress: input.state?.transportStress ?? 0,
      migrationPressure: input.state?.migrationPressure ?? 0,
      totalStress: input.state?.totalStress ?? 0,
      dominantStressReason: input.state?.dominantStressReason ?? 'food'
    }
  };
}
