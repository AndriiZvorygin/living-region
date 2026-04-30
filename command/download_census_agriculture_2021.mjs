// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { censusAgriculture2021Manifest } from '../program/data/census_agriculture_manifest.mjs';

const DEFAULT_OUTPUT_DIR = 'know/input/census-agriculture/2021';

function parseArgs(argv) {
  const out = {
    outputDir: DEFAULT_OUTPUT_DIR,
    dryRun: false,
    urls: {},
    allUrls: []
  };
  for (const arg of argv) {
    if (arg === '--dry-run') out.dryRun = true;
    else if (arg.startsWith('--output-dir=')) out.outputDir = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--url=')) out.allUrls.push(arg.split('=').slice(1).join('='));
    else if (arg.startsWith('--operators-work-url=')) out.urls['census-ag-32-10-0382-01'] = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--operators-demographics-url=')) out.urls['census-ag-32-10-0381-01'] = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--hired-labour-url=')) out.urls['census-ag-farm-labour-hired'] = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--community-profile-url=')) out.urls['census-ag-community-profiles-2021'] = arg.split('=').slice(1).join('=');
  }
  return out;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function extFromUrl(url) {
  try {
    const p = new URL(url).pathname.toLowerCase();
    for (const ext of ['.csv', '.zip', '.txt', '.json', '.xlsx', '.xls']) {
      if (p.endsWith(ext)) return ext;
    }
  } catch {
    // ignore
  }
  return '.dat';
}

function filenameForId(id, ext) {
  const base = id.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  return `${base}${ext}`;
}

async function fetchText(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'living-region-census-ag/1.0' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

async function fetchBinary(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'living-region-census-ag/1.0' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

function extractLinksFromHtml(html, pageUrl) {
  const links = [];
  const rx = /href\s*=\s*["']([^"']+)["']/gi;
  let m = rx.exec(html);
  while (m) {
    try {
      const abs = new URL(m[1], pageUrl).toString();
      links.push(abs);
    } catch {
      // ignore
    }
    m = rx.exec(html);
  }
  return [...new Set(links)];
}

function scoreCandidate(id, url) {
  const u = url.toLowerCase();
  let s = 0;
  if (/\.csv($|\?)/.test(u)) s += 6;
  if (/\.zip($|\?)/.test(u)) s += 4;
  if (/download/.test(u)) s += 3;
  if (/3210038201|32-10-0382-01/.test(u) && id === 'census-ag-32-10-0382-01') s += 8;
  if (/3210038101|32-10-0381-01/.test(u) && id === 'census-ag-32-10-0381-01') s += 8;
  if (/guide|metadata|catalogue\/$/.test(u)) s -= 5;
  return s;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const outputDir = path.resolve(args.outputDir);
  ensureDir(outputDir);

  const candidates = [];
  const manifestRows = [];

  for (const entry of censusAgriculture2021Manifest) {
    const row = { id: entry.id, status: 'pending', sourceUrl: entry.sourceUrl };

    const manualUrl = args.urls[entry.id];
    if (manualUrl) row.manualUrl = manualUrl;

    if (args.dryRun) {
      row.status = 'dry-run';
      manifestRows.push(row);
      continue;
    }

    let html = null;
    let links = [];
    try {
      html = await fetchText(entry.sourceUrl);
      fs.writeFileSync(path.join(outputDir, `${entry.id}.source-page.html`), html);
      links = extractLinksFromHtml(html, entry.sourceUrl);
      for (const l of links) candidates.push({ entryId: entry.id, url: l, score: scoreCandidate(entry.id, l) });
    } catch (error) {
      row.pageFetchError = error.message;
    }

    const chosen = manualUrl
      ? { url: manualUrl, source: 'manual' }
      : [...links]
          .map((l) => ({ url: l, score: scoreCandidate(entry.id, l) }))
          .sort((a, b) => b.score - a.score)
          .find((x) => x.score > 2);

    if (!chosen) {
      row.status = 'manual-url-needed';
      row.message = `No direct data file inferred for ${entry.id}. Provide --url or specific --*-url option.`;
      manifestRows.push(row);
      continue;
    }

    row.selectedUrl = chosen.url;
    try {
      const ext = extFromUrl(chosen.url);
      const fileName = filenameForId(entry.id, ext);
      const filePath = path.join(outputDir, fileName);
      const bin = await fetchBinary(chosen.url);
      fs.writeFileSync(filePath, bin);
      row.status = 'downloaded';
      row.outputPath = filePath;
      row.sizeBytes = bin.length;
    } catch (error) {
      row.status = 'failed';
      row.error = error.message;
    }

    manifestRows.push(row);
  }

  for (const url of args.allUrls) {
    try {
      const ext = extFromUrl(url);
      const fileName = `manual-${Buffer.from(url).toString('base64url').slice(0, 12)}${ext}`;
      const filePath = path.join(outputDir, fileName);
      const bin = await fetchBinary(url);
      fs.writeFileSync(filePath, bin);
      manifestRows.push({ id: 'manual-url', status: 'downloaded', selectedUrl: url, outputPath: filePath, sizeBytes: bin.length });
    } catch (error) {
      manifestRows.push({ id: 'manual-url', status: 'failed', selectedUrl: url, error: error.message });
    }
  }

  const manifestPath = path.join(outputDir, 'download-manifest.json');
  const candidatesPath = path.join(outputDir, 'census-ag-link-candidates.json');
  fs.writeFileSync(manifestPath, JSON.stringify({ generatedAt: new Date().toISOString(), outputDir, entries: manifestRows }, null, 2));
  fs.writeFileSync(candidatesPath, JSON.stringify({ generatedAt: new Date().toISOString(), candidates }, null, 2));

  console.log(`census-ag output dir: ${outputDir}`);
  console.log(`downloaded: ${manifestRows.filter((r) => r.status === 'downloaded').length}`);
  console.log(`manual-url-needed: ${manifestRows.filter((r) => r.status === 'manual-url-needed').length}`);
  console.log(`failed: ${manifestRows.filter((r) => r.status === 'failed').length}`);
  console.log(`manifest: ${manifestPath}`);
  console.log(`candidates: ${candidatesPath}`);
  if (manifestRows.some((r) => r.status === 'manual-url-needed')) {
    const manualNotePath = path.resolve('know/produce/grey-census-agriculture-manual-data-needed.md');
    fs.mkdirSync(path.dirname(manualNotePath), { recursive: true });
    fs.writeFileSync(manualNotePath, [
      '# Grey Census Agriculture Manual Data Needed',
      '',
      'Automatic download did not resolve all direct Census of Agriculture data files.',
      'Provide direct CSV/ZIP URLs or place files in `know/input/census-agriculture/2021/`.',
      '',
      'Suggested commands:',
      '```bash',
      'npm run census-ag:download-2021 -- --operators-work-url=\"<direct-csv-url>\"',
      'npm run census-ag:download-2021 -- --operators-demographics-url=\"<direct-csv-url>\"',
      'npm run census-ag:download-2021 -- --hired-labour-url=\"<direct-csv-url>\"',
      'npm run census-ag:import-grey -- --operators-work-table=<path> --operators-age-table=<path> --farms-table=<path> --hired-labour-table=<path>',
      '```',
      '',
      `Candidates file: ${candidatesPath}`
    ].join('\\n'));
    console.log('Some Census of Agriculture files need manual URL input.');
    console.log('Example: npm run census-ag:download-2021 -- --operators-work-url=<direct-csv-url>');
    console.log(`manual note: ${manualNotePath}`);
  }
}

run().catch((error) => {
  console.error(`census-ag download failed: ${error.message}`);
  process.exit(1);
});
