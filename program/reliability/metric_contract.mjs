// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';

export function validateMetricContract(options = {}) {
  const registryPath = path.resolve(options.registryPath ?? 'know/metric-registry.json');
  const reportPath = path.resolve(options.reportPath ?? 'know/produce/grey-hormuz-food-security-article-data.json');

  const failures = [];
  const warnings = [];

  if (!fs.existsSync(registryPath)) {
    return { status: 'fail', failures: [`Missing metric registry: ${registryPath}`], warnings };
  }
  if (!fs.existsSync(reportPath)) {
    return { status: 'fail', failures: [`Missing report JSON for metric contract check: ${reportPath}`], warnings };
  }

  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const metrics = report.headlineMetrics;
  if (!Array.isArray(metrics)) {
    return { status: 'fail', failures: ['Report is missing headlineMetrics[] metadata'], warnings };
  }

  const byId = new Map(metrics.map((m) => [m.metric_id, m]));
  for (const req of registry.metrics ?? []) {
    const m = byId.get(req.metric_id);
    if (!m) {
      failures.push(`Missing headline metric: ${req.metric_id}`);
      continue;
    }

    if (!req.allowed_statuses.includes(m.status)) {
      failures.push(`Metric ${req.metric_id} has invalid status ${m.status}`);
    }
    if (req.requires_method && !m.method) failures.push(`Metric ${req.metric_id} missing method`);
    if (req.requires_range && !m.range) failures.push(`Metric ${req.metric_id} missing range`);
    if (req.requires_confidence && !m.confidence) failures.push(`Metric ${req.metric_id} missing confidence`);
    if (req.requires_not_forecast_flag && m.not_forecast !== true) failures.push(`Metric ${req.metric_id} missing not_forecast=true`);
    if (!Array.isArray(m.source_refs) || !m.source_refs.length) failures.push(`Metric ${req.metric_id} missing source_refs`);
  }

  return { status: failures.length ? 'fail' : 'pass', failures, warnings, checked: (registry.metrics ?? []).length };
}
