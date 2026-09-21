# Owen Sound Local Representation Cost Calculator

Generated from contract 1.0.2 on 2026-09-21. The default report case is the city-wide Tier 1 baseline covering all 70 Local Areas, with central time assumptions, CAD 24.60/hour living wage and direct wages only (0% employer overhead); 15%, 20%, 33% and custom overhead remain comparison sensitivities.

## Default result: city-wide Tier 1 · 70 areas

70 active Local Areas and 70 Local Representatives serve 10,500 participating households.

- Paid representative time: 1,925 h (37 h average per week)
- Volunteer time entered by scenario: 0 h
- Wages: $47,355
- Employer overhead: $0
- Materials and training: $5,250
- Program administration: $0
- Gross recurring annual cost: $52,605
- Net municipal requirement after entered funding/savings: $52,605
- Citywide household-equivalent comparison: $4.78/year ($0.40/month ÷ 11,000 citywide household equivalents)
- Cost per participating household: $5.01/year ($0.42/month across 10,500 households in active Local Areas)
- Share of existing resident levy: 0.1380%
- Startup cost, shown separately: $13,000

## Tier accounting

| Tier | Active areas | Paid representative hours | Volunteer hours | Wages | Employer overhead | Materials/training | Gross annual cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| tier0 | 0 | 0 h | 0 h | $0 | $0 | $0 | $0 |
| tier1 | 70 | 1,925 h | 0 h | $47,355 | $0 | $5,250 | $52,605 |
| tier2 | 0 | 0 h | 0 h | $0 | $0 | $0 | $0 |
| tier3 | 0 | 0 h | 0 h | $0 | $0 | $0 | $0 |
| tier4 | 0 | 0 h | 0 h | $0 | $0 | $0 | $0 |

## Participation scale

| Scenario | Active areas | Participating households | Paid hours/year | Gross recurring cost | Net municipal requirement | Citywide household equivalent/year |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| City-wide Tier 1 · 70 areas | 70 | 10,500 | 1,925 h | $52,605 | $52,605 | $5 |
| One-area demonstration | 1 | 150 | 27.5 h | $752 | $752 | $0 |
| One basic area per ward · 7 areas | 7 | 1,050 | 192.5 h | $5,261 | $5,261 | $0 |
| Ten-area resident-demand pilot | 10 | 1,500 | 275 h | $7,515 | $7,515 | $1 |
| Mixed twenty-area rollout | 20 | 3,000 | 1,196 h | $33,797 | $33,797 | $3 |

## Time-assumption sensitivity

| Time scenario | Paid hours/year | Gross recurring cost | Net municipal requirement |
| --- | ---: | ---: | ---: |
| low | 1,505 h | $39,823 | $39,823 |
| central | 1,925 h | $52,605 | $52,605 |
| high | 2,520 h | $70,742 | $70,742 |

## Worked formula

For each active Tier 1 area, central assumptions calculate 150 households × 5 minutes ÷ 60 = 12.5 door-to-door invitation hours. This is one pass to each household, including walking, a brief doorstep issue check and a flyer handoff when nobody answers. The annual gathering and twelve one-hour Ward Councillor meetings are then added. The published baseline adds no preparation, follow-up or basic administration time; those fields remain explicit editable sensitivities. Tier 2 and Tier 3 add their own coordination and stewardship tasks; Tier 4 adds user-entered custom work. Wages are paid hours × living wage; employer cost is wages × the selected overhead percentage.

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
| Canada Revenue Agency | [Elected or appointed officials payroll deductions](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/payroll-deductions-contributions/special-payments/elected-appointed-officials.html) | Official figure | CRA states that EI premiums are generally not deducted from remuneration paid to mayors and municipal councillors. The Local Representative baseline therefore uses direct wages only; final treatment depends on the legal office and payroll structure adopted. |
| City of Owen Sound | [Planning justification report household projection](https://www.owensound.ca/media/g41nl2qa/planning-justification-report.pdf) | Official figure | The City planning document projects approximately 11,000 households to 2026. Living Region uses this as an editable citywide comparison denominator, not as a claim that every current household has been enumerated. |
| Living Region | [Owen Sound household-equivalent calculation convention](https://andriizvorygin.github.io/living-region/owen-sound-transit) | Campaign planning assumption | The citywide denominator is editable and is kept separate from the participating households served by active Local Areas. |

The calculator is a transparent planning model. Local-area demand, time requirements, employment structure, City support, avoided costs and partner funding require local operating data before budget approval.
