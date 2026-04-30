# Living Region

Living Region is an open-source map-based regional simulator for exploring how land use, housing, roads, food energy, transportation, infrastructure, population, local services, and rural-transition pressure affect each other over time.

It is designed to make assumptions visible and testable, not to produce official forecasts.

## Why this exists

- Many city-building and planning tools understate food production, land access, energy constraints, road maintenance burden, and rural labour constraints.
- Living Region treats a region as an interdependent metabolism rather than separate policy silos.
- It helps test questions such as:
  - How much local food energy can a region produce under different land/labour/input assumptions?
  - Who has access to productive land?
  - What happens when food, fuel, machinery, and housing costs rise together?
  - How much road maintenance burden comes from spread-out settlement?
  - When could rail/freight corridors become useful?

## Current status

- CLI-first Node.js simulator.
- Deterministic formulas and tests.
- Open-source under AGPL-3.0-or-later.
- Grey County census-scaled seed model.
- Real Grey County Open Data ingestion for municipal boundaries, settlement boundaries, and Official Plan Schedule A land use.
- Secondary useful data can be discovered/downloaded with `npm run grey:discover-all-data` and `npm run grey:download-data -- --all-useful`.
- Road centrelines, parcels/lot fabric, structures/condition, and public facilities are still being verified/imported.
- GeoJSON/CSV output.
- Real GIS import scaffolding.
- No web UI yet.
- Synthetic geometry still needs replacement with real GIS layers.

## Grey County census-scaled seed model

| Municipality | 2021 population | Land area |
|---|---:|---:|
| Owen Sound | 21,612 | 24.21 km² |
| West Grey | 13,131 | 875.21 km² |
| Meaford | 11,485 | 587.57 km² |
| Georgian Bluffs | 11,100 | 599.96 km² |
| Grey Highlands | 10,424 | 879.03 km² |
| The Blue Mountains | 9,390 | 284.65 km² |
| Southgate | 8,716 | 643.08 km² |
| Hanover | 7,967 | 9.78 km² |
| Chatsworth | 7,080 | 594.44 km² |
| **Grey County total** | **100,905** | **4,497.93 km²** |

- Population and land-area scale are census-grounded.
- Geometry, roads, rail, buildings, freight anchors, and patch shapes are still generated scaffolding.
- This is a transition stage before real GIS layers are imported.

## What the model currently tracks

### Land and food energy

- Food energy demand and production in GJ.
- Food coverage.
- Food surplus/deficit in GJ.
- Human-edible food hectares.
- Yield/loss diagnostics.
- Municipal self-coverage versus regional foodshed coverage.

### Rural transition

- Urban/town/village/rural population.
- Land access: none, garden, farm, common, cooperative.
- Food-producing households.
- Food labour demand and effective supply.
- Combined `ruralTransitionPressureIndex`.
- Households at garden/co-op/relocation trigger.
- Households blocked by no land access, low skill, tools, or inputs.

### Housing and households

- Dwelling units, vacancy, rent pressure.
- Average monthly rent-equivalent cost.
- Housing stress and cost burden.

### Roads, transport, and rail

- Road maintenance backlog and infrastructure condition.
- Transport diesel deficit.
- Passenger-km and freight tonne-km.
- Rail utilization and freight corridor diagnostics.
- Rail/road cost and break-even diagnostics.

### Energy

- Food, wood, heat, electricity, diesel, and other energy flows in SI units.
- Food energy is reported mainly in GJ.

## Example outputs

These are scenario diagnostics from the current generated land-use/yield/loss assumptions. They are not measured agricultural capacity or official forecasts.

### Full Grey County scenario

Command:

```bash
npm run demo:grey:full
```

Example output:

- `foodCoverage`: 0.724
- `foodSurplusGJ`: -123,585.32
- `averageRent`: $1,253.92
- `infrastructureCondition`: 0.468

### Full Grey County rail freight-corridor scenario

Command:

```bash
npm run demo:grey:rail:full
```

Example output:

