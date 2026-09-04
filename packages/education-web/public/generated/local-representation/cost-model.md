# Owen Sound Local Representation Cost Calculator

Generated from contract 1.0.0 on 2026-09-04. The default report case is the mixed twenty-area rollout with central time assumptions, CAD 24.60/hour living wage and 33% employer-overhead comparison.

## Default result: mixed twenty-area rollout

20 active Local Areas and 20 Local Representatives serve 3,000 participating households.

- Paid representative time: 1,786 h (34.3 h average per week)
- Volunteer time entered by scenario: 520 h
- Wages: $43,936
- Employer overhead: $14,499
- Materials and training: $4,375
- Program administration: $2,000
- Gross recurring annual cost: $64,809
- Net municipal requirement after entered funding/savings: $64,809
- Equivalent cost per Owen Sound household: $6
- Share of existing resident levy: 0.1700%
- Startup cost, shown separately: $13,000

## Tier accounting

| Tier | Active areas | Paid representative hours | Volunteer hours | Wages | Employer overhead | Materials/training | Gross annual cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| tier0 | 0 | 0 h | 0 h | $0 | $0 | $0 | $0 |
| tier1 | 10 | 570 h | 0 h | $14,022 | $4,627 | $750 | $19,399 |
| tier2 | 7 | 763 h | 280 h | $18,770 | $6,194 | $1,750 | $26,714 |
| tier3 | 3 | 453 h | 240 h | $11,144 | $3,677 | $1,875 | $16,696 |
| tier4 | 0 | 0 h | 0 h | $0 | $0 | $0 | $0 |

## Participation scale

| Scenario | Active areas | Participating households | Paid hours/year | Gross recurring cost | Net municipal requirement | Equivalent/household |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| One-area demonstration | 1 | 150 | 57 h | $3,940 | $3,940 | $0 |
| One basic area per ward · 7 areas | 7 | 1,050 | 399 h | $15,579 | $15,579 | $2 |
| Ten-area resident-demand pilot | 10 | 1,500 | 570 h | $21,399 | $21,399 | $2 |
| Mixed twenty-area rollout | 20 | 3,000 | 1,786 h | $64,809 | $64,809 | $6 |
| City-wide Tier 1 · 70 areas | 70 | 10,500 | 3,990 h | $137,795 | $137,795 | $14 |

## Time-assumption sensitivity

| Time scenario | Paid hours/year | Gross recurring cost | Net municipal requirement |
| --- | ---: | ---: | ---: |
| low | 1,244 h | $45,156 | $45,156 |
| central | 1,786 h | $64,809 | $64,809 |
| high | 2,690 h | $97,961 | $97,961 |

## Worked formula

For each active Tier 1 area, central assumptions calculate 150 households × 12 minutes ÷ 60 = 30 invitation hours. The annual gathering, twelve one-hour Ward Councillor meetings and basic issue administration are then added. Tier 2 and Tier 3 add their own coordination and stewardship tasks; Tier 4 adds user-entered custom work. Wages are paid hours × living wage; employer cost is wages × the selected overhead percentage.

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
| Living Region | [Owen Sound transit household-equivalent convention](https://andriizvorygin.github.io/living-region/owen-sound-transit) | Campaign planning assumption | 10,000 is an editable comparison denominator reused from the transit cost model. It is not presented as an official household count. |

The calculator is a transparent planning model. Local-area demand, time requirements, employment structure, City support, avoided costs and partner funding require local operating data before budget approval.
