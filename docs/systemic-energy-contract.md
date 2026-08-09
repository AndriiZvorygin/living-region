# Systemic-energy contract

Living Region treats Energy Model as an upstream evidence producer. The current
Energy Model checkout is `/home/htaf/oil-model` and publishes the generated
contract at `contracts/living-region/systemic-energy-v1.json`. Living Region
checks in a copy at
`data/systemic-energy/systemic-energy-v1.json`; application code never imports
the Energy Model source tree.

Regenerate upstream with:

```sh
cd /home/htaf/oil-model
python3 scripts/export_living_region_contract.py
```

Then copy the generated JSON into Living Region and run:

```sh
npm run validate:systemic-energy
```

## Three scales

| Scale | Owns | Does not own |
|---|---|---|
| Energy Model | Global and Canadian energy-economic evidence, energy prices, crude/refinery context, freight context, food-price indicators, wages/income and source provenance | Grey land access, household biological production or regional service layouts |
| Living Region | Regional population, land, food, labour, transport, infrastructure, settlement and transition scenarios | Upstream energy source calculations |
| Carrying Capacity package | Health Canada household food-energy demand, heating, woody biomass, annual/perennial succession, mature multifunctional land, labour and household/site sensitivity | Regional parcel ownership, adoption, legal access or macroeconomic forecasts |

## Current field audit

Living Region currently has scenario fields for fuel availability, fuel/diesel
prices, fertilizer availability/prices, transport pressure, import-price
pressure, trade competition, household affordability transmission and purchasing
power. The generated contract distinguishes them:

- `globalFoodPricePressure` can be imported as a measured contextual indicator.
- Energy Model provides contextual evidence for energy-price pressure, refinery
  and crude movement, global food prices, Canadian food prices, real wages,
  income and household savings.
- No current Energy Model field has the same semantics as a diesel multiplier,
  fertilizer availability/price, regional transport-cost multiplier, trade
  competition coefficient or household pass-through share. Those remain
  Living Region scenario assumptions pending documented calibration.
- Values are accompanied by observation/source dates, retrieval metadata where
  available, evidence labels, confidence and limitations. `null` values mean
  the upstream model does not supply that parameter.

The adapter in `packages/systemic-energy-adapter/` validates the contract and
only exposes direct imports listed by the contract compatibility section.
