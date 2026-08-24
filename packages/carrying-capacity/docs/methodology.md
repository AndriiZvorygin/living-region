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

The current calculation implements Health Canada's Estimated Energy Requirement equations and pregnancy/lactation adjustments. Profiles parameterize age, sex, height, weight, activity and reproductive status. The adult-equivalent is derived as the mean of two representative low-active adults; it is not the old 75 kg Lyis reference. It is a **food-energy normalization only** and must not be multiplied into total land.

Children are represented by age-specific Health Canada equations and are reported as their own energy demand. Household capacity is the sum of member demands, not a count of full adults.

## Heating and woody land

The yurt is approximated as a circular cylinder with a conical roof. Heat loss includes opaque wall/roof/floor transmission, windows/doors and ventilation. Annual envelope loss is calculated from the Owen Sound HDD normal and then adjusted by an explicit net-demand factor. Gross wood energy is useful heat divided by heater efficiency.

Woody area is solved rather than assumed:

`required woody area = gross wood energy requirement ÷ (dry biomass yield × 19 GJ/dry tonne × harvest/storage retention)`.

Marginal, ordinary and favourable bands are 3.0, 5.0 and 8.9 dry tonnes/ha/year. The ordinary value is a modelled synthesis anchored to stable eastern/northern short-rotation evidence; exceptional wet-landfill and later peak cultivar values remain sensitivities only.

## Site and household capacity

Site classes alter food productivity and select the woody band: wetter productive, ordinary mesic, dry, and shallow/rocky marginal. These are scenario classes, not claims about every Grey County parcel.

For the pre-ageing baseline household capacity layer:

`mathematical minimum = food area + heating area`

`baseline robust system area = mathematical minimum + diversity/rotation + soil/water + fibre/habitat + deliberate export allowances`.

The heating component is shared at the dwelling level in the current household scenarios. Children increase household food demand but do not create linear adult-equivalent land units. The ARC comparison allocation is 1 ha for a one-adult household and 2 ha for a two-adult household; it is evaluated against both the baseline and mature ageing-in-place result. The mature solver retains the existing diversity/rotation allowance as an exclusive reserve, but places soil/water, wildlife, fibre and habitat functions inside productive perennial/woody zones. Optional market land first uses annual acreage released during succession; only any residual is added to gross site area.

## Economics

Cash production is separate from calories and useful heat. The economic module reports configurable annual saleable-unit volumes for $1,000, $2,000, $3,000 and $5,000 targets. The checked-in direct-sale margins are illustrative placeholders, except for a clearly vintage OCO organic grain-price reference; they must be replaced with current Owen Sound-area farmgate/direct-sale records before public use.

## Annual-to-perennial transition

The food-forest transition is a succession model. For each household/site, annual crops first provide the residual household demand while perennial production follows class-specific bearing curves. The central mix is not a monocrop: berry/vitamin, hazelnut fat/protein, chestnut starch and fruit/storage layers each have an area share and separate yield fraction. Production is calculated as:

`annual usable food + perennial usable food = total usable food`

Young-row intercropping is represented as an explicit overlap in physical hectares. Occupied food land is:

`annual area + perennial footprint - intercrop overlap`.

The strict transition forest footprint is solved to keep each requested year within the food-production envelope as overlap declines. This protects the annual bridge but can be smaller than the unconstrained mature forest target. Released annual hectares are reported for a progressive handoff strategy; a staged later planting must use a slower age curve for the new rows. The transition output does not convert the result into hectares per adult-equivalent.

## Ageing-in-place and labour

The mature objective is a labour transition, not maximum GJ/ha. Annual crops are the establishment bridge; perennial berries, shrubs, fruit trees and staple trees progressively increase food supply. The model tests 50%, 60%, 70%, 75%, 80% and continuous maximum-feasible perennial-calorie shares. The canonical plants-only share is selected as the lowest tested share that meets the explicit low-replanting, annual-resilience, protein and fat screening constraints; 75% is therefore a comparison scenario, not a fixed assumption. The zero-annual-area progressive-handoff case remains a sensitivity only.

`data/source/food-production-labour.csv` records establishment labour, recurring labour, annual soil preparation, planting frequency, weeding, watering/monitoring, harvest, pruning/maintenance, irrigation, orchard maintenance, pest/wildlife work, processing/storage, greenhouse management and explicit coppice/firewood tasks. Hours are explicit planning estimates rather than a Grey-Bruce time-and-motion study. The model reports establishment labour separately from mature recurring labour and calculates:

`food energy without annual soil preparation/replanting ÷ household food energy`.

For plants-only rows this equals the perennial calorie percentage. The optional livestock module can make it broader where animal food is credited to perennial/on-property feed, while also adding daily animal care, winter storage, feed and manure handling. The mature canonical labour audit separates heavy annual cultivation, heavy woody work, physically demanding hours, light/moderate recurring hours and processing/storage hours.

## Perennial protein and optional livestock

Hazelnut and chestnut have usable food composition plus conservative planning yields in the current perennial mix. Heartnut/walnut, honey locust, Siberian peashrub/Caragana and perennial legumes/vegetables are retained as candidate functions or feed sources, not automatically as human protein. Honey locust pod edibility and USDA-reported seed/pod protein, and Caragana hardiness, are evidence to investigate rather than canonical yields.

The optional mature modules compare plants-only, a small egg flock, rabbits, combined livestock and an on-site-feed-constrained combined module. The livestock comparison uses the 75% perennial / 25% annual split; plants-only canonical land uses the solved share in `outputs/mature-food-system-canonical.md`. Animal feed dry matter, protein, energy, on-property fraction, purchased fraction, winter storage, feed area, labour and manure are explicit. This keeps caloric carrying capacity, nutritional output, livestock production and cash/value production separate.

## Food-production labour ledger

Food-production effort is calculated from the year-specific succession/whole-diet ledger, using the existing task-level evidence in `data/source/food-production-labour.csv`. Year 0 establishment work is kept separate from recurring annual work. Annual crops, perennial maintenance, livestock, harvest, preservation/storage and system maintenance are reported in person-hours/year with a coarse seasonal distribution. See `docs/food-production-labour.md` for the contract boundary, units, scaling and unresolved site-work categories.
