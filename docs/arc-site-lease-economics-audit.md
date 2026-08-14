# ARC site-lease economics audit

Audit date: 2026-08-13. This audit covers the Living Region checkout only. HelpOS
was not inspected or modified for this milestone.

## Existing components reused

| Component | Existing location | Reuse in site-lease model | Boundary / caveat |
|---|---|---|---|
| Household food-energy demand | `packages/carrying-capacity/src/health-canada.mjs`, `src/household-demand.mjs` | `calculateInteractiveHousehold()` receives the household member list and produces pooled food demand | Health Canada equations are biological demand, not an affordability assumption |
| Site quality and crop viability | `src/environment.mjs`, `src/core.mjs` | The selected site class determines viable annual/perennial systems and yield multipliers | Current Grey/Owen Sound site classes remain scenario capability bands, not parcel-level soil mapping |
| Establishment and mature productive hectares | `src/establishment.mjs`, `src/core.mjs` | The site allocation uses the canonical establishment peak exclusive footprint; mature hectares remain separately reported | The project must reserve the peak footprint for a new bare-land system |
| Building geometry and heating | `src/core.mjs`, `data/derived/evidence-woody-yields.json` | Every household building is passed through `calculateHeatingLoads()`; woody hectares come from the selected site band | Heater, envelope and woody-yield assumptions remain the canonical physical scenarios |
| Dwelling benchmark geometry | `defaultBuilding()` and `buildingArchetypes` in `src/core.mjs` | Default ARC yurt / building list is reused | No checked-in current ARC construction-cost quote was found; capital cost is an explicit replaceable monetary scenario input |
| Multifunctional land accounting | `calculateExclusiveLandAllocation()` and establishment rows | Productive food, heating and exclusive reserve hectares remain physical outputs and are not priced as a generic per-adult coefficient | Common land, roads and shared service areas are separate project inputs |
| Dwelling financing | No existing canonical housing-finance calculator found | New transparent annuity helper in `src/site-lease.mjs` | Called dwelling financing, not conventional mortgage eligibility |
| Land value / land finance | No existing parcel-value or land-finance calculator found | New project-level land value and debt-service scenario | Land price is not presented as observed current market evidence |
| Property tax | No parcel assessment/tax-roll input found | Explicit annual tax-rate scenario applied to project land value | Replace with actual assessment and municipal tax treatment for a real site |
| Roads/access, water/sewage, common building | Existing generic infrastructure records describe simulation maintenance, not an ARC site bill of quantities | New selectable capital components and annual operating inputs | Values are clearly marked planning assumptions pending site design and quotes |
| Maintenance and replacement | Generic world infrastructure has maintenance fields; no ARC shared-site cost model existed | New shared-infrastructure maintenance and replacement reserve rates; dwelling replacement allowance | Rates are scenario inputs, not measured local costs |
| Administration and vacancy reserve | No existing ARC land-holding administration model found | Explicit site-lease administration and vacancy-reserve pools | Kept separate from shared infrastructure administration |
| Project financing | No existing ARC project-finance API found | Separate land and infrastructure ownership/financing modes, down payment, rate and amortization | Legal lease term is kept separate from debt amortization and replacement horizon |

## New canonical boundary

`packages/carrying-capacity/src/site-lease.mjs` exposes
`calculateArcSiteLeaseEconomics()`. It consumes canonical carrying-capacity
results for each household and adds only the project-finance and cost-recovery
layer. `src/index.mjs` exports the API, while the generated education contract
exposes a future-facing summary without duplicating formulas in the browser.

The resident cost identity is:

```text
dwelling financing
+ dwelling maintenance/replacement allowance
+ household utilities allowance
+ household site lease
+ shared infrastructure/service charge
= total recurring resident cost
```

The central site-lease allocation is **base plus hectare**:

- land finance recovery and property tax follow each household's calculated
  establishment productive hectares;
- land insurance, common-land costs and land-holding administration are divided
  equally;
- the vacancy reserve follows each household's pre-reserve allocation.

The API also emits proportional-hectare and equal-shared/property-tax
alternatives. These are sensitivity cases, not hidden changes to the central
method.

## Monetary evidence status

The repository did not contain a current Grey County rural land-sale series,
parcel assessment/tax roll, ARC dwelling construction quote, or ARC servicing
bill of quantities. The default land value uses the existing task-specified
working range (`30,000–40,000 CAD/ha`) with `35,000 CAD/ha` as a midpoint
scenario. The reports show sensitivity at several land prices and label this
as a working assumption. The default dwelling cost and infrastructure values
are likewise explicit planning inputs and are not the obsolete HelpOS combined
figures.

## Accounting rules

- Resident dwelling capital is never included in project land principal.
- The entire ARC property remains one project parcel; household productive
  hectares are allocations used for physical planning and lease allocation,
  not individually purchased lots.
- Capital debt service, operating expenses and reserves are reported as
  separate categories.
- A 49-year legal lease term does not force land debt to amortize over 49
  years. Land debt, infrastructure debt and replacement reserves have their
  own explicit horizons.
- Project break-even compares site-lease plus shared-service revenue with
  project land and shared-infrastructure costs. Resident dwelling finance is
  outside project revenue.
