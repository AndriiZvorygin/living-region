import fs from 'node:fs';
import path from 'node:path';
import {ARC_ADULT_SCALE_SCENARIOS, ARC_FAMILY_CAPACITY_STANDARD, buildArcAdultScalePresentationContract} from '../packages/carrying-capacity/src/index.mjs';

const outputDir = path.resolve('packages/carrying-capacity/outputs');
fs.mkdirSync(outputDir, {recursive: true});
const contract = buildArcAdultScalePresentationContract();
const rows = contract.scenarios;
const money = (value) => value == null ? 'unresolved' : `$${Number(value).toFixed(2)}`;
const signedMoney = (value) => value == null ? 'unresolved' : `${Number(value) < 0 ? '-$' : '+$'}${Math.abs(Number(value)).toFixed(2)}`;
const ha = (value) => `${Number(value ?? 0).toFixed(2)} ha`;
const csvEscape = (value) => { const text = value == null ? '' : String(value); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; };

const headers = ['adult_residents', 'households', 'dependent_children_capacity', 'productive_hectares', 'common_hectares', 'total_parcel_hectares', 'land_market_band', 'land_price_cad_per_ha', 'land_price_status', 'land_price_sample_count', 'estimated_parcel_acquisition_cad', 'site_lease_monthly_cad_per_household', 'shared_infrastructure_monthly_cad_per_household', 'dwelling_financing_monthly_cad_per_household', 'combined_land_infrastructure_monthly_cad_per_household', 'combined_illustrative_monthly_cad_per_household'];
fs.writeFileSync(path.join(outputDir, 'arc-adult-scale.csv'), [headers.join(','), ...rows.map((row) => headers.map((key) => csvEscape(row[key])).join(','))].join('\n') + '\n');
const crossoverHeaders = ['adult_residents', 'households', 'parcel_hectares', 'previous_land_band', 'new_land_band', 'land_price_change_cad_per_ha', 'household_monthly_change_cad'];
const crossoverRows = contract.economic_crossover.market_band_crossings;
fs.writeFileSync(path.join(outputDir, 'arc-adult-scale-crossovers.csv'), [crossoverHeaders.join(','), ...crossoverRows.map((row) => crossoverHeaders.map((key) => csvEscape(row[key])).join(','))].join('\n') + '\n');
fs.writeFileSync(path.join(outputDir, 'arc-adult-scale.json'), JSON.stringify({contract_version: contract.contract_version, generated_at: new Date().toISOString(), scale_basis: contract.scale_basis, family_capacity_standard: ARC_FAMILY_CAPACITY_STANDARD, rows, economic_crossover: contract.economic_crossover, land_market: contract.land_market}, null, 2) + '\n');

