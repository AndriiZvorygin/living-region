import {pathToFileURL} from 'node:url';
import {readCsv, number, round, writeCsv, writeJson, writeText, format} from './model-utils.mjs';
import {buildHealthCanadaEnergy} from './calc-health-canada-energy.mjs';
import {calculateFoodEvidence} from './calc-evidence-food.mjs';
import {buildEvidenceHeating} from './calc-evidence-heating.mjs';
import {buildEvidenceWoody} from './calc-evidence-woody.mjs';
import {buildHouseholdCapacity} from './calc-household-capacity.mjs';
import {buildEconomics} from './calc-economics.mjs';
import {buildFarmSize} from './calc-farm-size.mjs';

const f = (value, digits = 2) => format(value, digits);

function historicalReference() {
  const human = readCsv('data/source/human-energy.csv');
  const hectare = readCsv('data/source/historic-hectare-model.csv');
  return {
    status: 'legacy/reference only; no historical value is used as a canonical ARC input',
    source_files: ['/home/htaf/lyis/pcan/paradise-garden.ods', '/home/htaf/lyis/pfet/hfoc/hectare_breakdown.png', '/home/htaf/lyis/pfet/hfoc/ghectare_breakdown_concentric.png'],
    historical_lyis_adult: {daily_mj: 13.05, annual_gj: 4.7665125, source_rows: human.filter(row => row.variable.includes('75kg'))},
    historical_allocation: hectare,
    historical_policy_values: {one_ha_per_adult: 'historical ARC shorthand', one_point_two_ha_per_person: 'historical Grey-Bruce growing-season adjustment; provenance only', willow_gross_gj_ha_year: 30, historical_food_quarter_area_ha: .25, historical_backup_quarter_area_ha: .25, historical_wood_area_ha: .5}
  };
}

function writeInputIntensity(food) {
  const rows = readCsv('data/source/evidence-food-yields.csv');
  const header = ['id','crop','input_intensity','synthetic_fertilizer','imported_manure_compost','biosolids','irrigation','herbicide','pesticide_fungicide','mechanized_energy','one_time_establishment','annual_purchased_inputs','recycled_on_site_nutrients','canonical_eligible','evidence_type','source','notes'];
  writeCsv('data/derived/input-intensity.csv', [header, ...rows.map(row => [row.id,row.crop,row.input_intensity,row.synthetic_fertilizer,row.imported_manure_compost,row.biosolids,row.irrigation,row.herbicide,row.pesticide_fungicide,row.mechanized_energy,row.one_time_establishment,row.annual_purchased_inputs,row.recycled_on_site_nutrients,row.canonical_eligible,row.evidence_type,row.source,row.notes])]);
}

function foodMarkdown(food) {
  const rows = food.rows.filter(row => row.food_gj_ha !== null);
  const r = food.low_input_observations;
  return `# Evidence-based low-input food yields

The old ` + '`paradise-garden.ods`' + ` crop table is retained in the historical audit but is not used here. This dataset combines current Canadian nutrient composition with Ontario measured crop benchmarks and explicit low-input synthesis rows. A synthesis row is not a measured zero-input trial: it is a reproducible adjustment to a measured Ontario benchmark, with the adjustment and limitations exposed in ` + '`data/source/evidence-food-yields.csv`' + `.

## Low-input energy distribution

| statistic | GJ/ha/year |
|---|---:|
| observations | ${r.count} |
| minimum | ${f(r.min)} |
| first quartile | ${f(r.q1)} |
| median | **${f(r.median)}** |
| mean | ${f(r.mean)} |
| third quartile | ${f(r.q3)} |
| maximum | ${f(r.max)} |
| IQR | ${f(r.interquartile_range)} |
| standard deviation | ${f(r.standard_deviation)} |
| coefficient of variation | ${f(r.coefficient_of_variation * 100, 1)}% |

The low-input observations span ${f(r.max / r.min, 1)}× from minimum to maximum. Category medians are reported in ` + '`data/derived/evidence-food-yields.json`' + `; the fat category has only one current low-input synthesis row, so its range is not evidence of a stable regional distribution.

| crop | category | yield t/ha | edible food GJ/ha | protein kg/ha | fat kg/ha | evidence |
|---|---|---:|---:|---:|---:|---|
${rows.map(row => `| ${row.crop} | ${row.category} | ${f(row.mean_yield_t_ha, 2)} | ${f(row.food_gj_ha, 1)} | ${f(row.protein_kg_ha, 0)} | ${f(row.fat_kg_ha, 0)} | ${row.evidence_type} |`).join('\n')}

## Hypothesis result

The current evidence supports a **qualified** order-of-magnitude statement, not crop equivalence. The starch, legume/protein and fat-seed rows overlap in the tens of GJ/ha/year, but the dataset is small, some central rows are modelled adjustments rather than direct low-input measurements, and a single fat-seed row cannot establish a category distribution. Gross calories are therefore constrained to a broad band by biological production, while nutritional composition changes materially and must be planned separately.

Potatoes and nuts/seeds can carry much more energy per hectare than low-energy fruit and vegetables; fruit, vegetables and perennial diversity are not optional just because they contribute fewer calories. No defensible ordinary Grey-Bruce low-input yield was found for chestnut, walnut, apple or carrot, so these are documented evidence gaps rather than fabricated numbers.
`;
}

