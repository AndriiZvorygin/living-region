import {pathToFileURL} from 'node:url';
import {readCsv, number, round, writeCsv, writeJson} from './model-utils.mjs';

const sourceRows = readCsv('data/source/food-production-labour.csv');
const byId = Object.fromEntries(sourceRows.map(row => [row.id, row]));

export const perennialLabourClassByFoodId = {
  early_berry_low_input_synthesis: 'early_berry',
  intermediate_hazelnut_low_input_synthesis: 'intermediate_nut_shrub',
  long_staple_chestnut_low_input_synthesis: 'long_staple_tree',
  intermediate_apple_low_input_synthesis: 'intermediate_fruit_tree'
};

const intensityRank = {none: 0, low: 1, 'low-moderate': 1.5, moderate: 2, 'moderate-high': 2.5, high: 3};

function rowNumber(row, key) { return number(row?.[key]) ?? 0; }

export function calculateFoodSystemLabour() {
  const output = {
    source: 'data/source/food-production-labour.csv',
    rows: sourceRows,
    evidence_boundary: 'The categorical labour ratings are evidence-informed planning classifications. Hours are explicit modelled planning estimates, not a time-and-motion study for Grey-Bruce household farms.',
    categories: ['low', 'low-moderate', 'moderate', 'moderate-high', 'high']
  };
  writeJson('data/derived/food-production-labour.json', output);
  writeCsv('data/derived/food-production-labour.csv', [
    ['id','production_class','establishment_labour_class','mature_recurring_labour_class','annual_soil_preparation','planting_frequency','weeding_requirement','watering_monitoring','harvest_labour','pruning_maintenance','mechanization_requirement','physical_intensity_older_resident','establishment_hours_per_ha','mature_recurring_hours_per_ha','soil_preparation_hours_per_ha','planting_hours_per_ha','weeding_hours_per_ha','pruning_maintenance_hours_per_ha','harvest_hours_per_ha','irrigation_monitoring_hours_per_ha','orchard_maintenance_hours_per_ha','pest_wildlife_management_hours_per_ha','processing_storage_hours_per_ha','greenhouse_management_hours_per_ha','coppice_cutting_hours_per_ha','firewood_hauling_hours_per_ha','firewood_splitting_hours_per_ha','firewood_stacking_drying_hours_per_ha','source','evidence_type','notes'],
    ...sourceRows.map(row => [row.id,row.production_class,row.establishment_labour_class,row.mature_recurring_labour_class,row.annual_soil_preparation,row.planting_frequency,row.weeding_requirement,row.watering_monitoring,row.harvest_labour,row.pruning_maintenance,row.mechanization_requirement,row.physical_intensity_older_resident,row.establishment_hours_per_ha,row.mature_recurring_hours_per_ha,row.soil_preparation_hours_per_ha,row.planting_hours_per_ha,row.weeding_hours_per_ha,row.pruning_maintenance_hours_per_ha,row.harvest_hours_per_ha,row.irrigation_monitoring_hours_per_ha,row.orchard_maintenance_hours_per_ha,row.pest_wildlife_management_hours_per_ha,row.processing_storage_hours_per_ha,row.greenhouse_management_hours_per_ha,row.coppice_cutting_hours_per_ha,row.firewood_hauling_hours_per_ha,row.firewood_splitting_hours_per_ha,row.firewood_stacking_drying_hours_per_ha,row.source,row.evidence_type,row.notes])
  ]);
  return output;
}

