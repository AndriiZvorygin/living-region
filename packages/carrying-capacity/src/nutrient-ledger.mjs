export const NUTRIENT_LEDGER_CONTRACT_VERSION = '1.0.0';
export const LEDGER_NUTRIENTS = Object.freeze(['N', 'P', 'K']);

const round = (value, digits = 6) => Math.round(Number(value) * 10 ** digits) / 10 ** digits;
const zeroNutrients = () => Object.fromEntries(LEDGER_NUTRIENTS.map((id) => [id, 0]));
const nutrientObject = (value = {}) => Object.fromEntries(LEDGER_NUTRIENTS.map((id) => [id, round(Math.max(0, Number(value[id] ?? 0)))]));
const add = (...objects) => Object.fromEntries(LEDGER_NUTRIENTS.map((id) => [id, round(objects.reduce((sum, object) => sum + Number(object?.[id] ?? 0), 0))]));
const subtract = (left, right) => Object.fromEntries(LEDGER_NUTRIENTS.map((id) => [id, round(Number(left?.[id] ?? 0) - Number(right?.[id] ?? 0))]));

export const DEFAULT_NUTRIENT_DENSITIES = Object.freeze({
  food_export_kg: {N: .018, P: .004, K: .003},
  crop_residue_kg_dm: {N: .012, P: .002, K: .012},
  livestock_manure_kg_dm: {N: .012, P: .004, K: .008}
});

export function calculateHumanureContribution({people = 0, urine_n_kg_person_year = 3.2, urine_p_kg_person_year = .25, urine_k_kg_person_year = .8, faecal_n_kg_person_year = .55, faecal_p_kg_person_year = .18, faecal_k_kg_person_year = .2, urine_recovery = .8, faecal_treatment_recovery = .4, crop_availability = {N: .7, P: .65, K: .8}, enabled = false} = {}) {
  const population = Math.max(0, Number(people));
  const rawUrine = {N: population * urine_n_kg_person_year, P: population * urine_p_kg_person_year, K: population * urine_k_kg_person_year};
  const rawFaecal = {N: population * faecal_n_kg_person_year, P: population * faecal_p_kg_person_year, K: population * faecal_k_kg_person_year};
  const recovered = enabled ? {N: rawUrine.N * urine_recovery + rawFaecal.N * faecal_treatment_recovery, P: rawUrine.P * urine_recovery + rawFaecal.P * faecal_treatment_recovery, K: rawUrine.K * urine_recovery + rawFaecal.K * faecal_treatment_recovery} : zeroNutrients();
  const available = nutrientObject(Object.fromEntries(LEDGER_NUTRIENTS.map((id) => [id, recovered[id] * Number(crop_availability[id] ?? 0)])));
  return {enabled, people: population, raw_urine: nutrientObject(rawUrine), raw_faecal_material: nutrientObject(rawFaecal), recovery_factors: {urine: urine_recovery, faecal_treatment: faecal_treatment_recovery, crop_availability}, recovered_treated: nutrientObject(recovered), crop_available: available, external_displaced: available, health_boundary: 'Only treated, approved and crop-available quantities are credited; pathogen, contaminant and local approval requirements remain site-specific.'};
}

export function calculatePlantNutrientFlows({production = [], supportPlants = [], livestockManure = {}, humanure = {}, densities = DEFAULT_NUTRIENT_DENSITIES} = {}) {
  const harvestMass = production.reduce((sum, row) => sum + Number(row.retained_edible_harvest_kg ?? row.harvest_kg ?? 0), 0);
  const residueMass = production.reduce((sum, row) => sum + Number(row.residue_kg_dm ?? 0), 0);
  const foodExport = Object.fromEntries(LEDGER_NUTRIENTS.map((id) => [id, harvestMass * Number(densities.food_export_kg?.[id] ?? 0)]));
  const residue = Object.fromEntries(LEDGER_NUTRIENTS.map((id) => [id, residueMass * Number(densities.crop_residue_kg_dm?.[id] ?? 0)]));
  const fixed = supportPlants.reduce((sum, row) => add(sum, nutrientObject({N: Number(row.nitrogen_fixed_kg_ha_year ?? 0) * Number(row.area_ha ?? 0)})), zeroNutrients());
  const transferredFixation = nutrientObject(Object.fromEntries(LEDGER_NUTRIENTS.map((id) => [id, Number(fixed[id] ?? 0) * Number(supportPlants.transfer_factor ?? .25)])));
  const manure = nutrientObject(livestockManure);
  const humanureAvailable = nutrientObject(humanure.crop_available ?? humanure);
  return {food_export: nutrientObject(foodExport), crop_residue_return: nutrientObject(residue), nitrogen_fixed: nutrientObject(fixed), nitrogen_transferred_to_crop_pool: transferredFixation, livestock_manure_return: manure, humanure_return: humanureAvailable, internal_transfers_in: add(residue, manure, humanureAvailable), external_inputs: zeroNutrients(), biological_additions: nutrientObject(fixed), caveat: 'Fixation is not automatically crop-available; only the transferred fraction enters the crop pool.'};
}

