#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const IN = path.resolve('artifacts/corner-lot-flyering-ranked.geojson');
const OUT_GEO = path.resolve('artifacts/corner-lot-flyering-ranked-deduped.geojson');
const OUT_CSV = path.resolve('artifacts/corner-lot-flyering-ranked-deduped.csv');
const OUT_PYA = path.resolve('artifacts/corner-lot-flyering-ranked-deduped.pya');

if (!fs.existsSync(IN)) {
  console.error(`Missing input: ${IN}`);
  process.exit(1);
}

const fc = JSON.parse(fs.readFileSync(IN, 'utf8'));
const features = (fc.features || []).map((f) => ({ ...f, properties: { ...(f.properties || {}) } }));

function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function normalizeRoadName(raw) {
  let s = String(raw || '').toLowerCase().trim().replace(/\s+/g, ' ');
  s = s.replace(/\bhighway\s*6\s*\/\s*10\b/g, 'hwy 6/10');
  s = s.replace(/\bhighway\s*6\b/g, 'hwy 6');
  s = s.replace(/\bhighway\s*10\b/g, 'hwy 10');
  s = s.replace(/\beast\b/g, 'e');
  s = s.replace(/\bwest\b/g, 'w');
  s = s.replace(/\bnorth\b/g, 'n');
  s = s.replace(/\bsouth\b/g, 's');
  s = s.replace(/\bstreet\b/g, 'st');
  s = s.replace(/\bavenue\b/g, 'ave');
  s = s.replace(/\broad\b/g, 'rd');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function titleCase(s) {
  return String(s || '').split(' ').map((w) => w ? w[0].toUpperCase() + w.slice(1) : w).join(' ');
}

function canonicalNames(props) {
  const names = Array.isArray(props.connected_way_names) ? props.connected_way_names : String(props.connected_way_names || '').split('|');
  const norm = [...new Set(names.map(normalizeRoadName).filter(Boolean))].sort();
  return norm;
}

const nodes = features.map((f) => {
  const p = f.properties;
  const lat = Number(p.lat ?? f.geometry?.coordinates?.[1]);
  const lon = Number(p.lon ?? f.geometry?.coordinates?.[0]);
  const namesNorm = canonicalNames(p);
  return {
    feature: f,
    node_id: String(p.node_id || ''),
    lat,
    lon,
    namesNorm,
    key: namesNorm.join(' + '),
    score: Number(p.daily_priority_score || 0),
    vis: Number(p.visibility_score || 0),
    rank: Number(p.global_rank || 999999),
    reason: String(p.priority_reason || ''),
    action: String(p.recommended_action || ''),
    tier: String(p.daily_tier || ''),
    tags: Array.isArray(p.connected_highway_tags) ? p.connected_highway_tags : String(p.connected_highway_tags || '').split('|').map((x)=>x.trim()).filter(Boolean)
  };
}).filter((n) => Number.isFinite(n.lat) && Number.isFinite(n.lon));

const parent = Array.from({ length: nodes.length }, (_, i) => i);
const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra; };

function sharedCount(a, b) {
  const s = new Set(a);
  let c = 0;
  for (const x of b) if (s.has(x)) c += 1;
  return c;
}

for (let i = 0; i < nodes.length; i += 1) {
  for (let j = i + 1; j < nodes.length; j += 1) {
    const ni = nodes[i], nj = nodes[j];
    const d = haversineM(ni.lat, ni.lon, nj.lat, nj.lon);
    const sameKey = ni.key && nj.key && ni.key === nj.key;
    const shared = sharedCount(ni.namesNorm, nj.namesNorm);

    if (sameKey && d <= 40) {
      union(i, j);
      continue;
    }
    if (Math.max(ni.namesNorm.length, nj.namesNorm.length) >= 3 && shared >= 2 && d <= 60) {
      union(i, j);
    }
  }
}

