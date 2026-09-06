import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {buildHouseCostPresentationContract, calculateHouseCost, HOUSE_COST_CONTRACT_VERSION} from '../src/house-cost.mjs';

const outputRoot = resolve('packages/education-web/public/generated/house-cost');
const evidenceRoot = resolve('know/produce/house-cost');
const generatedDate = new Date().toISOString().slice(0, 10);
const contract = buildHouseCostPresentationContract();
const central = contract.central;
const cad = (value) => `$${Number(value ?? 0).toLocaleString('en-CA', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`;
const money = (value) => `$${Number(value ?? 0).toLocaleString('en-CA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
const hours = (value) => `${Number(value ?? 0).toLocaleString('en-CA', {maximumFractionDigits: 1})} h`;
const modes = ['owner_builder', 'mixed_labour', 'contractor_built'].map((labourMode) => {
  const result = calculateHouseCost({labourMode});
  return {labourMode, label: result.labour.label, cash: result.totals.upfront_cash_required_cad, capital: result.totals.completed_dwelling_capital_cad, ownerHours: result.labour.owner_hours, paidHours: result.labour.paid_hours, financing: result.financing.monthly_debt_service_cad};
});
const componentRows = central.components.map((row) => `| ${row.label} | ${row.quantity.toLocaleString('en-CA', {maximumFractionDigits: 2})} | ${row.unit} | ${money(row.unit_rate_cad)} | ${money(row.material_cost_cad)} | ${hours(row.labour_hours_total)} | ${money(row.cash_cost_cad)} | ${row.package_id ? `inclusive ${row.package_id}` : row.status} |`).join('\n');
const diameterRows = contract.diameter_sensitivity.map((row) => `| ${row.label} | ${row.usable_floor_area_m2.toFixed(1)} | ${money(row.completed_dwelling_capital_cad)} | ${money(row.cost_per_usable_m2_cad)} | ${row.thresholds.join(', ') || 'none'} |`).join('\n');
const layoutRows = contract.layout_comparison.map((row) => `| ${row.label} | ${row.usable_floor_area_m2.toFixed(1)} | ${money(row.completed_dwelling_capital_cad)} | ${money(row.cost_per_usable_m2_cad)} | ${hours(row.owner_labour_hours)} | ${hours(row.paid_labour_hours)} |`).join('\n');
const modeRows = modes.map((row) => `| ${row.label} | ${money(row.cash)} | ${money(row.capital)} | ${hours(row.ownerHours)} | ${hours(row.paidHours)} | ${money(row.financing)}/month |`).join('\n');
const bridgeRows = central.legacy_reconciliation.bridge_rows.map((row) => `| ${row.component} | ${row.original_scope} (${money(row.original_amount_cad)}) | ${money(row.former_model_amount_cad)} | ${row.new_scope} (${money(row.new_amount_cad)}) | ${money(row.delta_from_former_model_cad)} | ${row.evidence} |`).join('\n');
const historicalRows = central.legacy_reconciliation.historical_scope_components.map((row) => `| ${row.scope} | ${money(row.amount_cad)} | ${row.status} |`).join('\n');
const bridge = central.legacy_reconciliation.bridge;
const packageRow = (id) => central.components.find((row) => row.id === id);
const markdown = `# ARC House Cost Calculator

Generated from contract ${HOUSE_COST_CONTRACT_VERSION} on ${generatedDate}. This is a planning model for a completed four-season yurt dwelling; land lease, shared infrastructure operating charges and household operating costs are separate.

## Central reference

- Geometry: ${central.geometry.inputs.diameter_m} m diameter (${central.geometry.gross_floor_area_m2.toFixed(2)} m² gross; ${central.geometry.usable_floor_area_m2.toFixed(2)} m² usable after explicit deductions)
- Servicing: ${central.servicing.label}
- Construction cash expenditure before tax/contingency: ${money(central.totals.construction_cash_expenditure_cad)}
- Tax/HST allowance: ${money(central.totals.taxes_cad)}
- Contingency: ${money(central.totals.contingency_cad)}
- Total cash construction budget (the former “upfront cash required”): ${money(central.totals.upfront_cash_required_cad)}
- Initial financing contribution: ${money(central.totals.initial_cash_contribution_cad)}
- Financed principal: ${money(central.totals.financed_principal_cad)}
- Owner labour economic value: ${money(central.totals.owner_labour_imputed_cad)}
- Completed dwelling economic cost: ${money(central.totals.economic_cost_cad)}
- Illustrative financing: ${money(central.financing.monthly_debt_service_cad)}/month at ${central.financing.interest_rate_annual * 100}% interest, ${central.financing.amortization_years} year amortization, ${money(central.financing.down_payment_cad)} down

