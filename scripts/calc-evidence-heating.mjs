import {pathToFileURL} from 'node:url';
import {round, writeJson, writeCsv} from './model-utils.mjs';

export const heatingCases = {
  low: {diameter_m: 9.1, floor_area_m2: 65.6, wall_height_m: 2.4, roof_rise_m: 2, wall_r: 25, roof_r: 45, floor_r: 35, window_area_m2: 6, window_u: .25, ach: .20, indoor_c: 20, design_c: -20, hdd: 4031.9, net_factor: .75, thermal_bridge: 1.10, heater_efficiency: .85, cord_gj: 8},
  central: {diameter_m: 9.1, floor_area_m2: 65.6, wall_height_m: 2.4, roof_rise_m: 2, wall_r: 20, roof_r: 40, floor_r: 30, window_area_m2: 8, window_u: .30, ach: .35, indoor_c: 20, design_c: -20, hdd: 4031.9, net_factor: .85, thermal_bridge: 1.15, heater_efficiency: .75, cord_gj: 10},
  high: {diameter_m: 9.1, floor_area_m2: 65.6, wall_height_m: 2.4, roof_rise_m: 2, wall_r: 15, roof_r: 30, floor_r: 20, window_area_m2: 10, window_u: .40, ach: .60, indoor_c: 20, design_c: -20, hdd: 4031.9, net_factor: .95, thermal_bridge: 1.30, heater_efficiency: .65, cord_gj: 12}
};

export function calculateEvidenceHeating(overrides = {}) {
  const a = {...heatingCases.central, ...overrides};
  const radius = a.diameter_m / 2;
  const circumference = Math.PI * a.diameter_m;
  const wallGross = circumference * a.wall_height_m;
  const roofSlope = Math.sqrt(radius ** 2 + a.roof_rise_m ** 2);
  const roofArea = Math.PI * radius * roofSlope;
  const wallOpaque = wallGross - a.window_area_m2;
  const volume = Math.PI * radius ** 2 * a.wall_height_m + Math.PI * radius ** 2 * a.roof_rise_m / 3;
  const rToRsi = .1761101838;
  const wallU = 1 / (a.wall_r * rToRsi);
  const roofU = 1 / (a.roof_r * rToRsi);
  const floorU = 1 / (a.floor_r * rToRsi);
  const opaqueUa = (wallOpaque * wallU + roofArea * roofU + a.floor_area_m2 * floorU) * a.thermal_bridge;
  const windowUa = a.window_area_m2 * a.window_u;
  const ventilationUa = .33 * a.ach * volume;
  const totalUa = opaqueUa + windowUa + ventilationUa;
  const grossEnvelopeGJ = totalUa * a.hdd * 24 / 1000 * .0036;
  const usefulGJ = grossEnvelopeGJ * a.net_factor;
  const grossWoodGJ = usefulGJ / a.heater_efficiency;
  return {
    assumptions: a,
    geometry: {radius_m: round(radius, 4), wall_gross_m2: round(wallGross, 4), wall_opaque_m2: round(wallOpaque, 4), roof_area_m2: round(roofArea, 4), floor_area_m2: a.floor_area_m2, conditioned_volume_m3: round(volume, 4)},
    heat_loss: {wall_u_w_m2k: round(wallU, 6), roof_u_w_m2k: round(roofU, 6), floor_u_w_m2k: round(floorU, 6), opaque_ua_w_k: round(opaqueUa, 6), window_ua_w_k: round(windowUa, 6), ventilation_ua_w_k: round(ventilationUa, 6), total_ua_w_k: round(totalUa, 6), annual_gross_envelope_loss_gj: round(grossEnvelopeGJ, 6), annual_useful_space_heating_gj: round(usefulGJ, 6), design_heat_loss_kw: round(totalUa * (a.indoor_c - a.design_c) / 1000, 6)},
    wood: {gross_wood_energy_required_gj: round(grossWoodGJ, 6), heater_efficiency: a.heater_efficiency, dry_wood_energy_gj_per_tonne: 19, approximate_dry_wood_tonnes: round(grossWoodGJ / 19, 6), approximate_dry_wood_kg: round(grossWoodGJ / 19 * 1000, 2), cord_energy_gj: a.cord_gj, approximate_cords_per_year: round(grossWoodGJ / a.cord_gj, 6)}
  };
}

export function buildEvidenceHeating() {
  const cases = Object.fromEntries(Object.entries(heatingCases).map(([id, assumptions]) => [id, calculateEvidenceHeating(assumptions)]));
  const output = {source: 'ECCC Owen Sound 1981-2010 HDD plus explicit geometry/envelope assumptions', cases, audit: 'All geometry and envelope values are user/design/modelling assumptions except the ECCC HDD normal; no as-built measurement was available.'};
  writeJson('data/derived/evidence-heating.json', output);
  writeCsv('data/derived/evidence-heating.csv', [
    ['case','useful_space_heat_gj','gross_wood_gj','dry_wood_tonnes','cords','heater_efficiency','hdd','classification'],
    ...Object.entries(cases).map(([id, r]) => [id,r.heat_loss.annual_useful_space_heating_gj,r.wood.gross_wood_energy_required_gj,r.wood.approximate_dry_wood_tonnes,r.wood.approximate_cords_per_year,r.wood.heater_efficiency,r.assumptions.hdd,'modelled case'])
  ]);
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) buildEvidenceHeating();
