import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { buildGreyTransitionPathwayReport } from '../program/report/grey_transition_pathway_report.mjs';

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

describe('grey transition pathway report', () => {
  test('writes markdown/json/csv and adaptation improves outcomes vs noChange', () => {
    const root = path.resolve('know/produce/transition-pathway-fixture');
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });

    writeJson(path.join(root, 'grey-food-calibration.json'), {
      foodDemandBaseline: { totalFoodDemandGJ: 1000 },
      plausibilityScenarios: [
        { scenario: 'localizedPresentTechBaseline', foodCoverage: 0.5 },
        { scenario: 'constrainedLocalFoodBaseline', foodCoverage: 0.3 }
      ]
    });
    writeJson(path.join(root, 'grey-fuel-fertilizer-shock.json'), {
      shockScenarios: [{ scenario: 'shock20', foodWorkersNeededFTE: 10000 }]
    });
    writeJson(path.join(root, 'grey-labour-land-baseline.json'), { regionalIndicators: {} });
    writeJson(path.join(root, 'grey-ag-labour-baseline.json'), { currentAgIndustryFTEEstimate: 1000, agLabourDataStatus: 'available' });
    writeJson(path.join(root, 'grey-dwelling-land-access.json'), {
      totalPopulation: 100000,
      outsideSettlementPopulation: 50000,
      estimatedPopulationNoDirectLandAccess: 8000,
      estimatedPopulationWithSubsistencePotential: 55000
    });
    writeJson(path.join(root, 'grey-localization-access.json'), { regionalSummary: {} });

    try {
      const built = buildGreyTransitionPathwayReport({ produceDir: root });
      expect(fs.existsSync(built.paths.markdownPath)).toBe(true);
      expect(fs.existsSync(built.paths.jsonPath)).toBe(true);
      expect(fs.existsSync(built.paths.scenariosCsvPath)).toBe(true);
      expect(fs.existsSync(built.paths.humanImpactCsvPath)).toBe(true);
      expect(fs.existsSync(built.paths.timelineCsvPath)).toBe(true);

      const noChange2030 = built.report.scenarioRows.find((r) => r.declinePath === 'abruptShock20' && r.adaptationPathway === 'noChange' && r.year === 2030);
      const strong2030 = built.report.scenarioRows.find((r) => r.declinePath === 'abruptShock20' && r.adaptationPathway === 'strongAdaptation' && r.year === 2030);
      expect(strong2030.foodCoverage).toBeGreaterThanOrEqual(noChange2030.foodCoverage);
      expect(strong2030.householdStressIndex).toBeLessThanOrEqual(noChange2030.householdStressIndex);
      expect(noChange2030.severeFoodStressPopulation).toBeLessThanOrEqual(noChange2030.foodInsecurityRiskExposurePopulation);
      expect(noChange2030.foodInsecurityRiskExposurePopulation).toBeLessThanOrEqual(noChange2030.foodStressRiskPopulation);

      const severeNoChange2050 = built.report.scenarioRows.find((r) => r.declinePath === 'severeDecline' && r.adaptationPathway === 'noChange' && r.year === 2050);
      const severeNoChange2030 = built.report.scenarioRows.find((r) => r.declinePath === 'severeDecline' && r.adaptationPathway === 'noChange' && r.year === 2030);
      expect(severeNoChange2050.foodCoverage).toBeLessThanOrEqual(severeNoChange2030.foodCoverage);

      const full2030 = built.report.scenarioRows.find((r) => r.declinePath === 'moderateDecline' && r.adaptationPathway === 'fullRuralTransition' && r.year === 2030);
      const full2050 = built.report.scenarioRows.find((r) => r.declinePath === 'moderateDecline' && r.adaptationPathway === 'fullRuralTransition' && r.year === 2050);
      expect(full2050.foodCoverage).toBeGreaterThanOrEqual(full2030.foodCoverage);
      const baselineNoShockNoChange2050 = built.report.scenarioRows.find((r) => r.declinePath === 'baselineNoShock' && r.adaptationPathway === 'noChange' && r.year === 2050);
      const severeFull2050 = built.report.scenarioRows.find((r) => r.declinePath === 'severeDecline' && r.adaptationPathway === 'fullRuralTransition' && r.year === 2050);
      expect(severeFull2050.qualityOfLifeIndex).toBeGreaterThan(severeNoChange2050.qualityOfLifeIndex);
      expect(severeFull2050.qualityOfLifeIndex).toBeLessThan(1);
      expect(severeFull2050.qualityOfLifeIndex).toBeLessThanOrEqual(severeFull2050.maxQualityOfLifeUnderDecline);
      expect(severeFull2050.localResilienceIndex).toBeGreaterThanOrEqual(severeFull2050.qualityOfLifeIndex);
      expect(severeFull2050.qualityOfLifeIndex).toBeGreaterThanOrEqual(baselineNoShockNoChange2050.qualityOfLifeIndex);

      const md = fs.readFileSync(built.paths.markdownPath, 'utf8');
      expect(md).toContain('Decline paths are scenarios, not forecasts');
      expect(md).toContain('not direct hunger forecasts');
      expect(md).toContain('not a utopia/perfect-conditions claim');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('command exits and prints key comparison fields', () => {
    const root = path.resolve('know/produce/transition-pathway-command');
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    writeJson(path.join(root, 'grey-food-calibration.json'), { foodDemandBaseline: { totalFoodDemandGJ: 1000 }, plausibilityScenarios: [] });
    writeJson(path.join(root, 'grey-fuel-fertilizer-shock.json'), {});
    writeJson(path.join(root, 'grey-labour-land-baseline.json'), {});
    writeJson(path.join(root, 'grey-ag-labour-baseline.json'), {});
    writeJson(path.join(root, 'grey-dwelling-land-access.json'), {});
    try {
      const run = spawnSync('node', ['command/report_grey_transition_pathways.mjs', `--produce-dir=${root}`], { encoding: 'utf8' });
      expect(run.status).toBe(0);
      expect(run.stdout).toContain('scenario rows:');
      expect(run.stdout).toContain('shock20 noChange foodInsecureRiskPopulation2030');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
