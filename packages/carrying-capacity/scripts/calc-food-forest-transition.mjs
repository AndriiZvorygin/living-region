import {pathToFileURL} from 'node:url';
import {readCsv, number, round, writeCsv, writeJson, writeText, format} from './model-utils.mjs';
import {buildHealthCanadaEnergy} from './calc-health-canada-energy.mjs';
import {calculateFoodEvidence} from './calc-evidence-food.mjs';
import {buildEvidenceHeating} from './calc-evidence-heating.mjs';
import {calculateWoodyLand} from './calc-evidence-woody.mjs';
import {buildHouseholdCapacity, householdProfiles, siteClasses, policySiteMap} from './calc-household-capacity.mjs';
import {calculateFoodSystemLabour, calculateTransitionLabour} from './calc-food-system-labour.mjs';
import {buildLivestockScenarios} from './calc-livestock.mjs';
import {buildMatureFoodSystem} from './calc-mature-food-system.mjs';
import {selectPerennialMixForSite} from '../src/environment.mjs';
import {calculateEstablishmentLandRequirement} from '../src/establishment.mjs';

export const transitionYears = [1, 2, 3, 5, 8, 10, 15, 'mature'];
const matureYear = 20;
const transitionLossReserveCases = [.20, .30, .40];
const annualReserveFraction = .25;
const annualIntercropOverlap = {1: .75, 2: .75, 3: .60, 5: .40, 8: .15, 10: .05, 15: 0, mature: 0};

const composition = Object.fromEntries(readCsv('data/source/current-food-composition.csv').map(row => [row.food_id, row]));
const sourceRows = readCsv('data/source/perennial-yield-evidence.csv');
const perennialProteinRows = readCsv('data/source/perennial-protein-evidence.csv');

const perennialResearchUpdates = [
  {species: 'Hazelnut', source: 'https://www.mdpi.com/2071-1050/17/4/1543', source_date: '2025', evidence_status: 'measured Ontario on-farm trial; short series', finding: 'Fertility treatments and cultivar/site performance are being measured in Ontario, strengthening the evidence base without establishing a Grey-Bruce low-input mature yield.', canonical_action: 'retain the existing conservative planning synthesis; do not promote to a measured canonical yield.'},
  {species: 'White oak/acorn systems', source: 'https://research.fs.usda.gov/treesearch/36770', source_date: '2009', evidence_status: 'measured comparable-climate forest study; high inter-tree and year variability', finding: 'Acorn production can be measured but is strongly episodic and uneven among trees and sites.', canonical_action: 'retain research-only status; do not credit acorn calories to the central mix.'},
  {species: 'Chinese chestnut', source: 'https://ucanr.edu/site/fruit-nut-research-information-center/chestnut-fact-sheet', source_date: 'extension reference', evidence_status: 'comparable-climate extension production guidance', finding: 'Supports the crop function and orchard establishment context, but does not provide a Grey-Bruce low-input yield series.', canonical_action: 'retain the conservative unvalidated synthesis and its climate, blight, frost and wildlife caveats.'},
  {species: 'Heartnut/Japanese walnut', source: 'https://omafra.gov.on.ca/CropOp/en/spec_fruit/nuts/hear.html', source_date: 'Ontario reference', evidence_status: 'Ontario specialty-crop reference without a yield series', finding: 'Supports a possible food-tree role and bearing-time investigation, not a defensible local hectare yield.', canonical_action: 'retain reference-only status pending regional trials.'}
];

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
  {id: 'early_berry_low_input_synthesis', area_share: .25, class: 'early_bearing_perennial', labour_id: 'early_berry'},
  {id: 'intermediate_hazelnut_low_input_synthesis', area_share: .25, class: 'intermediate_perennial', labour_id: 'intermediate_nut_shrub'},
  {id: 'long_staple_chestnut_low_input_synthesis', area_share: .25, class: 'late_bearing_staple', labour_id: 'long_staple_tree'},
  {id: 'intermediate_apple_low_input_synthesis', area_share: .25, class: 'intermediate_perennial', labour_id: 'intermediate_fruit_tree'}
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
    ],
    research_updates: perennialResearchUpdates
  };
  writeJson('data/derived/perennial-yield-evidence.json', output);
  writeCsv('data/derived/perennial-yield-evidence.csv', [
    ['id','species','functional_class','role','first_meaningful_crop_year','substantial_crop_year','mature_year','mature_yield_t_ha_year','yield_mean_t_ha_year','yield_median_t_ha_year','yield_range_t_ha_year','mature_food_gj_ha_year','protein_kg_ha','fat_kg_ha','carbohydrate_kg_ha','input_intensity','evidence_type','canonical_status','source','notes'],
    ...rows.map(row => [row.id,row.species,row.functional_class,row.role,row.first_meaningful_crop_year,row.substantial_crop_year,row.mature_year,row.mature_yield_t_ha_year,row.yield_mean_t_ha_year,row.yield_median_t_ha_year,row.yield_range_t_ha_year,row.mature_food_gj_ha_year,row.protein_kg_ha,row.fat_kg_ha,row.carbohydrate_kg_ha,row.input_intensity,row.evidence_type,row.canonical_status,row.source,row.notes])
  ]);
  return output;
}

