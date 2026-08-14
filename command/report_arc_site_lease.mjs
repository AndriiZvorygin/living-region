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
    base_land_charge_month_cad: household.site_lease.base_household_land_holding_charge_monthly_cad,
    land_charge_per_ha_month_cad: household.site_lease.land_charge_per_hectare_month_cad,
    hectare_portion_month_cad: household.site_lease.hectare_portion_monthly_cad,
    site_lease_month_cad: household.site_lease.monthly_total_cad,
    shared_service_month_cad: household.shared_infrastructure_service.monthly_cad,
    land_infrastructure_month_cad: household.land_infrastructure.combined_monthly_cad,
    land_layer_annual_revenue_cad: result.project.land_layer_break_even.site_lease_revenue_cad,
    land_layer_annual_cost_cad: result.project.land_layer_break_even.land_layer_cost_cad,
    infrastructure_layer_annual_revenue_cad: result.project.infrastructure_layer_break_even.shared_service_revenue_cad,
    infrastructure_layer_annual_cost_cad: result.project.infrastructure_layer_break_even.infrastructure_layer_cost_cad,
    land_layer_break_even: result.project.land_layer_break_even.revenue_equals_required_cost_recovery,
    infrastructure_layer_break_even: result.project.infrastructure_layer_break_even.revenue_equals_required_cost_recovery
  };
});
const csvEscape = (value) => { const text = value == null ? '' : String(value); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; };
const headers = Object.keys(compactRows[0]);
fs.writeFileSync(path.join(outputDir, 'arc-site-lease-economics.csv'), [headers.join(','), ...compactRows.map((row) => headers.map((key) => csvEscape(row[key])).join(','))].join('\n') + '\n');
fs.writeFileSync(path.join(outputDir, 'arc-site-lease-economics.json'), JSON.stringify({contract_version: '1.1.0', generated_at: new Date().toISOString(), scope: 'ARC land lease plus shared infrastructure only; private dwelling and household expenses excluded', scenarios: compactRows, comparison_rows: compactRows}, null, 2) + '\n');

const family = results.find((row) => row.id === 'family_ordinary_12');
const ordinaryAdult = results.find((row) => row.id === 'one_adult_ordinary_12');
const marginalAdult = results.find((row) => row.id === 'one_adult_marginal_12');
const communityRows = compactRows.filter((row) => row.id.startsWith('family_ordinary_'));
const markdown = [
  '# ARC site-lease economics',
  '',
  'This report covers the ARC site lease and selected shared infrastructure only. The private dwelling is acquired separately and is outside the public land-and-infrastructure charge.',
  '',
  '## Central accounting',
  '',
  '- Productive hectares come from the canonical carrying-capacity establishment peak for the household, site and heated buildings.',
  '- The recommended site-lease allocation is **base plus hectare**: productive/exclusive land finance recovery and property tax follow productive hectares; common-property land value, common tax and fixed land-holding costs are divided equally as the base household charge.',
  '- Shared infrastructure is financed and recovered separately from land lease. Legal lease term is 49 years; debt amortization is 30 years.',
  '- Default monetary inputs are planning assumptions pending a site design, current land evidence, assessment/tax data and construction/servicing quotes.',
  '',
  '## Household comparison',
  '',
  '| Scenario | Establishment site | Mature site | Project property | Land value | Site lease/mo | Shared services/mo | Land + infrastructure/mo |',
  '|---|---:|---:|---:|---:|---:|---:|---:|',
...[ordinaryAdult, marginalAdult, family].map(({label, result}) => { const row = compactRows.find((candidate) => candidate.scenario === label); return `| ${label} | ${ha(row.productive_land_ha)} | ${ha(row.mature_land_ha)} | ${ha(row.property_area_ha)} | ${money(row.land_value_cad)} | ${money(row.site_lease_month_cad)} | ${money(row.shared_service_month_cad)} | ${money(row.land_infrastructure_month_cad)} |`; }),
  '',
  `For the central 12-household ordinary-land case, the one-adult land + infrastructure charge is **${money(compactRows.find((row) => row.id === 'one_adult_ordinary_12').land_infrastructure_month_cad)}/month**. The 2-adult + 2-child case is **${money(compactRows.find((row) => row.id === 'family_ordinary_12').land_infrastructure_month_cad)}/month**; children change the canonical reserved land requirement without creating a separate child-specific perennial allocation.`,
  '',
  '## Community scale: 2 adults + 2 children per household',
  '',
  '| Households | Productive site area | Total property | Land value | Site lease/mo | Shared services/mo | Land + infrastructure/mo |',
  '|---:|---:|---:|---:|---:|---:|---:|',
...communityRows.map((row) => `| ${row.households} | ${ha(row.productive_land_ha * row.households)} | ${ha(row.property_area_ha)} | ${money(row.land_value_cad)} | ${money(row.site_lease_month_cad)} | ${money(row.shared_service_month_cad)} | ${money(row.land_infrastructure_month_cad)} |`),
  '',
  'The shared-service charge falls as households share the same capital and operating base. Productive site area and land value still scale with household requirements.',
  '',
  '## Project recovery',
  '',
  '| Scenario | Land-layer revenue | Land-layer cost | Infrastructure revenue | Infrastructure cost | Land check | Infrastructure check |',
  '|---|---:|---:|---:|---:|---|---|',
  ...compactRows.slice(0, 5).map((row) => `| ${row.scenario} | ${money(row.land_layer_annual_revenue_cad)} | ${money(row.land_layer_annual_cost_cad)} | ${money(row.infrastructure_layer_annual_revenue_cad)} | ${money(row.infrastructure_layer_annual_cost_cad)} | ${row.land_layer_break_even ? 'break-even' : 'shortfall'} | ${row.infrastructure_layer_break_even ? 'break-even' : 'shortfall'} |`),
  '',
  'Full machine-readable rows are in `arc-site-lease-economics.json` and `arc-site-lease-economics.csv`.',
  '',
  '## Evidence limits',
  '',
  '- The repository contains no current parcel-matched Grey County rural land-price series; the default 35,000 CAD/ha is the midpoint of the task-specified working range and must be treated as sensitivity only.',
  '- Dwelling acquisition and household expenses are intentionally outside this report; building/heating inputs affect biological hectares upstream but do not become a housing charge here.',
  '- The monetary layer is therefore a transparent planning model. The biological hectares and heating loads remain canonical carrying-capacity outputs and are not tuned to fit a cost target.'
].join('\n');
fs.writeFileSync(path.join(outputDir, 'arc-site-lease-economics.md'), markdown + '\n');
console.log(`JSON: ${path.join(outputDir, 'arc-site-lease-economics.json')}`);
console.log(`CSV: ${path.join(outputDir, 'arc-site-lease-economics.csv')}`);
console.log(`Markdown: ${path.join(outputDir, 'arc-site-lease-economics.md')}`);
  console.log(`ordinary one-adult land + infrastructure: ${money(ordinaryAdult.result.households[0].land_infrastructure.combined_monthly_cad)}/month`);
  console.log(`ordinary family land + infrastructure: ${money(family.result.households[0].land_infrastructure.combined_monthly_cad)}/month`);
  console.log(`marginal one-adult land + infrastructure: ${money(marginalAdult.result.households[0].land_infrastructure.combined_monthly_cad)}/month`);
