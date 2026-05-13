// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';

function n(v, fallback = 0) { const x = Number(v); return Number.isFinite(x) ? x : fallback; }
function within(a, b, tol) { return Math.abs(a - b) <= tol; }

function readJson(filePath, failures, label) {
  const p = path.resolve(filePath);
  if (!fs.existsSync(p)) {
    failures.push(`Missing required JSON for invariant check: ${label} (${p})`);
    return null;
  }
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (error) {
    failures.push(`Invalid JSON for invariant check: ${label} (${error.message})`);
    return null;
  }
}

export function runInvariantChecks(options = {}) {
  const produceDir = path.resolve(options.produceDir ?? 'know/produce');
  const tolerancePopulation = n(options.tolerancePopulation, 0.5);
  const toleranceWorkers = n(options.toleranceWorkers, 0.5);
  const failures = [];
  const warnings = [];

  const population = readJson(path.join(produceDir, 'grey-population-distribution.json'), failures, 'population distribution');
  const dwelling = readJson(path.join(produceDir, 'grey-dwelling-land-access.json'), failures, 'dwelling land access');
  const trend = readJson(path.join(produceDir, 'grey-food-insecurity-trend-projection.json'), failures, 'trend projection');
  const article = readJson(path.join(produceDir, 'grey-hormuz-food-security-article-data.json'), failures, 'hormuz article data');
  const gap = readJson(path.join(produceDir, 'grey-food-gap-replacement.json'), failures, 'food gap replacement');

  if (!population || !dwelling || !trend || !article || !gap) {
    return { status: 'fail', failures, warnings };
  }

  const popA = n(population.totalPopulationMatched);
  const popB = n(dwelling.totalPopulation);
  if (!within(popA, popB, tolerancePopulation)) {
    failures.push(`Population mismatch: distribution=${popA} dwelling=${popB}`);
  }

  const articleTrend = article.foodInsecurityTrendProjection;
  if (!articleTrend) {
    failures.push('Article data missing foodInsecurityTrendProjection block');
  } else {
    if (!within(n(articleTrend.preferred2027ProjectedPeople), n(trend.articlePreferredProjection?.projected2027People), 1)) {
      failures.push('Trend projection mismatch between article and trend report');
    }
  }

  const target10 = (article.physicalLocalFoodResponseTargets ?? []).find((x) => x.scenario === 'foodGap10');
  const gap10Field = (gap.modalityReplacementMatrix ?? []).find((x) => x.scenario === 'foodGap10' && x.modality === 'lowInputAnnualField');
  const gap10Market = (gap.modalityReplacementMatrix ?? []).find((x) => x.scenario === 'foodGap10' && x.modality === 'marketGardenIntensive');
  const gap10House = (gap.modalityReplacementMatrix ?? []).find((x) => x.scenario === 'foodGap10' && x.modality === 'handToolHouseholdGarden');
  if (!target10 || !gap10Field || !gap10Market || !gap10House) {
    failures.push('Missing foodGap10 comparison rows for invariant check');
  } else {
    if (!within(n(target10.modes?.lowInputAnnualField?.requiredGrowers), n(gap10Field.requiredWorkersYear1), toleranceWorkers)) failures.push('foodGap10 low-input worker mismatch');
    if (!within(n(target10.modes?.marketGardenIntensive?.requiredGrowers), n(gap10Market.requiredWorkersYear1), toleranceWorkers)) failures.push('foodGap10 market-garden worker mismatch');
    if (!within(n(target10.modes?.handToolHouseholdGarden?.requiredGrowers), n(gap10House.requiredWorkersYear1), toleranceWorkers)) failures.push('foodGap10 household worker mismatch');
  }

  const scenarios = article.hormuzCurrentDisruptionScenarios ?? [];
  const duplicateScenario = scenarios.find((s, i) => scenarios.findIndex((x) => x.scenario === s.scenario) !== i);
  if (duplicateScenario) failures.push(`Duplicate scenario id in article data: ${duplicateScenario.scenario}`);

  return {
    status: failures.length ? 'fail' : 'pass',
    failures,
    warnings,
    checks: {
      population_baseline: { distribution: popA, dwelling: popB },
      trend_projection_people: {
        article: n(articleTrend?.preferred2027ProjectedPeople),
        trend_report: n(trend.articlePreferredProjection?.projected2027People)
      }
    }
  };
}
