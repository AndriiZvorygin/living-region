// SPDX-License-Identifier: AGPL-3.0-or-later
export function createMarket(input) {
  return {
    id: input.id,
    settlementId: input.settlementId,
    prices: {
      foodCalories: input.prices?.foodCalories ?? 0.0004,
      firewoodKg: input.prices?.firewoodKg ?? 0.2,
      dieselLitre: input.prices?.dieselLitre ?? 1.5,
      electricityKwh: input.prices?.electricityKwh ?? 0.2,
      rentUnit: input.prices?.rentUnit ?? 700,
      landHa: input.prices?.landHa ?? 2_000,
      labourDay: input.prices?.labourDay ?? 120
    },
    demand: {
      housingUnits: input.demand?.housingUnits ?? 0,
      foodCalories: input.demand?.foodCalories ?? 0,
      labourDays: input.demand?.labourDays ?? 0,
      landHa: input.demand?.landHa ?? 0
    },
    supply: {
      housingUnits: input.supply?.housingUnits ?? 0,
      foodCalories: input.supply?.foodCalories ?? 0,
      labourDays: input.supply?.labourDays ?? 0,
      landHa: input.supply?.landHa ?? 0
    }
  };
}
