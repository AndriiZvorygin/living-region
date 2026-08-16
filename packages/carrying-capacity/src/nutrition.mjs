import {calculateHealthCanadaProtein, HEALTH_CANADA_PROTEIN_SOURCE} from './protein.mjs';

const round = (value, digits = 6) => Math.round(Number(value) * 10 ** digits) / 10 ** digits;

export const NUTRITION_CONTRACT_VERSION = '1.2.0';
export const DAYS_PER_YEAR = 365.25;
export const HEALTH_CANADA_NUTRIENT_DRI_SOURCE = 'https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-elements.html';
export const HEALTH_CANADA_AMINO_ACID_PATTERN_SOURCE = 'https://www.canada.ca/content/dam/hc-sc/migration/hc-sc/fn-an/alt_formats/hpfb-dgpsa/pdf/nutrition/dri_tables-eng.pdf';
export const CANADIAN_NUTRIENT_FILE_SOURCE = 'https://open.canada.ca/data/en/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109';

// The food rows are CNF food forms, not generic "grain", "meat" or "vegetable"
// averages. Null means the current food record does not support a defensible value.
const MACRO_PROFILES = {
  potato_white_raw: {energy_kj_per_100g: 288, fat_g_per_100g: .10, carbohydrate_g_per_100g: 15.71, fibre_g_per_100g: 2.2, saturated_fat_g_per_100g: .03, linoleic_g_per_100g: .032, alpha_linolenic_g_per_100g: .010},
  winter_wheat_dry: {energy_kj_per_100g: 1368, fat_g_per_100g: 1.54, carbohydrate_g_per_100g: 71.18, fibre_g_per_100g: 12.2, saturated_fat_g_per_100g: .26, linoleic_g_per_100g: .600, alpha_linolenic_g_per_100g: .027},
  black_beans_dry: {energy_kj_per_100g: 1417, fat_g_per_100g: .90, carbohydrate_g_per_100g: 63.25, fibre_g_per_100g: 15.5, saturated_fat_g_per_100g: .23, linoleic_g_per_100g: .211, alpha_linolenic_g_per_100g: .176},
  sunflower_seed_dry: {energy_kj_per_100g: 2445, fat_g_per_100g: 51.46, carbohydrate_g_per_100g: 20, fibre_g_per_100g: 8.6, saturated_fat_g_per_100g: 4.455, linoleic_g_per_100g: 23.05, alpha_linolenic_g_per_100g: .060},
  oats_dry: {energy_kj_per_100g: 1628, fat_g_per_100g: 6.90, carbohydrate_g_per_100g: 66.27, fibre_g_per_100g: 10.1, saturated_fat_g_per_100g: 1.217, linoleic_g_per_100g: 2.424, alpha_linolenic_g_per_100g: .111},
  chicken_egg_raw: {energy_kj_per_100g: 523, fat_g_per_100g: 10.0, carbohydrate_g_per_100g: .72, fibre_g_per_100g: 0, saturated_fat_g_per_100g: 3.126, linoleic_g_per_100g: 1.109, alpha_linolenic_g_per_100g: .073},
  rabbit_meat_raw: {energy_kj_per_100g: 694, fat_g_per_100g: 8.0, carbohydrate_g_per_100g: 0, fibre_g_per_100g: 0, saturated_fat_g_per_100g: 2.35, linoleic_g_per_100g: .860, alpha_linolenic_g_per_100g: .220},
  chicken_meat_raw: {energy_kj_per_100g: 700, fat_g_per_100g: 8.0, carbohydrate_g_per_100g: 0, fibre_g_per_100g: 0, saturated_fat_g_per_100g: 2.2, linoleic_g_per_100g: 1.6, alpha_linolenic_g_per_100g: .08},
  goose_meat_raw: {energy_kj_per_100g: 900, fat_g_per_100g: 13.0, carbohydrate_g_per_100g: 0, fibre_g_per_100g: 0, saturated_fat_g_per_100g: 4.0, linoleic_g_per_100g: .8, alpha_linolenic_g_per_100g: .1},
  carrot_raw: {energy_kj_per_100g: 173, fat_g_per_100g: .24, carbohydrate_g_per_100g: 9.58, fibre_g_per_100g: 2.8, saturated_fat_g_per_100g: .04, linoleic_g_per_100g: .103, alpha_linolenic_g_per_100g: .012},
  leafy_green_raw: {energy_kj_per_100g: 97, fat_g_per_100g: .39, carbohydrate_g_per_100g: 3.6, fibre_g_per_100g: 2.2, saturated_fat_g_per_100g: .06, linoleic_g_per_100g: .15, alpha_linolenic_g_per_100g: .02},
  apple_raw_skin: {energy_kj_per_100g: 218, fat_g_per_100g: .17, carbohydrate_g_per_100g: 13.81, fibre_g_per_100g: 2.4, saturated_fat_g_per_100g: .028, linoleic_g_per_100g: .043, alpha_linolenic_g_per_100g: .012},
  raspberry_raw: {energy_kj_per_100g: 222, fat_g_per_100g: .65, carbohydrate_g_per_100g: 11.94, fibre_g_per_100g: 6.5, saturated_fat_g_per_100g: .019, linoleic_g_per_100g: .375, alpha_linolenic_g_per_100g: .249},
  hazelnut_dried: {energy_kj_per_100g: 2630, fat_g_per_100g: 60.75, carbohydrate_g_per_100g: 16.70, fibre_g_per_100g: 9.7, saturated_fat_g_per_100g: 4.464, linoleic_g_per_100g: 7.92, alpha_linolenic_g_per_100g: .087}
};
const PROFILE = (id, label, protein, amino, nutrients, sourceCode, notes = '') => ({
  id, label, protein_g_per_100g: protein, amino_acid_g_per_100g: amino,
  nutrients_per_100g: nutrients, source_food_code: sourceCode,
  macro_per_100g: MACRO_PROFILES[id] ?? {},
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
    {vitamin_a_rae_ug: 12, vitamin_b12_ug: .49, vitamin_d_ug: null, folate_dfe_ug: 31, vitamin_c_mg: 7.2, calcium_mg: 13, iron_mg: 2.57, zinc_mg: 2.34, iodine_ug: null, selenium_ug: 16.8, magnesium_mg: 24, potassium_mg: 420, choline_mg: null, linoleic_g: .8, alpha_linolenic_g: .1}, '671'),
  carrot_raw: PROFILE('carrot_raw', 'Carrot, raw', .93, {},
    {vitamin_a_rae_ug: 835, vitamin_b12_ug: 0, vitamin_d_ug: 0, folate_dfe_ug: 19, vitamin_c_mg: 5.9, calcium_mg: 33, iron_mg: .30, zinc_mg: .24, iodine_ug: null, selenium_ug: .1, magnesium_mg: 12, potassium_mg: 320, choline_mg: 8.8, linoleic_g: .103, alpha_linolenic_g: .012}, '2380', 'CNF food-form composition; amino-acid detail not loaded in the current local extract.'),
  leafy_green_raw: PROFILE('leafy_green_raw', 'Leafy green vegetable, raw planning form', 2.86, {},
    {vitamin_a_rae_ug: 469, vitamin_b12_ug: 0, vitamin_d_ug: 0, folate_dfe_ug: 194, vitamin_c_mg: 28.1, calcium_mg: 99, iron_mg: 2.71, zinc_mg: .53, iodine_ug: null, selenium_ug: 1, magnesium_mg: 79, potassium_mg: 558, choline_mg: 19.3, linoleic_g: .15, alpha_linolenic_g: .02}, null, 'Representative leafy-green CNF planning form; exact species/form must be selected from the full CNF extract before site-specific use.'),
  apple_raw_skin: PROFILE('apple_raw_skin', 'Apple, raw with skin', .26, {},
    {vitamin_a_rae_ug: 3, vitamin_b12_ug: 0, vitamin_d_ug: 0, folate_dfe_ug: 3, vitamin_c_mg: 4.6, calcium_mg: 6, iron_mg: .12, zinc_mg: .04, iodine_ug: null, selenium_ug: 0, magnesium_mg: 5, potassium_mg: 107, choline_mg: 3.4, linoleic_g: .043, alpha_linolenic_g: .012}, '1696'),
  raspberry_raw: PROFILE('raspberry_raw', 'Raspberry, raw', 1.20, {},
    {vitamin_a_rae_ug: 2, vitamin_b12_ug: 0, vitamin_d_ug: 0, folate_dfe_ug: 21, vitamin_c_mg: 26.2, calcium_mg: 25, iron_mg: .69, zinc_mg: .42, iodine_ug: null, selenium_ug: .4, magnesium_mg: 22, potassium_mg: 151, choline_mg: 12.3, linoleic_g: .375, alpha_linolenic_g: .249}, '1747'),
  hazelnut_dried: PROFILE('hazelnut_dried', 'Hazelnut, dried', 14.95, {},
    {vitamin_a_rae_ug: 1, vitamin_b12_ug: 0, vitamin_d_ug: 0, folate_dfe_ug: 113, vitamin_c_mg: 6.3, calcium_mg: 114, iron_mg: 4.7, zinc_mg: 2.45, iodine_ug: null, selenium_ug: 2.4, magnesium_mg: 163, potassium_mg: 680, choline_mg: 45.6, linoleic_g: 7.92, alpha_linolenic_g: .087}, '2567')
};

