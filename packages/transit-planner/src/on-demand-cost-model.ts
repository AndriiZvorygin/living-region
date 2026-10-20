/**
 * Owen Sound on-demand transit planning calculations.
 *
 * The hybrid window values are planning ranges supplied by the on-demand
 * research packet. The full-network view follows the companion calculation
 * script and keeps local service, regional contributions and fare revenue
 * visible as separate lines.
 */

export const ON_DEMAND_TRANSIT_CONTRACT_VERSION = "1.1.0";

export type OnDemandRange = {low: number; high: number};

export type OnDemandServiceWindow = {
  id: string;
  label: string;
  description: string;
  annual_vehicle_hours: number;
  gross_cost_cad: OnDemandRange;
  fare_revenue_cad: OnDemandRange;
  evidence_classification: string;
};

export const ON_DEMAND_TRANSIT_SOURCES = [
  {
    id: "on_demand_replacement_cost_model",
    title: "On-demand transit replacement cost model",
    url: "https://helpos.ca/mayor/assets/transit/on-demand-replacement-cost-model.md",
    classification: "Derived from research model",
    note: "Hybrid-window planning ranges and full-network arithmetic source."
  },
  {
    id: "grey_county_regional_transit_integration",
    title: "Grey County regional transit integration",
    url: "https://helpos.ca/mayor/assets/transit/grey-county-regional-transit-integration.md",
    classification: "Research context",
    note: "Separates Owen Sound local service from GTR, GOST and the developing regional network."
  },
  {
    id: "on_demand_calculation_script",
    title: "calculate_on_demand_transit_cost.mjs",
    url: "https://helpos.ca/mayor/assets/transit/calculate_on_demand_transit_cost.mjs",
    classification: "Calculation source",
    note: "Core-hour, on-demand-hour, overhead and fare arithmetic."
  }
] as const;

export const DEFAULT_ON_DEMAND_WINDOWS: OnDemandServiceWindow[] = [
  {
    id: "sunday_daytime",
    label: "Sunday daytime",
    description: "Approximately 9 a.m.–3 p.m.; connects with the terminal and retains accessible backup coverage.",
    annual_vehicle_hours: 624,
    gross_cost_cad: {low: 60_000, high: 75_000},
    fare_revenue_cad: {low: 5_000, high: 10_000},
    evidence_classification: "Campaign planning assumption"
  },
  {
    id: "weekday_evenings",
    label: "Weekday evenings",
    description: "Lower-demand evening coverage alongside the current daytime bus network.",
    annual_vehicle_hours: 2_600,
    gross_cost_cad: {low: 195_000, high: 195_000},
    fare_revenue_cad: {low: 35_000, high: 40_000},
    evidence_classification: "Campaign planning assumption"
  },
  {
    id: "saturday_daytime",
    label: "Saturday daytime",
    description: "Additional weekend daytime coverage with phone booking and accessible service retained.",
    annual_vehicle_hours: 410,
    gross_cost_cad: {low: 28_000, high: 28_000},
    fare_revenue_cad: {low: 10_000, high: 12_000},
    evidence_classification: "Campaign planning assumption"
  },
  {
    id: "saturday_evenings",
    label: "Saturday evenings",
    description: "Additional Saturday evening coverage, subject to driver supply and winter backup review.",
    annual_vehicle_hours: 365,
    gross_cost_cad: {low: 25_000, high: 25_000},
    fare_revenue_cad: {low: 8_000, high: 10_000},
    evidence_classification: "Campaign planning assumption"
  }
];

export const DEFAULT_ON_DEMAND_WINDOW_IDS = ["sunday_daytime", "weekday_evenings"] as const;

