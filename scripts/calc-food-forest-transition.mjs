import {pathToFileURL} from 'node:url';
import {readCsv, number, round, writeCsv, writeJson, writeText, format} from './model-utils.mjs';
import {buildHealthCanadaEnergy} from './calc-health-canada-energy.mjs';
import {calculateFoodEvidence} from './calc-evidence-food.mjs';
import {buildEvidenceHeating} from './calc-evidence-heating.mjs';
import {calculateWoodyLand} from './calc-evidence-woody.mjs';
import {buildHouseholdCapacity, householdProfiles, siteClasses, policySiteMap} from './calc-household-capacity.mjs';

export const transitionYears = [1, 2, 3, 5, 8, 10, 15, 'mature'];
const matureYear = 20;
const transitionLossReserveCases = [.20, .30, .40];
const annualReserveFraction = .25;
const annualIntercropOverlap = {1: .75, 2: .75, 3: .60, 5: .40, 8: .15, 10: .05, 15: 0, mature: 0};

const composition = Object.fromEntries(readCsv('data/source/current-food-composition.csv').map(row => [row.food_id, row]));
const sourceRows = readCsv('data/source/perennial-yield-evidence.csv');

const curveAnchors = {
  conservative: {
    early_bearing_perennial: {1: 0, 2: .10, 3: .40, 5: .70, 8: .90, 10: .95, 15: 1, 20: 1},
    intermediate_perennial: {1: 0, 2: 0, 3: .03, 5: .20, 8: .45, 10: .65, 15: .90, 20: 1},
    late_bearing_staple: {1: 0, 2: 0, 3: 0, 5: .03, 8: .10, 10: .20, 15: .55, 20: 1}
  },
  central: {
    early_bearing_perennial: {1: 0, 2: .25, 3: .60, 5: .90, 8: 1, 10: 1, 15: 1, 20: 1},
    intermediate_perennial: {1: 0, 2: 0, 3: .08, 5: .35, 8: .65, 10: .85, 15: 1, 20: 1},
    late_bearing_staple: {1: 0, 2: 0, 3: 0, 5: .05, 8: .18, 10: .35, 15: .75, 20: 1}
  },
  favourable: {
    early_bearing_perennial: {1: 0, 2: .40, 3: .80, 5: 1, 8: 1, 10: 1, 15: 1, 20: 1},
    intermediate_perennial: {1: 0, 2: .03, 3: .15, 5: .50, 8: .80, 10: 1, 15: 1, 20: 1},
    late_bearing_staple: {1: 0, 2: 0, 3: .01, 5: .10, 8: .30, 10: .55, 15: .90, 20: 1}
  }
};

// These are yield bands around the central synthesis, not claims of measured
// Grey-Bruce production. The central rows themselves are conservative
// adjustments of extension/commercial references with explicit evidence gaps.
const yieldMultipliers = {conservative: .65, central: 1, favourable: 1.25};

const mix = [
  {id: 'early_berry_low_input_synthesis', area_share: .25, class: 'early_bearing_perennial'},
  {id: 'intermediate_hazelnut_low_input_synthesis', area_share: .25, class: 'intermediate_perennial'},
  {id: 'long_staple_chestnut_low_input_synthesis', area_share: .25, class: 'late_bearing_staple'},
  {id: 'intermediate_apple_low_input_synthesis', area_share: .25, class: 'intermediate_perennial'}
];

function interpolate(anchors, year) {
  if (year === 'mature') return 1;
  const x = Number(year);
  const points = Object.entries(anchors).map(([key, value]) => [Number(key), value]).sort((a, b) => a[0] - b[0]);
  if (x <= points[0][0]) return points[0][1];
  if (x >= points.at(-1)[0]) return points.at(-1)[1];
  for (let i = 1; i < points.length; i++) {
    const [x2, y2] = points[i];
    const [x1, y1] = points[i - 1];
    if (x <= x2) return y1 + (y2 - y1) * ((x - x1) / (x2 - x1));
  }
  return 0;
}

function evidenceYield(row) {
  const c = composition[row.composition_id];
  const yieldT = number(row.mature_yield_t_ha_year);
  if (!c || yieldT === null) return {...row, mature_food_gj_ha_year: null, protein_kg_ha: null, fat_kg_ha: null, carbohydrate_kg_ha: null};
  const usable = yieldT * (number(row.usable_fraction) ?? 1);
  return {
    ...row,
    mature_food_gj_ha_year: round(usable * number(c.energy_kj_per_100g) * .01, 6),
    protein_kg_ha: round(usable * number(c.protein_g_per_100g) * 10, 6),
    fat_kg_ha: round(usable * number(c.fat_g_per_100g) * 10, 6),
    carbohydrate_kg_ha: round(usable * number(c.carbohydrate_g_per_100g) * 10, 6),
    energy_density_kj_per_100g: number(c.energy_kj_per_100g),
    source_composition: c.source
  };
}

