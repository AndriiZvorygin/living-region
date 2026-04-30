# Living Region

Living Region is an open-source regional resilience model for testing how land, food, fuel, labour, transport, housing, infrastructure, and local services interact under stress. It makes assumptions visible and testable. It is not an official forecast.

## Current status

- CLI-first Node.js model
- deterministic formulas and tests
- AGPL-3.0-or-later
- Grey County is the first real-data region
- real Grey open data imported:
  - municipal boundaries
  - settlement boundaries
  - Official Plan Schedule A land use
  - Grey road centrelines
  - lots/concessions reference layer
  - transit/trails/cycling/facilities/rural business/managed forest/road-support layers where available
- real Statistics Canada data imported:
  - 2021 Census GAF
  - Census dissemination block geometry
  - population matched exactly to `100,905`
  - dwellings `50,183`
- no web UI yet
- parcel ownership/address-level dwelling data still missing
- model outputs are scenario diagnostics, not official forecasts

## Quickstart

```bash
npm install
npm test
npm run report:grey:all -- --quick
npm run report:grey:briefing
```

- `report:grey:all -- --quick` runs the full current Grey reporting suite and targeted required input downloads.
- `report:grey:briefing` writes plain-English outputs.

## Core Grey facts currently loaded

- Population: `100,905`
- Dwellings: `50,183`
- Municipalities: `9`
- Settlement boundaries: `56`
- Road network: about `4,794 km`
- Lots/concessions features: `10,137`
- Census DB features matched: `1,923`
- Inside settlement population: `49,882`
- Outside settlement population: `51,023`

## Main current findings

1. Land base is not the main constraint under present industrial assumptions.
- `presentIndustrialFossilBaseline` `foodCoverage`: `4.617`

2. Local self-reliance is much weaker.
- `localizedPresentTechBaseline`: `0.472`
- `constrainedLocalFoodBaseline`: `0.277`
- deeper fuel/input constrained case: `0.167`

3. Outside settlement is not land access.
- no-direct-access proxy: about `7,990`
- subsistence-potential proxy: about `54,949`
- caveat: proxy, not ownership/legal access

4. Labour is a major constraint.
- agriculture-industry FTE estimate: about `3,918`
- current core ag occupation table still incomplete/missing
- industry proxy only

5. Current-system shock thresholds now separate:
- measured food insecurity anchor
- broader vulnerability band
- trend baseline
- shock-added stress
- nonlinear price pass-through

6. Local response helps through supply and demand.
- household self-provision reduces market demand
- surplus production increases local supply
- storage/loss reduction increases effective supply
- local response reduces price-pressure proxy and food-insecurity estimate

7. Severe systemic input-loss scenario is global first.
- `globalFoodProductionLossShare`: `0.33`
- `localFoodAvailabilityLossShare`: `0.12`
- interpretation: global price/availability shock, not direct Grey crop failure

## Common commands

### Data acquisition

```bash
npm run grey:download-data
npm run grey:download-data -- --all-useful
npm run census:download-2021
npm run census:import-grey-population
npm run census-pop-labour:download-2021
npm run census-pop-labour:import-grey
npm run census-ag:download-2021
npm run census-ag:import-grey
```

### Core reports

```bash
npm run report:grey:all -- --quick
npm run report:grey:public-baseline
npm run report:grey:population-distribution
npm run report:grey:dwelling-land-access
npm run report:grey:labour-land
npm run report:grey:ag-labour
npm run report:model:assessment
```

### Food/fuel/shock reports

```bash
npm run report:grey:food-calibration
npm run report:grey:current-shock-threshold
npm run report:grey:food-insecurity-trends
npm run report:grey:food-price
npm run report:grey:food-gap-replacement
npm run report:grey:fuel-shock
npm run report:grey:transition-pathways
```

### Human-readable outputs

```bash
npm run report:grey:briefing
```

## Report map