- `foodCoverage`: 0.658
- `foodSurplusGJ`: -395,124.41
- `railPassengerKm`: 4,723,641
- `railFreightTonneKm`: 308,416

### Grey County inspect food balance

Command:

```bash
npm run demo:grey:inspect
```

Example output:

- `annualFoodEnergyGJPerPerson`: 3.7656
- `totalFoodDemandGJ`: 8,152.52
- `grossFoodProductionGJ`: 7,284.86
- `netFoodAvailableGJ`: 5,829.71
- `foodSurplusGJ`: -2,322.81
- `foodCoverage`: 0.715

### Rural transition pressure example

- `ruralTransitionPressureIndex`: 0.492
- `foodAffordabilityStress`: 0.806
- `transportFuelStress`: 0.264
- `housingStress`: 0.890
- `inputCostStress`: 0.240
- `machineryCostStress`: 0.175
- `landAccessOpportunity`: 0.775
- `householdsAtGardenTrigger`: 840
- `householdsAtCoopTrigger`: 189
- `householdsAtRelocationTrigger`: 0
- `householdsBlockedByNoLandAccess`: 189
- `potentialAddedFoodEnergyGJIfLandAccessMet`: 45.00

## Quickstart

```bash
npm install
npm test
npm run demo
npm run seed:grey
npm run demo:grey
npm run demo:grey:inspect
npm run export:geojson
npm run check:food-energy-terms
```

## Useful Grey County commands

```bash
npm run seed:grey:full
npm run demo:grey:full
npm run demo:grey:rail:full
npm run demo:grey:compare-food
npm run grey:download-data
npm run grey:summarize-gis
npm run grey:import-data
npm run seed:grey:open-data
npm run demo:grey:open-data
```

- `seed:grey:full`: generate the full-county census-scaled seed world and map layers.
- `demo:grey:full`: run the no-rail full-county scenario diagnostics.
- `demo:grey:rail:full`: run the rail freight-corridor full-county diagnostics.
- `demo:grey:compare-food`: compare food diagnostics between no-rail and rail scenarios.
- `grey:download-data`: download verified Grey Open Data layers into `know/input/gis`.
- `grey:summarize-gis`: inspect downloaded GeoJSON feature counts/fields/bounds.
- `grey:import-data`: import downloaded Grey layers into a structured world-layer JSON.
- `seed:grey:open-data`: generate a census-scaled Grey world using real municipal/settlement/land-use geometry.
- `demo:grey:open-data`: run a scenario on the open-data geometry world (roads remain synthetic).
- `report:grey:secondary`: summarize downloaded secondary useful layers.

## Outputs

Generated output types in `know/produce/` include:

- metrics JSON
- municipal summary CSV
- food balance CSV
- rural transition CSV
- GeoJSON layers

`know/produce/` is ignored by git.

### Real-data baseline reports

Run:

```bash
npm run report:grey:baseline
```

Outputs:

- `know/produce/grey-baseline-summary.json`
- `know/produce/grey-baseline-municipality-summary.csv`
- `know/produce/grey-baseline-roads-summary.csv`
- `know/produce/grey-baseline-land-use-summary.csv`

These reports summarize downloaded real Grey County layers before scenario modelling, so measured/open-data structure is easier to separate from model assumptions.

### Public baseline report

Run:

```bash
npm run report:grey:public-baseline
```

Outputs:

- `know/produce/grey-public-baseline.md`
- `know/produce/grey-public-baseline.json`
- `know/produce/grey-public-baseline-municipal.csv`

This report summarizes the real Grey County Open Data currently loaded and separates real spatial inputs from modelled assumptions.

### Land-access baseline

```bash
npm run report:grey:land-access
```

Outputs:

- `know/produce/grey-land-access-baseline.md`
- `know/produce/grey-land-access-baseline.json`
- `know/produce/grey-land-access-municipality-summary.csv`
- `know/produce/grey-land-access-lot-detail.csv`

This report uses the real Grey Lots and Concessions layer as a land-structure reference and explicitly does not treat it as parcel ownership.

### Labour-to-productive-land baseline

