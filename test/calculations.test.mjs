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

test('economic target calculation is margin divided into cash target', () => {
  const row = calculateEconomicTargets([{product: 'test', unit: 'unit', price_cad: 10, variable_cost_cad: 6, source: 'test', notes: ''}], [1000])[0];
  close(row.net_margin_cad_per_unit, 4);
  close(row.required_units_by_target['1000'], 250);
});
