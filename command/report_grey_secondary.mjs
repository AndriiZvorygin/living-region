// SPDX-License-Identifier: AGPL-3.0-or-later
import { buildGreySecondaryDataReport } from '../program/report/grey_secondary_data_report.mjs';

const { summary, paths } = buildGreySecondaryDataReport();
console.log(`downloaded source count: ${summary.downloadedSourceCount}`);
console.log(`transit stops: ${summary.transitStopCount}`);
console.log(`trail features: ${summary.trailFeatureCount}`);
console.log(`cycling route features: ${summary.cyclingRouteFeatureCount}`);
console.log(`managed forest features: ${summary.managedForestFeatureCount}`);
console.log(`hazardous forest features: ${summary.hazardousForestFeatureCount}`);
console.log(`rural businesses: ${summary.ruralBusinessCount}`);
console.log(`facilities: ${summary.facilityCount}`);
console.log(`structures/projects: ${summary.structuresProjectsCount}`);
console.log(`population estimate records: ${summary.populationEstimateRecords}`);
console.log(`summary json: ${paths.jsonPath}`);
console.log(`summary csv: ${paths.csvPath}`);
