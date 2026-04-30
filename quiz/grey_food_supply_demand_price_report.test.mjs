import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { buildGreyFoodSupplyDemandPriceReport } from '../program/report/grey_food_supply_demand_price_report.mjs';

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

describe('grey food supply-demand-price report', () => {
  test('writes outputs and price/demand logic behaves', () => {
    const root = path.resolve('know/produce/food-price-fixture');
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });

    writeJson(path.join(root, 'grey-food-calibration.json'), { totalFoodDemandGJ: 1000, population2021: 1000, plausibilityScenarios: [{ scenario: 'localizedPresentTechBaseline', foodCoverage: 0.5 }] });
    writeJson(path.join(root, 'grey-current-system-shock-threshold.json'), {
      measuredFoodInsecurityAnchor: { defaultMeasuredFoodInsecurityShare: 0.25 },
      shockScenarios: [
        { scenario: 'fuelShock0', fuelShockPct: 0, fuelAvailabilityIndex: 1, householdFoodPriceMultiplier: 1, householdTransportCostMultiplier: 1, foodCoverage: 0.5, lagMonthsToAcutePain: 2, foodInsecurityVulnerabilityPopulation: 250 },
        { scenario: 'fuelShock20', fuelShockPct: 20, fuelAvailabilityIndex: 0.8, householdFoodPriceMultiplier: 1.3, householdTransportCostMultiplier: 1.25, foodCoverage: 0.4, lagMonthsToAcutePain: 3, foodInsecurityVulnerabilityPopulation: 320 },
        { scenario: 'fuelShock30', fuelShockPct: 30, fuelAvailabilityIndex: 0.7, householdFoodPriceMultiplier: 1.4, householdTransportCostMultiplier: 1.35, foodCoverage: 0.35, lagMonthsToAcutePain: 4, foodInsecurityVulnerabilityPopulation: 360 },
        { scenario: 'fuelShock40', fuelShockPct: 40, fuelAvailabilityIndex: 0.6, householdFoodPriceMultiplier: 1.5, householdTransportCostMultiplier: 1.45, foodCoverage: 0.3, lagMonthsToAcutePain: 5, foodInsecurityVulnerabilityPopulation: 410 }
      ]
    });
    writeJson(path.join(root, 'grey-dwelling-land-access.json'), { totalPopulation: 1000, totalDwellings: 400, estimatedPopulationNoDirectLandAccess: 120, estimatedPopulationWithSubsistencePotential: 600, thresholdSensitivity: [{ thresholdScenario: 'baseline', dwellingsAtOrAboveSubsistence: 250 }] });
    writeJson(path.join(root, 'grey-ag-labour-baseline.json'), { currentAgIndustryFTEEstimate: 60 });

    try {
      const built = buildGreyFoodSupplyDemandPriceReport({ produceDir: root });
      expect(fs.existsSync(built.paths.markdownPath)).toBe(true);
      expect(fs.existsSync(built.paths.jsonPath)).toBe(true);
      expect(fs.existsSync(built.paths.scenariosCsvPath)).toBe(true);
      expect(fs.existsSync(built.paths.householdsCsvPath)).toBe(true);

      const rows = built.report.supplyDemandScenarios;
      const s20No = rows.find((r) => r.scenario === 'shock20NoAdaptation');
      const s20Garden = rows.find((r) => r.scenario === 'shock20GardenContribution');
      const s20Combined = rows.find((r) => r.scenario === 'shock20CombinedLocalResponse');
      const s40No = rows.find((r) => r.scenario === 'shock40NoAdaptation');
      const severeCombined = rows.find((r) => r.scenario === 'severeSystemicInputLoss33CombinedResponse');
      const trendNo = rows.find((r) => r.scenario === 'trend2027NoNewShockNoLocalResponse');
      const trend25 = rows.find((r) => r.scenario === 'trend2027NoNewShockSubsistenceMobilization25Pct');
      const trendCombined = rows.find((r) => r.scenario === 'trend2027NoNewShockCombinedLocalResponse');
      expect(s20Garden.reducedMarketDemandGJ).toBeGreaterThan(s20No.reducedMarketDemandGJ);
      expect(s20Garden.addedLocalSupplyGJ).toBeGreaterThan(s20No.addedLocalSupplyGJ);
      expect(s20Garden.foodPricePressureIndex).toBeLessThan(s20No.foodPricePressureIndex);
      expect(s20Combined.foodPricePressureIndex).toBeLessThan(s20No.foodPricePressureIndex);
      expect(s20Combined.foodPriceMultiplierEstimate).toBeLessThan(s20No.foodPriceMultiplierEstimate);
      expect(s40No.foodPricePressureIndex).toBeGreaterThan(s20No.foodPricePressureIndex);
      expect(s20No.noDirectLandAccessRemainingVulnerable).toBeGreaterThan(0);
      expect(s20No.tightMarketFoodPriceMultiplierEstimate).toBeGreaterThan(s20No.conservativeFoodPriceMultiplierEstimate);
      expect(severeCombined.globalFoodProductionLossShare).toBeCloseTo(0.33, 6);
      expect(severeCombined.localFoodAvailabilityLossShare).toBeLessThan(0.33);
      expect(String(severeCombined.interpretation)).toContain('global');
      expect(trendCombined.calibratedFoodInsecurityEstimate).toBeLessThan(trendNo.calibratedFoodInsecurityEstimate);
      expect(trendCombined.foodInsecurityAvoidedVsTrendNoResponse).toBeGreaterThan(0);
      expect(trend25.additionalFoodWorkersNeeded).toBeGreaterThan(0);
      expect(trendCombined.additionalFoodWorkersNeeded).toBeGreaterThan(trendNo.additionalFoodWorkersNeeded);

      const md = fs.readFileSync(built.paths.markdownPath, 'utf8');
      expect(md).toContain('proxy, not a price forecast');
      expect(md.toLowerCase()).toContain('trend-only');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('command runs', () => {
    const root = path.resolve('know/produce/food-price-cmd-fixture');
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    writeJson(path.join(root, 'grey-food-calibration.json'), { totalFoodDemandGJ: 1000, population2021: 1000, plausibilityScenarios: [] });
    writeJson(path.join(root, 'grey-current-system-shock-threshold.json'), { measuredFoodInsecurityAnchor: { defaultMeasuredFoodInsecurityShare: 0.25 }, shockScenarios: [] });
    try {
      const run = spawnSync('node', ['command/report_grey_food_supply_demand_price.mjs', `--produce-dir=${root}`], { encoding: 'utf8' });
      expect(run.status).toBe(0);
      expect(run.stdout).toContain('shock20');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
