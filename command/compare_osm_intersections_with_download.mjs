#!/usr/bin/env node
import path from 'node:path';
import { execSync } from 'node:child_process';

function parseArgs(argv) {
  const args = {
    greyArtifact: '',
    boundary: 'data/boundaries/owen-sound.geojson',
    cacheDir: 'data/osm',
    out: 'artifacts/osm-intersection-comparison.pya',
    region: 'ontario',
    forceDownload: false,
    skipDownload: false
  };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--grey-artifact') args.greyArtifact = argv[++i] ?? '';
    else if (token === '--boundary') args.boundary = argv[++i] ?? args.boundary;
    else if (token === '--cache-dir') args.cacheDir = argv[++i] ?? args.cacheDir;
    else if (token === '--out') args.out = argv[++i] ?? args.out;
    else if (token === '--region') args.region = argv[++i] ?? args.region;
    else if (token === '--force-download') args.forceDownload = true;
    else if (token === '--skip-download') args.skipDownload = true;
  }
  return args;
}

function sh(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function run(cmd) {
  return execSync(cmd, { stdio: 'pipe' }).toString('utf8');
}

const args = parseArgs(process.argv);
const ontarioPbf = path.resolve(args.cacheDir, 'ontario-latest.osm.pbf');
const clippedPbf = path.resolve(args.cacheDir, 'owen-sound.osm.pbf');

const downloadCmd = [
  'node',
  sh(path.resolve('command/download_osm_extract.mjs')),
  '--region', sh(args.region),
  '--cache-dir', sh(args.cacheDir),
  '--out', sh(ontarioPbf),
  args.forceDownload ? '--force-download' : '',
  args.skipDownload ? '--skip-download' : ''
].filter(Boolean).join(' ');
const prepareCmd = [
  'node',
  sh(path.resolve('command/prepare_osm_extract.mjs')),
  '--input', sh(ontarioPbf),
  '--boundary', sh(args.boundary),
  '--out', sh(clippedPbf)
].join(' ');
const compareCmd = [
  'node',
  sh(path.resolve('command/compare_osm_intersections.mjs')),
  args.greyArtifact ? `--grey-artifact ${sh(args.greyArtifact)}` : '',
  '--osm-pbf', sh(clippedPbf),
  '--boundary', sh(args.boundary),
  '--out', sh(args.out)
].filter(Boolean).join(' ');

const download = JSON.parse(run(downloadCmd));
const prepare = JSON.parse(run(prepareCmd));
const compare = JSON.parse(run(compareCmd));

console.log(JSON.stringify({
  ok: true,
  steps: {
    download,
    prepare,
    compare
  }
}, null, 2));
