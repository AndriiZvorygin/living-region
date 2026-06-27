#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = { boundary: '' };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--boundary') args.boundary = argv[++i] ?? '';
  }
  return args;
}

function fail(message, code = 1) {
  console.error(`Boundary validation failed: ${message}`);
  process.exit(code);
}

function geometryFromGeoJson(json) {
  if (!json || typeof json !== 'object') return null;
  if (json.type === 'Polygon' || json.type === 'MultiPolygon') return json;
  if (json.type === 'Feature' && json.geometry) return geometryFromGeoJson(json.geometry);
  if (json.type === 'FeatureCollection' && Array.isArray(json.features)) {
    for (const feature of json.features) {
      const geom = geometryFromGeoJson(feature);
      if (geom) return geom;
    }
  }
  return null;
}

function walkCoords(coords, sink) {
  if (!Array.isArray(coords)) return;
  if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    sink(coords[0], coords[1]);
    return;
  }
  for (const c of coords) walkCoords(c, sink);
}

function bboxForGeometry(geometry) {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  walkCoords(geometry.coordinates, (lon, lat) => {
    if (lon < minLon) minLon = lon;
    if (lat < minLat) minLat = lat;
    if (lon > maxLon) maxLon = lon;
    if (lat > maxLat) maxLat = lat;
  });
  return { minLon, minLat, maxLon, maxLat };
}

function looksLikeGreyArea(bbox) {
  const roughGrey = {
    minLon: -81.7,
    maxLon: -80.3,
    minLat: 44.0,
    maxLat: 45.1
  };
  return !(
    bbox.maxLon < roughGrey.minLon ||
    bbox.minLon > roughGrey.maxLon ||
    bbox.maxLat < roughGrey.minLat ||
    bbox.minLat > roughGrey.maxLat
  );
}

const args = parseArgs(process.argv);
if (!args.boundary) fail('missing --boundary <path>');

const boundaryPath = path.resolve(args.boundary);
if (!fs.existsSync(boundaryPath)) fail(`boundary file not found: ${boundaryPath}`);

let json;
try {
  json = JSON.parse(fs.readFileSync(boundaryPath, 'utf8'));
} catch (error) {
  fail(`invalid JSON: ${error.message}`);
}

const geometry = geometryFromGeoJson(json);
if (!geometry) {
  fail('no Polygon/MultiPolygon geometry found (boundary must be polygon geometry, not points/lines)');
}
if (!(geometry.type === 'Polygon' || geometry.type === 'MultiPolygon')) {
  fail(`unsupported geometry type: ${geometry.type}`);
}

const bbox = bboxForGeometry(geometry);
if (!Number.isFinite(bbox.minLon) || !Number.isFinite(bbox.minLat) || !Number.isFinite(bbox.maxLon) || !Number.isFinite(bbox.maxLat)) {
  fail('failed to compute boundary coordinate bounds');
}
if (bbox.minLon < -180 || bbox.maxLon > 180 || bbox.minLat < -90 || bbox.maxLat > 90) {
  fail('coordinates out of lon/lat range; expected EPSG:4326-style GeoJSON');
}

const width = bbox.maxLon - bbox.minLon;
const height = bbox.maxLat - bbox.minLat;
if (width <= 0 || height <= 0) fail('invalid zero-area boundary bbox');

const warnings = [];
if (!looksLikeGreyArea(bbox)) warnings.push('bbox does not overlap rough Grey/Owen Sound area bounds');
if (width > 2 || height > 2) warnings.push('boundary is large; verify this is intended and not province-wide geometry');

const result = {
  ok: true,
  boundaryPath,
  geometryType: geometry.type,
  bbox,
  warnings
};

console.log(JSON.stringify(result, null, 2));
