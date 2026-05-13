// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { loadScenarioFiles } from './scenario_contract.mjs';

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
  const scenariosDir = path.resolve(options.scenariosDir ?? 'know/input/scenarios');
  const scenarioLoad = loadScenarioFiles({ scenariosDir });
  const knownScenarioIds = new Set((scenarioLoad.scenarios ?? []).map((s) => s.scenario_id));
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
    if (req.requires_scenario_refs) {
      if (!Array.isArray(m.scenario_refs) || !m.scenario_refs.length) failures.push(`Metric ${req.metric_id} missing scenario_refs`);
      else {
        for (const sid of m.scenario_refs) {
          if (!knownScenarioIds.has(sid) && !String(sid).startsWith('foodGap')) failures.push(`Metric ${req.metric_id} has unknown scenario_ref: ${sid}`);
        }
      }
    }
  }

  const registered = new Set((registry.metrics ?? []).map((x) => x.metric_id));
  for (const m of metrics) {
    if (!registered.has(m.metric_id)) warnings.push(`Unregistered headline metric emitted: ${m.metric_id}`);
  }
  const obviousExpected = [
    'grey_food_insecurity_2027_baseline_people',
    'grey_food_insecurity_2027_baseline_rate_pct',
    'grey_population_baseline',
    'grey_no_meaningful_food_growing_land_access_population',
    'food_for_10k_low_input_workers_year1',
    'food_for_10k_market_garden_workers_year1',
    'food_for_10k_household_growers_year1',
    'food_for_33k_low_input_workers_year1',
    'food_for_33k_market_garden_workers_year1',
    'food_for_33k_household_growers_year1',
    'hormuz_current_disruption_severe_added_food_insecurity_people'
  ];
  for (const metricId of obviousExpected) {
    if (!registered.has(metricId)) failures.push(`Metric registry missing obvious public metric: ${metricId}`);
  }

  return { status: failures.length ? 'fail' : 'pass', failures, warnings, checked: (registry.metrics ?? []).length };
}
