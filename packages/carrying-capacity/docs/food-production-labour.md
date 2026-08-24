# Food-production labour ledger

The food-production labour contract extends the existing succession and nutrition ledgers. It does not create a second crop or livestock model.

## Data path

The source coefficients are the existing `data/source/food-production-labour.csv` rows, generated into `data/derived/food-production-labour.json`. A small stable-ID mapping connects those production classes to annual and perennial food IDs. The mapping contains no hours; missing IDs are reported in `missing_data`.

The calculation consumes either the year-specific `food_succession_ledger` or the agroecosystem `whole_diet` ledger. It uses the same planted areas, bearing factors, animal production start years and food-energy rows that feed land and nutrition.

## Time convention

* **Year 0** is initial perennial/support establishment before the first production season. It reports one-time establishment hours separately.
* **Year 1 onward** reports recurring work for that year's annual crops, perennial systems, harvest, preservation and system maintenance.
* **Mature** is the long-run bearing state from the underlying perennial curves.

The public stages include the complete annual sequence where available. The UI highlights the practical Year 1, 2, 3, 5 and 10 checkpoints and mature state through the table.

## Categories and units

Every value is person-hours/year unless explicitly labelled otherwise:

* `annual_crops`: soil preparation, planting and weeding;
* `perennial_food_forest`: pruning, orchard maintenance and perennial weeding;
* `livestock`: the existing task-based animal ledger, including the corrected self-replacing systems;
* `harvesting`: crop and perennial harvest work;
* `food_preservation_storage`: processing/storage coefficients plus animal processing;
* `system_maintenance`: irrigation/monitoring and pest/wildlife work.

The ledger also exposes hours/week, person-hours/week when participating workers are supplied, a coarse seasonal peak, monthly planning weights, and establishment-category hours. Labour capacity is separate from food demand: dependent children may have zero available labour even while contributing food demand.

## Scaling and uncertainty

Per-area coefficients scale with the actual annual/perennial areas from the production ledger. Perennial maintenance is retained during establishment using the existing bearing-aware transition assumption; harvest and food preservation scale with the bearing factor. Livestock uses its existing discrete animal counts and task-based fixed, animal, grow-out, batch and processing model.

The coefficients are evidence-informed planning estimates, not Grey-Bruce time-and-motion observations. Equipment, soil, weed pressure, skill, irrigation and preservation method can change the result materially. Site acquisition, access-road construction, water systems, fencing and initial earthworks are outside this food-production ledger unless a source row explicitly includes them; they are unresolved work, not zero hours.

The `food_production_labour` contract preserves source, evidence type, notes and the mapped source profiles so a future low/reference/high sensitivity can replace the central planning values without changing the calculation boundary.

## Adequacy boundary

The labour ledger reads year-specific nutrition status from the same whole-diet row. An immature perennial system cannot appear labour-efficient by failing to supply food: the annual bridge in that row is already sized to cover the residual demand, and the UI shows energy/protein status and external nutrient boundaries alongside labour.

