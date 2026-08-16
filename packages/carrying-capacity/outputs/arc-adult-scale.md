# ARC adult-scale community scenarios

This is an adult-scale planning demonstration. Adult residents are the primary settlement variable; household and dwelling count is a resulting arrangement. Except for the 1-adult case, pairs of adults are stress-tested as households designed to support up to three dependent children. This is a capacity case, not a demographic forecast.

**Family-capacity standard:** Family-capacity planning case: 2 adults + 3 dependent children.

| Adult residents | Households / dwellings | Dependent-child capacity | Productive land | Common land | Total parcel | Land band | Observed / unresolved $/ha | n | Price status | Site lease / household | Shared infrastructure / household | Land + infrastructure / household | Dwelling finance / household | Illustrative total with dwelling |
|---:|---:|---:|---:|---:|---:|---|---:|---|---:|---:|---:|---:|---:|
| 1 | 1 | 0 | 1.12 ha | 0.10 ha | 1.22 ha | <2 ha | $337743.44/ha | 11 | measured_local_size_band | $2315.54 | $575.57 | $2891.11 | $353.72 | $3244.83 |
| 4 | 2 | 6 | 3.63 ha | 0.10 ha | 3.73 ha | 2–5 ha | $71487.91/ha | 6 | measured_local_size_band | $750.46 | $287.79 | $1038.25 | $353.72 | $1391.97 |
| 12 | 6 | 18 | 10.89 ha | 0.10 ha | 10.99 ha | 10–20 ha | $46950.02/ha | 5 | measured_local_size_band | $484.06 | $95.93 | $579.99 | $353.72 | $933.71 |
| 16 | 8 | 24 | 14.52 ha | 0.10 ha | 14.62 ha | 10–20 ha | $46950.02/ha | 5 | measured_local_size_band | $482.96 | $71.95 | $554.91 | $353.72 | $908.63 |
| 20 | 10 | 30 | 18.15 ha | 0.10 ha | 18.25 ha | 10–20 ha | $46950.02/ha | 5 | measured_local_size_band | $482.30 | $57.56 | $539.86 | $353.72 | $893.58 |
| 28 | 14 | 42 | 25.41 ha | 0.10 ha | 25.51 ha | 20–40 ha | $21288.13/ha | 4 | measured_local_size_band | $218.34 | $41.11 | $259.45 | $353.72 | $613.17 |
| 40 | 20 | 60 | 36.29 ha | 0.10 ha | 36.39 ha | 20–40 ha | $21288.13/ha | 4 | measured_local_size_band | $218.09 | $28.78 | $246.87 | $353.72 | $600.59 |
| 56 | 28 | 84 | 50.81 ha | 0.10 ha | 50.91 ha | 40+ ha | unresolved/ha | 2 | unresolved_insufficient_local_size_band_evidence | unresolved | $20.56 | unresolved | $353.72 | unresolved |

## Interpretation

- Productive hectares come from the canonical household carrying-capacity calculation, including the peak establishment reservation.
- Common land is the existing geometry-derived 50 m laneway / terminal loop / 250 m² central envelope prototype. Productive edge vegetation remains in household allocations.
- Shared infrastructure is the selected legal-minimum scenario and falls per household as fixed access capital is shared.
- The dwelling-financing column is shown separately for planning comparison; the ARC land-and-infrastructure charge is the site lease plus shared infrastructure only.

## Economic crossover diagnostic

The public table above remains limited to the eight demonstration sizes. The diagnostic separately evaluates 29 scales: 1 adult plus every even count from 2 through 56 adults.
**Market-band crossover:** The internal two-adult scan first enters the measured 20–40 ha band at 22 adults (20.06 ha), rather than at the first public demonstration row. The observed land-price change is -$25661.89/ha per hectare; the household charge changes by -$268.96/month.
The first evidence-backed size-band change overall is 4 adults (<2 ha → 2–5 ha). The farm-scale 20–40 ha transition is the relevant comparison for the ARC scale question.
**Economic sweet spot:** Within the measured 20–40 ha band, the first two-adult step with no more than 15% additional per-household savings is 22 to 24 adults: $4.45 per household, or 1.6%. This is a provisional economic sweet spot, not an optimization result.
The exact first parcel above 20 ha is 22 adults / 11 households at 20.06 ha. The 20–40 ha band currently has four usable observations and the 40+ ha band remains unresolved, so both conclusions are provisional.

