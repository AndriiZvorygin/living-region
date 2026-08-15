import fs from 'node:fs';
import path from 'node:path';
import {calculateArcSiteLeaseEconomics, DEFAULT_SITE_LEASE_SCENARIO} from '../packages/carrying-capacity/src/index.mjs';

const outputDir = path.resolve('packages/carrying-capacity/outputs');
fs.mkdirSync(outputDir, {recursive: true});
const clone = (value) => structuredClone(value);
const money = (value) => Number(value ?? 0).toFixed(2);
const csvEscape = (value) => { const text = value == null ? '' : String(value); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; };

const householdCases = [
  {id: 'one_adult_ordinary', label: '1 adult · ordinary land', site_id: 'ordinary_mesic', members: ['reference_adult_man']},
  {id: 'one_adult_marginal', label: '1 adult · marginal land', site_id: 'shallow_rocky_marginal', members: ['reference_adult_man']},
  {id: 'one_adult_plus_child', label: '1 adult + 1 child · ordinary land', site_id: 'ordinary_mesic', members: ['adult_man', 'child_girl_8']},
  {id: 'two_adults', label: '2 adults · ordinary land', site_id: 'ordinary_mesic', members: ['adult_woman', 'adult_man']},
  {id: 'family_two_children', label: '2 adults + 2 children · ordinary land', site_id: 'ordinary_mesic', members: ['adult_woman', 'adult_man', 'child_girl_8', 'adolescent_boy_14']},
  {id: 'family_three_children', label: '2 adults + 3 children · ordinary land', site_id: 'ordinary_mesic', members: ['adult_woman', 'adult_man', 'child_girl_8', 'adolescent_boy_14', 'child_boy_8']}
];
const sizes = [12, 16, 25, 50];
const prices = [20000, 35000, 60000];
const ownerships = [
  {id: 'financed', ownership: 'financed', recovery_mode: 'debt_service'},
  {id: 'owned_out_right', ownership: 'owned_out_right', recovery_mode: 'none'},
  {id: 'donated_land_trust', ownership: 'donated_land_trust', recovery_mode: 'none'}
];

function makeScenario({household, householdCount = 12, price = 35000, ownership = 'financed', recoveryMode = 'debt_service'} = {}) {
  const base = clone(DEFAULT_SITE_LEASE_SCENARIO);
  return {
    ...base,
    site_id: household.site_id,
    household: {...base.household, household_id: `${household.id}-household`, label: household.label, members: household.members},
    community: {...base.community, project_id: `${household.id}-${householdCount}`, label: `${household.label} · ${householdCount} households`, household_count: householdCount},
    land: {...base.land, price_cad_per_ha: price, ownership, recovery_mode: recoveryMode}
  };
}

function rowFor(householdCase, result, {price = 35000, ownership = 'financed'} = {}) {
  const row = result.households[0];
  const landInfrastructure = row.land_infrastructure;
  return {
    id: householdCase.id,
    scenario: householdCase.label,
    site_class: result.scenario.site_label,
    households_in_project: result.scenario.household_count,
    land_price_cad_per_ha: price,
    land_ownership: ownership,
    establishment_allocation_ha: row.reserved_productive_land_ha,
    mature_productive_requirement_ha: row.mature_productive_land_requirement_ha,
    peak_year: row.establishment_peak_year,
    total_property_area_ha: result.project_land.total_property_area_ha,
    total_land_value_cad: result.project_land.total_land_value_cad,
    common_property_land_holding_share_monthly_cad: row.site_lease.common_property_land_holding_share_monthly_cad,
    productive_land_charge_per_hectare_monthly_cad: row.site_lease.productive_land_charge_per_hectare_monthly_cad,
    productive_land_portion_monthly_cad: row.site_lease.productive_land_portion_monthly_cad,
    site_lease_monthly_cad: landInfrastructure.site_lease_monthly_cad,
    shared_infrastructure_monthly_cad: landInfrastructure.shared_infrastructure_monthly_cad,
    combined_land_infrastructure_monthly_cad: landInfrastructure.combined_monthly_cad,
    completed_dwelling_capital_cad: row.completed_dwelling.completed_dwelling_capital_cad,
    completed_dwelling_low_cad: row.completed_dwelling.source_record.legacy_completed_dwelling_range_cad.low,
    completed_dwelling_high_cad: row.completed_dwelling.source_record.legacy_completed_dwelling_range_cad.high,
    illustrative_dwelling_financing_monthly_cad: row.affordability.illustrative_dwelling_financing_monthly_cad,
    illustrative_dwelling_plus_land_shared_monthly_cad: row.affordability.illustrative_dwelling_financing_plus_land_shared_monthly_cad,
    infrastructure_scenario: result.scenario.infrastructure_scenario_id,
    administration_scenario: result.project_land.administration.scenario_id,
    administration_annual_cad: result.project_land.administration.annual_total_cad,
    administration_monthly_per_household_cad: result.project_land.administration.monthly_per_household_cad,
    common_property_operations_annual_cad: result.project_land.common_property_operations.annual_total_cad,
    common_area_mode: result.scenario.common_area_accounting.mode,
    annual_site_lease_revenue_cad: result.project.annual_revenue_cad.site_leases,
    annual_land_layer_cost_cad: result.project.land_layer_break_even.land_layer_cost_cad,
    land_layer_break_even: result.project.land_layer_break_even.revenue_equals_required_cost_recovery
  };
}

