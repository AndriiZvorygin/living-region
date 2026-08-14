# ARC household-first site-lease accounting

The ARC economics model keeps four flows separate:

1. **Carrying capacity** calculates the household's establishment peak and mature productive land from people, heated buildings, site capability and the canonical annual-to-perennial transition.
2. **Site lease** recovers the entire project property through two layers:
   - the **common-property land holding share**, divided equally across households, covers the aggregate common-property/access/ecological land pool's acquisition/debt and tax, land insurance, common-land operating costs, administration, fixed land reserves and the explicitly modelled common-property vacancy allowance;
   - the **productive land charge**, expressed as CAD/ha/month, covers productive/exclusive land acquisition/debt, productive-land tax and its allocated vacancy allowance. A household pays its reserved establishment hectares multiplied by this rate.
3. **Shared infrastructure fee** recovers the selected `minimal_compliant`, `shared_services` or `amenity_rich` infrastructure scenario. It is not part of site lease and does not fund the land-holding administration a second time.
4. **The public ARC charge excludes the dwelling.** A resident acquires a private dwelling separately. Dwelling capital, financing, maintenance, replacement, utilities, heating fuel, personal insurance and other household expenses do not enter the public land-and-infrastructure comparison.

The central canonical function is `calculateLandLeaseAccounting()` in `packages/carrying-capacity/src/site-lease-browser.mjs`. It is imported by both the Node site-lease API and the education browser bundle. The browser does not reproduce the monetary formulas.

## Whole-property recovery

The land-holding entity owns one property. Productive household allocations, roads/access land, common spaces, ecological buffers and shared-building land are all included in the property area. Productive/exclusive land value is assigned to the productive land pool. The model currently represents all non-productive common area as one explicit scenario input (`common_area_ha`); it does not pretend to know how much is road, residential footprint, ecological buffer or other common use. Common-property value is assigned to the equal common-property land holding pool. The resulting site-lease revenue is checked against the annual land-layer cost before shared infrastructure revenue is included.

For the current reference adult in a 12-household project, the common-property land holding share is $222.74/month. At the default $35,000/ha, 6% and 30-year illustrative financing case, its monthly decomposition is:

| Underlying cost | Allocation basis | Monthly household charge |
|---|---|---:|
| Common land debt service | equal share of 1.5 ha common area | $20.98 |
| Common property tax | equal share of common land value | $3.65 |
| Land insurance | fixed land-layer cost divided equally | $20.83 |
| Common-land operating costs | fixed project cost divided equally | $41.67 |
| Land-holding administration | fixed project cost divided equally | $125.00 |
| Common-property vacancy reserve | equal share of common reserve | $10.61 |
| **Common-property land holding share** |  | **$222.74** |

The productive land rate is $206.89/ha/month: productive land debt service, productive property tax and productive vacancy reserve. The default reference case uses 1.135199 ha, producing a $234.86 productive portion and a $457.60 site lease. The initial 20% land down payment is acquisition equity; it is exposed separately and is not charged again as recurring lease recovery or an equity return.

The former $18,000/year administration input was exactly $125/household/month at 12 households, but had no documented service-capacity basis. It is now a project-scale budget with fixed project work, resident-variable billing/records and an event-driven professional allowance. The conventional scenario remains $18,000/year at 12 households; software-assisted and lean self-managed scenarios reduce cash cost while retaining human oversight and professional work. Common-land operations similarly decompose the former $6,000/year into vegetation, drainage/road-edge, paths, ecological-buffer and common-repair allowances. Snow, road maintenance, waste and infrastructure insurance remain shared-infrastructure costs.

The current 1.5 ha common-property input remains a pooled planning assumption. The API now accepts explicit residential footprint, internal road/access, common-building, ecological/water-buffer, shared productive and other common-land areas. It uses those areas only when a complete site-plan takeoff is supplied; current hamlet fixtures are not yet a validated parcel-clipped area source. See `arc-common-property-audit.md` for administration scale, operation decomposition, evidence statuses and the spatial accounting pathway.

The default reservation basis is `maximum_transition_exclusive_footprint`: the project keeps enough land available for the peak bare-land establishment requirement even after mature perennial production reduces annual bridge acreage. Mature hectares are exposed separately for biological comparison.

## Public page and canonical charge

`/arc-affordability` is the household-first presentation. It consumes the generated `site_lease_economics` contract and the same browser-safe land accounting function used by reports. Query parameters preserve household preset/custom members, buildings, site, community size, land price, ownership and financing assumptions between `/carrying-capacity` and `/arc-affordability`.

The visible monthly stack is deliberately limited to:

```text
site lease (common-property land holding share + productive land portion)
+ shared infrastructure fee
= ARC site and infrastructure charge
```

The canonical household field is `land_infrastructure.combined_monthly_cad`, and it must equal `site_lease.monthly_total_cad + shared_infrastructure_service.monthly_cad` exactly after rounding. Legacy dwelling-finance fields remain only for compatibility with older internal calculations; they are not part of the public presentation contract, report rows or headline total.

The land-holding entity owns one whole property. Productive/exclusive land acquisition and tax are recovered through the productive land charge. Common property, access land, buffers and fixed land-holding costs are recovered through the equal common-property land holding share. Shared infrastructure is a separate service layer with its own break-even check.

## Land financing evidence

The current 6% interest / 30-year amortization / 20% down case is an **illustrative financing scenario**, retained for continuity rather than treated as a canonical expected ARC loan. FCC's current borrowing guidance says land loans typically use 25% down, that land loans can reach up to 29 years but most are in the 20-25-year range, and that a 5- or 10-year loan term can be separate from a longer amortization. FCC also uses 25% down and 25-year amortization in a farmland-affordability analytical convention. The federal CALA program is eligibility-dependent and states a 15-year maximum repayment term for land purchases, with longer amortization only where a balloon payment is scheduled at year 15.

The contract exposes these as separate planning comparisons: illustrative current, neutral 25-year land planning, and CALA-style 15-year land comparison. No current lender quote was found for an ARC land-holding entity with this security and operating structure, so interest rates, equity requirements, term/renewal and eligibility remain lender-underwriting questions.

Sources: [FCC borrowing basics](https://www.fcc-fac.ca/en/knowledge/borrowing-basics), [FCC land and buildings](https://www.fcc-fac.ca/en/financing/agriculture/land-buildings), [FCC farmland affordability analysis](https://www.fcc-fac.ca/en/knowledge/economics/deteriorating-farmland-affordability), [AAFC CALA before applying](https://agriculture.canada.ca/en/programs/canadian-agricultural-loans-act/step-3-before-apply).

## Evidence status

CAD 35,000/ha remains a planning midpoint from the existing repository working range, not a current parcel-matched Grey County market value. Property tax, land insurance, legal structure, common-land operations and infrastructure financing remain explicit scenario inputs requiring site-specific evidence. MPAC/Ontario tax classification and OFA insurance guidance are recorded in the contract, but no parcel assessment or insurance quote is loaded. Heated building inputs may affect the upstream biological hectares, but building cost is outside this economics page.
