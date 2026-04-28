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

Living Region currently produces scenario metrics and GeoJSON layers that can be inspected in GIS tools or used for further analysis.

Example synthetic demo output:

- Final-year population: 264
- Average monthly rent: $608.87
- Infrastructure condition: 0.445

Example Grey County seed output:

- Final-year population: 2,191
- Food coverage ratio: 0.728
- Average monthly rent: $1,248.26

Example GeoJSON outputs:

- `know/produce/demo-patches-final.geojson`
- `know/produce/demo-buildings-final.geojson`
- `know/produce/demo-networks-final.geojson`
- `know/produce/demo-stations-final.geojson`
- `know/produce/demo-freight-anchors-final.geojson`

These outputs are generated files and are intentionally ignored by git. They can be recreated with:

```bash
npm run demo
npm run demo:grey
npm run export:geojson
```

The Grey County seed model uses real 2021 Census population and land-area scaling, but its patch geometry, roads, rail, buildings, and freight systems are still synthetic scenario scaffolding. These outputs are useful for testing model structure, not for making official policy claims.

What the numbers mean:

- `foodCoverage` is local production divided by local food demand.
- `averageRent` is average monthly rent-equivalent housing cost.
- `infrastructureCondition` is a 0 to 1 index, where 1 means fully maintained and 0 means failed.
- GeoJSON files can be opened in QGIS, ArcGIS, or web mapping tools.

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
