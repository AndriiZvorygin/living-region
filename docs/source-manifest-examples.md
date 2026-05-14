# Source Manifest Examples

These are templates only. Do not copy with fake hashes or dates.

## Example entries

```json
{
  "source_id": "local_greybruce_foodbank_annual_2025",
  "source_class": "manual_curated_input",
  "title": "Grey Bruce food bank annual report 2025",
  "origin_url": "https://example.org/report.pdf",
  "retrieved_at": "2026-05-14T00:00:00Z",
  "local_path": "know/input/local-calibration/raw/foodbank-annual-2025.pdf",
  "content_hash": "sha256:<replace-with-real-hash>",
  "licence": "Source terms apply",
  "schema_version": "1.0",
  "notes": "Used for meals_served/households_served indicators"
}
```

```json
{
  "source_id": "ontario_publichealth_foodbasket_2025",
  "source_class": "external_snapshot",
  "title": "Ontario nutritious food basket report 2025",
  "origin_url": "https://example.org/foodbasket",
  "retrieved_at": "2026-05-14T00:00:00Z",
  "local_path": "know/input/local-calibration/raw/ontario-foodbasket-2025.csv",
  "content_hash": "sha256:<replace-with-real-hash>",
  "licence": "Public report with attribution",
  "schema_version": "1.0",
  "notes": "Monthly basket cost trend"
}
```

```json
{
  "source_id": "cmhc_rent_table_2025",
  "source_class": "external_snapshot",
  "title": "CMHC rent table 2025",
  "origin_url": "https://example.org/cmhc-rent",
  "retrieved_at": "2026-05-14T00:00:00Z",
  "local_path": "know/input/local-calibration/raw/cmhc-rent-2025.csv",
  "content_hash": "sha256:<replace-with-real-hash>",
  "licence": "CMHC terms",
  "schema_version": "1.0",
  "notes": "Average/median rent indicators"
}
```

```json
{
  "source_id": "statcan_income_table_1310xxxx_2025",
  "source_class": "external_snapshot",
  "title": "StatCan income table",
  "origin_url": "https://www150.statcan.gc.ca/",
  "retrieved_at": "2026-05-14T00:00:00Z",
  "local_path": "know/input/local-calibration/raw/statcan-income-2025.csv",
  "content_hash": "sha256:<replace-with-real-hash>",
  "licence": "Statistics Canada Open Licence",
  "schema_version": "1.0",
  "notes": "Median income and distribution context"
}
```

```json
{
  "source_id": "ontario_odsp_rates_2026",
  "source_class": "external_snapshot",
  "title": "Ontario ODSP shelter allowance rates",
  "origin_url": "https://www.ontario.ca/",
  "retrieved_at": "2026-05-14T00:00:00Z",
  "local_path": "know/input/local-calibration/raw/ontario-odsp-2026.csv",
  "content_hash": "sha256:<replace-with-real-hash>",
  "licence": "Ontario open information terms",
  "schema_version": "1.0",
  "notes": "Used for rent-income pressure comparisons"
}
```

```json
{
  "source_id": "statcan_census_ag_3210038201_2021",
  "source_class": "external_snapshot",
  "title": "Census of Agriculture table 32-10-0382-01",
  "origin_url": "https://www150.statcan.gc.ca/",
  "retrieved_at": "2026-05-14T00:00:00Z",
  "local_path": "know/input/census-agriculture/2021/3210038201.csv",
  "content_hash": "sha256:<replace-with-real-hash>",
  "licence": "Statistics Canada Open Licence",
  "schema_version": "1.0",
  "notes": "Farm operators and work hours"
}
```

```json
{
  "source_id": "local_grey_parcel_address_export_2026",
  "source_class": "manual_curated_input",
  "title": "Municipal parcel/address export",
  "local_origin": "Municipal data share",
  "retrieved_at": "2026-05-14T00:00:00Z",
  "local_path": "know/input/local-calibration/raw/grey-parcel-address-2026.gpkg",
  "content_hash": "sha256:<replace-with-real-hash>",
  "licence": "Municipal sharing terms",
  "schema_version": "1.0",
  "notes": "Future parcel/address/dwelling linkage calibration"
}
```

## CSV row examples (documentation-only)

Food charity (`food-charity-series.csv`):

```csv
geography,organization_or_source,indicator,period_start,period_end,value,unit,source_ref,quality_tier,notes
Grey-Bruce,Example Food Bank,meals_served,2025-01-01,2025-12-31,365000,meals,local_greybruce_foodbank_annual_2025,direct_local,Annual total
```

Food price (`food-price-series.csv`):

```csv
geography,basket_or_item,indicator,period_start,period_end,value,unit,source_ref,quality_tier,notes
Ontario,Nutritious basket,nutritious_food_basket_monthly_cost,2025-01-01,2025-01-31,412.35,$,ontario_publichealth_foodbasket_2025,provincial_proxy,Monthly basket cost
```

Rent/income (`rent-income-series.csv`):

```csv
geography,indicator,period_start,period_end,value,unit,source_ref,quality_tier,notes
Ontario,odsp_single_shelter_allowance,2026-01-01,2026-12-31,556,$,ontario_odsp_rates_2026,provincial_proxy,Single adult shelter allowance
```

