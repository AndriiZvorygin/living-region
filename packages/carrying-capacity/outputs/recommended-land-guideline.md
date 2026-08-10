# Recommended ARC land guideline

## Result

The evidence-based model supports a **household/site-adjusted carrying-capacity guideline**, not a universal hectares-per-adult-equivalent rule. Adult-equivalent is retained only as a food-energy normalization.

- Food-energy normalization: a representative low-active adult-equivalent requires 3.88 GJ/year; the representative woman and man require 3.38 and 4.39 GJ/year.
- The central low-input food-system synthesis produces 32.4 GJ/ha/year gross edible food energy before household loss/reserve deductions.
- Shared dwelling heating is 21.1 GJ/year useful heat in the central case. Its ordinary woody area is 0.35 ha; marginal woody area is 0.58 ha.

## Household/site recommendation

| household | favourable site | ordinary site | marginal site |
|---|---:|---:|---:|
| 1 adult | 0.61 ha min / 0.71 ha with surplus | 0.83 ha min / 0.93 ha with surplus | 2.17 ha min / 2.17 ha with surplus |
| 1 adult + 1 child | 0.83 ha min / 0.87 ha with surplus | 1.10 ha min / 1.12 ha with surplus | 2.95 ha min / 2.95 ha with surplus |
| 2 adults | 1.01 ha min / 1.01 ha with surplus | 1.31 ha min / 1.31 ha with surplus | 3.57 ha min / 3.57 ha with surplus |
| 2 adults + 1 child | 1.24 ha min / 1.24 ha with surplus | 1.60 ha min / 1.60 ha with surplus | 4.37 ha min / 4.37 ha with surplus |
| 2 adults + 2 children | 1.64 ha min / 1.64 ha with surplus | 2.06 ha min / 2.06 ha with surplus | 5.61 ha min / 5.61 ha with surplus |
| 2 adults + 3 children | 1.91 ha min / 1.91 ha with surplus | 2.39 ha min / 2.39 ha with surplus | 6.46 ha min / 6.46 ha with surplus |

The current ARC examples evaluate as follows:

| ARC planning example | favourable | ordinary | marginal |
|---|---|---|---|
| 1 adult → 1 ha | sufficient against mature ageing-in-place scenario; 0.29 ha | sufficient against mature ageing-in-place scenario; 0.07 ha | deficit against mature ageing-in-place scenario; -1.17 ha |
| 2 adults/family → 2 ha | sufficient against mature ageing-in-place scenario; 0.99 ha | sufficient against mature ageing-in-place scenario; 0.69 ha | deficit against mature ageing-in-place scenario; -1.57 ha |

Here “surplus/deficit” is allocation area minus the recommended total site area, which includes only the portion of the optional market target not accommodated by released annual land. The robust household minimum is reported separately. It is not a food adult-equivalent. The two-adult allocation is shared across the household; children are not silently assigned or denied a full hectare.

Recommended website language: “Plan productive land by household and site. Calculate food land from household food energy, calculate shared dwelling heating land from the building heat load and woody productivity, retain an explicit reserve, and treat soil/water, wildlife, fibre and habitat functions as overlapping with productive zones. Report optional export land separately. Use 1 ha for a one-adult household and 2 ha for a two-adult household only as planning examples; verify adequacy against the household/site performance table. Children increase food demand without being converted into linear hectare units.”

The historic 1.2 ha/person remains a provenance-only Lyis scenario. The current model may produce totals near that value for particular households/sites, but it does not validate the historical growing-season ratio.

## Succession through establishment

The annual/perennial transition is a separate time-dependent constraint. On the ordinary site, the central 30% loss/reserve case requires 0.15 ha of annual crops for one adult and 0.62 ha for two adults plus two children. Those annuals can be planted in the future food-forest footprint while young rows remain agriculturally usable; the model records that as overlap rather than adding hectares twice.

The central perennial mix requires 0.46 ha at maturity for one adult and 1.91 ha for two adults plus two children, after the same 30% loss/reserve case. Within the current ARC allocations, the food-production envelopes after shared heat are 0.65 ha and 1.65 ha respectively. This is why a household/site test is necessary: annuals can bridge establishment, but mature full perennial replacement and resilience/ecological land may not fit the same allocation.

The transition outputs in `outputs/food-forest-transition.md` and `outputs/household-transition-scenarios.md` should be read alongside this land guideline. They do not convert the result into hectares per adult-equivalent.

## Ageing-in-place refinement

The mature food-system objective is not maximum calorie density and not elimination of annual crops. The solved ordinary-site plants-only trade-off selects 70% perennial food calories for one adult and 70% for two adults plus two children: the lowest tested share meeting the explicit reduction, annual-resilience and macro-screen constraints. The 75% case remains a sensitivity comparison. On the ordinary site, the one-adult annual-crop area falls from 0.15 ha in Year 1 to 0.04 ha at the solved mature share, a 70% reduction in annual cultivation area. The household/site rows in outputs/ageing-in-place-labour.json report the transition checkpoints; the solved land/labour table is in outputs/mature-food-system-canonical.md.

The low-replanting metric is reported separately from perennial calories. For plants-only food it is the same percentage; livestock can contribute only to the extent that its food output is credited to perennial/on-property feed. Optional animals add protein and fat diversity but also add feed land, purchased feed, winter storage, manure handling and recurring labour. The canonical recommendation therefore remains plants plus a retained annual supplement, with livestock as a household choice rather than an ARC requirement.

## What is mathematically required versus allowed

Mathematically required: household food demand divided by the chosen low-input food-system yield, plus audited useful heating demand divided by sustainable woody energy yield.

Design/resilience allowances: crop diversity and rotations; fruit and vegetable nutrition; perennial backup; soil and water interception; nutrient recycling; wildlife protection; fibre/materials; habitat; establishment losses; bad-year reserve; community support; and deliberate saleable surplus.

The largest remaining uncertainties are measured low-input Grey-Bruce yields, food-system nutritional completeness, current ECCC normals, as-built yurt leakage/thermal bridges, sustainable mixed-woody yield, wildlife losses, labour and cash margins.
