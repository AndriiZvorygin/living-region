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
- <https://services1.arcgis.com/wE2uWQWlTTnVDgyt/arcgis/rest/services/Building_Footprints/FeatureServer>

Required attribution for that source is:

> Contains information licensed under the Grey County Open Data Licence.

The public Grey Assessment Parcel v2 Addresses table was not used for the
derived address dataset: its item identifies MPAC/Teranet data, exposes
roll-number fields, and does not state the Grey County Open Data Licence. The
interactive locator was not scraped or treated as a bulk source. See the
generated `source-provenance.json` for the exact item references and decision.

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
- `reconciliation.json`, `validation-report.json`, and
  `source-provenance.json`.

Use `--publish` only after reviewing the generated report. It replaces the
static primary address bundle with the residential/partly-residential NAR
units. The existing server importer already performs an upsert by address ID,
keeps unmatched old rows in SQLite with `source_active=0`, and never deletes
households, visits, outcomes, conversations, corrections, or journal entries.
Existing IDs are reused for safe normalized matches; new rows receive a
SHA-256-derived ID from `ADDR_GUID`.

```sh
npm run canvassing:addresses -- \
  --zip private/canvassing/source-cache/national-address-register-202606.zip \
  --publish
```

Restarting the canvassing server runs its existing transactional prepared-data
seed. Make a backup before production restart as usual.

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
shared by all units at an apartment or mixed-use location. This is why the
location file is supplied separately from the unit file. The generated primary
unit bundle is now published at
`packages/web-client/public/canvassing/addresses.geojson`; the separate location
file remains available for future map-marker aggregation without duplicating
apartment markers.
