import fs from 'node:fs';
import path from 'node:path';
import {buildLandMarketContract, loadArcLandMarketData} from '../packages/carrying-capacity/src/index.mjs';

const outputDir = path.resolve('packages/carrying-capacity/outputs');
fs.mkdirSync(outputDir, {recursive: true});
const contract = buildLandMarketContract(loadArcLandMarketData());
const money = (value) => value == null ? 'unresolved' : `$${Number(value).toFixed(0)}`;
const hectares = (value) => value == null ? 'not supplied' : `${Number(value).toFixed(2)} ha`;
const curveStatus = (row) => row.arc_usable_acquisition ? `${row.property_market_class}; gross acquisition view` : `excluded: ${row.curve_eligibility ?? 'not classified'}`;
const bandById = (view, id) => view.parcel_size_bands.find((row) => row.id === id);
const markdown = [
  '# Grey County ARC land-market evidence',
  '',
  'This report keeps farmland benchmarks, vacant-land evidence, improved-property acquisition evidence and planning sensitivities separate. Improved properties enter gross acquisition economics at their actual whole-property asking or sale price; no farmhouse, barn or servicing value is silently subtracted. Asking prices are observations, not completed-sale values.',
  '',
  '## Evidence summary',
  '',
  `- ${contract.observations.length} observations loaded; ${contract.usable_vacant_land_observation_count} usable vacant/land-curve observations; ${contract.improved_property_observation_count} improved-property observations retained for gross acquisition analysis; ${contract.usable_arc_acquisition_observation_count} potentially ARC-usable acquisitions after unverified/strategic exclusions.`,
  `- Minimum sample for a band median: **${contract.minimum_observations_for_curve} observations**. Local curve status: **${contract.local_parcel_curve_status}**.`,
  `- The Ontario survey comparator contributes ${contract.productive_land_comparators.length} productive-land benchmark(s), separate from the whole-property curve.`,
  '',
  '## Loaded observations',
  '',
  '| Observation | Date | Municipality | Property class | Raw price | Adjusted price | Total area | Productive area | Raw $/ha | Curve treatment | Source / confidence |',
  '|---|---|---|---|---:|---:|---:|---:|---:|---|---|',
  ...contract.observations.map((row) => `| ${row.observation_id ?? 'unidentified'} | ${row.observation_date ?? ''} | ${row.municipality ?? ''} | ${row.property_type ?? ''} | ${money(row.raw_price_cad)} | ${money(row.adjusted_price_cad)} | ${hectares(row.total_parcel_area_ha)} | ${hectares(row.estimated_productive_area_ha)} | ${money(row.price_cad_per_ha)} | ${curveStatus(row)} | [source](${row.source_url ?? '#'}) · ${row.evidence_status} |`),
  '',
  '## Parcel-size bands',
  '',
  '| Band | Vacant n | Vacant gross $/ha | Improved n | Improved gross $/ha | All ARC-usable n | All ARC-usable gross $/ha | All median acquisition |',
  '|---|---:|---:|---:|---:|---:|---:|---:|',
  ...contract.parcel_size_bands.map((row) => { const improved = bandById(contract.improved_property_acquisition_market, row.id); const all = bandById(contract.arc_usable_acquisition_market, row.id); return `| ${row.label} | ${row.sample_count} | ${row.sufficient_evidence_for_median ? money(row.median_gross_price_cad_per_ha) : 'unresolved'} | ${improved.sample_count} | ${improved.sufficient_evidence_for_median ? money(improved.median_gross_price_cad_per_ha) : 'unresolved'} | ${all.sample_count} | ${all.sufficient_evidence_for_median ? money(all.median_gross_price_cad_per_ha) : 'unresolved'} | ${all.sufficient_evidence_for_median ? money(all.median_total_acquisition_price_cad) : 'unresolved'} |`; }),
  '',
  'The three views answer different questions: vacant land estimates the pure land component; improved property shows the gross acquisition cost of real farms/rural properties; all ARC-usable acquisitions provides a broad whole-property acquisition comparator. Each band remains unresolved when its own sample is below the minimum threshold.',
  '',
  '## Improvement reuse layer',
  '',
  `The ${contract.improved_property_observation_count} improved-property observations are retained. ${contract.minor_improvement_overlap_observation_count} minor-improvement observation also remains in the vacant/land curve because its sheds are not treated as a substantial building asset. All known homes, barns, access, wells, septic and hydro are flagged per observation as usable, potentially reusable or condition unknown; monetary offsets remain unresolved until inspection, approval and replacement-cost evidence exist.`,
  '',
  '| Observation | Property type | Gross acquisition | Gross $/ha | Candidate reuse assets | Offset status |',
  '|---|---|---:|---:|---|---|',
  ...contract.observations.filter((row) => row.arc_usable_acquisition && row.property_market_class === 'improved_property').map((row) => `| ${row.observation_id} | ${row.property_type} | ${money(row.gross_acquisition_price_cad)} | ${money(row.gross_acquisition_price_cad_per_ha)} | ${row.potential_arc_reuse.assets.filter((asset) => asset.present).map((asset) => asset.id).join(', ') || 'none identified'} | ${row.potential_arc_reuse.capital_offset_status} |`),
  '',
  `Adjusted land-value evidence: **${contract.adjusted_land_value_evidence.status}** (${contract.adjusted_land_value_evidence.observation_count} observations). Adjusted residuals remain analytical only and never replace gross purchase prices in ARC acquisition economics.`,
  '',
  '## Productive-land comparator',
  '',
  '| Comparator | Value | Evidence status | Interpretation |',
  '|---|---:|---|---|',
  ...contract.productive_land_comparators.map((row) => `| ${row.observation_id} | ${money(row.price_cad_per_productive_ha)} / productive ha | ${row.evidence_status} | ${row.note} |`),
  '',
  '## Current conclusion',
  '',
  `- Local size curve status: **${contract.local_parcel_curve_status}**.`,
  `- Planning curve status: **${contract.planning_curve_status}**.`,
  `- ${contract.planning_curve_basis}`,
  '- The loaded observations show a strong small-lot premium and lower observed whole-property $/ha in the 10–20 ha and 20–40 ha bands. This supports testing a size effect, but it is not a causal estimate: the sample mixes rural-residential lots, woodland, agricultural land, access, zoning, wetland, recreational and other site differences.',
  '- Asking prices are not sale prices. The 5–10 ha and 40+ ha bands remain below the minimum sample threshold and are not used as market medians.',
  '',
  '## Sources',
  '',
  ...contract.sources.map((source) => `- [${source.institution}: ${source.title}](${source.url}) — ${source.evidence_status}. ${source.limitation}`)
].join('\n') + '\n';
fs.writeFileSync(path.join(outputDir, 'arc-land-market.md'), markdown);
fs.writeFileSync(path.join(outputDir, 'arc-land-market.json'), JSON.stringify({generated_at: new Date().toISOString(), ...contract}, null, 2) + '\n');
console.log(`Wrote land-market evidence report to ${outputDir}`);
