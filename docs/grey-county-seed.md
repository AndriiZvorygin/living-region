# Grey County Census-Scale Seed World

This seed world is a coordinate-anchored synthetic scaffold for Living Region.
It is designed to be GIS-replaceable while still being grounded in 2021 Census municipality totals.

It is not an official boundary or parcel dataset.

## Census Seed Records (2021)

| Municipality | Type | Node Name | Lat | Lon | Population 2021 | Land Area km2 | Density / km2 |
|---|---|---|---:|---:|---:|---:|---:|
| Owen Sound | city | Owen Sound | 44.56981 | -80.93067 | 21,612 | 24.21 | 892.6 |
| West Grey | municipality | Durham | 44.17794 | -80.81745 | 13,131 | 875.21 | 15.0 |
| Meaford | municipality | Meaford | 44.6 | -80.583333 | 11,485 | 587.57 | 18.7 |
| Georgian Bluffs | township | Shallow Lake | 44.61614 | -81.08789 | 11,100 | 599.96 | 18.5 |
| Grey Highlands | municipality | Markdale | 44.3183333 | -80.6491666 | 10,424 | 879.03 | 11.9 |
| The Blue Mountains | town | Thornbury | 44.5597222 | -80.455 | 9,390 | 284.65 | 33.0 |
| Southgate | township | Dundalk | 44.17039 | -80.39351 | 8,716 | 643.08 | 13.6 |
| Hanover | town | Hanover | 44.1544445 | -81.0233334 | 7,967 | 9.78 | 814.6 |
| Chatsworth | township | Chatsworth | 44.4538889 | -80.895 | 7,080 | 594.44 | 11.9 |

Expected county totals:

- population: `100,905`
- land area: `4,497.93 km²`
- density reference: `22.4/km²`

## What The Generator Produces

Per municipality node:

- synthetic patch geometry and explicit `areaHa`
- households and dwellings derived from scaled census population
- vacancy estimates by municipality type and role
- local buildings and services
- freight anchors and optional rail/water nodes

Patch types:

- settlementCore
- olderResidential
- edgeResidential
- marketGardenBelt
- croplandCatchment
- pastureCatchment
- orchardNutBelt
- woodlotCatchment
- wetlandMarginal

## Scale Presets

- `tiny`: population `0.005`, area `0.005`
- `small`: population `0.02`, area `0.02`
- `medium`: population `0.10`, area `0.10`
- `county-lite`: population `0.50`, area `0.50`
- `full-county`: population `1.00`, area `1.00`

You can override with:

- `populationScaleMultiplier`
- `areaScaleMultiplier`
- `keepFullLandArea`

## Commands

```bash
npm run seed:grey
npm run seed:grey:rail
npm run seed:grey:medium
npm run seed:grey:county-lite
npm run seed:grey:full
npm run seed:grey:full:rail

npm run demo:grey
npm run demo:grey:rail
npm run demo:grey:full
npm run demo:grey:rail:full
```

Key outputs include:

- `know/produce/grey-county-seed-world*.json`
- `know/produce/grey-county-seed-patches*.geojson`
- `know/produce/grey-county-seed-networks*.geojson`
- `know/produce/grey-county-seed-stations*.geojson` (rail)
- `know/produce/grey-county-seed-municipal-summary.csv`

## Synthetic Corridor Assumptions

Road links are generated from known node pairs and straight-line distance with a wiggle factor.
Rail and water links are optional scenario corridors for resilience and transport economics testing.

These are scenario assumptions, not claims of active service geometry.

## Limitations

- No municipal boundary polygons in the seed itself
- No parcel-level geometry
- No official road centerline topology
- No official rail ROW geometry
- No calibrated municipal budget model by asset class

## Replacement Plan

1. Replace service-node synthetic polygons with municipal boundary and land-use layers.
2. Replace synthetic roads with official centerline data.
3. Replace synthetic rail corridors with actual ROW/track and station data.
4. Replace catchment assumptions with parcel/soil/ag capability layers.
5. Calibrate population, dwelling stock, freight flows, and infrastructure costs with local data.
