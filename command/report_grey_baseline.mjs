// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { buildGreyBaselineReport } from '../program/report/grey_baseline_report.mjs';

try {
  const summaryPath = path.resolve('know/produce/grey-baseline-summary.json');
  let summary;
  let paths;
  if (fs.existsSync(summaryPath)) {
    summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    paths = {
      summaryPath,
      municipalityCsvPath: path.resolve('know/produce/grey-baseline-municipality-summary.csv'),
      roadsCsvPath: path.resolve('know/produce/grey-baseline-roads-summary.csv'),
      landUseCsvPath: path.resolve('know/produce/grey-baseline-land-use-summary.csv')
    };
  } else {
    ({ summary, paths } = buildGreyBaselineReport());
  }
  console.log(`total population: ${summary.totalPopulation2021}`);
  console.log(`total road km: ${summary.totalRoadKm.toFixed(2)}`);
  console.log(`road km per 1000 residents: ${summary.roadKmPer1000Residents.toFixed(3)}`);
  console.log(`road km per km2: ${summary.roadKmPerKm2.toFixed(3)}`);
  console.log(`land-use category counts: ${JSON.stringify(summary.landUseCategoryCounts)}`);
  console.log(`road class counts: ${JSON.stringify(summary.roadClassCounts)}`);
  console.log(`assignment completeness: ${JSON.stringify(summary.assignmentCompleteness)}`);
  if ((summary.warnings ?? []).length > 0) {
    console.log('warnings:');
    for (const warning of summary.warnings) console.log(`  - ${warning}`);
  }
  console.log(`output summary: ${paths.summaryPath}`);
  console.log(`output municipality csv: ${paths.municipalityCsvPath}`);
  console.log(`output roads csv: ${paths.roadsCsvPath}`);
  console.log(`output land-use csv: ${paths.landUseCsvPath}`);
} catch (error) {
  console.error(`report failed: ${error.message}`);
  process.exit(1);
}
