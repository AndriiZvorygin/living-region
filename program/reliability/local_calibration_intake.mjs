// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';

function parseCsv(text) {
  const rows = [];
  let cur = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      row.push(cur);
      cur = '';
      continue;
    }
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(cur);
      cur = '';
      if (row.some((v) => String(v).trim() !== '')) rows.push(row);
      row = [];
      continue;
    }
    cur += ch;
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    if (row.some((v) => String(v).trim() !== '')) rows.push(row);
  }
  if (!rows.length) return { headers: [], records: [] };
  const headers = rows[0].map((h) => String(h).trim());
  const records = rows.slice(1).map((r) => {
    const out = {};
    headers.forEach((h, idx) => { out[h] = String(r[idx] ?? '').trim(); });
    return out;
  });
  return { headers, records };
}

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function validDateLike(v) {
  if (!v) return false;
  const d = new Date(v);
  return Number.isFinite(d.getTime());
}

function ensureHeaders(headers, required, failures, label) {
  for (const h of required) {
    if (!headers.includes(h)) failures.push(`${label} missing required header: ${h}`);
  }
}

function validateRows({ records, category, requiredHeaders, allowedIndicators, failures, warnings, sourceManifestRefs }) {
  const parsed = [];
  let unknownIndicatorRows = 0;
  for (const [idx, row] of records.entries()) {
    const rowLabel = `${category} row ${idx + 2}`;
    for (const h of requiredHeaders) {
      if (!String(row[h] ?? '').trim()) failures.push(`${rowLabel} missing ${h}`);
    }
    if (!validDateLike(row.period_start) || !validDateLike(row.period_end)) {
      failures.push(`${rowLabel} has invalid period_start/period_end`);
    }
    if (n(row.value) == null) failures.push(`${rowLabel} value must be numeric`);
    if (!row.unit) failures.push(`${rowLabel} unit required`);
    if (!row.source_ref) failures.push(`${rowLabel} source_ref required`);
    if (!row.geography) failures.push(`${rowLabel} geography required`);

    if (row.source_ref && sourceManifestRefs && !sourceManifestRefs.has(row.source_ref)) {
      warnings.push(`${rowLabel} source_ref not found in source manifest: ${row.source_ref}`);
    }

    if (allowedIndicators.size > 0 && row.indicator && !allowedIndicators.has(row.indicator)) {
      unknownIndicatorRows += 1;
      warnings.push(`${rowLabel} unknown indicator '${row.indicator}'`);
    }
    parsed.push({ ...row, value_numeric: n(row.value) });
  }
  return { parsed, unknownIndicatorRows };
}

function summarizeCategory(name, rows) {
  if (!rows.length) {
    return {
      category: name,
      data_points: 0,
      date_range: null,
      geographies: [],
      strongest_sources: [],
      limitations: ['No rows loaded yet.'],
      usable_for_claims: 'exploratory_only'
    };
  }
  const starts = rows.map((r) => new Date(r.period_start).getTime()).filter((x) => Number.isFinite(x));
  const ends = rows.map((r) => new Date(r.period_end).getTime()).filter((x) => Number.isFinite(x));
  const geos = [...new Set(rows.map((r) => r.geography).filter(Boolean))].sort();
  const src = [...new Set(rows.map((r) => r.source_ref).filter(Boolean))].sort();
  return {
    category: name,
    data_points: rows.length,
    date_range: {
      start: starts.length ? new Date(Math.min(...starts)).toISOString().slice(0, 10) : null,
      end: ends.length ? new Date(Math.max(...ends)).toISOString().slice(0, 10) : null
    },
    geographies: geos,
    strongest_sources: src.slice(0, 5),
    limitations: [
      'Mixed indicators must not be aggregated unless explicitly normalized in a derived stage.',
      'Coverage and representativeness depend on source quality and continuity.'
    ],
    usable_for_claims: rows.length >= 5 ? 'article_with_caveat' : 'exploratory_only'
  };
}

