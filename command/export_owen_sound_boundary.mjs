#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const source = path.resolve('know/input/gis/municipality-boundaries.geojson');
const out = path.resolve('data/boundaries/owen-sound.geojson');

if (!fs.existsSync(source)) {
  console.error(`Missing source boundary file: ${source}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(source, 'utf8'));
const feature = (data.features || []).find((f) =>
  String(f.properties?.MUNICIPAL || '').toLowerCase().includes('owen sound')
);
if (!feature) {
  console.error('Could not find "City of Owen Sound" in municipal boundaries file.');
  process.exit(1);
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ type: 'FeatureCollection', features: [feature] }, null, 2) + '\n');
console.log(JSON.stringify({ ok: true, source, out, municipal: feature.properties?.MUNICIPAL || null }, null, 2));
