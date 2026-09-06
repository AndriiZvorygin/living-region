# House Cost Calculator

Generated from contract 4.0.0 on 2026-09-06. This is a first-principles planning model for a resident-owned, four-season yurt dwelling. Land purchase, site lease, shared infrastructure and household operating costs are separate.

## Sourced yurt packages

The package price is the starting input. The old ARC dwelling estimate is not used as a rate, residual or calibration target.

| Supplier | Diameter | Published / estimated price | Price basis | Evidence status |
| --- | ---: | ---: | --- | --- |
| Yurts Canada | 12 ft | $12,420.00 | installed | published_supplier_price |
| Yurts Canada | 16 ft | $16,451.00 | installed | published_supplier_price |
| Yurts Canada | 20 ft | $19,252.00 | installed | published_supplier_price |
| Yurts Canada | 24 ft | $25,681.00 | installed | published_supplier_price |
| Yurts Canada | 30 ft | $36,404.00 | installed | published_supplier_price |
| The Out Factory | 20 ft | $32,958.00 | Canadian non-binding import estimate | non_binding_import_estimate |
| The Out Factory | 24 ft | $37,699.00 | Canadian non-binding import estimate | non_binding_import_estimate |
| The Out Factory | 32 ft | $57,852.00 | Canadian non-binding import estimate | non_binding_import_estimate |
| Biome Canada | 20 ft | quote required | quote required | configurator_options_quote_required |
| Biome Canada | 24 ft | quote required | quote required | configurator_options_quote_required |
| Biome Canada | 30 ft | quote required | quote required | configurator_options_quote_required |

Yurts Canada is the central reference because its public price is a Canadian installed all-season Base Kit. The Out Factory rows are non-binding Canadian import estimates. Biome Canada publishes a configurable package and options but requires a quote for the base total. Package inclusions and exclusions are preserved in the JSON contract.

## Central reference result

- Supplier package: **Yurts Canada 30 ft**, $36,404.00 (exact_published_or_selected_package)
- Geometry: 9.144 m diameter; 65.67 m² gross; 63.04 m² usable after explicit deductions
- Direct cash before tax and contingency: **$79,998.90**
- Taxes / HST allowance: $10,399.86
- Contingency: $7,231.90
- Completed dwelling cash construction budget: **$97,630.66**
- Contributed owner-labour value: $2,177.54
- Completed dwelling economic cost: **$99,808.20**
- Initial financing contribution: $9,763.07; financed principal: $87,867.59
- Illustrative financing: **$566.13/month** at 6% interest and 25-year amortization

This result is independently calculated from a published supplier package, quantity-based platform takeoff, itemized household systems, additional assemblies, labour, tax and contingency.

## Layered price from package to dwelling

The public starting view is the selected supplier package. It is distinct from the completed dwelling. Select the **Basic completed ARC dwelling** stage to include all five layers, or stop earlier to see outstanding requirements before occupancy.

| Layer | Incremental cash | Running cash total | Component rows |
| --- | ---: | ---: | --- |
| Yurt package | $36,404.00 | $36,404.00 | purchased_yurt_package |
| Platform and foundation | $8,218.49 | $44,622.49 | platform_support_blocks, platform_pt_beams, platform_joists, platform_decking, platform_floor_insulation, platform_vapour_layer, platform_connectors |
| Four-season completion | $11,600.79 | $56,223.28 | interior_finish_materials, wood_stove_and_chimney, balanced_ventilation |
| Basic household amenities | $17,975.62 | $74,198.90 | kitchen_fitout_materials, bathroom_fitout_materials, water_collection_storage_first_flush, water_demand_pump, water_sediment_and_uv, compact_pex_and_fittings, sink_and_shower_fixtures, composting_toilet, class_2_greywater, qualified_water_installation, water_permit_allowance, solar_thermal_collector, hot_water_storage_and_controls, thermosiphon_integration, hot_water_integration_labour, pv_400w, mppt_controller, lead_acid_bank, pure_sine_inverter, dc_ac_wiring_protection, qualified_electrical_labour, electrical_inspection |
| Project costs and optional upgrades | $23,431.76 | $97,630.66 | delivery_logistics, design_engineering, permits, taxes, contingency |

- Selected public stage: **Yurt package**, $36,404.00 cash and $36,404.00 economic cost.
- Selected-stage financing payment: **$211.10/month**.
- Layer reconciliation: passed; economic layer reconciliation: passed.

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
| Interior floor finish and partitions | 63.043 | CAD/m2 | $45.00 | $2,836.91 | 50.4 h | $3,971.68 | provisional_material_and_labour_allowance |
| Kitchen cabinetry, counter and basic appliances | 1 | CAD/dwelling | $2,750.00 | $2,750.00 | 26 h | $3,335.00 | provisional_itemized_fitout_allowance |
| Bathroom non-plumbing fit-out | 1 | CAD/dwelling | $1,650.00 | $1,650.00 | 24 h | $2,190.00 | provisional_itemized_fitout_allowance |
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

