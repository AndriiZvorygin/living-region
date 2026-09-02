# Food-production labour ledger

The food-production labour contract extends the existing succession and nutrition ledgers. It does not create a second crop or livestock model.

## Data path

The source coefficients are the existing `data/source/food-production-labour.csv` rows, generated into `data/derived/food-production-labour.json`. A small stable-ID mapping connects those production classes to annual and perennial food IDs. The mapping contains no hours; missing IDs are reported in `missing_data`.

The calculation consumes either the year-specific `food_succession_ledger` or the agroecosystem `whole_diet` ledger. It uses the same planted areas, bearing factors, animal production start years and food-energy rows that feed land and nutrition.

## Time convention and projection boundary

* **Year 0** is initial food-crop, perennial and support establishment before the first production season. It reports one-time establishment hours separately.
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
* `system_maintenance`: pest/wildlife monitoring;
* `water_management`: irrigation and water-system operation hours;
* `fertility_nutrient_cycling` and `seed_propagation`: explicit categories reserved for task coefficients that are not yet present in the source table. Missing work is reported as unresolved, not zero.

The ledger also exposes hours/week, person-hours/week when participating workers are supplied, a coarse seasonal peak, monthly planning weights, and establishment-category hours. Labour capacity is separate from food demand: dependent children may have zero available labour even while contributing food demand.

The current golden comparison uses `projection_mode: fixed_household` and one `reference_adult_man` on the ordinary/mesic site. Food demand, nutrition targets and the number of people fed are constant at every stage; only the annual/perennial production ledger changes. Household lifecycle and family scaling are outside this audit pass.

## Additive tasks and uncertainty

Per-area coefficients scale with the actual annual/perennial areas from the production ledger. Task rows are additive: the calculation never rescales their sum to `mature_recurring_hours_per_ha`. That source field is retained as a separate reference value and reconciled in `reference_reconciliation`; it is not used to suppress explicit task evidence. Perennial maintenance uses task-specific development curves for pruning, orchard care, weed/mulch management, water and pest work. Harvest and preservation scale with actual harvest mass where the succession ledger provides it, with bearing as the documented fallback.

The coefficients are evidence-informed planning estimates, not Grey-Bruce time-and-motion observations. The reference equipment assumption is a low-input household-scale manual system; machine operator time remains human labour and recurring fuel/electricity dependence is separately unresolved. Equipment, soil, weed pressure, skill, irrigation and preservation method can change the result materially. Site acquisition, access-road construction, water systems, fencing and initial earthworks are outside this food-production ledger unless a source row explicitly includes them; they are unresolved work, not zero hours.

The closed-loop ledger is attached to every stage. It distinguishes establishment inputs, recurring external/imported inputs, planned internally regenerated or shared flows, unresolved material inputs and unresolved labour gaps. Each gap has a labour category, input classification, timing and unit/status field; an unknown quantity is `null`, never zero. Existing nutrient and humanure ledgers are reused for the currently wired crop-export, residue, fixation and humanure flows, with zero initial stocks used only as a visibility audit rather than as a soil-stock claim. The result is not labelled closed-loop while propagation, fertility cycling, water source, equipment energy, mineral replacement or the associated work remain unquantified.

The low-external-input reference case therefore includes the labour that is already represented by source task rows, such as manual weed/mulch management, irrigation monitoring, pest/wildlife monitoring, pruning, harvest and preservation. Composting, chop-and-drop, biomass collection/application, seed saving, nursery propagation, humanure handling, tool/equipment maintenance and other work needed to replace purchased inputs are surfaced as unresolved categories until evidence-backed coefficients are added. This prevents a low purchased-input assumption from quietly becoming a low-labour assumption.

The `food_production_labour` contract preserves source, evidence type, notes and the mapped source profiles so a future low/reference/high sensitivity can replace the central planning values without changing the calculation boundary.

## Adequacy boundary

The labour ledger reads year-specific nutrition status from the same whole-diet row. An immature perennial system cannot appear labour-efficient by failing to supply food: the annual bridge in that row is already sized to cover the residual demand, and the UI shows energy/protein status and external nutrient boundaries alongside labour.
