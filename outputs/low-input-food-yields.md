# Evidence-based low-input food yields

The old `paradise-garden.ods` crop table is retained in the historical audit but is not used here. This dataset combines current Canadian nutrient composition with Ontario measured crop benchmarks and explicit low-input synthesis rows. A synthesis row is not a measured zero-input trial: it is a reproducible adjustment to a measured Ontario benchmark, with the adjustment and limitations exposed in `data/source/evidence-food-yields.csv`.

## Low-input energy distribution

| statistic | GJ/ha/year |
|---|---:|
| observations | 6 |
| minimum | 23.31 |
| first quartile | 24.70 |
| median | **29.89** |
| mean | 32.23 |
| third quartile | 39.85 |
| maximum | 44.17 |
| IQR | 15.15 |
| standard deviation | 8.40 |
| coefficient of variation | 26.1% |

The low-input observations span 1.9× from minimum to maximum. Category medians are reported in `data/derived/evidence-food-yields.json`; the fat category has only one current low-input synthesis row, so its range is not evidence of a stable regional distribution.

| crop | category | yield t/ha | edible food GJ/ha | protein kg/ha | fat kg/ha | evidence |
|---|---|---:|---:|---:|---:|---|
| Potato | starch | 25.33 | 65.7 | 383 | 23 | measured benchmark |
| Wheat all | starch | 6.08 | 74.9 | 690 | 84 | measured benchmark |
| Oats | starch | 3.29 | 48.2 | 501 | 204 | measured benchmark |
| Dry peas | protein-legume | 2.62 | 35.9 | 545 | 92 | measured benchmark |
| Dry beans | protein-legume | 2.83 | 36.1 | 541 | 23 | measured benchmark |
| Soybeans | protein-legume | 3.43 | 57.6 | 1126 | 615 | measured benchmark |
| Sunflower seed | fat-seed | 1.99 | 43.7 | 372 | 920 | measured benchmark |
| Rye all | starch | 3.23 | 40.8 | 429 | 73 | measured benchmark |
| Potato | starch | 16.46 | 42.7 | 249 | 15 | modelled synthesis |
| Wheat | starch | 3.59 | 44.2 | 407 | 50 | modelled synthesis |
| Oats | starch | 2.14 | 31.4 | 325 | 133 | modelled synthesis |
| Dry peas | protein-legume | 1.70 | 23.3 | 354 | 60 | modelled synthesis |
| Dry beans | protein-legume | 1.84 | 23.5 | 352 | 15 | modelled synthesis |
| Soybeans | protein-legume | 2.33 | 39.2 | 766 | 418 | modelled synthesis |
| Sunflower seed | fat-seed | 1.29 | 28.4 | 242 | 598 | modelled synthesis |

## Hypothesis result

The current evidence supports a **qualified** order-of-magnitude statement, not crop equivalence. The starch, legume/protein and fat-seed rows overlap in the tens of GJ/ha/year, but the dataset is small, some central rows are modelled adjustments rather than direct low-input measurements, and a single fat-seed row cannot establish a category distribution. Gross calories are therefore constrained to a broad band by biological production, while nutritional composition changes materially and must be planned separately.

Potatoes and nuts/seeds can carry much more energy per hectare than low-energy fruit and vegetables; fruit, vegetables and perennial diversity are not optional just because they contribute fewer calories. No defensible ordinary Grey-Bruce low-input yield was found for chestnut, walnut, apple or carrot, so these are documented evidence gaps rather than fabricated numbers.
