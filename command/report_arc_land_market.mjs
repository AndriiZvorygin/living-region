import fs from 'node:fs';
import path from 'node:path';
import {buildLandMarketContract, loadArcLandMarketData} from '../packages/carrying-capacity/src/index.mjs';

const outputDir = path.resolve('packages/carrying-capacity/outputs');
fs.mkdirSync(outputDir, {recursive: true});
const contract = buildLandMarketContract(loadArcLandMarketData());
const money = (value) => value == null ? 'unresolved' : `$${Number(value).toFixed(0)}`;
const markdown = [
  '# Grey County ARC land-market evidence',
  '',
  'This report keeps farmland benchmarks, parcel observations and planning sensitivities separate. Improved farms are not treated as bare land unless an improvement adjustment is documented.',
  '',
  '## Loaded observations',
  '',
  '| Observation | Date | Geography | Basis | Price | Parcel size | Sample / note | Evidence status |',
  '|---|---|---|---|---:|---:|---|---|',
  ...contract.observations.map((row) => `| ${row.observation_id ?? 'unidentified'} | ${row.observation_date ?? ''} | ${row.municipality ?? ''} | ${row.price_basis ?? ''} | ${money(row.price_cad_per_ha)} / ha equivalent | ${row.total_parcel_area_ha == null ? 'not supplied' : `${row.total_parcel_area_ha} ha`} | ${row.response_count ?? ''} ${row.site_quality_notes ?? ''} | ${row.evidence_status} |`),
  '',
  '## Parcel-size bands',
  '',
  '| Band | Sample count | Median | Lower quartile | Upper quartile | Property types | Vintage |',
  '|---|---:|---:|---:|---:|---|---|',
  ...contract.parcel_size_bands.map((row) => `| ${row.label} | ${row.sample_count} | ${money(row.median_price_cad_per_ha)} | ${money(row.lower_quartile_price_cad_per_ha)} | ${money(row.upper_quartile_price_cad_per_ha)} | ${Object.keys(row.property_type_composition).join(', ') || 'none'} | ${row.observation_years.join(', ') || 'none'} |`),
  '',
  '## Current conclusion',
  '',
  `- Local size curve status: **${contract.local_parcel_curve_status}**.`,
  `- Planning curve status: **${contract.planning_curve_status}**.`,
  `- ${contract.planning_curve_basis}`,
  '- The current evidence supports using Grey County farmland value as a benchmark and supports collecting local observations. It does not yet prove a parcel-size discount or establish the minimum economically attractive ARC scale.',
  '',
  '## Sources',
  '',
  ...contract.sources.map((source) => `- [${source.institution}: ${source.title}](${source.url}) — ${source.evidence_status}. ${source.limitation}`)
].join('\n') + '\n';
fs.writeFileSync(path.join(outputDir, 'arc-land-market.md'), markdown);
fs.writeFileSync(path.join(outputDir, 'arc-land-market.json'), JSON.stringify({generated_at: new Date().toISOString(), ...contract}, null, 2) + '\n');
console.log(`Wrote land-market evidence report to ${outputDir}`);
