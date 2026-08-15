import arcDwellingCostEvidence from '../data/source/arc-dwelling-costs.json' with {type: 'json'};

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round = (value, digits = 2) => Math.round(finite(value) * 10 ** digits) / 10 ** digits;

export const ARC_DWELLING_COST_EVIDENCE = arcDwellingCostEvidence;
export const ARC_DWELLING_COST_CONTRACT_VERSION = arcDwellingCostEvidence.contract_version;
export const ARC_DWELLING_SERVICING_MODES = arcDwellingCostEvidence.servicing_modes;

function selectedBand(component, band) {
  return Math.max(0, finite(component.capital_cost_cad?.[band]));
}

function componentRows({band, servicingMode, componentOverrides = {}}) {
  const mode = ARC_DWELLING_SERVICING_MODES[servicingMode];
  if (!mode) throw new Error(`Unknown ARC dwelling servicing mode: ${servicingMode}`);
  const centralized = servicingMode === 'centralized_shared_services';
  return arcDwellingCostEvidence.components.map((component) => {
    const override = componentOverrides[component.id];
    const generic = servicingMode === 'generic_distributed_alternatives';
    const genericCost = component.id === 'water_plumbing_sanitation'
      ? 14000 + 16000
      : component.id === 'electrical' ? 12000 : selectedBand(component, band);
    const defaultCost = centralized && ['water_plumbing_sanitation', 'electrical'].includes(component.id)
      ? 0
      : generic ? genericCost : selectedBand(component, band);
    const capitalCost = override == null ? defaultCost : Math.max(0, finite(override));
    return {
      id: component.id,
      label: component.label,
      layer: centralized && ['water_plumbing_sanitation', 'electrical'].includes(component.id) ? 'shared_infrastructure' : component.layer,
      capital_cost_cad: round(capitalCost),
      cost_status: override == null ? component.cost_status : 'scenario_override',
      design_basis: component.design_basis,
      approval_note: component.approval_note ?? null,
      servicing_mode: servicingMode,
      included_once: capitalCost > 0
    };
  });
}

export function calculateArcDwellingCost({packageId = 'arc_low_cost_four_season', band = 'central', servicingMode = 'arc_household_systems', componentOverrides = {}} = {}) {
  if (packageId !== arcDwellingCostEvidence.package_id) throw new Error(`Unknown ARC dwelling package: ${packageId}`);
  if (!['low', 'central', 'high'].includes(band)) throw new Error(`Unknown ARC dwelling cost band: ${band}`);
  const rows = componentRows({band, servicingMode, componentOverrides});
  const residentRows = rows.filter((row) => row.layer === 'resident_dwelling');
  const sharedRows = rows.filter((row) => row.layer === 'shared_infrastructure');
  const total = rows.reduce((sum, row) => sum + row.capital_cost_cad, 0);
  const residentTotal = residentRows.reduce((sum, row) => sum + row.capital_cost_cad, 0);
  const sharedTotal = sharedRows.reduce((sum, row) => sum + row.capital_cost_cad, 0);
  const utilityIds = new Set(['water_plumbing_sanitation', 'hot_water', 'electrical']);
  const utilityTotal = rows.filter((row) => utilityIds.has(row.id)).reduce((sum, row) => sum + row.capital_cost_cad, 0);
  const requiredSystems = [
    {id: 'potable_water', label: 'Potable water collection, storage and treatment', component_id: 'water_plumbing_sanitation', requirement_status: 'site_approval_required'},
    {id: 'plumbing_and_bathing', label: 'Household plumbing, sink and private shower', component_id: 'water_plumbing_sanitation', requirement_status: 'building_design_required'},
    {id: 'sanitation_and_greywater', label: 'Sanitation and greywater handling', component_id: 'water_plumbing_sanitation', requirement_status: 'site_approval_required'},
    {id: 'hot_water', label: 'Domestic hot water', component_id: 'hot_water', requirement_status: 'building_design_required'},
    {id: 'household_electrical', label: 'Household electrical supply', component_id: 'electrical', requirement_status: 'code_and_safety_review_required'},
    {id: 'space_heating', label: 'Space-heating appliance/system', component_id: 'heating_system', requirement_status: 'building_design_required'}
  ].map((system) => ({...system, layer: rows.find((row) => row.id === system.component_id)?.layer ?? null, capital_cost_cad: rows.find((row) => row.id === system.component_id)?.capital_cost_cad ?? 0}));
  return {
    contract_version: ARC_DWELLING_COST_CONTRACT_VERSION,
    package_id: packageId,
    package_label: arcDwellingCostEvidence.title,
    band,
    servicing_mode: servicingMode,
    servicing_mode_label: ARC_DWELLING_SERVICING_MODES[servicingMode].label,
    components: rows,
    resident_dwelling_capital_cad: round(residentTotal),
    shared_infrastructure_capital_cad: round(sharedTotal),
    completed_dwelling_capital_cad: round(residentTotal),
    utility_package_capital_cad: round(utilityTotal),
    required_systems: requiredSystems,
    required_systems_have_single_accounting_home: requiredSystems.every((system) => Boolean(system.layer && system.component_id)),
    unpriced_required_systems: requiredSystems.filter((system) => system.layer === 'shared_infrastructure' && system.capital_cost_cad === 0).map((system) => ({...system, status: 'site_specific_shared_service_cost_required'})),
    required_system_costs_complete: requiredSystems.every((system) => system.capital_cost_cad > 0),
    total_component_capital_cad: round(total),
    component_sum_check: round(rows.reduce((sum, row) => sum + row.capital_cost_cad, 0)) === round(total),
    accounting_boundary: {
      resident_dwelling_components: residentRows.map((row) => row.id),
      shared_infrastructure_components: sharedRows.map((row) => row.id),
      excluded_from_this_model: ['household operating utilities', 'dwelling maintenance', 'insurance', 'land lease', 'shared infrastructure operating cost']
    },
    source_record: arcDwellingCostEvidence.source_record,
      notes: arcDwellingCostEvidence.accounting_rules
  };
}

export function buildArcDwellingPresentationContract() {
  const bands = Object.fromEntries(['low', 'central', 'high'].map((band) => [band, calculateArcDwellingCost({band})]));
  return {
    contract_version: ARC_DWELLING_COST_CONTRACT_VERSION,
    package_id: arcDwellingCostEvidence.package_id,
    title: arcDwellingCostEvidence.title,
    source_record: arcDwellingCostEvidence.source_record,
    servicing_modes: arcDwellingCostEvidence.servicing_modes,
    bands,
    completed_dwelling_range_cad: {
      low: bands.low.completed_dwelling_capital_cad,
      central: bands.central.completed_dwelling_capital_cad,
      high: bands.high.completed_dwelling_capital_cad
    },
    component_evidence: arcDwellingCostEvidence.components,
    generic_alternatives: arcDwellingCostEvidence.generic_alternatives,
    accounting_rules: arcDwellingCostEvidence.accounting_rules
  };
}
