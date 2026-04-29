// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canadaCensus2021Manifest } from '../program/data/canada_census_manifest.mjs';

const ALLOWED_EXTENSIONS = ['.zip', '.csv', '.txt', '.shp', '.gpkg', '.geojson', '.json', '.gdb'];
const OPEN_CANADA_CKAN_PACKAGE_SHOW = 'https://open.canada.ca/data/api/action/package_show?id=1b3653d7-a48e-4001-8046-e6964bebe286';

function parseArgs(argv) {
  const out = {
    outputDir: 'know/input/census/2021',
    dryRun: false,
    gafUrl: null,
    dbBoundaryUrl: null,
    daBoundaryUrl: null,
    relationshipUrl: null,
    ckanUrl: OPEN_CANADA_CKAN_PACKAGE_SHOW
  };
  for (const arg of argv) {
    if (arg === '--dry-run') out.dryRun = true;
    else if (arg.startsWith('--output-dir=')) out.outputDir = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--gaf-url=')) out.gafUrl = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--db-boundary-url=')) out.dbBoundaryUrl = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--da-boundary-url=')) out.daBoundaryUrl = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--relationship-url=')) out.relationshipUrl = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--ckan-url=')) out.ckanUrl = arg.split('=').slice(1).join('=');
  }
  return out;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'living-region-census-downloader/1.0' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'living-region-census-downloader/1.0' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function fetchBinary(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'living-region-census-downloader/1.0' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function extensionFromUrl(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    for (const ext of ALLOWED_EXTENSIONS) if (pathname.endsWith(ext)) return ext;
  } catch {
    // noop
  }
  return '';
}

function filenameForEntry(id, ext) {
  if (id === 'census-2021-geographic-attribute-file') return `geographic-attribute-file${ext || '.csv'}`;
  if (id === 'census-2021-dissemination-geographies-relationship-file') return `dissemination-geographies-relationship-file${ext || '.csv'}`;
  if (id === 'census-2021-dissemination-block-boundaries') return `dissemination-block-boundaries${ext || '.zip'}`;
  if (id === 'census-2021-dissemination-area-boundaries') return `dissemination-area-boundaries${ext || '.zip'}`;
  return `${id}${ext || '.dat'}`;
}

export function extractDownloadLinksFromHtml(html, pageUrl) {
  const links = [];
  const rx = /href\s*=\s*["']([^"']+)["']/gi;
  let match = rx.exec(html);
  while (match) {
    const href = match[1];
    try {
      const abs = new URL(href, pageUrl).toString();
      const ext = extensionFromUrl(abs);
      if (ext) links.push({ url: abs, extension: ext, source: pageUrl });
      else if (/catalogue|dataset|record|resource|download|open\.canada|statcan/i.test(abs)) {
        links.push({ url: abs, extension: '', source: pageUrl, isCandidatePage: true });
      }
    } catch {
      // ignore
    }
    match = rx.exec(html);
  }
  return links;
}

export function extractCkanResourceLinks(payload) {
  const resources = payload?.result?.resources;
  if (!Array.isArray(resources)) return [];
  const out = [];
  for (const r of resources) {
    const url = r?.url;
    if (!url) continue;
    const extension = extensionFromUrl(url);
    const name = `${r?.name ?? ''} ${r?.description ?? ''}`.toLowerCase();
    out.push({
      url,
      extension,
      source: 'open-canada-ckan',
      resourceName: r?.name ?? '',
      scoreHint: /92-151|gaf|attribute|attribs/.test(name + url.toLowerCase()) ? 5 : 0
    });
  }
  return out;
}

function dedupeLinks(links) {
  const map = new Map();
  for (const l of links) {
    if (!l?.url) continue;
    if (!map.has(l.url)) map.set(l.url, l);
  }
  return [...map.values()];
}

function scoreLinkForEntry(entry, link) {
  const url = link.url.toLowerCase();
  let s = 0;
  if (link.scoreHint) s += link.scoreHint;
  if (entry.id.includes('geographic-attribute') && /92-151|gaf|attribute|attribs/.test(url)) s += 8;
  if (entry.id.includes('relationship') && /relationship|98-26-0004|98260004/.test(url)) s += 8;
  if (entry.id.includes('dissemination-block') && /92-163|dissemination.*block|\bdb\b/.test(url)) s += 8;
  if (entry.id.includes('dissemination-area') && /dissemination.*area|\bda\b/.test(url)) s += 8;
  if (url.endsWith('.csv') || url.endsWith('.txt')) s += 3;
  if (url.endsWith('.zip')) s += 2;
  if (/guide|reference|catalogue\/[^/]+$/.test(url)) s -= 6;
  if (link.isCandidatePage) s -= 3;
  return s;
}

function pickBestLink(entry, links) {
  const withScores = links
    .map((l) => ({ ...l, score: scoreLinkForEntry(entry, l) }))
    .sort((a, b) => b.score - a.score);
  return withScores[0] ?? null;
}

function overrideUrlForEntry(entryId, args) {
  if (entryId === 'census-2021-geographic-attribute-file') return args.gafUrl;
  if (entryId === 'census-2021-dissemination-block-boundaries') return args.dbBoundaryUrl;
  if (entryId === 'census-2021-dissemination-area-boundaries') return args.daBoundaryUrl;
  if (entryId === 'census-2021-dissemination-geographies-relationship-file') return args.relationshipUrl;
  return null;
}

