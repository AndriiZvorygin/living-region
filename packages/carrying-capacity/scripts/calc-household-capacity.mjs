import {pathToFileURL} from 'node:url';
import {round, writeCsv, writeJson} from './model-utils.mjs';
import {buildHealthCanadaEnergy} from './calc-health-canada-energy.mjs';
import {calculateFoodEvidence} from './calc-evidence-food.mjs';
import {buildEvidenceHeating} from './calc-evidence-heating.mjs';
import {calculateWoodyLand} from './calc-evidence-woody.mjs';
import {siteClasses, householdProfiles, arcPolicyAdultAllocationHa, policySiteMap, foodLossAssumptions, calculateFoodSystem} from '../src/core.mjs';
export {siteClasses, householdProfiles, arcPolicyAdultAllocationHa, policySiteMap, foodLossAssumptions, calculateFoodSystem};

export function buildHouseholdCapacity(energy = buildHealthCanadaEnergy(), food = calculateFoodEvidence(), heating = buildEvidenceHeating(), woody = calculateWoodyLand(heating)) {
  const adultEquivalent = energy.canonical_adult_equivalent.gj_year;
  const rows = [];
  for (const [siteId, site] of Object.entries(siteClasses)) {
    const heatingBand = site.woody_band;
      const heatArea = woody.cases.central[heatingBand].required_woody_area_ha / Number(site.woody_yield_multiplier ?? 1);
    for (const [householdId, household] of Object.entries(householdProfiles)) {
      const members = household.member_ids;
      const membersResult = members.map(id => energy.scenarios[id]);
      const demand = membersResult.reduce((sum, member) => sum + member.gj_year, 0);
      const referenceWeight = membersResult.reduce((sum, member) => sum + member.weight_kg, 0);
      const foodSystem = calculateFoodSystem(food, demand, site, referenceWeight);
      const mathArea = foodSystem.required_food_area_ha + heatArea;
      const resilience = {diversity_and_rotation_ha: round(Math.max(.12, foodSystem.required_food_area_ha * .25), 6), soil_water_perennial_buffer_ha: .15, fibre_habitat_wildlife_buffer_ha: .10, deliberate_export_production_ha: .20};
      const resilienceArea = Object.values(resilience).reduce((sum, value) => sum + value, 0);
      const robustArea = mathArea + resilienceArea;
      // ARC's 1 ha/adult example is evaluated by adult household count. Children affect
      // the food-demand component, but neither become full adult land units nor create a
      // second dwelling/heating system in this scenario.
      const arcAllocationHa = household.adult_count * arcPolicyAdultAllocationHa;
      const availableFoodAreaAtAllocation = arcAllocationHa - heatArea;
      const foodSurplusAtArcAllocation = availableFoodAreaAtAllocation * foodSystem.gross_energy_per_ha * foodSystem.delivery_factor_after_losses_and_reserves - demand;
      const landSurplusOrDeficit = arcAllocationHa - robustArea;
      rows.push({site: siteId, household: householdId, household_label: household.label, member_ids: members, member_count: members.length, adult_count: household.adult_count, household_energy_gj_year: round(demand, 6), food_adult_equivalents: round(demand / adultEquivalent, 6), food_area_ha: foodSystem.required_food_area_ha, heating_area_ha: round(heatArea, 6), mathematical_minimum_area_ha: round(mathArea, 6), resilience_allowances_ha: resilience, resilience_allowance_total_ha: round(resilienceArea, 6), robust_system_area_ha: round(robustArea, 6), arc_policy_allocation_ha: round(arcAllocationHa, 6), land_surplus_or_deficit_ha: round(landSurplusOrDeficit, 6), arc_policy_status: landSurplusOrDeficit >= 0 ? 'sufficient against robust-area scenario' : 'deficit against robust-area scenario', food_surplus_or_deficit_at_arc_allocation_gj: round(foodSurplusAtArcAllocation), food_system: foodSystem, site_capability: {id: siteId, environment_id: site.environment_id, viable_annual_crops: foodSystem.viable_crop_ids, excluded_annual_crops: foodSystem.excluded_crop_ids, woody_yield_multiplier: site.woody_yield_multiplier}, site_notes: site.notes});
    }
  }
  const output = {source: 'Health Canada EER + evidence-based food system + evidence-based heating/woody model', food_adult_equivalent_definition: energy.canonical_adult_equivalent, adult_equivalent_scope: 'food-energy normalization only; not a total-land multiplier', arc_policy_definition: '1 ha per adult is evaluated by number of adults in the household allocation, while children increase food demand and shared-household land pressure', site_classes: siteClasses, policy_site_map: policySiteMap, food_loss_assumptions: foodLossAssumptions, household_profiles: householdProfiles, rows};
  writeJson('data/derived/household-capacity.json', output);
  writeCsv('data/derived/household-capacity.csv', [
    ['site','household','adult_count','household_energy_gj_year','food_adult_equivalents','mathematical_food_area_ha','heating_area_ha','resilience_surplus_allowance_ha','total_robust_productive_area_ha','arc_policy_allocation_ha','land_surplus_or_deficit_ha','arc_policy_status','food_surplus_or_deficit_at_arc_allocation_gj'],
    ...rows.map(row => [row.site,row.household,row.adult_count,row.household_energy_gj_year,row.food_adult_equivalents,row.food_area_ha,row.heating_area_ha,row.resilience_allowance_total_ha,row.robust_system_area_ha,row.arc_policy_allocation_ha,row.land_surplus_or_deficit_ha,row.arc_policy_status,row.food_surplus_or_deficit_at_arc_allocation_gj])
  ]);
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) buildHouseholdCapacity();
