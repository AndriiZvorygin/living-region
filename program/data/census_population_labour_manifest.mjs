// SPDX-License-Identifier: AGPL-3.0-or-later

export const censusPopulationLabour2021Manifest = [
  {
    id: 'occupationUnitGroup9810044901',
    statcanTableId: '98-10-0449-01',
    statcanDownloadTableId: '98100449',
    name: 'Occupation unit group by labour force status and related dimensions',
    purpose: 'Estimate Grey ag-related workers by occupation categories.',
    geographyLevel: 'CD/CSD',
    directDownloadUrl: 'https://www150.statcan.gc.ca/n1/en/tbl/csv/98100449-eng.zip',
    manualUrlSupported: true,
    notes: 'Use table CSV extract with Grey CD/CSD rows where possible.'
  },
  {
    id: 'industryOccupation9810045601',
    statcanTableId: '98-10-0456-01',
    statcanDownloadTableId: '98100456',
    name: 'Place of work status by industry sectors and occupation broad category',
    purpose: 'Estimate ag/forestry/fishing/hunting industry workforce for Grey.',
    geographyLevel: 'CD/CSD',
    directDownloadUrl: 'https://www150.statcan.gc.ca/n1/en/tbl/csv/98100456-eng.zip',
    manualUrlSupported: true,
    notes: 'Prefer rows with Grey CD or Grey municipalities.'
  },
  {
    id: 'occupationWorkActivity9810047101',
    statcanTableId: '98-10-0471-01',
    statcanDownloadTableId: '98100471',
    name: 'Place of work by occupation broad category and work activity',
    purpose: 'Refine FTE assumptions via work activity where available.',
    geographyLevel: 'CD/CSD',
    directDownloadUrl: 'https://www150.statcan.gc.ca/n1/en/tbl/csv/98100471-eng.zip',
    manualUrlSupported: true,
    notes: 'Optional but useful for seasonal/full-year adjustment.'
  }
];
