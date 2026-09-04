import evidence from "../data/source/owen-sound-local-representation-evidence.json";

export const OWEN_SOUND_LOCAL_REPRESENTATION_CONTRACT_VERSION = "1.0.0";
export const LOCAL_REPRESENTATION_MAX_AREAS = 70;
export const DEFAULT_LOCAL_REPRESENTATION_WARDS = 7;
export const DEFAULT_LOCAL_AREAS_PER_WARD = 10;
export const DEFAULT_HOUSEHOLDS_PER_LOCAL_AREA = 150;
export const DEFAULT_LOCAL_REPRESENTATIVE_LIVING_WAGE_CAD = 24.60;
export const DEFAULT_LOCAL_REPRESENTATION_HOUSEHOLD_EQUIVALENTS = 10_000;
export const DEFAULT_EXISTING_RESIDENT_LEVY_CAD = 38_133_221;
export const LOCAL_REPRESENTATION_WEEKS_PER_YEAR = 52;
export const LOCAL_REPRESENTATION_HOURS_PER_FTE_YEAR = 2_080;

export type LocalRepresentationTierId = "tier0" | "tier1" | "tier2" | "tier3" | "tier4";
export type ActiveLocalAreaCounts = Record<Exclude<LocalRepresentationTierId, "tier0">, number>;
export type LocalRepresentationTimeScenarioId = "low" | "central" | "high";
export type LocalRepresentationOverheadPreset = "direct" | "plus_15" | "plus_20" | "plus_33" | "custom";

export type LocalRepresentationTimeAssumptions = {
  invitation_minutes_per_household: number;
  gathering_preparation_hours: number;
  gathering_attendance_hours: number;
  post_gathering_follow_up_hours: number;
  meetings_per_year: number;
  meeting_duration_hours: number;
  basic_administration_hours: number;
  regular_resident_communication_hours: number;
  volunteer_organizing_hours: number;
  mailing_list_administration_hours: number;
  project_planning_hours: number;
  training_hours: number;
  volunteer_hours: number;
  direct_stewardship_hours: number;
  project_preparation_hours: number;
  supplies_equipment_handling_hours: number;
  reporting_follow_up_hours: number;
  tier1_materials_cad_per_area: number;
  tier2_materials_cad_per_area: number;
  tier2_training_cad_per_area: number;
  tier3_supplies_ppe_cad_per_area: number;
  tier3_printing_cad_per_area: number;
  tier3_disposal_cad_per_area: number;
  tier3_training_cad_per_area: number;
  tier3_project_materials_cad_per_area: number;
};

export type LocalRepresentationCustomInputs = {
  representative_hours_per_week: number;
  representative_hours_per_month: number;
  coordination_hours_per_year: number;
  direct_stewardship_hours_per_year: number;
  projects_per_year: number;
  material_cost_per_project_cad: number;
  training_cost_per_year_cad: number;
  additional_city_support_cost_per_area_cad: number;
  volunteer_hours_per_year: number;
};

export type LocalRepresentationProgramCosts = {
  initial_program_design_cad: number;
  training_materials_cad: number;
  recordkeeping_system_cad: number;
  insurance_legal_review_cad: number;
  background_checks_cad: number;
  annual_city_administration_cad: number;
  public_reporting_cad: number;
  contingency_percent: number;
};

export type LocalRepresentationFunding = {
  recurring_operating_grants_cad: number;
  recurring_city_budget_savings_cad: number;
  recurring_transit_transition_savings_cad: number;
  other_recurring_revenue_cad: number;
  recurring_partner_contributions_cad: number;
  one_time_grants_or_reserves_cad: number;
  one_time_partner_contributions_cad: number;
};

export type LocalRepresentationAvoidedCosts = {
  service_requests_resolved_earlier_cad: number;
  vandalism_or_damage_prevented_cad: number;
  repeated_staff_visits_avoided_cad: number;
  suitable_volunteer_work_cad: number;
  emergency_or_police_calls_avoided_cad: number;
};

