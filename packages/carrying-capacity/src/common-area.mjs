/**
 * Geometry-only prototype for the shared ARC access and central common area.
 *
 * This is deliberately a conceptual site-plan takeoff, not a municipal or
 * fire-access standard. Productive vegetation beside the access corridor is
 * assigned to adjoining household leases and is therefore excluded here.
 */
export const ARC_COMMON_AREA_GEOMETRY_CONTRACT_VERSION = '1.0.0';

export const DEFAULT_ARC_COMMON_AREA_GEOMETRY = Object.freeze({
  mode: 'arc_lane_loop_amenity_prototype',
  laneway_length_m: 50,
  travelled_lane_width_m: 4,
  shoulders_drainage_width_m: 2,
  emergency_clearance_width_m: 0,
  household_connection_count: 12,
  household_connection_length_m: 15,
  household_connection_width_m: 3,
  terminal_loop: {
    amenity_envelope_area_m2: 250,
    amenity_envelope_shape: 'circle',
    amenity_building_footprint_area_m2: 0,
    circulating_lane_width_m: 6
  },
  other_required_common_area_m2: 0,
  access_road_construction_scenario: 'basic_gravel',
  source: 'conceptual ARC common-area geometry prototype; site/fire/municipal validation required'
});

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const nonNegative = (value, fallback = 0) => Math.max(0, finite(value, fallback));
const round = (value, digits = 6) => Math.round(Number(value) * 10 ** digits) / 10 ** digits;
const areaToHa = (areaM2) => round(areaM2 / 10000, 6);
const valueOf = (object, snake, camel, fallback) => object?.[snake] ?? object?.[camel] ?? fallback;

/**
 * Calculate the non-productive common-property geometry for an ARC prototype.
 * All dimensions are metres and all areas are square metres unless labelled ha.
 */
