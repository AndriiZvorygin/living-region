import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { discoverCandidates, lotConcessionCsvPath, scenarioDir, siteScoringWeights } from "../fixtures";
import { writeJson } from "../io";

const candidates = discoverCandidates(await readFile(lotConcessionCsvPath, "utf8").catch(() => undefined));
await writeJson(join(scenarioDir, "site_scoring_weights.json"), siteScoringWeights);
await writeJson(join(scenarioDir, "candidates.json"), candidates);
for (const candidate of candidates.candidates) {
  console.log(`${candidate.score_total.toFixed(3)} ${candidate.id} - ${candidate.name} (${candidate.data_caveat})`);
}