export const HEALTH_CANADA_AMINO_ACID_PATTERN = {
  histidine: 18, isoleucine: 25, leucine: 55, lysine: 51,
  methionine_cysteine: 25, phenylalanine_tyrosine: 47,
  threonine: 27, tryptophan: 7, valine: 32
};

export const NUTRIENT_DEFINITIONS = {
  b12: {field: 'vitamin_b12_ug', unit: 'µg', daily_field: 'vitamin_b12_ug_day', annual_field: 'vitamin_b12_ug_year'},
  d: {field: 'vitamin_d_ug', unit: 'µg', daily_field: 'vitamin_d_ug_day', annual_field: 'vitamin_d_ug_year'},
  a: {field: 'vitamin_a_rae_ug', unit: 'µg RAE', daily_field: 'vitamin_a_rae_ug_day', annual_field: 'vitamin_a_rae_ug_year'},
  folate: {field: 'folate_dfe_ug', unit: 'µg DFE', daily_field: 'folate_dfe_ug_day', annual_field: 'folate_dfe_ug_year'},
  c: {field: 'vitamin_c_mg', unit: 'mg', daily_field: 'vitamin_c_mg_day', annual_field: 'vitamin_c_mg_year'},
  calcium: {field: 'calcium_mg', unit: 'mg', daily_field: 'calcium_mg_day', annual_field: 'calcium_mg_year'},
  iron: {field: 'iron_mg', unit: 'mg', daily_field: 'iron_mg_day', annual_field: 'iron_mg_year'},
  zinc: {field: 'zinc_mg', unit: 'mg', daily_field: 'zinc_mg_day', annual_field: 'zinc_mg_year'},
  iodine: {field: 'iodine_ug', unit: 'µg', daily_field: 'iodine_ug_day', annual_field: 'iodine_ug_year'},
  selenium: {field: 'selenium_ug', unit: 'µg', daily_field: 'selenium_ug_day', annual_field: 'selenium_ug_year'},
  magnesium: {field: 'magnesium_mg', unit: 'mg', daily_field: 'magnesium_mg_day', annual_field: 'magnesium_mg_year'},
  potassium: {field: 'potassium_mg', unit: 'mg', daily_field: 'potassium_mg_day', annual_field: 'potassium_mg_year'},
  choline: {field: 'choline_mg', unit: 'mg', daily_field: 'choline_mg_day', annual_field: 'choline_mg_year'},
  linoleic_g: {field: 'linoleic_g', unit: 'g', daily_field: 'linoleic_g_day', annual_field: 'linoleic_g_year'},
  alpha_linolenic_g: {field: 'alpha_linolenic_g', unit: 'g', daily_field: 'alpha_linolenic_g_day', annual_field: 'alpha_linolenic_g_year'}
};