export const ON_DEMAND_NETWORK_ASSUMPTIONS = {
  baseline_vehicle_hours: 13_500,
  baseline_annual_fare_revenue_cad: 320_000,
  comparison_net_cost_cad: 1_180_000,
  core_hours_per_vehicle_year: 2_080,
  on_demand_rate_cad_per_hour: {low: 70, high: 84},
  accessible_core_rate_cad_per_hour: {low: 98.48, high: 118.18},
  dispatch_booking_support_cad: {low: 150_000, high: 250_000},
  insurance_vehicle_reserve_cad: {low: 100_000, high: 180_000},
  setup_cost_cad: {low: 25_000, high: 100_000},
  setup_amortization_years: 5,
  evidence_classification: "Campaign planning assumption"
} as const;

const finite = (value: unknown, fallback = 0): number => Number.isFinite(Number(value)) ? Number(value) : fallback;
const nonNegative = (value: unknown): number => Math.max(0, finite(value));
const round = (value: number): number => Number(value.toFixed(6));

function range(low: number, high: number): OnDemandRange {
  return {low: round(low), high: round(high)};
}
function netRange(gross: OnDemandRange, fares: OnDemandRange, recurringContribution = 0): OnDemandRange {
  return range(gross.low - fares.high - recurringContribution, gross.high - fares.low - recurringContribution);
}

export function calculateHybridOnDemandPilot(options: {
  selected_window_ids?: string[];
  household_equivalent_denominator?: number;
  regional_contribution_cad?: number;
  windows?: OnDemandServiceWindow[];
} = {}) {
  const windows = options.windows ?? DEFAULT_ON_DEMAND_WINDOWS;
  const selectedIds = new Set(options.selected_window_ids ?? DEFAULT_ON_DEMAND_WINDOW_IDS);
  const selectedWindows = windows.filter((window) => selectedIds.has(window.id));
  const totals = selectedWindows.reduce((sum, window) => ({
    hours: sum.hours + window.annual_vehicle_hours,
    gross: {low: sum.gross.low + window.gross_cost_cad.low, high: sum.gross.high + window.gross_cost_cad.high},
    fares: {low: sum.fares.low + window.fare_revenue_cad.low, high: sum.fares.high + window.fare_revenue_cad.high}
  }), {hours: 0, gross: {low: 0, high: 0}, fares: {low: 0, high: 0}});
  const regionalContribution = nonNegative(options.regional_contribution_cad);
  const net = netRange(totals.gross, totals.fares, regionalContribution);
  const denominator = Math.max(1, nonNegative(options.household_equivalent_denominator) || 10_000);
  const rows = selectedWindows.map((window) => ({
    ...window,
    net_cost_cad: netRange(window.gross_cost_cad, window.fare_revenue_cad)
  }));
  return {
    contract_version: ON_DEMAND_TRANSIT_CONTRACT_VERSION,
    mode: "hybrid_pilot" as const,
    selected_window_ids: selectedWindows.map((window) => window.id),
    selected_windows: rows,
    regional_contribution_cad: round(regionalContribution),
    selected: {
      annual_vehicle_hours: totals.hours,
      gross_cost_cad: range(totals.gross.low, totals.gross.high),
      fare_revenue_cad: range(totals.fares.low, totals.fares.high),
      net_cost_cad: net,
      net_cost_per_household_cad: range(net.low / denominator, net.high / denominator),
      household_equivalent_denominator: denominator
    },
    assumptions: {
      range_pairing: "low net cost uses low gross cost and high fare revenue; high net cost uses high gross cost and low fare revenue",
      regional_boundary: "Regional contributions are an optional separate input and are not included in the local window ranges.",
      operating_boundary: "The pilot runs alongside current fixed-route buses; its ranges are not added to the full-network replacement formula.",
      accessibility: "Phone booking, accessible trips, winter reliability and backup coverage require local operating design and quotation."
    },
    sources: ON_DEMAND_TRANSIT_SOURCES
  };
}