| Report | Command | Main question | Main outputs |
| ------ | ------- | ------------- | ------------ |
| public baseline | `npm run report:grey:public-baseline` | What real layers and core regional indicators are loaded? | `grey-public-baseline.{md,json,csv}` |
| population distribution | `npm run report:grey:population-distribution` | Where do people/dwellings sit across settlement/rural contexts? | `grey-population-distribution.{md,json,csv}` |
| dwelling land access | `npm run report:grey:dwelling-land-access` | Which dwellings likely map to productive land thresholds? | `grey-dwelling-land-access.{md,json,csv}` |
| land access | `npm run report:grey:land-access` | How are lots/land-use/settlement contexts assigned? | `grey-land-access-baseline.{md,json,csv}` |
| labour-land | `npm run report:grey:labour-land` | How do production systems compare in labour/land terms? | `grey-labour-land-baseline.{md,json,csv}` |
| ag labour | `npm run report:grey:ag-labour` | What current ag-related labour baseline is available? | `grey-ag-labour-baseline.{md,json,csv}` |
| food calibration | `npm run report:grey:food-calibration` | How sensitive is food coverage to land/yield/labour assumptions? | `grey-food-calibration.{md,json,csv}` |
| current shock threshold | `npm run report:grey:current-shock-threshold` | At what shock levels does current system stress become severe? | `grey-current-system-shock-threshold.{md,json,csv}` |
| food insecurity trends | `npm run report:grey:food-insecurity-trends` | What baseline trend drivers likely explain pre-shock rise? | `grey-food-insecurity-trend-drivers.{md,json,csv}` |
| food price | `npm run report:grey:food-price` | How do local supply-demand shifts change price-pressure proxy? | `grey-food-supply-demand-price.{md,json,csv}` |
| food gap replacement | `npm run report:grey:food-gap-replacement` | How much labour/land is needed by modality to fill food gaps? | `grey-food-gap-replacement.{md,json,csv}` |
| fuel shock | `npm run report:grey:fuel-shock` | How do fuel/fertilizer shock gradations affect coverage/labour? | `grey-fuel-fertilizer-shock.{md,json,csv}` |
| transition pathways | `npm run report:grey:transition-pathways` | What changes under no-change vs adaptation pathways to 2050? | `grey-transition-pathways.{md,json,csv}` |
| localization access | `npm run report:grey:localization-access` | Where are candidate local infra/service nodes? | `grey-localization-access.{md,json,csv}` |
| model assessment | `npm run report:model:assessment` | How credible is present-baseline by domain, and what gaps remain? | `living-region-model-assessment.{md,json,csv}` |
| briefing | `npm run report:grey:briefing` | What plain-English synthesis is shareable now? | `grey-plain-english-briefing.{md,json}` |
| report suite | `npm run report:grey:all -- --quick` | Where is the model now, end-to-end? | `grey-report-suite-summary.{md,json}` |

## Key output files

### Suite/briefing

- `know/produce/grey-report-suite-summary.json`
- `know/produce/grey-report-suite-summary.md`
- `know/produce/grey-plain-english-briefing.md`
- `know/produce/grey-plain-english-email-summary.md`

### Population/land

- `know/produce/grey-census-population-distribution.json`
- `know/produce/grey-census-population-blocks.geojson`
- `know/produce/grey-dwelling-land-access.json`
- `know/produce/grey-land-access-baseline.json`

### Food/shock/economics

- `know/produce/grey-food-calibration.json`
- `know/produce/grey-current-system-shock-threshold.json`
- `know/produce/grey-current-system-shock-threshold-pass-through.csv`
- `know/produce/grey-current-system-shock-threshold-trend.csv`
- `know/produce/grey-food-insecurity-trend-drivers.json`
- `know/produce/grey-food-supply-demand-price.json`
- `know/produce/grey-food-gap-replacement.json`
- `know/produce/grey-fuel-fertilizer-shock.json`
- `know/produce/grey-transition-pathways.json`

### Labour/localization

- `know/produce/grey-ag-labour-baseline.json`
- `know/produce/grey-labour-land-baseline.json`
- `know/produce/grey-localization-access.json`

## Researcher handoff: global supply-chain diagnosis integration

### Model layers

Living Region links two layers:

1. Global/systemic shock layer
- oil/fuel availability and pass-through
- fertilizer/input pressure (including sulfur/phosphate and nitrogen/natural-gas proxies)
- shipping/logistics pressure
- import price pressure
- global food production loss assumptions
- global food price pressure and trade competition
- affordability transmission into households

2. Grey County local-response layer
- population and dwelling distribution
- settlement/rural form and land-access proxy
- local production and labour scaling
- storage/processing/distribution buffers
- price-pressure and food-insecurity effects

### Where global assumptions plug in

- `globalFoodProductionLossShare`
- `localFoodAvailabilityLossShare`
- `importPricePressureMultiplier`
- `localProductionShockShare`
- `tradeCompetitionIndex`
- `householdAffordabilityTransmissionShare`
- `fuelAvailabilityIndex`
- `fuelPriceIncreasePct`
- `dieselPriceMultiplier`
- `fertilizerAvailabilityIndex`
- `fertilizerPriceMultiplier`
- sulfur/phosphate pressure proxy (currently in aggregated fertilizer/input pressure)
- nitrogen/natural-gas pressure proxy (currently in aggregated fertilizer/input pressure)
- `transportCostMultiplier`
- `globalFoodPricePressure`
- `lowerSurplusEnergyPurchasingPowerProxy`

