# Annual-crop establishment food

Annual crops are the establishment bridge. The current evidence-based balanced low-input annual system is used at its gross yield, then the model applies explicit loss/reserve cases of 20%, 30% and 40%. These are scenario deductions, not additional land double-counting.

| household | gross annual yield | area at gross yield | area after 20% | area after 30% | area after 40% |
|---|---:|---:|---:|---:|---:|
| 1 adult | 32.4 GJ/ha | 0.10 ha | 0.13 ha | 0.15 ha | 0.17 ha |
| 1 adult + 1 child | 32.4 GJ/ha | 0.18 ha | 0.23 ha | 0.26 ha | 0.30 ha |
| 2 adults | 32.4 GJ/ha | 0.24 ha | 0.30 ha | 0.34 ha | 0.40 ha |
| 2 adults + 1 child | 32.4 GJ/ha | 0.32 ha | 0.40 ha | 0.45 ha | 0.53 ha |
| 2 adults + 2 children | 32.4 GJ/ha | 0.43 ha | 0.54 ha | 0.62 ha | 0.72 ha |
| 2 adults + 3 children | 32.4 GJ/ha | 0.52 ha | 0.64 ha | 0.74 ha | 0.86 ha |

## The 0.25 ha test

At the ordinary site, 0.25 ha produces 5.66 GJ after a 30% loss/reserve case for one adult, but only 5.66 GJ is available against 5.85 GJ for one adult plus one child. Under this model, 0.25 ha is an adult-scale annual food zone, not a universal household allocation.

The full favourable/ordinary/marginal household tests are in `outputs/food-forest-transition.json`. Marginal sites can fail the 0.25 ha test even for one adult at the higher loss/reserve cases because the current model applies a 0.50 food-productivity multiplier.

Annual crops can carry establishment only if the annual food area fits within the available food-production envelope, or if young food-forest rows are used for plausible alleys/intercrops. The transition model records that overlap explicitly and subtracts it from occupied land.