```bash
npm run report:grey:labour-land
```

This estimates how people are distributed relative to productive land access and how human food-labour requirements change as machinery/fuel support declines. It uses Census population, settlement boundaries, Official Plan land use, and lots/concessions. It is an estimate, not a parcel-ownership or farm-capacity claim.

The report also compares annual, low-fuel, and perennial/permaculture production systems. Perennial systems are modelled as labour-profile changes: high establishment work up front, lower recurring maintenance at maturity, and a wider harvest window that can reduce seasonal labour bottlenecks.
It includes a mature perennial staple bulk scenario to test lower-fiddly harvest systems (for example nut/staple tree-crop belts), with explicit maturity delay and establishment burden.
`annualSmallToolOptimized` is explicitly defined as a human-scale optimized small-tool case (wheel hoes, broadforks, seeders, carts, tarps, drip irrigation, scythes, hand trucks, shared tool libraries), not ordinary hand hoeing and not tractor mechanization.
The report also compares draft animal power as a fossil-fuel substitute. Animal power is modelled as a land-and-labour tradeoff: it can reduce diesel/machinery dependence, but requires feed land, care labour, skill, and overwintering.
The report includes a hand-tool land-tending capacity table, showing rough ranges from intensive market gardening to hand-scale annual staples, mature perennial systems, and silvopasture/woodlot systems.

Outputs:

- `know/produce/grey-labour-land-baseline.md`
- `know/produce/grey-labour-land-baseline.json`
- `know/produce/grey-labour-land-municipality-summary.csv`
- `know/produce/grey-labour-land-scenarios.csv`
- `know/produce/grey-labour-land-permaculture-systems.csv`
- `know/produce/grey-labour-land-permaculture-scenarios.csv`

### Model assessment

```bash
npm run report:model:assessment
```

This writes a present-baseline credibility audit that separates real/open-data inputs from assumption-heavy model layers and identifies priority calibration gaps.

### Food-system calibration

```bash
npm run report:grey:food-calibration
```

### Fuel and fertilizer shock gradation

```bash
npm run report:grey:fuel-shock
```

This adds gradual and abrupt fuel/fertilizer/input shock diagnostics and adaptation-package comparisons for food coverage and labour mobilization needs.

Outputs:

- `know/produce/grey-fuel-fertilizer-shock.md`
- `know/produce/grey-fuel-fertilizer-shock.json`
- `know/produce/grey-fuel-fertilizer-shock-scenarios.csv`
- `know/produce/grey-fuel-fertilizer-shock-labour.csv`

### Current-system shock thresholds

```bash
npm run report:grey:current-shock-threshold
```

This report estimates when fuel/input shocks begin to create serious stress in the current supply-chain-dependent system, before assuming local resilience adaptations are in place.

Outputs:

- `know/produce/grey-current-system-shock-threshold.md`
- `know/produce/grey-current-system-shock-threshold.json`
- `know/produce/grey-current-system-shock-threshold-scenarios.csv`
- `know/produce/grey-current-system-shock-threshold-households.csv`

### Food gap replacement by production modality

```bash
npm run report:grey:food-gap-replacement
```

This report estimates how much land and labour would be needed to replace food losses under input-shock scenarios, comparing market gardens, hand-tool systems, low-input annuals, greenhouses, and perennial/permaculture systems.

Outputs:

- `know/produce/grey-food-gap-replacement.md`
- `know/produce/grey-food-gap-replacement.json`
- `know/produce/grey-food-gap-replacement-scenarios.csv`
- `know/produce/grey-food-gap-replacement-modalities.csv`
- `know/produce/grey-food-gap-replacement-timeline.csv`

### Food supply-demand and price pressure

```bash
npm run report:grey:food-price
```

This report estimates how household self-provisioning, surplus local production, storage/loss reduction, and food shocks affect market demand, local supply, price pressure, and food insecurity risk.

Outputs:

- `know/produce/grey-food-supply-demand-price.md`
- `know/produce/grey-food-supply-demand-price.json`
- `know/produce/grey-food-supply-demand-price-scenarios.csv`
- `know/produce/grey-food-supply-demand-price-households.csv`

