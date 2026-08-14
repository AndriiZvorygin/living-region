# ARC infrastructure economics audit

Generated from the canonical calculateArcSiteLeaseEconomics API. The audit preserves the former configuration as legacy_current, but the recommended affordability default is minimal_compliant. All monetary values are CAD; they are planning assumptions until a property-specific design, legal review and procurement quotes exist.

## Executive finding

The former 12-household shared-services charge was **$1162.31/household/month** because the legacy configuration carried **$1055000** of centralized capital, **$75000** of annual operations, **$21100** of maintenance and **$10550** of replacement reserve. Its annual total was **$167372**, divided by 12 households and 12 months.

The line-item total independently sums to $167372. The exact old result is retained for audit, not recommended for affordability. The new default minimal-compliant central charge is **$228.18/household/month** before household-specific utility alternatives.

## Legacy shared-services line-by-line breakdown

| Component | Capital cost | Financing term | Annual operating cost | Annual maintenance | Replacement reserve | Monthly household allocation | Required / optional | Source / status |
|---|---:|---|---:|---:|---:|---:|---|---|
| Internal road/access | $250000 | 6.0% / 30 y | $0 | $5000 | $2500 | $152.01 | physically necessary | planning assumption; site-specific legal/design review required Road/access capital was a single legacy placeholder. |
| Road maintenance | $0 | none | $10000 | $0 | $0 | $69.44 | physically necessary | planning assumption; site-specific legal/design review required Split from the legacy road/snow operating pool for audit display. |
| Snow clearing | $0 | none | $8000 | $0 | $0 | $55.56 | physically necessary | planning assumption; site-specific legal/design review required Split from the legacy road/snow operating pool for audit display. |
| Shared water supply/treatment | $180000 | 6.0% / 30 y | $5000 | $3600 | $1800 | $144.17 | unresolved/site-specific | planning assumption; site-specific legal/design review required |
| Shared sewage/greywater | $250000 | 6.0% / 30 y | $7000 | $5000 | $2500 | $200.62 | unresolved/site-specific | planning assumption; site-specific legal/design review required |
| Electrical distribution | $0 | none | $0 | $0 | $0 | $0.00 | unresolved/site-specific | planning assumption; site-specific legal/design review required Not separately costed in the legacy configuration. |
| Common laundry | $0 | none | $0 | $0 | $0 | $0.00 | convenience/amenity | planning assumption; site-specific legal/design review required Not separately costed in the legacy configuration. |
| Workshop/common building | $250000 | 6.0% / 30 y | $12000 | $5000 | $2500 | $235.34 | convenience/amenity | planning assumption; site-specific legal/design review required |
| Shared equipment | $75000 | 6.0% / 30 y | $0 | $1500 | $750 | $45.60 | convenience/amenity | planning assumption; site-specific legal/design review required |
| Waste handling | $50000 | 6.0% / 30 y | $0 | $1000 | $500 | $30.40 | physically necessary | planning assumption; site-specific legal/design review required Capital placeholder; no separate operating cost in legacy pool. |
| Infrastructure insurance | $0 | none | $15000 | $0 | $0 | $104.17 | physically necessary | planning assumption; site-specific legal/design review required |
| Infrastructure administration | $0 | none | $18000 | $0 | $0 | $125.00 | physically necessary | planning assumption; site-specific legal/design review required Potentially overlaps with land-holding administration; retained for baseline audit. |
| Centralized heating | $0 | none | $0 | $0 | $0 | $0.00 | unresolved/site-specific | planning assumption; site-specific legal/design review required Heating remains household/building-based in the canonical model. |

The monthly allocation includes that component’s debt service, operating cost, maintenance and active reserve mode, divided by 12 households and 12 months. Zero-capital lines still appear because they can carry operating costs or an explicit unresolved status.

## Land/site-lease layer kept separate

| Component | Capital basis | Financing term | Annual operating/recovery | Annual maintenance | Replacement reserve | Monthly household allocation | Layer | Source / status |
|---|---:|---|---:|---:|---:|---:|---|---|
| Common land acquisition/debt recovery | $52500 | 6.0% / 5 y term / 30 y amortization | $3022 | $0 | $0 | $20.98 | common-property land holding share | common property is recovered equally |
| Productive land acquisition/debt recovery | $734328 | 6.0% / 5 y term / 30 y amortization | $42266 | $0 | $0 | $293.51 | productive land charge | productive land follows calculated hectares |
| Common and productive property tax | $786828 | none | $7868 | $0 | $0 | $54.65 | common share + productive land charge | planning assumption; parcel assessment required |
| Land insurance | $0 | none | $3000 | $0 | $0 | $20.83 | common-property land holding share | site-lease layer; separate from infrastructure service |
| Common land costs | $0 | none | $6000 | $0 | $0 | $41.67 | common-property land holding share | common-property operating cost |
| Land-holding administration | $0 | none | $18000 | $0 | $0 | $125.00 | common-property land holding share | charged once in land layer |
| Vacancy allowance | $0 | none | $4008 | $0 | $4008 | $27.83 | common share + productive land charge | reserve; common and productive portions are separate and applied once |

