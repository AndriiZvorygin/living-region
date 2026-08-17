# ADR: migrate from a fixed crop basket to a data-driven agroecosystem planner

## Decision

Living Region will use a versioned plant/output database and annual planning
ledger alongside the existing carrying-capacity APIs. Selection is site- and
evidence-aware, and production is tracked by year, layer, season and
destination.

## Context

The former food portfolio was useful for stable historical reports but encoded
crop identity and area shares directly in JavaScript. That made it difficult
to explain why a crop was excluded, represent support plants, avoid layer
over-addition or connect food production to nutrient and material loops.

## Consequences

Source data becomes auditable and generated contracts become reproducible.
Unknown evidence remains visible. Existing reports receive compatibility
adapters during migration, so historical values remain traceable while the
new planner is validated against them. The planner may produce several
Pareto-style solutions instead of a single hidden optimum.
