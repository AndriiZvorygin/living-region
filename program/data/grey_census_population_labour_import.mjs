// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const GREY_NAMES = [
  'grey', 'owen sound', 'west grey', 'meaford', 'georgian bluffs', 'grey highlands', 'the blue mountains', 'southgate', 'hanover', 'chatsworth'
];

const OCC_KEYWORDS = {
  farmManagersOperatorsOccupation: ['managers in agriculture', 'farm managers'],
  farmLabourersOccupation: ['general farm workers', 'harvesting labourers', 'livestock labourers', 'farm worker'],
  greenhouseNurseryWorkers: ['nursery', 'greenhouse', 'floriculture'],
  forestryWorkers: ['forestry', 'logging'],
  adjacentLandBasedWorkers: ['landscaping', 'grounds maintenance']
};

const INDUSTRY_KEYWORDS = {
  agricultureIndustryWorkers: [
    'agriculture, forestry, fishing and hunting',
    'crop production',
    'animal production',
    'greenhouse',
    'nursery',
    'support activities for agriculture',
    'support activities for forestry'
  ]
};

const OCC_EXCLUDE_TOTALS = [
  'total - occupation',
  'total - occupation - broad category',
  'total - occupation - unit group',
  'total occupation'
];

function n(v, fallback = 0) {
  const x = Number(String(v ?? '').replace(/,/g, '').trim());
  return Number.isFinite(x) ? x : fallback;
}

function norm(v) {
  return String(v ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function parseDelimited(text, delimiter = ',') {
  const rows = [];
  let i = 0; let field = ''; let row = []; let inQuotes = false;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { if (row.length > 0) rows.push(row); row = []; };
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false;
      } else field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') { inQuotes = true; i += 1; continue; }
    if (ch === delimiter) { pushField(); i += 1; continue; }
    if (ch === '\n') { pushField(); pushRow(); i += 1; continue; }
    if (ch === '\r') { i += 1; continue; }
    field += ch; i += 1;
  }
  pushField(); pushRow();
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => String(h ?? '').trim());
  return rows.slice(1).map((r) => {
    const out = {};
    for (let j = 0; j < headers.length; j += 1) out[headers[j]] = r[j] ?? '';
    return out;
  });
}

function parseDelimitedWithHeaderPreference(text) {
  const commaRows = parseDelimited(text, ',');
  const tabRows = parseDelimited(text, '\t');
  const commaHeader = Object.keys(commaRows[0] ?? {});
  const tabHeader = Object.keys(tabRows[0] ?? {});
  const commaScore = commaHeader.length > 1 ? commaHeader.filter((h) => h.toLowerCase().includes('geo') || h.toLowerCase().includes('value')).length : 0;
  const tabScore = tabHeader.length > 1 ? tabHeader.filter((h) => h.toLowerCase().includes('geo') || h.toLowerCase().includes('value')).length : 0;
  if (tabScore > commaScore) return tabRows;
  return commaRows.length > 0 ? commaRows : tabRows;
}

function readRowsFromZip(zipPath, warnings, label) {
  if (!zipPath || !fs.existsSync(zipPath)) {
    warnings.push(`Missing ${label} ZIP: ${zipPath}`);
    return [];
  }
  try {
    const listing = execSync(`unzip -Z1 ${JSON.stringify(zipPath)}`, { encoding: 'utf8' })
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);
    const csvName = listing.find((name) => /\.(csv|txt)$/i.test(name));
    if (!csvName) {
      warnings.push(`No CSV/TXT found in ${label} ZIP: ${zipPath}`);
      return [];
    }
    const pattern = [
      'grey',
      'owen sound',
      'west grey',
      'meaford',
      'georgian bluffs',
      'grey highlands',
      'the blue mountains',
      'southgate',
      'hanover',
      'chatsworth'
    ].join('|').replace(/'/g, "\\'");
    const shell = [
      `header=$(unzip -p ${JSON.stringify(zipPath)} ${JSON.stringify(csvName)} | head -n 1)`,
      `body=$(unzip -p ${JSON.stringify(zipPath)} ${JSON.stringify(csvName)} | tail -n +2 | LC_ALL=C grep -aEi '${pattern}' || true)`,
      'printf "%s\\n%s\\n" "$header" "$body"'
    ].join('; ');
    const raw = execSync(shell, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 100 });
    return parseDelimitedWithHeaderPreference(raw);
  } catch (error) {
    warnings.push(`Failed to parse ${label} ZIP: ${zipPath} (${error.message})`);
    return [];
  }
}

