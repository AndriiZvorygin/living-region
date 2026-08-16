import {calculateHealthCanadaProtein, HEALTH_CANADA_PROTEIN_SOURCE} from './protein.mjs';

const round = (value, digits = 6) => Math.round(Number(value) * 10 ** digits) / 10 ** digits;

export const NUTRITION_CONTRACT_VERSION = '1.1.0';
export const HEALTH_CANADA_NUTRIENT_DRI_SOURCE = 'https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-elements.html';
export const HEALTH_CANADA_AMINO_ACID_PATTERN_SOURCE = 'https://www.canada.ca/content/dam/hc-sc/migration/hc-sc/fn-an/alt_formats/hpfb-dgpsa/pdf/nutrition/dri_tables-eng.pdf';
export const CANADIAN_NUTRIENT_FILE_SOURCE = 'https://open.canada.ca/data/en/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109';

// The food rows are CNF food forms, not generic "grain", "meat" or "vegetable"
// averages. Null means the current food record does not support a defensible value.
const PROFILE = (id, label, protein, amino, nutrients, sourceCode, notes = '') => ({
  id, label, protein_g_per_100g: protein, amino_acid_g_per_100g: amino,
  nutrients_per_100g: nutrients, source_food_code: sourceCode,
  source: CANADIAN_NUTRIENT_FILE_SOURCE, source_date: '2026-01-28',
  evidence_status: 'CNF_food_form', notes
});

