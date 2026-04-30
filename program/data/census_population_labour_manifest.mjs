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
  },
  {
    id: 'occupationMinorIndustry9810059401',
    statcanTableId: '98-10-0594-01',
    statcanDownloadTableId: '98100594',
    name: 'Labour force status by occupation minor group and industry sectors',
    purpose: 'Preferred CD-level proxy for core agriculture occupation workers when unit-group table is unavailable for Grey CD.',
    geographyLevel: 'CD/CSD',
    directDownloadUrl: 'https://www150.statcan.gc.ca/n1/en/tbl/csv/98100594-eng.zip',
    manualUrlSupported: true,
    notes: 'Priority target for Grey CD occupation import.'
  },
  {
    id: 'classWorkerOccupationMinor9810059101',
    statcanTableId: '98-10-0591-01',
    statcanDownloadTableId: '98100591',
    name: 'Class of worker including job permanency by occupation minor group',
    purpose: 'Supplement core occupation proxy with class-of-worker details.',
    geographyLevel: 'CD/CSD',
    directDownloadUrl: 'https://www150.statcan.gc.ca/n1/en/tbl/csv/98100591-eng.zip',
    manualUrlSupported: true,
    notes: 'Use to improve worker composition and avoid double counting.'
  },
  {
    id: 'classWorkerIndustry9810059201',
    statcanTableId: '98-10-0592-01',
    statcanDownloadTableId: '98100592',
    name: 'Class of worker by industry groups',
    purpose: 'Supplement industry baseline and class-of-worker context.',
    geographyLevel: 'CD/CSD',
    directDownloadUrl: 'https://www150.statcan.gc.ca/n1/en/tbl/csv/98100592-eng.zip',
    manualUrlSupported: true,
    notes: 'Use with occupation minor group table for CD-level ag labour inference.'
  }
];
