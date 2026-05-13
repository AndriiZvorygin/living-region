# Report Map and Output Categories

Living Region outputs must be interpreted by category:

- `measured`: directly measured/observed data series
- `proxy`: modelled proxy from partial data
- `scenario_assumption`: explicit assumption input
- `scenario_output`: output derived from assumptions + model logic

## Public-claim suitable (with caveats)

- `grey-food-insecurity-trend-projection.json`
  - regression-based no-new-shock trend baseline
- `grey-hormuz-food-security-article-data.json`
  - article-facing data blocks with separated pressure vs production metrics

## Exploratory/diagnostic

- `grey-current-system-shock-threshold.json`
- `grey-food-supply-demand-price.json`
- `grey-food-gap-replacement.json`
- `grey-transition-pathways.json`

These should be treated as scenario diagnostics, not forecasts.

## Reliability contract

- `know/source-manifest.json`: locked source files + hashes
- `know/input/scenarios/*.json`: editable assumptions with `not_forecast: true`
- `know/metric-registry.json`: public headline metric uncertainty/provenance contract
- `output/qa/rebuild-summary.json`: machine-readable QA status

## Rule set

- No number without provenance.
- No scenario without explicit assumptions.
- No public metric without uncertainty metadata.
- No report release without QA summary.