export const FOOD_PORTFOLIO = [
  {id: 'carrot_raw', label: 'Carrot and orange-root crops', category: 'carotenoid-rich vegetable', energy_share: .02, preparation_loss_fraction: .10, evidence_status: 'CNF food form plus local crop planning overlay', source: CANADIAN_NUTRIENT_FILE_SOURCE},
  {id: 'leafy_green_raw', label: 'Leafy green vegetables', category: 'leafy vegetable', energy_share: .02, preparation_loss_fraction: .15, evidence_status: 'representative CNF planning form; species/form unresolved', source: CANADIAN_NUTRIENT_FILE_SOURCE},
  {id: 'apple_raw_skin', label: 'Apples and storage fruit', category: 'fruit', energy_share: .01, preparation_loss_fraction: .10, evidence_status: 'CNF food form plus perennial food-forest diversity layer', source: CANADIAN_NUTRIENT_FILE_SOURCE},
  {id: 'raspberry_raw', label: 'Berries', category: 'fruit', energy_share: .01, preparation_loss_fraction: .10, evidence_status: 'CNF food form plus perennial berry layer', source: CANADIAN_NUTRIENT_FILE_SOURCE},
  {id: 'hazelnut_dried', label: 'Hazelnut and comparable fat-bearing perennial foods', category: 'fat source', energy_share: .04, preparation_loss_fraction: .05, evidence_status: 'CNF food form plus canonical perennial fat/protein layer', source: CANADIAN_NUTRIENT_FILE_SOURCE}
];

