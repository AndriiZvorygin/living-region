import {calculateHealthCanadaEER, representativeProfiles} from './health-canada.mjs';

// Food-energy normalization for choosing discrete livestock systems. This is
// not a land multiplier or a demographic projection.
export const FOOD_ADULT_EQUIVALENT_GJ_YEAR = (calculateHealthCanadaEER(representativeProfiles.adult_woman).gj_year + calculateHealthCanadaEER(representativeProfiles.adult_man).gj_year) / 2;