export function calculateArcCommonAreaGeometry(options = {}) {
  const source = options.geometry ?? options;
  const loop = source.terminal_loop ?? source.terminalLoop ?? {};
  const lanewayLength = nonNegative(valueOf(source, 'laneway_length_m', 'lanewayLengthM', DEFAULT_ARC_COMMON_AREA_GEOMETRY.laneway_length_m));
  const travelledWidth = nonNegative(valueOf(source, 'travelled_lane_width_m', 'travelledLaneWidthM', DEFAULT_ARC_COMMON_AREA_GEOMETRY.travelled_lane_width_m));
  const shouldersWidth = nonNegative(valueOf(source, 'shoulders_drainage_width_m', 'shouldersDrainageWidthM', DEFAULT_ARC_COMMON_AREA_GEOMETRY.shoulders_drainage_width_m));
  const emergencyWidth = nonNegative(valueOf(source, 'emergency_clearance_width_m', 'emergencyClearanceWidthM', DEFAULT_ARC_COMMON_AREA_GEOMETRY.emergency_clearance_width_m));
  const corridorWidth = travelledWidth + shouldersWidth + emergencyWidth;
  const lanewayCorridorArea = lanewayLength * corridorWidth;
  const travelledSurfaceArea = lanewayLength * travelledWidth;

  const amenityArea = nonNegative(valueOf(loop, 'amenity_envelope_area_m2', 'amenityEnvelopeAreaM2', DEFAULT_ARC_COMMON_AREA_GEOMETRY.terminal_loop.amenity_envelope_area_m2));
  const shape = valueOf(loop, 'amenity_envelope_shape', 'amenityEnvelopeShape', DEFAULT_ARC_COMMON_AREA_GEOMETRY.terminal_loop.amenity_envelope_shape);
  if (shape !== 'circle') throw new Error(`Unsupported ARC amenity envelope shape: ${shape}; use circle for the current prototype`);
  const explicitInnerRadius = valueOf(loop, 'inner_radius_m', 'innerRadiusM', null);
  const innerRadius = explicitInnerRadius == null ? Math.sqrt(amenityArea / Math.PI) : nonNegative(explicitInnerRadius);
  const effectiveAmenityArea = explicitInnerRadius == null ? amenityArea : Math.PI * innerRadius ** 2;
  const circulatingWidth = nonNegative(valueOf(loop, 'circulating_lane_width_m', 'circulatingLaneWidthM', DEFAULT_ARC_COMMON_AREA_GEOMETRY.terminal_loop.circulating_lane_width_m));
  const outerRadius = innerRadius + circulatingWidth;
  const terminalCirculationArea = Math.PI * (outerRadius ** 2 - innerRadius ** 2);
  const buildingFootprint = Math.min(effectiveAmenityArea, nonNegative(valueOf(loop, 'amenity_building_footprint_area_m2', 'amenityBuildingFootprintAreaM2', DEFAULT_ARC_COMMON_AREA_GEOMETRY.terminal_loop.amenity_building_footprint_area_m2)));
  const otherRequiredArea = nonNegative(valueOf(source, 'other_required_common_area_m2', 'otherRequiredCommonAreaM2', DEFAULT_ARC_COMMON_AREA_GEOMETRY.other_required_common_area_m2));

  const connectionCount = Math.round(nonNegative(valueOf(source, 'household_connection_count', 'householdConnectionCount', DEFAULT_ARC_COMMON_AREA_GEOMETRY.household_connection_count)));
  const connectionLength = nonNegative(valueOf(source, 'household_connection_length_m', 'householdConnectionLengthM', DEFAULT_ARC_COMMON_AREA_GEOMETRY.household_connection_length_m));
  const connectionWidth = nonNegative(valueOf(source, 'household_connection_width_m', 'householdConnectionWidthM', DEFAULT_ARC_COMMON_AREA_GEOMETRY.household_connection_width_m));
  const householdConnectionArea = connectionCount * connectionLength * connectionWidth;
  const terminalTotalArea = terminalCirculationArea + effectiveAmenityArea;
  const totalCommonArea = lanewayCorridorArea + terminalTotalArea + otherRequiredArea;

  return {
    contract_version: ARC_COMMON_AREA_GEOMETRY_CONTRACT_VERSION,
    mode: valueOf(source, 'mode', 'mode', DEFAULT_ARC_COMMON_AREA_GEOMETRY.mode),
    source: valueOf(source, 'source', 'source', DEFAULT_ARC_COMMON_AREA_GEOMETRY.source),
    access_road_construction_scenario: valueOf(source, 'access_road_construction_scenario', 'accessRoadConstructionScenario', DEFAULT_ARC_COMMON_AREA_GEOMETRY.access_road_construction_scenario),
    inputs: {
      laneway_length_m: round(lanewayLength),
      travelled_lane_width_m: round(travelledWidth),
      shoulders_drainage_width_m: round(shouldersWidth),
      emergency_clearance_width_m: round(emergencyWidth),
      common_corridor_width_m: round(corridorWidth),
      household_connection_count: connectionCount,
      household_connection_length_m: round(connectionLength),
      household_connection_width_m: round(connectionWidth),
      amenity_envelope_area_m2: round(effectiveAmenityArea, 3),
      amenity_envelope_shape: shape,
      amenity_building_footprint_area_m2: round(buildingFootprint, 3),
      circulating_lane_width_m: round(circulatingWidth),
      other_required_common_area_m2: round(otherRequiredArea, 3)
    },
    laneway: {
      travelled_surface_area_m2: round(travelledSurfaceArea, 3),
      corridor_area_m2: round(lanewayCorridorArea, 3),
      corridor_area_ha: areaToHa(lanewayCorridorArea),
      productive_edge_treatment: 'excluded_from_common_property; assign adjoining thorny shrubs, trees, coppice, windbreaks and other productive/ecological strips to household leased sites outside vehicle clearances'
    },
    terminal_loop: {
      inner_radius_m: round(innerRadius, 3),
      circulating_lane_width_m: round(circulatingWidth, 3),
      outer_turning_radius_m: round(outerRadius, 3),
      circulation_lane_area_m2: round(terminalCirculationArea, 3),
      circulation_lane_area_ha: areaToHa(terminalCirculationArea),
      amenity_envelope_area_m2: round(effectiveAmenityArea, 3),
      amenity_envelope_area_ha: areaToHa(effectiveAmenityArea),
      amenity_building_footprint_area_m2: round(buildingFootprint, 3),
      total_terminal_loop_common_area_m2: round(terminalTotalArea, 3),
      total_terminal_loop_common_area_ha: areaToHa(terminalTotalArea),
      turnaround_validation_status: 'conceptual_only; validate geometry against municipality and fire-service requirements'
    },
    household_connections: {
      count: connectionCount,
      total_area_m2: round(householdConnectionArea, 3),
      total_area_ha: areaToHa(householdConnectionArea),
      accounting_treatment: 'excluded from common property; assigned to adjoining household leased sites and not added to common hectares'
    },
    other_required_common_area_m2: round(otherRequiredArea, 3),
    other_required_common_area_ha: areaToHa(otherRequiredArea),
    common_property_area_m2: round(totalCommonArea, 3),
    common_property_area_ha: areaToHa(totalCommonArea),
    common_area_components: {
      laneway_corridor_area_ha: areaToHa(lanewayCorridorArea),
      terminal_circulation_loop_area_ha: areaToHa(terminalCirculationArea),
      amenity_envelope_area_ha: areaToHa(effectiveAmenityArea),
      other_required_common_area_ha: areaToHa(otherRequiredArea)
    },
    notes: [
      'The central 250 m² envelope is common ground reserved for a future shared use; amenity-building capital is not included here.',
      'The loop radius is a transparent conceptual geometry, not an emergency-vehicle approval.',
      'Only the physical common access corridor is counted. Productive/permaculture strips outside required clearance remain in adjoining household allocations.',
      'The public-road connection, lane alignment, drainage, setbacks and fire access require parcel-specific site-plan validation.'
    ]
  };
}
