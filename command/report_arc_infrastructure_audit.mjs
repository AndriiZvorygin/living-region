import fs from 'node:fs';
import path from 'node:path';
import {
  calculateArcSiteLeaseEconomics,
  DEFAULT_SITE_LEASE_SCENARIO,
  INFRASTRUCTURE_SCENARIOS
} from '../packages/carrying-capacity/src/index.mjs';

const outputPath = path.resolve('packages/carrying-capacity/outputs/arc-infrastructure-audit.md');
fs.mkdirSync(path.dirname(outputPath), {recursive: true});
const clone = (value) => structuredClone(value);
const money = (value) => `$${Number(value ?? 0).toFixed(2)}`;
const wholeMoney = (value) => `$${Number(value ?? 0).toFixed(0)}`;
const pct = (value) => `${(Number(value ?? 0) * 100).toFixed(1)}%`;
const scenarioFor = (infrastructureScenarioId, householdCount) => ({
  ...clone(DEFAULT_SITE_LEASE_SCENARIO),
  infrastructure_scenario_id: infrastructureScenarioId,
  household: {
    ...clone(DEFAULT_SITE_LEASE_SCENARIO.household),
    household_id: `${infrastructureScenarioId}-${householdCount}-family`,
    label: '2 adults + 3 dependent children family-capacity case',
    members: ['adult_woman', 'adult_man', 'child_girl_8', 'adolescent_boy_14', 'child_boy_8']
  },
  community: {
    ...clone(DEFAULT_SITE_LEASE_SCENARIO.community),
    project_id: `arc-${infrastructureScenarioId}-${householdCount}`,
    label: `${householdCount}-household ${INFRASTRUCTURE_SCENARIOS[infrastructureScenarioId].label}`,
    household_count: householdCount
  }
});
const calculate = (infrastructureScenarioId, householdCount) => calculateArcSiteLeaseEconomics({scenario: scenarioFor(infrastructureScenarioId, householdCount)});

