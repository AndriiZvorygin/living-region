# ARC dwelling and distributed-utility cost audit

## Result

The canonical resident-owned dwelling is now a componentized package:

`structure/envelope + heating system + water/plumbing/sanitation + hot water + electrical`

The central planning case is **CAD 61,000**, with a retained inclusive planning range of **CAD 51,000–74,000**. The legal-minimum land and shared-access charge remains a separate result: **CAD 268.22/month** for the one-adult ordinary case under the current illustrative land-financing and access assumptions.

The dwelling is not included in the land principal, site lease, or shared-infrastructure service charge.

## Evidence recovery

The repository and git-history audit searched Living Region, the migrated standalone `arc-carrying-capacity-model`, and the local evidence/document directories for the earlier ARC dwelling package, including the approximately CAD 5,940 water/plumbing/sanitation, CAD 2,000 hot-water, CAD 3,300 electrical, CAD 11,230 utility-total and CAD 51,000–74,000 range references. The original quote, spreadsheet or bill of materials was not present in the current checkouts.

The recovered design specification is therefore stored as `legacy_planning_evidence_not_recovered_in_current_checkout`, not as a current procurement quote. Its physical design basis is preserved: rainwater collection and first flush, indoor food-grade storage, pump and treatment, compact PEX plumbing, sink/shower, drainless composting toilet, Class 2 greywater concept, winter masonry-heater thermosiphon hot water, summer solar thermal, and the small PV/battery/inverter system.

The listed component values sum to **CAD 11,240** (`5,940 + 2,000 + 3,300`). The previously stated approximately CAD 11,230 total is treated as a CAD 10 source-rounding discrepancy and is not hidden in another component.

The structure/envelope residual is derived so the componentized central/low/high totals reconcile exactly to CAD 61,000 / CAD 51,000 / CAD 74,000. It is not an independent recovered quote. Heating is a separate transparent planning allocation; the canonical thermal model supplies heat demand but not a current appliance installation quote.

## Accounting boundary

With `arc_household_systems`, the required household systems have one home:

| Required system | Canonical component | Layer | Treatment |
|---|---|---|---|
| Potable water collection, storage and treatment | Water, plumbing and sanitation | Resident dwelling | Included once at CAD 5,940 |
| Plumbing and private bathing | Water, plumbing and sanitation | Resident dwelling | Included once in the same package |
| Sanitation and greywater | Water, plumbing and sanitation | Resident dwelling | Included once; approval remains site-specific |
| Hot water | Hot water | Resident dwelling | Included once at CAD 2,000 |
| Household electrical supply | Off-grid electrical | Resident dwelling | Included once at CAD 3,300 |
| Space heating appliance/system | Heating appliance and system | Resident dwelling | Included as a separate planning allocation; thermal demand remains canonical |
| Internal access | Basic gravel access/internal road | Shared infrastructure | Separate project capital/debt charge if a new compliant access is required |

The legal-minimum infrastructure rows for water, sewage and electrical are now marked `resident_dwelling_cost_model` with zero shared distributed placeholders. Generic well/septic/grid figures remain only in the `generic_distributed_alternatives` dwelling mode and in optional infrastructure comparisons.

Centralized services are a different design: the corresponding household components are removed from resident dwelling capital and the approved centralized capital belongs in shared infrastructure. No centralized quote is invented by this audit.

## Affordability outputs

The canonical result exposes:

- completed resident-owned dwelling capital and range;
- component rows and accounting layer;
- illustrative dwelling financing payment;
- land lease plus genuinely shared infrastructure;
- dwelling-financing payment plus land/shared charge;
- household operating expenses separately excluded.

For the reference adult, the current central dwelling package is CAD 61,000, its illustrative financing payment is approximately CAD 353.72/month under the existing 10% down / 6% / 25-year illustrative dwelling-financing inputs, and the land + shared-access charge remains CAD 268.22/month. The illustrative combined figure is approximately CAD 621.94/month; it is not a household operating-cost estimate.

For the 2-adult + 2-dependent-child case, the dwelling package is the same selected dwelling package unless the building plan changes. Its land requirement changes through carrying capacity, while dwelling capital does not silently absorb land or utility placeholders.

## Remaining missing required systems

No required household water, sanitation/greywater, hot-water or electrical system is missing from the selected ARC package at the planning-model level. The unresolved items are approvals and current costs, not an unpriced physical category:

- potable-water source and treatment approval;
- sanitation/greywater approval and soil/site suitability;
- Building Code, plumbing and electrical inspection/ESA requirements;
- heating appliance selection and installation quote;
- whether fire-access requirements require more than the shared gravel-access placeholder;
- whether a specific site requires centralized servicing rather than the household package.

These are retained as site-specific feasibility and quote requirements. Management, reserves, insurance and optional services are not added by this audit.
