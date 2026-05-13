// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';

function n(v, fallback = 0) { const x = Number(v); return Number.isFinite(x) ? x : fallback; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function esc(v) { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; }
function toCsv(rows, headers) { return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n'); }

function readJsonIfExists(filePath, warnings, label, fallback = null) {
  if (!fs.existsSync(filePath)) {
    warnings.push(`Missing ${label}: ${filePath}`);
    return fallback;
  }
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch (error) {
    warnings.push(`Failed to parse ${label}: ${filePath} (${error.message})`);
    return fallback;
  }
}

function linearRegression(points) {
  const m = points.length;
  const sx = points.reduce((a, p) => a + p.x, 0);
  const sy = points.reduce((a, p) => a + p.y, 0);
  const sxx = points.reduce((a, p) => a + p.x * p.x, 0);
  const sxy = points.reduce((a, p) => a + p.x * p.y, 0);
  const denom = (m * sxx) - (sx * sx);
  const slope = Math.abs(denom) < 1e-12 ? 0 : ((m * sxy) - (sx * sy)) / denom;
  const intercept = (sy - slope * sx) / m;
  return { slope, intercept, predict: (x) => intercept + slope * x };
}

function solve3x3(A, b) {
  const M = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < 3; i += 1) {
    let pivot = i;
    for (let r = i + 1; r < 3; r += 1) {
      if (Math.abs(M[r][i]) > Math.abs(M[pivot][i])) pivot = r;
    }
    if (Math.abs(M[pivot][i]) < 1e-12) return null;
    if (pivot !== i) [M[i], M[pivot]] = [M[pivot], M[i]];
    const div = M[i][i];
    for (let c = i; c < 4; c += 1) M[i][c] /= div;
    for (let r = 0; r < 3; r += 1) {
      if (r === i) continue;
      const factor = M[r][i];
      for (let c = i; c < 4; c += 1) M[r][c] -= factor * M[i][c];
    }
  }
  return [M[0][3], M[1][3], M[2][3]];
}

function quadraticRegression(points, xCenter) {
  const centered = points.map((p) => ({ x: p.x - xCenter, y: p.y }));
  const s0 = centered.length;
  const s1 = centered.reduce((a, p) => a + p.x, 0);
  const s2 = centered.reduce((a, p) => a + p.x ** 2, 0);
  const s3 = centered.reduce((a, p) => a + p.x ** 3, 0);
  const s4 = centered.reduce((a, p) => a + p.x ** 4, 0);
  const t0 = centered.reduce((a, p) => a + p.y, 0);
  const t1 = centered.reduce((a, p) => a + p.x * p.y, 0);
  const t2 = centered.reduce((a, p) => a + p.x ** 2 * p.y, 0);

  const coeff = solve3x3(
    [
      [s0, s1, s2],
      [s1, s2, s3],
      [s2, s3, s4]
    ],
    [t0, t1, t2]
  );

  if (!coeff) return { a: 0, b: 0, c: points[points.length - 1]?.y ?? 0, predict: () => points[points.length - 1]?.y ?? 0 };
  const [c, b, a] = coeff; // y = c + b*x + a*x^2
  return {
    a,
    b,
    c,
    xCenter,
    predict: (x) => {
      const z = x - xCenter;
      return c + b * z + a * z * z;
    }
  };
}

function rmse(points, predFn) {
  if (!points.length) return 0;
  const mse = points.reduce((a, p) => {
    const e = predFn(p.x) - p.y;
    return a + e * e;
  }, 0) / points.length;
  return Math.sqrt(mse);
}

export function buildGreyFoodInsecurityTrendProjectionReport(options = {}) {
  const produceDir = path.resolve(options.produceDir ?? 'know/produce');
  fs.mkdirSync(produceDir, { recursive: true });
  const warnings = [];

  const pop = readJsonIfExists(path.join(produceDir, 'grey-population-distribution.json'), warnings, 'population distribution', {});
  const projectionPopulation = n(pop.totalPopulationMatched, 100905);
  const projectionYear = 2027;

  // Comparable person-share anchors (documented as mixed geography with caveat).
  const sourceSeries = [
    { year: 2019, geography: 'Ten provinces (people share)', foodInsecurityRatePct: 16.8, source: 'PROOF / Statistics Canada', sourceNote: 'People in food-insecure households' },
    { year: 2022, geography: 'Ten provinces (people share)', foodInsecurityRatePct: 18.4, source: 'PROOF / Statistics Canada', sourceNote: 'People in food-insecure households' },
    { year: 2023, geography: 'Ten provinces (people share)', foodInsecurityRatePct: 22.9, source: 'PROOF / Statistics Canada', sourceNote: 'People in food-insecure households' },
    { year: 2024, geography: 'Ten provinces (people share)', foodInsecurityRatePct: 25.5, source: 'PROOF / Statistics Canada', sourceNote: 'People in food-insecure households' },
    { year: 2025, geography: 'Canada (people share)', foodInsecurityRatePct: 24.0, source: 'PROOF / Statistics Canada', sourceNote: 'First small decline after three consecutive increases; cross-geo caveat' }
  ];

  const points = sourceSeries.map((r) => ({ x: r.year, y: r.foodInsecurityRatePct / 100 }));
  if (points.length < 5) warnings.push('trend_series_fewer_than_5_points');

  const linear = linearRegression(points);
  const quad = quadraticRegression(points, points[0].x);
  const recentPoints = points.slice(-3);
  const recent = linearRegression(recentPoints);

  const linearRate = clamp(linear.predict(projectionYear), 0, 1);
  const quadraticRate = quad.predict(projectionYear);
  const cappedQuadraticRate = clamp(quadraticRate, 0, 1);
  const recentSlopeRate = clamp(recent.predict(projectionYear), 0, 1);

  const methods = {
    linear: {
      methodLabel: 'Linear regression (all years in series)',
      dataPointCount: points.length,
      projected2027RatePct: linearRate * 100,
      projected2027People: linearRate * projectionPopulation,
      slopePctPointsPerYear: linear.slope * 100,
      rmsePctPoints: rmse(points, linear.predict) * 100
    },
    quadratic: {
      methodLabel: 'Quadratic regression degree 2 (centered x, extrapolative)',
      dataPointCount: points.length,
      projected2027RatePct: quadraticRate * 100,
      projected2027People: quadraticRate * projectionPopulation,
      coefficientA: quad.a,
      coefficientB: quad.b,
      coefficientC: quad.c,
      rmsePctPoints: rmse(points, quad.predict) * 100,
      extrapolative: true
    },
    cappedQuadratic: {
      methodLabel: 'Quadratic regression with cap (0%-100%)',
      dataPointCount: points.length,
      projected2027RatePct: cappedQuadraticRate * 100,
      projected2027People: cappedQuadraticRate * projectionPopulation,
      capApplied: quadraticRate !== cappedQuadraticRate
    },
    recentSlope: {
      methodLabel: 'Recent-slope linear projection (last 3 years)',
      dataPointCount: recentPoints.length,
      projected2027RatePct: recentSlopeRate * 100,
      projected2027People: recentSlopeRate * projectionPopulation,
      slopePctPointsPerYear: recent.slope * 100,
      includes2025DeclinePoint: sourceSeries.some((r) => r.year === 2025 && r.foodInsecurityRatePct < 25.5)
    }
  };

  const lowPeople = Math.min(methods.recentSlope.projected2027People, methods.linear.projected2027People);
  const highPeople = Math.max(methods.cappedQuadratic.projected2027People, methods.linear.projected2027People);
  const centralPeople = methods.linear.projected2027People;
  const centralRate = methods.linear.projected2027RatePct;

  if ((methods.quadratic.projected2027RatePct - methods.linear.projected2027RatePct) > 4.0) {
    warnings.push('polynomial_extrapolation_acceleration_warning');
  }

  const report = {
    generatedAt: new Date().toISOString(),
    projectionYear,
    projectionPopulation,
    sourceSeries,
    methods,
    articlePreferredProjection: {
      method: 'linear',
      projected2027RatePct: centralRate,
      projected2027People: centralPeople,
      rangeLowPeople: lowPeople,
      rangeHighPeople: highPeople,
      rangeLowRatePct: (lowPeople / projectionPopulation) * 100,
      rangeHighRatePct: (highPeople / projectionPopulation) * 100,
      caveat: 'Trend projection, not forecast; excludes current Hormuz shock.'
    },
    assumptions: {
      seriesComparabilityStatus: 'mixed Canada/ten-provinces people-share anchors; Ontario-specific full annual series not yet loaded',
      preferredMethodReason: 'Linear method is transparent and less unstable than unconstrained polynomial extrapolation for article baseline.'
    },
    warnings
  };

  const md = [
    '# Grey Food-Insecurity Trend Projection (No New Shock Baseline)',
    '',
    'This report provides a no-new-shock 2027 trend-extension estimate using recent food-insecurity data. It is not a forecast and excludes the current Hormuz disruption.',
    '',
    '## Source series',
    '| Year | Geography | Food insecurity rate | Source | Note |',
    '|---:|---|---:|---|---|',
    ...sourceSeries.map((r) => `| ${r.year} | ${r.geography} | ${r.foodInsecurityRatePct.toFixed(1)}% | ${r.source} | ${r.sourceNote} |`),
    '',
    '## Regression methods (2027)',
    '| Method | Projected rate | Projected people | Notes |',
    '|---|---:|---:|---|',
    `| linear | ${methods.linear.projected2027RatePct.toFixed(2)}% | ${methods.linear.projected2027People.toFixed(0)} | all-series linear |`,
    `| quadratic | ${methods.quadratic.projected2027RatePct.toFixed(2)}% | ${methods.quadratic.projected2027People.toFixed(0)} | extrapolative degree-2 |`,
    `| cappedQuadratic | ${methods.cappedQuadratic.projected2027RatePct.toFixed(2)}% | ${methods.cappedQuadratic.projected2027People.toFixed(0)} | capped to plausible range |`,
    `| recentSlope | ${methods.recentSlope.projected2027RatePct.toFixed(2)}% | ${methods.recentSlope.projected2027People.toFixed(0)} | last-3-years slope |`,
    '',
    '## Article preferred projection',
    `- method: ${report.articlePreferredProjection.method}`,
    `- projected 2027 rate: ${report.articlePreferredProjection.projected2027RatePct.toFixed(2)}%`,
    `- projected 2027 people: ${report.articlePreferredProjection.projected2027People.toFixed(0)}`,
    `- plausible range: ${report.articlePreferredProjection.rangeLowPeople.toFixed(0)} to ${report.articlePreferredProjection.rangeHighPeople.toFixed(0)} people`,
    `- caveat: ${report.articlePreferredProjection.caveat}`,
    '',
    '## Warnings',
    ...(warnings.length ? warnings.map((w) => `- ${w}`) : ['- none'])
  ].join('\n');

  const paths = {
    jsonPath: path.join(produceDir, 'grey-food-insecurity-trend-projection.json'),
    markdownPath: path.join(produceDir, 'grey-food-insecurity-trend-projection.md'),
    csvPath: path.join(produceDir, 'grey-food-insecurity-trend-projection-series.csv')
  };

  fs.writeFileSync(paths.jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(paths.markdownPath, md);
  fs.writeFileSync(paths.csvPath, toCsv(sourceSeries, ['year', 'geography', 'foodInsecurityRatePct', 'source', 'sourceNote']));

  return { report, paths };
}