| Adult count | Households | Parcel | Previous land band | New land band | $/ha change | Household monthly change |
|---:|---:|---:|---|---|---:|---:|
| 4 | 2 | 3.73 ha | <2 ha | 2–5 ha | -$266255.53 | -$3177.88 |
| 6 | 3 | 5.54 ha | 2–5 ha | 5–10 ha | unresolved | unresolved |
| 12 | 6 | 10.99 ha | 5–10 ha | 10–20 ha | unresolved | unresolved |
| 22 | 11 | 20.06 ha | 10–20 ha | 20–40 ha | -$25661.89 | -$268.96 |
| 44 | 22 | 40.02 ha | 20–40 ha | 40+ ha | unresolved | unresolved |

The complete internal scan is retained in `arc-adult-scale.json` under `economic_crossover.internal_scan`; it is a diagnostic contract, not an expansion of the public demonstration table.

## Land-market evidence status

The 2024 Ontario Farmland Value and Rental Value Survey reports a Grey County median of CAD 19,000 per tillable acre from 29 responses. That is retained as a productive-land comparator, not as a parcel-size observation. The loaded whole-property observation set contains 30 usable observations; asking prices, property-type mix and site constraints remain important limitations.

| Parcel band | Size-tagged observations | Median used CAD/ha | Descriptive median CAD/ha | Planning fallback CAD/ha |
|---|---:|---:|---:|
| <2 ha | 11 | $337743.44 | $337743.44 | $60000.00 |
| 2–5 ha | 6 | $71487.91 | $71487.91 | $50000.00 |
| 5–10 ha | 2 | unresolved | $52696.59 | $46950.00 |
| 10–20 ha | 5 | $46950.02 | $46950.02 | $42000.00 |
| 20–40 ha | 4 | $21288.13 | $21288.13 | $36000.00 |
| 40+ ha | 2 | unresolved | $18107.88 | $32000.00 |

The model selects the parcel band from total calculated parcel area. Bands below 3 observations remain unresolved rather than being filled from the planning sensitivity curve. Import observations with `npm run import:arc:land-observations -- --input=...`.
The current economic-crossover status is **provisional_20_to_40_market_crossover_40_plus_unresolved**. The market-band crossover occurs at 22 adults in the internal scan. The provisional economic sweet spot begins at 22 adults because the next two-adult step saves only 1.6%. The 20–40 ha band has 4 observations and the 40+ ha band remains unresolved.

## Sources

- [Ontario Farmland Value and Rental Value Survey: 2024 Farmland Value Rental Value Survey](https://www.onfarmlandsurvey.com/_files/ugd/25f478_d4037c4c1a514db29440ad1d0cfb5c73.pdf) — survey_benchmark; Reports tillable-acre values and response counts, not whole-parcel size-tagged transactions or bare-land sale records.
- [Royal LePage RCR Realty / public brokerage listing pages: Grey County vacant-land and farm listing observations](https://www.royallepage.ca/en/on/west-grey/land/properties/) — public_listing_observations; Asking prices are not completed sale prices; listing descriptions and acreage should be independently verified before acquisition decisions.
- [Sutton-Sound Realty: Grey County vacant-land listing observations](https://www.suttonsoundrealty.ca/office-listings?p=6) — public_listing_observations; Asking prices and listing status can change; observations are preserved with the source URL and retrieval date.
- [Public brokerage-fed listing pages: REW, Zolo, Squareyards, One Percent Realty, Krib and comparable public listing pages](https://www.rew.ca/properties/areas/west-grey-on/type/land-lot) — public_listing_observations; Secondary listing displays may lag source brokerage records and are used as documented observations, not as a substitute for verified sale data.
- [Ontario Ministry of Agriculture, Food and Agribusiness: Estimated value and rental rate of farmland by county and township](https://data.ontario.ca/en/dataset/estimated-value-and-rental-rate-of-farmland-by-county-and-township) — official_context_dataset; Farm land/building value context is not a parcel-size curve and does not isolate ARC-suitable bare land.
- [Farm Credit Canada: FCC Farmland Values Report](https://www.fcc-fac.ca/en/knowledge/economics/farmland-values-report) — authoritative_comparator; Regional cultivated-land value trends are not Grey County parcel-size observations and detailed historical data require FCC Online Services access.
- [Statistics Canada: Farm capital, Census of Agriculture, 2021, Table 32-10-0237-01](https://www150.statcan.gc.ca/n1/en/catalogue/3210023701) — official_context_dataset; Value of land and buildings includes improvements and is not a bare-land parcel-price series.
