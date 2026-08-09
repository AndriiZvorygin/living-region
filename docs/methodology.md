# Methodology and model boundary

The repository has two explicit layers.

1. The historical layer extracts and preserves Lyis ODS formulas, displayed values, diagrams and related prose.
2. The current layer uses current Health Canada equations, Canadian nutrient composition, Ontario measured benchmarks, explicit low-input adjustments, current evidence on woody systems and a separately audited building model.

Historical values cannot enter a canonical calculation merely because they are present in an old spreadsheet.

## Food energy

For every current crop row:

`edible yield (t/ha) × energy (kJ/100 g) × 0.01 = food GJ/ha/year`

Protein, fat and carbohydrate are calculated from the Canadian nutrient composition record using:

`edible yield (t/ha) × nutrient (g/100 g) × 10 = nutrient kg/ha/year`.

Commercial Ontario provincial averages are preserved as measured benchmarks. The central current planning distribution uses explicit low-input synthesis rows, mostly conservative fractions of those benchmarks anchored where possible to Ontario organic/conventional relationships. This is a transparent interim model, not a claim that a six-row synthesis replaces multi-year Grey-Bruce trials.

The food-system area calculation uses an explicit energy-share mix of potato, wheat, dry beans, sunflower seed and oats. It then applies storage, wildlife, seed, bad-year and community-reserve factors. Fruit, vegetables, nuts, micronutrients and perennial diversity are treated as required design functions but are not assigned unsupported calorie yields.

## Human energy

The current calculation implements Health Canada's Estimated Energy Requirement equations and pregnancy/lactation adjustments. Profiles parameterize age, sex, height, weight, activity and reproductive status. The adult-equivalent is derived as the mean of two representative low-active adults; it is not the old 75 kg Lyis reference.

Children are represented by age-specific Health Canada equations and are reported as their own energy demand. Household capacity is the sum of member demands, not a count of full adults.

## Heating and woody land

The yurt is approximated as a circular cylinder with a conical roof. Heat loss includes opaque wall/roof/floor transmission, windows/doors and ventilation. Annual envelope loss is calculated from the Owen Sound HDD normal and then adjusted by an explicit net-demand factor. Gross wood energy is useful heat divided by heater efficiency.

Woody area is solved rather than assumed:

`required woody area = gross wood energy requirement ÷ (dry biomass yield × 19 GJ/dry tonne × harvest/storage retention)`.

Marginal, ordinary and favourable bands are 3.0, 5.0 and 8.9 dry tonnes/ha/year. The ordinary value is a modelled synthesis anchored to stable eastern/northern short-rotation evidence; exceptional wet-landfill and later peak cultivar values remain sensitivities only.

## Site and household capacity

Site classes alter food productivity and select the woody band: wetter productive, ordinary mesic, dry, and shallow/rocky marginal. These are scenario classes, not claims about every Grey County parcel.

For each household and site:

`mathematical minimum = food area + heating area`

`robust system area = mathematical minimum + diversity/rotation + soil/water + fibre/habitat + deliberate export allowances`.

The allowances are displayed separately so a reader can remove or change them. Exportable food surplus is calculated after household demand and the explicit loss/reserve factors; it is not assumed to appear automatically.

## Economics

Cash production is separate from calories and useful heat. The economic module reports configurable annual saleable-unit volumes for $1,000, $2,000, $3,000 and $5,000 targets. The checked-in direct-sale margins are illustrative placeholders, except for a clearly vintage OCO organic grain-price reference; they must be replaced with current Owen Sound-area farmgate/direct-sale records before public use.
