// SPDX-License-Identifier: AGPL-3.0-or-later
import { average, clamp } from '../util/math.mjs';

export function applyInfrastructureDecay(world, context) {
  const infraConstants = context.constants?.infrastructure ?? {};
  const baseDecayRate = infraConstants.baseDecayRate ?? 0.05;
  const budgetDecayPenalty = infraConstants.budgetDecayPenalty ?? 0.8;
  const maintenanceEffectiveness = infraConstants.maintenanceEffectiveness ?? 0.8;
  const preferredMaintenanceBonus = infraConstants.preferredMaintenanceBonus ?? 0.12;

  const networkManagedTypes = new Set(['road', 'rail', 'trail', 'bridge', 'water']);
  const managedInfrastructures = world.infrastructures.filter((infrastructure) => !networkManagedTypes.has(infrastructure.type));

  const totalMaintenanceLabourDemand = managedInfrastructures.reduce((sum, infrastructure) => sum + infrastructure.maintenance.labourDaysPerYear, 0);
  const totalMaintenanceMoneyDemand = managedInfrastructures.reduce((sum, infrastructure) => sum + infrastructure.maintenance.moneyPerYear, 0);

  const labourCoverage = totalMaintenanceLabourDemand > 0
    ? Math.min(1, context.suppliedMaintenanceDays / totalMaintenanceLabourDemand)
    : 1;
  const moneyCoverage = context.roadMaintenanceBudget;

  const maintenanceCoverage = Math.min(labourCoverage, moneyCoverage);
  const preferredSet = new Set(context.preferredInfrastructureTypes ?? []);

  for (const infrastructure of managedInfrastructures) {
    const decay = baseDecayRate * (1 + (1 - context.roadMaintenanceBudget) * budgetDecayPenalty);
    const preferenceBonus = preferredSet.has(infrastructure.type) ? preferredMaintenanceBonus : 0;
    const effectiveCoverage = clamp(maintenanceCoverage + preferenceBonus, 0, 1);
    const effectiveDecay = decay * (1 - effectiveCoverage * maintenanceEffectiveness);
    infrastructure.condition = clamp(infrastructure.condition - effectiveDecay, 0.1, 1);
  }

  const infrastructureAverageCondition = average(world.infrastructures.map((infrastructure) => infrastructure.condition), 0.7);
  const maintenanceDemandMoney = totalMaintenanceMoneyDemand;
  const maintenanceBacklog = maintenanceDemandMoney * (1 - maintenanceCoverage);

  for (const network of world.networks) {
    network.metrics.averageCondition = infrastructureAverageCondition;
    network.metrics.maintenanceBacklog = maintenanceBacklog;
  }

  return {
    infrastructureAverageCondition,
    maintenanceDemandMoney,
    maintenanceBacklog,
    maintenanceCoverageRatio: maintenanceCoverage
  };
}
