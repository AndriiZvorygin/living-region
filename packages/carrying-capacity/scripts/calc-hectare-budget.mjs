import {pathToFileURL} from 'node:url';
import {readCsv, number, stats, round, writeJson, writeText, format} from './model-utils.mjs';
import {buildHumanEnergy} from './calc-human-energy.mjs';
import {buildCropEnergy} from './calc-crop-energy.mjs';

export function calculateHectareBudget({foodDemandGJ, medianCropGJPerHa, cropQ1GJPerHa, cropQ3GJPerHa, heaterEfficiency = 0.65, historicalCoreLow = 5, historicalCoreHigh = 7, historicalBackupLow = 5, historicalBackupHigh = 7, historicalWoodGross = 15} = {}) {
  const coreArea = 0.25;
  const backupArea = 0.25;
  const woodArea = 0.5;
  const totalArea = coreArea + backupArea + woodArea;
  const coreMedian = coreArea * medianCropGJPerHa;
  const backupMedian = backupArea * medianCropGJPerHa;
  const woodUseful = historicalWoodGross * heaterEfficiency;
  return {
    allocation: {core_food_ha: coreArea, backup_perennial_food_ha: backupArea, coppice_ha: woodArea, total_ha: totalArea},
    food: {
      annual_demand_gj: foodDemandGJ,
      median_crop_gj_per_ha: medianCropGJPerHa,
      q1_crop_gj_per_ha: cropQ1GJPerHa,
      q3_crop_gj_per_ha: cropQ3GJPerHa,
      mathematical_food_area_at_median_ha: foodDemandGJ / medianCropGJPerHa,
      mathematical_food_area_at_q1_ha: foodDemandGJ / cropQ1GJPerHa,
      mathematical_food_area_at_q3_ha: foodDemandGJ / cropQ3GJPerHa,
      core_median_output_gj: coreMedian,
      backup_median_output_gj: backupMedian,
      core_food_surplus_factor: coreMedian / foodDemandGJ,
      core_food_safety_margin_percent: (coreMedian / foodDemandGJ - 1) * 100,
      total_food_median_output_gj: coreMedian + backupMedian,
      historical_core_output_low_gj: historicalCoreLow,
      historical_core_output_high_gj: historicalCoreHigh,
      historical_backup_output_low_gj: historicalBackupLow,
      historical_backup_output_high_gj: historicalBackupHigh
    },
    thermal: {
      coppice_gross_gj: historicalWoodGross,
      heater_efficiency: heaterEfficiency,
      coppice_useful_heat_gj: woodUseful,
      gross_biological_energy_using_median_food_gj: coreMedian + backupMedian + historicalWoodGross,
      useful_energy_after_heater_gj: coreMedian + backupMedian + woodUseful
    },
    historical_displayed_range: {
      food_gj_low: historicalCoreLow + historicalBackupLow,
      food_gj_high: historicalCoreHigh + historicalBackupHigh,
      mixed_gross_gj_low: historicalCoreLow + historicalBackupLow + historicalWoodGross,
      mixed_gross_gj_high: historicalCoreHigh + historicalBackupHigh + historicalWoodGross
    }
  };
}