function readRows(filePath, warnings, label) {
  if (!filePath || !fs.existsSync(filePath)) {
    warnings.push(`Missing ${label}: ${filePath}`);
    return [];
  }
  try {
    if (/\.zip$/i.test(filePath)) return readRowsFromZip(filePath, warnings, label);
    const raw = fs.readFileSync(filePath, 'utf8');
    return parseDelimitedWithHeaderPreference(raw);
  } catch (error) {
    warnings.push(`Failed to parse ${label}: ${filePath} (${error.message})`);
    return [];
  }
}

function discoverFiles(root, explicit = {}) {
  const dir = path.resolve(root);
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).map((f) => path.join(dir, f)) : [];
  const candidates = files.filter((f) => /\.(csv|txt|zip)$/i.test(f) && !/source-page\.html$/i.test(f));
  const zipLikelyData = (filePath) => {
    if (!/\.zip$/i.test(filePath)) return true;
    try {
      const size = fs.statSync(filePath).size;
      return size > 100000 && size < 600 * 1024 * 1024;
    } catch {
      return false;
    }
  };
  const pick = (patterns) => candidates
    .filter((f) => patterns.every((p) => norm(path.basename(f)).includes(p)))
    .filter(zipLikelyData)
    .sort((a, b) => {
      try {
        return fs.statSync(b).size - fs.statSync(a).size;
      } catch {
        return 0;
      }
    })[0] ?? null;
  return {
    root: dir,
    occupationTable: explicit.occupationTable ?? pick(['98100449']) ?? pick(['0449']) ?? pick(['occupation', 'unit', 'group']),
    industryTable: explicit.industryTable ?? pick(['98100456']) ?? pick(['0456']) ?? pick(['industry', 'occupation']),
    workActivityTable: explicit.workActivityTable ?? pick(['98100471']) ?? pick(['0471']) ?? pick(['work', 'activity'])
  };
}

function rowMatchesGrey(row) {
  const values = Object.values(row ?? {}).map((v) => norm(v));
  return values.some((v) => GREY_NAMES.some((g) => v.includes(g)));
}

function geoName(row) {
  return String(pickValue(row, ['GEO', 'Geo', 'geo', 'CSD name', 'CD name']) ?? '').trim();
}

function isGreyCdRow(row) {
  return norm(geoName(row)) === 'grey';
}

function isTotalDimension(value) {
  const v = norm(value);
  return v.startsWith('total') || v.includes('total -');
}

function isIndustryRollupRow(row) {
  const occupation = pickValue(row, [
    'Occupation - Broad category - National Occupational Classification (NOC) 2021 (11)',
    'Occupation',
    'occupation'
  ]);
  const gender = pickValue(row, ['Gender (3)', 'Gender', 'gender']);
  const stats = pickValue(row, ['Statistics (3)', 'Statistics', 'statistics']);
  const place = pickValue(row, ['Place of work status (5):Total - Place of work status[1]', 'Place of work status (5)', 'Place of work status']);
  const placeIsTextual = place !== null && place !== '' && Number.isNaN(Number(String(place).replace(/,/g, '')));
  const placeOk = !placeIsTextual || isTotalDimension(place);
  return isTotalDimension(occupation) && isTotalDimension(gender) && norm(stats) === 'count' && placeOk;
}

function isWorkActivityRollupRow(row) {
  const occupation = pickValue(row, [
    'Occupation - Broad category - National Occupational Classification (NOC) 2021 (11)',
    'Occupation',
    'occupation'
  ]);
  const age = pickValue(row, ['Age (15A)', 'Age', 'age']);
  const gender = pickValue(row, ['Gender (3)', 'Gender', 'gender']);
  const place = pickValue(row, ['Place of work status (7)', 'Place of work status', 'place of work status']);
  return isTotalDimension(occupation) && isTotalDimension(age) && isTotalDimension(gender) && isTotalDimension(place);
}

