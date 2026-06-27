#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {
    ranked: 'artifacts/corner-lot-flyering-ranked-deduped.updated.csv',
    followups: 'artifacts/corner-lot-flyering-followups.csv',
    outPya: 'artifacts/corner-lot-canvass-progress.pya',
    outTxt: 'artifacts/corner-lot-canvass-progress.txt',
    today: new Date().toISOString().slice(0, 10)
  };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--ranked') args.ranked = argv[++i] ?? args.ranked;
    else if (token === '--followups') args.followups = argv[++i] ?? args.followups;
    else if (token === '--out-pya') args.outPya = argv[++i] ?? args.outPya;
    else if (token === '--out-txt') args.outTxt = argv[++i] ?? args.outTxt;
    else if (token === '--today') args.today = argv[++i] ?? args.today;
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

function yes(v) {
  return ['y', 'yes', 'true', '1'].includes(String(v || '').trim().toLowerCase());
}

function warm(v) {
  const s = String(v || '').toLowerCase();
  return s.includes('warm') || s.includes('friendly') || s.includes('interested');
}

function due(d, today) {
  if (!d) return false;
  return d <= today;
}

const args = parseArgs(process.argv);
const rankedPath = path.resolve(args.ranked);
const followPath = path.resolve(args.followups);
const outPya = path.resolve(args.outPya);
const outTxt = path.resolve(args.outTxt);

if (!fs.existsSync(rankedPath)) {
  console.error(`Missing ranked file: ${rankedPath}`);
  process.exit(1);
}

const ranked = parseCsv(fs.readFileSync(rankedPath, 'utf8')).rows;
const followups = fs.existsSync(followPath) ? parseCsv(fs.readFileSync(followPath, 'utf8')).rows : [];

const tierCounts = { S: 0, A: 0, B: 0, C: 0 };
const visitedByTier = { S: 0, A: 0, B: 0, C: 0 };
const remainingByTier = { S: 0, A: 0, B: 0, C: 0 };

let flyerDeliveredCount = 0;
let knockedCount = 0;
let warmCount = 0;
let followupYesCount = 0;
let permissionYesCount = 0;
let knockDueNowCount = 0;

for (const r of ranked) {
  const t = String(r.daily_tier || '').toUpperCase();
  if (tierCounts[t] != null) tierCounts[t] += 1;

  const flyerDone = yes(r.flyer_delivered);
  const knocked = yes(r.knocked);

  if (flyerDone) flyerDeliveredCount += 1;
  if (knocked) knockedCount += 1;

  if (flyerDone && !knocked && due(r.knock_due_date, args.today)) knockDueNowCount += 1;

  if (knocked) {
    if (visitedByTier[t] != null) visitedByTier[t] += 1;
  } else {
    if (remainingByTier[t] != null) remainingByTier[t] += 1;
  }

  if (warm(r.response)) warmCount += 1;
  if (yes(r.sign_followup)) followupYesCount += 1;
  if (yes(r.sign_permission)) permissionYesCount += 1;
}

const total = ranked.length;
const unvisited = total - knockedCount;

const topRemaining = ranked
  .filter((r) => !yes(r.knocked))
  .sort((a, b) => Number(a.global_rank || 999999) - Number(b.global_rank || 999999))
  .slice(0, 15)
  .map((r) => ({
    global_rank: Number(r.global_rank || 0),
    daily_tier: r.daily_tier,
    intersection_area: r.display_intersection_name || r.canonical_intersection_name || r.connected_way_names,
    recommended_action: r.recommended_action
  }));

const followTop15 = followups
  .slice()
  .sort((a, b) => Number(a.global_rank || 999999) - Number(b.global_rank || 999999))
  .slice(0, 15)
  .map((r) => ({
    global_rank: Number(r.global_rank || 0),
    daily_tier: r.daily_tier,
    intersection_area: r.display_intersection_name || r.canonical_intersection_name || r.connected_way_names,
    response: r.response,
    sign_followup: r.sign_followup,
    sign_permission: r.sign_permission
  }));

let nextSheetType = 'flyer';
if (knockDueNowCount > 0) nextSheetType = 'knock';
if (followups.length > 0) nextSheetType = 'sign';

const summary = {
  generated_at: new Date().toISOString(),
  today: args.today,
  input_ranked: rankedPath,
  input_followups: followPath,
  total_ranked_stops: total,
  total_tier_counts: tierCounts,
  flyer_delivered_count: flyerDeliveredCount,
  knocked_count: knockedCount,
  visited_count: knockedCount,
  unvisited_count: unvisited,
  visited_by_tier: visitedByTier,
  remaining_by_tier: remainingByTier,
  warm_friendly_interested_count: warmCount,
  sign_followup_yes_count: followupYesCount,
  sign_permission_yes_count: permissionYesCount,
  knock_due_now_count: knockDueNowCount,
  top_15_remaining_stops: topRemaining,
  top_15_followup_stops: followTop15,
  next_suggested_sheet_type: nextSheetType,
  next_suggested_daily_sheet: path.join('artifacts/corner-lot-flyering-daily-sheets', `${nextSheetType}-day-001.csv`)
};

const txt = [
  'Corner-Lot Canvass Progress (Two-Touch Workflow)',
  `Generated: ${summary.generated_at}`,
  `Today: ${summary.today}`,
  `Total ranked stops: ${total}`,
  `Tiers S/A/B/C: ${tierCounts.S}/${tierCounts.A}/${tierCounts.B}/${tierCounts.C}`,
  `Flyers delivered: ${flyerDeliveredCount}`,
  `Knocked: ${knockedCount}`,
  `Knock due now: ${knockDueNowCount}`,
  `Warm/friendly/interested: ${warmCount}`,
  `sign_followup=yes: ${followupYesCount}`,
  `sign_permission=yes: ${permissionYesCount}`,
  `Next suggested sheet: ${summary.next_suggested_daily_sheet}`,
  '',
  'Top 15 Remaining Stops:',
  ...topRemaining.map((r) => `- #${r.global_rank} [${r.daily_tier}] ${r.intersection_area}`),
  '',
  'Top 15 Follow-Up Stops:',
  ...(followTop15.length ? followTop15.map((r) => `- #${r.global_rank} [${r.daily_tier}] ${r.intersection_area} (perm=${r.sign_permission}, follow=${r.sign_followup})`) : ['- none yet'])
].join('\n');

fs.mkdirSync(path.dirname(outPya), { recursive: true });
fs.writeFileSync(outPya, `${JSON.stringify(summary, null, 2)}\n`);
fs.writeFileSync(outTxt, `${txt}\n`);

console.log(`Canvass progress: flyers ${flyerDeliveredCount}/${total}, knocked ${knockedCount}/${total}, due ${knockDueNowCount}, followups ${followups.length}, next ${nextSheetType}`);
