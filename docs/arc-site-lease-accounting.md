# ARC household-first site-lease accounting

The ARC economics model keeps four flows separate:

1. **Carrying capacity** calculates the household's establishment peak and mature productive land from people, heated buildings, site capability and the canonical annual-to-perennial transition.
2. **Site lease** recovers the entire project property through two layers:
   - the **common-property land holding share**, divided equally across households, covers the actual common-property/access/ecological land pool's acquisition/debt and tax once a site-plan takeoff exists. The legal-minimum lower bound currently has no pooled common hectares, so paid administration, vacancy, optional insurance and common-land operating cash are zero and resident labour is shown separately;
   - the **productive land charge**, expressed as CAD/ha/month, covers productive/exclusive land acquisition/debt and the explicit productive-land tax proxy. A household pays its reserved establishment hectares multiplied by this rate.
3. **Shared infrastructure fee** recovers the selected `legal_minimum`, `minimal_compliant`, `shared_services` or `amenity_rich` infrastructure scenario. The public default is `legal_minimum`; it is not part of site lease and does not fund land-holding administration a second time.
4. **The public ARC charge excludes the dwelling.** A resident acquires a private dwelling separately. Dwelling capital, financing, maintenance, replacement, utilities, heating fuel, personal insurance and other household expenses do not enter the public land-and-infrastructure comparison.

The central canonical function is `calculateLandLeaseAccounting()` in `packages/carrying-capacity/src/site-lease-browser.mjs`. It is imported by both the Node site-lease API and the education browser bundle. The browser does not reproduce the monetary formulas.

## Whole-property recovery

The land-holding entity owns one property. Productive household allocations, roads/access land, common spaces, ecological buffers and shared-building land are all included in the property area once the site plan is known. The legal-minimum default currently uses a **0 ha lower bound** for non-productive common land because the repository does not yet contain a parcel-clipped site-plan takeoff. The former 1.50 ha pool remains an explicit sensitivity, not a measured requirement. Common-property value is assigned to the equal common-property land holding pool when actual common hectares are supplied. The resulting site-lease revenue is checked against the annual land-layer cost before shared infrastructure revenue is included.

The legal-minimum public decomposition is intentionally simpler:

| Site-lease layer | Allocation basis | Monthly household charge |
|---|---|---:|
| Common-property land holding share | equal share of actual common-property land and fixed land-holding costs | generated per selected parcel/scenario |
| Productive land | reserved establishment hectares × area-dependent land rate | generated per household |
| **Total site lease** | common-property share + productive land portion | generated per household |

The legal-minimum scenario includes only financed land debt service where land is financed and the explicit property-tax proxy. It excludes paid administration, vacancy reserve, optional insurance and common-land operating cash. The initial down payment is acquisition equity; it is exposed separately and is not charged again as recurring lease recovery or an equity return. Exact current examples are generated in `packages/carrying-capacity/outputs/arc-legal-minimum.md`, rather than copied into this document as stale constants.

The former $18,000/year administration input was exactly $125/household/month at 12 households, but had no documented mandatory service-capacity basis. It remains available as a conventional comparison. The legal-minimum case assumes open-source records, automated documents and resident governance: zero recurring paid administration, 60 resident hours/year, and irregular external fees shown as site-specific rather than invented monthly cash. Common-property operations follow the same rule. Road passability, snow/obstruction control and sanitary waste handling are represented in the infrastructure layer; drainage and minimum grounds are represented in common-property operations, avoiding duplicate labour.

The API accepts explicit residential footprint, internal road/access, common-building, ecological/water-buffer, shared productive and other common-land areas. It uses those areas only when a complete site-plan takeoff is supplied; current hamlet fixtures are not yet a validated parcel-clipped area source. See `arc-legal-minimum.md` and `arc-common-property-audit.md` for expense classification, administration scale, operation decomposition, evidence statuses and the spatial accounting pathway.

The default reservation basis is `maximum_transition_exclusive_footprint`: the project keeps enough land available for the peak bare-land establishment requirement even after mature perennial production reduces annual bridge acreage. Mature hectares are exposed separately for biological comparison.

## Public page and canonical charge

`/arc-affordability` is the household-first presentation and defaults to the `legal_minimum` affordability baseline. It consumes the generated `site_lease_economics` contract and the same browser-safe land accounting function used by reports. Query parameters preserve household preset/custom members, buildings, site, community size, land price, ownership and financing assumptions between `/carrying-capacity` and `/arc-affordability`.

