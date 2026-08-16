# ARC adult-scale community scenarios

This is an adult-scale planning demonstration. Adult residents are the primary settlement variable; household and dwelling count is a resulting arrangement. Except for the 1-adult case, pairs of adults are stress-tested as households designed to support up to three dependent children. This is a capacity case, not a demographic forecast.

**Family-capacity standard:** Family-capacity planning case: 2 adults + 3 dependent children.

| Adult residents | Households / dwellings | Dependent-child capacity | Productive land | Common land | Total parcel | Land band | Land price assumption | Price status | Site lease / household | Shared infrastructure / household | Land + infrastructure / household | Dwelling finance / household | Illustrative total with dwelling |
|---:|---:|---:|---:|---:|---:|---|---:|---|---:|---:|---:|---:|---:|
| 1 | 1 | 0 | 1.12 ha | 0.10 ha | 1.22 ha | <2 ha | $60000.00/ha | working_planning_sensitivity | $411.35 | $575.57 | $986.92 | $353.72 | $1340.64 |
| 4 | 2 | 6 | 3.63 ha | 0.10 ha | 3.73 ha | 2–5 ha | $50000.00/ha | working_planning_sensitivity | $524.89 | $287.79 | $812.68 | $353.72 | $1166.40 |
| 12 | 6 | 18 | 10.89 ha | 0.10 ha | 10.99 ha | 10–20 ha | $42000.00/ha | working_planning_sensitivity | $433.03 | $95.93 | $528.96 | $353.72 | $882.68 |
| 16 | 8 | 24 | 14.52 ha | 0.10 ha | 14.62 ha | 10–20 ha | $42000.00/ha | working_planning_sensitivity | $432.04 | $71.95 | $503.99 | $353.72 | $857.71 |
| 20 | 10 | 30 | 18.15 ha | 0.10 ha | 18.25 ha | 10–20 ha | $42000.00/ha | working_planning_sensitivity | $431.45 | $57.56 | $489.01 | $353.72 | $842.73 |
| 28 | 14 | 42 | 25.41 ha | 0.10 ha | 25.51 ha | 20–40 ha | $36000.00/ha | working_planning_sensitivity | $369.24 | $41.11 | $410.35 | $353.72 | $764.07 |
| 40 | 20 | 60 | 36.29 ha | 0.10 ha | 36.39 ha | 20–40 ha | $36000.00/ha | working_planning_sensitivity | $368.80 | $28.78 | $397.58 | $353.72 | $751.30 |
| 56 | 28 | 84 | 50.81 ha | 0.10 ha | 50.91 ha | 40+ ha | $32000.00/ha | working_planning_sensitivity | $327.57 | $20.56 | $348.13 | $353.72 | $701.85 |

## Interpretation

- Productive hectares come from the canonical household carrying-capacity calculation, including the peak establishment reservation.
- Common land is the existing geometry-derived 50 m laneway / terminal loop / 250 m² central envelope prototype. Productive edge vegetation remains in household allocations.
- Shared infrastructure is the selected legal-minimum scenario and falls per household as fixed access capital is shared.
- The dwelling-financing column is shown separately for planning comparison; the ARC land-and-infrastructure charge is the site lease plus shared infrastructure only.

## Land-market evidence status

The 2024 Ontario Farmland Value and Rental Value Survey reports a Grey County median of CAD 19,000 per tillable acre from 29 responses. That is retained as a county cropland benchmark, not as a parcel-size observation. No size-tagged Grey County bare-land transaction series is currently loaded. The size bands below are therefore an explicit planning sensitivity anchored at that benchmark, not measured market prices.

| Parcel band | Size-tagged observations | Median CAD/ha | Planning fallback CAD/ha |
|---|---:|---:|---:|
| <2 ha | 0 | unresolved | $60000.00 |
| 2–5 ha | 0 | unresolved | $50000.00 |
| 5–10 ha | 0 | unresolved | $46950.00 |
| 10–20 ha | 0 | unresolved | $42000.00 |
| 20–40 ha | 0 | unresolved | $36000.00 |
| 40+ ha | 0 | unresolved | $32000.00 |

The model selects the parcel band from total calculated parcel area. The current planning sensitivity indicates a possible scale effect, but a defensible economic crossover requires manually verified whole-parcel observations with improvements separated from land value. Import observations with `npm run import:arc:land-observations -- --input=...`.
The current economic-crossover status is **unresolved_insufficient_size_tagged_local_market_evidence**. Under the provisional sensitivity only, the lowest displayed land-plus-infrastructure charge is at 56 adults ($348.13/household/month); this is not a market conclusion.

## Sources

- [Ontario Farmland Value and Rental Value Survey: 2024 Farmland Value Rental Value Survey](https://www.onfarmlandsurvey.com/_files/ugd/25f478_d4037c4c1a514db29440ad1d0cfb5c73.pdf) — survey_benchmark; Reports tillable-acre values and response counts, not whole-parcel size-tagged transactions or bare-land sale records.
- [Ontario Ministry of Agriculture, Food and Agribusiness: Estimated value and rental rate of farmland by county and township](https://data.ontario.ca/en/dataset/estimated-value-and-rental-rate-of-farmland-by-county-and-township) — official_context_dataset; Farm land/building value context is not a parcel-size curve and does not isolate ARC-suitable bare land.
- [Farm Credit Canada: FCC Farmland Values Report](https://www.fcc-fac.ca/en/knowledge/economics/farmland-values-report) — authoritative_comparator; Regional cultivated-land value trends are not Grey County parcel-size observations and detailed historical data require FCC Online Services access.
- [Statistics Canada: Farm capital, Census of Agriculture, 2021, Table 32-10-0237-01](https://www150.statcan.gc.ca/n1/en/catalogue/3210023701) — official_context_dataset; Value of land and buildings includes improvements and is not a bare-land parcel-price series.
