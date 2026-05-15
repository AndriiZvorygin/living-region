// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';

function readJson(filePath, failures, label, fallback = null) {
  const p = path.resolve(filePath);
  if (!fs.existsSync(p)) {
    failures.push(`Missing ${label}: ${p}`);
    return fallback;
  }
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (error) {
    failures.push(`Invalid JSON ${label}: ${error.message}`);
    return fallback;
  }
}

function readJsonOptional(filePath, warnings, label, fallback = null) {
  const p = path.resolve(filePath);
  if (!fs.existsSync(p)) {
    warnings.push(`Missing optional ${label}: ${p}`);
    return fallback;
  }
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (error) {
    warnings.push(`Invalid optional JSON ${label}: ${error.message}`);
    return fallback;
  }
}

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

function safeN(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function claimByMetric(claims, metricId) {
  return claims.find((c) => c.claim_id === `metric:${metricId}`) ?? null;
}

function toNumberRowFromMetric(metric, claim) {
  if (!metric) return null;
  return {
    metric_id: metric.metric_id,
    label: metric.label,
    value: metric.value,
    unit: metric.unit,
    status: metric.status,
    confidence: metric.confidence ?? null,
    public_use: claim?.public_use ?? null,
    caveat: claim?.caveat ?? null,
    source_refs: metric.source_refs ?? [],
    scenario_refs: metric.scenario_refs ?? []
  };
}

export function buildArticleSupportEvidencePacket(options = {}) {
  const produceDir = path.resolve(options.produceDir ?? 'know/produce');
  const qaDir = path.resolve(options.qaDir ?? 'output/qa');
  const outputDir = path.resolve(options.outputDir ?? 'output/article-support');
  const calibrationDir = path.resolve(options.calibrationDir ?? 'know/input/local-calibration');

  fs.mkdirSync(outputDir, { recursive: true });

  const failures = [];
  const warnings = [];

  const article = readJson(path.join(produceDir, 'grey-hormuz-food-security-article-data.json'), failures, 'hormuz article data', null);
  const claimInventory = readJson(path.join(qaDir, 'claim-inventory.json'), failures, 'claim inventory', { claims: [] });
  const readinessTextPath = path.join(qaDir, 'article-readiness-summary.md');
  const readinessText = fs.existsSync(readinessTextPath) ? fs.readFileSync(readinessTextPath, 'utf8') : '';
  const groundtruth = readJsonOptional(path.join(produceDir, 'land-access-groundtruth-summary.json'), warnings, 'land-access groundtruth summary', {});
  const overlay = readJsonOptional(path.join(produceDir, 'grey-land-access-gis-overlay-summary.json'), warnings, 'land-access GIS overlay summary', {});
  const calibrationSummary = readJsonOptional(path.join(produceDir, 'local-calibration-summary.json'), warnings, 'local calibration summary', {});

  if (!article) {
    return { status: 'fail', failures, warnings };
  }

  const claims = Array.isArray(claimInventory?.claims) ? claimInventory.claims : [];
  const metrics = Array.isArray(article.headlineMetrics) ? article.headlineMetrics : [];

  const strongClaims = claims.filter((c) => c.public_use === 'article_grade');
  const caveatedClaims = claims.filter((c) => c.public_use === 'article_with_caveat');
  const exploratoryClaims = claims.filter((c) => c.public_use === 'exploratory_only');
  const avoidClaims = claims.filter((c) => c.public_use === 'do_not_publish' || c.evidence_strength === 'unsupported');

  const foodCharityRows = (() => {
    const p = path.join(calibrationDir, 'food-charity-series.csv');
    if (!fs.existsSync(p)) return [];
    return parseCsv(fs.readFileSync(p, 'utf8')).records;
  })();
  const foodPriceRows = (() => {
    const p = path.join(calibrationDir, 'food-price-series.csv');
    if (!fs.existsSync(p)) return [];
    return parseCsv(fs.readFileSync(p, 'utf8')).records;
  })();
  const rentIncomeRows = (() => {
    const p = path.join(calibrationDir, 'rent-income-series.csv');
    if (!fs.existsSync(p)) return [];
    return parseCsv(fs.readFileSync(p, 'utf8')).records;
  })();

  const metricIdsWanted = [
    'grey_population_baseline',
    'grey_food_insecurity_2027_baseline_people',
    'grey_food_insecurity_2027_baseline_rate_pct',
    'grey_no_meaningful_food_growing_land_access_population',
    'food_for_10k_low_input_workers_year1',
    'food_for_10k_market_garden_workers_year1',
    'food_for_10k_household_growers_year1',
    'food_for_33k_low_input_workers_year1',
    'food_for_33k_market_garden_workers_year1',
    'food_for_33k_household_growers_year1',
    'hormuz_current_disruption_severe_added_food_insecurity_people'
  ];

  const numbersTable = metricIdsWanted
    .map((id) => {
      const metric = metrics.find((m) => m.metric_id === id);
      return toNumberRowFromMetric(metric, claimByMetric(claims, id));
    })
    .filter(Boolean);

  // Add required non-headline rows from calibration and overlay outputs.
  const charityRowsOntario = foodCharityRows.filter((r) => (r.geography ?? '').toLowerCase().includes('ontario'));
  const priceRowsOntario = foodPriceRows.filter((r) => (r.geography ?? '').toLowerCase().includes('ontario'));
  const wageRowsOntario = rentIncomeRows.filter((r) => (r.geography ?? '').toLowerCase().includes('ontario') && (r.indicator ?? '') === 'minimum_wage_hourly');

  const extraRows = [
    {
      metric_id: 'ontario_food_charity_calibration_rows',
      label: 'Ontario food charity calibration rows',
      value: charityRowsOntario.length,
      unit: 'rows',
      status: 'measured',
      confidence: 'moderate',
      public_use: 'article_with_caveat',
      caveat: 'Provincial proxy calibration rows, not Grey-specific measured series.',
      source_refs: [...new Set(charityRowsOntario.map((r) => r.source_ref).filter(Boolean))],
      scenario_refs: []
    },
    {
      metric_id: 'ontario_food_price_calibration_rows',
      label: 'Ontario food price calibration rows',
      value: priceRowsOntario.length,
      unit: 'rows',
      status: 'measured',
      confidence: 'moderate',
      public_use: 'article_with_caveat',
      caveat: 'Provincial proxy calibration row count.',
      source_refs: [...new Set(priceRowsOntario.map((r) => r.source_ref).filter(Boolean))],
      scenario_refs: []
    },
    {
      metric_id: 'ontario_minimum_wage_calibration_rows',
      label: 'Ontario minimum wage calibration rows',
      value: wageRowsOntario.length,
      unit: 'rows',
      status: 'measured',
      confidence: 'moderate',
      public_use: 'article_with_caveat',
      caveat: 'Provincial proxy calibration row count.',
      source_refs: [...new Set(wageRowsOntario.map((r) => r.source_ref).filter(Boolean))],
      scenario_refs: []
    },
    {
      metric_id: 'land_access_lot_fabric_feature_count',
      label: 'Land-access lot-fabric feature count',
      value: safeN(overlay.lotFabricFeatureCount, 0),
      unit: 'features',
      status: 'measured',
      confidence: 'moderate',
      public_use: 'article_with_caveat',
      caveat: 'Lot-fabric grounded proxy count; not household-level linkage.',
      source_refs: ['know/input/gis/lots-and-concessions-grey.geojson'],
      scenario_refs: []
    },
    {
      metric_id: 'land_access_lots_inside_settlement',
      label: 'Lots inside settlement boundaries',
      value: safeN(overlay.lotsInsideSettlementCount, 0),
      unit: 'lots',
      status: 'overlay',
      confidence: 'low_to_moderate',
      public_use: 'article_with_caveat',
      caveat: 'Overlay diagnostic only; does not identify household-level access.',
      source_refs: [path.join(produceDir, 'grey-land-access-gis-overlay-summary.json')],
      scenario_refs: []
    },
    {
      metric_id: 'land_access_lots_outside_settlement',
      label: 'Lots outside settlement boundaries',
      value: safeN(overlay.lotsOutsideSettlementCount, 0),
      unit: 'lots',
      status: 'overlay',
      confidence: 'low_to_moderate',
      public_use: 'article_with_caveat',
      caveat: 'Overlay diagnostic only; does not identify household-level access.',
      source_refs: [path.join(produceDir, 'grey-land-access-gis-overlay-summary.json')],
      scenario_refs: []
    }
  ];

  const forbiddenPhrasing = [
    'Grey County will have X food-insecure people by 2027',
    'X residents have no land access',
    'The GIS proves household land access',
    'Hormuz will cause X local outcome'
  ];

  const recommendedWording = {
    foodInsecurityTrend: 'This is a trend-extension estimate, not a forecast, based on stated assumptions and available calibration.',
    hormuzShock: 'Under the stated disruption scenario, modelled pressure outputs indicate potential added food-insecurity risk.',
    landAccess: 'The current GIS bridge provides a lot-fabric grounded proxy and partial ground-truth overlay, not household-level parcel-address-building linkage.',
    workerEstimates: 'These are planning-scale labour estimates derived from explicit energy/land productivity assumptions, not direct counts of people to be moved into work.'
  };

  const caveatsTable = [
    {
      topic: 'Trend baseline',
      caveat: 'Trend-extension estimate only; not a forecast.',
      applies_to: ['grey_food_insecurity_2027_baseline_people', 'grey_food_insecurity_2027_baseline_rate_pct']
    },
    {
      topic: 'Hormuz scenarios',
      caveat: 'Scenario outputs under explicit assumptions; not deterministic predictions.',
      applies_to: ['hormuz_current_disruption_severe_added_food_insecurity_people']
    },
    {
      topic: 'Land access',
      caveat: 'Partial ground-truth lot-fabric overlay; not household-level proof without parcel-address-building linkage.',
      applies_to: ['grey_no_meaningful_food_growing_land_access_population', 'land_access_lot_fabric_feature_count']
    },
    {
      topic: 'Worker estimates',
      caveat: 'Planning-scale physical production substitution estimates; not direct labour program requirements.',
      applies_to: [
        'food_for_10k_low_input_workers_year1',
        'food_for_10k_market_garden_workers_year1',
        'food_for_10k_household_growers_year1',
        'food_for_33k_low_input_workers_year1',
        'food_for_33k_market_garden_workers_year1',
        'food_for_33k_household_growers_year1'
      ]
    }
  ];

  const sourceAssumptionMap = {
    sourceFiles: article.sourceFiles ?? {},
    scenarioRefsPresent: [...new Set(metrics.flatMap((m) => m.scenario_refs ?? []))],
    calibrationCategories: calibrationSummary.categories ?? {},
    landAccessGroundtruthStatus: groundtruth.landAccessGroundtruthStatus ?? 'unknown',
    landAccessGroundtruthLimitations: groundtruth.limitations ?? []
  };

  const packet = {
    generated_at: new Date().toISOString(),
    executiveSummary: {
      totalClaims: claims.length,
      strongestClaimCount: strongClaims.length,
      caveatedClaimCount: caveatedClaims.length,
      exploratoryClaimCount: exploratoryClaims.length,
      doNotPublishCount: avoidClaims.length,
      note: 'This packet is a support artifact for human writing. It does not change model calculations.'
    },
    strongestUsableClaims: strongClaims,
    claimsUsableWithCaveats: caveatedClaims,
    exploratoryClaimsOnly: exploratoryClaims,
    claimsToAvoidOrSoften: avoidClaims,
    recommendedWordingSnippets: recommendedWording,
    unsafePhrasingToAvoid: forbiddenPhrasing,
    numbersTable: [...numbersTable, ...extraRows],
    caveatsTable,
    sourceAssumptionMap,
    remainingEvidenceGaps: {
      fromReadinessSummary: readinessText.split('\n').filter((line) => line.startsWith('- ') && /missing|gap|not|proxy|caveat/i.test(line)).slice(0, 20),
      keyGaps: [
        'Parcel-address-building linkage remains missing for household-level land access claims.',
        'Food charity / food price / rent-income calibration is provincial proxy, not direct local series.',
        'Worker-equivalent estimates remain partially uncalibrated against local productivity benchmarks.'
      ]
    }
  };

  const mdLines = [
    '# Grey Food Security Evidence Packet',
    '',
    '## Executive summary',
    `- total claims: ${packet.executiveSummary.totalClaims}`,
    `- strongest usable claims: ${packet.executiveSummary.strongestClaimCount}`,
    `- claims usable with caveats: ${packet.executiveSummary.caveatedClaimCount}`,
    `- exploratory claims only: ${packet.executiveSummary.exploratoryClaimCount}`,
    `- claims to avoid/soften: ${packet.executiveSummary.doNotPublishCount}`,
    `- note: ${packet.executiveSummary.note}`,
    '',
    '## Strongest usable claims',
    ...(strongClaims.length ? strongClaims.map((c) => `- ${c.claim_text}`) : ['- none currently classified as article_grade']),
    '',
    '## Claims usable with caveats',
    ...caveatedClaims.map((c) => `- ${c.claim_text} (${c.caveat || 'caveat required'})`),
    '',
    '## Exploratory claims only',
    ...exploratoryClaims.map((c) => `- ${c.claim_text}`),
    '',
    '## Claims to avoid or soften',
    ...(avoidClaims.length ? avoidClaims.map((c) => `- ${c.claim_text}`) : ['- none marked do_not_publish']),
    '',
    '## Recommended wording snippets',
    `- food insecurity trend: ${recommendedWording.foodInsecurityTrend}`,
    `- Hormuz shock: ${recommendedWording.hormuzShock}`,
    `- land access: ${recommendedWording.landAccess}`,
    `- worker estimates: ${recommendedWording.workerEstimates}`,
    '',
    '## Numbers table',
    '| Metric | Value | Unit | Status | Confidence | Public use | Caveat |',
    '|---|---:|---|---|---|---|---|',
    ...[...numbersTable, ...extraRows].map((r) => `| ${r.label} | ${typeof r.value === 'number' ? r.value : String(r.value)} | ${r.unit} | ${r.status} | ${r.confidence ?? ''} | ${r.public_use ?? ''} | ${r.caveat ?? ''} |`),
    '',
    '## Caveats table',
    '| Topic | Caveat | Applies to |',
    '|---|---|---|',
    ...caveatsTable.map((r) => `| ${r.topic} | ${r.caveat} | ${r.applies_to.join(', ')} |`),
    '',
    '## Source/assumption map',
    `- landAccessGroundtruthStatus: ${sourceAssumptionMap.landAccessGroundtruthStatus}`,
    `- scenario refs present: ${sourceAssumptionMap.scenarioRefsPresent.join(', ')}`,
    `- source files: ${Object.keys(sourceAssumptionMap.sourceFiles).length}`,
    '',
    '## Remaining evidence gaps',
    ...packet.remainingEvidenceGaps.keyGaps.map((g) => `- ${g}`),
    '',
    '## Unsafe phrasing to avoid',
    ...forbiddenPhrasing.map((p) => `- ${p}`)
  ];

  const jsonPath = path.join(outputDir, 'grey-food-security-evidence-packet.json');
  const mdPath = path.join(outputDir, 'grey-food-security-evidence-packet.md');
  fs.writeFileSync(jsonPath, JSON.stringify(packet, null, 2));
  fs.writeFileSync(mdPath, mdLines.join('\n'));

  return {
    status: failures.length ? 'fail' : 'pass',
    failures,
    warnings,
    paths: { jsonPath, mdPath },
    packet
  };
}
