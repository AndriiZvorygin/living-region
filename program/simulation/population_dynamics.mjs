// SPDX-License-Identifier: AGPL-3.0-or-later
import { average, clamp, clamp01 } from '../util/math.mjs';

function settlementType(settlement) {
  const name = settlement.name.toLowerCase();
  if (name.includes('town')) {
    return 'urban';
  }
  if (name.includes('village')) {
    return 'village';
  }
  return 'rural';
}

function findSettlementByType(settlements, type) {
  return settlements.find((settlement) => settlementType(settlement) === type);
}

function setHouseholdPopulation(household, total) {
  household.people.total = Math.max(1, total);
  household.people.workers = Math.max(1, Math.round(household.people.total * 0.55));
  household.people.dependents = Math.max(0, household.people.total - household.people.workers);
}

function dominantStressReason(household) {
  const entries = [
    ['food', household.state.foodStress],
    ['fuel', household.state.fuelStress],
    ['housing', household.state.housingStress],
    ['transport', household.state.transportStress]
  ].sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

export function updatePopulationDynamics(world, context) {
  const populationConstants = context.constants?.population ?? {};

  const birthRateBase = populationConstants.birthRateBase ?? 0.012;
  const deathRateBase = populationConstants.deathRateBase ?? 0.009;
  const stressBirthSuppression = populationConstants.stressBirthSuppression ?? 0.009;
  const stressDeathIncrease = populationConstants.stressDeathIncrease ?? 0.008;
  const deficitBirthSuppressionPerYear = populationConstants.deficitBirthSuppressionPerYear ?? 0.03;
  const deficitBirthSuppressionMax = populationConstants.deficitBirthSuppressionMax ?? 0.2;
  const deficitDeathIncreasePerYear = populationConstants.deficitDeathIncreasePerYear ?? 0.004;

  const severeFoodStressThreshold = populationConstants.severeFoodStressThreshold ?? 0.75;
  const severeFuelStressThreshold = populationConstants.severeFuelStressThreshold ?? 0.75;
  const severeHousingStressThreshold = populationConstants.severeHousingStressThreshold ?? 0.72;
  const severeTransportStressThreshold = populationConstants.severeTransportStressThreshold ?? 0.72;

  const populationPolicy = context.populationPolicy ?? {
    allowStressMigration: true,
    forcedAnnualInMigration: 0,
    maxUrbanToRuralMovesPerYear: 999
  };

  const settlementsById = new Map(world.settlements.map((settlement) => [settlement.id, settlement]));
  const urbanSettlement = findSettlementByType(world.settlements, 'urban') ?? world.settlements[0];
  const villageSettlement = findSettlementByType(world.settlements, 'village') ?? world.settlements[0];
  const ruralSettlements = world.settlements.filter((settlement) => settlementType(settlement) !== 'urban');

  const startingPopulation = world.households.reduce((sum, household) => sum + household.people.total, 0);

  let births = 0;
  let deaths = 0;
  let inMigration = 0;
  let outMigration = 0;
  let urbanToRuralMoves = 0;
  let ruralToUrbanMoves = 0;
  let remainingUrbanToRuralMoves = populationPolicy.maxUrbanToRuralMovesPerYear ?? 999;

  let outMigrationFoodStress = 0;
  let outMigrationFuelStress = 0;
  let outMigrationHousingStress = 0;
  let outMigrationTransportStress = 0;

  for (const household of world.households) {
    const stress = household.state.totalStress ?? clamp01((
      household.state.housingStress
      + household.state.foodStress
      + household.state.transportStress
      + household.state.fuelStress
    ) / 4);

    const deficitSuppression = clamp(context.consecutiveFoodDeficitYears * deficitBirthSuppressionPerYear, 0, deficitBirthSuppressionMax);
    const birthRate = Math.max(0, birthRateBase - (stress * stressBirthSuppression) - deficitSuppression);
    const deathRate = deathRateBase + (stress * stressDeathIncrease) + (context.consecutiveFoodDeficitYears * deficitDeathIncreasePerYear);

    const naturalGrowth = household.people.total * (birthRate - deathRate);
    const roundedChange = Math.round(naturalGrowth);

    if (roundedChange > 0) {
      births += roundedChange;
    }
    if (roundedChange < 0) {
      deaths += Math.abs(roundedChange);
    }

    setHouseholdPopulation(household, household.people.total + roundedChange);

    const settlement = settlementsById.get(household.settlementId);
    const currentType = settlement ? settlementType(settlement) : 'urban';

    const ruralOpportunity = clamp(
      average(ruralSettlements.map((ruralSettlement) => ruralSettlement.metrics?.ruralOpportunity ?? 0.45), 0.45)
      + household.access.landHa * 0.06
      + household.preferences.landAccessDesire * 0.2
      + context.ruralOpportunityBoost
      + (context.localFoodCoverageRatio < 1 ? 0.15 : 0),
      0,
      1.4
    );

    const poorLocalFuelAccess = household.access.landHa < 0.4 && household.skills.forestry < 0.45;

    const severeFoodStress = household.state.foodStress > severeFoodStressThreshold;
    const severeFuelStress = household.state.fuelStress > severeFuelStressThreshold;
    const severeHousingStress = household.state.housingStress > severeHousingStressThreshold;
    const severeTransportStress = household.state.transportStress > severeTransportStressThreshold;

    if (populationPolicy.allowStressMigration) {
      const wantsRuralShift = household.preferences.landAccessDesire > 0.58
        || household.preferences.ruralPreference > household.preferences.urbanPreference;

      const transportPushToLocal = severeTransportStress && (currentType === 'urban');
      const housingPushToRural = severeHousingStress && wantsRuralShift;

      if (currentType === 'urban' && ruralSettlements.length > 0 && remainingUrbanToRuralMoves > 0
        && ruralOpportunity > 0.58 && (housingPushToRural || transportPushToLocal || severeFoodStress)) {
        const target = transportPushToLocal ? villageSettlement : ruralSettlements[0];
        household.settlementId = target.id;
        urbanToRuralMoves += 1;
        remainingUrbanToRuralMoves -= 1;
        continue;
      }

      if (currentType !== 'urban' && severeHousingStress && severeFoodStress && household.preferences.urbanPreference > household.preferences.ruralPreference + 0.15) {
        household.settlementId = urbanSettlement.id;
        ruralToUrbanMoves += 1;
        continue;
      }
    }

    let outMigrationTrigger = 0;
    if (severeFoodStress) {
      outMigrationTrigger += 0.45;
    }
    if (severeFuelStress) {
      outMigrationTrigger += poorLocalFuelAccess ? 0.4 : 0.25;
    }
    if (severeTransportStress) {
      outMigrationTrigger += 0.2;
    }
    if (context.consecutiveFoodDeficitYears >= 2) {
      outMigrationTrigger += 0.2;
    }

    if (outMigrationTrigger > 0.7 && household.people.total > 1) {
      setHouseholdPopulation(household, household.people.total - 1);
      outMigration += 1;
      const reason = household.state.dominantStressReason ?? dominantStressReason(household);
      if (reason === 'food') {
        outMigrationFoodStress += 1;
      } else if (reason === 'fuel') {
        outMigrationFuelStress += 1;
      } else if (reason === 'housing') {
        outMigrationHousingStress += 1;
      } else {
        outMigrationTransportStress += 1;
      }
    }

    const lowStressForInMigration = household.state.totalStress < 0.35
      && household.state.foodStress < 0.45
      && household.state.fuelStress < 0.45;

    if (lowStressForInMigration && context.housingVacancyRate > 0.06 && context.localFoodCoverageRatio > 0.9) {
      setHouseholdPopulation(household, household.people.total + 1);
      inMigration += 1;
    }
  }

  const forcedAnnualInMigration = populationPolicy.forcedAnnualInMigration ?? 0;
  if (forcedAnnualInMigration > 0) {
    const urbanHouseholds = world.households
      .filter((household) => household.settlementId === urbanSettlement.id)
      .sort((a, b) => (a.state.totalStress ?? 0) - (b.state.totalStress ?? 0));

    for (let i = 0; i < forcedAnnualInMigration; i += 1) {
      const target = urbanHouseholds[i % Math.max(1, urbanHouseholds.length)] ?? world.households[0];
      setHouseholdPopulation(target, target.people.total + 1);
      inMigration += 1;
    }
  }

  for (const settlement of world.settlements) {
    settlement.householdIds = world.households
      .filter((household) => household.settlementId === settlement.id)
      .map((household) => household.id);

    const people = world.households
      .filter((household) => household.settlementId === settlement.id)
      .reduce((sum, household) => sum + household.people.total, 0);

    if (settlementType(settlement) === 'urban') {
      settlement.populationUrban = people;
      settlement.populationRural = 0;
    } else {
      settlement.populationUrban = 0;
      settlement.populationRural = people;
    }
  }

  const populationUrban = world.settlements.reduce((sum, settlement) => sum + settlement.populationUrban, 0);
  const populationRural = world.settlements.reduce((sum, settlement) => sum + settlement.populationRural, 0);
  const endingPopulation = populationUrban + populationRural;

  const householdsFoodSecure = world.households.filter((household) => household.state.foodStress < 0.5).length;
  const householdsHousingSecure = world.households.filter((household) => household.state.housingStress < 0.5).length;

  return {
    startingPopulation,
    births,
    deaths,
    inMigration,
    outMigration,
    netMigration: inMigration - outMigration,
    urbanToRuralMoves,
    ruralToUrbanMoves,
    endingPopulation,
    populationTotal: endingPopulation,
    populationUrban,
    populationRural,
    householdsFoodSecure,
    householdsHousingSecure,
    outMigrationFoodStress,
    outMigrationFuelStress,
    outMigrationHousingStress,
    outMigrationTransportStress
  };
}
