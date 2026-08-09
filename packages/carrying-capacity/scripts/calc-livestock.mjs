import {pathToFileURL} from 'node:url';
import {readCsv, number, round, writeCsv, writeJson, writeText, format} from './model-utils.mjs';

const assumptions = readCsv('data/source/livestock-assumptions.csv');
const byId = Object.fromEntries(assumptions.map(row => [row.id, row]));
export const moduleDefinitions = {
  plants_only: {ids: [], label: 'Plants only'},
  small_egg_flock: {ids: ['small_layer_flock'], label: 'Small egg flock'},
  rabbits: {ids: ['small_meat_rabbitry'], label: 'Rabbits'},
  combined_livestock: {ids: ['small_layer_flock', 'small_meat_rabbitry'], label: 'Combined livestock'},
  on_site_feed_constrained_livestock: {ids: ['small_layer_flock', 'small_meat_rabbitry'], label: 'On-site-feed-constrained livestock', feed_fraction_override: 1, feed_area_budget_ha: .10}
};
export const maturePerennialFoodShareTarget = .75;
const transitionLossReserve = .30;

function n(value, fallback = 0) { return number(value) ?? fallback; }
function sum(rows, key) { return rows.reduce((total, row) => total + n(row[key]), 0); }

function animalOutputs(ids, siteMultiplier, scale = 1, feedFractionOverride = null) {
  return ids.map(id => {
    const row = byId[id];
    const totalFeed = n(row.total_feed_dm_kg_year) * scale;
    const propertyFeed = totalFeed * (feedFractionOverride ?? n(row.on_property_feed_fraction));
    const perennialFeed = totalFeed * n(row.perennial_feed_fraction_of_total);
    return {
      id,
      animal: row.animal,
      unit_definition: row.unit_definition,
      food_output_kg_year: n(row.food_output_kg_year) * scale,
      food_energy_gj_year: n(row.food_energy_gj_year) * scale,
      food_protein_kg_year: n(row.food_protein_kg_year) * scale,
      food_fat_kg_year: n(row.food_fat_kg_year) * scale,
      feed_dry_matter_requirement_kg_year: totalFeed,
      feed_energy_requirement_gj_year: totalFeed * n(row.feed_energy_gj_per_kg_dm),
      feed_protein_requirement_kg_year: totalFeed * n(row.feed_protein_fraction),
      on_property_feed_dry_matter_kg_year: propertyFeed,
      purchased_feed_dry_matter_kg_year: totalFeed - propertyFeed,
      perennial_feed_dry_matter_kg_year: perennialFeed,
      on_property_feed_energy_gj_year: propertyFeed * n(row.feed_energy_gj_per_kg_dm),
      on_property_feed_protein_kg_year: propertyFeed * n(row.feed_protein_fraction),
      purchased_feed_energy_gj_year: (totalFeed - propertyFeed) * n(row.feed_energy_gj_per_kg_dm),
      winter_stored_feed_dry_matter_kg_year: totalFeed * n(row.winter_feed_fraction),
      on_property_feed_area_ha: propertyFeed / (n(row.feed_dm_yield_t_ha_year) * 1000 * siteMultiplier),
      equivalent_total_feed_area_ha: totalFeed / (n(row.feed_dm_yield_t_ha_year) * 1000 * siteMultiplier),
      manure_kg_year: n(row.manure_kg_year),
      labour_hours_year: n(row.labour_hours_year),
      physical_intensity_for_older_resident: row.physical_intensity_older_resident,
      feed_protein_fraction: n(row.feed_protein_fraction),
      source: row.source,
      notes: row.notes,
      scale,
      feed_fraction_override: feedFractionOverride
    };
  });
}

function macroTotals(row, plantEnergy, perennialEnergy, annualEnergy, animalRows) {
  const annualPerGJ = row.annual_crop_macro_delivered_per_gj;
  const perennialPerGJ = {
    protein: n(row.perennial_mature_mix_macro_output_per_ha.protein_kg_ha) / n(row.perennial_mature_mix_gross_yield_gj_ha_year),
    fat: n(row.perennial_mature_mix_macro_output_per_ha.fat_kg_ha) / n(row.perennial_mature_mix_gross_yield_gj_ha_year),
    carbohydrate: n(row.perennial_mature_mix_macro_output_per_ha.carbohydrate_kg_ha) / n(row.perennial_mature_mix_gross_yield_gj_ha_year)
  };
  const plant = {
    protein_kg_year: annualEnergy * n(annualPerGJ.protein) + perennialEnergy * n(perennialPerGJ.protein),
    fat_kg_year: annualEnergy * n(annualPerGJ.fat) + perennialEnergy * n(perennialPerGJ.fat),
    carbohydrate_kg_year: annualEnergy * n(annualPerGJ.carbohydrate) + perennialEnergy * n(perennialPerGJ.carbohydrate)
  };
  const animal = {
    protein_kg_year: sum(animalRows, 'food_protein_kg_year'),
    fat_kg_year: sum(animalRows, 'food_fat_kg_year'),
    carbohydrate_kg_year: 0
  };
  return {plant, animal, total: Object.fromEntries(Object.keys(plant).map(key => [key, round(plant[key] + animal[key], 6)]))};
}