The visible monthly stack is deliberately limited to:

```text
site lease (common-property land holding share + productive land portion)
+ shared infrastructure fee
= ARC site and infrastructure charge
```

The canonical household field is `land_infrastructure.combined_monthly_cad`, and it must equal `site_lease.monthly_total_cad + shared_infrastructure_service.monthly_cad` exactly after rounding. Legacy dwelling-finance fields remain only for compatibility with older internal calculations; they are not part of the public presentation contract, report rows or headline total.

The land-holding entity owns one whole property. Productive/exclusive land acquisition and tax are recovered through the productive land charge. Common property, access land, buffers and fixed land-holding costs are recovered through the equal common-property land holding share once actual common area is known. Shared infrastructure is a separate service layer with its own break-even check. Legal-minimum infrastructure reports cash, resident labour and future replacement liability separately.

## Legal-minimum boundary

The governing question is whether removing a charge would violate an applicable Ontario or municipal requirement, an unavoidable tax obligation, an actual financing contract or a physical operating duty. O. Reg. 517/06 requires applicable land-lease-community outcomes such as potable/fire water, passable roads, snow/obstruction control, sewage security and safe landlord-supplied electrical connections. It does not require a paid property manager, paved roads, centralized utilities, a common building, commercial snow contract or annual landscaping budget. The model therefore retains the obligation while selecting resident labour or distributed servicing as a lower-cost method where legally feasible.

The legal-minimum baseline excludes vacancy reserves, paid administration, optional insurance, paid common-property operations, maintenance cash and replacement reserves. Those remain visible in resilient, professionally managed and amenity-rich comparisons. Water, sewage, electricity, fire access, permits and resident-labour feasibility remain site-specific approval questions, not claims that the requirement disappeared.

Sources: [Ontario Residential Tenancies Act](https://www.ontario.ca/laws/statute/06r17), [O. Reg. 517/06 Maintenance Standards](https://www.ontario.ca/laws/regulation/060517), [Ontario rural tiny-home servicing guidance](https://www.ontario.ca/document/build-or-buy-tiny-home/rural-suburban-or-urban-locations), [Owen Sound Property Standards By-law](https://www.owensound.ca/media/j04h0kkz/1999-030-property-standards-by-law-consolidated.pdf), [Owen Sound site-plan applications](https://www.owensound.ca/business-building-development/planning-and-development/planning-act-applications-and-how-to-apply/).

## Land financing evidence

The current 6% interest / 30-year amortization / 20% down case is an **illustrative financing scenario**, retained for continuity rather than treated as a canonical expected ARC loan. FCC's current borrowing guidance says land loans typically use 25% down, that land loans can reach up to 29 years but most are in the 20-25-year range, and that a 5- or 10-year loan term can be separate from a longer amortization. FCC also uses 25% down and 25-year amortization in a farmland-affordability analytical convention. The federal CALA program is eligibility-dependent and states a 15-year maximum repayment term for land purchases, with longer amortization only where a balloon payment is scheduled at year 15.

The contract exposes these as separate planning comparisons: illustrative current, neutral 25-year land planning, and CALA-style 15-year land comparison. No current lender quote was found for an ARC land-holding entity with this security and operating structure, so interest rates, equity requirements, term/renewal and eligibility remain lender-underwriting questions.

Sources: [FCC borrowing basics](https://www.fcc-fac.ca/en/knowledge/borrowing-basics), [FCC land and buildings](https://www.fcc-fac.ca/en/financing/agriculture/land-buildings), [FCC farmland affordability analysis](https://www.fcc-fac.ca/en/knowledge/economics/deteriorating-farmland-affordability), [AAFC CALA before applying](https://agriculture.canada.ca/en/programs/canadian-agricultural-loans-act/step-3-before-apply).

## Evidence status

CAD 35,000/ha remains a planning midpoint from the existing repository working range, not a current parcel-matched Grey County market value. Property tax, land insurance, legal structure, common-land operations and infrastructure financing remain explicit scenario inputs requiring site-specific evidence. MPAC/Ontario tax classification and OFA insurance guidance are recorded in the contract, but no parcel assessment or insurance quote is loaded. Heated building inputs may affect the upstream biological hectares, but building cost is outside this economics page.
