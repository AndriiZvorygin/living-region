import {mkdir, writeFile} from "node:fs/promises";
import {dirname, resolve} from "node:path";
import {
  calculateLocalRepresentationCostModel,
  DEFAULT_EXISTING_RESIDENT_LEVY_CAD,
  DEFAULT_LOCAL_REPRESENTATIVE_LIVING_WAGE_CAD,
  LOCAL_REPRESENTATION_SCENARIO_PRESETS,
  LOCAL_REPRESENTATION_SOURCES,
  OWEN_SOUND_LOCAL_REPRESENTATION_CONTRACT_VERSION
} from "../local-representation-cost-model";

const outputRoot = resolve("packages/education-web/public/generated/local-representation");
const evidenceRoot = resolve("know/produce/owen-sound-local-representation");
const model: any = calculateLocalRepresentationCostModel({scenario_preset_id: "mixed_twenty_area"});
const tier1: any = model.tiers.find((row: any) => row.tier_id === "tier1");
const cad = (value: number) => `$${Math.round(value).toLocaleString("en-CA")}`;
const hours = (value: number) => `${Number(value).toLocaleString("en-CA", {maximumFractionDigits: 1})} h`;
const summary = model.summary;
const presetRows = model.scale_comparison.map((row: any) => `| ${row.label} | ${row.summary.active_local_areas} | ${row.summary.participating_households.toLocaleString("en-CA")} | ${hours(row.summary.paid_representative_hours_year)} | ${cad(row.summary.gross_recurring_annual_cost_cad)} | ${cad(row.summary.net_municipal_requirement_cad)} | ${cad(row.summary.equivalent_cost_per_owen_sound_household_cad)} |`).join("\n");
const tierRows = model.tiers.map((row: any) => `| ${row.tier_id} | ${row.active_local_areas} | ${hours(row.paid_representative_hours_year)} | ${hours(row.volunteer_hours_year)} | ${cad(row.wages_cad)} | ${cad(row.employer_overhead_cad)} | ${cad(row.materials_and_training_cad)} | ${cad(row.gross_annual_cost_cad)} |`).join("\n");
const sensitivityRows = model.time_sensitivity.map((row: any) => `| ${row.time_scenario} | ${hours(row.summary.paid_representative_hours_year)} | ${cad(row.gross_recurring_annual_cost_cad)} | ${cad(row.net_municipal_requirement_cad)} |`).join("\n");
const sourceRows = LOCAL_REPRESENTATION_SOURCES.map((source: any) => `| ${source.institution} | [${source.title}](${source.url}) | ${source.classification} | ${source.note ?? ""} |`).join("\n");
const output = {
  ...model,
  generated_at: "2026-09-04",
  baseline: {
    living_wage_cad: DEFAULT_LOCAL_REPRESENTATIVE_LIVING_WAGE_CAD,
    existing_resident_levy_cad: DEFAULT_EXISTING_RESIDENT_LEVY_CAD,
    maximum_local_areas: 70,
    wards: 7,
    approximate_local_areas_per_ward: 10,
    approximate_households_per_local_area: 150
  },
  scenario_definitions: LOCAL_REPRESENTATION_SCENARIO_PRESETS,
  sources: LOCAL_REPRESENTATION_SOURCES,
  generation: {contract: OWEN_SOUND_LOCAL_REPRESENTATION_CONTRACT_VERSION, source: "packages/transit-planner/src/local-representation-cost-model.ts"}
};
const markdown = `# Owen Sound Local Representation Cost Calculator

Generated from contract ${OWEN_SOUND_LOCAL_REPRESENTATION_CONTRACT_VERSION} on 2026-09-04. The default report case is the mixed twenty-area rollout with central time assumptions, CAD 24.60/hour living wage and 33% employer-overhead comparison.

## Default result: mixed twenty-area rollout

${summary.active_local_areas} active Local Areas and ${summary.active_local_representatives} Local Representatives serve ${summary.participating_households.toLocaleString("en-CA")} participating households.

- Paid representative time: ${hours(summary.paid_representative_hours_year)} (${hours(summary.paid_representative_hours_year / 52)} average per week)
- Volunteer time entered by scenario: ${hours(summary.volunteer_hours_year)}
- Wages: ${cad(summary.wages_cad)}
- Employer overhead: ${cad(summary.employer_overhead_cad)}
- Materials and training: ${cad(summary.materials_and_training_cad)}
- Program administration: ${cad(summary.program_administration_cad)}
- Gross recurring annual cost: ${cad(summary.gross_recurring_annual_cost_cad)}
- Net municipal requirement after entered funding/savings: ${cad(summary.net_municipal_requirement_cad)}
- Equivalent cost per Owen Sound household: ${cad(summary.equivalent_cost_per_owen_sound_household_cad)}
- Share of existing resident levy: ${summary.percentage_of_existing_resident_levy.toFixed(4)}%
- Startup cost, shown separately: ${cad(summary.startup_cost_cad)}

## Tier accounting

| Tier | Active areas | Paid representative hours | Volunteer hours | Wages | Employer overhead | Materials/training | Gross annual cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${tierRows}

## Participation scale

| Scenario | Active areas | Participating households | Paid hours/year | Gross recurring cost | Net municipal requirement | Equivalent/household |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${presetRows}

## Time-assumption sensitivity

| Time scenario | Paid hours/year | Gross recurring cost | Net municipal requirement |
| --- | ---: | ---: | ---: |
${sensitivityRows}

## Worked formula

For each active Tier 1 area, central assumptions calculate ${model.assumptions.households_per_local_area} households × ${model.assumptions.time_values.invitation_minutes_per_household} minutes ÷ 60 = ${tier1.paid_hour_components.invitation_hours / Math.max(1, tier1.active_local_areas)} invitation hours. The annual gathering, twelve one-hour Ward Councillor meetings and basic issue administration are then added. Tier 2 and Tier 3 add their own coordination and stewardship tasks; Tier 4 adds user-entered custom work. Wages are paid hours × living wage; employer cost is wages × the selected overhead percentage.

Ward Councillor time is reported separately: ${model.ward_councillor_time.elected_representative_hours_year} elected-representative hours/year in this case, with ${cad(model.ward_councillor_time.incremental_cost_cad)} incremental cost by default. Councillors continue to be elected at large and each has primary responsibility for one ward.

## Funding and scope

Recurring grants, City savings, transition savings, other revenue, partner contributions and entered avoided costs reduce the continuing requirement only when entered by the user. Startup costs and one-time grants/reserves remain separate. Volunteer activity and prevention are not guaranteed financial savings.

Local Representation can begin in a few interested areas. Each Local Area can choose a service level suited to its needs, and participation can expand when residents request it. Enforcement, emergency response, skilled trades, hazardous work and regular unionized municipal duties remain with qualified workers.

## Sources and evidence status

| Institution | Source | Classification | Note |
| --- | --- | --- | --- |
${sourceRows}

The calculator is a transparent planning model. Local-area demand, time requirements, employment structure, City support, avoided costs and partner funding require local operating data before budget approval.
`;
await mkdir(outputRoot, {recursive: true});
await mkdir(evidenceRoot, {recursive: true});
await mkdir(dirname(resolve(evidenceRoot, "cost-model.json")), {recursive: true});
await writeFile(resolve(outputRoot, "cost-model.json"), JSON.stringify(output, null, 2) + "\n");
await writeFile(resolve(outputRoot, "cost-model.md"), markdown);
await writeFile(resolve(evidenceRoot, "cost-model.json"), JSON.stringify(output, null, 2) + "\n");
await writeFile(resolve(evidenceRoot, "cost-model.md"), markdown);
console.log(`wrote Owen Sound local representation cost model ${OWEN_SOUND_LOCAL_REPRESENTATION_CONTRACT_VERSION}`);
