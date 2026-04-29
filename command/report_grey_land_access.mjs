// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { buildGreyLandAccessReport } from '../program/report/grey_land_access_report.mjs';

function parseArgs(argv = process.argv.slice(2)) {
  const opts = {};
  for (const arg of argv) {
    if (arg.startsWith('--input-dir=')) {
      opts.inputDir = arg.slice('--input-dir='.length);
    } else if (arg.startsWith('--output-dir=')) {
      opts.outputDir = arg.slice('--output-dir='.length);
    } else if (arg.startsWith('--produce-dir=')) {
      opts.outputDir = arg.slice('--produce-dir='.length);
    } else if (arg === '--use-cache') {
      opts.useCache = true;
    } else if (arg === '--no-cache') {
      opts.useCache = false;
    }
  }
  return opts;
}

function readCachedReport(outputDir) {
  const jsonPath = path.resolve(outputDir, 'grey-land-access-baseline.json');
  if (!fs.existsSync(jsonPath)) return null;
  try {
    const report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    if (!report?.assignment) return null;
    return {
      report,
      paths: {
        markdownPath: path.resolve(outputDir, 'grey-land-access-baseline.md'),
        jsonPath,
        municipalityCsvPath: path.resolve(outputDir, 'grey-land-access-municipality-summary.csv'),
        detailCsvPath: path.resolve(outputDir, 'grey-land-access-lot-detail.csv')
      }
    };
  } catch {
    return null;
  }
}

function shouldUseCachedReport(cachedReport, inputDir) {
  if (!cachedReport?.report?.assignment) return false;
  if (!cachedReport.report.opportunityCategoryCounts || !cachedReport.report.constraintCounts) return false;
  if (!cachedReport.report.assignment.lotConcessionCountByMunicipality) return false;
  const lotsPath = path.resolve(inputDir, 'lots-and-concessions-grey.geojson');
  const hasLotsFile = fs.existsSync(lotsPath);
  const cachedLots = Number(cachedReport.report.assignment.totalLotConcessionFeatures ?? 0);
  const assignedCount = Number(cachedReport.report.assignment.assignedToMunicipalityCount ?? 0);
  if (hasLotsFile && cachedLots === 0) {
    // stale cache: lots file now exists but cached report was generated without it
    return false;
  }
  if (hasLotsFile && cachedLots > 0 && assignedCount === 0) {
    // likely incomplete or incompatible cached structure
    return false;
  }
  return true;
}

try {
  const options = parseArgs();
  const inputDir = path.resolve(options.inputDir ?? 'know/input/gis');
  const outputDir = path.resolve(options.outputDir ?? 'know/produce');
  const useCache = options.useCache !== false;
  const cached = useCache ? readCachedReport(outputDir) : null;
  const cachedOk = useCache && shouldUseCachedReport(cached, inputDir);
  const { report, paths } = cachedOk ? cached : buildGreyLandAccessReport({
    inputDir,
    outputDir
  });
  const assignment = report.assignment ?? {};
  const lotByMunicipality = assignment.lotConcessionCountByMunicipality ?? {};
  const topMunicipalities = Object.entries(lotByMunicipality)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => `${name}:${count}`)
    .join(', ');

  console.log(`total lots/concessions: ${assignment.totalLotConcessionFeatures ?? 0}`);
  console.log(`assigned count: ${assignment.assignedToMunicipalityCount ?? 0}`);
  console.log(`unassigned count: ${assignment.unassignedLotConcessionCount ?? 0}`);
  console.log(`top municipalities by lot count: ${topMunicipalities || 'none'}`);
  console.log(`opportunity category counts: ${JSON.stringify(report.opportunityCategoryCounts)}`);
  console.log(`constraint counts: ${JSON.stringify(report.constraintCounts)}`);
  console.log(`markdown: ${paths.markdownPath}`);
  console.log(`json: ${paths.jsonPath}`);
  console.log(`municipality csv: ${paths.municipalityCsvPath}`);
  console.log(`lot detail csv: ${paths.detailCsvPath}`);
  if ((assignment.totalLotConcessionFeatures ?? 0) === 0) {
    console.log('Missing lots-and-concessions-grey.geojson. Run:');
    console.log('npm run grey:download-data -- --source=lots-and-concessions-grey');
  }
  console.log('caveat: Lots and Concessions is a land-structure reference layer, not ownership parcels.');
} catch (error) {
  console.error(`land-access report failed: ${error.message}`);
  process.exit(1);
}