export function calculateMatureScenario(row, module, siteMultiplier, perennialShare = maturePerennialFoodShareTarget) {
  const moduleDefinition = moduleDefinitions[module];
  if (!moduleDefinition) throw new Error(`Unknown livestock module: ${module}`);
  const unitFeedArea = moduleDefinition.ids.reduce((total, id) => total + n(byId[id].total_feed_dm_kg_year) / (n(byId[id].feed_dm_yield_t_ha_year) * 1000 * siteMultiplier), 0);
  const scale = moduleDefinition.feed_area_budget_ha ? Math.min(1, moduleDefinition.feed_area_budget_ha / unitFeedArea) : 1;
  const animalRows = animalOutputs(moduleDefinition.ids, siteMultiplier, scale, moduleDefinition.feed_fraction_override ?? null);
  const animalEnergy = sum(animalRows, 'food_energy_gj_year');
  const householdDemand = row.household_food_demand_gj_year;
  const plantDemand = Math.max(0, householdDemand - animalEnergy);
  const perennialNetYield = row.perennial_mature_mix_gross_yield_gj_ha_year * (1 - transitionLossReserve);
  const annualNetYield = row.annual_crop_gross_yield_gj_ha_year * (1 - transitionLossReserve);
  const perennialEnergy = plantDemand * perennialShare;
  const annualEnergy = plantDemand - perennialEnergy;
  const perennialArea = perennialEnergy / perennialNetYield;
  const annualArea = annualEnergy / annualNetYield;
  const feed = {
    dry_matter_requirement_kg_year: sum(animalRows, 'feed_dry_matter_requirement_kg_year'),
    energy_requirement_gj_year: sum(animalRows, 'feed_energy_requirement_gj_year'),
    protein_requirement_kg_year: sum(animalRows, 'feed_protein_requirement_kg_year'),
    on_property_dry_matter_kg_year: sum(animalRows, 'on_property_feed_dry_matter_kg_year'),
    purchased_dry_matter_kg_year: sum(animalRows, 'purchased_feed_dry_matter_kg_year'),
    on_property_energy_gj_year: sum(animalRows, 'on_property_feed_energy_gj_year'),
    purchased_energy_gj_year: sum(animalRows, 'purchased_feed_energy_gj_year'),
    on_property_protein_kg_year: sum(animalRows, 'on_property_feed_protein_kg_year'),
    winter_stored_dry_matter_kg_year: sum(animalRows, 'winter_stored_feed_dry_matter_kg_year'),
    on_property_feed_area_ha: sum(animalRows, 'on_property_feed_area_ha'),
    equivalent_total_feed_area_ha: sum(animalRows, 'equivalent_total_feed_area_ha')
  };
  const macros = macroTotals(row, plantDemand, perennialEnergy, annualEnergy, animalRows);
  const proteinTarget = n(row.perennial_macro_screen_at_full_calorie_area.protein_screen_target_g_day) * 365.25 / 1000;
  const fatTarget = householdDemand * .20 / .037656;
  const plantArea = perennialArea + annualArea;
  const totalLand = plantArea + feed.on_property_feed_area_ha + row.shared_heating_area_ha;
  const matureTransition = row.transition.progressive_handoff.rows.at(-1);
  const perennialHoursPerHa = matureTransition.perennial_area_ha > 0 ? matureTransition.labour.perennial_recurring_labour_hours / matureTransition.perennial_area_ha : 0;
  const annualHoursPerHa = matureTransition.annual_area_ha > 0 ? matureTransition.labour.total_recurring_labour_hours / matureTransition.annual_area_ha : 150;
  const plantRecurringHours = perennialArea * perennialHoursPerHa + annualArea * annualHoursPerHa;
  const livestockHours = sum(animalRows, 'labour_hours_year');
  const lowReplantingEnergy = perennialEnergy + animalRows.reduce((total, animal) => total + animal.food_energy_gj_year * (Math.min(animal.perennial_feed_dry_matter_kg_year, animal.on_property_feed_dry_matter_kg_year) / Math.max(1, animal.feed_dry_matter_requirement_kg_year)), 0);
  return {
    module,
    module_label: moduleDefinition.label,
    household: row.household,
    household_label: row.household_label,
    site: row.site,
    site_label: row.site_label,
    household_food_demand_gj_year: round(householdDemand, 6),
    human_food_energy: {plant_gj_year: round(plantDemand, 6), perennial_plant_gj_year: round(perennialEnergy, 6), annual_plant_gj_year: round(annualEnergy, 6), livestock_gj_year: round(animalEnergy, 6), total_gj_year: round(plantDemand + animalEnergy, 6), source_percent: {perennial_plants: round(perennialEnergy / householdDemand * 100, 3), annual_plants: round(annualEnergy / householdDemand * 100, 3), livestock: round(animalEnergy / householdDemand * 100, 3)}},
    nutritional_output: {...macros, protein_target_kg_year: round(proteinTarget, 6), protein_coverage_percent: round(macros.total.protein_kg_year / proteinTarget * 100, 3), fat_screen_target_kg_year: round(fatTarget, 6), fat_coverage_percent: round(macros.total.fat_kg_year / fatTarget * 100, 3), adequacy_note: 'Protein and fat are screening quantities. This does not prove micronutrients, amino-acid balance, essential fatty acids, vitamin B12, calcium, iodine, food safety or seasonal adequacy.'},
    land: {annual_crop_area_ha: round(annualArea, 6), perennial_food_area_ha: round(perennialArea, 6), human_food_area_ha: round(plantArea, 6), livestock_feed_area_ha: round(feed.on_property_feed_area_ha, 6), woody_heating_area_ha: row.shared_heating_area_ha, total_food_feed_heat_area_ha: round(totalLand, 6), arc_food_envelope_ha: row.food_production_envelope_at_arc_allocation_ha, surplus_or_deficit_vs_arc_food_envelope_ha: round(row.food_production_envelope_at_arc_allocation_ha - plantArea - feed.on_property_feed_area_ha, 6), land_accounting_note: 'Feed area is additional productive area in this module; it is not silently overlapped with human-food rows. Woody area is shared dwelling heating area.'},
    feed,
    animals: animalRows,
    labour: {plant_recurring_labour_hours: round(plantRecurringHours, 2), livestock_recurring_labour_hours: round(livestockHours, 2), total_recurring_labour_hours: round(plantRecurringHours + livestockHours, 2), annual_soil_preparation_area_ha: round(annualArea, 6), annual_soil_preparation_hours: round(annualArea * 45, 2), physical_intensity_for_older_resident: annualArea > .1 || livestockHours > 150 ? 'moderate-high' : 'moderate', recurring_labour_note: 'Plant hours use the transition labour classifications and animal hours are explicit module planning assumptions. Establishment labour is excluded from this mature comparison.'},
    ageing_in_place: {perennial_food_energy_percent: round(perennialEnergy / householdDemand * 100, 3), food_energy_without_annual_soil_preparation_percent: round(lowReplantingEnergy / householdDemand * 100, 3), annual_replanting_reduction_relative_to_full_annual_bridge_percent: round((1 - annualArea / (householdDemand / annualNetYield)) * 100, 3)},
    mature_perennial_food_share: perennialShare,
    module_definition: moduleDefinition,
    evidence_boundary: 'Livestock modules are optional illustrative household units, not ARC requirements. Feed conversion, output, feed-area yield and labour are modelled planning assumptions bounded by the cited extension guidance.'
  };
}

