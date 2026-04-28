import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import {
  createDemoWorld,
  demoScenarioAdaptationWithRailFreightCorridorMedium,
  runScenario,
  runYear
} from '../program/index.mjs';
import { defaultConstants } from '../program/data/default_constants.mjs';
import { applyCalibrationProfile } from '../program/data/calibration_profiles.mjs';
import { evaluateUnitSanity } from '../program/simulation/unit_sanity.mjs';
import { calculateBreakEvenDiagnostics } from '../program/simulation/break_even_diagnostics.mjs';

function finalYearWithProfile(profile) {
  const world = createDemoWorld();
  const scenario = demoScenarioAdaptationWithRailFreightCorridorMedium();
  scenario.calibrationProfile = profile;
  return runScenario(world, scenario).years.at(-1);
}

describe('calibration envelope and unit sanity', () => {
  test('unit sanity warns when break-even utilization exceeds 1', () => {
    const result = evaluateUnitSanity({
      railBreakEvenPassengerKm: 20_000,
      railBreakEvenFreightTonneKm: 10_000,
      railBreakEvenMixedUtilization: 1.2,
      railPassengerCapacityKm: 1_000,
      railFreightCapacityTonneKm: 800
    }, defaultConstants);
    expect(result.warningCount).toBeGreaterThan(0);
    expect(result.warnings.some((item) => item.code === 'rail.break_even.utilization_gt_1')).toBe(true);
  });

  test('unit sanity warns when break-even demand exceeds capacity envelope', () => {
    const result = evaluateUnitSanity({
      railBreakEvenPassengerKm: 50_000,
      railBreakEvenFreightTonneKm: 40_000,
      railBreakEvenMixedUtilization: 0.9,
      railPassengerCapacityKm: 1_000,
      railFreightCapacityTonneKm: 1_000
    }, defaultConstants);
    expect(result.warnings.some((item) => item.code === 'rail.break_even.passenger_over_capacity')).toBe(true);
    expect(result.warnings.some((item) => item.code === 'rail.break_even.freight_over_capacity')).toBe(true);
  });

  test('calibration profile overrides constants deterministically', () => {
    const one = applyCalibrationProfile(defaultConstants, 'lowRailFixedCost');
    const two = applyCalibrationProfile(defaultConstants, 'lowRailFixedCost');
    expect(one.railCorridor.railFixedBaseAnnual).toBe(two.railCorridor.railFixedBaseAnnual);
    expect(one.railCorridor.railFixedBaseAnnual).toBeLessThan(defaultConstants.railCorridor.railFixedBaseAnnual);
  });

  test('break-even diagnostics produce scale multipliers', () => {
    const diagnostics = calculateBreakEvenDiagnostics({
      railFixedCostAnnual: 1000,
      railVariableCostAnnual: 200,
      railTotalCost: 1200,
      railPassengerRevenueEquivalent: 100,
      railFreightRevenueEquivalent: 100,
      railAvoidedRoadMaintenanceValue: 50,
      railAvoidedDieselValue: 50,
      railSpoilageReductionValue: 20,
      railTotalBenefitEquivalent: 320,
      railPassengerKm: 1000,
      railFreightTonneKm: 400,
      railPassengerCapacityKm: 10_000,
      railFreightCapacityTonneKm: 5_000,
      weightedUtilizationRatio: 0.2
    });
    expect(diagnostics.mixedScaleMultiplierNeeded).toBeGreaterThan(0);
  });

  test('low rail fixed cost profile improves benefit-cost ratio', () => {
    const baseline = finalYearWithProfile('baseline');
    const lowFixed = finalYearWithProfile('lowRailFixedCost');
    expect(lowFixed.railBenefitCostRatio).toBeGreaterThanOrEqual(baseline.railBenefitCostRatio);
  });

  test('high road maintenance burden increases avoided road maintenance value', () => {
    const baseline = finalYearWithProfile('baseline');
    const highRoad = finalYearWithProfile('highRoadMaintenanceBurden');
    expect(highRoad.railAvoidedRoadMaintenanceValue).toBeGreaterThanOrEqual(baseline.railAvoidedRoadMaintenanceValue);
  });

  test('high density corridor profile improves utilization or benefit ratio', () => {
    const baseline = finalYearWithProfile('baseline');
    const dense = finalYearWithProfile('highDensityCorridor');
    expect(
      dense.railUtilizationRatio >= baseline.railUtilizationRatio
      || dense.railBenefitCostRatio >= baseline.railBenefitCostRatio
    ).toBe(true);
  });

  test('rail utilization ratios are bounded and named metrics exist', () => {
    const world = createDemoWorld();
    const scenario = demoScenarioAdaptationWithRailFreightCorridorMedium();
    const year = runYear(world, scenario, scenario.startYear);
    expect(year.passengerUtilizationRatio).toBeGreaterThanOrEqual(0);
    expect(year.passengerUtilizationRatio).toBeLessThanOrEqual(1);
    expect(year.freightUtilizationRatio).toBeGreaterThanOrEqual(0);
    expect(year.freightUtilizationRatio).toBeLessThanOrEqual(1);
    expect(year.weightedUtilizationRatio).toBeGreaterThanOrEqual(0);
    expect(year.weightedUtilizationRatio).toBeLessThanOrEqual(1);
  });

  test('sensitivity command exits and writes json', () => {
    const result = spawnSync('node', ['command/run_sensitivity.mjs'], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    const outputPath = path.resolve('know/produce/rail-sensitivity.json');
    const parsed = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
  });

  test('compare calibration command exits successfully', () => {
    const result = spawnSync('node', ['command/run_demo_compare_calibration.mjs'], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('baseline');
    expect(result.stdout).toContain('highDensityCorridor');
  });
});
