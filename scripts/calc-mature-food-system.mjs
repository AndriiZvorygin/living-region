import {pathToFileURL} from 'node:url';
import {readCsv, number, round, writeJson, writeText, format} from './model-utils.mjs';
import {calculateMatureScenario, moduleDefinitions} from './calc-livestock.mjs';
import {perennialLabourClassByFoodId} from './calc-food-system-labour.mjs';

export const testedPerennialShares = [.50, .60, .70, .75, .80];
export const minimumAnnualResilienceShare = .20;
export const minimumAnnualCultivationReduction = .70;
const transitionLossReserve = .30;
const labourRows = Object.fromEntries(readCsv('data/source/food-production-labour.csv').map(row => [row.id, row]));

function n(value, fallback = 0) { return number(value) ?? fallback; }
function f(value, digits = 2) { return format(value, digits); }

function maturePerennialLabourPerHa() {
  // Use the fixed four-function perennial mix rather than a transition row's
  // land-limited footprint. A household whose transition cannot establish a
  // forest in the available early-year food envelope must not receive a
  // different mature labour rate merely because that footprint is zero.
  const mix = [
    ['early_berry_low_input_synthesis', .25],
    ['intermediate_hazelnut_low_input_synthesis', .25],
    ['long_staple_chestnut_low_input_synthesis', .25],
    ['intermediate_apple_low_input_synthesis', .25]
  ];
  return mix.reduce((out, [foodId, share]) => {
    const labour = labourRows[perennialLabourClassByFoodId[foodId]];
    if (!labour) return out;
    out.recurring += share * n(labour.mature_recurring_hours_per_ha);
    out.pruning += share * n(labour.pruning_maintenance_hours_per_ha);
    out.harvest += share * n(labour.harvest_hours_per_ha);
    out.irrigation += share * n(labour.irrigation_monitoring_hours_per_ha);
    out.orchard += share * n(labour.orchard_maintenance_hours_per_ha);
    out.pestWildlife += share * n(labour.pest_wildlife_management_hours_per_ha);
    out.processing += share * n(labour.processing_storage_hours_per_ha);
    return out;
  }, {recurring: 0, pruning: 0, harvest: 0, irrigation: 0, orchard: 0, pestWildlife: 0, processing: 0});
}

