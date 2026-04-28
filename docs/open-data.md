# Open Data Workflow

Living Region is GeoJSON-first for MVP imports.

## Preferred Formats

- GeoJSON (current supported path)
- CSV calibration tables
- Shapefile/GeoPackage: later milestone

## Minimum Useful GIS Layers

- Municipal boundaries
- Road centrelines with class/type
- Settlement/urban/village/hamlet boundaries
- Official Plan land-use designations

## Optional Useful Layers

- Parcels
- Public facilities
- Bridges/culverts
- Road condition
- Rail and former rail corridors
- Trails
- Asset-management summaries

## Recommended Input Layout

```text
know/input/
  gis/
    patches.geojson
    buildings.geojson
    networks.geojson
    stations.geojson
    freight-anchors.geojson
  calibration/
    road-maintenance.csv
    rail-maintenance.csv
    vehicle-costs.csv
    fuel-prices.csv
    building-energy.csv
    population.csv
    commodity-freight.csv
    land-use-transition.csv
```

## Licensing Note

Imported datasets remain under the licence/terms set by their original provider.

## Practical Guidance

- Reproject and normalize in GIS before export
- Precompute `areaHa` and `lengthKm` in GIS workflows
- Use stable IDs for joins and repeatable imports
- Replace synthetic seed geometry with real municipal/county data before policy/public claims
