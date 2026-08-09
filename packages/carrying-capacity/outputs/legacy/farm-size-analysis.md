# Historical/reference only

# Farm-size/productivity analysis

## Reconstruction

`Farm_size_to_yield.ods` contains ten size classes labelled `<= 1` through `<= 1000` and an `all size` aggregate. The sheet records the share of land, share of crop land and share of food crop land, then calculates two ratios. The formula in the source is `[.C2]/[.B2]` for crop output relative to land and `[.D2]/[.B2]` for food-crop output relative to land, copied down each row. The embedded chart source is [Our World in Data's farm-size page](https://ourworldindata.org/farm-size).

| Size class | Land share | Crop share | Food-crop share | Crop/land | Food-crop/land |
|---|---:|---:|---:|---:|---:|
| <= 1 | 12% | 12% | 15% | 1 | 1.25 |
| <= 2 | 24% | 29% | 32% | 1.21 | 1.33 |
| <= 5 | 32% | 41% | 46% | 1.28 | 1.44 |
| <= 10 | 40% | 51% | 55% | 1.28 | 1.38 |
| <= 20 | 49% | 54% | 59% | 1.10 | 1.20 |
| <= 50 | 57% | 59% | 63% | 1.04 | 1.11 |
| <= 100 | 65% | 65% | 69% | 1 | 1.06 |
| <= 200 | 72% | 81% | 85% | 1.13 | 1.18 |
| <= 500 | 80% | 85% | 87% | 1.06 | 1.09 |
| <= 1000 | 88% | 95% | 97% | 1.08 | 1.10 |
| all size | 100% | 100% | 100% | 1 | 1 |

## Interpretation

Across the ten size classes, the correlation between log upper-size-bound and output/land ratio is -0.35 for crop output and -0.74 for food-crop output. The small classes generally have higher ratios, but the pattern is not monotonic: the `<= 200` class rises again to 1.18 for food-crop output, for example. This supports a descriptive association in this constructed dataset, not a causal claim that smaller farms inherently produce more food per hectare.

Important caveats: the sheet does not document the exact OWID extraction date, definitions behind “crop” versus “food crop,” farm-type mix, regional composition, input intensity or whether classes are cumulative thresholds or bins. The all-size row is an aggregate and is not treated as an additional class in the correlation. This result should not be used as a universal productivity coefficient without rebuilding the underlying OWID query and checking the original metadata.
