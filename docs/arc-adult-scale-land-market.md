# ARC adult scale and parcel-size land economics

## Adult-scale architecture

`packages/carrying-capacity/src/arc-community-scale.mjs` is the canonical demonstration layer for settlement scale. It uses adult residents as the primary input and generates a resulting household/dwelling arrangement. The existing site-lease calculator still accepts `community.household_count` for compatibility; adult-scale scenarios add `adult_residents`, `dependent_children_capacity`, `scale_basis: adult_residents`, and explicit generated household rows rather than redefining household count.

The published demonstration sizes are 1, 4, 12, 16, 20, 28, 40 and 56 adults. One adult is a single-adult case. Larger even scenarios pair adults into family-capacity households using the existing `two_adults_plus_three_children` canonical profile. Three dependent children are a design/capacity stress test, not a demographic forecast.

## Common area

Adult-scale scenarios reuse the geometry-derived common-area prototype from commit `6c45993`: a configurable entrance laneway, terminal circulation loop and 250 m² central common envelope. The default is 50 m, 4 m travelled width plus 2 m shoulders/drainage, 449.397 m² loop circulation and 250 m² central envelope, or approximately 0.09994 ha. Productive shrubs, coppice, windbreaks and food-forest edges outside vehicle clearances remain in household leased productive allocations.

## Land-market evidence

The repository contains `packages/carrying-capacity/data/source/arc-land-market-observations.json` and `src/land-market.mjs`. The 2024 Grey County average-quality cropland benchmark from the Ontario Farmland Value and Rental Value Survey remains separate: CAD 19,000 per tillable acre from 29 responses. It is a productive-land comparator, not a whole-parcel sale or a size-band observation.

The Ontario farmland-value open-data catalogue and FCC farmland-values report are retained as source metadata. Statistics Canada farm-capital data are retained as context but explicitly include land and buildings/improvements. The local observation file now contains 39 manually transcribed public listing observations, including 30 usable whole-property observations after excluding improved, unverified and strategic-premium records.

The evidence is uneven by parcel-size band. The current usable whole-property counts are: `<2 ha`: 11; `2–5 ha`: 6; `5–10 ha`: 2; `10–20 ha`: 5; `20–40 ha`: 4; `40+ ha`: 2. The package requires three observations before using a band median for adult-scale economics. Consequently the `<2 ha`, `2–5 ha`, `10–20 ha` and `20–40 ha` bands are currently usable, while `5–10 ha` and `40+ ha` remain unresolved. Their descriptive medians remain visible for review, but the old planning curve is not silently substituted into a result.

The usable whole-property descriptive medians are approximately: `<2 ha` CAD 337,743/ha; `2–5 ha` CAD 71,488/ha; `5–10 ha` CAD 52,697/ha (sparse); `10–20 ha` CAD 46,950/ha; `20–40 ha` CAD 21,288/ha; `40+ ha` CAD 18,108/ha (sparse). These are mixed asking-price observations across rural-residential lots, woodland, agricultural land, wetland and access conditions, not a controlled hedonic price curve.

The 5–10 ha and 40+ ha planning values remain available only as explicit fallback sensitivity inputs for experiments. They are not used by the adult-scale contract while those bands are below the minimum sample threshold.

Import lawful, manually verified observations with:

```sh
npm run import:arc:land-observations -- --input=/path/to/observations.csv
```

The importer preserves source IDs, dates, property type, parcel area, improvement status, access/servicing notes and evidence status. Farm-with-residence or outbuilding observations are excluded from the bare-land parcel curve unless improvements have been explicitly separated.

## Evidence-supported scale signal

The first adult-scale demonstration that falls in a measured farm-scale band is 28 adults, requiring approximately 25.51 ha in the current family-capacity planning case. The 28-adult and 40-adult scenarios share the measured 20–40 ha band; moving from 28 to 40 adults reduces the combined land-plus-infrastructure charge by about 4.8%. The model therefore reports 28 adults as a provisional farm-scale entry / diminishing-savings point. The 40+ ha band is still sparse, so the result does not establish the global minimum or what happens at 56 adults. A completed crossover analysis needs more observations, especially large ordinary agricultural parcels and completed sale prices.

The adult-scale rows currently calculate as follows when a band is sufficiently observed: 1 adult uses `<2 ha`; 4 adults uses `2–5 ha`; 12, 16 and 20 adults use `10–20 ha`; 28 and 40 adults use `20–40 ha`; 56 adults is unresolved because its calculated parcel falls in the sparse `40+ ha` band. The shared-infrastructure and dwelling columns remain separate; the evidence-driven land result changes the site lease only.

## Data limitations

Most observations are active or recent asking prices rather than verified sale prices. A few records come from public brokerage indexes and have lower confidence or approximate areas. Vacant lots under 5 ha carry a likely residential/buildability premium and should not be compared directly to productive farmland. Large parcels include woodland, wetlands, conservation constraints and recreational premiums. Productive/tillable hectares are recorded where listing text provides them, but the current sample is not sufficient to derive a second productive-land curve. The Ontario 2024 survey benchmark is therefore retained as the best current productive-land comparator, not applied to whole ARC parcels.

## Generated outputs

- `packages/carrying-capacity/outputs/arc-adult-scale.md`
- `packages/carrying-capacity/outputs/arc-adult-scale.csv`
- `packages/carrying-capacity/outputs/arc-adult-scale.json`
- `packages/carrying-capacity/outputs/arc-land-market.md`
- `packages/carrying-capacity/outputs/arc-land-market.json`

The same rows are published under `site_lease_economics.adult_scale` in the generated education presentation contract.
