// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';

function n(v, fallback = 0) { const x = Number(v); return Number.isFinite(x) ? x : fallback; }

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
function readText(filePath) {
  const p = path.resolve(filePath);
  if (!fs.existsSync(p)) return null;
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}
function readJsonIfExists(filePath, fallback = null) {
  const p = path.resolve(filePath);
  if (!fs.existsSync(p)) return fallback;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function classifySourceRef(ref, sourceManifestMap) {
  const abs = path.resolve(ref);
  const hit = sourceManifestMap.get(abs);
  if (hit) return hit.source_class;
  if (abs.includes(path.resolve('know/produce')) || abs.includes(path.resolve('output/'))) return 'generated_derived_output';
  return 'unknown';
}

function evidenceStrength(status, sourceClasses) {
  const hasStrongSource = sourceClasses.includes('external_snapshot') || sourceClasses.includes('manual_curated_input');
  if (status === 'measured') return hasStrongSource ? 'high' : 'medium';
  if (status === 'proxy') return hasStrongSource ? 'medium' : 'low';
  if (status === 'scenario_assumption') return 'low';
  if (status === 'scenario_output') return hasStrongSource ? 'medium' : 'low';
  return 'low';
}

function publicUseForClaim(claim) {
  if (claim.claim_status === 'scenario_assumption') return 'exploratory_only';
  if (claim.evidence_strength === 'unsupported') return 'do_not_publish';
  if (claim.claim_status === 'measured' && claim.evidence_strength === 'high') return 'article_grade';
  if (claim.claim_status === 'scenario_output' || claim.claim_status === 'proxy' || claim.claim_status === 'interpretation') return 'article_with_caveat';
  return 'exploratory_only';
}

function recommendedWording(claim) {
  if (claim.claim_status === 'measured') return 'Measured value from cited source snapshot.';
  if (claim.claim_status === 'proxy') return 'Proxy estimate; include method and limits.';
  if (claim.claim_status === 'scenario_output') return 'Scenario output under explicit assumptions; not a forecast.';
  if (claim.claim_status === 'scenario_assumption') return 'Assumption input for scenario testing; not observed data.';
  return 'Interpretive statement; keep conditional wording and caveats.';
}

const CALIBRATION_REQUIREMENTS = {
  grey_food_insecurity_2027_baseline_people: ['food_charity_series', 'food_price_series', 'rent_income_series'],
  grey_food_insecurity_2027_baseline_rate_pct: ['food_charity_series', 'food_price_series', 'rent_income_series'],
  hormuz_current_disruption_severe_added_food_insecurity_people: ['food_charity_series', 'food_price_series', 'rent_income_series'],
  grey_no_meaningful_food_growing_land_access_population: ['parcel_address_unit_linkage'],
  food_for_10k_low_input_workers_year1: ['local_grower_productivity_calibration', 'crop_labour_benchmark_source'],
  food_for_10k_market_garden_workers_year1: ['local_grower_productivity_calibration', 'crop_labour_benchmark_source'],
  food_for_10k_household_growers_year1: ['local_grower_productivity_calibration', 'crop_labour_benchmark_source'],
  food_for_33k_low_input_workers_year1: ['local_grower_productivity_calibration', 'crop_labour_benchmark_source'],
  food_for_33k_market_garden_workers_year1: ['local_grower_productivity_calibration', 'crop_labour_benchmark_source'],
  food_for_33k_household_growers_year1: ['local_grower_productivity_calibration', 'crop_labour_benchmark_source']
};

function calibrationStatusForMetric(metricId, calibrationSummary) {
  const required = CALIBRATION_REQUIREMENTS[metricId] ?? [];
  if (!required.length) return { calibration_status: 'calibrated', missing_calibration_refs: [] };
  const categories = calibrationSummary?.categories ?? {};
  const loadedRefs = new Set();
  if ((categories.food_charity?.data_points ?? 0) > 0) loadedRefs.add('food_charity_series');
  if ((categories.food_price?.data_points ?? 0) > 0) loadedRefs.add('food_price_series');
  if ((categories.rent_income?.data_points ?? 0) > 0) loadedRefs.add('rent_income_series');
  const missing = required.filter((x) => !loadedRefs.has(x));
  const status = missing.length === 0 ? 'calibrated' : (missing.length === required.length ? 'uncalibrated' : 'partially_calibrated');
  return { calibration_status: status, missing_calibration_refs: missing };
}

const RISKY_PHRASES = [
  /\bwill rise\b/i,
  /\bwill cause\b/i,
  /\bexpected to\b/i,
  /\bforecast\b/i,
  /\bproven\b/i,
  /\bshows that\b/i,
  /\bdemonstrates that\b/i
];

function isSafeForecastContext(line) {
  const text = String(line ?? '').toLowerCase();
  return text.includes('not a forecast')
    || text.includes('not an official forecast')
    || /\bnot\b.{0,20}\bforecast\b/i.test(text)
    || text.includes('scenario, not forecast')
    || text.includes('trend scenario, not forecast')
    || text.includes('trend projection, not forecast');
}

export function buildEvidenceQualityAudit(options = {}) {
  const produceDir = path.resolve(options.produceDir ?? 'know/produce');
  const qaDir = path.resolve(options.qaDir ?? 'output/qa');
  fs.mkdirSync(qaDir, { recursive: true });

  const failures = [];
  const warnings = [];

  const articlePath = path.join(produceDir, 'grey-hormuz-food-security-article-data.json');
  const article = readJson(articlePath, failures, 'article report', null);
  const calibrationSummary = readJsonIfExists(path.join(produceDir, 'local-calibration-summary.json'), { categories: {} });
  const metricRegistry = readJson(options.metricRegistryPath ?? 'know/metric-registry.json', failures, 'metric registry', { metrics: [] });
  const sourceManifest = readJson(options.sourceManifestPath ?? 'know/source-manifest.json', failures, 'source manifest', { entries: [] });
  if (!article) {
    return { status: 'fail', failures, warnings };
  }

  const sourceManifestMap = new Map((sourceManifest.entries ?? []).map((e) => [path.resolve(e.local_path), e]));

  const metricRegistryIds = new Set((metricRegistry.metrics ?? []).map((m) => m.metric_id));
  const claims = [];

  for (const metric of article.headlineMetrics ?? []) {
    const sourceClasses = (metric.source_refs ?? []).map((r) => classifySourceRef(r, sourceManifestMap));
    const claim = {
      claim_id: `metric:${metric.metric_id}`,
      claim_text: `${metric.label}: ${n(metric.value).toFixed(2)} ${metric.unit}`,
      report_path: articlePath,
      metric_refs: [metric.metric_id],
      source_refs: metric.source_refs ?? [],
      source_classes: sourceClasses,
      scenario_refs: metric.scenario_refs ?? [],
      claim_status: metric.status ?? 'scenario_output',
      evidence_strength: evidenceStrength(metric.status, sourceClasses),
      public_use: 'exploratory_only',
      caveat: metric.not_forecast === true ? 'not a forecast' : (metric.status === 'proxy' ? 'proxy estimate with uncertainty bounds' : ''),
      recommended_wording: ''
    };
    const calibration = calibrationStatusForMetric(metric.metric_id, calibrationSummary);
    claim.calibration_status = calibration.calibration_status;
    claim.missing_calibration_refs = calibration.missing_calibration_refs;

    // Guard against circular confidence.
    const hasStrongSource = sourceClasses.includes('external_snapshot') || sourceClasses.includes('manual_curated_input');
    if (!hasStrongSource && claim.public_use === 'article_grade') {
      warnings.push(`Claim ${claim.claim_id} downgraded: generated-only source chain.`);
    }
    if ((claim.claim_status === 'scenario_output' || claim.claim_status === 'scenario_assumption') && metric.not_forecast !== true) {
      warnings.push(`Scenario claim ${claim.claim_id} missing explicit not_forecast=true.`);
    }
    if (claim.claim_status === 'proxy' && !claim.caveat) {
      warnings.push(`Proxy claim ${claim.claim_id} missing caveat text.`);
    }

    claim.public_use = publicUseForClaim(claim);
    if (!hasStrongSource && claim.public_use === 'article_grade') claim.public_use = 'article_with_caveat';
    claim.recommended_wording = recommendedWording(claim);

    // Guard against obviously implausible zero headline values for baseline-style public metrics.
    if (
      ['grey_population_baseline', 'grey_food_insecurity_2027_baseline_people', 'grey_no_meaningful_food_growing_land_access_population'].includes(metric.metric_id)
      && n(metric.value) <= 0
    ) {
      failures.push(`Headline metric ${metric.metric_id} has non-positive value (${metric.value}); likely missing upstream input/cached source.`);
      claim.evidence_strength = 'unsupported';
      claim.public_use = 'do_not_publish';
      claim.caveat = [claim.caveat, 'invalid-zero-value'].filter(Boolean).join('; ');
    }
    claims.push(claim);

    if (!metricRegistryIds.has(metric.metric_id)) {
      warnings.push(`Headline metric not found in metric registry: ${metric.metric_id}`);
    }
  }

  for (const id of metricRegistryIds) {
    if (!(article.headlineMetrics ?? []).some((m) => m.metric_id === id)) {
      warnings.push(`Registry metric not emitted in article output: ${id}`);
    }
  }

  for (const [i, text] of (article.articleHeadlineFacts ?? []).entries()) {
    claims.push({
      claim_id: `headline:${i + 1}`,
      claim_text: text,
      report_path: articlePath,
      metric_refs: [],
      source_refs: article.sourceFiles ? Object.values(article.sourceFiles) : [],
      source_classes: article.sourceFiles ? Object.values(article.sourceFiles).map((r) => classifySourceRef(r, sourceManifestMap)) : [],
      scenario_refs: ['baseline', 'hormuz_shock_low', 'hormuz_shock_central', 'hormuz_shock_high'],
      claim_status: 'interpretation',
      evidence_strength: 'medium',
      public_use: 'article_with_caveat',
      caveat: 'Interpretive summary statement.',
      recommended_wording: 'Use conditional language and keep uncertainty visible.',
      calibration_status: 'partially_calibrated',
      missing_calibration_refs: []
    });
  }

  // Wording risk scan over generated markdown.
  const markdownTargets = [
    path.join(produceDir, 'grey-hormuz-food-security-article-data.md'),
    path.join(produceDir, 'grey-food-insecurity-trend-projection.md'),
    path.join(produceDir, 'grey-current-system-shock-threshold.md'),
    path.join(produceDir, 'grey-plain-english-briefing.md')
  ];
  const wordingRisks = [];
  for (const mdPath of markdownTargets) {
    const text = readText(mdPath);
    if (!text) continue;
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      for (const rx of RISKY_PHRASES) {
        if (rx.test(lines[i])) {
          if (rx.source === '\\bforecast\\b' && isSafeForecastContext(lines[i])) continue;
          wordingRisks.push({ file: mdPath, line: i + 1, phrase: rx.toString(), text: lines[i].trim() });
        }
      }
    }
  }
  for (const risk of wordingRisks) {
    if (/^\-\s/.test(risk.text) && /headline facts/i.test(readText(risk.file)?.slice(Math.max(0, risk.line - 200), risk.line + 200) ?? '')) {
      failures.push(`Forbidden certainty phrase in headline claim: ${risk.file}:${risk.line} "${risk.text}"`);
    } else {
      warnings.push(`Wording risk: ${risk.file}:${risk.line} ${risk.text}`);
    }
  }

  const grouped = {
    strongest: claims.filter((c) => c.evidence_strength === 'high' && c.public_use === 'article_grade'),
    needsCaveats: claims.filter((c) => c.public_use === 'article_with_caveat'),
    proxyDependent: claims.filter((c) => c.claim_status === 'proxy'),
    scenarioDependent: claims.filter((c) => c.claim_status === 'scenario_output' || c.claim_status === 'scenario_assumption'),
    needsLocalCalibration: claims.filter((c) => c.calibration_status === 'uncalibrated' || c.calibration_status === 'partially_calibrated'),
    softenBeforePublication: claims.filter((c) => c.claim_status === 'interpretation' || c.evidence_strength === 'low'),
    avoidUntilBetterEvidence: claims.filter((c) => c.public_use === 'do_not_publish' || c.evidence_strength === 'unsupported')
  };

  const topEvidenceGaps = [
    'No external-snapshot chain for key produced metrics (currently derived from generated reports).',
    'Local food bank/soup kitchen time series still not integrated for direct trend calibration.',
    'Grey/Ontario food basket price time series not integrated into causal calibration.',
    'Parcel/address-level land-access ground truth still proxy-based.',
    'Scenario channel weights for fertilizer/sulfur/phosphate remain assumption-heavy.'
  ];
  const specificCalibrationGaps = [...new Set(claims.flatMap((c) => c.missing_calibration_refs ?? []))].sort();
  const topWordingChanges = [
    'Prefer "trend-extension estimate" over "projected" in public summary bullets.',
    'Use "scenario output" explicitly for all shock-band outcomes.',
    'Use "under this assumption" for labour replacement counts.',
    'Keep "not a forecast" adjacent to every scenario headline statement.',
    'Avoid causal verbs (will cause/demonstrates) in headline claims.'
  ];

  const claimInventory = {
    generated_at: new Date().toISOString(),
    claim_count: claims.length,
    claims
  };
  const invJsonPath = path.join(qaDir, 'claim-inventory.json');
  const invMdPath = path.join(qaDir, 'claim-inventory.md');
  fs.writeFileSync(invJsonPath, JSON.stringify(claimInventory, null, 2));
  fs.writeFileSync(invMdPath, [
    '# Claim Inventory',
    '',
    `- claims: ${claims.length}`,
    '',
    '| Claim ID | Status | Evidence | Public use | Calibration | Caveat |',
    '|---|---|---|---|---|---|',
    ...claims.map((c) => `| ${c.claim_id} | ${c.claim_status} | ${c.evidence_strength} | ${c.public_use} | ${c.calibration_status ?? 'n/a'} | ${c.caveat || ''} |`)
  ].join('\n'));

  const redTeamPath = path.join(qaDir, 'red-team-claims.md');
  fs.writeFileSync(redTeamPath, [
    '# Red-Team Claims Review',
    '',
    '## Strongest claims',
    ...grouped.strongest.map((c) => `- ${c.claim_text}`),
    '',
    '## Claims requiring caveats',
    ...grouped.needsCaveats.map((c) => `- ${c.claim_text}`),
    '',
    '## Proxy-dependent claims',
    ...grouped.proxyDependent.map((c) => `- ${c.claim_text}`),
    '',
    '## Scenario-dependent claims',
    ...grouped.scenarioDependent.map((c) => `- ${c.claim_text}`),
    '',
    '## Claims that need local calibration data',
    ...grouped.needsLocalCalibration.map((c) => `- ${c.claim_text} (missing: ${(c.missing_calibration_refs ?? []).join(', ') || 'n/a'})`),
    '',
    '## Claims that should be softened before publication',
    ...grouped.softenBeforePublication.map((c) => `- ${c.claim_text}`),
    '',
    '## Claims to avoid until better evidence exists',
    ...grouped.avoidUntilBetterEvidence.map((c) => `- ${c.claim_text}`)
  ].join('\n'));

  const readinessPath = path.join(qaDir, 'article-readiness-summary.md');
  fs.writeFileSync(readinessPath, [
    '# Article Readiness Summary',
    '',
    '## Ready for public use',
    ...claims.filter((c) => c.public_use === 'article_grade').map((c) => `- ${c.claim_text}`),
    '',
    '## Needs caveats',
    ...claims.filter((c) => c.public_use === 'article_with_caveat').map((c) => `- ${c.claim_text}`),
    '',
    '## Needs better local data',
    ...grouped.needsLocalCalibration.map((c) => `- ${c.claim_text} (missing: ${(c.missing_calibration_refs ?? []).join(', ') || 'n/a'})`),
    '',
    '## Specific calibration gaps',
    ...(specificCalibrationGaps.length ? specificCalibrationGaps.map((g) => `- ${g}`) : ['- none']),
    '',
    '## Top 5 evidence gaps',
    ...topEvidenceGaps.map((g) => `- ${g}`),
    '',
    '## Top 5 wording changes',
    ...topWordingChanges.map((g) => `- ${g}`)
  ].join('\n'));

  const wordingPath = path.join(qaDir, 'wording-risk-report.json');
  fs.writeFileSync(wordingPath, JSON.stringify({ generated_at: new Date().toISOString(), risks: wordingRisks }, null, 2));

  return {
    status: failures.length ? 'fail' : 'pass',
    failures,
    warnings,
    outputs: {
      claimInventoryJson: invJsonPath,
      claimInventoryMd: invMdPath,
      redTeamMd: redTeamPath,
      articleReadinessMd: readinessPath,
      wordingRiskJson: wordingPath
    },
    claimCount: claims.length
  };
}
