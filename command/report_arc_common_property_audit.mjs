import fs from 'node:fs';
import path from 'node:path';
import {
  ADMINISTRATION_SCENARIOS,
  ARC_SITE_LEASE_CONTRACT_VERSION,
  calculateAdministrationBudget,
  calculateArcSiteLeaseEconomics,
  calculateArcCommonAreaGeometry,
  calculateCommonPropertyOperations,
  DEFAULT_SITE_LEASE_SCENARIO,
  SITE_LEASE_EVIDENCE
} from '../packages/carrying-capacity/src/index.mjs';

const outputDir = path.resolve('packages/carrying-capacity/outputs');
fs.mkdirSync(outputDir, {recursive: true});
const clone = (value) => structuredClone(value);
const money = (value) => `$${Number(value ?? 0).toFixed(2)}`;
const wholeMoney = (value) => `$${Number(value ?? 0).toFixed(0)}`;
const sizes = [12, 16, 25, 50];
const defaultCommonArea = calculateArcCommonAreaGeometry(DEFAULT_SITE_LEASE_SCENARIO.community.common_area_accounting.geometry);
const commonAreaSensitivity = [30, 50, 75, 100].map((lanewayLengthM) => calculateArcCommonAreaGeometry({...DEFAULT_SITE_LEASE_SCENARIO.community.common_area_accounting.geometry, laneway_length_m: lanewayLengthM}));

const makeScenario = (householdCount, members = ['reference_adult_man']) => ({
  ...clone(DEFAULT_SITE_LEASE_SCENARIO),
  household: {...clone(DEFAULT_SITE_LEASE_SCENARIO.household), members},
  community: {...clone(DEFAULT_SITE_LEASE_SCENARIO.community), household_count: householdCount}
});

const adminRows = Object.values(ADMINISTRATION_SCENARIOS).flatMap((scenario) => sizes.map((householdCount) => {
  const budget = calculateAdministrationBudget({scenario_id: scenario.id, household_count: householdCount});
  return {
    scenario_id: scenario.id,
    scenario: scenario.label,
    household_count: householdCount,
    fixed_project_annual_cad: budget.fixed_project_annual_cad,
    variable_household_annual_cad: budget.variable_household_annual_cad,
    event_driven_allowance_annual_cad: budget.event_driven_allowance_annual_cad,
    total_annual_cad: budget.annual_total_cad,
    monthly_per_household_cad: budget.monthly_per_household_cad,
    evidence_status: budget.evidence_status,
    automation_level: budget.automation_level
  };
}));

const operationBudget = calculateCommonPropertyOperations({scenario_id: 'contracted_baseline'});
const legalMinimumOperations = calculateCommonPropertyOperations({scenario_id: 'legal_minimum'});
const scaleRows = sizes.map((householdCount) => {
  const result = calculateArcSiteLeaseEconomics({scenario: makeScenario(householdCount)});
  const household = result.households[0];
  const administration = result.project_land.administration;
  const operations = result.project_land.common_property_operations;
  return {
    household_count: householdCount,
    common_area_ha: result.scenario.common_area_ha,
    common_area_mode: result.scenario.common_area_accounting.mode,
    property_area_ha: result.project_land.total_property_area_ha,
    administration_annual_cad: administration.annual_total_cad,
    administration_monthly_per_household_cad: administration.monthly_per_household_cad,
    common_operations_annual_cad: operations.annual_total_cad,
    common_operations_monthly_per_household_cad: operations.annual_total_cad / householdCount / 12,
    common_property_share_monthly_cad: household.site_lease.common_property_land_holding_share_monthly_cad,
    productive_land_charge_monthly_cad: household.site_lease.productive_land_portion_monthly_cad,
    site_lease_monthly_cad: household.site_lease.monthly_total_cad,
    shared_infrastructure_monthly_cad: household.shared_infrastructure_service.monthly_cad,
    combined_land_infrastructure_monthly_cad: household.land_infrastructure.combined_monthly_cad
  };
});

