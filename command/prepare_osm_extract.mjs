#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

function parseArgs(argv) {
  const args = {
    input: 'data/osm/ontario-latest.osm.pbf',
    boundary: 'data/boundaries/owen-sound.geojson',
    out: 'data/osm/owen-sound.osm.pbf',
    bbox: ''
  };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--input') args.input = argv[++i] ?? args.input;
    else if (token === '--boundary') args.boundary = argv[++i] ?? args.boundary;
    else if (token === '--out') args.out = argv[++i] ?? args.out;
    else if (token === '--bbox') args.bbox = argv[++i] ?? '';
  }
  return args;
}

function sh(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function run(cmd) {
  return execSync(cmd, { stdio: 'pipe' }).toString('utf8');
}

function ensureOsmium() {
  try {
    run('osmium --version');
  } catch {
    console.error('Missing dependency: osmium is required (install osmium-tool).');
    process.exit(1);
  }
}

function validateBoundary(boundaryPath) {
  const output = run(`node ${sh(path.resolve('command/validate_boundary_geojson.mjs'))} --boundary ${sh(boundaryPath)}`);
  return JSON.parse(output);
}

function fileSizeMb(filePath) {
  return fs.statSync(filePath).size / (1024 * 1024);
}

function highwayWayCount(pbfPath) {
  const out = run(`osmium tags-filter ${sh(pbfPath)} w/highway -f opl`);
  return out.split('\n').filter((line) => line.startsWith('w')).length;
}

const args = parseArgs(process.argv);
const inputPbf = path.resolve(args.input);
const outPbf = path.resolve(args.out);

if (!fs.existsSync(inputPbf)) {
  console.error(`Input PBF missing: ${inputPbf}`);
  process.exit(1);
}

ensureOsmium();
let boundaryValidation = null;
if (!args.bbox) {
  if (!fs.existsSync(path.resolve(args.boundary))) {
    console.error(`Boundary file missing: ${path.resolve(args.boundary)}`);
    process.exit(1);
  }
  boundaryValidation = validateBoundary(path.resolve(args.boundary));
}

fs.mkdirSync(path.dirname(outPbf), { recursive: true });
if (args.bbox) {
  run(`osmium extract -b ${sh(args.bbox)} ${sh(inputPbf)} -o ${sh(outPbf)} --overwrite`);
} else {
  run(`osmium extract -p ${sh(path.resolve(args.boundary))} ${sh(inputPbf)} -o ${sh(outPbf)} --overwrite`);
}

if (!fs.existsSync(outPbf)) {
  console.error(`Clipped output missing: ${outPbf}`);
  process.exit(1);
}

const outSize = fileSizeMb(outPbf);
if (outSize <= 0.01) {
  console.error(`Clipped output appears empty: ${outPbf}`);
  process.exit(1);
}

const highwayWays = highwayWayCount(outPbf);
if (highwayWays === 0) {
  console.error('Clipped output contains no highway ways. Check boundary/bbox.');
  process.exit(1);
}

const infoPath = `${outPbf}.info.txt`;
const info = run(`osmium fileinfo ${sh(outPbf)}`);
fs.writeFileSync(infoPath, info);

const warnings = [];
if (outSize > 200) warnings.push('clipped extract is unexpectedly large; boundary may be too broad');
if (boundaryValidation?.warnings?.length) warnings.push(...boundaryValidation.warnings);

console.log(JSON.stringify({
  ok: true,
  inputPbf,
  outputPbf: outPbf,
  outputInfo: infoPath,
  outputSizeMb: Number(outSize.toFixed(2)),
  highwayWayCount: highwayWays,
  boundary: args.bbox
    ? { mode: 'bbox', bbox: args.bbox }
    : { mode: 'geojson', path: path.resolve(args.boundary), validation: boundaryValidation },
  warnings
}, null, 2));
