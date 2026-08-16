# Nutrient-Aware Food and Livestock Model

## Scope

The carrying-capacity model previously sized food land primarily from household food energy. Crop rows also carried protein, fat and carbohydrate quantities and a broad macro-range screen, but the model did not use an official age/sex/body-mass protein requirement, indispensable-amino-acid adequacy, human-edible feed competition, winter feed balance or species-specific edible output.

This milestone adds protein as a separate canonical constraint and adds an optional domestic-livestock layer. The plants-only result remains a valid baseline and is not replaced by livestock automatically.

## Canonical dependency chain

```text
member age / sex / body mass
  -> Health Canada energy requirement (MJ/day, GJ/year)
  -> household food-energy demand

member age / sex / body mass
  -> Health Canada protein DRI (g/day, kg/year)
  -> pooled household protein requirement

plants + optional animal products
  -> energy and protein supplied
  -> food-production area and establishment transition
```

The public contract and browser use `src/protein.mjs` and `src/livestock.mjs` through the package browser entry point. Formulas are not copied into the educational UI.

## Protein requirement

`src/protein.mjs` contains the Health Canada DRI reference bands and returns EAR/RDA values per kilogram, daily grams and annual kilograms for each member. Household protein is the sum of member requirements. This remains separate from EER: physical activity changes energy demand, while the protein DRI uses age, sex and body mass under the current model convention.

The contract also carries Health Canada's indispensable-amino-acid reference pattern as an evidence hook. This milestone reports total-protein adequacy separately; it does not fabricate DIAAS, PDCAAS or amino-acid scores where food-composition evidence is absent.

## Livestock boundary

`src/livestock.mjs` models rabbit meat, laying hens/eggs, meat chickens, grazing-biased geese and browse-biased goats. Each species exposes a bounded planning unit, edible output, feed dry matter, housing, water, labour, processing labour and manure. Outputs are edible meat or eggs, not liveweight.

Feed is separated into these classes:

- human-food-grade and human-edible surplus;
- crop by-products and garden culls;
- herbaceous forage, pasture and hay;
- leaf fodder, woody browse and food-forest understorey;
- invertebrates;
- purchased concentrate and mineral supplementation.

Each feed row carries dry matter, energy, protein, human-edible fraction, storage loss and source/evidence status. A mixed system consumes the finite property feed pool sequentially, so the same residue or browse stream cannot be allocated twice. Existing understorey, crop residues, culls, leaf fodder and browse are treated as bounded co-products/overlays within the modeled food area. Dedicated feed hectares are added when those finite streams are short.

## Ration cases

The livestock contract is version `1.1.0`. It exposes `conventional_reference`, `low_food_competition` and `arc_integrated`. The first two are explicitly non-ARC external-feed sensitivities. The ARC-integrated case prohibits purchased feed: it uses the modeled property feed supply first, then adds locally grown dedicated feed hectares for a deficit or marks the option infeasible. It is not a claim that arbitrary lawn grass, leaves or pasture can replace a balanced ration.

Seasonal accounting reports fresh growing-season feed, winter stored feed, storage loss, local dedicated feed production and any remaining deficit. Species production start years are carried into establishment rows; for example, the goat case does not receive its modeled output before its second year. Canonical livestock eligibility requires zero feed imports, zero unresolved deficit and complete winter-feed coverage.

## Current family-capacity result

For `two_adults_plus_three_children` on `ordinary_mesic`, the generated report is:

`packages/carrying-capacity/outputs/livestock-nutrient-comparison.md`

The plants-only row currently supplies approximately 157.8 kg protein/year against 77.3 kg/year of modeled RDA demand. It therefore remains the canonical baseline in this first protein pass. Rabbit, chicken/egg, chicken-meat, goose, goat and rabbit-plus-egg rows remain explicit alternatives with their feed competition and labour. The modeled establishment peak is larger than mature land because the perennial system is planted before reaching mature output.

These results do not establish complete nutritional adequacy. Total protein, indispensable amino acids, digestibility, micronutrients, food safety, animal health and local biomass inventories remain separate evidence questions.

## Evidence families

- [Health Canada macronutrient DRI tables](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-macronutrients.html)
- [Ontario introduction to poultry nutrition](https://www.ontario.ca/page/introduction-poultry-nutrition)
- [Ontario pasture production](https://files.ontario.ca/omafra-pasture-production-en-2022-12-08.pdf)
- [Ontario starting a farm guidance](https://files.ontario.ca/omafra-starting-farm-in-ontario-pub-61-en-2023-04-21.pdf)
- [Manitoba goat nutrition guidance](https://www.gov.mb.ca/agriculture/livestock/goat/pubs/goats-and-their-nutrition.pdf)
- [Penn State geese, ducks and swans guidance](https://extension.psu.edu/geese-ducks-and-swans)

Species output coefficients, feed shares and property co-product yields are explicitly marked planning syntheses bounded by government/extension guidance. They are not Grey-Bruce household trials and should not be treated as current farm performance without local validation.
