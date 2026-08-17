# Nutrient-aware livestock comparison

Generated 2026-08-17T10:40:51.513Z. This report uses the canonical Health Canada protein layer, CNF food-form profiles and the **zero-import ARC on-site feed** ration for the **two-adult + three-dependent-child** family-capacity case on the **ordinary / mesic** site.

## Results

| Option | Energy adequate | Protein demand kg/year | Total protein kg/year | Feed self-sufficient | Reproductively self-sufficient | Protein-quality pattern | Absolute lysine intake / requirement | External/unresolved nutrients | Human-edible feed protein kg/year | Dedicated feed ha | Labour h/year | Peak ha | Mature ha |
| --- | :---: | ---: | ---: | :---: | ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| Plants only | yes | 77.3 | 163.1 | yes | n/a | 90% lysine | 7513.5 / 3943.5 g (191%) | b12, d, calcium, iodine, choline, alpha_linolenic_g | 0.0 | 0.000 | 0 | 1.926 | 1.606 |
| Self-replacing rabbits | yes | 77.3 | 169.4 | yes | yes | 94% lysine | 8125.4 / 3943.5 g (206%) | b12, d, calcium, iodine, choline, alpha_linolenic_g | 0.8 | 0.048 | 225 | 1.938 | 1.620 |
| Self-replacing dual-purpose chicken flock | yes | 77.3 | 164.1 | yes | yes | 94% lysine | 7864.0 / 3943.5 g (199%) | b12, d, calcium, iodine, choline, alpha_linolenic_g | 102.7 | 0.236 | 249 | 2.001 | 1.689 |
| Fast-growing chicken sensitivity (non-canonical) | yes | 77.3 | 166.4 | yes | no | 94% lysine | 7954.3 / 3943.5 g (202%) | b12, d, calcium, iodine, choline, alpha_linolenic_g | 11.8 | 0.025 | 204 | 1.886 | 1.569 |
| Self-replacing grazing-biased geese | yes | 77.3 | 165.3 | yes | yes | 93% lysine | 7827.6 / 3943.5 g (198%) | b12, d, calcium, iodine, choline, alpha_linolenic_g | 9.4 | 0.326 | 196 | 2.199 | 1.882 |
| Self-replacing browse-biased goats | yes | 77.3 | 163.1 | yes | yes | 90% lysine | 7513.5 / 3943.5 g (191%) | b12, d, calcium, iodine, choline, alpha_linolenic_g | 0.0 | 0.846 | 301 | 2.706 | 2.389 |
| Self-replacing rabbits + chicken flock | yes | 77.3 | 170.4 | yes | yes | 98% lysine | 8475.9 / 3943.5 g (215%) | d, calcium, iodine, choline, alpha_linolenic_g | 112.5 | 0.312 | 474 | 2.042 | 1.731 |

The pattern score is not an absolute amino-acid requirement ratio. A 97% lysine pattern score can coexist with absolute lysine intake above the household requirement when total protein is well above the RDA. Digestibility-adjusted quality remains unresolved where food-specific evidence is unavailable.

The plant-only result remains a valid low-complexity baseline, but it is not automatically the minimum for every objective. The earlier screening compared plant food area plus dedicated feed land; the table keeps food/feed area, peak land, mature land, labour, external nutrient dependence, completeness and human-edible-feed competition separate.

## Objective winners

| Objective | Selected eligible option | Value |
| --- | --- | ---: |
| lowest food feed area | Plants only | 0.937 |
| lowest peak productive land | Plants only | 1.926 |
| lowest mature productive land | Plants only | 1.606 |
| lowest labour | Plants only | 0 |
| lowest human edible feed competition | Plants only | 0.000 |
| lowest external nutrient dependence | Self-replacing rabbits + chicken flock | 5.000 |
| maximum nutritional completeness | Self-replacing rabbits + chicken flock | 19.000 |
| lowest complexity | Plants only | 0.000 |

## Pareto-efficient options

