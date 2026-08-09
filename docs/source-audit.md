# Source audit and provenance

Audit date: 2026-08-08. The files below were inspected in place. No file under `/home/htaf/lyis/` was modified. ODS extraction is performed by `scripts/ods-utils.mjs`, which reads `content.xml` from the ODS ZIP and preserves displayed values, formulas, sheet names, row numbers, and cell addresses.

## Primary files

| File | Type | Audit result |
|---|---|---|
| `/home/htaf/lyis/pcan/paradise-garden.ods` | ODS | Main food-energy workbook; six sheets audited. |
| `/home/htaf/lyis/sren/Farm_size_to_yield.ods` | ODS | Farm-size shares and formula-derived relative outputs. |
| `/home/htaf/lyis/pfet/hfoc/farm_size_to_yield.png` | PNG, 605×340 | Presentation chart; matching SVG exposes its Our World in Data source URL. |
| `/home/htaf/lyis/pfet/hfoc/hectare_breakdown.png` | PNG, 491×567 | Presentation diagram; matching SVG supplies machine-readable labels. |
| `/home/htaf/lyis/pfet/hfoc/ghectare_breakdown_concentric.png` | PNG, 454×554 | Concentric presentation diagram; matching SVG in the SREN presentation directory supplies labels. |
| `/home/htaf/lyis/tcas/WiartonWomensInstitute/Food_forest_plan.png` | PNG, 795×1124 | Presentation plan; companion ODS supplies plant, spacing/color, and purchase data. |
| `/home/htaf/lyis/tcas/WiartonWomensInstitute/Food_forest_plan.ods` | ODS | Three sheets audited; contains layout/plant/purchase data, not carrying-capacity energy formulas. |
| `/home/htaf/lyis/pfet/transition_plan.html` | HTML | Historical one-global-hectare and 24 GJ/ha shorthand; heating section is qualitative and solar figures are electrical, not biological capture. |

## `paradise-garden.ods`

### `j needs`

| Cell | Variable | Displayed value | Units | Formula/status |
|---|---|---:|---|---|
| B3 | reference body mass | 50 | kg | input |
| C3 | reference daily food energy | 8,700 | kJ/day | input |
| D3 | reference annual food energy | 3.177675 | GJ/year | `of:=[.C3]*365.25/1000/1000` |
| E3 | reference monthly energy | 264.80625 | MJ/month | `of:=[.D3]/12*1000` |
| F3 | reference weekly energy | 60.9 | MJ/week | `of:=[.C3]*7/1000` |
| B4 | canonical body mass | 75 | kg | input |
| C4 | canonical daily food energy | 13,050 | kJ/day | `of:=[.C3]/[.$B$3]*[.$B4]` |
| D4 | canonical annual food energy | 4.7665125 | GJ/year | `of:=[.D3]/[.$B$3]*[.$B4]` |
| E4 | canonical monthly energy | 397.209375 | MJ/month | `of:=[.E3]/[.$B$3]*[.$B4]` |
| F4 | canonical weekly energy | 91.35 | MJ/week | `of:=[.F3]/[.$B$3]*[.$B4]` |

The source also has headers for human, weight, kJ/day, GJ/year, MJ/month, MJ/week, protein, and fats in A2:H2. The 75 kg case is the canonical historical active adult. The independently calculated kcal equivalent is `13,050 / 4.184 = 3,120 kcal/day`.

### `plant nutrient`

Source range A2:E32: crop/species, carbohydrate fraction, fat fraction, protein fraction, and kJ/100 g. The workbook has no separate edible-fraction field. The following rows are the quantitative nutrient inputs used by the yield sheets:

| Source row | Crop/species | Carbs | Fats | Protein | Energy |
|---:|---|---:|---:|---:|---:|
| 3 | black walnut | 6% | 80% | 14% | 2,591 kJ/100g |
| 4 | N. hazelnut | 11% | 81% | 8% | 2,629 |
| 5 | pine nut | 8% | 85% | 7% | 2,633 |
| 6 | chestnut | 89% | 4% | 7% | 1,544 |
| 7 | buckwheat | 79% | 8% | 13% | 1,448 |
| 8 | rye | 81% | 6% | 13% | 1,415 |
| 9 | wildrice | 82% | 3% | 15% | 1,494 |
| 10 | lupine | 44% | 22% | 34% | 1,553 |
| 11 | sunflower potato | 90% | 0% | 10% | 305 |
| 15 | autumn olive | 90% | 3% | 7% | 284 |
| 16 | grapes | 93% | 4% | 3% | 288 |
| 17 | apples | 95% | 3% | 2% | 217 |
| 18 | apios americana | 42% | 18% | 40% | 360 |
| 31 | pear cactus | 84% | 10% | 6% | 172 |
| 32 | cassava | 97% | 1% | 2% | 670 |

Bur oak (row 14) and amaranth (row 19) have nutrient fractions but no energy-density value, so they are not fabricated into the 15-observation energy distribution. Rows below the directly used examples are preserved in `data/source/paradise-garden-extracted.json`.

### Yield sheets and formulas

The yield sheets use yield in tonnes/ha, then calculate GJ/ha and MJ/100 m² from the nutrient-sheet kJ/100 g value. The formula pattern is `of:=[.Brow]*10000*['plant nutrient'.Erow]/1000/1000` for GJ/ha and `of:=[.Drow]*0.01*1000` for MJ/100 m².

| Sheet | Source rows included | Yield and derived GJ/ha |
|---|---|---|
| `tree yields` | 3 black walnut; 4 N. hazelnut; 5 pine nut; 6 chestnut; 10 autumn olive; 11 grapes; 12 apples; 13 apios americana | 1→25.91; 1→26.29; 1→26.33; 2→30.88; 7→19.88; 6→17.28; 6→13.02; 7→25.20 tonnes/ha→GJ/ha |
| `annual yields` | 3 buckwheat; 4 rye; 5 lupine | 1.5→21.72; 2→28.30; 2→31.06 tonnes/ha→GJ/ha |
| `perrenial yields` (workbook spelling) | 3 wildrice; 4 sunflower potato; 5 cactus pear; 6 cassava | 1→14.94; 12→36.60; 12→20.64; 9→60.30 tonnes/ha→GJ/ha |

Useful source fields, including original formulas, are normalized in [`data/source/crops.csv`](../data/source/crops.csv). Blank yield/energy cells and the source `#DIV/0!` in the cactus-pear seed-return field are preserved rather than repaired into food-energy values.

The `Seedling cost` sheet contains plant costs and source strings such as `grimonut.com`, `treetime.ca`, and `bambooplants.ca`. It is provenance context for establishment cost, not a yield or carrying-capacity calculation.

## `Farm_size_to_yield.ods`

Sheet `Sheet1`, range A1:F12:

| Source row | Farm class | Land % | Crop land % | Food crop % | Crop/land formula result | Food-crop/land formula result |
|---:|---|---:|---:|---:|---:|---:|
| 2 | ≤1 | 12 | 12 | 15 | 1.00 | 1.25 |
| 3 | ≤2 | 24 | 29 | 32 | 1.21 | 1.33 |
| 4 | ≤5 | 32 | 41 | 46 | 1.28 | 1.44 |
| 5 | ≤10 | 40 | 51 | 55 | 1.28 | 1.38 |
| 6 | ≤20 | 49 | 54 | 59 | 1.10 | 1.20 |
| 7 | ≤50 | 57 | 59 | 63 | 1.04 | 1.11 |
| 8 | ≤100 | 65 | 65 | 69 | 1.00 | 1.06 |
| 9 | ≤200 | 72 | 81 | 85 | 1.13 | 1.18 |
| 10 | ≤500 | 80 | 85 | 87 | 1.06 | 1.09 |
| 11 | ≤1000 | 88 | 95 | 97 | 1.08 | 1.10 |
| 12 | all size | 100 | 100 | 100 | 1.00 | 1.00 |

