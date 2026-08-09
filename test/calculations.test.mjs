import test from 'node:test';
import assert from 'node:assert/strict';

import {calculateHumanEnergy} from '../scripts/calc-human-energy.mjs';
import {calculateHectareBudget} from '../scripts/calc-hectare-budget.mjs';
import {calculateHeating} from '../scripts/calc-heating.mjs';
import {readCsv, stats} from '../scripts/model-utils.mjs';

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
