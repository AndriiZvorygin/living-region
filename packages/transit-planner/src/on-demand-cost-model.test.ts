import {describe, expect, it} from 'vitest';
import {calculateOnDemandNetwork, calculateOnDemandPilot, calculateTransitServiceMix, DEFAULT_ON_DEMAND_WINDOWS} from './on-demand-cost-model';

describe('Owen Sound on-demand selected service windows', () => {
  it('calculates Sunday plus weekday evening ranges exactly', () => {
    const result = calculateOnDemandPilot({selected_window_ids: ['sunday_daytime', 'weekday_evenings']});
    expect(result.selected.annual_vehicle_hours).toBe(3_224);
    expect(result.selected.gross_cost_cad).toEqual({low: 255_000, high: 270_000});
    expect(result.selected.fare_revenue_cad).toEqual({low: 40_000, high: 50_000});
    expect(result.selected.net_cost_cad).toEqual({low: 205_000, high: 230_000});
    expect(result.selected.net_cost_per_household_cad).toEqual({low: 20.5, high: 23});
  });

  it('calculates all four hybrid windows without mixing in network overhead', () => {
    const result = calculateOnDemandPilot({selected_window_ids: DEFAULT_ON_DEMAND_WINDOWS.map((window) => window.id)});
    expect(result.selected.annual_vehicle_hours).toBe(3_999);
    expect(result.selected.gross_cost_cad).toEqual({low: 308_000, high: 323_000});
    expect(result.selected.fare_revenue_cad).toEqual({low: 58_000, high: 72_000});
    expect(result.selected.net_cost_cad).toEqual({low: 236_000, high: 265_000});
  });

  it('keeps empty pilot selection at zero and regional contributions separate', () => {
    const result = calculateOnDemandPilot({selected_window_ids: [], household_equivalent_denominator: 11_000, regional_contribution_cad: 10_000});
    expect(result.selected.annual_vehicle_hours).toBe(0);
    expect(result.selected.net_cost_cad).toEqual({low: -10_000, high: -10_000});
    expect(result.regional_contribution_cad).toBe(10_000);
  });
});

describe('Owen Sound on-demand full-network comparison', () => {
  it('supports a rideshare-only network with zero core buses', () => {
    const result = calculateOnDemandNetwork({core_vehicle_count: 0});
    expect(result.core_hours).toBe(0);
    expect(result.on_demand_hours).toBe(13_500);
    expect(result.gross_cost_cad).toEqual({low: 1_200_000, high: 1_584_000});
    expect(result.net_cost_cad).toEqual({low: 880_000, high: 1_264_000});
  });

  it('uses 4,160 core and 9,340 on-demand hours for two core vehicles', () => {
    const result = calculateOnDemandNetwork({core_vehicle_count: 2});
    expect(result.core_hours).toBe(4_160);
    expect(result.on_demand_hours).toBe(9_340);
    expect(result.gross_cost_cad).toEqual({low: 1_318_476.8, high: 1_726_188.8});
    expect(result.net_cost_cad).toEqual({low: 998_476.8, high: 1_406_188.8});
  });

  it('keeps fare revenue and regional contributions distinct from gross cost', () => {
    const result = calculateOnDemandNetwork({core_vehicle_count: 2, fare_revenue_cad: 300_000, regional_contribution_cad: 20_000});
    expect(result.gross_cost_cad.low).toBe(1_318_476.8);
    expect(result.fare_revenue_cad).toEqual({low: 300_000, high: 300_000});
    expect(result.regional_contribution_cad).toBe(20_000);
    expect(result.net_cost_cad.low).toBe(998_476.8);
  });
});

describe('Owen Sound service composition', () => {
  const scheduled = {
    annual_vehicle_hours: 2_080,
    gross_cost_cad: {low: 300_000, high: 375_000},
    fare_revenue_cad: {low: 24_960, high: 33_280}
  };
  const onDemand = calculateOnDemandPilot().selected;

  it('labels and calculates bus-only service', () => {
    const result = calculateTransitServiceMix({scheduled_buses: true, on_demand_rides: false, scheduled_service: scheduled, on_demand_service: onDemand});
    expect(result.mode).toBe('bus_only');
    expect(result.label).toBe('Bus only');
    expect(result.selected.net_cost_cad).toEqual({low: 266_720, high: 350_040});
  });

  it('labels and calculates rideshare-only selected windows', () => {
    const result = calculateTransitServiceMix({scheduled_buses: false, on_demand_rides: true, scheduled_service: scheduled, on_demand_service: onDemand});
    expect(result.mode).toBe('rideshare_only');
    expect(result.label).toBe('Rideshare only');
    expect(result.selected.net_cost_cad).toEqual({low: 205_000, high: 230_000});
  });

  it('adds the selected bus and rideshare components once for combined service', () => {
    const result = calculateTransitServiceMix({scheduled_buses: true, on_demand_rides: true, scheduled_service: scheduled, on_demand_service: onDemand});
    expect(result.mode).toBe('combined');
    expect(result.label).toBe('Combined service');
    expect(result.selected.annual_vehicle_hours).toBe(5_304);
    expect(result.selected.net_cost_cad).toEqual({low: 471_720, high: 580_040});
  });

  it('applies a regional contribution once to the selected on-demand component', () => {
    const result = calculateTransitServiceMix({
      scheduled_buses: false,
      on_demand_rides: true,
      on_demand_service: {...onDemand, recurring_funding_cad: 10_000}
    });
    expect(result.selected.net_cost_cad).toEqual({low: 195_000, high: 220_000});
  });
});