export function calculateNutrientBalance({openingStock = {}, externalInputs = {}, biologicalAdditions = {}, internalTransfersIn = {}, internalTransfersOut = {}, exports = {}, losses = {}} = {}) {
  const opening = nutrientObject(openingStock);
  const external = nutrientObject(externalInputs);
  const biological = nutrientObject(biologicalAdditions);
  const transfersIn = nutrientObject(internalTransfersIn);
  const transfersOut = nutrientObject(internalTransfersOut);
  const exported = nutrientObject(exports);
  const lost = nutrientObject(losses);
  const closing = nutrientObject(add(opening, external, biological, transfersIn));
  const requestedOut = add(transfersOut, exported, lost);
  const closingAfter = nutrientObject(Object.fromEntries(LEDGER_NUTRIENTS.map((id) => [id, Math.max(0, Number(closing[id]) - Number(requestedOut[id]))])));
  const unmet = nutrientObject(Object.fromEntries(LEDGER_NUTRIENTS.map((id) => [id, Math.max(0, Number(requestedOut[id]) - Number(closing[id]))])));
  const lhs = add(opening, external, biological, transfersIn);
  const rhs = subtract(add(closingAfter, transfersOut, exported, lost), unmet);
  const residual = subtract(lhs, rhs);
  return {opening_stock: opening, external_inputs: external, biological_additions: biological, internal_transfers_in: transfersIn, internal_transfers_out: transfersOut, exports: exported, losses: lost, closing_stock: closingAfter, nutrient_deficit: unmet, reconciliation_residual: residual, balanced: LEDGER_NUTRIENTS.every((id) => Math.abs(residual[id]) < .000001)};
}

export function calculateNutrientLedger({years = [1], initialStocks = {N: 100, P: 25, K: 50}, annual = {}, humanure = {}, livestock = {}, externalInputs = {}, losses = {}, exports = {}} = {}) {
  let stock = nutrientObject(initialStocks);
  const rows = years.map((year) => {
    const humanureRow = typeof humanure === 'function' ? humanure(year) : humanure;
    const livestockRow = typeof livestock === 'function' ? livestock(year) : livestock;
    const flows = typeof annual === 'function' ? annual(year) : annual[year] ?? annual;
    const input = calculatePlantNutrientFlows({production: flows.production ?? [], supportPlants: flows.supportPlants ?? [], livestockManure: livestockRow.manure ?? livestockRow, humanure: humanureRow, densities: flows.densities ?? DEFAULT_NUTRIENT_DENSITIES});
    const externallyAdded = typeof externalInputs === 'function' ? externalInputs(year) : externalInputs[year] ?? externalInputs;
    const rowLosses = typeof losses === 'function' ? losses(year) : losses[year] ?? losses;
    const rowExports = typeof exports === 'function' ? exports(year) : exports[year] ?? exports;
    const balance = calculateNutrientBalance({openingStock: stock, externalInputs: add(input.external_inputs, externallyAdded), biologicalAdditions: input.biological_additions, internalTransfersIn: input.internal_transfers_in, internalTransfersOut: input.crop_residue_return, exports: add(input.food_export, rowExports), losses: rowLosses});
    stock = balance.closing_stock;
    return {year, flows: input, balance};
  });
  return {contract_version: NUTRIENT_LEDGER_CONTRACT_VERSION, nutrients: LEDGER_NUTRIENTS, years: rows, final_stock: stock, all_years_balanced: rows.every((row) => row.balance.balanced), accounting_rule: 'opening stock + external inputs + biological additions + internal transfers in = closing stock + exports + losses + internal transfers out'};
}
