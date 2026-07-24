# Owen Sound canvassing milestone 3

## Weekly follow-up workflow

A completed flyer route can produce one stable follow-up sample. The default is 20 percent, with an optional target count such as 40 or 50. Selection is stratified by normalized street, civic-number block, and odd/even street side. Each stratum uses a deterministic seed and offset, then selection proceeds round-robin across strata.

Draft samples support append-only inclusion, exclusion, reorder, and reschedule events. Acceptance creates a linked `followup_canvass` route and locks its membership and order. The server rejects regeneration or membership changes after acceptance. Schedule changes remain available without regenerating the route.

Default date cadence:

| Flyer delivery | Follow-up canvass |
| --- | --- |
| Monday | Wednesday |
| Wednesday | Following Monday |
| Friday | Following Tuesday |

The workspace labels accepted and draft routes as upcoming, due, or overdue.

## Neighbourhood conversations

Area-level and household-associated conversations are append-only. Approximate location, issue, political outcome, volunteer and candidate possibilities, follow-up request, household, and route are recorded. Location is captured only when the user submits the conversation. A household-associated conversation can append a route-stop completion event.

Volunteer submissions omit political outcome and candidate-recruitment indicators. Volunteer state responses contain no neighbourhood-conversation or recruitment records.

## Candidate recruitment

Recruitment areas maintain append-only statuses: candidate confirmed, candidate needed, potential candidate identified, contacted, considering, declined, and registered. Prospects can originate from a household visit, neighbourhood conversation, or manual entry. Candidate-needed areas are highlighted in the recruitment workspace but are not used as route-sampling weights.

The default `Owen Sound citywide` area is a placeholder because no ward boundary layer is present. Additional campaign wards or organizing areas can be added without changing household geography.

## Address review

Focused queues cover duplicate normalized addresses, apparent multi-unit records, unmatched streets, distant-from-road records, and outside-boundary records. The 12 outside-boundary address points remain in the review audit but have no household records and cannot enter default campaign routes.

## Storage and verification

Schema migration version 4 adds linked follow-up samples, sample-event history, neighbourhood conversations, route-stop completion events, recruitment areas and prospects, status history, and address-review records. Existing visits, households, associations, routes, backups, and the hash-chained journal remain intact.
