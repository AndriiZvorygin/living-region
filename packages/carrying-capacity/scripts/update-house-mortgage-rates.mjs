import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';

const sourcePath = resolve('packages/carrying-capacity/data/source/house-mortgage-rates.json');
const outputPath = resolve('packages/carrying-capacity/data/derived/house-mortgage-rates.json');
const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const asOfArgument = process.argv.find((argument) => argument.startsWith('--as-of='))?.split('=')[1];
const asOf = asOfArgument ?? process.env.MORTGAGE_RATE_AS_OF ?? source.snapshot_date;
const isoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value));
if (!isoDate(asOf) || !isoDate(source.snapshot_date)) throw new Error('Mortgage rate snapshot dates must use YYYY-MM-DD');
if (source.contract_version !== '1.0.0') throw new Error('Unsupported mortgage rate source contract');
if (!Array.isArray(source.sources) || !Array.isArray(source.lender_observations)) throw new Error('Mortgage rate source is missing source or lender rows');
const sourceIds = new Set(source.sources.map((row) => row.id));
if (sourceIds.size !== source.sources.length) throw new Error('Mortgage rate source contains duplicate source IDs');
for (const group of Object.values(source.reference_rates ?? {})) {
  for (const row of Object.values(group ?? {})) {
    if (!sourceIds.has(row.source_id) || !(row.annual_rate >= 0 && row.annual_rate < 1)) throw new Error('Mortgage reference rate is invalid');
  }
}
const observationIds = new Set();
for (const row of source.lender_observations) {
  if (observationIds.has(row.id) || !sourceIds.has(row.source_id) || !(row.annual_rate >= 0 && row.annual_rate < 1)) throw new Error('Mortgage lender observation is invalid');
  observationIds.add(row.id);
}
let previousLtv = -1;
for (const row of source.insurance_schedule ?? []) {
  if (!(row.max_ltv > previousLtv && row.max_ltv <= 1) || !(row.premium_rate >= 0 && row.premium_rate < 1)) throw new Error('Mortgage insurance schedule is invalid');
  previousLtv = row.max_ltv;
}
const ageDays = Math.max(0, (Date.parse(`${asOf}T00:00:00Z`) - Date.parse(`${source.snapshot_date}T00:00:00Z`)) / 86400000);
const snapshot = {
  ...source,
  freshness: {
    ...source.freshness,
    status: ageDays > Number(source.freshness?.stale_after_days ?? 120) ? 'stale' : 'fresh',
    checked_as_of: asOf,
    age_days: ageDays
  },
  generated_at: asOf,
  source_snapshot_path: 'packages/carrying-capacity/data/source/house-mortgage-rates.json'
};
await mkdir(dirname(outputPath), {recursive: true});
await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`wrote mortgage rate snapshot ${snapshot.snapshot_id} (${snapshot.freshness.status}; checked ${asOf})`);