- **Plants only** (plants_only): peak 1.926 ha, mature 1.606 ha, 0 labour hours/year, 6 tracked external/unresolved nutrients, 0.0 kg human-edible feed protein, complexity 0.
- **Self-replacing rabbits + chicken flock** (mixed_rabbit_eggs): peak 2.042 ha, mature 1.731 ha, 474 labour hours/year, 5 tracked external/unresolved nutrients, 112.5 kg human-edible feed protein, complexity 2.

These are alternatives under distinct objectives, not a single universal optimum.

Only rows with energy, total-protein and absolute amino-acid adequacy, zero feed imports, complete winter feed, no unresolved feed deficit and on-site reproduction are eligible for the canonical animal comparison. The fast-growing chicken sensitivity is deliberately excluded because it assumes recurring production birds.

## Human-edible versus inedible feed conversion

This is not conventional feed-conversion ratio. It asks whether animal protein comes from biomass people would otherwise eat.

| Option | Human-inedible feed DM kg/year | Animal protein kg/year | Edible protein per inedible feed kg | Human-edible feed protein consumed kg/year | Edible protein per edible feed protein kg |
| --- | ---: | ---: | ---: | ---: | ---: |
| Self-replacing rabbits | 342.1 | 8.9 | 0.026 | 0.8 | 11.289 |
| Self-replacing dual-purpose chicken flock | 120.9 | 11.2 | 0.092 | 102.7 | 0.109 |
| Fast-growing chicken sensitivity (non-canonical) | 56.6 | 7.0 | 0.124 | 11.8 | 0.592 |
| Self-replacing grazing-biased geese | 993.8 | 5.0 | 0.005 | 9.4 | 0.530 |
| Self-replacing browse-biased goats | 1200.0 | 6.0 | 0.005 | 0.0 | — |
| Self-replacing rabbits + chicken flock | 416.6 | 20.1 | 0.048 | 112.5 | 0.178 |

## Self-replacing chicken boundary

The canonical chicken row is an integrated true-breeding dual-purpose flock: breeding hens and rooster(s) produce fertile eggs, replacement females and males, surplus cockerels and cull birds. Edible eggs are gross eggs less incubation and losses. Feed includes breeding adults and all growing replacement generations. No external chicks or pullets are credited. Chantecler is the conservative cold-climate reference range, with Plymouth Rock, Rhode Island Red and Sussex retained as comparison candidates rather than silently averaged into a yield claim. Natural brooding and a locally powered incubator are separate reproduction options; neither permits recurring production-bird purchases. Breed performance, natural reproduction and genetic resilience remain planning evidence requiring local flock validation.

## Micronutrient boundary

CNF food-form values are used where available. Iodine and any nutrient without a defensible food-form value remain external or unresolved; supplements, iodized salt, fortification and veterinary minerals are not silently counted as property food. Plants-only may require a small external B12 input; the minimum self-replacing rabbit colony supplies B12 in the current modeled food forms, but adds labour and a small land increment.

## Previous purchased-feed audit

The previous report used purchased feed to close these annual deficits: **Self-replacing rabbits: 102 kg DM**; **Self-replacing dual-purpose chicken flock: 295 kg DM**; **Fast-growing chicken sensitivity (non-canonical): 75 kg DM**; **Self-replacing grazing-biased geese: 883 kg DM**; **Self-replacing browse-biased goats: 1063 kg DM**; **Self-replacing rabbits + chicken flock: 453 kg DM**. Under the corrected canonical rule, feed imports are zero; shortfalls become dedicated property feed land or infeasibility.

