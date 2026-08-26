# Owen Sound address activation audit — 2026-08-26

This audit covers only the address foundation. Volunteer, lawn-sign,
recruitment, lead, and flyer features were not changed as part of the audit.

## Published source counts

The authoritative source is the Statistics Canada National Address Register,
June 2026, filtered to Ontario (`PROV_CODE=35`), Owen Sound
(`CSD_CODE=3542059`, verified by `CSD_ENG_NAME`), then checked against the
repository municipal boundary.

| Population | Count | Treatment |
| --- | ---: | --- |
| All Ontario NAR records streamed | 6,246,543 | source file rows, before city filtering |
| Owen Sound-named address rows | 11,270 | raw city candidate rows |
| Outside municipal boundary | 12 | rejected |
| Missing usable coordinates | 14 | rejected |
| Retained all-use address units | 11,244 | excludes both rejection groups |
| Retained residential + partly residential units | 10,909 | primary published canvassing bundle |
| Retained physical locations, all use categories | 7,156 | one per retained `LOC_GUID` |
| Physical locations containing primary units | 6,857 | primary canvassing locations |

The 11,244 and 10,909 figures therefore exclude all 26 rejected records. The
primary static bundle is `packages/web-client/public/canvassing/addresses.geojson`.
The separate derived `canvassing-locations.geojson` preserves the physical
location level and unit counts.

## Legacy reconciliation

The generated reconciliation contains 916 exact matches, 75 normalized
address-plus-distance matches, and 6,462 unmatched legacy rows. The server
now loads `legacy-unmatched-address-ids.json` during its transactional seed and
forces those IDs to `source_active=0`, including the one former manually
labelled row that had previously escaped the broad manual-row exception.

Live database verification after deployment:

- 6,462/6,462 unmatched IDs are present and inactive.
- 0 unmatched IDs appear in the fresh `/api/canvassing/state` response.
- Their 1,799 historical visits remain in `visits`; the full database retains
  2,177 visits, one correction, one flyer-event row, and four association
  events. No historical rows were rewritten or deleted.
- The existing route table still retains its historical route stop reference;
  current state selection excludes the inactive address source.
- A later safe reconciliation can reuse the preserved household/address ID and
  retain the attached event history, subject to an explicit audited migration.

## Runtime targeting finding

The source deliverable has one physical feature per `LOC_GUID`, with unit
counts. However, the current runtime has not yet been converted to use that
identity for map/selection. It currently returns 10,912 active household rows:
10,909 NAR primary units plus three pre-existing `manual_split_inferred`
exceptions. Its selector and map still use address units, or legacy
`structure_id` where available. Thus the source counts are authoritative, but
the requested “one selectable canvassing stop per physical `LOC_GUID`” is not
yet a runtime invariant. Apartment units without a linked legacy structure can
still appear as overlapping address points at high zoom. This is the principal
remaining activation limitation.

## Deployment and smoke checks

The existing Docker Compose deployment was rebuilt with the published bundle.
Both containers became healthy. Static map assets returned HTTP 200, including
structures, addresses, roads, boundary, address quality, and building audit
files. The API health endpoint returned `{"status":"ok"}` and unauthenticated
state access returned HTTP 401.

An authenticated disposable-database smoke run (so production history was not
polluted) verified:

- login and `/api/me`;
- 10,909 NAR households in a clean seeded database;
- normal `/api/canvassing/next-area` and centered recommendation;
- route generation;
- partial coverage after a non-flyer visit;
- status persistence and actor attribution.

The existing mobile browser suite loaded the map and passed the mobile default
coverage, next-area popup, and bulk-delivery workflows. Two unrelated existing
end-to-end cases failed: the visit-without-flyer case timed out, and the route
creation case did not observe its toast. No address data was written by those
disposable tests.

There is no dedicated address-search endpoint or search control in the current
canvassing UI; address lookup is presently through map data/interaction. The
browser uses `force-cache` for static map JSON, but there is no service worker,
offline event queue, or offline write synchronization. Map assets can remain
available from browser cache, while new statuses still require the central API.

## Spot checks and gaps

The NAR subset contains numbered streets/avenues, directional components,
civic-number suffixes, unit/suite records, downtown partly-residential
records, and boundary-adjacent records. The automated validation found no
duplicate `ADDR_GUID`s, normalized civic-address duplicates, or normalized
conflicts. Boundary-adjacent examples were retained only when the
point-in-polygon check placed them inside Owen Sound; the 12 rejected examples
remain in the report's sample and do not enter the published bundle.

Database `PRAGMA integrity_check` returned `ok`, and `PRAGMA foreign_key_check`
returned zero rows. The live deployment preserved the pre-existing visit,
correction, flyer-event, association, split, route-session, and route-stop
records relative to the latest pre-deployment backup.

The remaining gaps are therefore explicit: runtime `LOC_GUID` aggregation,
dedicated address search, and true offline writes. They should be resolved in
the address foundation before treating the targeting model as fully activated;
no volunteer, lawn-sign, lead, recruitment, or flyer workflow work is included
in this audit.
