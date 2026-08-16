# Nutrient-aware livestock comparison

Generated 2026-08-16T12:35:54.434Z. This report uses the canonical Health Canada protein layer and the ARC-integrated feed ledger for the **two-adult + three-dependent-child** family-capacity case on the **ordinary / mesic** site.

## What the prior model constrained

The pre-existing carrying-capacity calculation sized the food system primarily from household food energy. It reported crop protein and a screening macro check, but did not apply an official age/sex/body-mass protein DRI, protein-quality constraint, human-edible feed conversion, winter feed balance or species-specific edible outputs.

## Results

| Option | Protein demand kg/year | Plant protein | Animal protein | Protein adequate | Plant food ha | Human-edible feed protein kg/year | Human-inedible feed DM kg/year | Winter stored feed DM kg/year | Purchased feed DM kg/year | Livestock labour h/year | Establishment ha | Mature ha | Peak |
| --- | ---: | ---: | ---: | :---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Plants only | 77.3 | 157.8 | 0.0 | yes | 0.937 | 0.0 | 0 | 0 | 0 | 0 | 1.815 | 1.522 | Year 8 |
| Rabbit meat | 77.3 | 155.6 | 8.9 | yes | 0.924 | 6.5 | 311 | 350 | 102 | 225 | 1.780 | 1.490 | Year 8 |
| Chicken / eggs | 77.3 | 153.6 | 9.2 | yes | 0.912 | 37.1 | 204 | 255 | 295 | 120 | 1.748 | 1.461 | Year 8 |
| Chicken meat | 77.3 | 153.8 | 7.0 | yes | 0.913 | 10.8 | 61 | 81 | 75 | 210 | 1.752 | 1.465 | Year 8 |
| Goose meat | 77.3 | 154.6 | 5.0 | yes | 0.918 | 27.9 | 885 | 683 | 883 | 196 | 1.764 | 1.475 | Year 8 |
| Goat meat | 77.3 | 153.8 | 6.0 | yes | 0.913 | 19.4 | 1092 | 1200 | 1063 | 310 | 1.750 | 1.463 | Year 8 |
| Rabbit + eggs | 77.3 | 151.4 | 18.0 | yes | 0.899 | 43.6 | 515 | 605 | 453 | 345 | 1.713 | 1.429 | Year 8 |

The current crop mix supplies 157.8 kg protein/year against 77.3 kg/year of modeled RDA demand. That means plants-only remains the canonical baseline in this first pass. This is total-protein adequacy only; indispensable amino acids, digestibility, micronutrients and food safety remain separate evidence work.

The lowest modeled protein-adequate row is **Rabbit + eggs** under the current arithmetic, but this is not a recommendation to add livestock: the options include purchased feed and bounded planning synthesis, while plants-only already meets the modeled total-protein target without animal housing or processing labour.

## Feed and land boundary

Existing residues, garden culls, food-forest understorey, leaf fodder and browse are treated as bounded co-products or overlays within the food area. They do not receive a second hectare. Dedicated feed land is 0.000 ha in the current integrated scenario; a property biomass inventory is required before operational use.

Sources: [Health Canada protein DRI tables](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-macronutrients.html), [Ontario poultry nutrition](https://www.ontario.ca/page/introduction-poultry-nutrition), [Ontario pasture production](https://files.ontario.ca/omafra-pasture-production-en-2022-12-08.pdf), [Ontario rabbit/farm guidance](https://files.ontario.ca/omafra-starting-farm-in-ontario-pub-61-en-2023-04-21.pdf), [Manitoba goat nutrition](https://www.gov.mb.ca/agriculture/livestock/goat/pubs/goats-and-their-nutrition.pdf), and [Penn State goose/poultry guidance](https://extension.psu.edu/geese-ducks-and-swans).

Evidence status: species outputs, feed shares and property co-product yields are bounded planning syntheses, not Grey-Bruce household trials.