### Food insecurity trend drivers

```bash
npm run report:grey:food-insecurity-trends
```

This report separates baseline food-insecurity trend pressure from shock-added pressure and maps candidate drivers (attribution diagnostic, not causal proof).

Outputs:

- `know/produce/grey-food-insecurity-trend-drivers.md`
- `know/produce/grey-food-insecurity-trend-drivers.json`
- `know/produce/grey-food-insecurity-trend-drivers.csv`

### Transition pathway comparison

```bash
npm run report:grey:transition-pathways
```

Compares no-change, reactive, moderate, strong, and full-rural-transition adaptation pathways under gradual and abrupt fuel/input decline scenarios from 2025 to 2050.

Outputs:

- `know/produce/grey-transition-pathways.md`
- `know/produce/grey-transition-pathways.json`
- `know/produce/grey-transition-pathways-scenarios.csv`
- `know/produce/grey-transition-pathways-human-impact.csv`
- `know/produce/grey-transition-pathways-timeline.csv`

### Plain-English briefing

```bash
npm run report:grey:briefing
```

Generates a plain-English briefing and email-ready summary using current Grey report outputs. It is a civic planning diagnostic summary, not an official forecast.

Outputs:

- `know/produce/grey-plain-english-briefing.md`
- `know/produce/grey-plain-english-briefing.json`
- `know/produce/grey-plain-english-email-summary.md`

### Localization access baseline

```bash
npm run report:grey:localization-access
```

This report identifies candidate settlement/service nodes for local food hubs, storage, processing, tool libraries, repair shops, animal-power depots, and wood-energy depots using Grey County open data. It is a spatial/access diagnostic, not a feasibility or capital plan.

Outputs:

- `know/produce/grey-localization-access.md`
- `know/produce/grey-localization-access.json`
- `know/produce/grey-localization-access-municipal.csv`
- `know/produce/grey-localization-access-candidate-nodes.csv`

### Census small-area population distribution

```bash
npm run census:download-2021
npm run census:import-grey-population
npm run report:grey:population-distribution
```

This uses aggregate 2021 Census dissemination geography to improve Grey population distribution diagnostics inside municipalities and settlement/rural contexts. It does not represent individual-level address or personal data.

### Census of Agriculture baseline

```bash
npm run census-ag:download-2021
npm run census-ag:import-grey
npm run report:grey:farm-labour
```

This adds Census of Agriculture operator/farm-labour calibration plumbing for Grey baseline diagnostics. It supports manual URL/file workflows when direct table download links are not automatically resolved.

Outputs:

- `know/produce/grey-census-agriculture-baseline.json`
- `know/produce/grey-farm-labour-baseline.md`
- `know/produce/grey-farm-labour-baseline.csv`

### Census Population agricultural labour baseline

```bash
npm run census-pop-labour:download-2021
npm run census-pop-labour:import-grey
npm run report:grey:ag-labour
```

This uses Census of Population occupation and industry tables to estimate current agriculture-related workers/FTE in Grey and compare them to low-fuel/perennial food-labour scenarios.

Outputs:

- `know/produce/grey-census-population-labour-baseline.json`
- `know/produce/grey-ag-labour-baseline.md`
- `know/produce/grey-ag-labour-baseline.csv`

### Dwelling-to-land-access threshold baseline

```bash
npm run report:grey:dwelling-land-access
```

This estimates how aggregate Census dwellings/population relate to lot/concession land-access proxies and threshold classes. It does not identify ownership, legal access, or exact household locations.

Outputs:

- `know/produce/grey-dwelling-land-access.md`
- `know/produce/grey-dwelling-land-access.json`
- `know/produce/grey-dwelling-land-access-municipal.csv`
- `know/produce/grey-dwelling-land-access-thresholds.csv`

### Run all Grey reports

```bash
npm run report:grey:all
```

Options:

```bash
npm run report:grey:all -- --quick
npm run report:grey:all -- --skip-download
npm run report:grey:all -- --force-download
```