export function calculatePerennialEvidence() {
  const rows = sourceRows.map(evidenceYield);
  const byId = Object.fromEntries(rows.map(row => [row.id, row]));
  const mixRows = mix.map(item => ({...item, ...byId[item.id]}));
  const mature = mixRows.reduce((total, row) => total + row.area_share * row.mature_food_gj_ha_year, 0);
  const macros = ['protein_kg_ha', 'fat_kg_ha', 'carbohydrate_kg_ha'].reduce((out, key) => {
    out[key] = round(mixRows.reduce((total, row) => total + row.area_share * row[key], 0), 6);
    return out;
  }, {});
  const output = {
    source: 'data/source/perennial-yield-evidence.csv + data/source/current-food-composition.csv',
    rows,
    mix: mixRows,
    central_mix: {name: 'four-function perennial food mix', mature_food_gj_ha_year: round(mature, 6), ...macros, composition: '25% early berry/vitamin layer; 25% hazelnut fat/protein layer; 25% chestnut starch layer; 25% fruit/storage layer'},
    curve_anchors: curveAnchors,
    yield_multipliers: yieldMultipliers,
    evidence_limitations: [
      'No replicated, long-term, near-zero-input perennial food-forest yield trial for ordinary Grey-Bruce land was located.',
      'Ontario hazelnut guidance explicitly says the province has no established hazelnut yield history; the central 0.75 t/ha value is an unvalidated conservative synthesis.',
      'Chestnut bearing-time evidence is regionally relevant but yield evidence is mainly outside Ontario; chestnut suitability, blight, frost and wildlife risk remain unresolved.',
      'Heartnut and oak/acorn functions are documented but excluded from the central calorie mix because no defensible Grey-Bruce yield series was found.',
      'The curves are bounded interpolations between published bearing-time anchors and planning milestones, not annual field measurements.'
    ]
  };
  writeJson('data/derived/perennial-yield-evidence.json', output);
  writeCsv('data/derived/perennial-yield-evidence.csv', [
    ['id','species','functional_class','role','first_meaningful_crop_year','substantial_crop_year','mature_year','mature_yield_t_ha_year','yield_mean_t_ha_year','yield_median_t_ha_year','yield_range_t_ha_year','mature_food_gj_ha_year','protein_kg_ha','fat_kg_ha','carbohydrate_kg_ha','input_intensity','evidence_type','canonical_status','source','notes'],
    ...rows.map(row => [row.id,row.species,row.functional_class,row.role,row.first_meaningful_crop_year,row.substantial_crop_year,row.mature_year,row.mature_yield_t_ha_year,row.yield_mean_t_ha_year,row.yield_median_t_ha_year,row.yield_range_t_ha_year,row.mature_food_gj_ha_year,row.protein_kg_ha,row.fat_kg_ha,row.carbohydrate_kg_ha,row.input_intensity,row.evidence_type,row.canonical_status,row.source,row.notes])
  ]);
  return output;
}

function rowFor(capacity, site, household) {
  return capacity.rows.find(row => row.site === site && row.household === household);
}

function lossLabel(loss) { return `${Math.round(loss * 100)}%`; }

function annualRequirements(demand, annualYield, loss) {
  return {
    loss_or_reserve_fraction: loss,
    gross_area_ha: round(demand / annualYield, 6),
    after_loss_reserve_area_ha: round(demand / (annualYield * (1 - loss)), 6),
    net_yield_gj_ha_year: round(annualYield * (1 - loss), 6)
  };
}

function annualAreaForResidual(residualGJ, annualNetYield, minimumAnnualArea = 0) {
  return Math.max(minimumAnnualArea, residualGJ > 0 ? residualGJ / annualNetYield : 0);
}

function maxInitialForestAlongsideAnnual(foodEnvelope, annualArea, overlapFraction) {
  if (annualArea > foodEnvelope) return 0;
  // If the forest is smaller than the annual zone, overlap is a fraction of
  // the forest. If it is larger, overlap is a fraction of the annual zone.
  // Solve both branches and select the largest feasible footprint.
  const smallerForestLimit = Math.min(annualArea, (foodEnvelope - annualArea) / Math.max(.000001, 1 - overlapFraction));
  const largerForestLimit = foodEnvelope - (1 - overlapFraction) * annualArea;
  return round(Math.max(0, largerForestLimit >= annualArea ? largerForestLimit : smallerForestLimit), 6);
}

