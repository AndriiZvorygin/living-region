# Owen Sound canvassing building coverage

## Sources and licence

The preferred supplemental source is the official City of Owen Sound geospatial
PDF supplied as `Map - City Map.pdf`:

- Map creation date: 2022-04-07
- Creator: Esri ArcGIS Pro 2.9.2
- Embedded CRS: NAD83 / UTM zone 17N
- Building layer: `Map_Frame.Developments.COSGEO_DBO_BuildingFootprints`
- Source SHA-256:
  `0224c57ebd3e8f23c4546bc79e0ee2605c71a68953f98db493fb4791fe23f7a9`
- Licence: not stated in the supplied PDF
- Use: private canvassing reference only, pending licence confirmation

The PDF is a GeoPDF with an isolated municipal building layer, but it does not
expose the original ArcGIS feature records. The extraction renders only that
layer at 576 DPI (about 0.44 m per pixel), selects the solid roof fill so light
anti-aliased edges cannot join neighbouring houses, polygonizes in the embedded
projected CRS, removes one-pixel raster and diagonal bridges, simplifies sub-metre staircase
edges, removes page-frame artefacts, clips to the municipal boundary, and
transforms the result to CRS84. This is substantially better than a
generated house rectangle, but it remains a cartographic extraction rather than
the original municipal building feature class.

After bridge cleanup, a bounded row-building pass examines only long,
articulated polygons between 400 and 2,200 square metres. A candidate must be
at least 35 m long, no more than 24 m wide, have an aspect ratio of at least
2.7, and have no interior holes. Probable townhouse rows are divided across
their long axis into approximately 9.5 m frontage units. Every resulting unit
must remain between 30 and 350 square metres and the units must retain at least
97% of the source roof area; otherwise the source polygon is left unchanged.
These are approximate private-map unit boundaries, not municipal parcel lines.

The secondary supplemental source is **Canada Structures**, Public Safety
Canada:

- Dataset: `3829eee9-f898-4643-9ad8-f48575b8873d`
- Ontario resource: `ON_Structures_EN`
- Published source date: 2025-09-17
- Licence: Open Government Licence - Canada
- Citation: Sandison J., Hayes S., Darlington C., Chastko K., & Ballard M. (2025), DOI `10.82126/z1bc-zd72`
- Original CRS: Canada Structures Lambert Conformal Conic GRS80
- Prepared CRS: OGC CRS84 / EPSG:4326 longitude-latitude

The integrated product identifies component geometry from OpenStreetMap, the Open Database of Buildings, and Microsoft Building Footprints. The Owen Sound clip currently contains OSM and Microsoft components. Existing local OSM roofs remain authoritative within this application and retain ODbL attribution.

Estimated roofs are Living Region local canvassing geometry. Supplemental and estimated roofs must not be uploaded to OpenStreetMap. The separate OSM QA export continues to contain only existing OSM buildings.

## Reproduction

Install GDAL (`ogr2ogr`) and run:

```bash
npm run canvassing:extract-city-roofs
npm run canvassing:acquire-buildings
npm run canvassing:prepare
npm run canvassing:prepare-osm-import
```

The city-roof command verifies the named layer, uses the embedded geotransform,
and records extraction settings, rejected geometry, source and output hashes in
`data/canvassing/owen-sound-city-map-source.json`.

The acquisition command follows the current signed Open Canada resource URL, uses an HTTP range-based spatial read of the 1.5 GB Ontario GeoPackage, transforms the Owen Sound bounding-box subset to CRS84, and records retrieval metadata plus the clipped-file SHA-256 hash in `data/canvassing/canada-structures-source.json`. The browser receives only prepared Owen Sound GeoJSON and requires no network map source.

## Geometry rules

1. Clip candidate roofs by centroid within the Owen Sound municipal boundary.
2. Preserve every suitable OSM roof.
3. Add non-overlapping city-map roofs, then add Canada Structures only where it
   does not overlap either preferred source.
4. Associate civic points by point-in-polygon first.
5. Otherwise consider nearby roofs up to 30 m. A small roof already assigned to another civic address is not reused unless the civic address is the same; apartments and large buildings can hold several addresses.
6. Mark sourced associations within 12 m as high confidence and longer sourced associations as probable and reviewable.
7. Preserve Grey County road segment ranges (`L_F_ADD`, `L_T_ADD`, `R_F_ADD`, `R_T_ADD`) and parity. Unlinked plausible sourced residential roofs are ordered along each segment and receive an approximate civic number from the matching side's range.
8. Tie an inferred address ID to the sourced roof ID, not the approximate number. A later correction can therefore change the number without losing visits or route membership. Approximate map labels use a `~` prefix.
9. Permit a 35-60 square metre unclassified roof to receive an inferred number only when it occupies street frontage. Test alternate ranged streets at corners; a roof behind another plausible building on every nearby frontage remains an unnumbered accessory.
10. Conservatively divide probable townhouse rows into individually clickable frontage units before assigning approximate road-range numbers. Preserve the parent geometry identifier and unit order on every derived unit.
11. Group units sharing one civic number and street onto one roof when their address points are within 35 m. Distant duplicate records remain separate roofs with the same civic label.
12. For unmatched imported address groups, construct a stable rectangular estimate. Its block position comes from the official segment range where available, and dimensions come from nearby plausible roofs with a 130 m2 fallback.
13. Use an official road-range placement only when the range projection is within 120 m of the imported address point. Otherwise use the nearest named frontage so stale duplicate records are not pulled to another block.
14. Treat sourced roofs and vehicle-road geometry as immutable obstacles. Municipal road centrelines take precedence over a nearby duplicate OSM centreline, while paths and pedestrian-only ways do not block a residential roof. Try bounded along-street shifts and dimension reductions; if no placement maintains 3.5 m road clearance without a building overlap, retain a clickable review point instead of drawing a roof.

