import {mkdir, writeFile} from "node:fs/promises";
import {dirname, resolve} from "node:path";
import {calculatePhase1BoardingSensitivity, calculateTransitCostModel, DEFAULT_TRANSIT_PHASES, OWEN_SOUND_TRANSIT_COST_CONTRACT_VERSION, TRANSIT_BASELINE} from "../cost-model";

const root = resolve("packages/education-web/public/generated/transit");
const knowRoot = resolve("know/produce/transit-cost-model");
const model: any = calculateTransitCostModel({through_phase_id: "phase4"});
const output = {
  ...model,
  phase_definitions: DEFAULT_TRANSIT_PHASES,
  phase1_boarding_sensitivity: calculatePhase1BoardingSensitivity(),
  generated_at: "2026-09-02",
  generation: {contract: OWEN_SOUND_TRANSIT_COST_CONTRACT_VERSION, source: "packages/transit-planner/src/cost-model.ts"}
};

const cad = (value: number) => `$${Math.round(value).toLocaleString("en-CA")}`;
const range = (low: number, high: number) => `${cad(low)}–${cad(high)}`;
const rows = model.cumulative.slice(0, 5).map((row: any) => `| ${row.through_phase_label} | ${row.incremental_boardings.toLocaleString("en-CA")} | ${range(row.gross_cost_low_cad, row.gross_cost_high_cad)} | ${range(row.fare_revenue_low_cad, row.fare_revenue_high_cad)} | ${range(row.net_municipal_cost_low_cad, row.net_municipal_cost_high_cad)} | ${range(row.household_equivalent_low_cad, row.household_equivalent_high_cad)} |`).join("\n");
const markdown = `# Owen Sound Transit Cost Model\n\nGenerated from contract ${OWEN_SOUND_TRANSIT_COST_CONTRACT_VERSION} on 2026-09-02.\n\n## Baseline\n\n- 2026 gross transit cost: ${cad(TRANSIT_BASELINE.gross_cost_cad)}\n- 2026 net cost after grants and other revenue: ${cad(TRANSIT_BASELINE.net_cost_cad)}\n- 2026 division levy requirement: ${cad(TRANSIT_BASELINE.division_levy_requirement_cad)}\n-  2025 reported conventional trips: approximately ${TRANSIT_BASELINE.conventional_transit_trips.toLocaleString("en-CA")}\n\n## Default existing-fares expansion\n\n| Cumulative phase | Added boardings | Gross cost | Fare revenue | Net municipal requirement | Household equivalent |\n| --- | ---: | ---: | ---: | ---: | ---: |\n${rows}\n\nRanges pair the low gross cost with high fare revenue for the low municipal requirement, and high gross cost with low fare revenue for the high requirement. Recurring sources are applied once to cumulative service. One-time capital grants or reserves remain separate.\n\n## Phase 1 ridership sensitivity\n\n${model.phase1_boarding_sensitivity ? "| Boardings/hour | Annual boardings | Fare revenue | Net requirement |\\n| ---: | ---: | ---: | ---: |\\n" : ""}${(output.phase1_boarding_sensitivity as any[]).map((row) => `| ${row.boardings_per_vehicle_hour} | ${row.incremental_boardings.toLocaleString("en-CA")} | ${range(row.fare_revenue_low_cad, row.fare_revenue_high_cad)} | ${range(row.net_municipal_cost_low_cad, row.net_municipal_cost_high_cad)} |`).join("\n")}\n\nPhase costs, target ridership and Mobility Transit requirements are planning scenarios pending City operating data, accessibility review, fleet capacity, quotations and Council approval.\n`;
await mkdir(root, {recursive: true});
await mkdir(knowRoot, {recursive: true});
await writeFile(resolve(root, "cost-model.json"), JSON.stringify(output, null, 2) + "\n");
await writeFile(resolve(root, "cost-model.md"), markdown);
await writeFile(resolve(knowRoot, "owen-sound-transit-cost-model.json"), JSON.stringify(output, null, 2) + "\n");
await writeFile(resolve(knowRoot, "owen-sound-transit-cost-model.md"), markdown);
console.log(`wrote Owen Sound transit cost model ${OWEN_SOUND_TRANSIT_COST_CONTRACT_VERSION}`);
