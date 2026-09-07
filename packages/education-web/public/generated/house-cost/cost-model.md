# House Cost Calculator

Generated from contract 4.4.0 on 2026-09-07. This is a first-principles planning model for a resident-owned, four-season yurt dwelling. Land purchase, site lease, shared infrastructure and household operating costs are separate.

## Sourced yurt packages

The package price is the starting input. The old ARC dwelling estimate is not used as a rate, residual or calibration target.

| Supplier | Diameter | Published / estimated price | Price basis | Evidence status |
| --- | ---: | ---: | --- | --- |
| Yurts Canada | 12 ft | $12,420.00 CAD | installed | published_supplier_price · evidence only: shell-only / seasonal / experimental / special engineering |
| Yurts Canada | 16 ft | $16,451.00 CAD | installed | published_supplier_price · evidence only: shell-only / seasonal / experimental / special engineering |
| Yurts Canada | 20 ft | $19,252.00 CAD | installed | published_supplier_price · ordinary residential candidate |
| Yurts Canada | 24 ft | $25,681.00 CAD | installed | published_supplier_price · ordinary residential candidate |
| Yurts Canada | 30 ft | $36,404.00 CAD | installed | published_supplier_price · ordinary residential candidate |
| The Out Factory | 20 ft | $32,958.00 CAD | Canadian non-binding import estimate | non_binding_import_estimate · ordinary residential candidate |
| The Out Factory | 24 ft | $37,699.00 CAD | Canadian non-binding import estimate | non_binding_import_estimate · ordinary residential candidate |
| The Out Factory | 32 ft | $57,852.00 CAD | Canadian non-binding import estimate | non_binding_import_estimate · ordinary residential candidate |
| Shelter Designs | 27 ft | US$17,950.00 USD base; ~$24,842.80 CAD at 1.3840 USD/CAD | published USD Big Sky base; CAD conversion estimate | published_usd_base_imported_shell · larger imported shell |
| Shelter Designs | 20 ft | US$13,850.00 USD base; ~$19,168.40 CAD at 1.3840 USD/CAD | published USD Big Sky base; CAD conversion estimate | published_usd_base_imported_shell · ordinary residential candidate |
| Shelter Designs | 24 ft | US$15,850.00 USD base; ~$21,936.40 CAD at 1.3840 USD/CAD | published USD Big Sky base; CAD conversion estimate | published_usd_base_imported_shell · ordinary residential candidate |
| Shelter Designs | 30 ft | US$19,990.00 USD base; ~$27,666.16 CAD at 1.3840 USD/CAD | published USD Big Sky base; CAD conversion estimate | published_usd_base_imported_shell · ordinary residential candidate |
| Shelter Designs | 35 ft | US$29,780.00 USD base; ~$41,215.52 CAD at 1.3840 USD/CAD | published USD Big Sky base; CAD conversion estimate | published_usd_base_imported_shell · larger imported shell |
| Shelter Designs | 40 ft | US$39,100.00 USD base; ~$54,114.40 CAD at 1.3840 USD/CAD | published USD Big Sky base; CAD conversion estimate | published_usd_base_imported_shell · larger imported shell |
| Biome Canada | 20 ft | quote required | quote required | configurator_options_quote_required · ordinary residential candidate |
| Biome Canada | 24 ft | quote required | quote required | configurator_options_quote_required · ordinary residential candidate |
| Biome Canada | 30 ft | quote required | quote required | configurator_options_quote_required · ordinary residential candidate |

Yurts Canada is the central reference because its public price is a Canadian installed all-season Base Kit. The Out Factory rows are non-binding Canadian import estimates. Shelter Designs Big Sky rows are published USD base prices for imported shell packages; their CAD equivalents use the recorded Bank of Canada conversion only and do not include Canadian delivery, customs, brokerage, installation, engineering or approvals. Biome Canada publishes a configurable package and options but requires a quote for the base total. Package inclusions and exclusions are preserved in the JSON contract.

### Shelter Designs Big Sky imported-shell review

These rows are **larger imported shell** evidence, not installed Canadian dwelling prices. The recorded conversion is 1.3840 USD/CAD on 2026-09-04; international delivery, customs, brokerage, local installation, Canadian engineering, taxes and approvals remain separate.

| Diameter | Published base | Estimated CAD equivalent | Quote-required additions | Structural / approval flags |
| --- | ---: | ---: | --- | --- |
| 27 ft | US$17,950.00 | $24,842.80 | international freight and final Ontario delivery; customs and import charges; Canadian brokerage; local installation; Canadian engineering; taxes and approvals | snow and wind loads; reinforced rafters and connections; platform design; transport and unloading; foundation and frost conditions; anchorage and uplift; local building-code and occupancy approval |
| 20 ft | US$13,850.00 | $19,168.40 | international freight and final Ontario delivery; customs and import charges; Canadian brokerage; local installation; Canadian engineering; taxes and approvals | snow and wind loads; reinforced rafters and connections; platform design; transport and unloading; foundation and frost conditions; anchorage and uplift; local building-code and occupancy approval |
| 24 ft | US$15,850.00 | $21,936.40 | international freight and final Ontario delivery; customs and import charges; Canadian brokerage; local installation; Canadian engineering; taxes and approvals | snow and wind loads; reinforced rafters and connections; platform design; transport and unloading; foundation and frost conditions; anchorage and uplift; local building-code and occupancy approval |
| 30 ft | US$19,990.00 | $27,666.16 | international freight and final Ontario delivery; customs and import charges; Canadian brokerage; local installation; Canadian engineering; taxes and approvals | snow and wind loads; reinforced rafters and connections; platform design; transport and unloading; foundation and frost conditions; anchorage and uplift; local building-code and occupancy approval |
| 35 ft | US$29,780.00 | $41,215.52 | international freight and final Ontario delivery; customs and import charges; Canadian brokerage; local installation; Canadian engineering; taxes and approvals | snow and wind loads; reinforced rafters and connections; platform design; transport and unloading; foundation and frost conditions; anchorage and uplift; local building-code and occupancy approval |
| 40 ft | US$39,100.00 | $54,114.40 | international freight and final Ontario delivery; customs and import charges; Canadian brokerage; local installation; Canadian engineering; taxes and approvals | snow and wind loads; reinforced rafters and connections; platform design; transport and unloading; foundation and frost conditions; anchorage and uplift; local building-code and occupancy approval |