function markdown(output) {
  const ordinary = output.scenarios.filter(row => row.site === 'ordinary_mesic');
  const byHousehold = household => ordinary.filter(row => row.household === household);
  const first = ordinary.find(row => row.module !== 'plants_only') ?? ordinary[0];
  return `# Optional small-livestock and mature low-recurring-labour scenarios

The modules compare a mature 75% perennial-plant calorie target with a 25% annual-plant supplement. Chickens and rabbits are optional protein/food modules; their feed, winter storage, purchased-feed dependence, labour and manure are shown explicitly. They are not free protein and are not required for ARC compliance.

The default livestock unit is six laying hens and/or a conservative 48-fryer rabbitry. The unit is deliberately not scaled linearly by adult-equivalent. Feed rations must remain nutritionally balanced: Ontario poultry guidance emphasizes energy, protein, amino acids and minerals; extension rabbit guidance likewise relies on complete feed and adequate fibre/protein.

## Ordinary-site mature household scenarios

| household | module | perennial plant calories | annual plant calories | livestock calories | protein coverage | annual area | perennial area | feed area | recurring labour |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
${ordinary.map(row => `| ${row.household_label} | ${row.module_label} | ${format(row.human_food_energy.source_percent.perennial_plants, 0)}% | ${format(row.human_food_energy.source_percent.annual_plants, 0)}% | ${format(row.human_food_energy.source_percent.livestock, 0)}% | ${format(row.nutritional_output.protein_coverage_percent, 0)}% | ${format(row.land.annual_crop_area_ha, 2)} ha | ${format(row.land.perennial_food_area_ha, 2)} ha | ${format(row.land.livestock_feed_area_ha, 2)} ha | ${format(row.labour.total_recurring_labour_hours, 0)} h/y |`).join('\n')}

## Feed and nutrient accounting

The first ordinary-site row (${first?.household_label ?? 'n/a'}; ${first?.module_label ?? 'n/a'}) is a checkable example: ${format(first?.feed?.dry_matter_requirement_kg_year, 0)} kg dry feed/year is required by the optional unit, of which ${format(first?.feed?.on_property_dry_matter_kg_year, 0)} kg is supplied from the property under the planning fraction and ${format(first?.feed?.purchased_dry_matter_kg_year, 0)} kg is purchased or imported. The full household/site/module table is in outputs/livestock-scenarios.json.

The livestock outputs add only ${format(first?.human_food_energy.livestock_gj_year, 2)} GJ/year in this small unit. Their primary benefit is protein/fat diversity and manure recycling, not replacing the household calorie field. Chicken rations cannot be replaced by kitchen scraps or pasture alone; rabbit forage also does not remove the need for balanced feed, clean water, winter storage and disease control.

Sources: [UMN laying hens](https://extension.umn.edu/small-scale-poultry/raising-chickens-eggs), [Penn State layer nutrition](https://extension.psu.edu/management-requirements-for-laying-flocks), [Ontario poultry nutrition](https://www.ontario.ca/page/introduction-poultry-nutrition), [Ontario Starting a Farm rabbit section](https://files.ontario.ca/omafra-starting-farm-in-ontario-pub-61-en-2023-04-21.pdf), [USU rabbit nutrition guide](https://extension.usu.edu/washington/files/Understanding_the_Basics_of_Rabbit_Care.pdf), [Ontario rabbit disease guidance](https://www.ontario.ca/document/animal-health-updates-and-veterinary-advisories/animal-health-update-rabbit-hemorrhagic-disease-virus-2-2022-06-10).
`;
}