const legacy = calculate('legacy_current', 12);
const legacyHousehold = legacy.households[0];
const scaleRows = Object.keys(INFRASTRUCTURE_SCENARIOS).flatMap((scenarioId) => [12, 16, 25, 50].map((householdCount) => {
  const result = calculate(scenarioId, householdCount);
  const household = result.households[0];
  return {
    scenarioId,
    scenarioLabel: result.infrastructure.scenario_label,
    householdCount,
    infrastructureCapital: result.infrastructure.capital_value_cad,
    infrastructureOperating: result.infrastructure.annual_costs_cad.operating,
    infrastructureReserve: result.infrastructure.annual_costs_cad.replacement_reserve,
    sharedMonthly: household.shared_infrastructure_service.monthly_cad,
    siteLeaseMonthly: household.site_lease.monthly_total_cad,
    landInfrastructureMonthly: household.land_infrastructure.combined_monthly_cad,
    landHectares: result.project_land.total_property_area_ha
  };
}));
const rowFor = (scenarioId, householdCount) => scaleRows.find((row) => row.scenarioId === scenarioId && row.householdCount === householdCount);
const lineRows = legacy.infrastructure.line_items;
const lineMarkdown = lineRows.map((row) => {
  const financing = row.capital_cost_cad > 0
    ? `${pct(row.financing_term.interest_rate_annual)} / ${row.financing_term.amortization_years} y`
    : 'none';
  const source = [row.source_status, row.notes].filter(Boolean).join(' ');
  return `| ${row.component} | ${wholeMoney(row.capital_cost_cad)} | ${financing} | ${wholeMoney(row.annual_operating_cost_cad)} | ${wholeMoney(row.annual_maintenance_cad)} | ${wholeMoney(row.replacement_reserve_annual_cad)} | ${money(row.monthly_household_allocation_cad)} | ${row.requiredness} | ${source} |`;
}).join('\n');
const landAccounting = legacy.project_land.land_accounting;
const landLineRows = [
  ['Common land acquisition/debt recovery', landAccounting.acquisition.common_land_value_cad, `${pct(legacy.project_land.financing.interest_rate_annual)} / ${legacy.project_land.financing.loan_term_years ?? '—'} y term / ${legacy.project_land.financing.amortization_years} y amortization`, landAccounting.acquisition.common_land_finance_recovery_annual_cad, 0, 0, legacyHousehold.site_lease.common_property_land_holding.monthly_components_cad.common_land_finance_recovery_monthly_cad, 'common-property land holding share', 'common property is recovered equally'],
  ['Productive land acquisition/debt recovery', landAccounting.acquisition.productive_land_value_cad, `${pct(legacy.project_land.financing.interest_rate_annual)} / ${legacy.project_land.financing.loan_term_years ?? '—'} y term / ${legacy.project_land.financing.amortization_years} y amortization`, landAccounting.acquisition.productive_land_finance_recovery_annual_cad, 0, 0, legacyHousehold.site_lease.productive_land_charge.monthly_components_cad.productive_land_finance_recovery_monthly_cad, 'productive land charge', 'productive land follows calculated hectares'],
  ['Common and productive property tax', legacy.project_land.total_land_value_cad, 'none', legacy.project_land.annual_costs_cad.property_tax, 0, 0, (legacyHousehold.site_lease.common_property_land_holding.monthly_components_cad.common_property_tax_monthly_cad + legacyHousehold.site_lease.productive_land_charge.monthly_components_cad.productive_property_tax_monthly_cad), 'common share + productive land charge', 'planning assumption; parcel assessment required'],
  ['Land insurance', 0, 'none', legacy.project_land.annual_costs_cad.land_insurance, 0, 0, legacyHousehold.site_lease.common_property_land_holding.monthly_components_cad.land_insurance_monthly_cad, 'common-property land holding share', 'site-lease layer; separate from infrastructure service'],
  ['Common land costs', 0, 'none', legacy.project_land.annual_costs_cad.common_land_costs, 0, 0, legacyHousehold.site_lease.common_property_land_holding.monthly_components_cad.common_land_costs_monthly_cad, 'common-property land holding share', 'common-property operating cost'],
  ['Land-holding administration', 0, 'none', legacy.project_land.annual_costs_cad.administration, 0, 0, legacyHousehold.site_lease.common_property_land_holding.monthly_components_cad.administration_monthly_cad, 'common-property land holding share', 'charged once in land layer'],
  ['Vacancy allowance', 0, 'none', legacy.project_land.annual_costs_cad.vacancy_reserve, 0, legacy.project_land.annual_costs_cad.vacancy_reserve, legacyHousehold.site_lease.common_property_land_holding.monthly_components_cad.common_vacancy_reserve_monthly_cad + legacyHousehold.site_lease.productive_land_charge.monthly_components_cad.productive_vacancy_reserve_monthly_cad, 'common share + productive land charge', 'reserve; common and productive portions are separate and applied once']
];
const landLineMarkdown = landLineRows.map(([label, capital, financing, annual, maintenance, reserve, monthly, layer, status]) => `| ${label} | ${wholeMoney(capital)} | ${financing} | ${wholeMoney(annual)} | ${wholeMoney(maintenance)} | ${wholeMoney(reserve)} | ${money(monthly)} | ${layer} | ${status} |`).join('\n');
const componentCheck = legacy.infrastructure.line_items.reduce((sum, row) => sum + row.annual_total_cad, 0);
const oldMonthly = legacy.infrastructure.annual_costs_cad.total / 12 / 12;
const scenarioSummary = Object.keys(INFRASTRUCTURE_SCENARIOS).map((scenarioId) => {
  const row = rowFor(scenarioId, 12);
  return `| ${row.scenarioLabel} | ${wholeMoney(row.infrastructureCapital)} | ${wholeMoney(row.infrastructureOperating)} | ${wholeMoney(row.infrastructureReserve)} | ${money(row.sharedMonthly)} | ${money(row.siteLeaseMonthly)} | ${money(row.landInfrastructureMonthly)} |`;
}).join('\n');
const scaleMarkdown = ['legacy_current', 'legal_minimum', 'minimal_compliant', 'shared_services', 'amenity_rich'].flatMap((scenarioId) => {
  const label = INFRASTRUCTURE_SCENARIOS[scenarioId].label;
  return [
    `### ${label}`,
    '',
    '| Households | Infrastructure capital | Annual operating | Annual reserve | Shared services / household / month | Site lease / month | Land + infrastructure / household / month |',
    '|---:|---:|---:|---:|---:|---:|---:|',
    ...[12, 16, 25, 50].map((count) => { const row = rowFor(scenarioId, count); return `| ${count} | ${wholeMoney(row.infrastructureCapital)} | ${wholeMoney(row.infrastructureOperating)} | ${wholeMoney(row.infrastructureReserve)} | ${money(row.sharedMonthly)} | ${money(row.siteLeaseMonthly)} | ${money(row.landInfrastructureMonthly)} |`; }),
    ''
  ];
}).join('\n');
const distributedRows = calculate('shared_services', 12).infrastructure.distributed_alternatives.comparisons
  .filter((row) => ['shared_water', 'shared_sewage', 'electrical_distribution', 'common_laundry', 'shared_heating'].includes(row.component_id));
