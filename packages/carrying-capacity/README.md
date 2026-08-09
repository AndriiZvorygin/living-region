# ARC evidence-based carrying-capacity model

This directory is the history-preserving migration of the standalone ARC
repository into Living Region. It is a first-class workspace package named
`@living-region/carrying-capacity`; its source evidence, derived tables,
reports, scripts and Node test history remain together under this prefix.

From the Living Region root, use `npm run report:carrying-capacity` or
`npm run test:carrying-capacity`. The programmatic boundary is
`src/index.mjs`, with the regional aggregation in `src/regional.mjs`.

This repository is an independent, reproducible Phase 2 model for Affordable Rural Communities. The current canonical model is evidence-based and deliberately does not defend a predetermined 1 ha/adult value. Historical Lyis spreadsheets, diagrams and calculations are preserved as provenance only under `data/source/`, `data/derived/legacy/` and `outputs/legacy/`.

The original files under `/home/htaf/lyis/` are read-only inputs and were not modified.

## Run

Requirements: Node.js 20+ and `unzip`.

```sh
npm run all
```

This extracts the original ODS files, builds the current evidence-based model and runs the test suite. The current build includes Health Canada EER scenarios, Ontario crop benchmarks and low-input syntheses, Canadian food composition, audited yurt heating, evidence-based woody-energy bands, household capacity, site sensitivity, deliberate surplus, a time-dependent annual-to-perennial food-forest transition model and a separate configurable economics module.

Useful commands:

```sh
npm run extract
npm run build:evidence
npm test
```

## Current handoff files

- [`outputs/evidence-based-headline-results.md`](outputs/evidence-based-headline-results.md)
- [`outputs/recommended-land-guideline.md`](outputs/recommended-land-guideline.md)
- [`outputs/summary.json`](outputs/summary.json), where `canonical` means the current evidence-based model and `historical` means provenance only
- [`outputs/low-input-food-yields.md`](outputs/low-input-food-yields.md)
- [`outputs/low-input-woody-yields.md`](outputs/low-input-woody-yields.md)
- [`outputs/heating-budget.md`](outputs/heating-budget.md)
- [`outputs/household-capacity.md`](outputs/household-capacity.md)
- [`outputs/site-sensitivity.md`](outputs/site-sensitivity.md)
- [`outputs/surplus-production.md`](outputs/surplus-production.md)
- [`outputs/food-forest-transition.md`](outputs/food-forest-transition.md)
- [`outputs/annual-establishment-food.md`](outputs/annual-establishment-food.md)
- [`outputs/mature-food-forest-capacity.md`](outputs/mature-food-forest-capacity.md)
- [`outputs/household-transition-scenarios.md`](outputs/household-transition-scenarios.md)
- [`outputs/perennial-yield-evidence.md`](outputs/perennial-yield-evidence.md)
- [`outputs/perennial-protein-staples.md`](outputs/perennial-protein-staples.md)
- [`outputs/protein-audit.md`](outputs/protein-audit.md)
- [`outputs/mature-food-system-canonical.md`](outputs/mature-food-system-canonical.md)
- [`outputs/land-accounting-audit.md`](outputs/land-accounting-audit.md)
- [`outputs/mature-labour-audit.md`](outputs/mature-labour-audit.md)
- [`outputs/ageing-in-place-labour.md`](outputs/ageing-in-place-labour.md)
- [`outputs/livestock-scenarios.md`](outputs/livestock-scenarios.md)
- [`docs/source-audit.md`](docs/source-audit.md)
- [`docs/evidence-methodology.md`](docs/evidence-methodology.md)

## Evidence-based recommendation

The model currently recommends a household/site-adjusted performance test. Adult-equivalent is a food-energy normalization only. The current planning examples are **1 ha for a one-adult household** and **2 ha for a two-adult household**, then checked against the mature household/site table. Marginal sites require more; favourable sites can retain exportable surplus.

The current ageing-in-place plants-only trade-off selects a 70% perennial-calorie mature scenario, while retaining annual production for resilience, beans, vegetables, markets and rotation. After removing double-counted ecological allowances, the ordinary-site robust household minimum is about 0.83 ha for one adult, 1.31 ha for two adults, 2.06 ha for two adults plus two children, and 2.39 ha for two adults plus three children. Optional market land is reported separately; the full site/household table is the recommendation, not a linear adult-equivalent rule.

That range is a model recommendation, not a measured provincial average. The largest unresolved inputs are measured low-input Grey-Bruce crop yields, nutritional completeness, current climate normals, yurt leakage and thermal bridges, mixed-woody yield, wildlife loss, labour and local sale margins.

The historical values—13.05 MJ/day for a 75 kg adult, 0.25 + 0.25 + 0.50 ha, 30 GJ/ha/year coppice, and the historical 1.0/1.2 ha policy shorthand—are not canonical inputs. They are documented in the historical source audit and excluded from the Phase 2 calculations.
