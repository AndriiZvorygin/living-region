# ARC household affordability and land lease

This household-first report starts with canonical carrying-capacity hectares and then applies transparent planning economics. It does not combine land, infrastructure and dwelling costs into one project-wide shortcut.

## Accounting structure

- **Biology determines hectares:** establishment peak land is reserved; mature productive need remains visible separately.
- **Site lease:** equal common-property land holding share plus productive hectares multiplied by the productive land charge per hectare.
- **Shared infrastructure:** selected minimal, shared-services or amenity-rich fee, kept outside the site lease.
- **Public scope:** only the site lease and selected shared infrastructure are included. The private dwelling and household expenses are outside this comparison.

## Site-lease decomposition · reference adult

- Common-property land holding share: **$0.00/month**, allocated equally across the 12-household project. The legal-minimum default currently uses a zero-hectare common-area lower bound because no parcel/site-plan takeoff is loaded; actual access, setback, buffer and common land must replace this lower bound.
- Productive land: **1.12 ha × $197.04/ha/month = $220.26/month**. It recovers the selected land-finance debt service and explicit productive-land tax proxy; vacancy reserve, paid administration and optional insurance are excluded from the legal-minimum default.
- Total site lease: **$220.26/month**. Initial land equity is **$93900.49** project capital and has **$0 recurring equity recovery** in this model.

## Household comparison · default 12-household community

| Household | Community | Reserved hectares | Common-property share | Productive land/ha/mo | Productive portion | Site lease | Shared infrastructure | Land + infrastructure/mo |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 adult · ordinary land | 12 | 1.12 ha | $0.00 | $197.04 | $220.26 | $220.26 | $47.96 | $268.22 |
| 1 adult · marginal land | 12 | 2.12 ha | $0.00 | $197.04 | $417.10 | $417.10 | $47.96 | $465.06 |
| 1 adult + 1 child · ordinary land | 12 | 1.21 ha | $0.00 | $197.04 | $238.31 | $238.31 | $47.96 | $286.27 |
| 2 adults · ordinary land | 12 | 1.65 ha | $0.00 | $197.04 | $324.67 | $324.67 | $47.96 | $372.63 |
| 2 adults + 2 children · ordinary land | 12 | 1.75 ha | $0.00 | $197.04 | $344.51 | $344.51 | $47.96 | $392.47 |
| 2 adults + 3 children · ordinary land | 12 | 1.81 ha | $0.00 | $197.04 | $357.57 | $357.57 | $47.96 | $405.53 |

The common-property land holding share is broadly unchanged as household hectares vary. In the current legal-minimum lower-bound case it is zero until spatial common land is supplied. The productive land portion rises with the calculated establishment allocation. Children contribute to pooled dependent food demand while growing up, but do not automatically create a permanent child-specific perennial allocation.

## Community-size sensitivity · 2 adults + 2 children

| Household | Community | Reserved hectares | Common-property share | Productive land/ha/mo | Productive portion | Site lease | Shared infrastructure | Land + infrastructure/mo |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 2 adults + 2 children · ordinary land | 12 | 1.75 ha | $0.00 | $197.04 | $344.51 | $344.51 | $47.96 | $392.47 |
| 2 adults + 2 children · ordinary land | 16 | 1.75 ha | $0.00 | $197.04 | $344.51 | $344.51 | $35.97 | $380.48 |
| 2 adults + 2 children · ordinary land | 25 | 1.75 ha | $0.00 | $197.04 | $344.51 | $344.51 | $23.02 | $367.53 |
| 2 adults + 2 children · ordinary land | 50 | 1.75 ha | $0.00 | $197.04 | $344.51 | $344.51 | $11.51 | $356.02 |

Community size lowers fixed/common charges and shared infrastructure per household. It does not change the selected household's carrying-capacity hectares or the productive-land rate itself.

## Whole-property recovery

The underlying property is one title. Productive/exclusive land value and property tax are recovered through the productive land portion. Once a site-plan takeoff is available, common property value, roads/access land, common buffers and other fixed land costs will be recovered through the common-property land holding share. The sum of site leases is independently checked against the land-layer break-even requirement before shared-service revenue is considered.

## Assumption status

- CAD 35,000/ha is a planning midpoint, not established current Grey County market evidence.
- Property tax, insurance, legal structure, administration and reserves require property-specific review. The legal-minimum baseline treats paid administration, vacancy reserves and optional insurance as zero recurring cash, while resident labour and future liability remain visible; see `arc-legal-minimum.md` and `arc-common-property-audit.md`.
- Infrastructure costs remain explicit scenario placeholders pending a site design, legal review and procurement quotes.
- The model preserves legal lease term, debt amortization and replacement reserve horizons as separate concepts.

Machine-readable outputs: `arc-household-affordability.json` and `arc-household-affordability.csv`.
