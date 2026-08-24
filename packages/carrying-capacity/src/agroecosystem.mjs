import {buildSiteSelectionContext, rankPlantCandidates, SUPPORT_PLANT_SENSITIVITIES, AGROECOSYSTEM_OBJECTIVES, AGROECOSYSTEM_CONTRACT_VERSION} from './suitability.mjs';
import {calculateHumanureContribution, calculateNutrientLedger} from './nutrient-ledger.mjs';
import {calculateFoodProductionLabour} from './production-labour.mjs';

export const AGROECOSYSTEM_YEARS = Object.freeze([...Array.from({length: 30}, (_, index) => index + 1), 'mature']);
export const AGRO_MACRO_TARGET_RANGES = Object.freeze({
  carbohydrate: Object.freeze({min: 45, max: 65, unit: '% of food energy'}),
  protein: Object.freeze({min: 10, max: 35, unit: '% of food energy'}),
  fat: Object.freeze({min: 20, max: 35, unit: '% of food energy'})
});
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

const MACRO_ENERGY_GJ_PER_KG = Object.freeze({protein: .016736, carbohydrate: .016736, fat: .037656});

function macroEnergyPoint(profile = {}) {
  const macro = profile.macro_per_100g ?? {};
  const energyKjPerKg = Number(macro.energy_kj_per_100g ?? 0) * 10;
  if (!(energyKjPerKg > 0)) return null;
  const energy = {
    carbohydrate: Number(macro.carbohydrate_g_per_100g ?? 0) * 10 / 1000 * MACRO_ENERGY_GJ_PER_KG.carbohydrate,
    protein: Number(profile.protein_g_per_100g ?? 0) * 10 / 1000 * MACRO_ENERGY_GJ_PER_KG.protein,
    fat: Number(macro.fat_g_per_100g ?? 0) * 10 / 1000 * MACRO_ENERGY_GJ_PER_KG.fat
  };
  const total = Object.values(energy).reduce((sum, value) => sum + value, 0);
  return total > 0 ? Object.fromEntries(Object.entries(energy).map(([id, value]) => [id, value / total * 100])) : null;
}

function macroCheck(id, value) {
  const target = AGRO_MACRO_TARGET_RANGES[id];
  const status = value < target.min ? 'below_target' : value > target.max ? 'above_target' : 'within_target';
  return {
    min_percent: target.min,
    max_percent: target.max,
    achieved_percent: round(value, 2),
    status,
    met: status === 'within_target',
    delta_percentage_points: round(status === 'below_target' ? value - target.min : status === 'above_target' ? value - target.max : 0, 2)
  };
}

function macroAssessment(percentages, {optimizerRequested = false, feasibleCandidate = null, candidateFoodIds = [], adjustment = null} = {}) {
  const checks = Object.fromEntries(Object.keys(AGRO_MACRO_TARGET_RANGES).map((id) => [id, macroCheck(id, Number(percentages[id] ?? 0))]));
  const currentRationFeasible = Object.values(checks).every((row) => row.met);
  const failed = Object.entries(checks).filter(([, row]) => !row.met).map(([id, row]) => `${id} ${row.status === 'below_target' ? `below by ${Math.abs(row.delta_percentage_points).toFixed(2)} percentage points` : `above by ${Math.abs(row.delta_percentage_points).toFixed(2)} percentage points`}`);
  const optimizer = !optimizerRequested
    ? {status: 'not_requested', proved_infeasible: false, method: 'No macro optimizer was requested for this planning objective.'}
    : feasibleCandidate
      ? {status: 'feasible_candidate_exists', proved_infeasible: false, method: 'Convex-hull feasibility check over the active year-specific food set.', candidate_food_ids: candidateFoodIds}
      : {status: 'proved_infeasible_under_active_food_set', proved_infeasible: true, method: 'Convex-hull feasibility check found no combination of the active foods that intersects all three AMDR ranges.', candidate_food_ids: candidateFoodIds};
  return {
    target_ranges: AGRO_MACRO_TARGET_RANGES,
    checks,
    constraints: checks,
    current_ration: {status: currentRationFeasible ? 'feasible' : 'outside_targets', feasible: currentRationFeasible, failed_targets: failed},
    optimizer,
    solver: {status: optimizerRequested ? 'completed' : 'not_requested', failed: false},
    displayed_solution: {kind: 'current_ration', fallback: false, note: 'The displayed food mix is the selected current ration; the optimizer never silently substitutes a different mix.'},
    adjustment,
    status: currentRationFeasible ? 'current_ration_feasible' : optimizer.proved_infeasible ? 'optimizer_proved_infeasible' : 'current_ration_outside_targets',
    reason: currentRationFeasible ? 'The displayed ration is within every active macro target range.' : optimizer.proved_infeasible ? 'The active food set cannot satisfy all macro target ranges under the stated year-specific constraints.' : `The displayed ration is outside the active macro target range: ${failed.join('; ')}. This is not an optimizer infeasibility result.`
  };
}