function esc(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

const FOOD_CHARITY_INDICATORS = new Set([
  'visits',
  'unique_clients',
  'households_served',
  'meals_served',
  'hamper_count',
  'percent_change',
  'unknown_indicator'
]);

const FOOD_PRICE_INDICATORS = new Set([
  'nutritious_food_basket_monthly_cost',
  'grocery_cpi_index',
  'food_cpi_index',
  'item_price',
  'percent_change'
]);

const RENT_INCOME_INDICATORS = new Set([
  'median_rent',
  'average_rent',
  'shelter_cost_to_income_ratio',
  'median_income',
  'low_income_measure_rate',
  'odsp_single_shelter_allowance',
  'minimum_wage_hourly'
]);

export function buildLocalCalibrationSummary(options = {}) {
  const inputDir = path.resolve(options.inputDir ?? 'know/input/local-calibration');
  const schemaDir = path.resolve(options.schemaDir ?? 'know/schema/local-calibration');
  const produceDir = path.resolve(options.produceDir ?? 'know/produce');
  const sourceManifestPath = path.resolve(options.sourceManifestPath ?? 'know/source-manifest.json');
  const strict = options.strict !== false;
  fs.mkdirSync(produceDir, { recursive: true });

  const failures = [];
  const warnings = [];

  const sourceManifestRefs = (() => {
    if (!fs.existsSync(sourceManifestPath)) return new Set();
    try {
      const parsed = JSON.parse(fs.readFileSync(sourceManifestPath, 'utf8'));
      return new Set((parsed.entries ?? []).map((e) => e.source_id).filter(Boolean));
    } catch {
      return new Set();
    }
  })();

  const csvSpecs = [
    {
      category: 'food_charity',
      file: 'food-charity-series.csv',
      schema: 'food-charity-series.schema.json',
      allowedIndicators: FOOD_CHARITY_INDICATORS
    },
    {
      category: 'food_price',
      file: 'food-price-series.csv',
      schema: 'food-price-series.schema.json',
      allowedIndicators: FOOD_PRICE_INDICATORS
    },
    {
      category: 'rent_income',
      file: 'rent-income-series.csv',
      schema: 'rent-income-series.schema.json',
      allowedIndicators: RENT_INCOME_INDICATORS
    }
  ];

  const requiredBaseHeaders = ['geography', 'indicator', 'period_start', 'period_end', 'value', 'unit', 'source_ref', 'notes'];
  const rowsByCategory = {};

  for (const spec of csvSpecs) {
    const csvPath = path.join(inputDir, spec.file);
    const schemaPath = path.join(schemaDir, spec.schema);
    if (!fs.existsSync(schemaPath)) failures.push(`Missing calibration schema: ${schemaPath}`);
    if (!fs.existsSync(csvPath)) {
      rowsByCategory[spec.category] = [];
      warnings.push(`Missing calibration CSV (allowed empty intake): ${csvPath}`);
      continue;
    }
    const text = fs.readFileSync(csvPath, 'utf8');
    const { headers, records } = parseCsv(text);
    const requiredHeaders = [...requiredBaseHeaders];
    if (spec.category === 'food_charity') requiredHeaders.push('organization_or_source');
    if (spec.category === 'food_price') requiredHeaders.push('basket_or_item');
    ensureHeaders(headers, requiredHeaders, failures, spec.category);
    const validated = validateRows({
      records,
      category: spec.category,
      requiredHeaders,
      allowedIndicators: spec.allowedIndicators,
      failures,
      warnings,
      sourceManifestRefs
    });
    rowsByCategory[spec.category] = validated.parsed;
  }

  // Block silent mixed-unit aggregation for food price category.
  const priceRows = rowsByCategory.food_price ?? [];
  if (priceRows.length) {
    const unitFamilies = new Set();
    for (const r of priceRows) {
      const indicator = String(r.indicator ?? '').toLowerCase();
      if (indicator.includes('cpi')) unitFamilies.add('index');
      else if (indicator.includes('percent_change')) unitFamilies.add('percent');
      else if (String(r.unit).includes('$')) unitFamilies.add('currency');
      else unitFamilies.add('other');
    }
    if (unitFamilies.size > 1) {
      failures.push('food_price contains multiple unit families (index/currency/percent). Aggregation is blocked unless normalized explicitly in a derived stage.');
    }
  }

  const categories = {
    food_charity: summarizeCategory('food_charity', rowsByCategory.food_charity ?? []),
    food_price: summarizeCategory('food_price', rowsByCategory.food_price ?? []),
    rent_income: summarizeCategory('rent_income', rowsByCategory.rent_income ?? [])
  };

  const summary = {
    generatedAt: new Date().toISOString(),
    sourceStatus: 'manual_calibration_intake_contract',
    categories,
    totalDataPoints:
      categories.food_charity.data_points
      + categories.food_price.data_points
      + categories.rent_income.data_points,
    warnings
  };

  const jsonPath = path.join(produceDir, 'local-calibration-summary.json');
  const mdPath = path.join(produceDir, 'local-calibration-summary.md');
  const md = [
    '# Local Calibration Summary',
    '',
    '## What this is',
    'Structured intake summary for local calibration rows. This does not invent data and does not normalize mixed indicator families.',
    '',
    '| Category | Data points | Date range | Geographies | Usable for claims |',
    '|---|---:|---|---|---|',
    ...Object.values(categories).map((c) => `| ${c.category} | ${c.data_points} | ${c.date_range ? `${c.date_range.start} to ${c.date_range.end}` : 'n/a'} | ${c.geographies.join('; ') || 'n/a'} | ${c.usable_for_claims} |`),
    '',
    '## Limitations',
    ...Object.values(categories).flatMap((c) => c.limitations.map((l) => `- ${c.category}: ${l}`)),
    '',
    '## Warnings',
    ...(warnings.length ? warnings.map((w) => `- ${w}`) : ['- none'])
  ].join('\n');

  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
  fs.writeFileSync(mdPath, md);

  if (strict && failures.length) {
    return { status: 'fail', failures, warnings, summary, paths: { jsonPath, mdPath } };
  }
  return { status: failures.length ? 'fail' : 'pass', failures, warnings, summary, paths: { jsonPath, mdPath } };
}
