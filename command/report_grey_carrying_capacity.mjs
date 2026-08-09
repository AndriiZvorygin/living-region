// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import {buildCarryingCapacityReport} from '../packages/carrying-capacity/src/index.mjs';
import {calculateRegionalCarryingCapacity, calculateGreyCarryingCapacityAdoption} from '../packages/carrying-capacity/src/regional.mjs';

const produce = path.resolve('know/produce');
fs.mkdirSync(produce, {recursive: true});
const read = (name) => JSON.parse(fs.readFileSync(path.join(produce, name), 'utf8'));
const food = read('grey-food-calibration.json');
const dwelling = read('grey-dwelling-land-access.json');
const labour = read('grey-labour-land-baseline.json');
const energyContract = read(path.join('..', '..', 'data', 'systemic-energy', 'systemic-energy-v1.json'));
const canonical = buildCarryingCapacityReport();
const owen = labour.municipalityIndicators?.find((row) => row.municipalityName === 'Owen Sound');

const scenarios = [
  calculateRegionalCarryingCapacity({
    regionId: 'grey-county',
    regionLabel: 'Grey County',
    population: food.foodDemandBaseline.totalPopulation,
    dwellings: dwelling.totalDwellings,
    humanFoodPriorityHa: food.landBaseSummary.humanFoodPriorityHa,
    canonical
  }),
  calculateRegionalCarryingCapacity({
    regionId: 'owen-sound',
    regionLabel: 'Owen Sound',
    population: owen?.population2021 ?? 0,
    dwellings: dwelling.municipalityRows?.find((row) => row.municipalityName === 'Owen Sound')?.dwellings ?? 0,
    humanFoodPriorityHa: owen?.estimatedHumanFoodProducingHa ?? 0,
    canonical
  })
];

const output = {
  report_version: '1.0.0',
  generated_at: new Date().toISOString(),
  model: 'Living Region regional aggregation over @living-region/carrying-capacity canonical rows',
  source_inputs: {
    canonical_arc: 'packages/carrying-capacity/outputs/summary.json',
    grey_food_calibration: 'know/produce/grey-food-calibration.json',
    grey_dwelling_land_access: 'know/produce/grey-dwelling-land-access.json',
    grey_labour_land: 'know/produce/grey-labour-land-baseline.json',
    systemic_energy_contract: 'data/systemic-energy/systemic-energy-v1.json'
  },
  systemic_energy_context: {
    contract_id: energyContract.contract_id,
    schema_version: energyContract.schema_version,
    producer: energyContract.producer,
    field_statuses: Object.fromEntries(energyContract.fields.map((field) => [field.field_id, field.evidence_status]))
  },
  scenarios
};
fs.writeFileSync(path.join(produce, 'grey-carrying-capacity.json'), JSON.stringify(output, null, 2) + '\n');