function calculatePerennialProteinEvidence() {
  const output = {
    source: 'data/source/perennial-protein-evidence.csv',
    rows: perennialProteinRows,
    human_food_eligible_rows: perennialProteinRows.filter(row => ['yes', 'possible'].includes(row.canonical_human_food_eligible)),
    human_food_canonical_yield_rows: perennialProteinRows.filter(row => row.canonical_human_food_eligible === 'yes' && number(row.mature_yield_t_ha_year) !== null),
    livestock_feed_eligible_rows: perennialProteinRows.filter(row => row.livestock_feed_eligible === 'yes'),
    conclusion: 'Hazelnut and chestnut remain the only rows in this expanded evidence table with both a usable food composition and a current central planning yield. Honey locust and Siberian peashrub are retained as food/feed research candidates; hardiness or pod protein does not establish a safe, processed, representative human-food yield.',
    source_notes: [
      'USDA Forest Service reports edible honey-locust pods and 9.3% protein in ground seeds and pods, but this is not a Grey-Bruce human staple yield study.',
      'Ontario reports honey locust tolerates some drought and flooding and a range of soils; this supports site-function investigation, not calorie credit.',
      'USDA plant-material references support Siberian peashrub hardiness and broad soil adaptation; no canonical human-food yield is inferred.',
      'Ontario specialty-crop and conservation material supports hazelnut, heartnut and chestnut functions with material local yield and establishment uncertainties.'
    ]
  };
  writeJson('data/derived/perennial-protein-evidence.json', output);
  writeCsv('data/derived/perennial-protein-evidence.csv', [
    Object.keys(perennialProteinRows[0]),
    ...perennialProteinRows.map(row => Object.values(row))
  ]);
  return output;
}

function perennialProteinMarkdown(evidence) {
  return `# Perennial protein and staple evidence

This table expands the food-forest research boundary beyond nuts. It distinguishes direct human food, livestock feed, dual-purpose functions and uncertain/experimental use. A species is not credited to the canonical human protein supply merely because it is hardy, fixes nitrogen, has edible pods or is used as animal feed.

| species | role | first meaningful crop | substantial crop | mature yield | human-food status | human canonical? | livestock feed? | evidence boundary |
|---|---|---:|---:|---:|---|---|---|---|
${evidence.rows.map(row => `| ${row.species} | ${row.food_role} | ${row.first_meaningful_crop_year || 'n/a'} | ${row.substantial_crop_year || 'n/a'} | ${row.mature_yield_t_ha_year || 'n/a'} | ${row.food_status} | ${row.canonical_human_food_eligible} | ${row.livestock_feed_eligible} | ${row.notes} |`).join('\n')}

## Interpretation

- **Honey locust:** USDA Forest Service material reports edible pods and approximately 9.3% protein in ground seeds and pods. Ontario describes tolerance of some drought and flooding and a broad soil range. The model treats it as a dual-purpose research candidate, not a canonical human staple: processing, anti-nutritional factors, cultivar differences, harvestability and representative Ontario yield remain unresolved.
- **Siberian peashrub / Caragana:** USDA material supports extreme hardiness and adaptation to sandy and alkaline soils, which is relevant to marginal-site shelter, nitrogen and feed design. It does not establish safe processed human food, protein availability or a Grey-Bruce yield, so it receives no canonical human-food credit.
- **Hazelnut and heartnut/walnut:** these are direct human food candidates with fat/protein value. Hazelnut has the current conservative synthesis used in the perennial mix; heartnut remains reference-only until local yield evidence exists.
- **Chestnut:** a human starch staple candidate with Ontario-relevant bearing-time evidence but unresolved local yield, blight, frost and wildlife risk. It is included as a conservative unvalidated synthesis in the current perennial mix.
- **Perennial vegetables and herbaceous legumes:** useful for diversity, soil cover and possible feed, but species-specific safety, processing, nutrition and hectare yields are not sufficiently established for canonical calorie/protein credit.

Sources: [USDA Forest Service honey locust review](https://research.fs.usda.gov/feis/species-reviews/gletri), [USDA Forest Service honey locust silvics](https://research.fs.usda.gov/silvics/honeylocust), [Ontario honey locust](https://www.ontario.ca/page/honey-locust), [USDA Plants Caragana profile](https://plants.usda.gov/home/plantProfile?symbol=CAAR18), [USDA NRCS plant materials](https://www.nrcs.usda.gov/plantmaterials/wapmctn6337.pdf), [OMAFRA heartnut guidance](https://omafra.gov.on.ca/CropOp/en/spec_fruit/nuts/hear.html), [Ontario American chestnut recovery strategy](https://www.ontario.ca/page/american-chestnut-recovery-strategy).
`;
}

