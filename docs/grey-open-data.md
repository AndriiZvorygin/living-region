# Grey County Open Data Workflow

Grey County Open Data pages are ArcGIS Hub pages. The human-facing pages are useful for browsing, but automated download usually works best through API endpoints.

Living Region supports two retrieval paths:

- ArcGIS Hub Downloads API when an `itemId` is known.
- ArcGIS REST FeatureServer/MapServer query endpoints when `serviceUrl` and `layerId` are known.

## Verified sources (current)

- `municipality-boundaries` (Grey open data)
- `settlement-boundaries` (Grey open data)
- `official-plan-schedule-a-land-use` (Grey open data)

## Pending sources

- road centrelines (target: Grey County Roads, fallback: ORN Composite)
- bridges/culverts/structures
- trails/rail corridors/ROW
- public facilities/service nodes
- lot fabric canonical LIO source
- asset-management/cost summaries for calibration

## Commands

```bash
npm run grey:open-data
npm run grey:discover-data
npm run grey:discover-all-data
npm run grey:download-data
npm run grey:download-roads
npm run grey:import-data
npm run grey:import-roads
npm run grey:data-status
npm run report:grey:secondary
```

Dry-run options are supported for network commands:

```bash
npm run grey:discover-data -- --dry-run
npm run grey:download-data -- --dry-run
```

Cached download behavior:

- Downloads are cached by default.
- If a target `know/input/gis/<source>.geojson` exists, has nonzero size, and parses as a `FeatureCollection`, downloader reuses it.
- Use `--force` to re-download:

```bash
npm run grey:download-data -- --source=lots-and-concessions-grey --force
```

## File locations

- Downloaded GIS files are written to `know/input/gis/` and are ignored by git.
- Imported/generated outputs are written to `know/produce/` and are ignored by git.

## Notes

- Discovery attempts to extract ArcGIS item IDs and service URLs from Hub dataset pages.
- If Hub direct download fails, downloader falls back to REST feature-layer queries.
- Cached files are reused by default; `--force` re-downloads.
- Large dataset safeguards block provincewide downloads unless filtered or explicitly allowed (`--allow-large-download`).
- Manual overrides are supported through `know/input/gis/source-overrides.json`.
- Source-provider licence and terms remain in force for downloaded data.
- Not all discovered candidates are automatically trusted; unverified and large-guarded sources are reported separately.

## Useful secondary source status

- Transit and active transport: `grey-transit-bus-stops`, `grey-transit-routes`, `official-road-cycling-routes`, `county-trails`, `cp-rail-trail`, `hiking-trails`, `tom-thomson-trail`
- Forest/risk: `managed-forest-boundary`, `hazardous-forest-types-wildfire`
- Rural economy: `on-farm-rural-business-listing`
- Population support: `population-estimates-2011-2041`
- Facilities/services: `public-facilities`, `community-facilities`, `libraries`, `arenas-community-centres`, `works-yards-depots`, `emergency-services`
- Infrastructure/assets: `bridges-culverts-structures`, `road-projects-construction-resurfacing`, `road-condition`, `asset-management-summary`
- Lot/parcels fallback: `lot-fabric-improved-lio` (guarded)
