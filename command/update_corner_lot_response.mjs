#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {
    ranked: 'artifacts/corner-lot-flyering-ranked-deduped.csv',
    daily: '',
    outRanked: 'artifacts/corner-lot-flyering-ranked-deduped.updated.csv',
    outFollowups: 'artifacts/corner-lot-flyering-followups.csv'
  };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--ranked') args.ranked = argv[++i] ?? args.ranked;
    else if (token === '--daily' || token === '--day-sheet') args.daily = argv[++i] ?? '';
    else if (token === '--out-ranked' || token === '--out') args.outRanked = argv[++i] ?? args.outRanked;
    else if (token === '--out-followups' || token === '--followups-out') args.outFollowups = argv[++i] ?? args.outFollowups;
  }
  return args;
}

function parseCsv(text) {
  const rows = [];
  let i = 0, field = '', row = [], inQuotes = false;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue; }
      if (ch === '"') { inQuotes = false; i += 1; continue; }
      field += ch; i += 1; continue;
    }
    if (ch === '"') { inQuotes = true; i += 1; continue; }
    if (ch === ',') { row.push(field); field = ''; i += 1; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i += 1; continue; }
    if (ch === '\r') { i += 1; continue; }
    field += ch; i += 1;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return { headers: [], rows: [] };
  const headers = rows[0];
  const records = rows.slice(1).filter((r) => r.some((x) => x !== '')).map((r) => {
    const obj = {};
    for (let k = 0; k < headers.length; k += 1) obj[headers[k]] = r[k] ?? '';
    return obj;
  });
  return { headers, rows: records };
}

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers, rows) {
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map((h) => csvEscape(r[h])).join(','));
  return `${lines.join('\n')}\n`;
}

function yes(v) {
  return ['y', 'yes', 'true', '1'].includes(String(v || '').trim().toLowerCase());
}

function warmResponse(v) {
  const s = String(v || '').toLowerCase();
  return s.includes('warm') || s.includes('friendly') || s.includes('interested');
}

function addDays(isoDate, days) {
  if (!isoDate) return '';
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const args = parseArgs(process.argv);
if (!args.daily) {
  console.error('Missing required --daily/--day-sheet <sheet.csv>');
  process.exit(1);
}

const rankedPath = path.resolve(args.ranked);
const dailyPath = path.resolve(args.daily);
const outRankedPath = path.resolve(args.outRanked);
const outFollowupsPath = path.resolve(args.outFollowups);

if (!fs.existsSync(rankedPath)) {
  console.error(`Missing ranked CSV: ${rankedPath}`);
  process.exit(1);
}
if (!fs.existsSync(dailyPath)) {
  console.error(`Missing daily CSV: ${dailyPath}`);
  process.exit(1);
}

const ranked = parseCsv(fs.readFileSync(rankedPath, 'utf8'));
const daily = parseCsv(fs.readFileSync(dailyPath, 'utf8'));

const updates = new Map();
for (const d of daily.rows) {
  const key = String(d.global_rank || '').trim();
  if (!key) continue;
  updates.set(key, {
    flyer_delivered: d.flyer_delivered || '',
    flyer_date: d.flyer_date || d.original_flyer_date || '',
    knock_due_date: d.knock_due_date || '',
    knocked: d.knocked || '',
    knock_date: d.knock_date || '',
    response: d.response || '',
    sign_followup: d.sign_followup || '',
    sign_permission: d.sign_permission || '',
    followup_notes: d.followup_notes || d.notes || ''
  });
}

const requiredFields = [
  'flyer_delivered','flyer_date','knock_due_date','knocked','knock_date',
  'response','sign_followup','sign_permission','followup_notes'
];

const rankedHeaders = [...ranked.headers];
for (const extra of requiredFields) {
  if (!rankedHeaders.includes(extra)) rankedHeaders.push(extra);
}

const mergedRows = ranked.rows.map((r) => {
  const key = String(r.global_rank || '').trim();
  const u = updates.get(key);
  const row = { ...r };
  for (const f of requiredFields) if (!Object.hasOwn(row, f)) row[f] = '';

  if (u) {
    for (const [k, v] of Object.entries(u)) {
      if (v !== '') row[k] = v;
    }
  }

  if (yes(row.flyer_delivered) && row.flyer_date) {
    row.knock_due_date = row.knock_due_date || addDays(row.flyer_date, 7);
  }

  return row;
});

const followups = mergedRows.filter((r) =>
  yes(r.sign_followup) ||
  yes(r.sign_permission) ||
  warmResponse(r.response)
);

followups.sort((a, b) => {
  const aPerm = yes(a.sign_permission) ? 0 : 1;
  const bPerm = yes(b.sign_permission) ? 0 : 1;
  if (aPerm !== bPerm) return aPerm - bPerm;
  const aFollow = yes(a.sign_followup) ? 0 : 1;
  const bFollow = yes(b.sign_followup) ? 0 : 1;
  if (aFollow !== bFollow) return aFollow - bFollow;
  return Number(a.global_rank || 999999) - Number(b.global_rank || 999999);
});

fs.mkdirSync(path.dirname(outRankedPath), { recursive: true });
fs.writeFileSync(outRankedPath, toCsv(rankedHeaders, mergedRows));

const followHeaders = [
  'global_rank','daily_tier','canonical_intersection_name','display_intersection_name','lat','lon',
  'response','sign_followup','sign_permission','followup_notes','recommended_action'
];
fs.writeFileSync(outFollowupsPath, toCsv(followHeaders, followups));

console.log(JSON.stringify({
  ok: true,
  ranked_input: rankedPath,
  daily_input: dailyPath,
  updated_rows: updates.size,
  merged_output: outRankedPath,
  followups_output: outFollowupsPath,
  followup_count: followups.length
}, null, 2));