The former itemized model produced $108,247.21 economic cost. The audited first-principles result is $99,808.20, a change of -$8,439.01. This bridge keeps package scope, tax, contingency and contributed labour visible instead of applying a discount to reach the historical ARC benchmark.

| Component | Original scope / amount | Former model cash | Audited scope / amount | Change from former | Evidence / reason |
| --- | --- | ---: | --- | ---: | --- |
| Water / plumbing / sanitation | Inclusive package / $5,940.00 | $8,685.00 | One inclusive package; included labour and fee decomposed, not added again / $6,744.62 | -$1,940.38 | Historical ARC design brief; original itemized quotation unrecovered. |
| Hot water | Inclusive package including integration labour / $2,000.00 | $2,630.00 | One inclusive package; labour allowance is replaced only by a labour override / $2,000.00 | -$630.00 | Historical ARC design brief; original itemized quotation unrecovered. |
| Household electrical | Inclusive off-grid package including qualified labour and inspection allowance / $3,300.00 | $4,200.00 | One inclusive package; labour and inspection allowance exposed inside package / $3,706.00 | -$494.00 | Historical ARC design brief; original itemized quotation unrecovered. |
| General permits | The utility package includes CAD 600 permit allowance / $0.00 | $1,000.00 | Residual general permit allowance after CAD 600 package offset / $1,000.00 | $0.00 | Historical ARC package detail plus current municipal-fee placeholder. |

The total bridge is direct cash -$5,048.83, tax -$526.35, contingency -$446.01 and owner-labour economic value -$2,417.82. The bridge isolates corrected bundled-package/permit overlap, then recomputes tax and contingency on the changed cash base. Contributed owner-labour value is shown separately; its delta reflects the changed task scope and labour basis. Structure, kitchen/bath fit-out and other planning-rate differences remain visible as unresolved scope/pricing differences rather than hidden offsets.

## Labour modes

| Mode | Cash budget | Economic cost | Owner hours | Paid hours | Illustrative financing |
| --- | ---: | ---: | ---: | ---: | ---: |
| Owner-builder | $92,769.45 | $97,124.49 | 177 h | 82.7 h | $537.94 / month |
| Mixed labour | $97,630.66 | $99,808.20 | 88.5 h | 171.2 h | $566.13 / month |
| Contractor-built | $102,491.80 | $102,491.80 | 0 h | 259.7 h | $594.32 / month |

## Size and layout sensitivity

| Diameter | Usable m² | Cash budget | Economic cost | Economic / usable m² | Thresholds |
| --- | ---: | ---: | ---: | ---: | --- |
| 6.096 m / 20 ft | 28.0 | $68,242.30 | $69,601.66 | $2,484.10 | none |
| 7.315 m / 24 ft | 40.3 | $79,146.75 | $80,803.30 | $2,002.70 | none |
| 9.144 m / 30 ft | 63.0 | $97,630.66 | $99,808.20 | $1,583.19 | none |
| 10.668 m / 35 ft | 85.8 | $106,799.23 | $109,518.73 | $1,276.32 | large_diameter_9_144 |
| 12.192 m / 40 ft | 112.1 | $119,257.43 | $122,573.64 | $1,093.67 | large_diameter_9_144, large_diameter_10_668 |

| Layout | Usable m² | Cash budget | Economic cost | Owner hours | Paid hours |
| --- | ---: | ---: | ---: | ---: | ---: |
| Single storey | 63.0 | $97,630.66 | $99,808.20 | 88.5 h | 171.2 h |
| Partial loft | 76.2 | $108,703.71 | $111,754.05 | 124 h | 208.3 h |
| Full two storeys | 118.1 | $120,676.00 | $124,740.41 | 165.2 h | 254.5 h |

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
- [Government of Ontario: Build or buy a tiny home: Building Code requirements](https://www.ontario.ca/document/build-or-buy-tiny-home/building-code-requirements) - official requirement guidance. Year-round homes require Building Code compliance, plumbing, energy efficiency, foundations/anchorage and site-specific water/sewage review.
- [Government of Ontario: Build or buy a tiny home: permits and inspections](https://www.ontario.ca/document/build-or-buy-tiny-home/building-code-permits-and-inspections) - official requirement guidance. Building permits and inspections apply to on-site and factory-built tiny homes.
- [Grey County: Development charges](https://www.grey.ca/government/development-charges) - official fee schedule. Development charges are payable when a building permit is issued; actual applicability and current fee require municipal confirmation.
- [Canada Revenue Agency: GST/HST new housing rebate](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc4052.html) - official tax guidance. Tax treatment and any rebate depend on owner-builder/builder facts, timing and eligibility; the calculator keeps HST as an editable planning assumption.
