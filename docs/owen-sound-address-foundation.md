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
  source, retained for review and not deleted from SQLite;
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

Restarting the canvassing server runs its existing transactional prepared-data
seed. Make a backup before production restart as usual. The seed applies the
generated unmatched-ID list as a historical-only deny list, so an old row that
had previously been labelled manually cannot remain active merely because of
its old source name. Manually inferred roof-split addresses remain separate
operational exceptions until explicitly reconciled; they are not counted as
NAR units.

## Current generated validation snapshot

The checked-in report is generated with retrieval date 2026-08-26. It records
the exact counts, duplicate/conflict groups, coordinate and boundary checks,
and the existing-stop reconciliation. In particular, one physical location
can have many address units, so those two counts must not be treated as
interchangeable household or building counts.

The current snapshot contains 11,244 in-bound coordinate-backed address units:
8,875 residential, 2,034 partly residential, 324 non-residential, and 11
unknown-use. Those units represent 7,156 coordinate-backed physical locations;
656 locations have more than one residential or partly residential unit. The
primary canvassing bundle contains 10,909 residential/partly-residential units.
Of the 7,453 parseable legacy address rows, 916 matched exactly and 75 matched
by normalized civic-address components within 75 metres; 6,462 are retained as
inactive legacy rows for historical integrity and review.

Unknown-use records are not silently promoted to residential. Non-residential
records are kept in their own file. Earlier OSM/range-derived records that do
not match are preserved in the database and review export rather than being
rewritten or deleted.

The NAR's point is a representative building/location coordinate and may be
shared by all units at an apartment or mixed-use location. The generated
`canvassing-locations.geojson` has one feature per `LOC_GUID` and the primary
NAR units represent 6,857 physical locations (7,156 across all retained use
categories). The generated primary unit bundle is published at
`packages/web-client/public/canvassing/addresses.geojson`.

The final activation audit is recorded in
`data/derived/owen-sound-address-foundation/validation-report.json`. The
11,244 retained all-use units and 10,909 primary units both exclude the 12
outside-boundary and 14 no-coordinate records. The live database currently
contains 10,912 selectable household rows: the 10,909 NAR primary rows plus
three pre-existing manual roof-split exceptions. The current runtime does not
yet consume `LOC_GUID` as its map/selection identity; it still groups linked
records by legacy `structure_id` and otherwise exposes address-unit points.
That is an explicit remaining address-foundation limitation, not a count that
should be hidden by the published source totals.
