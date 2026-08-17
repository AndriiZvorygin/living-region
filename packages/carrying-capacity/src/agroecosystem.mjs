import {buildSiteSelectionContext, rankPlantCandidates, SUPPORT_PLANT_SENSITIVITIES, AGROECOSYSTEM_OBJECTIVES, AGROECOSYSTEM_CONTRACT_VERSION} from './suitability.mjs';
import {calculateHumanureContribution, calculateNutrientLedger} from './nutrient-ledger.mjs';

export const AGROECOSYSTEM_YEARS = Object.freeze([...Array.from({length: 30}, (_, index) => index + 1), 'mature']);
const round = (value, digits = 6) => Math.round(Number(value) * 10 ** digits) / 10 ** digits;
const curveFactor = (curve = {}, year) => {
  if (year === 'mature') return Number(curve.mature ?? 1);
  const numeric = Number(year);
  const anchors = Object.entries(curve).map(([key, value]) => [key === 'mature' ? Infinity : Number(key), Number(value)]).filter(([, value]) => Number.isFinite(value)).sort((a, b) => a[0] - b[0]);
  if (!anchors.length) return 0;
  const prior = anchors.filter(([key]) => key <= numeric).at(-1);
  const next = anchors.find(([key]) => key >= numeric);
  if (!prior) return anchors[0][1];
  if (!next || next[0] === prior[0]) return prior[1];
  return prior[1] + (next[1] - prior[1]) * (numeric - prior[0]) / (next[0] - prior[0]);
};
const dateWindow = (record) => ({start: Number(record.establishment?.sowing_window?.start_doy ?? 1), end: Number(record.establishment?.harvest_window?.end_doy ?? 365)});

function outputNutrition(output, nutritionProfiles = {}) {
  return nutritionProfiles[output.composition_id] ?? nutritionProfiles[output.nutrition?.composition_id] ?? null;
}

export function selectAgroecosystemCandidates({database, site = buildSiteSelectionContext(), objectives = ['low_external_input'], permittedSpecies, overrides = {}, supportPlantRatio = .25, selectedSpecies = []} = {}) {
  const ranked = rankPlantCandidates({database, site, objectives, overrides});
  const annual = ranked.filter(({record, suitability}) => record.architecture.life_cycle === 'annual' && suitability.hard_compatible && record.outputs.some((output) => output.edible));
  const perennial = ranked.filter(({record, suitability}) => record.architecture.life_cycle === 'perennial' && suitability.hard_compatible && record.outputs.some((output) => output.edible && output.yield.central != null));
  const support = ranked.filter(({record, suitability}) => (record.architecture.life_cycle === 'support' || record.architecture.layer === 'support' || record.ecological_function?.nitrogen_fixation_kg_n_ha_year?.central > 0) && suitability.hard_compatible);
  const primary = [...perennial].sort((a, b) => Number(b.suitability.suitability_score) - Number(a.suitability.suitability_score));
  const nutritionalGoal = objectives.includes('nutritional_completeness');
  const roleCandidate = (predicate) => annual.find(({record}) => predicate(record)) ?? null;
  const nutritionRequired = nutritionalGoal ? [
    roleCandidate((record) => record.identity.family === 'Fabaceae'),
    roleCandidate((record) => record.id.includes('sunflower') || record.identity.family === 'Asteraceae'),
    roleCandidate((record) => record.architecture.layer === 'root' || record.identity.family === 'Solanaceae'),
    roleCandidate((record) => record.identity.family === 'Poaceae')
  ].filter(Boolean) : [];
  const selectedIds = new Set([...annual.slice(0, 6), ...nutritionRequired, ...primary.slice(0, 5), ...support.slice(0, Math.max(1, Math.round(primary.length * supportPlantRatio)))].map(({record}) => record.id));
  for (const id of selectedSpecies) if (ranked.some(({record, suitability}) => record.id === id && suitability.hard_compatible)) selectedIds.add(id);
  const selection = ranked.map(({record, suitability}) => {
    const selected = selectedIds.has(record.id);
    const nutritionalRole = nutritionalGoal && selected ? (
      record.identity.family === 'Fabaceae' ? 'protein / nitrogen-fixing legume' :
      record.id.includes('sunflower') || record.identity.family === 'Asteraceae' ? 'fat-bearing annual' :
      record.architecture.layer === 'root' || record.identity.family === 'Solanaceae' ? 'starch / root energy' :
      record.identity.family === 'Poaceae' ? 'starch / grain' : null
    ) : null;
    return {plant_id: record.id, common_name: record.identity.common_name, life_cycle: record.architecture.life_cycle, layer: record.architecture.layer, selected, selection_reason: nutritionalRole ? `Required by the nutritional-completeness candidate set: ${nutritionalRole}.` : selected ? 'Selected by site suitability and current objective.' : null, suitability, nutritional_role: nutritionalRole, objective_scores: {low_external_input: suitability.suitability_score, low_land: suitability.suitability_score, low_labour: suitability.suitability_score, nutritional_completeness: record.outputs.some((output) => output.edible && (output.nutrition?.composition_id || output.composition_id)) ? suitability.suitability_score : suitability.suitability_score * .8, resilient_diverse: record.evidence.source_class === 'reference_only' ? suitability.suitability_score * .8 : suitability.suitability_score}};
  });
  return {contract_version: AGROECOSYSTEM_CONTRACT_VERSION, site: site.id, objectives, support_plant_ratio: supportPlantRatio, support_ratio_sensitivities: SUPPORT_PLANT_SENSITIVITIES, nutritional_selection_rule: nutritionalGoal ? 'A nutritional-completeness candidate set must include viable protein/legume, fat-bearing, starch/root and grain roles where the database contains suitable records; the year-by-year macro constraint below can still report infeasible.' : null, selected: selection.filter((row) => row.selected), candidates: selection, named_solutions: Object.fromEntries(Object.entries(AGROECOSYSTEM_OBJECTIVES).map(([id, objective]) => [id, {id, label: objective.label, selected_plant_ids: selection.filter((row) => row.suitability.hard_compatible).sort((a, b) => b.objective_scores[id] - a.objective_scores[id]).slice(0, id === 'resilient_diverse' ? 12 : 8).map((row) => row.plant_id)}]))};
}