E2:E12 uses `of:=[.C2]/[.B2]` copied down; F2:F12 uses `of:=[.D2]/[.B2]` copied down. The embedded chart source text is `data from: https://ourworldindata.org/farm-size`. The exact class construction and extraction date are not documented in the workbook.

## Food forest plan

`Food_forest_plan.ods` has sheets `2024-07-purchase`, `2024-07 existing`, and `Plant Colors`.

- `2024-07-purchase` contains plant names, prices, quantities, and totals. D2:D15 uses quantity × price; D16 is `SUM([.D2:.D15])`, D17 is 10% of subtotal, and D18 is subtotal minus discount. Displayed totals are 200, 20, and 180 currency units respectively.
- `2024-07 existing` lists existing hazelnut 1, serviceberry 2, grape 1, and currants 3.
- `Plant Colors` contains species/common names, height and diameter ranges, colors, and a diagram scale column G. G2:G10 uses formulas such as `=3.5*3`, `=2*3`, `=15*3`, and so on. These are layout/legend quantities, not energy yields.

The full cell-level extract is [`data/source/food-forest-plan-extracted.json`](../data/source/food-forest-plan-extracted.json); the PNG is treated as a visual rendering of this plan.

## Diagram and HTML audit

The PNG diagrams do not contain spreadsheet formulas. Their matching SVGs were inspected for text labels:

- `hectare_breakdown.svg`: core food 0.25 ha ~5–7 GJ; backup food 0.25 ha ~5–7 GJ; willow SRC 0.5 ha; 1 cord ~15 GJ; active 75 kg human food ~4–5 GJ/year.
- `sren/2022-08-sren/hfoc/hectare_breakdown_concentric.svg`: core food 0.25 ha ~5–7 GJ; food forest 0.25 ha 5–7 GJ; wood coppice 0.5 ha ~15 GJ; active 75 kg human ~4–5 GJ/year.

These are presentation labels, not formula-linked calculations. They are normalized in `data/source/historic-hectare-model.csv` and `data/source/wood-energy.csv`. The prose file `/home/htaf/lyis/sren/long_term_rural/long_term_rural.tex` additionally says that half-hectare willow SRC yields one cord and describes this as barely enough for heating/cooking in a high-efficiency home; it also contrasts this with contemporary homes using roughly 4–7 cords. No yield trial or building heat-loss formula is included.

`/home/htaf/lyis/pfet/transition_plan.html` lines 111–113 says that a six-month growing season and at least 500 mm rainfall allow one global hectare to meet one person's food and firewood needs, using roughly 24 GJ/ha as a shorthand. The same file's heating section (around lines 622–628) recommends passive design and high-efficiency firewood furnaces but gives no yurt heat-loss calculation. Its solar sections quantify household/electronic electricity (for example 4.253 kWh/day, 4 peak sun-hours, and PV sizing), not photosynthetic energy capture; those figures are excluded from the biological land balance.

Related historical notes inspected include `/home/htaf/lyis/pfet/2024-lyis.tex` lines 69–81 (1.2 ha/person, 0.25 ha food, and the concentric planting sequence), `/home/htaf/lyis/pfet/hfp-numbers.tex` line 36 (1.2 ha/person for food, firewood, and surplus), and `/home/htaf/lyis/pfet/oil-and-after.tex` line 84 (six-month global hectare, half wood, quarter food, quarter surplus, five-month Grey County → 1.2 ha). These statements are retained as historical prose assumptions, not silently promoted to measured local productivity.

## External climate input

