# House Cost Calculator

The public House Cost Calculator is at `/house-cost`. It calculates a resident-owned, four-season ARC yurt dwelling separately from productive land, site lease, shared infrastructure and household operating costs.

## Calculation boundary

The calculator has one authoritative engine: `packages/carrying-capacity/src/house-cost.mjs`. It returns geometry, component quantities, cash costs, owner labour, construction stages, servicing boundaries, thresholds, financing and evidence status. The web page uses the same engine for interactive results, while `packages/education-web/public/generated/house-cost/cost-model.json` is the generated audit contract.

The basic accounting chain is:

```text
geometry -> component quantity x unit rate -> paid/owner labour -> tax -> contingency
         -> upfront cash and completed dwelling economic capital -> illustrative financing
```

Resident labour reduces cash expenditure in owner-builder and mixed modes, but remains visible as hours and imputed economic value. Financing is based on upfront cash required, excluding contributed owner labour, unless a custom completed-dwelling quote is supplied.

## Geometry

The default internal diameter is 9.144 m, retained at full precision because 9.1 m is a rounded public description. The engine calculates circular footprint, perimeter, exterior wall area, actual sloping roof area, gross floor area and usable floor area. Usable floor area subtracts interior partitions and, for upper-floor layouts, stair openings and restricted-headroom area.

Single-storey, partial-loft and full-two-storey layouts are explicit alternatives. Upper-floor structure, load path, stairs, guards and design allowances are separate components. A diameter or threshold is not structural approval; snow, wind, foundations, connections, fire safety and the final envelope require qualified design.

## Cost and servicing

Components use physical drivers such as footprint, perimeter, sloping roof area, envelope area, usable floor area, fixture count, household size or a fixed dwelling allowance. Threshold rules expose discrete planning effects for larger diameters, roof pitch and upper floors.

The ARC household servicing package carries forward the existing design evidence: rainwater collection and treatment, storage and pump, compact plumbing, sanitation/greywater, domestic hot water and the existing off-grid electrical package. Generic well/septic/grid and centralized servicing are alternatives. Household systems are counted once; centralized modes remove those costs from the dwelling and expose the unresolved shared quote instead.

## Evidence status

The source contract is `packages/carrying-capacity/data/source/house-cost-evidence.json`. It preserves:

- the existing ARC dwelling benchmark of CAD 51,000 to CAD 74,000, central CAD 61,000;
- Canadian yurt supplier specification context;
- Ontario tiny-home building-code and permit guidance;
- Grey County development-charge context;
- CRA HST new-housing rebate guidance.

The older CAD 61,000 benchmark was an integrated planning benchmark with its original itemized quote unrecovered. The new result does not force a match: it makes utilities, soft costs, design, permits, paid labour, tax and contingency explicit. Component rates, structural thresholds, local logistics, HST treatment, approvals and installed supplier pricing remain planning or quotation-required inputs.

## Generated outputs

Run `npm run report:house-cost` to regenerate the public JSON/Markdown contract and the evidence copy under `know/produce/house-cost`. The education build runs this report before Vite and writes a clean `house-cost/index.html` Pages artifact. The ARC affordability link carries the dwelling query parameters while keeping dwelling financing separate from land and shared infrastructure.