export type LocalRepresentationOptions = {
  scenario_preset_id?: string;
  active_area_counts?: Partial<ActiveLocalAreaCounts>;
  active_wards?: number;
  wards?: number;
  areas_per_ward?: number;
  households_per_area?: number;
  living_wage_cad?: number;
  employer_overhead_preset?: LocalRepresentationOverheadPreset;
  employer_overhead_percent?: number;
  time_scenario?: LocalRepresentationTimeScenarioId;
  time_overrides?: Partial<LocalRepresentationTimeAssumptions>;
  custom?: Partial<LocalRepresentationCustomInputs>;
  program?: Partial<LocalRepresentationProgramCosts>;
  funding?: Partial<LocalRepresentationFunding>;
  avoided_costs?: Partial<LocalRepresentationAvoidedCosts>;
  household_equivalent_denominator?: number;
  existing_resident_levy_cad?: number;
  incremental_councillor_cost_cad_per_hour?: number;
  include_sensitivity?: boolean;
  include_scale_comparison?: boolean;
};

export const DEFAULT_LOCAL_REPRESENTATION_TIME_SCENARIOS: Record<LocalRepresentationTimeScenarioId, LocalRepresentationTimeAssumptions> = {
  low: {
    invitation_minutes_per_household: 8,
    gathering_preparation_hours: 3,
    gathering_attendance_hours: 2,
    post_gathering_follow_up_hours: 1,
    meetings_per_year: 12,
    meeting_duration_hours: 1,
    basic_administration_hours: 4,
    regular_resident_communication_hours: 10,
    volunteer_organizing_hours: 8,
    mailing_list_administration_hours: 3,
    project_planning_hours: 8,
    training_hours: 3,
    volunteer_hours: 20,
    direct_stewardship_hours: 16,
    project_preparation_hours: 5,
    supplies_equipment_handling_hours: 3,
    reporting_follow_up_hours: 4,
    tier1_materials_cad_per_area: 40,
    tier2_materials_cad_per_area: 60,
    tier2_training_cad_per_area: 50,
    tier3_supplies_ppe_cad_per_area: 50,
    tier3_printing_cad_per_area: 25,
    tier3_disposal_cad_per_area: 10,
    tier3_training_cad_per_area: 50,
    tier3_project_materials_cad_per_area: 50
  },
  central: {
    invitation_minutes_per_household: 12,
    gathering_preparation_hours: 4,
    gathering_attendance_hours: 3,
    post_gathering_follow_up_hours: 2,
    meetings_per_year: 12,
    meeting_duration_hours: 1,
    basic_administration_hours: 6,
    regular_resident_communication_hours: 18,
    volunteer_organizing_hours: 12,
    mailing_list_administration_hours: 6,
    project_planning_hours: 12,
    training_hours: 4,
    volunteer_hours: 40,
    direct_stewardship_hours: 24,
    project_preparation_hours: 8,
    supplies_equipment_handling_hours: 4,
    reporting_follow_up_hours: 6,
    tier1_materials_cad_per_area: 75,
    tier2_materials_cad_per_area: 100,
    tier2_training_cad_per_area: 75,
    tier3_supplies_ppe_cad_per_area: 100,
    tier3_printing_cad_per_area: 50,
    tier3_disposal_cad_per_area: 25,
    tier3_training_cad_per_area: 100,
    tier3_project_materials_cad_per_area: 100
  },
  high: {
    invitation_minutes_per_household: 16,
    gathering_preparation_hours: 6,
    gathering_attendance_hours: 4,
    post_gathering_follow_up_hours: 4,
    meetings_per_year: 12,
    meeting_duration_hours: 1,
    basic_administration_hours: 12,
    regular_resident_communication_hours: 30,
    volunteer_organizing_hours: 24,
    mailing_list_administration_hours: 10,
    project_planning_hours: 20,
    training_hours: 8,
    volunteer_hours: 80,
    direct_stewardship_hours: 40,
    project_preparation_hours: 12,
    supplies_equipment_handling_hours: 8,
    reporting_follow_up_hours: 10,
    tier1_materials_cad_per_area: 125,
    tier2_materials_cad_per_area: 180,
    tier2_training_cad_per_area: 125,
    tier3_supplies_ppe_cad_per_area: 200,
    tier3_printing_cad_per_area: 100,
    tier3_disposal_cad_per_area: 50,
    tier3_training_cad_per_area: 200,
    tier3_project_materials_cad_per_area: 250
  }
};

