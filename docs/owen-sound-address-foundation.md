# Owen Sound address foundation

The canvassing address foundation uses the June 2026 Statistics Canada
National Address Register (NAR) as its authoritative civic-address source.
The NAR is an address reference dataset, not a resident or property-owner
dataset. The derivation does not retain names, telephone numbers, owner data,
or roll numbers.

## Sources and licensing

The release and the ZIP download link are published from the Statistics Canada
product page:

- Catalogue: <https://www150.statcan.gc.ca/n1/en/catalogue/46260002>
- Release page: <https://www150.statcan.gc.ca/n1/pub/46-26-0002/462600022022001-eng.htm>
- June 2026 user guide: <https://www150.statcan.gc.ca/n1/pub/46-26-0002/462600022026001-eng.htm>
- Download: <https://www150.statcan.gc.ca/n1/pub/46-26-0002/2022001/202606.zip>

The NAR is used under the Statistics Canada Open Licence Agreement. The
filter is `PROV_CODE=35`, `CSD_CODE=3542059` on the location file, and
`CSD_ENG_NAME=Owen Sound` on the address file. A second point-in-polygon check
uses `data/boundaries/owen-sound.geojson`.

Grey County's public GIS was inspected first. Its public Building Footprints
service is explicitly licensed under the Grey County Open Data Licence and is
retained as a licensed physical-building reference:

- <https://maps.grey.ca/pages/open-data>
- Public GIS application item: `645d414b2614427e91efc9c197c79657`
- Public Open Data group: `0810446c724f4ebf81fbe7be185da5c8`
- Building Footprints item: `1c937b952166443f91914e1123f7b924`, layer `0`
- <https://services1.arcgis.com/wE2uWQWlTTnVDgyt/arcgis/rest/services/Building_Footprints/FeatureServer>

Required attribution for that source is:

> Contains information licensed under the Grey County Open Data Licence.

The public Grey Assessment Parcel v2 Addresses table was not used for the
derived address dataset: its item identifies MPAC/Teranet data, exposes
roll-number fields, and does not state the Grey County Open Data Licence. The
interactive locator was not scraped or treated as a bulk source. See the
generated `source-provenance.json` for the exact item references and decision.

The 2021 Open Database of Addresses was also not used for the primary output:
the newer NAR supplied a sufficiently complete Owen Sound subset, so the older
source was not allowed to override it. A rendered Grey address-search spot
check was not used as a derivation input because the Grey address-like layer
did not have clear bulk reuse licensing; the report instead records the NAR
boundary and normalization checks and preserves the Grey licence limitation.

## Reproducible extraction

The raw 1.59 GB NAR ZIP is deliberately kept outside Git. `unzip` streams only
the Ontario CSV members; the extractor does not expand the national files to
the repository or load the whole Ontario files into memory.

```sh
# Retrieve the official ZIP into the outside-repository cache (about 1.59 GB).
npm run canvassing:addresses -- --download

# Or use an already cached/downloaded ZIP.
npm run canvassing:addresses -- \
  --zip /tmp/living-region-address-cache/202606.zip
```

The command writes `data/derived/owen-sound-address-foundation/`:

- `address-units.geojson`: all in-bound NAR address units;
- `address-units-residential.geojson`: residential and partly residential
  units used by the primary canvassing bundle;
- `address-units-unknown.geojson` and `address-units-non-residential.geojson`:
  review/separate-use records;
- `canvassing-locations.geojson`: one point per `LOC_GUID`, with unit counts
  and address GUIDs;
- `legacy-unmatched-stops.geojson`: existing rows not matched to the new
  source, retained for review and not deleted from SQLite. The immutable
  `legacy-address-source.geojson` is the input snapshot used to make repeated
  extraction runs reproducible;
- `legacy-unmatched-address-ids.json`: the stable internal IDs that the server
  keeps historical-only during its transactional seed;
- `reconciliation.json`, `validation-report.json`, and
  `source-provenance.json`.

Use `--publish` only after reviewing the generated report. It replaces the
static primary address bundle with the residential/partly-residential NAR
units. The existing server importer performs an upsert by address ID, keeps
the generated unmatched-ID list in SQLite with `source_active=0`, and never
deletes households, visits, outcomes, conversations, corrections, or journal
entries. Existing IDs are reused for safe normalized matches; new rows receive
a SHA-256-derived ID from `ADDR_GUID`.

```sh
npm run canvassing:addresses -- \
  --zip private/canvassing/source-cache/national-address-register-202606.zip \
  --publish
```

The legacy comparison input defaults to
`data/derived/owen-sound-address-foundation/legacy-address-source.geojson`.
Override it with `CANVASS_LEGACY_ADDRESS_SOURCE` when using a separately
archived pre-migration snapshot; the generated unmatched output is deliberately
not used as its own next-run input.

Restarting the canvassing server runs its existing transactional prepared-data
seed. Make a backup before production restart as usual. The seed applies the
generated unmatched-ID list as a historical-only deny list, so an old row that
had previously been labelled manually cannot remain active merely because of
its old source name. Manually inferred roof-split addresses remain separate
operational exceptions until explicitly reconciled; they are not counted as
NAR units.

