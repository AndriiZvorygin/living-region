// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { buildGreyPublicBaselineReport } from '../program/report/grey_public_baseline_report.mjs';

const produceDir = path.resolve('know/produce');
const metricsPath = path.join(produceDir, 'grey-county-open-data-metrics.json');

function readLatestMetrics() {
  if (!fs.existsSync(metricsPath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
    return Array.isArray(parsed?.years) ? parsed.years.at(-1) : null;
  } catch {
    return null;
  }
}

try {
  const { report, paths } = buildGreyPublicBaselineReport();
  const latest = readLatestMetrics();
  const maxWarningLines = 25;

  console.log('Grey Model Status');
  console.log('Core real layers loaded:');
  for (const layer of report.coreLayers) {
    console.log(`  - ${layer.layer}: ${layer.featureCount} (${layer.found ? 'real loaded' : 'missing'})`);
  }

  console.log('Real secondary layers loaded:');
  for (const layer of report.secondaryLayers.filter((l) => l.featureCount > 0)) {
    console.log(`  - ${layer.layer}: ${layer.featureCount}`);
  }

  console.log('Generated/synthetic or pending pieces:');
  for (const item of report.missingOrSynthetic) {
    console.log(`  - ${item}`);
  }

  console.log('Latest baseline report paths:');
  console.log(`  - ${paths.markdownPath}`);
  console.log(`  - ${paths.jsonPath}`);
  console.log(`  - ${paths.municipalCsvPath}`);

  console.log('Latest demo:grey:open-data metrics:');
  if (latest) {
    console.log(`  - foodCoverage: ${Number(latest.localFoodCoverageRatio ?? 0).toFixed(3)}`);
    console.log(`  - foodSurplusGJ: ${Number(latest.foodSurplusGJ ?? 0).toFixed(2)}`);
    console.log(`  - averageRent: ${Number(latest.averageRent ?? 0).toFixed(2)}`);
    console.log(`  - ruralTransitionPressureIndex: ${Number(latest.ruralTransitionPressureIndex ?? 0).toFixed(3)}`);
  } else {
    console.log('  - unavailable (run npm run demo:grey:open-data)');
  }

  if (report.warnings.length > 0) {
    console.log('Warnings:');
    for (const warning of report.warnings.slice(0, maxWarningLines)) {
      console.log(`  - ${warning}`);
    }
    if (report.warnings.length > maxWarningLines) {
      console.log(`  - ... ${report.warnings.length - maxWarningLines} more warnings suppressed`);
    }
  }
} catch (error) {
  console.error(`grey:status failed: ${error.message}`);
  process.exit(1);
}
