import fs from 'node:fs';
import path from 'node:path';
import {
  ARC_AFFORDABILITY_SCENARIOS,
  calculateAdministrationBudget,
  calculateArcSiteLeaseEconomics,
  calculateArcCommonAreaGeometry,
  calculateCommonPropertyOperations,
  DEFAULT_SITE_LEASE_SCENARIO,
  INFRASTRUCTURE_SCENARIOS,
  SITE_LEASE_EVIDENCE
} from '../packages/carrying-capacity/src/index.mjs';

const outputDir = path.resolve('packages/carrying-capacity/outputs');
fs.mkdirSync(outputDir, {recursive: true});
const clone = (value) => structuredClone(value);
const money = (value) => `$${Number(value ?? 0).toFixed(2)}`;
const wholeMoney = (value) => `$${Number(value ?? 0).toFixed(0)}`;
const hours = (value) => `${Number(value ?? 0).toFixed(0)} h/year`;
const ha = (value) => `${Number(value ?? 0).toFixed(2)} ha`;
const pct = (value) => `${(Number(value ?? 0) * 100).toFixed(1)}%`;
const sizes = [12, 16, 25, 50];
const commonAreaPrototype = calculateArcCommonAreaGeometry(DEFAULT_SITE_LEASE_SCENARIO.community.common_area_accounting.geometry);

function makeScenario({members = ['reference_adult_man'], ownership = 'financed', householdCount = 12, siteId = 'ordinary_mesic'} = {}) {
  const base = clone(DEFAULT_SITE_LEASE_SCENARIO);
  return {
    ...base,
    arc_affordability_scenario_id: 'legal_minimum',
    site_id: siteId,
    household: {...base.household, members},
    community: {...base.community, household_count: householdCount},
    land: {...base.land, ownership, recovery_mode: ownership === 'financed' ? 'debt_service' : 'none'}
  };
}

function calculate(options = {}) {
  return calculateArcSiteLeaseEconomics({scenario: makeScenario(options)});
}

function householdRow(result) {
  const h = result.households[0];
  return {
    household_count: result.scenario.household_count,
    site_class: result.scenario.site_label,
    ownership: result.scenario.land_financing_scenario_id,
    land_ownership: result.project_land.financing.ownership,
    establishment_ha: h.reserved_productive_land_ha,
    mature_ha: h.mature_productive_land_requirement_ha,
    site_lease_monthly_cad: h.site_lease.monthly_total_cad,
    common_property_share_monthly_cad: h.site_lease.common_property_land_holding_share_monthly_cad,
    productive_land_rate_monthly_cad_per_ha: h.site_lease.productive_land_charge_per_hectare_monthly_cad,
    productive_land_portion_monthly_cad: h.site_lease.productive_land_portion_monthly_cad,
    land_debt_service_monthly_cad: h.site_lease.financing.debt_service_monthly_cad,
    property_tax_monthly_cad: Number(((h.site_lease.productive_land_annual_components_cad.productive_property_tax_annual_cad + h.site_lease.common_property_land_holding_annual_components_cad.common_property_tax_annual_cad) / 12).toFixed(2)),
    shared_infrastructure_monthly_cad: h.shared_infrastructure_service.monthly_cad,
    combined_monthly_cad: h.land_infrastructure.combined_monthly_cad,
    completed_dwelling_capital_cad: h.completed_dwelling.completed_dwelling_capital_cad,
    completed_dwelling_range_cad: h.completed_dwelling.source_record.legacy_completed_dwelling_range_cad,
    dwelling_financing_monthly_cad: h.affordability.illustrative_dwelling_financing_monthly_cad,
    dwelling_plus_land_shared_monthly_cad: h.affordability.illustrative_dwelling_financing_plus_land_shared_monthly_cad,
    resident_labour_hours_year: result.infrastructure.resident_labour_hours_year + result.project_land.administration.resident_labour_hours_year + result.project_land.common_property_operations.resident_labour_hours_year,
    infrastructure_future_replacement_liability_cad: result.infrastructure.future_replacement_liability_cad,
    land_layer_break_even: result.project.land_layer_break_even.revenue_equals_required_cost_recovery,
    infrastructure_layer_break_even: result.project.infrastructure_layer_break_even.revenue_equals_required_cost_recovery
  };
}

