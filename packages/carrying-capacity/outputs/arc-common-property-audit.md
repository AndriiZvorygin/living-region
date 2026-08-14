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
| 12 | Conventional administration: $125.00<br>Software-assisted / self-managed: $70.00<br>Lean self-managed sensitivity: $51.67 |
| 16 | Conventional administration: $103.75<br>Software-assisted / self-managed: $57.50<br>Lean self-managed sensitivity: $41.25 |
| 25 | Conventional administration: $80.80<br>Software-assisted / self-managed: $44.00<br>Lean self-managed sensitivity: $30.00 |
| 50 | Conventional administration: $60.40<br>Software-assisted / self-managed: $32.00<br>Lean self-managed sensitivity: $20.00 |

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

The current **1.50 ha** is a pooled planning assumption. Current Living Region hamlet fixtures provide proposed points, lines and rectangles, but not a validated parcel-clipped area takeoff for residential footprints, roads/access, common buildings, ecological/water buffers, shared productive areas and other required common land. The API now accepts all six categories explicitly and switches to spatial/layout-derived mode only when all are supplied.

Desired pipeline:

`parcel → buildings/residential footprints → roads/access → servicing → productive layout → ecological buffers → explicit common hectares → land holding cost`

Until that takeoff exists, the pooled area is visible and must not be mistaken for a measured site layout.

## Scale: common-property and revised household charges

| Households | Common area mode | Administration/year | Administration/month/household | Common operations/month/household | Common-property share/month | Site lease/month | Land + infrastructure/month |
|---:|---|---:|---:|---:|---:|---:|---:|
| 12 | pooled_planning_assumption | $18000 | $125.00 | $41.67 | $222.74 | $457.60 | $685.78 |
| 16 | pooled_planning_assumption | $19920 | $103.75 | $31.25 | $177.55 | $412.42 | $583.56 |
| 25 | pooled_planning_assumption | $24240 | $80.80 | $20.00 | $128.75 | $363.62 | $473.15 |
| 50 | pooled_planning_assumption | $36240 | $60.40 | $10.00 | $85.38 | $320.24 | $375.00 |

The one-adult and family 12-household headline charges remain unchanged because the conventional scenario reproduces the former $18,000 and $6,000 annual inputs at 12 households. Larger projects now receive lower per-household administration allocation while common operations remain a physical cash allowance divided across households.

## Tax, insurance and vacancy status

- **Property tax:** the model currently applies an explicit 1% of land value. MPAC guidance shows that farm land, residences, buildings and non-farm/common uses can be classified differently, and Ontario farm-class eligibility can materially change the applicable rate. The 1% value is therefore a planning assumption, not an assessed Grey County tax result.
- **Land insurance:** the CAD 3,000/year allowance has no quote. Ontario farm-insurance guidance confirms that property and liability premiums depend on buildings, equipment, activities, visitors, location, limits and risk. This remains unresolved/site-specific.
- **Vacancy reserve:** the 5.0% rate is applied separately to common-property and productive-land pre-reserve pools. This is intentional because the pools have different allocation bases; neither reserve is applied twice. The reserve is retained by the land-holding entity for vacancy and future land-layer costs.

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
