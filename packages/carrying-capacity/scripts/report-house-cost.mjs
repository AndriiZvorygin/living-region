import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {buildHouseCostPresentationContract, calculateHouseCost, HOUSE_COST_CONTRACT_VERSION} from '../src/house-cost.mjs';

const outputRoot = resolve('packages/education-web/public/generated/house-cost');
const evidenceRoot = resolve('know/produce/house-cost');
const generatedDate = new Date().toISOString().slice(0, 10);
const contract = buildHouseCostPresentationContract();
const central = contract.central;
const money = (value) => `$${Number(value ?? 0).toLocaleString('en-CA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
const signedMoney = (value) => Number(value ?? 0) < 0 ? `-${money(Math.abs(Number(value)))}` : money(value);
const hours = (value) => `${Number(value ?? 0).toLocaleString('en-CA', {maximumFractionDigits: 1})} h`;
const quantity = (value) => Number(value ?? 0).toLocaleString('en-CA', {maximumFractionDigits: 3});
const packageRows = contract.market_evidence.yurt_packages.map((row) => {
  const supplier = contract.market_evidence.suppliers.find((item) => item.id === row.supplier_id);
  const price = row.price_cad == null ? 'quote required' : money(row.price_cad);
  return `| ${supplier?.name ?? row.supplier_id} | ${row.diameter_label} | ${price} | ${row.price_basis} | ${row.evidence_status} |`;
}).join('\n');
const componentRows = central.components.map((row) => `| ${row.label} | ${quantity(row.quantity)} | ${row.unit} | ${money(row.unit_rate_cad)} | ${money(row.material_cost_cad)} | ${hours(row.labour_hours_total)} | ${money(row.cash_cost_cad)} | ${row.status} |`).join('\n');
const platformRows = central.components.filter((row) => row.id.startsWith('platform_')).map((row) => `| ${row.label} | ${quantity(row.quantity)} ${row.unit} | ${money(row.base_unit_rate_cad)} | ${money(row.material_cost_cad)} | ${hours(row.labour_hours_total)} | ${money(row.cash_cost_cad)} | ${row.source_url ? `[source](${row.source_url})` : 'allowance / quote required'} |`).join('\n');
const utilityRows = central.components.filter((row) => row.id.startsWith('water_') || row.id.startsWith('compact_') || row.id.startsWith('sink_') || row.id.startsWith('composting_') || row.id.startsWith('class_') || row.id.startsWith('qualified_water') || row.id.startsWith('pv_') || row.id.startsWith('mppt_') || row.id.startsWith('lead_') || row.id.startsWith('pure_') || row.id.startsWith('dc_') || row.id.startsWith('electrical_') || row.id.startsWith('solar_') || row.id.startsWith('hot_water_') || row.id.startsWith('thermosiphon_')).map((row) => `| ${row.label} | ${quantity(row.quantity)} ${row.unit} | ${money(row.unit_rate_cad)} | ${money(row.material_cost_cad)} | ${hours(row.labour_hours_total)} | ${money(row.cash_cost_cad)} | ${row.status} |`).join('\n');
const materialRows = contract.market_evidence.material_catalog.map((row) => `| ${row.label} | ${money(row.unit_price_cad)} / ${row.purchase_unit} | ${row.price_date} | ${row.evidence_status} | ${row.source_url ? `[source](${row.source_url})` : 'quote required'} |`).join('\n');
const sourceRows = contract.sources.map((source) => `- [${source.institution}: ${source.title}](${source.url}) - ${source.classification}. ${source.note}`).join('\n');
const modeRows = ['owner_builder', 'mixed_labour', 'contractor_built'].map((labourMode) => {
  const result = calculateHouseCost({labourMode});
  return `| ${result.labour.label} | ${money(result.totals.upfront_cash_required_cad)} | ${money(result.totals.economic_cost_cad)} | ${hours(result.labour.owner_hours)} | ${hours(result.labour.paid_hours)} | ${money(result.financing.monthly_debt_service_cad)} / month |`;
}).join('\n');
const diameterRows = contract.diameter_sensitivity.map((row) => `| ${row.label} | ${row.usable_floor_area_m2.toFixed(1)} | ${money(row.upfront_cash_required_cad)} | ${money(row.completed_dwelling_capital_cad)} | ${money(row.cost_per_usable_m2_cad)} | ${row.thresholds.join(', ') || 'none'} |`).join('\n');
const layoutRows = contract.layout_comparison.map((row) => `| ${row.label} | ${row.usable_floor_area_m2.toFixed(1)} | ${money(row.upfront_cash_required_cad)} | ${money(row.completed_dwelling_capital_cad)} | ${hours(row.owner_labour_hours)} | ${hours(row.paid_labour_hours)} |`).join('\n');
const historicalRows = central.legacy_reconciliation.historical_scope_components.map((row) => `| ${row.scope} | ${money(row.amount_cad)} | ${row.status} |`).join('\n');
const bridgeRows = central.legacy_reconciliation.bridge_rows.map((row) => `| ${row.component} | ${row.original_scope} / ${money(row.original_amount_cad)} | ${money(row.former_model_amount_cad)} | ${row.new_scope} / ${money(row.new_amount_cad)} | ${signedMoney(row.delta_from_former_model_cad)} | ${row.evidence} |`).join('\n');
const layerRows = central.pricing_layers.map((layer) => `| ${layer.label} | ${money(layer.incremental_cash_cost_cad)} | ${money(layer.cumulative_cash_cost_cad)} | ${layer.component_ids.join(', ') || 'none'} |`).join('\n');
const markdown = `# House Cost Calculator

