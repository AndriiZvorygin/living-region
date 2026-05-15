// SPDX-License-Identifier: AGPL-3.0-or-later
import { buildArticleSupportEvidencePacket } from '../program/reliability/article_support_evidence_packet.mjs';

try {
  const result = buildArticleSupportEvidencePacket({
    produceDir: 'know/produce',
    qaDir: 'output/qa',
    outputDir: 'output/article-support',
    calibrationDir: 'know/input/local-calibration'
  });
  if (result.status !== 'pass') {
    console.error('article support evidence packet failed');
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(`json: ${result.paths.jsonPath}`);
  console.log(`markdown: ${result.paths.mdPath}`);
  for (const warning of result.warnings) console.warn(`warning: ${warning}`);
} catch (error) {
  console.error(`article support evidence packet command failed: ${error.message}`);
  process.exit(1);
}
