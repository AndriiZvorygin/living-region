# ARC household-first site-lease accounting

The ARC economics model keeps four flows separate:

1. **Carrying capacity** calculates the household's establishment peak and mature productive land from people, heated buildings, site capability and the canonical annual-to-perennial transition.
2. **Site lease** recovers the entire project property through two layers:
   - the **base household land-holding charge**, divided equally across households, covers common-property acquisition/debt and tax, land insurance, common-land operating costs, administration, fixed land reserves and the explicitly modelled vacancy allowance;
   - the **hectare charge**, expressed as CAD/ha/month, covers productive/exclusive land acquisition/debt, productive-land tax and its allocated vacancy allowance. A household pays its reserved establishment hectares multiplied by this rate.
3. **Shared infrastructure fee** recovers the selected `minimal_compliant`, `shared_services` or `amenity_rich` infrastructure scenario. It is not part of site lease and does not fund the land-holding administration a second time.
4. **Dwelling financing and household recurring costs** cover the resident-owned dwelling, its maintenance/replacement allowance and the explicit household utilities allowance.

The central canonical function is `calculateLandLeaseAccounting()` in `packages/carrying-capacity/src/site-lease-browser.mjs`. It is imported by both the Node site-lease API and the education browser bundle. The browser does not reproduce the monetary formulas.

## Whole-property recovery

The land-holding entity owns one property. Productive household allocations, roads/access land, common spaces, ecological buffers and shared-building land are all included in the property area. Productive/exclusive land value is assigned to the hectare pool. Common-property value is assigned to the equal base pool. The resulting site-lease revenue is checked against the annual land-layer cost before shared infrastructure revenue is included.

The default reservation basis is `maximum_transition_exclusive_footprint`: the project keeps enough land available for the peak bare-land establishment requirement even after mature perennial production reduces annual bridge acreage. Mature hectares are exposed separately for biological comparison.

## Public page

`/arc-affordability` is the household-first presentation. It consumes the generated `site_lease_economics` contract and the same browser-safe land accounting function used by reports. Query parameters preserve household preset/custom members, buildings, site, community size, land price, ownership and financing assumptions between `/carrying-capacity` and `/arc-affordability`.

The visible monthly stack is:

```text
dwelling financing
+ site lease (base household charge + hectare portion)
+ shared infrastructure fee
+ dwelling maintenance/replacement allowance
+ household utilities allowance
= total household cost
```

There is no residual or combined home-plus-land mortgage field.

## Evidence status

CAD 35,000/ha remains a planning midpoint from the existing repository working range, not a current parcel-matched Grey County market value. Property tax, insurance, legal structure, common-land operations, infrastructure, dwelling cost and financing products remain explicit scenario inputs requiring site-specific evidence.