export function buildLivestockScenarios(transitionOutput) {
  const scenarios = transitionOutput.households.flatMap(row => Object.keys(moduleDefinitions).map(module => calculateMatureScenario(row, module, transitionOutput.site_classes[row.site].food_multiplier)));
  const output = {
    model: 'optional livestock and mature low-recurring-labour food modules',
    status: 'current evidence-based planning module; optional and not a canonical ARC requirement',
    mature_perennial_food_share_target: maturePerennialFoodShareTarget,
    transition_loss_reserve_fraction: transitionLossReserve,
    assumptions,
    modules: moduleDefinitions,
    scenarios,
    limitations: ['Animal output and feed conversion are planning assumptions rather than Grey-Bruce household trials.', 'Feed area is represented as additional land and not overlapped with human food area.', 'Protein coverage is a screening calculation and does not establish complete dietary adequacy.', 'Manure is listed as a nutrient-recycling output but nutrient balances and pathogen handling are not yet modelled.']
  };
  writeJson('outputs/livestock-scenarios.json', output);
  writeText('outputs/livestock-scenarios.md', markdown(output));
  writeCsv('data/derived/livestock-scenarios.csv', [
    ['site','household','module','household_food_gj_year','perennial_food_percent','annual_food_percent','livestock_food_percent','protein_coverage_percent','annual_crop_area_ha','perennial_food_area_ha','livestock_feed_area_ha','woody_heating_area_ha','total_food_feed_heat_area_ha','recurring_labour_hours_year','food_energy_without_annual_soil_preparation_percent'],
    ...scenarios.map(row => [row.site,row.household,row.module,row.household_food_demand_gj_year,row.human_food_energy.source_percent.perennial_plants,row.human_food_energy.source_percent.annual_plants,row.human_food_energy.source_percent.livestock,row.nutritional_output.protein_coverage_percent,row.land.annual_crop_area_ha,row.land.perennial_food_area_ha,row.land.livestock_feed_area_ha,row.land.woody_heating_area_ha,row.land.total_food_feed_heat_area_ha,row.labour.total_recurring_labour_hours,row.ageing_in_place.food_energy_without_annual_soil_preparation_percent])
  ]);
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) throw new Error('Pass a transition output to buildLivestockScenarios from the build pipeline.');
