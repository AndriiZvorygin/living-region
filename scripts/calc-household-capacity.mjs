import {pathToFileURL} from 'node:url';
import {round, writeCsv, writeJson} from './model-utils.mjs';
import {buildHealthCanadaEnergy} from './calc-health-canada-energy.mjs';
import {calculateFoodEvidence} from './calc-evidence-food.mjs';
import {buildEvidenceHeating} from './calc-evidence-heating.mjs';
import {calculateWoodyLand} from './calc-evidence-woody.mjs';

export const siteClasses = {
  wetter_productive: {label: 'Wetter productive site', food_multiplier: 1.00, woody_band: 'favourable', notes: 'Moisture-tolerant woody systems can be considered, but exceptional saturated-site trials are excluded.'},
  ordinary_mesic: {label: 'Ordinary mesic site', food_multiplier: 1.00, woody_band: 'ordinary', notes: 'Central planning class for reasonably designed mixed perennial and annual production.'},
  dry: {label: 'Dry site', food_multiplier: .75, woody_band: 'marginal', notes: 'Water limitation is represented as a transparent scenario multiplier, not a measured Grey County average.'},
  shallow_rocky_marginal: {label: 'Shallow/rocky marginal site', food_multiplier: .50, woody_band: 'marginal', notes: 'Lower productivity scenario; a site survey is required before using it for a parcel.'}
};

const householdProfiles = {
  one_adult: ['adult_woman'],
  two_adults: ['adult_woman', 'adult_man'],
  adult_plus_child: ['adult_woman', 'child_girl_8'],
  adult_plus_two_children: ['adult_woman', 'child_girl_8', 'adolescent_boy_14'],
  two_adults_plus_two_children: ['adult_woman', 'adult_man', 'child_girl_8', 'adolescent_boy_14']
};

export const foodLossAssumptions = {storage_loss: .10, wildlife_loss: .10, seed_propagation_loss: .03, weather_crop_reserve: .20, emergency_community_reserve: .10};

export function calculateFoodSystem(foodEvidence, demandGJ, siteMultiplier = 1, proteinReferenceWeightKg = 70) {
  // This calorie-share mix is a screening diet, not a dietary prescription. The explicit oilseed share keeps the macro screen from becoming a starch-only calorie model.
  const wanted = {potato_low_input_synthesis: .25, wheat_low_input_synthesis: .20, dry_beans_low_input_synthesis: .20, sunflower_low_input_synthesis: .25, oats_low_input_synthesis: .10};
  const rows = Object.entries(wanted).map(([id, energyShare]) => {
    const row = foodEvidence.rows.find(item => item.id === id);
    if (!row || !row.food_gj_ha) throw new Error(`Missing canonical food-system row: ${id}`);
    const foodGJHa = row.food_gj_ha * siteMultiplier;
    return {id, crop: row.crop, category: row.category, energy_share: energyShare, food_gj_ha: foodGJHa, area_ha: demandGJ * energyShare / foodGJHa, protein_kg_ha: row.protein_kg_ha * siteMultiplier, fat_kg_ha: row.fat_kg_ha * siteMultiplier, carbohydrate_kg_ha: row.carbohydrate_kg_ha * siteMultiplier};
  });
  const rawArea = rows.reduce((sum, row) => sum + row.area_ha, 0);
  const grossEnergyPerHa = demandGJ / rawArea;
  const postHarvestFactor = (1 - foodLossAssumptions.storage_loss) * (1 - foodLossAssumptions.wildlife_loss) * (1 - foodLossAssumptions.seed_propagation_loss);
  const reserveFactor = 1 - foodLossAssumptions.weather_crop_reserve - foodLossAssumptions.emergency_community_reserve;
  const householdDeliveryFactor = postHarvestFactor * reserveFactor;
  const requiredArea = demandGJ / (grossEnergyPerHa * householdDeliveryFactor);
  const systemGJ = grossEnergyPerHa * requiredArea;
  const macro = rows.reduce((totals, row) => {
    const area = requiredArea * row.area_ha / rawArea;
    totals.protein_kg += area * row.protein_kg_ha;
    totals.fat_kg += area * row.fat_kg_ha;
    totals.carbohydrate_kg += area * row.carbohydrate_kg_ha;
    return totals;
  }, {protein_kg: 0, fat_kg: 0, carbohydrate_kg: 0});
  const deliveredMacro = Object.fromEntries(Object.entries(macro).map(([k,v]) => [k, v * householdDeliveryFactor]));
  const macroEnergyGJ = {protein: deliveredMacro.protein_kg * .016736, fat: deliveredMacro.fat_kg * .037656, carbohydrate: deliveredMacro.carbohydrate_kg * .016736};
  const macroEnergyTotal = Object.values(macroEnergyGJ).reduce((sum, value) => sum + value, 0);
  const macroShares = Object.fromEntries(Object.entries(macroEnergyGJ).map(([k,v]) => [k, round(v / macroEnergyTotal * 100, 3)]));
  return {diet_energy_shares: wanted, rows, gross_energy_per_ha: round(grossEnergyPerHa, 6), raw_calorie_area_ha: round(rawArea, 6), delivery_factor_after_losses_and_reserves: round(householdDeliveryFactor, 6), required_food_area_ha: round(requiredArea, 6), gross_food_energy_at_required_area_gj: round(systemGJ, 6), delivered_food_energy_gj: round(systemGJ * householdDeliveryFactor, 6), macro_output_at_required_area: Object.fromEntries(Object.entries(macro).map(([k,v]) => [k, round(v, 6)])), macro_delivered_to_household: Object.fromEntries(Object.entries(deliveredMacro).map(([k,v]) => [k, round(v, 6)])), macro_energy_shares_percent: macroShares, protein_g_day: round(deliveredMacro.protein_kg * 1000 / 365.25, 3), protein_reference_target_g_day: round(proteinReferenceWeightKg * .8, 3), protein_threshold_met: deliveredMacro.protein_kg * 1000 / 365.25 >= proteinReferenceWeightKg * .8, macro_range_check: {protein_10_to_35_percent: macroShares.protein >= 10 && macroShares.protein <= 35, fat_20_to_35_percent: macroShares.fat >= 20 && macroShares.fat <= 35, carbohydrate_45_to_65_percent: macroShares.carbohydrate >= 45 && macroShares.carbohydrate <= 65, status: 'screening check only; does not establish micronutrient sufficiency'}, assumptions: {...foodLossAssumptions, protein_reference_g_per_kg: .8, macro_energy_factors: '4 kcal/g protein and carbohydrate; 9 kcal/g fat converted to GJ'} };
}

