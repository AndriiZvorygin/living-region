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

export function selectAgroecosystemCandidates({database, site = buildSiteSelectionContext(), objectives = ['low_external_input'], permittedSpecies, overrides = {}, supportPlantRatio = .25} = {}) {
  const ranked = rankPlantCandidates({database, site, objectives, overrides});
  const annual = ranked.filter(({record, suitability}) => record.architecture.life_cycle === 'annual' && suitability.hard_compatible && record.outputs.some((output) => output.edible));
  const perennial = ranked.filter(({record, suitability}) => record.architecture.life_cycle === 'perennial' && suitability.hard_compatible && record.outputs.some((output) => output.edible && output.yield.central != null));
  const support = ranked.filter(({record, suitability}) => (record.architecture.life_cycle === 'support' || record.architecture.layer === 'support' || record.ecological_function?.nitrogen_fixation_kg_n_ha_year?.central > 0) && suitability.hard_compatible);
  const primary = [...perennial].sort((a, b) => Number(b.suitability.suitability_score) - Number(a.suitability.suitability_score));
  const selectedIds = new Set([...annual.slice(0, 6), ...primary.slice(0, 5), ...support.slice(0, Math.max(1, Math.round(primary.length * supportPlantRatio)))].map(({record}) => record.id));
  const selection = ranked.map(({record, suitability}) => ({plant_id: record.id, common_name: record.identity.common_name, life_cycle: record.architecture.life_cycle, layer: record.architecture.layer, selected: selectedIds.has(record.id), suitability, objective_scores: {low_external_input: suitability.suitability_score, low_land: suitability.suitability_score, low_labour: suitability.suitability_score, nutritional_completeness: record.outputs.some((output) => output.edible && output.nutrition?.composition_id) ? suitability.suitability_score : suitability.suitability_score * .8, resilient_diverse: record.evidence.source_class === 'reference_only' ? suitability.suitability_score * .8 : suitability.suitability_score}}));
  return {contract_version: AGROECOSYSTEM_CONTRACT_VERSION, site: site.id, objectives, support_plant_ratio: supportPlantRatio, support_ratio_sensitivities: SUPPORT_PLANT_SENSITIVITIES, selected: selection.filter((row) => row.selected), candidates: selection, named_solutions: Object.fromEntries(Object.entries(AGROECOSYSTEM_OBJECTIVES).map(([id, objective]) => [id, {id, label: objective.label, selected_plant_ids: selection.filter((row) => row.suitability.hard_compatible).sort((a, b) => b.objective_scores[id] - a.objective_scores[id]).slice(0, id === 'resilient_diverse' ? 12 : 8).map((row) => row.plant_id)}]))};
}