const ordinary = calculate();
const family = calculate({members: ['adult_woman', 'adult_man', 'child_girl_8', 'adolescent_boy_14', 'child_boy_8']});
const minimumWageHourlyCad = 17.60;
const fullTimeGrossMonthlyCad = minimumWageHourlyCad * 40 * 52 / 12;
const ownershipRows = ['financed', 'owned_out_right', 'land_trust'].map((ownership) => ({
  ownership,
  one_adult: householdRow(calculate({ownership})),
  family: householdRow(calculate({ownership, members: ['adult_woman', 'adult_man', 'child_girl_8', 'adolescent_boy_14', 'child_boy_8']}))
}));

const scaleRows = ['one_adult', 'family'].flatMap((householdType) => sizes.map((householdCount) => {
  const members = householdType === 'family' ? ['adult_woman', 'adult_man', 'child_girl_8', 'adolescent_boy_14', 'child_boy_8'] : ['reference_adult_man'];
  const result = calculate({members, householdCount});
  const h = result.households[0];
  return {
    household_type: householdType,
    households: householdCount,
    productive_area_ha: result.physical_inputs.productive_household_area_ha,
    common_area_ha: result.physical_inputs.common_area_ha,
    land_value_cad: result.project_land.total_land_value_cad,
    land_lease_monthly_cad: h.site_lease.monthly_total_cad,
    infrastructure_monthly_cad: h.shared_infrastructure_service.monthly_cad,
    combined_monthly_cad: h.land_infrastructure.combined_monthly_cad,
    resident_labour_hours_year: result.infrastructure.resident_labour_hours_year + result.project_land.administration.resident_labour_hours_year + result.project_land.common_property_operations.resident_labour_hours_year,
    future_replacement_liability_cad: result.infrastructure.future_replacement_liability_cad
  };
}));

