import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { discoverCandidates, lotConcessionCsvPath, scenarioDir } from "../fixtures";
import { writeJson } from "../io";

const candidates = discoverCandidates(await readFile(lotConcessionCsvPath, "utf8").catch(() => undefined));
await writeJson(join(scenarioDir, "candidates.json"), candidates);
console.log(`Discovered ${candidates.candidates.length} Owen Sound lot/concession proxy candidates.`);
console.log(`Top candidate: ${candidates.candidates[0].name} (${candidates.candidates[0].score_total})`);
