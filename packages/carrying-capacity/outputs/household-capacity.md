# Baseline household capacity (before ageing-in-place mature constraint)

Food and heat are calculated separately. Food demand uses current Health Canada EER equations; children are not counted as full adults. The adult-equivalent is a **food-energy normalization only**. It is not multiplied into total land, because dwelling heat and ecological/infrastructure functions are shared at the household/site level.

The ARC comparison allocation is 1 ha for a one-adult household and 2 ha for a two-adult household, regardless of the number of children. Children increase the household food-demand component.

| site | household | food GJ/year | food adult-equivalents | mathematical food area | heating area | resilience/surplus allowance | total robust area | ARC allocation | land surplus/deficit | food surplus/deficit GJ |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Favourable/wetter | 1 adult | 3.38 | 0.87 | 0.17 ha | 0.18 ha | 0.57 ha | **0.92 ha** | 1 ha | **0.08 ha** | 12.73 |
| Favourable/wetter | 1 adult + 1 child | 5.85 | 1.51 | 0.30 ha | 0.18 ha | 0.57 ha | **1.05 ha** | 1 ha | **-0.05 ha** | 10.26 |
| Favourable/wetter | 2 adults | 7.77 | 2 | 0.40 ha | 0.18 ha | 0.57 ha | **1.14 ha** | 2 ha | **0.86 ha** | 27.92 |
| Favourable/wetter | 2 adults + 1 child | 10.24 | 2.64 | 0.52 ha | 0.18 ha | 0.57 ha | **1.27 ha** | 2 ha | **0.73 ha** | 25.45 |
| Favourable/wetter | 2 adults + 2 children | 14.05 | 3.62 | 0.72 ha | 0.18 ha | 0.57 ha | **1.47 ha** | 2 ha | **0.53 ha** | 21.63 |
| Favourable/wetter | 2 adults + 3 children | 16.68 | 4.29 | 0.85 ha | 0.18 ha | 0.57 ha | **1.60 ha** | 2 ha | **0.40 ha** | 19.01 |
| Ordinary mesic | 1 adult | 3.38 | 0.87 | 0.19 ha | 0.35 ha | 0.57 ha | **1.11 ha** | 1 ha | **-0.11 ha** | 8.24 |
| Ordinary mesic | 1 adult + 1 child | 5.85 | 1.51 | 0.33 ha | 0.35 ha | 0.57 ha | **1.25 ha** | 1 ha | **-0.25 ha** | 5.77 |
| Ordinary mesic | 2 adults | 7.77 | 2 | 0.44 ha | 0.35 ha | 0.57 ha | **1.35 ha** | 2 ha | **0.65 ha** | 21.64 |
| Ordinary mesic | 2 adults + 1 child | 10.24 | 2.64 | 0.58 ha | 0.35 ha | 0.57 ha | **1.49 ha** | 2 ha | **0.51 ha** | 19.17 |
| Ordinary mesic | 2 adults + 2 children | 14.05 | 3.62 | 0.79 ha | 0.35 ha | 0.57 ha | **1.71 ha** | 2 ha | **0.29 ha** | 15.36 |
| Ordinary mesic | 2 adults + 3 children | 16.68 | 4.29 | 0.94 ha | 0.35 ha | 0.57 ha | **1.85 ha** | 2 ha | **0.15 ha** | 12.74 |
| Marginal/shallow-rocky | 1 adult | 3.38 | 0.87 | 0.38 ha | 1.05 ha | 0.57 ha | **2 ha** | 1 ha | **-1 ha** | -3.85 |
| Marginal/shallow-rocky | 1 adult + 1 child | 5.85 | 1.51 | 0.66 ha | 1.05 ha | 0.57 ha | **2.28 ha** | 1 ha | **-1.28 ha** | -6.32 |
| Marginal/shallow-rocky | 2 adults | 7.77 | 2 | 0.88 ha | 1.05 ha | 0.67 ha | **2.60 ha** | 2 ha | **-0.60 ha** | 0.63 |
| Marginal/shallow-rocky | 2 adults + 1 child | 10.24 | 2.64 | 1.15 ha | 1.05 ha | 0.67 ha | **2.88 ha** | 2 ha | **-0.88 ha** | -1.84 |
| Marginal/shallow-rocky | 2 adults + 2 children | 14.05 | 3.62 | 1.58 ha | 1.05 ha | 0.67 ha | **3.31 ha** | 2 ha | **-1.31 ha** | -5.65 |
| Marginal/shallow-rocky | 2 adults + 3 children | 16.68 | 4.29 | 1.88 ha | 1.05 ha | 0.67 ha | **3.60 ha** | 2 ha | **-1.60 ha** | -8.28 |

The mathematical minimum is food plus shared dwelling heating. The robust-system column adds explicit allowances for crop diversity/rotation, perennial soil/water buffers, fibre/habitat/wildlife protection and deliberate export production. Those allowances are design choices, not hidden biological constants.

This is the pre-ageing baseline capacity layer. The canonical mature plants-only land/labour recommendation, which adds the solved perennial-share and recurring-labour constraints, is in outputs/mature-food-system-canonical.md.

The ordinary representative one-adult food mix passes the simple macro screening check in the derived JSON: {"protein":15.183,"fat":22.109,"carbohydrate":62.709} of food energy from protein/fat/carbohydrate and 87 g protein/day against the explicit 52 g/day screening threshold. This does not establish micronutrient sufficiency, amino-acid quality, dietary acceptability or seasonal availability.

The calorie model does not prove micronutrient sufficiency, animal-food substitution, labour feasibility, seed security or long-term soil nutrient balance. The planned perennial fruit/vegetable and ecological zones are therefore required functions even where they do not improve the calorie median.