const rows = scenarios.flatMap((scenario) => scenario.household_composition_sensitivity.map((row) => ({
  region_id: scenario.region_id,
  region_label: scenario.region_label,
  household_profile: row.household_profile,
  household_label: row.household_label,
  candidate_human_food_land_ha: scenario.candidate_human_food_land_ha,
  households_supported: row.households_supported,
  population_supported_people: row.population_supported,
  mature_recurring_labour_hours_year: row.mature_recurring_labour_hours_year,
  annual_bridge_area_ha: row.annual_bridge_area_ha,
  food_energy_supported_gj_year: row.food_energy_supported_gj_year,
  household_count_basis: scenario.household_count_basis
})));
const headers = Object.keys(rows[0]);
const csvEscape = (value) => {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
fs.writeFileSync(path.join(produce, 'grey-carrying-capacity.csv'), [headers.join(','), ...rows.map((row) => headers.map((key) => csvEscape(row[key])).join(','))].join('\n') + '\n');

const county = scenarios[0];
const adoption = calculateGreyCarryingCapacityAdoption({
  eligibleHouseholds: food.dwellingLandAccess?.estimatedDwellingsWithGardenScaleAccess ?? dwelling.estimatedDwellingsWithGardenScaleAccess ?? 0,
  eligiblePopulation: food.dwellingLandAccess?.estimatedPopulationWithGardenScaleAccess ?? dwelling.estimatedPopulationWithGardenScaleAccess ?? 0,
  regionalFoodDemandGJ: food.foodDemandBaseline.totalFoodDemandGJ,
  canonical,
  eligibilityBasis: 'estimatedDwellingsWithGardenScaleAccess from the current Grey dwelling-land proxy; not legal parcel ownership or biological capability classification'
});
output.adoption_scenarios = adoption;
const ordinary = county.household_composition_sensitivity.find((row) => row.household_profile === 'two_adults_plus_two_children');
const markdown = [
  '# Grey County carrying-capacity scenarios',
  '',
  'This report is a regional planning aggregation over the canonical ARC household/site model. It does not convert current land-access proxies into legal parcel access or predict adoption.',
  '',
  '## Interpretation',
  '',
  `- Grey County human-food-priority land proxy: **${county.candidate_human_food_land_ha.toFixed(1)} ha**.`,
  `- Site sensitivity is allocated as ${(county.site_allocation.shares.favourable * 100).toFixed(0)}% favourable, ${(county.site_allocation.shares.ordinary * 100).toFixed(0)}% ordinary, and ${(county.site_allocation.shares.marginal * 100).toFixed(0)}% marginal. This is a scenario assumption because no validated countywide biological capability layer is loaded.`,
  `- Under the central 2-adult + 2-child planning profile, the robust-minimum calculation supports about **${ordinary.population_supported.toFixed(0)} people** across the proxy land base, with ${ordinary.mature_recurring_labour_hours_year.toFixed(0)} mature recurring labour hours/year and an annual establishment bridge of ${ordinary.annual_bridge_area_ha.toFixed(1)} ha.`,
  '',
  '## Canonical adoption and transition',
  'The adoption rows below are generated by the same carrying-capacity API used by the regional machine-readable output. Adoption is a share of eligible households; it is not an instant mature food-forest assumption.',
  '| Adoption | Input condition | Mature households | Mature people | Productive land (ha) | Annual bridge (ha) | Mature perennial food (ha) | Heating biomass (ha) | Labour hours/year |',
  '|---:|---|---:|---:|---:|---:|---:|---:|---:|',
  ...adoption.scenarios.map((scenario) => { const row = scenario.transition_years.find((candidate) => candidate.year === 'mature'); return `| ${scenario.adoption_percent.toFixed(0)}% | ${scenario.external_input_condition} | ${row.participating_households.toFixed(0)} | ${row.participating_population_people.toFixed(0)} | ${row.productive_land_required_ha.toFixed(1)} | ${row.establishment_annual_food_area_ha.toFixed(1)} | ${row.mature_perennial_food_area_ha.toFixed(1)} | ${row.woody_heating_area_ha.toFixed(1)} | ${row.labour_hours_total.toFixed(0)} |`; }),
  '',
  '## Household composition',
  '',
  '| Region | Household | Households supported | People supported | Mature labour hours/year | Annual bridge area (ha) |',
  '|---|---|---:|---:|---:|---:|',
  ...rows.map((row) => `| ${row.region_label} | ${row.household_label} | ${row.households_supported.toFixed(1)} | ${row.population_supported_people.toFixed(0)} | ${row.mature_recurring_labour_hours_year.toFixed(0)} | ${row.annual_bridge_area_ha.toFixed(1)} |`),
  '',
  '## Data limits',
  '',
  ...county.limitations.map((note) => `- ${note}`),
  '',
  'The detailed machine-readable results are in `grey-carrying-capacity.json` and `grey-carrying-capacity.csv`.'
].join('\n');
fs.writeFileSync(path.join(produce, 'grey-carrying-capacity.md'), markdown + '\n');
console.log(`grey carrying-capacity JSON: ${path.join(produce, 'grey-carrying-capacity.json')}`);
console.log(`grey carrying-capacity CSV: ${path.join(produce, 'grey-carrying-capacity.csv')}`);
console.log(`grey carrying-capacity Markdown: ${path.join(produce, 'grey-carrying-capacity.md')}`);
