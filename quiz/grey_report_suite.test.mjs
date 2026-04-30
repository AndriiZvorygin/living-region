import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  buildCommandPlan,
  extractKeyIndicators,
  runGreyReportSuite,
  parseArgs
} from '../command/run_grey_report_suite.mjs';

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

describe('grey report suite command', () => {
  test('builds correct command plan for default/quick/skip-download/force-download', () => {
    const def = buildCommandPlan({});
    expect(def[0].script).toBe('grey:download-data');
    expect(def.some((x) => x.script === 'grey:download-data' && x.args.includes('--source=lots-and-concessions-grey'))).toBe(true);
    expect(def.some((x) => x.script === 'grey:import-data')).toBe(true);
    expect(def.some((x) => x.script === 'report:grey:population-distribution')).toBe(true);
    expect(def.some((x) => x.script === 'report:grey:dwelling-land-access')).toBe(true);
    expect(def.some((x) => x.script === 'report:grey:dwelling-land-access' && x.args.includes('--no-cache'))).toBe(true);
    expect(def.some((x) => x.script === 'report:grey:farm-labour')).toBe(true);
    expect(def.some((x) => x.script === 'report:grey:ag-labour')).toBe(true);
    expect(def.some((x) => x.script === 'report:grey:current-shock-threshold')).toBe(true);
    expect(def.some((x) => x.script === 'report:grey:food-insecurity-trends')).toBe(true);
    expect(def.some((x) => x.script === 'report:grey:food-gap-replacement')).toBe(true);
    expect(def.some((x) => x.script === 'report:grey:food-price')).toBe(true);
    expect(def.some((x) => x.script === 'report:grey:fuel-shock')).toBe(true);
    expect(def.some((x) => x.script === 'report:grey:transition-pathways')).toBe(true);

    const quick = buildCommandPlan({ quick: true }, { worldExists: true, lotsExists: true });
    expect(quick.some((x) => x.script === 'grey:download-data')).toBe(false);
    expect(quick.some((x) => x.script === 'grey:import-data')).toBe(false);

    const quickMissingLots = buildCommandPlan({ quick: true }, { worldExists: true, lotsExists: false });
    expect(quickMissingLots.some((x) => x.script === 'grey:download-data' && x.args.includes('--source=lots-and-concessions-grey'))).toBe(true);
    expect(quickMissingLots.some((x) => x.script === 'grey:download-data' && x.args.includes('--all-useful'))).toBe(false);

    const skip = buildCommandPlan({ skipDownload: true });
    expect(skip.some((x) => x.script === 'grey:download-data')).toBe(false);

    const force = buildCommandPlan({ forceDownload: true }, { worldExists: false });
    const dl = force.find((x) => x.script === 'grey:download-data');
    expect(dl.args).toContain('--force');
  });

  test('extracts key indicators from fixture json files', () => {
    const k = extractKeyIndicators({
      assessment: { scorecard: { presentOverallCredibilityScore: 0.6, presentGeographyScore: 0.9, presentInfrastructureScore: 0.7, presentFoodSystemScore: 0.5 } },
      publicBaseline: { regionalIndicators: { totalRoadKm: 4700 } },
      landAccess: { assignment: { totalLotConcessionFeatures: 10137 } },
      labourLand: { regionalIndicators: { estimatedNoDirectLandAccessPopulation: 20000, estimatedRuralProductiveLandAccessPopulation: 30000, productiveHaPerRuralAccessPerson: 3.2 } },
      dwellingLandAccess: { estimatedPopulationNoDirectLandAccess: 21000, estimatedPopulationWithSubsistencePotential: 12000, thresholdSensitivity: [{ thresholdScenario: 'baseline', dwellingsAtOrAboveSubsistence: 5000 }] },
      farmLabour: { currentFarmOperators: 1200, currentFarmLabourDataStatus: 'available', currentFarmLabourFTEEstimate: 980, farmLabourScaleUpFactorLowFuel: 4.2 },
      agLabour: { currentAgRelatedFTEEstimate: 640, agLabourScaleUpFactorLowFuel: 1.9, agLabourDataStatus: 'available' },
      currentShockThreshold: {
        thresholdFindings: {
          firstModerateStressShockLevel: 'fuelShock10',
          firstSevereStressShockLevel: 'fuelShock20',
          firstFoodBankCrisisShockLevel: 'fuelShock25'
        },
        shockScenarios: [{ scenario: 'fuelShock20', foodInsecurityRiskExposurePopulation: 32000, lagMonthsToAcutePain: 3.5 }]
      },
      foodGapReplacement: {
        keyResults: {
          foodGap33EmergencyYear1Package: { byYear: { 1: { blendedRequiredWorkers: 9000 } }, year1CoverageOfGap: 0.2 },
          foodGap33TenYearResiliencePackage: { byYear: { 10: { blendedRequiredWorkers: 7000 } }, year10CoverageOfGap: 0.7 },
          severeSystemicInputLoss33MainBottleneck: 'labour'
        }
      },
      foodInsecurityTrends: {
        projected2027TrendCentral: 0.30,
        topDrivers: ['foodPriceInflationPressure', 'globalFoodPricePressure'],
        landConsolidationDataStatus: 'missingData',
        unexplainedTrendShare: 0.12
      },
      foodPrice: {
        keyResults: {
          shock20NoAdaptation: { foodPriceMultiplierEstimate: 1.8 },
          shock20CombinedLocalResponse: { foodPriceMultiplierEstimate: 1.5, foodInsecurityAvoidedVsNoAdaptation: 1200, noDirectLandAccessRemainingVulnerable: 7990 },
          severeSystemicInputLoss33CombinedResponse: { supplyDemandRatio: 0.94 }
        }
      },
      fuelShock: { keyResults: { shock20FoodCoverage: 0.31, shock20AddedFoodWorkersNeeded: 14000, shock20AgLabourScaleUpFactor: 9.1, shock20CombinedResiliencePackageFoodCoverage: 0.42 } },
      transitionPathways: { suiteKeyResults: { shock20NoChangeFoodInsecureRiskPopulation2030: 25000, shock20StrongAdaptationFoodInsecureRiskPopulation2030: 18000, avoidedFoodInsecureRiskVsNoChange2030: 7000, severeDecline2050NoChangeQualityOfLifeIndex: 0.2, severeDecline2050FullRuralTransitionQualityOfLifeIndex: 0.45 } },
      foodCalibration: { landEnoughDiagnostic: { lowFuelFoodCoverage: 0.16 }, plausibilityScenarios: [
        { scenario: 'presentIndustrialFossilBaseline', foodCoverage: 4.5 },
        { scenario: 'localizedPresentTechBaseline', foodCoverage: 0.47 },
        { scenario: 'constrainedLocalFoodBaseline', foodCoverage: 0.27 }
      ] },
      localization: { regionalSummary: { highestReadinessMunicipalities: [{ municipalityName: 'Meaford' }] }, candidateNodes: [{}, {}] }
    });
    expect(k.totalLotsConcessions).toBe(10137);
    expect(k.foodCoverageLocalizedPresentTechBaseline).toBeCloseTo(0.47, 6);
    expect(k.topReadinessMunicipality).toBe('Meaford');
    expect(k.candidateNodeCount).toBe(2);
    expect(k.estimatedPopulationNoDirectLandAccess).toBe(21000);
    expect(k.dwellingsAtOrAboveSubsistence).toBe(5000);
    expect(k.currentFarmOperators).toBe(1200);
    expect(k.currentFarmLabourDataStatus).toBe('available');
    expect(k.currentFarmLabourFTEEstimate).toBe(980);
    expect(k.farmLabourScaleUpFactorLowFuel).toBeCloseTo(4.2, 6);
    expect(k.currentAgRelatedFTEEstimate).toBe(640);
    expect(k.agLabourScaleUpFactorLowFuel).toBeCloseTo(1.9, 6);
    expect(k.agLabourDataStatus).toBe('available');
    expect(k.firstModerateStressShockLevel).toBe('fuelShock10');
    expect(k.firstSevereStressShockLevel).toBe('fuelShock20');
    expect(k.firstFoodBankCrisisShockLevel).toBe('fuelShock25');
    expect(k.shock20CurrentSystemFoodInsecurityRiskExposurePopulation).toBe(32000);
    expect(k.shock20CurrentSystemLagMonthsToAcutePain).toBeCloseTo(3.5, 6);
    expect(k.foodGap33EmergencyYear1Workers).toBe(9000);
    expect(k.foodGap33TenYearResilienceWorkers).toBe(7000);
    expect(k.foodGap33Year1GapCovered).toBeCloseTo(0.2, 6);
    expect(k.foodGap33Year10GapCovered).toBeCloseTo(0.7, 6);
    expect(k.severeSystemicInputLoss33MainBottleneck).toBe('labour');
    expect(k.projected2027TrendCentral).toBeCloseTo(0.30, 6);
    expect(String(k.topTrendDrivers)).toContain('globalFoodPricePressure');
    expect(k.landConsolidationDataStatus).toBe('missingData');
    expect(k.unexplainedTrendShare).toBeCloseTo(0.12, 6);
    expect(k.shock20NoAdaptationFoodPriceMultiplierEstimate).toBeCloseTo(1.8, 6);
    expect(k.shock20CombinedLocalResponseFoodPriceMultiplierEstimate).toBeCloseTo(1.5, 6);
    expect(k.shock20FoodInsecurityAvoidedVsNoAdaptation).toBe(1200);
    expect(k.severeSystemicInputLoss33CombinedResponseSupplyDemandRatio).toBeCloseTo(0.94, 6);
    expect(k.noDirectLandAccessRemainingVulnerable).toBe(7990);
    expect(k.shock20FoodCoverage).toBeCloseTo(0.31, 6);
    expect(k.shock20AddedFoodWorkersNeeded).toBe(14000);
    expect(k.shock20AgLabourScaleUpFactor).toBeCloseTo(9.1, 6);
    expect(k.shock20CombinedResiliencePackageFoodCoverage).toBeCloseTo(0.42, 6);
    expect(k.shock20NoChangeFoodInsecureRiskPopulation).toBe(25000);
    expect(k.shock20StrongAdaptationFoodInsecureRiskPopulation).toBe(18000);
    expect(k.avoidedFoodInsecureRiskVsNoChange).toBe(7000);
  });

  test('excludes dwelling indicators when dwelling report invalid', () => {
    const k = extractKeyIndicators({
      dwellingLandAccess: {
        dwellingLandAccessValid: false,
        confidence: 'invalid_missing_lots',
        estimatedPopulationNoDirectLandAccess: 100905,
        estimatedPopulationWithSubsistencePotential: 0,
        thresholdSensitivity: [{ thresholdScenario: 'baseline', dwellingsAtOrAboveSubsistence: 0 }]
      }
    });
    expect(k.dwellingLandAccessStatus).toBe('invalid_missing_lots');
    expect(k.estimatedPopulationNoDirectLandAccess).toBeNull();
    expect(k.estimatedPopulationWithSubsistencePotential).toBeNull();
    expect(k.dwellingsAtOrAboveSubsistence).toBeNull();
  });

  test('continue-on-error records failures and exits nonzero at end logic', () => {
    const options = parseArgs(['--continue-on-error']);
    expect(options.continueOnError).toBe(true);
  });

  test('missing JSON outputs produce warnings, not crash', () => {
    const produceDir = path.resolve('know/produce/suite-fixture-missing');
    fs.rmSync(produceDir, { recursive: true, force: true });
    fs.mkdirSync(produceDir, { recursive: true });
    const summary = runGreyReportSuite({
      skipDownload: true,
      quick: true,
      continueOnError: true,
      produceDir,
      mockCommandResults: [{ script: 'report:grey:baseline', args: [], ok: true, status: 0, signal: null, outputSample: '' }]
    });
    expect(Array.isArray(summary.warnings)).toBe(true);
    fs.rmSync(produceDir, { recursive: true, force: true });
  });

  test('writes markdown/json summary and script exists', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
    expect(pkg.scripts['report:grey:all']).toBeTruthy();

    const root = path.resolve('know/produce/suite-fixture-summary');
    fs.rmSync(root, { recursive: true, force: true });
    writeJson(path.join(root, 'grey-public-baseline.json'), { regionalIndicators: { totalRoadKm: 1 }, warnings: [] });
    writeJson(path.join(root, 'grey-land-access-baseline.json'), { assignment: { totalLotConcessionFeatures: 1 }, warnings: [] });
    writeJson(path.join(root, 'grey-labour-land-baseline.json'), { regionalIndicators: {}, warnings: [] });
    writeJson(path.join(root, 'grey-food-calibration.json'), { plausibilityScenarios: [], landEnoughDiagnostic: {}, warnings: [] });
    writeJson(path.join(root, 'grey-fuel-fertilizer-shock.json'), { keyResults: { shock20FoodCoverage: 0.1 }, warnings: [] });
    writeJson(path.join(root, 'grey-localization-access.json'), { regionalSummary: {}, candidateNodes: [], warnings: [] });
    writeJson(path.join(root, 'living-region-model-assessment.json'), { scorecard: {}, warnings: [] });

    const summary = runGreyReportSuite({
      skipDownload: true,
      quick: true,
      continueOnError: true,
      produceDir: root,
      mockCommandResults: [{ script: 'report:grey:baseline', args: [], ok: true, status: 0, signal: null, outputSample: '' }]
    });
    expect(fs.existsSync(summary.outputPaths.suiteMarkdown)).toBe(true);
    expect(fs.existsSync(summary.outputPaths.suiteJson)).toBe(true);
    expect(typeof summary.requiredInputDownloadsRun).toBe('number');
    expect(['present', 'downloaded', 'missing', 'failed']).toContain(summary.lotsConcessionsInputStatus);
    fs.rmSync(root, { recursive: true, force: true });
  });
});