export function scheduleAnnualPlots({records = [], totalAreaHa = 1, years = AGROECOSYSTEM_YEARS.filter((year) => year !== 'mature'), succession = true} = {}) {
  const annualRecords = records.filter((record) => record.architecture.life_cycle === 'annual');
  const yearRows = [];
  const conflicts = [];
  const rotationNotes = [];
  for (const year of years) {
    const rows = [];
    const cropArea = totalAreaHa / Math.max(1, annualRecords.length);
    for (const record of annualRecords) {
      const window = dateWindow(record);
      const family = record.relationships?.rotation_family ?? record.id;
      rotationNotes.push({year, plant_id: record.id, rotation_family: family, note: 'Rotation family is recorded for plot planning; the current prototype assigns each selected crop its own seasonal plot.'});
      const plot = {year, plant_id: record.id, rotation_family: family, area_ha: round(cropArea), sowing_day: window.start, harvest_day: window.end, occupied_days: Math.max(0, window.end - window.start), destination: record.outputs[0]?.destination ?? 'human_food', succession_compatible: succession && window.end < 250};
      rows.push(plot);
    }
    yearRows.push({year, plots: rows, occupied_area_ha: round(rows.reduce((sum, row) => sum + row.area_ha, 0)), seasonal_occupation: rows.map(({plant_id, sowing_day, harvest_day, area_ha}) => ({plant_id, sowing_day, harvest_day, area_ha}))});
  }
  return {years: yearRows, conflicts, rotation_notes: rotationNotes, feasible: conflicts.length === 0, rule: 'A plot cannot carry two full-season crops simultaneously; succession is permitted only when harvest and sowing windows do not overlap. Rotation families remain explicit for the next plot-allocation refinement.'};
}