Property tax, land insurance, land-holding administration and vacancy allowance are site-lease items. They are not part of the shared-infrastructure service charge. The underlying land remains one project asset; households do not receive individually financed land principals.

## Double-counting audit

| Check | Finding | Treatment |
|---|---|---|
| Capital debt + replacement reserve | Not a duplicate in the model. | Debt service repays financed capital; reserve is a separate future-renewal fund. Legacy baseline starts full reserve immediately; minimal/shared use the explicit early-life sensitivity by default. |
| Infrastructure maintenance + dwelling maintenance | Separate layers. | Infrastructure line maintenance is applied to shared capital. Dwelling maintenance/replacement is applied only to the resident-owned dwelling capital. |
| Shared utilities + household utilities | Potential ambiguity, not arithmetic duplication in the new scenarios. | Central water/sewer/electric appears only in infrastructure. The $1,800/year household allowance remains household-specific; distributed alternatives are reported separately and are not added to the shared charge. |
| Insurance | Separate by asset layer. | Land insurance is in the site lease. Infrastructure insurance is a shared-service line. No dwelling insurance is silently inserted into either. |
| Property tax | Single recovery layer. | Property tax appears only in the project-land/site-lease pool, not in infrastructure. |
| Road/access | Separated for audit. | Internal access capital, road maintenance and snow clearing are separate lines. The old combined operating pool is split 10,000/8,000 for traceability. |
| Water/sewage | Separated for audit. | Central water and sewage capital/operations are distinct. Distributed alternatives are comparison rows, not an additional charge. |
| Administration/vacancy | Legacy overlap identified. | The legacy baseline includes $18,000 infrastructure administration plus $18,000 land-holding administration. Recommended scenarios charge administration only in the land layer; vacancy is applied once to the site-lease pool. |

The legacy administration configuration is the material identified overlap risk. It is retained only so the former number can be reproduced. The recommended scenarios set infrastructure administration to zero because the land-holding administration allowance already covers the central project layer. This is an accounting choice that must be confirmed when an actual operating entity and staffing plan exist.

## Infrastructure scenarios

| Scenario | Capital | Annual operating | Annual reserve | Shared services / household / month | Site lease / month | Land + infrastructure / household / month |
|---|---:|---:|---:|---:|---:|---:|
| Legacy current shared-services baseline | $1055000 | $75000 | $10550 | $1162.31 | $584.47 | $1746.78 |
| Minimal compliant ARC | $140000 | $22000 | $700 | $228.18 | $584.47 | $812.65 |
| Shared-services ARC | $1005000 | $65000 | $5025 | $1027.57 | $584.47 | $1612.04 |
| Amenity-rich ARC | $1275000 | $72000 | $12750 | $1275.24 | $584.47 | $1859.71 |

- **Minimal compliant ARC** is the recommended affordability default. It centralizes only a basic access route, snow/road maintenance, waste/compost handling and project infrastructure insurance. Water, wastewater and electricity remain distributed/site-specific alternatives unless legal and engineering review supports a shared system.
- **Shared-services ARC** adds centralized water, wastewater, electrical distribution, laundry and selected equipment/common facilities where an economy of scale may exist. These are not all legally required.
- **Amenity-rich ARC** adds a larger common building, laundry and shared equipment. Those costs are convenience/amenity or optional cost-saving choices, not part of the basic headline affordability case.

### Legacy current shared-services baseline

| Households | Infrastructure capital | Annual operating | Annual reserve | Shared services / household / month | Site lease / month | Land + infrastructure / household / month |
|---:|---:|---:|---:|---:|---:|---:|
| 12 | $1055000 | $75000 | $10550 | $1162.31 | $584.47 | $1746.78 |
| 16 | $1055000 | $75000 | $10550 | $871.73 | $539.28 | $1411.01 |
| 25 | $1055000 | $75000 | $10550 | $557.91 | $490.48 | $1048.39 |
| 50 | $1055000 | $75000 | $10550 | $278.95 | $447.11 | $726.06 |

### Minimal compliant ARC

| Households | Infrastructure capital | Annual operating | Annual reserve | Shared services / household / month | Site lease / month | Land + infrastructure / household / month |
|---:|---:|---:|---:|---:|---:|---:|
| 12 | $140000 | $22000 | $700 | $228.18 | $584.47 | $812.65 |
| 16 | $140000 | $22000 | $700 | $171.14 | $539.28 | $710.42 |
| 25 | $140000 | $22000 | $700 | $109.53 | $490.48 | $600.01 |
| 50 | $140000 | $22000 | $700 | $54.76 | $447.11 | $501.87 |

### Shared-services ARC

