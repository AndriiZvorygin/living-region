import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HOUSE_MORTGAGE_RATE_EVIDENCE,
  calculateMortgage,
  calculateMortgageScenarios,
  isMortgageRateSnapshotStale,
  minimumMortgageDownPayment,
  mortgageInsurancePremium,
  mortgagePayment,
  validateMortgageRateSnapshot
} from '../src/index.mjs';

test('fixed mortgage evidence validates without a live website', () => {
  assert.equal(validateMortgageRateSnapshot(HOUSE_MORTGAGE_RATE_EVIDENCE), true);
  assert.equal(HOUSE_MORTGAGE_RATE_EVIDENCE.snapshot_date, '2026-09-07');
  assert.equal(HOUSE_MORTGAGE_RATE_EVIDENCE.reference_rates.fixed.insured.annual_rate, 0.0401);
  assert.equal(HOUSE_MORTGAGE_RATE_EVIDENCE.lender_observations.length, 5);
});

test('rate snapshots become stale while preserving the last valid source', () => {
  const old = {...HOUSE_MORTGAGE_RATE_EVIDENCE, snapshot_date: '2025-01-01'};
  assert.equal(isMortgageRateSnapshotStale(old, '2026-09-07'), true);
  assert.equal(isMortgageRateSnapshotStale(HOUSE_MORTGAGE_RATE_EVIDENCE, '2026-09-07'), false);
});

test('Canadian minimum down payment follows the current price bands', () => {
  assert.equal(minimumMortgageDownPayment(400000), 20000);
  assert.equal(minimumMortgageDownPayment(600000), 35000);
  assert.equal(minimumMortgageDownPayment(1500000), 300000);
});

test('CMHC premiums are separate from base principal and absent at 20% down', () => {
  const premium = mortgageInsurancePremium({propertyValueCad: 400000, baseFinancedPrincipalCad: 360000, downPaymentCad: 40000});
  assert.equal(premium.required, true);
  assert.equal(premium.premium_rate, 0.031);
  assert.equal(premium.premium_cad, 11160);
  const uninsured = mortgageInsurancePremium({propertyValueCad: 400000, baseFinancedPrincipalCad: 320000, downPaymentCad: 80000});
  assert.equal(uninsured.premium_cad, 0);
  assert.equal(uninsured.required, false);
});

test('mortgage payment handles zero interest and separates term from amortization', () => {
  assert.equal(mortgagePayment(300000, 0, 25), 1000);
  const result = calculateMortgage({cashCostCad: 88081.87, downPaymentRate: 0.2, rateType: 'fixed', termYears: 5, amortizationYears: 25});
  assert.equal(result.cash_construction_budget_cad, 88081.87);
  assert.equal(result.base_financed_principal_cad, 70465.5);
  assert.equal(result.mortgage_insurance_premium_cad, 0);
  assert.equal(result.term_years, 5);
  assert.equal(result.amortization_years, 25);
  assert.ok(result.term_end_balance_cad < result.total_financed_principal_cad);
  assert.ok(result.term_end_balance_cad > 0);
});

test('all published down-payment scenarios use the same selected cash basis', () => {
  const scenarios = calculateMortgageScenarios({cashCostCad: 88081.87, rateType: 'fixed', amortizationYears: 25, termYears: 5});
  assert.deepEqual(scenarios.map((row) => row.id), ['legal_minimum', 'ten_percent', 'twenty_percent', 'twenty_five_percent']);
  assert.equal(scenarios[0].result.initial_contribution_cad, 4404.09);
  assert.equal(scenarios[0].result.mortgage_insurance_premium_cad, 3347.11);
  assert.equal(scenarios[1].result.mortgage_insurance_premium_cad, 2457.48);
  assert.equal(scenarios[2].result.mortgage_insurance_premium_cad, 0);
  assert.equal(scenarios[2].result.rate.market_average, true);
  assert.equal(scenarios[2].result.rate.observed_date, '2026-06-30');
  assert.ok(scenarios[0].result.stress_test_payment_cad > scenarios[0].result.monthly_payment_cad);
});

test('custom lender rate is editable and does not overwrite the sourced snapshot', () => {
  const result = calculateMortgage({cashCostCad: 500000, downPaymentRate: 0.25, rateType: 'custom', customRateAnnual: 0.055, amortizationYears: 25, termYears: 5});
  assert.equal(result.contract_rate_annual, 0.055);
  assert.equal(result.rate.status, 'user-entered');
  assert.equal(result.rate_snapshot.snapshot_id, HOUSE_MORTGAGE_RATE_EVIDENCE.snapshot_id);
  assert.equal(result.stress_test_rate_annual, 0.075);
});