const classification = [
  {expense: 'Productive land acquisition debt service', current_amount: 'derived; previously included', legal_requirement: 'only if land is financed', financing_requirement: 'yes, under selected loan', physical_necessity: 'land must be held', optional: 'no', treatment: 'retain only for financed land; zero for debt-free/trust land', basis: 'actual loan principal and contract'},
  {expense: 'Productive/common land property tax', current_amount: '1% of modeled land value', legal_requirement: 'yes, subject to assessment/classification', financing_requirement: 'no', physical_necessity: 'tax obligation', optional: 'no', treatment: 'retain as explicit tax-rate planning assumption pending parcel tax roll', basis: 'Ontario assessment/tax framework; site-specific'},
  {expense: 'Common property area and acquisition', current_amount: `${commonAreaPrototype.common_property_area_ha.toFixed(3)} ha conceptual 50 m prototype`, legal_requirement: 'site-plan dependent', financing_requirement: 'only if acquired/financed', physical_necessity: 'physical access/loop/amenity envelope only', optional: 'extra portions are optional', treatment: 'retain geometry-derived lane/loop/amenity area; validate and replace with parcel takeoff', basis: 'ARC common-area geometry prototype; site/fire/municipal validation required'},
  {expense: 'Land-holding administration', current_amount: '$18,000/year conventional / $125 per household/month at 12', legal_requirement: 'tasks exist; recurring paid manager not identified as mandatory', financing_requirement: 'no', physical_necessity: 'records/governance required', optional: 'paid service is optional', treatment: '$0 recurring cash; 60 resident hours/year and irregular external fees shown separately', basis: 'self-managed planning scenario'},
  {expense: 'Common-property operations', current_amount: '$6,000/year contracted baseline', legal_requirement: 'outcomes required; contractor is not', financing_requirement: 'no', physical_necessity: 'drainage/grounds/hazard work where applicable', optional: 'contractor/landscaping is optional', treatment: '$0 recurring cash; 64 resident hours/year in the separated common-property layer', basis: 'O. Reg. 517/06 and Owen Sound property standards; site-specific'},
  {expense: 'Land insurance', current_amount: '$3,000/year planning allowance', legal_requirement: 'no general statutory minimum identified', financing_requirement: 'possible lender/entity requirement', physical_necessity: 'risk exists, policy not established', optional: 'yes unless contract requires', treatment: '$0 in legal minimum; site-specific quote/lender requirement', basis: 'unresolved insurance evidence'},
  {expense: 'Vacancy reserve', current_amount: '5% of land pools', legal_requirement: 'no', financing_requirement: 'only if lender contract requires', physical_necessity: 'no for an occupied site', optional: 'prudence/policy', treatment: '$0 legal minimum', basis: 'policy choice'},
  {expense: 'Fixed land reserve', current_amount: 'scenario input', legal_requirement: 'no', financing_requirement: 'no', physical_necessity: 'future liability is real but reserve timing is policy', optional: 'yes', treatment: '$0 legal-min cash; future liability disclosed', basis: 'reserve policy'},
  {expense: 'Basic internal access capital', current_amount: '$120,000 placeholder', legal_requirement: 'passable access/fire access subject to approval', financing_requirement: 'debt service if financed', physical_necessity: 'yes if existing compliant access unavailable', optional: 'capital amount is site-specific', treatment: 'retain explicit access capital/debt placeholder; set to $0 when existing access is compliant', basis: 'O. Reg. 517/06 s. 32; municipal/fire design required'},
  {expense: 'Road maintenance and snow clearing', current_amount: '$10,000/year former paid baseline', legal_requirement: 'passability/clearance outcome required', financing_requirement: 'no', physical_necessity: 'yes', optional: 'paid contractor is optional', treatment: '$0 recurring cash; 120 resident hours/year in infrastructure layer', basis: 'O. Reg. 517/06 s. 32; resident method is a feasibility assumption'},
  {expense: 'Household water/plumbing/sanitation package', current_amount: '$5,940 ARC dwelling component', legal_requirement: 'potable/fire water and lawful sanitation required', financing_requirement: 'resident dwelling capital', physical_necessity: 'yes', optional: 'centralization optional', treatment: 'retained once in resident-owned dwelling capital; excluded from shared infrastructure', basis: 'O. Reg. 517/06 ss. 31, 35; Ontario rural servicing guidance; legacy ARC design package'},
  {expense: 'Household hot water', current_amount: '$2,000 ARC dwelling component', legal_requirement: 'safe plumbing/hot-water installation where provided', financing_requirement: 'resident dwelling capital', physical_necessity: 'yes for the selected dwelling design', optional: 'system design is optional', treatment: 'retained once in resident-owned dwelling capital; no separate shared fee', basis: 'legacy ARC design package; code review required'},
  {expense: 'Household electrical system', current_amount: '$3,300 ARC dwelling component', legal_requirement: 'safe electrical installation required', financing_requirement: 'resident dwelling capital', physical_necessity: 'yes', optional: 'centralization optional', treatment: 'retained once in resident-owned dwelling capital; excluded from shared infrastructure', basis: 'O. Reg. 517/06 s. 36; Building Code/ESA; legacy ARC design package'},
  {expense: 'Waste handling', current_amount: 'centralized scenario placeholder', legal_requirement: 'sanitary storage/handling', financing_requirement: 'no', physical_necessity: 'yes', optional: 'collection contract optional', treatment: '$0 recurring cash; 24 resident hours/year in infrastructure layer', basis: 'Owen Sound property standards and maintenance standards'},
  {expense: 'Infrastructure insurance', current_amount: '$8,000/year legacy infrastructure line', legal_requirement: 'no general statutory minimum identified', financing_requirement: 'possible lender/entity requirement', physical_necessity: 'risk exists, policy not established', optional: 'yes unless contract requires', treatment: '$0 in legal minimum; site-specific quote/lender requirement', basis: 'unresolved insurance evidence'},
  {expense: 'Infrastructure maintenance cash', current_amount: 'percentage of capital in prior scenarios', legal_requirement: 'maintenance outcome required', financing_requirement: 'no', physical_necessity: 'yes over asset life', optional: 'paid method optional', treatment: '$0 legal-min cash; resident labour and future liability separate', basis: 'cash method not mandated'},
  {expense: 'Infrastructure replacement reserve', current_amount: 'full/early reserve in prior scenarios', legal_requirement: 'future replacement may be necessary', financing_requirement: 'not the same as debt service', physical_necessity: 'future liability', optional: 'reserve timing is policy', treatment: '$0 legal-min cash; full capital replacement liability disclosed', basis: 'lifecycle planning, not current legal fee'},
  {expense: 'Common building, laundry, workshop and shared equipment', current_amount: 'optional scenario capital', legal_requirement: 'no', financing_requirement: 'only if selected', physical_necessity: 'no for minimum site', optional: 'yes', treatment: 'excluded; available in amenity/shared scenarios', basis: 'design choice'}
];