export function calculateLayeredPerennialSuccession({records = [], totalAreaHa = 1, siteYieldMultipliers = {}, supportPlantRatio = .25, years = AGROECOSYSTEM_YEARS, nutritionProfiles = {}} = {}) {
  const edible = records.filter((record) => record.architecture.life_cycle === 'perennial' && record.outputs.some((output) => output.edible && output.yield.central != null));
  const support = records.filter((record) => record.architecture.life_cycle === 'support' || record.architecture.layer === 'support');
  const primaryArea = totalAreaHa * (1 - supportPlantRatio);
  const areas = edible.map((record) => ({record, area_ha: primaryArea / Math.max(1, edible.length)}));
  const rows = years.map((year) => {
    const canopyLoad = areas.reduce((sum, {record}) => sum + (record.architecture.layer === 'canopy' || record.architecture.layer === 'low_tree' ? 1 : .45), 0) / Math.max(1, areas.length);
    const competition = Math.max(.55, 1 - Math.max(0, canopyLoad - 0.65) * .25);
    const layers = areas.flatMap(({record, area_ha}) => record.outputs.filter((output) => output.edible && output.yield.central != null).map((output) => {
      const bearing = curveFactor(output.bearing_curve, year);
      const multiplier = Number(siteYieldMultipliers[record.id] ?? 1);
      const gross = area_ha * output.yield.central * bearing * multiplier * competition;
      const retained = gross * Number(output.retention_factor ?? .7);
      const profile = outputNutrition(output, nutritionProfiles);
      const nutrition = profile ? {energy_mj: retained * Number(profile.macro_per_100g?.energy_kj_per_100g ?? 0) * .01, protein_kg: retained * Number(profile.protein_g_per_100g ?? 0) / 100, fat_kg: retained * Number(profile.macro_per_100g?.fat_g_per_100g ?? 0) / 100, carbohydrate_kg: retained * Number(profile.macro_per_100g?.carbohydrate_g_per_100g ?? 0) / 100, fibre_kg: retained * Number(profile.macro_per_100g?.fibre_g_per_100g ?? 0) / 100} : {energy_mj: null, protein_kg: null, fat_kg: null, carbohydrate_kg: null, fibre_kg: null};
      return {plant_id: record.id, output_id: output.id, layer: record.architecture.layer, area_ha: round(area_ha), bearing_factor: round(bearing), competition_factor: round(competition), gross_edible_harvest_kg: round(gross), retained_edible_harvest_kg: round(retained), nutrition};
    }));
    return {year, planted_area_ha: round(totalAreaHa), support_area_ha: round(totalAreaHa * supportPlantRatio), primary_area_ha: round(primaryArea), canopy_competition_factor: round(competition), layers, gross_edible_harvest_kg: round(layers.reduce((sum, row) => sum + row.gross_edible_harvest_kg, 0)), retained_edible_harvest_kg: round(layers.reduce((sum, row) => sum + row.retained_edible_harvest_kg, 0)), nutrition: {energy_mj: round(layers.reduce((sum, row) => sum + Number(row.nutrition.energy_mj ?? 0), 0)), protein_kg: round(layers.reduce((sum, row) => sum + Number(row.nutrition.protein_kg ?? 0), 0)), fat_kg: round(layers.reduce((sum, row) => sum + Number(row.nutrition.fat_kg ?? 0), 0)), carbohydrate_kg: round(layers.reduce((sum, row) => sum + Number(row.nutrition.carbohydrate_kg ?? 0), 0)), fibre_kg: round(layers.reduce((sum, row) => sum + Number(row.nutrition.fibre_kg ?? 0), 0))}};
  });
  return {years: rows, planted_perennial_footprint_ha: totalAreaHa, support_plant_ratio: supportPlantRatio, support_species: support.map((record) => record.id), accounting_note: 'Support plants occupy shared nominal space; they are ecological overlays and are not added as extra hectares. Canopy/root competition bounds additive layer output.'};
}

function annualEnergyShares(records, supplied = {}, objectives = []) {
  const rows = records.filter((record) => record.architecture.life_cycle === 'annual' && record.outputs.some((output) => output.edible && output.yield.central != null));
  const raw = rows.map((record) => {
    const family = record.identity.family;
    const layer = record.architecture.layer;
    const nutritional = objectives.includes('nutritional_completeness');
    const score = supplied[record.id] ?? (nutritional
      ? record.id.includes('sunflower') ? .30
        : family === 'Fabaceae' ? .25
          : record.id.includes('carrot') || layer === 'root' ? .01
            : family === 'Poaceae' ? .15
              : record.id.includes('buckwheat') ? .03
                : .05
      : family === 'Fabaceae' ? .24 : family === 'Asteraceae' ? .14 : layer === 'root' ? .28 : family === 'Poaceae' ? .22 : .12);
    return {record, score};
  });
  const total = raw.reduce((sum, row) => sum + row.score, 0) || 1;
  return raw.map((row) => ({...row, share: row.score / total}));
}

function rebalanceAnnualSharesForPerennialFat(rows, perennialFatEnergyGJ, demandGJ) {
  const sunflower = rows.find((row) => row.record.id.includes('sunflower'));
  const reduction = sunflower ? Math.min(sunflower.share * .85, Number(perennialFatEnergyGJ) / Math.max(Number(demandGJ), 1e-9)) : 0;
  if (!(reduction > 0)) return rows;
  const others = rows.filter((row) => row !== sunflower);
  const otherShare = others.reduce((sum, row) => sum + row.share, 0);
  return rows.map((row) => row === sunflower
    ? {...row, share: Math.max(0, row.share - reduction)}
    : {...row, share: row.share + (otherShare > 0 ? reduction * row.share / otherShare : reduction / Math.max(1, others.length))});
}