export const NUTRITION_GOAL_DEFINITIONS = {
  plants_plus_external: {id: 'plants_plus_external', label: 'Plants plus disclosed external B12, vitamin D and iodine', mode: 'plants_only', description: 'Lowest-complexity plants-only baseline with non-food nutrient inputs disclosed rather than hidden.'},
  minimum_property_b12: {id: 'minimum_property_b12', label: 'Minimum property-produced B12', mode: 'rabbit_meat', description: 'Find the smallest discrete self-replacing rabbit system that meets the household B12 target; surplus is shown.'},
  nutrient_dense_mixed: {id: 'nutrient_dense_mixed', label: 'Nutrient-dense mixed diet', mode: 'mixed_rabbit_eggs', description: 'A mixed rabbit and heritage-chicken option that improves several nutrient rows at additional land and labour cost.'},
  pregnancy_iron_sensitivity: {id: 'pregnancy_iron_sensitivity', label: 'Pregnancy / menstruation iron sensitivity', mode: 'plants_only', description: 'Re-runs the nutrient screen with the selected adult pregnancy/iron sensitivity and separates total from bioavailability-adjusted iron.'},
  user_selected_animal_share: {id: 'user_selected_animal_share', label: 'User-selected animal-food share', mode: 'selected', description: 'Use the selected livestock mode and property-grown ration without declaring a universal optimum.'}
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
  const explicit = Object.fromEntries(Object.entries(NUTRIENT_DEFINITIONS).flatMap(([id, definition]) => [[definition.daily_field, round(d[id])], [definition.annual_field, round(d[id] * DAYS_PER_YEAR)]]));
  return {id: member.id, age_y: Number(member.age_y), sex: member.sex, pregnancy: member.pregnancy ?? 'none', lactation: member.lactation ?? 'none', ...d, ...explicit, protein_rda_g_day: protein.rda_g_day, protein_rda_g_year: protein.rda_kg_year * 1000, protein_source: HEALTH_CANADA_PROTEIN_SOURCE, source: HEALTH_CANADA_NUTRIENT_DRI_SOURCE, status: 'Health Canada DRI planning reference; daily fields are explicit and annual fields multiply by 365.25 days/year'};
}

function addProfile(total, profile, kg) {
  if (!profile || !(kg > 0)) return;
  total.protein_g += kg * profile.protein_g_per_100g * 10;
  total.macro.protein_g += kg * profile.protein_g_per_100g * 10;
  for (const [id, value] of Object.entries(profile.macro_per_100g ?? {})) {
    const macroId = id.replace(/_per_100g$/, '');
    total.macro[macroId] = (total.macro[macroId] ?? 0) + kg * Number(value) * 10;
  }
  // kg of food × g/100 g × 10,000 converts the profile to milligrams.
  for (const [id, value] of Object.entries(profile.amino_acid_g_per_100g)) total.amino_mg[id] = (total.amino_mg[id] ?? 0) + kg * Number(value) * 10000;
  for (const [id, value] of Object.entries(profile.nutrients_per_100g)) if (value != null) total.nutrients[id] = (total.nutrients[id] ?? 0) + kg * Number(value) * 10;
  total.sources.add(profile.source_food_code ?? profile.id);
}