Outputs:

- `know/produce/grey-report-suite-summary.md`
- `know/produce/grey-report-suite-summary.json`

## Researcher handoff: global supply-chain diagnosis integration

Living Region currently integrates two linked layers:

1. Global/systemic shock layer
- oil/fuel availability
- fuel price pass-through
- sulfur/phosphate fertilizer pressure
- nitrogen/natural gas fertilizer pressure
- shipping/logistics pressure
- import price pressure
- global food production loss assumptions
- global food price pressure
- trade competition
- disproportionate impact on poorer countries and lower-income households

2. Grey County local-response layer
- population/dwellings
- settlement/rural distribution
- land-use and lots/concessions proxy
- food demand
- local production potential
- ag labour
- land access
- storage/processing/local distribution
- price-pressure and food-insecurity effects

### Where global assumptions plug in

| Global/systemic input | Current model field | Used in reports | Status | Researcher can improve by |
|---|---|---|---|---|
| oil supply loss | `fuelAvailabilityIndex` | `report:grey:current-shock-threshold`, `report:grey:fuel-shock`, `report:grey:food-price` | scenario assumption | calibrate with external oil disruption scenarios and sensitivity ranges |
| diesel price pass-through | `dieselPriceMultiplier`, `fuelPriceIncreasePct` | `report:grey:current-shock-threshold`, `report:grey:fuel-shock` | proxy + scenario profile | add historical pass-through calibration by shock band |
| sulfur/phosphate fertilizer shock | currently represented via `fertilizerAvailabilityIndex`, `fertilizerPriceMultiplier`, `inputConstraintFactor` | `report:grey:fuel-shock`, `report:grey:food-price` | proxy | split fertilizer into explicit sulfur/phosphate channel |
| nitrogen/natural gas fertilizer shock | currently represented via `fertilizerAvailabilityIndex`, `fertilizerPriceMultiplier`, `inputConstraintFactor` | `report:grey:fuel-shock`, `report:grey:food-price` | proxy | split fertilizer into explicit nitrogen/natural-gas channel |
| shipping/logistics shock | `transportCostMultiplier`, `transportFuelAvailabilityIndex` | `report:grey:current-shock-threshold`, `report:grey:food-price` | proxy | add shipping/freight rate scenario data and lag assumptions |
| global food production loss | `globalFoodProductionLossShare` | `report:grey:food-gap-replacement`, `report:grey:food-price`, `report:grey:briefing` | severe scenario assumption | calibrate with external production-loss pathways and confidence bands |
| global food price pressure | `globalFoodPricePressure` driver | `report:grey:food-insecurity-trends` | measured/proxy | load FAO Food Price Index time series into driver attribution |
| malnutrition/global hunger pressure | trend anchors + `globalFoodPricePressure` notes | `report:grey:food-insecurity-trends` | context anchor, not causal proof | add IHME/OWID malnutrition time-series for correlation diagnostics only |
| trade competition / export restrictions | `tradeCompetitionIndex` | `report:grey:food-gap-replacement`, `report:grey:food-price` | scenario assumption | add explicit export-restriction/trade-competition model |
| lower surplus energy / purchasing power | `lowerSurplusEnergyPurchasingPowerProxy` | `report:grey:food-insecurity-trends` | proxy/assumption | calibrate with energy-cost burden and real-disposable-income trend data |

Field meanings, current usage, and data status:

