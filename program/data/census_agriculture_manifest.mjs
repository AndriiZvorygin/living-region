// SPDX-License-Identifier: AGPL-3.0-or-later

export const censusAgriculture2021Manifest = [
  {
    id: 'census-ag-community-profiles-2021',
    name: 'Census of Agriculture Community Profiles, 2021',
    purpose: 'Grey County / Grey CD baseline farm counts and agricultural profile context.',
    sourceUrl: 'https://www12.statcan.gc.ca/census-recensement/2021/dp-pd/prof/index.cfm?Lang=E',
    expectedFormat: 'html/csv',
    targetLayer: 'farmLabourCalibration',
    status: 'needsVerification',
    notes: 'Community profile geography commonly includes CD/CCS. Table extraction may require manual download.'
  },
  {
    id: 'census-ag-32-10-0382-01',
    name: 'Farm operators by farm work and other paid work, 2021',
    purpose: 'Estimate current farm operator labour and off-farm work split.',
    sourceUrl: 'https://www150.statcan.gc.ca/n1/en/catalogue/3210038201',
    alternateSourceUrls: [
      'https://www150.statcan.gc.ca/n1/pub/71-607-x/71-607-x2022019-eng.htm'
    ],
    expectedFormat: 'csv',
    targetLayer: 'farmLabourCalibration',
    status: 'needsVerification',
    notes: 'Known table id 32-10-0382-01. Prefer downloadable CSV where available.'
  },
  {
    id: 'census-ag-32-10-0381-01',
    name: 'Farm operators by age, sex and number of operators, 2021',
    purpose: 'Operator demographics and operator-count context.',
    sourceUrl: 'https://www150.statcan.gc.ca/n1/en/catalogue/3210038101',
    expectedFormat: 'csv',
    targetLayer: 'farmLabourCalibration',
    status: 'needsVerification',
    notes: 'Known table id 32-10-0381-01.'
  },
  {
    id: 'census-ag-farm-labour-hired',
    name: 'Farm labour / hired labour tables, 2021',
    purpose: 'Estimate hired labour availability and seasonal labour dependence where table is available.',
    sourceUrl: 'https://www150.statcan.gc.ca/n1/en/subjects/agriculture_and_food',
    expectedFormat: 'csv',
    targetLayer: 'farmLabourCalibration',
    status: 'needsDiscovery',
    notes: 'Use manual URL override when direct file resolution fails.'
  },
  {
    id: 'census-ag-ontario-summary',
    name: 'Ontario agriculture summary context, 2021',
    purpose: 'Provincial comparison context for Grey baseline interpretation.',
    sourceUrl: 'https://www150.statcan.gc.ca/n1/pub/95-606-x/95-606-x2021001-eng.htm',
    expectedFormat: 'html/csv',
    targetLayer: 'farmLabourCalibration',
    status: 'needsVerification',
    notes: 'Optional context layer for interpretation, not required for core Grey baseline output.'
  }
];
