# ARC site-lease economics

This report covers the ARC site lease and selected shared infrastructure only. The private dwelling is acquired separately and is outside the public land-and-infrastructure charge.

## Central accounting

- Productive hectares come from the canonical carrying-capacity establishment peak for the household, site and heated buildings.
- The recommended site-lease allocation is **common-property land holding share plus productive land**: productive/exclusive land finance recovery and property tax follow productive hectares; common-property land value, common tax and fixed land-holding costs are divided equally.
- Shared infrastructure is financed and recovered separately from land lease. Legal lease term is 49 years; the default 6% / 30-year / 20% land financing case is illustrative and its loan term/renewal is separate from amortization.
- Default monetary inputs are planning assumptions pending a site design, current land evidence, assessment/tax data and construction/servicing quotes.

## Household comparison

| Scenario | Establishment site | Mature site | Project property | Land value | Site lease/mo | Shared services/mo | Land + infrastructure/mo |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1 adult · ordinary land · 12 households | 1.14 ha | 1.06 ha | 15.12 ha | $529284 | $458 | $228 | $686 |
| 1 adult · marginal land · 12 households | 2.15 ha | 2.02 ha | 27.24 ha | $953477 | $667 | $228 | $895 |
| 2 adults + 2 children · ordinary land · 12 households | 1.75 ha | 1.52 ha | 22.48 ha | $786828 | $584 | $228 | $813 |

For the central 12-household ordinary-land case, the one-adult land + infrastructure charge is **$686/month**. The 2-adult + 2-child case is **$813/month**; children change the canonical reserved land requirement without creating a separate child-specific perennial allocation.

## Community scale: 2 adults + 2 children per household

| Households | Productive site area | Total property | Land value | Site lease/mo | Shared services/mo | Land + infrastructure/mo |
|---:|---:|---:|---:|---:|---:|---:|
| 12 | 20.98 ha | 22.48 ha | $786828 | $584 | $228 | $813 |
| 16 | 27.97 ha | 29.47 ha | $1031603 | $529 | $171 | $700 |
| 25 | 43.71 ha | 45.21 ha | $1582349 | $469 | $110 | $578 |

The shared-service charge falls as households share the same capital and operating base. Productive site area and land value still scale with household requirements.

## Project recovery

| Scenario | Land-layer revenue | Land-layer cost | Infrastructure revenue | Infrastructure cost | Land check | Infrastructure check |
|---|---:|---:|---:|---:|---|---|
| 1 adult · ordinary land · 12 households | $65895 | $65895 | $32858 | $32858 | break-even | break-even |
| 1 adult · marginal land · 12 households | $95985 | $95985 | $32858 | $32858 | break-even | break-even |
| 2 adults + 2 children · ordinary land · 12 households | $84163 | $84163 | $32858 | $32858 | break-even | break-even |
| 2 adults + 2 children · ordinary land · 16 households | $101527 | $101527 | $32858 | $32858 | break-even | break-even |
| 2 adults + 2 children · ordinary land · 25 households | $140593 | $140593 | $32858 | $32858 | break-even | break-even |

Full machine-readable rows are in `arc-site-lease-economics.json` and `arc-site-lease-economics.csv`.

## Evidence limits

- The repository contains no current parcel-matched Grey County rural land-price series; the default 35,000 CAD/ha is the midpoint of the task-specified working range and must be treated as sensitivity only.
- Dwelling acquisition and household expenses are intentionally outside this report; building/heating inputs affect biological hectares upstream but do not become a housing charge here.
- The monetary layer is therefore a transparent planning model. The biological hectares and heating loads remain canonical carrying-capacity outputs and are not tuned to fit a cost target.