const resultSummary = [ordinary, family].map((result) => {
  const row = householdRow(result);
  return {...row, household_type: result.households[0].household_id === 'household-1-1' && result.households[0].physical_carrying_capacity.household_food_demand_gj_year < 10 ? 'one adult' : '2 adults + 3 dependent children family-capacity case'};
});
const ordinaryRow = resultSummary[0];
const familyRow = resultSummary[1];

const json = {
  contract_version: '1.5.0',
  generated_at: new Date().toISOString(),
  scenario_id: 'legal_minimum',
  scope: 'Minimum recurring cash for a legally and physically operable leased productive site. Completed resident-owned dwelling capital and illustrative dwelling financing are reported separately; household operating expenses remain excluded.',
  legal_sources: SITE_LEASE_EVIDENCE.legal_minimum,
  expense_classification: classification,
  household_examples: resultSummary,
  affordability_comparison: {
    status: 'provincial_proxy_only_no_local_household_bands_loaded',
    source: 'know/input/local-calibration/rent-income-series.csv',
    minimum_wage_hourly_cad: minimumWageHourlyCad,
    full_time_gross_monthly_cad: Number(fullTimeGrossMonthlyCad.toFixed(2)),
    one_adult_charge_share_of_proxy: Number((ordinaryRow?.combined_monthly_cad / fullTimeGrossMonthlyCad).toFixed(4)),
    family_charge_share_of_proxy: Number((familyRow?.combined_monthly_cad / fullTimeGrossMonthlyCad).toFixed(4)),
    limitation: 'No Owen Sound household income, rent distribution or existing ARC affordability bands were found in the repository; this is not a household affordability assessment.'
  },
  ownership_sensitivity: ownershipRows,
  community_scale: scaleRows,
  infrastructure: {
    scenario: INFRASTRUCTURE_SCENARIOS.legal_minimum,
    '12_household': ordinary.infrastructure,
    cash_monthly_per_household_cad: ordinary.households[0].shared_infrastructure_service.monthly_cad,
    resident_labour_hours_year: ordinary.infrastructure.resident_labour_hours_year,
    future_replacement_liability_cad: ordinary.infrastructure.future_replacement_liability_cad
  },
  administration: sizes.map((householdCount) => calculateAdministrationBudget({scenario_id: 'legal_minimum', household_count: householdCount})),
  common_property_operations: calculateCommonPropertyOperations({scenario_id: 'legal_minimum'}),
  affordability_scenarios: Object.values(ARC_AFFORDABILITY_SCENARIOS),
  unresolved: [
    'municipal/fire access design and whether an existing compliant road makes the access capital placeholder zero',
    'parcel-specific assessment, tax class and actual property tax bill',
    'approved potable-water, sewage and electrical servicing method and cost',
    'entity/lender insurance requirement and quote',
    'site-plan-derived common hectares, setbacks, buffers and servicing area',
    'legal confirmation that resident labour can satisfy each applicable maintenance duty',
    'irregular formation, filing and professional-review expenses'
  ]
};
fs.writeFileSync(path.join(outputDir, 'arc-legal-minimum.json'), JSON.stringify(json, null, 2) + '\n');

