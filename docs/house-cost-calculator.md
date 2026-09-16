# House Cost Calculator

The public calculator is at `/house-cost`. It is a first-principles planning model for a resident-owned, four-season yurt dwelling. It starts with published yurt products and adds an itemized platform, additional assemblies, household systems, labour, taxes, contingency and financing.

## Calculation boundary

The authoritative engine is `packages/carrying-capacity/src/house-cost.mjs`. The generated contract is `packages/education-web/public/generated/house-cost/cost-model.json`; the report is generated with `npm run report:house-cost`.

```text
published yurt package
  + quantity-based platform and foundation prototype
  + individually selected privacy, protective-floor, heating, ventilation and basic-counter components
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
| Four-season completion | `$9,016.63` | `$53,639.12` |
| Basic household amenities | `$12,735.47` | `$66,374.59` |
| Delivery, design, permits, tax and contingency | `$21,707.28` | `$88,081.87` |

The full cash total includes the published supplier package, platform, only the selected minimal completion rows, utility package, project costs, tax and contingency. The default selected stage is the Basic completed ARC dwelling, while the package-only stage remains available for inspecting the opening supplier price and outstanding requirements. The supplier package is Yurts Canada's published installed all-season Base Kit; there is no unsupported claim that this evidence is a bare-material kit price.

## Residential shell boundary and occupancy review

The ordinary residential selector starts at **20 ft**. The existing **30 ft** default is preserved; 24 ft, the Shelter Designs 27 ft record, and the exact 32 ft Out Factory estimate remain available where supplier evidence exists. Shelter Designs also supplies exact **35 ft** and **40 ft** Big Sky base-price records. These are labelled **larger imported shell** options: the published prices are USD base prices and their CAD equivalents are indicative conversions, not installed Canadian dwelling prices. International freight, customs, brokerage, local installation, Canadian engineering, tax and approvals remain separate or quote-required. 12 ft and 16 ft products remain visible in the market evidence table only as shell-only, seasonal, experimental or special-engineering records. They cannot enter ordinary residential, completed-dwelling or mortgage calculations. A custom diameter below 20 ft is clamped to 20 ft and records that correction in the contract.

20 ft is a practical modelling threshold, not automatic legal approval. The occupancy screen evaluates finished usable floor area, open-concept or separated-room layout, occupants and bedrooms, sleeping/living/kitchen allocation, bathroom area, windows and egress, ventilation and heating, ceiling heights, stairs and guards, foundation/anchorage, zoning and occupancy approval. Ontario's tiny-home guidance gives **17.5 m²** as an open-concept reference, but municipal zoning and the final Building Code review may require more. The screen is therefore a design review aid, not a permit or lender approval.

## Cash waterfall

The basic dwelling subtotal ends after the Basic household amenities layer. Delivery, design and permits are external project costs added after that subtotal; they are not an unexplained construction-cost increase.

| Accounting step | Central cash amount |
| --- | ---: |
| Basic dwelling subtotal | `$66,374.59` |
| Project costs before tax | `$5,800.00` |
| Total before tax and contingency | `$72,174.59` |
| Tax/HST allowance | `$9,382.70` |
| Contingency | `$6,524.58` |
| Final cash construction budget | `$88,081.87` |

The `$5,800.00` project-cost bridge is exactly `$1,800.00` supplier freight and local delivery + `$3,000.00` site, structural and servicing design + `$1,000.00` residual permits and approvals. The first four layer totals therefore reconcile to the Basic dwelling subtotal, and the subtotal plus this project-cost bridge reconciles to the Total before tax and contingency. Tax/HST and contingency remain separate rows and are not included in the project-cost bridge.

The **Basic completed ARC dwelling** preset selects: heating (`1 dwelling`, `$5,200` rate, `$6,280` central cash including paid installation); ventilation (`63.0425 m²`, `$16/m²`, `$1,349.11`); a privacy partition (`7.2 m²`, `$32/m²`, `$473.40`); protective floor surface (`63.0425 m²`, `$10/m²`, `$914.12`); interior surface finish (`63.0425 m²`, `$14/m²`, `$1,194.66`); a basic counter (`1.08 m²`, `$140/m²`, `$284.85`); kitchen cabinetry (`1 dwelling`, `$900` material rate, `$1,170` cash); and bathroom storage/trim (`1 dwelling`, `$300` material rate, `$390` cash). Kitchen appliances remain individually priced and off by default at `$890` central cash when selected; other upgrades remain separately selectable.

The household owns the dwelling and can build equity in it. Land purchase, site lease, shared infrastructure and household operating costs remain outside this calculator.

## Market evidence

The source contract is `packages/carrying-capacity/data/source/house-cost-market-evidence.json`. It records supplier, diameter, price, currency, date, package inclusions and exclusions, plus a material catalogue with units, dates, evidence status and source URLs. Shelter Designs' Big Sky page publishes US$17,950 at 27 ft, US$19,990 at 30 ft, US$29,780 at 35 ft and US$39,100 at 40 ft. The model records a 1.3840 USD/CAD indicative conversion observed 2026-09-04 from the [Bank of Canada daily exchange-rate source](https://www.bankofcanada.ca/rates/exchange/daily-exchange-rates-lookup/), only to show a CAD equivalent.

The central reference uses the published Yurts Canada 30 ft installed all-season Base Kit. The package includes the yurt frame, lattice, dome/ring, covers, insulation, liner, one standard door and mandatory supplier installation. It excludes the platform/floor, delivery, additional openings, utilities and climate control. The Out Factory Canadian rows are non-binding import estimates; Biome Canada publishes configurator options but requires a base quote. Shelter Designs Big Sky is an imported shell route: the source identifies the larger 35 ft and 40 ft rafters as 2 x 8 in, and international shipping/final delivery and local engineering or installation remain purchaser-side requirements.

The historical ARC `$51,000–$74,000`, central approximately `$61,000`, is preserved only as a historical comparison. It represents a different planning/procurement route, not a Yurts Canada price. It is not a calculation input, component rate, discount, calibration target or implied local-fabrication price. Its exact historical integrated sum was `$61,240`: `$50,000` structural design-brief amount, `$5,940` water/plumbing/sanitation, `$2,000` hot water and `$3,300` electrical.

The two procurement routes remain separate: the Yurts Canada 30 ft purchased-package route starts with its published `$36,404` installed Base Kit; a local fabrication or owner-built route is currently unmodeled because no independently supported bill of materials is available. The historical ARC benchmark must not be used to fill that gap.

## Quantity accounting

The platform is explicitly labelled a preliminary circular deck-block concept, not an engineered foundation. It exposes blocks, pressure-treated beams, joists/blocking, tongue-and-groove deck, floor XPS, vapour/protective layer and connectors/anchors. Quantities are calculated from footprint or perimeter, purchase units and a stated waste factor. Soil, frost, uplift, snow, wind, anchorage, structural grade and municipal approval require qualified confirmation.

Each utility package row has one accounting home. Included supplier items are not repriced. Qualified installation and permit rows are separate. The ARC distributed package retains the earlier design intent: roof collection, first flush, storage, pump, filtration/UV/RO, compact PEX, private fixtures, composting sanitation, Class 2 greywater, seasonal hot water and a 400 Wh/day off-grid electrical system. Generic well/septic/grid and centralized servicing remain alternatives.

The historical inclusive water/plumbing/sanitation package was `$5,940`. The current central itemized package is `$6,744.62`, or `$804.62` higher. The current ledger shows each material, included qualified plumbing labour and included permit fee. Current product prices and planning allowances may contribute, but the original historical line items are unrecovered; changed equipment and changed scope are not established. The difference remains explicitly unresolved rather than being hidden or calibrated away.

## Labour and financing

Owner-builder, mixed-labour and contractor-built modes show paid hours, owner hours, cash labour and imputed owner-labour value separately. Owner work reduces cash expenditure but remains part of economic cost.

`upfront_cash_required_cad` is the complete cash construction budget including tax and contingency. It is not the household's down payment. Financing exposes the initial contribution and financed principal separately and documents the distinction between loan term/renewal and amortization.

The mortgage section uses the dated evidence snapshot at `packages/carrying-capacity/data/derived/house-mortgage-rates.json`, refreshed by `npm run update:house-mortgage-rates`. The default fixed reference is the Bank of Canada's latest visible **uninsured** fixed-rate market average for terms of five years and over: **4.35%**, observed **2026-06-30** and checked **2026-09-07**. The snapshot also records insured fixed and variable averages, current RBC high-ratio and conventional special-rate observations, and a source-dated Scotiabank comparison. Lender promotions are not treated as universal offers; the UI shows source, observation date and freshness, and retains the last valid snapshot if a refresh is unavailable.

The four comparison rows are legal-minimum down payment, 10%, 20% and 25%. Canada.ca minimum-down-payment rules determine the first row. Below 20% down, the standard CMHC premium schedule is calculated separately and added to the financed principal when the property is eligible; 20% down is the conventional uninsured reference, not the legal minimum. The selected mortgage mode can use fixed, variable, custom or no-premium sensitivity, while the published comparison rows retain the automatic CMHC treatment.

Contract payment uses monthly compounding over the selected amortization. A five-year term is the renewal period and does not turn a 25-year amortization into a five-year loan. The qualifying payment is calculated independently at the greater of the contract rate plus two percentage points or 5.25%, following the [OSFI minimum qualifying rate](https://www.osfi-bsif.gc.ca/en/supervision/financial-institutions/banks/minimum-qualifying-rate-uninsured-mortgages).

The mortgage basis is the selected dwelling stage's **cash** construction budget. Contributed owner labour is an economic-cost item and is not financed unless a user supplies a lender quote. The property is described as a **full-time, year-round residential dwelling based on a yurt form**, but financing remains subject to permanent foundation and structural compliance, year-round occupancy approval, insurability, appraisal, title/security registration, municipal approvals and lender acceptance of the construction system. See the [Canada.ca down-payment rules](https://www.canada.ca/en/financial-consumer-agency/services/mortgages/down-payment.html), [CMHC mortgage insurance schedule](https://www.cmhc-schl.gc.ca/professionals/project-funding-and-mortgage-financing/mortgage-loan-insurance/mortgage-loan-insurance-homeownership-programs/purchase) and [CMHC Prefab Plus guidance](https://www.cmhc-schl.gc.ca/professionals/project-funding-and-mortgage-financing/mortgage-loan-insurance/mortgage-loan-insurance-homeownership-programs/prefab-plus) for the documented boundaries.

## Evidence and uncertainty

Published supplier and retailer prices are dated evidence. Battery storage, solar thermal, greywater, composting-toilet suitability, the optional finish/cabinet/appliance/bathroom rows, delivery, tax/HST treatment, permits and engineering remain provisional or quotation-required where indicated. Interpolated diameters are labelled; extrapolated sizes are flagged. Larger spans, roof pitch and upper-floor structures use editable planning thresholds and are not approvals.

The display keeps the detailed component ledger, package inclusion matrix, platform BOM, procurement register, geometry audit, layout comparison, diameter sensitivity, labour modes and historical comparison expandable so the result can be independently reproduced.
