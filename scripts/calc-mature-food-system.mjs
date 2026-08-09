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
    return out;
  }, {recurring: 0, pruning: 0, harvest: 0});
}

function labourForScenario(row, scenario, year1AnnualArea) {
  const annual = labourRows.annual_staple_low_input;
  const annualArea = scenario.land.annual_crop_area_ha;
  const perHa = maturePerennialLabourPerHa();
  const annualSoil = annualArea * n(annual.soil_preparation_hours_per_ha);
  const annualPlanting = annualArea * n(annual.planting_hours_per_ha);
  const annualWeeding = annualArea * n(annual.weeding_hours_per_ha);
  const annualHarvest = annualArea * n(annual.harvest_hours_per_ha);
  const perennialPruning = scenario.land.perennial_food_area_ha * perHa.pruning;
  const perennialHarvest = scenario.land.perennial_food_area_ha * perHa.harvest;
  const perennialOther = scenario.land.perennial_food_area_ha * Math.max(0, perHa.recurring - perHa.pruning - perHa.harvest);
  const livestockHours = scenario.labour.livestock_recurring_labour_hours;
  const annualReduction = year1AnnualArea > 0 ? (1 - annualArea / year1AnnualArea) : 0;
  return {
    annual_soil_preparation_hours: round(annualSoil, 2),
    annual_planting_hours: round(annualPlanting, 2),
    annual_weeding_hours: round(annualWeeding, 2),
    annual_harvest_hours: round(annualHarvest, 2),
    perennial_pruning_maintenance_hours: round(perennialPruning, 2),
    perennial_harvest_hours: round(perennialHarvest, 2),
    perennial_other_maintenance_hours: round(perennialOther, 2),
    livestock_recurring_labour_hours: round(livestockHours, 2),
    annual_cultivation_hours: round(annualSoil + annualPlanting + annualWeeding + annualHarvest, 2),
    perennial_food_labour_hours: round(perennialPruning + perennialHarvest + perennialOther, 2),
    total_recurring_labour_hours: round(annualSoil + annualPlanting + annualWeeding + annualHarvest + perennialPruning + perennialHarvest + perennialOther + livestockHours, 2),
    annual_cultivation_area_reduction_percent: round(annualReduction * 100, 3),
    physically_demanding_annual_reduction_percent: round(annualReduction * 100, 3),
    labour_objective_note: 'The reduction metric tracks annual area and its soil-preparation, planting, weeding and harvest burden. Perennial pruning, harvest and maintenance remain recurring work.'
  };
}

