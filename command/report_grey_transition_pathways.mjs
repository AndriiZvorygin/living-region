// SPDX-License-Identifier: AGPL-3.0-or-later
import path from 'node:path';
import { buildGreyTransitionPathwayReport } from '../program/report/grey_transition_pathway_report.mjs';

function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (const arg of argv) {
    if (arg.startsWith('--produce-dir=')) out.produceDir = arg.split('=').slice(1).join('=');
  }
  return out;
}

try {
  const args = parseArgs();
  const built = buildGreyTransitionPathwayReport({ produceDir: path.resolve(args.produceDir ?? 'know/produce') });
  const report = built.report;
  console.log(`scenario rows: ${report.scenarioRows.length}`);
  console.log(`shock20 noChange foodInsecureRiskPopulation2030: ${report.suiteKeyResults.shock20NoChangeFoodInsecureRiskPopulation2030.toFixed(2)}`);
  console.log(`shock20 strongAdaptation foodInsecureRiskPopulation2030: ${report.suiteKeyResults.shock20StrongAdaptationFoodInsecureRiskPopulation2030.toFixed(2)}`);
  console.log(`avoidedFoodInsecureRiskVsNoChange2030: ${report.suiteKeyResults.avoidedFoodInsecureRiskVsNoChange2030.toFixed(2)}`);
  console.log(`severeDecline2050 noChange qualityOfLife: ${report.suiteKeyResults.severeDecline2050NoChangeQualityOfLifeIndex.toFixed(3)}`);
  console.log(`severeDecline2050 fullRuralTransition qualityOfLife: ${report.suiteKeyResults.severeDecline2050FullRuralTransitionQualityOfLifeIndex.toFixed(3)}`);
  console.log(`markdown: ${built.paths.markdownPath}`);
  console.log(`json: ${built.paths.jsonPath}`);
  console.log(`scenarios csv: ${built.paths.scenariosCsvPath}`);
  console.log(`human impact csv: ${built.paths.humanImpactCsvPath}`);
  console.log(`timeline csv: ${built.paths.timelineCsvPath}`);
} catch (error) {
  console.error(`transition-pathways report failed: ${error.message}`);
  process.exit(1);
}
