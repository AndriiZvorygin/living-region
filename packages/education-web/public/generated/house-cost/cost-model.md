# ARC House Cost Calculator

Generated from contract 2.0.0 on 2026-09-06. This is a planning model for a completed four-season yurt dwelling; land lease, shared infrastructure operating charges and household operating costs are separate.

## Central reference

- Geometry: 9.144 m diameter (65.67 m² gross; 63.04 m² usable after explicit deductions)
- Servicing: ARC household systems
- Construction cash expenditure before tax/contingency: $80,172.73
- Tax/HST allowance: $10,370.45
- Contingency: $7,243.45
- Total cash construction budget (the former “upfront cash required”): $97,786.64
- Initial financing contribution: $9,778.66
- Financed principal: $88,007.98
- Owner labour economic value: $4,595.36
- Completed dwelling economic cost: $102,382.00
- Illustrative financing: $567.04/month at 6% interest, 25 year amortization, $9,778.66 down

The historical ARC reference is $61,240.00 before public rounding to $61,000.00. The audited model is $102,382.00 on its independently itemized scope. The former model result of $108,247.21 is reconciled below; no hidden discount is used.

## Historical ARC scope

| Original scope | Original amount | Evidence status |
| --- | ---: | --- |
| Reinforced insulated structure, platform, masonry heater and chimney | $50,000.00 | historical_design_brief_amount |
| Fixtures, toilet, excavation, compact plumbing, commissioning, CAD 1,200 qualified plumbing labour and CAD 600 permit allowance | $5,940.00 | historical_inclusive_package |
| Winter thermosiphon and summer solar-thermal hot water, including CAD 400 integration labour | $2,000.00 | historical_inclusive_package |
| Approximately 400 W PV, MPPT, 2.52 kWh nominal battery, 1,000 W inverter, CAD 700 qualified electrical labour and CAD 100 inspection allowance | $3,300.00 | historical_inclusive_package |

The original structural itemization was not recovered. Its CAD 50,000 amount is retained as a historical design-brief figure. The utility packages are inclusive: their paid labour and fees are inside the stated package totals.

## Old-versus-audited package reconciliation

| Component | Original scope / amount | Former model cash row | Audited scope / amount | Delta from former | Evidence / reason |
| --- | --- | ---: | --- | ---: | --- |
| Water / plumbing / sanitation | Inclusive package ($5,940.00) | $8,685.00 | One inclusive package; included labour and fee decomposed, not added again ($5,940.00) | $-2,745.00 | Historical ARC design brief; original itemized quotation unrecovered. |
| Hot water | Inclusive package including integration labour ($2,000.00) | $2,630.00 | One inclusive package; labour allowance is replaced only by a labour override ($2,000.00) | $-630.00 | Historical ARC design brief; original itemized quotation unrecovered. |
| Household electrical | Inclusive off-grid package including qualified labour and inspection allowance ($3,300.00) | $4,200.00 | One inclusive package; labour and inspection allowance exposed inside package ($3,300.00) | $-900.00 | Historical ARC design brief; original itemized quotation unrecovered. |
| General permits | The utility package includes CAD 600 permit allowance ($0.00) | $1,000.00 | Residual general permit allowance after CAD 600 package offset ($400.00) | $-600.00 | Historical ARC package detail plus current municipal-fee placeholder. |

Bridge totals: direct cash $-4,875.00, tax $-555.75, contingency $-434.46, owner-labour value $0.00, total economic cost $-5,865.21. The bridge isolates corrected bundled-package/permit overlap, then recomputes tax and contingency on the lower cash base. Owner-labour valuation is unchanged. Structure, kitchen/bath fit-out and other planning-rate differences remain visible as unresolved scope/pricing differences rather than hidden offsets.

## Component audit

