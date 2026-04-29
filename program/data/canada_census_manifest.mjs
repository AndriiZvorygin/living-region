// SPDX-License-Identifier: AGPL-3.0-or-later

export const canadaCensus2021Manifest = [
  {
    id: 'census-2021-dissemination-block-boundaries',
    name: '2021 Census Dissemination Block Boundaries',
    purpose: 'Aggregate small-area Census geography for assigning population and dwellings to Grey spatial contexts.',
    sourceUrl: 'https://www150.statcan.gc.ca/n1/en/catalogue/92-163-X2021001',
    expectedFormat: 'geojson-or-shapefile-zip',
    targetLayer: 'censusPopulationBlocks',
    status: 'needsDownload',
    notes: 'Public aggregate geography only; not individual-level data.'
  },
  {
    id: 'census-2021-dissemination-area-boundaries',
    name: '2021 Census Dissemination Area Boundaries',
    purpose: 'Fallback small-area geography where dissemination blocks are unavailable.',
    sourceUrl: 'https://www150.statcan.gc.ca/n1/en/catalogue/92-160-X2021006',
    expectedFormat: 'geojson-or-shapefile-zip',
    targetLayer: 'censusPopulationAreas',
    status: 'needsDownload',
    notes: 'Use as fallback when block-level geometry cannot be imported.'
  },
  {
    id: 'census-2021-geographic-attribute-file',
    name: '2021 Census Geographic Attribute File',
    purpose: 'Population and dwelling counts with DGUID/UID geography linkage at dissemination block level.',
    sourceUrl: 'https://www12.statcan.gc.ca/census-recensement/2021/geo/aip-pia/attribute-attribs/index2021-eng.cfm',
    expectedFormat: 'csv',
    targetLayer: 'censusAttributes',
    status: 'needsDownload',
    notes: 'Contains aggregate counts only.'
  },
  {
    id: 'census-2021-dissemination-geographies-relationship-file',
    name: '2021 Dissemination Geographies Relationship File',
    purpose: 'Links dissemination blocks to higher-level Census geographies such as CSD/CD.',
    sourceUrl: 'https://www150.statcan.gc.ca/n1/en/catalogue/98260004',
    expectedFormat: 'csv',
    targetLayer: 'censusRelationships',
    status: 'needsDownload',
    notes: 'Used to improve Grey filtering and crosswalk reliability.'
  }
];

export function getCanadaCensusManifestById(id) {
  return canadaCensus2021Manifest.find((entry) => entry.id === id) ?? null;
}