## Current generated validation snapshot

The checked-in report is generated with retrieval date 2026-08-27. It records
the exact counts, duplicate/conflict groups, coordinate and boundary checks,
and the existing-stop reconciliation. In particular, one physical location
can have many address units, so those two counts must not be treated as
interchangeable household or building counts.

The current snapshot contains 11,228 retained in-bound coordinate-backed
address units: 8,861 residential, 2,032 partly residential, 324
non-residential, and 11 unknown-use. The source produced 11,270 Owen Sound
named rows; 28 rows were rejected by the municipal-boundary check and 14 were
rejected for missing usable coordinates. The retained units represent 7,156
coordinate-backed physical locations; 671 locations have more than one
primary residential or partly residential unit. The primary canvassing bundle
contains 10,893 residential/partly-residential units. These figures exclude
both rejection groups; see the generated validation report for raw, rejected,
retained, and primary counts separately.

The current placement run found 6,841 primary NAR physical locations. The
current generated audit assigns 4,378 locations to 4,374 unique structures;
4,310 are direct/nearby footprint matches and 68 are constrained street-side
sequence matches. The remaining 2,463 primary locations remain unresolved as
NAR-to-footprint associations and are not silently assigned to unrelated
roofs. This is deliberately a placement count, not a claim that every
assigned roof is fully validated. The current structure-level classifications
are 301 `nar_contained_footprint`, 282 `nar_validated_nearest`, 3,790
`nar_nearest_no_known_conflict`, one `legacy_spatially_consistent`, 3,109
`legacy_unverified`, and 913 `grid_estimated`. There are currently zero
`legacy_nar_confirmed` or documented-exception classifications. A nearest
match is fully validated only when the official street/direction, frontage
side, parity, block, sequence, unique plausible residential footprint, and
conservative BG-coordinate distance checks all pass. Unknown/unclassified
footprint metadata therefore remains `nar_nearest_no_known_conflict`, not
validated. All 6,462 original legacy source IDs remain preserved in the
reconciliation/history tables.

Unknown-use records are not silently promoted to residential. Non-residential
records are kept in their own file. Earlier OSM/range-derived records that do
not match are preserved in the database and review export rather than being
rewritten or deleted.

The NAR's point is a representative building/location coordinate and may be
shared by all units at an apartment or mixed-use location. The generated
`canvassing-locations.geojson` has one feature per `LOC_GUID` and the primary
NAR units represent 6,841 physical locations (7,156 across all retained use
categories). The generated primary unit bundle is published at
`packages/web-client/public/canvassing/addresses.geojson`; the map publishes
one physical roof feature per building and attaches unit targets to it.

The final placement audit is recorded in
`data/derived/owen-sound-address-foundation/validation-report.json`, with one
machine-readable row per primary NAR `LOC_GUID` in `nar-placement-audit.json`.
The 11,228 retained all-use units and 10,893 primary units both exclude the
28 outside-boundary rows and 14 no-coordinate rows. The latest publication
contains 8,396 active canvassable physical roofs out of 8,481 structure
features, with zero missing selection targets. Address classification is
explicit: 309 active roofs have NAR contained-footprint placement, 282 have
fully validated NAR nearest placement, 3,789 have NAR nearest placement with
no known conflict but incomplete validation evidence, 3,102 use an unverified
legacy fallback, 913 use a grid-estimated fallback, and one is a legacy
spatially consistent sequence match. The latter fallbacks are human-readable
operational labels, never authoritative NAR addresses. The
API retains unit-level household rows and uses physical-roof activity for
historical status, so apartment buildings remain one roof stop without losing
unit coverage.

## Authoritative number and footprint activation

The active NAR address bundle now uses `CIVIC_NO` plus `CIVIC_NO_SUFFIX`, the
official street name/type/direction, and `APT_NO_LABEL` directly. The shared
formatter in `packages/canvassing/src/official-address.ts` produces labels such
as `808 2nd Avenue East`, `254 8th Street East`, `155A 10th Street West`, and
`305 14th Street West Unit 101`. Estimated or interpolated numbers are not
used for an active NAR unit. Legacy same-roof addresses and grid estimates are
explicitly marked fallback metadata for roofs without a direct NAR unit; they
remain human-readable and selectable.

`npm run canvassing:grey-footprints` retrieves the Owen Sound envelope from the
public Grey County Building Footprints ArcGIS layer using IPv4, paginates the
service response, and writes a reproducible snapshot plus source metadata. The
address generator combines those polygons with the existing sourced footprint
bundle. It first tests containing polygons, then a nearest plausible polygon
within 50 metres; ambiguous and unmatched points are retained as NAR address
points and written to `address-footprint-review.geojson`. The 50-metre value is
a conservative review threshold, not a hard address exclusion.