| Component | Quantity | Unit | Unit rate | Materials / non-labour | Labour | Cash cost | Evidence status |
| --- | ---: | --- | ---: | ---: | ---: | ---: | --- |
| Platform / foundation | 65.67 | CAD/m2 | $130.00 | $8,537.01 | 27.6 h | $9,157.58 | planning_rate |
| Yurt frame and tension structure | 28.73 | CAD/m | $225.00 | $6,463.51 | 51.7 h | $7,626.94 | planning_rate |
| Roof structure and covering | 75.83 | CAD/m2 | $85.00 | $6,445.41 | 83.4 h | $8,322.17 | planning_rate |
| Insulation | 144.77 | CAD/m2 | $30.00 | $4,343.18 | 55 h | $5,580.98 | planning_rate |
| Weatherproofing and air control | 144.77 | CAD/m2 | $24.00 | $3,474.54 | 31.9 h | $4,191.16 | planning_rate |
| Windows / dome glazing | 6 | CAD/window | $550.00 | $3,300.00 | 18 h | $3,705.00 | supplier_range_planning_rate |
| Exterior and interior doors | 2 | CAD/door | $1,100.00 | $2,200.00 | 11 h | $2,447.50 | supplier_range_planning_rate |
| Interior finishes and floor finish | 63.04 | CAD/m2 | $75.00 | $4,728.19 | 63 h | $6,146.64 | planning_rate |
| Additional kitchen fit-out | 1 | CAD/dwelling | $3,500.00 | $3,500.00 | 32 h | $4,220.00 | unitemized_additional_fitout_allowance |
| Additional bathroom fit-out | 1 | CAD/dwelling | $3,000.00 | $3,000.00 | 38 h | $4,710.00 | unitemized_additional_fitout_allowance |
| Heating appliance and system | 1 | CAD/dwelling | $5,000.00 | $5,000.00 | 18 h | $5,810.00 | arc_planning_allocation |
| Ventilation / air exchange | 63.04 | CAD/m2 | $20.00 | $1,260.85 | 10.1 h | $1,714.76 | planning_rate |
| Household electrical equipment | 1 | CAD/dwelling | $3,300.00 | $2,600.00 | 15.6 h | $3,300.00 | inclusive household_electrical |
| Water, plumbing and sanitation package | 1 | CAD/dwelling | $5,940.00 | $4,740.00 | 26.7 h | $5,940.00 | inclusive water_plumbing_sanitation |
| Domestic hot water package | 1 | CAD/dwelling | $2,000.00 | $1,600.00 | 8.9 h | $2,000.00 | inclusive hot_water |
| Household demand upgrade | 0 | CAD/person above 2 | $600.00 | $0.00 | 0 h | $0.00 | planning_assumption |
| Delivery and logistics | 1 | CAD/dwelling | $1,200.00 | $1,200.00 | 6 h | $1,470.00 | site_specific_quote_required |
| Equipment hire | 1 | CAD/dwelling | $750.00 | $750.00 | 4 h | $930.00 | site_specific_quote_required |
| Design and engineering | 1 | CAD/dwelling | $2,500.00 | $2,500.00 | 0 h | $2,500.00 | quotation_or_engineering_required |
| Permits and approvals | 1 | CAD/dwelling | $1,000.00 | $400.00 | 0 h | $400.00 | site_specific_fee_required |

Package rows expose their inclusive total, included paid labour, included fee and non-labour portion in the generated JSON. A labour-rate override replaces the package’s included labour allowance; it is not added on top. The residual general permit row is $400.00 after the included $600.00 allowance.

## Labour modes

| Mode | Total cash budget | Economic cost | Owner hours | Paid hours | Illustrative finance |
| --- | ---: | ---: | ---: | ---: | ---: |
| Owner-builder | $87,527.80 | $96,718.53 | 373.6 h | 127.2 h | $507.55/month |
| Mixed labour | $97,786.64 | $102,382.00 | 186.8 h | 314 h | $567.04/month |
| Contractor-built | $108,045.51 | $108,045.51 | 0 h | 500.8 h | $626.52/month |

Owner-builder cash is lower because owner labour is contributed, not because that work disappears. Professional/design and approval work remains paid. Economic cost adds the imputed value of contributed owner labour to the total cash budget.

## Diameter sensitivity

