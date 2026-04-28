// SPDX-License-Identifier: AGPL-3.0-or-later
import { average, clamp } from '../util/math.mjs';

export function calculatePlantGroupProduction(group, patch, context) {
  const maturityYears = group.traits.maturityYears ?? 1;
  const maturityFactor = maturityYears <= 0 ? 1 : Math.min(1, group.ageYears / maturityYears);

  const soilFactor = average([
    patch.soil.nitrogen,
    patch.soil.phosphorus,
    patch.soil.potassium,
    patch.soil.carbon
  ], 0.5);

  const waterFactor = clamp(patch.soil.moisture * patch.conditions.waterAccess * context.water, 0.2, 1.3);

  const shadeTolerance = group.traits.shadeTolerance ?? 0.5;
  const adjustedSun = patch.conditions.sun * (0.7 + 0.3 * shadeTolerance);
  const sunFactor = clamp(adjustedSun * context.sun, 0.2, 1.2);

  const fertilizerFloor = context.constants?.production?.fertilizerProductivityFloor ?? 0.7;
  const fertilizerVariable = context.constants?.production?.fertilizerProductivityVariable ?? 0.3;
  const fertilizerFactor = fertilizerFloor + fertilizerVariable * context.fertilizerAvailability;

  const managedAreaHa = patch.areaHa * group.areaShare;
  const caloriesPerHa = group.traits.yields.caloriesPerHaAtMaturity;
  const biomassPerHa = group.traits.yields.biomassKgPerHaAtMaturity;
  const woodPerHa = group.traits.yields.woodKgPerHaAtMaturity;

  const baseMultiplier = maturityFactor * soilFactor * waterFactor * sunFactor * fertilizerFactor * context.productivityMultiplier;

  const grossCalories = managedAreaHa * caloriesPerHa * baseMultiplier;
  const grossBiomassKg = managedAreaHa * biomassPerHa * baseMultiplier;
  const grossWoodKg = managedAreaHa * woodPerHa * baseMultiplier;

  const labour = group.traits.labour;
  const tonnes = grossBiomassKg / 1_000;
  const labourDemandFoodDays = (managedAreaHa * labour.annualCareDaysPerHa) + (tonnes * labour.harvestDaysPerTonne);

  return {
    managedAreaHa,
    maturityFactor,
    soilFactor,
    waterFactor,
    sunFactor,
    fertilizerFactor,
    grossCalories,
    grossBiomassKg,
    grossWoodKg,
    labourDemandFoodDays
  };
}
