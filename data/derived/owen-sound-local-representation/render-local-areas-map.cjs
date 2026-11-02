#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = __dirname;
const localAreas = JSON.parse(fs.readFileSync(path.join(root, '2026-unit-local-areas.geojson'), 'utf8'));
const wards = JSON.parse(fs.readFileSync(path.join(root, '2026-resident-ward-boundaries.geojson'), 'utf8'));

const width = 1400;
const height = 980;
const mapBox = { left: 70, top: 105, right: 1050, bottom: 875 };
const colors = {
  NW: '#2f6f9f',
  NE: '#2f8f83',
  W: '#6b6bb3',
  C: '#bf7b2e',
  E: '#b85b75',
  SW: '#6d8f3c',
  SE: '#8b5aa8',
};

function ringCoordinates(feature) {
  return feature.geometry.coordinates[0];
}

const allCoordinates = localAreas.features.flatMap(ringCoordinates);
const minLon = Math.min(...allCoordinates.map((p) => p[0]));
const maxLon = Math.max(...allCoordinates.map((p) => p[0]));
const minLat = Math.min(...allCoordinates.map((p) => p[1]));
const maxLat = Math.max(...allCoordinates.map((p) => p[1]));
const cosLat = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
const pad = 0.003;
const xSpan = (maxLon - minLon + pad * 2) * cosLat;
const ySpan = maxLat - minLat + pad * 2;
const scale = Math.min((mapBox.right - mapBox.left) / xSpan, (mapBox.bottom - mapBox.top) / ySpan);
const usedWidth = xSpan * scale;
const usedHeight = ySpan * scale;
const offsetX = mapBox.left + ((mapBox.right - mapBox.left) - usedWidth) / 2;
const offsetY = mapBox.top + ((mapBox.bottom - mapBox.top) - usedHeight) / 2;

function project([lon, lat]) {
  return [
    offsetX + (lon - (minLon - pad)) * cosLat * scale,
    offsetY + (maxLat + pad - lat) * scale,
  ];
}

function fmt(value) {
  return Number(value).toFixed(1);
}

function pathForFeature(feature) {
  return feature.geometry.coordinates.map((ring) => ring.map((point, index) => {
    const [x, y] = project(point);
    return `${index === 0 ? 'M' : 'L'} ${fmt(x)} ${fmt(y)}`;
  }).join(' ') + ' Z').join(' ');
}

function centroid(feature) {
  const ring = ringCoordinates(feature);
  const sum = ring.reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0]);
  return project([sum[0] / ring.length, sum[1] / ring.length]);
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

const localPaths = localAreas.features.map((feature) => {
  const p = feature.properties;
  const [cx, cy] = centroid(feature);
  const color = colors[p.ward_id] || '#777';
  const title = `${p.local_area_id}: ${p.ward_name}; ${p.residential_units} residential units; ${p.matched_resident_electors} matched resident electors`;
  return `
    <g class="local-area" tabindex="0">
      <title>${escapeXml(title)}</title>
      <path d="${pathForFeature(feature)}" fill="${color}" fill-opacity="0.48" stroke="#ffffff" stroke-width="1.2" vector-effect="non-scaling-stroke"/>
      <text x="${fmt(cx)}" y="${fmt(cy + 4)}" text-anchor="middle" class="local-label">${escapeXml(String(p.local_area_number).padStart(2, '0'))}</text>
    </g>`;
}).join('\n');

const wardPaths = wards.features.map((feature) => {
  const p = feature.properties;
  return `<path d="${pathForFeature(feature)}" fill="none" stroke="${colors[p.ward_id] || '#333'}" stroke-width="3.2" stroke-opacity="0.95" vector-effect="non-scaling-stroke"/>`;
}).join('\n');

const wardLabels = wards.features.map((feature) => {
  const p = feature.properties;
  const [cx, cy] = centroid(feature);
  return `
    <g class="ward-label">
      <rect x="${fmt(cx - 49)}" y="${fmt(cy - 22)}" width="98" height="35" rx="7" fill="#ffffff" fill-opacity="0.90" stroke="${colors[p.ward_id] || '#333'}" stroke-width="2"/>
      <text x="${fmt(cx)}" y="${fmt(cy + 1)}" text-anchor="middle" class="ward-code">${escapeXml(p.ward_id)}</text>
      <text x="${fmt(cx)}" y="${fmt(cy + 12)}" text-anchor="middle" class="ward-total">${Number(p.resident_electors).toLocaleString()} electors</text>
    </g>`;
}).join('\n');

