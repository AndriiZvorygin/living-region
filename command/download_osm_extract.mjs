#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const DEFAULT_SOURCE_URL = 'https://download.geofabrik.de/north-america/canada/ontario-latest.osm.pbf';
const DEFAULT_CHECKSUM_URL = 'https://download.geofabrik.de/north-america/canada/ontario-latest.osm.pbf.md5';

function parseArgs(argv) {
  const args = {
    region: 'ontario',
    cacheDir: 'data/osm',
    out: 'data/osm/ontario-latest.osm.pbf',
    sourceUrl: DEFAULT_SOURCE_URL,
    checksumUrl: DEFAULT_CHECKSUM_URL,
    forceDownload: false,
    skipDownload: false
  };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--region') args.region = argv[++i] ?? args.region;
    else if (token === '--cache-dir') args.cacheDir = argv[++i] ?? args.cacheDir;
    else if (token === '--out') args.out = argv[++i] ?? args.out;
    else if (token === '--source-url') args.sourceUrl = argv[++i] ?? args.sourceUrl;
    else if (token === '--checksum-url') args.checksumUrl = argv[++i] ?? args.checksumUrl;
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

function ensureOsmium() {
  try {
    run('osmium --version');
  } catch {
    console.error('Missing dependency: osmium is required.');
    process.exit(1);
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function md5File(filePath) {
  const hash = crypto.createHash('md5');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function parseMd5File(md5Path) {
  const content = fs.readFileSync(md5Path, 'utf8').trim();
  const match = content.match(/^([a-fA-F0-9]{32})\s+\*?(.+)$/m);
  if (!match) return null;
  return { checksum: match[1].toLowerCase(), fileName: match[2].trim() };
}

function looksLikeHtml(filePath) {
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(512);
  const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
  fs.closeSync(fd);
  const sample = buffer.toString('utf8', 0, bytesRead).toLowerCase();
  return sample.includes('<html') || sample.includes('<!doctype html');
}

const args = parseArgs(process.argv);
const cacheDir = path.resolve(args.cacheDir);
const outPath = path.resolve(args.out);
const md5Path = `${outPath}.md5`;
const metadataPath = path.join(cacheDir, 'ontario-latest.download.pya');

ensureOsmium();
ensureDir(cacheDir);

if (!args.skipDownload) {
  const needPbf = args.forceDownload || !fs.existsSync(outPath);
  const needMd5 = args.forceDownload || !fs.existsSync(md5Path);
  if (needPbf) run(`curl -L -C - --fail --silent --show-error -o ${sh(outPath)} ${sh(args.sourceUrl)}`);
  if (needMd5) run(`curl -L --fail --silent --show-error -o ${sh(md5Path)} ${sh(args.checksumUrl)}`);
} else if (!fs.existsSync(outPath) || !fs.existsSync(md5Path)) {
  console.error('--skip-download was set but cached PBF and/or MD5 file is missing.');
  process.exit(1);
}

if (!fs.existsSync(outPath)) {
  console.error(`Downloaded file missing: ${outPath}`);
  process.exit(1);
}

const sizeBytes = fs.statSync(outPath).size;
if (sizeBytes < 100 * 1024 * 1024) {
  console.error(`Downloaded file is too small (${sizeBytes} bytes); expected Ontario extract (>100MB).`);
  process.exit(1);
}
if (looksLikeHtml(outPath)) {
  console.error('Downloaded file appears to be HTML, not PBF.');
  process.exit(1);
}

const md5Meta = parseMd5File(md5Path);
if (!md5Meta) {
  console.error(`Unable to parse checksum file: ${md5Path}`);
  process.exit(1);
}

const actual = md5File(outPath);
if (actual !== md5Meta.checksum) {
  console.error(`Checksum verification failed: expected ${md5Meta.checksum}, got ${actual}`);
  process.exit(1);
}

let fileInfoStatus = 'ok';
let fileInfoText = '';
try {
  fileInfoText = run(`osmium fileinfo ${sh(outPath)}`);
} catch (error) {
  fileInfoStatus = `failed: ${error.message}`;
}
if (fileInfoStatus !== 'ok') {
  console.error('osmium fileinfo failed for downloaded PBF.');
  process.exit(1);
}

const artifact = {
  source_url: args.sourceUrl,
  checksum_url: args.checksumUrl,
  region: args.region,
  downloaded_at: new Date().toISOString(),
  file_path: outPath,
  file_size_bytes: sizeBytes,
  md5_status: 'ok',
  md5_expected: md5Meta.checksum,
  md5_actual: actual,
  osmium_fileinfo_status: fileInfoStatus
};

fs.writeFileSync(metadataPath, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, ...artifact, metadata_artifact: metadataPath }, null, 2));
