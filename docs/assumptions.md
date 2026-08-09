# Assumptions register

## Historical inputs preserved

| Assumption | Value | Status |
|---|---:|---|
| Canonical adult mass | 75 kg | Historical workbook input |
| Food energy | 13,050 kJ/day | Historical workbook derived by mass scaling |
| Annual conversion | 365.25 days/year | Historical workbook formula |
| Core food allocation | 0.25 ha | Historical diagram label |
| Backup/perennial food allocation | 0.25 ha | Historical diagram label |
| Willow short-rotation coppice | 0.50 ha | Historical diagram label |
| Core and backup food energy | ~5–7 GJ/year each | Historical diagram label |
| Willow gross energy | ~15 GJ/year | Historical diagram label |
| Wood energy | ~15 GJ/cord | Historical diagram label |
| 1.2 ha/person | 6/5 growing-season scaling | Historical prose argument, not local yield validation |

## New model assumptions

| Assumption | Default | Why it matters |
|---|---:|---|
| Heater seasonal efficiency | 75% | Converts gross wood fuel into useful heat |
| Yurt wall R-value | R-20 | Envelope transmission |
| Yurt roof R-value | R-40 | Envelope transmission |
| Yurt floor R-value | R-30 | No historical floor value was found |
| Window/door area | 8 m² | Glazing and door losses |
| Window/door U-value | 0.30 W/m²K | Glazing/door losses |
| Air leakage | 0.35 ACH | Ventilation/infiltration losses |
| Indoor temperature | 20°C | Heating setpoint |
| Design outdoor temperature | −20°C | Design heat-loss check |
| HDD base | 18°C; 4,031.9 C-degree-days | Owen Sound MOE 1981–2010 normal |
| Net demand factor | 0.85 | Approximate internal/passive-gain allowance |
| Dry wood energy | 18 MJ/kg | Approximate dry-wood energy content; verify locally |

These assumptions are editable in `scripts/calc-heating.mjs` and are written to `data/derived/heating.json`.

## Unresolved or weak assumptions

- The crop spreadsheet has no consistent edible fraction, harvest-loss, storage-loss, maturity, soil, weather, water, or input basis.
- The crop values are not a nutritionally complete diet. Gross energy does not prove adequate protein, fat, micronutrients, or seasonal storage.
- The half-hectare willow number is a diagram/prose assumption, not a measured yield series in the audited files.
- The 15 GJ/cord value is not tied to a species, moisture content, cord definition, or stove delivery efficiency.
- The yurt heating model lacks measured infiltration, thermal-mass, occupancy and solar-gain data.
- The 1.2 ha value is based on a simple growing-season ratio and not a weather-responsive crop model.
- The farm-size data's class definitions and extraction metadata are not fully documented in the source workbook.
- The audited sources contain solar-electricity calculations but no quantitative photosynthetic solar-capture efficiency that belongs in this land-energy model.