export const DEFAULT_LOCAL_REPRESENTATION_CUSTOM_INPUTS: LocalRepresentationCustomInputs = {
  representative_hours_per_week: 4,
  representative_hours_per_month: 0,
  coordination_hours_per_year: 104,
  direct_stewardship_hours_per_year: 52,
  projects_per_year: 2,
  material_cost_per_project_cad: 250,
  training_cost_per_year_cad: 250,
  additional_city_support_cost_per_area_cad: 0,
  volunteer_hours_per_year: 80
};

export const DEFAULT_LOCAL_REPRESENTATION_PROGRAM_COSTS: LocalRepresentationProgramCosts = {
  initial_program_design_cad: 10_000,
  training_materials_cad: 2_000,
  recordkeeping_system_cad: 1_000,
  insurance_legal_review_cad: 0,
  background_checks_cad: 0,
  annual_city_administration_cad: 0,
  public_reporting_cad: 2_000,
  contingency_percent: 0
};

export const DEFAULT_LOCAL_REPRESENTATION_FUNDING: LocalRepresentationFunding = {
  recurring_operating_grants_cad: 0,
  recurring_city_budget_savings_cad: 0,
  recurring_transit_transition_savings_cad: 0,
  other_recurring_revenue_cad: 0,
  recurring_partner_contributions_cad: 0,
  one_time_grants_or_reserves_cad: 0,
  one_time_partner_contributions_cad: 0
};

export const DEFAULT_LOCAL_REPRESENTATION_AVOIDED_COSTS: LocalRepresentationAvoidedCosts = {
  service_requests_resolved_earlier_cad: 0,
  vandalism_or_damage_prevented_cad: 0,
  repeated_staff_visits_avoided_cad: 0,
  suitable_volunteer_work_cad: 0,
  emergency_or_police_calls_avoided_cad: 0
};

export const LOCAL_REPRESENTATION_SCENARIO_PRESETS = [
  {id: "one_area", label: "One-area demonstration", active_area_counts: {tier1: 1, tier2: 0, tier3: 0, tier4: 0}, active_wards: 1},
  {id: "one_per_ward", label: "One basic area per ward · 7 areas", active_area_counts: {tier1: 7, tier2: 0, tier3: 0, tier4: 0}, active_wards: 7},
  {id: "ten_area_pilot", label: "Ten-area resident-demand pilot", active_area_counts: {tier1: 10, tier2: 0, tier3: 0, tier4: 0}, active_wards: 7},
  {id: "mixed_twenty_area", label: "Mixed twenty-area rollout", active_area_counts: {tier1: 10, tier2: 7, tier3: 3, tier4: 0}, active_wards: 7},
  {id: "citywide_tier1", label: "City-wide Tier 1 · 70 areas", active_area_counts: {tier1: 70, tier2: 0, tier3: 0, tier4: 0}, active_wards: 7},
  {id: "custom", label: "Custom scenario", active_area_counts: {tier1: 0, tier2: 0, tier3: 0, tier4: 0}, active_wards: 0}
] as const;

export const LOCAL_REPRESENTATION_OVERHEAD_PRESETS: Record<LocalRepresentationOverheadPreset, number | null> = {
  direct: 0,
  plus_15: 15,
  plus_20: 20,
  plus_33: 33,
  custom: null
};

export const LOCAL_REPRESENTATION_TIME_FIELD_LABELS: Record<keyof LocalRepresentationTimeAssumptions, string> = {
  invitation_minutes_per_household: "Invitation minutes per household",
  gathering_preparation_hours: "Gathering preparation hours",
  gathering_attendance_hours: "Gathering attendance hours",
  post_gathering_follow_up_hours: "Post-gathering follow-up hours",
  meetings_per_year: "Ward Councillor meetings per year",
  meeting_duration_hours: "Meeting duration",
  basic_administration_hours: "Basic administration and issue records",
  regular_resident_communication_hours: "Regular resident communication",
  volunteer_organizing_hours: "Volunteer organizing",
  mailing_list_administration_hours: "Mailing-list administration",
  project_planning_hours: "Project planning",
  training_hours: "Representative training hours",
  volunteer_hours: "Volunteer hours",
  direct_stewardship_hours: "Direct stewardship",
  project_preparation_hours: "Project preparation",
  supplies_equipment_handling_hours: "Supplies/equipment handling",
  reporting_follow_up_hours: "Reporting and follow-up",
  tier1_materials_cad_per_area: "Tier 1 communication materials",
  tier2_materials_cad_per_area: "Tier 2 coordination materials",
  tier2_training_cad_per_area: "Tier 2 training cost",
  tier3_supplies_ppe_cad_per_area: "Tier 3 supplies and PPE",
  tier3_printing_cad_per_area: "Tier 3 printing",
  tier3_disposal_cad_per_area: "Tier 3 disposal",
  tier3_training_cad_per_area: "Tier 3 training",
  tier3_project_materials_cad_per_area: "Tier 3 project materials"
};

