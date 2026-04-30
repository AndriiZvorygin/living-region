// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';

const GREY_NAMES = [
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
];

function n(v, fallback = 0) {
  const x = Number(String(v ?? '').replace(/,/g, '').trim());
  return Number.isFinite(x) ? x : fallback;
}

function norm(s) {
  return String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function parseDelimited(text, delimiter = ',') {
  const rows = [];
  let i = 0;
  let field = '';
  let row = [];
  let inQuotes = false;
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
    field += ch;
    i += 1;
  }
  pushField();
  pushRow();
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => String(h ?? '').trim());
  return rows.slice(1).map((r) => {
    const out = {};
    for (let j = 0; j < headers.length; j += 1) out[headers[j]] = r[j] ?? '';
    return out;
  });
}

function readRows(filePath, warnings, label) {
  if (!filePath || !fs.existsSync(filePath)) {
    warnings.push(`Missing ${label}: ${filePath}`);
    return [];
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const tabRows = parseDelimited(raw, '\t');
    if (tabRows.length > 0 && Object.keys(tabRows[0]).length > 1) return tabRows;
    return parseDelimited(raw, ',');
  } catch (error) {
    warnings.push(`Failed to parse ${label}: ${filePath} (${error.message})`);
    return [];
  }
}

function discoverFiles(censusAgDir, explicit = {}) {
  const dir = path.resolve(censusAgDir);
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).map((f) => path.join(dir, f)) : [];
  const pick = (patterns) => explicit[patterns[0]] ?? files.find((f) => patterns.every((p) => norm(path.basename(f)).includes(p))) ?? null;
  return {
    censusAgDir: dir,
    operatorsWork: explicit.operatorsWork ?? pick(['32-10-0382']) ?? pick(['3210038201']) ?? pick(['operators', 'work']),
    operatorsDemographics: explicit.operatorsDemographics ?? pick(['32-10-0381']) ?? pick(['3210038101']) ?? pick(['operators', 'age']),
    hiredLabour: explicit.hiredLabour ?? pick(['hired', 'labour']) ?? pick(['farm-labour-hired']),
    communityProfiles: explicit.communityProfiles ?? pick(['community', 'profile'])
  };
}

