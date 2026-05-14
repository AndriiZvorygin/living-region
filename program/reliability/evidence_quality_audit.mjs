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

const SOURCE_REQUIREMENT_FORECAST = {
  food_charity_series: {
    expected_readiness_after_import: 'article_with_caveat',
    reason: 'Direct local time series can strengthen risk-pressure calibration but still requires model caveats.'
  },
  food_price_series: {
    expected_readiness_after_import: 'article_with_caveat',
    reason: 'Local basket/CPI evidence improves affordability calibration but remains model-mediated.'
  },
  rent_income_series: {
    expected_readiness_after_import: 'article_with_caveat',
    reason: 'Household pressure calibration improves with local income/rent series.'
  },
  parcel_address_unit_linkage: {
    expected_readiness_after_import: 'article_with_caveat',
    reason: 'Direct parcel-address linkage materially improves land-access proxy credibility.'
  },
  local_grower_productivity_calibration: {
    expected_readiness_after_import: 'article_with_caveat',
    reason: 'Local productivity benchmarks reduce uncertainty in worker equivalents.'
  },
  crop_labour_benchmark_source: {
    expected_readiness_after_import: 'article_with_caveat',
    reason: 'Independent labour benchmarks reduce modality-labour assumption risk.'
  }
};

const LOCAL_SOURCE_CANDIDATES = [
  {
    candidate_id: 'gbph_cost_of_eating_well_2024',
    category: 'food_price_series',
    title: 'Grey Bruce Public Health Cost of Eating Well report',
    organization: 'Grey Bruce Public Health',
    geography: 'Grey-Bruce',
    likely_quality_tier: 'regional_proxy',
    likely_indicators: ['nutritious_food_basket_monthly_cost', 'percent_change'],
    access_method: 'public_download',
    import_readiness: 'ready_to_import',
    notes: 'Public report references Ontario Nutritious Food Basket methodology.',
    expected_claim_impact: 'Improves food insecurity affordability calibration.'
  },
  {
    candidate_id: 'foodbrucegrey_app_timeseries',
    category: 'food_charity_series',
    title: 'FoodBruceGrey app program-level aggregate usage',
    organization: 'United Way of Bruce Grey',
    geography: 'Grey-Bruce',
    likely_quality_tier: 'direct_local',
    likely_indicators: ['meals_served', 'households_served', 'visits'],
    access_method: 'request_required',
    import_readiness: 'needs_request',
    notes: 'Likely strongest local food charity series if extractable as CSV.',
    expected_claim_impact: 'Can upgrade food insecurity pressure calibration quality.'
  },
  {
    candidate_id: 'owen_sound_hunger_relief_annual_usage',
    category: 'food_charity_series',
    title: 'Owen Sound Hunger and Relief Effort annual usage',
    organization: 'OSHaRE / local meal providers',
    geography: 'Owen Sound',
    likely_quality_tier: 'direct_local',
    likely_indicators: ['meals_served', 'unique_clients'],
    access_method: 'request_required',
    import_readiness: 'needs_request',
    notes: 'Local direct-use statistics likely available via annual reports or direct request.',
    expected_claim_impact: 'Improves claim specificity for local household food stress.'
  },
  {
    candidate_id: 'cmhc_owen_sound_rent_table',
    category: 'rent_income_series',
    title: 'CMHC rental market table for Owen Sound area',
    organization: 'CMHC',
    geography: 'Owen Sound / nearby rental market area',
    likely_quality_tier: 'regional_proxy',
    likely_indicators: ['average_rent', 'median_rent'],
    access_method: 'public_download',
    import_readiness: 'needs_manual_review',
    notes: 'Requires careful geography mapping to Grey/Owen Sound.',
    expected_claim_impact: 'Strengthens rent-income pressure calibration.'
  },
  {
    candidate_id: 'statcan_shelter_cost_income_ontario',
    category: 'rent_income_series',
    title: 'StatCan shelter-cost-to-income ratio table',
    organization: 'Statistics Canada',
    geography: 'Ontario',
    likely_quality_tier: 'provincial_proxy',
    likely_indicators: ['shelter_cost_to_income_ratio', 'low_income_measure_rate'],
    access_method: 'public_download',
    import_readiness: 'ready_to_import',
    notes: 'Useful fallback where local series unavailable.',
    expected_claim_impact: 'Adds policy pressure context; still caveated at provincial level.'
  },
  {
    candidate_id: 'grey_county_parcel_address_export',
    category: 'parcel_address_unit_linkage',
    title: 'Grey County parcel-address-building-unit linkage export',
    organization: 'Grey County GIS / municipalities',
    geography: 'Grey County',
    likely_quality_tier: 'direct_local',
    likely_indicators: ['parcel_area', 'dwelling_units', 'address_points'],
    access_method: 'request_required',
    import_readiness: 'needs_request',
    notes: 'Highest-value upgrade for strict land-access claims.',
    expected_claim_impact: 'Could materially improve land-access claim readiness.'
  },
  {
    candidate_id: 'municipal_open_data_address_points',
    category: 'parcel_address_unit_linkage',
    title: 'Municipal address points + building footprints',
    organization: 'Owen Sound / lower-tier municipalities',
    geography: 'Municipal',
    likely_quality_tier: 'direct_local',
    likely_indicators: ['address_points', 'building_footprints'],
    access_method: 'public_download',
    import_readiness: 'needs_manual_review',
    notes: 'Requires schema harmonization across municipalities.',
    expected_claim_impact: 'Improves spatial assignment precision for household land access.'
  },
  {
    candidate_id: 'grey_bruce_public_health_food_affordability_series',
    category: 'food_price_series',
    title: 'Grey-Bruce food affordability annual/public-health series',
    organization: 'Grey Bruce Public Health',
    geography: 'Grey-Bruce',
    likely_quality_tier: 'regional_proxy',
    likely_indicators: ['nutritious_food_basket_monthly_cost'],
    access_method: 'public_webpage',
    import_readiness: 'ready_to_import',
    notes: 'Likely easiest near-term upgrade from provincial to regional proxy.',
    expected_claim_impact: 'Directly supports food insecurity baseline calibration.'
  },
  {
    candidate_id: 'grey_local_grower_records_pilot',
    category: 'local_grower_productivity_calibration',
    title: 'Pilot local grower yield/labour logs',
    organization: 'Local growers / extension partners',
    geography: 'Grey County',
    likely_quality_tier: 'direct_local',
    likely_indicators: ['GJ_per_ha', 'ha_per_worker', 'GJ_per_worker'],
    access_method: 'internal_manual_entry',
    import_readiness: 'needs_request',
    notes: 'Requires data-sharing agreements and normalization protocol.',
    expected_claim_impact: 'High impact for food-gap worker estimates.'
  },
  {
    candidate_id: 'omafra_or_extension_crop_labour_benchmarks',
    category: 'crop_labour_benchmark_source',
    title: 'Ontario crop labour benchmark datasets',
    organization: 'OMAFRA / extension sources',
    geography: 'Ontario',
    likely_quality_tier: 'provincial_proxy',
    likely_indicators: ['labour_hours_per_ha', 'yield_per_ha'],
    access_method: 'public_download',
    import_readiness: 'needs_manual_review',
    notes: 'Can anchor modality assumptions until direct local benchmarks are available.',
    expected_claim_impact: 'Reduces worker-equivalent uncertainty with caveat.'
  }
];