const distributedMarkdown = distributedRows.map((row) => `| ${row.component} | ${money(row.centralized_annual_per_household_cad / 12)} | ${wholeMoney(row.distributed_capital_total_cad)} | ${money(row.distributed_monthly_per_household_cad)} | ${row.result} | ${row.source_status} |`).join('\n');
const doubleCountRows = [
  ['Capital debt + replacement reserve', 'Not a duplicate in the model.', 'Debt service repays financed capital; reserve is a separate future-renewal fund. Legacy baseline starts full reserve immediately; minimal/shared use the explicit early-life sensitivity by default.'],
  ['Infrastructure maintenance + dwelling maintenance', 'Separate layers.', 'Infrastructure line maintenance is applied to shared capital. Dwelling maintenance/replacement is applied only to the resident-owned dwelling capital.'],
  ['Shared utilities + household utilities', 'Potential ambiguity, not arithmetic duplication in the new scenarios.', 'Central water/sewer/electric appears only in infrastructure. The $1,800/year household allowance remains household-specific; distributed alternatives are reported separately and are not added to the shared charge.'],
  ['Insurance', 'Separate by asset layer.', 'Land insurance is in the site lease. Infrastructure insurance is a shared-service line. No dwelling insurance is silently inserted into either.'],
  ['Property tax', 'Single recovery layer.', 'Property tax appears only in the project-land/site-lease pool, not in infrastructure.'],
  ['Road/access', 'Separated for audit.', 'Internal access capital, road maintenance and snow clearing are separate lines. The old combined operating pool is split 10,000/8,000 for traceability.'],
  ['Water/sewage', 'Separated for audit.', 'Central water and sewage capital/operations are distinct. Distributed alternatives are comparison rows, not an additional charge.'],
  ['Administration/vacancy', 'Legacy overlap identified.', 'The legacy baseline includes $18,000 infrastructure administration plus $18,000 land-holding administration. Recommended scenarios charge administration only in the land layer; vacancy is applied once to the site-lease pool.']
].map(([check, finding, treatment]) => `| ${check} | ${finding} | ${treatment} |`).join('\n');