| Global/systemic input | Current model field | Used in reports | Status | Researcher can improve by |
|---|---|---|---|---|
| oil supply loss | `fuelAvailabilityIndex` | current-shock-threshold, fuel-shock, food-price | scenario assumption | external energy-supply scenario calibration |
| diesel price pass-through | `fuelPriceIncreasePct`, `dieselPriceMultiplier` | current-shock-threshold, fuel-shock | proxy/profile | historical pass-through calibration |
| sulfur/phosphate fertilizer shock | aggregated fertilizer/input channel | fuel-shock, food-price | proxy | split explicit sulfur/phosphate channel |
| nitrogen/natural gas fertilizer shock | aggregated fertilizer/input channel | fuel-shock, food-price | proxy | split explicit nitrogen/natural-gas channel |
| shipping/logistics shock | `transportCostMultiplier` | current-shock-threshold, food-price | proxy | freight/shipping series and lag calibration |
| global food production loss | `globalFoodProductionLossShare` | food-gap-replacement, food-price, briefing | severe scenario assumption | externally bounded scenario bands |
| global food price pressure | `globalFoodPricePressure` driver | food-insecurity-trends | measured/proxy | load FAO FPI time series |
| malnutrition/global hunger pressure | global anchors and context notes | food-insecurity-trends | context/proxy | load malnutrition trend series for correlation diagnostics |
| trade competition/export restrictions | `tradeCompetitionIndex` | food-gap-replacement, food-price | scenario assumption | explicit trade-competition submodel |
| lower surplus energy/purchasing power | `lowerSurplusEnergyPurchasingPowerProxy` | food-insecurity-trends | proxy/assumption | calibrate with income/energy burden data |

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

- `current-shock-threshold`: current supply-chain vulnerability and lag thresholds
- `food-insecurity-trends`: baseline trend drivers and global food-price pressure channel
- `food-price`: supply/demand, household self-provisioning, surplus, price-pressure proxy
- `food-gap-replacement`: labour/land by production modality for replacing food gaps
- `fuel-shock`: fuel/fertilizer shock gradations
- `transition-pathways`: no-change vs adaptation over time
- `briefing`: plain-English summary
- `all`: one-command suite

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
- add configurable scenario file (e.g. `know/input/scenarios/global-systemic-shock.json`) so researchers can edit assumptions without modifying report code

### Do not overclaim

- scenario diagnostics, not forecasts
- global food production loss does not equal local food loss
- price-pressure multiplier is not retail price forecast
- malnutrition deaths are not a direct food-price index
- local land access proxy is not ownership/legal access

## Current data gaps

Missing / weak:

- modern parcel/assessment fabric
- address points/building footprints/dwelling units by parcel
- core occupation-unit agriculture rows
- Census of Agriculture farm-operator historical rows
- soil/crop/ag capability calibration
- local processing/storage capacity
- local food bank/soup kitchen time series
- local food basket price series
- traffic/freight flow data
- road/bridge maintenance cost calibration
- household income/rent distribution
- explicit sulfur/phosphate and nitrogen/natural-gas fertilizer channels
- configurable scenario files

## Development

- Node.js ESM project
- tests under `quiz/`
- deterministic formulas and transparent model logic
- assumptions are explicit in code and output fields
- generated outputs under `know/produce/` are git-ignored
- AGPL-3.0-or-later license

## Limitations

- scenario diagnostics, not forecasts
- price-pressure multiplier is not retail price forecast
- global food production loss does not equal local food loss
- lots/concessions are historical reference fabric, not modern parcel ownership
- Census DB population is aggregate geography, not address-level persons
- land-access proxy is not legal access
- current ag labour is industry proxy until occupation rows improve
- food insecurity trend drivers are attribution diagnostics, not causal proof
- no web UI yet

## Legacy/demo commands

These commands are still useful for tests and formula demos, but the current Grey modelling workflow centers on report commands and real-data inputs.

```bash
npm run demo
npm run seed:grey
npm run demo:grey
npm run demo:grey:inspect
npm run demo:grey:full
npm run demo:grey:rail:full
```

## Licence

Living Region is licensed under GNU Affero General Public License v3.0 or later (`AGPL-3.0-or-later`). See [LICENSE](/home/htaf/living-region/LICENSE) and [NOTICE](/home/htaf/living-region/NOTICE).