function labourForScenario(row, scenario, year1AnnualArea) {
  const annual = labourRows.annual_staple_low_input;
  const woody = labourRows.woody_heating_coppice;
  const annualArea = scenario.land.annual_crop_area_ha;
  const perHa = maturePerennialLabourPerHa();
  const annualSoil = annualArea * n(annual.soil_preparation_hours_per_ha);
  const annualPlanting = annualArea * n(annual.planting_hours_per_ha);
  const annualWeeding = annualArea * n(annual.weeding_hours_per_ha);
  const annualHarvest = annualArea * n(annual.harvest_hours_per_ha);
  const annualIrrigation = annualArea * n(annual.irrigation_monitoring_hours_per_ha);
  const annualPestWildlife = annualArea * n(annual.pest_wildlife_management_hours_per_ha);
  const annualProcessing = annualArea * n(annual.processing_storage_hours_per_ha);
  const perennialPruning = scenario.land.perennial_food_area_ha * perHa.pruning;
  const perennialHarvest = scenario.land.perennial_food_area_ha * perHa.harvest;
  const perennialOther = scenario.land.perennial_food_area_ha * Math.max(0, perHa.recurring - perHa.pruning - perHa.harvest);
  const perennialIrrigation = scenario.land.perennial_food_area_ha * perHa.irrigation;
  const perennialOrchard = scenario.land.perennial_food_area_ha * perHa.orchard;
  const perennialPestWildlife = scenario.land.perennial_food_area_ha * perHa.pestWildlife;
  const perennialProcessing = scenario.land.perennial_food_area_ha * perHa.processing;
  const heatingArea = scenario.land.woody_heating_area_ha;
  const coppiceMaintenance = heatingArea * n(woody.pest_wildlife_management_hours_per_ha);
  const coppiceCutting = heatingArea * n(woody.coppice_cutting_hours_per_ha);
  const firewoodHauling = heatingArea * n(woody.firewood_hauling_hours_per_ha);
  const firewoodSplitting = heatingArea * n(woody.firewood_splitting_hours_per_ha);
  const firewoodStackingDrying = heatingArea * n(woody.firewood_stacking_drying_hours_per_ha);
  const livestockHours = scenario.labour.livestock_recurring_labour_hours;
  const annualReduction = year1AnnualArea > 0 ? (1 - annualArea / year1AnnualArea) : 0;
  const heavyAnnualCultivation = annualSoil + annualPlanting + annualWeeding + annualHarvest;
  const heavyWoodyWork = coppiceCutting + firewoodHauling + firewoodSplitting;
  const physicallyDemanding = heavyAnnualCultivation + heavyWoodyWork;
  const lightModerate = annualIrrigation + annualPestWildlife + perennialPruning + perennialHarvest + perennialOther + perennialIrrigation + perennialOrchard + perennialPestWildlife + coppiceMaintenance + livestockHours;
  const processingStorage = annualProcessing + perennialProcessing + firewoodStackingDrying;
  const greenhouseManagement = 0;
  return {
    annual_soil_preparation_hours: round(annualSoil, 2),
    annual_planting_hours: round(annualPlanting, 2),
    annual_weeding_hours: round(annualWeeding, 2),
    annual_harvest_hours: round(annualHarvest, 2),
    annual_irrigation_monitoring_hours: round(annualIrrigation, 2),
    annual_pest_wildlife_management_hours: round(annualPestWildlife, 2),
    annual_processing_storage_hours: round(annualProcessing, 2),
    perennial_pruning_maintenance_hours: round(perennialPruning, 2),
    perennial_harvest_hours: round(perennialHarvest, 2),
    perennial_other_maintenance_hours: round(perennialOther, 2),
    perennial_irrigation_monitoring_hours: round(perennialIrrigation, 2),
    perennial_orchard_maintenance_hours: round(perennialOrchard, 2),
    perennial_pest_wildlife_management_hours: round(perennialPestWildlife, 2),
    perennial_processing_storage_hours: round(perennialProcessing, 2),
    coppice_maintenance_hours: round(coppiceMaintenance, 2),
    coppice_cutting_hours: round(coppiceCutting, 2),
    firewood_hauling_hours: round(firewoodHauling, 2),
    firewood_splitting_hours: round(firewoodSplitting, 2),
    firewood_stacking_drying_hours: round(firewoodStackingDrying, 2),
    greenhouse_management_hours: greenhouseManagement,
    livestock_recurring_labour_hours: round(livestockHours, 2),
    heavy_annual_cultivation_hours: round(heavyAnnualCultivation, 2),
    heavy_woody_work_hours: round(heavyWoodyWork, 2),
    physically_demanding_hours: round(physicallyDemanding, 2),
    light_moderate_recurring_hours: round(lightModerate, 2),
    processing_storage_hours: round(processingStorage, 2),
    annual_cultivation_hours: round(heavyAnnualCultivation, 2),
    perennial_food_labour_hours: round(perennialPruning + perennialHarvest + perennialOther + perennialIrrigation + perennialOrchard + perennialPestWildlife + perennialProcessing, 2),
    total_recurring_labour_hours: round(physicallyDemanding + lightModerate + processingStorage + greenhouseManagement, 2),
    annual_cultivation_area_reduction_percent: round(annualReduction * 100, 3),
    physically_demanding_annual_reduction_percent: round(annualReduction * 100, 3),
    labour_objective_note: 'Physically demanding hours include annual soil preparation, planting, weeding, annual harvest, coppice cutting, firewood hauling and splitting. Light/moderate hours include perennial pruning, food harvest, irrigation, orchard and wildlife work. Processing/storage includes food preservation, nut drying/shelling/storage and firewood stacking/drying. Greenhouse labour is zero because no greenhouse footprint is allocated in this mature land row.'
  };
}

