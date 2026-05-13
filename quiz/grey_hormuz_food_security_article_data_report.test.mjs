import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { buildGreyCurrentSystemShockThresholdReport } from '../program/report/grey_current_system_shock_threshold_report.mjs';
import { buildGreyFoodGapReplacementReport } from '../program/report/grey_food_gap_replacement_report.mjs';
import { buildGreyFoodSupplyDemandPriceReport } from '../program/report/grey_food_supply_demand_price_report.mjs';
import { buildGreyHormuzFoodSecurityArticleDataReport } from '../program/report/grey_hormuz_food_security_article_data_report.mjs';

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

describe('grey hormuz food security article data report', () => {
  test('writes article-facing data with strict separation and corrected worker values', () => {
    const root = path.resolve('know/produce/hormuz-article-fixture');
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });

    writeJson(path.join(root, 'grey-food-calibration.json'), {
      totalFoodDemandGJ: 379967.868,
      foodDemandBaseline: { totalFoodDemandGJ: 379967.868 },
      population2021: 100905,
      plausibilityScenarios: [{ scenario: 'localizedPresentTechBaseline', foodCoverage: 0.472, netFoodEnergyGJ: 179345 }]
    });
    writeJson(path.join(root, 'grey-transition-pathways.json'), { assumptions: { currentFoodInsecurityShare: 0.25 } });
    writeJson(path.join(root, 'grey-ag-labour-baseline.json'), { currentAgIndustryFTEEstimate: 3918.43 });
    writeJson(path.join(root, 'grey-dwelling-land-access.json'), {
      totalPopulation: 100905,
      totalDwellings: 50183,
      estimatedPopulationNoDirectLandAccess: 7990,
      estimatedPopulationWithSubsistencePotential: 54949,
      broadParcelOrYardAccessPopulation: 92915,
      supplementalGardenAccessPopulation: 53695.55,
      meaningfulHouseholdFoodAccessPopulation: 30646.18,
      subsistencePotentialAccessPopulation: 6333.41,
      noMeaningfulFoodGrowingLandAccessPopulation: 61685.55,
      productionScaleAccessPopulation: 2239.85,
      thresholdSensitivity: [{ thresholdScenario: 'baseline', dwellingsAtOrAboveSubsistence: 28310.66 }]
    });
    writeJson(path.join(root, 'grey-population-distribution.json'), { totalPopulationMatched: 100905 });
    writeJson(path.join(root, 'grey-food-insecurity-trend-projection.json'), {
      articlePreferredProjection: {
        method: 'linear',
        projected2027RatePct: 30.0,
        projected2027People: 30272,
        rangeLowPeople: 29000,
        rangeHighPeople: 32000
      }
    });

    buildGreyCurrentSystemShockThresholdReport({ produceDir: root });
    buildGreyFoodGapReplacementReport({ produceDir: root });
    buildGreyFoodSupplyDemandPriceReport({ produceDir: root });

    const built = buildGreyHormuzFoodSecurityArticleDataReport({ produceDir: root });
    expect(fs.existsSync(built.paths.markdownPath)).toBe(true);
    expect(fs.existsSync(built.paths.jsonPath)).toBe(true);
    expect(fs.existsSync(built.paths.scenariosCsvPath)).toBe(true);

    const report = built.report;
    expect(report.notOnlyOilNote).toContain('not only an oil shock');
    expect(report.strictLandAccess.noMeaningfulFoodGrowingLandAccessPopulation).toBeCloseTo(61685.55, 1);
    expect(report.foodInsecurityTrendProjection.preferred2027ProjectedPeople).toBe(30272);
    expect(report.foodInsecurityTrendProjection.method).toBe('linear');

    const low = report.hormuzCurrentDisruptionScenarios.find((s) => s.scenario === 'currentDisruptionLow');
    expect(low.oilDieselStressPct).toBeGreaterThan(0);
    expect(low.lngNaturalGasStressPct).toBeGreaterThan(0);
    expect(low.nitrogenFertilizerStressPct).toBeGreaterThan(0);
    expect(low.sulfurPhosphateStressPct).toBeGreaterThan(0);
    expect(low.shippingStressPct).toBeGreaterThan(0);

    const extreme = report.hormuzCurrentDisruptionScenarios.find((s) => s.scenario === 'currentDisruptionExtreme');
    expect(extreme.globalFoodProductionLossPct).toBe(30);
    expect(String(extreme.caveat).toLowerCase()).toContain('not a forecast');

    const t10 = report.physicalLocalFoodResponseTargets.find((t) => t.scenario === 'foodGap10');
    expect(t10.modes.lowInputAnnualField.requiredGrowers).toBeCloseTo(2417.98, 1);
    expect(t10.modes.marketGardenIntensive.requiredGrowers).toBeCloseTo(3799.68, 1);
    expect(t10.modes.handToolHouseholdGarden.requiredGrowers).toBeCloseTo(9499.20, 1);

    // Ensure old bad values are not present.
    const text = fs.readFileSync(built.paths.markdownPath, 'utf8');
    expect(text).not.toContain('11399.04');
    expect(text).not.toContain('4885');
    expect(text).not.toContain('3109');

    // Pressure table and production table are separate outputs.
    expect(text).toContain('## Hormuz current-disruption scenarios');
    expect(text).toContain('## Physical local food response targets');
    expect(text).not.toContain('people kept out of food insecurity |');

    fs.rmSync(root, { recursive: true, force: true });
  });

  test('command runs', () => {
    const root = path.resolve('know/produce/hormuz-article-cmd-fixture');
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    writeJson(path.join(root, 'grey-current-system-shock-threshold.json'), {
      measuredFoodInsecurityAnchor: { defaultMeasuredFoodInsecurityShare: 0.25, measuredFoodInsecurityEstimate: 25000 },
      currentDisruptionBands: [{ scenario: 'currentDisruptionLow', bandLabel: 'low', globalFoodProductionLossPct: 5, localFoodAvailabilityStressPct: 4, foodPricePressureIndex: 0.4, fertilizerAvailabilityStressPct: 8, fuelAvailabilityStressPct: 10, shippingStressPct: 12 }],
      passThroughScenarios: [{ profile: 'linearConservative', shockScenario: 'fuelShock5', foodPriceIncreasePct: 5, calibratedFoodInsecurityEstimateUnderShock: 26000 }],
      foodInsecurityTrendProjection: [{ trendScenario: 'central', year: 2027, projectedMeasuredFoodInsecurityShareWithoutShock: 0.30, projectedFoodInsecurePeopleWithoutShock: 30300 }],
      severeSystemicInputLoss33Framing: {}
    });
    writeJson(path.join(root, 'grey-food-gap-replacement.json'), { foodGapScenarios: [], modalityReplacementMatrix: [] });
    writeJson(path.join(root, 'grey-food-supply-demand-price.json'), { supplyDemandScenarios: [] });
    writeJson(path.join(root, 'grey-dwelling-land-access.json'), { noMeaningfulFoodGrowingLandAccessPopulation: 61685.55 });
    writeJson(path.join(root, 'grey-population-distribution.json'), { totalPopulationMatched: 100905 });
    writeJson(path.join(root, 'grey-food-insecurity-trend-projection.json'), {
      articlePreferredProjection: {
        method: 'linear',
        projected2027RatePct: 30.0,
        projected2027People: 30300,
        rangeLowPeople: 29000,
        rangeHighPeople: 32000
      }
    });

    const run = spawnSync('node', ['command/report_grey_hormuz_food_security_article_data.mjs', `--produce-dir=${root}`], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('headline facts');

    fs.rmSync(root, { recursive: true, force: true });
  });
});