| Households | Infrastructure capital | Annual operating | Annual reserve | Shared services / household / month | Site lease / month | Land + infrastructure / household / month |
|---:|---:|---:|---:|---:|---:|---:|
| 12 | $1005000 | $65000 | $5025 | $1027.57 | $584.47 | $1612.04 |
| 16 | $1005000 | $65000 | $5025 | $770.67 | $539.28 | $1309.95 |
| 25 | $1005000 | $65000 | $5025 | $493.23 | $490.48 | $983.71 |
| 50 | $1005000 | $65000 | $5025 | $246.62 | $447.11 | $693.73 |

### Amenity-rich ARC

| Households | Infrastructure capital | Annual operating | Annual reserve | Shared services / household / month | Site lease / month | Land + infrastructure / household / month |
|---:|---:|---:|---:|---:|---:|---:|
| 12 | $1275000 | $72000 | $12750 | $1275.24 | $584.47 | $1859.71 |
| 16 | $1275000 | $72000 | $12750 | $956.43 | $539.28 | $1495.71 |
| 25 | $1275000 | $72000 | $12750 | $612.12 | $490.48 | $1102.60 |
| 50 | $1275000 | $72000 | $12750 | $306.06 | $447.11 | $753.17 |

## Replacement reserve sensitivity

Debt service and replacement reserves are reported separately. The default mode for minimal/shared services is an early-life contribution of 0.5% of capital; full lifecycle sensitivity is 1.0%. Both begin in year 1 in this planning model. The lower early-life case is not a waiver of future liability: it delays part of the reserve contribution while the assets are new.

| Scenario | Reserve mode | Annual reserve | Shared charge / household / month |
|---|---|---:|---:|
| Minimal compliant ARC | early_life | $700 | $228.18 |
| Minimal compliant ARC | full_lifecycle | $1400 | $233.04 |
| Shared-services ARC | early_life | $5025 | $1027.57 |
| Shared-services ARC | full_lifecycle | $10050 | $1062.46 |
| Amenity-rich ARC | early_life | $6375 | $1230.97 |
| Amenity-rich ARC | full_lifecycle | $12750 | $1275.24 |
| Legacy current shared-services baseline | early_life | $5275 | $1125.68 |
| Legacy current shared-services baseline | full_lifecycle | $10550 | $1162.31 |

## Distributed versus centralized servicing

The following comparison uses the 12-household shared-services placeholders. It annualizes distributed capital with the same financing/reserve convention only to make the alternatives visible. It is not a procurement conclusion; well yield, septic feasibility, electrical connection distance, source-water rules, fire protection, maintenance labour and municipal approvals can change the result.

| Function | Centralized monthly / household | Distributed capital total | Distributed monthly / household | Placeholder result | Source / status |
|---|---:|---:|---:|---|---|
| Shared water supply/treatment | $137.92 | $168000 | $146.32 | centralized_placeholder_lower_or_equal | planning assumption; site-specific legal/design review required |
| Shared sewage/greywater | $174.74 | $192000 | $172.58 | distributed_placeholder_lower | planning assumption; site-specific legal/design review required |
| Electrical distribution | $59.75 | $144000 | $157.56 | centralized_placeholder_lower_or_equal | planning assumption; site-specific legal/design review required |
| Common laundry | $93.27 | $18000 | $22.82 | distributed_placeholder_lower | planning assumption; site-specific legal/design review required |
| Centralized heating | $0.00 | $0 | $0.00 | unresolved | unresolved; canonical model prices household/building heating separately |

- **Water:** centralized treatment may benefit from scale, but household wells/rainwater/treatment can reduce shared capital where hydrogeology and approvals permit.
- **Wastewater:** distributed septic/greywater/composting may be lower-capital, but soil, setbacks, seasonal water table and legal approval are decisive.
- **Electricity:** a central distribution system is not automatically cheaper than shorter household connections or individual generation/storage; the current comparison is placeholder-only.
- **Heating:** the canonical model remains building-based. No central heating credit is assigned without a local design, fuel system and operating evidence.
- **Laundry:** common laundry can save household capital or labour, but it is not necessary for basic housing and should remain optional until utilization and maintenance are known.

## Land reservation basis

The default project reserves the maximum exclusive land requirement during the establishment transition. It does not sell or reallocate land merely because annual cultivation shrinks at maturity. The reserved property therefore retains establishment capacity, rotation/resilience area, future household flexibility and surplus/fibre/habitat potential. Mature hectares remain exposed separately for biological comparison.

## Unresolved site-specific costs

- municipal access and fire-route standards for gravel roads;
- source-water, well yield, treatment and drinking-water approvals;
- septic, greywater or composting-toilet approvals and soil constraints;
- transformer/service distance, electrical code requirements and backup power;
- snow-clearing contract, road maintenance standard and winter emergency access;
- insurance quotes for a community land-holding entity and shared facilities;
- property assessment/tax treatment and legal lease structure;
- actual common-building, laundry and equipment utilization;
- replacement schedules, reserve investment policy and project administration staffing;
- current Grey County land price by site class and parcel condition.
