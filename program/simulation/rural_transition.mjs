// SPDX-License-Identifier: AGPL-3.0-or-later
import { clamp, safeDivide } from '../util/math.mjs';

function classifyPopulationBucket(household) {
  const context = household.householdContext ?? 'settlementEdge';
  if (context === 'urbanCore') {
    return 'urban';
  }
  if (context === 'townCore') {
    return 'town';
  }
  if (context === 'villageCore') {
    return 'village';
  }
  if (['farmstead', 'ruralResidential', 'common/cooperative'].includes(context)) {
    return 'rural';
  }
  if (household.settlementId === 'owen-sound' || household.settlementId === 'hanover') {
    return 'urban';
  }
  return 'village';
}

export function calculateRuralTransitionMetrics(world, context = {}) {
  const inputCostStress = clamp((context.fertilizerCostIndex ?? 1) - 1, 0, 1);
  const machineryCostStress = clamp((context.machineryCostIndex ?? 1) - 1, 0, 1);
  const transportFuelStress = clamp(context.transportFuelStress ?? 0, 0, 1);
  const foodAffordabilityStress = clamp(context.foodAffordabilityStress ?? 0, 0, 1);
  const housingStress = clamp(context.housingStress ?? 0, 0, 1);
  const totalWorkers = world.households.reduce((sum, hh) => sum + (hh.people.workers ?? 0), 0);
  const totalAdults = world.households.reduce((sum, hh) => sum + Math.max(hh.people.workers ?? 0, Math.round((hh.people.total ?? 1) * 0.55)), 0);
  const underemploymentStress = clamp(1 - safeDivide(totalWorkers, Math.max(1, totalAdults), 1), 0, 1);

  let populationTotal = 0;
  let urbanPopulation = 0;
  let townPopulation = 0;
  let villagePopulation = 0;
  let ruralPopulation = 0;

  let farmAccessPopulation = 0;
  let gardenAccessPopulation = 0;
  let noLandAccessPopulation = 0;

  let foodProducingHouseholds = 0;
  let landAccessHouseholds = 0;
  let noLandAccessHouseholds = 0;
  let householdsWithGardenAccess = 0;
  let householdsWithFarmAccess = 0;
  let householdsWithCommonLandAccess = 0;

  let householdsIncreasingFoodProduction = 0;
  let urbanToRuralFoodAccessMoves = 0;
  let newGardenHouseholds = 0;
  let newCooperativeLandAccessHouseholds = 0;
  let addedFoodLabourDaysFromTransition = 0;
  let addedFoodEnergyGJFromHouseholdProduction = 0;
  let unmetLandAccessDemandHouseholds = 0;
  let householdsAtGardenTrigger = 0;
  let householdsAtCoopTrigger = 0;
  let householdsAtRelocationTrigger = 0;
  let householdsBlockedByNoLandAccess = 0;
  let householdsBlockedByLowSkill = 0;
  let householdsBlockedByToolsInputs = 0;
  let potentialAddedFoodEnergyGJIfLandAccessMet = 0;
  let transitionPressureSum = 0;

  for (const household of world.households) {
    const people = household.people.total;
    populationTotal += people;

    const bucket = classifyPopulationBucket(household);
    if (bucket === 'urban') {
      urbanPopulation += people;
    } else if (bucket === 'town') {
      townPopulation += people;
    } else if (bucket === 'village') {
      villagePopulation += people;
    } else {
      ruralPopulation += people;
    }

    const type = household.landAccessType ?? 'none';
    const landAccessOpportunity = clamp(
      (type === 'none' ? 0.08 : (['common', 'cooperative'].includes(type) ? 0.85 : 0.65))
      + Math.min(0.15, (household.productiveLandAccessHa ?? 0) * 0.08),
      0,
      1
    );
    const socialCooperationAccess = clamp(
      (type === 'cooperative' || type === 'common' ? 0.8 : 0.25)
      + (household.preferences?.landAccessDesire ?? 0.5) * 0.15,
      0,
      1
    );
    const hhSkill = clamp(household.foodProductionSkill ?? household.skills?.farming ?? 0.5, 0, 1);
    const hhToolsInputs = clamp(
      ((household.toolAccessLevel ?? household.access?.tools ?? 0.5) + (household.inputAccessLevel ?? household.access?.marketAccess ?? 0.5)) / 2,
      0,
      1
    );
    const hhPressure = clamp(
      foodAffordabilityStress * 0.28
      + transportFuelStress * 0.12
      + inputCostStress * 0.12
      + machineryCostStress * 0.1
      + housingStress * 0.13
      + underemploymentStress * 0.1
      + (1 - landAccessOpportunity) * 0.1
      + (1 - socialCooperationAccess) * 0.05,
      0,
      1
    );
    transitionPressureSum += hhPressure;

    if (hhPressure >= 0.25) {
      householdsAtGardenTrigger += 1;
    }
    if (hhPressure >= 0.5) {
      householdsAtCoopTrigger += 1;
    }
    if (hhPressure >= 0.7) {
      householdsAtRelocationTrigger += 1;
    }

    if (hhPressure >= 0.25 && type === 'none') {
      householdsBlockedByNoLandAccess += 1;
      potentialAddedFoodEnergyGJIfLandAccessMet += (household.people.workers ?? 1) * 0.18;
    }
    if (hhPressure >= 0.5 && hhSkill < 0.4) {
      householdsBlockedByLowSkill += 1;
    }
    if (hhPressure >= 0.5 && hhToolsInputs < 0.45) {
      householdsBlockedByToolsInputs += 1;
    }

    if (type === 'none') {
      noLandAccessPopulation += people;
      noLandAccessHouseholds += 1;
    } else {
      landAccessHouseholds += 1;
      foodProducingHouseholds += 1;
      if (['farm', 'common', 'cooperative'].includes(type)) {
        farmAccessPopulation += people;
        householdsWithFarmAccess += 1;
      }
      if (['garden', 'allotment'].includes(type)) {
        gardenAccessPopulation += people;
        householdsWithGardenAccess += 1;
      }
      if (type === 'common' || type === 'cooperative') {
        householdsWithCommonLandAccess += 1;
      }
    }

    const foodStress = household.state.foodStress ?? 0;
    const affordabilityStress = household.state.foodAffordabilityStress ?? 0;
    const highFoodStress = Math.max(foodStress, affordabilityStress) > 0.55;

    if (highFoodStress && type !== 'none') {
      householdsIncreasingFoodProduction += 1;
      const addedDays = (household.people.workers ?? 1) * 10;
      addedFoodLabourDaysFromTransition += addedDays;
      addedFoodEnergyGJFromHouseholdProduction += addedDays * 0.042;
    }

    if (highFoodStress && type === 'none') {
      unmetLandAccessDemandHouseholds += 1;
      household.state.migrationPressure = clamp((household.state.migrationPressure ?? 0) + 0.06, 0, 1);
      if (bucket === 'urban' || bucket === 'town') {
        urbanToRuralFoodAccessMoves += 0.25;
      }
      if ((household.access?.landHa ?? 0) > 0.015 || (household.gardenAccessM2 ?? 0) > 90) {
        household.landAccessType = 'garden';
        household.householdContext = household.householdContext === 'urbanCore' ? 'settlementEdge' : household.householdContext;
        newGardenHouseholds += 1;
      } else if ((context.allowCooperativeFallback ?? true) && (household.preferences?.landAccessDesire ?? 0.5) > 0.55) {
        household.landAccessType = 'cooperative';
        household.householdContext = 'common/cooperative';
        household.productiveLandAccessHa = Math.max(0.08, household.productiveLandAccessHa ?? 0.08);
        newCooperativeLandAccessHouseholds += 1;
      }
    }
  }

  const categorySum = urbanPopulation + townPopulation + villagePopulation + ruralPopulation;
  const landAccessPopulationSum = farmAccessPopulation + gardenAccessPopulation + noLandAccessPopulation;
  const urbanShare = safeDivide(urbanPopulation, Math.max(1, populationTotal), 0);
  const townShare = safeDivide(townPopulation, Math.max(1, populationTotal), 0);
  const villageShare = safeDivide(villagePopulation, Math.max(1, populationTotal), 0);
  const ruralShare = safeDivide(ruralPopulation, Math.max(1, populationTotal), 0);

  const classificationWarnings = [];
  const hasTownLikeMunicipality = world.settlements.some((settlement) => ['owen-sound', 'hanover', 'blue-mountains'].includes(settlement.id));
  if (urbanPopulation <= 0 && hasTownLikeMunicipality) {
    classificationWarnings.push('classification.urban_zero_with_city_town');
  }
  if (Math.abs(categorySum - populationTotal) > 0.5) {
    classificationWarnings.push('classification.population_sum_mismatch');
  }
  if (ruralPopulation > populationTotal) {
    classificationWarnings.push('classification.rural_exceeds_total');
  }
  if (Math.abs(landAccessPopulationSum - populationTotal) > 0.5) {
    classificationWarnings.push('classification.land_access_population_mismatch');
  }
  const landAccessOpportunity = clamp(safeDivide(landAccessHouseholds, Math.max(1, world.households.length), 0), 0, 1);
  const socialCooperation = clamp(safeDivide(householdsWithCommonLandAccess, Math.max(1, world.households.length), 0) * 1.5, 0, 1);
  const ruralTransitionPressureIndex = clamp(safeDivide(transitionPressureSum, Math.max(1, world.households.length), 0), 0, 1);

  return {
    populationTotal,
    urbanPopulation,
    townPopulation,
    villagePopulation,
    ruralPopulation,
    urbanShare,
    townShare,
    villageShare,
    ruralShare,
    farmAccessPopulation,
    gardenAccessPopulation,
    noLandAccessPopulation,
    foodProducingHouseholds,
    landAccessHouseholds,
    noLandAccessHouseholds,
    householdsWithGardenAccess,
    householdsWithFarmAccess,
    householdsWithCommonLandAccess,
    householdsIncreasingFoodProduction,
    urbanToRuralFoodAccessMoves: Math.round(urbanToRuralFoodAccessMoves),
    newGardenHouseholds,
    newCooperativeLandAccessHouseholds,
    addedFoodLabourDaysFromTransition,
    addedFoodEnergyGJFromHouseholdProduction,
    unmetLandAccessDemandHouseholds,
    ruralTransitionPressureIndex,
    transportFuelStress,
    inputCostStress,
    machineryCostStress,
    housingStress,
    underemploymentStress,
    landAccessOpportunity,
    socialCooperation,
    householdsAtGardenTrigger,
    householdsAtCoopTrigger,
    householdsAtRelocationTrigger,
    householdsBlockedByNoLandAccess,
    householdsBlockedByLowSkill,
    householdsBlockedByToolsInputs,
    potentialAddedFoodEnergyGJIfLandAccessMet,
    classificationWarnings
  };
}