Manual address associations remain append-only in SQLite and override imported associations without modifying source geometry.

Manual civic-number corrections use the same stable structure and address IDs.
The API appends each change to `address_number_events` and materializes only
the latest verified values in
`private/canvassing/address-number-calibration.json`. The original imported or
inferred address remains unchanged in SQLite. `npm run canvassing:prepare`
loads the private calibration file, reapplies corrected civic numbers and
street names, creates a stable address for a corrected previously-unlinked
roof, and reserves verified numbers before automatic range allocation. The
calibration file contains geography identifiers and address corrections only;
it is private and is excluded from public and OpenStreetMap exports.

## Current coverage

The generated source of truth is `packages/web-client/public/canvassing/building-coverage-audit.json`. It reports OSM roofs, supplemental roofs, deduplicated polygons, sourced, inferred-range and estimated address matches, collision-safe placement failures, unresolved addresses, and suspicious longer-distance matches. Review geometry is written to `building-coverage-review.geojson`.

The August 6, 2026 regeneration contains 1,111 retained OSM roofs, 5,962
non-overlapping city-map roofs, and 128 remaining Canada Structures roofs. It
contains 3,426 imported civic points plus 4,040 stable inferred-range
households. It links 6,623 addresses to sourced roofs, draws 826 local estimated
roofs for 840 address/unit records, and leaves four records as reviewable point
stops. The generated-geometry audit reports zero road-clearance, sourced-roof,
or estimated-roof conflicts.

The 27th and 28th Avenue East pocket was checked separately after the
underflyered-area view exposed gaps. The supplied City PDF has only sparse
building polygons in this northeast pocket, rather than a dense detached-house
roof layer. The regenerated map therefore uses the PDF roofs where present and
adds road-oriented estimated roofs for the civic points that have no suitable
sourced polygon. The two distant `398379 28th Avenue East` records are now
separate clickable roofs instead of one multi-unit roof; the ordinary nearby
unit rule remains in effect elsewhere.

All 8,027 displayed polygons now carry a civic label and are selectable. Roofs
without their own direct civic-address match remain separate structures but
inherit a provisional reference to the nearest addressed structure, avoiding
duplicate household records. The current audit reports 214 shared-accessory
references, 675 provisional-nearest references, 612 high-confidence references,
137 probable references, and 140 distant-review references. The relation and
confidence counters are intentionally overlapping classifications, not a
single additive total.

Derived roof properties retain the referenced address IDs, source structure,
distance, relationship, and confidence. A candidate can use **Make separate
address** when an accessory or provisional classification is wrong. That
action creates an audited manual address on the selected roof and leaves the
original household and imported source geometry intact.

The source extraction identified 18 probable row-building parents and produced
117 frontage units. After OSM-first deduplication, 65 units remain in the
private map; 58 are associated with addresses, including 42 approximate
road-range addresses. Subdivision provenance is visible as
`official_map_subdivided`, and the original parent geometry identifier remains
available for later correction.

Roof fill follows household canvassing status. Estimated roofs use the same interaction and status fill with a quiet dashed outline. Civic numbers appear over linked roofs at field zoom. Multi-unit selection uses the existing household tabs.

## Operational safety

Building geometry remains derived static data. Schema version 5 adds a source
lifecycle flag so a regenerated bundle can retire obsolete imported geometry
from the live map without deleting its database row or any related campaign
history. Schema version 6 adds append-only civic-number calibration events.
Schema version 7 keeps flyer delivery, no-answer, conversation, revisit, and
political outcome as independent visit facts. The household drawer presents
the field facts as checkbox controls and appends one combined visit event, so a
single encounter can count toward flyer, conversation, supporter, and revisit
metrics without overwriting any of them.
Schema version 8 adds append-only building split events. Candidate users can
draw one or more cut lines through a false bridge or divide a probable
townhouse row into 2–20 frontage units. The server validates a 10 m2 minimum
child area and 99% parent-area retention, hides the imported parent only in the
effective private map, and creates stable child structure IDs. Existing exact
addresses follow their nearest child; remaining children receive visibly
approximate road-parity numbers ordered along the principal roof axis. Reversal
restores the parent and reassociates every child household without changing
household, route, visit, person, or follow-up IDs.

Active split corrections are exported privately to
`private/canvassing/structure-split-calibration.json`. They are excluded from
public and OpenStreetMap exports. Volunteer mode cannot create or reverse
geometry corrections.
Before this coverage update, maintenance preflight created a route
export and a restore-tested SQLite backup. Regeneration upserts current
structures and imported associations while preserving stable address IDs,
household IDs, visits, route stops, manual association events, and the audit
journal.