export const LOCAL_REPRESENTATION_SOURCES = evidence.sources;

const numeric = (value: unknown, fallback = 0): number => Number.isFinite(Number(value)) ? Number(value) : fallback;
const nonNegative = (value: unknown, fallback = 0): number => Math.max(0, numeric(value, fallback));
const rounded = (value: number): number => Number(value.toFixed(6));
const tierIds: Array<Exclude<LocalRepresentationTierId, "tier0">> = ["tier1", "tier2", "tier3", "tier4"];

function selectedPreset(id: string | undefined) {
  return LOCAL_REPRESENTATION_SCENARIO_PRESETS.find((preset) => preset.id === id) ?? LOCAL_REPRESENTATION_SCENARIO_PRESETS[3];
}

function resolveTime(options: LocalRepresentationOptions): {id: LocalRepresentationTimeScenarioId; values: LocalRepresentationTimeAssumptions} {
  const id = options.time_scenario ?? "central";
  const base = DEFAULT_LOCAL_REPRESENTATION_TIME_SCENARIOS[id] ?? DEFAULT_LOCAL_REPRESENTATION_TIME_SCENARIOS.central;
  return {id, values: {...base, ...(options.time_overrides ?? {})}};
}

function resolveCounts(options: LocalRepresentationOptions) {
  const preset = selectedPreset(options.scenario_preset_id);
  const requested: ActiveLocalAreaCounts = {
    tier1: Math.round(nonNegative(options.active_area_counts?.tier1, preset.active_area_counts.tier1)),
    tier2: Math.round(nonNegative(options.active_area_counts?.tier2, preset.active_area_counts.tier2)),
    tier3: Math.round(nonNegative(options.active_area_counts?.tier3, preset.active_area_counts.tier3)),
    tier4: Math.round(nonNegative(options.active_area_counts?.tier4, preset.active_area_counts.tier4))
  };
  const totalRequested = Object.values(requested).reduce((sum, value) => sum + value, 0);
  let remaining = LOCAL_REPRESENTATION_MAX_AREAS;
  const applied = {} as ActiveLocalAreaCounts;
  for (const tier of tierIds) {
    applied[tier] = Math.min(requested[tier], remaining);
    remaining -= applied[tier];
  }
  return {
    preset,
    requested,
    applied,
    total_requested: totalRequested,
    total_applied: Object.values(applied).reduce((sum, value) => sum + value, 0),
    limit_exceeded: totalRequested > LOCAL_REPRESENTATION_MAX_AREAS
  };
}

function resolveOverhead(options: LocalRepresentationOptions): {preset: LocalRepresentationOverheadPreset; percent: number} {
  const preset = options.employer_overhead_preset ?? "plus_33";
  const configured = LOCAL_REPRESENTATION_OVERHEAD_PRESETS[preset];
  return {preset, percent: Math.max(0, configured == null ? numeric(options.employer_overhead_percent, 0) : configured)};
}

type TierWork = Record<string, number>;

