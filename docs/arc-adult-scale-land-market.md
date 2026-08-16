# ARC adult scale and parcel-size land economics

## Adult-scale architecture

`packages/carrying-capacity/src/arc-community-scale.mjs` is the canonical demonstration layer for settlement scale. It uses adult residents as the primary input and generates a resulting household/dwelling arrangement. The existing site-lease calculator still accepts `community.household_count` for compatibility; adult-scale scenarios add `adult_residents`, `dependent_children_capacity`, `scale_basis: adult_residents`, and explicit generated household rows rather than redefining household count.

The published demonstration sizes are 1, 4, 12, 16, 20, 28, 40 and 56 adults. One adult is a single-adult case. Larger even scenarios pair adults into family-capacity households using the existing `two_adults_plus_three_children` canonical profile. Three dependent children are a design/capacity stress test, not a demographic forecast.

## Common area

Adult-scale scenarios reuse the geometry-derived common-area prototype from commit `6c45993`: a configurable entrance laneway, terminal circulation loop and 250 m² central common envelope. The default is 50 m, 4 m travelled width plus 2 m shoulders/drainage, 449.397 m² loop circulation and 250 m² central envelope, or approximately 0.09994 ha. Productive shrubs, coppice, windbreaks and food-forest edges outside vehicle clearances remain in household leased productive allocations.

## Land-market evidence

The repository now contains `packages/carrying-capacity/data/source/arc-land-market-observations.json` and `src/land-market.mjs`. The first loaded observation is the 2024 Grey County average-quality cropland benchmark from the Ontario Farmland Value and Rental Value Survey: CAD 19,000 per tillable acre, 29 survey responses. It is converted for context only and is not treated as a whole-parcel sale or a size-band observation.

The Ontario farmland-value open-data catalogue and FCC farmland-values report are retained as source metadata. Statistics Canada farm-capital data are retained as context but explicitly include land and buildings/improvements. No current Grey County parcel-size-tagged bare-land transaction series is present yet.

Until observations are manually imported, the adult-scale table uses an explicit planning sensitivity curve anchored at the Grey County benchmark for the 5–10 ha band: `<2 ha` CAD 60,000/ha; `2–5 ha` CAD 50,000/ha; `5–10 ha` CAD 46,950/ha; `10–20 ha` CAD 42,000/ha; `20–40 ha` CAD 36,000/ha; `40+ ha` CAD 32,000/ha. These values are marked `working_planning_sensitivity`, not evidence-backed market prices. They are present to test scale effects without silently multiplying every scenario by CAD 35,000/ha.

Import lawful, manually verified observations with:

```sh
npm run import:arc:land-observations -- --input=/path/to/observations.csv
```

The importer preserves source IDs, dates, property type, parcel area, improvement status, access/servicing notes and evidence status. Farm-with-residence or outbuilding observations are excluded from the bare-land parcel curve unless improvements have been explicitly separated.

## Crossover limitation

The current dataset does not support a defensible minimum practical ARC scale or economic crossover. The published scale table shows the effect of the provisional sensitivity curve and fixed infrastructure sharing, while the evidence column makes the unresolved local market curve visible. A crossover claim should wait for size-tagged Grey County observations or a defensible licensed transaction dataset.

## Generated outputs

- `packages/carrying-capacity/outputs/arc-adult-scale.md`
- `packages/carrying-capacity/outputs/arc-adult-scale.csv`
- `packages/carrying-capacity/outputs/arc-adult-scale.json`
- `packages/carrying-capacity/outputs/arc-land-market.md`
- `packages/carrying-capacity/outputs/arc-land-market.json`

The same rows are published under `site_lease_economics.adult_scale` in the generated education presentation contract.
