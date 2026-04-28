# Grey County Open Data Workflow

Grey County Open Data pages are ArcGIS Hub pages. The human-facing pages are useful for browsing, but automated download usually works best through API endpoints.

Living Region supports two retrieval paths:

- ArcGIS Hub Downloads API when an `itemId` is known.
- ArcGIS REST FeatureServer/MapServer query endpoints when `serviceUrl` and `layerId` are known.

## Commands

```bash
npm run grey:open-data
npm run grey:discover-data
npm run grey:download-data
npm run grey:import-data
```

Dry-run options are supported for network commands:

```bash
npm run grey:discover-data -- --dry-run
npm run grey:download-data -- --dry-run
```

## File locations

- Downloaded GIS files are written to `know/input/gis/` and are ignored by git.
- Imported/generated outputs are written to `know/produce/` and are ignored by git.

## Notes

- Discovery attempts to extract ArcGIS item IDs and service URLs from Hub dataset pages.
- If Hub direct download fails, downloader falls back to REST feature-layer queries.
- Source-provider licence and terms remain in force for downloaded data.
