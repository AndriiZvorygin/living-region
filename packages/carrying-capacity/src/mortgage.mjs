import rateEvidence from '../data/derived/house-mortgage-rates.json' with {type: 'json'};

export const HOUSE_MORTGAGE_CONTRACT_VERSION = '1.0.0';
export const HOUSE_MORTGAGE_RATE_EVIDENCE = rateEvidence;
export const HOUSE_MORTGAGE_SCENARIOS = [
  {id: 'legal_minimum', label: 'Legal minimum down payment', downPayment: 'minimum'},
  {id: 'ten_percent', label: '10% down', downPayment: 0.1},
  {id: 'twenty_percent', label: '20% down · uninsured reference', downPayment: 0.2},
  {id: 'twenty_five_percent', label: '25% down', downPayment: 0.25}
];

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, finite(value, min)));
const round = (value, digits = 2) => Math.round(Math.max(0, finite(value)) * 10 ** digits) / 10 ** digits;
const isoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? String(value) : null;
const daysBetween = (from, to) => Math.max(0, (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

function asOfDate(asOf = rateEvidence.snapshot_date) {
  return isoDate(asOf) ?? rateEvidence.snapshot_date;
}

export function isMortgageRateSnapshotStale(snapshot = rateEvidence, asOf = snapshot.snapshot_date) {
  const snapshotDate = isoDate(snapshot.snapshot_date);
  const checkDate = asOfDate(asOf);
  if (!snapshotDate || !checkDate || !Number.isFinite(Date.parse(`${snapshotDate}T00:00:00Z`))) return true;
  return daysBetween(snapshotDate, checkDate) > finite(snapshot.freshness?.stale_after_days, 120);
}

export function validateMortgageRateSnapshot(snapshot = rateEvidence) {
  if (!snapshot || snapshot.contract_version !== '1.0.0') throw new Error('Mortgage rate snapshot contract version is invalid');
  if (!isoDate(snapshot.snapshot_date) || !Array.isArray(snapshot.sources) || !Array.isArray(snapshot.lender_observations)) throw new Error('Mortgage rate snapshot is incomplete');
  const sourceIds = new Set(snapshot.sources.map((source) => source.id));
  if (sourceIds.size !== snapshot.sources.length) throw new Error('Mortgage rate snapshot has duplicate source IDs');
  for (const group of Object.values(snapshot.reference_rates ?? {})) {
    for (const rate of Object.values(group ?? {})) {
      if (!(rate.annual_rate >= 0 && rate.annual_rate < 1) || !sourceIds.has(rate.source_id)) throw new Error('Mortgage reference rate is invalid or missing its source');
    }
  }
  const ids = new Set();
  for (const observation of snapshot.lender_observations) {
    if (ids.has(observation.id) || !(observation.annual_rate >= 0 && observation.annual_rate < 1) || !sourceIds.has(observation.source_id)) throw new Error('Mortgage lender observation is invalid or duplicated');
    ids.add(observation.id);
  }
  let previous = -1;
  for (const row of snapshot.insurance_schedule ?? []) {
    if (!(row.max_ltv > previous && row.max_ltv <= 1) || !(row.premium_rate >= 0 && row.premium_rate < 1)) throw new Error('Mortgage insurance schedule is not ordered or valid');
    previous = row.max_ltv;
  }
  return true;
}

export function minimumMortgageDownPayment(propertyValueCad, rules = rateEvidence.rules) {
  const value = Math.max(0, finite(propertyValueCad));
  if (value <= 500000) return value * finite(rules.minimum_down_payment.up_to_500000_cad_rate, 0.05);
  if (value < 1500000) return 500000 * finite(rules.minimum_down_payment.between_500000_and_1500000_first_rate, 0.05) + (value - 500000) * finite(rules.minimum_down_payment.between_500000_and_1500000_remainder_rate, 0.1);
  return value * finite(rules.minimum_down_payment.over_1500000_cad_rate, 0.2);
}

export function mortgageInsurancePremium({propertyValueCad, baseFinancedPrincipalCad, downPaymentCad, mode = 'automatic', snapshot = rateEvidence} = {}) {
  const value = Math.max(0, finite(propertyValueCad));
  const principal = Math.max(0, finite(baseFinancedPrincipalCad));
  const contribution = Math.max(0, finite(downPaymentCad));
  const ltv = value > 0 ? principal / value : 0;
  const eligible = value > 0 && value <= finite(snapshot.rules.max_insured_home_price_cad, 1500000) && ltv > (1 - finite(snapshot.rules.insurance_required_below_down_payment, .2));
  if (mode === 'none' || !eligible) return {required: false, eligible, ltv, premium_rate: 0, premium_cad: 0, status: eligible ? 'waived_by_user_or_not_selected' : 'not_required_or_not_eligible'};
  if (mode !== 'automatic' && mode !== 'cmhc') return {required: false, eligible, ltv, premium_rate: 0, premium_cad: 0, status: 'unknown_insurance_mode'};
  const schedule = snapshot.insurance_schedule.find((row) => ltv <= row.max_ltv + 1e-12);
  if (!schedule) return {required: true, eligible: false, ltv, premium_rate: null, premium_cad: null, status: 'quote_required'};
  return {required: true, eligible: true, ltv, premium_rate: schedule.premium_rate, premium_cad: round(principal * schedule.premium_rate), status: 'cmhc_standard_schedule'};
}

export function mortgagePayment(principalCad, annualRate, amortizationYears) {
  const principal = Math.max(0, finite(principalCad));
  const months = Math.max(1, Math.round(Math.max(1, finite(amortizationYears, 25)) * 12));
  const monthlyRate = Math.max(0, finite(annualRate)) / 12;
  if (!principal) return 0;
  if (!monthlyRate) return principal / months;
  return principal * monthlyRate / (1 - (1 + monthlyRate) ** -months);
}

export function mortgageBalance(principalCad, paymentCad, annualRate, elapsedMonths) {
  const principal = Math.max(0, finite(principalCad));
  const payment = Math.max(0, finite(paymentCad));
  const months = Math.max(0, Math.round(finite(elapsedMonths)));
  const monthlyRate = Math.max(0, finite(annualRate)) / 12;
  if (!monthlyRate) return Math.max(0, principal - payment * months);
  return Math.max(0, principal * (1 + monthlyRate) ** months - payment * (((1 + monthlyRate) ** months - 1) / monthlyRate));
}

function rateFor({rateType, insured, customRateAnnual, snapshot}) {
  if (rateType === 'custom') return Math.max(0, finite(customRateAnnual));
  const group = snapshot.reference_rates[rateType] ?? snapshot.reference_rates.fixed;
  return finite(group[insured ? 'insured' : 'uninsured']?.annual_rate);
}

function rateMetadata({rateType, insured, customRateAnnual, snapshot, asOf}) {
  if (rateType === 'custom') return {type: 'custom lender rate', source_id: null, source_url: null, observed_date: null, status: 'user-entered'};
  const row = snapshot.reference_rates[rateType]?.[insured ? 'insured' : 'uninsured'] ?? snapshot.reference_rates.fixed[insured ? 'insured' : 'uninsured'];
  const source = snapshot.sources.find((item) => item.id === row.source_id);
  return {type: rateType, label: row.label, source_id: row.source_id, source_url: source?.url ?? null, observed_date: source?.observed_date ?? null, retrieved_date: source?.retrieved_date ?? null, status: isMortgageRateSnapshotStale(snapshot, asOf) ? 'stale' : 'fresh', market_average: row.market_average === true};
}

export function calculateMortgage({cashCostCad = 0, propertyValueCad = cashCostCad, ownership = 'financed', downPaymentRate = .2, downPaymentCad = null, rateType = 'fixed', termYears = 5, amortizationYears = 25, insuranceMode = 'automatic', customRateAnnual = null, rateSnapshot = rateEvidence, asOf = rateSnapshot.snapshot_date} = {}) {
  validateMortgageRateSnapshot(rateSnapshot);
  const value = Math.max(0, finite(propertyValueCad, cashCostCad));
  const financed = ownership !== 'owned_out_right';
  const minimumDownPaymentCad = minimumMortgageDownPayment(value, rateSnapshot.rules);
  const requestedContribution = downPaymentCad == null ? value * clamp(downPaymentRate, 0, 1) : clamp(downPaymentCad, 0, value);
  const belowMinimumDownPayment = financed && requestedContribution < minimumDownPaymentCad - .005;
  const contribution = financed ? Math.max(requestedContribution, minimumDownPaymentCad) : value;
  const basePrincipal = financed ? Math.max(0, value - contribution) : 0;
  const insurance = financed ? mortgageInsurancePremium({propertyValueCad: value, baseFinancedPrincipalCad: basePrincipal, downPaymentCad: contribution, mode: insuranceMode, snapshot: rateSnapshot}) : {required: false, eligible: false, ltv: 0, premium_rate: 0, premium_cad: 0, status: 'not_applicable_owned_out_right'};
  const insurancePremium = Math.max(0, finite(insurance.premium_cad));
  const totalPrincipal = basePrincipal + insurancePremium;
  const insured = insurance.required && insurance.eligible;
  const contractRate = rateFor({rateType, insured, customRateAnnual, snapshot: rateSnapshot});
  const payment = financed ? mortgagePayment(totalPrincipal, contractRate, amortizationYears) : 0;
  const months = Math.max(1, Math.round(Math.max(1, finite(amortizationYears, 25)) * 12));
  const termMonths = Math.max(0, Math.round(Math.max(0, finite(termYears, 5)) * 12));
  const stressRate = Math.max(finite(rateSnapshot.rules.stress_test_floor, .0525), contractRate + finite(rateSnapshot.rules.stress_test_buffer, .02));
  const stressPayment = financed ? mortgagePayment(totalPrincipal, stressRate, amortizationYears) : 0;
  const eligibilityIssues = [];
  if (value > finite(rateSnapshot.rules.max_insured_home_price_cad, 1500000) && contribution < value * .2) eligibilityIssues.push('The property exceeds the CMHC-insured price cap for this model and requires lender-specific uninsured financing.');
  if (belowMinimumDownPayment) eligibilityIssues.push('The requested contribution is below the Canada.ca minimum down payment; the model raised it to the minimum.');
  if (insured && amortizationYears > finite(rateSnapshot.rules.max_standard_insured_amortization_years, 25)) eligibilityIssues.push('The selected amortization exceeds the standard insured 25-year limit; eligibility depends on an applicable current exception and lender approval.');
  if (insuranceMode === 'none' && contribution < value * .2) eligibilityIssues.push('Insurance was disabled below 20% down; a lender would normally require mortgage insurance if the property is otherwise eligible.');
  return {
    contract_version: HOUSE_MORTGAGE_CONTRACT_VERSION,
    capital_value_cad: round(value),
    cash_construction_budget_cad: round(value),
    property_value_cad: round(value),
    ownership,
    initial_contribution_cad: round(contribution),
    down_payment_cad: round(contribution),
    down_payment_rate: value ? contribution / value : 0,
    requested_initial_contribution_cad: round(requestedContribution),
    contribution_raised_to_minimum: belowMinimumDownPayment,
    minimum_down_payment_cad: round(minimumDownPaymentCad),
    base_financed_principal_cad: round(basePrincipal),
    mortgage_insurance_premium_cad: round(insurancePremium),
    mortgage_insurance: {...insurance, premium_cad: insurancePremium == null ? null : round(insurancePremium)},
    total_financed_principal_cad: round(totalPrincipal),
    financed_principal_cad: round(totalPrincipal),
    rate_type: rateType,
    contract_rate_annual: contractRate,
    interest_rate_annual: contractRate,
    rate: rateMetadata({rateType, insured, customRateAnnual, snapshot: rateSnapshot, asOf}),
    term_years: Math.max(0, finite(termYears, 5)),
    loan_term_years: Math.max(0, finite(termYears, 5)),
    amortization_years: Math.max(1, finite(amortizationYears, 25)),
    monthly_payment_cad: round(payment),
    monthly_debt_service_cad: round(payment),
    total_interest_over_amortization_cad: round(Math.max(0, payment * months - totalPrincipal)),
    term_end_balance_cad: round(mortgageBalance(totalPrincipal, payment, contractRate, termMonths)),
    stress_test_rate_annual: stressRate,
    stress_test_payment_cad: round(stressPayment),
    qualification: {
      rate_annual: stressRate,
      payment_cad: round(stressPayment),
      rule: 'greater of contract rate + 2 percentage points or 5.25%'
    },
    eligibility: {
      status: eligibilityIssues.length ? 'requires_lender_review' : 'planning_eligibility_only',
      issues: eligibilityIssues,
      warning: 'Full-time, year-round yurt-form residential financing depends on permanent foundation and structural compliance, occupancy approval, insurability, appraisal, legal title/security registration, municipal approvals and lender acceptance of the construction system.'
    },
    basis: 'selected_dwelling_stage_cash_cost_excluding_contributed_owner_labour',
    rate_snapshot: {snapshot_id: rateSnapshot.snapshot_id, snapshot_date: rateSnapshot.snapshot_date, as_of: asOfDate(asOf), stale: isMortgageRateSnapshotStale(rateSnapshot, asOf)},
    monthly_compounding: true,
    loan_term_vs_amortization: 'Term is the renewal period; amortization is the scheduled payment period.'
  };
}

export function calculateMortgageScenarios({cashCostCad, ...options} = {}) {
  return HOUSE_MORTGAGE_SCENARIOS.map((scenario) => {
    const minimum = scenario.downPayment === 'minimum';
    return {...scenario, result: calculateMortgage({...options, cashCostCad, propertyValueCad: cashCostCad, downPaymentRate: minimum ? 0 : scenario.downPayment, downPaymentCad: minimum ? minimumMortgageDownPayment(cashCostCad) : null, insuranceMode: 'automatic'})};
  });
}