function maxForestThatFitsAllYears({demand, annualYield, upperForestArea, siteMultiplier, yieldCase, curveCase, loss, strategy, mixRows, foodEnvelope}) {
  if (upperForestArea <= 0 || foodEnvelope <= 0) return 0;
  let best = 0;
  // A fine grid is preferable to a false precision claim here: it makes the
  // area constraint transparent while avoiding a monotonicity assumption in
  // the changing annual/perennial overlap schedule.
  const steps = 100;
  for (let i = 0; i <= steps; i++) {
    const forestArea = upperForestArea * i / steps;
    const rows = transitionSeries({demand, annualYield, forestArea, siteMultiplier, yieldCase, curveCase, loss, strategy, mixRows, foodEnvelope});
    if (rows.every(row => !row.annual_land_limited)) best = forestArea;
  }
  return round(best, 6);
}

function classProduction(mixRows, forestArea, siteMultiplier, yieldCase, curveCase, year) {
  return mixRows.map(row => {
    const fraction = interpolate(curveAnchors[curveCase][row.class], year);
    const gross = forestArea * row.area_share * row.mature_food_gj_ha_year * siteMultiplier * yieldMultipliers[yieldCase] * fraction;
    return {
      id: row.id,
      functional_class: row.class,
      area_share: row.area_share,
      yield_fraction: round(fraction, 6),
      gross_food_gj: round(gross, 6),
      usable_food_gj: round(gross, 6)
    };
  });
}

function sumProduction(rows) { return rows.reduce((sum, row) => sum + row.gross_food_gj, 0); }

function transitionSeries({demand, annualYield, forestArea, siteMultiplier, yieldCase, curveCase, loss, strategy, mixRows, foodEnvelope}) {
  const annualNetYield = annualYield * (1 - loss);
  const initialBridgeArea = demand / annualNetYield;
  const reserveArea = demand * annualReserveFraction / annualNetYield;
  return transitionYears.map(year => {
    const perennialClasses = classProduction(mixRows, forestArea, siteMultiplier, yieldCase, curveCase, year);
    const perennialGross = sumProduction(perennialClasses);
    const perennialUsable = perennialGross * (1 - loss);
    const residual = Math.max(0, demand - perennialUsable);
    const requestedAnnualArea = strategy === 'constant_annual_reserve'
      ? annualAreaForResidual(residual, annualNetYield, reserveArea)
      : annualAreaForResidual(residual, annualNetYield, 0);
    const overlapFraction = annualIntercropOverlap[year] ?? 0;
    const maximumAnnualArea = forestArea <= 0
      ? foodEnvelope
      : forestArea >= requestedAnnualArea
        ? (foodEnvelope - forestArea) / Math.max(.000001, 1 - overlapFraction)
        : foodEnvelope - (1 - overlapFraction) * forestArea;
    const annualArea = Math.min(requestedAnnualArea, Math.max(0, maximumAnnualArea));
    const annualGross = annualArea * annualYield;
    const annualUsable = annualGross * (1 - loss);
    const overlap = Math.min(annualArea, forestArea) * overlapFraction;
    const occupied = annualArea + forestArea - overlap;
    const totalUsable = annualUsable + perennialUsable;
    const classTotals = Object.fromEntries(perennialClasses.map(row => [row.functional_class, round(row.usable_food_gj, 6)]));
    const intentionalAnnualReserveGJ = strategy === 'constant_annual_reserve' ? demand * annualReserveFraction : 0;
    return {
      year,
      perennial_curve_case: curveCase,
      annual_area_required_ha: round(requestedAnnualArea, 6),
      annual_area_ha: round(annualArea, 6),
      annual_gross_food_gj: round(annualGross, 6),
      annual_usable_food_gj: round(annualUsable, 6),
      perennial_area_ha: round(forestArea, 6),
      perennial_gross_food_gj: round(perennialGross, 6),
      perennial_usable_food_gj: round(perennialUsable, 6),
      perennial_by_function_usable_gj: classTotals,
      total_usable_food_gj: round(totalUsable, 6),
      household_food_coverage_ratio: round(totalUsable / demand, 6),
      perennial_food_coverage_ratio: round(perennialUsable / demand, 6),
      household_food_surplus_or_deficit_gj: round(totalUsable - demand, 6),
      intentional_annual_reserve_food_gj: round(intentionalAnnualReserveGJ, 6),
      exportable_food_energy_surplus_gj: round(Math.max(0, totalUsable - demand - intentionalAnnualReserveGJ), 6),
      annual_land_limited: annualArea + 1e-9 < requestedAnnualArea,
      food_supplied_percent: {annual: round(annualUsable / demand * 100, 3), perennial: round(perennialUsable / demand * 100, 3)},
      released_annual_area_ha: round(Math.max(0, initialBridgeArea - annualArea), 6),
      young_forest_annual_intercrop_overlap_ha: round(overlap, 6),
      occupied_food_production_area_ha: round(occupied, 6),
      land_double_counted_as_if_separate_ha: round(overlap, 6),
      class_production: perennialClasses
    };
  });
}

