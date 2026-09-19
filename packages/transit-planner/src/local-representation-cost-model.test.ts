import {describe, expect, it} from 'vitest';
import {calculateLocalRepresentationCostModel} from './local-representation-cost-model';

describe('Owen Sound Local Representation household comparisons', () => {
  it('keeps participating-household and citywide comparison denominators separate', () => {
    const model = calculateLocalRepresentationCostModel({scenario_preset_id: 'mixed_twenty_area'});

    expect(model.assumptions.household_equivalent_denominator).toBe(11_000);
    expect(model.assumptions.employer_overhead_preset).toBe('direct');
    expect(model.assumptions.employer_overhead_percent).toBe(0);
    expect(model.summary.employer_overhead_cad).toBe(0);
    expect(model.summary.program_administration_cad).toBe(0);
    expect(model.summary.participating_households).toBe(3_000);
    expect(model.summary.net_municipal_requirement_cad).toBeCloseTo(36748.6, 6);
    expect(model.summary.cost_per_participating_household_cad).toBeCloseTo(12.249533, 6);
    expect(model.summary.cost_per_participating_household_monthly_cad).toBeCloseTo(1.020794, 6);
    expect(model.summary.equivalent_cost_per_owen_sound_household_cad).toBeCloseTo(3.340782, 6);
    expect(model.summary.equivalent_cost_per_owen_sound_household_monthly_cad).toBeCloseTo(0.278398, 6);
    expect(model.tiers.find((tier) => tier.tier_id === 'tier1')?.paid_hour_components).toMatchObject({
      gathering_preparation_hours: 0,
      post_gathering_follow_up_hours: 0,
      gathering_attendance_hours: 30,
      ward_councillor_meeting_hours: 120
    });
  });

  it('allows the citywide denominator to remain an editable scenario input', () => {
    const model = calculateLocalRepresentationCostModel({
      scenario_preset_id: 'mixed_twenty_area',
      household_equivalent_denominator: 10_000
    });

    expect(model.assumptions.household_equivalent_denominator).toBe(10_000);
    expect(model.summary.equivalent_cost_per_owen_sound_household_cad).toBeCloseTo(3.67486, 6);
    expect(model.summary.cost_per_participating_household_cad).toBeCloseTo(12.249533, 6);
  });

  it('keeps employer overhead presets as explicit sensitivities', () => {
    const model = calculateLocalRepresentationCostModel({
      scenario_preset_id: 'mixed_twenty_area',
      employer_overhead_preset: 'plus_33'
    });

    expect(model.assumptions.employer_overhead_percent).toBe(33);
    expect(model.summary.employer_overhead_cad).toBeCloseTo(10683.288, 6);
    expect(model.summary.net_municipal_requirement_cad).toBeCloseTo(47431.888, 6);
  });
});
