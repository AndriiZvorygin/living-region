import fs from 'node:fs';
import path from 'node:path';
import {buildLandMarketContract, loadArcLandMarketData} from '../packages/carrying-capacity/src/index.mjs';

const outputDir = path.resolve('packages/carrying-capacity/outputs');
fs.mkdirSync(outputDir, {recursive: true});
const contract = buildLandMarketContract(loadArcLandMarketData());
const money = (value) => value == null ? 'unresolved' : `$${Number(value).toFixed(0)}`;
const hectares = (value) => value == null ? 'not supplied' : `${Number(value).toFixed(2)} ha`;
const curveStatus = (row) => row.curve_eligibility === 'whole_property_curve' && row.price_cad_per_ha != null ? 'included in whole-property curve' : `excluded: ${row.curve_eligibility ?? 'not classified'}`;
const markdown = [
  '# Grey County ARC land-market evidence',
  '',
  'This report keeps farmland benchmarks, parcel observations and planning sensitivities separate. Improved farms are preserved as context but are not treated as bare land unless an improvement adjustment is documented. Asking prices are observations, not completed-sale values.',
  '',
  '## Evidence summary',
  '',
  `- ${contract.observations.length} observations loaded; ${contract.usable_whole_property_observation_count} usable whole-property observations after exclusions; ${contract.improved_property_observation_count} improved/context observations retained but excluded.`,
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
  '| Band | Sample count | Median used? | Median used | Descriptive median | Range | Vacant / excluded improved | Vintage |',
  '|---|---:|---|---:|---:|---:|---:|---|',
  ...contract.parcel_size_bands.map((row) => `| ${row.label} | ${row.sample_count} | ${row.sufficient_evidence_for_median ? 'yes' : 'no'} | ${row.sufficient_evidence_for_median ? money(row.median_price_cad_per_ha) : 'unresolved'} | ${money(row.median_price_cad_per_ha)} | ${money(row.min_price_cad_per_ha)}–${money(row.max_price_cad_per_ha)} | ${row.vacant_observation_count} / ${row.improved_observation_count_excluded} | ${row.observation_years.join(', ') || 'none'} |`),
  '',
  'The descriptive median is shown even in sparse bands for inspection, but the adult-scale model only uses a band when the minimum sample threshold is met. Sparse bands remain unresolved rather than being filled from the planning curve.',
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