function tierWork(tier: Exclude<LocalRepresentationTierId, "tier0">, households: number, time: LocalRepresentationTimeAssumptions, custom: LocalRepresentationCustomInputs): TierWork {
  const invitation = households * time.invitation_minutes_per_household / 60;
  const gathering = time.gathering_preparation_hours + time.gathering_attendance_hours + time.post_gathering_follow_up_hours;
  const wardMeeting = time.meetings_per_year * time.meeting_duration_hours;
  const base = {
    invitation_hours: invitation,
    gathering_preparation_hours: time.gathering_preparation_hours,
    gathering_attendance_hours: time.gathering_attendance_hours,
    post_gathering_follow_up_hours: time.post_gathering_follow_up_hours,
    ward_councillor_meeting_hours: wardMeeting,
    communication_and_issue_admin_hours: time.basic_administration_hours,
    coordination_hours: 0,
    direct_stewardship_hours: 0,
    project_preparation_hours: 0,
    supplies_equipment_handling_hours: 0,
    reporting_follow_up_hours: 0,
    custom_service_hours: 0
  };
  if (tier === "tier1") return base;
  if (tier === "tier2") return {
    ...base,
    communication_and_issue_admin_hours: time.basic_administration_hours + time.regular_resident_communication_hours + time.mailing_list_administration_hours,
    coordination_hours: time.volunteer_organizing_hours + time.project_planning_hours + time.training_hours
  };
  if (tier === "tier3") return {
    ...tierWork("tier2", households, time, custom),
    direct_stewardship_hours: time.direct_stewardship_hours,
    project_preparation_hours: time.project_preparation_hours,
    supplies_equipment_handling_hours: time.supplies_equipment_handling_hours,
    reporting_follow_up_hours: time.reporting_follow_up_hours
  };
  const customService = custom.representative_hours_per_month > 0 ? custom.representative_hours_per_month * 12 : custom.representative_hours_per_week * LOCAL_REPRESENTATION_WEEKS_PER_YEAR;
  return {
    ...base,
    custom_service_hours: customService,
    coordination_hours: custom.coordination_hours_per_year,
    direct_stewardship_hours: custom.direct_stewardship_hours_per_year
  };
}

function tierMaterialCosts(tier: Exclude<LocalRepresentationTierId, "tier0">, areaCount: number, time: LocalRepresentationTimeAssumptions, custom: LocalRepresentationCustomInputs): Record<string, number> {
  if (tier === "tier1") return {essential_communication: time.tier1_materials_cad_per_area * areaCount};
  if (tier === "tier2") return {
    essential_communication: time.tier1_materials_cad_per_area * areaCount,
    coordination_materials: time.tier2_materials_cad_per_area * areaCount,
    training: time.tier2_training_cad_per_area * areaCount
  };
  if (tier === "tier3") return {
    essential_communication: time.tier1_materials_cad_per_area * areaCount,
    coordination_materials: time.tier2_materials_cad_per_area * areaCount,
    training: time.tier2_training_cad_per_area * areaCount,
    supplies_and_ppe: time.tier3_supplies_ppe_cad_per_area * areaCount,
    printing: time.tier3_printing_cad_per_area * areaCount,
    disposal: time.tier3_disposal_cad_per_area * areaCount,
    active_training: time.tier3_training_cad_per_area * areaCount,
    project_materials: time.tier3_project_materials_cad_per_area * areaCount
  };
  return {
    essential_communication: time.tier1_materials_cad_per_area * areaCount,
    custom_project_materials: custom.material_cost_per_project_cad * custom.projects_per_year * areaCount,
    custom_training: custom.training_cost_per_year_cad * areaCount,
    additional_city_support: custom.additional_city_support_cost_per_area_cad * areaCount
  };
}

function sumValues(values: Record<string, number>): number { return Object.values(values).reduce((sum, value) => sum + value, 0); }

