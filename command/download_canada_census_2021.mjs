// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { canadaCensus2021Manifest } from '../program/data/canada_census_manifest.mjs';

function parseArgs(argv) {
  const out = { outputDir: 'know/input/census/2021', dryRun: false };
  for (const arg of argv) {
    if (arg === '--dry-run') out.dryRun = true;
    else if (arg.startsWith('--output-dir=')) out.outputDir = arg.split('=').slice(1).join('=');
  }
  return out;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function filenameFor(entry) {
  if (entry.expectedFormat === 'csv') return `${entry.id}.csv`;
  return `${entry.id}.geojson`;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'living-region-census-downloader/1.0'
    }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const outputDir = path.resolve(args.outputDir);
  ensureDir(outputDir);

  const summary = {
    generatedAt: new Date().toISOString(),
    outputDir,
    dryRun: args.dryRun,
    files: []
  };

  for (const entry of canadaCensus2021Manifest) {
    const outPath = path.join(outputDir, filenameFor(entry));
    const row = {
      id: entry.id,
      sourceUrl: entry.sourceUrl,
      outputPath: outPath,
      status: 'pending',
      notes: entry.notes
    };
    if (args.dryRun) {
      row.status = 'dry-run';
      summary.files.push(row);
      continue;
    }

    try {
      const page = await fetchText(entry.sourceUrl);
      const body = [
        '# Statistics Canada source page snapshot',
        `# source: ${entry.sourceUrl}`,
        `# downloadedAt: ${new Date().toISOString()}`,
        '',
        page
      ].join('\n');
      fs.writeFileSync(outPath.replace(/\.(csv|geojson)$/i, '.source-page.html'), body);
      row.status = 'downloaded-source-page';
      row.outputPath = outPath.replace(/\.(csv|geojson)$/i, '.source-page.html');
      row.message = 'Downloaded source page metadata snapshot. Direct file extraction may still require manual URL selection.';
    } catch (error) {
      row.status = 'failed';
      row.error = error.message;
    }
    summary.files.push(row);
  }

  const manifestPath = path.join(outputDir, 'download-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(summary, null, 2));

  console.log(`census output dir: ${outputDir}`);
  console.log(`entries: ${summary.files.length}`);
  console.log(`failed: ${summary.files.filter((f) => f.status === 'failed').length}`);
  console.log(`manifest: ${manifestPath}`);
  if (!args.dryRun) {
    console.log('note: if direct Census boundary/attribute files are not present yet, place them in know/input/census/2021 using expected names and run npm run census:import-grey-population');
  }
}

run().catch((error) => {
  console.error(`census download failed: ${error.message}`);
  process.exit(1);
});