function isTotalOrAllCategoryLabel(label) {
  const l = norm(label);
  return l.startsWith('total') || l.includes('all industries') || l.includes('all occupations');
}

function normalizeIndustryLabel(row) {
  return String(
    pickValue(row, [
      'Industry - Sectors - North American Industry Classification System (NAICS) 2017 (21)',
      'Industry',
      'industry'
    ]) ?? ''
  );
}

function normalizeOccupationLabel(row) {
  return String(
    pickValue(row, [
      'Occupation - Unit group - National Occupational Classification (NOC) 2021 (516)',
      'Occupation - Broad category - National Occupational Classification (NOC) 2021 (11)',
      'Occupation',
      'occupation',
      'Occupation unit group'
    ]) ?? ''
  );
}

function pickValue(row, names) {
  const keys = Object.keys(row ?? {});
  for (const name of names) {
    const hit = keys.find((k) => norm(k) === norm(name));
    if (hit && String(row[hit] ?? '').trim() !== '') return row[hit];
  }
  for (const name of names) {
    const hit = keys.find((k) => norm(k).includes(norm(name)));
    if (hit && String(row[hit] ?? '').trim() !== '') return row[hit];
  }
  return null;
}

function extractCountValue(row) {
  const direct = n(pickValue(row, ['VALUE', 'value', 'OBS_VALUE', 'obs_value', 'estimate', 'ESTIMATE', 'Count']));
  if (direct > 0) return direct;
  const numericValues = Object.values(row ?? {})
    .map((v) => n(v, NaN))
    .filter((x) => Number.isFinite(x) && x > 0);
  if (numericValues.length === 0) return 0;
  return Math.max(...numericValues);
}

function countFromRows(rows, keywordSets, labelFields = []) {
  const out = Object.fromEntries(Object.keys(keywordSets).map((k) => [k, 0]));
  for (const row of rows) {
    const label = norm(String(
      pickValue(row, [
        ...labelFields,
        'Occupation',
        'occupation',
        'Occupation unit group',
        'Occupation - Broad category - National Occupational Classification (NOC) 2021 (11)',
        'Industry',
        'industry',
        'Industry - Sectors - North American Industry Classification System (NAICS) 2017 (21)',
        'Characteristics',
        'Statistics'
      ])
      ?? Object.values(row).find((v) => typeof v === 'string')
      ?? ''
    ));
    const value = extractCountValue(row);
    if (value <= 0) continue;
    for (const [bucket, keywords] of Object.entries(keywordSets)) {
      if (keywords.some((k) => label.includes(k))) out[bucket] += value;
    }
  }
  return out;
}