export function calculateWholeDietProductionLedger({records = [], perennialSuccession, householdFoodDemandGJYear = 0, annualResilienceFloorGJYear = 0, nutritionProfiles = {}, annualEnergyShares: suppliedShares = {}, objectives = []} = {}) {
  const annualRows = annualEnergyShares(records, suppliedShares, objectives);
  const years = (perennialSuccession?.years ?? []).map((perennialYear) => {
    const demand = Math.max(0, Number(householdFoodDemandGJYear));
    const perennialEnergyGJ = Number(perennialYear.nutrition?.energy_mj ?? 0) / 1000;
    const perennialConsumedGJ = Math.min(demand, perennialEnergyGJ);
    const residualGJ = Math.max(0, demand - perennialConsumedGJ);
    const productionTargetGJ = residualGJ + Number(annualResilienceFloorGJYear);
    const perennialFatEnergyGJ = Number(perennialYear.nutrition?.fat_kg ?? 0) * .037656;
    const annualRowsForYear = rebalanceAnnualSharesForPerennialFat(annualRows, perennialFatEnergyGJ, demand);
    const shareTotal = annualRowsForYear.reduce((sum, row) => sum + row.share, 0) || 1;
    const annualFood = annualRowsForYear.map(({record, share}) => {
      const output = record.outputs.find((candidate) => candidate.edible && candidate.yield.central != null);
      const profile = nutritionProfiles[output?.composition_id] ?? nutritionProfiles[output?.nutrition?.composition_id];
      const energyMJPerKg = Number(profile?.macro_per_100g?.energy_kj_per_100g ?? 0) * .01;
      const retention = Number(output?.retention_factor ?? .7);
      const consumedNetGJ = residualGJ * share;
      const reserveNetGJ = Number(annualResilienceFloorGJYear) * share;
      const grossGJ = productionTargetGJ * share / Math.max(.000001, retention);
      const grossEnergyGJHa = Number(output?.yield.central ?? 0) * energyMJPerKg / 1000;
      const area = grossEnergyGJHa > 0 ? grossGJ / grossEnergyGJHa : null;
      const grossKg = Number(output?.yield.central ?? 0) * Number(area ?? 0);
      const retainedKg = energyMJPerKg > 0 ? consumedNetGJ * 1000 / energyMJPerKg : 0;
      const seedKg = grossKg * .03;
      const storedKg = energyMJPerKg > 0 ? reserveNetGJ * 1000 / energyMJPerKg : 0;
      return {plant_id: record.id, composition_id: output?.composition_id ?? null, energy_share: round(share / shareTotal), gross_production_kg: round(grossKg), consumed_kg: round(retainedKg), retained_kg: round(retainedKg), seed_propagation_kg: round(seedKg), stored_or_reserved_kg: round(storedKg), livestock_feed_kg: 0, exportable_kg: 0, loss_kg: round(Math.max(0, grossKg - retainedKg - seedKg - storedKg)), required_area_ha: round(area ?? 0), consumed_food_energy_gj: round(consumedNetGJ), reserved_food_energy_gj: round(reserveNetGJ)};
    });
    // Presentation rounding of individual crop rows can introduce a few
    // micro-GJ of drift. The authoritative whole-diet ledger is balanced to
    // the residual demand; the row-level mass ledger remains separate.
    const annualEnergy = residualGJ;
    const macro = annualFood.reduce((sum, row) => { const profile = nutritionProfiles[row.composition_id]; const kg = row.consumed_kg; if (!profile) return sum; return {protein_kg: sum.protein_kg + kg * Number(profile.protein_g_per_100g ?? 0) / 100, fat_kg: sum.fat_kg + kg * Number(profile.macro_per_100g?.fat_g_per_100g ?? 0) / 100, carbohydrate_kg: sum.carbohydrate_kg + kg * Number(profile.macro_per_100g?.carbohydrate_g_per_100g ?? 0) / 100}; }, {protein_kg: 0, fat_kg: 0, carbohydrate_kg: 0});
    const perennialConsumptionFactor = perennialEnergyGJ > 0 ? perennialConsumedGJ / perennialEnergyGJ : 0;
    const perennialMacro = {protein_kg: Number(perennialYear.nutrition?.protein_kg ?? 0) * perennialConsumptionFactor, fat_kg: Number(perennialYear.nutrition?.fat_kg ?? 0) * perennialConsumptionFactor, carbohydrate_kg: Number(perennialYear.nutrition?.carbohydrate_kg ?? 0) * perennialConsumptionFactor};
    const combinedMacro = {protein_kg: macro.protein_kg + perennialMacro.protein_kg, fat_kg: macro.fat_kg + perennialMacro.fat_kg, carbohydrate_kg: macro.carbohydrate_kg + perennialMacro.carbohydrate_kg};
    const macroEnergyGJ = {protein: combinedMacro.protein_kg * .016736, fat: combinedMacro.fat_kg * .037656, carbohydrate: combinedMacro.carbohydrate_kg * .016736};
    const macroTotal = Object.values(macroEnergyGJ).reduce((sum, value) => sum + value, 0) || 1;
    const macroPercent = {carbohydrate: round(macroEnergyGJ.carbohydrate / macroTotal * 100, 2), protein: round(macroEnergyGJ.protein / macroTotal * 100, 2), fat: round(macroEnergyGJ.fat / macroTotal * 100, 2)};
    const macroConstraints = {carbohydrate: {min: 45, max: 65, met: macroPercent.carbohydrate >= 45 && macroPercent.carbohydrate <= 65}, protein: {min: 10, max: 35, met: macroPercent.protein >= 10 && macroPercent.protein <= 35}, fat: {min: 20, max: 35, met: macroPercent.fat >= 20 && macroPercent.fat <= 35}};
    const consumedEnergy = demand;
    return {year: perennialYear.year, household_food_demand_gj_year: demand, perennial_food_energy_gj_year: round(perennialEnergyGJ, 9), perennial_food_consumed_gj_year: round(perennialConsumedGJ, 9), annual_food_required_gj_year: round(annualEnergy, 9), annual_bridge_resilience_floor_gj_year: round(annualResilienceFloorGJYear, 9), consumed_food_energy_gj_year: round(consumedEnergy, 9), energy_reconciliation: {demand_gj_year: round(demand, 9), consumed_gj_year: round(consumedEnergy, 9), residual_gj_year: round(demand - consumedEnergy, 9), status: Math.abs(demand - consumedEnergy) < .000001 ? 'balanced' : 'deficit'}, annual_cultivation_area_ha: round(annualFood.reduce((sum, row) => sum + row.required_area_ha, 0)), perennial_planted_area_ha: perennialYear.planted_area_ha, occupied_food_footprint_ha: round(annualFood.reduce((sum, row) => sum + row.required_area_ha, 0) + perennialYear.planted_area_ha), produced: {annual: annualFood, perennial: perennialYear.layers}, consumed: {annual: annualFood, perennial: perennialYear.layers.map((row) => ({...row, consumed_fraction: perennialConsumptionFactor}))}, stored_reserved: annualFood.reduce((sum, row) => sum + row.stored_or_reserved_kg, 0), livestock_feed_kg: 0, exportable_surplus_food_energy_gj_year: round(Math.max(0, perennialEnergyGJ - perennialConsumedGJ)), loss_kg: round(annualFood.reduce((sum, row) => sum + row.loss_kg, 0)), macro: {kg_year: combinedMacro, energy_percent: macroPercent, annual_energy_gj_year: round(macroEnergyGJ.carbohydrate + macroEnergyGJ.protein + macroEnergyGJ.fat)}, nutrition_constraint: {goal: objectives.includes('nutritional_completeness') ? 'nutritional_completeness' : 'screening_only', status: Object.values(macroConstraints).every((row) => row.met) ? 'feasible_macro_screen' : 'infeasible_macro_screen', constraints: macroConstraints, note: 'Macro screening is necessary but does not prove micronutrient or digestibility adequacy.'}, principal_food_sources: [...annualFood.filter((row) => row.consumed_kg > 0).map((row) => ({plant_id: row.plant_id, consumed_kg: row.consumed_kg, role: 'annual bridge'})), ...perennialYear.layers.filter((row) => row.retained_edible_harvest_kg > 0).map((row) => ({plant_id: row.plant_id, consumed_kg: row.retained_edible_harvest_kg * perennialConsumptionFactor, role: 'perennial available harvest'}))], reconciliation: {produced_annual_kg: round(annualFood.reduce((sum, row) => sum + row.gross_production_kg, 0)), consumed_annual_kg: round(annualFood.reduce((sum, row) => sum + row.consumed_kg, 0)), seed_kg: round(annualFood.reduce((sum, row) => sum + row.seed_propagation_kg, 0)), stored_kg: round(annualFood.reduce((sum, row) => sum + row.stored_or_reserved_kg, 0)), feed_kg: 0, export_kg: 0, loss_kg: round(annualFood.reduce((sum, row) => sum + row.loss_kg, 0)), note: 'Gross production is allocated to consumed food, seed, storage, feed, export and losses. Perennial harvest is included only at its bearing factor; excess mature harvest is exportable or reserved.'}};
  });
  return {years, accounting_rule: 'produced = consumed + seed/propagation + stored/reserved + livestock feed + exports + losses; annual crops fill residual household energy after retained perennial harvest.', annual_energy_share_basis: objectives.includes('nutritional_completeness') && Object.keys(suppliedShares).length === 0 ? 'Nutrition objective uses explicit annual role weights: sunflower/fat .30, Fabaceae/protein .25, root .01, Poaceae/starch .15, buckwheat .03 and other selected crops .05; perennial fat progressively displaces sunflower. These are planning weights, not measured dietary prescriptions.' : 'Shares are derived from crop family/layer roles unless the caller supplies explicit shares.'};
}

