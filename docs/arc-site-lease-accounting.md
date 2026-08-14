# ARC household-first site-lease accounting

The ARC economics model keeps four flows separate:

1. **Carrying capacity** calculates the household's establishment peak and mature productive land from people, heated buildings, site capability and the canonical annual-to-perennial transition.
2. **Site lease** recovers the entire project property through two layers:
   - the **base household land-holding charge**, divided equally across households, covers common-property acquisition/debt and tax, land insurance, common-land operating costs, administration, fixed land reserves and the explicitly modelled vacancy allowance;
   - the **hectare charge**, expressed as CAD/ha/month, covers productive/exclusive land acquisition/debt, productive-land tax and its allocated vacancy allowance. A household pays its reserved establishment hectares multiplied by this rate.
3. **Shared infrastructure fee** recovers the selected `minimal_compliant`, `shared_services` or `amenity_rich` infrastructure scenario. It is not part of site lease and does not fund the land-holding administration a second time.
4. **The public ARC charge excludes the dwelling.** A resident acquires a private dwelling separately. Dwelling capital, financing, maintenance, replacement, utilities, heating fuel, personal insurance and other household expenses do not enter the public land-and-infrastructure comparison.

The central canonical function is `calculateLandLeaseAccounting()` in `packages/carrying-capacity/src/site-lease-browser.mjs`. It is imported by both the Node site-lease API and the education browser bundle. The browser does not reproduce the monetary formulas.

## Whole-property recovery

The land-holding entity owns one property. Productive household allocations, roads/access land, common spaces, ecological buffers and shared-building land are all included in the property area. Productive/exclusive land value is assigned to the hectare pool. Common-property value is assigned to the equal base pool. The resulting site-lease revenue is checked against the annual land-layer cost before shared infrastructure revenue is included.

The default reservation basis is `maximum_transition_exclusive_footprint`: the project keeps enough land available for the peak bare-land establishment requirement even after mature perennial production reduces annual bridge acreage. Mature hectares are exposed separately for biological comparison.

## Public page and canonical charge

`/arc-affordability` is the household-first presentation. It consumes the generated `site_lease_economics` contract and the same browser-safe land accounting function used by reports. Query parameters preserve household preset/custom members, buildings, site, community size, land price, ownership and financing assumptions between `/carrying-capacity` and `/arc-affordability`.

The visible monthly stack is deliberately limited to:

```text
site lease (base household charge + hectare portion)
+ shared infrastructure fee
= ARC site and infrastructure charge
```

The canonical household field is `land_infrastructure.combined_monthly_cad`, and it must equal `site_lease.monthly_total_cad + shared_infrastructure_service.monthly_cad` exactly after rounding. Legacy dwelling-finance fields remain only for compatibility with older internal calculations; they are not part of the public presentation contract, report rows or headline total.

The land-holding entity owns one whole property. Productive/exclusive land acquisition and tax are recovered through the hectare charge. Common property, access land, buffers and fixed land-holding costs are recovered through the equal base household land charge. Shared infrastructure is a separate service layer with its own break-even check.

## Evidence status

CAD 35,000/ha remains a planning midpoint from the existing repository working range, not a current parcel-matched Grey County market value. Property tax, insurance, legal structure, common-land operations and infrastructure financing remain explicit scenario inputs requiring site-specific evidence. Heated building inputs may affect the upstream biological hectares, but building cost is outside this economics page.
