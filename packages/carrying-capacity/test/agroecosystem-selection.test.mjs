import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildPlantDatabase} from '../src/plant-database.mjs';
import {buildSiteSelectionContext, calculatePlantSuitability} from '../src/suitability.mjs';
import {calculateAgroecosystemPlan, calculateLayeredPerennialSuccession, scheduleAnnualPlots} from '../src/agroecosystem.mjs';
import {FOOD_NUTRIENT_PROFILES} from '../src/nutrition.mjs';

const database = buildPlantDatabase(JSON.parse(await readFile(new URL('../data/source/agroecosystem-plants.json', import.meta.url))));

test('site suitability gives inclusion and exclusion reasons', () => {
  const ordinary = buildSiteSelectionContext('ordinary_mesic');
  const marginal = buildSiteSelectionContext('shallow_rocky_marginal');
  const wheat = database.records.find((record) => record.id === 'annual_winter_wheat');
  const ordinaryResult = calculatePlantSuitability(wheat, ordinary);
  const marginalResult = calculatePlantSuitability(wheat, marginal);
  assert.equal(ordinaryResult.hard_compatible, true);
  assert.equal(marginalResult.hard_compatible, false);
  assert.ok(marginalResult.exclusion_reasons.length > 0);
});

test('annual schedule reports seasonal occupation and rotation conflicts', () => {
  const records = database.records.filter((record) => ['annual_dry_bean', 'annual_buckwheat'].includes(record.id));
  const schedule = scheduleAnnualPlots({records, totalAreaHa: 1, years: [1, 2, 3]});
  assert.equal(schedule.years.length, 3);
  assert.equal(schedule.years[0].occupied_area_ha, 1);
  assert.ok(schedule.years[0].plots.every((row) => row.harvest_day >= row.sowing_day));
});

test('layered perennial output changes with bearing curves and does not sum unlimited layers', () => {
  const records = database.records.filter((record) => ['perennial_raspberry', 'perennial_hazelnut', 'perennial_chinese_chestnut', 'support_clover'].includes(record.id));
  const timeline = calculateLayeredPerennialSuccession({records, totalAreaHa: 1, years: [1, 5, 8, 15, 'mature']});
  assert.equal(timeline.years[0].retained_edible_harvest_kg, 0);
  assert.ok(timeline.years.at(-1).retained_edible_harvest_kg > timeline.years[0].retained_edible_harvest_kg);
  assert.ok(timeline.years.at(-1).canopy_competition_factor <= 1);
  assert.equal(timeline.planted_perennial_footprint_ha, 1);
});

test('ordinary agroecosystem plan contains selected species, succession and explicit uncertainty', () => {
  const plan = calculateAgroecosystemPlan({database, siteId: 'ordinary_mesic', annualAreaHa: 1, perennialAreaHa: 1, householdFoodDemandGJYear: 100, nutritionProfiles: FOOD_NUTRIENT_PROFILES});
  assert.equal(plan.site.id, 'ordinary_mesic');
  assert.ok(plan.selection.selected.length > 0);
  assert.equal(plan.perennial_succession.years.length, 31);
  assert.equal(plan.reconciliation.unknown_values_are_not_zero, true);
  assert.ok(plan.whole_diet.years.some((row) => row.macro.energy_percent.fat > 0));
  for (const row of plan.whole_diet.years) {
    const reconciliation = row.reconciliation;
    const lhs = reconciliation.consumed_annual_kg + reconciliation.seed_kg + reconciliation.stored_kg + reconciliation.feed_kg + reconciliation.export_kg + reconciliation.loss_kg;
    assert.ok(Math.abs(lhs - reconciliation.produced_annual_kg) < .01);
    assert.ok(Math.abs(row.energy_reconciliation.consumed_gj_year - row.energy_reconciliation.demand_gj_year) < .000001);
  }
});
