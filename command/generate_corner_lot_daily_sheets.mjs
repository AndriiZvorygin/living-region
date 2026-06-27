#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {
    input: 'artifacts/corner-lot-flyering-ranked-deduped.csv',
    outDir: 'artifacts/corner-lot-flyering-daily-sheets',
    stopsPerDay: 15,
    includeCTier: false,
    sheetType: 'flyer',
    today: new Date().toISOString().slice(0, 10)
  };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--input') args.input = argv[++i] ?? args.input;
    else if (token === '--out-dir') args.outDir = argv[++i] ?? args.outDir;
    else if (token === '--stops-per-day') args.stopsPerDay = Number(argv[++i] ?? args.stopsPerDay);
    else if (token === '--include-c-tier') args.includeCTier = true;
    else if (token === '--sheet-type') args.sheetType = (argv[++i] ?? args.sheetType).toLowerCase();
    else if (token === '--today') args.today = argv[++i] ?? args.today;
  }
  return args;
}

function parseCsv(text) {
  const rows = [];
  let i = 0; let field = ''; let row = []; let inQuotes = false;
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
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).filter((r) => r.some((x) => x !== '')).map((r) => {
    const obj = {};
    for (let k = 0; k < headers.length; k += 1) obj[headers[k]] = r[k] ?? '';
    return obj;
  });
}

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
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

function dateLE(a, b) {
  if (!a || !b) return false;
  return a <= b;
}

function suggestedHouses(tier, mode) {
  const base = tier === 'S' ? 12 : tier === 'A' ? 10 : tier === 'B' ? 8 : 6;
  if (mode === 'knock') return Math.max(4, Math.round(base * 0.6));
  return base;
}

const args = parseArgs(process.argv);
if (!['flyer', 'knock', 'sign'].includes(args.sheetType)) {
  console.error('--sheet-type must be one of: flyer, knock, sign');
  process.exit(1);
}

const inputPath = path.resolve(args.input);
const outDir = path.resolve(args.outDir);
if (!fs.existsSync(inputPath)) {
  console.error(`Missing ranked input CSV: ${inputPath}`);
  process.exit(1);
}
if (!Number.isFinite(args.stopsPerDay) || args.stopsPerDay <= 0) {
  console.error('--stops-per-day must be a positive number');
  process.exit(1);
}

const rows = parseCsv(fs.readFileSync(inputPath, 'utf8')).map((r) => ({ ...r }));
const tierOrder = { S: 1, A: 2, B: 3, C: 4 };

for (const r of rows) {
  if (!Object.hasOwn(r, 'flyer_delivered')) r.flyer_delivered = '';
  if (!Object.hasOwn(r, 'flyer_date')) r.flyer_date = '';
  if (!Object.hasOwn(r, 'knock_due_date')) r.knock_due_date = '';
  if (!Object.hasOwn(r, 'knocked')) r.knocked = '';
  if (!Object.hasOwn(r, 'knock_date')) r.knock_date = '';
  if (!Object.hasOwn(r, 'response')) r.response = '';
  if (!Object.hasOwn(r, 'sign_followup')) r.sign_followup = '';
  if (!Object.hasOwn(r, 'sign_permission')) r.sign_permission = '';
  if (!Object.hasOwn(r, 'followup_notes')) r.followup_notes = '';
  if (yes(r.flyer_delivered) && r.flyer_date && !r.knock_due_date) {
    r.knock_due_date = addDays(r.flyer_date, 7);
  }
}

let eligible = rows;
if (!args.includeCTier) eligible = eligible.filter((r) => String(r.daily_tier || '').toUpperCase() !== 'C');

if (args.sheetType === 'flyer') {
  eligible = eligible.filter((r) => !yes(r.flyer_delivered));
} else if (args.sheetType === 'knock') {
  eligible = eligible.filter((r) => {
    if (!yes(r.flyer_delivered)) return false;
    if (yes(r.knocked)) return false;
    const due = r.knock_due_date || addDays(r.flyer_date, 7);
    return dateLE(due, args.today);
  });
} else {
  eligible = eligible.filter((r) => yes(r.sign_followup) || yes(r.sign_permission) || warmResponse(r.response));
}

