import {describe, expect, test} from "vitest";
import {
  calculateLocalRepresentationCostModel,
  DEFAULT_EXISTING_RESIDENT_LEVY_CAD,
  DEFAULT_LOCAL_REPRESENTATION_HOUSEHOLD_EQUIVALENTS,
  DEFAULT_LOCAL_REPRESENTATIVE_LIVING_WAGE_CAD
} from "../packages/transit-planner/src/local-representation-cost-model";

describe("Owen Sound Local Representation cost model", () => {
  test("Tier 0 has no active representatives or representative labour", () => {
    const model = calculateLocalRepresentationCostModel({scenario_preset_id: "custom", active_area_counts: {tier1: 0, tier2: 0, tier3: 0, tier4: 0}});
    expect(model.summary.active_local_representatives).toBe(0);
    expect(model.summary.paid_representative_hours_year).toBe(0);
    expect(model.tiers.every((row) => row.gross_annual_cost_cad === 0)).toBe(true);
  });

  test("one-area Tier 1 calculates invitations and twelve monthly meetings", () => {
    const model = calculateLocalRepresentationCostModel({scenario_preset_id: "one_area"});
    const tier: any = model.tiers.find((row) => row.tier_id === "tier1");
    expect(model.summary.active_local_areas).toBe(1);
    expect(model.summary.active_local_representatives).toBe(1);
    expect(model.summary.participating_households).toBe(150);
    expect(tier?.annual_invitations).toBe(150);
    expect(tier?.annual_ward_councillor_meetings).toBe(12);
    expect(tier?.paid_hour_components.invitation_hours).toBe(30);
    expect(tier?.paid_representative_hours_year).toBe(57);
  });

  test("standard participation presets reconcile at seven, ten, twenty and seventy areas", () => {
    for (const [preset, activeAreas] of [["one_per_ward", 7], ["ten_area_pilot", 10], ["mixed_twenty_area", 20], ["citywide_tier1", 70]] as const) {
      const model = calculateLocalRepresentationCostModel({scenario_preset_id: preset});
      expect(model.summary.active_local_areas).toBe(activeAreas);
      expect(model.summary.active_local_representatives).toBe(activeAreas);
      expect(model.summary.participating_households).toBe(activeAreas * 150);
    }
  });

  test("the mixed rollout keeps different tiers visible and sums their costs", () => {
    const model = calculateLocalRepresentationCostModel({scenario_preset_id: "mixed_twenty_area"});
    expect(model.participation.applied_area_counts).toEqual({tier1: 10, tier2: 7, tier3: 3, tier4: 0});
    expect(model.summary.paid_representative_hours_year).toBe(1786);
    expect(model.summary.volunteer_hours_year).toBe(520);
    expect(model.summary.gross_recurring_annual_cost_cad).toBe(64809.348);
    expect(model.summary.net_municipal_requirement_cad).toBe(model.summary.gross_recurring_annual_cost_cad);
  });

  test("the maximum of seventy active areas is enforced without hiding an invalid request", () => {
    const model = calculateLocalRepresentationCostModel({scenario_preset_id: "custom", active_area_counts: {tier1: 70, tier2: 1, tier3: 0, tier4: 0}});
    expect(model.participation.total_requested_active_areas).toBe(71);
    expect(model.participation.total_active_areas).toBe(70);
    expect(model.participation.active_area_limit_exceeded).toBe(true);
    expect(model.validation.valid).toBe(false);
  });

  test("wages and employer overhead remain separate and use the selected payroll preset", () => {
    const direct = calculateLocalRepresentationCostModel({scenario_preset_id: "one_area", employer_overhead_preset: "direct"});
    const comparison = calculateLocalRepresentationCostModel({scenario_preset_id: "one_area", employer_overhead_preset: "plus_33"});
    expect(direct.summary.wages_cad).toBe(comparison.summary.wages_cad);
    expect(direct.summary.employer_overhead_cad).toBe(0);
    expect(comparison.summary.employer_overhead_cad).toBe(462.726);
  });

  test("startup funds do not silently pay for recurring service", () => {
    const model = calculateLocalRepresentationCostModel({scenario_preset_id: "one_area", funding: {one_time_grants_or_reserves_cad: 20_000}});
    expect(model.summary.startup_funding_cad).toBe(20_000);
    expect(model.summary.startup_net_cost_cad).toBe(0);
    expect(model.summary.net_municipal_requirement_cad).toBe(3939.926);
  });

  test("recurring grants and entered savings reduce net requirement once and expose excess", () => {
    const model = calculateLocalRepresentationCostModel({scenario_preset_id: "one_area", funding: {recurring_operating_grants_cad: 1000}, avoided_costs: {suitable_volunteer_work_cad: 500}});
    expect(model.summary.gross_recurring_annual_cost_cad).toBe(3939.926);
    expect(model.summary.recurring_funding_cad).toBe(1000);
    expect(model.summary.entered_avoided_costs_cad).toBe(500);
    expect(model.summary.net_municipal_requirement_cad).toBe(2439.926);
    const excess = calculateLocalRepresentationCostModel({scenario_preset_id: "one_area", funding: {recurring_operating_grants_cad: 10_000}});
    expect(excess.summary.net_municipal_requirement_cad).toBe(0);
    expect(excess.summary.recurring_funding_excess_cad).toBe(6060.074);
  });

  test("household and levy comparisons use explicit denominators", () => {
    const model = calculateLocalRepresentationCostModel({scenario_preset_id: "one_area"});
    expect(model.assumptions.living_wage_cad).toBe(DEFAULT_LOCAL_REPRESENTATIVE_LIVING_WAGE_CAD);
    expect(model.assumptions.household_equivalent_denominator).toBe(DEFAULT_LOCAL_REPRESENTATION_HOUSEHOLD_EQUIVALENTS);
    expect(model.assumptions.existing_resident_levy_cad).toBe(DEFAULT_EXISTING_RESIDENT_LEVY_CAD);
    expect(model.summary.equivalent_cost_per_owen_sound_household_cad).toBe(0.393993);
    expect(model.summary.percentage_of_existing_resident_levy).toBe(0.010332);
  });

  test("time presets and custom time values are shareable calculation inputs", () => {
    const low = calculateLocalRepresentationCostModel({scenario_preset_id: "one_area", time_scenario: "low"});
    const high = calculateLocalRepresentationCostModel({scenario_preset_id: "one_area", time_scenario: "high"});
    expect(low.summary.paid_representative_hours_year).toBeLessThan(high.summary.paid_representative_hours_year);
    const custom = calculateLocalRepresentationCostModel({scenario_preset_id: "one_area", time_overrides: {invitation_minutes_per_household: 20}});
    expect((custom.tiers.find((row) => row.tier_id === "tier1") as any)?.paid_hour_components.invitation_hours).toBe(50);
  });

  test("Ward Councillor time is visible separately from representative payroll", () => {
    const model = calculateLocalRepresentationCostModel({scenario_preset_id: "one_per_ward", active_wards: 7});
    expect(model.ward_councillor_time.meetings).toBe(84);
    expect(model.ward_councillor_time.elected_representative_hours_year).toBe(84);
    expect(model.ward_councillor_time.incremental_cost_cad).toBe(0);
  });
});