function ageingInPlaceOutput(households) {
  const checkpoints = [1, 5, 10, 'mature'];
  const rows = households.map(row => {
    const series = row.transition.progressive_handoff.rows;
    const checkpointsOutput = Object.fromEntries(checkpoints.map(year => {
      const item = series.find(entry => entry.year === year);
      if (year === 'mature') {
        // Preserve a smaller annual reserve in the mature design. The
        // progressive-handoff series remains available as a no-reserve upper
        // sensitivity, but ageing-in-place should not imply that all annual
        // cultivation disappears or that the diet becomes tree-only.
        const annualArea = row.household_food_demand_gj_year * .25 / (row.annual_crop_gross_yield_gj_ha_year * (1 - .30));
        const perennialArea = row.household_food_demand_gj_year * .75 / (row.perennial_mature_mix_gross_yield_gj_ha_year * (1 - .30));
        const perennialHoursPerHa = item.perennial_area_ha > 0 ? item.labour.perennial_recurring_labour_hours / item.perennial_area_ha : 100;
        const recurringHours = annualArea * 150 + perennialArea * perennialHoursPerHa;
        return [String(year), {
          annual_crop_area_ha: round(annualArea, 6),
          annual_soil_preparation_area_ha: round(annualArea, 6),
          annual_soil_preparation_hours: round(annualArea * 45, 2),
          perennial_food_energy_percent: 75,
          food_energy_without_annual_soil_preparation_percent: 75,
          total_recurring_labour_hours: round(recurringHours, 2),
          total_labour_hours_including_establishment: round(recurringHours, 2),
          physical_intensity_for_older_resident: annualArea > .1 ? 'moderate-high' : 'moderate',
          household_food_coverage_ratio: 1,
          occupied_food_production_area_ha: round(annualArea + perennialArea, 6),
          mature_design_note: 'Mature target retains 25% annual plant calories for beans, vegetables, market crops, seed, rotation and resilience; the separate progressive-handoff series shows the zero-annual-area sensitivity.'
        }];
      }
      return [String(year), {
        annual_crop_area_ha: item.annual_area_ha,
        annual_soil_preparation_area_ha: item.labour.annual_soil_preparation_area_ha,
        annual_soil_preparation_hours: item.labour.annual_soil_preparation_hours,
        perennial_food_energy_percent: item.labour.perennial_food_energy_percent,
        food_energy_without_annual_soil_preparation_percent: item.labour.low_replanting_food_energy_percent,
        total_recurring_labour_hours: item.labour.total_recurring_labour_hours,
        total_labour_hours_including_establishment: item.labour.total_labour_hours_including_establishment,
        physical_intensity_for_older_resident: item.labour.physical_intensity_for_older_resident,
        household_food_coverage_ratio: item.household_food_coverage_ratio,
        occupied_food_production_area_ha: item.occupied_food_production_area_ha
      }];
    }));
    const y1 = checkpointsOutput['1'].annual_crop_area_ha;
    const mature = checkpointsOutput.mature.annual_crop_area_ha;
    return {
      site: row.site,
      site_label: row.site_label,
      household: row.household,
      household_label: row.household_label,
      household_food_demand_gj_year: row.household_food_demand_gj_year,
      annual_crop_area_reduction_from_year_1_to_maturity_percent: round((1 - mature / y1) * 100, 3),
      checkpoints: checkpointsOutput,
      interpretation: 'Establishment labour includes the one-time perennial establishment estimate in year 1; mature recurring labour excludes that one-time work. Annual crop soil preparation and replanting remain proportional to annual crop area.'
    };
  });
  return {
    model: 'ageing-in-place food-system labour transition (75% comparison series)',
    strategy: 'progressive_handoff_with_mature_annual_reserve',
    metric_definition: 'food energy produced without annual soil preparation/replanting = perennial plant food energy plus any optional livestock output credited to perennial/on-property feed; plants-only rows therefore match perennial calorie percentage.',
    rows,
    mature_perennial_food_share_target: .75,
    mature_perennial_food_share_status: 'comparison scenario; canonical mature share is solved in mature-food-system-canonical.json',
    mature_annual_food_share_retained_for_resilience: .25,
    labour_evidence: 'data/source/food-production-labour.csv uses categorical evidence-informed planning classifications and explicit non-field-study hour estimates.'
  };
}