function landAccounting(row, scenario, year1AnnualArea) {
  const allowance = row.resilience_allowances_ha;
  const emergencyReserve = n(allowance.diversity_and_rotation_ha);
  const soilWater = n(allowance.soil_water_perennial_buffer_ha);
  const wildlifeFibreHabitat = n(allowance.fibre_habitat_wildlife_buffer_ha);
  const marketTarget = n(allowance.deliberate_export_production_ha);
  const annualArea = scenario.land.annual_crop_area_ha;
  const perennialArea = scenario.land.perennial_food_area_ha;
  const feedArea = scenario.land.livestock_feed_area_ha;
  const heatingArea = scenario.land.woody_heating_area_ha;
  const foodHeatArea = annualArea + perennialArea + feedArea + heatingArea;
  const releasedAnnualArea = Math.max(0, year1AnnualArea - annualArea);
  const marketOverlap = Math.min(marketTarget, releasedAnnualArea);
  const marketAdditional = Math.max(0, marketTarget - marketOverlap);
  const multifunctionalEcologicalArea = Math.max(soilWater, wildlifeFibreHabitat);
  const exclusiveOtherArea = emergencyReserve;
  const exclusiveProductiveArea = foodHeatArea + exclusiveOtherArea;
  const robustMinimum = exclusiveProductiveArea;
  const grossSiteArea = robustMinimum + marketAdditional;
  return {
    food_heat_exclusive_area_ha: round(foodHeatArea, 6),
    exclusive_productive_area_ha: round(exclusiveProductiveArea, 6),
    exclusive_other_area_ha: round(exclusiveOtherArea, 6),
    robust_household_minimum_area_ha: round(robustMinimum, 6),
    multifunctional_ecological_area_ha: round(multifunctionalEcologicalArea, 6),
    multifunctional_functional_coverage_area_sum_ha: round(soilWater + wildlifeFibreHabitat, 6),
    emergency_resilience_reserve_area_ha: round(emergencyReserve, 6),
    soil_water_management_area_ha: round(soilWater, 6),
    wildlife_protection_area_ha: round(wildlifeFibreHabitat, 6),
    fibre_material_production_area_ha: 0,
    habitat_biodiversity_area_ha: 0,
    paths_access_area_ha: 0,
    greenhouse_building_area_ha: 0,
    market_export_target_area_ha: round(marketTarget, 6),
    released_annual_area_available_for_market_ha: round(releasedAnnualArea, 6),
    market_export_overlap_with_released_annual_area_ha: round(marketOverlap, 6),
    additional_productive_surplus_area_ha: round(marketAdditional, 6),
    gross_site_area_ha: round(grossSiteArea, 6),
    accounting_rule: 'Annual food, perennial food, on-property feed and woody heating are exclusive productive zones. The emergency/rotation reserve is retained as a conservative exclusive reserve. Soil/water, wildlife, fibre and habitat functions are hosted within perennial/woody zones and are reported as overlapping multifunctional coverage, not added hectares. Market production first uses annual land released during the handoff; only the remainder is additional site area.',
    component_classification: {
      emergency_resilience_reserve: 'exclusive land requirement in the central robust case; can be reduced if reserve production is demonstrably carried inside the food zones',
      soil_water_management: 'overlaps perennial food and woody heating zones; already inherent where those zones are designed with continuous roots and runoff interception',
      wildlife_protection: 'overlaps woody/perennial edge; not a separate hectare block in the central accounting',
      paths_access: 'not separately allocated; paths are assumed to pass through productive zones',
      greenhouse_building: 'not included in this land total; any greenhouse footprint must be added from a site plan',
      fibre_material_production: 'no separate hectare; can use coppice and released annual/perennial land',
      market_export_production: 'optional policy/design allowance; first uses released annual acreage and only the residual is additional',
      habitat_biodiversity: 'overlaps perennial/woody zones; no separate hectare added'
    }
  };
}

