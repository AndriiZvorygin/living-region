#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const inGeo = path.resolve('artifacts/corner-lot-flyering-priority.geojson');
const inPya = path.resolve('artifacts/corner-lot-flyering-priority.pya');
const outGeo = path.resolve('artifacts/corner-lot-flyering-ranked.geojson');
const outCsv = path.resolve('artifacts/corner-lot-flyering-ranked.csv');
const outPya = path.resolve('artifacts/corner-lot-flyering-ranked.pya');

if (!fs.existsSync(inGeo)) {
  console.error(`Missing input: ${inGeo}`);
  process.exit(1);
}

const fc = JSON.parse(fs.readFileSync(inGeo, 'utf8'));
const baseSummary = fs.existsSync(inPya) ? JSON.parse(fs.readFileSync(inPya, 'utf8')) : null;
const features = (fc.features || []).map((f) => ({ ...f, properties: { ...(f.properties || {}) } }));

function normTags(tags) {
  return Array.isArray(tags) ? tags.map((t) => String(t).toLowerCase()) : [];
}

function hasAny(tags, set) {
  return tags.some((t) => set.has(t));
}

const majorSet = new Set(['primary', 'secondary', 'tertiary']);
const localSet = new Set(['residential', 'unclassified', 'living_street', 'road']);

function classifyLabel(score) {
  if (score >= 85) return 'highest visibility corner';
  if (score >= 70) return 'strong visibility corner';
  if (score >= 50) return 'neighbourhood connector corner';
  return 'local residential corner';
}

function actionForTier(tier) {
  if (tier === 'S') return 'visit first; highest sign ask potential';
  if (tier === 'A') return 'visit early; good sign ask potential';
  if (tier === 'B') return 'visit when nearby; flyer first';
  return 'flyer-only / later saturation';
}

function reasonFor(props, scoreCtx) {
  const reasons = [];
  if (scoreCtx.majorCount >= 2) reasons.push('two+ higher-order roads');
  else if (scoreCtx.majorCount >= 1 && scoreCtx.localCount >= 1) reasons.push('higher-order to neighbourhood connector');
  if (scoreCtx.degree >= 4) reasons.push('multi-approach junction');
  if (scoreCtx.distinctNames >= 2) reasons.push('multiple street-front exposures');
  if (scoreCtx.allLocal) reasons.push('mostly local-street exposure');
  if (props.visibility_score < 40) reasons.push('lower baseline visibility');
  if (!Array.isArray(props.connected_way_names) || props.connected_way_names.length === 0) reasons.push('missing street names');
  return reasons.slice(0, 3).join('; ') || 'baseline intersection exposure';
}

for (const f of features) {
  const p = f.properties;
  const tags = normTags(p.connected_highway_tags);
  const names = Array.isArray(p.connected_way_names) ? p.connected_way_names.filter((x) => String(x).trim()) : [];
  const degree = Number(p.degree_merged || 0);
  const vis = Number(p.visibility_score || 0);

  const majorCount = tags.filter((t) => majorSet.has(t)).length;
  const localCount = tags.filter((t) => localSet.has(t)).length;
  const allLocal = tags.length > 0 && tags.every((t) => localSet.has(t));

  let score = vis;
  if (majorCount >= 2) score += 25;
  else if (majorCount >= 1 && localCount >= 1) score += 20;
  if (degree >= 4) score += 15;
  if (names.length >= 2) score += 10;

  // Dataset-driven optionals unavailable in this pass: school/park/church/facility/bridge/downtown/walk-route

  if (allLocal) score -= 30;
  if (allLocal && degree <= 2) score -= 25;
  if (vis < 40) score -= 20;
  if (names.length === 0) score -= 10;

  // clamp
  score = Math.max(0, Math.min(130, Math.round(score)));

  const label = classifyLabel(score);
  const reason = reasonFor(p, { majorCount, localCount, degree, distinctNames: names.length, allLocal });

  p.daily_priority_score = score;
  p.priority_reason = reason;
  p.route_bucket = label;
}

const priorityRank = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6 };
features.sort((a, b) => {
  const pa = a.properties, pb = b.properties;
  if (pa.daily_priority_score !== pb.daily_priority_score) return pb.daily_priority_score - pa.daily_priority_score;
  if ((priorityRank[pa.intersection_priority] || 99) !== (priorityRank[pb.intersection_priority] || 99)) {
    return (priorityRank[pa.intersection_priority] || 99) - (priorityRank[pb.intersection_priority] || 99);
  }
  return (pb.visibility_score || 0) - (pa.visibility_score || 0);
});

for (let i = 0; i < features.length; i += 1) {
  const rank = i + 1;
  const p = features[i].properties;
  p.global_rank = rank;
  p.daily_tier = rank <= 20 ? 'S' : rank <= 70 ? 'A' : rank <= 170 ? 'B' : 'C';
  p.suggested_day = `Day ${Math.ceil(rank / 15)}`;
  p.recommended_action = actionForTier(p.daily_tier);
  p.canvass_order = p.daily_tier === 'S' ? 1 : p.daily_tier === 'A' ? 2 : p.daily_tier === 'B' ? 3 : 4;
}

const tierCounts = features.reduce((acc, f) => {
  const t = f.properties.daily_tier;
  acc[t] = (acc[t] || 0) + 1;
  return acc;
}, {});

const day1 = features.filter((f) => f.properties.suggested_day === 'Day 1').map((f) => f.properties);
const top25 = features.slice(0, 25).map((f) => f.properties);

const outFc = { type: 'FeatureCollection', features };

function csvEscape(v) {
  const s = Array.isArray(v) ? v.join(' | ') : String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const headers = [
  'global_rank','daily_tier','daily_priority_score','node_id','lat','lon',
  'connected_way_names','connected_highway_tags','degree_merged','intersection_priority',
  'visibility_score','sign_value','route_bucket','priority_reason','canvass_order','suggested_day','recommended_action'
];

const csvLines = [headers.join(',')];
for (const f of features) {
  const p = f.properties;
  const row = headers.map((h) => csvEscape(p[h]));
  csvLines.push(row.join(','));
}

const summary = {
  generated_at: new Date().toISOString(),
  source_geojson: inGeo,
  source_summary: inPya,
  output_geojson: outGeo,
  output_csv: outCsv,
  total_candidates: features.length,
  tier_counts: tierCounts,
  top_25: top25,
  day_1_route_list: day1,
  notes: [
    'Daily tiers are ranked funnel targets: S top 20, A next 50, B next 100, C remaining.',
    'Road-importance wording uses practical visibility labels, not “major intersection” claims.'
  ],
  base_summary_reference: baseSummary ? {
    previous_total_candidates: baseSummary.total_candidates,
    previous_priority_counts: baseSummary.priority_counts
  } : null
};

fs.mkdirSync(path.dirname(outGeo), { recursive: true });
fs.writeFileSync(outGeo, `${JSON.stringify(outFc, null, 2)}\n`);
fs.writeFileSync(outCsv, `${csvLines.join('\n')}\n`);
fs.writeFileSync(outPya, `${JSON.stringify(summary, null, 2)}\n`);

console.log(JSON.stringify({
  ok: true,
  total_candidates: features.length,
  tier_counts: tierCounts,
  output_geojson: outGeo,
  output_csv: outCsv,
  output_pya: outPya,
  top_3: top25.slice(0, 3).map((x) => ({ rank: x.global_rank, tier: x.daily_tier, score: x.daily_priority_score, node_id: x.node_id, roads: x.connected_way_names }))
}, null, 2));
