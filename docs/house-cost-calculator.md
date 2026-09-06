# House Cost Calculator

The public calculator is at `/house-cost`. It is a first-principles planning model for a resident-owned, four-season yurt dwelling. It starts with published yurt products and adds an itemized platform, additional assemblies, household systems, labour, taxes, contingency and financing.

## Calculation boundary

The authoritative engine is `packages/carrying-capacity/src/house-cost.mjs`. The generated contract is `packages/education-web/public/generated/house-cost/cost-model.json`; the report is generated with `npm run report:house-cost`.

```text
published yurt package
  + quantity-based platform and foundation prototype
  + additional openings, finishes, kitchen, bath, heating and ventilation
  + itemized water, sanitation, hot-water and electrical systems
  + paid labour, delivery, design, approvals, tax and contingency
  = dwelling cash construction budget
```

The public calculator opens at the **Yurt package** layer. This is a package-only price, not an occupancy-ready home: supplier-bundled insulation and installation remain inside the supplier price when the selected product includes them. The user can stop at four explicit stages: package-only, platform-supported shell, four-season structure and Basic completed ARC dwelling. The last stage is a selectable modest completion preset rather than the default opening price.

At the 30 ft reference diameter, the central cash layers are:

| Layer | Incremental cash | Running cash total |
| --- | ---: | ---: |
| Yurt package | `$36,404.00` | `$36,404.00` |
| Platform and foundation | `$8,218.49` | `$44,622.49` |
| Four-season completion | `$11,600.79` | `$56,223.28` |
| Basic household amenities | `$17,975.62` | `$74,198.90` |
| Project costs and optional upgrades | `$23,431.76` | `$97,630.66` |

The full cash total includes all five layers, tax and contingency. The default selected stage is the first layer, so its financing and outstanding requirements are shown separately. The supplier package is Yurts Canada's published installed all-season Base Kit; there is no unsupported claim that this evidence is a bare-material kit price.

The household owns the dwelling and can build equity in it. Land purchase, site lease, shared infrastructure and household operating costs remain outside this calculator.

## Market evidence

The source contract is `packages/carrying-capacity/data/source/house-cost-market-evidence.json`. It records supplier, diameter, price, currency, date, package inclusions and exclusions, plus a material catalogue with units, dates, evidence status and source URLs.

The central reference uses the published Yurts Canada 30 ft installed all-season Base Kit. The package includes the yurt frame, lattice, dome/ring, covers, insulation, liner, one standard door and mandatory supplier installation. It excludes the platform/floor, delivery, additional openings, utilities and climate control. The Out Factory Canadian rows are non-binding import estimates; Biome Canada publishes configurator options but requires a base quote.

The historical ARC `$51,000–$74,000`, central approximately `$61,000`, is preserved only as a historical comparison. It is not a calculation input, component rate or calibration target. Its exact historical integrated sum was `$61,240`: `$50,000` structural design-brief amount, `$5,940` water/plumbing/sanitation, `$2,000` hot water and `$3,300` electrical.

## Quantity accounting

The platform is explicitly labelled a preliminary circular deck-block concept, not an engineered foundation. It exposes blocks, pressure-treated beams, joists/blocking, tongue-and-groove deck, floor XPS, vapour/protective layer and connectors/anchors. Quantities are calculated from footprint or perimeter, purchase units and a stated waste factor. Soil, frost, uplift, snow, wind, anchorage, structural grade and municipal approval require qualified confirmation.

Each utility package row has one accounting home. Included supplier items are not repriced. Qualified installation and permit rows are separate. The ARC distributed package retains the earlier design intent: roof collection, first flush, storage, pump, filtration/UV/RO, compact PEX, private fixtures, composting sanitation, Class 2 greywater, seasonal hot water and a 400 Wh/day off-grid electrical system. Generic well/septic/grid and centralized servicing remain alternatives.

## Labour and financing

Owner-builder, mixed-labour and contractor-built modes show paid hours, owner hours, cash labour and imputed owner-labour value separately. Owner work reduces cash expenditure but remains part of economic cost.

`upfront_cash_required_cad` is the complete cash construction budget including tax and contingency. It is not the household's down payment. Financing exposes the initial contribution and financed principal separately and documents the distinction between loan term/renewal and amortization.

## Evidence and uncertainty

Published supplier and retailer prices are dated evidence. Battery storage, solar thermal, greywater, composting-toilet suitability, kitchen/bath allowances, delivery, tax/HST treatment, permits and engineering remain provisional or quotation-required where indicated. Interpolated diameters are labelled; extrapolated sizes are flagged. Larger spans, roof pitch and upper-floor structures use editable planning thresholds and are not approvals.

The display keeps the detailed component ledger, package inclusion matrix, platform BOM, procurement register, geometry audit, layout comparison, diameter sensitivity, labour modes and historical comparison expandable so the result can be independently reproduced.