function thresholds(series) {
  return Object.fromEntries([.25, .50, .75, 1].map(threshold => {
    const first = series.find(row => row.perennial_food_coverage_ratio >= threshold);
    return [`${Math.round(threshold * 100)}%`, first ? first.year : null];
  }));
}

function perennialAreaRequirements(demand, matureYield, loss) {
  return Object.fromEntries([.25, .50, .75, 1].map(share => [
    `${Math.round(share * 100)}%`, round(demand * share / (matureYield * (1 - loss)), 6)
  ]));
}

function quarterHectareTests({capacity, food, households = Object.keys(householdProfiles)}) {
  return Object.entries(policySiteMap).flatMap(([policySite, siteId]) => households.flatMap(household => {
    const row = rowFor(capacity, siteId, household);
    const annualYield = row.food_system.gross_energy_per_ha;
    return transitionLossReserveCases.map(loss => {
      const usable = .25 * annualYield * (1 - loss);
      return {policy_site: policySite, site: siteId, household, household_label: row.household_label, loss_or_reserve_fraction: loss, annual_gross_yield_gj: round(.25 * annualYield, 6), annual_usable_food_gj: round(usable, 6), household_food_demand_gj: row.household_energy_gj_year, surplus_or_deficit_gj: round(usable - row.household_energy_gj_year, 6), supports_household: usable >= row.household_energy_gj_year};
    });
  }));
}

function householdTransition({capacity, perennial, food, siteId, householdId, yieldCase = 'central', curveCase = 'central'}) {
  const capacityRow = rowFor(capacity, siteId, householdId);
  const site = siteClasses[siteId];
  const demand = capacityRow.household_energy_gj_year;
  const annualYield = capacityRow.food_system.gross_energy_per_ha;
  const mixRows = perennial.mix;
  const centralMixYield = perennial.central_mix.mature_food_gj_ha_year * site.food_multiplier * yieldMultipliers[yieldCase];
  const annual = Object.fromEntries(transitionLossReserveCases.map(loss => [lossLabel(loss), annualRequirements(demand, annualYield, loss)]));
  const matureAreas = Object.fromEntries(transitionLossReserveCases.map(loss => [lossLabel(loss), perennialAreaRequirements(demand, centralMixYield, loss)]));
  const loss = .30;
  const annualBridgeArea = demand / (annualYield * (1 - loss));
  const foodEnvelope = Math.max(0, capacityRow.arc_policy_allocation_ha - capacityRow.heating_area_ha);
  const foodForestAreaAtArc = Math.min(demand / (centralMixYield * (1 - loss)), foodEnvelope);
  const forestEstablishableAlongsideBridge = maxInitialForestAlongsideAnnual(foodEnvelope, annualBridgeArea, annualIntercropOverlap[1]);
  const initialForestArea = Math.min(foodForestAreaAtArc, forestEstablishableAlongsideBridge);
  const series = {};
  for (const strategy of ['constant_annual_reserve', 'progressive_handoff']) {
    const forestAreaUsed = maxForestThatFitsAllYears({demand, annualYield, upperForestArea: Math.min(foodForestAreaAtArc, initialForestArea), siteMultiplier: site.food_multiplier, yieldCase, curveCase, loss, strategy, mixRows, foodEnvelope});
    const rows = transitionSeries({demand, annualYield, forestArea: forestAreaUsed, siteMultiplier: site.food_multiplier, yieldCase, curveCase, loss, strategy, mixRows, foodEnvelope});
    series[strategy] = {forest_area_used_ha: forestAreaUsed, description: strategy === 'constant_annual_reserve' ? 'Annual acreage contracts only until a 25% food-demand annual reserve floor is reached, then remains at that floor.' : 'Annual acreage contracts to the residual food requirement and can reach zero when the perennial mix covers demand; no extra annual reserve floor is imposed.', thresholds: thresholds(rows), rows};
  }
  const transitionSensitivity = {};
  for (const scenario of ['conservative', 'favourable']) {
    const scenarioYield = perennial.central_mix.mature_food_gj_ha_year * site.food_multiplier * yieldMultipliers[scenario];
    const scenarioTarget = Math.min(demand / (scenarioYield * (1 - loss)), foodEnvelope);
    const scenarioInitialPotential = maxInitialForestAlongsideAnnual(foodEnvelope, annualBridgeArea, annualIntercropOverlap[1]);
    const scenarioSeries = {};
    for (const strategy of ['constant_annual_reserve', 'progressive_handoff']) {
      const forestAreaUsed = maxForestThatFitsAllYears({demand, annualYield, upperForestArea: Math.min(scenarioTarget, scenarioInitialPotential), siteMultiplier: site.food_multiplier, yieldCase: scenario, curveCase: scenario, loss, strategy, mixRows, foodEnvelope});
      const rows = transitionSeries({demand, annualYield, forestArea: forestAreaUsed, siteMultiplier: site.food_multiplier, yieldCase: scenario, curveCase: scenario, loss, strategy, mixRows, foodEnvelope});
      scenarioSeries[strategy] = {forest_area_used_ha: forestAreaUsed, mature_perennial_food_coverage_ratio: rows.at(-1).perennial_food_coverage_ratio, thresholds: thresholds(rows), rows};
    }
    transitionSensitivity[scenario] = {mature_mix_gross_yield_gj_ha_year: round(scenarioYield, 6), long_term_forest_target_ha: round(scenarioTarget, 6), transition: scenarioSeries};
  }
  const quarter = transitionLossReserveCases.map(lossCase => {
    const usable = .25 * annualYield * (1 - lossCase);
    return {loss_or_reserve_fraction: lossCase, usable_food_gj: round(usable, 6), surplus_or_deficit_gj: round(usable - demand, 6), supports_household: usable >= demand};
  });
  const matureMacro = Object.fromEntries(['protein_kg_ha', 'fat_kg_ha', 'carbohydrate_kg_ha'].map(key => [key, round(perennial.central_mix[key] * site.food_multiplier * yieldMultipliers[yieldCase], 6)]));
  const fullCalorieAreaAt30 = matureAreas['30%']['100%'];
  const deliveredMacroAtFullCalories = Object.fromEntries(Object.entries(matureMacro).map(([key, value]) => [key, round(value * fullCalorieAreaAt30 * (1 - loss), 6)]));
  return {
    site: siteId,
    site_label: site.label,
    household: householdId,
    household_label: capacityRow.household_label,
    household_food_demand_gj_year: demand,
    food_adult_equivalents: capacityRow.food_adult_equivalents,
    adult_equivalent_scope: 'food-energy normalization only; not a total-land multiplier',
    annual_crop_gross_yield_gj_ha_year: round(annualYield, 6),
    annual_crop_requirements: annual,
    perennial_mature_mix_gross_yield_gj_ha_year: round(centralMixYield, 6),
    perennial_mature_mix_macro_output_per_ha: matureMacro,
    perennial_macro_screen_at_full_calorie_area: {delivered_kg_year: deliveredMacroAtFullCalories, protein_g_day: round(deliveredMacroAtFullCalories.protein_kg_ha * 1000 / 365.25, 3), protein_screen_target_g_day: capacityRow.food_system.protein_reference_target_g_day, note: 'Coarse protein/fat/carbohydrate screen only; does not establish micronutrient, amino-acid, fatty-acid, processing, storage or dietary adequacy.'},
    perennial_area_required_at_maturity_ha: matureAreas,
    arc_allocation_ha: capacityRow.arc_policy_allocation_ha,
    shared_heating_area_ha: capacityRow.heating_area_ha,
    food_production_envelope_at_arc_allocation_ha: round(foodEnvelope, 6),
    annual_bridge_area_at_30_percent_loss_or_reserve_ha: round(annualBridgeArea, 6),
    long_term_food_forest_area_target_at_arc_allocation_ha: round(foodForestAreaAtArc, 6),
    initial_food_forest_area_alongside_full_annual_bridge_ha: round(initialForestArea, 6),
    food_forest_area_establishable_alongside_full_annual_bridge_ha: round(forestEstablishableAlongsideBridge, 6),
    land_accounting_note: 'Annual and perennial hectares are partitioned through occupied_food_production_area_ha. Young-row annual intercropping is represented as overlap; overlap is not added as a second hectare.',
    transition: series,
    transition_sensitivity: transitionSensitivity,
    quarter_hectare_annual_test: quarter
  };
}