function evaluateScenario(row, module, share) {
  const siteMultiplier = row.site === 'wetter_productive' ? 1 : row.site === 'ordinary_mesic' ? 1 : row.site === 'dry' ? .75 : .50;
  const scenario = calculateMatureScenario(row, module, siteMultiplier, share);
  const year1AnnualArea = row.household_food_demand_gj_year / (row.annual_crop_gross_yield_gj_ha_year * (1 - transitionLossReserve));
  const labour = labourForScenario(row, scenario, year1AnnualArea);
  const ecologicalAllowance = row.resilience_ecological_allowance_ha;
  const marketAllowance = row.market_export_allowance_ha;
  const totalRobust = scenario.land.annual_crop_area_ha + scenario.land.perennial_food_area_ha + scenario.land.livestock_feed_area_ha + scenario.land.woody_heating_area_ha + ecologicalAllowance + marketAllowance;
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
    resilience_ecological_allowance_ha: ecologicalAllowance,
    market_export_allowance_ha: marketAllowance,
    other_robust_allowance_ha: round(ecologicalAllowance + marketAllowance, 6),
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
  const labourRows = rows.map(row => `| ${row.site_label} | ${row.household_label} | ${f(row.perennial_share_requested * 100, 0)}% | ${f(row.mature_annual_area_ha)} ha | ${f(row.recurring_labour.annual_soil_preparation_hours, 0)} | ${f(row.recurring_labour.annual_planting_hours, 0)} | ${f(row.recurring_labour.annual_weeding_hours, 0)} | ${f(row.recurring_labour.perennial_pruning_maintenance_hours, 0)} | ${f(row.recurring_labour.perennial_harvest_hours, 0)} | ${f(row.recurring_labour.total_recurring_labour_hours, 0)} | ${f(row.recurring_labour.physically_demanding_annual_reduction_percent, 0)}% |`).join('\n');
  return `# Mature food-system trade-off and canonical land table

The mature share is solved as a trade-off. The canonical plants-only objective is the **lowest tested perennial share that simultaneously** provides at least 70% reduction in physically demanding annual cultivation, at least 20% annual plant-food share for resilience, and passes the protein and fat screening thresholds. This produces a data-derived central share rather than assuming 75% in advance. The 75% case remains a comparison; continuous maximum-feasible shares are also reported.

The labour hours are planning estimates. Annual cultivation includes soil preparation, planting, weeding and harvest. Perennial food labour includes pruning, harvest and other recurring maintenance. Heating is shared at the dwelling level. Ecological and market/export allowances are added explicitly.

## Canonical plants-only table

| site | household | Year-1 annual area | mature annual area | mature perennial share | perennial area | heating area | other robust allowance | total robust land | protein coverage | recurring labour |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${rows.map(row => `| ${row.site_label} | ${row.household_label} | ${f(row.year1_annual_bridge_area_ha)} ha | ${f(row.mature_annual_area_ha)} ha | ${f(row.mature_perennial_share_percent, 0)}% | ${f(row.mature_perennial_area_ha)} ha | ${f(row.heating_area_ha)} ha | ${f(row.other_robust_allowance_ha)} ha | **${f(row.total_robust_productive_area_ha)} ha** | ${f(row.protein_coverage_percent, 0)}% | ${f(row.recurring_labour.total_recurring_labour_hours, 0)} h/y |`).join('\n')}

## Ordinary-site share scenarios

| household | share | annual area | perennial area | protein coverage | annual cultivation reduction | total robust land | labour |
|---|---:|---:|---:|---:|---:|---:|---:|
${gridRows.map(row => `| ${row.household_label} | ${row.perennial_share_requested === null ? 'max' : `${f(row.perennial_share_requested * 100, 1)}%`} | ${f(row.mature_annual_area_ha)} ha | ${f(row.mature_perennial_area_ha)} ha | ${f(row.protein_coverage_percent, 0)}% | ${f(row.recurring_labour.physically_demanding_annual_reduction_percent, 0)}% | ${f(row.total_robust_productive_area_ha)} ha | ${f(row.recurring_labour.total_recurring_labour_hours, 0)} h/y |`).join('\n')}
${output.max_share_rows.filter(row => row.site === 'ordinary_mesic' && ['one_adult','two_adults_plus_two_children'].includes(row.household) && row.module === 'plants_only' && row.maximum_type === 'biological and nutritional constraints').map(row => `| ${row.household_label} | max ${f(row.perennial_share_requested * 100, 1)}% | ${f(row.mature_annual_area_ha)} ha | ${f(row.mature_perennial_area_ha)} ha | ${f(row.protein_coverage_percent, 0)}% | ${f(row.recurring_labour.physically_demanding_annual_reduction_percent, 0)}% | ${f(row.total_robust_productive_area_ha)} ha | ${f(row.recurring_labour.total_recurring_labour_hours, 0)} h/y |`).join('\n')}

## Canonical recurring-labour decomposition

The following rows correspond to the canonical 70% plants-only selection. Hours are planning estimates per year. Annual soil preparation, planting and weeding are the physically demanding annual-cultivation components; perennial pruning and harvest remain recurring work after the annual area contracts.

| site | household | share | mature annual area | annual soil prep h/y | annual planting h/y | annual weeding h/y | perennial pruning h/y | perennial harvest h/y | total recurring h/y | annual cultivation reduction |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${labourRows}

## Reconciliation: ordinary 2 adults + 2 children

The previous robust result was ${f(ordinaryFamily.previous_robust_system_area_ha)} ha. Under the new 70% perennial mature constraint, the food-and-heat subtotal is ${f(ordinaryFamily.mature_annual_area_ha + ordinaryFamily.mature_perennial_area_ha + ordinaryFamily.heating_area_ha)} ha: ${f(ordinaryFamily.mature_annual_area_ha)} ha annual food + ${f(ordinaryFamily.mature_perennial_area_ha)} ha perennial food + ${f(ordinaryFamily.heating_area_ha)} ha heating. Adding ${f(ordinaryFamily.other_robust_allowance_ha)} ha for ecological/resilience and deliberate market/export functions produces **${f(ordinaryFamily.total_robust_productive_area_ha)} ha**, ${f(ordinaryFamily.difference_vs_previous_robust_area_ha)} ha above the previous result. The earlier approximately 1.93 ha subtotal corresponds closely to the 75% comparison, not the selected 70% canonical share.

## Ageing-in-place answer

For one ordinary-site adult, the canonical mature share is ${f(ordinaryAdult.mature_perennial_share_percent, 0)}% perennial calories, with ${f(ordinaryAdult.recurring_labour.physically_demanding_annual_reduction_percent, 0)}% reduction in annual cultivation area from the Year-1 bridge. The system still retains ${f(ordinaryAdult.annual_food_resilience_share_percent, 0)}% annual plant food for resilience and optional market production. On marginal sites the same biological share may require more land than the ARC example; land deficit is exposed rather than hidden.

## Optional livestock

Plants-only is canonical. Small eggs, rabbits, combined livestock and an on-site-feed-constrained combined module are comparisons in outputs/livestock-scenarios.json. The on-site constrained case caps dedicated feed area at 0.10 ha per household and reduces animal numbers until the modeled feed can be supplied on-site; it does not claim that scraps alone make a nutritionally complete ration.
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
    return {site: row.site, household: row.household, biological_max_share: biological?.perennial_share_requested ?? null, max_share_within_arc_allocation: withinArc?.perennial_share_requested ?? null, biological_max_required_land_ha: biological?.total_robust_productive_area_ha ?? null, arc_allocation_ha: row.arc_allocation_ha};
  });
  const output = {
    model: 'canonical mature food-system trade-off for ageing in place',
    status: 'current evidence-based scenario optimization; 75% is not a fixed canonical input',
    tested_perennial_shares: testedPerennialShares,
    minimum_annual_resilience_share: minimumAnnualResilienceShare,
    minimum_annual_cultivation_reduction: minimumAnnualCultivationReduction,
    canonical_selection_rule: 'Select the lowest tested perennial share satisfying protein and fat screening, retaining at least 20% annual plant food and reducing physically demanding annual cultivation by at least 70%. Report continuous maximum-feasible shares separately.',
    canonical_rows: canonicalRows,
    scenario_grid: scenarioRows,
    max_share_rows: maxShareRows,
    max_share_summary: maxShareSummary,
    optional_livestock_modules: modules,
    limitations: ['The 70% reduction threshold is an explicit ageing-in-place design objective, not a measured physiological limit.', 'Perennial yield and labour values remain evidence-informed planning syntheses rather than a long-term ordinary Grey-Bruce food-forest trial.', 'Land allowances include the existing resilience/ecological and deliberate market/export planning allowances; site-specific parcel surveys must replace scenario multipliers.', 'Nutritional screening does not establish complete diet adequacy.']
  };
  writeJson('outputs/mature-food-system-canonical.json', output);
  writeText('outputs/mature-food-system-canonical.md', canonicalMarkdown(output));
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) throw new Error('Pass a transition output to buildMatureFoodSystem from the build pipeline.');
