import fs from 'node:fs';
import path from 'node:path';
import {calculateArcSiteLeaseEconomics, DEFAULT_SITE_LEASE_SCENARIO} from '../packages/carrying-capacity/src/index.mjs';

const outputDir = path.resolve('packages/carrying-capacity/outputs');
fs.mkdirSync(outputDir, {recursive: true});
const clone = (value) => structuredClone(value);
const money = (value) => { const amount = Math.abs(Number(value)) < 0.5 ? 0 : Number(value); return `$${amount.toFixed(0)}`; };
const ha = (value) => `${Number(value).toFixed(2)} ha`;
const scenario = ({id, label, siteId = 'ordinary_mesic', members, householdCount = 12, landOwnership = 'financed', price = 35000} = {}) => {
  const base = clone(DEFAULT_SITE_LEASE_SCENARIO);
  return {
    id,
    label,
    scenario: {
      ...base,
      site_id: siteId,
      household: {...base.household, household_id: `${id}-household`, label, members},
      community: {...base.community, project_id: `${id}-project`, label, household_count: householdCount},
      land: {...base.land, price_cad_per_ha: price, ownership: landOwnership, recovery_mode: landOwnership === 'financed' ? 'debt_service' : 'none'}
    }
  };
};

const definitions = [
  scenario({id: 'one_adult_ordinary_12', label: '1 adult · ordinary land · 12 households', members: ['adult_man']}),
  scenario({id: 'one_adult_marginal_12', label: '1 adult · marginal land · 12 households', siteId: 'shallow_rocky_marginal', members: ['adult_man']}),
  scenario({id: 'family_ordinary_12', label: '2 adults + 2 children · ordinary land · 12 households', members: ['adult_woman', 'adult_man', 'child_girl_8', 'adolescent_boy_14']}),
  ...[16, 25].map((householdCount) => scenario({id: `family_ordinary_${householdCount}`, label: `2 adults + 2 children · ordinary land · ${householdCount} households`, members: ['adult_woman', 'adult_man', 'child_girl_8', 'adolescent_boy_14'], householdCount}))
];

const results = definitions.map(({id, label, scenario: input}) => ({id, label, result: calculateArcSiteLeaseEconomics({scenario: input})}));
const compactRows = results.map(({id, label, result}) => {
  const household = result.households[0];
  return {
    id,
    scenario: label,
    households: result.scenario.household_count,
    site: result.scenario.site_label,
    productive_land_ha: household.calculated_productive_land_ha,
    mature_land_ha: household.mature_productive_land_requirement_ha,
    property_area_ha: result.project_land.total_property_area_ha,
    land_value_cad: result.project_land.total_land_value_cad,
    dwelling_finance_month_cad: household.recurring_monthly_cost_cad.dwelling_financing_monthly_cad,
    site_lease_month_cad: household.site_lease.monthly_total_cad,
    shared_service_month_cad: household.shared_infrastructure_service.monthly_cad,
    resident_monthly_cost_cad: household.total_recurring_monthly_cost_cad,
    project_annual_revenue_cad: result.project.annual_revenue_cad.total,
    project_annual_cost_cad: result.project.annual_costs_cad.total,
    annual_reserve_cad: result.project.annual_reserves_cad,
    break_even: result.project.break_even.status
  };
});
const csvEscape = (value) => { const text = value == null ? '' : String(value); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; };
const headers = Object.keys(compactRows[0]);
fs.writeFileSync(path.join(outputDir, 'arc-site-lease-economics.csv'), [headers.join(','), ...compactRows.map((row) => headers.map((key) => csvEscape(row[key])).join(','))].join('\n') + '\n');
fs.writeFileSync(path.join(outputDir, 'arc-site-lease-economics.json'), JSON.stringify({contract_version: '1.0.0', generated_at: new Date().toISOString(), scenarios: results.map(({id, label, result}) => ({id, label, result})), comparison_rows: compactRows}, null, 2) + '\n');