function evaluateScenario(row, module, share) {
  const siteMultiplier = row.site === 'wetter_productive' ? 1 : row.site === 'ordinary_mesic' ? 1 : row.site === 'dry' ? .75 : .50;
  const scenario = calculateMatureScenario(row, module, siteMultiplier, share);
  const year1AnnualArea = row.household_food_demand_gj_year / (row.annual_crop_gross_yield_gj_ha_year * (1 - transitionLossReserve));
  const labour = labourForScenario(row, scenario, year1AnnualArea);
  const land = landAccounting(row, scenario, year1AnnualArea);
  const totalRobust = land.gross_site_area_ha;
  const annualFoodShare = scenario.human_food_energy.annual_plant_gj_year / row.household_food_demand_gj_year;
  const adequateProtein = scenario.nutritional_output.protein_coverage_percent >= 100;
  const adequateFat = scenario.nutritional_output.fat_coverage_percent >= 100;
  const adequateAnnualResilience = annualFoodShare >= minimumAnnualResilienceShare;
  const lowRecurringAnnualLabour = labour.physically_demanding_annual_reduction_percent >= minimumAnnualCultivationReduction;
  return {
    site: row.site,
    site_label: row.site_label,
    household: row.household,
    household_label: row.household_label,
    module,
    module_label: scenario.module_label,
    perennial_share_requested: share,
    mature_perennial_share_percent: scenario.human_food_energy.source_percent.perennial_plants,
    household_food_gj_year: row.household_food_demand_gj_year,
    year1_annual_bridge_area_ha: round(year1AnnualArea, 6),
    mature_annual_area_ha: scenario.land.annual_crop_area_ha,
    mature_perennial_area_ha: scenario.land.perennial_food_area_ha,
    livestock_feed_area_ha: scenario.land.livestock_feed_area_ha,
    heating_area_ha: scenario.land.woody_heating_area_ha,
    legacy_resilience_ecological_allowance_ha: row.resilience_ecological_allowance_ha,
    legacy_market_export_allowance_ha: row.market_export_allowance_ha,
    legacy_additive_allowance_ha: round(row.resilience_ecological_allowance_ha + row.market_export_allowance_ha, 6),
    legacy_allowance_note: 'Retained for reconciliation only. These historical additive fields must not be added to the current multifunction land-accounting fields.',
    land_accounting: land,
    robust_household_minimum_area_ha: land.robust_household_minimum_area_ha,
    additional_productive_surplus_area_ha: land.additional_productive_surplus_area_ha,
    gross_site_area_ha: land.gross_site_area_ha,
    total_robust_productive_area_ha: round(totalRobust, 6),
    previous_robust_system_area_ha: row.previous_robust_system_area_ha,
    difference_vs_previous_robust_area_ha: round(totalRobust - row.previous_robust_system_area_ha, 6),
    arc_allocation_ha: row.arc_allocation_ha,
    surplus_or_deficit_vs_arc_allocation_ha: round(row.arc_allocation_ha - totalRobust, 6),
    land_surplus_or_deficit_ha: round(row.arc_allocation_ha - totalRobust, 6),
    arc_policy_status: totalRobust <= row.arc_allocation_ha + 1e-9 ? 'sufficient against mature ageing-in-place scenario' : 'deficit against mature ageing-in-place scenario',
    protein_kg_year: scenario.nutritional_output.total.protein_kg_year,
    protein_g_day: round(scenario.nutritional_output.total.protein_kg_year * 1000 / 365.25, 3),
    protein_target_g_day: row.protein_audit.target_g_day,
    protein_coverage_percent: scenario.nutritional_output.protein_coverage_percent,
    fat_coverage_percent: scenario.nutritional_output.fat_coverage_percent,
    annual_food_resilience_share_percent: round(annualFoodShare * 100, 3),
    calories_adequate: scenario.human_food_energy.total_gj_year + 1e-9 >= row.household_food_demand_gj_year,
    protein_adequate: adequateProtein,
    fat_adequate: adequateFat,
    annual_resilience_adequate: adequateAnnualResilience,
    low_recurring_annual_labour_adequate: lowRecurringAnnualLabour,
    land_within_arc_allocation: totalRobust <= row.arc_allocation_ha + 1e-9,
    biologically_feasible_tradeoff: adequateProtein && adequateFat && adequateAnnualResilience && lowRecurringAnnualLabour,
    feasible_within_arc_allocation: adequateProtein && adequateFat && adequateAnnualResilience && lowRecurringAnnualLabour && totalRobust <= row.arc_allocation_ha + 1e-9,
    recurring_labour: labour,
    human_food_energy: scenario.human_food_energy,
    feed: scenario.feed,
    animals: scenario.animals,
    evidence_boundary: scenario.evidence_boundary
  };
}

function maxFeasibleShare(row, module, landConstraint = false) {
  let best = null;
  for (let i = 0; i <= 950; i++) {
    const share = i / 1000;
    if (share < .5) continue;
    const candidate = evaluateScenario(row, module, share);
    if (candidate.biologically_feasible_tradeoff && (!landConstraint || candidate.land_within_arc_allocation)) best = candidate;
  }
  return best;
}

function chooseCanonical(grid) {
  const candidates = grid.filter(row => row.biologically_feasible_tradeoff && row.perennial_share_requested >= minimumCultivationShareForObjective());
  return candidates.sort((a, b) => a.perennial_share_requested - b.perennial_share_requested)[0] ?? grid.find(row => row.perennial_share_requested === .70) ?? grid[0];
}

function minimumCultivationShareForObjective() { return 1 - (1 - minimumAnnualCultivationReduction); }

