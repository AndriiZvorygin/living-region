# ARC House Cost Calculator

Generated from contract 1.0.0 on 2026-09-05. This is a planning model for a completed four-season yurt dwelling; land lease, shared infrastructure operating charges and household operating expenses are separate.

## Central reference

- Geometry: 9.144 m diameter (65.67 m² gross; 63.04 m² usable after explicit deductions)
- Servicing: ARC household systems
- Upfront cash required: $103,651.85
- Completed dwelling capital including owner-labour value: $108,247.21
- Illustrative financing: $601.05/month at 6% interest, 25 year amortization, 10,365.18 down

The legacy ARC central benchmark was $61,000. The new component model's core capital before delivery, equipment hire, design, permits, tax and contingency is $83,743.11; its completed economic capital is $108,247.21. The difference is exposed rather than hidden.

## Component audit

| Component | Quantity | Unit | Unit rate | Materials / allowance | Labour | Cash cost | Evidence status |
| --- | ---: | --- | ---: | ---: | ---: | ---: | --- |
| Platform / foundation | 65.67 | CAD/m2 | $130.00 | $8,537.01 | 27.6 h | $9,157.58 | planning_rate |
| Yurt frame and tension structure | 28.73 | CAD/m | $225.00 | $6,463.51 | 51.7 h | $7,626.94 | planning_rate |
| Roof structure and covering | 75.83 | CAD/m2 | $85.00 | $6,445.41 | 83.4 h | $8,322.17 | planning_rate |
| Insulation | 144.77 | CAD/m2 | $30.00 | $4,343.18 | 55 h | $5,580.98 | planning_rate |
| Weatherproofing and air control | 144.77 | CAD/m2 | $24.00 | $3,474.54 | 31.9 h | $4,191.16 | planning_rate |
| Windows / dome glazing | 6 | CAD/window | $550.00 | $3,300.00 | 18 h | $3,705.00 | supplier_range_planning_rate |
| Exterior and interior doors | 2 | CAD/door | $1,100.00 | $2,200.00 | 11 h | $2,447.50 | supplier_range_planning_rate |
| Interior finishes and floor finish | 63.04 | CAD/m2 | $75.00 | $4,728.19 | 63 h | $6,146.64 | planning_rate |
| Kitchen and food-preparation fixtures | 1 | CAD/dwelling | $3,500.00 | $3,500.00 | 32 h | $4,220.00 | planning_allowance |
| Bathroom fixtures and finish | 1 | CAD/dwelling | $3,000.00 | $3,000.00 | 38 h | $4,710.00 | planning_allowance |
| Heating appliance and system | 1 | CAD/dwelling | $5,000.00 | $5,000.00 | 18 h | $5,810.00 | arc_planning_allocation |
| Ventilation / air exchange | 63.04 | CAD/m2 | $20.00 | $1,260.85 | 10.1 h | $1,714.76 | planning_rate |
| Household electrical equipment | 1 | CAD/dwelling | $3,300.00 | $3,300.00 | 20 h | $4,200.00 | legacy_design_package_planning_value |
| Water collection, treatment and plumbing | 1 | CAD/dwelling | $3,940.00 | $3,940.00 | 45 h | $5,965.00 | legacy_design_package_planning_value |
| Sanitation and greywater | 1 | CAD/dwelling | $2,000.00 | $2,000.00 | 16 h | $2,720.00 | legacy_design_package_planning_value |
| Domestic hot water | 1 | CAD/dwelling | $2,000.00 | $2,000.00 | 14 h | $2,630.00 | legacy_design_package_planning_value |
| Household demand upgrade | 0 | CAD/person above 2 | $600.00 | $0.00 | 0 h | $0.00 | planning_assumption |
| Delivery and logistics | 1 | CAD/dwelling | $1,200.00 | $1,200.00 | 6 h | $1,470.00 | site_specific_quote_required |
| Equipment hire | 1 | CAD/dwelling | $750.00 | $750.00 | 4 h | $930.00 | site_specific_quote_required |
| Design and engineering | 1 | CAD/dwelling | $2,500.00 | $2,500.00 | 0 h | $2,500.00 | quotation_or_engineering_required |
| Permits and approvals | 1 | CAD/dwelling | $1,000.00 | $1,000.00 | 0 h | $1,000.00 | site_specific_fee_required |

Taxes and contingency are shown as separate additions: $10,926.20 tax/HST allowance and $7,677.91 contingency. Owner labour is 186.8 h ($4,595.36 imputed); paid labour is 357.9 h ($16,105.04 cash).