export const FOOD_NUTRIENT_PROFILES = {
  potato_white_raw: PROFILE('potato_white_raw', 'Potato, white flesh and skin, raw', 1.68,
    {histidine: .028, isoleucine: .054, leucine: .080, lysine: .087, methionine_cysteine: .046, phenylalanine_tyrosine: .105, threonine: .055, tryptophan: .017, valine: .084},
    {vitamin_a_rae_ug: 0, vitamin_b12_ug: 0, vitamin_d_ug: 0, folate_dfe_ug: 18, vitamin_c_mg: 9.1, calcium_mg: 9, iron_mg: .52, zinc_mg: .29, iodine_ug: null, selenium_ug: .3, magnesium_mg: 21, potassium_mg: 407, choline_mg: 11, linoleic_g: .032, alpha_linolenic_g: .010}, '5285'),
  winter_wheat_dry: PROFILE('winter_wheat_dry', 'Hard red winter wheat, dry', 12.61,
    {histidine: .285, isoleucine: .458, leucine: .854, lysine: .335, methionine_cysteine: .523, phenylalanine_tyrosine: .979, threonine: .365, tryptophan: .160, valine: .556},
    {vitamin_a_rae_ug: 0, vitamin_b12_ug: 0, vitamin_d_ug: 0, folate_dfe_ug: 38, vitamin_c_mg: 0, calcium_mg: 29, iron_mg: 3.19, zinc_mg: 2.65, iodine_ug: null, selenium_ug: 70.7, magnesium_mg: 126, potassium_mg: 363, choline_mg: 31.2, linoleic_g: .600, alpha_linolenic_g: .027}, '4437'),
  black_beans_dry: PROFILE('black_beans_dry', 'Black turtle beans, mature seeds, dry', 21.25,
    {histidine: .592, isoleucine: .938, leucine: 1.697, lysine: 1.459, methionine_cysteine: .551, phenylalanine_tyrosine: 1.747, threonine: .894, tryptophan: .252, valine: 1.112},
    {vitamin_a_rae_ug: 0, vitamin_b12_ug: 0, vitamin_d_ug: 0, folate_dfe_ug: 444, vitamin_c_mg: 0, calcium_mg: 160, iron_mg: 8.7, zinc_mg: 2.2, iodine_ug: null, selenium_ug: 3.2, magnesium_mg: 160, potassium_mg: 1500, choline_mg: null, linoleic_g: .211, alpha_linolenic_g: .176}, '3252'),
  sunflower_seed_dry: PROFILE('sunflower_seed_dry', 'Sunflower seed kernels, dried', 20.78,
    {histidine: .632, isoleucine: 1.139, leucine: 1.659, lysine: .937, methionine_cysteine: .945, phenylalanine_tyrosine: 1.835, threonine: .928, tryptophan: .348, valine: 1.315},
    {vitamin_a_rae_ug: 0, vitamin_b12_ug: 0, vitamin_d_ug: 0, folate_dfe_ug: 227, vitamin_c_mg: 1.4, calcium_mg: 78, iron_mg: 5.25, zinc_mg: 5, iodine_ug: null, selenium_ug: 53, magnesium_mg: 325, potassium_mg: 645, choline_mg: 55.1, linoleic_g: 23.05, alpha_linolenic_g: .060}, '2526'),
  oats_dry: PROFILE('oats_dry', 'Oats, dry', 16.89,
    {histidine: .405, isoleucine: .694, leucine: 1.284, lysine: .701, methionine_cysteine: .720, phenylalanine_tyrosine: 1.468, threonine: .575, tryptophan: .234, valine: .937},
    {vitamin_a_rae_ug: 0, vitamin_b12_ug: 0, vitamin_d_ug: 0, folate_dfe_ug: 56, vitamin_c_mg: 0, calcium_mg: 54, iron_mg: 4.72, zinc_mg: 3.97, iodine_ug: null, selenium_ug: null, magnesium_mg: 177, potassium_mg: 429, choline_mg: null, linoleic_g: 2.424, alpha_linolenic_g: .111}, '4421'),
  chicken_egg_raw: PROFILE('chicken_egg_raw', 'Chicken egg, whole, raw', 12.56,
    {histidine: .266, isoleucine: .658, leucine: 1.058, lysine: .875, methionine_cysteine: .729, phenylalanine_tyrosine: 1.176, threonine: .591, tryptophan: .177, valine: .828},
    {vitamin_a_rae_ug: 203.139, vitamin_b12_ug: 1.502, vitamin_d_ug: 1.538, folate_dfe_ug: 68.373, vitamin_c_mg: 0, calcium_mg: 50.211, iron_mg: 1.758, zinc_mg: 1.277, iodine_ug: null, selenium_ug: 29.584, magnesium_mg: 10.307, potassium_mg: 124.838, choline_mg: 391.83, linoleic_g: 1.1089, alpha_linolenic_g: .0726}, '125'),
  rabbit_meat_raw: PROFILE('rabbit_meat_raw', 'Domestic rabbit, composite cuts, raw', 21.0,
    {histidine: .562, isoleucine: .951, leucine: 1.562, lysine: 1.756, methionine_cysteine: .754, phenylalanine_tyrosine: 1.537, threonine: .897, tryptophan: .265, valine: 1.019},
    {vitamin_a_rae_ug: 0, vitamin_b12_ug: 7.16, vitamin_d_ug: 0, folate_dfe_ug: 8, vitamin_c_mg: 0, calcium_mg: 13, iron_mg: 1.57, zinc_mg: 1.57, iodine_ug: null, selenium_ug: 23.7, magnesium_mg: 19, potassium_mg: 330, choline_mg: null, linoleic_g: .860, alpha_linolenic_g: .220}, '3592'),
  chicken_meat_raw: PROFILE('chicken_meat_raw', 'Chicken meat, raw, composition proxy', 21.0,
    {histidine: .550, isoleucine: .950, leucine: 1.650, lysine: 1.800, methionine_cysteine: .750, phenylalanine_tyrosine: 1.550, threonine: .900, tryptophan: .250, valine: 1.050},
    {vitamin_a_rae_ug: null, vitamin_b12_ug: null, vitamin_d_ug: null, folate_dfe_ug: null, vitamin_c_mg: 0, calcium_mg: null, iron_mg: null, zinc_mg: null, iodine_ug: null, selenium_ug: null, magnesium_mg: null, potassium_mg: null, choline_mg: null, linoleic_g: null, alpha_linolenic_g: null}, null,
    'Chicken meat composition is intentionally unresolved until a matching CNF food form is selected; it must not be treated as a complete micronutrient profile.'),
  goose_meat_raw: PROFILE('goose_meat_raw', 'Domesticated goose, meat only, raw', 22.75,
    {histidine: .601, isoleucine: 1.168, leucine: 1.922, lysine: 1.947, methionine_cysteine: .964, phenylalanine_tyrosine: 1.820, threonine: .972, tryptophan: .317, valine: 1.190},
    {vitamin_a_rae_ug: 12, vitamin_b12_ug: .49, vitamin_d_ug: null, folate_dfe_ug: 31, vitamin_c_mg: 7.2, calcium_mg: 13, iron_mg: 2.57, zinc_mg: 2.34, iodine_ug: null, selenium_ug: 16.8, magnesium_mg: 24, potassium_mg: 420, choline_mg: null, linoleic_g: .8, alpha_linolenic_g: .1}, '671')
};

