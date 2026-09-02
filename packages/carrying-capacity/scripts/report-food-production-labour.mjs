import fs from 'node:fs';
import path from 'node:path';
import {calculateInteractiveHousehold} from '../src/index.mjs';

const root = path.resolve('packages/carrying-capacity');
const contractPath = path.resolve('packages/education-web/public/generated/carrying-capacity/presentation.json');
if (!fs.existsSync(contractPath)) throw new Error('Build the carrying-capacity presentation contract before generating the labour report.');

const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
const member = {...contract.reference_profile, id: 'reference_adult_man', labour_level: 'moderate'};
const siteId = 'ordinary_mesic';
const result = calculateInteractiveHousehold({
  members: [member],
  buildings: [contract.heating.default_building],
  siteId,
  foodEvidence: contract.food_energy_evidence,
  woodyCases: contract.woody_yields.cases,
  establishmentModel: contract.establishment.site_models[siteId],
  livestockMode: 'plants_only',
  livestockRation: 'arc_integrated'
});

const selectedYears = [0, 1, 2, 3, 5, 10, 'mature'];
const stages = result.food_production_labour.stages.filter((stage) => selectedYears.includes(stage.year)).map((stage) => ({
  year: stage.year,
  household_food_demand_gj_year: stage.household_food_demand_gj_year,
  people_fed: stage.people_fed,
  annual_area_ha: stage.annual_area_ha,
  perennial_area_ha: stage.perennial_area_ha,
  annual_food_percent: stage.food.annual_food_percent,
  perennial_food_percent: stage.food.perennial_food_percent,
  food: stage.food,
  establishment_hours_year: stage.establishment_hours_year,
  recurring_hours_year: stage.recurring_hours_year,
  total_hours_year: stage.total_hours_year,
  average_hours_week: stage.average_hours_week,
  seasonal_peak_hours_week: stage.seasonal_peak_hours_week,
  peak_month: stage.peak_month,
  categories: stage.categories,
  establishment_categories: stage.establishment_categories,
  external_input_ledger: stage.external_input_ledger,
  closed_loop_labour_gaps: stage.closed_loop_labour_gaps,
  nutrition: stage.nutrition,
  top_labour_contributors: stage.top_labour_contributors,
  food_production_by_crop: stage.food_production_by_crop,
  audit_rows: stage.audit_rows,
  task_hours_reconciliation: stage.task_hours_reconciliation,
  data_quality: stage.data_quality
}))
;

const report = {
  contract_version: result.food_production_labour.contract_version,
  scenario: {person: 'reference_adult_man', site: siteId, livestock: 'plants_only', ration: 'arc_integrated', projection_mode: result.food_production_labour.projection_mode},
  fixed_demand: {food_gj_year: member.gj_year, people_fed: 1, note: 'The same reference adult and food demand are used at every production stage.'},
  scope: result.food_production_labour.scope,
  mechanization_assumption: result.food_production_labour.mechanization_assumption,
  closed_loop_assessment: result.food_production_labour.closed_loop_assessment,
  stages,
  historical_reconciliation: result.food_production_labour.historical_reconciliation,
  reference_reconciliation: result.food_production_labour.reference_reconciliation,
  missing_data: result.food_production_labour.missing_data
};