function nutrientStatus(ratio, known, supplied = null) {
  if (!known) return 'unresolved evidence';
  if (ratio >= 1) return 'adequate from property-produced food';
  if (Number(supplied) === 0) return 'small external input required';
  return 'actual food-system deficit';
}

function memberAMDR(member) {
  const age = Number(member.age_y);
  return {
    protein_percent_energy: age < 4 ? {min: 5, max: 20} : {min: 10, max: 35},
    fat_percent_energy: age < 4 ? {min: 30, max: 40} : age < 19 ? {min: 25, max: 35} : {min: 20, max: 35},
    carbohydrate_percent_energy: {min: 45, max: 65},
    source: 'Health Canada Dietary Reference Intakes macronutrient AMDR planning bands'
  };
}

function macroEnergy(macro = {}) {
  return {protein: Number(macro.protein_g ?? 0) * .016736, fat: Number(macro.fat_g ?? 0) * .037656, carbohydrate: Number(macro.carbohydrate_g ?? 0) * .016736};
}

function calculateDietaryMacroSummary(total, members) {
  const energy = macroEnergy(total.macro);
  const totalEnergy = Object.values(energy).reduce((sum, value) => sum + value, 0);
  const percentages = Object.fromEntries(Object.entries(energy).map(([id, value]) => [id, totalEnergy > 0 ? round(value / totalEnergy * 100, 3) : null]));
  const memberRanges = members.map((member) => ({id: member.id, label: member.label, age_y: member.age_y, sex: member.sex, ...memberAMDR(member)}));
  const householdIntersection = Object.fromEntries(['protein', 'fat', 'carbohydrate'].map((id) => {
    const ranges = memberRanges.map((row) => row[`${id}_percent_energy`]);
    const range = {min: Math.max(...ranges.map((row) => row.min)), max: Math.min(...ranges.map((row) => row.max))};
    return [`${id}_percent_energy`, {...range, compatible: range.min <= range.max}];
  }));
  const fatFloor = Math.max(...memberRanges.map((row) => row.fat_percent_energy.min), 0);
  const unsaturatedFat = Math.max(0, Number(total.macro.fat_g ?? 0) - Number(total.macro.saturated_fat_g ?? 0));
  return {
    mass_kg_year: {protein: round(total.macro.protein_g / 1000), fat: round(total.macro.fat_g / 1000), carbohydrate: round(total.macro.carbohydrate_g / 1000), fibre: round((total.macro.fibre_g ?? 0) / 1000), saturated_fat: round((total.macro.saturated_fat_g ?? 0) / 1000), unsaturated_fat: round(unsaturatedFat / 1000), linoleic_acid: round((total.macro.linoleic_g ?? 0) / 1000), alpha_linolenic_acid: round((total.macro.alpha_linolenic_g ?? 0) / 1000)},
    grams_per_day: {protein: round(total.macro.protein_g / DAYS_PER_YEAR, 3), fat: round(total.macro.fat_g / DAYS_PER_YEAR, 3), carbohydrate: round(total.macro.carbohydrate_g / DAYS_PER_YEAR, 3), fibre: round((total.macro.fibre_g ?? 0) / DAYS_PER_YEAR, 3), saturated_fat: round((total.macro.saturated_fat_g ?? 0) / DAYS_PER_YEAR, 3), unsaturated_fat: round(unsaturatedFat / DAYS_PER_YEAR, 3), linoleic_acid: round((total.macro.linoleic_g ?? 0) / DAYS_PER_YEAR, 3), alpha_linolenic_acid: round((total.macro.alpha_linolenic_g ?? 0) / DAYS_PER_YEAR, 3)},
    energy_gj_year: Object.fromEntries(Object.entries(energy).map(([id, value]) => [id, round(value)])),
    energy_percent: percentages,
    essential_fatty_acids: {linoleic_acid_g_year: round(total.macro.linoleic_g ?? 0), alpha_linolenic_acid_g_year: round(total.macro.alpha_linolenic_g ?? 0), dha_epa_g_year: null, dha_epa_status: 'not modeled from the current property-food profiles'},
    amdr: {member_ranges: memberRanges, household_intersection: householdIntersection, compatible_household_intersection: Object.values(householdIntersection).every((row) => row.compatible)},
    flags: {children_fat_floor_met: percentages.fat == null ? null : percentages.fat >= fatFloor, fat_share_status: percentages.fat == null ? 'unresolved' : percentages.fat < fatFloor ? 'below applicable household fat floor' : 'within or above applicable household fat floor'}
  };
}