export const HEALTH_CANADA_AMINO_ACID_PATTERN = {
  histidine: 18, isoleucine: 25, leucine: 55, lysine: 51,
  methionine_cysteine: 25, phenylalanine_tyrosine: 47,
  threonine: 27, tryptophan: 7, valine: 32
};

const band = (age, sex) => {
  const a = Number(age);
  if (a <= 3) return {b12: .9, d: 15, a: 300, folate: 150, c: 15, calcium: 700, iron: 7, zinc: 3, iodine: 90, selenium: 20, magnesium: 80, potassium: 3000, choline: 200};
  if (a <= 8) return {b12: 1.2, d: 15, a: 400, folate: 200, c: 25, calcium: 1000, iron: 10, zinc: 5, iodine: 90, selenium: 30, magnesium: 130, potassium: 3800, choline: 250};
  if (a <= 13) return {b12: 1.8, d: 15, a: 600, folate: 300, c: 45, calcium: 1300, iron: 8, zinc: 8, iodine: 120, selenium: 40, magnesium: 240, potassium: 4500, choline: 375};
  if (a <= 18) return {b12: 2.4, d: 15, a: sex === 'female' ? 700 : 900, folate: 400, c: sex === 'female' ? 65 : 75, calcium: 1300, iron: sex === 'female' ? 15 : 11, zinc: sex === 'female' ? 9 : 11, iodine: 150, selenium: 55, magnesium: sex === 'female' ? 360 : 410, potassium: sex === 'female' ? 2300 : 3000, choline: sex === 'female' ? 400 : 550};
  return {b12: 2.4, d: age > 70 ? 20 : 15, a: sex === 'female' ? 700 : 900, folate: 400, c: sex === 'female' ? 75 : 90, calcium: age > 50 ? 1200 : 1000, iron: sex === 'female' && age <= 50 ? 18 : 8, zinc: sex === 'female' ? 8 : 11, iodine: 150, selenium: 55, magnesium: sex === 'female' ? 320 : 420, potassium: sex === 'female' ? 2600 : 3400, choline: sex === 'female' ? 425 : 550};
};

export function calculateHealthCanadaNutrientDemand(member = {}) {
  const d = band(member.age_y, member.sex);
  const protein = calculateHealthCanadaProtein(member);
  if (member.pregnancy && member.pregnancy !== 'none') Object.assign(d, {b12: 2.6, a: 770, folate: 600, c: 85, iron: 27, iodine: 220, choline: 450});
  if (member.lactation && member.lactation !== 'none') Object.assign(d, {b12: 2.8, a: 1300, folate: 500, c: 120, iodine: 290, choline: 550});
  return {id: member.id, age_y: Number(member.age_y), sex: member.sex, pregnancy: member.pregnancy ?? 'none', lactation: member.lactation ?? 'none', ...d, protein_rda_g_day: protein.rda_g_day, protein_rda_g_year: protein.rda_kg_year * 1000, protein_source: HEALTH_CANADA_PROTEIN_SOURCE, source: HEALTH_CANADA_NUTRIENT_DRI_SOURCE, status: 'Health Canada DRI planning reference; pregnancy/lactation adjustments applied where supplied'};
}