function woodyMarkdown(woody) {
  const central = woody.cases.central;
  return `# Evidence-based low-input woody yields

The historical 30 GJ/ha/year coppice assumption is not used. Woody land is solved from dry biomass yield, 19 GJ gross per dry tonne, 15% harvest/storage retention and the audited yurt heating cases.

## Yield bands

| site band | dry biomass | gross energy | retained gross energy | evidence status |
|---|---:|---:|---:|---|
| marginal | ${woody.bands.marginal} dry t/ha/year | ${f(woody.bands.marginal * 19, 1)} GJ/ha/year | ${f(central.marginal.usable_gross_energy_gj_ha_year, 1)} GJ/ha/year | lower stable-cultivar range synthesis |
| ordinary | ${woody.bands.ordinary} dry t/ha/year | ${f(woody.bands.ordinary * 19, 1)} GJ/ha/year | ${f(central.ordinary.usable_gross_energy_gj_ha_year, 1)} GJ/ha/year | central modelled synthesis anchored to stable eastern/northern trial results |
| favourable | ${woody.bands.favourable} dry t/ha/year | ${f(woody.bands.favourable * 19, 1)} GJ/ha/year | ${f(central.favourable.usable_gross_energy_gj_ha_year, 1)} GJ/ha/year | commercial cultivar first-rotation sensitivity, not ordinary central case |

The Eastern Canada landfill-cell trial is reported only as an exceptional upper sensitivity. It cannot represent ordinary Grey County land. The central ordinary value is consequently a transparent synthesis, not a direct measurement of a mixed Grey County stand.

## Required woody land

| heating case | marginal | ordinary | favourable |
|---|---:|---:|---:|
${Object.entries(woody.cases).map(([heat, sites]) => `| ${heat} | ${f(sites.marginal.required_woody_area_ha, 2)} ha | **${f(sites.ordinary.required_woody_area_ha, 2)} ha** | ${f(sites.favourable.required_woody_area_ha, 2)} ha |`).join('\n')}

For the central heating case, ordinary-site wood is ${f(central.ordinary.required_woody_area_ha, 2)} ha, marginal-site wood is ${f(central.marginal.required_woody_area_ha, 2)} ha and favourable-site wood is ${f(central.favourable.required_woody_area_ha, 2)} ha. The historical 0.5 ha wood allocation is therefore not a mathematical requirement on an ordinary site, but it can be consumed by a marginal site, higher heat demand, establishment losses, or non-heating wood functions.
`;
}

