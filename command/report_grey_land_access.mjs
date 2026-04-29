// SPDX-License-Identifier: AGPL-3.0-or-later
import { buildGreyLandAccessReport } from '../program/report/grey_land_access_report.mjs';

try {
  const { report, paths } = buildGreyLandAccessReport();
  const topMunicipalities = Object.entries(report.assignment.lotConcessionCountByMunicipality)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => `${name}:${count}`)
    .join(', ');

  console.log(`total lots/concessions: ${report.assignment.totalLotConcessionFeatures}`);
  console.log(`assigned count: ${report.assignment.assignedToMunicipalityCount}`);
  console.log(`unassigned count: ${report.assignment.unassignedLotConcessionCount}`);
  console.log(`top municipalities by lot count: ${topMunicipalities || 'none'}`);
  console.log(`opportunity category counts: ${JSON.stringify(report.opportunityCategoryCounts)}`);
  console.log(`constraint counts: ${JSON.stringify(report.constraintCounts)}`);
  console.log(`markdown: ${paths.markdownPath}`);
  console.log(`json: ${paths.jsonPath}`);
  console.log(`municipality csv: ${paths.municipalityCsvPath}`);
  console.log(`lot detail csv: ${paths.detailCsvPath}`);
  if (report.assignment.totalLotConcessionFeatures === 0) {
    console.log('Missing lots-and-concessions-grey.geojson. Run:');
    console.log('npm run grey:download-data -- --source=lots-and-concessions-grey');
  }
  console.log('caveat: Lots and Concessions is a land-structure reference layer, not ownership parcels.');
} catch (error) {
  console.error(`land-access report failed: ${error.message}`);
  process.exit(1);
}
