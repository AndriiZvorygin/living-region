# Grey County ARC land-market evidence

This report keeps farmland benchmarks, vacant-land evidence, improved-property acquisition evidence and planning sensitivities separate. Improved properties enter gross acquisition economics at their actual whole-property asking or sale price; no farmhouse, barn or servicing value is silently subtracted. Asking prices are observations, not completed-sale values.

## Evidence summary

- 39 observations loaded; 30 usable vacant/land-curve observations; 7 improved-property observations retained for gross acquisition analysis; 36 potentially ARC-usable acquisitions after unverified/strategic exclusions.
- Minimum sample for a band median: **3 observations**. Local curve status: **partial_measured_whole_property_curve**.
- The Ontario survey comparator contributes 1 productive-land benchmark(s), separate from the whole-property curve.

## Loaded observations

| Observation | Date | Municipality | Property class | Raw price | Adjusted price | Total area | Productive area | Raw $/ha | Curve treatment | Source / confidence |
|---|---|---|---|---:|---:|---:|---:|---:|---|---|
| grey-2024-tillable-benchmark | 2024-12-31 | Grey County | average_quality_cropland_benchmark | $19000 | unresolved | not supplied | not supplied | $46950 | excluded: not classified | [source](https://www.onfarmlandsurvey.com/_files/ugd/25f478_d4037c4c1a514db29440ad1d0cfb5c73.pdf) · survey_benchmark |
| grey-x12006980-177970-grey-road-18 | 2026-07-24 | Georgian Bluffs | vacant_building_lot | $249900 | unresolved | 0.40 ha | not supplied | $617516 | vacant_land; gross acquisition view | [source](https://www.suttonsoundrealty.ca/listings/view/695184/georgian-bluffs/georgian-bluffs/177970-grey-road-18) · public_listing_observation |
| grey-40782201-409006-grey-road-4 | 2026-05 | Grey Highlands | vacant_building_lot | $250000 | unresolved | 0.51 ha | not supplied | $486428 | vacant_land; gross acquisition view | [source](https://www.royallepage.ca/en/property/ontario/feversham/409006-grey-road-4/27240756/mls40782201/) · public_listing_observation |
| grey-x13050500-120-anderson-drive-s | 2026-04-27 | West Grey | vacant_building_lot | $225000 | unresolved | 0.43 ha | not supplied | $521564 | vacant_land; gross acquisition view | [source](https://www.zolo.ca/west-grey-real-estate/120-anderson-drive-south) · public_listing_observation |
| grey-x13130802-120-forest-creek-trail | 2026-07 | West Grey | vacant_building_lot | $199999 | unresolved | 0.44 ha | not supplied | $457600 | vacant_land; gross acquisition view | [source](https://www.rew.ca/properties/120-forest-creek-trail-west-grey-on) · public_listing_observation |
| grey-x11935568-382309-concession-17 | 2025-01-22 | Georgian Bluffs | vacant_building_lot | $219000 | unresolved | 0.51 ha | not supplied | $432929 | vacant_land; gross acquisition view | [source](https://www.suttonsoundrealty.ca/listings/view/666324/georgian-bluffs/georgian-bluffs/382309-concession-17) · recent_public_listing_observation |
| grey-x13580126-part-lot-17-grey-road-17 | 2026-07-20 | Georgian Bluffs | vacant_building_lot | $299000 | unresolved | 0.93 ha | not supplied | $321237 | vacant_land; gross acquisition view | [source](https://www.royallepage.ca/en/property/ontario/georgian-bluffs/part-lot-17-grey-road-17-road-e/28743911/mlsx13580126/) · public_listing_observation |
| grey-x10846397-part-lot-25-grey-road-17 | 2026-07-02 | Georgian Bluffs | vacant_building_lot | $275000 | unresolved | 0.81 ha | not supplied | $337743 | vacant_land; gross acquisition view | [source](https://www.suttonsoundrealty.ca/listings/view/666318/georgian-bluffs/georgian-bluffs/pt-lt-25-conc-16-grey-road-17) · public_listing_observation |
| grey-x13430714-part-2-grey-road-12 | 2026-06-11 | Meaford | vacant_building_lot | $375000 | unresolved | 1.32 ha | not supplied | $285122 | vacant_land; gross acquisition view | [source](https://www.redfin.ca/on/meaford/PART-2-Part-South-1-2Lot2-Grey-Road-12-N-A-N4L-1W6/home/202213212) · public_listing_observation |
| grey-x12192075-773462-highway-10 | 2026-02-23 | Grey Highlands | vacant_building_lot | $299000 | unresolved | 1.42 ha | not supplied | $211099 | vacant_land; gross acquisition view | [source](https://locationsnorth.com/listing/773462-highway-10-road-n-grey-highlands-ontario-x12192075/) · public_listing_observation |
| grey-x12743672-401619-grey-road-4 | 2026-05 | West Grey | vacant_building_lot | $179900 | unresolved | 1.21 ha | not supplied | $148181 | vacant_land; gross acquisition view | [source](https://www.royallepage.ca/en/property/ontario/west-grey/401619-grey-road-4/27190123/mlsx12743672/) · public_listing_observation |
| grey-40802363-pt-lt-48-concession-3 | 2026-07 | West Grey | vacant_building_lot | $269500 | unresolved | 1.97 ha | not supplied | $136465 | vacant_land; gross acquisition view | [source](https://www.royallepage.ca/en/property/ontario/west-grey/pt-lt-48-concession-3-road/27278917/mls40802363/) · public_listing_observation |
| grey-x13425154-801331-sideroad-2 | 2026-06-12 | Chatsworth | vacant_land_with_outbuilding | $324900 | unresolved | 1.72 ha | not supplied | $188905 | improved_property; gross acquisition view | [source](https://www.zolo.ca/chatsworth-real-estate/801331-sideroad-2-side-road) · public_listing_observation |
| grey-x12998054-201-con-2-swtsr | 2026-05 | Southgate | vacant_agricultural_land | $245000 | unresolved | 3.77 ha | not supplied | $64979 | vacant_land; gross acquisition view | [source](https://www.squareyards.ca/sale/on/grey-county/southgate/houses-under-500-thousand) · public_listing_observation |
| grey-40812575-112314-grey-road-14 | 2026-07 | Southgate | vacant_rural_land | $350000 | unresolved | 4.00 ha | not supplied | $87449 | vacant_land; gross acquisition view | [source](https://www.royallepage.ca/en/property/ontario/southgate/112314-grey-county-road-14/27618784/mls40812575/) · public_listing_observation |
| grey-x13212326-pt-lt-15-baseline | 2026-07-19 | West Grey | vacant_rural_land | $350000 | unresolved | 3.81 ha | not supplied | $91910 | vacant_land; gross acquisition view | [source](https://lisavandenberg.ca/listing/ON/West-Grey/Pt-Lt-15-Baseline-Road-N0C-1H0/228279357) · public_listing_observation |
| grey-40619252-pt-lt-20-sideroad-40 | 2024-07-12 | West Grey | vacant_woodland | $125000 | unresolved | 3.24 ha | not supplied | $38610 | vacant_land; gross acquisition view | [source](https://www.squareyards.ca/sale/on/grey-county/west-grey/rural-west-grey/pt-lt-20-sideroad-40-n0c-1h0) · recent_public_sale_listing_observation |
| grey-196300-grey-road-7-6-972-acres | 2026-07 | Grey Highlands | rural_residential_with_dwelling | $599000 | unresolved | 2.82 ha | not supplied | $212301 | improved_property; gross acquisition view | [source](https://www.royallepage.ca/en/property/ontario/grey-highlands/196300-grey-road-7-road/28195749/mlsx13160720/) · public_listing_observation |
| grey-495155-traverston-6-3-acres | 2026-07 | West Grey | farm_with_dwelling | $749000 | unresolved | 2.55 ha | not supplied | $293781 | improved_property; gross acquisition view | [source](https://www.greycountyrealestate.com/properties) · public_listing_observation |
| grey-x13607754-pt-lot-88-hwy-10 | 2026-07 | West Grey | vacant_woodland | $249000 | unresolved | 4.05 ha | not supplied | $61529 | improved_property; gross acquisition view | [source](https://www.royallepage.ca/en/property/ontario/west-grey/pt-lot-88-hwy-10-highway/28814084/mlsx13607754/) · public_listing_observation |
| grey-x13212578-part-lot-20-concession-14 | 2026-05-29 | Georgian Bluffs | vacant_rural_land | $339000 | unresolved | 4.35 ha | not supplied | $77997 | vacant_land; gross acquisition view | [source](https://soldwell.com/real-estate/Georgian-Bluffs-ON/PART-LOT-20-CONCESSION-ROAD-14-Concession-N0H-2K0-X13212578-10933896) · public_listing_observation |
| grey-x12789044-lot-22-sideroad-22 | 2026-02-14 | Meaford | vacant_woodland | $199000 | unresolved | 7.69 ha | not supplied | $25881 | vacant_land; gross acquisition view | [source](https://ontario.onepercentrealty.com/properties/1509518331/MEAFORD-LOT_22_SIDEROAD_22) · public_listing_observation |
| grey-public-12-4-acre-williamsford | 2026-07 | South Bruce Peninsula | vacant_woodland | $399000 | unresolved | 5.02 ha | not supplied | $79512 | vacant_land; gross acquisition view | [source](https://www.greycountyrealestate.com/properties?format=list) · public_listing_index_observation_lower_confidence |
| grey-x13521894-part-lot-2-conc-17 | 2026-06 | Georgian Bluffs | vacant_woodland | $58700 | unresolved | 5.46 ha | not supplied | $10745 | excluded: excluded_unverified | [source](https://www.steacydenhaan.ca/listings/listings/on/georgian-bluffs/part-lot-2-conc-17-road?listingId=28603961&print=1) · search_index_only_needs_verification |
| grey-x13410450-part-lot-24-grey-road-12 | 2026-06-06 | West Grey | vacant_woodland | $475000 | unresolved | 10.12 ha | not supplied | $46950 | vacant_land; gross acquisition view | [source](https://robertporteous.com/home-for-sale/part-lot-24-grey-road-12-west-grey-ontario-n0c-1h0/) · public_listing_observation |
| grey-x13548218-ptlt-39-con-25-ne | 2026-07-10 | Georgian Bluffs | vacant_woodland | $349000 | unresolved | 10.52 ha | not supplied | $33169 | vacant_land; gross acquisition view | [source](https://revelrealty.ca/listing/ptlt-39-con-25-n-e-georgian-bluffs-ontario-n0h-2t0-30016820/) · public_listing_observation |
| grey-x12911920-395549-concession-2 | 2026-04 | Chatsworth | vacant_rural_land | $479000 | unresolved | 11.10 ha | not supplied | $43167 | vacant_land; gross acquisition view | [source](https://krib.ca/chatsworth/395549-concession-2/mlsNumber-X12911920) · public_listing_observation |
| grey-x12342111-448020-10th-concession | 2026-03-03 | Grey Highlands | vacant_agricultural_land | $800000 | unresolved | 12.14 ha | 6.47 ha | $65895 | vacant_land; gross acquisition view | [source](https://www.remaxspec.co/property/64-X12342111-448020-10th-concession-grey-highlands-ON-N0C1C0) · public_listing_observation |
| grey-x12736968-23-3rd-line-d-line-e | 2026-05 | Grey Highlands | vacant_woodland | $3200000 | unresolved | 18.21 ha | not supplied | $175719 | vacant_land; gross acquisition view | [source](https://www.royallepage.ca/en/property/ontario/grey-highlands/23-3rd-line-d-line-e/27176122/mlsx12736968/) · public_listing_observation |
| grey-x12494384-lt-42-con-2-netsr | 2025-10 | Chatsworth | vacant_rural_land | $499900 | unresolved | 29.54 ha | not supplied | $16922 | vacant_land; gross acquisition view | [source](https://www.royallepage.ca/en/property/ontario/chatsworth/lt-42-con-2-netsr/26646796/mlsx12494384/) · public_listing_observation |
| grey-x12308978-pl11-12-10-side-road | 2026-05 | Chatsworth | vacant_agricultural_land | $999900 | unresolved | 39.25 ha | 16.19 ha | $25472 | vacant_land; gross acquisition view | [source](https://www.royallepage.ca/en/property/ontario/chatsworth/pl11-12-10-side-road/25799159/mlsx12308978/) · public_listing_observation |
| grey-x13159882-lot-24-concession-14 | 2026-07 | Georgian Bluffs | vacant_rural_land | $799000 | unresolved | 40.47 ha | not supplied | $19744 | vacant_land; gross acquisition view | [source](https://www.royallepage.ca/en/property/ontario/georgian-bluffs/lot-24-concession-14-keppel-concession/28185832/mlsx13159882/) · public_listing_observation |
| grey-x13169206-442318-concession-21 | 2026-05-25 | Georgian Bluffs | vacant_woodland | $449000 | unresolved | 20.23 ha | not supplied | $22190 | vacant_land; gross acquisition view | [source](https://soldwell.com/real-estate/Georgian-Bluffs-ON/442318-CONCESSION-21-Concession-N0H-2T0-X13169206-10916628) · public_listing_observation_approximate_area |
| grey-public-52-acre-priceville | 2026-07 | Grey Highlands | vacant_woodland | $429000 | unresolved | 21.04 ha | not supplied | $20386 | vacant_land; gross acquisition view | [source](https://www.greycountyrealestate.com/properties?format=list) · public_listing_index_observation_lower_confidence |
| grey-x12937214-south-of-keady-grey-road-3 | 2026-03-30 | Chatsworth | vacant_agricultural_land | $999900 | unresolved | 60.70 ha | not supplied | $16472 | vacant_land; gross acquisition view | [source](https://ontario.onepercentrealty.com/properties/1530904929/CHATSWORTH-SOUTH_OF_KEADY_GREY_ROAD_3_S) · public_listing_observation |
| grey-x12829838-409155-grey-road-4 | 2026-04 | Grey Highlands | farm_with_dwelling_and_outbuildings | $2550000 | unresolved | 40.47 ha | 24.28 ha | $63012 | improved_property; gross acquisition view | [source](https://robertporteous.com/home-for-sale/409155-grey-road-4-grey-highlands-on-n0c-1m0/) · public_listing_observation |
| grey-x12235333-135389-concession-8 | 2025-06-20 | Chatsworth | farm_with_dwelling_and_outbuildings | $998000 | unresolved | 40.26 ha | 16.19 ha | $24788 | improved_property; gross acquisition view | [source](https://www.movewithmanoj.ca/mls-listings/Chatsworth/Chatsworth/Concession%208/X12551506) · recent_public_listing_observation |
| grey-x13221646-158567-highway-10 | 2026-07 | Melancthon | vacant_agricultural_land | $18000000 | unresolved | 59.89 ha | 50.59 ha | $300534 | excluded: excluded_strategic_or_development_premium | [source](https://www.royallepage.ca/en/property/ontario/melancthon/158567-highway-10/28276877/mlsx13221646/) · public_listing_observation |
| grey-x12772394-304599-south-line | 2026-02 | West Grey | farm_with_outbuildings | $1425000 | unresolved | 40.21 ha | 16.19 ha | $35436 | improved_property; gross acquisition view | [source](https://www.jumprealty.ca/304599-south-line-west-grey-ontario-mls-x12772394) · public_listing_observation |

## Parcel-size bands

| Band | Vacant n | Vacant gross $/ha | Improved n | Improved gross $/ha | All ARC-usable n | All ARC-usable gross $/ha | All median acquisition |
|---|---:|---:|---:|---:|---:|---:|---:|
| <2 ha | 11 | $337743 | 1 | unresolved | 12 | $329490 | $259750 |
| 2–5 ha | 6 | $71488 | 3 | $212301 | 8 | $82723 | $344500 |
| 5–10 ha | 2 | unresolved | 0 | unresolved | 2 | unresolved | unresolved |
| 10–20 ha | 5 | $46950 | 0 | unresolved | 5 | $46950 | $479000 |
| 20–40 ha | 4 | $21288 | 0 | unresolved | 4 | $21288 | $474450 |
| 40+ ha | 2 | unresolved | 3 | $35436 | 5 | $24788 | $999900 |

The three views answer different questions: vacant land estimates the pure land component; improved property shows the gross acquisition cost of real farms/rural properties; all ARC-usable acquisitions provides a broad whole-property acquisition comparator. Each band remains unresolved when its own sample is below the minimum threshold.

## Improvement reuse layer

The 7 improved-property observations are retained. 1 minor-improvement observation also remains in the vacant/land curve because its sheds are not treated as a substantial building asset. All known homes, barns, access, wells, septic and hydro are flagged per observation as usable, potentially reusable or condition unknown; monetary offsets remain unresolved until inspection, approval and replacement-cost evidence exist.

| Observation | Property type | Gross acquisition | Gross $/ha | Candidate reuse assets | Offset status |
|---|---|---:|---:|---|---|
| grey-x13425154-801331-sideroad-2 | vacant_land_with_outbuilding | $324900 | $188905 | workshop_storage, agricultural_buildings, road_access, well_water_system, grid_electrical_service | reuse_value_unresolved |
| grey-196300-grey-road-7-6-972-acres | rural_residential_with_dwelling | $599000 | $212301 | resident_dwelling, common_amenity_building, well_water_system, septic_sanitation | reuse_value_unresolved |
| grey-495155-traverston-6-3-acres | farm_with_dwelling | $749000 | $293781 | resident_dwelling, common_amenity_building | reuse_value_unresolved |
| grey-x13607754-pt-lot-88-hwy-10 | vacant_woodland | $249000 | $61529 | workshop_storage, agricultural_buildings, road_access, grid_electrical_service | reuse_value_unresolved |
| grey-x12829838-409155-grey-road-4 | farm_with_dwelling_and_outbuildings | $2550000 | $63012 | resident_dwelling, common_amenity_building, workshop_storage, agricultural_buildings, road_access, well_water_system, septic_sanitation, grid_electrical_service | reuse_value_unresolved |
| grey-x12235333-135389-concession-8 | farm_with_dwelling_and_outbuildings | $998000 | $24788 | resident_dwelling, common_amenity_building, workshop_storage, agricultural_buildings, road_access, well_water_system, septic_sanitation, grid_electrical_service | reuse_value_unresolved |
| grey-x12772394-304599-south-line | farm_with_outbuildings | $1425000 | $35436 | workshop_storage, agricultural_buildings, road_access, well_water_system | reuse_value_unresolved |

Adjusted land-value evidence: **unresolved_no_documented_improvement_adjustments** (0 observations). Adjusted residuals remain analytical only and never replace gross purchase prices in ARC acquisition economics.

## Productive-land comparator

| Comparator | Value | Evidence status | Interpretation |
|---|---:|---|---|
| grey-2024-tillable-benchmark | $46950 / productive ha | survey_benchmark | Tillable-acre survey benchmark; not a whole-parcel transaction. |

## Current conclusion

- Local size curve status: **partial_measured_whole_property_curve**.
- Planning curve status: **fallback_only_for_unresolved_or_sparse_bands**.
- The 5–10 ha value is anchored to the 2024 Grey County survey benchmark converted from CAD 19,000 per tillable acre. Other values remain explicit fallback sensitivities and are not used when a parcel-size band has sufficient local observations.
- The loaded observations show a strong small-lot premium and lower observed whole-property $/ha in the 10–20 ha and 20–40 ha bands. This supports testing a size effect, but it is not a causal estimate: the sample mixes rural-residential lots, woodland, agricultural land, access, zoning, wetland, recreational and other site differences.
- Asking prices are not sale prices. The 5–10 ha and 40+ ha bands remain below the minimum sample threshold and are not used as market medians.

## Sources

- [Ontario Farmland Value and Rental Value Survey: 2024 Farmland Value Rental Value Survey](https://www.onfarmlandsurvey.com/_files/ugd/25f478_d4037c4c1a514db29440ad1d0cfb5c73.pdf) — survey_benchmark. Reports tillable-acre values and response counts, not whole-parcel size-tagged transactions or bare-land sale records.
- [Royal LePage RCR Realty / public brokerage listing pages: Grey County vacant-land and farm listing observations](https://www.royallepage.ca/en/on/west-grey/land/properties/) — public_listing_observations. Asking prices are not completed sale prices; listing descriptions and acreage should be independently verified before acquisition decisions.
- [Sutton-Sound Realty: Grey County vacant-land listing observations](https://www.suttonsoundrealty.ca/office-listings?p=6) — public_listing_observations. Asking prices and listing status can change; observations are preserved with the source URL and retrieval date.
- [Public brokerage-fed listing pages: REW, Zolo, Squareyards, One Percent Realty, Krib and comparable public listing pages](https://www.rew.ca/properties/areas/west-grey-on/type/land-lot) — public_listing_observations. Secondary listing displays may lag source brokerage records and are used as documented observations, not as a substitute for verified sale data.
- [Ontario Ministry of Agriculture, Food and Agribusiness: Estimated value and rental rate of farmland by county and township](https://data.ontario.ca/en/dataset/estimated-value-and-rental-rate-of-farmland-by-county-and-township) — official_context_dataset. Farm land/building value context is not a parcel-size curve and does not isolate ARC-suitable bare land.
- [Farm Credit Canada: FCC Farmland Values Report](https://www.fcc-fac.ca/en/knowledge/economics/farmland-values-report) — authoritative_comparator. Regional cultivated-land value trends are not Grey County parcel-size observations and detailed historical data require FCC Online Services access.
- [Statistics Canada: Farm capital, Census of Agriculture, 2021, Table 32-10-0237-01](https://www150.statcan.gc.ca/n1/en/catalogue/3210023701) — official_context_dataset. Value of land and buildings includes improvements and is not a bare-land parcel-price series.
