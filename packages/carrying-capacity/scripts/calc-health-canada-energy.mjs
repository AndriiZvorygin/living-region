import {pathToFileURL} from 'node:url';
import {round, writeCsv, writeJson} from './model-utils.mjs';
import {calculateHealthCanadaEER, representativeProfiles, HEALTH_CANADA_EER_SOURCE as SOURCE} from '../src/health-canada.mjs';

export {calculateHealthCanadaEER, representativeProfiles};

export function buildHealthCanadaEnergy() {
  const scenarios = Object.fromEntries(Object.entries(representativeProfiles).map(([id, profile]) => [id, calculateHealthCanadaEER({id, ...profile})]));
  const representativeAdult = (scenarios.adult_woman.gj_year + scenarios.adult_man.gj_year) / 2;
  const activitySensitivity = Object.fromEntries(['inactive', 'low', 'active', 'very'].map((activity) => [activity, {adult_woman: calculateHealthCanadaEER({...representativeProfiles.adult_woman, id: 'adult_woman', activity}), adult_man: calculateHealthCanadaEER({...representativeProfiles.adult_man, id: 'adult_man', activity})}]));
  const output = {source: SOURCE, canonical_adult_equivalent: {definition: 'mean of the two representative low-active adults', gj_year: round(representativeAdult, 6), mj_day: round(representativeAdult * 1000 / 365.25, 6), kcal_day: round(representativeAdult * 1000 / 365.25 / 4.184 * 1000, 3)}, scenarios, activity_sensitivity: activitySensitivity, pregnancy_lactation_adjustments_kcal_day: {pregnancy_trimester_1: 0, pregnancy_trimester_2: 340, pregnancy_trimester_3: 452, lactation_months_0_6: 330, lactation_months_7_12: 380}};
  writeJson('data/derived/health-canada-energy.json', output);
  writeCsv('data/derived/health-canada-energy.csv', [['id','label','age_y','sex','weight_kg','height_cm','activity','kcal_day','mj_day','gj_year','source','status'], ...Object.values(scenarios).map((row) => [row.id, row.label, row.age_y, row.sex, row.weight_kg, row.height_cm, row.activity, row.kcal_day, row.mj_day, row.gj_year, row.source, row.status])]);
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) buildHealthCanadaEnergy();
