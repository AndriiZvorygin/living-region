// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (const item of argv) {
    if (!item.startsWith('--')) continue;
    const [k, v] = item.slice(2).split('=');
    args[k] = v ?? true;
  }
  return args;
}

function collectTopKeys(features, limit = 10) {
  const counts = new Map();
  for (const feature of features) {
    const props = feature?.properties ?? {};
    for (const key of Object.keys(props)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function geometryTypes(features) {
  const types = {};
  for (const feature of features) {
    const type = feature?.geometry?.type ?? 'null';
    types[type] = (types[type] ?? 0) + 1;
  }
  return types;
}

function computeBbox(features) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  function visit(coord) {
    if (!Array.isArray(coord)) return;
    if (coord.length >= 2 && typeof coord[0] === 'number' && typeof coord[1] === 'number') {
      minX = Math.min(minX, coord[0]);
      minY = Math.min(minY, coord[1]);
      maxX = Math.max(maxX, coord[0]);
      maxY = Math.max(maxY, coord[1]);
      return;
    }
    for (const child of coord) visit(child);
  }

  for (const feature of features) visit(feature?.geometry?.coordinates);
  if (!Number.isFinite(minX)) return null;
  return [minX, minY, maxX, maxY];
}

const args = parseArgs(process.argv.slice(2));
const inputDir = path.resolve(args.dir ?? 'know/input/gis');
const outputPath = path.resolve(args.out ?? 'know/produce/grey-gis-summary.json');

if (!fs.existsSync(inputDir)) {
  console.error(`input dir not found: ${inputDir}`);
  process.exit(1);
}

const files = fs.readdirSync(inputDir).filter((f) => f.endsWith('.geojson')).sort();
const summaries = [];

for (const file of files) {
  const fullPath = path.join(inputDir, file);
  const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  const features = Array.isArray(parsed?.features) ? parsed.features : [];
  const summary = {
    file,
    featureCount: features.length,
    geometryTypes: geometryTypes(features),
    topPropertyKeys: collectTopKeys(features),
    bbox: computeBbox(features),
    sampleProperties: features[0]?.properties ?? {}
  };
  summaries.push(summary);

  console.log(`${file}:`);
  console.log(`  features: ${summary.featureCount}`);
  console.log(`  geometryTypes: ${Object.keys(summary.geometryTypes).length > 0 ? JSON.stringify(summary.geometryTypes) : 'none'}`);
  console.log(`  topPropertyKeys: ${summary.topPropertyKeys.map((k) => k.key).join(', ') || 'none'}`);
  console.log(`  bbox: ${summary.bbox ? summary.bbox.join(', ') : 'n/a'}`);
  console.log(`  sampleProperties: ${JSON.stringify(summary.sampleProperties)}`);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify({ generatedAt: new Date().toISOString(), inputDir, files: summaries }, null, 2));
console.log(`written: ${outputPath}`);