export function buildHouseholdCapacity(energy = buildHealthCanadaEnergy(), food = calculateFoodEvidence(), heating = buildEvidenceHeating(), woody = calculateWoodyLand(heating)) {
  const adultEquivalent = energy.canonical_adult_equivalent.gj_year;
  const rows = [];
  for (const [siteId, site] of Object.entries(siteClasses)) {
    const heatingBand = site.woody_band;
    const heatArea = woody.cases.central[heatingBand].required_woody_area_ha;
    for (const [householdId, members] of Object.entries(householdProfiles)) {
      const membersResult = members.map(id => energy.scenarios[id]);
      const demand = membersResult.reduce((sum, member) => sum + member.gj_year, 0);
      const referenceWeight = membersResult.reduce((sum, member) => sum + member.weight_kg, 0);
      const foodSystem = calculateFoodSystem(food, demand, site.food_multiplier, referenceWeight);
      const mathArea = foodSystem.required_food_area_ha + heatArea;
      const resilience = {diversity_and_rotation_ha: round(Math.max(.12, foodSystem.required_food_area_ha * .25), 6), soil_water_perennial_buffer_ha: .15, fibre_habitat_wildlife_buffer_ha: .10, deliberate_export_production_ha: .20};
      const resilienceArea = Object.values(resilience).reduce((sum, value) => sum + value, 0);
      const robustArea = mathArea + resilienceArea;
      const foodSurplusAtOneHa = Math.max(0, 1 - heatArea) * foodSystem.gross_energy_per_ha * foodSystem.delivery_factor_after_losses_and_reserves - demand;
      rows.push({site: siteId, household: householdId, member_ids: members, member_count: members.length, household_energy_gj_year: round(demand, 6), adult_equivalents: round(demand / adultEquivalent, 6), food_area_ha: foodSystem.required_food_area_ha, heating_area_ha: round(heatArea, 6), mathematical_minimum_area_ha: round(mathArea, 6), resilience_allowances_ha: resilience, resilience_allowance_total_ha: round(resilienceArea, 6), robust_system_area_ha: round(robustArea, 6), food_surplus_at_one_total_ha_gj: round(foodSurplusAtOneHa, 6), food_system: foodSystem, site_notes: site.notes});
    }
  }
  const output = {source: 'Health Canada EER + evidence-based food system + evidence-based heating/woody model', adult_equivalent_definition: energy.canonical_adult_equivalent, site_classes: siteClasses, food_loss_assumptions: foodLossAssumptions, household_profiles: householdProfiles, rows};
  writeJson('data/derived/household-capacity.json', output);
  writeCsv('data/derived/household-capacity.csv', [
    ['site','household','household_energy_gj_year','adult_equivalents','food_area_ha','heating_area_ha','mathematical_minimum_area_ha','resilience_allowance_total_ha','robust_system_area_ha','food_surplus_at_one_total_ha_gj'],
    ...rows.map(row => [row.site,row.household,row.household_energy_gj_year,row.adult_equivalents,row.food_area_ha,row.heating_area_ha,row.mathematical_minimum_area_ha,row.resilience_allowance_total_ha,row.robust_system_area_ha,row.food_surplus_at_one_total_ha_gj])
  ]);
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) buildHouseholdCapacity();