function proteinAuditOutput(households) {
  return {
    model: 'protein-unit and denominator audit',
    target_definition: 'Health Canada-derived screening target of 0.8 g protein per kg reference body mass per day; this is a screening target, not a complete dietary adequacy standard.',
    rows: households.map(row => ({site: row.site, household: row.household, household_label: row.household_label, demand_gj_year: row.household_food_demand_gj_year, audit: row.protein_audit})),
    discrepancy: 'The earlier approximately 42 g/day result is the full-perennial calorie case: 15.222 kg/year × 1,000 ÷ 365.25 = 41.676 g/day, which is 80.15% of 52 g/day. The later approximately 42% result came from the mature 75/25 plants-only scenario after a field-name bug dropped the perennial protein component and divided only annual-plant protein (7.985 kg/year) by the annual target (18.993 kg/year). The corrected 75/25 case is reported separately and no percentage is labelled as g/day.'
  };
}

function proteinAuditMarkdown(output) {
  const ordinary = output.rows.filter(row => row.site === 'ordinary_mesic');
  return `# Protein calculation audit

## Reconciled discrepancy

The historical transition field reported approximately **41.676 g/day** for the ordinary one-adult full-perennial calorie case. Its denominator is the Health Canada-derived screening target of **52 g/day**, so the corresponding coverage is **80.15%**, not 42%.

The later **42.04%** headline was not the same case. It came from the mature 75/25 plants-only scenario, and a field-name bug in the livestock macro calculation silently omitted the perennial protein contribution because the stored fields are named protein_kg_ha, fat_kg_ha and carbohydrate_kg_ha. After correction, the 75/25 case is approximately 53 g/day and approximately 102% of the 52 g/day screening target for the ordinary representative adult.

The unit chain is:

protein kg/year × 1,000 g/kg ÷ 365.25 days/year = protein g/day

protein g/day ÷ target g/day × 100 = percentage coverage

| case | protein kg/year | protein g/day | target g/day | coverage |
|---|---:|---:|---:|---:|
${ordinary.filter(row => ['one_adult','two_adults_plus_two_children'].includes(row.household)).map(row => `| ${row.household_label} full perennial calories | ${format(row.audit.full_perennial_calorie_case.protein_kg_year, 2)} | ${format(row.audit.full_perennial_calorie_case.protein_g_day, 1)} | ${format(row.audit.target_g_day, 1)} | ${format(row.audit.full_perennial_calorie_case.coverage_percent, 1)}% |`).join('\n')}
${ordinary.filter(row => ['one_adult','two_adults_plus_two_children'].includes(row.household)).map(row => `| ${row.household_label} mature 75/25 comparison | ${format(row.audit.mature_75_25_comparison_case.protein_kg_year, 2)} | ${format(row.audit.mature_75_25_comparison_case.protein_g_day, 1)} | ${format(row.audit.target_g_day, 1)} | ${format(row.audit.mature_75_25_comparison_case.coverage_percent, 1)}% |`).join('\n')}

The corrected percentage is always dimensionless. It must not be displayed as grams per day.
`;
}