function calculateCore(options: LocalRepresentationOptions) {
  const counts = resolveCounts(options);
  const time = resolveTime(options);
  const custom: LocalRepresentationCustomInputs = {...DEFAULT_LOCAL_REPRESENTATION_CUSTOM_INPUTS, ...(options.custom ?? {})};
  const program: LocalRepresentationProgramCosts = {...DEFAULT_LOCAL_REPRESENTATION_PROGRAM_COSTS, ...(options.program ?? {})};
  const funding: LocalRepresentationFunding = {...DEFAULT_LOCAL_REPRESENTATION_FUNDING, ...(options.funding ?? {})};
  const avoidedCosts: LocalRepresentationAvoidedCosts = {...DEFAULT_LOCAL_REPRESENTATION_AVOIDED_COSTS, ...(options.avoided_costs ?? {})};
  const overhead = resolveOverhead(options);
  const householdsPerArea = nonNegative(options.households_per_area, DEFAULT_HOUSEHOLDS_PER_LOCAL_AREA);
  const livingWage = nonNegative(options.living_wage_cad, DEFAULT_LOCAL_REPRESENTATIVE_LIVING_WAGE_CAD);
  const wards = Math.max(0, Math.round(nonNegative(options.wards, DEFAULT_LOCAL_REPRESENTATION_WARDS)));
  const areasPerWard = Math.max(1, nonNegative(options.areas_per_ward, DEFAULT_LOCAL_AREAS_PER_WARD));
  const activeWards = Math.min(wards, Math.max(0, Math.round(nonNegative(options.active_wards, counts.preset.active_wards))));
  const denominator = Math.max(1, nonNegative(options.household_equivalent_denominator, DEFAULT_LOCAL_REPRESENTATION_HOUSEHOLD_EQUIVALENTS));
  const levyBase = Math.max(1, nonNegative(options.existing_resident_levy_cad, DEFAULT_EXISTING_RESIDENT_LEVY_CAD));
  const councillorCostPerHour = nonNegative(options.incremental_councillor_cost_cad_per_hour);
  const activeAreas = counts.total_applied;
  const participatingHouseholds = activeAreas * householdsPerArea;
  const representatives = activeAreas;
  const annualInvitations = activeAreas * householdsPerArea;
  const annualGatherings = activeAreas;
  const annualWardMeetingsForRepresentatives = representatives * time.values.meetings_per_year;
  const electedWardMeetingHours = activeWards * time.values.meetings_per_year * time.values.meeting_duration_hours;
  const tierRows = tierIds.map((tier) => {
    const areaCount = counts.applied[tier];
    const work = tierWork(tier, householdsPerArea, time.values, custom);
    const paidHoursPerArea = sumValues(work);
    const paidHours = paidHoursPerArea * areaCount;
    const materials = tierMaterialCosts(tier, areaCount, time.values, custom);
    const materialsTotal = sumValues(materials);
    const volunteerHoursPerArea = tier === "tier1" ? 0 : tier === "tier2" ? time.values.volunteer_hours : tier === "tier3" ? time.values.volunteer_hours * 2 : custom.volunteer_hours_per_year;
    const volunteerHours = volunteerHoursPerArea * areaCount;
    const wages = paidHours * livingWage;
    const employerCost = wages * overhead.percent / 100;
    return {
      tier_id: tier,
      active_local_areas: areaCount,
      active_local_representatives: areaCount,
      participating_households: areaCount * householdsPerArea,
      annual_invitations: tier === "tier1" || tier === "tier2" || tier === "tier3" || tier === "tier4" ? areaCount * householdsPerArea : 0,
      annual_gatherings: areaCount,
      annual_ward_councillor_meetings: areaCount * time.values.meetings_per_year,
      paid_hour_components: Object.fromEntries(Object.entries(work).map(([key, value]) => [key, rounded(value * areaCount)])),
      paid_hours_per_area_year: rounded(paidHoursPerArea),
      paid_representative_hours_year: rounded(paidHours),
      volunteer_hours_year: rounded(volunteerHours),
      wages_cad: rounded(wages),
      employer_overhead_cad: rounded(employerCost),
      materials_and_training_cad: rounded(materialsTotal),
      material_components_cad: Object.fromEntries(Object.entries(materials).map(([key, value]) => [key, rounded(value)])),
      gross_annual_cost_cad: rounded(wages + employerCost + materialsTotal),
      evidence_status: "Campaign planning assumption"
    };
  });
  const tierCost = tierRows.reduce((sum, row) => sum + row.gross_annual_cost_cad, 0);
  const tierWages = tierRows.reduce((sum, row) => sum + row.wages_cad, 0);
  const tierEmployer = tierRows.reduce((sum, row) => sum + row.employer_overhead_cad, 0);
  const tierMaterials = tierRows.reduce((sum, row) => sum + row.materials_and_training_cad, 0);
  const representativeHours = tierRows.reduce((sum, row) => sum + row.paid_representative_hours_year, 0);
  const volunteerHours = tierRows.reduce((sum, row) => sum + row.volunteer_hours_year, 0);
  const programAdministration = program.annual_city_administration_cad + program.public_reporting_cad;
  const subtotalBeforeContingency = tierCost + programAdministration;
  const contingency = subtotalBeforeContingency * Math.max(0, program.contingency_percent) / 100;
  const grossRecurring = subtotalBeforeContingency + contingency;
  const startup = program.initial_program_design_cad + program.training_materials_cad + program.recordkeeping_system_cad + program.insurance_legal_review_cad + program.background_checks_cad;
  const recurringFunding = funding.recurring_operating_grants_cad + funding.recurring_city_budget_savings_cad + funding.recurring_transit_transition_savings_cad + funding.other_recurring_revenue_cad + funding.recurring_partner_contributions_cad;
  const oneTimeFunding = funding.one_time_grants_or_reserves_cad + funding.one_time_partner_contributions_cad;
  const enteredAvoidedCosts = sumValues(avoidedCosts as unknown as Record<string, number>);
  const recurringRequirementBeforeFloor = grossRecurring - recurringFunding - enteredAvoidedCosts;
  const netRequirement = Math.max(0, recurringRequirementBeforeFloor);
  const fundingExcess = Math.max(0, -recurringRequirementBeforeFloor);
  const startupNet = Math.max(0, startup - oneTimeFunding);
  const startupExcess = Math.max(0, oneTimeFunding - startup);
  const summary = {
    active_local_areas: activeAreas,
    active_local_representatives: representatives,
    participating_households: participatingHouseholds,
    annual_invitations: annualInvitations,
    annual_gatherings: annualGatherings,
    annual_ward_councillor_meetings: electedWardMeetingHours > 0 ? activeWards * time.values.meetings_per_year : 0,
    paid_representative_hours_year: rounded(representativeHours),
    paid_representative_fte: rounded(representativeHours / LOCAL_REPRESENTATION_HOURS_PER_FTE_YEAR),
    volunteer_hours_year: rounded(volunteerHours),
    wages_cad: rounded(tierWages),
    employer_overhead_cad: rounded(tierEmployer),
    materials_and_training_cad: rounded(tierMaterials),
    program_administration_cad: rounded(programAdministration),
    contingency_cad: rounded(contingency),
    gross_recurring_annual_cost_cad: rounded(grossRecurring),
    recurring_funding_cad: rounded(recurringFunding),
    entered_avoided_costs_cad: rounded(enteredAvoidedCosts),
    net_municipal_requirement_cad: rounded(netRequirement),
    recurring_funding_excess_cad: rounded(fundingExcess),
    startup_cost_cad: rounded(startup),
    startup_funding_cad: rounded(oneTimeFunding),
    startup_net_cost_cad: rounded(startupNet),
    startup_funding_excess_cad: rounded(startupExcess),
    cost_per_active_local_area_cad: rounded(activeAreas ? netRequirement / activeAreas : 0),
    cost_per_participating_household_cad: rounded(participatingHouseholds ? netRequirement / participatingHouseholds : 0),
    equivalent_cost_per_owen_sound_household_cad: rounded(netRequirement / denominator),
    percentage_of_existing_resident_levy: rounded(netRequirement / levyBase * 100),
    savings_required_to_break_even_cad: rounded(Math.max(0, grossRecurring - recurringFunding)),
    savings_required_per_active_area_cad: rounded(activeAreas ? Math.max(0, grossRecurring - recurringFunding) / activeAreas : 0),
    savings_required_per_participating_household_cad: rounded(participatingHouseholds ? Math.max(0, grossRecurring - recurringFunding) / participatingHouseholds : 0)
  };
  const inactiveTier = {
    tier_id: "tier0",
    active_local_areas: 0,
    active_local_representatives: 0,
    participating_households: 0,
    annual_invitations: 0,
    annual_gatherings: 0,
    annual_ward_councillor_meetings: 0,
    paid_hour_components: {},
    paid_hours_per_area_year: 0,
    paid_representative_hours_year: 0,
    volunteer_hours_year: 0,
    wages_cad: 0,
    employer_overhead_cad: 0,
    materials_and_training_cad: 0,
    material_components_cad: {},
    gross_annual_cost_cad: 0,
    evidence_status: "Campaign planning assumption"
  };
  const result = {
    contract_version: OWEN_SOUND_LOCAL_REPRESENTATION_CONTRACT_VERSION,
    scenario_preset_id: counts.preset.id,
    scenario_label: counts.preset.label,
    assumptions: {
      wards,
      areas_per_ward: areasPerWard,
      maximum_local_areas: LOCAL_REPRESENTATION_MAX_AREAS,
      households_per_local_area: householdsPerArea,
      living_wage_cad: livingWage,
      employer_overhead_preset: overhead.preset,
      employer_overhead_percent: overhead.percent,
      household_equivalent_denominator: denominator,
      existing_resident_levy_cad: levyBase,
      time_scenario: time.id,
      time_values: time.values,
      custom_inputs: custom,
      program_costs: program,
      evidence_status: evidence.input_status
    },
    participation: {
      requested_area_counts: counts.requested,
      applied_area_counts: counts.applied,
      total_requested_active_areas: counts.total_requested,
      total_active_areas: counts.total_applied,
      active_wards: activeWards,
      active_area_limit_exceeded: counts.limit_exceeded,
      maximum_active_areas: LOCAL_REPRESENTATION_MAX_AREAS
    },
    tiers: [inactiveTier, ...tierRows],
    ward_councillor_time: {
      active_wards: activeWards,
      meetings_per_year: time.values.meetings_per_year,
      meeting_duration_hours: time.values.meeting_duration_hours,
      meetings: activeWards * time.values.meetings_per_year,
      elected_representative_hours_year: rounded(electedWardMeetingHours),
      incremental_cost_cad: rounded(electedWardMeetingHours * councillorCostPerHour),
      evidence_status: councillorCostPerHour > 0 ? "Campaign planning assumption" : "Derived from official figures"
    },
    program: {
      startup_components_cad: {
        initial_program_design: program.initial_program_design_cad,
        training_materials: program.training_materials_cad,
        recordkeeping_system: program.recordkeeping_system_cad,
        insurance_legal_review: program.insurance_legal_review_cad,
        background_checks: program.background_checks_cad
      },
      recurring_components_cad: {
        annual_city_administration: program.annual_city_administration_cad,
        public_reporting: program.public_reporting_cad,
        contingency
      },
      startup_cost_cad: rounded(startup),
      recurring_administration_cad: rounded(programAdministration),
      contingency_cad: rounded(contingency),
      evidence_status: "Campaign planning assumption"
    },
    funding: {
      recurring_components_cad: funding,
      recurring_total_cad: rounded(recurringFunding),
      one_time_total_cad: rounded(oneTimeFunding),
      entered_avoided_costs_components_cad: avoidedCosts,
      entered_avoided_costs_total_cad: rounded(enteredAvoidedCosts),
      all_values_are_user_entered_scenarios: true
    },
    summary,
    formulas: {
      invitation_hours: "active local area households × invitation minutes ÷ 60",
      representative_paid_hours: "invitation + gathering + Ward Councillor meeting + communication/administration + coordination + direct stewardship",
      wages: "paid representative hours × living wage",
      employer_cost: "wages × employer overhead percentage",
      net_municipal_requirement: "max(0, gross recurring cost − recurring funding − entered avoided costs)",
      household_equivalent: "net municipal requirement ÷ editable household-equivalent denominator"
    },
    validation: {
      valid: !counts.limit_exceeded,
      messages: counts.limit_exceeded ? [`Requested active Local Areas exceed the maximum of ${LOCAL_REPRESENTATION_MAX_AREAS}; applied counts are capped.`] : [],
      zero_active_service_is_zero_cost: activeAreas === 0 ? rounded(grossRecurring) === rounded(programAdministration + contingency) : true
    }
  };
  return result;
}

