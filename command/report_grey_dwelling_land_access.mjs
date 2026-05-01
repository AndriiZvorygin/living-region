// SPDX-License-Identifier: AGPL-3.0-or-later
import path from 'node:path';
import fs from 'node:fs';
import { buildGreyDwellingLandAccessReport } from '../program/report/grey_dwelling_land_access_report.mjs';

function parseArgs(argv = process.argv.slice(2)) {
  const opts = { strict: false, useCache: false, noCache: false };
  for (const arg of argv) {
    if (arg.startsWith('--input-dir=')) opts.inputDir = arg.slice('--input-dir='.length);
    else if (arg.startsWith('--produce-dir=')) opts.produceDir = arg.slice('--produce-dir='.length);
    else if (arg.startsWith('--output-dir=')) opts.produceDir = arg.slice('--output-dir='.length);
    else if (arg === '--strict') opts.strict = true;
    else if (arg === '--use-cache') opts.useCache = true;
    else if (arg === '--no-cache') opts.noCache = true;
  }
  return opts;
}

try {
  const opts = parseArgs();
  if (opts.useCache && opts.noCache) {
    throw new Error('Cannot use both --use-cache and --no-cache.');
  }
  const inputDir = path.resolve(opts.inputDir ?? 'know/input/gis');
  const produceDir = path.resolve(opts.produceDir ?? 'know/produce');
  const lotsPath = path.join(inputDir, 'lots-and-concessions-grey.geojson');
  const cachedPath = path.join(produceDir, 'grey-dwelling-land-access.json');

  const shouldTryCache = opts.useCache && !opts.noCache;
  let usedCache = false;
  let reportResult = null;

  if (shouldTryCache && fs.existsSync(cachedPath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cachedPath, 'utf8'));
      const lotsExists = fs.existsSync(lotsPath);
      const staleInvalidCache = cached?.dwellingLandAccessValid === false && lotsExists;
      if (!staleInvalidCache) {
        reportResult = {
          report: cached,
          paths: {
            markdownPath: path.join(produceDir, 'grey-dwelling-land-access.md'),
            jsonPath: cachedPath,
            municipalCsvPath: path.join(produceDir, 'grey-dwelling-land-access-municipal.csv'),
            thresholdsCsvPath: path.join(produceDir, 'grey-dwelling-land-access-thresholds.csv')
          }
        };
        usedCache = true;
      }
    } catch {
      // fall through to rebuild
    }
  }

  if (!reportResult) {
    reportResult = buildGreyDwellingLandAccessReport({ inputDir, produceDir });
  }

  const { report, paths } = reportResult;
  console.log(`inputDir: ${inputDir}`);
  console.log(`lots path: ${lotsPath}`);
  console.log(`lots exists: ${fs.existsSync(lotsPath)}`);
  console.log(`cache mode: ${usedCache ? 'used' : 'rebuilt'}`);

  console.log(`population distribution source: ${report.populationDistributionSource}`);
  console.log(`total population: ${report.totalPopulation}`);
  console.log(`total dwellings: ${report.totalDwellings}`);
  console.log(`inside settlement population: ${report.insideSettlementPopulation}`);
  console.log(`outside settlement population: ${report.outsideSettlementPopulation}`);
  const fmt = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? 'invalid' : Number(v).toFixed(2));
  console.log(`broad parcel/yard access population (legacy): ${fmt(report.broadParcelOrYardAccessPopulation)}`);
  console.log(`no meaningful food-growing land access population (strict): ${fmt(report.noMeaningfulFoodGrowingLandAccessPopulation)}`);
  console.log(`supplemental garden access population (strict): ${fmt(report.supplementalGardenAccessPopulation)}`);
  console.log(`meaningful household food access population (strict): ${fmt(report.meaningfulHouseholdFoodAccessPopulation)}`);
  console.log(`subsistence-potential access population (strict): ${fmt(report.subsistencePotentialAccessPopulation)}`);
  console.log(`production-scale access population (strict): ${fmt(report.productionScaleAccessPopulation)}`);
  if (report.dwellingLandAccessValid === false) {
    console.warn('Dwelling-land-access report is invalid until lots-and-concessions-grey.geojson is downloaded.');
    console.warn('Run: npm run grey:download-data -- --source=lots-and-concessions-grey');
    if (opts.strict) process.exit(1);
  }
  console.log(`markdown: ${paths.markdownPath}`);
  console.log(`json: ${paths.jsonPath}`);
  console.log(`municipal csv: ${paths.municipalCsvPath}`);
  console.log(`threshold csv: ${paths.thresholdsCsvPath}`);
} catch (error) {
  console.error(`dwelling-land-access report failed: ${error.message}`);
  process.exit(1);
}