function perennialWeighted(classProduction, forestArea) {
  return classProduction.reduce((out, production) => {
    const labourId = perennialLabourClassByFoodId[production.id];
    const labour = byId[labourId];
    if (!labour) return out;
    const area = forestArea * (number(production.area_share) ?? 0);
    const fraction = number(production.yield_fraction) ?? 0;
    out.establishment_hours += area * rowNumber(labour, 'establishment_hours_per_ha');
    // Maintenance, monitoring and pruning persist before full bearing. Harvest
    // work is represented by the yield fraction; this avoids calling a young
    // non-bearing tree a zero-labour system.
    const matureHours = rowNumber(labour, 'mature_recurring_hours_per_ha');
    out.recurring_hours += area * matureHours * (.35 + .65 * fraction);
    out.soil_preparation_hours += area * rowNumber(labour, 'soil_preparation_hours_per_ha') * (fraction < 1 ? .25 : 0);
    out.physical_intensity_score += area * (intensityRank[labour.physical_intensity_older_resident] ?? 0);
    out.area += area;
    out.pruning_hours += area * rowNumber(labour, 'pruning_maintenance_hours_per_ha') * (.35 + .65 * fraction);
    out.harvest_hours += area * rowNumber(labour, 'harvest_hours_per_ha') * fraction;
    return out;
  }, {area: 0, establishment_hours: 0, recurring_hours: 0, soil_preparation_hours: 0, pruning_hours: 0, harvest_hours: 0, physical_intensity_score: 0});
}

export function calculateTransitionLabour({year, annualArea, forestArea, classProduction, perennialUsableFoodGJ, householdDemandGJ}) {
  const annual = byId.annual_staple_low_input;
  const perennial = perennialWeighted(classProduction, forestArea);
  const annualEstablishment = annualArea * rowNumber(annual, 'establishment_hours_per_ha');
  const annualRecurring = annualArea * rowNumber(annual, 'mature_recurring_hours_per_ha');
  const annualSoilPreparation = annualArea * rowNumber(annual, 'soil_preparation_hours_per_ha');
  const annualPlanting = annualArea * rowNumber(annual, 'planting_hours_per_ha');
  const annualWeeding = annualArea * rowNumber(annual, 'weeding_hours_per_ha');
  const firstYearPerennialEstablishment = year === 1 ? perennial.establishment_hours : 0;
  const totalRecurring = annualRecurring + perennial.recurring_hours;
  const lowReplantingPercent = householdDemandGJ > 0 ? perennialUsableFoodGJ / householdDemandGJ * 100 : 0;
  const scoreDenominator = annualArea + forestArea;
  const combinedScore = scoreDenominator > 0
    ? (annualArea * (intensityRank[annual.physical_intensity_older_resident] ?? 0) + perennial.physical_intensity_score) / scoreDenominator
    : 0;
  const physicalIntensity = combinedScore >= 2.5 ? 'high' : combinedScore >= 1.75 ? 'moderate' : combinedScore > 0 ? 'low-moderate' : 'low';
  return {
    annual_soil_preparation_area_ha: round(annualArea, 6),
    annual_replanting_area_ha: round(annualArea, 6),
    annual_soil_preparation_hours: round(annualSoilPreparation, 2),
    annual_planting_hours: round(annualPlanting, 2),
    annual_weeding_hours: round(annualWeeding, 2),
    annual_establishment_labour_hours: round(annualEstablishment, 2),
    perennial_establishment_labour_hours: round(firstYearPerennialEstablishment, 2),
    perennial_recurring_labour_hours: round(perennial.recurring_hours, 2),
    perennial_pruning_maintenance_hours: round(perennial.pruning_hours, 2),
    perennial_harvest_hours: round(perennial.harvest_hours, 2),
    total_recurring_labour_hours: round(totalRecurring, 2),
    total_labour_hours_including_establishment: round(totalRecurring + annualEstablishment + firstYearPerennialEstablishment, 2),
    low_replanting_food_energy_gj: round(perennialUsableFoodGJ, 6),
    low_replanting_food_energy_percent: round(lowReplantingPercent, 3),
    perennial_food_energy_percent: round(lowReplantingPercent, 3),
    physical_intensity_for_older_resident: physicalIntensity,
    labour_metric_note: 'For plants-only transition rows, low-replanting food energy equals perennial food energy. The separate metric becomes broader than perennial calories when livestock outputs are credited against perennial/on-property feed in the optional livestock module.'
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) calculateFoodSystemLabour();
