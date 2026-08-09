import {pathToFileURL} from 'node:url';
import {writeJson, writeCsv} from './model-utils.mjs';
import {calculateEvidenceHeating, heatingCases} from '../src/core.mjs';

export {calculateEvidenceHeating, heatingCases};

export function buildEvidenceHeating() {
  const cases = Object.fromEntries(Object.entries(heatingCases).map(([id, assumptions]) => [id, calculateEvidenceHeating(assumptions)]));
  const output = {source: 'ECCC Owen Sound 1981-2010 HDD plus explicit geometry/envelope assumptions', cases, audit: 'All geometry and envelope values are user/design/modelling assumptions except the ECCC HDD normal; no as-built measurement was available.'};
  writeJson('data/derived/evidence-heating.json', output);
  writeCsv('data/derived/evidence-heating.csv', [['case','useful_space_heat_gj','gross_wood_gj','dry_wood_tonnes','cords','heater_efficiency','hdd','classification'], ...Object.entries(cases).map(([id, row]) => [id, row.heat_loss.annual_useful_space_heating_gj, row.wood.gross_wood_energy_required_gj, row.wood.approximate_dry_wood_tonnes, row.wood.approximate_cords_per_year, row.wood.heater_efficiency, row.assumptions.hdd, 'modelled case'])]);
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) buildEvidenceHeating();
