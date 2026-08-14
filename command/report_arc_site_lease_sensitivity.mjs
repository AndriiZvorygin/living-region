import fs from 'node:fs';
import path from 'node:path';
import {calculateArcSiteLeaseEconomics, DEFAULT_SITE_LEASE_SCENARIO, LAND_FINANCING_SCENARIOS} from '../packages/carrying-capacity/src/index.mjs';

const outputDir = path.resolve('packages/carrying-capacity/outputs');
const clone = (value) => structuredClone(value);
const prices = [20000, 30000, 35000, 40000, 60000];
const sizes = [12, 16, 25];
const ownershipModes = [
  {id: 'financed', ownership: 'financed', recovery_mode: 'debt_service'},
  {id: 'owned_out_right', ownership: 'owned_out_right', recovery_mode: 'none'},
  {id: 'donated_land_trust', ownership: 'donated_land_trust', recovery_mode: 'none'}
];
const rows = [];
for (const householdCount of sizes) {
  for (const price of prices) {
    for (const mode of ownershipModes) {
      const base = clone(DEFAULT_SITE_LEASE_SCENARIO);
      const result = calculateArcSiteLeaseEconomics({scenario: {
        ...base,
        household: {id: 'family', label: '2 adults + 2 children', members: ['adult_woman', 'adult_man', 'child_girl_8', 'adolescent_boy_14'], buildings: base.household.buildings},
        community: {...base.community, household_count: householdCount, project_id: `family-${householdCount}`},
        land: {...base.land, price_cad_per_ha: price, ownership: mode.ownership, recovery_mode: mode.recovery_mode}
      }});
      const household = result.households[0];
      rows.push({households: householdCount, land_price_cad_per_ha: price, land_ownership: mode.id, property_area_ha: result.project_land.total_property_area_ha, land_value_cad: result.project_land.total_land_value_cad, land_finance_month_cad: result.project_land.financing.monthly_debt_service_cad, common_property_land_holding_share_month_cad: household.site_lease.common_property_land_holding_share_monthly_cad, productive_land_charge_per_ha_month_cad: household.site_lease.productive_land_charge_per_hectare_monthly_cad, productive_land_portion_month_cad: household.site_lease.productive_land_portion_monthly_cad, site_lease_month_cad: household.site_lease.monthly_total_cad, shared_service_month_cad: household.shared_infrastructure_service.monthly_cad, land_infrastructure_month_cad: household.land_infrastructure.combined_monthly_cad});
    }
  }
}
const financingRows = Object.values(LAND_FINANCING_SCENARIOS).map((financingScenario) => {
  const base = clone(DEFAULT_SITE_LEASE_SCENARIO);
  const result = calculateArcSiteLeaseEconomics({scenario: {
    ...base,
    household: {...base.household, household_id: `financing-${financingScenario.id}`, label: '2 adults + 2 children', members: ['adult_woman', 'adult_man', 'child_girl_8', 'adolescent_boy_14']},
    community: {...base.community, household_count: 12},
    land: {...base.land, ...financingScenario, financing_scenario_id: financingScenario.id, ownership: 'financed', recovery_mode: 'debt_service'}
  }});
  const household = result.households[0];
  return {
    financing_scenario: financingScenario.id,
    label: financingScenario.label,
    status: financingScenario.status,
    down_payment_rate: financingScenario.down_payment_rate,
    interest_rate_annual: financingScenario.interest_rate_annual,
    amortization_years: financingScenario.amortization_years,
    loan_term_years: financingScenario.loan_term_years,
    total_land_value_cad: result.project_land.total_land_value_cad,
    initial_equity_cad: result.project_land.financing.down_payment_cad,
    financed_principal_cad: result.project_land.financing.financed_principal_cad,
    project_debt_service_monthly_cad: result.project_land.financing.monthly_debt_service_cad,
    common_property_land_holding_share_month_cad: household.site_lease.common_property_land_holding_share_monthly_cad,
    productive_land_portion_month_cad: household.site_lease.productive_land_portion_monthly_cad,
    site_lease_month_cad: household.site_lease.monthly_total_cad,
    shared_service_month_cad: household.shared_infrastructure_service.monthly_cad,
    land_infrastructure_month_cad: household.land_infrastructure.combined_monthly_cad
  };
});
const headers = Object.keys(rows[0]);
const escape = (value) => { const text = value == null ? '' : String(value); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; };
fs.writeFileSync(path.join(outputDir, 'arc-site-lease-sensitivity.csv'), [headers.join(','), ...rows.map((row) => headers.map((key) => escape(row[key])).join(','))].join('\n') + '\n');
fs.writeFileSync(path.join(outputDir, 'arc-site-lease-sensitivity.json'), JSON.stringify({contract_version: '1.1.0', land_price_scenarios_cad_per_ha: prices, community_sizes: sizes, land_ownership_modes: ownershipModes, financing_scenarios: financingRows, rows}, null, 2) + '\n');
const money = (value) => `$${Number(value).toFixed(0)}`;
const markdown = [
  '# ARC site-lease sensitivity',
  '',
  'Family case: 2 adults + 2 children on an ordinary site. Prices and infrastructure are scenario inputs; the carrying-capacity hectares are held canonical. The public comparison covers land lease plus shared infrastructure only.',
  '',
  '## Land price and ownership',
  '',
  '| Households | Land price/ha | Land ownership | Land value | Land finance/mo | Site lease/mo | Shared service/mo | Land + infrastructure/mo |',
  '|---:|---:|---|---:|---:|---:|---:|---:|',
  ...rows.filter((row) => [12, 25].includes(row.households) && [20000, 35000, 60000].includes(row.land_price_cad_per_ha)).map((row) => `| ${row.households} | ${money(row.land_price_cad_per_ha)} | ${row.land_ownership} | ${money(row.land_value_cad)} | ${money(row.land_finance_month_cad)} | ${money(row.site_lease_month_cad)} | ${money(row.shared_service_month_cad)} | ${money(row.land_infrastructure_month_cad)} |`),
  '',
  'The financed land case has a land-capital recovery payment; outright and donated/land-trust cases do not. Their land value remains visible even when no acquisition debt is charged.',
  '',
  '## Land-financing comparison',
  '',
  'The current 6% / 30-year / 20% case is illustrative. Loan term is shown separately from amortization. The neutral comparison follows the FCC 25% down / 25-year analytical convention; the CALA-style comparison is eligibility-dependent and uses a 15-year land horizon.',
  '',
  '| Scenario | Down | Interest | Amortization | Loan term | Initial equity | Project debt service/mo | Site lease/mo | Land + infrastructure/mo | Status |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|---|',
  ...financingRows.map((row) => `| ${row.label} | ${(row.down_payment_rate * 100).toFixed(0)}% | ${(row.interest_rate_annual * 100).toFixed(1)}% | ${row.amortization_years} y | ${row.loan_term_years} y | ${money(row.initial_equity_cad)} | ${money(row.project_debt_service_monthly_cad)} | ${money(row.site_lease_month_cad)} | ${money(row.land_infrastructure_month_cad)} | ${row.status} |`),
  '',
  '## Inputs still needing local evidence',
  '',
  '- Grey County parcel-matched rural land values and the relevant assessment/tax treatment.',
  '- Site-specific road, water, sewage, common-building, waste and equipment designs and quotes.',
  '- Resident dwelling construction costs and financing are outside this land-and-infrastructure comparison.',
  '- Insurance, maintenance, reserve and administration budgets for the land-holding entity.',
  '- A lender quote and eligibility determination for the ARC land-holding entity, including security, renewal term and any balloon payment.'
].join('\n');
fs.writeFileSync(path.join(outputDir, 'arc-site-lease-sensitivity.md'), markdown + '\n');
console.log(`JSON: ${path.join(outputDir, 'arc-site-lease-sensitivity.json')}`);
console.log(`CSV: ${path.join(outputDir, 'arc-site-lease-sensitivity.csv')}`);
console.log(`Markdown: ${path.join(outputDir, 'arc-site-lease-sensitivity.md')}`);
