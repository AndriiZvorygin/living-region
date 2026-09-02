import evidence from "../data/source/owen-sound-transit-cost-evidence.json";

export const OWEN_SOUND_TRANSIT_COST_CONTRACT_VERSION = "1.0.0";
export const TRANSIT_DAYS_PER_YEAR = 52;

export type TransitFareScenario = "existing_fares" | "added_service_fare_free" | "entire_system_fare_free";

export type TransitPhase = {
  id: string;
  label: string;
  description: string;
  included_description: string;
  conventional_vehicle_hours: number;
  service_days_per_week: number;
  added_hours_per_day: number;
  conventional_buses_operating: number;
  mobility_transit_included: boolean;
  mobility_transit_vehicle_hours: number | null;
  gross_cost_low_cad: number;
  gross_cost_high_cad: number;
  target_boardings_per_vehicle_hour: number;
  fare_contribution_low_cad: number;
  fare_contribution_high_cad: number;
  evidence_classifications: Record<string, string>;
};

export type TransitFunding = {
  recurring_operating_grants_cad?: number;
  recurring_city_budget_savings_cad?: number;
  recurring_transit_transition_savings_cad?: number;
  other_recurring_revenue_cad?: number;
  one_time_capital_grants_or_reserves_cad?: number;
};

export const TRANSIT_BASELINE = {
  year: 2026,
  contract_services_cad: 1_415_538,
  fuel_cad: 172_000,
  gross_cost_cad: 1_848_555,
  grants_cad: 250_000,
  other_revenue_cad: 414_300,
  net_cost_cad: 1_184_255,
  internal_allocation_cad: 161_905,
  division_levy_requirement_cad: 1_346_160,
  ridership_year: 2025,
  conventional_transit_trips: 200_000,
  transit_revenue_cad: 412_000,
  system_average_boardings_per_vehicle_hour: 14.36,
  sources: ["city_2026_mayors_budget", "city_transit_study", "cfos_2025_results"]
} as const;

export const TRANSIT_SOURCES = evidence.sources;

export const TRANSIT_INPUT_EVIDENCE_CLASSIFICATIONS = {
  service_days_per_week: "Campaign planning assumption",
  added_hours_per_day: "Campaign planning assumption",
  conventional_buses_operating: "Campaign planning assumption",
  conventional_vehicle_hours: "Campaign planning assumption",
  mobility_transit_vehicle_hours: "Quotation or operating data required",
  gross_cost_range: "Campaign planning assumption",
  target_boardings_per_vehicle_hour: "Campaign planning assumption",
  fare_contribution_per_boarding: "Campaign planning assumption",
  recurring_operating_grants: "Quotation or operating data required",
  recurring_city_budget_savings: "Quotation or operating data required",
  recurring_transit_transition_savings: "Quotation or operating data required",
  other_recurring_revenue: "Quotation or operating data required",
  one_time_capital_grants_or_reserves: "Quotation or operating data required",
  existing_system_fare_revenue: "Quotation or operating data required",
  household_equivalent_denominator: "Campaign planning assumption"
} as const;

