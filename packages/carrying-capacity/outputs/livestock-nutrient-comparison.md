# Nutrient-aware livestock comparison

Generated 2026-08-16T19:34:37.462Z. This report uses the canonical Health Canada protein layer, CNF food-form profiles and the **zero-import ARC on-site feed** ration for the **two-adult + three-dependent-child** family-capacity case on the **ordinary / mesic** site.

## Results

| Option | Energy adequate | Protein demand kg/year | Total protein kg/year | Feed self-sufficient | Reproductively self-sufficient | Protein-quality pattern | Absolute lysine intake / requirement | External/unresolved nutrients | Human-edible feed protein kg/year | Dedicated feed ha | Labour h/year | Peak ha | Mature ha |
| --- | :---: | ---: | ---: | :---: | ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| Plants only | yes | 77.3 | 157.8 | yes | n/a | 97% lysine | 7826.5 / 3943.5 g (198%) | b12, d, a, iodine, alpha_linolenic_g | 0.0 | 0.000 | 0 | 1.815 | 1.522 |
| Self-replacing rabbits | yes | 77.3 | 184.6 | yes | yes | 110% lysine | 10256.8 / 3943.5 g (260%) | d, a, iodine, alpha_linolenic_g | 28.7 | 0.615 | 900 | 2.291 | 2.011 |
| Self-replacing dual-purpose chicken flock | yes | 77.3 | 163.1 | yes | yes | 110% lysine | 9150.6 / 3943.5 g (232%) | iodine, alpha_linolenic_g | 485.3 | 1.144 | 980 | 2.337 | 2.102 |
| Fast-growing chicken sensitivity (non-canonical) | yes | 77.3 | 169.9 | yes | no | 109% lysine | 9558.1 / 3943.5 g (242%) | b12, d, a, iodine, alpha_linolenic_g | 67.6 | 0.154 | 840 | 1.717 | 1.448 |
| Self-replacing grazing-biased geese | yes | 77.3 | 165.0 | yes | yes | 106% lysine | 9057.4 / 3943.5 g (230%) | d, iodine, alpha_linolenic_g | 66.7 | 1.480 | 784 | 3.091 | 2.817 |
| Self-replacing browse-biased goats | yes | 77.3 | 165.5 | yes | yes | 97% lysine | 7019.3 / 3943.5 g (178%) | b12, d, a, iodine, alpha_linolenic_g | 0.0 | 3.820 | 1240 | 5.377 | 5.108 |
| Self-replacing rabbits + chicken flock | yes | 77.3 | 189.9 | yes | yes | 120% lysine | 11580.9 / 3943.5 g (294%) | iodine, alpha_linolenic_g | 524.5 | 1.839 | 1880 | 2.945 | 2.671 |

The pattern score is not an absolute amino-acid requirement ratio. A 97% lysine pattern score can coexist with absolute lysine intake above the household requirement when total protein is well above the RDA. Digestibility-adjusted quality remains unresolved where food-specific evidence is unavailable.

The plant-only result remains a valid low-complexity baseline, but it is not automatically the minimum for every objective. The earlier screening compared plant food area plus dedicated feed land; the table keeps food/feed area, peak land, mature land, labour, external nutrient dependence, completeness and human-edible-feed competition separate.

## Objective winners

| Objective | Selected eligible option | Value |
| --- | --- | ---: |
| lowest food feed area | Plants only | 0.937 |
| lowest peak productive land | Plants only | 1.815 |
| lowest mature productive land | Plants only | 1.522 |
| lowest labour | Plants only | 0 |
| lowest human edible feed competition | Plants only | 0.000 |
| lowest external nutrient dependence | Self-replacing dual-purpose chicken flock | 2.000 |
| maximum nutritional completeness | Self-replacing dual-purpose chicken flock | 22.000 |
| lowest complexity | Plants only | 0.000 |

## Pareto-efficient options

- **Plants only** (plants_only): peak 1.815 ha, mature 1.522 ha, 0 labour hours/year, 5 tracked external/unresolved nutrients, 0.0 kg human-edible feed protein, complexity 0.
- **Self-replacing rabbits** (rabbit_meat): peak 2.291 ha, mature 2.011 ha, 900 labour hours/year, 4 tracked external/unresolved nutrients, 28.7 kg human-edible feed protein, complexity 1.
- **Self-replacing dual-purpose chicken flock** (chicken_eggs): peak 2.337 ha, mature 2.102 ha, 980 labour hours/year, 2 tracked external/unresolved nutrients, 485.3 kg human-edible feed protein, complexity 1.
- **Self-replacing grazing-biased geese** (goose_meat): peak 3.091 ha, mature 2.817 ha, 784 labour hours/year, 3 tracked external/unresolved nutrients, 66.7 kg human-edible feed protein, complexity 1.

