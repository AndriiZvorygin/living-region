# Owen Sound canvassing data inventory

| Path | Format / CRS | Coverage and count | Household usefulness | Currency / limitation |
| --- | --- | --- | --- | --- |
| `data/osm/owen-sound.osm.pbf` | OSM PBF, WGS84 | Owen Sound extract; 28,882 nodes, 5,629 ways, 74 relations; 1,116 tagged buildings, 3,347 tagged address objects, 2,190 tagged highway ways in the source audit | Identifies many individual structures and civic addresses; supports multi-unit tags where mapped | Latest object timestamp 2026-05-18; community completeness varies |
| `know/input/gis/road-centrelines-grey.geojson` | GeoJSON, OGC CRS84 | Grey County; 6,327 lines; 883 intersect the prepared Owen Sound extent | Street names, classes and address ranges; not individual properties | Official local layer; feature-level update date is not supplied |
| `data/boundaries/owen-sound.geojson` | GeoJSON, WGS84 assumed | One Owen Sound municipal polygon | Defines private-map extent and clipping boundary | Official source attributes include edit metadata |
| `know/produce/grey-census-population-blocks.geojson` | GeoJSON, WGS84 assumed | 1,923 Grey County blocks; 248 Owen Sound blocks | Aggregate coverage only; cannot identify households | 2021 Census-derived |
| `know/input/gis/county-trails.geojson`, `hiking-trails.geojson`, `official-road-cycling-routes.geojson` | GeoJSON, CRS84 | Grey County paths and routes | Walking context only | Source dates vary; inspect source manifest |
| `know/input/local-calibration/address-points.csv`, `building-footprints.csv`, `parcel-address-linkage.csv` | CSV schemas | Headers only | Import templates, no current city features | Empty |
| `know/input/local-calibration/parcels.csv` | CSV | 10,137 Grey lot/concession proxies | Not an Owen Sound urban parcel fabric | Rural legal-lot proxy; excluded from canvassing map |
| `artifacts/corner-lot-*` | CSV, GeoJSON, PYA JSON | 437 campaign intersection-priority records | Can support later route reconciliation, not household identity | Generated May 2026; no recorded visits |

No local GeoPackage, MBTiles, PMTiles, aerial imagery, cached basemap tiles, authoritative Owen Sound parcel fabric, or authoritative municipal address/building layer was found. The prepared browser bundle uses indexed MapLibre GeoJSON sources and clustering because the current city extract is small. PMTiles should replace it if an authoritative layer materially increases feature volume.

## Prepared layer methodology

`npm run canvassing:prepare` exports OSM locally, clips by the official boundary, classifies structures, spatially joins address points to containing building polygons, and retains ambiguous or unmatched points for review. Stable application IDs are SHA-256-derived from source namespace and external ID; source IDs remain external references. All browser layers are geographic CRS84 longitude/latitude.

The private SQLite database is initialized from the prepared bundle. Visit events are inserted append-only and mirrored to `private/canvassing/visits.pya.jsonl`. This journal is Pyash-compatible newline-delimited event data; no standalone Pyash runtime or package was present in the repository audit.
