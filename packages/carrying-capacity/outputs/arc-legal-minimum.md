# ARC legal-minimum affordability audit

Generated from the canonical `calculateArcSiteLeaseEconomics` API. This is a lower-bound cash scenario candidate, not legal advice or a claim that every site can be approved at these values. The land + infrastructure charge prices only the leased productive site and shared infrastructure. The completed resident-owned dwelling is shown as a separate capital/illustrative financing layer; household operating utilities, heating fuel, personal insurance and operating expenses remain outside scope.

## Governing rule

An expense remains in `legal_minimum` only when it is tied to an unavoidable land-finance contract, tax obligation, physical operating requirement or legally applicable maintenance/service outcome. The model chooses the least-cost method as a scenario assumption; it does not convert every prudent practice into a cash fee.

## Legal and regulatory basis

The Ontario Residential Tenancies Act treats land-lease-community sites as rental units/residential complexes, and O. Reg. 517/06 includes Part V standards for land-lease communities. Those standards address potable/fire water, passable roads, snow/obstruction control, sewage security and landlord-supplied electrical safety. Ontario rural tiny-home guidance recognizes on-site water and sewage approaches subject to local approval and the Building Code. Owen Sound property standards add local requirements for yards, garbage storage, safe access and servicing. Site-plan, fire, Building Code, septic, source-water and tax review remain unresolved for a specific property.

