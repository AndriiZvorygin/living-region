# Nutrient-aware livestock comparison

Generated 2026-08-16T13:01:52.139Z. This report uses the canonical Health Canada protein layer and the **zero-import ARC on-site feed** ration for the **two-adult + three-dependent-child** family-capacity case on the **ordinary / mesic** site.

## What the prior model constrained

The pre-existing carrying-capacity calculation sized the food system primarily from household food energy. It reported crop protein and a screening macro check, but did not apply an official age/sex/body-mass protein DRI, protein-quality constraint, human-edible feed conversion, winter feed balance or species-specific edible outputs. The first livestock pass also reported feed shortfalls as purchased feed; this report corrects that boundary.

## Results

| Option | Protein demand kg/year | Plant protein | Animal protein | Feed self-sufficient | Human-edible feed protein kg/year | Human-inedible feed DM kg/year | Property-grown dedicated feed DM kg/year | Dedicated feed ha | Winter stored feed kg/year | Feed deficit kg DM/year | Labour h/year | Establishment ha | Mature ha | Peak |
| --- | ---: | ---: | ---: | :---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Plants only | 77.3 | 157.8 | 0.0 | yes | 0.0 | 0 | 0 | 0.000 | 0 | 0 | 0 | 1.815 | 1.522 | Year 8 |
| Rabbit meat | 77.3 | 155.6 | 8.9 | yes | 0.8 | 342 | 121 | 0.048 | 350 | 0 | 225 | 1.828 | 1.538 | Year 8 |
| Chicken / eggs | 77.3 | 153.6 | 9.2 | yes | 52.3 | 125 | 290 | 0.116 | 255 | 0 | 120 | 1.864 | 1.577 | Year 8 |
| Chicken meat | 77.3 | 153.8 | 7.0 | yes | 11.8 | 57 | 63 | 0.025 | 81 | 0 | 210 | 1.777 | 1.490 | Year 8 |
| Goose meat | 77.3 | 154.6 | 5.0 | yes | 9.4 | 994 | 952 | 0.326 | 578 | 0 | 196 | 2.089 | 1.801 | Year 8 |
| Goat meat | 77.3 | 153.8 | 6.0 | yes | 0.0 | 1200 | 1355 | 0.846 | 1200 | 0 | 310 | 2.596 | 2.309 | Year 8 |
| Rabbit + eggs | 77.3 | 151.4 | 18.0 | yes | 62.1 | 421 | 474 | 0.190 | 605 | 0 | 345 | 1.903 | 1.619 | Year 8 |

The current crop mix supplies 157.8 kg protein/year against 77.3 kg/year of modeled RDA demand. Plants-only therefore remains the canonical baseline in this first pass. This is total-protein adequacy only; indispensable amino acids, digestibility, micronutrients and food safety remain separate evidence work.

The lowest modeled protein-adequate, feed-self-sufficient row is **Plants only** after counting dedicated feed land, but this is not a recommendation to add livestock. Plants-only already meets the modeled total-protein target without animal housing or processing labour.

## Previous purchased-feed audit

The prior livestock report used purchased feed to close these annual deficits. Those values are retained only for comparison: **Rabbit meat 102 kg DM**; **Chicken / eggs 295 kg DM**; **Chicken meat 75 kg DM**; **Goose meat 883 kg DM**; **Goat meat 1063 kg DM**; **Rabbit + eggs 453 kg DM**. Under the corrected canonical ARC rule, every row above has zero feed imports; any shortfall becomes dedicated on-property feed land or an infeasible scenario.

## Feed conversion boundary

| Option | Human-inedible feed DM → edible animal protein | Human-edible feed protein → edible animal protein | Net human-edible animal protein |
| --- | ---: | ---: | ---: |
| Rabbit meat | 0.026 kg/kg | 11.289 kg/kg | 8.1 kg/year |
| Chicken / eggs | 0.073 kg/kg | 0.175 kg/kg | -43.2 kg/year |
| Chicken meat | 0.124 kg/kg | 0.592 kg/kg | -4.8 kg/year |
| Goose meat | 0.005 kg/kg | 0.530 kg/kg | -4.4 kg/year |
| Goat meat | 0.005 kg/kg | — kg/kg | 6.0 kg/year |
| Rabbit + eggs | 0.043 kg/kg | 0.290 kg/kg | -44.1 kg/year |

These are modelled mass ratios, not universal biological constants. A high human-edible-feed ratio indicates direct competition with food that could otherwise be eaten by people. Mineral and veterinary inputs remain a separate external-input category and are not counted as feed DM.

## Feed and land boundary

Existing residues, garden culls, food-forest understorey, leaf fodder and browse are finite co-products or overlays within the food area. Dedicated feed crops are added as productive land when those streams are insufficient. A canonical row is eligible only when purchased feed and remaining feed deficit are both zero and winter feed is fully supplied.

Sources: [Health Canada protein DRI tables](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-macronutrients.html), [Ontario poultry nutrition](https://www.ontario.ca/page/introduction-poultry-nutrition), [Ontario pasture production](https://files.ontario.ca/omafra-pasture-production-en-2022-12-08.pdf), [Ontario rabbit/farm guidance](https://files.ontario.ca/omafra-starting-farm-in-ontario-pub-61-en-2023-04-21.pdf), [Manitoba goat nutrition](https://www.gov.mb.ca/agriculture/livestock/goat/pubs/goats-and-their-nutrition.pdf), and [Penn State goose/poultry guidance](https://extension.psu.edu/geese-ducks-and-swans).

Evidence status: species outputs, feed shares, dedicated-feed yields and property co-product yields are bounded planning syntheses, not Grey-Bruce household trials.