function addProfile(total, profile, kg) {
  if (!profile || !(kg > 0)) return;
  total.protein_g += kg * profile.protein_g_per_100g * 10;
  // kg of food × g/100 g × 10,000 converts the profile to milligrams.
  for (const [id, value] of Object.entries(profile.amino_acid_g_per_100g)) total.amino_mg[id] = (total.amino_mg[id] ?? 0) + kg * Number(value) * 10000;
  for (const [id, value] of Object.entries(profile.nutrients_per_100g)) if (value != null) total.nutrients[id] = (total.nutrients[id] ?? 0) + kg * Number(value) * (id.endsWith('_ug') ? 10 : 10);
  total.sources.add(profile.source_food_code ?? profile.id);
}

function nutrientStatus(ratio, known, supplied = null) {
  if (!known) return 'unresolved evidence';
  if (ratio >= 1) return 'adequate from property-produced food';
  if (Number(supplied) === 0) return 'small external input required';
  return 'actual food-system deficit';
}

export function calculateFoodNutrientAdequacy({members = [], plantFood = {}, animals = [], energyGJ = 0} = {}) {
  const demandRows = members.map(calculateHealthCanadaNutrientDemand);
  const demand = {b12: 0, d: 0, a: 0, folate: 0, c: 0, calcium: 0, iron: 0, zinc: 0, iodine: 0, selenium: 0, magnesium: 0, potassium: 0, choline: 0, protein_rda_g_year: 0};
  for (const row of demandRows) for (const id of Object.keys(demand)) demand[id] += row[id];
  const energyKj = Number(energyGJ) * 1e6;
  demand.linoleic_g = energyKj * .05 / 37;
  demand.alpha_linolenic_g = energyKj * .006 / 37;
  const total = {protein_g: 0, amino_mg: {}, nutrients: {}, sources: new Set()};
  for (const row of plantFood.rows ?? []) addProfile(total, FOOD_NUTRIENT_PROFILES[row.composition_id], Number(row.edible_food_kg_delivered ?? 0));
  for (const animal of animals) {
    const profiles = animal.food_profile_id_by_output ?? {};
    addProfile(total, FOOD_NUTRIENT_PROFILES[profiles.eggs ?? animal.food_profile_id], Number(animal.output?.eggs_kg_year ?? 0));
    addProfile(total, FOOD_NUTRIENT_PROFILES[profiles.meat ?? animal.food_profile_id], Number(animal.output?.edible_meat_kg_year ?? 0));
  }
  const amino = Object.fromEntries(Object.entries(HEALTH_CANADA_AMINO_ACID_PATTERN).map(([id, mgPerG]) => {
    const patternTarget = total.protein_g * mgPerG;
    const supplied = total.amino_mg[id] ?? 0;
    const requirement = demand.protein_rda_g_year * mgPerG / 1000;
    const actual = supplied / 1000;
    const qualityRatio = patternTarget > 0 ? supplied / patternTarget : null;
    const absoluteRatio = requirement > 0 ? actual / requirement : null;
    return [id, {
      pattern_target_mg: round(patternTarget),
      supplied_mg: round(supplied),
      actual_intake_g_year: round(actual),
      requirement_g_year: round(requirement),
      absolute_adequacy_ratio: absoluteRatio == null ? null : round(absoluteRatio),
      quality_pattern_ratio: qualityRatio == null ? null : round(qualityRatio),
      // Compatibility alias. It is a pattern score, not an absolute requirement ratio.
      adequacy_ratio: qualityRatio == null ? null : round(qualityRatio),
      quality_status: qualityRatio == null ? 'unresolved evidence' : qualityRatio >= 1 ? 'meets reference pattern' : 'limiting reference pattern',
      absolute_status: absoluteRatio == null ? 'unresolved evidence' : absoluteRatio >= 1 ? 'absolute adequacy met' : 'actual amino-acid deficit',
      digestibility_status: 'unresolved evidence',
      digestibility_adjusted_ratio: null,
      status: absoluteRatio == null ? 'unresolved evidence' : absoluteRatio >= 1 ? 'absolute adequacy met' : 'actual amino-acid deficit'
    }];
  }));
  const limiting = Object.entries(amino).filter(([, row]) => row.quality_pattern_ratio != null).sort(([, a], [, b]) => a.quality_pattern_ratio - b.quality_pattern_ratio)[0];
  const absoluteLimiting = Object.entries(amino).filter(([, row]) => row.absolute_adequacy_ratio != null).sort(([, a], [, b]) => a.absolute_adequacy_ratio - b.absolute_adequacy_ratio)[0];
  const microMap = {vitamin_b12_ug: 'b12', vitamin_d_ug: 'd', vitamin_a_rae_ug: 'a', folate_dfe_ug: 'folate', vitamin_c_mg: 'c', calcium_mg: 'calcium', iron_mg: 'iron', zinc_mg: 'zinc', iodine_ug: 'iodine', selenium_ug: 'selenium', magnesium_mg: 'magnesium', potassium_mg: 'potassium', choline_mg: 'choline', linoleic_g: 'linoleic_g', alpha_linolenic_g: 'alpha_linolenic_g'};
  const nutrients = Object.fromEntries(Object.entries(microMap).map(([id, demandId]) => {
    const supplied = total.nutrients[id] ?? 0;
    const target = demand[demandId] ?? 0;
    const compositionIds = [...(plantFood.rows ?? []).map((row) => row.composition_id), ...animals.flatMap((animal) => Object.values(animal.food_profile_id_by_output ?? {}).concat(animal.food_profile_id ?? []))].filter(Boolean);
    const known = compositionIds.some((compositionId) => FOOD_NUTRIENT_PROFILES[compositionId]?.nutrients_per_100g?.[id] != null);
    return [demandId, {target: round(target), supplied: round(supplied), adequacy_ratio: target > 0 ? round(supplied / target) : null, status: nutrientStatus(target > 0 ? supplied / target : 0, known, supplied), unit: id.endsWith('_ug') ? 'µg/year' : id.endsWith('_mg') ? 'mg/year' : 'g/year'}];
  }));
  const externalInputs = Object.entries(nutrients).filter(([, row]) => row.status !== 'adequate from property-produced food').map(([id, row]) => ({nutrient: id, status: row.status, note: id === 'b12' || id === 'iodine' ? 'A small external non-food input may be required; no supplement is silently included.' : 'Current food-form evidence does not establish adequacy.'}));
  const absoluteAdequacy = Object.values(amino).every((row) => row.absolute_adequacy_ratio != null && row.absolute_adequacy_ratio >= 1);
  return {
    contract_version: NUTRITION_CONTRACT_VERSION,
    demand: {members: demandRows, aggregate: Object.fromEntries(Object.entries(demand).map(([id, value]) => [id, round(value)]))},
    supply: {protein_g: round(total.protein_g), sources: [...total.sources]},
    amino_acid_pattern: {
      source: HEALTH_CANADA_AMINO_ACID_PATTERN_SOURCE,
      reference_mg_per_g_protein: HEALTH_CANADA_AMINO_ACID_PATTERN,
      limiting_amino_acid: limiting ? limiting[0] : null,
      limiting_pattern_amino_acid: limiting ? limiting[0] : null,
      absolute_limiting_amino_acid: absoluteLimiting ? absoluteLimiting[0] : null,
      absolute_adequacy: absoluteAdequacy,
      requirement_method: 'Household absolute amino-acid planning requirements are derived by applying the Health Canada age-1+ reference pattern (mg/g protein) to each member total-protein RDA. This is an explicit planning comparison, not a separate clinical amino-acid DRI table.',
      digestibility_method: 'No food-specific digestibility adjustment is applied where the current CNF food-form evidence does not provide a defensible value. Raw intake and reference-pattern results remain separate from digestibility-adjusted quality.',
      rows: amino
    },
    nutrients,
    external_inputs: externalInputs,
    food_source_boundary: 'Only modeled property-produced food is counted. Iodized salt, supplements, fortification and veterinary minerals are external non-food inputs and are not included.',
    status: externalInputs.length ? 'external input or unresolved evidence remains' : 'adequate from modeled property food'
  };
}
