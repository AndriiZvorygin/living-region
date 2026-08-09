# Human food-energy reconstruction

The canonical historical case is the `j needs` sheet in `paradise-garden.ods`: a 75 kg person with 13,050 kJ/day. The workbook formula for annual energy is `[.C3]*365.25/1000/1000` for the 50 kg reference row, then the 75 kg row scales that result by body mass.

| Case | Body mass | Daily energy | Annual energy | kcal/day |
|---|---:|---:|---:|---:|
| lower/source 50 kg | 50 kg | 8.700 MJ | 3.177675 GJ | 2079 |
| canonical historical active 75 kg | 75 kg | 13.050 MJ | 4.766513 GJ | 3119 |
| higher linear sensitivity 100 kg | 100 kg | 17.400 MJ | 6.355350 GJ | 4159 |

The 100 kg row is a sensitivity extrapolation from the workbook's linear scaling, not an original source input. `365.25` days/year is retained because it is present in the original formula.