export function importGreyCensusPopulationLabour(options = {}) {
  const inputDir = path.resolve(options.inputDir ?? 'know/input/census-population-labour/2021');
  const produceDir = path.resolve(options.produceDir ?? 'know/produce');
  fs.mkdirSync(produceDir, { recursive: true });
  const warnings = [];

  const discovered = discoverFiles(inputDir, {
    occupationTable: options.occupationTable,
    industryTable: options.industryTable,
    workActivityTable: options.workActivityTable
  });

  const occupationRowsAll = readRows(discovered.occupationTable, warnings, 'occupation table');
  const industryRowsAll = readRows(discovered.industryTable, warnings, 'industry table');
  const workActivityRowsAll = readRows(discovered.workActivityTable, warnings, 'work activity table');

  const occupationRows = occupationRowsAll.filter(rowMatchesGrey);
  const industryRows = industryRowsAll.filter(rowMatchesGrey);
  const workActivityRows = workActivityRowsAll.filter(rowMatchesGrey);

  const preferredOccupationRows = occupationRows.filter(isGreyCdRow);
  const preferredIndustryRows = industryRows.filter(isGreyCdRow);
  const preferredWorkActivityRows = workActivityRows.filter(isGreyCdRow);

  const occSourceRows = preferredOccupationRows.length > 0 ? preferredOccupationRows : occupationRows;
  const industrySourceRows = preferredIndustryRows.length > 0 ? preferredIndustryRows : industryRows;
  const workActivitySourceRows = preferredWorkActivityRows.length > 0 ? preferredWorkActivityRows : workActivityRows;

  const occCounts = countFromRows(occSourceRows, OCC_KEYWORDS, [
    'Occupation unit group',
    'Occupation - Unit group - National Occupational Classification (NOC) 2021 (516)',
    'Occupation'
  ]);
  const industryRollupRows = industrySourceRows.filter(isIndustryRollupRow);
  let industryRowsNarrow = industryRollupRows.filter((row) => {
    const label = normalizeIndustryLabel(row);
    const l = norm(label);
    if (isTotalOrAllCategoryLabel(l)) return false;
    // keep core ag sector and support activities without double counting all-sector totals
    return l.startsWith('11 ') || l.startsWith('111 ') || l.startsWith('112 ') || l.startsWith('113 ') || l.startsWith('114 ') || l.startsWith('115 ');
  });
  // Avoid summing sector total with its sub-sectors when both exist.
  const hasBroad11 = industryRowsNarrow.some((row) => norm(normalizeIndustryLabel(row)).startsWith('11 '));
  if (hasBroad11) {
    industryRowsNarrow = industryRowsNarrow.filter((row) => norm(normalizeIndustryLabel(row)).startsWith('11 '));
  }
  const indCounts = countFromRows(industryRowsNarrow, INDUSTRY_KEYWORDS, [
    'Industry - Sectors - North American Industry Classification System (NAICS) 2017 (21)',
    'Industry'
  ]);

  const occupationRowsNarrow = occSourceRows.filter((row) => {
    const label = norm(normalizeOccupationLabel(row));
    if (!label) return false;
    if (OCC_EXCLUDE_TOTALS.some((x) => label.includes(x))) return false;
    if (isTotalOrAllCategoryLabel(label)) return false;
    const gender = pickValue(row, ['Gender (3)', 'Gender', 'gender']);
    const age = pickValue(row, ['Age (15A)', 'Age', 'age']);
    const status = pickValue(row, ['Labour force status', 'Labour force status (5)', 'labour force status']);
    // keep only total-gender/total-age/total-status to avoid duplicate subtotals
    if (gender && !isTotalDimension(gender)) return false;
    if (age && !isTotalDimension(age)) return false;
    if (status && !isTotalDimension(status)) return false;
    return true;
  });
  const occNarrowCounts = countFromRows(occupationRowsNarrow, OCC_KEYWORDS, [
    'Occupation unit group',
    'Occupation - Unit group - National Occupational Classification (NOC) 2021 (516)'
  ]);

  const farmManagersOperatorsOccupation = n(occNarrowCounts.farmManagersOperatorsOccupation);
  const farmLabourersOccupation = n(occNarrowCounts.farmLabourersOccupation);
  const greenhouseNurseryWorkers = n(occNarrowCounts.greenhouseNurseryWorkers);
  const landscapingGroundsWorkers = n(occNarrowCounts.adjacentLandBasedWorkers);
  const forestryWorkers = n(occNarrowCounts.forestryWorkers);

  const coreAgriculturalWorkers = farmManagersOperatorsOccupation + farmLabourersOccupation + greenhouseNurseryWorkers;
  const agricultureIndustryWorkers = n(indCounts.agricultureIndustryWorkers);
  const adjacentLandBasedWorkers = landscapingGroundsWorkers;
  const totalAgRelatedBroadWorkers = Math.max(agricultureIndustryWorkers, coreAgriculturalWorkers) + adjacentLandBasedWorkers + forestryWorkers;

  let workActivityFactor = 0.85;
  const workActivityRollupRows = workActivitySourceRows.filter(isWorkActivityRollupRow);
  if (workActivityRollupRows.length > 0) {
    const seasonalShareHint = Math.min(0.5, workActivityRollupRows.reduce((s, r) => {
      const label = norm(JSON.stringify(r));
      if (label.includes('part year') || label.includes('part-time')) return s + 0.01;
      return s;
    }, 0));
    workActivityFactor = Math.max(0.6, 0.85 - seasonalShareHint);
  }

  const currentCoreAgFTEEstimate = coreAgriculturalWorkers * workActivityFactor;
  const currentAgIndustryFTEEstimate = agricultureIndustryWorkers * workActivityFactor;
  const currentBroadAgAdjacentFTEEstimate = totalAgRelatedBroadWorkers * workActivityFactor;
  const currentAdjacentLandBasedFTEEstimate = (adjacentLandBasedWorkers + forestryWorkers) * 0.65;
  const currentAgRelatedFTEEstimate = currentCoreAgFTEEstimate;

  const totalPopulation = n(options.totalPopulation ?? 100905);
  const sanityFlags = [];
  if ((totalAgRelatedBroadWorkers / Math.max(totalPopulation, 1)) > 0.15) {
    sanityFlags.push('ag_labour_count_high_check_classification');
  }
  if (coreAgriculturalWorkers <= 0 && totalAgRelatedBroadWorkers > 0) {
    sanityFlags.push('core_ag_labour_missing_using_broad_proxy');
  }

  const diagnostics = {
    generatedAt: new Date().toISOString(),
    sourceTablesUsed: discovered,
    fieldNamesUsed: {
      occupation: Object.keys(occSourceRows[0] ?? {}),
      industry: Object.keys(industrySourceRows[0] ?? {}),
      workActivity: Object.keys(workActivitySourceRows[0] ?? {})
    },
    geographyRowsMatched: {
      occupationRowsAll: occupationRowsAll.length,
      industryRowsAll: industryRowsAll.length,
      workActivityRowsAll: workActivityRowsAll.length,
      occupationRowsGrey: occupationRows.length,
      industryRowsGrey: industryRows.length,
      workActivityRowsGrey: workActivityRows.length,
      usingGreyCdOnly: preferredIndustryRows.length > 0 || preferredOccupationRows.length > 0 || preferredWorkActivityRows.length > 0
    },
    rowInclusion: {
      occupationRowsIncludedCore: occupationRowsNarrow.length,
      industryRowsIncludedCore: industryRowsNarrow.length,
      workActivityRowsIncluded: workActivityRollupRows.length,
      rowsExcludedTotalsSubtotals: Math.max(0, occSourceRows.length - occupationRowsNarrow.length) + Math.max(0, industryRollupRows.length - industryRowsNarrow.length),
      rowsExcludedBroadAllCategory: industryRollupRows.filter((row) => isTotalOrAllCategoryLabel(normalizeIndustryLabel(row))).length
    },
    sanityFlags
  };

  const summary = {
    generatedAt: new Date().toISOString(),
    geographyLevel: (occupationRows.length > 0 || industryRows.length > 0) ? 'CD_or_CSD' : 'unknown',
    coverage: (occupationRows.length > 0 || industryRows.length > 0) ? 'Grey rows matched' : 'No Grey rows matched',
    coreAgriculturalWorkers,
    agricultureIndustryWorkers,
    farmManagersOperatorsOccupation,
    farmLabourersOccupation,
    greenhouseNurseryWorkers,
    landscapingGroundsWorkers,
    adjacentLandBasedWorkers,
    forestryWorkers,
    totalAgRelatedBroadWorkers,
    totalAgRelatedLabourForce: totalAgRelatedBroadWorkers,
    currentAgRelatedWorkers: coreAgriculturalWorkers,
    currentAgRelatedFTEEstimate,
    currentCoreAgFTEEstimate,
    currentAgIndustryFTEEstimate,
    currentBroadAgAdjacentFTEEstimate,
    currentAdjacentLandBasedFTEEstimate,
    fullTimeEquivalenceFactor: workActivityFactor,
    sanityFlags,
    dataStatus: {
      occupationRows: occSourceRows.length,
      industryRows: industrySourceRows.length,
      workActivityRows: workActivitySourceRows.length,
      agLabourDataStatus: (coreAgriculturalWorkers > 0 || agricultureIndustryWorkers > 0) ? 'available' : 'missing'
    },
    warnings
  };

  if ((coreAgriculturalWorkers <= 0 && agricultureIndustryWorkers <= 0)) {
    warnings.push('No Grey Census Population labour rows matched. Provide direct StatCan CSV/ZIP files or explicit --occupation-table/--industry-table/--work-activity-table paths.');
  }

  const outPath = path.join(produceDir, 'grey-census-population-labour-baseline.json');
  const diagPath = path.join(produceDir, 'grey-ag-labour-import-diagnostics.json');
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
  fs.writeFileSync(diagPath, JSON.stringify(diagnostics, null, 2));

  return { summary, discovered, diagnostics, outputPath: outPath, diagnosticsPath: diagPath };
}