const ordinary = calculateArcSiteLeaseEconomics({scenario: makeScenario(12)}).households[0];
const family = calculateArcSiteLeaseEconomics({scenario: {...makeScenario(12, ['adult_woman', 'adult_man', 'child_girl_8', 'adolescent_boy_14']), household: {...makeScenario(12).household, members: ['adult_woman', 'adult_man', 'child_girl_8', 'adolescent_boy_14']}}}).households[0];
const lineItems = operationBudget.components;
const json = {
  contract_version: ARC_SITE_LEASE_CONTRACT_VERSION,
  generated_at: new Date().toISOString(),
  scope: 'Common-property administration, common-property operations and land-layer evidence audit; private dwelling excluded.',
  administration_scale: adminRows,
  common_property_operations: {legal_minimum: legalMinimumOperations, contracted_baseline: operationBudget},
  common_property_area: {
    total_common_area_ha: defaultCommonArea.common_property_area_ha,
    mode: 'geometry_derived',
    geometry: defaultCommonArea,
    sensitivity: commonAreaSensitivity,
    component_definitions: DEFAULT_SITE_LEASE_SCENARIO.community.common_area_accounting.components,
    spatial_pipeline_status: 'conceptual_geometry_prototype_connected_to_ARC_economics'
  },
  tax: SITE_LEASE_EVIDENCE.property_tax,
  insurance: SITE_LEASE_EVIDENCE.land_insurance,
  vacancy: {
    rate_annual: DEFAULT_SITE_LEASE_SCENARIO.land.vacancy_reserve_rate_annual,
    treatment: 'separate common-property and productive-land pre-reserve pools; applied once to each pool',
    surplus_policy: 'retained for vacancies and future land-layer costs'
  },
  affordability_examples: {
    one_adult_ordinary: {site_lease_monthly_cad: ordinary.site_lease.monthly_total_cad, shared_infrastructure_monthly_cad: ordinary.shared_infrastructure_service.monthly_cad, combined_land_infrastructure_monthly_cad: ordinary.land_infrastructure.combined_monthly_cad},
    family_ordinary: {site_lease_monthly_cad: family.site_lease.monthly_total_cad, shared_infrastructure_monthly_cad: family.shared_infrastructure_service.monthly_cad, combined_land_infrastructure_monthly_cad: family.land_infrastructure.combined_monthly_cad}
  }
};
fs.writeFileSync(path.join(outputDir, 'arc-common-property-audit.json'), JSON.stringify(json, null, 2) + '\n');

