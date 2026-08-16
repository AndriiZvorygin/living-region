import fs from 'node:fs';
import path from 'node:path';
import {calculateInteractiveHousehold, calculateHealthCanadaEER} from '../packages/carrying-capacity/src/index.mjs';

const root = path.resolve('packages/carrying-capacity');
const contract = JSON.parse(fs.readFileSync(path.join('packages/education-web/public/generated/carrying-capacity/presentation.json'), 'utf8'));
const outputDir = path.join(root, 'outputs');
const modes = [
  ['plants_only', 'Plants only'],
  ['rabbit_meat', 'Rabbit meat'],
  ['chicken_eggs', 'Chicken / eggs'],
  ['chicken_meat', 'Chicken meat'],
  ['goose_meat', 'Goose meat'],
  ['goat_meat', 'Goat meat'],
  ['mixed_rabbit_eggs', 'Rabbit + eggs']
];

function familyMembers() {
  const preset = contract.household_presets.find((row) => row.id === 'two_adults_plus_three_children');
  return preset.members.map((member, index) => ({...calculateHealthCanadaEER({...member, id: `family-${index}`}), labour_level: index < 2 ? 'moderate' : 'dependent'}));
}

const members = familyMembers();
const siteId = 'ordinary_mesic';
const model = contract.establishment.site_models[siteId];
const rows = modes.map(([mode, label]) => {
  const result = calculateInteractiveHousehold({
    members,
    buildings: [contract.heating.default_building],
    siteId,
    foodEvidence: contract.food_energy_evidence,
    woodyCases: contract.woody_yields.cases,
    establishmentModel: model,
    livestockMode: mode,
    livestockRation: 'arc_integrated'
  });
  const transition = result.establishment_land?.strategy_comparison?.progressive_handoff;
  return {
    mode,
    label,
    household_food_demand_gj_year: result.household_food_gj_year,
    protein_demand_kg_year: result.protein_demand.household_protein_kg_year,
    plant_protein_kg_year: result.nutrient_food_system.plant_protein_kg_year,
    animal_protein_kg_year: result.nutrient_food_system.animal_protein_kg_year,
    total_protein_kg_year: result.nutrient_food_system.total_protein_kg_year,
    protein_adequacy: result.nutrient_food_system.protein_adequacy,
    plant_food_area_ha: result.nutrient_food_system.plant_food.required_food_area_ha,
    animal_food_energy_gj_year: result.nutrient_food_system.animal_food_energy_gj_year,
    human_edible_feed_protein_kg_year: result.nutrient_food_system.feed.human_edible_feed_protein_consumed_kg,
    human_inedible_feed_dm_kg_year: result.nutrient_food_system.feed.human_inedible_feed_dm_kg,
    winter_stored_feed_dm_kg_year: result.nutrient_food_system.feed.winter_stored_feed_required_kg,
    storage_loss_dm_kg_year: result.nutrient_food_system.feed.storage_loss_kg,
    purchased_feed_dm_kg_year: result.nutrient_food_system.feed.purchased_feed_required_kg,
    additional_dedicated_feed_land_ha: result.nutrient_food_system.feed.additional_dedicated_feed_land_ha,
    livestock_labour_hours_year: result.nutrient_food_system.labour.livestock_hours_year,
    establishment_productive_land_ha: transition?.establishment_land_requirement_ha ?? null,
    mature_productive_land_ha: transition?.mature_land_requirement_ha ?? null,
    establishment_peak_year: transition?.establishment_peak_year ?? null,
    caveat: result.nutrient_food_system.evidence_boundary
  };
});

const best = rows.filter((row) => row.protein_adequacy).reduce((winner, row) => !winner || (row.plant_food_area_ha + row.additional_dedicated_feed_land_ha) < (winner.plant_food_area_ha + winner.additional_dedicated_feed_land_ha) ? row : winner, null);
const payload = {
  report_version: '1.0.0',
  generated_at: new Date().toISOString(),
  household: 'two_adults_plus_three_children',
  site: siteId,
  ration: 'arc_integrated',
  baseline_note: 'Plants-only is the current canonical baseline. Animal options are bounded planning syntheses and are not forced into the result.',
  protein_source: contract.protein.source,
  livestock_sources: Object.fromEntries(Object.entries(contract.livestock.species).map(([id, row]) => [id, row.sources])),
  rows,
  best_protein_adequate_option: best ? {mode: best.mode, label: best.label, rule: 'lowest modeled plant food area plus dedicated feed land among protein-adequate rows'} : null
};

