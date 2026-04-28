// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';

function exists(filePath) {
  return fs.existsSync(filePath);
}

function readJsonIfExists(filePath, warnings, label) {
  if (!exists(filePath)) {
    warnings.push(`Missing ${label}: ${filePath}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    warnings.push(`Failed to parse ${label}: ${filePath} (${error.message})`);
    return null;
  }
}

function readGeoJsonCount(inputDir, sourceId) {
  const filePath = path.join(inputDir, `${sourceId}.geojson`);
  if (!exists(filePath)) return { filePath, featureCount: 0, found: false };
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return { filePath, featureCount: Array.isArray(parsed?.features) ? parsed.features.length : 0, found: true };
  } catch {
    return { filePath, featureCount: 0, found: true };
  }
}

function parseCsv(csvText) {
  const rows = [];
  let i = 0;
  let field = '';
  let row = [];
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    if (row.length > 1 || (row.length === 1 && row[0] !== '')) rows.push(row);
    row = [];
  };

  while (i < csvText.length) {
    const ch = csvText[i];
    if (inQuotes) {
      if (ch === '"') {
        if (csvText[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
      } else {
        field += ch;
      }
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      pushField();
      i += 1;
      continue;
    }
    if (ch === '\n') {
      pushField();
      pushRow();
      i += 1;
      continue;
    }
    if (ch === '\r') {
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }

  pushField();
  pushRow();

  if (rows.length === 0) return [];
  const headers = rows[0];
  return rows.slice(1).map((r) => {
    const obj = {};
    for (let j = 0; j < headers.length; j += 1) obj[headers[j]] = r[j] ?? '';
    return obj;
  });
}

function readCsvIfExists(filePath, warnings, label) {
  if (!exists(filePath)) {
    warnings.push(`Missing ${label}: ${filePath}`);
    return [];
  }
  try {
    return parseCsv(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    warnings.push(`Failed to parse ${label}: ${filePath} (${error.message})`);
    return [];
  }
}

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return 'unknown';
  return value.toLocaleString('en-CA', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function asCsv(rows, headers) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((row) => headers.map((h) => esc(row[h])).join(','))].join('\n');
}

function toMap(layers) {
  return Object.fromEntries(layers.map((l) => [l.id, l]));
}

export function buildGreyPublicBaselineReport(options = {}) {
  const inputDir = path.resolve(options.inputDir ?? 'know/input/gis');
  const produceDir = path.resolve(options.produceDir ?? 'know/produce');
  fs.mkdirSync(produceDir, { recursive: true });

  const warnings = [];
  const sourceFiles = {};

  const baselineSummaryPath = path.join(produceDir, 'grey-baseline-summary.json');
  const baselineMunicipalityCsvPath = path.join(produceDir, 'grey-baseline-municipality-summary.csv');
  const secondarySummaryPath = path.join(produceDir, 'grey-secondary-data-summary.json');
  const gisSummaryPath = path.join(produceDir, 'grey-gis-summary.json');
  const openDataMetricsPath = path.join(produceDir, 'grey-county-open-data-metrics.json');

  const baselineSummary = readJsonIfExists(baselineSummaryPath, warnings, 'baseline summary') ?? {};
  const municipalityRows = readCsvIfExists(baselineMunicipalityCsvPath, warnings, 'baseline municipality csv');
  const secondarySummary = readJsonIfExists(secondarySummaryPath, warnings, 'secondary summary') ?? {};
  const gisSummary = readJsonIfExists(gisSummaryPath, warnings, 'GIS summary') ?? {};
  const openDataMetrics = readJsonIfExists(openDataMetricsPath, warnings, 'open-data demo metrics');

  sourceFiles.baselineSummaryPath = baselineSummaryPath;
  sourceFiles.baselineMunicipalityCsvPath = baselineMunicipalityCsvPath;
  sourceFiles.secondarySummaryPath = secondarySummaryPath;
  sourceFiles.gisSummaryPath = gisSummaryPath;
  sourceFiles.openDataMetricsPath = openDataMetricsPath;

  const coreLayers = [
    {
      id: 'municipality-boundaries',
      layer: 'Municipal boundaries',
      modelUse: 'Municipality geometry and assignment',
      sourceStatus: 'real open-data'
    },
    {
      id: 'settlement-boundaries',
      layer: 'Settlement boundaries',
      modelUse: 'Settlement structure diagnostics',
      sourceStatus: 'real open-data'
    },
    {
      id: 'official-plan-schedule-a-land-use',
      layer: 'Official Plan land use',
      modelUse: 'Land-use category diagnostics',
      sourceStatus: 'real open-data'
    },
    {
      id: 'road-centrelines-grey',
      layer: 'Road centrelines',
      modelUse: 'Road burden, transport, maintenance proxies',
      sourceStatus: 'real open-data'
    }
  ].map((entry) => ({ ...entry, ...readGeoJsonCount(inputDir, entry.id) }));

  const secondaryLayerDefs = [
    ['grey-transit-bus-stops', 'Transit stops', 'Service access and mobility baseline'],
    ['grey-transit-routes', 'Transit routes', 'Service coverage and mobility baseline'],
    ['official-road-cycling-routes', 'Cycling routes', 'Low-energy mobility support'],
    ['county-trails', 'County trails', 'Active mobility / corridor support'],
    ['cp-rail-trail', 'CP Rail Trail', 'Former rail/trail corridor signal'],
    ['hiking-trails', 'Hiking trails', 'Active mobility / trail network'],
    ['managed-forest-boundary', 'Managed forest boundaries', 'Forest and wood-energy context'],
    ['on-farm-rural-business-listing', 'On-farm/rural businesses', 'Rural economy and local service nodes'],
    ['public-facilities', 'Public facilities', 'Service node baseline'],
    ['bridges-culverts-structures', 'Bridges/culverts/structures', 'Infrastructure fragility and maintenance pressure'],
    ['road-condition', 'Road condition', 'Condition pressure proxy']
  ];

  const secondaryLayers = secondaryLayerDefs.map(([id, layer, modelUse]) => ({ id, layer, modelUse, ...readGeoJsonCount(inputDir, id) }));

  const layersById = toMap(secondaryLayers);

  const regionalIndicators = {
    population2021: asNumber(baselineSummary.totalPopulation2021),
    landAreaKm2: asNumber(baselineSummary.totalLandAreaKm2),
    settlementBoundaryCount: asNumber(baselineSummary.settlementBoundaryCount),
    landUseFeatureCount: asNumber(baselineSummary.landUseFeatureCount),
    totalRoadKm: asNumber(baselineSummary.totalRoadKm),
    roadKmPer1000Residents: asNumber(baselineSummary.roadKmPer1000Residents),
    roadKmPerKm2: asNumber(baselineSummary.roadKmPerKm2),
    roadFeatureCount: asNumber(baselineSummary.roadFeatureCount),
    roadClassCounts: baselineSummary.roadClassCounts ?? {},
    roadJurisdictionCounts: baselineSummary.roadJurisdictionCounts ?? {},
    pavedStatusCounts: baselineSummary.pavedStatusCounts ?? {}
  };

  const transitStopCount = layersById['grey-transit-bus-stops']?.featureCount ?? 0;
  const transitRouteCount = layersById['grey-transit-routes']?.featureCount ?? 0;
  const trailFeatureCount = (layersById['county-trails']?.featureCount ?? 0)
    + (layersById['cp-rail-trail']?.featureCount ?? 0)
    + (layersById['hiking-trails']?.featureCount ?? 0);
  const cyclingRouteFeatureCount = layersById['official-road-cycling-routes']?.featureCount ?? 0;
  const managedForestFeatureCount = layersById['managed-forest-boundary']?.featureCount ?? 0;
  const ruralBusinessCount = layersById['on-farm-rural-business-listing']?.featureCount ?? 0;
  const facilityCount = layersById['public-facilities']?.featureCount ?? 0;
  const roadStructureCount = layersById['bridges-culverts-structures']?.featureCount ?? 0;
  const roadConditionFeatureCount = layersById['road-condition']?.featureCount ?? 0;

  const pop = regionalIndicators.population2021;
  const roadKm = regionalIndicators.totalRoadKm;

  const serviceAccessIndicators = {
    transitStopCount,
    transitRouteCount,
    cyclingRouteFeatureCount,
    trailFeatureCount,
    managedForestFeatureCount,
    ruralBusinessCount,
    facilityCount,
    roadStructureCount,
    roadConditionFeatureCount,
    transitStopsPer1000Residents: pop > 0 ? (transitStopCount / pop) * 1000 : 0,
    ruralBusinessesPer1000Residents: pop > 0 ? (ruralBusinessCount / pop) * 1000 : 0,
    facilitiesPer1000Residents: pop > 0 ? (facilityCount / pop) * 1000 : 0,
    roadStructuresPer100KmRoad: roadKm > 0 ? (roadStructureCount / roadKm) * 100 : 0,
    notes: 'Counts are structural baseline indicators; they are not direct measures of service quality or accessibility.'
  };

  const latestYear = Array.isArray(openDataMetrics?.years) ? openDataMetrics.years.at(-1) : null;
  const ruralTransitionRelevance = {
    dataCapabilities: [
      'Road burden and car dependence diagnostics with real road geometry',
      'Settlement versus rural land structure diagnostics with real boundary and land-use layers',
      'Food-energy and land-use scenario diagnostics tied to census-scaled demand',
      'Service access and trip reduction potential proxies from transit, trails, cycling, and facilities layers',
      'Rural business/service node distribution proxies from on-farm/rural business listings',
      'Infrastructure pressure proxies from structures and road condition layers'
    ],
    modelDiagnostics: {
      foodCoverage: Number.isFinite(latestYear?.localFoodCoverageRatio) ? latestYear.localFoodCoverageRatio : null,
      foodSurplusGJ: Number.isFinite(latestYear?.foodSurplusGJ) ? latestYear.foodSurplusGJ : null,
      averageRent: Number.isFinite(latestYear?.averageRent) ? latestYear.averageRent : null,
      ruralTransitionPressureIndex: Number.isFinite(latestYear?.ruralTransitionPressureIndex) ? latestYear.ruralTransitionPressureIndex : null,
      roadSource: openDataMetrics?.seedMeta?.summary?.roadSource ?? null
    }
  };

  const missingOrSynthetic = [
    'Parcel/lot fabric coverage for Grey County (currently unresolved/guarded)',
    'Population estimates layer import for scenario scaling support',
    'Specific libraries/arenas/works-yards layers (where separate feeds remain unresolved)',
    'Some road project feeds and project-specific schedules',
    'Provincewide fallback datasets that remain blocked by large-download safeguards unless filtered',
    'Detailed building footprints/address points',
    'Rail/former rail ROW completeness beyond currently loaded trail/corridor proxies',
    'Road asset cost tables and bridge/culvert condition-capital calibration',
    'Calibrated food/yield/soil and freight flow datasets'
  ];

  const municipalityIndicators = municipalityRows.map((row) => ({
    municipalityName: row.municipalityName,
    population2021: asNumber(row.population2021),
    landAreaKm2: asNumber(row.landAreaKm2),
    densityPerKm2: asNumber(row.densityPerKm2),
    roadKm: asNumber(row.roadKm),
    roadKmPer1000Residents: asNumber(row.roadKmPer1000Residents),
    roadKmPerKm2: asNumber(row.roadKmPerKm2),
    settlementFeatureCount: asNumber(row.settlementFeatureCount),
    landUseFeatureCount: asNumber(row.landUseFeatureCount),
    dominantRoadClasses: row.dominantRoadClasses ?? '',
    dominantRoadJurisdictions: row.dominantRoadJurisdictions ?? '',
    dominantLandUseCategories: row.dominantLandUseCategories ?? row.topLandUseCategories ?? '',
    transitStopCount: '',
    facilityCount: '',
    ruralBusinessCount: '',
    notes: 'Transit/facility/rural-business municipality assignment is regional-only in this report pass.'
  }));

  const municipalCsvPath = path.join(produceDir, 'grey-public-baseline-municipal.csv');
  fs.writeFileSync(municipalCsvPath, asCsv(municipalityIndicators, [
    'municipalityName','population2021','landAreaKm2','densityPerKm2','roadKm','roadKmPer1000Residents','roadKmPerKm2','settlementFeatureCount','landUseFeatureCount','dominantRoadClasses','dominantRoadJurisdictions','dominantLandUseCategories','transitStopCount','facilityCount','ruralBusinessCount','notes'
  ]));

  sourceFiles.publicMunicipalCsvPath = municipalCsvPath;

  const dataStatus = {
    coreRealLayersLoaded: coreLayers.filter((l) => l.found).length,
    coreLayersExpected: coreLayers.length,
    secondaryLayersLoaded: secondaryLayers.filter((l) => l.featureCount > 0).length,
    secondaryLayersTracked: secondaryLayers.length,
    roadSource: openDataMetrics?.seedMeta?.summary?.roadSource ?? 'unknown',
    unresolved: [
      'lot fabric/parcels',
      'population estimates',
      'some facilities/service-specific feeds',
      'some road project feeds',
      'guarded provincewide fallback datasets'
    ]
  };

  const reportJson = {
    generatedAt: new Date().toISOString(),
    dataStatus,
    coreLayers,
    secondaryLayers,
    regionalIndicators,
    municipalityIndicators,
    serviceAccessIndicators,
    ruralTransitionRelevance,
    missingOrSynthetic,
    warnings,
    sourceFiles
  };

  const jsonPath = path.join(produceDir, 'grey-public-baseline.json');
  fs.writeFileSync(jsonPath, JSON.stringify(reportJson, null, 2));

  const markdown = [
    '# Grey County Living Region Baseline',
    '',
    '## What this is',
    '',
    '- Living Region is an open-source regional simulator.',
    '- This report summarizes the real Grey County Open Data currently loaded.',
    '- It separates real open-data facts from modelled assumptions.',
    '- It is a baseline/status report, not a forecast.',
    '',
    '## Data currently loaded',
    '',
    '### Core layers',
    '',
    '| Layer | Feature count | Source status | Model use |',
    '|---|---:|---|---|',
    ...coreLayers.map((l) => `| ${l.layer} | ${l.featureCount} | ${l.found ? l.sourceStatus : 'missing'} | ${l.modelUse} |`),
    '',
    '### Secondary layers',
    '',
    '| Layer | Feature count | Model use |',
    '|---|---:|---|',
    ...secondaryLayers.map((l) => `| ${l.layer} | ${l.featureCount} | ${l.modelUse} |`),
    '',
    '## Regional baseline indicators',
    '',
    `- 2021 population: ${regionalIndicators.population2021.toLocaleString('en-CA')}`,
    `- Land area: ${formatNumber(regionalIndicators.landAreaKm2, 2)} km²`,
    `- Settlement boundary count: ${regionalIndicators.settlementBoundaryCount.toLocaleString('en-CA')}`,
    `- Land-use feature count: ${regionalIndicators.landUseFeatureCount.toLocaleString('en-CA')}`,
    `- Total road km: ${formatNumber(regionalIndicators.totalRoadKm, 2)}`,
    `- Road km per 1,000 residents: ${formatNumber(regionalIndicators.roadKmPer1000Residents, 3)}`,
    `- Road km per km²: ${formatNumber(regionalIndicators.roadKmPerKm2, 3)}`,
    `- Road feature count: ${regionalIndicators.roadFeatureCount.toLocaleString('en-CA')}`,
    `- Road class counts: ${JSON.stringify(regionalIndicators.roadClassCounts)}`,
    `- Road jurisdiction counts: ${JSON.stringify(regionalIndicators.roadJurisdictionCounts)}`,
    `- Paved/unpaved status counts: ${JSON.stringify(regionalIndicators.pavedStatusCounts)}`,
    '',
    '## Municipality baseline',
    '',
    '| Municipality | Population | Land area km² | Density | Road km | Road km / 1,000 | Road km / km² | Settlement features | Land-use features | Dominant road classes | Dominant land-use categories |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|',
    ...municipalityIndicators.map((m) => `| ${m.municipalityName || 'unknown'} | ${m.population2021 || ''} | ${m.landAreaKm2 || ''} | ${formatNumber(m.densityPerKm2, 2)} | ${formatNumber(m.roadKm, 2)} | ${formatNumber(m.roadKmPer1000Residents, 2)} | ${formatNumber(m.roadKmPerKm2, 2)} | ${m.settlementFeatureCount || ''} | ${m.landUseFeatureCount || ''} | ${m.dominantRoadClasses || 'unknown'} | ${m.dominantLandUseCategories || 'unknown'} |`),
    '',
    'If some values are missing, they are shown as blank/unknown. Municipality-level transit/facility/rural-business assignment is regional-only in this pass.',
    '',
    '## Service and access baseline',
    '',
    `- Transit stops: ${transitStopCount}`,
    `- Transit routes: ${transitRouteCount}`,
    `- Cycling routes: ${cyclingRouteFeatureCount}`,
    `- Trails: ${trailFeatureCount}`,
    `- Public facilities: ${facilityCount}`,
    `- Rural businesses: ${ruralBusinessCount}`,
    `- Managed forest features: ${managedForestFeatureCount}`,
    `- Structures (bridges/culverts): ${roadStructureCount}`,
    `- Road condition features: ${roadConditionFeatureCount}`,
    `- Transit stops per 1,000 residents: ${formatNumber(serviceAccessIndicators.transitStopsPer1000Residents, 3)}`,
    `- Rural businesses per 1,000 residents: ${formatNumber(serviceAccessIndicators.ruralBusinessesPer1000Residents, 3)}`,
    `- Facilities per 1,000 residents: ${formatNumber(serviceAccessIndicators.facilitiesPer1000Residents, 3)}`,
    `- Road structures per 100 km of road: ${formatNumber(serviceAccessIndicators.roadStructuresPer100KmRoad, 3)}`,
    '',
    'Do not interpret these as direct service-access outcomes yet; they are structural indicators.',
    '',
    '## Rural-transition relevance',
    '',
    ...ruralTransitionRelevance.dataCapabilities.map((line) => `- ${line}`),
    '',
    `- foodCoverage: ${ruralTransitionRelevance.modelDiagnostics.foodCoverage ?? 'unknown'}`,
    `- foodSurplusGJ: ${ruralTransitionRelevance.modelDiagnostics.foodSurplusGJ ?? 'unknown'}`,
    `- averageRent: ${ruralTransitionRelevance.modelDiagnostics.averageRent ?? 'unknown'}`,
    `- ruralTransitionPressureIndex: ${ruralTransitionRelevance.modelDiagnostics.ruralTransitionPressureIndex ?? 'unknown'}`,
    `- road source: ${ruralTransitionRelevance.modelDiagnostics.roadSource ?? 'unknown'}`,
    '',
    '## What is still synthetic or missing',
    '',
    ...missingOrSynthetic.map((item) => `- ${item}`),
    '',
    '## Useful commands',
    '',
    '```bash',
    'npm run grey:download-data -- --all-useful',
    'npm run grey:import-data',
    'npm run report:grey:baseline',
    'npm run report:grey:secondary',
    'npm run report:grey:public-baseline',
    'npm run seed:grey:open-data',
    'npm run demo:grey:open-data',
    '```',
    '',
    '## Caveats',
    '',
    '- Real GIS data is used where downloaded.',
    '- Scenario outputs are diagnostics, not forecasts.',
    '- Geometry and data quality depend on source layers.',
    '- Some modelling dimensions still rely on generated assumptions.'
  ].join('\n');

  const markdownPath = path.join(produceDir, 'grey-public-baseline.md');
  fs.writeFileSync(markdownPath, markdown);

  sourceFiles.publicMarkdownPath = markdownPath;
  sourceFiles.publicJsonPath = jsonPath;

  return {
    report: reportJson,
    paths: {
      markdownPath,
      jsonPath,
      municipalCsvPath
    }
  };
}
