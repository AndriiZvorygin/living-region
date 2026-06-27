#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const inputPath = path.resolve('artifacts/osm-intersection-debug.geojson');
const outGeo = path.resolve('artifacts/corner-lot-flyering-priority.geojson');
const outPya = path.resolve('artifacts/corner-lot-flyering-priority.pya');

if (!fs.existsSync(inputPath)) {
  console.error(`Missing input: ${inputPath}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const features = (data.features || []).filter((f) => f?.properties?.status === 'retained_municipal_through_street');

const classWeight = {
  trunk: 6,
  primary: 5,
  secondary: 4,
  tertiary: 3,
  residential: 2,
  unclassified: 2,
  living_street: 1,
  road: 1
};

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.map((t) => String(t).toLowerCase().trim()).filter(Boolean);
}

function computeVisibilityScore(props) {
  const tags = normalizeTags(props.connected_highway_tags);
  const names = Array.isArray(props.connected_way_names)
    ? props.connected_way_names.filter((n) => String(n).trim())
    : [];
  const degree = Number(props.degree_merged ?? props.degree_raw ?? 0);

  const weights = tags.map((t) => classWeight[t] ?? 0);
  const maxClass = weights.length ? Math.max(...weights) : 0;
  const hasMajor = tags.some((t) => ['primary', 'secondary', 'tertiary', 'trunk'].includes(t));

  let score = 0;
  score += maxClass * 12;
  score += Math.min(4, degree) * 10;
  score += Math.min(4, names.length) * 6;
  if (hasMajor) score += 12;

  // Slight bump for multi-class connectivity (often better movement exposure)
  score += Math.min(4, new Set(tags).size) * 3;

  // Clamp 0-100
  return Math.max(0, Math.min(100, Math.round(score)));
}

function classify(score) {
  if (score >= 88) return 'A';
  if (score >= 78) return 'B';
  if (score >= 66) return 'C';
  if (score >= 54) return 'D';
  if (score >= 42) return 'E';
  return 'F';
}

function signValue(score) {
  if (score >= 78) return 'high';
  if (score >= 54) return 'medium';
  return 'low';
}

function canvassOrder(tags, priority) {
  const t = new Set(normalizeTags(tags));
  const major = ['trunk', 'primary', 'secondary'];
  const collector = ['tertiary', 'unclassified'];

  if ([...t].some((x) => major.includes(x))) return 1;
  if ([...t].some((x) => collector.includes(x))) return 2;
  if (['A', 'B'].includes(priority)) return 2;
  return 3;
}

function action(priority, value, order) {
  if (priority === 'A' || (priority === 'B' && value === 'high')) return 'door-knock early; possible sign ask later';
  if (order <= 2 && (priority === 'B' || priority === 'C' || priority === 'D')) return 'flyer only';
  if (priority === 'E') return 'low priority';
  return 'skip unless nearby';
}

const caveats = [
  'Do not place signs without property-owner permission.',
  'Avoid sightline obstruction.',
  'Respect election-sign bylaw setbacks and safety rules.',
  'Corner-lot estimate is for planning only, not a precise household count.'
];

const scored = features.map((f, idx) => {
  const p = f.properties || {};
  const score = computeVisibilityScore(p);
  const priority = classify(score);
  const value = signValue(score);
  const order = canvassOrder(p.connected_highway_tags, priority);
  const rec = action(priority, value, order);

  return {
    type: 'Feature',
    geometry: f.geometry,
    properties: {
      node_id: p.osm_node_id ?? `node_${idx + 1}`,
      lat: f.geometry?.coordinates?.[1] ?? null,
      lon: f.geometry?.coordinates?.[0] ?? null,
      connected_way_names: p.connected_way_names ?? [],
      connected_highway_tags: p.connected_highway_tags ?? [],
      degree_merged: Number(p.degree_merged ?? p.degree_raw ?? 0),
      intersection_priority: priority,
      visibility_score: score,
      sign_value: value,
      canvass_order: order,
      recommended_action: rec,
      caveats
    }
  };
});

// Deterministic sort for canvassing
scored.sort((a, b) => {
  const pa = a.properties;
  const pb = b.properties;
  if (pa.canvass_order !== pb.canvass_order) return pa.canvass_order - pb.canvass_order;
  if (pa.visibility_score !== pb.visibility_score) return pb.visibility_score - pa.visibility_score;
  return String(pa.node_id).localeCompare(String(pb.node_id));
});

const byPriority = scored.reduce((acc, f) => {
  const k = f.properties.intersection_priority;
  acc[k] = (acc[k] || 0) + 1;
  return acc;
}, {});

const byAction = scored.reduce((acc, f) => {
  const k = f.properties.recommended_action;
  acc[k] = (acc[k] || 0) + 1;
  return acc;
}, {});

const outFeatureCollection = { type: 'FeatureCollection', features: scored };
const summary = {
  generated_at: new Date().toISOString(),
  source: inputPath,
  output_geojson: outGeo,
  total_candidates: scored.length,
  priority_counts: byPriority,
  action_counts: byAction,
  caveats,
  top10: scored.slice(0, 10).map((f) => f.properties)
};

fs.mkdirSync(path.dirname(outGeo), { recursive: true });
fs.writeFileSync(outGeo, `${JSON.stringify(outFeatureCollection, null, 2)}\n`);
fs.writeFileSync(outPya, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