export const DEFAULT_TRANSIT_PHASES: TransitPhase[] = [
  {
    id: "phase0",
    label: "Phase 0 · reliability and transition",
    description: "Existing routes and hours are preserved while the City audits fleet, reliability, procurement and transition options.",
    included_description: "No added service cost or added levy allocation.",
    conventional_vehicle_hours: 0,
    service_days_per_week: 0,
    added_hours_per_day: 0,
    conventional_buses_operating: 0,
    mobility_transit_included: true,
    mobility_transit_vehicle_hours: 0,
    gross_cost_low_cad: 0,
    gross_cost_high_cad: 0,
    target_boardings_per_vehicle_hour: 0,
    fare_contribution_low_cad: 0,
    fare_contribution_high_cad: 0,
    evidence_classifications: { service: "Campaign planning assumption", cost: "Campaign planning assumption", mobility: "Quotation or operating data required" }
  },
  {
    id: "phase1",
    label: "Phase 1 · weekday evenings",
    description: "All four routes approximately hourly until 10 p.m., Monday to Friday, with equivalent Mobility Transit availability.",
    included_description: "Added beyond the existing daytime service.",
    conventional_vehicle_hours: 2_080,
    service_days_per_week: 5,
    added_hours_per_day: 8,
    conventional_buses_operating: 4,
    mobility_transit_included: true,
    mobility_transit_vehicle_hours: null,
    gross_cost_low_cad: 300_000,
    gross_cost_high_cad: 375_000,
    target_boardings_per_vehicle_hour: 8,
    fare_contribution_low_cad: 1.5,
    fare_contribution_high_cad: 2,
    evidence_classifications: { service: "Campaign planning assumption", cost: "Campaign planning assumption", mobility: "Quotation or operating data required", ridership: "Campaign planning assumption", fare: "Campaign planning assumption" }
  },
  {
    id: "phase2",
    label: "Phase 2 · Sunday daytime",
    description: "All four routes approximately hourly from 9 a.m. to 3 p.m. on Sundays, with equivalent Mobility Transit availability.",
    included_description: "Incremental beyond Phase 1.",
    conventional_vehicle_hours: 624,
    service_days_per_week: 1,
    added_hours_per_day: 6,
    conventional_buses_operating: 4,
    mobility_transit_included: true,
    mobility_transit_vehicle_hours: null,
    gross_cost_low_cad: 90_000,
    gross_cost_high_cad: 110_000,
    target_boardings_per_vehicle_hour: 6,
    fare_contribution_low_cad: 1.5,
    fare_contribution_high_cad: 2,
    evidence_classifications: { service: "Campaign planning assumption", cost: "Campaign planning assumption", mobility: "Quotation or operating data required", ridership: "Campaign planning assumption", fare: "Campaign planning assumption" }
  },
  {
    id: "phase3",
    label: "Phase 3 · through 10 p.m. seven days",
    description: "Fill remaining gaps toward 6 a.m. to 10 p.m. service seven days a week, with equivalent Mobility Transit availability.",
    included_description: "Incremental beyond Phases 1 and 2.",
    conventional_vehicle_hours: 2_236,
    service_days_per_week: 7,
    added_hours_per_day: 4,
    conventional_buses_operating: 4,
    mobility_transit_included: true,
    mobility_transit_vehicle_hours: null,
    gross_cost_low_cad: 330_000,
    gross_cost_high_cad: 395_000,
    target_boardings_per_vehicle_hour: 8,
    fare_contribution_low_cad: 1.5,
    fare_contribution_high_cad: 2,
    evidence_classifications: { service: "Campaign planning assumption", cost: "Campaign planning assumption", mobility: "Quotation or operating data required", ridership: "Campaign planning assumption", fare: "Campaign planning assumption" }
  },
  {
    id: "phase4",
    label: "Phase 4 · through midnight",
    description: "Add service from 10 p.m. to midnight, with equivalent Mobility Transit availability.",
    included_description: "Incremental beyond Phases 1 through 3.",
    conventional_vehicle_hours: 1_413,
    service_days_per_week: 7,
    added_hours_per_day: 2,
    conventional_buses_operating: 4,
    mobility_transit_included: true,
    mobility_transit_vehicle_hours: null,
    gross_cost_low_cad: 210_000,
    gross_cost_high_cad: 255_000,
    target_boardings_per_vehicle_hour: 6,
    fare_contribution_low_cad: 1.5,
    fare_contribution_high_cad: 2,
    evidence_classifications: { service: "Campaign planning assumption", cost: "Campaign planning assumption", mobility: "Quotation or operating data required", ridership: "Campaign planning assumption", fare: "Campaign planning assumption" }
  }
];

const phaseOrder = DEFAULT_TRANSIT_PHASES.map((phase) => phase.id);
const numeric = (value: unknown, fallback = 0): number => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round = (value: number): number => Number(value.toFixed(6));

function phaseWithOverride(phase: TransitPhase, override: Partial<TransitPhase> | undefined): TransitPhase {
  return {...phase, ...(override ?? {})};
}