// Secondary same-key cleanup to avoid split duplicates from segmented geometry:
// if identical canonical key nodes are still very near, merge with a looser tolerance.
for (let i = 0; i < nodes.length; i += 1) {
  for (let j = i + 1; j < nodes.length; j += 1) {
    const ni = nodes[i], nj = nodes[j];
    if (!(ni.key && nj.key && ni.key === nj.key)) continue;
    const d = haversineM(ni.lat, ni.lon, nj.lat, nj.lon);
    if (d <= 120) union(i, j);
  }
}

const groups = new Map();
for (let i = 0; i < nodes.length; i += 1) {
  const r = find(i);
  if (!groups.has(r)) groups.set(r, []);
  groups.get(r).push(nodes[i]);
}

const dedup = [];
for (const members of groups.values()) {
  members.sort((a, b) => b.score - a.score || b.vis - a.vis || a.rank - b.rank);
  const rep = members[0];

  const allNames = [...new Set(members.flatMap((m) => m.namesNorm))].sort();
  const allTags = [...new Set(members.flatMap((m) => m.tags))].sort();
  const mergedIds = members.map((m) => m.node_id).filter(Boolean);
  const reasons = [...new Set(members.map((m) => m.reason).filter(Boolean))];

  const repLat = members.reduce((s, m) => s + m.lat, 0) / members.length;
  const repLon = members.reduce((s, m) => s + m.lon, 0) / members.length;

  dedup.push({
    canonical_intersection_key: allNames.join(' + '),
    canonical_intersection_name: allNames.map(titleCase).join(' & '),
    display_intersection_name: (Array.isArray(rep.feature.properties.connected_way_names) ? rep.feature.properties.connected_way_names : String(rep.feature.properties.connected_way_names || '').split('|')).map((x)=>String(x).trim()).filter(Boolean).join(' & ') || allNames.map(titleCase).join(' & '),
    representative_lat: repLat,
    representative_lon: repLon,
    merged_node_ids: mergedIds,
    merged_count: members.length,
    max_visibility_score: Math.max(...members.map((m) => m.vis)),
    max_daily_priority_score: Math.max(...members.map((m) => m.score)),
    combined_priority_reason: reasons.join(' ; '),
    connected_highway_tags: allTags,
    degree_merged: Number(rep.feature.properties.degree_merged || 0),
    intersection_priority: rep.feature.properties.intersection_priority,
    sign_value: rep.feature.properties.sign_value,
    route_bucket: rep.feature.properties.route_bucket,
    recommended_action: rep.feature.properties.recommended_action
  });
}

dedup.sort((a, b) => b.max_daily_priority_score - a.max_daily_priority_score || b.max_visibility_score - a.max_visibility_score || a.canonical_intersection_name.localeCompare(b.canonical_intersection_name));
for (let i = 0; i < dedup.length; i += 1) {
  const rank = i + 1;
  dedup[i].global_rank = rank;
  dedup[i].daily_tier = rank <= 20 ? 'S' : rank <= 70 ? 'A' : rank <= 170 ? 'B' : 'C';
  dedup[i].canvass_order = dedup[i].daily_tier === 'S' ? 1 : dedup[i].daily_tier === 'A' ? 2 : dedup[i].daily_tier === 'B' ? 3 : 4;
  dedup[i].suggested_day = `Day ${Math.ceil(rank / 15)}`;
  dedup[i].daily_priority_score = dedup[i].max_daily_priority_score;
  dedup[i].visibility_score = dedup[i].max_visibility_score;
}

const top50 = dedup.slice(0, 50);
const nameDup = new Set();
let top50NameDupCount = 0;
for (const r of top50) {
  const k = r.display_intersection_name.toLowerCase();
  if (nameDup.has(k)) top50NameDupCount += 1;
  nameDup.add(k);
}
let top50SpatialDupCount = 0;
for (let i = 0; i < top50.length; i += 1) {
  for (let j = i + 1; j < top50.length; j += 1) {
    if (top50[i].canonical_intersection_key !== top50[j].canonical_intersection_key) continue;
    const d = haversineM(top50[i].representative_lat, top50[i].representative_lon, top50[j].representative_lat, top50[j].representative_lon);
    if (d <= 40) top50SpatialDupCount += 1;
  }
}