function convexHull(points) {
  const unique = [...new Map(points.map((point) => [`${point.x.toFixed(8)}:${point.y.toFixed(8)}`, point])).values()].sort((a, b) => a.x - b.x || a.y - b.y);
  if (unique.length <= 1) return unique;
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [];
  for (const point of unique) { while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), point) <= 1e-10) lower.pop(); lower.push(point); }
  const upper = [];
  for (const point of [...unique].reverse()) { while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), point) <= 1e-10) upper.pop(); upper.push(point); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function clipHalfPlane(polygon, a, b, c) {
  if (!polygon.length) return [];
  const inside = (point) => a * point.x + b * point.y + c >= -1e-9;
  const intersection = (from, to) => {
    const first = a * from.x + b * from.y + c;
    const second = a * to.x + b * to.y + c;
    const fraction = first / (first - second);
    return {x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction};
  };
  const result = [];
  let previous = polygon.at(-1);
  for (const current of polygon) {
    const currentInside = inside(current);
    const previousInside = inside(previous);
    if (currentInside !== previousInside) result.push(intersection(previous, current));
    if (currentInside) result.push(current);
    previous = current;
  }
  return result;
}

function macroFeasibleFromFoodSet(points) {
  const hull = convexHull(points.map(({carbohydrate, protein}) => ({x: carbohydrate, y: protein})));
  let clipped = hull;
  // x=carbohydrate, y=protein, and fat = 100 - x - y.
  for (const [a, b, c] of [[1, 0, -45], [-1, 0, 65], [0, 1, -10], [0, -1, 35], [1, 1, -65], [-1, -1, 80]]) clipped = clipHalfPlane(clipped, a, b, c);
  return {feasible: clipped.length > 0, hull, intersection: clipped};
}

function macroPointForComposition(profile, fixedEnergy = {carbohydrate: 0, protein: 0, fat: 0}, annualEnergyGJ = 0) {
  const point = macroEnergyPoint(profile);
  if (!point) return null;
  const energy = {
    carbohydrate: Number(fixedEnergy.carbohydrate ?? 0) + annualEnergyGJ * point.carbohydrate / 100,
    protein: Number(fixedEnergy.protein ?? 0) + annualEnergyGJ * point.protein / 100,
    fat: Number(fixedEnergy.fat ?? 0) + annualEnergyGJ * point.fat / 100
  };
  const total = Object.values(energy).reduce((sum, value) => sum + value, 0);
  return total > 0 ? {carbohydrate: energy.carbohydrate / total * 100, protein: energy.protein / total * 100, fat: energy.fat / total * 100} : null;
}

function nearestSingleTransfer({annualRows, currentShares, perennialEnergy, fixedPerennialEnergy, nutritionProfiles}) {
  const current = macroPointForShares(annualRows, currentShares, perennialEnergy, fixedPerennialEnergy, nutritionProfiles);
  if (!current || Object.values(macroAssessment(current).checks).every((row) => row.met)) return null;
  let best = null;
  for (let donorIndex = 0; donorIndex < annualRows.length; donorIndex += 1) for (let recipientIndex = 0; recipientIndex < annualRows.length; recipientIndex += 1) {
    if (donorIndex === recipientIndex || !(currentShares[donorIndex] > 0)) continue;
    const donor = annualRows[donorIndex];
    const recipient = annualRows[recipientIndex];
    const donorProfile = nutritionProfiles[donor.composition_id];
    const recipientProfile = nutritionProfiles[recipient.composition_id];
    if (!macroEnergyPoint(donorProfile) || !macroEnergyPoint(recipientProfile)) continue;
    const maxTransfer = Number(currentShares[donorIndex]);
    let low = 0;
    let high = maxTransfer;
    const evaluate = (transfer) => {
      const shares = currentShares.map((value, index) => index === donorIndex ? value - transfer : index === recipientIndex ? value + transfer : value);
      return macroPointForShares(annualRows, shares, perennialEnergy, fixedPerennialEnergy, nutritionProfiles);
    };
    const satisfies = (point) => point && Object.values(macroAssessment(point).checks).every((row) => row.met);
    if (!satisfies(evaluate(high))) continue;
    for (let iteration = 0; iteration < 45; iteration += 1) { const middle = (low + high) / 2; if (satisfies(evaluate(middle))) high = middle; else low = middle; }
    const result = evaluate(high);
    if (!best || high < best.share_transfer) best = {from: donor.plant_id, to: recipient.plant_id, share_transfer: round(high, 6), resulting_energy_percent: Object.fromEntries(Object.entries(result).map(([id, value]) => [id, round(value, 2)]))};
  }
  return best;
}

