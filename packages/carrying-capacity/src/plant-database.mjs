/**
 * Versioned plant-record boundary for the agroecosystem planner.
 *
 * Source records are permissive about unknown evidence. Missing yields and
 * nutrients remain null and are surfaced by the selector rather than being
 * silently converted to zero.
 */

export const PLANT_DATABASE_CONTRACT_VERSION = '1.0.0';
export const PLANT_DATABASE_VERSION = '1.0.0';
export const PLANT_EVIDENCE_CLASSES = Object.freeze([
  'local_measurement', 'published_research', 'government_extension',
  'practitioner_observation', 'documented_synthesis', 'explicit_proxy',
  'scenario_assumption', 'reference_only'
]);
export const PLANT_LIFE_CYCLES = Object.freeze(['annual', 'perennial', 'support']);
export const PLANT_LAYERS = Object.freeze([
  'annual_plot', 'canopy', 'low_tree', 'shrub', 'vine', 'herbaceous',
  'ground_cover', 'root', 'support'
]);

const NUTRITION_FIELDS = [
  'energy_mj_per_kg', 'protein_kg_per_kg', 'carbohydrate_kg_per_kg',
  'fat_kg_per_kg', 'fibre_kg_per_kg', 'saturated_fat_kg_per_kg',
  'unsaturated_fat_kg_per_kg', 'linoleic_kg_per_kg', 'alpha_linolenic_kg_per_kg',
  'histidine_kg_per_kg', 'isoleucine_kg_per_kg', 'leucine_kg_per_kg',
  'lysine_kg_per_kg', 'methionine_cysteine_kg_per_kg',
  'phenylalanine_tyrosine_kg_per_kg', 'threonine_kg_per_kg',
  'tryptophan_kg_per_kg', 'valine_kg_per_kg', 'vitamin_a_rae_mg_per_kg',
  'vitamin_b12_mg_per_kg', 'vitamin_d_mg_per_kg', 'folate_mg_per_kg',
  'vitamin_c_mg_per_kg', 'calcium_g_per_kg', 'iron_g_per_kg',
  'zinc_g_per_kg', 'iodine_mg_per_kg', 'selenium_mg_per_kg',
  'magnesium_g_per_kg', 'potassium_g_per_kg', 'choline_g_per_kg'
];

const range = (value = {}) => ({low: value.low ?? null, central: value.central ?? null, high: value.high ?? null});
const defaultOutput = {
  id: null, part: null, edible: false, composition_id: null,
  destination: 'soil_return',
  yield: {unit: 'kg_per_ha_year', low: null, central: null, high: null},
  bearing_curve: {1: 0, 2: 0, 3: 0, 5: 0, 8: 0, 10: 0, 15: 0, mature: 0},
  retention_factor: null, nutrition: {composition_id: null, values: null, source: null},
  destinations: [], evidence: {status: 'unknown', source_class: 'reference_only', sources: [], confidence: 'low', proxy: null, caveat: 'Evidence not yet established.'}
};

export function normalizePlantRecord(record = {}) {
  const outputs = (record.outputs ?? []).map((output) => {
    const normalized = {
      ...defaultOutput, ...output,
      yield: {...defaultOutput.yield, ...(output.yield ?? {})},
      bearing_curve: {...defaultOutput.bearing_curve, ...(output.bearing_curve ?? {})},
      nutrition: {...defaultOutput.nutrition, ...(output.nutrition ?? {})},
      evidence: {...defaultOutput.evidence, ...(output.evidence ?? {})}
    };
    normalized.yield = range(normalized.yield);
    if (normalized.nutrition.values) normalized.nutrition.values = {...Object.fromEntries(NUTRITION_FIELDS.map((field) => [field, null])), ...normalized.nutrition.values};
    return normalized;
  });
  return {
    id: record.id ?? null,
    identity: {common_name: null, scientific_name: null, cultivar: null, family: null, evidence_status: 'unknown', ...(record.identity ?? {})},
    architecture: {life_cycle: null, layer: null, mature_height_m: null, canopy_width_m: null, root_depth_m: null, growth_form: null, lifespan_years: null, ...(record.architecture ?? {})},
    establishment: {sowing_window: {start_doy: null, end_doy: null}, harvest_window: {start_doy: null, end_doy: null}, years_to_first_yield: null, years_to_substantial_yield: null, mature_year: null, replacement_cycle_years: null, ...(record.establishment ?? {})},
    site_needs: {hardiness_zone_min: null, min_winter_temp_c: null, growing_degree_days_base5: null, frost_sensitive: null, soil_texture: [], soil_depth: null, ph: {min: null, max: null}, drainage: [], moisture: null, fertility: null, light: null, water_requirement: null, slope_tolerance_percent: null, wind_exposure: null, ...(record.site_needs ?? {})},
    outputs,
    ecological_function: {nitrogen_fixation_kg_n_ha_year: range(), phosphorus_scavenging: null, mulch_kg_dm_ha_year: range(), pollinator_support: null, wind_protection: null, habitat_value: null, carbon_or_soil_organic_matter: null, ...(record.ecological_function ?? {})},
    management: {labour_hours_ha_year: range(), propagation_method: null, pruning: null, harvest: null, processing: null, storage: null, machinery: null, external_inputs: [], ...(record.management ?? {})},
    relationships: {rotation_family: null, disease_conflicts: [], compatible_layers: [], competition: null, livestock_compatibility: [], guilds: [], ...(record.relationships ?? {})},
    evidence: {source_class: 'reference_only', sources: [], geography: null, sample_type: null, confidence: 'low', values: {}, proxy: null, caveat: null, ...(record.evidence ?? {})},
    database_contract_version: PLANT_DATABASE_CONTRACT_VERSION
  };
}

