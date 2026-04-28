# Living Region

Living Region is an open-source map-based simulator for exploring how land use, housing, roads, food, energy, population, and local services affect each other over time, so communities can test regional planning scenarios more transparently.

It models a region as interdependent systems: settlements, households, land patches, roads, rail corridors, buildings, services, freight, food production, energy demand, infrastructure maintenance, and population movement. The purpose is not to predict the future with false precision, but to make assumptions visible and testable.
Food, wood, heat, electricity, diesel, and other energy flows are modelled in SI units, with food energy reported mainly in GJ.

## Quickstart

```bash
npm install
npm test
npm run demo
npm run seed:grey
npm run demo:grey
npm run export:geojson
```

## Example outputs

Living Region already includes a Grey County seed model grounded in 2021 Census population and land-area totals for the nine lower-tier municipalities. This gives the simulator a real municipality-scale foundation before full GIS layers are imported.

Current Grey County census-scale seed inputs:

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

From those real population and land-area inputs, Living Region generates a municipality-scale model with households, dwelling units, land patches, food demand, freight demand, road burden, and optional rail-corridor scenarios.

Example full Grey County seed output:

- Population: 100,905
- Synthetic patch area: 449,793 ha
- Households: 41,973
- Dwelling units: 46,712
- Vacancy rate: 10.15%

Example full Grey County scenario output:

- Final-year population: 110,227
- `foodCoverage`: 0.724
- `foodSurplusGJ`: -123,585.32
- Average monthly rent: $1,253.92
- Infrastructure condition: 0.468

Example full Grey County rail scenario output:

- Final-year population: 104,930
- `foodCoverage`: 0.658
- `foodSurplusGJ`: -395,124.41
- `railPassengerKm`: 4,723,641
- `railFreightTonneKm`: 308,416

### Rural transition and resilience signals

Living Region is designed to expose the pressures that can drive or constrain urban-to-rural transition. The current Grey County census-scale model already reports indicators such as:

- `foodCoverage`: how much local food demand can be met by modelled local production.
- `foodSurplusGJ`: whether the region has a food surplus or deficit under the scenario, expressed in GJ.
- `averageHouseholdStress`: combined pressure from food, housing, fuel, transport, and service access.
- `transportDieselDeficitLitre`: unmet diesel demand for passenger and freight movement.
- `roadMaintenanceBacklogMoney`: accumulated road maintenance pressure.
- `railPassengerKm` and `railFreightTonneKm`: how much movement shifts to rail in corridor scenarios.
- `railUtilizationRatio`: whether a rail corridor has enough demand to become useful.
- `infrastructureCondition`: whether roads, services, and other infrastructure are being maintained or degrading.

These metrics help test questions such as: How much local food capacity would be needed to support existing settlement patterns? How much does transport fuel scarcity constrain rural access? Does rail or freight consolidation reduce road and diesel pressure? How much infrastructure maintenance burden is created by spread-out settlement? Which scenarios reduce household stress, and which merely shift stress from one system to another?

Example full Grey County rural-transition comparison:

- No-rail full Grey scenario:
  - `foodCoverage`: 0.724
  - `foodSurplusGJ`: -123,585.32
  - Infrastructure condition: 0.468

- Rail freight-corridor full Grey scenario:
  - `foodCoverage`: 0.658
  - `foodSurplusGJ`: -395,124.41
  - `railPassengerKm`: 4,723,641
  - `railFreightTonneKm`: 308,416

Example `npm run demo:grey:inspect` Food Balance output:

- `annualFoodEnergyGJPerPerson`: 3.7656
- `totalFoodDemandGJ`: 8,152.52
- `grossFoodProductionGJ`: 7,284.86
- `netFoodAvailableGJ`: 5,829.71
- `foodSurplusGJ`: -2,322.81
- `foodCoverage`: 0.715

These are not forecasts. They are scenario diagnostics. Their purpose is to show which assumptions create food deficits, transport bottlenecks, road maintenance burdens, rural access problems, or settlement patterns that may require adaptation.

The current Grey County model is census-scaled, but still uses generated geometry. The population and land-area totals are grounded in public census data; the patch shapes, road links, rail corridors, buildings, and freight anchors are scenario scaffolding until replaced with real GIS layers.

Generated outputs include:

- `know/produce/grey-county-seed-municipal-summary.csv`
- `know/produce/grey-county-seed-world-full.json`
- `know/produce/grey-county-seed-full-metrics.json`
- `know/produce/grey-county-seed-rail-full-metrics.json`
- `know/produce/grey-county-seed-patches.geojson`
- `know/produce/grey-county-seed-networks.geojson`
- `know/produce/grey-county-seed-stations.geojson`

These can be regenerated with:

```bash
npm run seed:grey:full
npm run demo:grey:full
npm run demo:grey:rail:full
```

The point of the current seed model is to use the best available structured data already in the repository: real municipality population and land-area scale from the 2021 Census, plus transparent generated assumptions for the spatial layers that still need to be replaced.

The current food balance is a scenario diagnostic based on generated land-use/yield/loss assumptions. It is not a measured agricultural capacity assessment.
Food energy uses SI units internally (joules), so it can be compared directly with wood heat, electricity, diesel, and other regional energy flows.
Food energy is modelled in joules internally and normally reported as GJ. Older calorie-named fields may appear only as deprecated compatibility aliases during the transition.

What the numbers mean:

- `foodCoverage` is local production divided by local food demand.
- `averageRent` is average monthly rent-equivalent housing cost.
- `infrastructureCondition` is a 0 to 1 index, where 1 means fully maintained and 0 means failed.
- GeoJSON files can be opened in QGIS, ArcGIS, or web mapping tools.

## Real-data priority

The next milestone is to replace the generated geometry with the best public/open GIS layers available for Grey County.

Minimum useful layers:

1. Municipal boundary polygons
2. Road centrelines with road class/type
3. Settlement, village, hamlet, or urban boundary polygons
4. Official Plan land-use designation polygons

The census-scale model is already useful for checking municipal scale, population/land-area ratios, dwelling assumptions, food demand, and scenario diagnostics. Real GIS layers will make the map geometry, road network, settlement boundaries, land-use classes, and corridor analysis much more accurate.

## What Living Region Models

- Land patches, plant groups, and ecological productivity
- Households, labour allocation, stress, migration, and population change
- Buildings, rents, housing demand, and real-estate value dynamics
- Transportation demand, mode substitution, fuel constraints, and settlement form
- Urban-to-rural transition pressure, including food coverage, local service access, transport fuel constraints, rural land capacity, road maintenance burden, and settlement rebalancing
- Road/rail maintenance burdens, backlog effects, and service reliability
- Food, freight, and energy balances under changing resource assumptions

### Rural transition metrics

Living Region tracks rural-transition pressure through settlement form, land access, food-producing households, food labour demand, food affordability stress, transport fuel constraints, and local food coverage. The model distinguishes people who have no productive land access from those with garden, farm, common, or cooperative land access.

Food affordability pressure can drive household/cooperative food production before production becomes cheaper under market-wage labour accounting.
Living Region models rural transition as a combined pressure system (food affordability, fuel/input costs, machinery pressure, housing stress, employment pressure, and land/co-op access), not a single fuel-price threshold.

Urban/town/village/rural categories are scenario diagnostics, not official Census classifications yet. These are scenario diagnostics, not predictions. Food insecurity risk is modelled as affordability pressure, not as a direct survey estimate.

## Current Status

- MVP CLI simulator with deterministic formulas and test coverage
- GeoJSON export for map viewing workflows
- GeoJSON + CSV import scaffolding for real regional inputs
- Calibration profiles and sensitivity commands for transparent scenario testing
- Older calorie-named fields are now isolated as deprecated compatibility aliases. Active model fields and new outputs use joules/GJ.
- `npm run check:food-energy-terms` verifies that active code/docs do not reintroduce unapproved calorie/kcal terminology.

## Grey County Synthetic Seed Model

- Includes a coordinate-seeded Grey County starter world for rapid experimentation
- Geometry is synthetic by design (generated catchments and networks)
- Census population/land-area scaling is used where implemented
- Real GIS boundary and network data should replace synthetic geometry before policy/public claims

## GIS/Open Data Workflow

- Start with `know/input-example/` and copy to `know/input/`
- Import GeoJSON/CSV bundle with `npm run import:region`
- Run scenarios on imported worlds with `npm run demo:imported`
- GeoJSON is first-class in MVP; GeoPackage is a documented next step
- Imported data remains under the source provider’s licence/terms

See [open-data.md](/home/htaf/living-region/docs/open-data.md) and [import-schema.md](/home/htaf/living-region/docs/import-schema.md).

## Licence

Living Region is licensed under the GNU Affero General Public License v3.0 or later (`AGPL-3.0-or-later`). See [LICENSE](/home/htaf/living-region/LICENSE) and [NOTICE](/home/htaf/living-region/NOTICE).

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](/home/htaf/living-region/CONTRIBUTING.md).

## Limitations

- Synthetic demo and seed data are scaffolds, not official planning datasets
- Formulas are intentionally coarse and transparent rather than tightly calibrated econometrics
- No web UI in MVP
- No full routing engine or detailed seasonal transport model yet
- Outputs are scenario scaffolds for assumption testing, not official forecasts
