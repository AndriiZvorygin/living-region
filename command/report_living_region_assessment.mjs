// SPDX-License-Identifier: AGPL-3.0-or-later
import { buildLivingRegionModelAssessment } from '../program/report/living_region_model_assessment.mjs';

try {
  const { report, paths } = buildLivingRegionModelAssessment();
  console.log(`presentOverallCredibilityScore: ${report.scorecard.presentOverallCredibilityScore.toFixed(3)}`);
  console.log(`presentGeographyScore: ${report.scorecard.presentGeographyScore.toFixed(3)}`);
  console.log(`presentInfrastructureScore: ${report.scorecard.presentInfrastructureScore.toFixed(3)}`);
  console.log(`presentFoodSystemScore: ${report.scorecard.presentFoodSystemScore.toFixed(3)}`);
  console.log(`checks: ${report.presentBaselineChecks.length}`);
  console.log(`domain assessments: ${report.domainAssessment.length}`);
  console.log(`warnings: ${report.warnings.length}`);
  console.log(`markdown: ${paths.markdownPath}`);
  console.log(`json: ${paths.jsonPath}`);
  console.log(`gap matrix csv: ${paths.gapMatrixCsvPath}`);
  console.log(`baseline checks csv: ${paths.checksCsvPath}`);
} catch (error) {
  console.error(`model assessment report failed: ${error.message}`);
  process.exit(1);
}