const rows = [];
for (const householdCase of householdCases) {
  const result = calculateArcSiteLeaseEconomics({scenario: makeScenario({household: householdCase})});
  rows.push(rowFor(householdCase, result));
}
for (const householdCount of sizes) {
  const householdCase = householdCases.find((row) => row.id === 'family_two_children');
  const result = calculateArcSiteLeaseEconomics({scenario: makeScenario({household: householdCase, householdCount})});
  rows.push(rowFor({...householdCase, id: `${householdCase.id}_${householdCount}`}, result));
}
const sensitivity = [];
for (const householdCount of sizes) for (const price of prices) for (const mode of ownerships) {
  const householdCase = householdCases.find((row) => row.id === 'family_two_children');
  const result = calculateArcSiteLeaseEconomics({scenario: makeScenario({household: householdCase, householdCount, price, ownership: mode.ownership, recoveryMode: mode.recovery_mode})});
  sensitivity.push(rowFor({...householdCase, id: `${householdCase.id}_${householdCount}_${price}_${mode.id}`}, result, {price, ownership: mode.id}));
}

const allRows = [...rows, ...sensitivity];
const auditExample = calculateArcSiteLeaseEconomics({scenario: makeScenario({household: householdCases[0]})});
const auditHousehold = auditExample.households[0];
const decomposition = {
  household: householdCases[0].label,
  common_property_land_holding_share_monthly_cad: auditHousehold.site_lease.common_property_land_holding_share_monthly_cad,
  common_property_land_holding_components_monthly_cad: auditHousehold.site_lease.common_property_land_holding.monthly_components_cad,
  productive_land_allocation_ha: auditHousehold.site_lease.productive_land_allocation_ha,
  productive_land_charge_per_hectare_monthly_cad: auditHousehold.site_lease.productive_land_charge_per_hectare_monthly_cad,
  productive_land_components_monthly_cad: auditHousehold.site_lease.productive_land_charge.monthly_components_cad,
  productive_land_components_monthly_per_hectare_cad: auditHousehold.site_lease.productive_land_charge.monthly_components_per_hectare_cad,
  productive_land_portion_monthly_cad: auditHousehold.site_lease.productive_land_portion_monthly_cad,
  site_lease_monthly_cad: auditHousehold.site_lease.monthly_total_cad,
  land_financing: auditExample.land_financing
};
const headers = Object.keys(allRows[0]);
fs.writeFileSync(path.join(outputDir, 'arc-household-affordability.csv'), [headers.join(','), ...allRows.map((row) => headers.map((key) => csvEscape(row[key])).join(','))].join('\n') + '\n');
fs.writeFileSync(path.join(outputDir, 'arc-household-affordability.json'), JSON.stringify({
  contract_version: '2.1.0',
  generated_at: new Date().toISOString(),
  accounting_rule: 'site lease = equal common-property land holding share + productive hectares × productive land charge per hectare; shared infrastructure is separate',
  biology_source: 'calculateArcSiteLeaseEconomics carrying-capacity outputs',
  household_comparison: rows,
  decomposition_example: decomposition,
  community_size_sensitivity: rows.filter((row) => row.id.startsWith('family_two_children_') && sizes.some((size) => row.id.endsWith(`_${size}`))),
  land_price_ownership_sensitivity: sensitivity
}, null, 2) + '\n');

