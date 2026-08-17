# Agroecosystem planner architecture

The Living Region agroecosystem planner extends the carrying-capacity package;
it does not create a second household or land model. Existing Health Canada
energy and nutrient demand, perennial bearing curves, zero-import livestock
ledgers, heating, labour and establishment calculations remain the canonical
interfaces consumed by reports and the education site.

## Data flow

`source plant records -> validated derived database -> site suitability -> candidate systems -> annual/seasonal schedule -> layered succession -> nutrient/material ledgers -> household presentation`

Human-maintained evidence belongs under `packages/carrying-capacity/data/source/`.
Normalized records under `data/derived/` are generated and must not be edited
by hand. A record may contain null values. Null means unresolved evidence and
is surfaced as uncertainty; it is never silently interpreted as zero yield.

The planner has five boundaries:

1. **Evidence** describes plants, harvestable parts, food composition, site
   needs, establishment, management and ecological functions.
2. **Suitability** applies hard climate/site constraints and continuous
   response scores, with reasons and confidence penalties.
3. **Production** schedules annual plots and layered perennial systems through
   establishment and mature years. Shared nominal land is adjusted for light,
   root and canopy competition rather than summed without limit.
4. **Flows** allocate production to household food, seed, storage, livestock,
   trade, soil return and losses, then reconcile N/P/K stocks and transfers.
5. **Presentation** exposes selected plants, rejected candidates, annual
   results, uncertainty and evidence links through the generated contract.

The selector offers named objectives rather than hiding weights in one score:
low external input, low land, low labour, nutritional completeness and
resilience/diversity. A result is a planning solution with assumptions, not a
claim that one crop basket is universally optimal.

## Compatibility

Existing fixed-basket and succession APIs remain available through adapters
while generated agroecosystem outputs are introduced. The migration is
complete only when the planner's yearly production and flow ledger reconcile
to the existing household energy, nutrition, feed, labour and land rows.