function rowMatchesGrey(row) {
  const values = Object.values(row ?? {}).map((v) => norm(v));
  return values.some((v) => GREY_NAMES.some((g) => v.includes(g)));
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

function aggregateOperatorsWork(rows) {
  let numberOfFarmOperators = 0;
  let operatorsWithOffFarmWork = 0;
  const operatorsByFarmWorkHours = {};

  for (const row of rows) {
    const val = n(pickValue(row, ['VALUE', 'value', 'OBS_VALUE', 'obs_value', 'estimate', 'ESTIMATE']));
    if (val <= 0) continue;
    const classLabel = String(pickValue(row, ['Farm work', 'farm work', 'work category', 'characteristic'])
      ?? pickValue(row, ['Characteristics', 'characteristics', 'Statistics'])
      ?? 'unknown').trim();
    const otherWork = norm(String(pickValue(row, ['Other paid work', 'off-farm work', 'other work']) ?? classLabel));

    if (/farm operators|total/.test(norm(classLabel))) numberOfFarmOperators += val;
    if (/off|other paid/.test(otherWork)) operatorsWithOffFarmWork += val;

    const key = classLabel || 'unknown';
    operatorsByFarmWorkHours[key] = (operatorsByFarmWorkHours[key] ?? 0) + val;
  }

  if (numberOfFarmOperators <= 0) {
    numberOfFarmOperators = Object.values(operatorsByFarmWorkHours).reduce((s, v) => s + n(v), 0);
  }

  return { numberOfFarmOperators, operatorsWithOffFarmWork, operatorsByFarmWorkHours };
}

function aggregateOperatorDemographics(rows) {
  const byCategory = {};
  for (const row of rows) {
    const label = String(pickValue(row, ['Characteristics', 'characteristics', 'Statistics', 'Age group', 'Sex']) ?? 'unknown').trim();
    const val = n(pickValue(row, ['VALUE', 'value', 'OBS_VALUE', 'obs_value', 'estimate', 'ESTIMATE']));
    if (val <= 0) continue;
    byCategory[label] = (byCategory[label] ?? 0) + val;
  }
  return byCategory;
}

function aggregateHiredLabour(rows) {
  let hiredLabour = 0;
  const byCategory = {};
  for (const row of rows) {
    const label = String(pickValue(row, ['Characteristics', 'characteristics', 'Statistics']) ?? 'unknown').trim();
    const val = n(pickValue(row, ['VALUE', 'value', 'OBS_VALUE', 'obs_value', 'estimate', 'ESTIMATE']));
    if (val <= 0) continue;
    byCategory[label] = (byCategory[label] ?? 0) + val;
    if (/hired|paid/.test(norm(label))) hiredLabour += val;
  }
  if (hiredLabour <= 0) hiredLabour = Object.values(byCategory).reduce((s, v) => s + n(v), 0);
  return { hiredLabour, byCategory };
}

export function importGreyCensusAgriculture(options = {}) {
  const censusAgDir = path.resolve(options.censusAgDir ?? 'know/input/census-agriculture/2021');
  const produceDir = path.resolve(options.produceDir ?? 'know/produce');
  fs.mkdirSync(produceDir, { recursive: true });

  const warnings = [];
  const discovered = discoverFiles(censusAgDir, {
    operatorsWork: options.operatorsWork,
    operatorsDemographics: options.operatorsDemographics,
    hiredLabour: options.hiredLabour,
    communityProfiles: options.communityProfiles
  });

  const operatorsWorkRowsAll = readRows(discovered.operatorsWork, warnings, 'operators work table');
  const operatorsDemRowsAll = readRows(discovered.operatorsDemographics, warnings, 'operator demographics table');
  const hiredLabourRowsAll = readRows(discovered.hiredLabour, warnings, 'hired labour table');
  const communityRowsAll = readRows(discovered.communityProfiles, warnings, 'community profiles table');

  const operatorsWorkRows = operatorsWorkRowsAll.filter(rowMatchesGrey);
  const operatorsDemRows = operatorsDemRowsAll.filter(rowMatchesGrey);
  const hiredLabourRows = hiredLabourRowsAll.filter(rowMatchesGrey);
  const communityRows = communityRowsAll.filter(rowMatchesGrey);

  const workAgg = aggregateOperatorsWork(operatorsWorkRows);
  const demAgg = aggregateOperatorDemographics(operatorsDemRows);
  const hiredAgg = aggregateHiredLabour(hiredLabourRows);
  const currentFarmOperatorsFTEEstimate = workAgg.numberOfFarmOperators * 0.75;
  const currentHiredFarmLabourFTEEstimate = hiredAgg.hiredLabour * 0.45;
  const currentFarmLabourFTEEstimate = currentFarmOperatorsFTEEstimate + currentHiredFarmLabourFTEEstimate;

  const numberOfFarms = n(pickValue(communityRows[0] ?? {}, ['number of farms', 'farms', 'farm count']) ?? 0);
  const landInCrops = n(pickValue(communityRows[0] ?? {}, ['land in crops', 'crop area']) ?? 0);
  const landInPasture = n(pickValue(communityRows[0] ?? {}, ['pasture', 'land in pasture']) ?? 0);
  const averageFarmSize = n(pickValue(communityRows[0] ?? {}, ['average farm size']) ?? 0);

  const summary = {
    generatedAt: new Date().toISOString(),
    geographyLevel: operatorsWorkRows.length > 0 ? 'CD_or_CCS' : 'unknown',
    coverage: operatorsWorkRows.length > 0 ? 'Grey-matched rows present' : 'No Grey rows matched from source tables',
    numberOfFarms,
    numberOfFarmOperators: workAgg.numberOfFarmOperators,
    currentFarmOperatorsFTEEstimate,
    currentHiredFarmLabourFTEEstimate,
    currentFarmLabourFTEEstimate,
    operatorsByFarmWorkHours: workAgg.operatorsByFarmWorkHours,
    operatorsWithOffFarmWork: workAgg.operatorsWithOffFarmWork,
    hiredLabour: hiredAgg.hiredLabour,
    hiredLabourBreakdown: hiredAgg.byCategory,
    operatorDemographics: demAgg,
    landInCrops,
    landInPasture,
    averageFarmSize,
    dataStatus: {
      operatorsWorkRows: operatorsWorkRows.length,
      operatorsDemographicRows: operatorsDemRows.length,
      hiredLabourRows: hiredLabourRows.length,
      communityRows: communityRows.length,
      hasFarmLabourData: workAgg.numberOfFarmOperators > 0 || hiredAgg.hiredLabour > 0,
      farmLabourDataStatus: (workAgg.numberOfFarmOperators > 0 || hiredAgg.hiredLabour > 0) ? 'available' : 'missing'
    },
    warnings
  };

  const csvRows = [
    { metric: 'numberOfFarms', value: summary.numberOfFarms },
    { metric: 'numberOfFarmOperators', value: summary.numberOfFarmOperators },
    { metric: 'operatorsWithOffFarmWork', value: summary.operatorsWithOffFarmWork },
    { metric: 'hiredLabour', value: summary.hiredLabour },
    { metric: 'landInCrops', value: summary.landInCrops },
    { metric: 'landInPasture', value: summary.landInPasture },
    { metric: 'averageFarmSize', value: summary.averageFarmSize }
  ];

  const jsonPath = path.join(produceDir, 'grey-census-agriculture-baseline.json');
  const csvPath = path.join(produceDir, 'grey-farm-labour-baseline.csv');

  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
  fs.writeFileSync(csvPath, ['metric,value', ...csvRows.map((r) => `${r.metric},${r.value}`)].join('\n'));

  return { summary, outputPaths: { jsonPath, csvPath }, discovered };
}
