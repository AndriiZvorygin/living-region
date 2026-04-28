// SPDX-License-Identifier: AGPL-3.0-or-later
import { generateGreyCountyWorld } from '../program/data/generate_grey_county_world.mjs';
import { runScenario } from '../program/simulation/run_scenario.mjs';
import { demoScenarioAdaptation, demoScenarioAdaptationWithRailFreightCorridor } from '../program/data/demo_scenario.mjs';

function parseArgs(argv) {
  const args = {};
  for (const item of argv) {
    if (!item.startsWith('--')) continue;
    const [key, value] = item.slice(2).split('=');
    args[key] = value ?? true;
  }
  return args;
}

function toBool(value, fallback = false) {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function runCase({ rail }) {
  const world = generateGreyCountyWorld({ scale: 'full-county', includeRail: rail, includeWaterFreight: rail, includeSyntheticPolygons: true });
  const scenario = rail ? demoScenarioAdaptationWithRailFreightCorridor() : demoScenarioAdaptation();
  return runScenario(world, scenario).years.at(-1);
}

function f(v, d = 3) { return Number(v ?? 0).toFixed(d); }
function perPerson(v, p) { return (p ?? 0) > 0 ? (v ?? 0) / p : 0; }

const args = parseArgs(process.argv.slice(2));
const samePopulationBaseline = toBool(args.samePopulationBaseline, true);

const noRail = runCase({ rail: false });
const rail = runCase({ rail: true });

const noRailPop = noRail.populationTotal ?? 0;
const railPop = rail.populationTotal ?? 0;
const normalizedPop = noRailPop;
const railCoverageNormalized = normalizedPop > 0 ? (rail.netFoodAvailableGJ ?? 0) / (rail.totalFoodDemandGJ ?? 1) * (railPop / normalizedPop) : 0;
const railSurplusNormalized = (rail.netFoodAvailableGJ ?? 0) - (rail.totalFoodDemandGJ ?? 0) * (normalizedPop / Math.max(1, railPop));

const differences = {
  populationDifference: railPop - noRailPop,
  productiveFoodHaDifference: (rail.humanEdibleFoodHa ?? 0) - (noRail.humanEdibleFoodHa ?? 0),
  foodLabourAvailableDifference: (rail.effectiveFoodLabourAvailableDays ?? 0) - (noRail.effectiveFoodLabourAvailableDays ?? 0),
  foodLabourDeficitDifference: (rail.foodLabourDeficitDays ?? 0) - (noRail.foodLabourDeficitDays ?? 0),
  netFoodAvailableDifferenceGJ: (rail.netFoodAvailableGJ ?? 0) - (noRail.netFoodAvailableGJ ?? 0),
  storageLossDifferenceGJ: ((rail.producedCalories ?? 0) * (rail.spoilageRate ?? 0) - (noRail.producedCalories ?? 0) * (noRail.spoilageRate ?? 0)) / 239005.736,
  transportLossDifferenceGJ: (((rail.transportDieselDeficitLitre ?? 0) - (noRail.transportDieselDeficitLitre ?? 0)) * 0.028),
  fertilizerEnergyConstraintDifferenceGJ: ((rail.fertilizerCostThresholdForLowInput ?? 0) - (noRail.fertilizerCostThresholdForLowInput ?? 0)) * 10,
  householdFoodDemandDifferenceGJ: (rail.totalFoodDemandGJ ?? 0) - (noRail.totalFoodDemandGJ ?? 0)
};

console.log('Grey Full Food Comparison');
console.log(`samePopulationBaseline: ${samePopulationBaseline}`);
console.log('');

for (const [label, item] of [['No Rail', noRail], ['Rail Freight Corridor', rail]]) {
  const pop = item.populationTotal ?? 0;
  console.log(`${label}:`);
  console.log(`  populationTotal: ${Math.round(pop)}`);
  console.log(`  foodCoverage: ${f(item.localFoodCoverageRatio)}`);
  console.log(`  foodSurplusGJ: ${f(item.foodSurplusGJ, 2)}`);
  console.log(`  totalFoodDemandGJ: ${f(item.totalFoodDemandGJ, 2)}`);
  console.log(`  netFoodAvailableGJ: ${f(item.netFoodAvailableGJ, 2)}`);
  console.log(`  netFoodAvailableGJPerPerson: ${f(perPerson(item.netFoodAvailableGJ, pop), 3)}`);
  console.log(`  humanEdibleFoodHaPerPerson: ${f(perPerson(item.humanEdibleFoodHa, pop), 4)}`);
  console.log(`  foodSurplusGJPerPerson: ${f(perPerson(item.foodSurplusGJ, pop), 3)}`);
  console.log(`  foodLabourCoverageRatio: ${f(item.foodLabourCoverageRatio)}`);
  console.log(`  foodLabourDeficitDays: ${Math.round(item.foodLabourDeficitDays ?? 0)}`);
  console.log(`  foodPricePerGJ: ${f(item.foodPricePerGJ, 2)}`);
  console.log(`  householdsFoodInsecureRisk: ${Math.round(item.householdsFoodInsecureRisk ?? 0)}`);
  console.log('');
}

console.log('Diagnostics:');
for (const [key, value] of Object.entries(differences)) {
  const direction = value >= 0 ? 'higher in rail' : 'lower in rail';
  console.log(`  - ${key}: ${f(value, 2)} (${direction})`);
}

if ((railPop - noRailPop) > 0) {
  console.log('');
  console.log('Explanation:');
  console.log('  - Rail scenario retains/supports more population, increasing food demand unless food production also expands.');
}

if (samePopulationBaseline) {
  console.log('');
  console.log('Normalized To No-Rail Population:');
  console.log(`  baselinePopulation: ${Math.round(normalizedPop)}`);
  console.log(`  railFoodCoverageAtNoRailPopulation: ${f(railCoverageNormalized, 3)}`);
  console.log(`  railFoodSurplusGJAtNoRailPopulation: ${f(railSurplusNormalized, 2)}`);
}
