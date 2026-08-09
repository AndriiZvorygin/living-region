# Food-forest transition through time

## Answer in brief

Yes, annual crops can independently feed the household during perennial establishment **when the annual bridge area fits the site's available food-production envelope**. The transition is not a static mature-landscape calculation: young trees and shrubs can share alleys with annuals, then annual acreage is progressively released as perennial production becomes material. The central model does not support saying that every household can replace all calories with a mature perennial mix on 1 or 2 ha; that result depends on household demand, site productivity and whether resilience/ecological land is counted.

For an ordinary site, the central progressive-handoff model reaches 25%, 50%, 75% and 100% of one adult's calories from perennials in years 5, 8, 10, mature. For two adults plus two children the corresponding thresholds are 5, 10, never, never. These are scenario years, not field predictions. The one-adult conservative and favourable threshold sequences are 8, 10, mature, never and 5, 5, 10, mature respectively.

The ageing-in-place design retains 25% of mature plant calories in annual crops for beans, vegetables, markets, seed and resilience. It reports the separate no-annual-soil-preparation food-energy metric and labour profile in outputs/ageing-in-place-labour.md. For one ordinary-site adult, the retained annual area falls from 0.15 ha in year 1 to 0.04 ha at maturity; this is a planning target, not a claim that all recurring perennial labour disappears.

## Ordinary-site progressive handoff: one adult

| year | annual usable GJ | perennial usable GJ | total usable GJ | coverage | annual area | released area | occupied food area |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | 3.38 | 0 | 3.38 | 100% | 0.15 | 0 | 0.49 |
| 2 | 3.24 | 0.13 | 3.38 | 100% | 0.14 | 0.01 | 0.49 |
| 3 | 2.87 | 0.50 | 3.38 | 100% | 0.13 | 0.02 | 0.51 |
| 5 | 2.07 | 1.31 | 3.38 | 100% | 0.09 | 0.06 | 0.51 |
| 8 | 1.26 | 2.12 | 3.38 | 100% | 0.06 | 0.09 | 0.50 |
| 10 | 0.71 | 2.67 | 3.38 | 100% | 0.03 | 0.12 | 0.49 |
| 15 | 0.14 | 3.23 | 3.38 | 100% | 0.01 | 0.14 | 0.46 |
| mature | 0 | 3.38 | 3.38 | 100% | 0 | 0.15 | 0.46 |

## Ordinary-site progressive handoff: 2 adults + 2 children

| year | annual usable GJ | perennial usable GJ | total usable GJ | coverage | annual area | released area | occupied food area |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | 14.05 | 0 | 14.05 | 100% | 0.62 | 0 | 1.50 |
| 2 | 13.66 | 0.39 | 14.05 | 100% | 0.60 | 0.02 | 1.50 |
| 3 | 12.57 | 1.48 | 14.05 | 100% | 0.55 | 0.07 | 1.57 |
| 5 | 10.21 | 3.84 | 14.05 | 100% | 0.45 | 0.17 | 1.62 |
| 8 | 7.82 | 6.23 | 14.05 | 100% | 0.35 | 0.27 | 1.64 |
| 10 | 6.20 | 7.85 | 14.05 | 100% | 0.27 | 0.35 | 1.61 |
| 15 | 4.53 | 9.52 | 14.05 | 100% | 0.20 | 0.42 | 1.55 |
| mature | 4.11 | 9.94 | 14.05 | 100% | 0.18 | 0.44 | 1.53 |

Strategy A keeps a 25% annual food-demand reserve after the perennial system supplies the remaining demand. Strategy B progressively hands annual acreage to perennials and does not impose that additional annual reserve floor. Both strategies use the same explicit 30% loss/reserve case and the same young-row overlap schedule.

The transition is sized to cover household food rather than to consume the deliberate export allowance. The `exportable_food_energy_surplus_gj` field is therefore zero in the central progressive case; Strategy A's extra output is intentionally retained as annual reserve. Exportable calories require additional land or production assigned to market/community output, which remains separate from this household handoff calculation.

The strict food-forest footprint is established from year 1 in the model, but annual crops can occupy plausible young-tree alleys. At year 1, the model applies 75% overlap; by year 15 and mature state it applies no overlap. This is a land-accounting assumption, not a claim that every crop is agronomically compatible with every tree row. The long-term target can be larger than the strict footprint; filling it requires staged planting after annual land is released.

See `outputs/annual-establishment-food.md` for the 0.25 ha test, `outputs/mature-food-forest-capacity.md` for mature area requirements and `outputs/household-transition-scenarios.md` for the site/household table.