const baseRows = rows.filter((row) => householdCases.some((item) => item.id === row.id));
const sizeRows = rows.filter((row) => row.id.startsWith('family_two_children_'));
const table = (items) => items.map((row) => `| ${row.scenario} | ${row.households_in_project} | ${row.establishment_allocation_ha.toFixed(2)} ha | $${money(row.common_property_land_holding_share_monthly_cad)} | $${money(row.productive_land_charge_per_hectare_monthly_cad)} | $${money(row.productive_land_portion_monthly_cad)} | $${money(row.site_lease_monthly_cad)} | $${money(row.shared_infrastructure_monthly_cad)} | $${money(row.combined_land_infrastructure_monthly_cad)} | $${money(row.completed_dwelling_capital_cad)} | $${money(row.illustrative_dwelling_financing_monthly_cad)} / mo | $${money(row.illustrative_dwelling_plus_land_shared_monthly_cad)} / mo |`).join('\n');
const markdown = [
  '# ARC household affordability and land lease',
  '',
  'This household-first report starts with canonical carrying-capacity hectares and then applies transparent planning economics. Land + shared infrastructure remains the ARC site charge; the completed resident-owned dwelling and its illustrative financing are reported separately.',
  '',
  '## Accounting structure',
  '',
  '- **Biology determines hectares:** establishment peak land is reserved; mature productive need remains visible separately.',
  '- **Site lease:** equal common-property land holding share plus productive hectares multiplied by the productive land charge per hectare.',
  '- **Shared infrastructure:** selected minimal, shared-services or amenity-rich fee, kept outside the site lease.',
  '- **Public site-charge scope:** only the site lease and selected shared infrastructure are included. The completed dwelling is a separate resident-owned capital layer, and household operating expenses remain outside this comparison.',
  '',
  '## Site-lease decomposition · reference adult',
  '',
  `- Common-property land holding share: **$${money(decomposition.common_property_land_holding_share_monthly_cad)}/month**, allocated equally across the 12-household project. The legal-minimum default currently uses a zero-hectare common-area lower bound because no parcel/site-plan takeoff is loaded; actual access, setback, buffer and common land must replace this lower bound.`,
  `- Productive land: **${decomposition.productive_land_allocation_ha.toFixed(2)} ha × $${money(decomposition.productive_land_charge_per_hectare_monthly_cad)}/ha/month = $${money(decomposition.productive_land_portion_monthly_cad)}/month**. It recovers the selected land-finance debt service and explicit productive-land tax proxy; vacancy reserve, paid administration and optional insurance are excluded from the legal-minimum default.`,
  `- Total site lease: **$${money(decomposition.site_lease_monthly_cad)}/month**. Initial land equity is **$${money(decomposition.land_financing.initial_equity_contribution_cad)}** project capital and has **$0 recurring equity recovery** in this model.`,
  `- Completed resident-owned ARC dwelling: **$${money(auditHousehold.completed_dwelling.completed_dwelling_capital_cad)} central** (${money(auditHousehold.completed_dwelling.source_record.legacy_completed_dwelling_range_cad.low)}–${money(auditHousehold.completed_dwelling.source_record.legacy_completed_dwelling_range_cad.high)} planning range). Its components are exposed in the canonical dwelling contract; household water, sanitation/greywater, hot water and electrical systems are included once in that capital package.`,
  '',
  '## Household comparison · default 12-household community',
  '',
  '| Household | Community | Reserved hectares | Common-property share | Productive land/ha/mo | Productive portion | Site lease | Shared infrastructure | Land + infrastructure/mo | Dwelling capital | Illustrative dwelling finance | Dwelling finance + land/shared |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  table(baseRows),
  '',
  'The common-property land holding share is broadly unchanged as household hectares vary. In the current legal-minimum lower-bound case it is zero until spatial common land is supplied. The productive land portion rises with the calculated establishment allocation. Children contribute to pooled dependent food demand while growing up, but do not automatically create a permanent child-specific perennial allocation.',
  '',
  '## Community-size sensitivity · 2 adults + 2 children',
  '',
  '| Household | Community | Reserved hectares | Common-property share | Productive land/ha/mo | Productive portion | Site lease | Shared infrastructure | Land + infrastructure/mo | Dwelling capital | Illustrative dwelling finance | Dwelling finance + land/shared |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  table(sizeRows),
  '',
  'Community size lowers fixed/common charges and shared infrastructure per household. It does not change the selected household\'s carrying-capacity hectares or the productive-land rate itself.',
  '',
  '## Whole-property recovery',
  '',
  'The underlying property is one title. Productive/exclusive land value and property tax are recovered through the productive land portion. Once a site-plan takeoff is available, common property value, roads/access land, common buffers and other fixed land costs will be recovered through the common-property land holding share. The sum of site leases is independently checked against the land-layer break-even requirement before shared-service revenue is considered.',
  '',
  '## Assumption status',
  '',
  '- CAD 35,000/ha is a planning midpoint, not established current Grey County market evidence.',
  '- Property tax, insurance, legal structure, administration and reserves require property-specific review. The legal-minimum baseline treats paid administration, vacancy reserves and optional insurance as zero recurring cash, while resident labour and future liability remain visible; see `arc-legal-minimum.md` and `arc-common-property-audit.md`.',
  '- Infrastructure costs remain explicit scenario placeholders pending a site design, legal review and procurement quotes.',
  '- The model preserves legal lease term, debt amortization and replacement reserve horizons as separate concepts.',
  '',
  'Machine-readable outputs: `arc-household-affordability.json` and `arc-household-affordability.csv`.'
].join('\n') + '\n';
fs.writeFileSync(path.join(outputDir, 'arc-household-affordability.md'), markdown);
console.log(`Markdown: ${path.join(outputDir, 'arc-household-affordability.md')}`);
console.log(`JSON: ${path.join(outputDir, 'arc-household-affordability.json')}`);
console.log(`CSV: ${path.join(outputDir, 'arc-household-affordability.csv')}`);
