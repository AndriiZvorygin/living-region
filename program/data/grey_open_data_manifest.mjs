// SPDX-License-Identifier: AGPL-3.0-or-later

export const greyOpenDataManifest = [
  {
    id: 'municipality-boundaries',
    name: 'Municipality Boundary',
    purpose: 'Municipal boundary polygons for census-scaled alignment and patch boundaries.',
    sourcePageUrl: 'https://maps.grey.ca/datasets/grey::municipality-boundary-2/about',
    itemId: '1915f2e37a5c4ea7801a075eccaad32a',
    serviceUrl: 'https://services1.arcgis.com/wE2uWQWlTTnVDgyt/arcgis/rest/services/Grey_County_Reference_Layers_-_Open_Data/FeatureServer',
    layerId: 1,
    downloadFormat: 'geojson',
    expectedGeometryType: 'Polygon',
    targetLayer: 'municipality-boundaries',
    status: 'verified',
    requiredProperties: ['id', 'name'],
    optionalProperties: ['municipality', 'area'],
    fallbackSources: [],
    notes: 'Primary county boundary source.',
    verified: true,
    verifiedReason: 'Live ArcGIS discovery + download confirmed Municipality Boundary layer on Grey owner service.',
    selectedTitle: 'Municipality Boundary',
    selectedOwner: 'service_grey',
    selectedLayerName: 'Municipality Boundary',
    lastVerifiedNote: 'Verified 2026-04-28 from ArcGIS sharing search + service layer inspection.',
    searchQueries: [
      'title:"Municipality Boundary" Grey',
      'title:"Municipality Boundary" "Grey County"',
      '"Municipality Boundary" "maps.grey.ca"'
    ],
    expectedTitleTerms: ['municipality', 'boundary'],
    expectedOwnerTerms: ['grey'],
    expectedUrlTerms: ['feature', 'mapserver', 'featureserver']
  },
  {
    id: 'settlement-boundaries',
    name: 'Settlement Boundaries',
    purpose: 'Settlement area polygons for urban/town/village diagnostics.',
    sourcePageUrl: 'https://maps.grey.ca/datasets/grey::settlement-boundaries-1/about',
    itemId: '98a2f72bd83d4b4d8fb697577905564a',
    serviceUrl: 'https://services1.arcgis.com/wE2uWQWlTTnVDgyt/arcgis/rest/services/SettlementBoundaries/FeatureServer',
    layerId: 4,
    downloadFormat: 'geojson',
    expectedGeometryType: 'Polygon',
    targetLayer: 'settlement-boundaries',
    status: 'verified',
    requiredProperties: ['id', 'name'],
    optionalProperties: ['type'],
    fallbackSources: [],
    notes: 'May be used to map town/village/rural context.',
    verified: true,
    verifiedReason: 'Live ArcGIS discovery + layer inspection confirmed Grey County Settlements layer.',
    selectedTitle: 'Settlement Boundaries',
    selectedOwner: 'service_grey',
    selectedLayerName: 'Grey County Settlements',
    lastVerifiedNote: 'Verified 2026-04-28 from ArcGIS sharing search + FeatureServer layer check.',
    searchQueries: [
      'title:"Settlement Boundaries" Grey',
      'title:"Settlement Boundaries" "Grey County"'
    ],
    expectedTitleTerms: ['settlement', 'boundaries'],
    expectedOwnerTerms: ['grey'],
    expectedUrlTerms: ['feature', 'mapserver', 'featureserver']
  },
  {
    id: 'official-plan-schedule-a-land-use',
    name: 'Official Plan Schedule A - Land Use',
    purpose: 'Land-use designation polygons for patch land-use initialization.',
    sourcePageUrl: 'https://maps.grey.ca/datasets/grey::official-plan-schedule-a-land-use/about',
    itemId: 'c0a0ede3dc764d17a819adf6c46c614f',
    serviceUrl: 'https://gis.grey.ca/server/rest/services/Public/Service_GCOfficialPlan/MapServer',
    layerId: 30,
    downloadFormat: 'geojson',
    expectedGeometryType: 'Polygon',
    targetLayer: 'official-plan-land-use',
    status: 'verified',
    requiredProperties: ['id'],
    optionalProperties: ['landUse', 'designation'],
    fallbackSources: [],
    notes: 'Primary planning land-use source.',
    verified: true,
    verifiedReason: 'Live ArcGIS discovery + MapServer layer inspection confirmed Land use layer.',
    selectedTitle: 'Official Plan Schedule A - Land Use',
    selectedOwner: 'service_grey',
    selectedLayerName: 'Land use',
    lastVerifiedNote: 'Verified 2026-04-28 from ArcGIS sharing search + MapServer layer check.',
    searchQueries: [
      'title:"Official Plan Schedule A" Grey',
      'title:"Official Plan Schedule A - Land Use" "Grey County"',
      '"Official Plan Schedule A" "Land Use" Grey'
    ],
    expectedTitleTerms: ['official', 'plan', 'schedule', 'land', 'use'],
    expectedOwnerTerms: ['grey'],
    expectedUrlTerms: ['feature', 'mapserver', 'featureserver']
  },
  {
    id: 'road-centrelines',
    name: 'Road Centrelines',
    purpose: 'Road network centreline layer with class/type attributes.',
    sourcePageUrl: 'https://maps.grey.ca/pages/open-data',
    itemId: null,
    serviceUrl: null,
    layerId: null,
    downloadFormat: 'geojson',
    expectedGeometryType: 'LineString',
    targetLayer: 'road-centrelines',
    status: 'needsConfirmation',
    requiredProperties: ['id'],
    optionalProperties: ['class', 'type', 'roadClass'],
    fallbackSources: [],
    notes: 'Auto-discovery selected Road Transfers, likely not road centrelines; requires manual confirmation.',
    verified: false,
    verifiedReason: 'Unverified: auto-selected Road Transfers candidate appears off-target.',
    selectedTitle: null,
    selectedOwner: null,
    selectedLayerName: null,
    lastVerifiedNote: 'Needs confirmation against canonical road centreline dataset.',
    searchQueries: [
      'title:"Road" "Grey County"',
      'title:"Road Centreline" Grey',
      'title:"Road Network" Grey'
    ],
    expectedTitleTerms: ['road'],
    expectedOwnerTerms: ['grey'],
    expectedUrlTerms: ['road', 'feature', 'mapserver', 'featureserver']
  },
  {
    id: 'lot-fabric-improved',
    name: 'Lot Fabric Improved',
    purpose: 'Fallback lots and concessions style layer for parcel context.',
    sourcePageUrl: 'https://geohub.lio.gov.on.ca/datasets/lot-fabric-improved/',
    itemId: null,
    serviceUrl: null,
    layerId: null,
    downloadFormat: 'geojson',
    expectedGeometryType: 'Polygon',
    targetLayer: 'lot-fabric-reference',
    status: 'needsConfirmation',
    requiredProperties: ['id'],
    optionalProperties: ['lot', 'concession'],
    fallbackSources: [],
    notes: 'Auto-discovery selected public Peel-owned candidate; needs Ontario LIO canonical source confirmation.',
    verified: false,
    verifiedReason: 'Unverified fallback candidate not confirmed as Grey/LIO canonical source.',
    selectedTitle: null,
    selectedOwner: null,
    selectedLayerName: null,
    lastVerifiedNote: 'Needs confirmation before ingestion.',
    searchQueries: [
      'title:"Lot Fabric Improved" Ontario',
      'title:"Lot Fabric Improved" LIO'
    ],
    expectedTitleTerms: ['lot', 'fabric', 'improved'],
    expectedOwnerTerms: ['ontario', 'lio'],
    expectedUrlTerms: ['feature', 'mapserver', 'featureserver']
  }
];

export function validateGreyOpenDataManifest(manifest = greyOpenDataManifest) {
  const required = [
    'id', 'name', 'purpose', 'sourcePageUrl', 'itemId', 'serviceUrl', 'layerId',
    'downloadFormat', 'expectedGeometryType', 'targetLayer', 'status',
    'requiredProperties', 'optionalProperties', 'fallbackSources', 'notes',
    'searchQueries', 'expectedTitleTerms', 'expectedOwnerTerms', 'expectedUrlTerms',
    'verified', 'verifiedReason', 'selectedTitle', 'selectedOwner', 'selectedLayerName', 'lastVerifiedNote'
  ];
  const errors = [];
  for (const [index, item] of manifest.entries()) {
    for (const key of required) {
      if (!Object.hasOwn(item, key)) {
        errors.push({ index, id: item?.id ?? null, key, message: `Missing key ${key}` });
      }
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    count: manifest.length
  };
}
