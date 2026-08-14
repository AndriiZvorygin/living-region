import fs from 'node:fs';
import path from 'node:path';
import {calculateArcSiteLeaseEconomics, DEFAULT_SITE_LEASE_SCENARIO} from '../packages/carrying-capacity/src/index.mjs';

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
      rows.push({households: householdCount, land_price_cad_per_ha: price, land_ownership: mode.id, property_area_ha: result.project_land.total_property_area_ha, land_value_cad: result.project_land.total_land_value_cad, land_finance_month_cad: result.project_land.financing.monthly_debt_service_cad, site_lease_month_cad: household.site_lease.monthly_total_cad, shared_service_month_cad: household.shared_infrastructure_service.monthly_cad, resident_monthly_cost_cad: household.total_recurring_monthly_cost_cad, annual_project_cost_cad: result.project.annual_costs_cad.total, annual_reserve_cad: result.project.annual_reserves_cad});
    }
  }
}
const headers = Object.keys(rows[0]);
const escape = (value) => { const text = value == null ? '' : String(value); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; };
fs.writeFileSync(path.join(outputDir, 'arc-site-lease-sensitivity.csv'), [headers.join(','), ...rows.map((row) => headers.map((key) => escape(row[key])).join(','))].join('\n') + '\n');
fs.writeFileSync(path.join(outputDir, 'arc-site-lease-sensitivity.json'), JSON.stringify({contract_version: '1.0.0', land_price_scenarios_cad_per_ha: prices, community_sizes: sizes, land_ownership_modes: ownershipModes, rows}, null, 2) + '\n');
const money = (value) => `$${Number(value).toFixed(0)}`;
const markdown = [
  '# ARC site-lease sensitivity',
  '',
  'Family case: 2 adults + 2 children, ordinary site, one default heated dwelling per household. Prices and infrastructure are scenario inputs; the carrying-capacity hectares are held canonical.',
  '',
  '## Land price and ownership',
  '',
  '| Households | Land price/ha | Land ownership | Land value | Land finance/mo | Site lease/mo | Shared service/mo | Resident total/mo |',
  '|---:|---:|---|---:|---:|---:|---:|---:|',
  ...rows.filter((row) => [12, 25].includes(row.households) && [20000, 35000, 60000].includes(row.land_price_cad_per_ha)).map((row) => `| ${row.households} | ${money(row.land_price_cad_per_ha)} | ${row.land_ownership} | ${money(row.land_value_cad)} | ${money(row.land_finance_month_cad)} | ${money(row.site_lease_month_cad)} | ${money(row.shared_service_month_cad)} | ${money(row.resident_monthly_cost_cad)} |`),
  '',
  'The financed land case has a land-capital recovery payment; outright and donated/land-trust cases do not. Their land value remains visible even when no acquisition debt is charged.',
  '',
  '## Inputs still needing local evidence',
  '',
  '- Grey County parcel-matched rural land values and the relevant assessment/tax treatment.',
  '- Site-specific road, water, sewage, common-building, waste and equipment designs and quotes.',
  '- Resident dwelling construction costs and an actual financing product, if one is offered.',
  '- Insurance, maintenance, reserve and administration budgets for the land-holding entity.'
].join('\n');
fs.writeFileSync(path.join(outputDir, 'arc-site-lease-sensitivity.md'), markdown + '\n');
console.log(`JSON: ${path.join(outputDir, 'arc-site-lease-sensitivity.json')}`);
console.log(`CSV: ${path.join(outputDir, 'arc-site-lease-sensitivity.csv')}`);
console.log(`Markdown: ${path.join(outputDir, 'arc-site-lease-sensitivity.md')}`);
