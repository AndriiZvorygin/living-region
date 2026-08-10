# Protein calculation audit

## Reconciled discrepancy

The historical transition field reported approximately **41.676 g/day** for the ordinary one-adult full-perennial calorie case. Its denominator is the Health Canada-derived screening target of **52 g/day**, so the corresponding coverage is **80.15%**, not 42%.

The later **42.04%** headline was not the same case. It came from the mature 75/25 plants-only scenario, and a field-name bug in the livestock macro calculation silently omitted the perennial protein contribution because the stored fields are named protein_kg_ha, fat_kg_ha and carbohydrate_kg_ha. After correction, the 75/25 case is approximately 53 g/day and approximately 102% of the 52 g/day screening target for the ordinary representative adult.

The unit chain is:

protein kg/year × 1,000 g/kg ÷ 365.25 days/year = protein g/day

protein g/day ÷ target g/day × 100 = percentage coverage

| case | protein kg/year | protein g/day | target g/day | coverage |
|---|---:|---:|---:|---:|
| 1 adult full perennial calories | 15.22 | 41.7 | 52.0 | 80.1% |
| 2 adults + 2 children full perennial calories | 35.04 | 95.9 | 116.0 | 82.7% |
| 1 adult mature 75/25 comparison | 19.40 | 53.1 | 52.0 | 102.2% |
| 2 adults + 2 children mature 75/25 comparison | 44.66 | 122.3 | 116.0 | 105.4% |

The corrected percentage is always dimensionless. It must not be displayed as grams per day.