export function calculateLocalRepresentationCostModel(options: LocalRepresentationOptions = {}) {
  const core = calculateCore(options);
  const includeSensitivity = options.include_sensitivity !== false;
  const timeSensitivity = includeSensitivity ? (Object.keys(DEFAULT_LOCAL_REPRESENTATION_TIME_SCENARIOS) as LocalRepresentationTimeScenarioId[]).map((scenario) => {
    const row = calculateCore({...options, time_scenario: scenario, include_sensitivity: false});
    return {time_scenario: scenario, summary: row.summary, gross_recurring_annual_cost_cad: row.summary.gross_recurring_annual_cost_cad, net_municipal_requirement_cad: row.summary.net_municipal_requirement_cad};
  }) : [];
  const scaleComparison = options.include_scale_comparison === false ? [] : LOCAL_REPRESENTATION_SCENARIO_PRESETS.filter((preset) => preset.id !== "custom").map((preset) => {
    const row = calculateCore({...options, scenario_preset_id: preset.id, active_area_counts: undefined, active_wards: preset.active_wards, include_sensitivity: false});
    return {preset_id: preset.id, label: preset.label, summary: row.summary, active_area_counts: row.participation.applied_area_counts};
  });
  return {...core, time_sensitivity: timeSensitivity, scale_comparison: scaleComparison};
}
