# Owen Sound Local Representation Cost Calculator

Generated from contract 1.0.1 on 2026-09-04. The default report case is the mixed twenty-area rollout with central time assumptions, CAD 24.60/hour living wage and 33% employer-overhead comparison.

## Default result: mixed twenty-area rollout

20 active Local Areas and 20 Local Representatives serve 3,000 participating households.

- Paid representative time: 1,436 h (27.6 h average per week)
- Volunteer time entered by scenario: 520 h
- Wages: $35,326
- Employer overhead: $11,657
- Materials and training: $4,375
- Program administration: $2,000
- Gross recurring annual cost: $53,358
- Net municipal requirement after entered funding/savings: $53,358
- Citywide household-equivalent comparison: $4.85/year ($0.40/month ÷ 11,000 citywide household equivalents)
- Cost per participating household: $17.79/year ($1.48/month across 3,000 households in active Local Areas)
- Share of existing resident levy: 0.1399%
- Startup cost, shown separately: $13,000

## Tier accounting

| Tier | Active areas | Paid representative hours | Volunteer hours | Wages | Employer overhead | Materials/training | Gross annual cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| tier0 | 0 | 0 h | 0 h | $0 | $0 | $0 | $0 |
| tier1 | 10 | 395 h | 0 h | $9,717 | $3,207 | $750 | $13,674 |
| tier2 | 7 | 640.5 h | 280 h | $15,756 | $5,200 | $1,750 | $22,706 |
| tier3 | 3 | 400.5 h | 240 h | $9,852 | $3,251 | $1,875 | $14,979 |
| tier4 | 0 | 0 h | 0 h | $0 | $0 | $0 | $0 |

## Participation scale

| Scenario | Active areas | Participating households | Paid hours/year | Gross recurring cost | Net municipal requirement | Citywide household equivalent/year |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| One-area demonstration | 1 | 150 | 39.5 h | $3,367 | $3,367 | $0 |
| One basic area per ward · 7 areas | 7 | 1,050 | 276.5 h | $11,572 | $11,572 | $1 |
| Ten-area resident-demand pilot | 10 | 1,500 | 395 h | $15,674 | $15,674 | $1 |
| Mixed twenty-area rollout | 20 | 3,000 | 1,436 h | $53,358 | $53,358 | $5 |
| City-wide Tier 1 · 70 areas | 70 | 10,500 | 2,765 h | $97,715 | $97,715 | $9 |

## Time-assumption sensitivity

| Time scenario | Paid hours/year | Gross recurring cost | Net municipal requirement |
| --- | ---: | ---: | ---: |
| low | 994 h | $36,977 | $36,977 |
| central | 1,436 h | $53,358 | $53,358 |
| high | 2,290 h | $84,874 | $84,874 |

## Worked formula

For each active Tier 1 area, central assumptions calculate 150 households × 5 minutes ÷ 60 = 12.5 door-to-door invitation hours. This is one pass to each household, including walking, a brief doorstep issue check and a flyer handoff when nobody answers. The annual gathering, twelve one-hour Ward Councillor meetings and basic issue administration are then added. Tier 2 and Tier 3 add their own coordination and stewardship tasks; Tier 4 adds user-entered custom work. Wages are paid hours × living wage; employer cost is wages × the selected overhead percentage.

Ward Councillor time is reported separately: 84 elected-representative hours/year in this case, with $0 incremental cost by default. Councillors continue to be elected at large and each has primary responsibility for one ward.

## Funding and scope

Recurring grants, City savings, transition savings, other revenue, partner contributions and entered avoided costs reduce the continuing requirement only when entered by the user. Startup costs and one-time grants/reserves remain separate. Volunteer activity and prevention are not guaranteed financial savings.

Local Representation can begin in a few interested areas. Each Local Area can choose a service level suited to its needs, and participation can expand when residents request it. Enforcement, emergency response, skilled trades, hazardous work and regular unionized municipal duties remain with qualified workers.

## Sources and evidence status

| Institution | Source | Classification | Note |
| --- | --- | --- | --- |
| HelpOS | [Neighbourhoods and Local Representation policy](https://helpos.ca/mayor/neighbourhoods) | Campaign planning assumption | Policy context for demand-led Local Areas, representatives and ward relationships; this calculator does not determine legal authority or employment classification. |
| Ontario Living Wage Network | [Updated 2025 living-wage rates](https://www.ontariolivingwage.ca/updated_2025_rates) | Official figure | The Bruce Grey Huron Perth Simcoe 2025 planning rate used here is CAD 24.60/hour. Rates are normally updated annually in November. |
| City of Owen Sound | [2026 Mayor's Budget](https://www.owensound.ca/media/lujd1fw3/2026-mayor-s-budget.pdf) | Official figure | The budget reports a 33% full-time employee overhead comparison and an existing resident levy base of CAD 38,133,221. |
| City of Owen Sound | [Planning justification report household projection](https://www.owensound.ca/media/g41nl2qa/planning-justification-report.pdf) | Official figure | The City planning document projects approximately 11,000 households to 2026. Living Region uses this as an editable citywide comparison denominator, not as a claim that every current household has been enumerated. |
| Living Region | [Owen Sound household-equivalent calculation convention](https://andriizvorygin.github.io/living-region/owen-sound-transit) | Campaign planning assumption | The citywide denominator is editable and is kept separate from the participating households served by active Local Areas. |

The calculator is a transparent planning model. Local-area demand, time requirements, employment structure, City support, avoided costs and partner funding require local operating data before budget approval.
