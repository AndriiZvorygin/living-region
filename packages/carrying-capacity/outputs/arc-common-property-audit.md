# ARC common-property administration and operations audit

This report audits the common-property land-holding operating inputs. The public headline remains site lease plus shared infrastructure; these details remain expandable and are not dwelling or household expenses.

## Administration: origin of the former $125/month

The former charge was exactly **$18,000/year ÷ 12 households ÷ 12 months = $125/household/month**. It had no documented staffing plan or service-capacity basis. The canonical model now treats that amount as the 12-household result of the conventional administration scenario:

| Activity | Cost type | Annual cost at 12 households | Intended work |
|---|---|---:|---|
| Lease, accounting and bookkeeping | fixed project | $3,600 | lease billing, accounting close, reserve ledger |
| Tax and payment administration | fixed project | $1,800 | tax/payment calendar, reconciliation, annual filings |
| Compliance and site records | fixed project | $2,400 | resident records, site-plan/checklist records, document control |
| Maintenance coordination and inspections | fixed project | $1,800 | work orders, inspection scheduling, contractor coordination |
| Resident billing and records | variable per household | $5,760 | account changes, statements, routine correspondence |
| Legal/accounting professional allowance | event-driven allowance | $2,640 | occasional review and compliance questions |
| **Total** |  | **$18,000** |  |

The fixed work is not multiplied by household count. Resident records/billing scale with households, while professional work is retained as an allowance rather than assumed to be zero.

## Administration scale sensitivity

| Households | Administration scenarios: monthly per household |
|---:|---|
| 12 | Legal minimum / resident self-managed: $0.00<br>Conventional administration: $125.00<br>Software-assisted / self-managed: $70.00<br>Lean self-managed sensitivity: $51.67 |
| 16 | Legal minimum / resident self-managed: $0.00<br>Conventional administration: $103.75<br>Software-assisted / self-managed: $57.50<br>Lean self-managed sensitivity: $41.25 |
| 25 | Legal minimum / resident self-managed: $0.00<br>Conventional administration: $80.80<br>Software-assisted / self-managed: $44.00<br>Lean self-managed sensitivity: $30.00 |
| 50 | Legal minimum / resident self-managed: $0.00<br>Conventional administration: $60.40<br>Software-assisted / self-managed: $32.00<br>Lean self-managed sensitivity: $20.00 |

The software-assisted scenario assumes open-source tools can automate billing/accounting workflows, reserve ledgers, maintenance schedules, resident/site records, site-plan checks, carrying-capacity calculations, productive-land plans, inspection checklists and document generation. It retains human exception handling and professional legal/accounting work. The lean sensitivity adds resident time and lowers cash cost; it is not zero administration.

## Common-property operations: origin of the former $41.67/month

The former amount was **$6,000/year ÷ 12 households ÷ 12 months = $41.67/household/month**. It is now decomposed as:

| Component | Annual cost | Status | Boundary |
|---|---:|---|---|
| Common-land mowing and vegetation management | $1800 | planning assumption | Common-property cash operations; not shared infrastructure |
| Road-edge and drainage maintenance | $1200 | planning assumption | Common-property cash operations; not shared infrastructure |
| Common paths and access-side grounds | $600 | planning assumption | Common-property cash operations; not shared infrastructure |
| Ecological and water-buffer maintenance | $1200 | planning assumption | Common-property cash operations; not shared infrastructure |
| Common-area repairs and miscellaneous grounds work | $1200 | planning assumption | Common-property cash operations; not shared infrastructure |

Snow clearing, road maintenance, waste handling and infrastructure insurance remain in the shared-infrastructure layer. They are explicitly excluded from this common-property operations pool.

## Common-property area

The current **0.00 ha** is a pooled planning assumption. Current Living Region hamlet fixtures provide proposed points, lines and rectangles, but not a validated parcel-clipped area takeoff for residential footprints, roads/access, common buildings, ecological/water buffers, shared productive areas and other required common land. The API now accepts all six categories explicitly and switches to spatial/layout-derived mode only when all are supplied.

Desired pipeline:

`parcel → buildings/residential footprints → roads/access → servicing → productive layout → ecological buffers → explicit common hectares → land holding cost`

Until that takeoff exists, the pooled area is visible and must not be mistaken for a measured site layout.

## Scale: common-property and revised household charges

| Households | Common area mode | Administration/year | Administration/month/household | Common operations/month/household | Common-property share/month | Site lease/month | Land + infrastructure/month |
|---:|---|---:|---:|---:|---:|---:|---:|
| 12 | pooled_planning_assumption | $0 | $0.00 | $0.00 | $0.00 | $220.26 | $268.22 |
| 16 | pooled_planning_assumption | $0 | $0.00 | $0.00 | $0.00 | $220.26 | $256.23 |
| 25 | pooled_planning_assumption | $0 | $0.00 | $0.00 | $0.00 | $220.26 | $243.28 |
| 50 | pooled_planning_assumption | $0 | $0.00 | $0.00 | $0.00 | $220.26 | $231.77 |

The legal-minimum headline uses zero recurring cash for paid administration and common-property operations; resident labour is shown separately. The conventional scenario remains available for comparison and reproduces the former $18,000 administration and $6,000 operations inputs. It is not the legal-minimum baseline.

## Tax, insurance and vacancy status

- **Property tax:** the model currently applies an explicit 1% of land value. MPAC guidance shows that farm land, residences, buildings and non-farm/common uses can be classified differently, and Ontario farm-class eligibility can materially change the applicable rate. The 1% value is therefore a planning assumption, not an assessed Grey County tax result.
- **Land insurance:** the CAD 3,000/year allowance has no quote. Ontario farm-insurance guidance confirms that property and liability premiums depend on buildings, equipment, activities, visitors, location, limits and risk. This remains unresolved/site-specific.
- **Vacancy reserve:** the 0.0% rate is applied separately to common-property and productive-land pre-reserve pools. This is intentional because the pools have different allocation bases; neither reserve is applied twice. The reserve is retained by the land-holding entity for vacancy and future land-layer costs.

## Evidence-status classification

| Input | Status |
|---|---|
| Carrying-capacity hectares | derived from Living Region canonical model |
| Common area | working planning assumption until spatial takeoff |
| Administration scenarios | policy/design choice with explicit planning costs |
| Common-property operations | working planning assumption pending maintenance plan/bids |
| Property tax | planning assumption informed by MPAC/Ontario classification framework |
| Land insurance | unresolved/site-specific pending broker/entity quote |
| Vacancy rate and surplus policy | policy/design choice |

Sources: [MPAC farm property assessments](https://www.mpac.ca/en/PropertyTypes/FarmPropertyAssessments), [Ontario tax rates](https://www.ontario.ca/laws/regulation/090224), [OFA insurance guidance](https://ofa.on.ca/resources/insurance-coverage-for-ontario-farmers-a-summary-prepared-by-ofa/).