function sourceMarkdown(perennial) {
  const rows = perennial.rows;
  return `# Perennial yield and establishment evidence

The transition model uses a four-function central mix: 25% early berries, 25% hazelnut, 25% chestnut and 25% fruit/storage trees. The mix is a planning synthesis, not a measured Grey-Bruce food forest. Heartnut and oak/acorn functions are retained as evidence rows but excluded from the calorie anchor until local yield trials exist.

| crop/layer | first meaningful crop | substantial crop | mature milestone | central yield | central food energy | status |
|---|---:|---:|---:|---:|---:|---|
${rows.filter(row => row.mature_food_gj_ha_year !== null || row.canonical_status === 'reference only').map(row => `| ${row.species} | ${row.first_meaningful_crop_year} | ${row.substantial_crop_year} | ${row.mature_year || 'n/a'} | ${row.mature_yield_t_ha_year || 'n/a'} t/ha | ${row.mature_food_gj_ha_year === null ? 'n/a' : format(row.mature_food_gj_ha_year, 1) + ' GJ/ha'} | ${row.canonical_status} |`).join('\n')}

## Evidence interpretation

- Ontario raspberry guidance reports no crop in the planting year, a small second-year crop and full production in year 3; the Ontario farm-starting guide gives 5–10 t/ha as a typical commercial-scale yield range. The model uses 3 t/ha as a low-input synthesis, not the commercial midpoint.
- Ontario's hazelnut economic model supplies a useful bearing curve—15%, 30%, 45%, 60%, 75%, 90% in years 5–10 and full production in year 11—but explicitly says Ontario has no established yield history. The model uses 0.75 t/ha as an unvalidated low-input synthesis and flags it accordingly.
- Ontario recovery material says American chestnut can begin producing seed at about year 8. Chestnut production references from comparable climates support the function, but not a Grey-Bruce yield. The model therefore uses 0.75 t/ha as a conservative synthesis and treats climate, blight, frost and wildlife as unresolved.
- Ontario heartnut information supports the species as a possible food-tree function and gives commercial production timing, but reports no Ontario fertility recommendations and no yield series. Heartnut is not used in the central calorie yield.
- The production curves are bounded interpolations between those evidence anchors. They are scenarios, not claims that yield increases linearly in real orchards.

Sources: [OMAFRA raspberry guidance](https://www.ontario.ca/page/growing-raspberries-and-blackberries-home-gardens), [OMAFRA Starting a Farm 101](https://files.ontario.ca/omafra-starting-a-farm-in-ontario-pub-61-en-2023-04-21.pdf), [OMAFRA hazelnut economic report](https://www.ontario.ca/page/2018-economic-report-establishment-and-production-costs-hazelnuts-ontario), [Ontario American chestnut recovery strategy](https://www.ontario.ca/page/american-chestnut-recovery-strategy), [UC ANR chestnut fact sheet](https://ucanr.edu/site/fruit-nut-research-information-center/chestnut-fact-sheet), [OMAFRA heartnut information](https://omafra.gov.on.ca/CropOp/en/spec_fruit/nuts/hear.html).
`;
}

