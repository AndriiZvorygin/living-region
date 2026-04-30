import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { buildGreyPlainEnglishBriefingReport } from '../program/report/grey_plain_english_briefing_report.mjs';

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

describe('grey plain english briefing report', () => {
  test('writes briefing markdown/json/email and includes key caveats', () => {
    const root = path.resolve('know/produce/briefing-fixture');
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });

    writeJson(path.join(root, 'grey-report-suite-summary.json'), {});
    writeJson(path.join(root, 'living-region-model-assessment.json'), {});
    writeJson(path.join(root, 'grey-public-baseline.json'), {
      regionalIndicators: { population2021: 100905, settlementBoundaryCount: 56, totalRoadKm: 4794.16 },
      coreLayers: [{ id: 'municipality-boundaries', featureCount: 9 }]
    });
    writeJson(path.join(root, 'grey-population-distribution.json'), {
      totalPopulationMatched: 100905,
      totalDwellingsMatched: 50183,
      populationInsideSettlementBoundaries: 49882,
      populationOutsideSettlementBoundaries: 51023
    });
    writeJson(path.join(root, 'grey-dwelling-land-access.json'), {
      estimatedPopulationNoDirectLandAccess: 7990,
      estimatedPopulationWithSubsistencePotential: 54949,
      thresholdSensitivity: [{ thresholdScenario: 'baseline', dwellingsAtOrAboveSubsistence: 28310.66 }]
    });
    writeJson(path.join(root, 'grey-ag-labour-baseline.json'), {
      agricultureIndustryWorkers: 4721,
      currentAgIndustryFTEEstimate: 3918.43,
      agLabourScaleUpFactorLowFuelIndustry: 10.42
    });
    writeJson(path.join(root, 'grey-food-calibration.json'), {
      plausibilityScenarios: [
        { scenario: 'presentIndustrialFossilBaseline', foodCoverage: 4.617 },
        { scenario: 'localizedPresentTechBaseline', foodCoverage: 0.472 },
        { scenario: 'constrainedLocalFoodBaseline', foodCoverage: 0.277 }
      ],
      scenarioAssumptions: {
        lowFuelTransitionBaseline: {
          fuelAvailabilityIndex: 0.7,
          fertilizerAvailabilityIndex: 0.75,
          machinerySupportFactor: 0.62
        }
      },
      landEnoughDiagnostic: { lowFuelFoodCoverage: 0.167 }
    });
    writeJson(path.join(root, 'grey-fuel-fertilizer-shock.json'), {
      shockScenarios: [
        { scenario: 'shock20', foodCoverage: 0.355, addedFoodWorkersNeededVsCurrent: 26930.46, agLabourScaleUpFactor: 7.87 },
        { scenario: 'shock40', foodCoverage: 0.289, addedFoodWorkersNeededVsCurrent: 31537.88 }
      ],
      scenarioAssumptions: {
        shock20: { fuelAvailabilityIndex: 0.8, fertilizerAvailabilityIndex: 0.82, machinerySupportFactor: 0.74, transportFuelAvailabilityIndex: 0.78, effectiveNetGJPerHa: 3.6, foodCoverage: 0.355, foodWorkersNeededFTE: 31000 },
        shock40: { fuelAvailabilityIndex: 0.6, fertilizerAvailabilityIndex: 0.66, machinerySupportFactor: 0.55, transportFuelAvailabilityIndex: 0.58, effectiveNetGJPerHa: 2.9, foodCoverage: 0.289, foodWorkersNeededFTE: 35500 },
        combinedResiliencePackage: { foodCoverage: 0.441, requiredNewFoodWorkers: 22000 }
      },
      adaptationComparisons: [{ scenario: 'shock20', adaptationPackage: 'combinedResiliencePackage', foodCoverage: 0.441 }]
    });
    writeJson(path.join(root, 'grey-transition-pathways.json'), {
      suiteKeyResults: {
        shock20NoChangeFoodInsecureRiskPopulation2030: 69385,
        shock20StrongAdaptationFoodInsecureRiskPopulation2030: 51094,
        avoidedFoodInsecureRiskVsNoChange2030: 18291,
        severeDecline2050NoChangeQualityOfLifeIndex: 0.345,
        severeDecline2050FullRuralTransitionQualityOfLifeIndex: 0.87
      }
    });
    writeJson(path.join(root, 'grey-localization-access.json'), {});
    writeJson(path.join(root, 'grey-land-access-baseline.json'), { assignment: { totalLotConcessionFeatures: 10137 } });
    writeJson(path.join(root, 'grey-labour-land-baseline.json'), {});

    try {
      const built = buildGreyPlainEnglishBriefingReport({ produceDir: root });
      expect(fs.existsSync(built.paths.markdownPath)).toBe(true);
      expect(fs.existsSync(built.paths.jsonPath)).toBe(true);
      expect(fs.existsSync(built.paths.emailSummaryPath)).toBe(true);

      const parsed = JSON.parse(fs.readFileSync(built.paths.jsonPath, 'utf8'));
      expect(Array.isArray(parsed.findings)).toBe(true);
      expect(parsed.keyNumbers.population2021).toBe(100905);
      expect(parsed.scenarioAssumptions).toBeTruthy();
      expect(parsed.scenarioAssumptions.lowFuelTransitionBaseline).toBeTruthy();
      expect(parsed.scenarioAssumptions.shock20).toBeTruthy();

      const md = fs.readFileSync(built.paths.markdownPath, 'utf8');
      expect(md).toContain('not an official forecast');
      expect(md).toContain('Risk-exposure outputs are not direct hunger forecasts');
      expect(md).toContain('Lots/concessions are historical land-structure references, not ownership parcels');
      expect(md).toContain('What is real data-backed now');
      expect(md).toContain('Main findings so far');
      expect(md).toContain('Scenario assumption snapshot');
      expect(md).toMatch(/low-fuel transition baseline.*0\.70|0\.7/i);

      const email = fs.readFileSync(built.paths.emailSummaryPath, 'utf8');
      expect(email).toContain('early diagnostic modelling, not an official forecast');
      expect(email).toContain('not parcel ownership');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('command exits and prints output paths', () => {
    const root = path.resolve('know/produce/briefing-command-fixture');
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    writeJson(path.join(root, 'grey-public-baseline.json'), {});
    try {
      const run = spawnSync('node', ['command/report_grey_briefing.mjs', `--produce-dir=${root}`], { encoding: 'utf8' });
      expect(run.status).toBe(0);
      expect(run.stdout).toContain('title:');
      expect(run.stdout).toContain('markdown:');
      expect(run.stdout).toContain('email summary:');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
