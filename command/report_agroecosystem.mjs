import fs from 'node:fs';
import path from 'node:path';
import {buildPlantDatabase} from '../packages/carrying-capacity/src/plant-database.mjs';
import {calculateAgroecosystemPlan} from '../packages/carrying-capacity/src/agroecosystem.mjs';
import {FOOD_NUTRIENT_PROFILES} from '../packages/carrying-capacity/src/nutrition.mjs';
import {calculateHealthCanadaEER, representativeProfiles} from '../packages/carrying-capacity/src/health-canada.mjs';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const packageRoot = path.join(root, 'packages/carrying-capacity');
const source = JSON.parse(fs.readFileSync(path.join(packageRoot, 'data/source/agroecosystem-plants.json'), 'utf8'));
const database = buildPlantDatabase(source);
const members = ['adult_woman', 'adult_man', 'child_girl_8', 'adolescent_boy_14', 'child_boy_8'].map((id) => ({id, ...representativeProfiles[id]}));
const demand = members.reduce((sum, member) => sum + calculateHealthCanadaEER(member).gj_year, 0);
const plans = Object.fromEntries(['wetter_productive', 'ordinary_mesic', 'dry', 'shallow_rocky_marginal'].map((siteId) => [siteId, calculateAgroecosystemPlan({database, siteId, objectives: ['low_external_input', 'nutritional_completeness', 'resilient_diverse'], supportPlantRatio: .25, annualAreaHa: 1, perennialAreaHa: 1, nutritionProfiles: FOOD_NUTRIENT_PROFILES, householdPeople: members.length, householdFoodDemandGJYear: demand, annualResilienceFloorGJYear: demand * .1, humanure: {enabled: false}})]));
const compact = (plan) => ({site: plan.site, objectives: plan.objectives, support_plant_ratio: plan.support_plant_ratio, selected: plan.selection.selected, candidates: plan.selection.candidates, annual_schedule: plan.annual_schedule, whole_diet: plan.whole_diet, perennial_succession: plan.perennial_succession, nutrient_ledger: plan.nutrient_ledger, reconciliation: plan.reconciliation});
const outputDir = path.join(packageRoot, 'outputs');
fs.mkdirSync(outputDir, {recursive: true});
fs.writeFileSync(path.join(outputDir, 'agroecosystem-plan.json'), `${JSON.stringify({contract_version: '1.0.0', generated_at: new Date().toISOString(), household: 'two_adults_plus_three_children', site_context: 'Owen Sound / Grey County regional scenario', household_food_demand_gj_year: demand, database_version: database.database_version, plans: Object.fromEntries(Object.entries(plans).map(([id, plan]) => [id, compact(plan)]))}, null, 2)}\n`);
const reference = plans.ordinary_mesic;
const lines = [
  '# Agroecosystem planner report', '',
  `Generated for the two-adult plus three-dependent-child capacity household. Household food demand: ${demand.toFixed(3)} GJ/year.`, '',
  '## Database and selection', '',
  `- Plant database: ${database.database_version}; records: ${database.records.length}.`,
  '- Site: Owen Sound / Grey County ordinary/mesic scenario.',
  '- Objective set: low external input, nutritional completeness, resilience/diversity.',
  '- Support-plant sensitivity: 25% shared nominal area; 15% and 33% remain available.',
  `- Selected records: ${reference.selection.selected.map((row) => row.common_name).join(', ')}.`, '',
  '## Ordinary/mesic succession', '',
  '| Year | Annual bridge ha | Perennial harvest kg | Food energy GJ | Carbohydrate | Protein | Fat | Main sources |',
  '| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
  ...reference.whole_diet.years.filter((row) => [1, 2, 3, 5, 8, 10, 15, 30, 'mature'].includes(row.year)).map((row) => `| ${row.year} | ${row.annual_cultivation_area_ha.toFixed(3)} | ${row.perennial_food_energy_gj_year.toFixed(2)} | ${row.consumed_food_energy_gj_year.toFixed(2)} | ${row.macro.energy_percent.carbohydrate.toFixed(1)}% | ${row.macro.energy_percent.protein.toFixed(1)}% | ${row.macro.energy_percent.fat.toFixed(1)}% | ${row.principal_food_sources.slice(0, 4).map((source) => source.plant_id).join(', ')} |`), '',
  '## Nutrient and material boundary', '',
  `- N/P/K ledger balanced arithmetically: ${reference.nutrient_ledger.all_years_balanced}.`,
  '- Internal residue, support, manure and humanure flows are transfers, not newly created fertility.',
  '- Humanure is disabled in this reference report; enabling it credits only treated, recovered, crop-available nutrients.',
  '- Any nutrient deficit is disclosed in the balance row and is not filled by an invisible amendment.', '',
  '## Evidence boundary', '',
  '- Walnut yield remains unresolved and is not credited to canonical production.',
  '- Support nitrogen fixation is a bounded synthesis/proxy; fixed nitrogen and crop-available transfer are separate.',
  '- Site capability is regional scenario evidence, not parcel-level soil mapping.'
];
fs.writeFileSync(path.join(outputDir, 'agroecosystem-plan.md'), `${lines.join('\n')}\n`);
console.log(`Wrote ${path.join(outputDir, 'agroecosystem-plan.json')}`);
console.log(`Wrote ${path.join(outputDir, 'agroecosystem-plan.md')}`);
