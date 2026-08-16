# Nutrient-aware livestock comparison

Generated 2026-08-16T14:38:27.995Z. This report uses the canonical Health Canada protein layer, CNF food-form profiles and the **zero-import ARC on-site feed** ration for the **two-adult + three-dependent-child** family-capacity case on the **ordinary / mesic** site.

## Results

| Option | Energy adequate | Protein demand kg/year | Total protein kg/year | Feed self-sufficient | Reproductively self-sufficient | Limiting amino acid | External/unresolved nutrients | Human-edible feed protein kg/year | Dedicated feed ha | Labour h/year | Peak ha | Mature ha |
| --- | :---: | ---: | ---: | :---: | :---: | --- | --- | ---: | ---: | ---: | ---: | ---: |
| Plants only | yes | 77.3 | 157.8 | yes | n/a | 97% lysine | b12, d, a, iodine, alpha_linolenic_g | 0.0 | 0.000 | 0 | 1.815 | 1.522 |
| Self-replacing rabbits | yes | 77.3 | 164.5 | yes | yes | 101% lysine | d, a, iodine, alpha_linolenic_g | 0.8 | 0.048 | 225 | 1.828 | 1.538 |
| Self-replacing dual-purpose chicken flock | yes | 77.3 | 159.2 | yes | yes | 101% lysine | iodine, alpha_linolenic_g | 102.7 | 0.236 | 245 | 1.895 | 1.616 |
| Fast-growing chicken sensitivity (non-canonical) | yes | 77.3 | 160.8 | yes | no | 100% lysine | b12, d, a, iodine, alpha_linolenic_g | 11.8 | 0.025 | 210 | 1.777 | 1.490 |
| Self-replacing grazing-biased geese | yes | 77.3 | 159.6 | yes | yes | 100% lysine | d, a, iodine, alpha_linolenic_g | 9.4 | 0.326 | 196 | 2.089 | 1.801 |
| Self-replacing browse-biased goats | yes | 77.3 | 159.8 | yes | yes | 97% lysine | b12, d, a, iodine, alpha_linolenic_g | 0.0 | 0.846 | 310 | 2.596 | 2.309 |
| Self-replacing rabbits + chicken flock | yes | 77.3 | 165.8 | yes | yes | 104% lysine | iodine, alpha_linolenic_g | 112.5 | 0.312 | 470 | 1.936 | 1.661 |

The plant-only result remains a valid low-complexity baseline, but it is not automatically the minimum for every objective. The former optimizer compared plant food area plus dedicated feed land; the table below keeps food/feed area, peak land, mature land, labour and human-edible-feed competition separate.

## Objective winners

| Objective | Lowest eligible option | Value |
| --- | --- | ---: |
| lowest food feed area | Plants only | 0.937 |
| lowest peak productive land | Plants only | 1.815 |
| lowest mature productive land | Plants only | 1.522 |
| lowest labour | Plants only | 0 |
| lowest human edible feed competition | Plants only | 0.000 |

Only rows with energy and total-protein adequacy, zero feed imports, complete winter feed, no unresolved feed deficit and on-site reproduction are eligible for the canonical animal comparison. The fast-growing chicken sensitivity is deliberately excluded from that set because it assumes recurring production birds.

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

CNF food-form values are used where available. Iodine and any nutrient without a defensible food-form value remain external or unresolved; supplements, iodized salt, fortification and veterinary minerals are not silently counted as property food. Amino-acid pattern adequacy is reported separately from digestibility-quality scores.

## Previous purchased-feed audit

The previous report used purchased feed to close these annual deficits: **Self-replacing rabbits: 102 kg DM**; **Self-replacing dual-purpose chicken flock: 295 kg DM**; **Fast-growing chicken sensitivity (non-canonical): 75 kg DM**; **Self-replacing grazing-biased geese: 883 kg DM**; **Self-replacing browse-biased goats: 1063 kg DM**; **Self-replacing rabbits + chicken flock: 453 kg DM**. Under the corrected canonical rule, feed imports are zero; shortfalls become dedicated property feed land or infeasibility.

Sources: [Health Canada DRI tables](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-elements.html), [Canadian Nutrient File](https://open.canada.ca/data/en/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109), [Health Canada protein DRI](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-macronutrients.html), [heritage poultry comparison](https://afs.mgcafe.uky.edu/research/poultry/use-heritage-breeds-alternative-poultry-production), [free-range/heritage ranging study](https://pmc.ncbi.nlm.nih.gov/articles/PMC8858978/), [Ontario poultry nutrition](https://www.ontario.ca/page/introduction-poultry-nutrition), [Ontario pasture production](https://files.ontario.ca/omafra-pasture-production-en-2022-12-08.pdf), and [Ontario rabbit/farm guidance](https://files.ontario.ca/omafra-starting-farm-in-ontario-pub-61-en-2023-04-21.pdf).

Evidence status: crop yields, feed shares, feed-stream yields, species outputs and reproductive ledgers are bounded planning syntheses, not Grey-Bruce household trials.
