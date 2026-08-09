import {buildHumanEnergy} from './calc-human-energy.mjs';
import {buildCropEnergy} from './calc-crop-energy.mjs';
import {buildHectareBudget} from './calc-hectare-budget.mjs';
import {buildHeating} from './calc-heating.mjs';
import {buildFarmSize} from './calc-farm-size.mjs';
import {round, writeJson, writeText, format, svgText} from './model-utils.mjs';

function allocationChart() {
  const width = 960, height = 260;
  const segments = [
    {label: 'Core food', area: 0.25, color: '#4c78a8'},
    {label: 'Backup / perennial food', area: 0.25, color: '#54a24b'},
    {label: 'Willow SRC / wood', area: 0.5, color: '#8c6d31'}
  ];
  let x = 80;
  const barWidth = 800;
  const rects = segments.map(segment => {
    const widthPart = segment.area * barWidth;
    const out = `<rect x="${x}" y="80" width="${widthPart}" height="52" fill="${segment.color}"/><text x="${x + widthPart / 2}" y="110" fill="white" text-anchor="middle" font-size="13">${svgText(segment.label)}</text><text x="${x + widthPart / 2}" y="155" text-anchor="middle" font-size="13">${segment.area.toFixed(2)} ha</text>`;
    x += widthPart;
    return out;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><text x="25" y="30" font-size="18" font-weight="bold">Historical one-hectare allocation</text>${rects}<text x="480" y="205" text-anchor="middle" font-size="13">Total = 1.00 ha; the graphic is an allocation, not a complete site plan</text></svg>`;
}

function buildScenarios(hectare, heating) {
  const base = hectare.allocation;
  const factor = 1.2;
  return {
    baseline_1_0_ha: {
      label: '1.0 ha baseline ARC guideline',
      total_area_ha: 1,
      allocation: base,
      interpretation: 'Historical ARC shorthand; productive allocation is 0.25 ha core food + 0.25 ha backup/perennial food + 0.50 ha coppice.'
    },
    higher_resilience_1_2_ha: {
      label: '1.2 ha Grey-Bruce higher-provisioning scenario',
      total_area_ha: 1.2,
      allocation_if_scaled_proportionally: {core_food_ha: 0.25 * factor, backup_perennial_food_ha: 0.25 * factor, coppice_ha: 0.5 * factor},
      additional_area_ha: 0.2,
      additional_if_scaled_proportionally: {core_food_ha: 0.05, backup_perennial_food_ha: 0.05, coppice_ha: 0.10},
      interpretation: 'The source text attributes 1.2 ha to a five-month Grey County growing season versus a six-month global-hectare assumption (6/5 = 1.2). It does not specify how the additional 0.2 ha is spatially allocated; proportional scaling is a new scenario assumption.'
    },
    heating_reference: {useful_demand_gj: heating.result.heat_loss.annual_useful_space_heating_gj, required_coppice_ha_at_historical_yield: heating.result.wood.required_coppice_area_at_historical_yield_ha}
  };
}

function headline(human, crops, hectare, heating, farm, scenarios) {
  const food = hectare.food;
  const thermal = hectare.thermal;
  return `# Headline results

This report reconstructs the historical source values before adding new calculations. Original files under /home/htaf/lyis/ were not modified.

1. **Historical annual food energy:** the j needs sheet gives an active 75 kg adult **13.05 MJ/day = ${format(human.canonical.annual_gj, 6)} GJ/year**, or ${format(human.canonical.annual_kcal, 0)} kcal/day. The annual formula uses 365.25 days/year.

2. **Crop-energy distribution:** ${crops.overall.count} usable observations span **${format(crops.overall.min, 2)}–${format(crops.overall.max, 2)} GJ/ha**, with median **${format(crops.overall.median, 2)}**, mean **${format(crops.overall.mean, 2)}**, CV **${format(crops.overall.coefficient_of_variation * 100, 1)}%**, and IQR **${format(crops.overall.interquartile_range, 2)} GJ/ha**.

3. **Hypothesis test:** the data supports only a qualified broad-order-of-magnitude claim. Carb-, protein- and fat-oriented entries overlap in the general tens-of-GJ/ha range, but the full range is ${format(crops.overall.max / crops.overall.min, 1)}× and the sample mixes incomparable crop types, yield horizons and undocumented assumptions. It does not support “all crops are equivalent.”

4. **Mathematical food land at median yield:** ${format(food.mathematical_food_area_at_median_ha, 3)} ha supplies ${format(human.canonical.annual_gj, 2)} GJ/year at the spreadsheet median. At the lower and upper quartiles the arithmetic requirement is ${format(food.mathematical_food_area_at_q1_ha, 3)} and ${format(food.mathematical_food_area_at_q3_ha, 3)} ha respectively.

5. **0.25 ha core-food margin:** median modeled output is ${format(food.core_median_output_gj, 2)} GJ/year, ${format(food.core_food_surplus_factor, 2)}× demand, a gross-energy margin of ${format(food.core_food_safety_margin_percent, 1)}% before harvest, storage, dietary-balance, labour and bad-year losses. The historical graphic's 5–7 GJ range implies a narrower ${format(food.historical_core_output_low_gj / food.annual_demand_gj * 100 - 100, 1)}–${format(food.historical_core_output_high_gj / food.annual_demand_gj * 100 - 100, 1)}% margin.

6. **Second 0.25 ha food/perennial zone:** ${format(food.backup_median_output_gj, 2)} additional median GJ/year if held to the same crop-yield assumption; historically it is a resilience/surplus allowance, not a separate mathematically required minimum.

7. **0.5 ha coppice:** the historical graphic assigns **15 GJ/year gross** and one cord/year. At the default ${format(thermal.heater_efficiency * 100, 0)}% heater efficiency that is ${format(thermal.coppice_useful_heat_gj, 2)} GJ useful heat.

8. **65.6 m² yurt heating:** the transparent new model estimates **${format(heating.result.heat_loss.annual_useful_space_heating_gj, 2)} GJ/year useful space heat** under the documented envelope, air-leakage, HDD and passive-gain assumptions.

9. **Coppice sufficiency:** 0.5 ha is **insufficient under the default heating model**, supplying ${format(heating.result.wood.historical_half_ha_heat_fraction * 100, 1)}% of useful heating demand. Approximately ${format(heating.result.wood.required_coppice_area_at_historical_yield_ha, 2)} ha would be required if the historical 30 GJ gross/ha yield held.

10. **Required versus allowance:** food-only land is the arithmetic demand divided by crop yield. The historical extra food quarter, half-hectare wood allocation, 1.2 ha climate adjustment, ecological buffers, nutrient interception, soil regeneration, fibre/materials and wildlife protection are design/resilience allowances or unresolved assumptions, not all mathematically required by the food equation.

11. **Evidence for 1 ha/adult:** evidence is internally consistent as a historical policy shorthand: the sources state 1 global hectare with six months growing season, half food and half wood, and a 24 GJ/ha mixed-energy shorthand. However, the crop and wood outputs are not jointly site-calibrated, the heating model is absent, and the historical 15 GJ/0.5 ha coppice number is unsupported by a yield trial in the audited files.

12. **Evidence for 1.2 ha/person:** the source explicitly says Grey County's five-month growing season requires 1.2 ha versus a six-month global hectare; this is the arithmetic ratio 6/5. The source does not provide a crop-weather productivity model or an explicit allocation for the extra 0.2 ha, so it is a plausible higher-resilience scenario, not a validated local carrying-capacity estimate.

## Significant weak, obsolete or unsupported assumptions

- The crop spreadsheet combines gross harvested energy across species without a common maturity, land-quality, loss, input, water or dietary-balance basis.
- “Edible fraction” is not a separate source input, although the workbook's crop energy values are implicitly treated as edible food energy.
- The diagram's 5–7 GJ food ranges are not formula-linked to a crop mix.
- Willow SRC yield of 1 cord/year from 0.5 ha is a prose/graphic assumption, not a measured source table in the audited files.
- The diagram's 15 GJ/cord is not reconciled with wood species, moisture content, cord definition or delivered heat.
- The historical “high efficiency home” is not specified enough to verify heating demand. The new 65.6 m² model therefore uses explicit assumptions and finds the historical 0.5 ha allocation insufficient under its default case.
- The 1.2 ha value is a growing-season scaling argument, not a local crop-yield model.
- The farm-size result is a descriptive OWID-derived association with unclear class construction and no causal identification.
- Solar-electricity values in transition_plan.html address household/electronic electricity, not biological solar capture and are not part of the food/wood land balance.

Recommended website treatment: keep **1 ha/adult** as a clearly labelled historical ARC policy guideline; present **1.2 ha/person** as a Grey-Bruce higher-resilience/full-provisioning scenario; show food, useful heat, and gross biomass as separate streams; and expose the crop-yield, heating, loss and climate assumptions rather than presenting one hectare as a universal physical constant.
`;
}

const human = buildHumanEnergy();
const crops = buildCropEnergy();
const hectare = buildHectareBudget({human, crops});
const heating = buildHeating();
const farm = buildFarmSize();
const scenarios = buildScenarios(hectare, heating);
writeJson('data/derived/scenarios.json', scenarios);
writeText('outputs/charts/hectare-allocation.svg', allocationChart());
writeJson('outputs/summary.json', {human, crops: {overall: crops.overall, groups: crops.groups}, hectare, heating, farm: {correlation: farm.correlation}, scenarios});
writeText('outputs/headline-results.md', headline(human, crops, hectare, heating, farm, scenarios));
console.log('Built derived model outputs.');