fs.mkdirSync(outputDir, {recursive: true});
fs.writeFileSync(path.join(outputDir, 'livestock-nutrient-comparison.json'), `${JSON.stringify(payload, null, 2)}\n`);

const fmt = (value, digits = 2) => value == null ? '—' : Number(value).toFixed(digits);
const markdown = `# Nutrient-aware livestock comparison\n\nGenerated ${payload.generated_at}. This report uses the canonical Health Canada protein layer and the ARC-integrated feed ledger for the **two-adult + three-dependent-child** family-capacity case on the **ordinary / mesic** site.\n\n## What the prior model constrained\n\nThe pre-existing carrying-capacity calculation sized the food system primarily from household food energy. It reported crop protein and a screening macro check, but did not apply an official age/sex/body-mass protein DRI, protein-quality constraint, human-edible feed conversion, winter feed balance or species-specific edible outputs.\n\n## Results\n\n| Option | Protein demand kg/year | Plant protein | Animal protein | Protein adequate | Plant food ha | Human-edible feed protein kg/year | Human-inedible feed DM kg/year | Winter stored feed DM kg/year | Purchased feed DM kg/year | Livestock labour h/year | Establishment ha | Mature ha | Peak |\n| --- | ---: | ---: | ---: | :---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |\n${rows.map((row) => `| ${row.label} | ${fmt(row.protein_demand_kg_year, 1)} | ${fmt(row.plant_protein_kg_year, 1)} | ${fmt(row.animal_protein_kg_year, 1)} | ${row.protein_adequacy ? 'yes' : 'no'} | ${fmt(row.plant_food_area_ha, 3)} | ${fmt(row.human_edible_feed_protein_kg_year, 1)} | ${fmt(row.human_inedible_feed_dm_kg_year, 0)} | ${fmt(row.winter_stored_feed_dm_kg_year, 0)} | ${fmt(row.purchased_feed_dm_kg_year, 0)} | ${fmt(row.livestock_labour_hours_year, 0)} | ${fmt(row.establishment_productive_land_ha, 3)} | ${fmt(row.mature_productive_land_ha, 3)} | Year ${row.establishment_peak_year ?? '—'} |`).join('\n')}\n\nThe current crop mix supplies ${fmt(rows[0].plant_protein_kg_year, 1)} kg protein/year against ${fmt(rows[0].protein_demand_kg_year, 1)} kg/year of modeled RDA demand. That means plants-only remains the canonical baseline in this first pass. This is total-protein adequacy only; indispensable amino acids, digestibility, micronutrients and food safety remain separate evidence work.\n\n${best ? `The lowest modeled protein-adequate row is **${best.label}** under the current arithmetic, but this is not a recommendation to add livestock: the options include purchased feed and bounded planning synthesis, while plants-only already meets the modeled total-protein target without animal housing or processing labour.` : 'No modeled option met the total-protein target.'}\n\n## Feed and land boundary\n\nExisting residues, garden culls, food-forest understorey, leaf fodder and browse are treated as bounded co-products or overlays within the food area. They do not receive a second hectare. Dedicated feed land is ${fmt(rows[0].additional_dedicated_feed_land_ha, 3)} ha in the current integrated scenario; a property biomass inventory is required before operational use.\n\nSources: [Health Canada protein DRI tables](${contract.protein.source}), [Ontario poultry nutrition](https://www.ontario.ca/page/introduction-poultry-nutrition), [Ontario pasture production](https://files.ontario.ca/omafra-pasture-production-en-2022-12-08.pdf), [Ontario rabbit/farm guidance](https://files.ontario.ca/omafra-starting-farm-in-ontario-pub-61-en-2023-04-21.pdf), [Manitoba goat nutrition](https://www.gov.mb.ca/agriculture/livestock/goat/pubs/goats-and-their-nutrition.pdf), and [Penn State goose/poultry guidance](https://extension.psu.edu/geese-ducks-and-swans).\n\nEvidence status: species outputs, feed shares and property co-product yields are bounded planning syntheses, not Grey-Bruce household trials.\n`;
fs.writeFileSync(path.join(outputDir, 'livestock-nutrient-comparison.md'), markdown);
console.log(`wrote ${path.join(outputDir, 'livestock-nutrient-comparison.md')}`);