function heatingMarkdown(heating, woody) {
  return `# Audited yurt heating budget

The 65.6 m², 9.1 m diameter geometry is user-provided. The circular wall and conical roof geometry, R-values, window area/U-value, thermal bridges, air leakage, internal/passive gain factor and heater efficiency are modelling/design assumptions. The only measured climate input in this calculation is the ECCC Owen Sound 1981–2010 normal of 4,031.9 degree-days below 18°C. The normal vintage should be updated before website publication.

| case | useful space heat | gross wood energy | dry wood | cords/year |
|---|---:|---:|---:|---:|
${Object.entries(heating.cases).map(([id, r]) => `| ${id} | **${f(r.heat_loss.annual_useful_space_heating_gj)} GJ/year** | ${f(r.wood.gross_wood_energy_required_gj)} GJ/year | ${f(r.wood.approximate_dry_wood_kg, 0)} kg/year | ${f(r.wood.approximate_cords_per_year, 2)} |`).join('\n')}

The central result is ${f(heating.cases.central.heat_loss.annual_useful_space_heating_gj)} GJ/year useful space heat, ${f(heating.cases.central.wood.gross_wood_energy_required_gj)} GJ/year gross wood input, approximately ${f(heating.cases.central.wood.approximate_dry_wood_kg, 0)} kg dry wood and ${f(heating.cases.central.wood.approximate_cords_per_year, 2)} full-cord-equivalents at the explicitly modelled 10 GJ/cord. The cord value is only a conversion convenience; dry tonnes are the stronger result.

0.5 ha is not declared sufficient or insufficient in the abstract: at the central heating demand and ordinary woody yield, the required area is ${f(woody.cases.central.ordinary.required_woody_area_ha, 2)} ha; at marginal yield it is ${f(woody.cases.central.marginal.required_woody_area_ha, 2)} ha. This is a site- and building-dependent result.
`;
}

function householdMarkdown(capacity) {
  const ordinary = capacity.rows.filter(row => row.site === 'ordinary_mesic');
  return `# Household capacity

Food and heat are calculated separately. Food demand uses current Health Canada EER equations; children are not counted as full adults. The canonical adult-equivalent is the mean of the representative low-active 35-year-old woman and man: ${f(capacity.rows.find(row => row.household === 'one_adult' && row.site === 'ordinary_mesic').household_energy_gj_year, 2)} GJ/year for the representative woman, while the adult-equivalent definition is stored in ` + '`data/derived/health-canada-energy.json`' + `.

Central ordinary-site results:

| household | food GJ/year | adult-equivalents | food area | heating area | mathematical minimum | robust system area |
|---|---:|---:|---:|---:|---:|---:|
${ordinary.map(row => `| ${row.household} | ${f(row.household_energy_gj_year, 2)} | ${f(row.adult_equivalents, 2)} | ${f(row.food_area_ha, 2)} ha | ${f(row.heating_area_ha, 2)} ha | ${f(row.mathematical_minimum_area_ha, 2)} ha | **${f(row.robust_system_area_ha, 2)} ha** |`).join('\n')}

The mathematical minimum is food plus heating. The robust-system column adds explicit allowances for crop diversity/rotation, perennial soil/water buffers, fibre/habitat/wildlife protection and deliberate export production. Those allowances are design choices, not hidden biological constants.

The representative one-adult food mix passes the simple macro screening check in the derived JSON: ${JSON.stringify(ordinary[0].food_system.macro_energy_shares_percent)} of food energy from protein/fat/carbohydrate and ${f(ordinary[0].food_system.protein_g_day, 0)} g protein/day against the explicit ${f(ordinary[0].food_system.protein_reference_target_g_day, 0)} g/day screening threshold. This does not establish micronutrient sufficiency, amino-acid quality, dietary acceptability or seasonal availability.

The calorie model does not prove micronutrient sufficiency, animal-food substitution, labour feasibility, seed security or long-term soil nutrient balance. The planned perennial fruit/vegetable and ecological zones are therefore required functions even where they do not improve the calorie median.
`;
}