function annualMarkdown(output) {
  const ordinary = output.households.filter(row => row.site === 'ordinary_mesic');
  return `# Annual-crop establishment food

Annual crops are the establishment bridge. The current evidence-based balanced low-input annual system is used at its gross yield, then the model applies explicit loss/reserve cases of 20%, 30% and 40%. These are scenario deductions, not additional land double-counting.

| household | gross annual yield | area at gross yield | area after 20% | area after 30% | area after 40% |
|---|---:|---:|---:|---:|---:|
${ordinary.map(row => `| ${row.household_label} | ${format(row.annual_crop_gross_yield_gj_ha_year, 1)} GJ/ha | ${format(row.annual_crop_requirements['30%'].gross_area_ha, 2)} ha | ${format(row.annual_crop_requirements['20%'].after_loss_reserve_area_ha, 2)} ha | ${format(row.annual_crop_requirements['30%'].after_loss_reserve_area_ha, 2)} ha | ${format(row.annual_crop_requirements['40%'].after_loss_reserve_area_ha, 2)} ha |`).join('\n')}

## The 0.25 ha test

At the ordinary site, 0.25 ha produces ${format(ordinary.find(row => row.household === 'one_adult').quarter_hectare_annual_test[1].usable_food_gj, 2)} GJ after a 30% loss/reserve case for one adult, but only ${format(ordinary.find(row => row.household === 'adult_plus_child').quarter_hectare_annual_test[1].usable_food_gj, 2)} GJ is available against ${format(ordinary.find(row => row.household === 'adult_plus_child').household_food_demand_gj_year, 2)} GJ for one adult plus one child. Under this model, 0.25 ha is an adult-scale annual food zone, not a universal household allocation.

The full favourable/ordinary/marginal household tests are in ` + '`outputs/food-forest-transition.json`' + `. Marginal sites can fail the 0.25 ha test even for one adult at the higher loss/reserve cases because the current model applies a 0.50 food-productivity multiplier.

Annual crops can carry establishment only if the annual food area fits within the available food-production envelope, or if young food-forest rows are used for plausible alleys/intercrops. The transition model records that overlap explicitly and subtracts it from occupied land.
`;
}