function phaseCalculation(phase: TransitPhase, fareScenario: TransitFareScenario) {
  const derivedVehicleHours = phase.service_days_per_week * phase.added_hours_per_day * phase.conventional_buses_operating * TRANSIT_DAYS_PER_YEAR;
  const vehicleHours = phase.conventional_vehicle_hours > 0 ? phase.conventional_vehicle_hours : derivedVehicleHours;
  const boardings = vehicleHours * phase.target_boardings_per_vehicle_hour;
  const fareLow = fareScenario === "existing_fares" ? boardings * phase.fare_contribution_low_cad : 0;
  const fareHigh = fareScenario === "existing_fares" ? boardings * phase.fare_contribution_high_cad : 0;
  return {
    phase_id: phase.id,
    label: phase.label,
    description: phase.description,
    included_description: phase.included_description,
    conventional_vehicle_hours: round(vehicleHours),
    derived_vehicle_hours: round(derivedVehicleHours),
    mobility_transit_included: phase.mobility_transit_included,
    mobility_transit_vehicle_hours: phase.mobility_transit_vehicle_hours,
    gross_cost_low_cad: round(phase.gross_cost_low_cad),
    gross_cost_high_cad: round(phase.gross_cost_high_cad),
    target_boardings_per_vehicle_hour: phase.target_boardings_per_vehicle_hour,
    incremental_boardings: round(boardings),
    fare_revenue_low_cad: round(fareLow),
    fare_revenue_high_cad: round(fareHigh),
    fare_contribution_low_cad: phase.fare_contribution_low_cad,
    fare_contribution_high_cad: phase.fare_contribution_high_cad,
    evidence_classifications: phase.evidence_classifications
  };
}

function cumulativeRow(incrementalRows: ReturnType<typeof phaseCalculation>[], throughIndex: number, options: { fareScenario: TransitFareScenario; funding: Required<TransitFunding>; denominator: number; baselineFareRevenue: number }) {
  const rows = incrementalRows.slice(0, throughIndex + 1);
  const sum = (field: keyof ReturnType<typeof phaseCalculation>) => rows.reduce((total, row) => total + numeric(row[field]), 0);
  const grossLow = sum("gross_cost_low_cad");
  const grossHigh = sum("gross_cost_high_cad");
  const boardings = sum("incremental_boardings");
  const fareLow = options.fareScenario === "existing_fares" ? sum("fare_revenue_low_cad") : 0;
  const fareHigh = options.fareScenario === "existing_fares" ? sum("fare_revenue_high_cad") : 0;
  const baselineFareLoss = options.fareScenario === "entire_system_fare_free" ? options.baselineFareRevenue : 0;
  const recurringFunding = Object.values(options.funding).reduce((total, value) => total + numeric(value), 0);
  const rawLow = grossLow - fareHigh - recurringFunding + baselineFareLoss;
  const rawHigh = grossHigh - fareLow - recurringFunding + baselineFareLoss;
  const netLow = Math.max(0, rawLow);
  const netHigh = Math.max(0, rawHigh);
  return {
    through_phase_id: rows.at(-1)?.phase_id,
    through_phase_label: rows.at(-1)?.label,
    conventional_vehicle_hours: round(sum("conventional_vehicle_hours")),
    gross_cost_low_cad: round(grossLow),
    gross_cost_high_cad: round(grossHigh),
    incremental_boardings: round(boardings),
    fare_revenue_low_cad: round(fareLow),
    fare_revenue_high_cad: round(fareHigh),
    baseline_fare_revenue_lost_cad: round(baselineFareLoss),
    recurring_funding_cad: round(recurringFunding),
    raw_net_municipal_cost_low_cad: round(rawLow),
    raw_net_municipal_cost_high_cad: round(rawHigh),
    net_municipal_cost_low_cad: round(netLow),
    net_municipal_cost_high_cad: round(netHigh),
    recurring_funding_excess_low_cad: round(Math.max(0, -rawLow)),
    recurring_funding_excess_high_cad: round(Math.max(0, -rawHigh)),
    household_equivalent_low_cad: round(netLow / Math.max(1, options.denominator)),
    household_equivalent_high_cad: round(netHigh / Math.max(1, options.denominator)),
    household_equivalent_denominator: options.denominator,
    one_time_capital_grants_or_reserves_cad: round(numeric(options.funding.one_time_capital_grants_or_reserves_cad))
  };
}

