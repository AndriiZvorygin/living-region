// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';

const inputPath = fs.existsSync(path.resolve('know/input/gis/road-centrelines-grey.geojson'))
  ? path.resolve('know/input/gis/road-centrelines-grey.geojson')
  : path.resolve('know/input/gis/road-centrelines-orn.geojson');

if (!fs.existsSync(inputPath)) {
  console.error('No road-centrelines-grey.geojson or road-centrelines-orn.geojson found.');
  process.exit(1);
}

const parsed = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const features = Array.isArray(parsed?.features) ? parsed.features : [];

const roads = features.map((feature, index) => {
  const p = feature.properties ?? {};
  return {
    id: `road-${index + 1}`,
    roadName: p.ROAD_NAME ?? p.ROADNAME ?? p.NAME ?? null,
    roadClass: p.ROAD_CLASS ?? p.CLASS ?? p.FUNCTIONAL_CLASS ?? p.TYPE ?? null,
    jurisdiction: p.JURISDICTION ?? p.OWNER ?? p.MUNICIPAL ?? p.COUNTY ?? null,
    surface: p.SURFACE ?? p.PAVEMENT ?? null,
    speedLimit: Number(p.SPEED_LIMIT ?? p.SPEED ?? p.POSTED_SPEED ?? 0) || null,
    lengthKmSource: Number(p.LENGTH_KM ?? p.LENGTH ?? p.Shape_STLength__ ?? 0) || null,
    roadSource: 'grey-open-data',
    geometry: feature.geometry ?? null,
    sourceProperties: p
  };
});

const outPath = path.resolve('know/produce/grey-open-data-roads.json');
fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), source: inputPath, roads }, null, 2));

const worldPath = path.resolve('know/produce/grey-open-data-world.json');
if (fs.existsSync(worldPath)) {
  const world = JSON.parse(fs.readFileSync(worldPath, 'utf8'));
  world.roadCentrelines = roads;
  fs.writeFileSync(worldPath, JSON.stringify(world, null, 2));
}

console.log(`source: ${inputPath}`);
console.log(`road features imported: ${roads.length}`);
console.log(`output: ${outPath}`);