function canonicalMarkdown(output) {
  const rows = output.canonical_rows;
  const ordinary = rows.filter(row => row.site === 'ordinary_mesic');
  const ordinaryFamily = ordinary.find(row => row.household === 'two_adults_plus_two_children');
  const ordinaryAdult = ordinary.find(row => row.household === 'one_adult');
  const gridRows = output.scenario_grid.filter(row => row.site === 'ordinary_mesic' && ['one_adult', 'two_adults_plus_two_children'].includes(row.household) && row.module === 'plants_only');
  const labourRows = rows.map(row => `| ${row.site_label} | ${row.household_label} | ${f(row.perennial_share_requested * 100, 0)}% | ${f(row.mature_annual_area_ha)} ha | ${f(row.recurring_labour.heavy_annual_cultivation_hours, 0)} | ${f(row.recurring_labour.heavy_woody_work_hours, 0)} | ${f(row.recurring_labour.physically_demanding_hours, 0)} | ${f(row.recurring_labour.light_moderate_recurring_hours, 0)} | ${f(row.recurring_labour.processing_storage_hours, 0)} | ${f(row.recurring_labour.total_recurring_labour_hours, 0)} | ${f(row.recurring_labour.annual_cultivation_area_reduction_percent, 0)}% |`).join('\n');
  return `# Mature food-system trade-off and canonical land table

The mature share is solved as a trade-off. The canonical plants-only objective is the **lowest tested perennial share that simultaneously** provides at least 70% reduction in physically demanding annual cultivation, at least 20% annual plant-food share for resilience, and passes the protein and fat screening thresholds. The 70% threshold is an explicit ageing-in-place planning judgement, not a mathematically unique optimum. The 75% case remains a comparison; continuous maximum-feasible shares are also reported.

The labour hours are planning estimates. Annual cultivation includes soil preparation, planting, weeding and harvest. The detailed audit separates physically demanding work, light/moderate recurring work, and processing/storage. Heating is shared at the dwelling level. Soil/water, wildlife, fibre and habitat functions are multifunctional overlays rather than additive hectares. Optional market land is separated from the robust household minimum.

## Canonical plants-only table

| site | household | Year-1 annual area | mature annual area | mature perennial share | perennial area | heating area | multifunction ecological area | exclusive other area | robust minimum | optional additional surplus | total site area | protein coverage | recurring labour |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${rows.map(row => `| ${row.site_label} | ${row.household_label} | ${f(row.year1_annual_bridge_area_ha)} ha | ${f(row.mature_annual_area_ha)} ha | ${f(row.mature_perennial_share_percent, 0)}% | ${f(row.mature_perennial_area_ha)} ha | ${f(row.heating_area_ha)} ha | ${f(row.land_accounting.multifunctional_ecological_area_ha)} ha | ${f(row.land_accounting.exclusive_other_area_ha)} ha | **${f(row.robust_household_minimum_area_ha)} ha** | ${f(row.additional_productive_surplus_area_ha)} ha | **${f(row.gross_site_area_ha)} ha** | ${f(row.protein_coverage_percent, 0)}% | ${f(row.recurring_labour.total_recurring_labour_hours, 0)} h/y |`).join('\n')}

## Ordinary-site share scenarios

| household | share | annual area | perennial area | protein | fat | annual resilience | annual reduction | passes canonical constraints | robust minimum | optional additional surplus | total site area | total labour |
|---|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|
${gridRows.map(row => `| ${row.household_label} | ${row.perennial_share_requested === null ? 'max' : `${f(row.perennial_share_requested * 100, 1)}%`} | ${f(row.mature_annual_area_ha)} ha | ${f(row.mature_perennial_area_ha)} ha | ${f(row.protein_coverage_percent, 0)}% | ${f(row.fat_coverage_percent, 0)}% | ${f(row.annual_food_resilience_share_percent, 0)}% | ${f(row.recurring_labour.physically_demanding_annual_reduction_percent, 0)}% | ${row.biologically_feasible_tradeoff ? 'yes' : 'no'} | ${f(row.robust_household_minimum_area_ha)} ha | ${f(row.additional_productive_surplus_area_ha)} ha | ${f(row.gross_site_area_ha)} ha | ${f(row.recurring_labour.total_recurring_labour_hours, 0)} h/y |`).join('\n')}
${output.max_share_rows.filter(row => row.site === 'ordinary_mesic' && ['one_adult','two_adults_plus_two_children'].includes(row.household) && row.module === 'plants_only' && row.maximum_type === 'biological and nutritional constraints').map(row => `| ${row.household_label} | max ${f(row.perennial_share_requested * 100, 1)}% | ${f(row.mature_annual_area_ha)} ha | ${f(row.mature_perennial_area_ha)} ha | ${f(row.protein_coverage_percent, 0)}% | ${f(row.fat_coverage_percent, 0)}% | ${f(row.annual_food_resilience_share_percent, 0)}% | ${f(row.recurring_labour.physically_demanding_annual_reduction_percent, 0)}% | yes | ${f(row.robust_household_minimum_area_ha)} ha | ${f(row.additional_productive_surplus_area_ha)} ha | ${f(row.gross_site_area_ha)} ha | ${f(row.recurring_labour.total_recurring_labour_hours, 0)} h/y |`).join('\n')}

## Canonical recurring-labour decomposition

The following rows correspond to the canonical 70% plants-only selection. Hours are planning estimates per year. Annual soil preparation, planting and weeding are the physically demanding annual-cultivation components; perennial pruning and harvest remain recurring work after the annual area contracts.

| site | household | share | mature annual area | annual soil prep h/y | annual planting h/y | annual weeding h/y | perennial pruning h/y | perennial harvest h/y | total recurring h/y | annual cultivation reduction |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${labourRows}

## Reconciliation: ordinary 2 adults + 2 children

The previous robust result was ${f(ordinaryFamily.previous_robust_system_area_ha)} ha, but it added ecological functions and optional export as separate hectares. Under the corrected 70% model, the exclusive food-and-heat subtotal is ${f(ordinaryFamily.land_accounting.food_heat_exclusive_area_ha)} ha; the retained exclusive emergency/rotation reserve is ${f(ordinaryFamily.land_accounting.exclusive_other_area_ha)} ha, while ${f(ordinaryFamily.land_accounting.multifunctional_ecological_area_ha)} ha carries overlapping soil/water, wildlife, fibre and habitat functions. The robust household minimum is **${f(ordinaryFamily.robust_household_minimum_area_ha)} ha**. The ${f(ordinaryFamily.land_accounting.market_export_target_area_ha)} ha optional market target fits within ${f(ordinaryFamily.land_accounting.market_export_overlap_with_released_annual_area_ha)} ha of released annual land, so only ${f(ordinaryFamily.additional_productive_surplus_area_ha)} ha is additional.

## Ageing-in-place answer

For one ordinary-site adult, the canonical mature share is ${f(ordinaryAdult.mature_perennial_share_percent, 0)}% perennial calories, with ${f(ordinaryAdult.recurring_labour.physically_demanding_annual_reduction_percent, 0)}% reduction in annual cultivation area from the Year-1 bridge. The system still retains ${f(ordinaryAdult.annual_food_resilience_share_percent, 0)}% annual plant food for resilience and optional market production. On marginal sites the same biological share may require more land than the ARC example; land deficit is exposed rather than hidden.

## Optional livestock

Plants-only is canonical. Small eggs, rabbits, combined livestock and an on-site-feed-constrained combined module are comparisons in outputs/livestock-scenarios.json. The on-site constrained case caps dedicated feed area at 0.10 ha per household and reduces animal numbers until the modeled feed can be supplied on-site; it does not claim that scraps alone make a nutritionally complete ration.
`;
}

