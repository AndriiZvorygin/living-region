import test from 'node:test';
import assert from 'node:assert/strict';

import {calculateHumanEnergy} from '../scripts/calc-human-energy.mjs';
import {calculateHectareBudget} from '../scripts/calc-hectare-budget.mjs';
import {calculateHeating} from '../scripts/calc-heating.mjs';
import {readCsv, stats} from '../scripts/model-utils.mjs';
import {calculateHealthCanadaEER} from '../scripts/calc-health-canada-energy.mjs';
import {calculateFoodEvidence} from '../scripts/calc-evidence-food.mjs';
import {calculateEvidenceHeating} from '../scripts/calc-evidence-heating.mjs';
import {calculateWoodyLand} from '../scripts/calc-evidence-woody.mjs';
import {buildHouseholdCapacity} from '../scripts/calc-household-capacity.mjs';
import {calculateEconomicTargets} from '../scripts/calc-economics.mjs';
import {buildFoodForestTransition, calculatePerennialEvidence, transitionYears} from '../scripts/calc-food-forest-transition.mjs';
import {calculateFoodSystemLabour} from '../scripts/calc-food-system-labour.mjs';

function close(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} was not within ${tolerance} of ${expected}`);
}

test('historical 75 kg food energy converts MJ/day to GJ/year', () => {
  const result = calculateHumanEnergy({bodyMassKg: 75, dailyKj: 13050, daysPerYear: 365.25});
  close(result.daily_mj, 13.05);
  close(result.annual_gj, 4.7665125);
  close(result.annual_kcal, 13050 / 4.184, 1e-10);
});

test('crop yield times energy density reproduces workbook GJ/ha', () => {
  const tonnesPerHa = 1;
  const kjPer100g = 2591;
  const gjPerHa = tonnesPerHa * 10000 * kjPer100g / 1_000_000;
  close(gjPerHa, 25.91);
});

test('quarter-hectare crop output uses the modeled crop yield', () => {
  const result = calculateHectareBudget({
    foodDemandGJ: 4.7665125,
    medianCropGJPerHa: 25.91,
    cropQ1GJPerHa: 20.26,
    cropQ3GJPerHa: 29.59,
    heaterEfficiency: 0.65,
    historicalWoodGross: 15
  });
  close(result.food.core_median_output_gj, 6.4775);
  close(result.food.backup_median_output_gj, 6.4775);
  close(result.food.mathematical_food_area_at_median_ha, 4.7665125 / 25.91);
});

test('half-hectare historical biomass output remains gross until efficiency is applied', () => {
  const result = calculateHectareBudget({
    foodDemandGJ: 4.7665125,
    medianCropGJPerHa: 25.91,
    cropQ1GJPerHa: 20.26,
    cropQ3GJPerHa: 29.59,
    heaterEfficiency: 0.65,
    historicalWoodGross: 15
  });
  close(result.thermal.coppice_gross_gj, 15);
  close(result.thermal.coppice_useful_heat_gj, 9.75);
});

test('heating efficiency converts useful demand to gross wood energy', () => {
  const result = calculateHeating({masonry_heater_seasonal_efficiency: 0.75});
  close(result.wood.gross_wood_energy_required_gj, result.heat_loss.annual_useful_space_heating_gj / 0.75);
  close(result.wood.historical_half_ha_useful_heat_gj, 15 * 0.75);
});

test('historical hectare allocation sums to one hectare', () => {
  const result = calculateHectareBudget({
    foodDemandGJ: 4.7665125,
    medianCropGJPerHa: 25.91,
    cropQ1GJPerHa: 20.26,
    cropQ3GJPerHa: 29.59
  });
  close(result.allocation.core_food_ha + result.allocation.backup_perennial_food_ha + result.allocation.coppice_ha, 1);
  close(result.allocation.total_ha, 1);
});

test('farm-size relative output is share divided by land share', () => {
  const rows = readCsv('data/source/farm-size-yield.csv');
  const five = rows.find(row => row.farm_size_class === '<= 5');
  close(Number(five.crop_share_percent) / Number(five.land_share_percent), 41 / 32);
  close(Number(five.food_crop_share_percent) / Number(five.land_share_percent), 46 / 32);
});

test('crop distribution statistics are reproducible from normalized source data', () => {
  const rows = readCsv('data/source/crops.csv').map(row => Number(row.gj_per_ha)).filter(Number.isFinite);
  const result = stats(rows);
  assert.equal(result.count, 15);
  close(result.min, 13.02);
  close(result.median, 25.91);
  close(result.max, 60.3);
});

test('Health Canada adult EER equation is parameterized by current profile inputs', () => {
  const result = calculateHealthCanadaEER({age_y: 35, sex: 'female', weight_kg: 65, height_cm: 165, activity: 'low'});
  close(result.kcal_day, 2208.52, 0.001);
  close(result.mj_day, result.kcal_day * 4.184 / 1000, 1e-5);
  close(result.gj_year, result.mj_day * 365.25 / 1000, 1e-5);
});

test('Health Canada child EER is lower than a full adult in the representative scenario', () => {
  const child = calculateHealthCanadaEER({age_y: 8, sex: 'female', weight_kg: 28, height_cm: 130, activity: 'low'});
  const adult = calculateHealthCanadaEER({age_y: 35, sex: 'female', weight_kg: 65, height_cm: 165, activity: 'low'});
  assert.ok(child.gj_year < adult.gj_year);
});

test('evidence food calculation converts edible yield and CNF energy to GJ/ha', () => {
  const food = calculateFoodEvidence();
  const potato = food.rows.find(row => row.id === 'potato_low_input_synthesis');
  close(potato.food_gj_ha, 16.4645 * 0.9 * 288 * 0.01, 1e-6);
  close(potato.protein_kg_ha, 16.4645 * 0.9 * 1.68 * 10, 1e-6);
});

test('audited heating efficiency converts useful demand to gross wood energy', () => {
  const result = calculateEvidenceHeating({heater_efficiency: .75});
  close(result.wood.gross_wood_energy_required_gj, result.heat_loss.annual_useful_space_heating_gj / .75, 1e-5);
  close(result.wood.approximate_dry_wood_tonnes, result.wood.gross_wood_energy_required_gj / 19, 1e-5);
});

test('woody land is solved from ordinary dry biomass yield rather than historical 0.5 ha', () => {
  const heating = {cases: {central: calculateEvidenceHeating()}};
  const woody = calculateWoodyLand(heating);
  close(woody.cases.central.ordinary.required_woody_area_ha, heating.cases.central.wood.gross_wood_energy_required_gj / (5 * 19 * .85), 1e-5);
});

test('household robust allocation is an explicit sum of food, heat and allowances', () => {
  const result = buildHouseholdCapacity();
  const row = result.rows.find(item => item.site === 'ordinary_mesic' && item.household === 'one_adult');
  close(row.mathematical_minimum_area_ha, row.food_area_ha + row.heating_area_ha, 1e-9);
  close(row.robust_system_area_ha, row.mathematical_minimum_area_ha + row.resilience_allowance_total_ha, 1e-9);
});

test('household table covers requested family sizes and keeps adult-equivalent food-only', () => {
  const result = buildHouseholdCapacity();
  const requested = ['one_adult', 'adult_plus_child', 'two_adults', 'two_adults_plus_one_child', 'two_adults_plus_two_children', 'two_adults_plus_three_children'];
  for (const site of ['wetter_productive', 'ordinary_mesic', 'shallow_rocky_marginal']) {
    const rows = result.rows.filter(row => row.site === site);
    assert.deepEqual(rows.map(row => row.household), requested);
    assert.ok(rows.every(row => row.food_adult_equivalents > 0));
    assert.ok(rows.every(row => row.arc_policy_allocation_ha === (row.adult_count === 1 ? 1 : 2)));
    assert.ok(rows.every(row => row.heating_area_ha === rows[0].heating_area_ha));
  }
  assert.equal(result.adult_equivalent_scope, 'food-energy normalization only; not a total-land multiplier');
});

test('ARC examples compare adult-count allocations with robust household area', () => {
  const result = buildHouseholdCapacity();
  const favourableAdult = result.rows.find(row => row.site === 'wetter_productive' && row.household === 'one_adult');
  const ordinaryAdult = result.rows.find(row => row.site === 'ordinary_mesic' && row.household === 'one_adult');
  const marginalTwoAdults = result.rows.find(row => row.site === 'shallow_rocky_marginal' && row.household === 'two_adults');
  close(favourableAdult.land_surplus_or_deficit_ha, 1 - favourableAdult.robust_system_area_ha, 1e-6);
  assert.ok(ordinaryAdult.land_surplus_or_deficit_ha < 0);
  assert.ok(marginalTwoAdults.land_surplus_or_deficit_ha < 0);
});

test('economic target calculation is margin divided into cash target', () => {
  const row = calculateEconomicTargets([{product: 'test', unit: 'unit', price_cad: 10, variable_cost_cad: 6, source: 'test', notes: ''}], [1000])[0];
  close(row.net_margin_cad_per_unit, 4);
  close(row.required_units_by_target['1000'], 250);
});

test('annual establishment bridge area meets demand after the selected loss/reserve case', () => {
  const result = buildFoodForestTransition();
  const row = result.households.find(item => item.site === 'ordinary_mesic' && item.household === 'two_adults_plus_two_children');
  const case30 = row.annual_crop_requirements['30%'];
  close(case30.after_loss_reserve_area_ha * case30.net_yield_gj_ha_year, row.household_food_demand_gj_year, 1e-6);
});

test('perennial mature mix scales by area and has a bounded production curve', () => {
  const evidence = calculatePerennialEvidence();
  assert.ok(evidence.central_mix.mature_food_gj_ha_year > 0);
  const curve = evidence.curve_anchors.central.late_bearing_staple;
  assert.equal(curve[1], 0);
  assert.equal(curve[20], 1);
  for (const year of [2, 3, 5, 8, 10, 15]) assert.ok(curve[year] >= 0 && curve[year] <= 1);
});

test('food-forest handoff releases annual area while perennial supply rises', () => {
  const result = buildFoodForestTransition();
  const row = result.households.find(item => item.site === 'ordinary_mesic' && item.household === 'one_adult');
  const series = row.transition.progressive_handoff.rows;
  assert.deepEqual(series.map(item => item.year), transitionYears);
  assert.ok(series.at(-1).annual_area_ha < series[0].annual_area_ha);
  assert.ok(series.at(-1).perennial_food_coverage_ratio > series[0].perennial_food_coverage_ratio);
  assert.ok(series.every(item => item.released_annual_area_ha >= 0));
});

test('young-row intercropping prevents annual and perennial hectares from being double-counted', () => {
  const result = buildFoodForestTransition();
  for (const row of result.households) {
    for (const item of row.transition.progressive_handoff.rows) {
      close(item.occupied_food_production_area_ha, item.annual_area_ha + item.perennial_area_ha - item.young_forest_annual_intercrop_overlap_ha, 2e-6);
      assert.ok(item.land_double_counted_as_if_separate_ha >= 0);
      assert.ok(item.occupied_food_production_area_ha <= row.food_production_envelope_at_arc_allocation_ha + 2e-6);
    }
  }
});

test('perennial calorie thresholds are reported independently from total household coverage', () => {
  const result = buildFoodForestTransition();
  const row = result.households.find(item => item.site === 'ordinary_mesic' && item.household === 'one_adult');
  const thresholds = row.transition.progressive_handoff.thresholds;
  assert.ok(thresholds['25%'] !== null);
  assert.ok(thresholds['50%'] !== null);
  assert.ok(thresholds['75%'] !== null);
  assert.ok(thresholds['100%'] !== null);
  assert.ok(row.transition.progressive_handoff.rows.every(item => item.household_food_coverage_ratio >= 0.999));
});

test('marginal establishment deficits are exposed rather than hidden by intercropping', () => {
  const result = buildFoodForestTransition();
  const ordinaryFamily = result.households.find(item => item.site === 'ordinary_mesic' && item.household === 'two_adults_plus_two_children');
  const marginalAdultChild = result.households.find(item => item.site === 'shallow_rocky_marginal' && item.household === 'adult_plus_child');
  assert.ok(ordinaryFamily.transition.progressive_handoff.rows.every(item => !item.annual_land_limited));
  assert.ok(marginalAdultChild.transition.progressive_handoff.rows.some(item => item.annual_land_limited));
  assert.ok(marginalAdultChild.transition.progressive_handoff.rows[0].household_food_coverage_ratio < 1);
});

test('conservative and favourable perennial establishment sensitivities are explicit', () => {
  const result = buildFoodForestTransition();
  const row = result.households.find(item => item.site === 'ordinary_mesic' && item.household === 'one_adult');
  assert.ok(row.transition_sensitivity.conservative.mature_mix_gross_yield_gj_ha_year < row.perennial_mature_mix_gross_yield_gj_ha_year);
  assert.ok(row.transition_sensitivity.favourable.mature_mix_gross_yield_gj_ha_year > row.perennial_mature_mix_gross_yield_gj_ha_year);
  assert.ok(row.transition_sensitivity.conservative.transition.progressive_handoff.rows[2].perennial_usable_food_gj <= row.transition.progressive_handoff.rows[2].perennial_usable_food_gj);
});

test('ageing-in-place keeps a smaller annual reserve and separates establishment labour', () => {
  const result = buildFoodForestTransition();
  const row = result.ageing_in_place.rows.find(item => item.site === 'ordinary_mesic' && item.household === 'one_adult');
  assert.ok(row.checkpoints['1'].total_labour_hours_including_establishment > row.checkpoints.mature.total_recurring_labour_hours);
  assert.ok(row.checkpoints['1'].annual_crop_area_ha > row.checkpoints['5'].annual_crop_area_ha);
  assert.ok(row.checkpoints['5'].annual_crop_area_ha > row.checkpoints.mature.annual_crop_area_ha);
  close(row.checkpoints.mature.perennial_food_energy_percent, 75, 1e-9);
  close(row.checkpoints.mature.food_energy_without_annual_soil_preparation_percent, 75, 1e-9);
  close(row.annual_crop_area_reduction_from_year_1_to_maturity_percent, 75, 0.2);
});

test('labour source exposes annual preparation and perennial recurring classes', () => {
  const result = calculateFoodSystemLabour();
  assert.ok(result.rows.some(row => row.id === 'annual_staple_low_input' && row.annual_soil_preparation === 'high'));
  assert.ok(result.rows.some(row => row.id === 'long_staple_tree' && row.annual_soil_preparation === 'low'));
  assert.ok(Number(result.rows.find(row => row.id === 'long_staple_tree').mature_recurring_hours_per_ha) < Number(result.rows.find(row => row.id === 'annual_staple_low_input').mature_recurring_hours_per_ha));
});

test('optional livestock modules account for feed and maintain land separation', () => {
  const result = buildFoodForestTransition();
  const rows = result.livestock.scenarios.filter(row => row.site === 'ordinary_mesic' && row.household === 'one_adult');
  assert.deepEqual(rows.map(row => row.module), ['plants_only', 'small_egg_flock', 'rabbits', 'combined_livestock', 'on_site_feed_constrained_livestock']);
  for (const row of rows) {
    close(row.human_food_energy.total_gj_year, row.household_food_demand_gj_year, 1e-6);
    close(row.feed.dry_matter_requirement_kg_year, row.feed.on_property_dry_matter_kg_year + row.feed.purchased_dry_matter_kg_year, 1e-6);
    close(row.land.total_food_feed_heat_area_ha, row.land.human_food_area_ha + row.land.livestock_feed_area_ha + row.land.woody_heating_area_ha, 1e-6);
    assert.ok(row.nutritional_output.protein_coverage_percent > 0);
    assert.ok(row.ageing_in_place.food_energy_without_annual_soil_preparation_percent >= row.human_food_energy.source_percent.perennial_plants);
  }
  assert.equal(rows[0].human_food_energy.livestock_gj_year, 0);
  assert.ok(rows[1].feed.purchased_dry_matter_kg_year > 0);
  assert.ok(rows[3].labour.total_recurring_labour_hours > rows[0].labour.total_recurring_labour_hours);
  const constrained = rows[4];
  assert.equal(constrained.feed.purchased_dry_matter_kg_year, 0);
  assert.ok(constrained.animals.every(animal => animal.scale < 1));
  assert.ok(constrained.land.livestock_feed_area_ha <= .1 + 1e-9);
});

test('protein g/day and percentage coverage use distinct audited units and denominators', () => {
  const result = buildFoodForestTransition();
  const row = result.households.find(item => item.site === 'ordinary_mesic' && item.household === 'one_adult');
  const full = row.protein_audit.full_perennial_calorie_case;
  const comparison = row.protein_audit.mature_75_25_comparison_case;
  close(full.protein_g_day, full.protein_kg_year * 1000 / 365.25, .001);
  close(full.coverage_percent, full.protein_g_day / full.target_g_day * 100, .001);
  close(comparison.protein_g_day, comparison.protein_kg_year * 1000 / 365.25, .001);
  close(comparison.coverage_percent, comparison.protein_g_day / row.protein_audit.target_g_day * 100, .001);
  close(full.protein_g_day, 41.676, .001);
  close(full.coverage_percent, 80.146, .01);
  assert.ok(comparison.protein_g_day > 50);
  assert.ok(comparison.coverage_percent > 100);
  assert.notEqual(full.protein_g_day, full.coverage_percent);
  assert.match(result.protein_audit.discrepancy, /field-name bug/);
});

test('mature food-system canonical share is solved from labour, nutrition and resilience constraints', () => {
  const result = buildFoodForestTransition();
  const mature = result.mature_food_system;
  assert.equal(mature.canonical_rows.length, 24);
  assert.deepEqual(mature.tested_perennial_shares, [.5, .6, .7, .75, .8]);
  for (const row of mature.canonical_rows) {
    close(row.perennial_share_requested, .7, 1e-9);
    assert.ok(row.protein_coverage_percent >= 100);
    assert.ok(row.annual_food_resilience_share_percent >= 20);
    assert.ok(row.recurring_labour.physically_demanding_annual_reduction_percent >= 70);
  }
  const ordinaryAdultMax = mature.max_share_summary.find(row => row.site === 'ordinary_mesic' && row.household === 'one_adult');
  close(ordinaryAdultMax.biological_max_share, .774, .001);
  assert.equal(ordinaryAdultMax.max_share_within_arc_allocation, null);
  const family = mature.canonical_rows.find(row => row.site === 'ordinary_mesic' && row.household === 'two_adults_plus_two_children');
  close(family.mature_annual_area_ha + family.mature_perennial_area_ha + family.heating_area_ha, 1.863, .01);
  assert.ok(family.total_robust_productive_area_ha > family.previous_robust_system_area_ha);
  const marginalFamily = mature.canonical_rows.find(row => row.site === 'shallow_rocky_marginal' && row.household === 'two_adults_plus_two_children');
  const marginalLargerFamily = mature.canonical_rows.find(row => row.site === 'shallow_rocky_marginal' && row.household === 'two_adults_plus_three_children');
  assert.ok(marginalLargerFamily.recurring_labour.total_recurring_labour_hours > marginalFamily.recurring_labour.total_recurring_labour_hours);
  assert.ok(marginalFamily.recurring_labour.annual_soil_preparation_hours > 0);
  assert.ok(marginalFamily.recurring_labour.annual_planting_hours > 0);
  assert.ok(marginalFamily.recurring_labour.annual_weeding_hours > 0);
  assert.ok(marginalFamily.recurring_labour.perennial_pruning_maintenance_hours > 0);
  assert.ok(marginalFamily.recurring_labour.perennial_harvest_hours > 0);
});
