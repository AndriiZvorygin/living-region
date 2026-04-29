import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { buildLivingRegionModelAssessment } from '../program/report/living_region_model_assessment.mjs';

describe('living region model assessment report', () => {
  test('assessment command writes Markdown/JSON/CSV and contains core sections', () => {
    const root = path.resolve('know/produce/model-assessment-fixture');
    const produceDir = root;
    fs.mkdirSync(produceDir, { recursive: true });

    fs.writeFileSync(path.join(produceDir, 'grey-public-baseline.json'), JSON.stringify({
      dataStatus: { coreRealLayersLoaded: 4, coreLayersExpected: 4, secondaryLayersLoaded: 11, secondaryLayersTracked: 12 },
      coreLayers: [{ id: 'municipality-boundaries', featureCount: 9 }],
      secondaryLayers: [{ id: 'grey-transit-bus-stops', featureCount: 23 }],
      regionalIndicators: {
        population2021: 100905,
        settlementBoundaryCount: 56,
        landUseFeatureCount: 6729,
        totalRoadKm: 4741.82,
        roadFeatureCount: 6327
      },
      serviceAccessIndicators: {
        lotsAndConcessionsFeatureCount: 10137,
        transitStopCount: 23,
        ruralBusinessCount: 197,
        facilityCount: 35,
        roadStructureCount: 31,
        roadConditionFeatureCount: 590
      }
    }, null, 2));

    fs.writeFileSync(path.join(produceDir, 'grey-baseline-summary.json'), JSON.stringify({
      totalPopulation2021: 100905,
      settlementBoundaryCount: 56,
      landUseFeatureCount: 6729,
      roadFeatureCount: 6327,
      totalRoadKm: 4741.82,
      roadClassCounts: { 5: 5000 },
      assignmentDiagnostics: { landUseAssignedToMunicipalityCount: 6600 }
    }, null, 2));

    fs.writeFileSync(path.join(produceDir, 'grey-land-access-baseline.json'), JSON.stringify({
      assignment: { totalLotConcessionFeatures: 10137, assignedToMunicipalityCount: 10118 }
    }, null, 2));

    fs.writeFileSync(path.join(produceDir, 'grey-labour-land-baseline.json'), JSON.stringify({
      assumptions: { caveat: 'Lots and concessions are not ownership parcels; baseline estimate.' },
      communityAnimalPowerScenarios: [{ winterServiceNotEquivalentTo: 'modern municipal plow truck road clearing' }],
      regionalIndicators: { estimatedProductiveLandHa: 109000 }
    }, null, 2));

    fs.writeFileSync(path.join(produceDir, 'grey-county-open-data-metrics.json'), JSON.stringify({
      seedMeta: { summary: { roadSource: 'grey-open-data' } }
    }, null, 2));

    try {
      const { report, paths } = buildLivingRegionModelAssessment({ produceDir });
      expect(fs.existsSync(paths.markdownPath)).toBe(true);
      expect(fs.existsSync(paths.jsonPath)).toBe(true);
      expect(fs.existsSync(paths.gapMatrixCsvPath)).toBe(true);
      expect(fs.existsSync(paths.checksCsvPath)).toBe(true);

      expect(report).toHaveProperty('scorecard');
      expect(report).toHaveProperty('domainAssessment');
      expect(report.domainAssessment.length).toBeGreaterThanOrEqual(20);
      expect(report.domainAssessment.some((d) => d.domain === 'Population and settlement form')).toBe(true);

      const checksCsv = fs.readFileSync(paths.checksCsvPath, 'utf8');
      expect(checksCsv).toContain('population matches census total');
      expect(checksCsv).toContain('road feature count');
      expect(checksCsv).toContain('lots and concessions feature count');
      expect(checksCsv).toContain('land-use feature count');

      const md = fs.readFileSync(paths.markdownPath, 'utf8');
      expect(md).toContain('What it should not yet be used for');

      for (const v of Object.values(report.scorecard)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('missing files produce warnings and do not crash', () => {
    const root = path.resolve('know/produce/model-assessment-missing');
    fs.mkdirSync(root, { recursive: true });
    try {
      const { report } = buildLivingRegionModelAssessment({ produceDir: root });
      expect(report.warnings.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('assessment command exits successfully', () => {
    const run = spawnSync('node', ['command/report_living_region_assessment.mjs'], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('presentOverallCredibilityScore');
  });
});
