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
function readText(filePath, failures, label) {
  const p = path.resolve(filePath);
  if (!fs.existsSync(p)) {
    failures.push(`Missing required text for invariant check: ${label} (${p})`);
    return null;
  }
  try { return fs.readFileSync(p, 'utf8'); }
  catch (error) {
    failures.push(`Failed to read text for invariant check: ${label} (${error.message})`);
    return null;
  }
}
function readCsvRows(filePath, failures, label) {
  const text = readText(filePath, failures, label);
  if (!text) return [];
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cols[i]; });
    return obj;
  });
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
  const articleMd = readText(path.join(produceDir, 'grey-hormuz-food-security-article-data.md'), failures, 'article markdown');
  const scenarioCsvRows = readCsvRows(path.join(produceDir, 'grey-hormuz-food-security-article-data-scenarios.csv'), failures, 'article scenarios csv');

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
  if (!within(n(article.currentFoodInsecurityBaseline?.trend2027CentralEstimate), n(trend.articlePreferredProjection?.projected2027People), 1)) {
    failures.push('2027 trend baseline mismatch between article baseline block and trend report');
  }
  if (!within(n(article.currentFoodInsecurityBaseline?.trend2027CentralShare) * 100, n(trend.articlePreferredProjection?.projected2027RatePct), 0.05)) {
    failures.push('2027 trend rate mismatch between article baseline block and trend report');
  }
  if (!within(n(article.foodInsecurityTrendProjection?.rangeLowPeople), n(trend.articlePreferredProjection?.rangeLowPeople), 1)
    || !within(n(article.foodInsecurityTrendProjection?.rangeHighPeople), n(trend.articlePreferredProjection?.rangeHighPeople), 1)) {
    failures.push('2027 trend range mismatch between article trend block and trend report');
  }
  if (!within(n(article.strictLandAccess?.noMeaningfulFoodGrowingLandAccessPopulation), n(dwelling.noMeaningfulFoodGrowingLandAccessPopulation), 0.5)) {
    failures.push('Strict land-access mismatch between article and dwelling report');
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
  const csvScenarioIds = new Set(scenarioCsvRows.map((r) => r.scenario).filter(Boolean));
  const jsonScenarioIds = new Set(scenarios.map((s) => s.scenario));
  if (csvScenarioIds.size !== jsonScenarioIds.size) failures.push('Scenario ID count mismatch between article CSV and JSON');
  for (const sid of jsonScenarioIds) {
    if (!csvScenarioIds.has(sid)) failures.push(`Scenario ${sid} missing from article scenarios CSV`);
  }

  // Markdown/JSON consistency checks for headline numbers.
  if (articleMd) {
    const mustContain = [
      String(Math.round(n(article.currentFoodInsecurityBaseline?.trend2027CentralEstimate))),
      String(Math.round(n(target10?.modes?.lowInputAnnualField?.requiredGrowers))),
      String(Math.round(n(target10?.modes?.marketGardenIntensive?.requiredGrowers))),
      String(Math.round(n(target10?.modes?.handToolHouseholdGarden?.requiredGrowers))),
      String(Math.round(n(article.strictLandAccess?.noMeaningfulFoodGrowingLandAccessPopulation)))
    ];
    for (const token of mustContain) {
      if (!articleMd.includes(token)) failures.push(`Markdown/JSON drift: article markdown missing headline token ${token}`);
    }
  }

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