const componentMarkdown = classification.map((row) => `| ${row.expense} | ${row.current_amount} | ${row.legal_requirement} | ${row.financing_requirement} | ${row.physical_necessity} | ${row.optional} | ${row.treatment} |`).join('\n');
const ownershipMarkdown = ownershipRows.map((row) => `| ${row.ownership} | ${money(row.one_adult.site_lease_monthly_cad)} | ${money(row.one_adult.shared_infrastructure_monthly_cad)} | ${money(row.one_adult.combined_monthly_cad)} | ${money(row.family.site_lease_monthly_cad)} | ${money(row.family.shared_infrastructure_monthly_cad)} | ${money(row.family.combined_monthly_cad)} |`).join('\n');
const scaleMarkdown = scaleRows.map((row) => `| ${row.household_type} | ${row.households} | ${ha(row.productive_area_ha)} | ${money(row.land_lease_monthly_cad)} | ${money(row.infrastructure_monthly_cad)} | ${money(row.combined_monthly_cad)} | ${hours(row.resident_labour_hours_year)} | ${wholeMoney(row.future_replacement_liability_cad)} |`).join('\n');
const markdown = [
  '# ARC legal-minimum affordability audit',
  '',
  'Generated from the canonical `calculateArcSiteLeaseEconomics` API. This is a lower-bound cash scenario candidate, not legal advice or a claim that every site can be approved at these values. The land + infrastructure charge prices only the leased productive site and shared infrastructure. The completed resident-owned dwelling is shown as a separate capital/illustrative financing layer; household operating utilities, heating fuel, personal insurance and operating expenses remain outside scope.',
  '',
  '## Governing rule',
  '',
  'An expense remains in `legal_minimum` only when it is tied to an unavoidable land-finance contract, tax obligation, physical operating requirement or legally applicable maintenance/service outcome. The model chooses the least-cost method as a scenario assumption; it does not convert every prudent practice into a cash fee.',
  '',
  '## Legal and regulatory basis',
  '',
  'The Ontario Residential Tenancies Act treats land-lease-community sites as rental units/residential complexes, and O. Reg. 517/06 includes Part V standards for land-lease communities. Those standards address potable/fire water, passable roads, snow/obstruction control, sewage security and landlord-supplied electrical safety. Ontario rural tiny-home guidance recognizes on-site water and sewage approaches subject to local approval and the Building Code. Owen Sound property standards add local requirements for yards, garbage storage, safe access and servicing. Site-plan, fire, Building Code, septic, source-water and tax review remain unresolved for a specific property.',
  '',
  'Sources: [Ontario Residential Tenancies Act](https://www.ontario.ca/laws/statute/06r17), [O. Reg. 517/06 Maintenance Standards](https://www.ontario.ca/laws/regulation/060517), [Ontario rural tiny-home servicing guidance](https://www.ontario.ca/document/build-or-buy-tiny-home/rural-suburban-or-urban-locations), [Owen Sound Property Standards By-law](https://www.owensound.ca/media/j04h0kkz/1999-030-property-standards-by-law-consolidated.pdf), [Owen Sound Planning Act applications](https://www.owensound.ca/business-building-development/planning-and-development/planning-act-applications-and-how-to-apply/).',
  '',
  '## Classification of every current charge',
  '',
  '| Expense | Current/planning amount | Legal requirement? | Financing requirement? | Physical necessity? | Optional/prudence? | Legal-minimum treatment |',
  '|---|---|---|---|---|---|---|',
  componentMarkdown,
  '',
  '### Removed from recurring legal-minimum cash',
  '',
  '- paid administration and the former CAD 125/household/month planning allowance;',
  '- the former CAD 6,000/year contracted common-property operations allowance;',
  '- vacancy reserve;',
  '- the CAD 3,000/year land insurance planning allowance unless a lender/entity contract requires it;',
  '- infrastructure insurance unless required by a lender/entity contract;',
  '- paid road maintenance, commercial snow clearing, grounds contracts and waste contracts;',
  '- centralized water, sewage and electrical distribution where distributed approved systems are feasible;',
  '- infrastructure maintenance cash and replacement reserve; these remain future liability/sensitivity outputs;',
  '- common buildings, laundry, workshop and shared equipment.'
  , '',
  '## Retained cash and separate non-cash obligations',
  '',
  `For the default 12-household ordinary case, financed land debt service is ${money(ordinary.project_land.annual_costs_cad.land_finance_recovery / 12 / 12)}/household/month in the productive land charge, and the modeled property-tax proxy is ${money(ordinary.project_land.annual_costs_cad.property_tax / 12 / 12)}/household/month. The combined productive-land rate is ${money(ordinary.households[0].site_lease.productive_land_charge_per_hectare_monthly_cad)}/ha/month. The access-capital placeholder produces ${money(ordinary.households[0].shared_infrastructure_service.monthly_cad)}/household/month of legal-minimum shared cash; this falls to zero only if an existing compliant access arrangement is confirmed or the capital is otherwise funded. The resident-owned ARC dwelling central case is ${money(ordinaryRow.completed_dwelling_capital_cad)}, including the ${money(ordinary.households[0].completed_dwelling.utility_package_capital_cad)} household utility package once.`,
  '',
  `The legal-minimum scenario reports ${hours(ordinary.infrastructure.resident_labour_hours_year + ordinary.project_land.administration.resident_labour_hours_year + ordinary.project_land.common_property_operations.resident_labour_hours_year)} of resident/community labour per year: ${hours(ordinary.project_land.administration.resident_labour_hours_year)} administration, ${hours(ordinary.project_land.common_property_operations.resident_labour_hours_year)} common-property drainage/grounds, and ${hours(ordinary.infrastructure.resident_labour_hours_year)} infrastructure access/snow/waste. These are not converted into a monthly fee.`,
  '',
  `Future replacement liability is shown separately as ${wholeMoney(ordinary.infrastructure.future_replacement_liability_cad)} for the modeled access asset. Debt service repays current financing; it is not a replacement reserve. The legal-minimum monthly figure does not pretend the future asset can be replaced for free.`,
  '',
  '## Default ordinary-land household results',
  '',
  '| Household | Reserved establishment land | Mature land | Site lease/month | Shared infrastructure/month | Land + infrastructure/month | Dwelling capital | Dwelling finance/month | Dwelling finance + land/shared | Labour | Future replacement liability |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  `| One adult | ${ha(ordinaryRow.establishment_ha)} | ${ha(ordinaryRow.mature_ha)} | ${money(ordinaryRow.site_lease_monthly_cad)} | ${money(ordinaryRow.shared_infrastructure_monthly_cad)} | ${money(ordinaryRow.combined_monthly_cad)} | ${money(ordinaryRow.completed_dwelling_capital_cad)} | ${money(ordinaryRow.dwelling_financing_monthly_cad)} | ${money(ordinaryRow.dwelling_plus_land_shared_monthly_cad)} | ${hours(ordinaryRow.resident_labour_hours_year)} | ${wholeMoney(ordinaryRow.infrastructure_future_replacement_liability_cad)} |`,
  `| 2 adults + 3 dependent children family-capacity case | ${ha(familyRow.establishment_ha)} | ${ha(familyRow.mature_ha)} | ${money(familyRow.site_lease_monthly_cad)} | ${money(familyRow.shared_infrastructure_monthly_cad)} | ${money(familyRow.combined_monthly_cad)} | ${money(familyRow.completed_dwelling_capital_cad)} | ${money(familyRow.dwelling_financing_monthly_cad)} | ${money(familyRow.dwelling_plus_land_shared_monthly_cad)} | ${hours(familyRow.resident_labour_hours_year)} | ${wholeMoney(familyRow.infrastructure_future_replacement_liability_cad)} |`,
  '',
  `These are legal-minimum land/infrastructure cash figures under the current illustrative land-financing case and the conceptual ${commonAreaPrototype.common_property_area_ha.toFixed(3)} ha common-area prototype (${commonAreaPrototype.laneway.corridor_area_m2.toFixed(0)} m² laneway corridor + ${commonAreaPrototype.terminal_loop.circulation_lane_area_m2.toFixed(0)} m² terminal circulation + ${commonAreaPrototype.terminal_loop.amenity_envelope_area_m2.toFixed(0)} m² central common envelope). The ARC dwelling package places household water, sanitation/greywater, hot water and electrical systems in resident dwelling capital once. A real site may require a different approved system or a centralized project service; that alternative must replace, not stack on top of, the corresponding package component.`,
  '',
  '## Owen Sound affordability comparison',
  '',
  `The repository does not currently contain a Grey County/Owen Sound household income, rent distribution or approved affordability-band contract. The only loaded affordability-adjacent input is the Ontario general minimum wage of CAD ${minimumWageHourlyCad.toFixed(2)}/hour for 2025-10-01 to 2026-09-30. At 40 hours/week and 52 weeks/year, that is a gross proxy of ${money(fullTimeGrossMonthlyCad)}/month. The one-adult legal-minimum land-plus-infrastructure charge is ${money(ordinaryRow.combined_monthly_cad)} (${pct(ordinaryRow.combined_monthly_cad / fullTimeGrossMonthlyCad)} of that gross proxy); the family case is ${money(familyRow.combined_monthly_cad)} (${pct(familyRow.combined_monthly_cad / fullTimeGrossMonthlyCad)}). This comparison is a provincial wage proxy, not a local affordability band, and excludes the private dwelling and all household expenses.`,
  '',
  'A defensible local affordability comparison still requires Owen Sound/Grey household income distribution, household composition, rent/shelter-cost bands, tax treatment and the actual dwelling arrangement. The legal-minimum result should not be called affordable or unaffordable until those inputs are loaded.',
  '',
  '## Ownership sensitivity',
  '',
  '| Land ownership | Adult site lease | Adult infrastructure | Adult combined | Family site lease | Family infrastructure | Family combined |',
  '|---|---:|---:|---:|---:|---:|---:|',
  ownershipMarkdown,
  '',
  'Owned-outright and land-trust cases remove land acquisition debt service but retain the modeled property-tax obligation. The model does not charge a return on donated land equity.',
  '',
  '## Community scale',
  '',
  '| Household type | Households | Productive area | Site lease/household | Infrastructure/household | Combined/household | Resident labour | Future replacement |',
  '|---|---:|---:|---:|---:|---:|---:|---:|',
  scaleMarkdown,
  '',
  'The access capital is fixed in this scenario, so its cash allocation declines with household count. Productive hectares and productive land charges remain household-dependent. The common-area prototype also varies with entrance-laneway length; productive edge vegetation remains in adjoining household leases rather than being added to common property.',
  '',
  '## Optional scenarios',
  '',
  '| Scenario | Purpose | Legal-minimum status |',
  '|---|---|---|',
  '| legal_minimum | Lowest recurring cash candidate using resident/self-managed methods | canonical affordability baseline |',
  '| resilient_self_funded | Adds deliberate reserves, self-managed software support and optional insurance/operations | optional comparison |',
  '| professionally_managed | Adds paid administration and contracted/shared services | optional comparison |',
  '| amenity_rich | Adds optional common facilities and equipment | optional comparison |',
  '',
  '## Unresolved/site-specific requirements',
  '',
  ...json.unresolved.map((item) => `- ${item};`),
  '',
  'The next defensible refinement is a parcel-specific site-plan and servicing takeoff. It should replace the conceptual lane/loop geometry, access placeholder, tax proxy and distributed servicing placeholders with approved alignment, fire-access geometry, drainage, assessments, engineering and quotes.'
].join('\n') + '\n';

fs.writeFileSync(path.join(outputDir, 'arc-legal-minimum.md'), markdown);
console.log(path.join(outputDir, 'arc-legal-minimum.md'));
console.log(path.join(outputDir, 'arc-legal-minimum.json'));
