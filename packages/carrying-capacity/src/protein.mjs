const round = (value, digits = 6) => Math.round(Number(value) * 10 ** digits) / 10 ** digits;

export const HEALTH_CANADA_PROTEIN_SOURCE = 'https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-macronutrients.html';

// Health Canada's table expresses total-protein reference values per kg body
// weight. The age bands below are the RDA/AI and EAR values for people age 1+
//; pregnancy and lactation use the separate table rows. Sex is retained in the
// API because the source table publishes sex-specific adolescent/adult rows,
// even where the protein values are equal.
export const HEALTH_CANADA_PROTEIN_DRI = {
  children_1_3: {min_age: 1, max_age: 3, ear_g_kg_day: .87, rda_g_kg_day: 1.05},
  children_4_8: {min_age: 4, max_age: 8, ear_g_kg_day: .76, rda_g_kg_day: .95},
  adolescent_9_13: {min_age: 9, max_age: 13, ear_g_kg_day: .76, rda_g_kg_day: .95},
  adolescent_14_18_male: {min_age: 14, max_age: 18, sex: 'male', ear_g_kg_day: .73, rda_g_kg_day: .85},
  adolescent_14_18_female: {min_age: 14, max_age: 18, sex: 'female', ear_g_kg_day: .71, rda_g_kg_day: .85},
  adult_19_50_male: {min_age: 19, max_age: 50, sex: 'male', ear_g_kg_day: .66, rda_g_kg_day: .80},
  adult_19_50_female: {min_age: 19, max_age: 50, sex: 'female', ear_g_kg_day: .66, rda_g_kg_day: .80},
  adult_51_70_male: {min_age: 51, max_age: 70, sex: 'male', ear_g_kg_day: .66, rda_g_kg_day: .80},
  adult_51_70_female: {min_age: 51, max_age: 70, sex: 'female', ear_g_kg_day: .66, rda_g_kg_day: .80},
  older_adult_male: {min_age: 71, max_age: 130, sex: 'male', ear_g_kg_day: .66, rda_g_kg_day: .80},
  older_adult_female: {min_age: 71, max_age: 130, sex: 'female', ear_g_kg_day: .66, rda_g_kg_day: .80}
};

export const HEALTH_CANADA_PROTEIN_QUALITY_REFERENCE = {
  status: 'reference_pattern_only',
  method: 'PDCAAS reference amino-acid pattern; a complete digestibility score is not assigned without food-specific amino-acid evidence.',
  amino_acid_mg_per_g_protein: {
    histidine: 18,
    isoleucine: 25,
    leucine: 55,
    lysine: 51,
    methionine_cysteine: 25,
    phenylalanine_tyrosine: 47,
    threonine: 27,
    tryptophan: 7,
    valine: 32
  },
  source: HEALTH_CANADA_PROTEIN_SOURCE
};

function tableRow(age, sex) {
  const numericAge = Number(age);
  if (!Number.isFinite(numericAge) || numericAge < 1) throw new Error('Health Canada protein calculation requires age >= 1');
  if (!['male', 'female'].includes(sex)) throw new Error(`Health Canada protein requires sex male/female: ${sex}`);
  const rows = Object.values(HEALTH_CANADA_PROTEIN_DRI).filter((row) => numericAge >= row.min_age && numericAge <= row.max_age && (!row.sex || row.sex === sex));
  if (!rows.length) throw new Error(`No Health Canada protein reference row for age ${age}, sex ${sex}`);
  return rows[0];
}

/** Calculate the Health Canada total-protein EAR and RDA for one member. */
export function calculateHealthCanadaProtein(profile = {}) {
  const age = Number(profile.age_y);
  const weight = Number(profile.weight_kg);
  const row = tableRow(age, profile.sex);
  if (!Number.isFinite(weight) || weight <= 0) throw new Error('Health Canada protein calculation requires positive weight_kg');
  const pregnancy = profile.pregnancy ?? 'none';
  const lactation = profile.lactation ?? 'none';
  const pregnancyRate = pregnancy === 'none' || pregnancy === 'trimester_1' ? row.rda_g_kg_day : 1.1;
  const lactationRate = lactation === 'none' ? pregnancyRate : 1.3;
  const rdaRate = lactation !== 'none' ? lactationRate : pregnancyRate;
  const earRate = pregnancy !== 'none' && pregnancy !== 'trimester_1' ? .88 : lactation !== 'none' ? 1.05 : row.ear_g_kg_day;
  const rda = weight * rdaRate;
  const ear = weight * earRate;
  return {
    id: profile.id,
    label: profile.label,
    age_y: age,
    sex: profile.sex,
    weight_kg: weight,
    reference_band: Object.entries(HEALTH_CANADA_PROTEIN_DRI).find(([, candidate]) => candidate === row)?.[0] ?? 'custom',
    ear_g_kg_day: round(earRate),
    rda_g_kg_day: round(rdaRate),
    ear_g_day: round(ear),
    rda_g_day: round(rda),
    ear_kg_year: round(ear * 365.25 / 1000),
    rda_kg_year: round(rda * 365.25 / 1000),
    pregnancy: pregnancy,
    lactation: lactation,
    source: HEALTH_CANADA_PROTEIN_SOURCE,
    status: 'official Health Canada DRI total-protein reference; food quality and amino-acid adequacy remain separate checks'
  };
}

export function calculateHouseholdProteinDemand(members = [], {target = 'rda'} = {}) {
  const rows = members.map((member, index) => calculateHealthCanadaProtein({...member, id: member.id ?? `member-${index + 1}`}));
  const key = target === 'ear' ? 'ear' : 'rda';
  const dayKey = `${key}_g_day`;
  const yearKey = `${key}_kg_year`;
  return {
    target,
    members: rows,
    household_protein_g_day: round(rows.reduce((sum, row) => sum + row[dayKey], 0)),
    household_protein_kg_year: round(rows.reduce((sum, row) => sum + row[yearKey], 0)),
    source: HEALTH_CANADA_PROTEIN_SOURCE,
    quality_reference: HEALTH_CANADA_PROTEIN_QUALITY_REFERENCE,
    caveat: 'Total protein RDA is a screening requirement. This output does not prove indispensable-amino-acid adequacy, digestibility, micronutrients or food safety.'
  };
}