const f = (value, digits = 2) => value == null || !Number.isFinite(Number(value)) ? '—' : Number(value).toFixed(digits);
const label = (year) => year === 0 ? 'Year 0' : year === 'mature' ? 'Mature' : `Year ${year}`;
const categoryLabels = {annual_crops: 'Annual cultivation', perennial_food_forest: 'Perennial maintenance', livestock: 'Livestock', harvesting: 'Harvest', food_preservation_storage: 'Preservation/storage', fertility_nutrient_cycling: 'Fertility/nutrient cycling', seed_propagation: 'Seed/propagation', water_management: 'Water management', system_maintenance: 'Other system maintenance'};
const mergedCategories = (stage) => Object.fromEntries(Object.keys(categoryLabels).map((id) => [id, Number(stage.establishment_categories?.[id] ?? 0) + Number(stage.categories?.[id] ?? 0)]));
const stageTable = stages.map((stage) => `| ${label(stage.year)} | ${f(stage.annual_area_ha, 3)} | ${f(stage.perennial_area_ha, 3)} | ${f(stage.annual_food_percent, 1)}% | ${f(stage.perennial_food_percent, 1)}% | ${f(stage.establishment_hours_year, 1)} | ${f(stage.recurring_hours_year, 1)} | ${f(stage.total_hours_year, 1)} | ${f(stage.average_hours_week, 2)} | ${f(stage.seasonal_peak_hours_week, 2)} | ${stage.nutrition?.status ?? '—'} |`).join('\n');
const categoryTable = stages.map((stage) => [`### ${label(stage.year)}`, '', ...Object.entries(mergedCategories(stage)).map(([id, value]) => `- ${categoryLabels[id] ?? id}: ${f(value, 1)} h/year`), '', `Unresolved closed-loop labour: ${(stage.closed_loop_labour_gaps ?? []).map((item) => `${item.id} (${item.category})`).join(', ') || 'none listed'}`].join('\n')).join('\n\n');
const topTable = stages.map((stage) => [`### ${label(stage.year)}`, '', ...(stage.top_labour_contributors ?? []).map((item, index) => `${index + 1}. ${item.crop_or_species} — ${item.task}: ${f(item.hours_year, 1)} h/year`), ...(stage.top_labour_contributors?.length ? [] : ['No quantified task rows.'])].join('\n')).join('\n\n');
const flowTable = stages.map((stage) => [`### ${label(stage.year)}`, '', `- Establishment external: ${(stage.external_input_ledger.establishment_external_inputs ?? []).map((item) => `${item.id} (${item.status})`).join(', ') || 'none listed'}`, `- Recurring external/imported: ${(stage.external_input_ledger.recurring_external_inputs ?? []).map((item) => `${item.id} (${item.status})`).join(', ') || 'none quantified'}`, `- Planned internal/shared: ${(stage.external_input_ledger.internally_regenerated_inputs ?? []).map((item) => `${item.id} (${item.status})`).join(', ') || 'none quantified'}`, `- Unresolved: ${(stage.external_input_ledger.unresolved_inputs ?? []).map((item) => item.id).join(', ') || 'none listed'}`, `- Nutrient flow status: ${stage.external_input_ledger.nutrient_ledger.status}`].join('\n')).join('\n\n');
const markdown = [
  '# Reference-adult food-production labour audit',
  '',
  'Generated from the canonical interactive carrying-capacity calculation. This is a fixed-demand comparison for one reference adult man on an ordinary/mesic site, plants-only, ARC-integrated ration. It is not a family or lifecycle projection.',
  '',
  '## Boundary',
  '',
  `- Food demand is held at **${f(report.fixed_demand.food_gj_year, 6)} GJ/year** and one person is fed at every stage.`,
  '- Year 0 is **food-crop and perennial establishment labour only**. Fencing, water-system installation, access, earthworks and other site infrastructure are unresolved, not zero.',
  '- The reference case uses a low-input household-scale manual system. Machine operator time remains labour; recurring fuel/electricity dependence is unresolved.',
  '- Additive task coefficients are canonical. The source mature_recurring_hours_per_ha field is retained as a separate comparison and never used to normalize task rows.',
  '- Closed-loop status is **unresolved** because internal fertility cycling, propagation, water source, equipment energy and mineral replacement do not yet have complete quantified flows and labour coefficients.',
  '',
  '## Stage summary',
  '',
  '| Stage | Annual area ha | Perennial area ha | Annual food | Perennial food | Establishment h/y | Recurring h/y | Total h/y | Avg h/week | Peak h/week | Nutrition |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|',
  stageTable,
  '',
  '## Labour categories',
  '',
  categoryTable,
  '',
  '## Five largest quantified contributors',
  '',
  topTable,
  '',
  '## External-input and internal-flow ledger',
  '',
  flowTable,
  '',
  '## Mature closed-loop assessment',
  '',
  `- Status: **${report.closed_loop_assessment.status}**`,
  `- Quantified recurring external inputs: ${stages.at(-1).external_input_ledger.recurring_external_inputs.length ? stages.at(-1).external_input_ledger.recurring_external_inputs.map((item) => item.id).join(', ') : 'none quantified'}`,
  `- Planned internal/shared flows still requiring quantified closure: ${stages.at(-1).external_input_ledger.internally_regenerated_inputs.map((item) => item.id).join(', ') || 'none listed'}`,
  `- Unresolved material, energy, water or labour dependencies: ${stages.at(-1).external_input_ledger.unresolved_inputs.map((item) => item.id).join(', ') || 'none listed'}`,
  `- Reason: ${report.closed_loop_assessment.reason}`,
  '',
  '## Reconciliation',
  '',
  `Every reported total is the sum of visible establishment and recurring task rows. The pre-2.0 time-aware result was **${f(report.historical_reconciliation.previous_time_aware_reference_adult_mature_hours_year, 3)} h/year**, while the earlier mature-food-system report was **${f(report.historical_reconciliation.previous_mature_food_system_reference_adult_hours_year, 0)} h/year**. Those figures used different boundaries and/or normalization; this report is the current task-level pathway and exposes the difference rather than blending it.`,
  '',
  'The task ledger remains a planning estimate, not a Grey-Bruce time-and-motion study.',
  ''
].join('\n');

fs.writeFileSync(path.join(root, 'outputs/food-production-labour-reference-adult.json'), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(root, 'outputs/food-production-labour-reference-adult.md'), markdown);
console.log(markdown);
