// SPDX-License-Identifier: AGPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';

const REQUIRED_ASSUMPTION_FIELDS = ['value', 'range', 'unit', 'confidence', 'notes', 'source_refs'];

export function loadScenarioFiles(options = {}) {
  const scenariosDir = path.resolve(options.scenariosDir ?? 'know/input/scenarios');
  const failures = [];
  const warnings = [];
  const scenarios = [];

  if (!fs.existsSync(scenariosDir)) {
    return { status: 'fail', failures: [`Missing scenarios directory: ${scenariosDir}`], warnings, scenarios, scenariosDir };
  }

  const files = fs.readdirSync(scenariosDir).filter((f) => f.endsWith('.json')).sort();
  if (!files.length) failures.push('No scenario JSON files found');

  for (const file of files) {
    const fullPath = path.join(scenariosDir, file);
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    } catch (error) {
      failures.push(`Invalid JSON in scenario ${file}: ${error.message}`);
      continue;
    }

    const sid = parsed.scenario_id;
    if (!sid) failures.push(`Scenario ${file} missing scenario_id`);
    if (parsed.status !== 'scenario_assumption') failures.push(`Scenario ${sid ?? file} must set status=scenario_assumption`);
    if (parsed.not_forecast !== true) failures.push(`Scenario ${sid ?? file} must set not_forecast=true`);

    const assumptions = parsed.assumptions;
    if (!assumptions || typeof assumptions !== 'object') {
      failures.push(`Scenario ${sid ?? file} missing assumptions object`);
    } else {
      for (const [key, val] of Object.entries(assumptions)) {
        if (!val || typeof val !== 'object') {
          failures.push(`Scenario ${sid ?? file} assumption ${key} must be an object`);
          continue;
        }
        for (const f of REQUIRED_ASSUMPTION_FIELDS) {
          if (!(f in val)) failures.push(`Scenario ${sid ?? file} assumption ${key} missing ${f}`);
        }
      }
    }

    scenarios.push({ ...parsed, __file: file, __path: fullPath });
  }

  return {
    status: failures.length ? 'fail' : 'pass',
    failures,
    warnings,
    scenarios,
    scenariosDir
  };
}

export function scenarioById(scenarios, scenarioId) {
  return (scenarios ?? []).find((s) => s.scenario_id === scenarioId) ?? null;
}