export function calculateOnDemandNetwork(options: {
  core_vehicle_count?: number;
  household_equivalent_denominator?: number;
  fare_revenue_cad?: number;
  regional_contribution_cad?: number;
  assumptions?: typeof ON_DEMAND_NETWORK_ASSUMPTIONS;
} = {}) {
  const assumptions = options.assumptions ?? ON_DEMAND_NETWORK_ASSUMPTIONS;
  const coreVehicleCount = Math.min(3, Math.max(1, Math.round(nonNegative(options.core_vehicle_count) || 1)));
  const coreHours = coreVehicleCount * assumptions.core_hours_per_vehicle_year;
  const onDemandHours = Math.max(0, assumptions.baseline_vehicle_hours - coreHours);
  const coreCost = range(coreHours * assumptions.accessible_core_rate_cad_per_hour.low, coreHours * assumptions.accessible_core_rate_cad_per_hour.high);
  const onDemandCost = range(onDemandHours * assumptions.on_demand_rate_cad_per_hour.low, onDemandHours * assumptions.on_demand_rate_cad_per_hour.high);
  const setupAnnual = range(assumptions.setup_cost_cad.low / assumptions.setup_amortization_years, assumptions.setup_cost_cad.high / assumptions.setup_amortization_years);
  const gross = range(
    coreCost.low + onDemandCost.low + setupAnnual.low + assumptions.dispatch_booking_support_cad.low + assumptions.insurance_vehicle_reserve_cad.low,
    coreCost.high + onDemandCost.high + setupAnnual.high + assumptions.dispatch_booking_support_cad.high + assumptions.insurance_vehicle_reserve_cad.high
  );
  const fareRevenue = nonNegative(options.fare_revenue_cad) || assumptions.baseline_annual_fare_revenue_cad;
  const regionalContribution = nonNegative(options.regional_contribution_cad);
  const net = range(gross.low - fareRevenue - regionalContribution, gross.high - fareRevenue - regionalContribution);
  const denominator = Math.max(1, nonNegative(options.household_equivalent_denominator) || 10_000);
  return {
    contract_version: ON_DEMAND_TRANSIT_CONTRACT_VERSION,
    mode: "network_comparison" as const,
    core_vehicle_count: coreVehicleCount,
    core_hours: coreHours,
    on_demand_hours: onDemandHours,
    baseline_vehicle_hours: assumptions.baseline_vehicle_hours,
    core_share: round(coreHours / assumptions.baseline_vehicle_hours),
    on_demand_share: round(onDemandHours / assumptions.baseline_vehicle_hours),
    cost_components: {core_vehicle_cost_cad: coreCost, on_demand_vehicle_cost_cad: onDemandCost, setup_annualized_cad: setupAnnual, dispatch_booking_support_cad: assumptions.dispatch_booking_support_cad, insurance_vehicle_reserve_cad: assumptions.insurance_vehicle_reserve_cad},
    fare_revenue_cad: range(fareRevenue, fareRevenue),
    regional_contribution_cad: round(regionalContribution),
    gross_cost_cad: gross,
    net_cost_cad: net,
    net_cost_per_household_cad: range(net.low / denominator, net.high / denominator),
    difference_from_current_net_cost_cad: range(net.low - assumptions.comparison_net_cost_cad, net.high - assumptions.comparison_net_cost_cad),
    household_equivalent_denominator: denominator,
    assumptions: {
      rate_basis: "On-demand $70–$84/hour; accessible core $98.48–$118.18/hour.",
      overhead: "Dispatch, phone booking, scheduling, administration, insurance and vehicle reserve are visible annual allowances.",
      setup: `One-time setup is annualized over ${assumptions.setup_amortization_years} years for comparison; it is not a permanent operating cost.`,
      fare_basis: "Held-constant $320,000 annual fare revenue from the research script; update with current local fare/pass data.",
      driver_supply: "Drivers are paid, screened and trained; availability and backup coverage remain quotation or operating data required.",
      regional_boundary: "Regional service and any regional contribution are separate from the Owen Sound local operating envelope.",
      planning_status: "Planning estimate, not a promised saving or approved operating budget."
    },
    sources: ON_DEMAND_TRANSIT_SOURCES
  };
}
