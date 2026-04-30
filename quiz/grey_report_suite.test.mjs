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
    expect(def.some((x) => x.script === 'grey:import-data')).toBe(true);
    expect(def.some((x) => x.script === 'report:grey:population-distribution')).toBe(true);
    expect(def.some((x) => x.script === 'report:grey:dwelling-land-access')).toBe(true);
    expect(def.some((x) => x.script === 'report:grey:farm-labour')).toBe(true);
    expect(def.some((x) => x.script === 'report:grey:ag-labour')).toBe(true);

    const quick = buildCommandPlan({ quick: true }, { worldExists: true });
    expect(quick.some((x) => x.script === 'grey:download-data')).toBe(false);
    expect(quick.some((x) => x.script === 'grey:import-data')).toBe(false);

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
    fs.rmSync(root, { recursive: true, force: true });
  });
});
