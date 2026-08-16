# Carrying-Capacity Nutrition And Livestock Audit

Generated from the canonical Living Region carrying-capacity APIs.

## Pre-existing model

The food-area solver was primarily energy based. It already carried crop protein, fat and carbohydrate outputs and a total-protein screening value, but it did not constrain indispensable amino acids, food-form micronutrients, digestibility quality, iodine, B12 or essential-fat adequacy. Livestock was a separate option that reduced plant energy demand and added a finite feed ledger.

The canonical feed boundary is now property production only. Feed imports are zero; finite co-products are consumed once; winter storage losses are explicit; and any remaining ration requirement becomes dedicated feed land or makes the row infeasible.

## Nutrition layers

The canonical API now exposes:

- Health Canada age/sex protein demand and the age-1-plus indispensable-amino-acid reference pattern;
- two separate amino-acid results: a protein-quality pattern score in mg amino acid/g dietary protein, and absolute annual intake versus a derived household planning requirement;
- CNF 2026 food-form profiles for the modeled annual staples and the available rabbit, egg and goose forms;
- key DRI planning references for B12, vitamin D, vitamin A, folate, vitamin C, calcium, iron, zinc, iodine, selenium, magnesium, potassium and choline;
- linoleic and alpha-linolenic planning targets expressed as shares of food energy;
- property-food supply separately from external non-food inputs such as iodized salt, supplements, fortification and veterinary minerals.

Missing food-form values remain unresolved. They are not silently replaced with a generic food profile. No digestibility adjustment is applied unless a defensible food-specific value is available; raw amino-acid pattern, absolute intake and digestibility-adjusted quality are separate fields.

### Amino-acid interpretation

The Health Canada pattern is a quality reference, not an absolute household intake target. For each amino acid the API reports:

- `actual_intake_g_year` from modeled food;
- `requirement_g_year`, derived by applying the reference pattern to each member's Health Canada protein RDA;
- `absolute_adequacy_ratio`;
- `quality_pattern_ratio` in mg/g dietary protein divided by the reference pattern;
- digestibility status and adjusted ratio, which remain unresolved for the current food forms.

Therefore a plant diet can have a lysine pattern score below 100% while still supplying more lysine than the household's derived absolute requirement. The public interface must never describe a pattern score as “percent of lysine requirement.”

## Optimizer boundary

The former screening comparison minimized:

`plant food area + dedicated feed land`

That is retained as `lowest_food_feed_area`, but it is not the final establishment or mature productive-land objective. The report now publishes separate winners for food/feed area, peak establishment land, mature land, livestock labour and human-edible-feed competition. The full household transition is authoritative for peak and mature land.

The current optimizer requires energy, total protein, absolute amino-acid adequacy, zero imported feed, complete winter feed and self-replacing animals for livestock rows. It exposes separate objectives for food/feed area, peak establishment land, mature land, labour, external nutrient dependence, human-edible-feed competition, nutritional completeness and system complexity. Pareto-efficient rows are retained; there is no universal `best` food system.

Plants-only remains the low-complexity policy baseline because it meets the current food-energy, total-protein, absolute amino-acid and feed-self-sufficiency screens with no livestock housing, processing or reproductive management. It still requires a disclosed small external B12 input in the current food forms, and iodine remains unresolved. This does not claim plants-only minimizes every possible objective.

## Self-replacing livestock

The canonical chicken row is an integrated, true-breeding dual-purpose flock. It includes breeding hens and roosters, fertile eggs, hatch and juvenile survival, replacement females and males, surplus cockerels, cull birds, gross eggs minus incubation/losses, feed for every generation, and zero recurring chick/pullet purchases. Chantecler is used as a conservative cold-climate reference range; Plymouth Rock, Rhode Island Red and Sussex remain comparison candidates. The breed/reproductive ledger is a bounded planning synthesis requiring local flock validation.

The breed boundary is explicit rather than a hidden broiler substitution: the comparison contract records natural reproduction, cold hardiness, locomotion/range use, forage behaviour, growth rate, feed requirement and the unresolved status of breed-specific heat tolerance. Heritage/alternative-production guidance and the slow-growing free-range study support treating outdoor mobility and range use as distinct from fast-growing commercial broiler performance; neither source is used as a local Grey County intake or carcass-yield trial. No commercial broiler feed-conversion or carcass coefficient enters the canonical flock.

Fast-growing commercial-style meat birds remain a non-canonical sensitivity and cannot win the ARC optimizer because their production cycle is not self-replacing.

Rabbits, geese and goats also carry explicit breeding/replacement ledgers. Goat food composition remains unresolved in the current nutrient layer.

## Current family-capacity reading

For two adults plus three dependent children on ordinary/mesic land, the current generated comparison reports:

- plants-only: 1.815 ha peak and 1.522 ha mature;
- self-replacing rabbits: 1.828 ha peak and 1.538 ha mature;
- self-replacing dual-purpose chicken flock: 1.895 ha peak and 1.616 ha mature;
- self-replacing geese: 2.089 ha peak and 1.801 ha mature;
- self-replacing goats: 2.596 ha peak and 2.309 ha mature.

Plants-only remains lowest on the current peak, mature, food/feed-screening and labour objectives. The modeled lysine quality pattern is about 97% for the family plants-only mix, but absolute lysine intake remains above the derived household requirement. Self-replacing rabbits add approximately 0.013 ha peak and 0.016 ha mature in exchange for on-property B12 coverage and additional animal-food diversity, at approximately 225 additional labour hours/year. That is a household trade-off, not a reason to replace the canonical plants-only baseline. The chicken option has substantially higher human-edible-feed competition than rabbits in the current bounded ration.

The minimum rabbit result is a discrete self-replacing colony, not a fractional nutrient patch. The current minimum unit is four breeding does and one buck; its output may exceed the amount needed merely to close B12, which is why rabbit production is presented as an explicit scale/trade-off choice.

These values are planning results, not Grey-Bruce trials. They should remain labelled as evidence-bounded synthesis in public outputs.

## Sources

- [Health Canada DRI tables](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-elements.html)
- [Health Canada protein reference values](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-macronutrients.html)
- [Health Canada DRI reference pattern table](https://www.canada.ca/content/dam/hc-sc/migration/hc-sc/fn-an/alt_formats/hpfb-dgpsa/pdf/nutrition/dri_tables-eng.pdf)
- [Canadian Nutrient File](https://open.canada.ca/data/en/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109)
- [Heritage breeds in alternative poultry production](https://afs.mgcafe.uky.edu/research/poultry/use-heritage-breeds-alternative-poultry-production)
- [Ranging behaviour in slow-growing free-range chickens](https://pmc.ncbi.nlm.nih.gov/articles/PMC8858978/)
- [Ontario poultry nutrition guidance](https://www.ontario.ca/page/introduction-poultry-nutrition)
