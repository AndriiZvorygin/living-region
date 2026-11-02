# Owen Sound local representation layer

This directory preserves a preliminary, aggregate-only local representation
layout for the City of Owen Sound. It is intended to remain available after
the election while the private elector extract used to prepare it is retired.

The layer contains no elector names, identifiers, row-level assignments, or
full addresses. The private source extract and any temporary row-level join
files are intentionally excluded from this repository.

## Contents

- `2026-resident-ward-boundaries.geojson`: seven candidate ward polygons.
- `2026-resident-ward-boundaries.csv`: aggregate ward counts and method fields.
- `2026-unit-local-areas.geojson`: 70 candidate local-area polygons.
- `2026-unit-local-area-summary.csv`: aggregate residential-unit and matched-elector counts by local area.
- `2026-unit-local-areas-map.html`: offline-viewable map.
- `2026-unit-local-areas-map.svg`: scalable static map.
- `2026-unit-local-areas-map.png`: shareable raster map.
- `render-local-areas-map.cjs`: map renderer using only the committed aggregate layers.

## Ward layer

The seven candidate ward polygons were generated as population-weighted power
cells clipped to the City of Owen Sound boundary. The population measure was
resident-coded electors from a private election extract; non-resident-coded
records were excluded.

| Ward | Resident-coded electors | Difference from seven-way target |
| --- | ---: | ---: |
| NW | 2,688 | +48.14 |
| NE | 2,619 | -20.86 |
| W | 2,687 | +47.14 |
| C | 2,620 | -19.86 |
| E | 2,619 | -20.86 |
| SW | 2,628 | -11.86 |
| SE | 2,618 | -21.86 |
| **Total** | **18,479** |  |

The ward boundaries are a planning proposal, not statutory election
boundaries. They should be reviewed against authoritative municipal, street,
and poll data before adoption.

## Local-area layer

The local areas use 10,893 residential or partly residential address units as
a household proxy. There are 70 areas in total, with an approximate target of
150 units per area. The parent wards receive 10 areas in NW, NE, W, and E; 12
in C; and 9 in SW and SE so that the areas remain close to the target despite
unequal residential-unit totals across wards.

| Ward | Residential units | Local areas | Units per area | Unit range |
| --- | ---: | ---: | ---: | ---: |
| NW | 1,502 | 10 | 150.2 | 137–164 |
| NE | 1,449 | 10 | 144.9 | 137–156 |
| W | 1,622 | 10 | 162.2 | 138–187 |
| C | 1,997 | 12 | 166.4 | 165–168 |
| E | 1,570 | 10 | 157.0 | 157–157 |
| SW | 1,347 | 9 | 149.7 | 149–150 |
| SE | 1,406 | 9 | 156.2 | 156–157 |
| **Total** | **10,893** | **70** | **155.6** | **137–187** |

The local-area polygons are preliminary data-driven strip cuts inside the
parent ward polygons. They should be adjusted to street and natural
boundaries during final review.

## Provenance and retention

- The municipal boundary is the committed Owen Sound layer at
  `data/boundaries/owen-sound.geojson`.
- The address-unit foundation is the committed public layer under
  `data/derived/owen-sound-address-foundation/`.
- Ward and local-area outputs were derived from those public geospatial layers
  plus a private resident-coded elector extract. Only the aggregate results
  are retained here.
- After the election, the private elector extract and any row-level working
  files can be destroyed while these aggregate boundaries, counts, maps, and
  methods are retained.

To regenerate the maps from the committed aggregate layers:

```bash
node data/derived/owen-sound-local-representation/render-local-areas-map.cjs
```