const adminTable = sizes.map((householdCount) => {
  const rows = adminRows.filter((row) => row.household_count === householdCount);
  return `| ${householdCount} | ${rows.map((row) => `${row.scenario}: ${money(row.monthly_per_household_cad)}`).join('<br>')} |`;
}).join('\n');
const componentTable = lineItems.map((row) => `| ${row.label} | ${wholeMoney(row.annual_cad)} | planning assumption | Common-property cash operations; not shared infrastructure |`).join('\n');
const markdown = [
  '# ARC common-property administration and operations audit',
  '',
  'This report audits the common-property land-holding operating inputs. The public headline remains site lease plus shared infrastructure; these details remain expandable and are not dwelling or household expenses.',
  '',
  '## Administration: origin of the former $125/month',
  '',
  'The former charge was exactly **$18,000/year ÷ 12 households ÷ 12 months = $125/household/month**. It had no documented staffing plan or service-capacity basis. The canonical model now treats that amount as the 12-household result of the conventional administration scenario:',
  '',
  '| Activity | Cost type | Annual cost at 12 households | Intended work |',
  '|---|---|---:|---|',
  '| Lease, accounting and bookkeeping | fixed project | $3,600 | lease billing, accounting close, reserve ledger |',
  '| Tax and payment administration | fixed project | $1,800 | tax/payment calendar, reconciliation, annual filings |',
  '| Compliance and site records | fixed project | $2,400 | resident records, site-plan/checklist records, document control |',
  '| Maintenance coordination and inspections | fixed project | $1,800 | work orders, inspection scheduling, contractor coordination |',
  '| Resident billing and records | variable per household | $5,760 | account changes, statements, routine correspondence |',
  '| Legal/accounting professional allowance | event-driven allowance | $2,640 | occasional review and compliance questions |',
  '| **Total** |  | **$18,000** |  |',
  '',
  'The fixed work is not multiplied by household count. Resident records/billing scale with households, while professional work is retained as an allowance rather than assumed to be zero.',
  '',
  '## Administration scale sensitivity',
  '',
  '| Households | Administration scenarios: monthly per household |',
  '|---:|---|',
  adminTable,
  '',
  'The software-assisted scenario assumes open-source tools can automate billing/accounting workflows, reserve ledgers, maintenance schedules, resident/site records, site-plan checks, carrying-capacity calculations, productive-land plans, inspection checklists and document generation. It retains human exception handling and professional legal/accounting work. The lean sensitivity adds resident time and lowers cash cost; it is not zero administration.',
  '',
  '## Common-property operations: origin of the former $41.67/month',
  '',
  'The former amount was **$6,000/year ÷ 12 households ÷ 12 months = $41.67/household/month**. It is now decomposed as:',
  '',
  '| Component | Annual cost | Status | Boundary |',
  '|---|---:|---|---|',
  componentTable,
  '',
  'Snow clearing, road maintenance, waste handling and infrastructure insurance remain in the shared-infrastructure layer. They are explicitly excluded from this common-property operations pool.',
  '',
  '## Common-property area',
  '',
  `The default common-property prototype is **${defaultCommonArea.common_property_area_ha.toFixed(3)} ha** at a configurable 50 m entrance laneway: ${defaultCommonArea.laneway.corridor_area_m2.toFixed(0)} m² of physical laneway corridor, ${defaultCommonArea.terminal_loop.circulation_lane_area_m2.toFixed(0)} m² of terminal circulation, and a ${defaultCommonArea.terminal_loop.amenity_envelope_area_m2.toFixed(0)} m² central common envelope. This is conceptual geometry, not a parcel-clipped engineering or fire-access approval. Productive vegetation outside required clearances remains in adjoining household allocations and is not added to common hectares.`,
  '',
  'Desired pipeline:',
  '',
  '`parcel → buildings/residential footprints → roads/access → servicing → productive layout → ecological buffers → explicit common hectares → land holding cost`',
  '',
  'The prototype is now connected to ARC economics, but a real project must replace it with parcel-specific alignment, drainage, setback, servicing and fire-access geometry.',
  '',
  '### Laneway-length sensitivity',
  '',
  '| Entrance laneway | Laneway corridor | Terminal loop | Amenity envelope | Total common area |',
  '|---:|---:|---:|---:|---:|',
  ...commonAreaSensitivity.map((row) => `| ${row.inputs.laneway_length_m} m | ${row.laneway.corridor_area_m2.toFixed(0)} m² | ${row.terminal_loop.circulation_lane_area_m2.toFixed(0)} m² | ${row.terminal_loop.amenity_envelope_area_m2.toFixed(0)} m² | ${row.common_property_area_ha.toFixed(3)} ha |`),
  '',
  '## Scale: common-property and revised household charges',
  '',
  '| Households | Common area mode | Administration/year | Administration/month/household | Common operations/month/household | Common-property share/month | Site lease/month | Land + infrastructure/month |',
  '|---:|---|---:|---:|---:|---:|---:|---:|',
  ...scaleRows.map((row) => `| ${row.household_count} | ${row.common_area_mode} | ${wholeMoney(row.administration_annual_cad)} | ${money(row.administration_monthly_per_household_cad)} | ${money(row.common_operations_monthly_per_household_cad)} | ${money(row.common_property_share_monthly_cad)} | ${money(row.site_lease_monthly_cad)} | ${money(row.combined_land_infrastructure_monthly_cad)} |`),
  '',
  'The legal-minimum headline uses zero recurring cash for paid administration and common-property operations; resident labour is shown separately. The conventional scenario remains available for comparison and reproduces the former $18,000 administration and $6,000 operations inputs. It is not the legal-minimum baseline.',
  '',
  '## Tax, insurance and vacancy status',
  '',
  '- **Property tax:** the model currently applies an explicit 1% of land value. MPAC guidance shows that farm land, residences, buildings and non-farm/common uses can be classified differently, and Ontario farm-class eligibility can materially change the applicable rate. The 1% value is therefore a planning assumption, not an assessed Grey County tax result.',
  '- **Land insurance:** the CAD 3,000/year allowance has no quote. Ontario farm-insurance guidance confirms that property and liability premiums depend on buildings, equipment, activities, visitors, location, limits and risk. This remains unresolved/site-specific.',
  `- **Vacancy reserve:** the ${Number(DEFAULT_SITE_LEASE_SCENARIO.land.vacancy_reserve_rate_annual * 100).toFixed(1)}% rate is applied separately to common-property and productive-land pre-reserve pools. This is intentional because the pools have different allocation bases; neither reserve is applied twice. The reserve is retained by the land-holding entity for vacancy and future land-layer costs.`,
  '',
  '## Evidence-status classification',
  '',
  '| Input | Status |',
  '|---|---|',
  '| Carrying-capacity hectares | derived from Living Region canonical model |',
  '| Common area | derived from conceptual lane/loop/amenity geometry; site validation required |',
  '| Administration scenarios | policy/design choice with explicit planning costs |',
  '| Common-property operations | working planning assumption pending maintenance plan/bids |',
  '| Property tax | planning assumption informed by MPAC/Ontario classification framework |',
  '| Land insurance | unresolved/site-specific pending broker/entity quote |',
  '| Vacancy rate and surplus policy | policy/design choice |',
  '',
  'Sources: [MPAC farm property assessments](https://www.mpac.ca/en/PropertyTypes/FarmPropertyAssessments), [Ontario tax rates](https://www.ontario.ca/laws/regulation/090224), [OFA insurance guidance](https://ofa.on.ca/resources/insurance-coverage-for-ontario-farmers-a-summary-prepared-by-ofa/).'
].join('\n') + '\n';
fs.writeFileSync(path.join(outputDir, 'arc-common-property-audit.md'), markdown);
console.log(path.join(outputDir, 'arc-common-property-audit.md'));
console.log(path.join(outputDir, 'arc-common-property-audit.json'));