function siteMarkdown(capacity) {
  const households = ['one_adult', 'two_adults', 'two_adults_plus_two_children'];
  return `# Site sensitivity

Site classes are scenarios, not parcel classifications. A site survey must replace the food multipliers and woody band before an ARC decision is made.

| site | food multiplier | woody band | one adult robust area | two adults robust area | two adults + two children robust area |
|---|---:|---|---:|---:|---:|
${Object.keys(capacity.site_classes).map(site => {
    const values = households.map(household => capacity.rows.find(row => row.site === site && row.household === household).robust_system_area_ha);
    return `| ${capacity.site_classes[site].label} | ${f(capacity.site_classes[site].food_multiplier, 2)} | ${capacity.site_classes[site].woody_band} | ${f(values[0], 2)} ha | ${f(values[1], 2)} ha | ${f(values[2], 2)} ha |`;
  }).join('\n')}

The ordinary site is close to 1.1 ha for the one-adult robust-system scenario and 1.73 ha for two adults plus two representative children. A single hectare is not a household-size-independent capacity claim.
`;
}

function surplusMarkdown(capacity, economics) {
  const rows = capacity.rows.filter(row => row.site === 'ordinary_mesic');
  const oneHa = rows.find(row => row.household === 'one_adult');
  return `# Deliberate surplus and cash output

At one total hectare on the ordinary site, the central model allocates ${f(oneHa.heating_area_ha, 2)} ha to heating and ${f(Math.max(0, 1 - oneHa.heating_area_ha), 2)} ha to food and associated production. For the representative one-adult case, the model reports ${f(oneHa.food_surplus_at_one_total_ha_gj, 2)} GJ/year of post-loss, post-reserve food surplus after the modeled household requirement. This is a scenario output, not a promise of saleable surplus in every year.

Two adults plus two children require ${f(rows.find(row => row.household === 'two_adults_plus_two_children').robust_system_area_ha, 2)} ha in the robust ordinary-site scenario; a one-hectare system therefore cannot be described as a full household food-and-heat system for that household.

## Cash targets

The economic module is intentionally separate from calories and wood. It uses configurable illustrative margins until current Owen Sound farmgate/direct-sale records are added.

| product | unit | net margin | units for $1,000 | units for $2,000 | units for $3,000 | units for $5,000 |
|---|---|---:|---:|---:|---:|---:|
${economics.products.map(row => `| ${row.product} | ${row.unit} | $${f(row.net_margin_cad_per_unit, 2)} | ${f(row.required_units_by_target['1000'], 0)} | ${f(row.required_units_by_target['2000'], 0)} | ${f(row.required_units_by_target['3000'], 0)} | ${f(row.required_units_by_target['5000'], 0)} |`).join('\n')}

These are annual saleable-unit requirements, not net farm-income forecasts. Labour, depreciation, taxes, delivery, unsold product and owner time are not fully priced. Property taxes and unavoidable cash costs should be entered as a target, then matched to a product with a verified local margin.
`;
}