function ageingMarkdown(output) {
  const ordinary = output.rows.filter(row => row.site === 'ordinary_mesic');
  return `# Ageing-in-place and labour reduction

The objective is a succession from reliable annual staple calories toward a mature system with a substantial low-replanting food share. The target is not zero annual crops: a smaller annual area can remain useful for beans, vegetables, market crops, seed, resilience and crop rotation.

The separate ageing metric is **food energy produced without annual soil preparation/replanting**. In plants-only rows this equals perennial calorie percentage. Optional livestock can make the metric slightly broader when animal output is credited to perennial/on-property feed. Establishment labour is shown separately from mature recurring labour.

The **75% perennial / 25% annual** split in this file is a comparison series. It is not the canonical ARC mature-share recommendation. The canonical share is solved separately in ` + '`outputs/mature-food-system-canonical.md`' + ` using nutrition, annual resilience, site productivity and low-recurring-labour constraints. The underlying transition series also retains a no-annual-area sensitivity.

## Ordinary mesic site

| household | year 1 annual area | year 5 | year 10 | mature | annual-area reduction | mature perennial calories | mature without annual soil prep |
|---|---:|---:|---:|---:|---:|---:|---:|
${ordinary.map(row => `| ${row.household_label} | ${format(row.checkpoints['1'].annual_crop_area_ha, 2)} ha | ${format(row.checkpoints['5'].annual_crop_area_ha, 2)} ha | ${format(row.checkpoints['10'].annual_crop_area_ha, 2)} ha | ${format(row.checkpoints.mature.annual_crop_area_ha, 2)} ha | ${format(row.annual_crop_area_reduction_from_year_1_to_maturity_percent, 0)}% | ${format(row.checkpoints.mature.perennial_food_energy_percent, 0)}% | ${format(row.checkpoints.mature.food_energy_without_annual_soil_preparation_percent, 0)}% |`).join('\n')}

## Interpretation

Annual crops can carry the establishment bridge where the Year-1 area fits the site's food envelope. As berries, nut shrubs, fruit trees and staple trees begin bearing, the progressive handoff releases annual ground. A mature tree/shrub system still requires harvest, pruning, monitoring, wildlife protection and periodic replacement; it simply removes the repeated whole-area soil preparation and replanting burden.

The high-value mature design is therefore a **mixed labour profile**: annual cultivation becomes smaller and optional, perennial harvest/maintenance remains, and small livestock can add protein but introduces daily feed, water, health and winter-storage work. Exact hours are planning estimates, not a measured Grey-Bruce time-and-motion study. Full checkpoint data for every site and household is in ` + '`outputs/ageing-in-place-labour.json`' + `.
`;
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

function transitionSeries({demand, annualYield, siteMultiplier = 1, yieldCase, curveCase, loss, strategy, mixRows, foodEnvelope: _foodEnvelope, heatingAreaHa = 0, exclusiveReserveHa = .12}) {
  // This is deliberately a thin report adapter over the canonical bare-land
  // establishment engine. ARC allocation is comparison metadata only.
  const establishment = calculateEstablishmentLandRequirement({
    demandGJ: demand,
    annualYieldGJHaYear: annualYield,
    perennialMix: mixRows,
    curveAnchors: curveAnchors[curveCase],
    years: transitionYears,
    annualIntercropOverlap,
    loss,
    annualReserveFraction,
    strategy,
    heatingAreaHa,
    exclusiveReserveHa,
    yieldMultiplier: yieldMultipliers[yieldCase] * Number(siteMultiplier ?? 1)
  });
  const annualNetYield = annualYield * (1 - loss);
  const initialBridgeArea = demand / annualNetYield;
  return establishment.rows.map(row => {
    const annualArea = row.annual_area_ha;
    const forestArea = row.perennial_area_ha;
    const perennialClasses = row.class_production;
    const intentionalAnnualReserveGJ = strategy === 'constant_annual_reserve' ? demand * annualReserveFraction : 0;
    return {...row,
      perennial_curve_case: curveCase,
      annual_area_required_ha: row.annual_area_required_ha,
      exportable_food_energy_surplus_gj: round(Math.max(0, row.total_usable_food_gj - demand - intentionalAnnualReserveGJ), 6),
      intentional_annual_reserve_food_gj: round(intentionalAnnualReserveGJ, 6),
      annual_land_limited: false,
      food_supplied_percent: {annual: round(row.annual_usable_food_gj / demand * 100, 3), perennial: round(row.perennial_usable_food_gj / demand * 100, 3)},
      released_annual_area_ha: round(Math.max(0, initialBridgeArea - annualArea), 6),
      labour: calculateTransitionLabour({year: row.year, annualArea, forestArea, classProduction: perennialClasses, perennialUsableFoodGJ: row.perennial_usable_food_gj, householdDemandGJ: demand}),
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
  const mixRows = selectPerennialMixForSite(perennial.mix, siteId);
  const centralMixYield = mixRows.reduce((sum, row) => sum + Number(row.area_share) * Number(row.mature_food_gj_ha_year) * Number(row.site_yield_multiplier ?? 1), 0) * yieldMultipliers[yieldCase] * Number(site.food_multiplier ?? 1);
  const annual = Object.fromEntries(transitionLossReserveCases.map(loss => [lossLabel(loss), annualRequirements(demand, annualYield, loss)]));
  const matureAreas = Object.fromEntries(transitionLossReserveCases.map(loss => [lossLabel(loss), perennialAreaRequirements(demand, centralMixYield, loss)]));
  const loss = .30;
  const annualBridgeArea = demand / (annualYield * (1 - loss));
  const foodEnvelope = Math.max(0, capacityRow.arc_policy_allocation_ha - capacityRow.heating_area_ha);
  const longTermFoodForestArea = demand / (centralMixYield * (1 - loss));
  const series = {};
  for (const strategy of ['constant_annual_reserve', 'progressive_handoff']) {
    const rows = transitionSeries({demand, annualYield, siteMultiplier: site.food_multiplier, yieldCase, curveCase, loss, strategy, mixRows, foodEnvelope, heatingAreaHa: capacityRow.heating_area_ha, exclusiveReserveHa: capacityRow.resilience_allowances_ha.diversity_and_rotation_ha});
    const peak = rows.reduce((best, row) => row.total_exclusive_land_requirement_ha > best.total_exclusive_land_requirement_ha ? row : best, rows[0]);
    const mature = rows.at(-1);
    series[strategy] = {forest_area_used_ha: rows[0].perennial_area_ha, planted_perennial_footprint_ha: rows[0].planted_perennial_footprint_ha, establishment_land_requirement_ha: peak.total_exclusive_land_requirement_ha, establishment_peak_year: peak.year, mature_land_requirement_ha: mature.total_exclusive_land_requirement_ha, description: strategy === 'constant_annual_reserve' ? 'Annual acreage contracts only until a 25% food-demand annual reserve floor is reached, then remains at that floor.' : 'Annual acreage contracts to the residual food requirement and can reach zero when the perennial mix covers demand; no extra annual reserve floor is imposed.', thresholds: thresholds(rows), rows};
  }
  const transitionSensitivity = {};
  for (const scenario of ['conservative', 'favourable']) {
    const scenarioYield = mixRows.reduce((sum, row) => sum + Number(row.area_share) * Number(row.mature_food_gj_ha_year) * Number(row.site_yield_multiplier ?? 1), 0) * site.food_multiplier * yieldMultipliers[scenario];
    const scenarioTarget = demand / (scenarioYield * (1 - loss));
    const scenarioSeries = {};
    for (const strategy of ['constant_annual_reserve', 'progressive_handoff']) {
      const rows = transitionSeries({demand, annualYield, siteMultiplier: site.food_multiplier, yieldCase: scenario, curveCase: scenario, loss, strategy, mixRows, foodEnvelope, heatingAreaHa: capacityRow.heating_area_ha, exclusiveReserveHa: capacityRow.resilience_allowances_ha.diversity_and_rotation_ha});
      scenarioSeries[strategy] = {forest_area_used_ha: rows[0].perennial_area_ha, mature_perennial_food_coverage_ratio: rows.at(-1).perennial_food_coverage_ratio, thresholds: thresholds(rows), rows};
    }
    transitionSensitivity[scenario] = {mature_mix_gross_yield_gj_ha_year: round(scenarioYield, 6), long_term_forest_target_ha: round(scenarioTarget, 6), transition: scenarioSeries};
  }
  const quarter = transitionLossReserveCases.map(lossCase => {
    const usable = .25 * annualYield * (1 - lossCase);
    return {loss_or_reserve_fraction: lossCase, usable_food_gj: round(usable, 6), surplus_or_deficit_gj: round(usable - demand, 6), supports_household: usable >= demand};
  });
  const matureMacro = Object.fromEntries(['protein_kg_ha', 'fat_kg_ha', 'carbohydrate_kg_ha'].map(key => [key, round(mixRows.reduce((sum, row) => sum + Number(row.area_share) * Number(row[key] ?? 0) * Number(row.site_yield_multiplier ?? 1), 0) * site.food_multiplier * yieldMultipliers[yieldCase], 6)]));
  const fullCalorieAreaAt30 = matureAreas['30%']['100%'];
  const deliveredMacroAtFullCalories = Object.fromEntries(Object.entries(matureMacro).map(([key, value]) => [key, round(value * fullCalorieAreaAt30 * (1 - loss), 6)]));
  const targetGDay = capacityRow.food_system.protein_reference_target_g_day;
  const targetKgYear = targetGDay * 365.25 / 1000;
  const annualProteinPerGJ = capacityRow.food_system.macro_delivered_to_household.protein_kg / demand;
  const perennialProteinPerGJ = matureMacro.protein_kg_ha / centralMixYield;
  const mature75AnnualEnergy = demand * .25;
  const mature75PerennialEnergy = demand * .75;
  const mature75AnnualProtein = mature75AnnualEnergy * annualProteinPerGJ;
  const mature75PerennialProtein = mature75PerennialEnergy * perennialProteinPerGJ;
  const mature75ProteinKg = mature75AnnualProtein + mature75PerennialProtein;
  return {
    site: siteId,
    site_label: site.label,
    household: householdId,
    household_label: capacityRow.household_label,
    household_food_demand_gj_year: demand,
    food_adult_equivalents: capacityRow.food_adult_equivalents,
    adult_equivalent_scope: 'food-energy normalization only; not a total-land multiplier',
    annual_crop_gross_yield_gj_ha_year: round(annualYield, 6),
    annual_crop_macro_delivered_per_gj: {
      protein: round(capacityRow.food_system.macro_delivered_to_household.protein_kg / demand, 8),
      fat: round(capacityRow.food_system.macro_delivered_to_household.fat_kg / demand, 8),
      carbohydrate: round(capacityRow.food_system.macro_delivered_to_household.carbohydrate_kg / demand, 8)
    },
    annual_crop_requirements: annual,
    perennial_mature_mix_gross_yield_gj_ha_year: round(centralMixYield, 6),
    perennial_mature_mix_macro_output_per_ha: matureMacro,
    resilience_allowances_ha: capacityRow.resilience_allowances_ha,
    resilience_ecological_allowance_ha: round(capacityRow.resilience_allowance_total_ha - capacityRow.resilience_allowances_ha.deliberate_export_production_ha, 6),
    market_export_allowance_ha: capacityRow.resilience_allowances_ha.deliberate_export_production_ha,
    previous_robust_system_area_ha: capacityRow.robust_system_area_ha,
    perennial_macro_screen_at_full_calorie_area: {delivered_kg_year: deliveredMacroAtFullCalories, protein_g_day: round(deliveredMacroAtFullCalories.protein_kg_ha * 1000 / 365.25, 3), protein_screen_target_g_day: targetGDay, protein_coverage_percent: round(deliveredMacroAtFullCalories.protein_kg_ha / targetKgYear * 100, 3), note: 'Coarse protein/fat/carbohydrate screen only; does not establish micronutrient, amino-acid, fatty-acid, processing, storage or dietary adequacy.'},
    protein_audit: {
      target_g_day: round(targetGDay, 6),
      target_kg_year: round(targetKgYear, 6),
      unit_conversion: 'kg/year × 1000 ÷ 365.25 = g/day; g/day ÷ target g/day × 100 = percentage coverage',
      full_perennial_calorie_case: {protein_kg_year: round(deliveredMacroAtFullCalories.protein_kg_ha, 6), protein_g_day: round(deliveredMacroAtFullCalories.protein_kg_ha * 1000 / 365.25, 3), target_g_day: targetGDay, coverage_percent: round(deliveredMacroAtFullCalories.protein_kg_ha / targetKgYear * 100, 3), perennial_area_ha: fullCalorieAreaAt30},
      mature_75_25_comparison_case: {annual_food_energy_gj_year: round(mature75AnnualEnergy, 6), perennial_food_energy_gj_year: round(mature75PerennialEnergy, 6), annual_protein_kg_year: round(mature75AnnualProtein, 6), perennial_protein_kg_year: round(mature75PerennialProtein, 6), protein_kg_year: round(mature75ProteinKg, 6), protein_g_day: round(mature75ProteinKg * 1000 / 365.25, 3), target_g_day: targetGDay, coverage_percent: round(mature75ProteinKg / targetKgYear * 100, 3)},
      denominator_note: 'The target denominator is target_g_day for a daily comparison or target_kg_year for an annual comparison. Adult-equivalent is not a protein denominator.'
    },
    perennial_area_required_at_maturity_ha: matureAreas,
    arc_allocation_ha: capacityRow.arc_policy_allocation_ha,
    shared_heating_area_ha: capacityRow.heating_area_ha,
    food_production_envelope_at_arc_allocation_ha: round(foodEnvelope, 6),
    annual_bridge_area_at_30_percent_loss_or_reserve_ha: round(annualBridgeArea, 6),
    long_term_food_forest_area_target_ha: round(longTermFoodForestArea, 6),
    long_term_food_forest_area_target_at_arc_allocation_ha: round(longTermFoodForestArea, 6),
    initial_food_forest_area_alongside_full_annual_bridge_ha: round(longTermFoodForestArea, 6),
    food_forest_area_establishable_alongside_full_annual_bridge_ha: round(longTermFoodForestArea, 6),
    establishment_land_requirement_ha: series.progressive_handoff.establishment_land_requirement_ha,
    mature_land_requirement_ha: series.progressive_handoff.mature_land_requirement_ha,
    establishment_peak_year: series.progressive_handoff.establishment_peak_year,
    planted_perennial_footprint_ha: series.progressive_handoff.planted_perennial_footprint_ha,
    establishment_food_peak_ha: series.progressive_handoff.rows.reduce((best, row) => row.total_exclusive_land_requirement_ha > best.total_exclusive_land_requirement_ha ? row : best, series.progressive_handoff.rows[0]).occupied_food_production_area_ha,
    mature_food_production_footprint_ha: series.progressive_handoff.rows.at(-1).occupied_food_production_area_ha,
    arc_policy_comparison: {
      allocation_ha: capacityRow.arc_policy_allocation_ha,
      establishment_surplus_or_deficit_ha: round(capacityRow.arc_policy_allocation_ha - series.progressive_handoff.establishment_land_requirement_ha, 6),
      mature_surplus_or_deficit_ha: round(capacityRow.arc_policy_allocation_ha - series.progressive_handoff.mature_land_requirement_ha, 6),
      note: 'ARC allocation is evaluated after the biological establishment calculation and does not constrain it.'
    },
    local_environment: site,
    viable_annual_crops: capacityRow.food_system.viable_crop_ids,
    excluded_annual_crops: capacityRow.food_system.excluded_crop_ids,
    viable_perennial_layers: mixRows.map(row => row.id),
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

## Evidence updates reviewed for this model

${(perennial.research_updates ?? []).map(row => `- **${row.species}:** [source](${row.source}) (${row.source_date}; ${row.evidence_status}). ${row.finding} **Model action:** ${row.canonical_action}`).join('\n')}

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

For ageing-in-place, the 75% perennial-plant / 25% annual-plant split is a comparison scenario rather than a fixed recommendation. The solved mature plants-only trade-off is reported in ` + '`outputs/mature-food-system-canonical.md`' + `; it selects the lowest tested perennial share meeting the explicit low-replanting, annual-resilience and macro-screen constraints. The optional livestock comparisons and their feed/labour requirements are in outputs/livestock-scenarios.md.

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
  const ordinaryAdultAgeing = output.ageing_in_place?.rows?.find(row => row.household === 'one_adult' && row.site === 'ordinary_mesic');
  const rowTable = row => row.map(year => `| ${year.year} | ${format(year.annual_usable_food_gj, 2)} | ${format(year.perennial_usable_food_gj, 2)} | ${format(year.total_usable_food_gj, 2)} | ${format(year.household_food_coverage_ratio * 100, 0)}% | ${format(year.annual_area_ha, 2)} | ${format(year.released_annual_area_ha, 2)} | ${format(year.occupied_food_production_area_ha, 2)} |`).join('\n');
  return `# Food-forest transition through time

## Answer in brief

Yes, annual crops can independently feed the household during perennial establishment **when the annual bridge area fits the site's available food-production envelope**. The transition is not a static mature-landscape calculation: young trees and shrubs can share alleys with annuals, then annual acreage is progressively released as perennial production becomes material. The central model does not support saying that every household can replace all calories with a mature perennial mix on 1 or 2 ha; that result depends on household demand, site productivity and whether resilience/ecological land is counted.

For an ordinary site, the central progressive-handoff model reaches 25%, 50%, 75% and 100% of one adult's calories from perennials in years ${Object.values(ordinaryAdult.transition.progressive_handoff.thresholds).map(value => value ?? 'never').join(', ')}. For two adults plus two children the corresponding thresholds are ${Object.values(ordinaryFamily.transition.progressive_handoff.thresholds).map(value => value ?? 'never').join(', ')}. These are scenario years, not field predictions. The one-adult conservative and favourable threshold sequences are ${Object.values(ordinaryAdult.transition_sensitivity.conservative.transition.progressive_handoff.thresholds).map(value => value ?? 'never').join(', ')} and ${Object.values(ordinaryAdult.transition_sensitivity.favourable.transition.progressive_handoff.thresholds).map(value => value ?? 'never').join(', ')} respectively.

The ageing-in-place transition output retains 25% of mature plant calories in its 75% comparison case for beans, vegetables, markets, seed and resilience. The solved mature share and labour profile are in outputs/mature-food-system-canonical.md; the separate checkpoint series remains in outputs/ageing-in-place-labour.md. For one ordinary-site adult, the comparison annual area falls from ${format(ordinaryAdultAgeing?.checkpoints?.['1']?.annual_crop_area_ha ?? 0, 2)} ha in year 1 to ${format(ordinaryAdultAgeing?.checkpoints?.mature?.annual_crop_area_ha ?? 0, 2)} ha at maturity; this is a planning sensitivity, not a claim that all recurring perennial labour disappears.

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
  calculateFoodSystemLabour();
  const perennial = calculatePerennialEvidence();
  const perennialProtein = calculatePerennialProteinEvidence();
  const households = Object.entries(siteClasses).flatMap(([siteId]) => Object.keys(householdProfiles).map(household => householdTransition({capacity, perennial, food, siteId, householdId: household})));
  const ageingInPlace = ageingInPlaceOutput(households);
  const proteinAudit = proteinAuditOutput(households);
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
    perennial_protein_evidence: perennialProtein,
    protein_audit: proteinAudit,
    site_classes: siteClasses,
    policy_site_map: policySiteMap,
    households,
    ageing_in_place: ageingInPlace,
    quarter_hectare_tests: quarterHectareTests({capacity, food}),
    land_accounting: {rule: 'annual_area + perennial_area - young_row_intercrop_overlap = occupied food-production area', no_double_counting_test: 'occupied food-production area must be compared with allocation minus shared heating; resilience/ecological allowances remain separate and are not silently converted into food hectares.'}
  };
  output.livestock = buildLivestockScenarios(output);
  output.mature_food_system = buildMatureFoodSystem(output);
  writeJson('outputs/food-forest-transition.json', output);
  writeText('outputs/perennial-yield-evidence.md', sourceMarkdown(perennial));
  writeText('outputs/perennial-protein-staples.md', perennialProteinMarkdown(perennialProtein));
  writeJson('outputs/protein-audit.json', proteinAudit);
  writeText('outputs/protein-audit.md', proteinAuditMarkdown(proteinAudit));
  writeText('outputs/annual-establishment-food.md', annualMarkdown(output));
  writeText('outputs/mature-food-forest-capacity.md', matureMarkdown(output));
  writeText('outputs/household-transition-scenarios.md', householdMarkdown(output));
  writeText('outputs/food-forest-transition.md', transitionMarkdown(output));
  writeJson('outputs/ageing-in-place-labour.json', ageingInPlace);
  writeText('outputs/ageing-in-place-labour.md', ageingMarkdown(ageingInPlace));
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) buildFoodForestTransition();