Sources: [Health Canada DRI tables](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-elements.html), [Canadian Nutrient File](https://open.canada.ca/data/en/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109), [Health Canada protein DRI](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-macronutrients.html), [heritage poultry comparison](https://afs.mgcafe.uky.edu/research/poultry/use-heritage-breeds-alternative-poultry-production), [free-range/heritage ranging study](https://pmc.ncbi.nlm.nih.gov/articles/PMC8858978/), [Ontario poultry nutrition](https://www.ontario.ca/page/introduction-poultry-nutrition), [Ontario pasture production](https://files.ontario.ca/omafra-pasture-production-en-2022-12-08.pdf), and [Ontario rabbit/farm guidance](https://files.ontario.ca/omafra-starting-farm-in-ontario-pub-61-en-2023-04-21.pdf).

Evidence status: crop yields, feed shares, feed-stream yields, species outputs and reproductive ledgers are bounded planning syntheses, not Grey-Bruce household trials.


## Whole-diet macro comparison

| Option | Carbohydrate energy | Protein energy | Fat energy | Fibre g/day | Animal food kg/year | Animal energy share |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Plants only | 62.9% | 15.6% | 21.5% | 359.0 | 0.0 | 0.0% |
| Self-replacing rabbits | 61.9% | 16.2% | 21.9% | 354.0 | 40.8 | 1.4% |
| Self-replacing dual-purpose chicken flock | 61.1% | 16.3% | 22.6% | 336.6 | 80.8 | 6.2% |
| Fast-growing chicken sensitivity (non-canonical) | 62.0% | 16.1% | 21.8% | 350.0 | 35.0 | 2.5% |
| Self-replacing grazing-biased geese | 62.1% | 16.0% | 21.9% | 351.7 | 24.0 | 2.0% |
| Self-replacing browse-biased goats | 62.9% | 15.6% | 21.5% | 359.0 | 30.0 | 2.6% |
| Self-replacing rabbits + chicken flock | 60.1% | 16.9% | 23.0% | 331.6 | 121.6 | 7.6% |

These are complete-ration values after animal food displaces an equivalent amount of plant food energy. The household AMDR intersection and child fat-floor flag are carried in each JSON row. Linoleic acid and alpha-linolenic acid are reported in the contract; DHA/EPA remains unresolved for the current property-food profiles.

## Year-by-year food-forest succession

### Plants only

| Year | Carb | Protein | Fat | Annual GJ | Perennial GJ | Animal GJ | Annual cultivation ha | Occupied food ha | Surplus GJ | Main fat sources |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 62.9% | 15.6% | 21.5% | 16.7 | 0.0 | 0.0 | 1.026 | 1.310 | 0.0 | Sunflower seed (163.7 kg) |
| 2 | 63.4% | 15.5% | 21.1% | 16.4 | 0.3 | 0.0 | 1.006 | 1.305 | 0.0 | Sunflower seed (159.3 kg) |
| 3 | 64.3% | 15.1% | 20.6% | 15.5 | 1.2 | 0.0 | 0.952 | 1.434 | 0.0 | Sunflower seed (139.2 kg), Hazelnut (11.1 kg) |
| 5 | 65.9% | 13.8% | 20.3% | 9.8 | 3.0 | 0.0 | 0.597 | 1.412 | 0.0 | Sunflower seed (56.8 kg), Hazelnut (48.4 kg) |
| 8 | 65.3% | 12.6% | 22.1% | 7.8 | 4.9 | 0.0 | 0.476 | 1.458 | 0.0 | Sunflower seed (20.4 kg), Hazelnut (89.9 kg) |
| 10 | 63.2% | 11.7% | 25.1% | 6.5 | 6.1 | 0.0 | 0.395 | 1.429 | 0.0 | Sunflower seed (9.6 kg), Hazelnut (117.5 kg) |
| 15 | 56.0% | 9.0% | 35.0% | 1.7 | 6.1 | 0.0 | 0.101 | 1.155 | 1.3 | Sunflower seed (2.4 kg), Hazelnut (113.5 kg) |
| mature | 56.3% | 8.7% | 35.0% | 1.4 | 6.4 | 0.0 | 0.084 | 1.138 | 1.4 | Sunflower seed (2.0 kg), Hazelnut (113.6 kg) |

### Self-replacing rabbits

| Year | Carb | Protein | Fat | Annual GJ | Perennial GJ | Animal GJ | Annual cultivation ha | Occupied food ha | Surplus GJ | Main fat sources |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 61.9% | 16.2% | 21.9% | 16.4 | 0.0 | 0.2 | 1.011 | 1.275 | 0.0 | Sunflower seed (161.4 kg) |
| 2 | 62.4% | 16.1% | 21.5% | 16.1 | 0.3 | 0.2 | 0.993 | 1.270 | 0.0 | Sunflower seed (157.1 kg) |
| 3 | 63.3% | 15.7% | 21.0% | 15.3 | 1.1 | 0.2 | 0.940 | 1.398 | 0.0 | Sunflower seed (137.8 kg), Hazelnut (10.7 kg) |
| 5 | 64.5% | 14.6% | 20.9% | 9.6 | 2.9 | 0.2 | 0.589 | 1.375 | 0.0 | Sunflower seed (57.1 kg), Hazelnut (47.0 kg) |
| 8 | 63.9% | 13.5% | 22.7% | 7.7 | 4.7 | 0.2 | 0.471 | 1.422 | 0.0 | Sunflower seed (21.9 kg), Hazelnut (87.2 kg) |
| 10 | 62.1% | 12.6% | 25.3% | 6.4 | 6.0 | 0.2 | 0.392 | 1.394 | 0.0 | Sunflower seed (9.5 kg), Hazelnut (114.0 kg) |
| 15 | 54.3% | 10.4% | 35.4% | 1.6 | 5.9 | 0.2 | 0.098 | 1.120 | 1.3 | Sunflower seed (2.4 kg), Hazelnut (110.1 kg) |
| mature | 54.5% | 10.1% | 35.4% | 1.3 | 6.2 | 0.2 | 0.082 | 1.104 | 1.3 | Sunflower seed (2.0 kg), Hazelnut (110.2 kg) |

### Self-replacing dual-purpose chicken flock

| Year | Carb | Protein | Fat | Annual GJ | Perennial GJ | Animal GJ | Annual cultivation ha | Occupied food ha | Surplus GJ | Main fat sources |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 61.1% | 16.3% | 22.6% | 15.6 | 0.0 | 1.0 | 0.962 | 1.190 | 0.0 | Sunflower seed (153.5 kg) |
| 2 | 61.5% | 16.1% | 22.3% | 15.4 | 0.3 | 1.0 | 0.945 | 1.173 | 0.0 | Sunflower seed (149.7 kg) |
| 3 | 62.3% | 15.8% | 21.8% | 14.6 | 1.0 | 1.0 | 0.897 | 1.272 | 0.0 | Sunflower seed (132.9 kg), Hazelnut (9.6 kg) |
| 5 | 63.0% | 14.8% | 22.2% | 9.1 | 2.6 | 1.0 | 0.559 | 1.248 | 0.0 | Sunflower seed (58.0 kg), Hazelnut (41.9 kg) |
| 8 | 62.4% | 13.7% | 23.9% | 7.4 | 4.2 | 1.0 | 0.453 | 1.298 | 0.0 | Sunflower seed (26.6 kg), Hazelnut (77.9 kg) |
| 10 | 61.4% | 12.9% | 25.7% | 6.3 | 5.3 | 1.0 | 0.382 | 1.275 | 0.0 | Sunflower seed (10.8 kg), Hazelnut (101.8 kg) |
| 15 | 52.6% | 10.8% | 36.6% | 1.4 | 5.3 | 1.0 | 0.087 | 1.000 | 1.2 | Sunflower seed (2.1 kg), Hazelnut (98.3 kg) |
| mature | 52.9% | 10.5% | 36.6% | 1.2 | 5.5 | 1.0 | 0.073 | 0.986 | 1.2 | Sunflower seed (1.8 kg), Hazelnut (98.4 kg) |

### Fast-growing chicken sensitivity (non-canonical)

| Year | Carb | Protein | Fat | Annual GJ | Perennial GJ | Animal GJ | Annual cultivation ha | Occupied food ha | Surplus GJ | Main fat sources |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 62.0% | 16.1% | 21.8% | 16.3 | 0.0 | 0.4 | 1.000 | 1.249 | 0.0 | Sunflower seed (159.6 kg) |
| 2 | 62.5% | 16.0% | 21.5% | 16.0 | 0.3 | 0.4 | 0.982 | 1.242 | 0.0 | Sunflower seed (155.4 kg) |
| 3 | 63.4% | 15.6% | 21.0% | 15.1 | 1.1 | 0.4 | 0.930 | 1.369 | 0.0 | Sunflower seed (136.7 kg), Hazelnut (10.5 kg) |
| 5 | 64.5% | 14.5% | 20.9% | 9.5 | 2.8 | 0.4 | 0.582 | 1.346 | 0.0 | Sunflower seed (57.3 kg), Hazelnut (45.8 kg) |
| 8 | 64.0% | 13.4% | 22.7% | 7.7 | 4.6 | 0.4 | 0.467 | 1.393 | 0.0 | Sunflower seed (23.0 kg), Hazelnut (85.0 kg) |
| 10 | 62.4% | 12.5% | 25.1% | 6.4 | 5.8 | 0.4 | 0.389 | 1.367 | 0.0 | Sunflower seed (9.4 kg), Hazelnut (111.2 kg) |
| 15 | 54.5% | 10.2% | 35.3% | 1.6 | 5.8 | 0.4 | 0.096 | 1.092 | 1.3 | Sunflower seed (2.3 kg), Hazelnut (107.3 kg) |
| mature | 54.8% | 9.9% | 35.3% | 1.3 | 6.0 | 0.4 | 0.080 | 1.076 | 1.3 | Sunflower seed (1.9 kg), Hazelnut (107.5 kg) |

### Self-replacing grazing-biased geese

| Year | Carb | Protein | Fat | Annual GJ | Perennial GJ | Animal GJ | Annual cultivation ha | Occupied food ha | Surplus GJ | Main fat sources |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 62.1% | 16.0% | 21.9% | 16.3 | 0.0 | 0.3 | 1.005 | 1.259 | 0.0 | Sunflower seed (160.4 kg) |
| 2 | 62.6% | 15.8% | 21.6% | 16.0 | 0.3 | 0.3 | 0.986 | 1.254 | 0.0 | Sunflower seed (156.1 kg) |
| 3 | 63.5% | 15.5% | 21.0% | 15.2 | 1.1 | 0.3 | 0.934 | 1.381 | 0.0 | Sunflower seed (137.1 kg), Hazelnut (10.6 kg) |
| 5 | 64.7% | 14.3% | 21.0% | 9.6 | 2.9 | 0.3 | 0.585 | 1.358 | 0.0 | Sunflower seed (57.2 kg), Hazelnut (46.3 kg) |
| 8 | 64.1% | 13.1% | 22.8% | 7.7 | 4.7 | 0.3 | 0.469 | 1.406 | 0.0 | Sunflower seed (22.5 kg), Hazelnut (86.0 kg) |
| 10 | 62.4% | 12.3% | 25.3% | 6.4 | 5.9 | 0.3 | 0.390 | 1.378 | 0.0 | Sunflower seed (9.4 kg), Hazelnut (112.4 kg) |
| 15 | 54.6% | 9.8% | 35.5% | 1.6 | 5.8 | 0.3 | 0.097 | 1.104 | 1.3 | Sunflower seed (2.3 kg), Hazelnut (108.5 kg) |
| mature | 54.9% | 9.6% | 35.5% | 1.3 | 6.1 | 0.3 | 0.081 | 1.088 | 1.3 | Sunflower seed (1.9 kg), Hazelnut (108.7 kg) |

### Self-replacing browse-biased goats

| Year | Carb | Protein | Fat | Annual GJ | Perennial GJ | Animal GJ | Annual cultivation ha | Occupied food ha | Surplus GJ | Main fat sources |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 62.9% | 15.6% | 21.5% | 16.7 | 0.0 | 0.0 | 1.026 | 1.275 | 0.0 | Sunflower seed (163.7 kg) |
| 2 | 63.3% | 15.5% | 21.2% | 15.9 | 0.3 | 0.4 | 0.981 | 1.241 | 0.0 | Sunflower seed (155.3 kg) |
| 3 | 64.3% | 15.1% | 20.6% | 15.1 | 1.1 | 0.4 | 0.929 | 1.367 | 0.0 | Sunflower seed (136.6 kg), Hazelnut (10.5 kg) |
| 5 | 65.7% | 13.9% | 20.5% | 9.5 | 2.8 | 0.4 | 0.581 | 1.344 | 0.0 | Sunflower seed (57.4 kg), Hazelnut (45.7 kg) |
| 8 | 65.1% | 12.7% | 22.3% | 7.7 | 4.6 | 0.4 | 0.467 | 1.392 | 0.0 | Sunflower seed (23.1 kg), Hazelnut (84.9 kg) |
| 10 | 63.5% | 11.8% | 24.7% | 6.4 | 5.8 | 0.4 | 0.389 | 1.365 | 0.0 | Sunflower seed (9.4 kg), Hazelnut (111.0 kg) |
| 15 | 56.0% | 9.0% | 35.0% | 1.6 | 5.8 | 0.4 | 0.095 | 1.091 | 1.3 | Sunflower seed (2.3 kg), Hazelnut (107.2 kg) |
| mature | 56.3% | 8.7% | 35.0% | 1.3 | 6.0 | 0.4 | 0.080 | 1.075 | 1.3 | Sunflower seed (1.9 kg), Hazelnut (107.3 kg) |

### Self-replacing rabbits + chicken flock

| Year | Carb | Protein | Fat | Annual GJ | Perennial GJ | Animal GJ | Annual cultivation ha | Occupied food ha | Surplus GJ | Main fat sources |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 60.1% | 16.9% | 23.0% | 15.4 | 0.0 | 1.3 | 0.948 | 1.168 | 0.0 | Sunflower seed (151.2 kg) |
| 2 | 60.5% | 16.8% | 22.7% | 15.1 | 0.3 | 1.3 | 0.931 | 1.151 | 0.0 | Sunflower seed (147.6 kg) |
| 3 | 61.3% | 16.4% | 22.3% | 14.4 | 1.0 | 1.3 | 0.885 | 1.238 | 0.0 | Sunflower seed (131.4 kg), Hazelnut (9.3 kg) |
| 5 | 61.5% | 15.7% | 22.8% | 9.0 | 2.5 | 1.3 | 0.550 | 1.211 | 0.0 | Sunflower seed (58.1 kg), Hazelnut (40.5 kg) |
| 8 | 60.9% | 14.6% | 24.4% | 7.3 | 4.1 | 1.3 | 0.448 | 1.262 | 0.0 | Sunflower seed (27.8 kg), Hazelnut (75.2 kg) |
| 10 | 60.0% | 13.9% | 26.2% | 6.2 | 5.1 | 1.3 | 0.379 | 1.241 | 0.0 | Sunflower seed (12.4 kg), Hazelnut (98.3 kg) |
| 15 | 50.6% | 12.4% | 37.0% | 1.4 | 5.1 | 1.3 | 0.084 | 0.966 | 1.1 | Sunflower seed (2.0 kg), Hazelnut (94.9 kg) |
| mature | 50.9% | 12.1% | 37.0% | 1.2 | 5.3 | 1.3 | 0.070 | 0.952 | 1.2 | Sunflower seed (1.7 kg), Hazelnut (95.0 kg) |


The same ledger supplies the perennial food credit, annual residual bridge, consumed-diet macro ratios and food-area timing. Annual bridge ratios are therefore year-specific; they are not a permanent mature plants-only diet.

## Task-based labour ledger

Labour is calculated from explicit task quantities and unit-time assumptions. Central task values are planning assumptions bounded by the listed sources; no unsupported fixed/variable percentage is asserted. Formula: `fixed system + breeding-animal + grow-out-inventory + seasonal-batch tasks; processing setup × batches + per-animal × harvest`.

| Option | Recurring h/year | Processing h/year | Total h/year | h/kg edible product | h/kg animal protein | Task components |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Self-replacing rabbits | 180.0 | 45.0 | 225.0 | 5.51 | 25.31 | rabbit_meat: {"recurring":{"fixed_system":90,"breeding_females":16,"breeding_males":4,"growout_inventory":8.054795,"seasonal_batches":61.945205},"processing":{"batch_setup":10,"harvested_animals":35}} |
| Self-replacing dual-purpose chicken flock | 209.9 | 39.5 | 249.5 | 3.09 | 22.33 | chicken_eggs: {"recurring":{"fixed_system":90,"breeding_females":40,"breeding_males":5,"growout_inventory":2.146192,"seasonal_batches":72.8},"processing":{"batch_setup":8,"harvested_animals":31.511551}} |
| Fast-growing chicken sensitivity (non-canonical) | 143.9 | 60.0 | 203.9 | 5.83 | 29.13 | chicken_meat: {"recurring":{"fixed_system":70,"breeding_females":0,"breeding_males":0,"growout_inventory":1.917808,"seasonal_batches":72},"processing":{"batch_setup":15,"harvested_animals":45}} |
| Self-replacing grazing-biased geese | 160.0 | 36.0 | 196.0 | 8.17 | 39.19 | goose_meat: {"recurring":{"fixed_system":80,"breeding_females":24,"breeding_males":6,"growout_inventory":1.775342,"seasonal_batches":48.2},"processing":{"batch_setup":6,"harvested_animals":29.99}} |
| Self-replacing browse-biased goats | 261.3 | 39.7 | 301.0 | 10.03 | 50.17 | goat_meat: {"recurring":{"fixed_system":120,"breeding_females":40,"breeding_males":10,"growout_inventory":1.257534,"seasonal_batches":90},"processing":{"batch_setup":10,"harvested_animals":29.74359}} |
| Self-replacing rabbits + chicken flock | 389.9 | 84.5 | 474.5 | 3.90 | 23.65 | rabbit_meat: {"recurring":{"fixed_system":90,"breeding_females":16,"breeding_males":4,"growout_inventory":8.054795,"seasonal_batches":61.945205},"processing":{"batch_setup":10,"harvested_animals":35}}<br>chicken_eggs: {"recurring":{"fixed_system":90,"breeding_females":40,"breeding_males":5,"growout_inventory":2.146192,"seasonal_batches":72.8},"processing":{"batch_setup":8,"harvested_animals":31.511551}} |

Each row also contains low, central and high sensitivity totals plus the task frequencies and unit-time assumptions used to derive it.

## Discrete property-produced B12 search

The search begins at each species' minimum self-replacing population and adds one breeding female at a time. It runs the complete reproductive, feed, land, labour and nutrient calculation; it does not treat an integer system scale as a population.

| System | First feasible population | Lowest-land feasible population / food-feed area | Lowest labour | Lowest human-edible feed |
| --- | --- | --- | ---: | ---: |
| rabbit_meat | 5 does + 1 bucks | 5 does + 1 bucks; 1.001 ha | 258 h/year | 2.3 kg protein/year |
| chicken_eggs | 28 hens + 4 roosters | 28 hens + 4 roosters; 1.725 ha | 465 h/year | 421.5 kg protein/year |
| goose_meat | No feasible population in search range | — | — | — |
| mixed_rabbit_eggs | 4 does + 8 hens | 4 does + 8 hens; 1.177 ha | 474 h/year | 112.5 kg protein/year |

The selected rabbit result is the first rabbit population that reaches 100% B12 coverage. Other rows are comparison objectives, not a universal livestock recommendation.