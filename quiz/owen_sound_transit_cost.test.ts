import {describe, expect, test} from "vitest";
import {calculatePhase1BoardingSensitivity, calculateTransitCostModel} from "../packages/transit-planner/src/cost-model";

describe("Owen Sound transit cost model", () => {
  test("matches the canonical Phase 1 range pairing", () => {
    const model = calculateTransitCostModel({through_phase_id: "phase1"});
    const phase = model.phases[1];
    expect(phase.incremental_boardings).toBe(16640);
    expect(phase.fare_revenue_low_cad).toBe(24960);
    expect(phase.fare_revenue_high_cad).toBe(33280);
    expect(model.selected.net_municipal_cost_low_cad).toBe(266720);
    expect(model.selected.net_municipal_cost_high_cad).toBe(350040);
    expect(model.selected.household_equivalent_low_cad).toBe(26.672);
    expect(model.selected.household_equivalent_high_cad).toBe(35.004);
  });

  test("cumulative totals are exact sums of incremental phases", () => {
    const model = calculateTransitCostModel({through_phase_id: "phase4"});
    const throughPhase3 = model.cumulative.find((row) => row.through_phase_id === "phase3");
    const throughPhase4 = model.cumulative.find((row) => row.through_phase_id === "phase4");
    expect(throughPhase3?.incremental_boardings).toBe(38272);
    expect(throughPhase3?.conventional_vehicle_hours).toBe(4940);
    expect(throughPhase3?.gross_cost_low_cad).toBe(720000);
    expect(throughPhase3?.gross_cost_high_cad).toBe(880000);
    expect(throughPhase3?.fare_revenue_low_cad).toBe(57408);
    expect(throughPhase3?.fare_revenue_high_cad).toBe(76544);
    expect(throughPhase3?.net_municipal_cost_low_cad).toBe(643456);
    expect(throughPhase3?.net_municipal_cost_high_cad).toBe(822592);
    expect(throughPhase4?.incremental_boardings).toBe(46750);
    expect(throughPhase4?.net_municipal_cost_low_cad).toBe(836500);
    expect(throughPhase4?.net_municipal_cost_high_cad).toBe(1064875);
  });

  test("fare-free and recurring funding remain explicit", () => {
    const addedFareFree = calculateTransitCostModel({through_phase_id: "phase1", fare_scenario: "added_service_fare_free"});
    expect(addedFareFree.selected.net_municipal_cost_low_cad).toBe(300000);
    expect(addedFareFree.selected.net_municipal_cost_high_cad).toBe(375000);
    const wholeSystemFree = calculateTransitCostModel({through_phase_id: "phase1", fare_scenario: "entire_system_fare_free"});
    expect(wholeSystemFree.selected.net_municipal_cost_low_cad).toBe(712000);
    expect(wholeSystemFree.selected.net_municipal_cost_high_cad).toBe(787000);
    const funded = calculateTransitCostModel({through_phase_id: "phase2", funding: {recurring_operating_grants_cad: 100000, one_time_capital_grants_or_reserves_cad: 50000}});
    expect(funded.selected.recurring_funding_cad).toBe(150000);
    expect(funded.selected.one_time_capital_grants_or_reserves_cad).toBe(50000);
    expect(funded.selected.net_municipal_cost_low_cad).toBe(199232);
  });

  test("direct and derived vehicle-hour controls are supported", () => {
    const derived = calculateTransitCostModel({through_phase_id: "phase1", phase_overrides: {phase1: {conventional_vehicle_hours: 0, service_days_per_week: 5, added_hours_per_day: 8, conventional_buses_operating: 4}}});
    expect(derived.phases[1].derived_vehicle_hours).toBe(8320);
    expect(derived.phases[1].conventional_vehicle_hours).toBe(8320);
  });

  test("ridership sensitivity recalculates fares and municipal need", () => {
    const rows = calculatePhase1BoardingSensitivity();
    expect(rows[0].incremental_boardings).toBe(8320);
    expect(rows[0].net_municipal_cost_high_cad).toBe(362520);
    expect(rows.at(-1)?.incremental_boardings).toBe(24960);
    expect(rows.at(-1)?.net_municipal_cost_low_cad).toBe(250080);
  });

  test("zero-cost Phase 0 does not create a negative requirement", () => {
    const model = calculateTransitCostModel({through_phase_id: "phase0", funding: {recurring_operating_grants_cad: 1000}});
    expect(model.selected.net_municipal_cost_low_cad).toBe(0);
    expect(model.selected.recurring_funding_excess_low_cad).toBe(1000);
  });
});