function recommendationMarkdown(energy, food, heating, woody, capacity, economics) {
  const ordinaryAdult = capacity.rows.find(row => row.site === 'ordinary_mesic' && row.household === 'one_adult');
  const ordinaryFamily = capacity.rows.find(row => row.site === 'ordinary_mesic' && row.household === 'two_adults_plus_two_children');
  return `# Recommended ARC land guideline

## Result

The evidence-based model supports a **site-adjusted performance range**, not a universal hectare constant.

- A representative low-active adult requires ${f(energy.canonical_adult_equivalent.gj_year, 2)} GJ/year in the current adult-equivalent definition; the representative woman and man are ${f(energy.scenarios.adult_woman.gj_year, 2)} and ${f(energy.scenarios.adult_man.gj_year, 2)} GJ/year.
- The central low-input food-system synthesis produces ${f(ordinaryAdult.food_system.gross_energy_per_ha, 1)} GJ/ha/year gross edible food energy before household loss/reserve deductions.
- Central ordinary-site mathematical demand is ${f(ordinaryAdult.mathematical_minimum_area_ha, 2)} ha for one representative adult; the explicit robust-system scenario is ${f(ordinaryAdult.robust_system_area_ha, 2)} ha.
- Central ordinary-site robust demand is ${f(ordinaryFamily.robust_system_area_ha, 2)} ha for two adults plus two representative children.
- Central yurt useful heating is ${f(heating.cases.central.heat_loss.annual_useful_space_heating_gj, 1)} GJ/year; ordinary woody area is ${f(woody.cases.central.ordinary.required_woody_area_ha, 2)} ha, with ${f(woody.cases.central.marginal.required_woody_area_ha, 2)} ha on the marginal band.

## Policy interpretation

1 ha/adult is **approximately correct as a rounded ordinary-site one-adult design allowance**, but it is not demonstrated as a universal carrying capacity. It is slightly below this model's 1.10 ha ordinary robust-system result and becomes inadequate for larger households unless productive surplus is imported or the design is unusually favourable.

Recommended website language: “Plan against a site-adjusted performance test. Use approximately 1.0–1.2 productive hectares per adult-equivalent as an initial ordinary-site planning range, then adjust for measured soil, water, food-yield and heating performance. Marginal land and larger households require more; favourable sites can export surplus.” This is a recommendation derived from the model's explicit scenarios, not a current empirical provincial average.

The historic 1.2 ha/person remains a provenance-only Lyis scenario. The evidence-based model arrives near that range for a robust ordinary one-adult system, but by a different calculation and without validating the historic growing-season ratio.

## What is mathematically required versus allowed

Mathematically required: household food demand divided by the chosen low-input food-system yield, plus audited useful heating demand divided by sustainable woody energy yield.

Design/resilience allowances: crop diversity and rotations; fruit and vegetable nutrition; perennial backup; soil and water interception; nutrient recycling; wildlife protection; fibre/materials; habitat; establishment losses; bad-year reserve; community support; and deliberate saleable surplus.

The largest remaining uncertainties are measured low-input Grey-Bruce yields, food-system nutritional completeness, current ECCC normals, as-built yurt leakage/thermal bridges, sustainable mixed-woody yield, wildlife losses, labour and cash margins.
`;
}

