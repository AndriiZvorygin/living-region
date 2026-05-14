# Local Calibration Source Checklist

This checklist is for manual source collection before adding rows to local calibration CSVs.

## Naming Convention

Use `source_ref` values as stable manifest IDs:

- `local_<org>_<topic>_<year>`
- `ontario_<org>_<topic>_<year>`
- `statcan_<tableid>_<year>`

Example: `ontario_publichealth_foodbasket_2025`

## Quality Tiers

- `direct_local`: Grey/Grey-Bruce local measured source
- `regional_proxy`: nearby regional source suitable with caveat
- `provincial_proxy`: Ontario-level source
- `national_proxy`: Canada-level source
- `scenario_only`: assumption-only placeholder

## food_charity

- Preferred source types: food bank annual reports, program admin dashboards, public health partner reports.
- Acceptable geographies: Grey County, Grey-Bruce, municipality-level in Grey.
- Ideal indicators: `visits`, `unique_clients`, `households_served`, `meals_served`, `hamper_count`.
- Minimum required fields: `geography, organization_or_source, indicator, period_start, period_end, value, unit, source_ref, quality_tier, notes`.
- Claims supported: food insecurity pressure calibration (with caveats unless direct local multi-year series).

## food_price

- Preferred source types: nutritious food basket reports, CPI series, local basket surveys.
- Acceptable geographies: Grey, Grey-Bruce, Ontario, Canada.
- Ideal indicators: `nutritious_food_basket_monthly_cost`, `food_cpi_index`, `grocery_cpi_index`, `item_price`.
- Minimum required fields: `geography, basket_or_item, indicator, period_start, period_end, value, unit, source_ref, quality_tier, notes`.
- Claims supported: affordability/price pressure calibration; avoid mixing CPI/currency/percent without normalization.

## rent_income

- Preferred source types: CMHC, StatCan, Ontario social assistance tables, local housing reports.
- Acceptable geographies: Grey, Grey-Bruce, Ontario, Canada.
- Ideal indicators: `median_rent`, `average_rent`, `shelter_cost_to_income_ratio`, `median_income`, `low_income_measure_rate`, `odsp_single_shelter_allowance`, `minimum_wage_hourly`.
- Minimum required fields: `geography, indicator, period_start, period_end, value, unit, source_ref, quality_tier, notes`.
- Claims supported: household stress / affordability pressure calibration.

## land_access

- Preferred source types: parcel fabric, address points, dwelling-unit linkage, assessment rolls.
- Acceptable geographies: Grey parcel/address-level preferred.
- Ideal indicators: parcel area usable-for-food, dwelling units per parcel, tenure/access constraints.
- Minimum required fields: source-manifested files plus explicit processing notes.
- Claims supported: upgrade proxy land-access claims toward measured local estimates.

## agriculture_labour

- Preferred source types: Census of Population (occupation/industry) and Census of Agriculture farm operator/labour tables.
- Acceptable geographies: Grey CD preferred; Ontario as proxy.
- Ideal indicators: core ag occupations, ag industry workers, hired labour.
- Minimum required fields: table ID, geography filter rules, unit definitions.
- Claims supported: labour bottleneck and scale-up factor calibration.

## local_productivity

- Preferred source types: local grower records, extension benchmarks, crop-labour datasets.
- Acceptable geographies: Grey direct local preferred; Ontario regional proxy acceptable with caveat.
- Ideal indicators: GJ/ha, ha/worker, GJ/worker by production modality/time basis.
- Minimum required fields: modality, period, yield basis, labour basis, source_ref, quality_tier.
- Claims supported: food-gap worker requirements and substitution scenarios.

## Next best direct_local imports

### food_charity_series

Preferred next row pattern:

`geography,organization_or_source,indicator,period_start,period_end,value,unit,source_ref,quality_tier,notes`

Example target indicators:
- `meals_served`
- `households_served`
- `unique_clients`

### food_price_series

Preferred next row pattern:

`geography,basket_or_item,indicator,period_start,period_end,value,unit,source_ref,quality_tier,notes`

Example target indicators:
- `nutritious_food_basket_monthly_cost`
- `item_price`
- `food_cpi_index` (if only index data is available)

### rent_income_series

Preferred next row pattern:

`geography,indicator,period_start,period_end,value,unit,source_ref,quality_tier,notes`

Example target indicators:
- `median_rent`
- `shelter_cost_to_income_ratio`
- `median_income`

### parcel_address_unit_linkage

Target import package:
- parcel polygons
- address points
- building footprints
- dwelling-unit count linkage (if available)

Expected claim effect:
- stronger strict land-access classification confidence

### local_grower_productivity_calibration

Target import rows should support deriving:
- `GJ_per_ha`
- `ha_per_worker`
- `GJ_per_worker`

Expected claim effect:
- tighter worker-equivalent ranges in food-gap replacement scenarios

### crop_labour_benchmark_source

Target import rows should support:
- labour hours per hectare by crop type
- annual yield benchmarks by production modality

Expected claim effect:
- lower uncertainty for scenario labour assumptions