const markdown = [
  '# ARC infrastructure economics audit',
  '',
  'Generated from the canonical calculateArcSiteLeaseEconomics API. The audit preserves the former configuration as legacy_current, but the recommended affordability default is legal_minimum. All monetary values are CAD; they are planning assumptions until a property-specific design, legal review and procurement quotes exist.',
  '',
  '## Executive finding',
  '',
  `The former 12-household shared-services charge was **${money(oldMonthly)}/household/month** because the legacy configuration carried **${wholeMoney(legacy.infrastructure.capital_value_cad)}** of centralized capital, **${wholeMoney(legacy.infrastructure.annual_costs_cad.operating)}** of annual operations, **${wholeMoney(legacy.infrastructure.annual_costs_cad.maintenance)}** of maintenance and **${wholeMoney(legacy.infrastructure.annual_costs_cad.replacement_reserve)}** of replacement reserve. Its annual total was **${wholeMoney(legacy.infrastructure.annual_costs_cad.total)}**, divided by 12 households and 12 months.`,
  '',
  `The line-item total independently sums to ${wholeMoney(componentCheck)}. The exact old result is retained for audit, not recommended for affordability. The new legal-minimum central charge is **${money(rowFor('legal_minimum', 12).sharedMonthly)}/household/month** before household-specific distributed servicing alternatives. The former minimal-compliant tier remains an optional comparison.`,
  '',
  '## Legacy shared-services line-by-line breakdown',
  '',
  '| Component | Capital cost | Financing term | Annual operating cost | Annual maintenance | Replacement reserve | Monthly household allocation | Required / optional | Source / status |',
  '|---|---:|---|---:|---:|---:|---:|---|---|',
  lineMarkdown,
  '',
  'The monthly allocation includes that component’s debt service, operating cost, maintenance and active reserve mode, divided by 12 households and 12 months. Zero-capital lines still appear because they can carry operating costs or an explicit unresolved status.',
  '',
  '## Land/site-lease layer kept separate',
  '',
  '| Component | Capital basis | Financing term | Annual operating/recovery | Annual maintenance | Replacement reserve | Monthly household allocation | Layer | Source / status |',
  '|---|---:|---|---:|---:|---:|---:|---|---|',
  landLineMarkdown,
  '',
  'Property tax, land insurance, land-holding administration and vacancy allowance are site-lease items. They are not part of the shared-infrastructure service charge. The underlying land remains one project asset; households do not receive individually financed land principals.',
  '',
  '## Double-counting audit',
  '',
  '| Check | Finding | Treatment |',
  '|---|---|---|',
  doubleCountRows,
  '',
  'The legacy administration configuration is the material identified overlap risk. It is retained only so the former number can be reproduced. The recommended scenarios set infrastructure administration to zero because the land-holding administration allowance already covers the central project layer. This is an accounting choice that must be confirmed when an actual operating entity and staffing plan exist.',
  '',
  '## Infrastructure scenarios',
  '',
  '| Scenario | Capital | Annual operating | Annual reserve | Shared services / household / month | Site lease / month | Land + infrastructure / household / month |',
  '|---|---:|---:|---:|---:|---:|---:|',
  scenarioSummary,
  '',
  '- **Legal minimum ARC** is the recommended affordability default. It includes only the basic access capital debt placeholder in recurring shared cash; road/snow/waste labour and future replacement are shown separately. Water, wastewater and electricity remain distributed/site-specific alternatives unless legal and engineering review supports a shared system.',
  '- **Minimal compliant ARC** is an optional resilience/compliance comparison that adds paid maintenance, early reserves and insurance assumptions.',
  '- **Shared-services ARC** adds centralized water, wastewater, electrical distribution, laundry and selected equipment/common facilities where an economy of scale may exist. These are not all legally required.',
  '- **Amenity-rich ARC** adds a larger common building, laundry and shared equipment. Those costs are convenience/amenity or optional cost-saving choices, not part of the basic headline affordability case.',
  '',
  scaleMarkdown,
  '## Replacement reserve sensitivity',
  '',
  'Debt service and replacement reserves are reported separately. The default mode for minimal/shared services is an early-life contribution of 0.5% of capital; full lifecycle sensitivity is 1.0%. Both begin in year 1 in this planning model. The lower early-life case is not a waiver of future liability: it delays part of the reserve contribution while the assets are new.',
  '',
  '| Scenario | Reserve mode | Annual reserve | Shared charge / household / month |',
  '|---|---|---:|---:|',
  ...['minimal_compliant', 'shared_services', 'amenity_rich', 'legacy_current'].flatMap((scenarioId) => calculate(scenarioId, 12).infrastructure.reserve_sensitivity.map((row) => `| ${INFRASTRUCTURE_SCENARIOS[scenarioId].label} | ${row.mode} | ${wholeMoney(row.annual_reserve_cad)} | ${money(row.monthly_household_allocation_cad)} |`)),
  '',
  '## Distributed versus centralized servicing',
  '',
  'The following comparison uses the 12-household shared-services placeholders. It annualizes distributed capital with the same financing/reserve convention only to make the alternatives visible. It is not a procurement conclusion; well yield, septic feasibility, electrical connection distance, source-water rules, fire protection, maintenance labour and municipal approvals can change the result.',
  '',
  '| Function | Centralized monthly / household | Distributed capital total | Distributed monthly / household | Placeholder result | Source / status |',
  '|---|---:|---:|---:|---|---|',
  distributedMarkdown,
  '',
  '- **Water:** centralized treatment may benefit from scale, but household wells/rainwater/treatment can reduce shared capital where hydrogeology and approvals permit.',
  '- **Wastewater:** distributed septic/greywater/composting may be lower-capital, but soil, setbacks, seasonal water table and legal approval are decisive.',
  '- **Electricity:** a central distribution system is not automatically cheaper than shorter household connections or individual generation/storage; the current comparison is placeholder-only.',
  '- **Heating:** the canonical model remains building-based. No central heating credit is assigned without a local design, fuel system and operating evidence.',
  '- **Laundry:** common laundry can save household capital or labour, but it is not necessary for basic housing and should remain optional until utilization and maintenance are known.',
  '',
  '## Land reservation basis',
  '',
  'The default project reserves the maximum exclusive land requirement during the establishment transition. It does not sell or reallocate land merely because annual cultivation shrinks at maturity. The reserved property therefore retains establishment capacity, rotation/resilience area, future household flexibility and surplus/fibre/habitat potential. Mature hectares remain exposed separately for biological comparison.',
  '',
  '## Unresolved site-specific costs',
  '',
  '- municipal access and fire-route standards for gravel roads;',
  '- source-water, well yield, treatment and drinking-water approvals;',
  '- septic, greywater or composting-toilet approvals and soil constraints;',
  '- transformer/service distance, electrical code requirements and backup power;',
  '- snow-clearing contract, road maintenance standard and winter emergency access;',
  '- insurance quotes for a community land-holding entity and shared facilities;',
  '- property assessment/tax treatment and legal lease structure;',
  '- actual common-building, laundry and equipment utilization;',
  '- replacement schedules, reserve investment policy and project administration staffing;',
  '- current Grey County land price by site class and parcel condition.'
].join('\n') + '\n';

fs.writeFileSync(outputPath, markdown);
console.log(outputPath);