export function calculateTransitCostModel(options: {
  through_phase_id?: string;
  fare_scenario?: TransitFareScenario;
  phase_overrides?: Record<string, Partial<TransitPhase>>;
  funding?: TransitFunding;
  household_equivalent_denominator?: number;
  existing_system_fare_revenue_cad?: number;
} = {}) {
  const fareScenario = options.fare_scenario ?? "existing_fares";
  const funding: Required<TransitFunding> = {
    recurring_operating_grants_cad: numeric(options.funding?.recurring_operating_grants_cad),
    recurring_city_budget_savings_cad: numeric(options.funding?.recurring_city_budget_savings_cad),
    recurring_transit_transition_savings_cad: numeric(options.funding?.recurring_transit_transition_savings_cad),
    other_recurring_revenue_cad: numeric(options.funding?.other_recurring_revenue_cad),
    one_time_capital_grants_or_reserves_cad: numeric(options.funding?.one_time_capital_grants_or_reserves_cad)
  };
  const phases = DEFAULT_TRANSIT_PHASES.map((phase) => phaseWithOverride(phase, options.phase_overrides?.[phase.id]));
  const incrementalRows = phases.map((phase) => phaseCalculation(phase, fareScenario));
  const throughIndex = Math.max(0, phaseOrder.indexOf(options.through_phase_id ?? "phase1"));
  const cumulativeRows = phases.map((_, index) => cumulativeRow(incrementalRows, index, {
    fareScenario,
    funding,
    denominator: numeric(options.household_equivalent_denominator, 10_000),
    baselineFareRevenue: numeric(options.existing_system_fare_revenue_cad, TRANSIT_BASELINE.transit_revenue_cad)
  }));
  const selected = cumulativeRows[throughIndex];
  return {
    contract_version: OWEN_SOUND_TRANSIT_COST_CONTRACT_VERSION,
    last_updated: "2026-09-02",
    baseline: TRANSIT_BASELINE,
    phases: incrementalRows,
    cumulative: cumulativeRows,
    selected,
    selected_phase_id: phases[throughIndex]?.id,
    fare_scenario: fareScenario,
    funding,
    assumptions: {
      annual_days_basis: TRANSIT_DAYS_PER_YEAR,
      cumulative_funding_applied_once: true,
      range_pairing: "low municipal cost uses high fare revenue; high municipal cost uses low fare revenue",
      mobility_transit: "Equivalent Mobility Transit availability is included in each phase's gross planning range; separate vehicle-hour requirements remain quotation or operating data required.",
      household_equivalent: "Net municipal funding requirement divided by an adjustable household-equivalent denominator; this is not an equal property-tax bill.",
      input_evidence_classifications: TRANSIT_INPUT_EVIDENCE_CLASSIFICATIONS
    },
    sources: TRANSIT_SOURCES,
    fare_scenarios: {
      existing_fares: {label: "Existing fares continue", description: "Added conventional boardings contribute the selected fare yield."},
      added_service_fare_free: {label: "Added evening service is fare-free", description: "Existing daytime fares continue; added service contributes no fare revenue."},
      entire_system_fare_free: {label: "Entire local system is fare-free", description: "The adjustable existing fare/pass revenue is treated as revenue that must be replaced, in addition to gross added service cost."}
    }
  };
}

export function calculatePhase1BoardingSensitivity(options: { fare_scenario?: TransitFareScenario; fare_contribution_cad?: number; gross_cost_cad?: number } = {}) {
  return [4, 6, 8, 10, 12].map((boardingsPerHour) => {
    const model = calculateTransitCostModel({
      through_phase_id: "phase1",
      fare_scenario: options.fare_scenario ?? "existing_fares",
      phase_overrides: { phase1: { target_boardings_per_vehicle_hour: boardingsPerHour, ...(options.fare_contribution_cad == null ? {} : {fare_contribution_low_cad: options.fare_contribution_cad, fare_contribution_high_cad: options.fare_contribution_cad}), ...(options.gross_cost_cad == null ? {} : {gross_cost_low_cad: options.gross_cost_cad, gross_cost_high_cad: options.gross_cost_cad}) } }
    });
    return { boardings_per_vehicle_hour: boardingsPerHour, ...model.selected };
  });
}

export const transitCostEvidenceClassification = {
  official_figure: "Official figure",
  derived_from_official: "Derived from official figures",
  campaign_assumption: "Campaign planning assumption",
  quotation_required: "Quotation or operating data required"
} as const;
