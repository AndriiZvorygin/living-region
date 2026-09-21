import {describe, expect, it} from 'vitest';
import {calculateLocalRepresentationCostModel, DEFAULT_LOCAL_REPRESENTATION_SCENARIO_ID} from './local-representation-cost-model';

describe('Owen Sound Local Representation household comparisons', () => {
  it('uses all 70 Local Areas for the canonical baseline', () => {
    const model = calculateLocalRepresentationCostModel();
    const tier1 = model.tiers.find((tier) => tier.tier_id === 'tier1');

    expect(model.scenario_preset_id).toBe(DEFAULT_LOCAL_REPRESENTATION_SCENARIO_ID);
    expect(model.summary.active_local_areas).toBe(70);
    expect(model.summary.active_local_representatives).toBe(70);
    expect(model.summary.participating_households).toBe(10_500);
    expect(model.summary.annual_gatherings).toBe(70);
    expect(model.summary.annual_ward_councillor_meetings).toBe(84);
    expect(model.summary.paid_representative_hours_year).toBeCloseTo(1_925, 6);
    expect(model.summary.wages_cad).toBeCloseTo(47_355, 6);
    expect(model.summary.materials_and_training_cad).toBeCloseTo(5_250, 6);
    expect(model.summary.net_municipal_requirement_cad).toBeCloseTo(52_605, 6);
    expect(model.summary.equivalent_cost_per_owen_sound_household_monthly_cad).toBeCloseTo(0.398523, 6);
    expect(tier1?.annual_ward_councillor_meetings).toBe(840);
    expect(tier1?.paid_hour_components).toMatchObject({
      gathering_preparation_hours: 0,
      gathering_attendance_hours: 210,
      post_gathering_follow_up_hours: 0,
      communication_and_issue_admin_hours: 0,
      ward_councillor_meeting_hours: 840
    });
  });

  it('keeps participating-household and citywide comparison denominators separate', () => {
    const model = calculateLocalRepresentationCostModel({scenario_preset_id: 'mixed_twenty_area'});

    expect(model.assumptions.household_equivalent_denominator).toBe(11_000);
    expect(model.assumptions.employer_overhead_preset).toBe('direct');
    expect(model.assumptions.employer_overhead_percent).toBe(0);
    expect(model.summary.employer_overhead_cad).toBe(0);
    expect(model.summary.program_administration_cad).toBe(0);
    expect(model.summary.participating_households).toBe(3_000);
    expect(model.summary.net_municipal_requirement_cad).toBeCloseTo(33796.6, 6);
    expect(model.summary.cost_per_participating_household_cad).toBeCloseTo(11.265533, 6);
    expect(model.summary.cost_per_participating_household_monthly_cad).toBeCloseTo(0.938794, 6);
    expect(model.summary.equivalent_cost_per_owen_sound_household_cad).toBeCloseTo(3.072418, 6);
    expect(model.summary.equivalent_cost_per_owen_sound_household_monthly_cad).toBeCloseTo(0.256035, 6);
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
    expect(model.summary.equivalent_cost_per_owen_sound_household_cad).toBeCloseTo(3.37966, 6);
    expect(model.summary.cost_per_participating_household_cad).toBeCloseTo(11.265533, 6);
  });

  it('keeps employer overhead presets as explicit sensitivities', () => {
    const model = calculateLocalRepresentationCostModel({
      scenario_preset_id: 'mixed_twenty_area',
      employer_overhead_preset: 'plus_33'
    });

    expect(model.assumptions.employer_overhead_percent).toBe(33);
    expect(model.summary.employer_overhead_cad).toBeCloseTo(9709.128, 6);
    expect(model.summary.net_municipal_requirement_cad).toBeCloseTo(43505.728, 6);
  });
});