function portfolioFoodRows(plantFood) {
  const availableEnergyGJ = Number(plantFood.delivered_food_energy_gj ?? 0);
  const totalShare = FOOD_PORTFOLIO.reduce((sum, row) => sum + Number(row.energy_share), 0);
  const baseFraction = Math.max(0, 1 - totalShare);
  const rows = FOOD_PORTFOLIO.map((row) => {
    const profile = FOOD_NUTRIENT_PROFILES[row.id];
    const energyKjPerKg = Number(profile?.macro_per_100g?.energy_kj_per_100g ?? 0) * 10;
    const grossKg = energyKjPerKg > 0 ? availableEnergyGJ * 1e6 * Number(row.energy_share) / energyKjPerKg : 0;
    return {...row, composition_id: row.id, consumed_energy_gj_year: round(availableEnergyGJ * Number(row.energy_share)), consumed_food_kg_year: round(grossKg * (1 - Number(row.preparation_loss_fraction ?? 0))), preparation_loss_kg_year: round(grossKg * Number(row.preparation_loss_fraction ?? 0))};
  });
  return {base_fraction: baseFraction, total_energy_share: totalShare, rows};
}

export function calculateFoodNutrientAdequacy({members = [], plantFood = {}, animals = [], energyGJ = 0, foodPortfolio = true} = {}) {
  const demandRows = members.map(calculateHealthCanadaNutrientDemand);
  const daily = Object.fromEntries(Object.keys(NUTRIENT_DEFINITIONS).map((id) => [id, 0]));
  const annual = Object.fromEntries(Object.keys(NUTRIENT_DEFINITIONS).map((id) => [id, 0]));
  for (const row of demandRows) for (const [id, definition] of Object.entries(NUTRIENT_DEFINITIONS)) { daily[id] += Number(row[definition.daily_field] ?? 0); annual[id] += Number(row[definition.annual_field] ?? 0); }
  const energyDailyKj = Number(energyGJ) * 1e6 / DAYS_PER_YEAR;
  daily.linoleic_g = energyDailyKj * .05 / 37;
  daily.alpha_linolenic_g = energyDailyKj * .006 / 37;
  annual.linoleic_g = daily.linoleic_g * DAYS_PER_YEAR;
  annual.alpha_linolenic_g = daily.alpha_linolenic_g * DAYS_PER_YEAR;
  annual.protein_rda_g = demandRows.reduce((sum, row) => sum + Number(row.protein_rda_g_year ?? 0), 0);
  const total = {protein_g: 0, amino_mg: {}, nutrients: {}, macro: {protein_g: 0, fat_g: 0, carbohydrate_g: 0, fibre_g: 0, saturated_fat_g: 0, linoleic_g: 0, alpha_linolenic_g: 0}, sources: new Set()};
  const portfolio = foodPortfolio ? portfolioFoodRows(plantFood) : {base_fraction: 1, total_energy_share: 0, rows: []};
  for (const row of plantFood.rows ?? []) addProfile(total, FOOD_NUTRIENT_PROFILES[row.composition_id], Number(row.edible_food_kg_delivered ?? 0) * portfolio.base_fraction);
  for (const row of portfolio.rows) addProfile(total, FOOD_NUTRIENT_PROFILES[row.composition_id], Number(row.consumed_food_kg_year ?? 0));
  for (const animal of animals) {
    const profiles = animal.food_profile_id_by_output ?? {};
    addProfile(total, FOOD_NUTRIENT_PROFILES[profiles.eggs ?? animal.food_profile_id], Number(animal.output?.eggs_kg_year ?? 0));
    addProfile(total, FOOD_NUTRIENT_PROFILES[profiles.meat ?? animal.food_profile_id], Number(animal.output?.edible_meat_kg_year ?? 0));
  }
  const amino = Object.fromEntries(Object.entries(HEALTH_CANADA_AMINO_ACID_PATTERN).map(([id, mgPerG]) => {
    const patternTarget = total.protein_g * mgPerG;
    const supplied = total.amino_mg[id] ?? 0;
    const requirement = annual.protein_rda_g * mgPerG / 1000;
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
    const target = annual[demandId] ?? 0;
    const compositionIds = [...(plantFood.rows ?? []).map((row) => row.composition_id), ...animals.flatMap((animal) => Object.values(animal.food_profile_id_by_output ?? {}).concat(animal.food_profile_id ?? []))].filter(Boolean);
    const known = compositionIds.some((compositionId) => FOOD_NUTRIENT_PROFILES[compositionId]?.nutrients_per_100g?.[id] != null);
    const definition = NUTRIENT_DEFINITIONS[demandId];
    return [demandId, {target_daily: round(daily[demandId]), target_annual: round(target), supplied_annual: round(supplied), adequacy_ratio: target > 0 ? round(supplied / target) : null, status: nutrientStatus(target > 0 ? supplied / target : 0, known, supplied), unit: `${definition.unit}/year`, daily_unit: `${definition.unit}/day`}];
  }));
  const externalInputs = Object.entries(nutrients).filter(([, row]) => row.status !== 'adequate from property-produced food').map(([id, row]) => ({nutrient: id, status: row.status, note: id === 'b12' || id === 'iodine' ? 'A small external non-food input may be required; no supplement is silently included.' : 'Current food-form evidence does not establish adequacy.'}));
  const absoluteAdequacy = Object.values(amino).every((row) => row.absolute_adequacy_ratio != null && row.absolute_adequacy_ratio >= 1);
  const iron = nutrients.iron ?? {};
  return {
    contract_version: NUTRITION_CONTRACT_VERSION,
    demand: {days_per_year: DAYS_PER_YEAR, members: demandRows, aggregate: {daily: Object.fromEntries(Object.entries(daily).map(([id, value]) => [id, round(value)])), annual: Object.fromEntries(Object.entries(annual).map(([id, value]) => [id, round(value)])), protein_rda_g_day: round(demandRows.reduce((sum, row) => sum + Number(row.protein_rda_g_day ?? 0), 0)), protein_rda_g_year: round(annual.protein_rda_g)}},
    supply: {protein_g: round(total.protein_g), sources: [...total.sources]},
    whole_diet: {portfolio: portfolio.rows, portfolio_energy_share: round(portfolio.total_energy_share), base_staple_energy_share: round(portfolio.base_fraction), macros: calculateDietaryMacroSummary(total, members)},
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
    iron_assessment: {total_food_iron_mg_year: iron.supplied_annual ?? null, target_iron_mg_day: iron.target_daily ?? null, target_iron_mg_year: iron.target_annual ?? null, heme_iron_mg_year: null, estimated_bioavailable_iron_mg_year: null, vitamin_c_food_mg_year: nutrients.c?.supplied_annual ?? null, phytate_inhibition: 'not quantified from the current mixed-food preparation data', status: 'Total iron is reported; digestibility, heme fraction and absorption are unresolved for this planning portfolio.'},
    external_inputs: externalInputs,
    dimensional_analysis: {daily_reference_values_annualized: true, days_per_year: DAYS_PER_YEAR, comparison_rule: 'Annual food supply is compared only with annualized daily reference targets.', legacy_ambiguous_target_removed: true},
    food_source_boundary: 'Only modeled property-produced food is counted. Iodized salt, supplements, fortification and veterinary minerals are external non-food inputs and are not included.',
    status: externalInputs.length ? 'external input or unresolved evidence remains' : 'adequate from modeled property food'
  };
}
