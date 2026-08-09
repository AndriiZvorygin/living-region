# Owen Sound canvassing data inventory

| Path | Format / CRS | Coverage and count | Household usefulness | Currency / limitation |
| --- | --- | --- | --- | --- |
| `data/osm/owen-sound.osm.pbf` | OSM PBF, WGS84 | Owen Sound extract; 28,882 nodes, 5,629 ways, 74 relations; 1,116 tagged buildings, 3,347 tagged address objects, 2,190 tagged highway ways in the source audit | Identifies many individual structures and civic addresses; supports multi-unit tags where mapped | Latest object timestamp 2026-05-18; community completeness varies |
| `Map - City Map.pdf`; `data/canvassing/owen-sound-city-map-buildings.geojson` | Geospatial PDF, NAD83 / UTM 17N; derived GeoJSON, CRS84 | 6,915 roofs/row units extracted inside the boundary; 5,962 retained after OSM-first deduplication | Official-map roof shapes provide individual private-map structures across most of the city, including northeast gaps; 18 probable row parents were conservatively divided into 117 frontage units | Map created 2022-04-07; PDF licence is not stated; 0.44 m cartographic extraction with raster-bridge cleanup, private reference only; row-unit boundaries are approximate |
| `data/canvassing/canada-structures-owen-sound.geojson` | GeoJSON, OGC CRS84 | 6,629 spatial-filter candidates around Owen Sound; 128 retained after OSM and city-map deduplication | Fills remaining individual roof gaps; integrated source provenance identifies OSM and Microsoft components | Canada Structures Ontario resource updated 2025-09-17; Open Government Licence - Canada; machine-derived geometry requires local review |
| `know/input/gis/road-centrelines-grey.geojson` | GeoJSON, OGC CRS84 | Grey County; 6,327 lines; 883 intersect the prepared Owen Sound extent | Street names, classes and address ranges; not individual properties | Official local layer; feature-level update date is not supplied |
| `data/boundaries/owen-sound.geojson` | GeoJSON, WGS84 assumed | One Owen Sound municipal polygon | Defines private-map extent and clipping boundary | Official source attributes include edit metadata |
| `know/produce/grey-census-population-blocks.geojson` | GeoJSON, WGS84 assumed | 1,923 Grey County blocks; 248 Owen Sound blocks | Aggregate coverage only; cannot identify households | 2021 Census-derived |
| `know/input/gis/county-trails.geojson`, `hiking-trails.geojson`, `official-road-cycling-routes.geojson` | GeoJSON, CRS84 | Grey County paths and routes | Walking context only | Source dates vary; inspect source manifest |
| `know/input/local-calibration/address-points.csv`, `building-footprints.csv`, `parcel-address-linkage.csv` | CSV schemas | Headers only | Import templates, no current city features | Empty |
| `know/input/local-calibration/parcels.csv` | CSV | 10,137 Grey lot/concession proxies | Not an Owen Sound urban parcel fabric | Rural legal-lot proxy; excluded from canvassing map |
| `artifacts/corner-lot-*` | CSV, GeoJSON, PYA JSON | 437 campaign intersection-priority records | Can support later route reconciliation, not household identity | Generated May 2026; no recorded visits |

No local MBTiles, PMTiles, aerial imagery, cached basemap tiles, authoritative
Owen Sound parcel fabric, or downloadable original municipal building feature
class was found. The supplied official GeoPDF does contain a usable municipal
building cartography layer. The prepared browser bundle uses indexed MapLibre
GeoJSON sources and clustering because the clipped city layers remain
practical. PMTiles should replace them if future sources materially increase
feature volume.

## Prepared layer methodology

`npm run canvassing:extract-city-roofs` isolates and polygonizes the city-map
building layer and conservatively divides probable long townhouse rows into
frontage-sized, provenance-marked units. `npm run canvassing:acquire-buildings` performs a GDAL range
read against the official Ontario Canada Structures GeoPackage and writes only
the Owen Sound bounding-box subset. `npm run canvassing:prepare` exports OSM
locally, clips all roofs by the official boundary, preserves OSM geometry,
deduplicates the city-map and Canada Structures supplements in priority order,
associates civic points, infers reviewable household numbers for plausible
roofs from Grey County left/right road ranges, and generates collision-checked
local roofs where no plausible source roof exists. Stable application IDs are
SHA-256-derived from source namespace and external ID; inferred household IDs
are tied to source roof IDs so later number corrections preserve campaign
history. All browser layers are geographic CRS84 longitude/latitude.

The private SQLite database is initialized from the prepared bundle. Visit events are inserted append-only and mirrored to `private/canvassing/visits.pya.jsonl`. This journal is Pyash-compatible newline-delimited event data; no standalone Pyash runtime or package was present in the repository audit.
