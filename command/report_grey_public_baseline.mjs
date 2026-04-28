// SPDX-License-Identifier: AGPL-3.0-or-later
import { buildGreyPublicBaselineReport } from '../program/report/grey_public_baseline_report.mjs';

try {
  const { report, paths } = buildGreyPublicBaselineReport();
  console.log(`core real layers loaded: ${report.dataStatus.coreRealLayersLoaded}/${report.dataStatus.coreLayersExpected}`);
  console.log(`secondary layers loaded: ${report.dataStatus.secondaryLayersLoaded}/${report.dataStatus.secondaryLayersTracked}`);
  console.log(`population2021: ${report.regionalIndicators.population2021}`);
  console.log(`totalRoadKm: ${report.regionalIndicators.totalRoadKm.toFixed(2)}`);
  console.log(`roadFeatureCount: ${report.regionalIndicators.roadFeatureCount}`);
  console.log(`transit stops: ${report.serviceAccessIndicators.transitStopCount}`);
  console.log(`trails: ${report.serviceAccessIndicators.trailFeatureCount}`);
  console.log(`facilities: ${report.serviceAccessIndicators.facilityCount}`);
  console.log(`rural businesses: ${report.serviceAccessIndicators.ruralBusinessCount}`);
  console.log(`warnings: ${report.warnings.length}`);
  console.log(`markdown: ${paths.markdownPath}`);
  console.log(`json: ${paths.jsonPath}`);
  console.log(`municipal csv: ${paths.municipalCsvPath}`);
} catch (error) {
  console.error(`report failed: ${error.message}`);
  process.exit(1);
}