async function gatherLinksForEntry(entry, outputDir, candidates) {
  const pageUrls = [entry.sourceUrl, ...(entry.alternateSourceUrls ?? [])];
  let links = [];
  const pageFetchErrors = [];
  for (const pageUrl of pageUrls) {
    try {
      const html = await fetchText(pageUrl);
      const pageSnapshotPath = path.join(outputDir, `${entry.id}.${Buffer.from(pageUrl).toString('base64url').slice(0, 16)}.source-page.html`);
      fs.writeFileSync(pageSnapshotPath, html);
      const extracted = extractDownloadLinksFromHtml(html, pageUrl);
      links = links.concat(extracted);
      for (const l of extracted) {
        candidates.push({ entryId: entry.id, from: pageUrl, url: l.url, extension: l.extension || null, type: l.extension ? 'direct-file' : 'candidate-page' });
      }
    } catch (error) {
      pageFetchErrors.push(`${pageUrl}: ${error.message}`);
    }
  }
  return { links: dedupeLinks(links), pageFetchErrors };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const outputDir = path.resolve(args.outputDir);
  ensureDir(outputDir);

  const summary = { generatedAt: new Date().toISOString(), outputDir, dryRun: args.dryRun, files: [] };
  const linkCandidates = [];

  let ckanLinks = [];
  let ckanError = null;
  if (!args.dryRun) {
    try {
      const ckanPayload = await fetchJson(args.ckanUrl);
      ckanLinks = extractCkanResourceLinks(ckanPayload);
      fs.writeFileSync(path.join(outputDir, 'open-canada-package-show.json'), JSON.stringify(ckanPayload, null, 2));
      for (const l of ckanLinks) {
        linkCandidates.push({ entryId: 'all', from: 'open-canada-ckan', url: l.url, extension: l.extension || null, type: l.extension ? 'direct-file' : 'candidate-page' });
      }
    } catch (error) {
      ckanError = error.message;
    }
  }

  for (const entry of canadaCensus2021Manifest) {
    const row = { id: entry.id, sourceUrl: entry.sourceUrl, status: 'pending', notes: entry.notes };
    const overrideUrl = overrideUrlForEntry(entry.id, args);
    if (overrideUrl) row.overrideUrl = overrideUrl;
    if (args.dryRun) {
      row.status = 'dry-run';
      summary.files.push(row);
      continue;
    }

    const { links: pageLinks, pageFetchErrors } = await gatherLinksForEntry(entry, outputDir, linkCandidates);
    row.pageFetchErrors = pageFetchErrors;
    row.pageLinkCount = pageLinks.length;
    let links = [...pageLinks, ...ckanLinks];
    links = dedupeLinks(links);
    row.linkCountIncludingCkan = links.length;

    const chosen = overrideUrl
      ? { url: overrideUrl, extension: extensionFromUrl(overrideUrl), score: 999, source: 'override' }
      : pickBestLink(entry, links);

    row.sampleLinks = links.slice(0, 20).map((l) => l.url);

    if (!chosen) {
      row.status = 'no-download-link-found';
      row.message = 'Could not infer a direct data file link. Provide explicit URL with --*-url options.';
      summary.files.push(row);
      continue;
    }

    row.selectedUrl = chosen.url;
    row.selectionScore = chosen.score ?? null;
    row.selectionSource = chosen.source ?? chosen.from ?? 'parsed';

    const ext = chosen.extension || extensionFromUrl(chosen.url);
    if (!ext) {
      row.status = 'selected-link-has-unknown-extension';
      row.message = 'Selected link has no recognized extension. Provide explicit URL.';
      summary.files.push(row);
      continue;
    }

    try {
      const outName = filenameForEntry(entry.id, ext);
      const outPath = path.join(outputDir, outName);
      const content = await fetchBinary(chosen.url);
      fs.writeFileSync(outPath, content);
      row.status = 'downloaded';
      row.outputPath = outPath;
      row.sizeBytes = content.length;
    } catch (error) {
      row.status = 'failed';
      row.error = error.message;
    }
    summary.files.push(row);
  }

  const manifestPath = path.join(outputDir, 'download-manifest.json');
  const candidatesPath = path.join(outputDir, 'census-link-candidates.json');
  fs.writeFileSync(manifestPath, JSON.stringify({ ...summary, ckanError }, null, 2));
  fs.writeFileSync(candidatesPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    ckanUrl: args.ckanUrl,
    ckanError,
    candidates: dedupeLinks(linkCandidates.map((c) => ({ ...c, key: `${c.entryId}|${c.url}` }))).map((c) => {
      const { key, ...rest } = c;
      return rest;
    })
  }, null, 2));

  console.log(`census output dir: ${outputDir}`);
  console.log(`entries: ${summary.files.length}`);
  console.log(`downloaded: ${summary.files.filter((f) => f.status === 'downloaded').length}`);
  console.log(`failed: ${summary.files.filter((f) => f.status === 'failed').length}`);
  console.log(`manifest: ${manifestPath}`);
  console.log(`candidates: ${candidatesPath}`);

  const downloadedGaf = summary.files.find((f) => f.id === 'census-2021-geographic-attribute-file' && f.status === 'downloaded');
  if (!downloadedGaf) {
    console.log('No raw GAF ZIP/CSV was found automatically. Please open census-link-candidates.json or provide:');
    console.log('npm run census:download-2021 -- --gaf-url=<direct zip/csv/txt URL>');
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  run().catch((error) => {
    console.error(`census download failed: ${error.message}`);
    process.exit(1);
  });
}
