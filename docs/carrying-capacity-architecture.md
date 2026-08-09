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

`src/regional.mjs` exposes `calculateRegionalCarryingCapacity`. It reports
household composition, favourable/ordinary/marginal site sensitivity, mature
labour, annual establishment bridge area, supported households/population and
optional productive surplus. Site shares are explicit scenario inputs because
the current Grey land layers do not constitute a validated biological
capability map.

## Report commands

```sh
npm run report:carrying-capacity
npm run report:grey:carrying-capacity
npm run report:grey:household-transition
```

The first command preserves the ARC standalone headline and canonical outputs
under `know/produce/`. The Grey commands aggregate the same canonical rows over
the existing Grey food-land and population/dwelling proxies; they do not create
a second set of ARC coefficients.
