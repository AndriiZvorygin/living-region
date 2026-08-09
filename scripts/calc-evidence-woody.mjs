import {pathToFileURL} from 'node:url';
import {readCsv, number, round, writeCsv, writeJson} from './model-utils.mjs';
import {buildEvidenceHeating} from './calc-evidence-heating.mjs';

export const woodyBands = {marginal: 3.0, ordinary: 5.0, favourable: 8.9};

export function calculateWoodyLand(heating = buildEvidenceHeating()) {
  const cases = {};
  for (const [heatingCase, result] of Object.entries(heating.cases)) {
    cases[heatingCase] = {};
    for (const [site, dryTonnes] of Object.entries(woodyBands)) {
      const grossGJHa = dryTonnes * 19;
      const usableGrossGJHa = grossGJHa * .85;
      cases[heatingCase][site] = {
        dry_biomass_t_ha_year: dryTonnes,
        gross_energy_gj_ha_year: round(grossGJHa, 6),
        harvest_storage_retention: .85,
        usable_gross_energy_gj_ha_year: round(usableGrossGJHa, 6),
        gross_wood_required_gj: result.wood.gross_wood_energy_required_gj,
        required_woody_area_ha: round(result.wood.gross_wood_energy_required_gj / usableGrossGJHa, 6),
        useful_delivered_heat_gj: result.heat_loss.annual_useful_space_heating_gj
      };
    }
  }
  return {source: 'data/source/woody-yield-evidence.csv', energy_conversion_gj_per_dry_tonne: 19, harvest_storage_retention: .85, bands: woodyBands, cases};
}

export function buildEvidenceWoody(heating = buildEvidenceHeating()) {
  const evidence = readCsv('data/source/woody-yield-evidence.csv');
  const output = {...calculateWoodyLand(heating), evidence};
  writeJson('data/derived/evidence-woody-yields.json', output);
  writeCsv('data/derived/evidence-woody-yields.csv', [
    ['heating_case','site_band','dry_biomass_t_ha_year','gross_energy_gj_ha_year','usable_gross_energy_gj_ha_year','gross_wood_required_gj','required_woody_area_ha','useful_delivered_heat_gj'],
    ...Object.entries(output.cases).flatMap(([heatingCase, sites]) => Object.entries(sites).map(([site, r]) => [heatingCase,site,r.dry_biomass_t_ha_year,r.gross_energy_gj_ha_year,r.usable_gross_energy_gj_ha_year,r.gross_wood_required_gj,r.required_woody_area_ha,r.useful_delivered_heat_gj]))
  ]);
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) buildEvidenceWoody();
