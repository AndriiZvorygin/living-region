import {describe, expect, it} from 'vitest';
import {calculateLocalRepresentationCostModel} from './local-representation-cost-model';

describe('Owen Sound Local Representation household comparisons', () => {
  it('keeps participating-household and citywide comparison denominators separate', () => {
    const model = calculateLocalRepresentationCostModel({scenario_preset_id: 'mixed_twenty_area'});

    expect(model.assumptions.household_equivalent_denominator).toBe(11_000);
    expect(model.assumptions.employer_overhead_preset).toBe('direct');
    expect(model.assumptions.employer_overhead_percent).toBe(0);
    expect(model.summary.employer_overhead_cad).toBe(0);
    expect(model.summary.participating_households).toBe(3_000);
    expect(model.summary.net_municipal_requirement_cad).toBeCloseTo(41700.6, 6);
    expect(model.summary.cost_per_participating_household_cad).toBeCloseTo(13.9002, 6);
    expect(model.summary.cost_per_participating_household_monthly_cad).toBeCloseTo(1.15835, 6);
    expect(model.summary.equivalent_cost_per_owen_sound_household_cad).toBeCloseTo(3.790964, 6);
    expect(model.summary.equivalent_cost_per_owen_sound_household_monthly_cad).toBeCloseTo(0.315914, 6);
  });

  it('allows the citywide denominator to remain an editable scenario input', () => {
    const model = calculateLocalRepresentationCostModel({
      scenario_preset_id: 'mixed_twenty_area',
      household_equivalent_denominator: 10_000
    });

    expect(model.assumptions.household_equivalent_denominator).toBe(10_000);
    expect(model.summary.equivalent_cost_per_owen_sound_household_cad).toBeCloseTo(4.17006, 6);
    expect(model.summary.cost_per_participating_household_cad).toBeCloseTo(13.9002, 6);
  });

  it('keeps employer overhead presets as explicit sensitivities', () => {
    const model = calculateLocalRepresentationCostModel({
      scenario_preset_id: 'mixed_twenty_area',
      employer_overhead_preset: 'plus_33'
    });

    expect(model.assumptions.employer_overhead_percent).toBe(33);
    expect(model.summary.employer_overhead_cad).toBeCloseTo(11657.448, 6);
    expect(model.summary.net_municipal_requirement_cad).toBeCloseTo(53358.048, 6);
  });
});
