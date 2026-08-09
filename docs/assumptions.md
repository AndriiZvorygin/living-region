# Assumptions register

## Canonical current model

| assumption | central value | classification | evidence/basis |
|---|---:|---|---|
| Adult-equivalent food demand | 3.884 GJ/year | derived current scenario | Mean of representative low-active 35-year-old woman and man using Health Canada EER equations |
| Representative adult woman | 3.375 GJ/year | derived current scenario | 35 years, 65 kg, 165 cm, low activity |
| Representative adult man | 4.394 GJ/year | derived current scenario | 35 years, 80 kg, 178 cm, low activity |
| Low-input crop energy median | 29.891 GJ/ha/year | modelled synthesis distribution | Six eligible low-input synthesis rows; see `data/source/evidence-food-yields.csv` |
| Food storage loss | 10% | modelling assumption | Explicit reserve model; replace with measured system records |
| Wildlife loss | 10% | modelling assumption | Explicit site-management sensitivity |
| Seed/propagation loss | 3% | modelling assumption | Explicit planning allowance |
| Weather/crop-loss reserve | 20% | design/resilience allowance | Deliberate bad-year reserve, not an observed regional average |
| Emergency/community reserve | 10% | design/resilience allowance | Deliberate surplus policy choice |
| Yurt useful space heat | 21.054 GJ/year | derived central case | ECCC HDD plus explicit envelope, leakage, thermal bridge and gain assumptions |
| Wood energy | 19 GJ/dry tonne | external default | Government of Canada dry-basis wood higher heating value |
| Harvest/storage retention | 85% | modelling assumption | Converts standing/gross wood energy to usable stored fuel |
| Ordinary woody yield | 5 dry t/ha/year | modelled evidence synthesis | Long-term eastern/northern willow trial; not direct mixed Grey County measurement |

## Heating cases

The low/central/high cases are in `data/source/heating-assumptions.csv`. The geometry is the user-specified 9.1 m diameter and 65.6 m² floor area. R-values, glazing, infiltration, thermal bridges, gain factors and masonry-heater efficiency are design or modelling assumptions, not measurements or code claims. The 4,031.9 heating degree-days below 18°C are an ECCC Owen Sound 1981–2010 climate normal.

The central model uses R-20 walls, R-40 roof, R-30 floor, 8 m² of windows/doors, U=0.30 W/m²K, 0.35 ACH, a 1.15 opaque-envelope thermal-bridge multiplier, 0.85 net-demand factor and 75% seasonal heater efficiency. Sensitivity cases are intentionally broad and must be replaced by as-built measurements.

## Input intensity

`data/derived/input-intensity.csv` records synthetic fertilizer, imported manure/compost, biosolids, irrigation, crop-protection chemicals, mechanized energy, establishment work, annual purchased inputs and recycled nutrients. Commercial Ontario averages are benchmark evidence only. The central food rows are labelled low-input synthesis, not measured zero-input trials; organic evidence is not treated as near-zero input because the documented organic examples still use rotation, manure, machinery and labour.

## Historical boundary

The following values are legacy/reference only:

- 13.05 MJ/day = 4.7665125 GJ/year for the historical 75 kg adult;
- 0.25 ha core food + 0.25 ha backup/perennial food + 0.50 ha wood;
- 30 GJ/ha/year historical coppice;
- historical 1 ha/adult and 1.2 ha/person shorthand.

They are available under `outputs/legacy/` and `data/derived/legacy/`, but are not read by the current canonical build.
