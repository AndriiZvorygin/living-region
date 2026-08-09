# ARC yurt heating model

## Scope

The Lyis material inspected here describes an approximately 9 m interior Earth Lodge and says a high-efficiency home is needed, but it does not provide a yurt heat-loss calculation, R-values, HDD input, window area, air leakage or masonry-heater efficiency.

The requested 9.1 m diameter, approximately 65.6 m² four-season yurt is therefore modeled with explicit new assumptions. The geometry is a circular 2.4 m wall cylinder plus a 2.0 m roof rise; the roof is approximated as a cone. An 8 m² combined window/door area, R-20 walls, R-40 roof, an assumed R-30 floor, 0.35 ACH, 20°C indoors, and -20°C design outdoor temperature are used. The annual calculation uses **4,031.9 heating degree-days below 18°C**, from the Owen Sound MOE 1981–2010 ECCC station normal; the newer 1991–2020 station value should be verified before website publication.

## Result

| Quantity | Result |
|---|---:|
| Gross envelope loss before gains | 22.69 GJ/year |
| Net useful space-heating demand | **19.29 GJ/year** |
| Approximate design heat loss | 2.61 kW |
| Gross wood required at 75% seasonal efficiency | 25.72 GJ/year |
| Approximate dry-wood mass at 18 MJ/kg | 1429 kg/year |
| Cords/year at historical 15 GJ/cord | **1.71 cords/year** |
| Useful heat from historical 0.5 ha at 15 GJ gross | 11.25 GJ/year |
| Share of modeled demand supplied by 0.5 ha | 58.3% |
| Coppice area at historical 30 GJ gross/ha yield | **0.86 ha** |

Under these assumptions, 0.5 ha of coppice is **insufficient**, not merely marginal: it supplies 58.3% of modeled useful heat and would need roughly 0.86 ha at the historical yield. This conclusion is sensitive to the envelope, air leakage, passive gains, heater efficiency and the historical wood-yield assumption.

## Efficiency sensitivity

| Heater efficiency | Gross wood | Cords/year | Required coppice |
|---:|---:|---:|---:|
| 65% | 29.68 GJ | 1.98 | 0.99 ha |
| 75% | 25.72 GJ | 1.71 | 0.86 ha |
| 85% | 22.69 GJ | 1.51 | 0.76 ha |
| 90% | 21.43 GJ | 1.43 | 0.71 ha |

The historical graphic's 15 GJ is explicitly treated as gross fuel energy. It is never reported as useful room heat without applying the heater-efficiency parameter.