function matureMarkdown(output) {
  const ordinary = output.households.filter(row => row.site === 'ordinary_mesic');
  const adult = ordinary.find(row => row.household === 'one_adult');
  return `# Mature food-forest capacity

The central perennial mix yields **${format(output.perennial_evidence.central_mix.mature_food_gj_ha_year, 1)} GJ/ha/year gross** before the same 30% loss/reserve case. It contains a starch-bearing chestnut layer, a fat/protein-bearing hazelnut layer, early berries and fruit/storage diversity. It is calorie-plausible but not a proof of complete micronutrient, amino-acid, fatty-acid or seasonal adequacy.

For one adult on an ordinary site, the mature mix requires ${format(adult.perennial_area_required_at_maturity_ha['30%']['100%'], 2)} ha at the 30% loss/reserve case to supply all food energy. The central 1 ha ARC allocation leaves ${format(adult.food_production_envelope_at_arc_allocation_ha, 2)} ha after shared heating, so the mature mix can cover the food energy in this scenario only if the resilience/ecological allowances are also accommodated elsewhere or the food mix/yield performs better than the central synthesis. At that full-calorie area, the coarse protein screen supplies ${format(adult.perennial_macro_screen_at_full_calorie_area.protein_g_day, 0)} g/day against ${format(adult.perennial_macro_screen_at_full_calorie_area.protein_screen_target_g_day, 0)} g/day; this is a warning that calorie sufficiency is not nutritional adequacy.

| household | 25% food | 50% food | 75% food | 100% food | mature area available within ARC food envelope |
|---|---:|---:|---:|---:|---:|
${ordinary.map(row => `| ${row.household_label} | ${format(row.perennial_area_required_at_maturity_ha['30%']['25%'], 2)} ha | ${format(row.perennial_area_required_at_maturity_ha['30%']['50%'], 2)} ha | ${format(row.perennial_area_required_at_maturity_ha['30%']['75%'], 2)} ha | ${format(row.perennial_area_required_at_maturity_ha['30%']['100%'], 2)} ha | ${format(row.food_production_envelope_at_arc_allocation_ha, 2)} ha |`).join('\n')}

The mature mix does not rely on one exceptional crop. Nevertheless, its central yield is partly modelled because Ontario lacks a long-term, low-input, mixed perennial trial applicable to Grey-Bruce. Heartnut, oak/acorn and perennial vegetable yields remain separate research needs.
`;
}

function householdMarkdown(output) {
  const rows = output.households.filter(row => ['wetter_productive', 'ordinary_mesic', 'shallow_rocky_marginal'].includes(row.site));
  return `# Household food-forest transition scenarios

Adult-equivalent remains a food-energy normalization only. Heating is a shared dwelling component, while resilience, ecological buffers and market/export functions are household/site components. Annual and perennial food hectares are partitioned in each year's occupied-food-area result; young-row intercropping is recorded as overlap rather than counted twice.

| site | household | food GJ/year | food adult-equiv. | annual area at 30% | mature perennial area for 100% | long-term forest target | strict transition forest area | mature perennial coverage | mature annual residual |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
${rows.map(row => { const mature = row.transition.progressive_handoff.rows.at(-1); return `| ${row.site_label} | ${row.household_label} | ${format(row.household_food_demand_gj_year, 2)} | ${format(row.food_adult_equivalents, 2)} | ${format(row.annual_bridge_area_at_30_percent_loss_or_reserve_ha, 2)} ha | ${format(row.perennial_area_required_at_maturity_ha['30%']['100%'], 2)} ha | ${format(row.long_term_food_forest_area_target_at_arc_allocation_ha, 2)} ha | ${format(row.transition.progressive_handoff.forest_area_used_ha, 2)} ha | ${format(mature.perennial_food_coverage_ratio * 100, 0)}% | ${format(mature.annual_area_ha, 2)} ha |`; }).join('\n')}

The full annual handoff years and thresholds are in the JSON. On an ordinary site, annual crops cover the non-bearing years for the listed households when the annual bridge fits within the food envelope. Long-term perennial replacement is more constrained: children increase household demand while the dwelling heat load is shared. The strict-transition footprint is the largest single forest footprint that keeps every modelled year within the food envelope as intercropping declines; a staged expansion can use released annual land later, but newly planted rows must receive their own slower production curve.
`;
}