eligible.sort((a, b) => {
  const ta = tierOrder[String(a.daily_tier || '').toUpperCase()] ?? 99;
  const tb = tierOrder[String(b.daily_tier || '').toUpperCase()] ?? 99;
  if (ta !== tb) return ta - tb;
  return Number(a.global_rank || 999999) - Number(b.global_rank || 999999);
});

fs.mkdirSync(outDir, { recursive: true });

let headers;
if (args.sheetType === 'flyer') {
  headers = ['stop_order','global_rank','daily_tier','intersection_area','suggested_houses_to_flyer','lat','lon','flyer_delivered','flyer_date','notes'];
} else if (args.sheetType === 'knock') {
  headers = ['stop_order','global_rank','daily_tier','intersection_area','suggested_houses_to_knock','original_flyer_date','knock_due_date','knocked','knock_date','response','sign_followup','notes'];
} else {
  headers = ['stop_order','global_rank','intersection_area','response','sign_followup','sign_permission','notes'];
}

const dayCount = Math.ceil(eligible.length / args.stopsPerDay);
const created = [];
const prefix = args.sheetType;
for (let day = 1; day <= dayCount; day += 1) {
  const start = (day - 1) * args.stopsPerDay;
  const chunk = eligible.slice(start, start + args.stopsPerDay);
  const lines = [headers.join(',')];

  for (let idx = 0; idx < chunk.length; idx += 1) {
    const r = chunk[idx];
    const intersectionArea = String(r.display_intersection_name || r.canonical_intersection_name || r.connected_way_names || '').replace(/\s*\|\s*/g, ' & ').trim();
    const row = { stop_order: idx + 1 };

    if (args.sheetType === 'flyer') {
      Object.assign(row, {
        global_rank: r.global_rank,
        daily_tier: r.daily_tier,
        intersection_area: intersectionArea,
        suggested_houses_to_flyer: suggestedHouses(String(r.daily_tier || '').toUpperCase(), 'flyer'),
        lat: r.representative_lat || r.lat,
        lon: r.representative_lon || r.lon,
        flyer_delivered: r.flyer_delivered,
        flyer_date: r.flyer_date,
        notes: r.followup_notes || ''
      });
    } else if (args.sheetType === 'knock') {
      Object.assign(row, {
        global_rank: r.global_rank,
        daily_tier: r.daily_tier,
        intersection_area: intersectionArea,
        suggested_houses_to_knock: suggestedHouses(String(r.daily_tier || '').toUpperCase(), 'knock'),
        original_flyer_date: r.flyer_date,
        knock_due_date: r.knock_due_date || addDays(r.flyer_date, 7),
        knocked: r.knocked,
        knock_date: r.knock_date,
        response: r.response,
        sign_followup: r.sign_followup,
        notes: r.followup_notes || ''
      });
    } else {
      Object.assign(row, {
        global_rank: r.global_rank,
        intersection_area: intersectionArea,
        response: r.response,
        sign_followup: r.sign_followup,
        sign_permission: r.sign_permission,
        notes: r.followup_notes || ''
      });
    }

    lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  }

  const filename = `${prefix}-day-${String(day).padStart(3, '0')}.csv`;
  const fullPath = path.join(outDir, filename);
  fs.writeFileSync(fullPath, `${lines.join('\n')}\n`);
  created.push(fullPath);
}

console.log(JSON.stringify({
  ok: true,
  sheetType: args.sheetType,
  input: inputPath,
  outDir,
  stopsPerDay: args.stopsPerDay,
  includeCTier: args.includeCTier,
  today: args.today,
  eligibleStops: eligible.length,
  daySheets: dayCount,
  files: created
}, null, 2));