function landAccountingMarkdown(output) {
  const rows = output.canonical_rows.filter(row => row.site === 'ordinary_mesic');
  const adult = rows.find(row => row.household === 'one_adult');
  return `# Multifunction land-accounting audit

The previous ordinary one-adult 0.57 ha other allowance was not one exclusive block. It was 0.12 ha diversity/rotation, 0.15 ha soil/water buffer, 0.10 ha fibre/habitat/wildlife buffer and 0.20 ha optional export production. The corrected accounting retains the 0.12 ha reserve as an exclusive conservative household function, places the ecological functions inside productive perennial/woody zones, and treats market land separately.

| component | ordinary one-adult planning value | classification | added to gross site area? |
|---|---:|---|---:|
| emergency/resilience reserve and rotation | ${f(adult.land_accounting.emergency_resilience_reserve_area_ha)} ha | exclusive in central robust case; can overlap if reserve yield is demonstrated inside food zones | yes |
| soil/water management | ${f(adult.land_accounting.soil_water_management_area_ha)} ha functional coverage | overlaps perennial food and woody heating zones; already inherent when designed with continuous roots | no |
| wildlife protection | ${f(adult.land_accounting.wildlife_protection_area_ha)} ha functional coverage | overlaps woody/perennial edge | no |
| paths/access | 0 ha allocated | paths assumed to pass through productive zones | no |
| greenhouse/building footprint | 0 ha allocated | outside this food/heat total; add from parcel plan | no |
| fibre/material production | 0 ha separate | uses coppice and released annual/perennial land | no |
| habitat/biodiversity | 0 ha separate | overlaps perennial/woody zones | no |
| market/export production | ${f(adult.land_accounting.market_export_target_area_ha)} ha target | optional; first uses released annual land | only residual |

The two ecological function footprints sum to ${f(adult.land_accounting.multifunctional_functional_coverage_area_sum_ha)} ha as tags, but their conservative overlapping footprint is ${f(adult.land_accounting.multifunctional_ecological_area_ha)} ha and neither is added to the gross area. For the ordinary one-adult case, the robust household minimum is ${f(adult.robust_household_minimum_area_ha)} ha. The ${f(adult.land_accounting.market_export_target_area_ha)} ha optional market target overlaps ${f(adult.land_accounting.market_export_overlap_with_released_annual_area_ha)} ha of released annual acreage, leaving ${f(adult.additional_productive_surplus_area_ha)} ha of additional site area.

| household | food/heat exclusive | exclusive reserve | multifunction ecological overlay | robust minimum | optional market target | additional market area | total site area |
|---|---:|---:|---:|---:|---:|---:|---:|
${rows.map(row => `| ${row.household_label} | ${f(row.land_accounting.food_heat_exclusive_area_ha)} ha | ${f(row.land_accounting.exclusive_other_area_ha)} ha | ${f(row.land_accounting.multifunctional_ecological_area_ha)} ha | ${f(row.robust_household_minimum_area_ha)} ha | ${f(row.land_accounting.market_export_target_area_ha)} ha | ${f(row.additional_productive_surplus_area_ha)} ha | ${f(row.gross_site_area_ha)} ha |`).join('\n')}

The model does not allocate separate hectares for paths, greenhouse/building footprint, habitat or fibre. Those are explicit omissions requiring a site plan before a parcel-level policy decision; they are not silently assumed to be zero in a complete property design.
`;
}

