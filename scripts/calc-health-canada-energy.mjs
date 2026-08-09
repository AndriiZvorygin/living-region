import {pathToFileURL} from 'node:url';
import {round, writeCsv, writeJson} from './model-utils.mjs';

const SOURCE = 'https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/equations-estimate-energy-requirement.html';

const ADULT = {
  male: {
    inactive: [753.07, -10.83, 6.50, 14.10], low: [581.47, -10.83, 8.30, 14.94],
    active: [1004.82, -10.83, 6.52, 15.91], very: [-517.88, -10.83, 15.61, 19.11]
  },
  female: {
    inactive: [584.90, -7.01, 5.72, 11.71], low: [575.77, -7.01, 6.60, 12.14],
    active: [710.25, -7.01, 6.54, 12.34], very: [511.83, -7.01, 9.07, 12.56]
  }
};

const CHILD = {
  male: {
    inactive: [-447.51, 3.68, 13.01, 13.15], low: [-19.12, 3.68, 8.62, 20.28],
    active: [-388.19, 3.68, 12.66, 20.46], very: [-671.75, 3.68, 15.38, 23.25]
  },
  female: {
    inactive: [55.59, -22.25, 8.43, 17.07], low: [-297.54, -22.25, 12.77, 14.73],
    active: [-189.55, -22.25, 11.74, 18.34], very: [-709.59, -22.25, 18.22, 14.25]
  }
};

function equationValue(coefficients, profile, childConstant = 0) {
  const [constant, age, height, weight] = coefficients;
  return constant + age * profile.age_y + height * profile.height_cm + weight * profile.weight_kg + childConstant;
}

export function calculateHealthCanadaEER(profile) {
  const age = Number(profile.age_y);
  const sex = profile.sex;
  const activity = profile.activity ?? 'low';
  if (!['male', 'female'].includes(sex)) throw new Error(`Health Canada EER requires sex male/female: ${sex}`);
  if (!Number.isFinite(age) || !Number.isFinite(profile.height_cm) || !Number.isFinite(profile.weight_kg)) {
    throw new Error('Health Canada EER requires numeric age, height_cm and weight_kg');
  }
  let kcal;
  let equation;
  if (age >= 19) {
    const coefficients = ADULT[sex][activity];
    if (!coefficients) throw new Error(`Unknown adult activity category: ${activity}`);
    kcal = equationValue(coefficients, profile);
    equation = `${coefficients[0]} ${coefficients[1]}*age_y ${coefficients[2]}*height_cm ${coefficients[3]}*weight_kg`;
  } else if (age >= 3) {
    const coefficients = CHILD[sex][activity];
    if (!coefficients) throw new Error(`Unknown child activity category: ${activity}`);
    const childConstant = age < 9 ? 20 : 25;
    kcal = equationValue(coefficients, profile, childConstant);
    equation = `${coefficients[0]} ${coefficients[1]}*age_y ${coefficients[2]}*height_cm ${coefficients[3]}*weight_kg + ${childConstant}`;
  } else {
    throw new Error('The representative model currently requires age >= 3; infant equations remain a documented extension point.');
  }
  const pregnancyKcal = {none: 0, trimester_1: 0, trimester_2: 340, trimester_3: 452}[profile.pregnancy ?? 'none'] ?? 0;
  const lactationKcal = {none: 0, months_0_6: 330, months_7_12: 380}[profile.lactation ?? 'none'] ?? 0;
  const totalKcal = kcal + pregnancyKcal + lactationKcal;
  const dailyMj = totalKcal * 4.184 / 1000;
  return {
    ...profile,
    equation,
    base_kcal_day: round(kcal, 3),
    pregnancy_adjustment_kcal_day: pregnancyKcal,
    lactation_adjustment_kcal_day: lactationKcal,
    kcal_day: round(totalKcal, 3),
    mj_day: round(dailyMj, 6),
    gj_year: round(dailyMj * 365.25 / 1000, 6),
    source: SOURCE,
    status: 'current canonical Health Canada EER calculation'
  };
}

export const representativeProfiles = {
  adult_woman: {label: 'Representative adult woman', age_y: 35, sex: 'female', weight_kg: 65, height_cm: 165, activity: 'low'},
  adult_man: {label: 'Representative adult man', age_y: 35, sex: 'male', weight_kg: 80, height_cm: 178, activity: 'low'},
  child_girl_8: {label: 'Representative 8-year-old girl', age_y: 8, sex: 'female', weight_kg: 28, height_cm: 130, activity: 'low'},
  child_boy_8: {label: 'Representative 8-year-old boy', age_y: 8, sex: 'male', weight_kg: 28, height_cm: 130, activity: 'low'},
  adolescent_girl_14: {label: 'Representative 14-year-old girl', age_y: 14, sex: 'female', weight_kg: 50, height_cm: 160, activity: 'low'},
  adolescent_boy_14: {label: 'Representative 14-year-old boy', age_y: 14, sex: 'male', weight_kg: 50, height_cm: 165, activity: 'low'}
};

export function buildHealthCanadaEnergy() {
  const scenarios = Object.fromEntries(Object.entries(representativeProfiles).map(([id, profile]) => [id, calculateHealthCanadaEER({id, ...profile})]));
  const representativeAdult = (scenarios.adult_woman.gj_year + scenarios.adult_man.gj_year) / 2;
  const activitySensitivity = Object.fromEntries(['inactive', 'low', 'active', 'very'].map(activity => [activity, {
    adult_woman: calculateHealthCanadaEER({...representativeProfiles.adult_woman, id: 'adult_woman', activity}),
    adult_man: calculateHealthCanadaEER({...representativeProfiles.adult_man, id: 'adult_man', activity})
  }]));
  const output = {source: SOURCE, canonical_adult_equivalent: {definition: 'mean of the two representative low-active adults', gj_year: round(representativeAdult, 6), mj_day: round(representativeAdult * 1000 / 365.25, 6), kcal_day: round(representativeAdult * 1000 / 365.25 / 4.184 * 1000, 3)}, scenarios, activity_sensitivity: activitySensitivity, pregnancy_lactation_adjustments_kcal_day: {pregnancy_trimester_1: 0, pregnancy_trimester_2: 340, pregnancy_trimester_3: 452, lactation_months_0_6: 330, lactation_months_7_12: 380}};
  writeJson('data/derived/health-canada-energy.json', output);
  writeCsv('data/derived/health-canada-energy.csv', [
    ['id','label','age_y','sex','weight_kg','height_cm','activity','kcal_day','mj_day','gj_year','source','status'],
    ...Object.values(scenarios).map(r => [r.id, r.label, r.age_y, r.sex, r.weight_kg, r.height_cm, r.activity, r.kcal_day, r.mj_day, r.gj_year, r.source, r.status])
  ]);
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) buildHealthCanadaEnergy();
