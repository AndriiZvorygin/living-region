# Living Region

Living Region is an open-source map-based simulator for exploring how land use, housing, roads, food, energy, population, and local services affect each other over time, so communities can test regional planning scenarios more transparently.

It models a region as interdependent systems: settlements, households, land patches, roads, rail corridors, buildings, services, freight, food production, energy demand, infrastructure maintenance, and population movement. The purpose is not to predict the future with false precision, but to make assumptions visible and testable.

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
- Average monthly rent: $1,253.92
- Food coverage ratio: 0.697
- Infrastructure condition: 0.468

Example full Grey County rail scenario output:

- Final-year population: 104,930
- Food coverage ratio: 0.761
- Rail passenger-km: 4,063,097
- Rail freight tonne-km: 268,679
- Rail utilization ratio: 0.133
- Transport diesel deficit: 174,480 L
- Road maintenance backlog: $16,744,204

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
- Road/rail maintenance burdens, backlog effects, and service reliability
- Food, freight, and energy balances under changing resource assumptions

## Current Status

- MVP CLI simulator with deterministic formulas and test coverage
- GeoJSON export for map viewing workflows
- GeoJSON + CSV import scaffolding for real regional inputs
- Calibration profiles and sensitivity commands for transparent scenario testing

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