## Labour modes

| Mode | Upfront cash | Completed capital | Owner hours | Paid hours | Illustrative finance |
| --- | ---: | ---: | ---: | ---: | ---: |
| Owner-builder | $93,393.01 | $102,583.74 | 373.6 h | 171.1 h | $541.56/month |
| Mixed labour | $103,651.85 | $108,247.21 | 186.8 h | 357.9 h | $601.05/month |
| Contractor-built | $113,910.72 | $113,910.72 | 0 h | 544.7 h | $660.54/month |

Owner-builder cash is lower because owner labour is contributed, not because that work disappears. Professional/design and approval work remains paid.

## Diameter sensitivity

| Diameter | Usable m² | Completed capital | Cost / usable m² | Applied thresholds |
| --- | ---: | ---: | ---: | --- |
| 6.096 m / 20 ft | 28.0 | $80,718.10 | $2,880.84 | none |
| 7.315 m / 24 ft | 40.3 | $90,666.49 | $2,247.16 | none |
| 9.144 m / 30 ft | 63.0 | $108,247.21 | $1,717.05 | none |
| 10.668 m / 35 ft | 85.8 | $129,850.00 | $1,513.26 | large_diameter_9_144 |
| 12.192 m / 40 ft | 112.1 | $157,451.23 | $1,404.87 | large_diameter_9_144, large_diameter_10_668 |

## Layout comparison

| Layout | Usable m² | Completed capital | Cost / usable m² | Owner hours | Paid hours |
| --- | ---: | ---: | ---: | ---: | ---: |
| Single storey | 63.0 | $108,247.21 | $1,717.05 | 186.8 h | 357.9 h |
| Partial loft | 80.0 | $121,495.45 | $1,518.67 | 225.5 h | 399.3 h |
| Full two storeys | 108.2 | $134,401.69 | $1,241.76 | 264.1 h | 442.4 h |

## Accounting and evidence

- Shell is the platform/foundation, frame, roof, insulation, weatherproofing, windows, doors and any upper-floor structure.
- Insulated/heated structure adds interior finish, heating, ventilation, stairs and guards.
- Completed dwelling adds kitchen, bathroom, distributed household systems, logistics, equipment, design, permits, tax and contingency.
- The ARC household utility package is carried forward once: water/plumbing CAD 3,940, sanitation/greywater CAD 2,000, hot water CAD 2,000 and electrical CAD 3,300. Generic well/septic/grid options remain alternatives.
- Centralized servicing removes household utility capital and reports unresolved shared-infrastructure quotation requirements; it is not silently added to this dwelling.
- A custom quote overrides the financing headline while any unallocated difference remains visible.

The strongest evidence supports geometry/specification boundaries and Ontario permit/servicing obligations. Component rates, structural thresholds, labour rates, HST treatment and site logistics remain planning estimates or quotation-required inputs.

## Sources

- [Living Region: ARC dwelling cost evidence](https://github.com/AndriiZvorygin/living-region/blob/main/packages/carrying-capacity/data/source/arc-dwelling-costs.json) - derived from existing Living Region evidence. Existing integrated ARC package and utility components; original underlying quote remains unrecovered.
- [Biome Canada: The Yurt](https://biome-canada.ca/products/the-yurt/) - supplier specification. Canadian diameter options and included structural/envelope elements support geometry and component boundaries; price is not adopted as a local installed quote.
- [Yurts Canada: Pricing and FAQs](https://www.yurts-canada.ca/pricing-faqs1) - supplier specification. Canadian four-season package and installation/specification context; current quote required for a project.
- [Government of Ontario: Build or buy a tiny home: Building Code requirements](https://www.ontario.ca/document/build-or-buy-tiny-home/building-code-requirements) - official requirement guidance. Year-round homes require Building Code compliance, plumbing, energy efficiency, foundations/anchorage and site-specific water/sewage review.
- [Government of Ontario: Build or buy a tiny home: permits and inspections](https://www.ontario.ca/document/build-or-buy-tiny-home/building-code-permits-and-inspections) - official requirement guidance. Building permits and inspections apply to on-site and factory-built tiny homes.
- [Grey County: Development charges](https://www.grey.ca/government/development-charges) - official fee schedule. Development charges are payable when a building permit is issued; actual applicability and current fee require municipal confirmation.
- [Canada Revenue Agency: GST/HST new housing rebate](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc4052.html) - official tax guidance. Tax treatment and any rebate depend on owner-builder/builder facts, timing and eligibility; the calculator keeps HST as an editable planning assumption.