These are alternatives under distinct objectives, not a single universal optimum.

Only rows with energy, total-protein and absolute amino-acid adequacy, zero feed imports, complete winter feed, no unresolved feed deficit and on-site reproduction are eligible for the canonical animal comparison. The fast-growing chicken sensitivity is deliberately excluded because it assumes recurring production birds.

## Human-edible versus inedible feed conversion

This is not conventional feed-conversion ratio. It asks whether animal protein comes from biomass people would otherwise eat.

| Option | Human-inedible feed DM kg/year | Animal protein kg/year | Edible protein per inedible feed kg | Human-edible feed protein consumed kg/year | Edible protein per edible feed protein kg |
| --- | ---: | ---: | ---: | ---: | ---: |
| Self-replacing rabbits | 1237.0 | 35.6 | 0.029 | 28.7 | 1.240 |
| Self-replacing dual-purpose chicken flock | 96.8 | 44.7 | 0.462 | 485.3 | 0.092 |
| Fast-growing chicken sensitivity (non-canonical) | 116.0 | 28.0 | 0.241 | 67.6 | 0.414 |
| Self-replacing grazing-biased geese | 3825.7 | 20.0 | 0.005 | 66.7 | 0.300 |
| Self-replacing browse-biased goats | 4800.0 | 24.0 | 0.005 | 0.0 | — |
| Self-replacing rabbits + chicken flock | 1279.6 | 80.2 | 0.063 | 524.5 | 0.153 |

## Self-replacing chicken boundary

The canonical chicken row is an integrated true-breeding dual-purpose flock: breeding hens and rooster(s) produce fertile eggs, replacement females and males, surplus cockerels and cull birds. Edible eggs are gross eggs less incubation and losses. Feed includes breeding adults and all growing replacement generations. No external chicks or pullets are credited. Chantecler is the conservative cold-climate reference range, with Plymouth Rock, Rhode Island Red and Sussex retained as comparison candidates rather than silently averaged into a yield claim. Natural brooding and a locally powered incubator are separate reproduction options; neither permits recurring production-bird purchases. Breed performance, natural reproduction and genetic resilience remain planning evidence requiring local flock validation.

## Micronutrient boundary

CNF food-form values are used where available. Iodine and any nutrient without a defensible food-form value remain external or unresolved; supplements, iodized salt, fortification and veterinary minerals are not silently counted as property food. Plants-only may require a small external B12 input; the minimum self-replacing rabbit colony supplies B12 in the current modeled food forms, but adds labour and a small land increment.

## Previous purchased-feed audit

The previous report used purchased feed to close these annual deficits: **Self-replacing rabbits: 102 kg DM**; **Self-replacing dual-purpose chicken flock: 295 kg DM**; **Fast-growing chicken sensitivity (non-canonical): 75 kg DM**; **Self-replacing grazing-biased geese: 883 kg DM**; **Self-replacing browse-biased goats: 1063 kg DM**; **Self-replacing rabbits + chicken flock: 453 kg DM**. Under the corrected canonical rule, feed imports are zero; shortfalls become dedicated property feed land or infeasibility.

Sources: [Health Canada DRI tables](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-elements.html), [Canadian Nutrient File](https://open.canada.ca/data/en/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109), [Health Canada protein DRI](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-macronutrients.html), [heritage poultry comparison](https://afs.mgcafe.uky.edu/research/poultry/use-heritage-breeds-alternative-poultry-production), [free-range/heritage ranging study](https://pmc.ncbi.nlm.nih.gov/articles/PMC8858978/), [Ontario poultry nutrition](https://www.ontario.ca/page/introduction-poultry-nutrition), [Ontario pasture production](https://files.ontario.ca/omafra-pasture-production-en-2022-12-08.pdf), and [Ontario rabbit/farm guidance](https://files.ontario.ca/omafra-starting-farm-in-ontario-pub-61-en-2023-04-21.pdf).

Evidence status: crop yields, feed shares, feed-stream yields, species outputs and reproductive ledgers are bounded planning syntheses, not Grey-Bruce household trials.
