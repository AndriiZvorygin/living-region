// SPDX-License-Identifier: AGPL-3.0-or-later
import path from 'node:path';
import { buildGreyHormuzFoodSecurityArticleDataReport } from '../program/report/grey_hormuz_food_security_article_data_report.mjs';

function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (const arg of argv) {
    if (arg.startsWith('--produce-dir=')) out.produceDir = arg.split('=').slice(1).join('=');
  }
  return out;
}

try {
  const args = parseArgs();
  const built = buildGreyHormuzFoodSecurityArticleDataReport({
    produceDir: path.resolve(args.produceDir ?? 'know/produce')
  });
  const report = built.report;
  const low = report.hormuzCurrentDisruptionScenarios?.find((s) => s.scenario === 'currentDisruptionLow');
  const severe = report.hormuzCurrentDisruptionScenarios?.find((s) => s.scenario === 'currentDisruptionSevere');
  const t10 = report.physicalLocalFoodResponseTargets?.find((t) => t.scenario === 'foodGap10');
  console.log(`headline facts: ${report.articleHeadlineFacts?.length ?? 0}`);
  if (low) console.log(`currentDisruptionLow estimated food insecurity: ${low.estimatedGreyFoodInsecurity.toFixed(0)}`);
  if (severe) console.log(`currentDisruptionSevere estimated food insecurity: ${severe.estimatedGreyFoodInsecurity.toFixed(0)}`);
  if (t10) console.log(`food for ~10,000: lowInputAnnualField growers Year1=${t10.modes.lowInputAnnualField.requiredGrowers.toFixed(2)}`);
  console.log(`markdown: ${built.paths.markdownPath}`);
  console.log(`json: ${built.paths.jsonPath}`);
  console.log(`scenarios csv: ${built.paths.scenariosCsvPath}`);
} catch (error) {
  console.error(`hormuz article-data report failed: ${error.message}`);
  process.exit(1);
}