export function buildHectareBudget({human = buildHumanEnergy(), crops = buildCropEnergy()} = {}) {
  const wood = readCsv('data/source/wood-energy.csv');
  const historical = readCsv('data/source/historic-hectare-model.csv');
  const woodGross = number(wood.find(row => row.variable === 'willow_coppice_gross_energy')?.value) ?? 15;
  const core = historical.find(row => row.allocation === 'core food');
  const backup = historical.find(row => row.allocation === 'backup/perennial food');
  const result = calculateHectareBudget({
    foodDemandGJ: human.canonical.annual_gj,
    medianCropGJPerHa: crops.overall.median,
    cropQ1GJPerHa: crops.overall.q1,
    cropQ3GJPerHa: crops.overall.q3,
    historicalCoreLow: number(core?.energy_low_gj_per_year) ?? 5,
    historicalCoreHigh: number(core?.energy_high_gj_per_year) ?? 7,
    historicalBackupLow: number(backup?.energy_low_gj_per_year) ?? 5,
    historicalBackupHigh: number(backup?.energy_high_gj_per_year) ?? 7,
    historicalWoodGross: woodGross
  });
  writeJson('data/derived/hectare-budget.json', result);
  const md = `# One-hectare energy budget

## Reconstructed historical display

The source SVG explicitly labels **0.25 ha core food at ~5–7 GJ/year**, **0.25 ha backup/food forest at ~5–7 GJ/year**, and **0.5 ha willow SRC at ~15 GJ/year**. The active 75 kg food demand from the spreadsheet is ${format(result.food.annual_demand_gj, 6)} GJ/year.

| Stream | Area | Historical range or value | Model treatment |
|---|---:|---:|---|
| Core food | 0.25 ha | 5–7 GJ/year | source graphic; not linked to a crop mix |
| Backup/perennial food | 0.25 ha | 5–7 GJ/year | source graphic; not linked to a crop mix |
| Willow SRC | 0.50 ha | 15 GJ/year gross | source graphic; useful heat is calculated separately |

The graphic therefore implies 10–14 GJ/year of food and 15 GJ/year of gross wood energy. These streams must not be treated as interchangeable: food energy is edible energy, while wood is fuel.

## Compact annual balance

incoming solar energy → biological production → edible food + gross wood/fibre

For this historical allocation, the crop-median bookkeeping value is ${format(result.food.total_food_median_output_gj, 2)} GJ/year of gross harvested food energy plus ${format(result.thermal.coppice_gross_gj, 2)} GJ/year gross wood energy, or ${format(result.thermal.gross_biological_energy_using_median_food_gj, 2)} GJ/year combined gross biological energy. The combined number is not a substitute for separate human food demand and useful heating demand.

food land = human food demand ÷ crop GJ/ha

heating land = useful dwelling heat ÷ heater efficiency ÷ coppice gross GJ/ha

Additional land for nutritional diversity, perennial backup, soil regeneration, nutrient interception, runoff control, fibre/materials, and wildlife-loss protection is a resilience/design allowance unless independently quantified.

## Crop-spreadsheet cross-check

Using the median of the ${crops.overall.count} usable crop observations (${format(crops.overall.median, 2)} GJ/ha), 0.25 ha produces ${format(result.food.core_median_output_gj, 2)} GJ/year. That is ${format(result.food.core_food_surplus_factor, 2)}× the canonical food demand, or a ${format(result.food.core_food_safety_margin_percent, 1)}% gross-energy margin before losses, diet balance, bad years, labour, processing or storage.

The mathematical food-only land requirement is ${format(result.food.mathematical_food_area_at_median_ha, 3)} ha at the median, ${format(result.food.mathematical_food_area_at_q1_ha, 3)} ha at the lower-quartile yield and ${format(result.food.mathematical_food_area_at_q3_ha, 3)} ha at the upper-quartile yield. This is a gross arithmetic result, not a recommendation to reduce the historical 0.5 ha food allocation.

The second 0.25 ha adds another ${format(result.food.backup_median_output_gj, 2)} GJ/year at the median crop yield and doubles the modeled crop-energy pool. Historically it is described as insurance against below-average years and as potential surplus, not as a mathematically necessary second food quarter.

## Wood conversion

At the default configurable heater efficiency of ${format(result.thermal.heater_efficiency * 100, 0)}%, the historical 15 GJ gross wood output becomes ${format(result.thermal.coppice_useful_heat_gj, 2)} GJ of useful heat. The default is a new model assumption; the historical graphic only supplies gross energy.

The one-hectare allocation sums exactly: 0.25 + 0.25 + 0.50 = 1.00 ha. The remaining question is not arithmetic allocation but whether the historical yields and dwelling demand are simultaneously realistic at the same site and climate.
`;
  writeText('outputs/hectare-energy-budget.md', md);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) buildHectareBudget();