const table = rows.map((row) => `| ${row.adult_residents} | ${row.households} | ${row.dependent_children_capacity} | ${ha(row.productive_hectares)} | ${ha(row.common_hectares)} | ${ha(row.total_parcel_hectares)} | ${row.land_market_band} | ${money(row.land_price_cad_per_ha)}/ha | ${row.land_price_sample_count} | ${row.land_price_status} | ${money(row.site_lease_monthly_cad_per_household)} | ${money(row.shared_infrastructure_monthly_cad_per_household)} | ${money(row.combined_land_infrastructure_monthly_cad_per_household)} | ${money(row.dwelling_financing_monthly_cad_per_household)} | ${money(row.combined_illustrative_monthly_cad_per_household)} |`).join('\n');
const markdown = [
  '# ARC adult-scale community scenarios',
  '',
  'This is an adult-scale planning demonstration. Adult residents are the primary settlement variable; household and dwelling count is a resulting arrangement. Except for the 1-adult case, pairs of adults are stress-tested as households designed to support up to three dependent children. This is a capacity case, not a demographic forecast.',
  '',
  `**Family-capacity standard:** ${ARC_FAMILY_CAPACITY_STANDARD.label}: ${ARC_FAMILY_CAPACITY_STANDARD.adult_residents} adults + ${ARC_FAMILY_CAPACITY_STANDARD.dependent_children} dependent children.`,
  '',
  '| Adult residents | Households / dwellings | Dependent-child capacity | Productive land | Common land | Total parcel | Land band | Observed / unresolved $/ha | n | Price status | Site lease / household | Shared infrastructure / household | Land + infrastructure / household | Dwelling finance / household | Illustrative total with dwelling |',
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
  '## Economic crossover diagnostic',
  '',
  `The public table above remains limited to the eight demonstration sizes. The diagnostic separately evaluates ${contract.economic_crossover.scan_adult_counts.length} scales: 1 adult plus every even count from 2 through 56 adults.`,
  `**Market-band crossover:** ${contract.economic_crossover.market_band_crossover.explanation}`,
  `The first evidence-backed size-band change overall is ${contract.economic_crossover.first_evidence_backed_band_crossover ? `${contract.economic_crossover.first_evidence_backed_band_crossover.adult_residents} adults (${contract.economic_crossover.first_evidence_backed_band_crossover.previous_land_band} → ${contract.economic_crossover.first_evidence_backed_band_crossover.new_land_band})` : 'unresolved'}. The farm-scale 20–40 ha transition is the relevant comparison for the ARC scale question.`,
  contract.economic_crossover.economic_sweet_spot
    ? `**Economic sweet spot:** ${contract.economic_crossover.economic_sweet_spot.explanation}`
    : '**Economic sweet spot:** unresolved with the available priced increments.',
  `The exact first parcel above 20 ha is ${contract.economic_crossover.first_over_20_ha ? `${contract.economic_crossover.first_over_20_ha.adult_residents} adults / ${contract.economic_crossover.first_over_20_ha.households} households at ${ha(contract.economic_crossover.first_over_20_ha.parcel_hectares)}` : 'unresolved'}. The 20–40 ha band currently has four usable observations and the 40+ ha band remains unresolved, so both conclusions are provisional.`,
  '',
  '| Adult count | Households | Parcel | Previous land band | New land band | $/ha change | Household monthly change |',
  '|---:|---:|---:|---|---|---:|---:|',
  ...crossoverRows.map((row) => `| ${row.adult_residents} | ${row.households} | ${ha(row.parcel_hectares)} | ${row.previous_land_band} | ${row.new_land_band} | ${signedMoney(row.land_price_change_cad_per_ha)} | ${signedMoney(row.household_monthly_change_cad)} |`),
  '',
  'The complete internal scan is retained in `arc-adult-scale.json` under `economic_crossover.internal_scan`; it is a diagnostic contract, not an expansion of the public demonstration table.',
  '',
  '## Land-market evidence status',
  '',
  `The 2024 Ontario Farmland Value and Rental Value Survey reports a Grey County median of CAD 19,000 per tillable acre from 29 responses. That is retained as a productive-land comparator, not as a parcel-size observation. The loaded whole-property observation set contains ${contract.land_market.usable_whole_property_observation_count} usable observations; asking prices, property-type mix and site constraints remain important limitations.`,
  '',
  '| Parcel band | Size-tagged observations | Median used CAD/ha | Descriptive median CAD/ha | Planning fallback CAD/ha |',
  '|---|---:|---:|---:|',
  ...contract.land_market.parcel_size_bands.map((band) => `| ${band.label} | ${band.sample_count} | ${band.sufficient_evidence_for_median ? money(band.median_price_cad_per_ha) : 'unresolved'} | ${money(band.median_price_cad_per_ha)} | ${money(contract.land_market.planning_curve[band.id])} |`),
  '',
  `The model selects the parcel band from total calculated parcel area. Bands below ${contract.land_market.minimum_observations_for_curve} observations remain unresolved rather than being filled from the planning sensitivity curve. Import observations with \`npm run import:arc:land-observations -- --input=...\`.`,
  `The current economic-crossover status is **${contract.economic_crossover.status}**. ${contract.economic_crossover.explanation}`,
  '',
  '## Sources',
  '',
  ...contract.land_market.sources.map((source) => `- [${source.institution}: ${source.title}](${source.url}) — ${source.evidence_status}; ${source.limitation}`)
].join('\n') + '\n';
fs.writeFileSync(path.join(outputDir, 'arc-adult-scale.md'), markdown);
console.log(`Wrote ${rows.length} adult-scale scenarios to ${outputDir}`);