const isNumberOrNull = (value) => value == null || (typeof value === 'number' && Number.isFinite(value));

function validateRange(value, path, errors) {
  if (!value || typeof value !== 'object') {
    errors.push(`${path} must be an object with low, central and high values`);
    return;
  }
  for (const key of ['low', 'central', 'high']) if (!isNumberOrNull(value[key]) || (value[key] != null && value[key] < 0)) errors.push(`${path}.${key} must be non-negative or null`);
  if (value.low != null && value.central != null && value.central < value.low) errors.push(`${path}.central is below low`);
  if (value.high != null && value.central != null && value.high < value.central) errors.push(`${path}.high is below central`);
}

export function validatePlantDatabase(database = {}) {
  const errors = [];
  const warnings = [];
  if (database.contract_version !== PLANT_DATABASE_CONTRACT_VERSION) errors.push(`contract_version must be ${PLANT_DATABASE_CONTRACT_VERSION}`);
  if (!Array.isArray(database.records)) errors.push('records must be an array');
  const seen = new Set();
  let outputCount = 0;
  for (const [index, raw] of (database.records ?? []).entries()) {
    const record = normalizePlantRecord(raw);
    const path = `records[${index}]`;
    if (!record.id || !/^[a-z][a-z0-9_]+$/.test(record.id)) errors.push(`${path}.id must be a stable snake_case identifier`);
    if (seen.has(record.id)) errors.push(`duplicate plant id ${record.id}`);
    seen.add(record.id);
    if (!PLANT_LIFE_CYCLES.includes(record.architecture.life_cycle)) errors.push(`${path}.architecture.life_cycle is invalid`);
    if (!PLANT_LAYERS.includes(record.architecture.layer)) errors.push(`${path}.architecture.layer is invalid`);
    if (!record.identity.common_name || !record.identity.family) errors.push(`${path}.identity requires common_name and family`);
    if (!PLANT_EVIDENCE_CLASSES.includes(record.evidence.source_class)) errors.push(`${path}.evidence.source_class is invalid`);
    if (!Array.isArray(record.evidence.sources) || record.evidence.sources.length === 0) errors.push(`${path}.evidence.sources must contain at least one source`);
    const localOutputs = new Set();
    for (const [outputIndex, output] of record.outputs.entries()) {
      const outputPath = `${path}.outputs[${outputIndex}]`;
      if (!output.id || localOutputs.has(output.id)) errors.push(`${outputPath}.id must be unique within its plant`);
      localOutputs.add(output.id); outputCount += 1;
      validateRange(output.yield, `${outputPath}.yield`, errors);
      if (output.edible && !output.composition_id && !output.nutrition?.composition_id) errors.push(`${outputPath} edible output requires composition_id`);
      for (const [year, factor] of Object.entries(output.bearing_curve ?? {})) if (!isNumberOrNull(factor) || (factor != null && (factor < 0 || factor > 1))) errors.push(`${outputPath}.bearing_curve.${year} must be between 0 and 1 or null`);
      if (output.retention_factor != null && (!Number.isFinite(output.retention_factor) || output.retention_factor <= 0 || output.retention_factor > 1)) errors.push(`${outputPath}.retention_factor must be between 0 and 1 or null`);
      if (output.nutrition?.values) for (const [field, value] of Object.entries(output.nutrition.values)) if (!isNumberOrNull(value) || (value != null && value < 0)) errors.push(`${outputPath}.nutrition.values.${field} must be non-negative or null`);
      if (output.edible && Object.values(output.nutrition?.values ?? {}).every((value) => value == null) && !output.nutrition?.composition_id && !output.composition_id) warnings.push(`${outputPath} has no known nutrition values`);
    }
    if (record.identity.evidence_status === 'unknown' || record.evidence.source_class === 'reference_only') warnings.push(`${record.id} has unresolved or reference-only evidence`);
    if (record.architecture.life_cycle !== 'support' && record.outputs.filter((output) => output.edible).length === 0) warnings.push(`${record.id} has no edible output`);
  }
  return {valid: errors.length === 0, errors, warnings, plant_count: database.records?.length ?? 0, output_count: outputCount};
}

export function assertValidPlantDatabase(database = {}) {
  const result = validatePlantDatabase(database);
  if (!result.valid) throw new Error(`Invalid plant database:\n${result.errors.join('\n')}`);
  return {...database, validation: result};
}

export function buildPlantDatabase(source = {}) {
  return assertValidPlantDatabase({contract_version: PLANT_DATABASE_CONTRACT_VERSION, database_version: source.database_version ?? PLANT_DATABASE_VERSION, source_date: source.source_date ?? null, source_manifest: source.source_manifest ?? [], records: (source.records ?? []).map(normalizePlantRecord)});
}

export {NUTRITION_FIELDS};
