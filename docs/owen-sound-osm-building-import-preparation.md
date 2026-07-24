# Owen Sound building-import preparation

## Status

API uploading is disabled. The current local audit found 1,111 existing OpenStreetMap buildings and no separate licence-compatible Microsoft, Statistics Canada, or municipal footprint source suitable for a candidate import batch.

`npm run canvassing:prepare-osm-import` creates a public-only QA export in `artifacts/owen-sound-building-import/`. It contains geometry and source provenance only. Campaign households, statuses, visits, routes, people, support assessments, volunteer records, sign requests, and notes are prohibited.

## Required QA before any future import

1. Record the source URL, licence text, retrieval date, and immutable file hash.
2. Validate polygon closure, self-intersections, minimum area, duplicate geometries, and municipal-boundary coverage.
3. Conflate every source footprint against current OSM buildings. Existing OSM geometry is never replaced automatically.
4. Review address-bearing and multi-part buildings manually, including sheds, garages, attached buildings, and demolition or construction changes.
5. Split candidates into small, geographically coherent batches with stable source IDs and a human reviewer.
6. Publish an import proposal and obtain community review before enabling any upload mechanism.

The generated export labels current OSM features as `existing_osm_building_self` and assigns no candidate import batch. This is intentional: private canvassing data and OSM editing remain separate systems.
