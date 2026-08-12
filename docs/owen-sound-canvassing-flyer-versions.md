# Owen Sound canvassing flyer versions

The canvassing database stores flyer versions in the `flyer_catalogue` table and
stores the selected `flyer_id` on each append-only delivery event. A household's
current coverage state remains separate from its delivery history: any flyer
delivery still counts as coverage under the existing rules, while the history
shows which material was delivered and when.

## Initial catalogue

The schema 12 migration creates two editable catalogue records:

| Stable ID | Initial name | Introduction date |
| --- | --- | --- |
| `flyer-1-original` | Flyer 1: Original flyer | 2026-07-26 |
| `flyer-2-current` | Flyer 2: Current flyer | 2026-08-12 |

Names, descriptions, active state, introduction date and printable filename/link
can be edited from **Flyer catalogue**. Stable IDs are retained in delivery
events, audit records and exports.

## Migration and field use

Before applying schema 12, the production SQLite database was backed up and the
backup passed `PRAGMA quick_check` and a restore test. Existing delivery events
were all dated before Flyer 2 entered use, so they were assigned
`flyer-1-original`. A future migration must use `unknown-legacy-flyer` when that
date-based conclusion is not supported by the source records.

Select **Active flyer** once at the start of an outing. The selection is stored
in device local storage. Individual and bulk delivery actions send that stable
ID. The app warns before delivering the same flyer to a household again, but a
candidate can confirm an intentional repeat. Visiting without leaving a flyer
does not require an active flyer.

The household drawer shows delivery history. Campaign totals report deliveries
and distinct households by catalogue entry, households receiving both current
flyers, and any unknown-version deliveries. The optional **Inspect flyer** map
filter shows where one version was distributed without changing normal coverage
colours.

Route CSV exports include a `flyer_versions` column. The Pyash-compatible JSONL
audit journal retains the flyer ID on appended visit and catalogue events; no
delivery history is deleted when a current flyer status is corrected.

## Verification

The migration and workflow are covered by
`packages/canvassing/src/canvassing-workflow-api.test.ts`, including catalogue
editing, individual delivery, duplicate warning and override, history,
summary counts, CSV export and journal persistence. Operational integrity is
checked with:

```sh
npm run canvassing:verify-operations
```
