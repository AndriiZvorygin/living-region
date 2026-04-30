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
