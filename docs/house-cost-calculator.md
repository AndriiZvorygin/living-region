# House Cost Calculator

The public House Cost Calculator is at `/house-cost`. It calculates a resident-owned, four-season ARC yurt dwelling separately from productive land, site lease, shared infrastructure and household operating costs.

## Calculation boundary

The calculator has one authoritative engine: `packages/carrying-capacity/src/house-cost.mjs`. It returns geometry, component quantities, cash costs, owner labour, construction stages, servicing boundaries, thresholds, financing and evidence status. The web page uses the same engine for interactive results, while `packages/education-web/public/generated/house-cost/cost-model.json` is the generated audit contract.

The basic accounting chain is:

```text
geometry -> component quantity x unit rate -> package decomposition -> paid/owner labour
         -> tax -> contingency -> total cash construction budget
         -> economic cost and illustrative financing
```

Resident labour reduces cash expenditure in owner-builder and mixed modes, but remains visible as hours and imputed economic value. `construction_cash_expenditure_cad` is the direct pre-tax/pre-contingency cash cost. `upfront_cash_required_cad` is the complete cash construction budget including tax and contingency, not the household's initial contribution. Financing is based on that cash budget, excluding contributed owner labour, unless a custom completed-dwelling quote is supplied. Down payment and financed principal are exposed separately.

## Geometry

The default internal diameter is 9.144 m, retained at full precision because 9.1 m is a rounded public description. The engine calculates circular footprint, perimeter, exterior wall area, actual sloping roof area, gross floor area and usable floor area. Usable floor area subtracts interior partitions and, for upper-floor layouts, stair openings and restricted-headroom area.

Single-storey, partial-loft and full-two-storey layouts are explicit alternatives. Single-storey at the 9.144 m reference diameter activates no diameter threshold. Full-two-storey geometry receives a second wall-height envelope and an upper-floor elevation; partial-loft headroom is calculated from the pitched roof profile unless the user supplies an override. Upper-floor structure, load path, stairs, guards and design allowances are separate components. A diameter or threshold is not structural approval; snow, wind, foundations, connections, fire safety and the final envelope require qualified design.

## Cost and servicing

Components use physical drivers such as footprint, perimeter, sloping roof area, envelope area, usable floor area, fixture count, household size or a fixed dwelling allowance. Threshold rules expose discrete planning effects for larger diameters, roof pitch and upper floors.

The ARC household servicing package carries forward the existing design evidence: rainwater collection and treatment, storage and pump, compact plumbing, sanitation/greywater, domestic hot water and the existing off-grid electrical package. Its inclusive central totals are CAD 5,940 for water/plumbing/sanitation, CAD 2,000 for hot water and CAD 3,300 for electrical. The package records expose included paid labour and fees inside those totals. A labour-rate override replaces the included allowance; it does not add labour again. The general permit row is reduced by the CAD 600 permit allowance already inside the water/plumbing/sanitation package. Generic well/septic/grid and centralized servicing are alternatives. Household systems are counted once; centralized modes remove those costs from the dwelling and expose the unresolved shared quote instead.

## Evidence status

The source contract is `packages/carrying-capacity/data/source/house-cost-evidence.json`. It preserves:

- the existing ARC dwelling benchmark of CAD 51,000 to CAD 74,000, central CAD 61,000;
- Canadian yurt supplier specification context;
- Ontario tiny-home building-code and permit guidance;
- Grey County development-charge context;
- CRA HST new-housing rebate guidance.

The older CAD 61,000 benchmark was an integrated planning benchmark with its original itemized structural quote unrecovered. The historical exact sum is CAD 61,240: CAD 50,000 structure/platform/masonry-heater/chimney design brief amount, CAD 5,940 water/plumbing/sanitation, CAD 2,000 hot water and CAD 3,300 electrical, publicly rounded to CAD 61,000. The audited reference model is CAD 102,382 economic cost under the current independently itemized scope. Relative to the former CAD 108,247.21 model, the direct correction is CAD 4,875: CAD 2,745 duplicate water/sanitation labour, CAD 630 duplicate hot-water integration labour, CAD 900 duplicate electrical labour and CAD 600 duplicate permit allowance. Tax falls by CAD 555.75 and contingency by CAD 434.46; owner-labour value is unchanged. The remaining difference from the historical benchmark is a scope and pricing difference, not a hidden adjustment. Component rates, structural thresholds, kitchen/bath fit-out itemization, local logistics, HST treatment, approvals and installed supplier pricing remain planning or quotation-required inputs.

The generated contract includes an old-versus-audited package table with original scope, former model cash row, audited scope, delta and evidence. It also includes the historical scope rows and the former-model accounting basis so changes can be audited without treating the CAD 61,000 rounded figure as an itemized quote.

## Generated outputs

Run `npm run report:house-cost` to regenerate the public JSON/Markdown contract and the evidence copy under `know/produce/house-cost`. The education build runs this report before Vite and writes a clean `house-cost/index.html` Pages artifact. The ARC affordability link carries the dwelling query parameters while keeping dwelling financing separate from land and shared infrastructure.
