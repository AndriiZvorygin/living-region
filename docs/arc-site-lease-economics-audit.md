# ARC site-lease economics audit

> **Historical audit note:** this document records the original broader site-lease/infrastructure model and its legacy comparison cases. The current canonical affordability baseline is `legal_minimum`, documented in `docs/arc-site-lease-accounting.md` and `packages/carrying-capacity/outputs/arc-legal-minimum.md`. The legal-minimum public scope excludes the private dwelling and household expenses, excludes discretionary paid administration/vacancy/insurance/reserves, separates resident labour and future replacement liability, and uses a zero common-area lower bound until a parcel/site-plan takeoff is available.

Audit date: 2026-08-14. This audit covers the Living Region checkout only. HelpOS
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

## Infrastructure audit and scenario boundary

The infrastructure model now preserves four explicit configurations:

| Scenario | Intended use | Default reserve mode | Centralized scope |
|---|---|---|---|
| `legal_minimum` | Current canonical affordability case | No recurring replacement reserve; future liability shown separately | Basic access placeholder, resident-maintained passability/snow/waste; distributed servicing remains site-specific |
| `minimal_compliant` | Optional resilient comparison | 0.5% early-life reserve, 1.0% full-lifecycle sensitivity | Basic access, snow/road maintenance, waste/compost and infrastructure insurance |
| `shared_services` | Shared-service sensitivity | 0.5% early-life reserve, 1.0% full-lifecycle sensitivity | Adds water, wastewater, electrical distribution, laundry and selected shared facilities |
| `amenity_rich` | Optional amenity sensitivity | 1.0% full-lifecycle reserve | Larger common building, laundry, equipment and expanded central systems |
| `legacy_current` | Reproduction/audit only | 1.0% full-lifecycle reserve | Former aggregate configuration that produced the approximately `$1,162/month` 12-household charge |

Each infrastructure component is exposed with capital cost, debt service term,
annual operating cost, maintenance, replacement reserve, requiredness and
source status. Debt service repays financed capital; a replacement reserve is a
separate fund for future renewal. The early-life reserve is a sensitivity, not a
claim that replacement liability disappears.

The former `$1,162.31/month` charge is reproduced by `$1,055,000` of capital,
`$75,000/year` operations, `$21,100/year` maintenance and
`$10,550/year` reserve, for `$167,372.40/year / 12 / 12`. The legacy baseline
also contains infrastructure administration and land-holding administration as
separate `$18,000/year` allowances. That is the main identified overlap risk;
recommended scenarios keep administration in the land layer and do not charge
it again in shared services.

Water, wastewater and electricity have distributed alternatives in the API.
Those placeholders are shown for lifecycle comparison only and are not silently
added to the central service charge or the existing household utility allowance.
Legal servicing, hydrogeology, road/fire standards, insurance, tax treatment,
actual replacement schedules and procurement quotes remain site-specific.

The generated detail report is:

`packages/carrying-capacity/outputs/arc-infrastructure-audit.md`

and can be regenerated with:

```bash
npm run report:arc:infrastructure-audit
```