function labourAuditMarkdown(output) {
  const rows = output.canonical_rows.filter(row => row.site === 'ordinary_mesic');
  const adult = rows.find(row => row.household === 'one_adult');
  return `# Mature recurring-labour audit

The canonical plants-only mature estimate includes annual cultivation, perennial food management and woody heating work. It excludes one-time establishment labour. Hours are planning assumptions, not a Grey-Bruce time-and-motion study.

## Ordinary one-adult activity audit

| activity | hours/year | labour class |
|---|---:|---|
| annual soil preparation | ${f(adult.recurring_labour.annual_soil_preparation_hours, 1)} | physically demanding annual cultivation |
| sowing/transplanting | ${f(adult.recurring_labour.annual_planting_hours, 1)} | physically demanding annual cultivation |
| annual weeding | ${f(adult.recurring_labour.annual_weeding_hours, 1)} | repetitive annual cultivation |
| annual irrigation/monitoring | ${f(adult.recurring_labour.annual_irrigation_monitoring_hours, 1)} | light/moderate recurring |
| annual pest/wildlife management | ${f(adult.recurring_labour.annual_pest_wildlife_management_hours, 1)} | light/moderate recurring |
| annual harvest | ${f(adult.recurring_labour.annual_harvest_hours, 1)} | physically demanding annual harvest |
| perennial pruning | ${f(adult.recurring_labour.perennial_pruning_maintenance_hours, 1)} | light/moderate recurring |
| berry/fruit/nut gathering | ${f(adult.recurring_labour.perennial_harvest_hours, 1)} | seasonal light/moderate harvest |
| orchard/plant maintenance and wildlife work | ${f(adult.recurring_labour.perennial_orchard_maintenance_hours + adult.recurring_labour.perennial_pest_wildlife_management_hours, 1)} | light/moderate recurring |
| perennial irrigation/monitoring | ${f(adult.recurring_labour.perennial_irrigation_monitoring_hours, 1)} | light/moderate recurring |
| food preservation, nut drying/shelling/storage | ${f(adult.recurring_labour.processing_storage_hours - adult.recurring_labour.firewood_stacking_drying_hours, 1)} | processing/storage |
| coppice cutting | ${f(adult.recurring_labour.coppice_cutting_hours, 1)} | physically demanding woody work |
| firewood hauling | ${f(adult.recurring_labour.firewood_hauling_hours, 1)} | physically demanding woody work |
| firewood splitting/cutting | ${f(adult.recurring_labour.firewood_splitting_hours, 1)} | physically demanding woody work |
| stacking/drying firewood | ${f(adult.recurring_labour.firewood_stacking_drying_hours, 1)} | processing/storage |
| greenhouse management | ${f(adult.recurring_labour.greenhouse_management_hours, 1)} | not allocated in canonical land row |

The resulting ordinary one-adult totals are ${f(adult.recurring_labour.heavy_annual_cultivation_hours, 1)} heavy annual-cultivation hours, ${f(adult.recurring_labour.heavy_woody_work_hours, 1)} heavy woody hours, ${f(adult.recurring_labour.physically_demanding_hours, 1)} physically demanding hours overall, ${f(adult.recurring_labour.light_moderate_recurring_hours, 1)} light/moderate recurring hours, ${f(adult.recurring_labour.processing_storage_hours, 1)} processing/storage hours and ${f(adult.recurring_labour.total_recurring_labour_hours, 1)} total recurring hours/year. The ageing metric is the ${f(adult.recurring_labour.annual_cultivation_area_reduction_percent, 0)}% reduction in annual cultivation area; it does not imply that total work falls by the same percentage.

| ordinary household | heavy annual hours | physically demanding hours | light/moderate hours | processing/storage hours | total recurring hours |
|---|---:|---:|---:|---:|---:|
${rows.map(row => `| ${row.household_label} | ${f(row.recurring_labour.heavy_annual_cultivation_hours, 0)} | ${f(row.recurring_labour.physically_demanding_hours, 0)} | ${f(row.recurring_labour.light_moderate_recurring_hours, 0)} | ${f(row.recurring_labour.processing_storage_hours, 0)} | ${f(row.recurring_labour.total_recurring_labour_hours, 0)} |`).join('\n')}
`;
}

