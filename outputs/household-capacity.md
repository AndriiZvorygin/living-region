# Household capacity

Food and heat are calculated separately. Food demand uses current Health Canada EER equations; children are not counted as full adults. The canonical adult-equivalent is the mean of the representative low-active 35-year-old woman and man: 3.38 GJ/year for the representative woman, while the adult-equivalent definition is stored in `data/derived/health-canada-energy.json`.

Central ordinary-site results:

| household | food GJ/year | adult-equivalents | food area | heating area | mathematical minimum | robust system area |
|---|---:|---:|---:|---:|---:|---:|
| one_adult | 3.38 | 0.87 | 0.19 ha | 0.35 ha | 0.54 ha | **1.11 ha** |
| two_adults | 7.77 | 2 | 0.44 ha | 0.35 ha | 0.78 ha | **1.35 ha** |
| adult_plus_child | 5.85 | 1.51 | 0.33 ha | 0.35 ha | 0.68 ha | **1.25 ha** |
| adult_plus_two_children | 9.66 | 2.49 | 0.54 ha | 0.35 ha | 0.89 ha | **1.48 ha** |
| two_adults_plus_two_children | 14.05 | 3.62 | 0.79 ha | 0.35 ha | 1.14 ha | **1.78 ha** |

The mathematical minimum is food plus heating. The robust-system column adds explicit allowances for crop diversity/rotation, perennial soil/water buffers, fibre/habitat/wildlife protection and deliberate export production. Those allowances are design choices, not hidden biological constants.

The representative one-adult food mix passes the simple macro screening check in the derived JSON: {"protein":15.183,"fat":22.109,"carbohydrate":62.709} of food energy from protein/fat/carbohydrate and 87 g protein/day against the explicit 52 g/day screening threshold. This does not establish micronutrient sufficiency, amino-acid quality, dietary acceptability or seasonal availability.

The calorie model does not prove micronutrient sufficiency, animal-food substitution, labour feasibility, seed security or long-term soil nutrient balance. The planned perennial fruit/vegetable and ecological zones are therefore required functions even where they do not improve the calorie median.
