// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { censusPopulationLabour2021Manifest } from '../program/data/census_population_labour_manifest.mjs';

function parseArgs(argv) {
  const out = { outputDir: 'know/input/census-population-labour/2021', dryRun: false, urls: {}, allUrls: [] };
  for (const arg of argv) {
    if (arg === '--dry-run') out.dryRun = true;
    else if (arg.startsWith('--output-dir=')) out.outputDir = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--occupation-url=')) out.urls.occupationUnitGroup9810044901 = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--industry-url=')) out.urls.industryOccupation9810045601 = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--work-activity-url=')) out.urls.occupationWorkActivity9810047101 = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--occupation-minor-industry-url=')) out.urls.occupationMinorIndustry9810059401 = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--class-worker-occupation-minor-url=')) out.urls.classWorkerOccupationMinor9810059101 = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--class-worker-industry-url=')) out.urls.classWorkerIndustry9810059201 = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--url=')) out.allUrls.push(arg.split('=').slice(1).join('='));
  }
  return out;
}

function extFromUrl(url) {
  try {
    const p = new URL(url).pathname.toLowerCase();
    for (const ext of ['.csv', '.zip', '.txt', '.json', '.xlsx', '.xls']) if (p.endsWith(ext)) return ext;
  } catch {
    // ignore
  }
  return '.dat';
}