The heating extension uses the Owen Sound MOE 1981–2010 climate normal, annual heating degree-days below 18°C = 4,031.9. The station page is [Environment and Climate Change Canada: Owen Sound MOE climate normals](https://climate.weather.gc.ca/climate_normals/results_1981_2010_e.html?climate_id=6116132&coordsStn=44.745833%7C-81.107222%7COWEN+SOUND+MOE&optProxType=station&searchType=stnProx&txtCentralLatMin=0&txtCentralLatSec=0&txtCentralLongMin=0&txtCentralLongSec=0&txtRadius=25), and the definition is [ECCC's degree-days glossary](https://climate.meteo.gc.ca/glossary_e.html). The exact value, URL, and status are recorded in `data/source/climate-heating.csv`.

## Phase 2 evidence boundary

The historical audit above is retained for provenance only. It is not the evidence base for the current ARC recommendation. Current quantitative sources and their classifications are recorded in [`data/source/evidence-sources.csv`](../data/source/evidence-sources.csv), [`data/source/evidence-food-yields.csv`](../data/source/evidence-food-yields.csv), [`data/source/woody-yield-evidence.csv`](../data/source/woody-yield-evidence.csv), and [`data/source/heating-assumptions.csv`](../data/source/heating-assumptions.csv).

| Current variable | Canonical source/assumption | Geography/site | Status |
|---|---|---|---|
| Human food energy | Health Canada EER equations | Canada reference population equations | Current derived model; profiles and equations are checked in |
| Food composition | 2026 Canadian Nutrient File | Canada food records | Current composition data; checked-in subset |
| Commercial crop benchmark | Statistics Canada Tables 32-10-0359-01 and 32-10-0358-01 | Ontario, 2020–2024 | Measured benchmark, excluded from low-input central case |
| Low-input food yield | Explicit fractions of Ontario benchmark anchored by Organic Council relationships where available | Ontario/organic comparator | Modelled synthesis, central but not a direct zero-input measurement |
| Woody biomass | Peer-reviewed long-term eastern/northern willow evidence | Eastern/northern temperate sites | Marginal/ordinary/favourable band synthesis; mixed Grey County yield remains unresolved |
| Wood energy | Government of Canada dry-basis default | Canada | 19 GJ per dry tonne gross |
| Yurt climate | ECCC Owen Sound MOE normal | Owen Sound, 1981–2010 | Measured climate normal; newer normal requires verification |
| Yurt envelope/leakage | Explicit low/central/high assumptions | ARC design scenario | Not measured; never presented as an as-built result |

The current model intentionally excludes historical 4.77 GJ/adult, 30 GJ/ha/year coppice, 0.25 + 0.25 + 0.50 ha allocation, and historical 1.0/1.2 ha policy arithmetic from canonical inputs. Those values are listed in `outputs/summary.json` under `historical` and in `outputs/legacy/`.

## Phase 2 extension: labour, perennial protein and livestock

The ageing-in-place extension adds three checked-in source/assumption tables:

| file | contents | canonical status |
|---|---|---|
| `data/source/food-production-labour.csv` | labour tasks, establishment versus recurring hours, annual soil preparation, planting, weeding, watering, harvest, pruning, mechanization and older-resident physical intensity | evidence-informed planning classification; hours are not a time-and-motion study |
| `data/source/perennial-protein-evidence.csv` | honey locust, Siberian peashrub/Caragana, hazelnut, heartnut/walnut, chestnut and perennial vegetables/herbaceous legumes | current evidence boundary; only rows marked eligible with a yield are credited to the current perennial mix |
| `data/source/livestock-assumptions.csv` | optional six-hen and conservative rabbitry output, feed dry matter/protein/energy, property feed fraction, winter storage, manure and labour | explicit modelled household planning cases; not ARC requirements |

The honey-locust row links USDA Forest Service pod/protein evidence and Ontario soil/moisture tolerance. The Caragana row links USDA plant-material references for hardiness and soil adaptation. Neither row is converted into canonical human protein yield: food safety, processing, cultivar, harvestability and representative Grey-Bruce yield remain unresolved. The livestock rows link Ontario poultry nutrition and rabbit-production guidance plus University of Minnesota/Penn State small-flock guidance; feed and output quantities remain conservative planning assumptions rather than local production measurements.