export function buildMatureFoodSystem(transitionOutput) {
  const modules = Object.keys(moduleDefinitions);
  const scenarioRows = transitionOutput.households.flatMap(row => modules.flatMap(module => testedPerennialShares.map(share => evaluateScenario(row, module, share))));
  const canonicalRows = transitionOutput.households.map(row => {
    const grid = testedPerennialShares.map(share => evaluateScenario(row, 'plants_only', share));
    const selected = chooseCanonical(grid);
    return {...selected, selection_rule: 'lowest tested share meeting >=70% annual-cultivation reduction, >=20% annual plant-food resilience share, and protein/fat screening thresholds; land deficit remains an output.'};
  });
  const maxShareRows = transitionOutput.households.flatMap(row => {
    const biological = maxFeasibleShare(row, 'plants_only');
    const withinArc = maxFeasibleShare(row, 'plants_only', true);
    return [biological ? {...biological, maximum_type: 'biological and nutritional constraints'} : null, withinArc ? {...withinArc, maximum_type: 'biological, nutritional and ARC allocation constraints'} : null].filter(Boolean);
  });
  const maxShareSummary = transitionOutput.households.map(row => {
    const biological = maxShareRows.find(item => item.site === row.site && item.household === row.household && item.maximum_type === 'biological and nutritional constraints');
    const withinArc = maxShareRows.find(item => item.site === row.site && item.household === row.household && item.maximum_type === 'biological, nutritional and ARC allocation constraints');
    return {site: row.site, household: row.household, biological_max_share: biological?.perennial_share_requested ?? null, max_share_within_arc_allocation: withinArc?.perennial_share_requested ?? null, biological_max_required_site_area_ha: biological?.gross_site_area_ha ?? null, arc_allocation_ha: row.arc_allocation_ha};
  });
  const output = {
    model: 'canonical mature food-system trade-off for ageing in place',
    status: 'current evidence-based scenario optimization; 75% is not a fixed canonical input',
    tested_perennial_shares: testedPerennialShares,
    minimum_annual_resilience_share: minimumAnnualResilienceShare,
    minimum_annual_cultivation_reduction: minimumAnnualCultivationReduction,
    canonical_selection_rule: 'Planning judgement: select the lowest tested perennial share satisfying protein and fat screening, retaining at least 20% annual plant food and reducing physically demanding annual cultivation by at least 70%. This is not a mathematically unique optimum; report 75%, 80% and continuous maximum-feasible shares separately.',
    canonical_rows: canonicalRows,
    scenario_grid: scenarioRows,
    max_share_rows: maxShareRows,
    max_share_summary: maxShareSummary,
    optional_livestock_modules: modules,
    limitations: ['The 70% reduction threshold is an explicit ageing-in-place design objective, not a measured physiological limit or unique mathematical optimum.', 'Perennial yield and labour values remain evidence-informed planning syntheses rather than a long-term ordinary Grey-Bruce food-forest trial.', 'The central robust minimum retains the diversity/rotation allowance as exclusive reserve land; soil/water, wildlife, fibre and habitat functions overlap productive zones and are not added as separate hectares.', 'Optional market/export land is separated from the robust household minimum and first uses released annual ground.', 'Paths/access and greenhouse/building footprints are not allocated in this food/heat site total and require a parcel plan.', 'Nutritional screening does not establish complete diet adequacy.']
  };
  writeJson('outputs/mature-food-system-canonical.json', output);
  writeText('outputs/mature-food-system-canonical.md', canonicalMarkdown(output));
  writeText('outputs/land-accounting-audit.md', landAccountingMarkdown(output));
  writeText('outputs/mature-labour-audit.md', labourAuditMarkdown(output));
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) throw new Error('Pass a transition output to buildMatureFoodSystem from the build pipeline.');