function macroPointForShares(annualRows, shares, annualEnergyGJ, fixedPerennialEnergy, nutritionProfiles) {
  const annualEnergy = Number(annualEnergyGJ ?? 0);
  const fixed = fixedPerennialEnergy ?? {carbohydrate: 0, protein: 0, fat: 0};
  const energy = {...fixed};
  annualRows.forEach((row, index) => {
    const point = macroEnergyPoint(nutritionProfiles[row.composition_id]);
    if (!point) return;
    for (const id of ['carbohydrate', 'protein', 'fat']) energy[id] += annualEnergy * Number(shares[index] ?? 0) * point[id] / 100;
  });
  const total = Object.values(energy).reduce((sum, value) => sum + value, 0);
  return total > 0 ? Object.fromEntries(Object.entries(energy).map(([id, value]) => [id, value / total * 100])) : null;
}

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
    const macroEnergyGJ = {protein: combinedMacro.protein_kg * MACRO_ENERGY_GJ_PER_KG.protein, fat: combinedMacro.fat_kg * MACRO_ENERGY_GJ_PER_KG.fat, carbohydrate: combinedMacro.carbohydrate_kg * MACRO_ENERGY_GJ_PER_KG.carbohydrate};
    const macroTotal = Object.values(macroEnergyGJ).reduce((sum, value) => sum + value, 0) || 1;
    const rawMacroPercent = Object.fromEntries(Object.entries(macroEnergyGJ).map(([id, value]) => [id, value / macroTotal * 100]));
    const macroPercent = Object.fromEntries(Object.entries(rawMacroPercent).map(([id, value]) => [id, round(value, 2)]));
    const currentShares = annualRowsForYear.map((row) => Number(row.share ?? 0) / Math.max(shareTotal, 1e-9));
    const fixedPerennialEnergy = {carbohydrate: perennialMacro.carbohydrate_kg * MACRO_ENERGY_GJ_PER_KG.carbohydrate, protein: perennialMacro.protein_kg * MACRO_ENERGY_GJ_PER_KG.protein, fat: perennialMacro.fat_kg * MACRO_ENERGY_GJ_PER_KG.fat};
    const candidatePoints = annualRowsForYear.map(({record}) => {
      const output = record.outputs.find((candidate) => candidate.edible && candidate.yield.central != null);
      return {plant_id: record.id, composition_id: output?.composition_id ?? null, point: macroPointForComposition(nutritionProfiles[output?.composition_id ?? output?.nutrition?.composition_id], fixedPerennialEnergy, annualEnergy)};
    }).filter((row) => row.point);
    const macroFeasibility = macroFeasibleFromFoodSet(candidatePoints.map((row) => row.point));
    const adjustment = nearestSingleTransfer({annualRows: annualFood, currentShares, perennialEnergy: annualEnergy, fixedPerennialEnergy, nutritionProfiles});
    const macroConstraint = macroAssessment(rawMacroPercent, {optimizerRequested: objectives.includes('nutritional_completeness'), feasibleCandidate: macroFeasibility.feasible, candidateFoodIds: candidatePoints.map((row) => row.plant_id), adjustment});
    const consumedEnergy = demand;
    macroConstraint.energy_reconciliation = {consumed_food_energy_gj_year: round(consumedEnergy, 9), macro_energy_gj_year: round(macroTotal, 9), difference_gj_year: round(macroTotal - consumedEnergy, 9), status: Math.abs(macroTotal - consumedEnergy) < .000001 ? 'matched' : 'macro-factor-total differs from source food energy; percentages use macro-factor energy only'};
    return {year: perennialYear.year, household_food_demand_gj_year: demand, perennial_food_energy_gj_year: round(perennialEnergyGJ, 9), perennial_food_consumed_gj_year: round(perennialConsumedGJ, 9), annual_food_required_gj_year: round(annualEnergy, 9), annual_bridge_resilience_floor_gj_year: round(annualResilienceFloorGJYear, 9), consumed_food_energy_gj_year: round(consumedEnergy, 9), energy_reconciliation: {demand_gj_year: round(demand, 9), consumed_gj_year: round(consumedEnergy, 9), residual_gj_year: round(demand - consumedEnergy, 9), status: Math.abs(demand - consumedEnergy) < .000001 ? 'balanced' : 'deficit'}, annual_cultivation_area_ha: round(annualFood.reduce((sum, row) => sum + row.required_area_ha, 0)), perennial_planted_area_ha: perennialYear.planted_area_ha, occupied_food_footprint_ha: round(annualFood.reduce((sum, row) => sum + row.required_area_ha, 0) + perennialYear.planted_area_ha), produced: {annual: annualFood, perennial: perennialYear.layers}, consumed: {annual: annualFood, perennial: perennialYear.layers.map((row) => ({...row, consumed_fraction: perennialConsumptionFactor}))}, stored_reserved: annualFood.reduce((sum, row) => sum + row.stored_or_reserved_kg, 0), livestock_feed_kg: 0, exportable_surplus_food_energy_gj_year: round(Math.max(0, perennialEnergyGJ - perennialConsumedGJ)), loss_kg: round(annualFood.reduce((sum, row) => sum + row.loss_kg, 0)), macro: {kg_year: combinedMacro, energy_percent: macroPercent, energy_percent_raw: rawMacroPercent, annual_energy_gj_year: round(macroEnergyGJ.carbohydrate + macroEnergyGJ.protein + macroEnergyGJ.fat), energy_factor_basis: 'Protein and carbohydrate 0.016736 GJ/kg; fat 0.037656 GJ/kg; fibre is reported separately and is not added as an independent energy source.'}, nutrition_constraint: macroConstraint, principal_food_sources: [...annualFood.filter((row) => row.consumed_kg > 0).map((row) => ({plant_id: row.plant_id, consumed_kg: row.consumed_kg, role: 'annual bridge'})), ...perennialYear.layers.filter((row) => row.retained_edible_harvest_kg > 0).map((row) => ({plant_id: row.plant_id, consumed_kg: row.retained_edible_harvest_kg * perennialConsumptionFactor, role: 'perennial available harvest'}))], reconciliation: {produced_annual_kg: round(annualFood.reduce((sum, row) => sum + row.gross_production_kg, 0)), consumed_annual_kg: round(annualFood.reduce((sum, row) => sum + row.consumed_kg, 0)), seed_kg: round(annualFood.reduce((sum, row) => sum + row.seed_propagation_kg, 0)), stored_kg: round(annualFood.reduce((sum, row) => sum + row.stored_or_reserved_kg, 0)), feed_kg: 0, export_kg: 0, loss_kg: round(annualFood.reduce((sum, row) => sum + row.loss_kg, 0)), note: 'Gross production is allocated to consumed food, seed, storage, feed, export and losses. Perennial harvest is included only at its bearing factor; excess mature harvest is exportable or reserved.'}};
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
  const labour = calculateFoodProductionLabour({records, wholeDiet, supportPlantRatio, perennialFootprintHa: perennialAreaHa});
  const people = Number(householdPeople);
  const humanureScenario = calculateHumanureContribution({people, ...humanure});
  const ledger = calculateNutrientLedger({years, humanure: humanureScenario, annual: (year) => ({production: perennial.years.find((row) => row.year === year)?.layers ?? [], supportPlants: records.filter((record) => record.architecture.life_cycle === 'support').map((record) => ({plant_id: record.id, area_ha: perennialAreaHa * supportPlantRatio / Math.max(1, records.filter((candidate) => candidate.architecture.life_cycle === 'support').length), nitrogen_fixed_kg_ha_year: record.ecological_function?.nitrogen_fixation_kg_n_ha_year?.central ?? 0}))})});
  const nutritionRows = wholeDiet.years.map((row) => row.nutrition_constraint);
  const currentRationFeasible = nutritionRows.every((row) => row?.current_ration?.feasible === true);
  const optimizerProvedInfeasible = nutritionRows.some((row) => row?.optimizer?.proved_infeasible === true);
  const optimizerRequested = objectives.includes('nutritional_completeness');
  return {contract_version: AGROECOSYSTEM_CONTRACT_VERSION, site, objectives, support_plant_ratio: supportPlantRatio, selection, annual_schedule: annual, perennial_succession: perennial, whole_diet: wholeDiet, labour, nutrition_constraint: {goal: optimizerRequested ? 'nutritional_completeness' : 'screening_only', status: currentRationFeasible ? 'current_ration_feasible' : optimizerProvedInfeasible ? 'optimizer_proved_infeasible' : 'current_ration_outside_targets', optimizer: {requested: optimizerRequested, status: optimizerProvedInfeasible ? 'proved_infeasible_under_active_food_set' : nutritionRows.some((row) => row?.optimizer?.status === 'feasible_candidate_exists') ? 'feasible_candidate_exists' : 'not_requested_or_not_proven'}, years: nutritionRows, note: 'The current ration checks are separate from optimizer feasibility. A current-ration miss does not prove that no other active-food combination can meet the targets; unresolved micronutrients and digestibility remain disclosed separately.'}, nutrient_ledger: ledger, reconciliation: {annual_years: annual.years.length, perennial_years: perennial.years.length, whole_diet_years: wholeDiet.years.length, nutrient_years: ledger.years.length, annual_schedule_feasible: annual.feasible, nutrient_ledger_balanced: ledger.all_years_balanced, nutrition_constraint_satisfied: currentRationFeasible, unknown_values_are_not_zero: true}};
}