function transitionMarkdown(output) {
  const ordinaryAdult = output.households.find(row => row.site === 'ordinary_mesic' && row.household === 'one_adult');
  const ordinaryFamily = output.households.find(row => row.site === 'ordinary_mesic' && row.household === 'two_adults_plus_two_children');
  const centralAdultSeries = ordinaryAdult.transition.progressive_handoff.rows;
  const centralFamilySeries = ordinaryFamily.transition.progressive_handoff.rows;
  const rowTable = row => row.map(year => `| ${year.year} | ${format(year.annual_usable_food_gj, 2)} | ${format(year.perennial_usable_food_gj, 2)} | ${format(year.total_usable_food_gj, 2)} | ${format(year.household_food_coverage_ratio * 100, 0)}% | ${format(year.annual_area_ha, 2)} | ${format(year.released_annual_area_ha, 2)} | ${format(year.occupied_food_production_area_ha, 2)} |`).join('\n');
  return `# Food-forest transition through time

## Answer in brief

Yes, annual crops can independently feed the household during perennial establishment **when the annual bridge area fits the site's available food-production envelope**. The transition is not a static mature-landscape calculation: young trees and shrubs can share alleys with annuals, then annual acreage is progressively released as perennial production becomes material. The central model does not support saying that every household can replace all calories with a mature perennial mix on 1 or 2 ha; that result depends on household demand, site productivity and whether resilience/ecological land is counted.

For an ordinary site, the central progressive-handoff model reaches 25%, 50%, 75% and 100% of one adult's calories from perennials in years ${Object.values(ordinaryAdult.transition.progressive_handoff.thresholds).map(value => value ?? 'never').join(', ')}. For two adults plus two children the corresponding thresholds are ${Object.values(ordinaryFamily.transition.progressive_handoff.thresholds).map(value => value ?? 'never').join(', ')}. These are scenario years, not field predictions. The one-adult conservative and favourable threshold sequences are ${Object.values(ordinaryAdult.transition_sensitivity.conservative.transition.progressive_handoff.thresholds).map(value => value ?? 'never').join(', ')} and ${Object.values(ordinaryAdult.transition_sensitivity.favourable.transition.progressive_handoff.thresholds).map(value => value ?? 'never').join(', ')} respectively.

## Ordinary-site progressive handoff: one adult

| year | annual usable GJ | perennial usable GJ | total usable GJ | coverage | annual area | released area | occupied food area |
|---|---:|---:|---:|---:|---:|---:|---:|
${rowTable(centralAdultSeries)}

## Ordinary-site progressive handoff: 2 adults + 2 children

| year | annual usable GJ | perennial usable GJ | total usable GJ | coverage | annual area | released area | occupied food area |
|---|---:|---:|---:|---:|---:|---:|---:|
${rowTable(centralFamilySeries)}

Strategy A keeps a 25% annual food-demand reserve after the perennial system supplies the remaining demand. Strategy B progressively hands annual acreage to perennials and does not impose that additional annual reserve floor. Both strategies use the same explicit 30% loss/reserve case and the same young-row overlap schedule.

The transition is sized to cover household food rather than to consume the deliberate export allowance. The ` + '`exportable_food_energy_surplus_gj`' + ` field is therefore zero in the central progressive case; Strategy A's extra output is intentionally retained as annual reserve. Exportable calories require additional land or production assigned to market/community output, which remains separate from this household handoff calculation.

The strict food-forest footprint is established from year 1 in the model, but annual crops can occupy plausible young-tree alleys. At year 1, the model applies ${Math.round(annualIntercropOverlap[1] * 100)}% overlap; by year 15 and mature state it applies no overlap. This is a land-accounting assumption, not a claim that every crop is agronomically compatible with every tree row. The long-term target can be larger than the strict footprint; filling it requires staged planting after annual land is released.

See ` + '`outputs/annual-establishment-food.md`' + ` for the 0.25 ha test, ` + '`outputs/mature-food-forest-capacity.md`' + ` for mature area requirements and ` + '`outputs/household-transition-scenarios.md`' + ` for the site/household table.
`;
}

export function buildFoodForestTransition(energy = buildHealthCanadaEnergy(), food = calculateFoodEvidence(), heating = buildEvidenceHeating(), woody = calculateWoodyLand(heating), capacity = buildHouseholdCapacity(energy, food, heating, woody)) {
  const perennial = calculatePerennialEvidence();
  const households = Object.entries(siteClasses).flatMap(([siteId]) => Object.keys(householdProfiles).map(household => householdTransition({capacity, perennial, food, siteId, householdId: household})));
  const output = {
    model: 'evidence-based ARC food-forest transition',
    status: 'current evidence-based model; historical Lyis values are provenance only',
    years: transitionYears,
    mature_year_assumption: matureYear,
    loss_reserve_cases: transitionLossReserveCases,
    annual_reserve_fraction_after_handoff: annualReserveFraction,
    annual_intercrop_overlap_by_year: annualIntercropOverlap,
    annual_crop_basis: {source: 'current evidence-based balanced low-input annual food system', gross_yield_gj_ha_year: 'site-specific from current evidence model', note: 'The 20/30/40% cases are explicit transition scenarios and are not the same as the canonical household model’s detailed storage/wildlife/seed/reserve accounting.'},
    perennial_evidence: perennial,
    site_classes: siteClasses,
    policy_site_map: policySiteMap,
    households,
    quarter_hectare_tests: quarterHectareTests({capacity, food}),
    land_accounting: {rule: 'annual_area + perennial_area - young_row_intercrop_overlap = occupied food-production area', no_double_counting_test: 'occupied food-production area must be compared with allocation minus shared heating; resilience/ecological allowances remain separate and are not silently converted into food hectares.'}
  };
  writeJson('outputs/food-forest-transition.json', output);
  writeText('outputs/perennial-yield-evidence.md', sourceMarkdown(perennial));
  writeText('outputs/annual-establishment-food.md', annualMarkdown(output));
  writeText('outputs/mature-food-forest-capacity.md', matureMarkdown(output));
  writeText('outputs/household-transition-scenarios.md', householdMarkdown(output));
  writeText('outputs/food-forest-transition.md', transitionMarkdown(output));
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) buildFoodForestTransition();
