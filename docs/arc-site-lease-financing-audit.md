# ARC site-lease decomposition and land-financing audit

## Scope

This audit covers the public ARC site lease and shared-infrastructure charge. A resident-owned dwelling and all household expenses are outside this calculation.

## Current reference case

The public URL starts with a 35-year-old, 75 kg reference adult man. In a 12-household ordinary-site project it calculates:

| Item | Monthly amount |
|---|---:|
| Common-property land holding share | $222.74 |
| Productive land | 1.117863 ha x $206.89/ha/month | $231.28 |
| Total site lease | $454.01 |
| Minimal shared infrastructure | $228.18 |
| **Land + shared infrastructure** | **$682.19** |

The generated CLI/report reference profile uses the canonical `adult_man` profile, which is 80 kg and requires 1.135199 ha. Its result is $234.86 productive land, $457.60 site lease and $685.78 combined. The $3.59 difference is therefore a profile/input difference, not a stale hardcoded total or rounding change.

## Common-property land holding share

The current 1.5 ha `common_area_ha` is one unallocated common-property pool. The model does not claim to know the separate areas of roads, access, residential/common footprints, ecological buffers or other common uses. The entire pool is recovered equally across households.

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