The historical ARC reference is ${money(central.legacy_reconciliation.legacy_exact_integrated_total_cad)} before public rounding to ${money(central.legacy_reconciliation.legacy_public_rounded_total_cad)}. The audited model is ${money(central.totals.economic_cost_cad)} on its independently itemized scope. The former model result of ${money(bridge.former_model_economic_capital_cad)} is reconciled below; no hidden discount is used.

## Historical ARC scope

| Original scope | Original amount | Evidence status |
| --- | ---: | --- |
${historicalRows}

The original structural itemization was not recovered. Its CAD 50,000 amount is retained as a historical design-brief figure. The utility packages are inclusive: their paid labour and fees are inside the stated package totals.

## Old-versus-audited package reconciliation

| Component | Original scope / amount | Former model cash row | Audited scope / amount | Delta from former | Evidence / reason |
| --- | --- | ---: | --- | ---: | --- |
${bridgeRows}

Bridge totals: direct cash ${money(bridge.direct_cash_delta_cad)}, tax ${money(bridge.tax_delta_cad)}, contingency ${money(bridge.contingency_delta_cad)}, owner-labour value ${money(bridge.owner_labour_delta_cad)}, total economic cost ${money(bridge.total_delta_cad)}. ${bridge.explanation}

## Component audit

| Component | Quantity | Unit | Unit rate | Materials / non-labour | Labour | Cash cost | Evidence status |
| --- | ---: | --- | ---: | ---: | ---: | ---: | --- |
${componentRows}

Package rows expose their inclusive total, included paid labour, included fee and non-labour portion in the generated JSON. A labour-rate override replaces the package’s included labour allowance; it is not added on top. The residual general permit row is ${money(central.components.find((row) => row.id === 'permits')?.cash_cost_cad)} after the included ${money(central.components.find((row) => row.id === 'permits')?.package_fee_offset_cad)} allowance.

## Labour modes

| Mode | Total cash budget | Economic cost | Owner hours | Paid hours | Illustrative finance |
| --- | ---: | ---: | ---: | ---: | ---: |
${modeRows}

Owner-builder cash is lower because owner labour is contributed, not because that work disappears. Professional/design and approval work remains paid. Economic cost adds the imputed value of contributed owner labour to the total cash budget.

## Diameter sensitivity

| Diameter | Usable m² | Economic cost | Cost / usable m² | Applied thresholds |
| --- | ---: | ---: | ---: | --- |
${diameterRows}

## Layout comparison

| Layout | Usable m² | Economic cost | Cost / usable m² | Owner hours | Paid hours |
| --- | ---: | ---: | ---: | ---: | ---: |
${layoutRows}

## Accounting and evidence

- Shell is the platform/foundation, frame, roof, insulation, weatherproofing, windows, doors and any upper-floor structure.
- The platform/foundation row covers the structural base and floor structure; interior finishes cover finish flooring and surfaces. Frame and roof scopes are separated, and wall weatherproofing excludes the roof covering.
- Insulated/heated structure adds interior finish, heating, ventilation, stairs and guards.
- Completed dwelling adds additional kitchen/bathroom fit-out, distributed household systems, logistics, equipment, design, residual permits, tax and contingency.
- The ARC household package is carried once: water/plumbing/sanitation ${money(packageRow('water_plumbing_sanitation')?.package_total_cad)}, hot water ${money(packageRow('hot_water')?.package_total_cad)}, electrical ${money(packageRow('household_electrical')?.package_total_cad)}. Generic well/septic/grid options remain alternatives.
- Financing is calculated on the total cash construction budget, excluding contributed owner-labour value. Down payment/equity and financed principal are separate from that budget.
- Centralized servicing removes household utility capital and reports unresolved shared-infrastructure quotation requirements; it is not silently added to this dwelling.
- A custom quote overrides the financing headline while any unallocated difference remains visible.

The strongest evidence supports geometry/specification boundaries and Ontario permit/servicing obligations. Component rates, structural thresholds, labour rates, HST treatment, kitchen/bath fit-out itemization and site logistics remain planning estimates or quotation-required inputs.

## Sources

${contract.sources.map((source) => `- [${source.institution}: ${source.title}](${source.url}) - ${source.classification}. ${source.note}`).join('\n')}
`;
await mkdir(outputRoot, {recursive: true});
await mkdir(dirname(resolve(evidenceRoot, 'cost-model.json')), {recursive: true});
await writeFile(resolve(outputRoot, 'cost-model.json'), JSON.stringify(contract, null, 2) + '\n');
await writeFile(resolve(outputRoot, 'cost-model.md'), markdown);
await writeFile(resolve(evidenceRoot, 'cost-model.json'), JSON.stringify(contract, null, 2) + '\n');
await writeFile(resolve(evidenceRoot, 'cost-model.md'), markdown);
console.log(`wrote ARC house cost model ${HOUSE_COST_CONTRACT_VERSION}`);
