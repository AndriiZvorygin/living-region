import {pathToFileURL} from 'node:url';
import {number, round, writeJson, writeText, writeCsv, format} from './model-utils.mjs';

export const defaultHeatingAssumptions = {
  diameter_m: 9.1,
  floor_area_m2: 65.6,
  wall_height_m: 2.4,
  roof_rise_m: 2.0,
  wall_r_value_ip: 20,
  roof_r_value_ip: 40,
  floor_r_value_ip: 30,
  window_door_area_m2: 8,
  window_door_u_w_per_m2k: 0.30,
  air_changes_per_hour: 0.35,
  indoor_temperature_c: 20,
  outdoor_design_temperature_c: -20,
  heating_degree_days_c_18: 4031.9,
  net_demand_factor: 0.85,
  masonry_heater_seasonal_efficiency: 0.75,
  dry_wood_energy_gj_per_kg: 0.018,
  historical_wood_gj_per_cord: 15,
  historical_coppice_gross_gj_per_year: 15,
  historical_coppice_area_ha: 0.5
};

export function calculateHeating(overrides = {}) {
  const a = {...defaultHeatingAssumptions, ...overrides};
  const r = a.diameter_m / 2;
  const circumference = Math.PI * a.diameter_m;
  const wallGross = circumference * a.wall_height_m;
  const roofSlope = Math.sqrt(r ** 2 + a.roof_rise_m ** 2);
  const roofArea = Math.PI * r * roofSlope;
  const wallOpaque = wallGross - a.window_door_area_m2;
  const volume = Math.PI * r ** 2 * a.wall_height_m + Math.PI * r ** 2 * a.roof_rise_m / 3;
  const rToRsi = 0.1761101838;
  const wallU = 1 / (a.wall_r_value_ip * rToRsi);
  const roofU = 1 / (a.roof_r_value_ip * rToRsi);
  const floorU = 1 / (a.floor_r_value_ip * rToRsi);
  const transmissionUa = wallOpaque * wallU + roofArea * roofU + a.floor_area_m2 * floorU + a.window_door_area_m2 * a.window_door_u_w_per_m2k;
  const ventilationUa = 0.33 * a.air_changes_per_hour * volume;
  const totalUa = transmissionUa + ventilationUa;
  const annualGrossGJ = totalUa * a.heating_degree_days_c_18 * 24 / 1000 * 0.0036;
  const annualUsefulGJ = annualGrossGJ * a.net_demand_factor;
  const grossWoodGJ = annualUsefulGJ / a.masonry_heater_seasonal_efficiency;
  const dryWoodKg = grossWoodGJ / a.dry_wood_energy_gj_per_kg;
  const cords = grossWoodGJ / a.historical_wood_gj_per_cord;
  const historicalWoodUsefulGJ = a.historical_coppice_gross_gj_per_year * a.masonry_heater_seasonal_efficiency;
  const historicalAreaGrossGJPerHa = a.historical_coppice_gross_gj_per_year / a.historical_coppice_area_ha;
  const requiredCoppiceHa = grossWoodGJ / historicalAreaGrossGJPerHa;
  const provisionFraction = historicalWoodUsefulGJ / annualUsefulGJ;
  const designHeatLossKw = totalUa * (a.indoor_temperature_c - a.outdoor_design_temperature_c) / 1000;
  return {
    assumptions: a,
    geometry: {radius_m: r, circumference_m: circumference, wall_gross_m2: wallGross, wall_opaque_m2: wallOpaque, roof_area_m2: roofArea, floor_area_m2: a.floor_area_m2, conditioned_volume_m3: volume},
    heat_loss: {wall_u_w_per_m2k: wallU, roof_u_w_per_m2k: roofU, floor_u_w_per_m2k: floorU, transmission_ua_w_per_k: transmissionUa, ventilation_ua_w_per_k: ventilationUa, total_ua_w_per_k: totalUa, annual_gross_envelope_loss_gj: annualGrossGJ, net_demand_factor: a.net_demand_factor, annual_useful_space_heating_gj: annualUsefulGJ, design_heat_loss_kw: designHeatLossKw},
    wood: {masonry_heater_efficiency: a.masonry_heater_seasonal_efficiency, gross_wood_energy_required_gj: grossWoodGJ, dry_wood_energy_gj_per_kg: a.dry_wood_energy_gj_per_kg, approximate_dry_wood_mass_kg: dryWoodKg, historical_cord_energy_gj: a.historical_wood_gj_per_cord, approximate_cords_per_year: cords, historical_half_ha_useful_heat_gj: historicalWoodUsefulGJ, historical_half_ha_heat_fraction: provisionFraction, required_coppice_area_at_historical_yield_ha: requiredCoppiceHa}
  };
}

