# Crop-energy analysis

## Result

The extracted workbook provides **15 usable crop-yield observations** with recorded or formula-derived gross food energy. Values range from **13.02 to 60.30 GJ/ha**, with a median of **25.91 GJ/ha**, mean **26.56 GJ/ha**, standard deviation **10.93 GJ/ha**, coefficient of variation **41.1%**, and IQR **9.33 GJ/ha**.

The minimum is apples; the maximum is cassava. The full range is 4.6×, so the source does **not** support a claim that every crop produces the same energy per hectare. It does support a more limited “same broad order of magnitude” observation for many observations: the middle 50% spans 20.26–29.59 GJ/ha, while crop composition varies substantially.

The source workbook's groups are retained exactly. The energy_role field is a separate manual classification based primarily on the nutrient composition or crop identity; it is not an original workbook field and does not change the values.

## Overall distribution

| Statistic | GJ/ha |
|---|---:|
| Count | 15 |
| Minimum | 13.02 |
| Q1 | 20.26 |
| Median | 25.91 |
| Q3 | 29.59 |
| Maximum | 60.30 |
| Mean | 26.56 |
| Standard deviation | 10.93 |
| CV | 41.1% |
| IQR | 9.33 |

## Manual role groups

| Group | n | Min | Median | Mean | Max |
|---|---:|---:|---:|---:|---:|
| fat | 3 | 25.91 | 26.29 | 26.18 | 26.33 |
| starch/carbohydrate | 6 | 14.94 | 29.59 | 32.12 | 60.30 |
| fruit | 4 | 13.02 | 18.58 | 17.70 | 20.64 |
| protein/legume | 2 | 25.20 | 28.13 | 28.13 | 31.06 |

## Interpretation limits

These are workbook estimates, not a controlled agronomic trial. The entries mix trees, fruit, grains, roots and a perennial crop section; the yield horizon, maturity assumptions, harvest losses, storage losses, labour, land quality, climate, water, input intensity and edible fraction are not harmonized. The workbook also records gross food energy rather than a complete human nutrition or dietary-balance model. In particular, energy density is missing for bur oak, amaranth and several rows that have no yield observation, and edible fraction is not supplied as a separate source field.

The source formulas for GJ/ha are retained in data/source/crops.csv. For the rows where the workbook formula is visible, the arithmetic is yield tonnes/ha × 10,000 × kJ/100 g ÷ 1,000,000. This is a gross harvested-energy calculation, not net energy after cultivation, processing or storage.