async function fetchWithTimeout(url, opts = {}, timeoutMs = 20000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url) {
  const r = await fetchWithTimeout(url, { headers: { 'User-Agent': 'living-region-census-pop-labour/1.0' } }, 20000);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

async function fetchResponse(url) {
  const r = await fetchWithTimeout(url, { headers: { 'User-Agent': 'living-region-census-pop-labour/1.0' } }, 45000);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r;
}

function extractLinksFromHtml(html, pageUrl) {
  const links = [];
  const rx = /href\s*=\s*["']([^"']+)["']/gi;
  let m = rx.exec(html);
  while (m) {
    try { links.push(new URL(m[1], pageUrl).toString()); } catch {}
    m = rx.exec(html);
  }
  return [...new Set(links)];
}

function scoreLink(entry, url) {
  const u = url.toLowerCase();
  let s = 0;
  if (/\.csv($|\?)/.test(u)) s += 6;
  if (/\.zip($|\?)/.test(u)) s += 4;
  if (/download/.test(u)) s += 3;
  if (u.includes('/n1/en/tbl/csv/')) s += 10;
  if (u.includes(entry.statcanTableId.replaceAll('-', '').toLowerCase())) s += 8;
  if (u.includes(entry.statcanTableId.toLowerCase())) s += 8;
  if (entry.statcanDownloadTableId && u.includes(entry.statcanDownloadTableId.toLowerCase())) s += 10;
  if (/guide|metadata|catalogue\/$/.test(u)) s -= 4;
  return s;
}

function slug(id) {
  return id.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const outputDir = path.resolve(args.outputDir);
  fs.mkdirSync(outputDir, { recursive: true });

  const results = [];
  const candidates = [];

  for (const entry of censusPopulationLabour2021Manifest) {
    const row = { id: entry.id, statcanTableId: entry.statcanTableId, status: 'pending' };
    if (args.dryRun) { row.status = 'dry-run'; results.push(row); continue; }

    const manualUrl = args.urls[entry.id] ?? null;
    let links = [];
    const pageUrls = [
      `https://www150.statcan.gc.ca/n1/en/catalogue/${entry.statcanTableId.replaceAll('-', '')}`,
      `https://www150.statcan.gc.ca/n1/en/table/${entry.statcanTableId}`
    ];
    if (entry.statcanDownloadTableId) {
      pageUrls.unshift(`https://www150.statcan.gc.ca/n1/en/tbl/csv/${entry.statcanDownloadTableId}-eng.zip`);
    }
    if (entry.directDownloadUrl) {
      pageUrls.unshift(entry.directDownloadUrl);
    }

    for (const pageUrl of pageUrls) {
      try {
        const html = await fetchText(pageUrl);
        if (html.length <= 2_000_000) {
          fs.writeFileSync(path.join(outputDir, `${slug(entry.id)}.${Buffer.from(pageUrl).toString('base64url').slice(0, 12)}.source-page.html`), html);
        }
        const extracted = extractLinksFromHtml(html, pageUrl);
        links.push(...extracted);
        for (const l of extracted) candidates.push({ entryId: entry.id, tableId: entry.statcanTableId, url: l, score: scoreLink(entry, l) });
      } catch (error) {
        row.pageFetchError = error.message;
      }
    }

    links = [...new Set(links)];
    const chosen = manualUrl
      ? { url: manualUrl, score: 999, source: 'manual' }
      : links.map((l) => ({ url: l, score: scoreLink(entry, l), source: 'auto' })).sort((a, b) => b.score - a.score).find((x) => x.score > 3);

    if (!chosen) {
      row.status = 'manual-url-needed';
      row.message = `No direct file inferred for ${entry.statcanTableId}.`;
      results.push(row);
      continue;
    }

    row.selectedUrl = chosen.url;
    try {
      const ext = extFromUrl(chosen.url);
      const outPath = path.join(outputDir, `${slug(entry.id)}${ext}`);
      const res = await fetchResponse(chosen.url);
      const contentType = String(res.headers.get('content-type') ?? '').toLowerCase();
      if (contentType.includes('text/html')) {
        row.status = 'manual-url-needed';
        row.message = `Selected URL returned HTML, not raw data: ${chosen.url}`;
        results.push(row);
        continue;
      }
      if (!res.body) throw new Error('Empty response body');
      await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(outPath));
      row.status = 'downloaded';
      row.outputPath = outPath;
      row.sizeBytes = fs.statSync(outPath).size;
    } catch (error) {
      row.status = 'failed';
      row.error = error.message;
    }
    results.push(row);
  }

  for (const url of args.allUrls) {
    try {
      const ext = extFromUrl(url);
      const outPath = path.join(outputDir, `manual-${Buffer.from(url).toString('base64url').slice(0, 12)}${ext}`);
      const res = await fetchResponse(url);
      if (!res.body) throw new Error('Empty response body');
      await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(outPath));
      const sizeBytes = fs.statSync(outPath).size;
      results.push({ id: 'manual-url', status: 'downloaded', selectedUrl: url, outputPath: outPath, sizeBytes });
    } catch (error) {
      results.push({ id: 'manual-url', status: 'failed', selectedUrl: url, error: error.message });
    }
  }

  const manifestPath = path.join(outputDir, 'download-manifest.json');
  const candidatesPath = path.join(outputDir, 'census-pop-labour-link-candidates.json');
  fs.writeFileSync(manifestPath, JSON.stringify({ generatedAt: new Date().toISOString(), outputDir, entries: results }, null, 2));
  fs.writeFileSync(candidatesPath, JSON.stringify({ generatedAt: new Date().toISOString(), candidates }, null, 2));

  if (results.some((r) => r.status === 'manual-url-needed')) {
    const notePath = path.resolve('know/produce/grey-census-population-labour-manual-data-needed.md');
    fs.mkdirSync(path.dirname(notePath), { recursive: true });
    fs.writeFileSync(notePath, [
      '# Grey Census Population Labour Manual Data Needed',
      '',
      'Automatic resolver did not find all direct table files.',
      'Provide manual direct CSV/ZIP URLs or place files in `know/input/census-population-labour/2021/`.',
      '',
      'Commands:',
      '```bash',
      'npm run census-pop-labour:download-2021 -- --occupation-url="<direct-csv-url>"',
      'npm run census-pop-labour:download-2021 -- --industry-url="<direct-csv-url>"',
      'npm run census-pop-labour:download-2021 -- --work-activity-url="<direct-csv-url>"',
      'npm run census-pop-labour:download-2021 -- --occupation-minor-industry-url="<direct-csv-url>"',
      'npm run census-pop-labour:download-2021 -- --class-worker-occupation-minor-url="<direct-csv-url>"',
      'npm run census-pop-labour:download-2021 -- --class-worker-industry-url="<direct-csv-url>"',
      'npm run census-pop-labour:import-grey -- --occupation-table=<path> --industry-table=<path> --work-activity-table=<path>',
      '```',
      '',
      `Candidates file: ${candidatesPath}`
    ].join('\n'));
    console.log(`manual note: ${notePath}`);
  }

  console.log(`census-pop-labour output dir: ${outputDir}`);
  console.log(`downloaded: ${results.filter((r) => r.status === 'downloaded').length}`);
  console.log(`manual-url-needed: ${results.filter((r) => r.status === 'manual-url-needed').length}`);
  console.log(`failed: ${results.filter((r) => r.status === 'failed').length}`);
  console.log(`manifest: ${manifestPath}`);
  console.log(`candidates: ${candidatesPath}`);
}

run().catch((error) => {
  console.error(`census-pop-labour download failed: ${error.message}`);
  process.exit(1);
});
