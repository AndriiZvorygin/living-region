// SPDX-License-Identifier: AGPL-3.0-or-later
import { buildGreyLabourLandBaselineReport } from '../program/report/grey_labour_land_baseline_report.mjs';

try {
  const { report, paths } = buildGreyLabourLandBaselineReport();
  const regional = report.regionalIndicators;
  const lowFuel = report.scenarios.find((s) => s.scenario === 'lowFuelMixed') ?? report.scenarios[0];

  console.log(`totalPopulation2021: ${regional.totalPopulation2021}`);
  console.log(`estimatedNoDirectLandAccessPopulation: ${regional.estimatedNoDirectLandAccessPopulation}`);
  console.log(`estimatedRuralProductiveLandAccessPopulation: ${regional.estimatedRuralProductiveLandAccessPopulation}`);
  console.log(`estimatedProductiveLandHa: ${regional.estimatedProductiveLandHa.toFixed(2)}`);
  console.log(`productiveHaPerPerson: ${regional.productiveHaPerPerson.toFixed(4)}`);
  console.log(`productiveHaPerRuralAccessPerson: ${regional.productiveHaPerRuralAccessPerson.toFixed(4)}`);
  console.log(`availableFoodWorkerFTE: ${regional.availableFoodWorkerFTE.toFixed(2)}`);
  console.log(`lowFuelFoodWorkersNeeded: ${lowFuel.requiredFoodWorkerFTE.toFixed(2)}`);
  console.log(`lowFuelLabourDeficitDays: ${lowFuel.labourDeficitDays.toFixed(2)}`);
  console.log(`fossilFuelLeverageRatio: ${lowFuel.fossilFuelLeverageRatio.toFixed(3)}`);
  console.log(`markdown: ${paths.markdownPath}`);
  console.log(`json: ${paths.jsonPath}`);
  console.log(`municipality csv: ${paths.municipalityCsvPath}`);
  console.log(`scenario csv: ${paths.scenarioCsvPath}`);
  if (paths.permacultureSystemsCsvPath) console.log(`permaculture systems csv: ${paths.permacultureSystemsCsvPath}`);
  if (paths.permacultureScenariosCsvPath) console.log(`permaculture scenarios csv: ${paths.permacultureScenariosCsvPath}`);
  if ((report.warnings ?? []).length > 0) {
    console.log('warnings:');
    for (const w of report.warnings) console.log(`  - ${w}`);
  }
} catch (error) {
  console.error(`labour-land report failed: ${error.message}`);
  process.exit(1);
}
