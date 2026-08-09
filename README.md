# ARC carrying-capacity model

This is an independent, reproducible reconstruction and audit of the quantitative model behind the Affordable Rural Communities one-hectare-per-adult carrying-capacity guideline. It preserves the historical Lyis values first, then adds explicitly labelled calculations for crop-energy spread, useful heat, yurt heating, farm-size ratios, and 1.0/1.2 ha scenarios.

The original files under `/home/htaf/lyis/` are read-only inputs to this repository and are not modified.

## Run it

Requirements: Node.js 20+ and the system `unzip` command. The ODS reader is dependency-free and extracts displayed values, formulas, sheet names, and cell addresses directly from the OpenDocument XML.

```sh
npm run all
```

Individual stages:

```sh
npm run extract   # source ODS -> data/source/
npm run build     # calculations -> data/derived/ and outputs/
npm test          # arithmetic and allocation checks
```

The main handoff files are:

- [`outputs/headline-results.md`](outputs/headline-results.md) — answers to the requested policy questions.
- [`outputs/summary.json`](outputs/summary.json) — machine-readable model summary.
- [`docs/source-audit.md`](docs/source-audit.md) — cell-level provenance and historical-source audit.
- [`docs/methodology.md`](docs/methodology.md) — calculation boundaries and interpretation.
- [`outputs/heating-budget.md`](outputs/heating-budget.md) — transparent yurt heat model.

## Historical canonical values

- Active 75 kg adult: 13.05 MJ/day and 4.7665125 GJ/year, from `paradise-garden.ods` → `j needs`.
- Historical allocation: 0.25 ha core food, 0.25 ha backup/perennial food, 0.50 ha willow short-rotation coppice.
- Historical diagram labels: approximately 5–7 GJ/year for each food quarter and 15 GJ/year gross for the half-hectare wood stream.

The crop workbook contains 15 usable gross-food-energy observations, from 13.02 to 60.30 GJ/ha, median 25.91 GJ/ha. The default new yurt model estimates 19.29 GJ/year useful space heating and therefore does not validate the historical half-hectare coppice allocation under its default assumptions.

## Source and model boundaries

Gross harvested food energy is not net edible energy after field losses, storage, processing, labour, or dietary balancing. Gross wood energy is not delivered room heat until heater efficiency is applied. The 1.0 ha figure remains a historical ARC policy shorthand; 1.2 ha is represented as a Grey-Bruce higher-resilience scenario based on the historical 6/5 growing-season ratio, not as a validated local yield model.

The heating calculation uses the Owen Sound MOE 1981–2010 climate normal of 4,031.9 heating degree-days below 18°C. The exact station and definition are documented in [`data/source/climate-heating.csv`](data/source/climate-heating.csv); current 1991–2020 normals should be checked before website publication.
