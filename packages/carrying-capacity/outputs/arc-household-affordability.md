# ARC household affordability and land lease

This household-first report starts with canonical carrying-capacity hectares and then applies transparent planning economics. It does not combine land, infrastructure and dwelling costs into one project-wide shortcut.

## Accounting structure

- **Biology determines hectares:** establishment peak land is reserved; mature productive need remains visible separately.
- **Site lease:** equal common-property land holding share plus productive hectares multiplied by the productive land charge per hectare.
- **Shared infrastructure:** selected minimal, shared-services or amenity-rich fee, kept outside the site lease.
- **Public scope:** only the site lease and selected shared infrastructure are included. The private dwelling and household expenses are outside this comparison.

## Site-lease decomposition · reference adult

- Common-property land holding share: **$222.74/month**, allocated equally across the 12-household project. It recovers common-property/access/ecological land debt and tax, land insurance, common-land costs, administration and the common vacancy reserve.
- Productive land: **1.14 ha × $206.89/ha/month = $234.86/month**. It recovers productive-land debt service, productive-land tax and the productive vacancy reserve.
- Total site lease: **$457.60/month**. Initial land equity is **$105856.72** project capital and has **$0 recurring equity recovery** in this model.

## Household comparison · default 12-household community

| Household | Community | Reserved hectares | Common-property share | Productive land/ha/mo | Productive portion | Site lease | Shared infrastructure | Land + infrastructure/mo |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 adult · ordinary land | 12 | 1.14 ha | $222.74 | $206.89 | $234.86 | $457.60 | $228.18 | $685.78 |
| 1 adult · marginal land | 12 | 2.15 ha | $222.74 | $206.89 | $443.82 | $666.56 | $228.18 | $894.74 |
| 1 adult + 1 child · ordinary land | 12 | 1.21 ha | $222.74 | $206.89 | $250.22 | $472.96 | $228.18 | $701.14 |
| 2 adults · ordinary land | 12 | 1.65 ha | $222.74 | $206.89 | $340.91 | $563.64 | $228.18 | $791.82 |
| 2 adults + 2 children · ordinary land | 12 | 1.75 ha | $222.74 | $206.89 | $361.73 | $584.47 | $228.18 | $812.65 |
| 2 adults + 3 children · ordinary land | 12 | 1.81 ha | $222.74 | $206.89 | $375.45 | $598.19 | $228.18 | $826.37 |

The common-property land holding share is broadly unchanged as household hectares vary. The productive land portion rises with the calculated establishment allocation. Children contribute to pooled dependent food demand while growing up, but do not automatically create a permanent child-specific perennial allocation.

## Community-size sensitivity · 2 adults + 2 children

| Household | Community | Reserved hectares | Common-property share | Productive land/ha/mo | Productive portion | Site lease | Shared infrastructure | Land + infrastructure/mo |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 2 adults + 2 children · ordinary land | 12 | 1.75 ha | $222.74 | $206.89 | $361.73 | $584.47 | $228.18 | $812.65 |
| 2 adults + 2 children · ordinary land | 16 | 1.75 ha | $177.55 | $206.89 | $361.73 | $539.28 | $171.14 | $710.42 |
| 2 adults + 2 children · ordinary land | 25 | 1.75 ha | $128.75 | $206.89 | $361.73 | $490.48 | $109.53 | $600.01 |
| 2 adults + 2 children · ordinary land | 50 | 1.75 ha | $85.38 | $206.89 | $361.73 | $447.11 | $54.76 | $501.87 |

Community size lowers fixed/common charges and shared infrastructure per household. It does not change the selected household's carrying-capacity hectares or the productive-land rate itself.

## Whole-property recovery

The underlying property is one title. Productive/exclusive land value and property tax are recovered through the productive land portion. Common property value, roads/access land, common buffers, land insurance, common-land costs, administration and fixed land reserves are recovered through the common-property land holding share. The sum of site leases is independently checked against the land-layer break-even requirement before shared-service revenue is considered.

## Assumption status

- CAD 35,000/ha is a planning midpoint, not established current Grey County market evidence.
- Property tax, insurance, legal structure, administration and reserves require property-specific review. Administration is now decomposed into fixed project, per-household and event-driven components; see `arc-common-property-audit.md`.
- Infrastructure costs remain explicit scenario placeholders pending a site design, legal review and procurement quotes.
- The model preserves legal lease term, debt amortization and replacement reserve horizons as separate concepts.

Machine-readable outputs: `arc-household-affordability.json` and `arc-household-affordability.csv`.
