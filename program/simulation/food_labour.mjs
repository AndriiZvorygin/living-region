// SPDX-License-Identifier: AGPL-3.0-or-later
import { clamp, safeDivide } from '../util/math.mjs';

export function calculateFoodLabour(world, production, labour, context = {}) {
  const foodConsts = context.constants?.foodLabour ?? {};
  const peakMultiplier = foodConsts.seasonalPeakMultiplier ?? 1.25;
  const baseSkillRequirement = foodConsts.baseSkillRequirement ?? 0.45;

  const householdCount = Math.max(1, world.households.length);
  let landAccessFactorSum = 0;
  let rawFoodLabourAvailableDays = 0;
  let effectiveFoodLabourAvailableDays = 0;
  let skillAdjustedFoodLabourAvailableDays = 0;
  let mechanizedLabourSubstitutionDays = 0;

  for (const household of world.households) {
    const landType = household.landAccessType ?? 'none';
    const hasAccess = landType !== 'none';
    const landFactor = hasAccess ? 1 : 0.12;
    const accessDistancePenalty = clamp(1 - ((household.distanceToProductiveLandKm ?? 1.5) / 10), 0.5, 1);
    const toolFactor = clamp((household.toolAccessLevel ?? household.access?.tools ?? 0.5), 0.1, 1);
    const inputFactor = clamp((household.inputAccessLevel ?? household.access?.marketAccess ?? 0.5), 0.1, 1);
    const machineFactor = clamp((household.machineryAccessLevel ?? household.access?.machinePower ?? 0.2), 0.05, 1);
    const skill = clamp(household.foodProductionSkill ?? household.skills?.farming ?? 0.5, 0.05, 1);
    const baseAvailable = Math.max(0, household.availableFoodProductionLabourDays ?? (household.people.workers * 70));

    rawFoodLabourAvailableDays += baseAvailable;
    const effectiveAvailable = baseAvailable * landFactor * accessDistancePenalty * (0.75 + 0.25 * toolFactor);
    effectiveFoodLabourAvailableDays += effectiveAvailable;

    const skillScale = clamp(safeDivide(skill, baseSkillRequirement, 1), 0.25, 1.25);
    skillAdjustedFoodLabourAvailableDays += effectiveAvailable * skillScale;

    landAccessFactorSum += landFactor;
    mechanizedLabourSubstitutionDays += effectiveAvailable * machineFactor * inputFactor * toolFactor * 0.28;
  }

  const landAccessFactor = landAccessFactorSum / householdCount;
  const labourDemandBase = production.labourDemandFoodDays;
  const foodLabourDemandDays = labourDemandBase * clamp(1.08 - landAccessFactor * 0.2, 0.88, 1.28);

  const foodLabourCoverageRatio = clamp(
    safeDivide(effectiveFoodLabourAvailableDays, Math.max(1, foodLabourDemandDays), 1),
    0,
    1.35
  );
  const foodLabourDeficitDays = Math.max(0, foodLabourDemandDays - effectiveFoodLabourAvailableDays);
  const foodLabourShareOfTotalLabour = safeDivide(effectiveFoodLabourAvailableDays, Math.max(1, labour.labourAvailableDays), 0);
  const seasonalFoodLabourPeakPressure = clamp(
    safeDivide(foodLabourDemandDays * peakMultiplier, Math.max(1, effectiveFoodLabourAvailableDays), 0),
    0,
    2.5
  );

  const manualLabourSubstitutionNeededDays = Math.max(0, foodLabourDeficitDays - mechanizedLabourSubstitutionDays);

  const skilledRatio = clamp(safeDivide(skillAdjustedFoodLabourAvailableDays, Math.max(1, foodLabourDemandDays), 1), 0, 1.1);
  const accessFactor = clamp(0.35 + landAccessFactor * 0.65, 0.15, 1);
  const toolInputFactor = clamp(
    world.households.reduce((sum, household) => sum + ((household.toolAccessLevel ?? 0.5) * 0.5 + (household.inputAccessLevel ?? 0.5) * 0.5), 0) / householdCount,
    0.2,
    1
  );

  const productionAdjustmentFactor = clamp(
    foodLabourCoverageRatio * 0.52 + skilledRatio * 0.18 + accessFactor * 0.2 + toolInputFactor * 0.1,
    0.35,
    1.2
  );

  return {
    foodLabourDemandDays,
    rawFoodLabourAvailableDays,
    effectiveFoodLabourAvailableDays,
    skillAdjustedFoodLabourAvailableDays,
    foodLabourDeficitDays,
    foodLabourCoverageRatio,
    foodLabourShareOfTotalLabour,
    seasonalFoodLabourPeakPressure,
    mechanizedLabourSubstitutionDays,
    manualLabourSubstitutionNeededDays,
    productionAdjustmentFactor
  };
}
