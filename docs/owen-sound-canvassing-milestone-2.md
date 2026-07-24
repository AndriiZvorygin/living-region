# Owen Sound canvassing milestone 2

Generated from the local Owen Sound extract on 2026-07-21. This milestone remains private and field-test focused.

## Field usability

- Route sessions record start/end time, active and paused minutes, flyers, attempts, knocks, answers, conversations, revisits, skips, and completed stops per hour.
- Undo appends a correction; it never deletes a visit or stop event. Submission keys reject duplicate mobile taps.
- The browser restores the route, stop, map view, filter, session, and volunteer mode after reload.
- Optional geolocation stays in browser memory and shows accuracy, selected-stop distance, nearest unfinished stop, and recentering.
- Route ordering groups street sides, follows civic-number direction, preserves manual changes, excludes completed/inaccessible stops on requested recalculation, and reports both straight-line and road-network estimates where snapping succeeds.

## Address quality

The default 12 m high-confidence, 30 m probable, and 50 m road-distance thresholds are configurable with `CANVASS_HIGH_CONFIDENCE_M`, `CANVASS_PROBABLE_M`, and `CANVASS_FAR_FROM_ROAD_M` when preparing data.

| Check | Count |
| --- | ---: |
| Civic address points | 3,426 |
| Points participating in duplicate normalized addresses | 335 |
| Address points outside the municipal boundary | 12 |
| Address points more than 50 m from a mapped road | 13 |
| Address points without a normalized OSM street match | 118 |
| Apparent multi-unit address points | 331 |
| Addresses with competing building candidates | 19 |
| Nearest footprint beyond 12 m | 3,020 |
| Nearest footprint beyond 30 m | 2,564 |

## Building coverage and joins

The repository contains 1,111 Owen Sound OSM footprints. No separate licence-compatible local Microsoft, Statistics Canada, or municipal building layer was found, so no private reference layer was added.

| Match confidence | Addresses | Automatic association |
| --- | ---: | --- |
| Exact containment | 209 | Yes |
| High confidence | 240 | Yes |
| Probable | 395 | No, review only |
| Ambiguous | 19 | No, review only |
| Unmatched | 2,563 | No, remains a point stop |

Automatic building associations total 449. The 414 probable or ambiguous records remain visible in the manual association review. Corrections are append-only and reversible, while imported address geometry and source identifiers remain unchanged.

## OSM preparation

`npm run canvassing:prepare-osm-import` writes public-only QA geography and a validation summary under `artifacts/owen-sound-building-import/`. The current artifact records existing OSM overlap for 1,111 footprints and contains zero proposed import candidates. Campaign data are excluded and API uploading is disabled.

## Operations

Schema migration version 3 adds route sessions, corrections, address-association history, submission keys, route-order history, and a hash-chained journal. The server checks hourly for a backup no older than 26 hours. Every backup is opened and integrity-checked; maintenance preflight exports routes before creating a tested backup.
