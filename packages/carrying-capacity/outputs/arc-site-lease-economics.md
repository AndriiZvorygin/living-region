# ARC site-lease economics

This report covers the ARC site lease and selected shared infrastructure only. The completed resident-owned dwelling is reported separately as capital and illustrative financing; it is outside the land-and-infrastructure charge.

## Central accounting

- Productive hectares come from the canonical carrying-capacity establishment peak for the household, site and heated buildings.
- The legal-minimum site-lease allocation is **common-property land holding share plus productive land**: productive/exclusive land finance recovery and property tax follow productive hectares; common-property land value, common tax and fixed land-holding costs are divided equally once a site-plan takeoff exists.
- Legal-minimum cash excludes paid administration, vacancy reserve, optional insurance, contracted grounds work, maintenance cash and replacement reserves. Resident labour and future replacement liability are shown separately.
- Shared infrastructure is financed and recovered separately from land lease. Legal lease term is 49 years; the default 6% / 30-year / 20% land financing case is illustrative and its loan term/renewal is separate from amortization.
- Default monetary inputs are planning assumptions pending a site design, current land evidence, assessment/tax data and construction/servicing quotes.

## Household comparison

| Scenario | Establishment site | Mature site | Project property | Land value | Site lease/mo | Shared services/mo | Land + infrastructure/mo | Dwelling capital | Dwelling finance/mo | Dwelling finance + land/shared/mo |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 adult · ordinary land · 12 households | 1.12 ha | 1.05 ha | 13.41 ha | $469502 | $220 | $48 | $268 | $61000 | $354 | $622 |
| 1 adult · marginal land · 12 households | 2.12 ha | 2.00 ha | 25.40 ha | $889075 | $417 | $48 | $465 | $61000 | $354 | $819 |
| 2 adults + 2 children · ordinary land · 12 households | 1.75 ha | 1.52 ha | 20.98 ha | $734328 | $345 | $48 | $392 | $61000 | $354 | $746 |

For the central 12-household ordinary-land case, the one-adult land + infrastructure charge is **$268/month** and the 2-adult + 2-child case is **$392/month**. The componentized resident-owned dwelling central case is **$61000** with an illustrative financing payment of **$354/month**; children change the canonical reserved land requirement without creating a separate child-specific perennial allocation.

## Community scale: 2 adults + 2 children per household

| Households | Productive site area | Total property | Land value | Site lease/mo | Shared services/mo | Land + infrastructure/mo |
|---:|---:|---:|---:|---:|---:|---:|
| 12 | 20.98 ha | 20.98 ha | $734328 | $345 | $48 | $392 |
| 16 | 27.97 ha | 27.97 ha | $979103 | $345 | $36 | $380 |
| 25 | 43.71 ha | 43.71 ha | $1529849 | $345 | $23 | $368 |

The shared-service charge falls as households share the same capital and operating base. Productive site area and land value still scale with household requirements.

The public default is legal-minimum/self-managed. Conventional administration remains a separately selectable comparison: its former $18,000/year at 12 households is an operating-budget scenario, not an unavoidable recurring legal charge. Software-assisted and lean self-managed alternatives are available in the common-property audit.

## Project recovery

| Scenario | Land-layer revenue | Land-layer cost | Infrastructure revenue | Infrastructure cost | Land check | Infrastructure check |
|---|---:|---:|---:|---:|---|---|
| 1 adult · ordinary land · 12 households | $31718 | $31718 | $6907 | $6907 | break-even | break-even |
| 1 adult · marginal land · 12 households | $60063 | $60063 | $6907 | $6907 | break-even | break-even |
| 2 adults + 2 children · ordinary land · 12 households | $49609 | $49609 | $6907 | $6907 | break-even | break-even |
| 2 adults + 2 children · ordinary land · 16 households | $66145 | $66145 | $6907 | $6907 | break-even | break-even |
| 2 adults + 2 children · ordinary land · 25 households | $103352 | $103352 | $6907 | $6907 | break-even | break-even |

Full machine-readable rows are in `arc-site-lease-economics.json` and `arc-site-lease-economics.csv`.

## Evidence limits

- The repository contains no current parcel-matched Grey County rural land-price series; the default 35,000 CAD/ha is the midpoint of the task-specified working range and must be treated as sensitivity only.
- Dwelling acquisition and household expenses are intentionally outside this report; building/heating inputs affect biological hectares upstream but do not become a housing charge here.
- The monetary layer is therefore a transparent planning model. The biological hectares and heating loads remain canonical carrying-capacity outputs and are not tuned to fit a cost target.