const legend = Object.entries(colors).map(([wardId, color]) => {
  const ward = wards.features.find((feature) => feature.properties.ward_id === wardId);
  const wardName = ward ? ward.properties.ward_name : wardId;
  const y = 190 + Object.keys(colors).indexOf(wardId) * 58;
  return `
    <rect x="1120" y="${y}" width="24" height="24" rx="3" fill="${color}" fill-opacity="0.62" stroke="${color}" stroke-width="2"/>
    <text x="1160" y="${y + 17}" class="legend-text"><tspan font-weight="700">${wardId}</tspan><tspan x="1190">${escapeXml(wardName)}</tspan></text>`;
}).join('\n');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">
  <title id="title">Owen Sound preliminary unit-level local area layout</title>
  <desc id="description">Seventy aggregate local areas grouped into seven proposed resident-elector-balanced wards. Numbers identify local areas within each ward.</desc>
  <style>
    .title { font: 700 31px Arial, sans-serif; fill: #1f2933; }
    .subtitle { font: 16px Arial, sans-serif; fill: #52606d; }
    .local-label { font: 700 10px Arial, sans-serif; fill: #1f2933; pointer-events: none; }
    .ward-code { font: 700 19px Arial, sans-serif; fill: #1f2933; }
    .ward-total { font: 10px Arial, sans-serif; fill: #52606d; }
    .legend-title { font: 700 18px Arial, sans-serif; fill: #1f2933; }
    .legend-text { font: 15px Arial, sans-serif; fill: #1f2933; }
    .note { font: 13px Arial, sans-serif; fill: #52606d; }
    .local-area:focus path, .local-area:hover path { fill-opacity: 0.82; stroke: #111827; stroke-width: 2.2; }
  </style>
  <rect width="${width}" height="${height}" fill="#f7f9fb"/>
  <text x="70" y="48" class="title">Owen Sound preliminary local-area layout</text>
  <text x="70" y="76" class="subtitle">70 aggregate areas based on residential address-unit counts; labels are local-area numbers within each ward</text>
  <rect x="${mapBox.left - 10}" y="${mapBox.top - 10}" width="${mapBox.right - mapBox.left + 20}" height="${mapBox.bottom - mapBox.top + 20}" rx="4" fill="#ffffff" stroke="#9aa5b1" stroke-width="1.5"/>
  ${localPaths}
  <g aria-label="Proposed ward boundaries">${wardPaths}</g>
  ${wardLabels}
  <g aria-label="Legend">
    <text x="1120" y="145" class="legend-title">Proposed wards</text>
    ${legend}
    <line x1="1120" y1="630" x2="1144" y2="630" stroke="#ffffff" stroke-width="4"/>
    <text x="1160" y="635" class="legend-text">Local-area edge</text>
    <line x1="1120" y1="670" x2="1144" y2="670" stroke="#333" stroke-width="3"/>
    <text x="1160" y="675" class="legend-text">Ward edge</text>
  </g>
  <g aria-label="Map notes">
    <text x="1120" y="760" class="note">Unit target: approximately 150</text>
    <text x="1120" y="783" class="note">Total residential units: 10,893</text>
    <text x="1120" y="806" class="note">Source layer is aggregate-only.</text>
    <text x="1120" y="829" class="note">Preliminary planning geometry.</text>
  </g>
  <text x="70" y="925" class="note">Prepared 2026-10-20. Residential address units are used as a household proxy; validate against authoritative street, poll, and municipal data before adoption.</text>
</svg>`;

const svgPath = path.join(root, '2026-unit-local-areas-map.svg');
fs.writeFileSync(svgPath, `<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n`.replace(/[ \t]+$/gm, ''));

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Owen Sound preliminary local-area layout</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; background: #f7f9fb; color: #1f2933; font: 16px system-ui, sans-serif; }
    main { max-width: 1400px; margin: 0 auto; padding: 18px; }
    .map { background: white; border: 1px solid #cbd2d9; box-shadow: 0 2px 10px rgb(31 41 51 / 8%); overflow-x: auto; }
    svg { display: block; min-width: 1000px; width: 100%; height: auto; }
    p { color: #52606d; }
  </style>
</head>
<body>
  <main>
    <p>This is an aggregate planning map. It contains proposed boundaries and counts only; no voter names, identifiers, or addresses are included.</p>
    <div class="map">${svg}</div>
  </main>
</body>
</html>
`;
fs.writeFileSync(path.join(root, '2026-unit-local-areas-map.html'), html.replace(/[ \t]+$/gm, ''));
console.log(`Wrote ${svgPath}`);
console.log(`Wrote ${path.join(root, '2026-unit-local-areas-map.html')}`);
