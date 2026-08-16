import fs from 'node:fs';
import path from 'node:path';
import {ARC_ADULT_SCALE_SCENARIOS, ARC_FAMILY_CAPACITY_STANDARD, buildArcAdultScalePresentationContract} from '../packages/carrying-capacity/src/index.mjs';

const outputDir = path.resolve('packages/carrying-capacity/outputs');
fs.mkdirSync(outputDir, {recursive: true});
const contract = buildArcAdultScalePresentationContract();
const rows = contract.scenarios;
const money = (value) => `$${Number(value ?? 0).toFixed(2)}`;
const ha = (value) => `${Number(value ?? 0).toFixed(2)} ha`;
const csvEscape = (value) => { const text = value == null ? '' : String(value); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; };

const headers = ['adult_residents', 'households', 'dependent_children_capacity', 'productive_hectares', 'common_hectares', 'total_parcel_hectares', 'land_market_band', 'land_price_cad_per_ha', 'land_price_status', 'estimated_parcel_acquisition_cad', 'site_lease_monthly_cad_per_household', 'shared_infrastructure_monthly_cad_per_household', 'dwelling_financing_monthly_cad_per_household', 'combined_land_infrastructure_monthly_cad_per_household', 'combined_illustrative_monthly_cad_per_household'];
fs.writeFileSync(path.join(outputDir, 'arc-adult-scale.csv'), [headers.join(','), ...rows.map((row) => headers.map((key) => csvEscape(row[key])).join(','))].join('\n') + '\n');
fs.writeFileSync(path.join(outputDir, 'arc-adult-scale.json'), JSON.stringify({contract_version: contract.contract_version, generated_at: new Date().toISOString(), scale_basis: contract.scale_basis, family_capacity_standard: ARC_FAMILY_CAPACITY_STANDARD, rows, land_market: contract.land_market}, null, 2) + '\n');

const table = rows.map((row) => `| ${row.adult_residents} | ${row.households} | ${row.dependent_children_capacity} | ${ha(row.productive_hectares)} | ${ha(row.common_hectares)} | ${ha(row.total_parcel_hectares)} | ${row.land_market_band} | ${money(row.land_price_cad_per_ha)}/ha | ${row.land_price_status} | ${money(row.site_lease_monthly_cad_per_household)} | ${money(row.shared_infrastructure_monthly_cad_per_household)} | ${money(row.combined_land_infrastructure_monthly_cad_per_household)} | ${money(row.dwelling_financing_monthly_cad_per_household)} | ${money(row.combined_illustrative_monthly_cad_per_household)} |`).join('\n');
const markdown = [
  '# ARC adult-scale community scenarios',
  '',
  'This is an adult-scale planning demonstration. Adult residents are the primary settlement variable; household and dwelling count is a resulting arrangement. Except for the 1-adult case, pairs of adults are stress-tested as households designed to support up to three dependent children. This is a capacity case, not a demographic forecast.',
  '',
  `**Family-capacity standard:** ${ARC_FAMILY_CAPACITY_STANDARD.label}: ${ARC_FAMILY_CAPACITY_STANDARD.adult_residents} adults + ${ARC_FAMILY_CAPACITY_STANDARD.dependent_children} dependent children.`,
  '',
  '| Adult residents | Households / dwellings | Dependent-child capacity | Productive land | Common land | Total parcel | Land band | Land price assumption | Price status | Site lease / household | Shared infrastructure / household | Land + infrastructure / household | Dwelling finance / household | Illustrative total with dwelling |',
  '|---:|---:|---:|---:|---:|---:|---|---:|---|---:|---:|---:|---:|---:|',
  table,
  '',
  '## Interpretation',
  '',
  '- Productive hectares come from the canonical household carrying-capacity calculation, including the peak establishment reservation.',
  '- Common land is the existing geometry-derived 50 m laneway / terminal loop / 250 m² central envelope prototype. Productive edge vegetation remains in household allocations.',
  '- Shared infrastructure is the selected legal-minimum scenario and falls per household as fixed access capital is shared.',
  '- The dwelling-financing column is shown separately for planning comparison; the ARC land-and-infrastructure charge is the site lease plus shared infrastructure only.',
  '',
  '## Land-market evidence status',
  '',
  'The 2024 Ontario Farmland Value and Rental Value Survey reports a Grey County median of CAD 19,000 per tillable acre from 29 responses. That is retained as a county cropland benchmark, not as a parcel-size observation. No size-tagged Grey County bare-land transaction series is currently loaded. The size bands below are therefore an explicit planning sensitivity anchored at that benchmark, not measured market prices.',
  '',
  '| Parcel band | Size-tagged observations | Median CAD/ha | Planning fallback CAD/ha |',
  '|---|---:|---:|---:|',
  ...contract.land_market.parcel_size_bands.map((band) => `| ${band.label} | ${band.sample_count} | ${band.median_price_cad_per_ha == null ? 'unresolved' : money(band.median_price_cad_per_ha)} | ${money(contract.land_market.planning_curve[band.id])} |`),
  '',
  `The model selects the parcel band from total calculated parcel area. The current planning sensitivity indicates a possible scale effect, but a defensible economic crossover requires manually verified whole-parcel observations with improvements separated from land value. Import observations with \`npm run import:arc:land-observations -- --input=...\`.`,
  `The current economic-crossover status is **${contract.economic_crossover.status}**. Under the provisional sensitivity only, the lowest displayed land-plus-infrastructure charge is at ${contract.economic_crossover.provisional_lowest_charge_adult_scale} adults (${money(contract.economic_crossover.provisional_lowest_charge_cad_per_household)}/household/month); this is not a market conclusion.`,
  '',
  '## Sources',
  '',
  ...contract.land_market.sources.map((source) => `- [${source.institution}: ${source.title}](${source.url}) — ${source.evidence_status}; ${source.limitation}`)
].join('\n') + '\n';
fs.writeFileSync(path.join(outputDir, 'arc-adult-scale.md'), markdown);
console.log(`Wrote ${rows.length} adult-scale scenarios to ${outputDir}`);
