// SPDX-License-Identifier: AGPL-3.0-or-later
import { runYear } from './run_year.mjs';

export function runScenario(world, scenario) {
  const outputs = [];
  for (let offset = 0; offset < scenario.years; offset += 1) {
    const year = scenario.startYear + offset;
    const yearly = runYear(world, scenario, year);
    outputs.push(yearly);
  }
  return {
    years: outputs,
    finalWorld: world
  };
}