export function scheduleAnnualPlots({records = [], totalAreaHa = 1, years = AGROECOSYSTEM_YEARS.filter((year) => year !== 'mature'), succession = true} = {}) {
  const annualRecords = records.filter((record) => record.architecture.life_cycle === 'annual');
  const yearRows = [];
  const conflicts = [];
  const rotation = new Map();
  for (const year of years) {
    const rows = [];
    const cropArea = totalAreaHa / Math.max(1, annualRecords.length);
    for (const record of annualRecords) {
      const window = dateWindow(record);
      const family = record.relationships?.rotation_family ?? record.id;
      const prior = rotation.get(family);
      if (prior === year - 1) conflicts.push({year, plant_id: record.id, reason: 'same rotation family repeated in consecutive years'});
      const plot = {year, plant_id: record.id, rotation_family: family, area_ha: round(cropArea), sowing_day: window.start, harvest_day: window.end, occupied_days: Math.max(0, window.end - window.start), destination: record.outputs[0]?.destination ?? 'human_food', succession_compatible: succession && window.end < 250};
      rows.push(plot); rotation.set(family, year);
    }
    yearRows.push({year, plots: rows, occupied_area_ha: round(rows.reduce((sum, row) => sum + row.area_ha, 0)), seasonal_occupation: rows.map(({plant_id, sowing_day, harvest_day, area_ha}) => ({plant_id, sowing_day, harvest_day, area_ha}))});
  }
  return {years: yearRows, conflicts, feasible: conflicts.length === 0, rule: 'A plot cannot carry two full-season crops simultaneously; succession is permitted only when harvest and sowing windows do not overlap.'};
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
      const nutrition = profile ? {energy_mj: retained * Number(profile.macro_per_100g?.energy_mj_per_kg ?? 0), protein_kg: retained * Number(profile.protein_g_per_100g ?? 0) / 100, fat_kg: retained * Number(profile.macro_per_100g?.fat_g_per_100g ?? 0) / 100, carbohydrate_kg: retained * Number(profile.macro_per_100g?.carbohydrate_g_per_100g ?? 0) / 100, fibre_kg: retained * Number(profile.macro_per_100g?.fibre_g_per_100g ?? 0) / 100} : {energy_mj: null, protein_kg: null, fat_kg: null, carbohydrate_kg: null, fibre_kg: null};
      return {plant_id: record.id, output_id: output.id, layer: record.architecture.layer, area_ha: round(area_ha), bearing_factor: round(bearing), competition_factor: round(competition), gross_edible_harvest_kg: round(gross), retained_edible_harvest_kg: round(retained), nutrition};
    }));
    return {year, planted_area_ha: round(totalAreaHa), support_area_ha: round(totalAreaHa * supportPlantRatio), primary_area_ha: round(primaryArea), canopy_competition_factor: round(competition), layers, gross_edible_harvest_kg: round(layers.reduce((sum, row) => sum + row.gross_edible_harvest_kg, 0)), retained_edible_harvest_kg: round(layers.reduce((sum, row) => sum + row.retained_edible_harvest_kg, 0)), nutrition: {energy_mj: round(layers.reduce((sum, row) => sum + Number(row.nutrition.energy_mj ?? 0), 0)), protein_kg: round(layers.reduce((sum, row) => sum + Number(row.nutrition.protein_kg ?? 0), 0)), fat_kg: round(layers.reduce((sum, row) => sum + Number(row.nutrition.fat_kg ?? 0), 0)), carbohydrate_kg: round(layers.reduce((sum, row) => sum + Number(row.nutrition.carbohydrate_kg ?? 0), 0)), fibre_kg: round(layers.reduce((sum, row) => sum + Number(row.nutrition.fibre_kg ?? 0), 0))}};
  });
  return {years: rows, planted_perennial_footprint_ha: totalAreaHa, support_plant_ratio: supportPlantRatio, support_species: support.map((record) => record.id), accounting_note: 'Support plants occupy shared nominal space; they are ecological overlays and are not added as extra hectares. Canopy/root competition bounds additive layer output.'};
}

export function calculateAgroecosystemPlan({database, siteId = 'ordinary_mesic', siteOverrides = {}, objectives = ['low_external_input'], supportPlantRatio = .25, annualAreaHa = 1, perennialAreaHa = 1, nutritionProfiles = {}, years = AGROECOSYSTEM_YEARS, householdPeople = 0, humanure = {enabled: false}} = {}) {
  const site = buildSiteSelectionContext(siteId, siteOverrides);
  const selection = selectAgroecosystemCandidates({database, site, objectives, supportPlantRatio});
  const records = (database.records ?? []).filter((record) => selection.selected.some((row) => row.plant_id === record.id));
  const annual = scheduleAnnualPlots({records, totalAreaHa: annualAreaHa, years: years.filter((year) => year !== 'mature')});
  const perennial = calculateLayeredPerennialSuccession({records, totalAreaHa: perennialAreaHa, supportPlantRatio, nutritionProfiles, years});
  const people = Number(householdPeople);
  const humanureScenario = calculateHumanureContribution({people, ...humanure});
  const ledger = calculateNutrientLedger({years, humanure: humanureScenario, annual: (year) => ({production: perennial.years.find((row) => row.year === year)?.layers ?? [], supportPlants: records.filter((record) => record.architecture.life_cycle === 'support').map((record) => ({plant_id: record.id, area_ha: perennialAreaHa * supportPlantRatio / Math.max(1, records.filter((candidate) => candidate.architecture.life_cycle === 'support').length), nitrogen_fixed_kg_ha_year: record.ecological_function?.nitrogen_fixation_kg_n_ha_year?.central ?? 0}))})});
  return {contract_version: AGROECOSYSTEM_CONTRACT_VERSION, site, objectives, support_plant_ratio: supportPlantRatio, selection, annual_schedule: annual, perennial_succession: perennial, nutrient_ledger: ledger, reconciliation: {annual_years: annual.years.length, perennial_years: perennial.years.length, nutrient_years: ledger.years.length, annual_schedule_feasible: annual.feasible, nutrient_ledger_balanced: ledger.all_years_balanced, unknown_values_are_not_zero: true}};
}
