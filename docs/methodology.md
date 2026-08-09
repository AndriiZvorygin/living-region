# Methodology

## Workflow

The repository follows a source-first pipeline:

1. `scripts/extract-ods.mjs` reads the three ODS workbooks and writes provenance-preserving CSV/JSON files under `data/source/`.
2. The calculation scripts consume only those normalized inputs plus explicit new assumptions.
3. `scripts/build-summary.mjs` writes derived JSON, Markdown, CSV tables, and SVG charts.
4. `node --test` verifies the canonical arithmetic.

No original spreadsheet is rewritten or recalculated in place.

## Units and energy boundaries

The source workbook's food formula treats one tonne/ha as 10,000 × 100 g units/ha. Therefore:

`GJ/ha = yield (tonnes/ha) × 10,000 × energy density (kJ/100 g) ÷ 1,000,000`.

This is gross harvested food energy as represented by the workbook. The model does not infer an edible fraction when the workbook does not supply one. It also does not treat macronutrient percentages as a replacement for the workbook's listed energy density.

For the human calculation:

`GJ/year = kJ/day × 365.25 ÷ 1,000,000`.

For wood:

`useful heat = gross wood energy × heater seasonal efficiency`.

The historical 15 GJ value is retained as gross fuel energy. A default 75% seasonal masonry-heater efficiency is a new assumption, not a historical source value.

## Crop-energy hypothesis

All rows with a numeric `gj_per_ha` are included in the overall distribution. The statistics are count, minimum, quartiles, median, maximum, arithmetic mean, population standard deviation, coefficient of variation, and interquartile range. Quartiles use linear interpolation between sorted observations.

The `energy_role` field is manual and separate from the original workbook group. It is used only for exploratory group summaries. A group with two observations is not treated as strong evidence.

## Hectare budget

The historical display is reconstructed separately from the crop cross-check. The displayed 5–7 GJ food ranges are not silently replaced with the crop median. The crop median is used only to calculate a transparent comparison: 0.25 ha × 25.91 GJ/ha = 6.4775 GJ/year.

Food and wood are reported as separate streams. A summed gross-biological-energy number is provided for bookkeeping only and should not be interpreted as interchangeable human food, useful heat, or a complete solar-energy budget.

## Yurt heating

The new building model approximates the dwelling as a circular cylinder with a conical roof. It calculates wall, roof, floor, window/door, and air-change heat-loss conductances, multiplies by heating degree-days, and applies a configurable net-demand factor for internal/passive gains. It separately reports useful space heat, gross wood energy, dry wood mass, cords, and the implied coppice area at the historical gross yield.

The model is deliberately not calibrated to the historical diagram. Air leakage, floor construction, glazing, solar gains, thermal mass, occupancy, thermostat schedule, moisture, and actual masonry-heater operation remain material uncertainties.

## Farm-size chart

The source rows are copied exactly. The original formulas are:

- crop output relative to land: crop-land share ÷ land share;
- food-crop output relative to land: food-crop share ÷ land share.

The `all size` aggregate is excluded from the size-class correlation. The reproduced chart keeps the historical labels; the cleaned chart uses explicit hectare labels. This is a descriptive association in a constructed dataset, not a causal farm-size productivity estimate.

## Required area versus resilience area

The mathematical food-only area is food demand divided by assumed crop-energy yield. The historical second food quarter, coppice, growing-season adjustment, nutrient interception, soil regeneration, fibre/materials, wildlife protection, and other ecological buffers are retained as resilience or design allowances unless a source calculation proves otherwise.