Sources: [Ontario Residential Tenancies Act](https://www.ontario.ca/laws/statute/06r17), [O. Reg. 517/06 Maintenance Standards](https://www.ontario.ca/laws/regulation/060517), [Ontario rural tiny-home servicing guidance](https://www.ontario.ca/document/build-or-buy-tiny-home/rural-suburban-or-urban-locations), [Owen Sound Property Standards By-law](https://www.owensound.ca/media/j04h0kkz/1999-030-property-standards-by-law-consolidated.pdf), [Owen Sound Planning Act applications](https://www.owensound.ca/business-building-development/planning-and-development/planning-act-applications-and-how-to-apply/).

## Classification of every current charge

| Expense | Current/planning amount | Legal requirement? | Financing requirement? | Physical necessity? | Optional/prudence? | Legal-minimum treatment |
|---|---|---|---|---|---|---|
| Productive land acquisition debt service | derived; previously included | only if land is financed | yes, under selected loan | land must be held | no | retain only for financed land; zero for debt-free/trust land |
| Productive/common land property tax | 1% of modeled land value | yes, subject to assessment/classification | no | tax obligation | no | retain as explicit tax-rate planning assumption pending parcel tax roll |
| Common property area and acquisition | 0.100 ha conceptual 50 m prototype | site-plan dependent | only if acquired/financed | physical access/loop/amenity envelope only | extra portions are optional | retain geometry-derived lane/loop/amenity area; validate and replace with parcel takeoff |
| Land-holding administration | $18,000/year conventional / $125 per household/month at 12 | tasks exist; recurring paid manager not identified as mandatory | no | records/governance required | paid service is optional | $0 recurring cash; 60 resident hours/year and irregular external fees shown separately |
| Common-property operations | $6,000/year contracted baseline | outcomes required; contractor is not | no | drainage/grounds/hazard work where applicable | contractor/landscaping is optional | $0 recurring cash; 64 resident hours/year in the separated common-property layer |
| Land insurance | $3,000/year planning allowance | no general statutory minimum identified | possible lender/entity requirement | risk exists, policy not established | yes unless contract requires | $0 in legal minimum; site-specific quote/lender requirement |
| Vacancy reserve | 5% of land pools | no | only if lender contract requires | no for an occupied site | prudence/policy | $0 legal minimum |
| Fixed land reserve | scenario input | no | no | future liability is real but reserve timing is policy | yes | $0 legal-min cash; future liability disclosed |
| Basic internal access capital | $120,000 placeholder | passable access/fire access subject to approval | debt service if financed | yes if existing compliant access unavailable | capital amount is site-specific | retain explicit access capital/debt placeholder; set to $0 when existing access is compliant |
| Road maintenance and snow clearing | $10,000/year former paid baseline | passability/clearance outcome required | no | yes | paid contractor is optional | $0 recurring cash; 120 resident hours/year in infrastructure layer |
| Household water/plumbing/sanitation package | $5,940 ARC dwelling component | potable/fire water and lawful sanitation required | resident dwelling capital | yes | centralization optional | retained once in resident-owned dwelling capital; excluded from shared infrastructure |
| Household hot water | $2,000 ARC dwelling component | safe plumbing/hot-water installation where provided | resident dwelling capital | yes for the selected dwelling design | system design is optional | retained once in resident-owned dwelling capital; no separate shared fee |
| Household electrical system | $3,300 ARC dwelling component | safe electrical installation required | resident dwelling capital | yes | centralization optional | retained once in resident-owned dwelling capital; excluded from shared infrastructure |
| Waste handling | centralized scenario placeholder | sanitary storage/handling | no | yes | collection contract optional | $0 recurring cash; 24 resident hours/year in infrastructure layer |
| Infrastructure insurance | $8,000/year legacy infrastructure line | no general statutory minimum identified | possible lender/entity requirement | risk exists, policy not established | yes unless contract requires | $0 in legal minimum; site-specific quote/lender requirement |
| Infrastructure maintenance cash | percentage of capital in prior scenarios | maintenance outcome required | no | yes over asset life | paid method optional | $0 legal-min cash; resident labour and future liability separate |
| Infrastructure replacement reserve | full/early reserve in prior scenarios | future replacement may be necessary | not the same as debt service | future liability | reserve timing is policy | $0 legal-min cash; full capital replacement liability disclosed |
| Common building, laundry, workshop and shared equipment | optional scenario capital | no | only if selected | no for minimum site | yes | excluded; available in amenity/shared scenarios |

### Removed from recurring legal-minimum cash

- paid administration and the former CAD 125/household/month planning allowance;
- the former CAD 6,000/year contracted common-property operations allowance;
- vacancy reserve;
- the CAD 3,000/year land insurance planning allowance unless a lender/entity contract requires it;
- infrastructure insurance unless required by a lender/entity contract;
- paid road maintenance, commercial snow clearing, grounds contracts and waste contracts;
- centralized water, sewage and electrical distribution where distributed approved systems are feasible;
- infrastructure maintenance cash and replacement reserve; these remain future liability/sensitivity outputs;
- common buildings, laundry, workshop and shared equipment.

## Retained cash and separate non-cash obligations

For the default 12-household ordinary case, financed land debt service is $189.06/household/month in the productive land charge, and the modeled property-tax proxy is $32.85/household/month. The combined productive-land rate is $197.04/ha/month. The access-capital placeholder produces $47.96/household/month of legal-minimum shared cash; this falls to zero only if an existing compliant access arrangement is confirmed or the capital is otherwise funded. The resident-owned ARC dwelling central case is $61000.00, including the $11240.00 household utility package once.

The legal-minimum scenario reports 388 h/year of resident/community labour per year: 60 h/year administration, 64 h/year common-property drainage/grounds, and 264 h/year infrastructure access/snow/waste. These are not converted into a monthly fee.

Future replacement liability is shown separately as $120000 for the modeled access asset. Debt service repays current financing; it is not a replacement reserve. The legal-minimum monthly figure does not pretend the future asset can be replaced for free.

## Default ordinary-land household results

| Household | Reserved establishment land | Mature land | Site lease/month | Shared infrastructure/month | Land + infrastructure/month | Dwelling capital | Dwelling finance/month | Dwelling finance + land/shared | Labour | Future replacement liability |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| One adult | 1.12 ha | 1.05 ha | $221.91 | $47.96 | $269.87 | $61000.00 | $353.72 | $623.59 | 388 h/year | $120000 |
| 2 adults + 2 dependent children | 1.75 ha | 1.52 ha | $346.15 | $47.96 | $394.11 | $61000.00 | $353.72 | $747.83 | 388 h/year | $120000 |

These are legal-minimum land/infrastructure cash figures under the current illustrative land-financing case and the conceptual 0.100 ha common-area prototype (300 m² laneway corridor + 449 m² terminal circulation + 250 m² central common envelope). The ARC dwelling package places household water, sanitation/greywater, hot water and electrical systems in resident dwelling capital once. A real site may require a different approved system or a centralized project service; that alternative must replace, not stack on top of, the corresponding package component.

## Owen Sound affordability comparison

The repository does not currently contain a Grey County/Owen Sound household income, rent distribution or approved affordability-band contract. The only loaded affordability-adjacent input is the Ontario general minimum wage of CAD 17.60/hour for 2025-10-01 to 2026-09-30. At 40 hours/week and 52 weeks/year, that is a gross proxy of $3050.67/month. The one-adult legal-minimum land-plus-infrastructure charge is $269.87 (8.8% of that gross proxy); the family case is $394.11 (12.9%). This comparison is a provincial wage proxy, not a local affordability band, and excludes the private dwelling and all household expenses.

A defensible local affordability comparison still requires Owen Sound/Grey household income distribution, household composition, rent/shelter-cost bands, tax treatment and the actual dwelling arrangement. The legal-minimum result should not be called affordable or unaffordable until those inputs are loaded.

## Ownership sensitivity

| Land ownership | Adult site lease | Adult infrastructure | Adult combined | Family site lease | Family infrastructure | Family combined |
|---|---:|---:|---:|---:|---:|---:|
| financed | $221.91 | $47.96 | $269.87 | $346.15 | $47.96 | $394.11 |
| owned_out_right | $32.85 | $47.96 | $80.81 | $51.24 | $47.96 | $99.20 |
| land_trust | $32.85 | $47.96 | $80.81 | $51.24 | $47.96 | $99.20 |

Owned-outright and land-trust cases remove land acquisition debt service but retain the modeled property-tax obligation. The model does not charge a return on donated land equity.

## Community scale

| Household type | Households | Productive area | Site lease/household | Infrastructure/household | Combined/household | Resident labour | Future replacement |
|---|---:|---:|---:|---:|---:|---:|---:|
| one_adult | 12 | 13.41 ha | $221.91 | $47.96 | $269.87 | 388 h/year | $120000 |
| one_adult | 16 | 17.89 ha | $221.50 | $35.97 | $257.47 | 388 h/year | $120000 |
| one_adult | 25 | 27.95 ha | $221.05 | $23.02 | $244.07 | 388 h/year | $120000 |
| one_adult | 50 | 55.89 ha | $220.66 | $11.51 | $232.17 | 388 h/year | $120000 |
| family | 12 | 20.98 ha | $346.15 | $47.96 | $394.11 | 388 h/year | $120000 |
| family | 16 | 27.97 ha | $345.74 | $35.97 | $381.71 | 388 h/year | $120000 |
| family | 25 | 43.71 ha | $345.29 | $23.02 | $368.31 | 388 h/year | $120000 |
| family | 50 | 87.42 ha | $344.90 | $11.51 | $356.41 | 388 h/year | $120000 |

The access capital is fixed in this scenario, so its cash allocation declines with household count. Productive hectares and productive land charges remain household-dependent. The common-area prototype also varies with entrance-laneway length; productive edge vegetation remains in adjoining household leases rather than being added to common property.

## Optional scenarios

| Scenario | Purpose | Legal-minimum status |
|---|---|---|
| legal_minimum | Lowest recurring cash candidate using resident/self-managed methods | canonical affordability baseline |
| resilient_self_funded | Adds deliberate reserves, self-managed software support and optional insurance/operations | optional comparison |
| professionally_managed | Adds paid administration and contracted/shared services | optional comparison |
| amenity_rich | Adds optional common facilities and equipment | optional comparison |

## Unresolved/site-specific requirements

- municipal/fire access design and whether an existing compliant road makes the access capital placeholder zero;
- parcel-specific assessment, tax class and actual property tax bill;
- approved potable-water, sewage and electrical servicing method and cost;
- entity/lender insurance requirement and quote;
- site-plan-derived common hectares, setbacks, buffers and servicing area;
- legal confirmation that resident labour can satisfy each applicable maintenance duty;
- irregular formation, filing and professional-review expenses;

The next defensible refinement is a parcel-specific site-plan and servicing takeoff. It should replace the conceptual lane/loop geometry, access placeholder, tax proxy and distributed servicing placeholders with approved alignment, fire-access geometry, drainage, assessments, engineering and quotes.
