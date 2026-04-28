// SPDX-License-Identifier: AGPL-3.0-or-later
import { safeDivide } from '../util/math.mjs';

function warning(code, severity, message, value, threshold, metricPath) {
  return { code, severity, message, value, threshold, metricPath };
}

export function evaluateUnitSanity(metrics, constants) {
  const warnings = [];
  const sanity = constants?.sanity ?? {};

  const railPassengerCapacityKm = metrics.railPassengerCapacityKm ?? 1;
  const railFreightCapacityTonneKm = metrics.railFreightCapacityTonneKm ?? 1;

  const railBreakEvenPassengerKm = metrics.railBreakEvenPassengerKm ?? 0;
  const railBreakEvenFreightTonneKm = metrics.railBreakEvenFreightTonneKm ?? 0;
  const railBreakEvenMixedUtilization = metrics.railBreakEvenMixedUtilization ?? 0;

  if (railBreakEvenPassengerKm > railPassengerCapacityKm * (sanity.railBreakEvenCapacityMultipleWarning ?? 10)) {
    warnings.push(warning(
      'rail.break_even.passenger_over_capacity',
      'warning',
      'Rail break-even passenger-km exceeds configured multiple of passenger capacity.',
      railBreakEvenPassengerKm,
      railPassengerCapacityKm * (sanity.railBreakEvenCapacityMultipleWarning ?? 10),
      'railBreakEvenPassengerKm'
    ));
  }
  if (railBreakEvenFreightTonneKm > railFreightCapacityTonneKm * (sanity.railBreakEvenCapacityMultipleWarning ?? 10)) {
    warnings.push(warning(
      'rail.break_even.freight_over_capacity',
      'warning',
      'Rail break-even freight tonne-km exceeds configured multiple of freight capacity.',
      railBreakEvenFreightTonneKm,
      railFreightCapacityTonneKm * (sanity.railBreakEvenCapacityMultipleWarning ?? 10),
      'railBreakEvenFreightTonneKm'
    ));
  }
  if (railBreakEvenMixedUtilization > 1) {
    warnings.push(warning(
      'rail.break_even.utilization_gt_1',
      'critical',
      'Rail mixed break-even utilization exceeds 1.0 (full corridor capacity).',
      railBreakEvenMixedUtilization,
      1,
      'railBreakEvenMixedUtilization'
    ));
  }

  if ((metrics.railPassengerCostPerKmAtUtilization ?? 0) > (sanity.railCostPerPassengerKmWarningThreshold ?? 12)) {
    warnings.push(warning(
      'rail.cost.passenger_high',
      'warning',
      'Rail passenger cost per km is above warning threshold.',
      metrics.railPassengerCostPerKmAtUtilization ?? 0,
      sanity.railCostPerPassengerKmWarningThreshold ?? 12,
      'railPassengerCostPerKmAtUtilization'
    ));
  }
  if ((metrics.railFreightCostPerTonneKmAtUtilization ?? 0) > (sanity.railCostPerTonneKmWarningThreshold ?? 3)) {
    warnings.push(warning(
      'rail.cost.freight_high',
      'warning',
      'Rail freight cost per tonne-km is above warning threshold.',
      metrics.railFreightCostPerTonneKmAtUtilization ?? 0,
      sanity.railCostPerTonneKmWarningThreshold ?? 3,
      'railFreightCostPerTonneKmAtUtilization'
    ));
  }

  const backlogYears = safeDivide(metrics.roadMaintenanceBacklogMoney ?? 0, Math.max(1, metrics.roadMaintenanceDemandMoney ?? 0), 0);
  if (backlogYears > (sanity.roadBacklogYearsWarning ?? 5)) {
    warnings.push(warning(
      'road.backlog.years_high',
      'warning',
      'Road maintenance backlog exceeds configured years of annual demand.',
      backlogYears,
      sanity.roadBacklogYearsWarning ?? 5,
      'roadMaintenanceBacklogMoney'
    ));
  }

  if ((metrics.localFoodCoverageRatio ?? 1) < (sanity.foodCoverageWarningThreshold ?? 0.5) && (metrics.netMigration ?? 0) >= 0) {
    warnings.push(warning(
      'food.coverage_low_population_not_falling',
      'critical',
      'Food coverage is low while population is stable or growing.',
      metrics.localFoodCoverageRatio ?? 1,
      sanity.foodCoverageWarningThreshold ?? 0.5,
      'localFoodCoverageRatio'
    ));
  }

  const unmetPassengerShare = safeDivide(metrics.unmetPassengerKm ?? 0, Math.max(1, metrics.totalPassengerKmDemand ?? 0), 0);
  const unmetFreightShare = safeDivide(metrics.unmetFreightTonneKm ?? 0, Math.max(1, metrics.totalFreightTonneKmDemand ?? 0), 0);
  const transportUnmetShare = Math.max(unmetPassengerShare, unmetFreightShare);
  if (transportUnmetShare > (sanity.transportUnmetShareWarning ?? 0.5)) {
    warnings.push(warning(
      'transport.unmet_share_high',
      'critical',
      'Unmet transport demand exceeds threshold.',
      transportUnmetShare,
      sanity.transportUnmetShareWarning ?? 0.5,
      'unmetPassengerKm|unmetFreightTonneKm'
    ));
  }

  const electricityDeficitShare = safeDivide(metrics.electricityDeficitKwh ?? 0, Math.max(1, metrics.electricityDemandKwh ?? 0), 0);
  if (electricityDeficitShare > (sanity.electricityDeficitShareWarning ?? 0.5)) {
    warnings.push(warning(
      'energy.electricity_deficit_high',
      'critical',
      'Electricity deficit exceeds threshold share of demand.',
      electricityDeficitShare,
      sanity.electricityDeficitShareWarning ?? 0.5,
      'electricityDeficitKwh'
    ));
  }

  const heatingDeficitShare = safeDivide(metrics.heatingEnergyDeficitKwh ?? 0, Math.max(1, metrics.heatDemandKwh ?? 0), 0);
  if (heatingDeficitShare > (sanity.heatingDeficitShareWarning ?? 0.5)) {
    warnings.push(warning(
      'energy.heating_deficit_high',
      'critical',
      'Heating deficit exceeds threshold share of demand.',
      heatingDeficitShare,
      sanity.heatingDeficitShareWarning ?? 0.5,
      'heatingEnergyDeficitKwh'
    ));
  }

  if ((metrics.averageRent ?? 0) > (sanity.warningRentPerMonth ?? 4_000)) {
    warnings.push(warning(
      'housing.rent.warning_high',
      'warning',
      'Average monthly rent exceeds warning threshold.',
      metrics.averageRent ?? 0,
      sanity.warningRentPerMonth ?? 4_000,
      'averageRent'
    ));
  }
  if ((metrics.averageRent ?? 0) > (sanity.criticalRentPerMonth ?? 8_000)) {
    warnings.push(warning(
      'housing.rent.critical_high',
      'critical',
      'Average monthly rent exceeds critical threshold.',
      metrics.averageRent ?? 0,
      sanity.criticalRentPerMonth ?? 8_000,
      'averageRent'
    ));
  }

  if ((metrics.housingVacancyRate ?? 1) < (sanity.lowVacancyRateWarning ?? 0.02)) {
    warnings.push(warning(
      'housing.vacancy.low',
      'warning',
      'Housing vacancy rate is below warning threshold.',
      metrics.housingVacancyRate ?? 1,
      sanity.lowVacancyRateWarning ?? 0.02,
      'housingVacancyRate'
    ));
  }

  if ((metrics.households ?? 0) > (metrics.dwellingUnits ?? 0)) {
    warnings.push(warning(
      'housing.units.shortfall',
      'warning',
      'Household count exceeds dwelling units.',
      metrics.households ?? 0,
      metrics.dwellingUnits ?? 0,
      'households|dwellingUnits'
    ));
  }

  const priceToAnnualRentRatio = metrics.priceToAnnualRentRatio ?? metrics.valueToRentRatio ?? 0;
  if (priceToAnnualRentRatio > 0) {
    const lowThreshold = sanity.warningLowPriceToAnnualRentRatio ?? 6;
    const highWarningThreshold = sanity.warningHighPriceToAnnualRentRatio ?? 35;
    const criticalHighThreshold = sanity.criticalHighPriceToAnnualRentRatio ?? 60;

    if (priceToAnnualRentRatio < lowThreshold) {
      warnings.push(warning(
        'housing.price_to_annual_rent.out_of_range',
        'warning',
        'Price-to-annual-rent ratio is below plausible warning range.',
        priceToAnnualRentRatio,
        lowThreshold,
        'priceToAnnualRentRatio'
      ));
    } else if (priceToAnnualRentRatio > criticalHighThreshold) {
      warnings.push(warning(
        'housing.price_to_annual_rent.out_of_range',
        'critical',
        'Price-to-annual-rent ratio exceeds critical threshold.',
        priceToAnnualRentRatio,
        criticalHighThreshold,
        'priceToAnnualRentRatio'
      ));
    } else if (priceToAnnualRentRatio > highWarningThreshold) {
      warnings.push(warning(
        'housing.price_to_annual_rent.out_of_range',
        'warning',
        'Price-to-annual-rent ratio exceeds warning threshold.',
        priceToAnnualRentRatio,
        highWarningThreshold,
        'priceToAnnualRentRatio'
      ));
    }
  }

  if ((metrics.previousAverageRent ?? 0) > 0) {
    const maxGrowth = sanity.maxAnnualRentGrowthRateWarning ?? 0.1;
    const growth = metrics.averageRentGrowthRate ?? 0;
    if (growth > maxGrowth && !metrics.hasRentGrowthOverride) {
      warnings.push(warning(
        'housing.rent_growth.exceeds_cap',
        'warning',
        'Annual average rent growth exceeds configured warning cap without override.',
        growth,
        maxGrowth,
        'averageRentGrowthRate'
      ));
    }
  }

  const warningCount = warnings.length;
  const criticalWarningCount = warnings.filter((item) => item.severity === 'critical').length;
  return { warnings, warningCount, criticalWarningCount };
}
