# ARC site-lease decomposition and land-financing audit

> **Current-baseline note:** the original figures in this audit are retained as a legacy decomposition. The canonical affordability baseline is now `legal_minimum`: paid administration, vacancy, optional insurance, paid common-property operations and replacement reserves are excluded from recurring cash; common area is represented by the conceptual lane/loop/250 m² amenity prototype until a parcel/site-plan takeoff is available. See `packages/carrying-capacity/outputs/arc-legal-minimum.md` for regenerated values.

## Scope

This audit covers the public ARC site lease and shared-infrastructure charge. A resident-owned dwelling and all household expenses are outside this calculation.

## Current legal-minimum reference case

The public URL starts with a 35-year-old, 75 kg reference adult man. In a 12-household ordinary-site project it calculates:

| Item | Monthly amount |
|---|---:|
| Common-property land holding share | $0.00 lower bound |
| Productive land | 1.117863 ha x $197.04/ha/month | $220.26 |
| Total site lease | $220.26 |
| Legal-minimum shared infrastructure | $47.96 |
| **Land + shared infrastructure** | **$268.22** |

The public calculation and CLI now use the same explicit 75 kg `reference_adult_man` profile. The former 80 kg `adult_man` case remains available for representative household comparisons but is not the public starting case.

## Historical common-property land holding share

The former 1.5 ha `common_area_ha` was an unallocated common-property pool. It is now a historical sensitivity rather than the legal-minimum default. The model does not claim to know the separate areas of roads, access, residential/common footprints, ecological buffers or other common uses. The entire pool was recovered equally across households.

For 12 households at $35,000/ha, 6% interest, 30-year amortization and 20% down:

| Underlying cost | Allocation basis | Annual project recovery | Monthly household share |
|---|---|---:|---:|
| Common land debt service | common land value / financed project debt, equal household allocation | $3,021.72 | $20.98 |
| Common property tax | common land value x 1% | $525.00 | $3.65 |
| Land insurance | fixed land-layer input / households | $3,000.00 | $20.83 |
| Common-land operating costs | fixed land-layer input / households | $6,000.00 | $41.67 |
| Land-holding administration | fixed land-layer input / households | $18,000.00 | $125.00 |
| Fixed land reserve | explicit input | $0.00 | $0.00 |
| Common-property vacancy reserve | 5% of common-property pool before reserve / households | $1,527.34 | $10.61 |
| **Total common-property land holding share** |  | **$32,074.06** | **$222.74** |

No productive hectares, productive land value or shared-infrastructure capital is hidden in this share. The common pool is part of the whole property, while its debt, tax and fixed costs are separate from the productive-hectare pool.

## Productive land rate

The $206.89/ha/month rate is calculated from the productive land pool only:

| Component | Monthly per productive hectare |
|---|---:|
| Productive land debt service | $167.87 |
| Productive property tax | $29.17 |
| Productive vacancy reserve | $9.85 |
| **Productive land charge** | **$206.89/ha/month** |

The 20% down payment reduces financed principal and therefore debt service. It is recorded as initial project equity; the model does not recover that equity again through lease payments and does not assign it an opportunity-cost return.

## Financing evidence

The existing 6% / 30-year / 20% case is retained as an **illustrative financing scenario**. It is not a canonical expectation for an ARC land-holding entity.

- FCC says land loans typically need 25% down, land loans can reach up to 29 years, and most are in the 20-25-year range. FCC distinguishes a 5- or 10-year loan term from the longer amortization period.
- FCC's farmland-affordability analysis uses 25% down and 25-year amortization as an analytical convention, not a product guarantee.
- FCC's land/buildings product describes lender-selected rates, maturity dates, amortizations and repayment schedules for producers.
- AAFC's CALA program is eligibility-dependent. Its current guidance states a 15-year maximum repayment term for land purchases; longer amortization requires a balloon payment at year 15. The program is administered by participating lenders for eligible farmers and agricultural co-operatives.

The contract therefore exposes:

- illustrative current: 20% down, 6%, 30-year amortization, 5-year term;
- neutral land planning: 25% down, 6%, 25-year amortization, 5-year term;
- CALA-style comparison: 20% down, 6%, 15-year amortization, 15-year term, subject to eligibility.

Interest rates remain lender-quoted scenario inputs. No public lender quote was found for this specific ARC ownership, security and operating structure.

Sources:

- https://www.fcc-fac.ca/en/knowledge/borrowing-basics
- https://www.fcc-fac.ca/en/financing/agriculture/land-buildings
- https://www.fcc-fac.ca/en/knowledge/economics/deteriorating-farmland-affordability
- https://agriculture.canada.ca/en/programs/canadian-agricultural-loans-act/step-3-before-apply
