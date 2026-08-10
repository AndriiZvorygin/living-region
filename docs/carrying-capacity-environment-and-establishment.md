# Carrying capacity: local environment and bare-land establishment

## What changed

The household/site calculation now has two separate layers:

1. **Biological requirement:** a locally contextualized annual and perennial food system, a new perennial footprint, year-by-year annual bridge, valid young-row intercropping, heating biomass and exclusive resilience reserve.
2. **ARC policy comparison:** the approximately 1 ha per adult allocation is compared with the biological requirement after that calculation. It never caps the perennial footprint or annual bridge.

The headline planning quantity for a new community is therefore:

`establishment_land_requirement_ha = max(total_exclusive_land_requirement_ha across establishment years)`

`mature_land_requirement_ha` is retained as the long-run comparison after the perennial system reaches its modelled mature production.

## Owen Sound / Grey County environment contract

The canonical source contract is `packages/carrying-capacity/data/source/owen-sound-growing-environment.json`.

It records:

- Owen Sound MOE climate-normal proxy, station 6116132, 1981–2010;
- 2,073.5 growing degree days above 5 °C;
- 162 average frost-free days, with average last spring frost May 5 and first fall frost October 14;
- 1,114.4 mm annual precipitation and 510.7 mm summed May–October precipitation;
- 4,031.9 heating degree days below 18 °C, retained from the existing ECCC-backed heating model;
- the Canada Land Inventory / Ontario soil-capability framework, including CLI classes, drainage, stoniness and surface-texture concepts;
- explicit scenario bands for favourable/deep/well-drained, ordinary/mesic, dry, shallow/rocky marginal and wet land;
- source dates, geography, transformations, evidence status and uncertainty.

Solar radiation remains explicitly unresolved. The model does not invent an Owen Sound insolation value or photosynthetic efficiency.

Sources: [ECCC Owen Sound climate normals](https://climate.weather.gc.ca/climate_normals/results_1981_2010_e.html?climate_id=6116132), [ECCC climate-normal methods](https://www.canada.ca/en/environment-climate-change/services/climate-change/canadian-centre-climate-services/display-download/technical-documentation-climate-normals.html), [Ontario soil capability for agriculture](https://www.ontario.ca/page/soil-capability-agriculture-ontario), and [Ontario soil data](https://www.ontario.ca/page/soil-data).

## Site capability

Site capability is no longer only a generic multiplier. The selected band provides:

- annual crop viability and yield multipliers;
- perennial layer viability and yield multipliers;
- woody heating productivity adjustment;
- drainage, moisture, soil-depth, rockiness and CLI-range caveats.

For example, the dry and shallow/rocky bands exclude the current wheat and sunflower annual rows, and shallow/rocky land excludes the current chestnut and apple perennial layers. The remaining rows are renormalized into a viable site mix. This is still a regional scenario band, not parcel-level Grey County soil mapping.

## Establishment accounting

For each year 1, 2, 3, 5, 8, 10, 15 and mature:

1. Size the planted perennial footprint from mature viable perennial output and household food demand.
2. Calculate actual perennial output from the existing bearing curves.
3. Calculate annual bridge area for the residual food requirement.
4. Subtract only the permitted annual/perennial young-row overlap.
5. Add woody heating area and the genuinely exclusive diversity/rotation reserve.

The result is never constrained by `arc_policy_allocation_ha`. The API exposes the ARC surplus/deficit separately. Multifunctional soil, water, wildlife, fibre and habitat functions remain overlays and are not added as extra hectares.

The browser contract exposes this under `environment` and `establishment`; CLI and regional reports consume the same transition rows.