const tierCounts = dedup.reduce((acc, r) => {
  acc[r.daily_tier] = (acc[r.daily_tier] || 0) + 1;
  return acc;
}, {});

const topMerged = dedup.slice().sort((a, b) => b.merged_count - a.merged_count).slice(0, 25).map((r) => ({
  canonical_intersection_name: r.canonical_intersection_name,
  merged_count: r.merged_count,
  merged_node_ids: r.merged_node_ids,
  representative_lat: r.representative_lat,
  representative_lon: r.representative_lon
}));

const outFeatures = dedup.map((r) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [r.representative_lon, r.representative_lat] },
  properties: {
    node_id: r.merged_node_ids[0] || '',
    lat: r.representative_lat,
    lon: r.representative_lon,
    connected_way_names: r.display_intersection_name,
    connected_highway_tags: r.connected_highway_tags.join(' | '),
    degree_merged: r.degree_merged,
    intersection_priority: r.intersection_priority,
    visibility_score: r.visibility_score,
    sign_value: r.sign_value,
    canvass_order: r.canvass_order,
    recommended_action: r.recommended_action,
    global_rank: r.global_rank,
    daily_tier: r.daily_tier,
    daily_priority_score: r.daily_priority_score,
    priority_reason: r.combined_priority_reason,
    route_bucket: r.route_bucket,
    suggested_day: r.suggested_day,
    canonical_intersection_key: r.canonical_intersection_key,
    canonical_intersection_name: r.canonical_intersection_name,
    display_intersection_name: r.display_intersection_name,
    merged_node_ids: r.merged_node_ids.join(' | '),
    merged_count: r.merged_count
  }
}));

const headers = [
  'global_rank','daily_tier','daily_priority_score','canonical_intersection_name','display_intersection_name','canonical_intersection_key',
  'representative_lat','representative_lon','connected_highway_tags','degree_merged','intersection_priority','visibility_score','sign_value','route_bucket',
  'recommended_action','priority_reason','suggested_day','merged_count','merged_node_ids'
];

function csvEscape(v){const s=String(v??''); if(/[",\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`; return s;}
const csvLines=[headers.join(',')];
for(const r of dedup){
  const row={
    global_rank:r.global_rank,
    daily_tier:r.daily_tier,
    daily_priority_score:r.daily_priority_score,
    canonical_intersection_name:r.canonical_intersection_name,
    display_intersection_name:r.display_intersection_name,
    canonical_intersection_key:r.canonical_intersection_key,
    representative_lat:r.representative_lat,
    representative_lon:r.representative_lon,
    connected_highway_tags:r.connected_highway_tags.join(' | '),
    degree_merged:r.degree_merged,
    intersection_priority:r.intersection_priority,
    visibility_score:r.visibility_score,
    sign_value:r.sign_value,
    route_bucket:r.route_bucket,
    recommended_action:r.recommended_action,
    priority_reason:r.combined_priority_reason,
    suggested_day:r.suggested_day,
    merged_count:r.merged_count,
    merged_node_ids:r.merged_node_ids.join(' | ')
  };
  csvLines.push(headers.map(h=>csvEscape(row[h])).join(','));
}

const summary={
  generated_at:new Date().toISOString(),
  input:IN,
  output_geojson:OUT_GEO,
  output_csv:OUT_CSV,
  raw_candidates:nodes.length,
  deduped_physical_intersections:dedup.length,
  merged_duplicate_count:nodes.length-dedup.length,
  tier_counts:tierCounts,
  validation:{
    top50_duplicate_display_intersection_name_count:top50NameDupCount,
    top50_same_key_within_40m_count:top50SpatialDupCount
  },
  top_merged_intersections_by_merged_count:topMerged
};

fs.writeFileSync(OUT_GEO, JSON.stringify({type:'FeatureCollection',features:outFeatures},null,2)+'\n');
fs.writeFileSync(OUT_CSV, csvLines.join('\n')+'\n');
fs.writeFileSync(OUT_PYA, JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