- `globalFoodProductionLossShare`: severe global production-loss assumption used as a global shock channel.
Current status: scenario assumption.
Improve with: externally validated global production-loss scenarios.
- `localFoodAvailabilityLossShare`: local availability shock share used separately from global loss.
Current status: scenario assumption/proxy.
Improve with: local crop/input/logistics disruption data.
- `importPricePressureMultiplier`: import affordability/price pressure transmission factor.
Current status: scenario assumption.
Improve with: Ontario/Canada food import price data and pass-through calibration.
- `localProductionShockShare`: direct local production shock component.
Current status: scenario assumption.
Improve with: local input-access and seasonal production disruption datasets.
- `tradeCompetitionIndex`: proxy for tighter global competition/export constraints.
Current status: scenario assumption.
Improve with: trade-flow/restriction scenario inputs.
- `householdAffordabilityTransmissionShare`: share of global/systemic pressure transmitted to household stress.
Current status: scenario assumption.
Improve with: household budget and food affordability microdata.
- `fuelAvailabilityIndex`: physical fuel availability level relative to baseline.
Current status: scenario assumption.
Improve with: scenario-specific energy supply constraints.
- `dieselPriceMultiplier`: diesel cost multiplier from pass-through logic.
Current status: proxy.
Improve with: historical pass-through and regional fuel price series.
- `fertilizerAvailabilityIndex`: aggregated fertilizer availability pressure.
Current status: proxy.
Improve with: split channels (N vs sulfur/phosphate) and supply data.
- `fertilizerPriceMultiplier`: aggregated fertilizer price pressure.
Current status: proxy.
Improve with: commodity-specific fertilizer price series.
- sulfur/phosphate pressure: represented via aggregate fertilizer/input pressure until channel split.
Current status: proxy.
Improve with: dedicated sulfur/phosphate supply-risk channel.
- nitrogen/natural-gas pressure: represented via aggregate fertilizer/input pressure until channel split.
Current status: proxy.
Improve with: dedicated nitrogen/natural-gas supply-risk channel.
- `foodPriceIncreasePct`: modeled food price pass-through under shock profiles.
Current status: proxy/scenario profile.
Improve with: empirical pass-through calibration.
- `fuelPriceIncreasePct`: modeled fuel price shock pass-through.
Current status: proxy/scenario profile.
Improve with: historical shock episodes and non-linear fit.
- `transportCostMultiplier`: transport cost pressure from fuel/logistics stress.
Current status: proxy.
Improve with: freight/trucking/retail distribution cost data.
- `globalFoodPricePressure` driver: explicit trend driver in attribution diagnostic.
Current status: measured/proxy.
Improve with: loaded FAO FPI series and local price-basket linkage.
- `lowerSurplusEnergyPurchasingPowerProxy`: systems-level pressure hypothesis channel.
Current status: proxy/assumption.
Improve with: calibrated energy-cost burden + disposable income metrics.

### Severe systemic input-loss scenario

Current `severeSystemicInputLoss33` values:

- `globalFoodProductionLossShare`: `0.33`
- `localFoodAvailabilityLossShare`: `0.12`
- `importPricePressureMultiplier`: `1.55`
- `localProductionShockShare`: `0.08`
- `tradeCompetitionIndex`: `0.85`
- `householdAffordabilityTransmissionShare`: `0.72`
- `sourceStatus`: `severe global scenario assumption, not forecast`
- `interpretation`: `global price/availability shock, not direct local crop failure`

Caveat:
A one-third global food production loss is not the same as Grey County having one-third less local food. In Grey, the near-term channel is price pressure, trade competition, import stress, food-bank pressure, and household affordability.

### Reports most useful for global-system integration

```bash
npm run report:grey:current-shock-threshold
npm run report:grey:food-insecurity-trends
npm run report:grey:food-price
npm run report:grey:food-gap-replacement
npm run report:grey:fuel-shock
npm run report:grey:transition-pathways
npm run report:grey:briefing
npm run report:grey:all -- --quick
```

- `current-shock-threshold`: current supply-chain vulnerability and lag thresholds.
- `food-insecurity-trends`: baseline trend drivers and global food-price pressure channel.
- `food-price`: supply/demand, household self-provisioning, surplus, and price-pressure proxy.
- `food-gap-replacement`: labour/land by production modality for replacing food gaps.
- `fuel-shock`: fuel/fertilizer shock gradations and adaptation deltas.
- `transition-pathways`: no-change vs adaptation pathways over time.
- `briefing`: plain-English summary for collaborator/public handoff.
- `all`: one-command suite run and summary.

### Data files to inspect