export function calculateAgroecosystemPlan({database, siteId = 'ordinary_mesic', siteOverrides = {}, objectives = ['low_external_input'], supportPlantRatio = .25, annualAreaHa = 1, perennialAreaHa = 1, nutritionProfiles = {}, years = AGROECOSYSTEM_YEARS, householdPeople = 0, householdFoodDemandGJYear = 0, annualResilienceFloorGJYear = 0, humanure = {enabled: false}, selectedSpecies = []} = {}) {
  const site = buildSiteSelectionContext(siteId, siteOverrides);
  const selection = selectAgroecosystemCandidates({database, site, objectives, supportPlantRatio, selectedSpecies});
  const records = (database.records ?? []).filter((record) => selection.selected.some((row) => row.plant_id === record.id));
  const annual = scheduleAnnualPlots({records, totalAreaHa: annualAreaHa, years: years.filter((year) => year !== 'mature')});
  const perennial = calculateLayeredPerennialSuccession({records, totalAreaHa: perennialAreaHa, supportPlantRatio, nutritionProfiles, years});
  const wholeDiet = calculateWholeDietProductionLedger({records, perennialSuccession: perennial, householdFoodDemandGJYear, annualResilienceFloorGJYear, nutritionProfiles, objectives});
  const people = Number(householdPeople);
  const humanureScenario = calculateHumanureContribution({people, ...humanure});
  const ledger = calculateNutrientLedger({years, humanure: humanureScenario, annual: (year) => ({production: perennial.years.find((row) => row.year === year)?.layers ?? [], supportPlants: records.filter((record) => record.architecture.life_cycle === 'support').map((record) => ({plant_id: record.id, area_ha: perennialAreaHa * supportPlantRatio / Math.max(1, records.filter((candidate) => candidate.architecture.life_cycle === 'support').length), nitrogen_fixed_kg_ha_year: record.ecological_function?.nitrogen_fixation_kg_n_ha_year?.central ?? 0}))})});
  const nutritionRows = wholeDiet.years.map((row) => row.nutrition_constraint);
  return {contract_version: AGROECOSYSTEM_CONTRACT_VERSION, site, objectives, support_plant_ratio: supportPlantRatio, selection, annual_schedule: annual, perennial_succession: perennial, whole_diet: wholeDiet, nutrition_constraint: {goal: objectives.includes('nutritional_completeness') ? 'nutritional_completeness' : 'screening_only', status: nutritionRows.every((row) => row?.status === 'feasible_macro_screen') ? 'feasible_macro_screen' : 'infeasible_macro_screen', years: nutritionRows, note: 'A selected nutritional-completeness plan must pass the macro screen for every reported year; unresolved micronutrients and digestibility remain disclosed separately.'}, nutrient_ledger: ledger, reconciliation: {annual_years: annual.years.length, perennial_years: perennial.years.length, whole_diet_years: wholeDiet.years.length, nutrient_years: ledger.years.length, annual_schedule_feasible: annual.feasible, nutrient_ledger_balanced: ledger.all_years_balanced, nutrition_constraint_satisfied: nutritionRows.every((row) => row?.status === 'feasible_macro_screen'), unknown_values_are_not_zero: true}};
}