## Procurement routes

- **Yurts Canada purchased-package route:** Published supplier package price; the selected 30 ft Base Kit is $36,404.00 before platform, household systems, heating, delivery, design, tax and contingency.
- **Local fabrication or owner-built route:** **not modeled**. No independently supported bill of materials is currently available in the evidence set. The historical ARC approximately CAD 61,000 figure is not a local-fabrication price and is not used to infer one.

## Central reference result

- Supplier package: **Yurts Canada 30 ft**, $36,404.00 (exact_published_or_selected_package)
- Geometry: 9.144 m diameter; 65.67 m² gross; 63.04 m² usable after explicit deductions
- Total before tax and contingency: **$72,174.59**
- Tax/HST allowance: $9,382.70
- Contingency: $6,524.58
- Completed dwelling cash construction budget: **$88,081.87**
- Contributed owner-labour value: $1,303.18
- Completed dwelling economic cost: **$89,385.05**
- Selected-stage mortgage basis: **$88,081.87 cash**, excluding contributed owner labour.
- Selected-stage contract payment: **$385.69/month** at 4.35% fixed; source: [Bank of Canada funds advanced, uninsured, fixed 5 years and over](https://www.bankofcanada.ca/rates/banking-and-financial-statistics/interest-rates-for-new-and-existing-lending-by-chartered-banks/) observed 2026-06-30; snapshot 2026-09-07 (fresh).
- Initial contribution: $17,616.37; base financed principal: $70,465.50; mortgage-insurance premium: $0.00; total financed principal: $70,465.50.
- Stress-test payment: **$469.20/month** at 6.35%; term: 5 years; amortization: 25 years; balance at term end: $61,752.56.

This result is independently calculated from a published supplier package, quantity-based platform takeoff, itemized household systems, additional assemblies, labour, tax and contingency.

## Residential shell and occupancy screen

- Ordinary residential selector minimum: **20 ft** (6.096 m); existing default: **9.144 m / 30 ft**.
- 12 ft and 16 ft records remain supplier evidence only and are excluded from ordinary residential, completed-dwelling and mortgage calculations.
- Exact larger supplier evidence is supplier-specific: the 27 ft, 35 ft and 40 ft Shelter Designs Big Sky base prices are available as larger imported-shell evidence, alongside the 32 ft Out Factory estimate; custom sizes outside exact rows are labelled interpolated or extrapolated.
- The Ontario guidance reference is **17.5 m²** for an open-concept tiny-home example. This is a reference screen, not automatic approval.

| Occupancy/code check | Result | Detail |
| --- | --- | --- |
| Finished floor area | passes_reference_minimum | 63.04 m² usable against 17.50 m² for the open-concept reference. |
| Open-concept living / sleeping / dining / kitchen | passes_reference_allocation | 60.04 m² available against 13.50 m² reference sleeping/living allocation. |
| Occupants and bedrooms | review_required | 2 occupants and 0 bedrooms supplied. Ontario guidance does not create a universal occupancy-per-m² rule; room use and municipal review remain required. |
| Bathroom | passes_reference_area | 3.00 m² planning allocation; fixtures still require compliant layout and servicing. |
| Kitchen | included_in_open_concept_reference | 4.20 m² planning allocation; the open-concept reference combines kitchen with living/sleeping/dining. |
| Windows and egress | review_required | At least 6.00 m² of qualifying glazing is required by the reference; provide an opening schedule. |
| Ventilation and heating | review_required | Year-round occupancy needs code-compliant heating and ventilation; the model does not infer approval from a yurt package. |
| Ceiling heights | review_required | 2.40 m wall height is not proof that all required floor area meets the applicable ceiling-height rules. |
| Stairs and guards | not_applicable_single_storey | No upper floor selected. |
| Foundation and anchorage | review_required | Footings, foundation, frost protection and anchorage require site-specific structural design. |
| Zoning and occupancy approval | review_required | Municipal zoning, minimum dwelling area, permits and occupancy approval are site-specific. |

Source: [Ontario tiny-home guidance](https://files.ontario.ca/pdf1/mmah-build-or-buy-a-tiny-home-en-2022-05-12.pdf). Municipal zoning, Building Code review, servicing, foundation/anchorage, occupancy approval, appraisal, insurance and lender acceptance remain unresolved until reviewed for the actual design and site.

## Mortgage evidence and down-payment scenarios

The dwelling is labelled **Full-time, year-round residential dwelling based on a yurt form.** Financing is a planning calculation, not a commitment. CMHC/lender eligibility depends on permanent foundation and structural compliance, year-round occupancy approval, insurability, appraisal, title/security registration, municipal approvals and acceptance of the yurt construction system.

| Scenario | Initial contribution | Base principal | Insurance premium | Total principal | Contract rate | Contract payment | Stress payment |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Legal minimum down payment | $4,404.09 | $83,677.78 | $3,347.11 | $87,024.89 | 4.01% | $459.83 | $561.23 |
| 10% down | $8,808.19 | $79,273.68 | $2,457.48 | $81,731.16 | 4.01% | $431.86 | $527.09 |
| 20% down · uninsured reference | $17,616.37 | $70,465.50 | $0.00 | $70,465.50 | 4.35% | $385.69 | $469.20 |
| 25% down | $22,020.47 | $66,061.40 | $0.00 | $66,061.40 | 4.35% | $361.59 | $439.88 |

20% down is the conventional uninsured reference scenario, not the legal minimum. The legal-minimum row follows current Canada.ca down-payment rules. Insurance is shown separately and added to principal where the CMHC standard schedule applies. The qualifying rate is separate from the ordinary contract rate: the model uses the greater of contract rate + 2 percentage points or 5.25%.

### Recorded rate evidence

The default is a Bank of Canada market average, not a guaranteed lender offer. Lender observations remain separate because special rates have product, credit, insurance and property conditions.

| Reference rate | Annual | Institution | Observed | Type | Source |
| --- | ---: | --- | --- | --- | --- |
| Bank of Canada funds advanced, insured, fixed 5 years and over | 4.01% | Bank of Canada | 2026-06-30 | market average | [source](https://www.bankofcanada.ca/rates/banking-and-financial-statistics/interest-rates-for-new-and-existing-lending-by-chartered-banks/) |
| Bank of Canada funds advanced, uninsured, fixed 5 years and over | 4.35% | Bank of Canada | 2026-06-30 | market average | [source](https://www.bankofcanada.ca/rates/banking-and-financial-statistics/interest-rates-for-new-and-existing-lending-by-chartered-banks/) |
| Bank of Canada funds advanced, insured, variable | 3.79% | Bank of Canada | 2026-06-30 | market average | [source](https://www.bankofcanada.ca/rates/banking-and-financial-statistics/interest-rates-for-new-and-existing-lending-by-chartered-banks/) |
| Bank of Canada funds advanced, uninsured, variable | 3.90% | Bank of Canada | 2026-06-30 | market average | [source](https://www.bankofcanada.ca/rates/banking-and-financial-statistics/interest-rates-for-new-and-existing-lending-by-chartered-banks/) |

| Lender | Product | Annual | Insurance status | Observed | Classification | Source |
| --- | --- | ---: | --- | --- | --- |
| RBC Royal Bank | fixed · 5 years | 4.89% | uninsured / 20%+ down | 2026-09-07 | promotional rate | [source](https://www.rbcroyalbank.com/mortgages/mortgage-rates.html) |
| RBC Royal Bank | fixed · 5 years | 4.59% | insured / under 20% down | 2026-09-07 | promotional rate | [source](https://www.rbcroyalbank.com/mortgages/mortgage-rates.html) |
| RBC Royal Bank | variable · 5 years | 3.95% | uninsured / 20%+ down | 2026-09-07 | promotional rate | [source](https://www.rbcroyalbank.com/mortgages/mortgage-rates.html) |
| RBC Royal Bank | variable · 5 years | 3.65% | insured / under 20% down | 2026-09-07 | promotional rate | [source](https://www.rbcroyalbank.com/mortgages/mortgage-rates.html) |
| Scotiabank | variable · 5 years | 4.90% | conventional or insured | 2025-10-30 | special rate; source-dated · stale | [source](https://www.scotiabank.com/ca/en/personal/mortgages/variable-rate/flex-value-closed-term.html) |

The snapshot was checked on 2026-09-07; stale source-dated observations are retained as comparison evidence rather than silently substituted into the default.

## Layered price from package to dwelling

The public starting view is the selected supplier package. It is distinct from the completed dwelling. Select the **Basic completed ARC dwelling** stage to include all five layers, or stop earlier to see outstanding requirements before occupancy.

| Layer | Incremental cash | Running cash total | Component rows |
| --- | ---: | ---: | --- |
| Yurt package | $36,404.00 | $36,404.00 | purchased_yurt_package |
| Platform and foundation | $8,218.49 | $44,622.49 | platform_support_blocks, platform_pt_beams, platform_joists, platform_decking, platform_floor_insulation, platform_vapour_layer, platform_connectors |
| Four-season completion | $9,016.63 | $53,639.12 | privacy_partition, protective_floor_surface, wood_stove_and_chimney, balanced_ventilation |
| Basic household amenities | $12,735.47 | $66,374.59 | basic_counter, water_collection_storage_first_flush, water_demand_pump, water_sediment_and_uv, compact_pex_and_fittings, sink_and_shower_fixtures, composting_toilet, class_2_greywater, qualified_water_installation, water_permit_allowance, solar_thermal_collector, hot_water_storage_and_controls, thermosiphon_integration, hot_water_integration_labour, pv_400w, mppt_controller, lead_acid_bank, pure_sine_inverter, dc_ac_wiring_protection, qualified_electrical_labour, electrical_inspection |
| Delivery, design, permits, tax and contingency | $21,707.28 | $88,081.87 | delivery_logistics, design_engineering, permits, taxes, contingency |

- Selected public stage: **Basic completed ARC dwelling**, $88,081.87 cash and $89,385.01 economic cost.
- Selected-stage financing payment: **$385.69/month**.
- Layer reconciliation: passed; economic layer reconciliation: passed.

## Cash waterfall

The layer table shows the full price stack. This waterfall makes the boundary between the basic dwelling and external project costs explicit: the first subtotal ends with basic household amenities, then delivery, design and permits are added before tax and contingency.

| Accounting step | Amount |
| --- | ---: |
| Basic dwelling subtotal | **$66,374.59** |
| Project costs before tax | **$5,800.00** |
| Total before tax and contingency | **$72,174.59** |
| Tax/HST allowance | **$9,382.70** |
| Contingency | **$6,524.58** |
| Final cash construction budget | **$88,081.87** |

Project costs before tax are the following required or provisional external project rows:

| Project cost | Amount | Evidence status |
| --- | ---: | --- |
| Supplier freight and local delivery | $1,800.00 | quotation_required |
| Site, structural and servicing design | $3,000.00 | quotation_or_engineering_required |
| Residual permits and approvals | $1,000.00 | site_specific_fee_required |

The project-cost bridge is exactly $5,800.00 = $1,800.00 + $3,000.00 + $1,000.00. The subtotal check is passed: basic dwelling subtotal plus project costs before tax equals the total before tax and contingency.

## Basic completed ARC selection

The completed preset selects only the documented minimal additions. Utility-package fixtures and installation remain in their existing package exactly once. Elective finishes, cabinetry, appliances and bathroom storage/trim are priced but off by default.

| Component | State | Quantity | Materials | Labour | Cash if selected | Evidence |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Basic privacy partition | selected | 7.2 m² | $230.40 | 10.8 h | $473.40 | provisional_itemized_quantity |
| Protective floor surface | selected | 63.043 m² | $630.42 | 12.6 h | $914.12 | provisional_itemized_quantity |
| Basic kitchen counter | selected | 1.08 m² | $151.20 | 5.9 h | $284.85 | provisional_itemized_quantity |
| Wood stove, chimney and fire-safe installation | selected | 1 dwelling | $5,200.00 | 24 h | $6,280.00 | published_product_plus_provisional_assembly |
| Small dwelling ventilation | selected | 63.043 m² | $1,008.68 | 7.6 h | $1,349.11 | provisional_design_allowance |

| Component | State | Quantity | Materials if selected | Labour if selected | Cash if selected | Evidence |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Interior decorative surface finish | not selected | 63.043 m² | $882.59 | 13.9 h | $1,194.66 | optional_itemized_planning_rate |
| Kitchen base cabinetry | not selected | 1 dwelling | $900.00 | 12 h | $1,170.00 | optional_itemized_planning_rate |
| Basic kitchen appliances | not selected | 1 dwelling | $800.00 | 4 h | $890.00 | optional_itemized_planning_rate |
| Optional bathroom storage and trim | not selected | 1 dwelling | $300.00 | 4 h | $390.00 | optional_itemized_planning_rate |

Unresolved or provisional allowances remain visible in the component ledger: supplier freight/local delivery, structural/site/servicing design, residual permits, tax/HST treatment, contingency, the preliminary platform/foundation design, heating/chimney assembly, ventilation design, protective floor product compatibility, privacy partition detailing and basic counter detailing. These are not hidden calibration amounts.

## Water package reconciliation

The earlier ARC water/plumbing/sanitation package was an inclusive **$5,940.00**. The current itemized package is **$6,744.62**, a difference of **$804.62** at the central planning band.

| Current itemized row | Quantity | Materials | Included labour | Included fee | Current cash | Evidence |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Roof collection, first-flush and food-grade storage | 1 allowance | $650.00 | $0.00 | $0.00 | $650.00 | provisional_quote_required |
| Demand pump and pressure hardware | 1 allowance | $420.00 | $0.00 | $0.00 | $420.00 | provisional_quote_required |
| Sediment filtration and UV/RO treatment | 1 package | $548.00 | $0.00 | $0.00 | $548.00 | published_retail_price |
| Compact PEX, valves and fittings | 2 100 ft coil | $122.62 | $0.00 | $0.00 | $122.62 | published_retail_price |
| Sink and private shower fixtures | 1 allowance | $500.00 | $0.00 | $0.00 | $500.00 | published_retail_price_synthesis |
| Drainless composting toilet | 1 each | $1,854.00 | $0.00 | $0.00 | $1,854.00 | published_manufacturer_price_reference |
| Class 2 greywater components and excavation | 1 allowance | $850.00 | $0.00 | $0.00 | $850.00 | provisional_quote_required |
| Qualified plumbing installation and commissioning | 1 allowance | $0.00 | $1,200.00 | $0.00 | $1,200.00 | planning_labour_allowance |
| Water/plumbing permit allowance | 1 allowance | $0.00 | $0.00 | $600.00 | $600.00 | site_specific_fee_required |

The current rows preserve the historical broad design intent and include the qualified plumbing allowance and water/plumbing permit allowance once. Current product prices and planning allowances are possible contributors, but the original historical line-item quotation was not recovered. A changed equipment set is **not established**, and a changed scope is **not established**. The $804.62 attribution therefore remains unresolved rather than being assigned to an invented price or scope change. The current central planning-band package is CAD 804.62 above the historical inclusive CAD 5940.00 package. This is a reconciliation difference, not a hidden discount or calibration adjustment.

## Platform and foundation BOM

The platform is a preliminary circular deck-block concept, not an engineered foundation. Quantities include the stated waste factor and are driven by the reference geometry.

| Item | Quantity | Unit rate | Material / non-labour | Labour | Cash |
| --- | ---: | ---: | ---: | ---: | ---: |
| Concrete deck blocks | 36 each | $10.51 | $378.36 | 19.8 h | $823.86 | [source](https://www.homedepot.ca/en/home/categories/building-materials/concrete-cement-and-masonry/f/bulk-pricing/g2c-xzs) |
| Pressure-treated beams / rim framing | 9 16 ft piece | $46.21 | $415.89 | 5 h | $527.27 | [source](https://www.homedepot.ca/s/en/home/categories/building-materials/lumber-and-composites/dimensional-lumber-and-studs/2-x-8-x-16) |
| SPF joists and blocking | 12 16 ft piece | $39.75 | $477.00 | 6.6 h | $625.50 | [source](https://www.homedepot.ca/s/en/home/categories/building-materials/lumber-and-composites/dimensional-lumber-and-studs/2-x-8-x-16) |
| Tongue-and-groove floor deck | 25 sheet | $93.99 | $2,349.75 | 13.8 h | $2,659.13 | [source](https://www.homedepot.ca/en/home/categories/building-materials/lumber-and-composites/plywood/sheathing-plywood/f/tongue-and-groove/4-x-8/myp-1kki-3f3j) |
| 2 in XPS floor insulation | 49 panel | $43.49 | $2,131.01 | 27 h | $2,737.39 | [source](https://www.rona.ca/en/product/dupont-rigid-insulation-panel-sm-r10-2-x-2-x-8-st248-2-0941038) |
| 6 mil vapour/protective layer | 1 roll | $92.96 | $92.96 | 0.6 h | $105.34 | [source](https://www.homedepot.ca/product/everbilt-10-x-100-1000-sq-ft-ccmc-evaluated-6-mil-vapour-barrier/1000113373) |
| Connectors, fasteners and anchors | 1 allowance | $650.00 | $650.00 | 4 h | $740.00 | allowance / quote required |

## Household systems and amenities

Each row below has one home in the dwelling. Included supplier items are not repriced. Qualified installation and fee rows are separated from materials.

| Item | Quantity | Unit rate | Material / non-labour | Labour | Cash | Evidence |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Roof collection, first-flush and food-grade storage | 1 allowance | $650.00 | $650.00 | 0 h | $650.00 | provisional_quote_required |
| Demand pump and pressure hardware | 1 allowance | $420.00 | $420.00 | 0 h | $420.00 | provisional_quote_required |
| Sediment filtration and UV/RO treatment | 1 package | $548.00 | $548.00 | 0 h | $548.00 | published_retail_price |
| Compact PEX, valves and fittings | 2 100 ft coil | $61.31 | $122.62 | 0 h | $122.62 | published_retail_price |
| Sink and private shower fixtures | 1 allowance | $500.00 | $500.00 | 0 h | $500.00 | published_retail_price_synthesis |
| Drainless composting toilet | 1 each | $1,854.00 | $1,854.00 | 0 h | $1,854.00 | published_manufacturer_price_reference |
| Class 2 greywater components and excavation | 1 allowance | $850.00 | $850.00 | 0 h | $850.00 | provisional_quote_required |
| Qualified plumbing installation and commissioning | 1 allowance | $0.00 | $0.00 | 26.7 h | $1,200.00 | planning_labour_allowance |
| Water/plumbing permit allowance | 1 allowance | $0.00 | $0.00 | 0 h | $600.00 | site_specific_fee_required |
| Summer solar-thermal collector | 1 quote allowance | $650.00 | $650.00 | 0 h | $650.00 | provisional_quote_required |
| Storage tank, valves and controls | 1 allowance | $550.00 | $550.00 | 0 h | $550.00 | provisional_quote_required |
| Winter heater thermosiphon plumbing | 1 allowance | $400.00 | $400.00 | 0 h | $400.00 | planning_design_allowance |
| Hot-water integration labour | 1 allowance | $0.00 | $0.00 | 8.9 h | $400.00 | planning_labour_allowance |
| 400 W PV array | 1 kit | $825.00 | $825.00 | 0 h | $825.00 | published_retail_price |
| MPPT charge controller | 1 each | $196.00 | $196.00 | 0 h | $196.00 | published_retail_price |
| 2.52 kWh nominal lead-acid storage | 1 allowance | $1,050.00 | $1,050.00 | 0 h | $1,050.00 | provisional_quote_required |
| 1,000 W pure-sine inverter | 1 each | $485.00 | $485.00 | 0 h | $485.00 | published_retail_price |
| Wiring, disconnects, fuses and enclosure | 1 allowance | $350.00 | $350.00 | 0 h | $350.00 | provisional_quote_required |
| Electrical inspection allowance | 1 allowance | $0.00 | $0.00 | 0 h | $100.00 | site_specific_fee_required |

## Complete component ledger

| Component | Quantity | Unit | Unit rate | Material / non-labour | Labour | Cash | Evidence |
| --- | ---: | --- | ---: | ---: | ---: | ---: | --- |
| Yurts Canada 30 ft Base Kit | 1 | CAD/package | $36,404.00 | $36,404.00 | 0 h | $36,404.00 | published_supplier_price |
| Concrete deck blocks | 36 | each | $10.51 | $378.36 | 19.8 h | $823.86 | provisional_quantity |
| Pressure-treated beams / rim framing | 9 | 16 ft piece | $46.21 | $415.89 | 5 h | $527.27 | provisional_quantity |
| SPF joists and blocking | 12 | 16 ft piece | $39.75 | $477.00 | 6.6 h | $625.50 | provisional_quantity |
| Tongue-and-groove floor deck | 25 | sheet | $93.99 | $2,349.75 | 13.8 h | $2,659.13 | provisional_quantity |
| 2 in XPS floor insulation | 49 | panel | $43.49 | $2,131.01 | 27 h | $2,737.39 | provisional_quantity |
| 6 mil vapour/protective layer | 1 | roll | $92.96 | $92.96 | 0.6 h | $105.34 | provisional_quantity |
| Connectors, fasteners and anchors | 1 | allowance | $650.00 | $650.00 | 4 h | $740.00 | provisional_quote_required |
| Basic privacy partition | 7.2 | CAD/m2 | $32.00 | $230.40 | 10.8 h | $473.40 | provisional_itemized_quantity |
| Protective floor surface | 63.043 | CAD/m2 | $10.00 | $630.42 | 12.6 h | $914.12 | provisional_itemized_quantity |
| Basic kitchen counter | 1.08 | CAD/m2 | $140.00 | $151.20 | 5.9 h | $284.85 | provisional_itemized_quantity |
| Wood stove, chimney and fire-safe installation | 1 | CAD/dwelling | $5,200.00 | $5,200.00 | 24 h | $6,280.00 | published_product_plus_provisional_assembly |
| Small dwelling ventilation | 63.043 | CAD/m2 | $16.00 | $1,008.68 | 7.6 h | $1,349.11 | provisional_design_allowance |
| Supplier freight and local delivery | 1 | CAD/dwelling | $1,800.00 | $1,800.00 | 0 h | $1,800.00 | quotation_required |
| Site, structural and servicing design | 1 | CAD/dwelling | $3,000.00 | $3,000.00 | 0 h | $3,000.00 | quotation_or_engineering_required |
| Residual permits and approvals | 1 | CAD/dwelling | $1,000.00 | $1,000.00 | 0 h | $1,000.00 | site_specific_fee_required |
| Roof collection, first-flush and food-grade storage | 1 | allowance | $650.00 | $650.00 | 0 h | $650.00 | provisional_quote_required |
| Demand pump and pressure hardware | 1 | allowance | $420.00 | $420.00 | 0 h | $420.00 | provisional_quote_required |
| Sediment filtration and UV/RO treatment | 1 | package | $548.00 | $548.00 | 0 h | $548.00 | published_retail_price |
| Compact PEX, valves and fittings | 2 | 100 ft coil | $61.31 | $122.62 | 0 h | $122.62 | published_retail_price |
| Sink and private shower fixtures | 1 | allowance | $500.00 | $500.00 | 0 h | $500.00 | published_retail_price_synthesis |
| Drainless composting toilet | 1 | each | $1,854.00 | $1,854.00 | 0 h | $1,854.00 | published_manufacturer_price_reference |
| Class 2 greywater components and excavation | 1 | allowance | $850.00 | $850.00 | 0 h | $850.00 | provisional_quote_required |
| Qualified plumbing installation and commissioning | 1 | allowance | $0.00 | $0.00 | 26.7 h | $1,200.00 | planning_labour_allowance |
| Water/plumbing permit allowance | 1 | allowance | $0.00 | $0.00 | 0 h | $600.00 | site_specific_fee_required |
| Summer solar-thermal collector | 1 | quote allowance | $650.00 | $650.00 | 0 h | $650.00 | provisional_quote_required |
| Storage tank, valves and controls | 1 | allowance | $550.00 | $550.00 | 0 h | $550.00 | provisional_quote_required |
| Winter heater thermosiphon plumbing | 1 | allowance | $400.00 | $400.00 | 0 h | $400.00 | planning_design_allowance |
| Hot-water integration labour | 1 | allowance | $0.00 | $0.00 | 8.9 h | $400.00 | planning_labour_allowance |
| 400 W PV array | 1 | kit | $825.00 | $825.00 | 0 h | $825.00 | published_retail_price |
| MPPT charge controller | 1 | each | $196.00 | $196.00 | 0 h | $196.00 | published_retail_price |
| 2.52 kWh nominal lead-acid storage | 1 | allowance | $1,050.00 | $1,050.00 | 0 h | $1,050.00 | provisional_quote_required |
| 1,000 W pure-sine inverter | 1 | each | $485.00 | $485.00 | 0 h | $485.00 | published_retail_price |
| Wiring, disconnects, fuses and enclosure | 1 | allowance | $350.00 | $350.00 | 0 h | $350.00 | provisional_quote_required |
| Qualified electrical installation | 1 | allowance | $0.00 | $0.00 | 15.6 h | $700.00 | planning_labour_allowance |
| Electrical inspection allowance | 1 | allowance | $0.00 | $0.00 | 0 h | $100.00 | site_specific_fee_required |

The visible component rows plus taxes and contingency equal the cash construction budget. Owner-builder work reduces cash expenditure but remains visible as hours and imputed economic value.

## Procurement register

| Material / product | Published unit price | Observed | Status | Source |
| --- | ---: | --- | --- | --- |
| Oldcastle 11 x 11 x 7 in concrete deck block | $10.51 / each | 2026-09-05 | published_retail_price | [source](https://www.homedepot.ca/en/home/categories/building-materials/concrete-cement-and-masonry/f/bulk-pricing/g2c-xzs) |
| Pressure-treated 2 x 8 x 16 ft premium wood | $46.21 / each | 2026-09-05 | published_retail_price | [source](https://www.homedepot.ca/s/en/home/categories/building-materials/lumber-and-composites/dimensional-lumber-and-studs/2-x-8-x-16) |
| SPF 2 x 8 x 16 ft premium dimensional lumber | $39.75 / each | 2026-09-05 | published_retail_price | [source](https://www.homedepot.ca/s/en/home/categories/building-materials/lumber-and-composites/dimensional-lumber-and-studs/2-x-8-x-16) |
| 3/4 in 4 x 8 ft standard spruce tongue-and-groove plywood | $93.99 / sheet | 2026-09-05 | published_retail_price | [source](https://www.homedepot.ca/en/home/categories/building-materials/lumber-and-composites/plywood/sheathing-plywood/f/tongue-and-groove/4-x-8/myp-1kki-3f3j) |
| DuPont SM R10 XPS 2 in x 2 ft x 8 ft panel | $43.49 / panel | 2026-09-05 | published_retail_price | [source](https://www.rona.ca/en/product/dupont-rigid-insulation-panel-sm-r10-2-x-2-x-8-st248-2-0941038) |
| Everbilt CCMC-evaluated 6 mil vapour barrier, 1,000 ft² | $92.96 / roll | 2026-09-05 | published_retail_price | [source](https://www.homedepot.ca/product/everbilt-10-x-100-1000-sq-ft-ccmc-evaluated-6-mil-vapour-barrier/1000113373) |
| Apollo 1/2 in x 100 ft PEX-B pipe | $37.95 / coil | 2026-09-05 | published_retail_price | [source](https://www.homedepot.ca/s/en/home/categories/building-materials/plumbing/pipe-and-fittings/pex-pipes-and-fittings/pex-1-2-ix1) |
| Zurn 1/2 in x 100 ft PEX pipe | $61.31 / coil | 2026-07-29 | published_retail_price | [source](https://www.homedepot.ca/product/zurn-1-2-inch-x-100-ft-pex-pipe-in-white/1001512365) |
| iSpring RCC7AK-UV 7-stage RO with UV | $548.00 / each | 2026-09-05 | published_retail_price | [source](https://www.homedepot.ca/product/ispring-rcc7ak-uv-nsf-certified-75gpd-7-stage-reverse-osmosis-water-filter-system-alkaline-uv-filter/1001103065) |
| Rheem 2.5 gallon point-of-use electric water heater | $331.00 / each | 2026-09-05 | published_retail_price | [source](https://www.homedepot.ca/product/rheem-mini-tank-120-volt-2-5-gallon-compact-point-of-use-electric-water-heater/1001683414) |
| Rocksolar 400 W 12 V rigid solar panel kit | $825.00 / kit | 2026-09-05 | published_retail_price | [source](https://www.homedepot.ca/product/rocksolar-400w-12v-rigid-solar-panel-kit/1001828381) |
| Rocksolar 40 A MPPT charge controller | $196.00 / each | 2026-08-24 | published_retail_price | [source](https://www.homedepot.ca/product/rocksolar-40a-mppt-solar-charge-controller/1001817765) |
| PowerBright 1,000 W 12 V pure-sine inverter | $485.00 / each | 2026-09-05 | published_retail_price | [source](https://www.homedepot.ca/product/power-bright-1000-watt-12v-dc-to-120v-ac-pure-sine-wave-power-inverter/1001281881) |
| Flooded lead-acid storage allowance for 2.52 kWh nominal | $1,050.00 / allowance | 2026-09-05 | provisional_quote_required | quote required |
| Sun-Mar composting toilet allowance | $1,854.00 / each | 2026-09-05 | published_manufacturer_price_reference | [source](https://images.homedepot.ca/pdf/Instructions_1000158002.pdf) |

## Historical ARC comparison only

The former ARC figure remains a historical comparison, not a model input. Its exact integrated total was $61,240.00, publicly rounded to $61,000.00.

| Historical scope | Amount | Status |
| --- | ---: | --- |
| Reinforced insulated structure, platform, masonry heater and chimney | $50,000.00 | historical_design_brief_amount |
| Fixtures, toilet, excavation, compact plumbing, commissioning, CAD 1,200 qualified plumbing labour and CAD 600 permit allowance | $5,940.00 | historical_inclusive_package |
| Winter thermosiphon and summer solar-thermal hot water, including CAD 400 integration labour | $2,000.00 | historical_inclusive_package |
| Approximately 400 W PV, MPPT, 2.52 kWh nominal battery, 1,000 W inverter, CAD 700 qualified electrical labour and CAD 100 inspection allowance | $3,300.00 | historical_inclusive_package |

The historical structural amount was a design-brief figure whose supporting takeoff was not recovered. The present result is not forced to match it; differences arise from the sourced yurt package, platform BOM, additional openings, fit-out, logistics, design, tax, contingency and explicit labour treatment.

## Former-model numerical reconciliation

The former itemized model produced $108,247.21 economic cost. The audited first-principles result is $89,385.05, a change of -$18,862.16. This bridge keeps package scope, tax, contingency and contributed labour visible instead of applying a discount to reach the historical ARC benchmark.

| Component | Original scope / amount | Former model cash | Audited scope / amount | Change from former | Evidence / reason |
| --- | --- | ---: | --- | ---: | --- |
| Water / plumbing / sanitation | Inclusive package / $5,940.00 | $8,685.00 | One inclusive package; included labour and fee decomposed, not added again / $6,744.62 | -$1,940.38 | Historical ARC design brief; original itemized quotation unrecovered. |
| Hot water | Inclusive package including integration labour / $2,000.00 | $2,630.00 | One inclusive package; labour allowance is replaced only by a labour override / $2,000.00 | -$630.00 | Historical ARC design brief; original itemized quotation unrecovered. |
| Household electrical | Inclusive off-grid package including qualified labour and inspection allowance / $3,300.00 | $4,200.00 | One inclusive package; labour and inspection allowance exposed inside package / $3,706.00 | -$494.00 | Historical ARC design brief; original itemized quotation unrecovered. |
| General permits | The utility package includes CAD 600 permit allowance / $0.00 | $1,000.00 | Residual general permit allowance after CAD 600 package offset / $1,000.00 | $0.00 | Historical ARC package detail plus current municipal-fee placeholder. |

The total bridge is direct cash -$12,873.14, tax -$1,543.51, contingency -$1,153.33 and owner-labour economic value -$3,292.18. The bridge isolates corrected bundled-package/permit overlap, then recomputes tax and contingency on the changed cash base. Contributed owner-labour value is shown separately; its delta reflects the changed task scope and labour basis. Structure, kitchen/bath fit-out and other planning-rate differences remain visible as unresolved scope/pricing differences rather than hidden offsets.

## Labour modes

| Mode | Cash budget | Economic cost | Owner hours | Paid hours | Illustrative financing |
| --- | ---: | ---: | ---: | ---: | ---: |
| Owner-builder | $85,172.59 | $87,778.92 | 106 h | 82.7 h | $372.96 / month |
| Mixed labour | $88,081.87 | $89,385.05 | 53 h | 135.7 h | $385.69 / month |
| Contractor-built | $90,991.08 | $90,991.08 | 0 h | 188.6 h | $398.43 / month |

## Size and layout sensitivity

| Diameter | Usable m² | Cash budget | Economic cost | Economic / usable m² | Thresholds |
| --- | ---: | ---: | ---: | ---: | --- |
| 6.096 m / 20 ft | 28.0 | $60,766.54 | $61,510.02 | $2,195.30 | none |
| 7.315 m / 24 ft | 40.3 | $70,941.28 | $71,890.96 | $1,781.81 | none |
| 9.144 m / 30 ft | 63.0 | $88,081.87 | $89,385.05 | $1,417.85 | none |
| 8.230 m / 27 ft · Shelter Designs Big Sky base | 51.1 | $71,755.22 | $72,866.57 | $1,426.95 | none |
| 9.754 m / 32 ft · Out Factory estimate | 71.7 | $119,318.13 | $120,757.68 | $1,683.54 | large_diameter_9_144 |
| 10.668 m / 35 ft · Shelter Designs Big Sky base | 85.8 | $101,774.94 | $103,452.08 | $1,205.62 | large_diameter_9_144 |
| 12.192 m / 40 ft · Shelter Designs Big Sky base | 112.1 | $128,420.18 | $130,500.18 | $1,164.39 | large_diameter_9_144, large_diameter_10_668 |

| Layout | Usable m² | Cash budget | Economic cost | Owner hours | Paid hours |
| --- | ---: | ---: | ---: | ---: | ---: |
| Single storey | 63.0 | $88,081.87 | $89,385.05 | 53 h | 135.7 h |
| Partial loft | 76.2 | $98,374.89 | $100,453.61 | 84.5 h | 168.8 h |
| Full two storeys | 118.1 | $107,869.26 | $110,653.10 | 113.2 h | 202.5 h |

Interpolated sizes are labelled in the JSON contract. Thresholds for larger spans, roof pitch and upper floors are provisional planning rules, not structural approval. Snow, wind, foundations, connections, fire safety and final assemblies require qualified design.

## Accounting boundaries and evidence gaps

- The purchased yurt package is a supplier-price input with its published inclusions and exclusions.
- The platform is a quantity prototype using published retail material prices where available; structural grade, frost, soil, uplift, anchorage and spans require engineering.
- Household water, sanitation, hot water and electrical systems are itemized once. Generic well/septic/grid and centralized services remain alternatives.
- Financing uses the cash construction budget and excludes contributed owner-labour value. Down payment and financed principal are separate from the full cash budget.
- Tax treatment, HST eligibility, municipal approvals, delivery, final supplier installation scope, battery pricing, kitchen/bath fit-out and structural design remain site-specific or quotation-required.
- The dwelling is resident-owned. This does not convey ownership or guaranteed appreciation in the underlying land.

## Sources

- [Living Region: ARC dwelling cost evidence](https://github.com/AndriiZvorygin/living-region/blob/main/packages/carrying-capacity/data/source/arc-dwelling-costs.json) - derived from existing Living Region evidence. Existing integrated ARC package and utility components; original underlying quote remains unrecovered.
- [Biome Canada: The Yurt](https://biome-canada.ca/products/the-yurt/) - supplier specification. Canadian diameter options and included structural/envelope elements support geometry and component boundaries; price is not adopted as a local installed quote.
- [Yurts Canada: Pricing and FAQs](https://www.yurts-canada.ca/pricing-faqs1) - supplier specification. Canadian four-season package and installation/specification context; current quote required for a project.
- [Shelter Designs: Big Sky yurt kits for sale](https://www.shelterdesigns.net/custom-yurt-kits-for-sale/big-sky-yurt/) - published imported supplier USD base price. Published Big Sky base prices for 27 ft, 35 ft and 40 ft are imported shell evidence. Shipping/customs, final delivery, installation, Canadian engineering and local approvals are not included in the base price.
- [Bank of Canada: Daily exchange rates](https://www.bankofcanada.ca/rates/exchange/daily-exchange-rates-lookup/) - official indicative exchange rate. USD/CAD conversion used only to display an estimated Canadian equivalent; observed 2026-09-04. Supplier pricing remains published in USD.
- [Government of Ontario: Build or buy a tiny home: Building Code requirements](https://www.ontario.ca/document/build-or-buy-tiny-home/building-code-requirements) - official requirement guidance. Year-round homes require Building Code compliance, plumbing, energy efficiency, foundations/anchorage and site-specific water/sewage review.
- [Government of Ontario: Build or buy a tiny home: permits and inspections](https://www.ontario.ca/document/build-or-buy-tiny-home/building-code-permits-and-inspections) - official requirement guidance. Building permits and inspections apply to on-site and factory-built tiny homes.
- [Grey County: Development charges](https://www.grey.ca/government/development-charges) - official fee schedule. Development charges are payable when a building permit is issued; actual applicability and current fee require municipal confirmation.
- [Canada Revenue Agency: GST/HST new housing rebate](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc4052.html) - official tax guidance. Tax treatment and any rebate depend on owner-builder/builder facts, timing and eligibility; the calculator keeps HST as an editable planning assumption.