function headline(energy, food, heating, woody, capacity, economics) {
  const adult = capacity.rows.find(row => row.site === 'ordinary_mesic' && row.household === 'one_adult');
  return `# Evidence-based ARC carrying-capacity headline results

1. A representative current low-active adult-equivalent requires **${f(energy.canonical_adult_equivalent.gj_year, 2)} GJ/year**, ${f(energy.canonical_adult_equivalent.mj_day, 2)} MJ/day and ${f(energy.canonical_adult_equivalent.kcal_day, 0)} kcal/day. The representative woman is ${f(energy.scenarios.adult_woman.gj_year, 2)} GJ/year; the representative man is ${f(energy.scenarios.adult_man.gj_year, 2)} GJ/year. An 8-year-old girl is ${f(energy.scenarios.child_girl_8.gj_year, 2)} GJ/year and a 14-year-old boy is ${f(energy.scenarios.adolescent_boy_14.gj_year, 2)} GJ/year.
2. The low-input food dataset has ${food.low_input_observations.count} usable observations spanning **${f(food.low_input_observations.min)}–${f(food.low_input_observations.max)} GJ/ha/year**, median **${f(food.low_input_observations.median)}**, IQR ${f(food.low_input_observations.interquartile_range)}, and CV ${f(food.low_input_observations.coefficient_of_variation * 100, 1)}%.
3. The carb/protein/fat order-of-magnitude hypothesis is **qualified, not proven universally**: categories overlap in the tens of GJ/ha, but fat evidence is sparse, low-input rows are partly modelled, and nutritional composition differs materially.
4. The central balanced food-system synthesis is ${f(adult.food_system.gross_energy_per_ha, 1)} GJ/ha/year gross edible energy. One representative adult's calculated food area after storage, wildlife, seed, bad-year and community reserves is **${f(adult.food_area_ha, 2)} ha**.
5. The audited 65.6 m² yurt central useful heating requirement is **${f(heating.cases.central.heat_loss.annual_useful_space_heating_gj, 1)} GJ/year**, with a low/high range of ${f(heating.cases.low.heat_loss.annual_useful_space_heating_gj, 1)}–${f(heating.cases.high.heat_loss.annual_useful_space_heating_gj, 1)} GJ/year.
6. Woody bands are ${woody.bands.marginal}, ${woody.bands.ordinary} and ${woody.bands.favourable} dry t/ha/year for marginal, ordinary and favourable scenarios. Central yurt wood area is **${f(woody.cases.central.marginal.required_woody_area_ha, 2)} ha marginal, ${f(woody.cases.central.ordinary.required_woody_area_ha, 2)} ha ordinary, ${f(woody.cases.central.favourable.required_woody_area_ha, 2)} ha favourable**.
7. For an ordinary mesic site, the mathematical food-plus-heat minimum is ${f(adult.mathematical_minimum_area_ha, 2)} ha and the explicit robust one-adult system is **${f(adult.robust_system_area_ha, 2)} ha**. Two adults plus two representative children require ${f(capacity.rows.find(row => row.site === 'ordinary_mesic' && row.household === 'two_adults_plus_two_children').robust_system_area_ha, 2)} ha in the same scenario.
8. One hectare on the ordinary site produces a modeled ${f(adult.food_surplus_at_one_total_ha_gj, 1)} GJ/year post-loss/post-reserve food surplus for one representative adult after heating land is assigned; this is deliberate capacity, not guaranteed export.
9. The economic module is separate and illustrative: depending on product, covering $1,000–$5,000/year requires the configurable unit volumes in ` + '`data/derived/economic-output.csv`' + `. Current local margins remain unresolved.
10. Recommendation: use a **site-adjusted range/performance test**, initially approximately **1.0–1.2 productive ha per adult-equivalent for an ordinary robust one-adult system**, with larger allowances for marginal land and larger households. Do not publish 1 ha/adult as a universal physical constant.

Historical Lyis values are deliberately excluded from these canonical calculations. See ` + '`outputs/legacy/`' + ` and ` + '`historical`' + ` in ` + '`outputs/summary.json`' + ` for provenance only.
`;
}

export function buildEvidenceSummary() {
  const energy = buildHealthCanadaEnergy();
  const food = calculateFoodEvidence();
  const heating = buildEvidenceHeating();
  const woody = buildEvidenceWoody(heating);
  const capacity = buildHouseholdCapacity(energy, food, heating, woody);
  const economics = buildEconomics();
  writeInputIntensity(food);
  const farm = buildFarmSize();

  const historical = historicalReference();
  const canonical = {status: 'evidence-based current ARC model', human_energy: energy, food_yields: {low_input_distribution: food.low_input_observations, category_stats: food.category_stats_low_input}, heating, woody_yields: woody, household_capacity: capacity, economic_output: economics, site_sensitivity: capacity.site_classes, farm_size_reference: {status: 'historical descriptive reference only', correlation: farm.correlation}};
  writeJson('outputs/summary.json', {model_version: 'phase-2-evidence-based', canonical, historical});
  writeText('outputs/evidence-based-headline-results.md', headline(energy, food, heating, woody, capacity, economics));
  writeText('outputs/low-input-food-yields.md', foodMarkdown(food));
  writeText('outputs/low-input-woody-yields.md', woodyMarkdown(woody));
  writeText('outputs/heating-budget.md', heatingMarkdown(heating, woody));
  writeText('outputs/household-capacity.md', householdMarkdown(capacity));
  writeText('outputs/site-sensitivity.md', siteMarkdown(capacity));
  writeText('outputs/surplus-production.md', surplusMarkdown(capacity, economics));
  writeText('outputs/recommended-land-guideline.md', recommendationMarkdown(energy, food, heating, woody, capacity, economics));
  writeText('outputs/legacy/README.md', '# Historical Lyis reference outputs\n\nThe existing Phase 1 outputs and source-derived values are provenance only. They are not canonical inputs to the evidence-based ARC model. The current model is generated by `scripts/build-summary.mjs`.\n');
  return {canonical, historical};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) buildEvidenceSummary();
