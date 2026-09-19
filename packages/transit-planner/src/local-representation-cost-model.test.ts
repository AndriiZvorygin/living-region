import {describe, expect, it} from 'vitest';
import {calculateLocalRepresentationCostModel} from './local-representation-cost-model';

describe('Owen Sound Local Representation household comparisons', () => {
  it('keeps participating-household and citywide comparison denominators separate', () => {
    const model = calculateLocalRepresentationCostModel({scenario_preset_id: 'mixed_twenty_area'});

    expect(model.assumptions.household_equivalent_denominator).toBe(11_000);
    expect(model.summary.participating_households).toBe(3_000);
    expect(model.summary.cost_per_participating_household_cad).toBeCloseTo(17.786016, 6);
    expect(model.summary.cost_per_participating_household_monthly_cad).toBeCloseTo(1.482168, 6);
    expect(model.summary.equivalent_cost_per_owen_sound_household_cad).toBeCloseTo(4.850732, 6);
    expect(model.summary.equivalent_cost_per_owen_sound_household_monthly_cad).toBeCloseTo(0.404228, 6);
  });

  it('allows the citywide denominator to remain an editable scenario input', () => {
    const model = calculateLocalRepresentationCostModel({
      scenario_preset_id: 'mixed_twenty_area',
      household_equivalent_denominator: 10_000
    });

    expect(model.assumptions.household_equivalent_denominator).toBe(10_000);
    expect(model.summary.equivalent_cost_per_owen_sound_household_cad).toBeCloseTo(5.335805, 6);
    expect(model.summary.cost_per_participating_household_cad).toBeCloseTo(17.786016, 6);
  });
});
