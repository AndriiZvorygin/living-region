# Carrying-capacity architecture

## Migration mapping

The standalone ARC repository was migrated with a non-squashed Git subtree.
The original ARC commits remain ancestors of the Living Region migration
commit. The path mapping is:

| ARC path | Living Region path | Ownership |
|---|---|---|
| `data/source/` | `packages/carrying-capacity/data/source/` | ARC evidence inputs and provenance |
| `data/derived/` | `packages/carrying-capacity/data/derived/` | reproducible derived evidence tables |
| `scripts/` | `packages/carrying-capacity/scripts/` | canonical calculations and builders |
| `outputs/` | `packages/carrying-capacity/outputs/` | standalone canonical reports |
| `test/calculations.test.mjs` | `packages/carrying-capacity/test/calculations.test.mjs` | preserved ARC suite |
| new Living Region API | `packages/carrying-capacity/src/index.mjs` | stable programmatic calculation boundary |
| new regional adapter | `packages/carrying-capacity/src/regional.mjs` | aggregates canonical rows over regional land/population inputs |

The only required runtime-path change was replacing ARC's absolute root path in
`scripts/model-utils.mjs` with a path derived from the workspace package. This
keeps the standalone scripts reproducible without depending on the old checkout.

## Programmatic interfaces

`src/index.mjs` exposes:

- `calculateHealthCanadaHouseholdFoodEnergyDemand`
- `calculateAnnualFoodBridge`
- `calculateAnnualToPerennialSuccession`
- `calculateMatureFoodSystemLandRequirement`
- `calculateDwellingHeatingDemand`
- `calculateWoodyBiomassLandRequirement`
- `calculateSiteSensitivity`
- `calculateLabourRequirements`
- `calculateMultifunctionalLandAccounting`
- `calculateRobustMinimumVsOptionalProductiveSurplus`
- `calculateArcSiteLeaseEconomics`

The ARC site-lease layer in `src/site-lease.mjs` is the monetary/project
boundary above the physical household model. It takes calculated
establishment and mature productive hectares plus building heat loads as
inputs; it never replaces them with a per-adult hectare coefficient. It keeps
resident-owned dwelling finance, project land recovery, household site lease
and shared infrastructure/service charge separate. The generated education
contract includes `site_lease_economics` as a stable future-facing data
contract; the browser does not duplicate the financial formulas.

`src/regional.mjs` exposes `calculateRegionalCarryingCapacity`. It reports
household composition, favourable/ordinary/marginal site sensitivity, mature
labour, annual establishment bridge area, supported households/population and
optional productive surplus. Site shares are explicit scenario inputs because
the current Grey land layers do not constitute a validated biological
capability map.

### Household land roles and establishment

`src/household-demand.mjs` separates pooled household food demand into
`permanent_adult` and `dependent_child` roles. Adults size the permanent
perennial footprint. Dependent children contribute to current food demand and
therefore to the annual bridge while they remain dependent, but they do not
receive child-specific perennial acreage. Annual and perennial food are pooled
and available to everyone in the household. At the adult transition age, the
former child leaves the parental parcel calculation and receives a separate
future allocation.

The establishment solver plants the adult-sized perennial footprint from Year
1, evaluates its maturity curve, supplies residual pooled household food with
annual production, and takes the maximum exclusive footprint across the
transition years. Year 1 is the starting establishment season; at later
numeric checkpoints age advances by `year - 1`. ARC's one-hectare-per-adult
allocation is compared after this biological calculation and never constrains
it.

## Report commands

```sh
npm run report:carrying-capacity
npm run report:grey:carrying-capacity
npm run report:grey:household-transition
npm run report:arc:site-lease
npm run report:arc:site-lease:sensitivity
npm run report:carrying-capacity:livestock
```

The first command preserves the ARC standalone headline and canonical outputs
under `know/produce/`. The Grey commands aggregate the same canonical rows over
the existing Grey food-land and population/dwelling proxies; they do not create
a second set of ARC coefficients.

## Nutrient and livestock extension

`src/protein.mjs` adds the Health Canada protein DRI as a constraint separate
from the EER energy calculation. `src/livestock.mjs` then compares plants-only
and optional rabbit, chicken, goose and goat systems through explicit feed
streams. Feed is partitioned into human-edible and human-inedible fractions,
and mixed systems consume a shared finite property-feed pool rather than
reusing the same residue or browse stream for every species.

The livestock coefficients and feed shares are bounded planning syntheses from
government and extension evidence. They report edible output, winter storage,
purchased supplementation, housing and labour, but do not claim Grey-Bruce
household trial performance. Plants-only remains a first-class baseline. The
generated comparison for the ordinary two-adult/three-child family-capacity
case is written to
`packages/carrying-capacity/outputs/livestock-nutrient-comparison.md`.