Generated from contract ${HOUSE_COST_CONTRACT_VERSION} on ${generatedDate}. This is a first-principles planning model for a resident-owned, four-season yurt dwelling. Land purchase, site lease, shared infrastructure and household operating costs are separate.

## Sourced yurt packages

The package price is the starting input. The old ARC dwelling estimate is not used as a rate, residual or calibration target.

| Supplier | Diameter | Published / estimated price | Price basis | Evidence status |
| --- | ---: | ---: | --- | --- |
${packageRows}

Yurts Canada is the central reference because its public price is a Canadian installed all-season Base Kit. The Out Factory rows are non-binding Canadian import estimates. Biome Canada publishes a configurable package and options but requires a quote for the base total. Package inclusions and exclusions are preserved in the JSON contract.

## Central reference result

- Supplier package: **${central.supplier_package.source?.name ?? central.supplier_package.supplier_id} ${central.supplier_package.diameter_label}**, ${money(central.supplier_package.selected_price_cad)} (${central.supplier_package.selection_method})
- Geometry: ${central.geometry.inputs.diameter_m} m diameter; ${central.geometry.gross_floor_area_m2.toFixed(2)} m² gross; ${central.geometry.usable_floor_area_m2.toFixed(2)} m² usable after explicit deductions
- Direct cash before tax and contingency: **${money(central.totals.direct_cash_before_tax_cad)}**
- Taxes / HST allowance: ${money(central.totals.taxes_cad)}
- Contingency: ${money(central.totals.contingency_cad)}
- Completed dwelling cash construction budget: **${money(central.totals.upfront_cash_required_cad)}**
- Contributed owner-labour value: ${money(central.totals.owner_labour_imputed_cad)}
- Completed dwelling economic cost: **${money(central.totals.economic_cost_cad)}**
- Initial financing contribution: ${money(central.totals.initial_cash_contribution_cad)}; financed principal: ${money(central.totals.financed_principal_cad)}
- Illustrative financing: **${money(central.financing.monthly_debt_service_cad)}/month** at ${central.financing.interest_rate_annual * 100}% interest and ${central.financing.amortization_years}-year amortization

This result is independently calculated from a published supplier package, quantity-based platform takeoff, itemized household systems, additional assemblies, labour, tax and contingency.

## Layered price from package to dwelling

The public starting view is the selected supplier package. It is distinct from the completed dwelling. Select the **Basic completed ARC dwelling** stage to include all five layers, or stop earlier to see outstanding requirements before occupancy.

| Layer | Incremental cash | Running cash total | Component rows |
| --- | ---: | ---: | --- |
${layerRows}

- Selected public stage: **${central.selected_stage.label}**, ${money(central.selected_stage.cash_cost_cad)} cash and ${money(central.selected_stage.economic_cost_cad)} economic cost.
- Selected-stage financing payment: **${money(central.selected_financing.monthly_debt_service_cad)}/month**.
- Layer reconciliation: ${central.accounting.pricing_layer_sum_check ? 'passed' : 'failed'}; economic layer reconciliation: ${central.accounting.pricing_layer_economic_sum_check ? 'passed' : 'failed'}.

## Platform and foundation BOM

The platform is a preliminary circular deck-block concept, not an engineered foundation. Quantities include the stated waste factor and are driven by the reference geometry.

| Item | Quantity | Unit rate | Material / non-labour | Labour | Cash |
| --- | ---: | ---: | ---: | ---: | ---: |
${platformRows}

## Household systems and amenities

Each row below has one home in the dwelling. Included supplier items are not repriced. Qualified installation and fee rows are separated from materials.