- `know/produce/grey-current-system-shock-threshold.json`
- `know/produce/grey-current-system-shock-threshold-pass-through.csv`
- `know/produce/grey-current-system-shock-threshold-trend.csv`
- `know/produce/grey-food-insecurity-trend-drivers.json`
- `know/produce/grey-food-supply-demand-price.json`
- `know/produce/grey-food-supply-demand-price-scenarios.csv`
- `know/produce/grey-food-gap-replacement.json`
- `know/produce/grey-food-gap-replacement-modalities.csv`
- `know/produce/grey-transition-pathways.json`
- `know/produce/grey-report-suite-summary.json`
- `know/produce/grey-plain-english-briefing.md`

### Suggested integration workflow

1. Run the suite:

```bash
npm run report:grey:all -- --quick
```

2. Inspect current global-shock assumptions:

```bash
node -e 'const f=require("fs"); const j=JSON.parse(f.readFileSync("know/produce/grey-food-supply-demand-price.json","utf8")); console.log(JSON.stringify(j.assumptions || j.scenarioAssumptions || {}, null, 2));'
```

3. Adjust scenario fields in the relevant report module or add a configuration input.

4. Re-run:

```bash
npm test
npm run report:grey:current-shock-threshold
npm run report:grey:food-price
npm run report:grey:food-gap-replacement
npm run report:grey:briefing
```

5. Compare:

- food insecurity trend
- price-pressure proxy
- food gap replacement labour
- unmet gap
- adaptation benefits

### Next integration improvements

- split fertilizer into nitrogen/natural gas and sulfur/phosphate channels
- add explicit export restriction / trade competition model
- load FAO Food Price Index time series
- load global malnutrition/death-rate time series only as context, not simple causal proof
- add local food bank/soup kitchen time series
- add food basket price series for Grey/Ontario
- add Census of Agriculture historical farm count/size/operator trends
- add configurable scenario YAML/JSON so researcher can edit assumptions without changing code

### Do not overclaim

- scenario diagnostics, not forecasts
- global food production loss does not equal local food loss
- price-pressure multiplier is not retail price forecast
- malnutrition deaths are not a direct food-price index
- local land access proxy is not ownership/legal access

## Real-data priority

Minimum real GIS layers to replace generated geometry:

1. Municipal boundary polygons
2. Road centrelines with road class/type
3. Settlement, village, hamlet, or urban boundary polygons
4. Official Plan land-use designation polygons

These would replace generated geometry and make road burden, settlement structure, land-use shares, and corridor analysis much more credible.

## GIS/Open Data Workflow

- Start with `know/input-example/`.
- Copy to `know/input/`.
- Import GeoJSON/CSV bundle with `npm run import:region`.
- Run imported scenarios with `npm run demo:imported`.
- Imported data remains under source-provider licence/terms.

See [open-data.md](/home/htaf/living-region/docs/open-data.md) and [import-schema.md](/home/htaf/living-region/docs/import-schema.md).

## Development

- Node.js ESM project.
- Tests live under `quiz/`.
- Formulas are deterministic and inspectable.
- Core constants live in `program/data/default_constants.mjs` and calibration profiles.
- No hidden magic constants; assumptions are explicit in code/data.
- `npm run check:food-energy-terms` guards docs against accidental reintroduction of disallowed food-energy wording.

## Licence

Living Region is licensed under GNU Affero General Public License v3.0 or later (`AGPL-3.0-or-later`). See [LICENSE](/home/htaf/living-region/LICENSE) and [NOTICE](/home/htaf/living-region/NOTICE).

## Limitations

- Synthetic demo/seed geometry is scaffolding.
- Grey County population/land-area scale is census-grounded; municipal/settlement/land-use geometry can now come from downloaded Grey open data.
- Road centrelines and lot fabric still need verified sources; until then road network modelling remains synthetic/generated links.
- Road structures/conditions and public facilities/service nodes are still pending open-data ingestion.
- Formulas are coarse and transparent, not calibrated econometrics.
- No web UI yet.
- No full routing engine yet.
- Outputs are scenario diagnostics, not official forecasts.