function calibrationStatusForMetric(metricId, calibrationSummary) {
  const required = CALIBRATION_REQUIREMENTS[metricId] ?? [];
  if (!required.length) return { calibration_status: 'calibrated', missing_calibration_refs: [], calibration_quality: 'none' };
  const categories = calibrationSummary?.categories ?? {};
  const loadedRefs = new Set();
  const qualityByRef = new Map();
  if ((categories.food_charity?.data_points ?? 0) > 0) {
    loadedRefs.add('food_charity_series');
    qualityByRef.set('food_charity_series', categories.food_charity.strongest_quality_tier ?? 'unknown');
  }
  if ((categories.food_price?.data_points ?? 0) > 0) {
    loadedRefs.add('food_price_series');
    qualityByRef.set('food_price_series', categories.food_price.strongest_quality_tier ?? 'unknown');
  }
  if ((categories.rent_income?.data_points ?? 0) > 0) {
    loadedRefs.add('rent_income_series');
    qualityByRef.set('rent_income_series', categories.rent_income.strongest_quality_tier ?? 'unknown');
  }
  const missing = required.filter((x) => !loadedRefs.has(x));
  const status = missing.length === 0 ? 'calibrated' : (missing.length === required.length ? 'uncalibrated' : 'partially_calibrated');
  const tierOrder = ['none', 'scenario_only', 'national_proxy', 'provincial_proxy', 'regional_proxy', 'direct_local'];
  const presentTiers = required
    .filter((x) => loadedRefs.has(x))
    .map((x) => qualityByRef.get(x) ?? 'unknown')
    .map((t) => (t === 'unknown' ? 'none' : t));
  const bestTier = presentTiers.length
    ? presentTiers.sort((a, b) => tierOrder.indexOf(a) - tierOrder.indexOf(b)).at(-1)
    : 'none';
  return { calibration_status: status, missing_calibration_refs: missing, calibration_quality: bestTier };
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

function applyCalibrationQualityRule(claim) {
  const q = claim.calibration_quality ?? 'none';
  if (q === 'none') return;
  if (q === 'scenario_only') {
    if (claim.public_use === 'article_grade') claim.public_use = 'article_with_caveat';
    return;
  }
  if (q === 'national_proxy' || q === 'provincial_proxy') {
    if (claim.public_use === 'article_grade') claim.public_use = 'article_with_caveat';
    return;
  }
  if (q === 'regional_proxy') {
    if (claim.public_use === 'do_not_publish') return;
    if (claim.public_use === 'exploratory_only') claim.public_use = 'article_with_caveat';
    return;
  }
  if (q === 'direct_local') {
    if (claim.claim_status === 'measured' && claim.evidence_strength === 'high') {
      claim.public_use = 'article_grade';
    } else if (claim.public_use === 'exploratory_only') {
      claim.public_use = 'article_with_caveat';
    }
  }
}

function candidateScore(c) {
  const tierScore = { direct_local: 5, regional_proxy: 4, provincial_proxy: 3, national_proxy: 2, scenario_only: 1, unknown: 1 }[c.likely_quality_tier] ?? 1;
  const importScore = { ready_to_import: 4, needs_manual_review: 3, needs_request: 2, unsuitable: 0 }[c.import_readiness] ?? 0;
  const accessScore = { public_download: 4, public_webpage: 3, request_required: 2, internal_manual_entry: 1 }[c.access_method] ?? 0;
  return tierScore * 2 + importScore + accessScore;
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
    claim.calibration_quality = calibration.calibration_quality;

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
    applyCalibrationQualityRule(claim);
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
      missing_calibration_refs: [],
      calibration_quality: 'none'
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
    '| Claim ID | Status | Evidence | Public use | Calibration | Quality | Caveat |',
    '|---|---|---|---|---|---|---|',
    ...claims.map((c) => `| ${c.claim_id} | ${c.claim_status} | ${c.evidence_strength} | ${c.public_use} | ${c.calibration_status ?? 'n/a'} | ${c.calibration_quality ?? 'none'} | ${c.caveat || ''} |`)
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
  const calibrationRows = Object.values(calibrationSummary?.categories ?? {});
  const missingToClaims = new Map();
  for (const claim of claims) {
    for (const ref of claim.missing_calibration_refs ?? []) {
      if (!missingToClaims.has(ref)) missingToClaims.set(ref, []);
      missingToClaims.get(ref).push(claim.claim_id);
    }
  }
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
    '## Highest-impact missing sources',
    '| Missing source | Affected claims | Current readiness | Expected readiness after import | Reason |',
    '|---|---|---|---|---|',
    ...(specificCalibrationGaps.length
      ? specificCalibrationGaps.map((g) => {
        const claimIds = [...new Set((missingToClaims.get(g) ?? []))];
        const currentReadiness = [...new Set(
          claims
            .filter((c) => claimIds.includes(c.claim_id))
            .map((c) => c.public_use)
        )].join('; ') || 'n/a';
        const forecast = SOURCE_REQUIREMENT_FORECAST[g] ?? {
          expected_readiness_after_import: 'article_with_caveat',
          reason: 'Additional calibration expected to improve caveated readiness.'
        };
        return `| ${g} | ${claimIds.join(', ') || 'n/a'} | ${currentReadiness} | ${forecast.expected_readiness_after_import} | ${forecast.reason} |`;
      })
      : ['| none | n/a | n/a | n/a | n/a |']),
    '',
    '## Local calibration status',
    '| Category | Data points | Strongest quality tier | Claim impact | Remaining gap |',
    '|---|---:|---|---|---|',
    ...(calibrationRows.length
      ? calibrationRows.map((c) => {
        const impact = c.data_points > 0
          ? (c.strongest_quality_tier === 'direct_local' ? 'can strengthen local claims' : 'supports caveated calibration only')
          : 'no claim impact yet';
        const gap = c.data_points > 0 ? `upgrade toward direct_local where possible` : 'collect source-backed rows';
        return `| ${c.category} | ${c.data_points} | ${c.strongest_quality_tier ?? 'none'} | ${impact} | ${gap} |`;
      })
      : ['| none | 0 | none | no claim impact yet | collect source-backed rows |']),
    '',
    '## Top 5 evidence gaps',
    ...topEvidenceGaps.map((g) => `- ${g}`),
    '',
    '## Top 5 wording changes',
    ...topWordingChanges.map((g) => `- ${g}`)
  ].join('\n'));

  const wordingPath = path.join(qaDir, 'wording-risk-report.json');
  fs.writeFileSync(wordingPath, JSON.stringify({ generated_at: new Date().toISOString(), risks: wordingRisks }, null, 2));

  const candidatesByCategory = {};
  for (const c of LOCAL_SOURCE_CANDIDATES) {
    if (!candidatesByCategory[c.category]) candidatesByCategory[c.category] = [];
    candidatesByCategory[c.category].push(c);
  }
  const candidateJsonPath = path.join(qaDir, 'local-source-candidates.json');
  fs.writeFileSync(candidateJsonPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    categories: candidatesByCategory,
    candidates: LOCAL_SOURCE_CANDIDATES
  }, null, 2));
  const candidateMdPath = path.join(qaDir, 'local-source-candidates.md');
  const categoryOrder = [
    'food_charity_series',
    'food_price_series',
    'rent_income_series',
    'parcel_address_unit_linkage',
    'local_grower_productivity_calibration',
    'crop_labour_benchmark_source'
  ];
  fs.writeFileSync(candidateMdPath, [
    '# Local Source Candidates',
    '',
    ...categoryOrder.flatMap((category) => {
      const rows = candidatesByCategory[category] ?? [];
      return [
        `## ${category}`,
        '',
        '| Candidate | Organization | Geography | Tier | Access | Readiness | Impact |',
        '|---|---|---|---|---|---|---|',
        ...(rows.length
          ? rows.map((r) => `| ${r.candidate_id} | ${r.organization} | ${r.geography} | ${r.likely_quality_tier} | ${r.access_method} | ${r.import_readiness} | ${r.expected_claim_impact} |`)
          : ['| none | n/a | n/a | n/a | n/a | n/a | n/a |']),
        ''
      ];
    })
  ].join('\n'));

  const priority = [...LOCAL_SOURCE_CANDIDATES]
    .map((c) => ({ ...c, priority_score: candidateScore(c) }))
    .sort((a, b) => b.priority_score - a.priority_score)
    .slice(0, 10);
  const priorityPath = path.join(qaDir, 'local-source-priority.md');
  fs.writeFileSync(priorityPath, [
    '# Local Source Priority',
    '',
    '| Rank | Candidate | Category | Tier | Import readiness | Access | Score | Why now |',
    '|---:|---|---|---|---|---|---:|---|',
    ...priority.map((r, i) => `| ${i + 1} | ${r.title} | ${r.category} | ${r.likely_quality_tier} | ${r.import_readiness} | ${r.access_method} | ${r.priority_score} | ${r.expected_claim_impact} |`)
  ].join('\n'));

  return {
    status: failures.length ? 'fail' : 'pass',
    failures,
    warnings,
    outputs: {
      claimInventoryJson: invJsonPath,
      claimInventoryMd: invMdPath,
      redTeamMd: redTeamPath,
      articleReadinessMd: readinessPath,
      wordingRiskJson: wordingPath,
      localSourceCandidatesJson: candidateJsonPath,
      localSourceCandidatesMd: candidateMdPath,
      localSourcePriorityMd: priorityPath
    },
    claimCount: claims.length
  };
}