| Diameter | Usable m² | Economic cost | Cost / usable m² | Applied thresholds |
| --- | ---: | ---: | ---: | --- |
| 6.096 m / 20 ft | 28.0 | $74,852.89 | $2,671.51 | none |
| 7.315 m / 24 ft | 40.3 | $84,801.28 | $2,101.79 | none |
| 9.144 m / 30 ft | 63.0 | $102,382.00 | $1,624.02 | none |
| 10.668 m / 35 ft | 85.8 | $123,984.79 | $1,444.91 | large_diameter_9_144 |
| 12.192 m / 40 ft | 112.1 | $151,586.02 | $1,352.53 | large_diameter_9_144, large_diameter_10_668 |

## Layout comparison

| Layout | Usable m² | Economic cost | Cost / usable m² | Owner hours | Paid hours |
| --- | ---: | ---: | ---: | ---: | ---: |
| Single storey | 63.0 | $102,382.00 | $1,624.02 | 186.8 h | 314 h |
| Partial loft | 76.2 | $115,008.43 | $1,508.88 | 223.6 h | 352.9 h |
| Full two storeys | 118.1 | $136,344.94 | $1,154.63 | 289.7 h | 425.7 h |

## Accounting and evidence

- Shell is the platform/foundation, frame, roof, insulation, weatherproofing, windows, doors and any upper-floor structure.
- The platform/foundation row covers the structural base and floor structure; interior finishes cover finish flooring and surfaces. Frame and roof scopes are separated, and wall weatherproofing excludes the roof covering.
- Insulated/heated structure adds interior finish, heating, ventilation, stairs and guards.
- Completed dwelling adds additional kitchen/bathroom fit-out, distributed household systems, logistics, equipment, design, residual permits, tax and contingency.
- The ARC household package is carried once: water/plumbing/sanitation $5,940.00, hot water $2,000.00, electrical $3,300.00. Generic well/septic/grid options remain alternatives.
- Financing is calculated on the total cash construction budget, excluding contributed owner-labour value. Down payment/equity and financed principal are separate from that budget.
- Centralized servicing removes household utility capital and reports unresolved shared-infrastructure quotation requirements; it is not silently added to this dwelling.
- A custom quote overrides the financing headline while any unallocated difference remains visible.

The strongest evidence supports geometry/specification boundaries and Ontario permit/servicing obligations. Component rates, structural thresholds, labour rates, HST treatment, kitchen/bath fit-out itemization and site logistics remain planning estimates or quotation-required inputs.

## Sources

- [Living Region: ARC dwelling cost evidence](https://github.com/AndriiZvorygin/living-region/blob/main/packages/carrying-capacity/data/source/arc-dwelling-costs.json) - derived from existing Living Region evidence. Existing integrated ARC package and utility components; original underlying quote remains unrecovered.
- [Biome Canada: The Yurt](https://biome-canada.ca/products/the-yurt/) - supplier specification. Canadian diameter options and included structural/envelope elements support geometry and component boundaries; price is not adopted as a local installed quote.
- [Yurts Canada: Pricing and FAQs](https://www.yurts-canada.ca/pricing-faqs1) - supplier specification. Canadian four-season package and installation/specification context; current quote required for a project.
- [Government of Ontario: Build or buy a tiny home: Building Code requirements](https://www.ontario.ca/document/build-or-buy-tiny-home/building-code-requirements) - official requirement guidance. Year-round homes require Building Code compliance, plumbing, energy efficiency, foundations/anchorage and site-specific water/sewage review.
- [Government of Ontario: Build or buy a tiny home: permits and inspections](https://www.ontario.ca/document/build-or-buy-tiny-home/building-code-permits-and-inspections) - official requirement guidance. Building permits and inspections apply to on-site and factory-built tiny homes.
- [Grey County: Development charges](https://www.grey.ca/government/development-charges) - official fee schedule. Development charges are payable when a building permit is issued; actual applicability and current fee require municipal confirmation.
- [Canada Revenue Agency: GST/HST new housing rebate](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc4052.html) - official tax guidance. Tax treatment and any rebate depend on owner-builder/builder facts, timing and eligibility; the calculator keeps HST as an editable planning assumption.
