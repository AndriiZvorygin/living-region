# ARC site-lease economics

This report models a resident-owned dwelling on a project-owned ARC property. The household leases its calculated productive site and pays a separate shared-infrastructure/service charge. It does not use the obsolete combined dwelling-plus-land shortcut.

## Central accounting

- Productive hectares come from the canonical carrying-capacity establishment peak for the household, site and heated buildings.
- The recommended site-lease allocation is **base plus hectare**: productive/exclusive land finance recovery and property tax follow productive hectares; common-property land value, common tax and fixed land-holding costs are divided equally as the base household charge.
- Shared infrastructure is financed and recovered separately from land lease. Legal lease term is 49 years; debt amortization is 30 years.
- Default monetary inputs are planning assumptions pending a site design, current land evidence, assessment/tax data and construction/servicing quotes.

## Household comparison

| Scenario | Establishment site | Mature site | Project property | Land value | Dwelling finance/mo | Site lease/mo | Shared services/mo | Resident total/mo |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 adult · ordinary land · 12 households | 1.14 ha | 1.06 ha | 15.12 ha | $529284 | $725 | $458 | $228 | $1769 |
| 1 adult · marginal land · 12 households | 2.15 ha | 2.02 ha | 27.24 ha | $953477 | $725 | $667 | $228 | $1978 |
| 2 adults + 2 children · ordinary land · 12 households | 1.75 ha | 1.52 ha | 22.48 ha | $786828 | $725 | $584 | $228 | $1896 |

For the central 12-household ordinary-land case, the one-adult household costs **$1769/month** under the default financed-land, financed-dwelling and shared-service assumptions. The family case costs **$1896/month**; children change the canonical food-site requirement but do not create a separate child dwelling allocation.

## Community scale: 2 adults + 2 children per household

| Households | Productive site area | Total property | Land value | Site lease/mo | Shared services/mo | Resident total/mo | Annual reserve |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 12 | 20.98 ha | 22.48 ha | $786828 | $584 | $228 | $1896 | $4708 |
| 16 | 27.97 ha | 29.47 ha | $1031603 | $529 | $171 | $1783 | $5535 |
| 25 | 43.71 ha | 45.21 ha | $1582349 | $469 | $110 | $1661 | $7395 |

The shared-service charge falls as households share the same capital and operating base. Productive site area and land value still scale with household requirements.

## Project recovery

| Scenario | Annual project revenue | Annual project cost | Surplus / shortfall | Break-even |
|---|---:|---:|---:|---|
| 1 adult · ordinary land · 12 households | $98753 | $98753 | $0 | break_even_or_surplus |
| 1 adult · marginal land · 12 households | $128843 | $128843 | $0 | break_even_or_surplus |
| 2 adults + 2 children · ordinary land · 12 households | $117021 | $117021 | $0 | break_even_or_surplus |
| 2 adults + 2 children · ordinary land · 16 households | $134385 | $134385 | $0 | break_even_or_surplus |
| 2 adults + 2 children · ordinary land · 25 households | $173451 | $173451 | $0 | shortfall |

Full machine-readable rows are in `arc-site-lease-economics.json` and `arc-site-lease-economics.csv`.

## Evidence limits

- The repository contains no current parcel-matched Grey County rural land-price series; the default 35,000 CAD/ha is the midpoint of the task-specified working range and must be treated as sensitivity only.
- No current ARC dwelling construction quote, property assessment/tax roll, servicing design, insurance quote or replacement study is loaded.
- The monetary layer is therefore a transparent planning model. The biological hectares and heating loads remain canonical carrying-capacity outputs and are not tuned to fit a cost target.