| Item | Quantity | Unit rate | Material / non-labour | Labour | Cash | Evidence |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
${utilityRows}

## Complete component ledger

| Component | Quantity | Unit | Unit rate | Material / non-labour | Labour | Cash | Evidence |
| --- | ---: | --- | ---: | ---: | ---: | ---: | --- |
${componentRows}

The visible component rows plus taxes and contingency equal the cash construction budget. Owner-builder work reduces cash expenditure but remains visible as hours and imputed economic value.

## Procurement register

| Material / product | Published unit price | Observed | Status | Source |
| --- | ---: | --- | --- | --- |
${materialRows}

## Historical ARC comparison only

The former ARC figure remains a historical comparison, not a model input. Its exact integrated total was ${money(central.legacy_reconciliation.legacy_exact_integrated_total_cad)}, publicly rounded to ${money(central.legacy_reconciliation.legacy_public_rounded_total_cad)}.

| Historical scope | Amount | Status |
| --- | ---: | --- |
${historicalRows}

The historical structural amount was a design-brief figure whose supporting takeoff was not recovered. The present result is not forced to match it; differences arise from the sourced yurt package, platform BOM, additional openings, fit-out, logistics, design, tax, contingency and explicit labour treatment.

## Former-model numerical reconciliation

The former itemized model produced ${money(central.legacy_reconciliation.bridge.former_model_economic_capital_cad)} economic cost. The audited first-principles result is ${money(central.legacy_reconciliation.bridge.corrected_economic_capital_cad)}, a change of ${signedMoney(central.legacy_reconciliation.bridge.total_delta_cad)}. This bridge keeps package scope, tax, contingency and contributed labour visible instead of applying a discount to reach the historical ARC benchmark.

| Component | Original scope / amount | Former model cash | Audited scope / amount | Change from former | Evidence / reason |
| --- | --- | ---: | --- | ---: | --- |
${bridgeRows}

The total bridge is direct cash ${signedMoney(central.legacy_reconciliation.bridge.direct_cash_delta_cad)}, tax ${signedMoney(central.legacy_reconciliation.bridge.tax_delta_cad)}, contingency ${signedMoney(central.legacy_reconciliation.bridge.contingency_delta_cad)} and owner-labour economic value ${signedMoney(central.legacy_reconciliation.bridge.owner_labour_delta_cad)}. ${central.legacy_reconciliation.bridge.explanation}

## Labour modes

| Mode | Cash budget | Economic cost | Owner hours | Paid hours | Illustrative financing |
| --- | ---: | ---: | ---: | ---: | ---: |
${modeRows}

## Size and layout sensitivity

| Diameter | Usable m² | Cash budget | Economic cost | Economic / usable m² | Thresholds |
| --- | ---: | ---: | ---: | ---: | --- |
${diameterRows}

| Layout | Usable m² | Cash budget | Economic cost | Owner hours | Paid hours |
| --- | ---: | ---: | ---: | ---: | ---: |
${layoutRows}

Interpolated sizes are labelled in the JSON contract. Thresholds for larger spans, roof pitch and upper floors are provisional planning rules, not structural approval. Snow, wind, foundations, connections, fire safety and final assemblies require qualified design.

## Accounting boundaries and evidence gaps

- The purchased yurt package is a supplier-price input with its published inclusions and exclusions.
- The platform is a quantity prototype using published retail material prices where available; structural grade, frost, soil, uplift, anchorage and spans require engineering.
- Household water, sanitation, hot water and electrical systems are itemized once. Generic well/septic/grid and centralized services remain alternatives.
- Financing uses the cash construction budget and excludes contributed owner-labour value. Down payment and financed principal are separate from the full cash budget.
- Tax treatment, HST eligibility, municipal approvals, delivery, final supplier installation scope, battery pricing, kitchen/bath fit-out and structural design remain site-specific or quotation-required.
- The dwelling is resident-owned. This does not convey ownership or guaranteed appreciation in the underlying land.

## Sources

${sourceRows}
`;
await mkdir(outputRoot, {recursive: true});
await mkdir(dirname(resolve(evidenceRoot, 'cost-model.json')), {recursive: true});
await writeFile(resolve(outputRoot, 'cost-model.json'), JSON.stringify(contract, null, 2) + '\n');
await writeFile(resolve(outputRoot, 'cost-model.md'), markdown);
await writeFile(resolve(evidenceRoot, 'cost-model.json'), JSON.stringify(contract, null, 2) + '\n');
await writeFile(resolve(evidenceRoot, 'cost-model.md'), markdown);
console.log(`wrote House Cost first-principles model ${HOUSE_COST_CONTRACT_VERSION}`);