const family = results.find((row) => row.id === 'family_ordinary_12');
const ordinaryAdult = results.find((row) => row.id === 'one_adult_ordinary_12');
const marginalAdult = results.find((row) => row.id === 'one_adult_marginal_12');
const communityRows = compactRows.filter((row) => row.id.startsWith('family_ordinary_'));
const markdown = [
  '# ARC site-lease economics',
  '',
  'This report models a resident-owned dwelling on a project-owned ARC property. The household leases its calculated productive site and pays a separate shared-infrastructure/service charge. It does not use the obsolete combined dwelling-plus-land shortcut.',
  '',
  '## Central accounting',
  '',
  '- Productive hectares come from the canonical carrying-capacity establishment peak for the household, site and heated buildings.',
  '- The recommended site-lease allocation is **base plus hectare**: land finance recovery and property tax follow productive hectares; common land-holding costs are divided equally.',
  '- Shared infrastructure is financed and recovered separately from land lease. Legal lease term is 49 years; debt amortization is 30 years.',
  '- Default monetary inputs are planning assumptions pending a site design, current land evidence, assessment/tax data and construction/servicing quotes.',
  '',
  '## Household comparison',
  '',
  '| Scenario | Establishment site | Mature site | Project property | Land value | Dwelling finance/mo | Site lease/mo | Shared services/mo | Resident total/mo |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
  ...[ordinaryAdult, marginalAdult, family].map(({label, result}) => { const row = compactRows.find((candidate) => candidate.scenario === label); return `| ${label} | ${ha(row.productive_land_ha)} | ${ha(row.mature_land_ha)} | ${ha(row.property_area_ha)} | ${money(row.land_value_cad)} | ${money(row.dwelling_finance_month_cad)} | ${money(row.site_lease_month_cad)} | ${money(row.shared_service_month_cad)} | ${money(row.resident_monthly_cost_cad)} |`; }),
  '',
  `For the central 12-household ordinary-land case, the one-adult household costs **${money(compactRows.find((row) => row.id === 'one_adult_ordinary_12').resident_monthly_cost_cad)}/month** under the default financed-land, financed-dwelling and shared-service assumptions. The family case costs **${money(compactRows.find((row) => row.id === 'family_ordinary_12').resident_monthly_cost_cad)}/month**; children change the canonical food-site requirement but do not create a separate child dwelling allocation.`,
  '',
  '## Community scale: 2 adults + 2 children per household',
  '',
  '| Households | Productive site area | Total property | Land value | Site lease/mo | Shared services/mo | Resident total/mo | Annual reserve |',
  '|---:|---:|---:|---:|---:|---:|---:|---:|',
  ...communityRows.map((row) => `| ${row.households} | ${ha(row.productive_land_ha * row.households)} | ${ha(row.property_area_ha)} | ${money(row.land_value_cad)} | ${money(row.site_lease_month_cad)} | ${money(row.shared_service_month_cad)} | ${money(row.resident_monthly_cost_cad)} | ${money(row.annual_reserve_cad)} |`),
  '',
  'The shared-service charge falls as households share the same capital and operating base. Productive site area and land value still scale with household requirements.',
  '',
  '## Project recovery',
  '',
  '| Scenario | Annual project revenue | Annual project cost | Surplus / shortfall | Break-even |',
  '|---|---:|---:|---:|---|',
  ...compactRows.slice(0, 5).map((row) => `| ${row.scenario} | ${money(row.project_annual_revenue_cad)} | ${money(row.project_annual_cost_cad)} | ${money(row.project_annual_revenue_cad - row.project_annual_cost_cad)} | ${row.break_even} |`),
  '',
  'Full machine-readable rows are in `arc-site-lease-economics.json` and `arc-site-lease-economics.csv`.',
  '',
  '## Evidence limits',
  '',
  '- The repository contains no current parcel-matched Grey County rural land-price series; the default 35,000 CAD/ha is the midpoint of the task-specified working range and must be treated as sensitivity only.',
  '- No current ARC dwelling construction quote, property assessment/tax roll, servicing design, insurance quote or replacement study is loaded.',
  '- The monetary layer is therefore a transparent planning model. The biological hectares and heating loads remain canonical carrying-capacity outputs and are not tuned to fit a cost target.'
].join('\n');
fs.writeFileSync(path.join(outputDir, 'arc-site-lease-economics.md'), markdown + '\n');
console.log(`JSON: ${path.join(outputDir, 'arc-site-lease-economics.json')}`);
console.log(`CSV: ${path.join(outputDir, 'arc-site-lease-economics.csv')}`);
console.log(`Markdown: ${path.join(outputDir, 'arc-site-lease-economics.md')}`);
console.log(`ordinary one-adult: ${money(ordinaryAdult.result.households[0].total_recurring_monthly_cost_cad)}/month`);
console.log(`ordinary family: ${money(family.result.households[0].total_recurring_monthly_cost_cad)}/month`);
console.log(`marginal one-adult: ${money(marginalAdult.result.households[0].total_recurring_monthly_cost_cad)}/month`);
