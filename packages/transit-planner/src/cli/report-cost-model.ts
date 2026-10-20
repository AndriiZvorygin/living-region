import {mkdir, writeFile} from "node:fs/promises";
import {dirname, resolve} from "node:path";
import {calculatePhase1BoardingSensitivity, calculateTransitCostModel, DEFAULT_TRANSIT_PHASES, OWEN_SOUND_TRANSIT_COST_CONTRACT_VERSION, TRANSIT_BASELINE} from "../cost-model";
import {calculateOnDemandNetwork, calculateOnDemandPilot, DEFAULT_ON_DEMAND_WINDOWS, ON_DEMAND_NETWORK_ASSUMPTIONS, ON_DEMAND_TRANSIT_CONTRACT_VERSION} from "../on-demand-cost-model";

const root = resolve("packages/education-web/public/generated/transit");
const knowRoot = resolve("know/produce/transit-cost-model");
const model: any = calculateTransitCostModel({through_phase_id: "phase4"});
const onDemandPilot = calculateOnDemandPilot();
const onDemandNetwork = [0, 1, 2, 3].map((core_vehicle_count) => calculateOnDemandNetwork({core_vehicle_count}));
const output = {
  ...model,
  phase_definitions: DEFAULT_TRANSIT_PHASES,
  on_demand: {contract_version: ON_DEMAND_TRANSIT_CONTRACT_VERSION, pilot: onDemandPilot, windows: DEFAULT_ON_DEMAND_WINDOWS, network_comparison: onDemandNetwork, assumptions: ON_DEMAND_NETWORK_ASSUMPTIONS, service_modes: ['scheduled_buses', 'on_demand_rides']},
  phase1_boarding_sensitivity: calculatePhase1BoardingSensitivity(),
  generated_at: "2026-10-20",
  generation: {contract: OWEN_SOUND_TRANSIT_COST_CONTRACT_VERSION, source: "packages/transit-planner/src/cost-model.ts"}
};

const cad = (value: number) => `$${Math.round(value).toLocaleString("en-CA")}`;
const range = (low: number, high: number) => `${cad(low)}–${cad(high)}`;
const rows = model.cumulative.slice(0, 5).map((row: any) => `| ${row.through_phase_label} | ${row.incremental_boardings.toLocaleString("en-CA")} | ${range(row.gross_cost_low_cad, row.gross_cost_high_cad)} | ${range(row.fare_revenue_low_cad, row.fare_revenue_high_cad)} | ${range(row.net_municipal_cost_low_cad, row.net_municipal_cost_high_cad)} | ${range(row.household_equivalent_low_cad, row.household_equivalent_high_cad)} |`).join("\n");
const networkRows = onDemandNetwork.map((row) => `| ${row.core_vehicle_count} | ${row.core_hours.toLocaleString("en-CA")} | ${row.on_demand_hours.toLocaleString("en-CA")} | ${range(row.gross_cost_cad.low, row.gross_cost_cad.high)} | ${range(row.net_cost_cad.low, row.net_cost_cad.high)} | ${range(row.difference_from_current_net_cost_cad.low, row.difference_from_current_net_cost_cad.high)} |`).join("\n");
const markdown = `# Owen Sound Transit Cost Model\n\nGenerated from contract ${OWEN_SOUND_TRANSIT_COST_CONTRACT_VERSION} on 2026-09-02.\n\n## Baseline\n\n- 2026 gross transit cost: ${cad(TRANSIT_BASELINE.gross_cost_cad)}\n- 2026 net cost after grants and other revenue: ${cad(TRANSIT_BASELINE.net_cost_cad)}\n- 2026 division levy requirement: ${cad(TRANSIT_BASELINE.division_levy_requirement_cad)}\n-  2025 reported conventional trips: approximately ${TRANSIT_BASELINE.conventional_transit_trips.toLocaleString("en-CA")}\n\n## Default existing-fares expansion\n\n| Cumulative phase | Added boardings | Gross cost | Fare revenue | Net municipal requirement | Household equivalent |\n| --- | ---: | ---: | ---: | ---: | ---: |\n${rows}\n\nRanges pair the low gross cost with high fare revenue for the low municipal requirement, and high gross cost with low fare revenue for the high requirement. Recurring sources are applied once to cumulative service. One-time capital grants or reserves remain separate.\n\n## Phase 1 ridership sensitivity\n\n${model.phase1_boarding_sensitivity ? "| Boardings/hour | Annual boardings | Fare revenue | Net requirement |\\n| ---: | ---: | ---: | ---: |\\n" : ""}${(output.phase1_boarding_sensitivity as any[]).map((row) => `| ${row.boardings_per_vehicle_hour} | ${row.incremental_boardings.toLocaleString("en-CA")} | ${range(row.fare_revenue_low_cad, row.fare_revenue_high_cad)} | ${range(row.net_municipal_cost_low_cad, row.net_municipal_cost_high_cad)} |`).join("\n")}\n\nPhase costs, target ridership and Mobility Transit requirements are planning scenarios pending City operating data, accessibility review, fleet capacity, quotations and Council approval.\n`;
await mkdir(root, {recursive: true});
await mkdir(knowRoot, {recursive: true});
await writeFile(resolve(root, "cost-model.json"), JSON.stringify(output, null, 2) + "\n");
const onDemandMarkdown = `\n\n## On-demand service options\n\nThe default selected on-demand service uses Sunday daytime and weekday evenings: ${onDemandPilot.selected.annual_vehicle_hours.toLocaleString("en-CA")} vehicle-hours, ${range(onDemandPilot.selected.net_cost_cad.low, onDemandPilot.selected.net_cost_cad.high)} net municipal cost and ${range(onDemandPilot.selected.net_cost_per_household_cad.low, onDemandPilot.selected.net_cost_per_household_cad.high)} per household equivalent. People can combine this component with the selected scheduled-bus phase or view it on its own. All four on-demand windows total ${range(calculateOnDemandPilot({selected_window_ids: DEFAULT_ON_DEMAND_WINDOWS.map((window) => window.id)}).selected.net_cost_cad.low, calculateOnDemandPilot({selected_window_ids: DEFAULT_ON_DEMAND_WINDOWS.map((window) => window.id)}).selected.net_cost_cad.high)} net.\n\n## Full-network service comparison\n\n| Paid core buses | Core hours | On-demand hours | Gross cost | Net cost | Difference from current net |\n| ---: | ---: | ---: | ---: | ---: | ---: |\n${networkRows}\n\nZero core buses is the rideshare-only planning case. One to three core buses are combined service cases with on-demand coverage filling the remaining baseline hours. This is a planning estimate with paid local drivers, accessible service, phone booking, dispatch, insurance, vehicle reserve and five-year annualized setup allowances. Regional service and contributions remain separate.\n`;
const fullMarkdown = markdown.replace('on 2026-09-02.', 'on 2026-10-20.') + onDemandMarkdown;
await writeFile(resolve(root, "cost-model.md"), fullMarkdown);
await writeFile(resolve(knowRoot, "owen-sound-transit-cost-model.json"), JSON.stringify(output, null, 2) + "\n");
await writeFile(resolve(knowRoot, "owen-sound-transit-cost-model.md"), fullMarkdown);
console.log(`wrote Owen Sound transit cost model ${OWEN_SOUND_TRANSIT_COST_CONTRACT_VERSION}`);