`address-footprint-placement.json` and
`address-numbering-validation.json` are developer-facing diagnostics. The
numbering validator checks parity, numbered-grid hundred blocks, directions,
suffix syntax, and monotonic progression. It never overwrites an authoritative
NAR value. The Grey footprint snapshot and the generated review files contain
no resident or roll-number data.

The latest generated snapshot reports 7,156 retained physical `LOC_GUID`
locations, of which 6,841 contain primary residential or partly-residential
units; 10,893 primary address units remain published. Primary NAR coordinates
are 5,720 BG building coordinates and 1,121 BF_REPPOINT block-face fallbacks.
The placement audit reports 334 exact, 4,211 nearest, 810 ambiguous, and 1,801
unmatched locations across all-use records; for primary records the
corresponding unresolved total is 2,463. Across primary NAR locations, 4,378
have a selected structure and 2,463 do not. The selected-distance distribution
for the current all-use placement set is p50 8.04m, p90 29.16m, p95 37.94m,
p99 50.56m, and maximum 723.38m; the maximum includes records that
are not fully validated and is not used to certify a nearest match. The
constrained pass is monotonic within normalized street/side/hundred-block
groups, permits explicit skipped lots, and never performs a city-wide nearest
fallback. The primary numbering diagnostics currently flag 335 parity, 161
hundred-block, and 763 monotonic-progression anomalies; these are review
signals and do not overwrite NAR values.

The live database seed stores the NAR GUIDs, suffix, official street parts,
retrieval date, and footprint provenance in the address row. Existing matched
internal address IDs and their histories remain unchanged. Route and household
responses use the generated canonical label, while manual correction events
continue to take precedence for historically corrected rows.

## Preserving activity when a legacy roof is reconciled

The authoritative reseed also publishes
`legacy-history-reconciliation.json`. It contains only internal address IDs,
NAR address/location IDs, match status, and matching diagnostics; it contains
no event payloads or resident information. In the current placement run it
contains 6,437 legacy-only rows after 25 former rows matched a current NAR
address: 1,852 confident, 3,731 ambiguous, and 854 unmatched. The original
6,462 legacy source IDs remain preserved independently in the recovery and
history tables.

On startup, schema migration 18 creates `legacy_history_links` and
`legacy_history_reviews`. A confident link causes the existing append-only
`visits`, `household_flyer_events`, `people`, and neighbourhood-conversation
rows to be projected onto the canonical household through read views. The
original row, event ID, timestamp, actor, flyer ID, notes, corrections, and
foreign keys are not copied or rewritten. This also prevents an event from
being counted twice in coverage, history, or user statistics.

Inactive legacy addresses that have activity but no safe one-to-one link are
recorded in `legacy_history_reviews` and remain visible in the map/state with
their historical label, current derived status, and an address-review flag.
They are explicitly excluded from fresh coverage totals, recommendation
selection, and route targeting. The review set is derived from the event
tables during every seed, so reseeding and restarting cannot reset a roof's
colour or hide an activity-bearing historical roof. A later safe reconciliation
can update the link table without modifying the original events.

## Physical-roof recovery and operational address fallback

Schema migration 20 creates `structure_history_crosswalk`. It is keyed by the
historical household and records the historical structure, current physical
structure, match method, and confidence. The crosswalk is generated from the
verified pre-migration snapshot with:

```sh
npm run canvassing:history-crosswalk
```

The API derives physical-roof activity from the original visits and flyer
events through that crosswalk. It does not copy, rewrite, or re-identify those
events, so event IDs, timestamps, actors, flyer IDs, notes, corrections, and
sources remain intact. When several historical rows resolve to one roof, their
effective activity is unioned for the roof status while unit history remains
available at household level.

Generate the machine-readable recovery comparison and invariant report with:

```sh
npm run canvassing:audit-address-recovery -- \
  --current-db private/canvassing/owen-sound.sqlite \
  --pre-migration-db private/canvassing/backups/owen-sound-pre-address-history-2026-08-26.sqlite
```

The 2026-08-27 production-shaped recovery clone reported 2,046
pre-migration flyered physical roofs and 2,046 recovered roofs, with zero
missing visit rows. It also verified zero anonymous canvassing labels, zero
blank active target addresses, zero distant-review references used for
targeting, and zero canvassable roofs without a target. The current production
backup made before this repair is stored outside Git under
`private/canvassing/backups/recovery-before-address-repair-2026-08-27T03-51-34Z`.
The final pre-deployment recovery backup is under
`private/canvassing/backups/recovery-before-final-address-deploy-2026-08-27T05-14-53Z`;
the post-activation stale-target cleanup backup is under the timestamped
`recovery-before-stale-target-cleanup-*` directory.

The old city-wide nearest-building references are no longer used to create
household targets. A roof with a direct NAR placement uses its NAR address
units. An otherwise canvassable roof uses a same-physical-roof legacy civic
label when one exists, or an explicitly marked Owen Sound grid estimate. Both
remain human-readable and selectable; review confidence is informational and
cannot suppress physical-roof activity or field actions. Accessory structures
remain outside the canvassable structure type set unless they have an explicit
residential address placement.