export function buildHeating() {
  const result = calculateHeating();
  const sensitivity = [0.65, 0.75, 0.85, 0.90].map(efficiency => {
    const row = calculateHeating({masonry_heater_seasonal_efficiency: efficiency});
    return {efficiency, useful_demand_gj: row.heat_loss.annual_useful_space_heating_gj, gross_wood_gj: row.wood.gross_wood_energy_required_gj, cords: row.wood.approximate_cords_per_year, required_coppice_ha: row.wood.required_coppice_area_at_historical_yield_ha, half_ha_fraction: row.wood.historical_half_ha_heat_fraction};
  });
  writeCsv('data/source/climate-heating.csv', [
    ['variable','value','units','source','status','notes'],
    ['heating_degree_days_below_18_c',4031.9,'C degree-days','https://climate.weather.gc.ca/climate_normals/results_1981_2010_e.html?climate_id=6116132&coordsStn=44.745833%7C-81.107222%7COWEN+SOUND+MOE&optProxType=station&searchType=stnProx&txtCentralLatMin=0&txtCentralLatSec=0&txtCentralLongMin=0&txtCentralLongSec=0&txtRadius=25','external assumption','Owen Sound MOE; 1981–2010 station normals; below 18 C annual value'],
    ['heating_degree_day_definition',18,'C base','https://climate.meteo.gc.ca/glossary_e.html','external definition','ECCC defines heating degree-days as degrees below 18 C'],
    ['dry_wood_energy',0.018,'GJ/kg','new model assumption','new assumption','18 MJ/kg dry wood; verify by species, moisture and cord convention'],
    ['masonry_heater_efficiency',0.75,'fraction','new model assumption','new assumption','seasonal delivered-useful efficiency; not found in historical Lyis source'],
    ['net_demand_factor',0.85,'fraction','new model assumption','new assumption','15% reduction from HDD envelope loss for internal/passive gains; sensitivity required'],
    ['floor_r_value',30,'h ft2 F/Btu','new model assumption','new assumption','insulated floor/platform; historical Lyis material did not specify a floor R-value']
  ]);
  writeJson('data/derived/heating.json', {result, sensitivity});
  const sourceNote = 'The Lyis material inspected here describes an approximately 9 m interior Earth Lodge and says a high-efficiency home is needed, but it does not provide a yurt heat-loss calculation, R-values, HDD input, window area, air leakage or masonry-heater efficiency.';
  const md = `# ARC yurt heating model

## Scope

${sourceNote}

The requested 9.1 m diameter, approximately 65.6 m² four-season yurt is therefore modeled with explicit new assumptions. The geometry is a circular 2.4 m wall cylinder plus a 2.0 m roof rise; the roof is approximated as a cone. An 8 m² combined window/door area, R-20 walls, R-40 roof, an assumed R-30 floor, 0.35 ACH, 20°C indoors, and -20°C design outdoor temperature are used. The annual calculation uses **4,031.9 heating degree-days below 18°C**, from the Owen Sound MOE 1981–2010 ECCC station normal; the newer 1991–2020 station value should be verified before website publication.

## Result

| Quantity | Result |
|---|---:|
| Gross envelope loss before gains | ${format(result.heat_loss.annual_gross_envelope_loss_gj, 2)} GJ/year |
| Net useful space-heating demand | **${format(result.heat_loss.annual_useful_space_heating_gj, 2)} GJ/year** |
| Approximate design heat loss | ${format(result.heat_loss.design_heat_loss_kw, 2)} kW |
| Gross wood required at ${format(result.wood.masonry_heater_efficiency * 100, 0)}% seasonal efficiency | ${format(result.wood.gross_wood_energy_required_gj, 2)} GJ/year |
| Approximate dry-wood mass at 18 MJ/kg | ${format(result.wood.approximate_dry_wood_mass_kg, 0)} kg/year |
| Cords/year at historical 15 GJ/cord | **${format(result.wood.approximate_cords_per_year, 2)} cords/year** |
| Useful heat from historical 0.5 ha at 15 GJ gross | ${format(result.wood.historical_half_ha_useful_heat_gj, 2)} GJ/year |
| Share of modeled demand supplied by 0.5 ha | ${format(result.wood.historical_half_ha_heat_fraction * 100, 1)}% |
| Coppice area at historical 30 GJ gross/ha yield | **${format(result.wood.required_coppice_area_at_historical_yield_ha, 2)} ha** |

Under these assumptions, 0.5 ha of coppice is **insufficient**, not merely marginal: it supplies ${format(result.wood.historical_half_ha_heat_fraction * 100, 1)}% of modeled useful heat and would need roughly ${format(result.wood.required_coppice_area_at_historical_yield_ha, 2)} ha at the historical yield. This conclusion is sensitive to the envelope, air leakage, passive gains, heater efficiency and the historical wood-yield assumption.

## Efficiency sensitivity

| Heater efficiency | Gross wood | Cords/year | Required coppice |
|---:|---:|---:|---:|
${sensitivity.map(row => `| ${format(row.efficiency * 100, 0)}% | ${format(row.gross_wood_gj, 2)} GJ | ${format(row.cords, 2)} | ${format(row.required_coppice_ha, 2)} ha |`).join('\n')}

The historical graphic's 15 GJ is explicitly treated as gross fuel energy. It is never reported as useful room heat without applying the heater-efficiency parameter.
`;
  writeText('outputs/heating-budget.md', md);
  return {result, sensitivity};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) buildHeating();
