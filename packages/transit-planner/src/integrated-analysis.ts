import { calculateCoverage, distanceMetres, nearestNode, type Destination, type GeoCollection, type Position, type RoutedPath, type Stop, type StreetGraph } from "./index";
import type { BicycleStress } from "./bicycle-analysis";
import type { CityElevationModel, ElevationProfile } from "./city-elevation";

export type IntegratedRoute = {
  id: string;
  title: string;
  path: RoutedPath;
  stops: Stop[];
  buses: number;
  service_hours: number;
  expected_cycle_minutes: number;
  adverse_cycle_minutes: number;
  direct_destination_ids: string[];
};

export type CostProfile = {
  id: string;
  title: string;
  driver_compensation_per_vehicle_hour: number;
  vehicle_operation_per_km: number;
  administration_per_vehicle_hour: number;
  fuel_per_km: number;
  maintenance_per_km: number;
  insurance_per_vehicle_annual: number;
  capital_replacement_per_km: number;
};

type ScenarioDefinition = { id: string; title: string; routes: IntegratedRoute[]; active_buses: number; evening_minibus: boolean; additional_vehicle_requirement?: number };

function annualCost(profile: CostProfile, vehicleHours: number, vehicleKm: number, vehicles: number) {
  const components = {
    direct_driver_compensation: vehicleHours * profile.driver_compensation_per_vehicle_hour,
    vehicle_operation: vehicleKm * profile.vehicle_operation_per_km,
    administration: vehicleHours * profile.administration_per_vehicle_hour,
    fuel: vehicleKm * profile.fuel_per_km,
    maintenance: vehicleKm * profile.maintenance_per_km,
    insurance: vehicles * profile.insurance_per_vehicle_annual,
    capital_replacement: vehicleKm * profile.capital_replacement_per_km
  };
  return { profile_id: profile.id, components: Object.fromEntries(Object.entries(components).map(([key, value]) => [key, Number(value.toFixed(0))])), total: Number(Object.values(components).reduce((sum, value) => sum + value, 0).toFixed(0)) };
}

function pathFeature(route: IntegratedRoute, scenarioId: string) {
  return { type: "Feature" as const, properties: { scenario_id: scenarioId, route_id: route.id, title: route.title, buses: route.buses, expected_cycle_minutes: route.expected_cycle_minutes, adverse_cycle_minutes: route.adverse_cycle_minutes }, geometry: { type: "LineString", coordinates: route.path.coordinates } };
}

export function buildIntegratedScenarios(definitions: ScenarioDefinition[], walkingGraph: StreetGraph, population: GeoCollection, walkingThresholds: number[], bicycleCoverage: Record<string, any>, costProfiles: CostProfile[], serviceDays = 360) {
  const scenarioGeo: Record<string, GeoCollection> = {};
  const rows = definitions.map((scenario) => {
    const stops = [...new Map(scenario.routes.flatMap((route) => route.stops).map((stop) => [`${stop.lon.toFixed(6)}:${stop.lat.toFixed(6)}`, stop])).values()];
    const coverage = calculateCoverage(population, walkingGraph, stops, walkingThresholds, 180);
    const dailyHours = scenario.routes.reduce((sum, route) => sum + route.buses * route.service_hours, 0);
    const dailyKm = scenario.routes.reduce((sum, route) => sum + route.buses * route.service_hours * (route.path.distance_m / 1000) / Math.max(0.1, route.expected_cycle_minutes / 60), 0);
    const annualHours = dailyHours * serviceDays;
    const annualKm = dailyKm * serviceDays;
    const costs = costProfiles.map((profile) => annualCost(profile, annualHours, annualKm, scenario.active_buses));
    const eveningRoutes = scenario.routes.filter((route) => route.id.includes("evening-minibus"));
    const eveningHours = eveningRoutes.reduce((sum, route) => sum + route.buses * route.service_hours, 0) * serviceDays;
    const eveningKm = eveningRoutes.reduce((sum, route) => sum + route.buses * route.service_hours * (route.path.distance_m / 1000) / Math.max(0.1, route.expected_cycle_minutes / 60), 0) * serviceDays;
    const minibusProfile = costProfiles.find((profile) => profile.id === "accessible_evening_minibus");
    const eveningMarginal = minibusProfile && eveningRoutes.length ? annualCost(minibusProfile, eveningHours, eveningKm, 1) : null;
    const direct = [...new Set(scenario.routes.flatMap((route) => route.direct_destination_ids))];
    const percent = (value: number, total: number) => Number((value / Math.max(1, total) * 100).toFixed(1));
    const cityPeople = coverage.totals.population;
    const cityDwellings = coverage.totals.dwellings;
    const worstRecovery = Math.min(...scenario.routes.map((route) => 30 - route.adverse_cycle_minutes));
    const expectedRecovery = Math.min(...scenario.routes.map((route) => 30 - route.expected_cycle_minutes));
    scenarioGeo[scenario.id] = { type: "FeatureCollection", features: scenario.routes.map((route) => pathFeature(route, scenario.id)) };
    return {
      scenario_id: scenario.id,
      title: scenario.title,
      active_buses: scenario.active_buses,
      additional_vehicle_requirement: scenario.additional_vehicle_requirement ?? Math.max(0, scenario.active_buses - 4),
      evening_minibus: scenario.evening_minibus,
      people_300m_walk: coverage.network["300"].population,
      dwellings_300m_walk: coverage.network["300"].dwellings,
      percentage_of_city_population_300m_walk: percent(coverage.network["300"].population, cityPeople),
      percentage_of_city_dwellings_300m_walk: percent(coverage.network["300"].dwellings, cityDwellings),
      people_400m_walk: coverage.network["400"].population,
      dwellings_400m_walk: coverage.network["400"].dwellings,
      percentage_of_city_population_400m_walk: percent(coverage.network["400"].population, cityPeople),
      percentage_of_city_dwellings_400m_walk: percent(coverage.network["400"].dwellings, cityDwellings),
      people_600m_walk: coverage.network["600"].population,
      dwellings_600m_walk: coverage.network["600"].dwellings,
      percentage_of_city_population_600m_walk: percent(coverage.network["600"].population, cityPeople),
      percentage_of_city_dwellings_600m_walk: percent(coverage.network["600"].dwellings, cityDwellings),
      people_1km_comfortable_cycle: bicycleCoverage.comfortable_only["1000"].population,
      dwellings_1km_comfortable_cycle: bicycleCoverage.comfortable_only["1000"].dwellings,
      percentage_of_city_population_1km_comfortable_cycle: percent(bicycleCoverage.comfortable_only["1000"].population, cityPeople),
      percentage_of_city_dwellings_1km_comfortable_cycle: percent(bicycleCoverage.comfortable_only["1000"].dwellings, cityDwellings),
      people_2km_comfortable_cycle: bicycleCoverage.comfortable_only["2000"].population,
      dwellings_2km_comfortable_cycle: bicycleCoverage.comfortable_only["2000"].dwellings,
      percentage_of_city_population_2km_comfortable_cycle: percent(bicycleCoverage.comfortable_only["2000"].population, cityPeople),
      percentage_of_city_dwellings_2km_comfortable_cycle: percent(bicycleCoverage.comfortable_only["2000"].dwellings, cityDwellings),
      people_3km_comfortable_cycle: bicycleCoverage.comfortable_only["3000"].population,
      dwellings_3km_comfortable_cycle: bicycleCoverage.comfortable_only["3000"].dwellings,
      percentage_of_city_population_3km_comfortable_cycle: percent(bicycleCoverage.comfortable_only["3000"].population, cityPeople),
      percentage_of_city_dwellings_3km_comfortable_cycle: percent(bicycleCoverage.comfortable_only["3000"].dwellings, cityDwellings),
      people_1km_connecting_cycle: bicycleCoverage.comfortable_plus_connecting["1000"].population,
      dwellings_1km_connecting_cycle: bicycleCoverage.comfortable_plus_connecting["1000"].dwellings,
      percentage_of_city_population_1km_connecting_cycle: percent(bicycleCoverage.comfortable_plus_connecting["1000"].population, cityPeople),
      percentage_of_city_dwellings_1km_connecting_cycle: percent(bicycleCoverage.comfortable_plus_connecting["1000"].dwellings, cityDwellings),
      people_2km_connecting_cycle: bicycleCoverage.comfortable_plus_connecting["2000"].population,
      dwellings_2km_connecting_cycle: bicycleCoverage.comfortable_plus_connecting["2000"].dwellings,
      percentage_of_city_population_2km_connecting_cycle: percent(bicycleCoverage.comfortable_plus_connecting["2000"].population, cityPeople),
      percentage_of_city_dwellings_2km_connecting_cycle: percent(bicycleCoverage.comfortable_plus_connecting["2000"].dwellings, cityDwellings),
      people_3km_connecting_cycle: bicycleCoverage.comfortable_plus_connecting["3000"].population,
      dwellings_3km_connecting_cycle: bicycleCoverage.comfortable_plus_connecting["3000"].dwellings,
      percentage_of_city_population_3km_connecting_cycle: percent(bicycleCoverage.comfortable_plus_connecting["3000"].population, cityPeople),
      percentage_of_city_dwellings_3km_connecting_cycle: percent(bicycleCoverage.comfortable_plus_connecting["3000"].dwellings, cityDwellings),
      major_destinations_served_directly: direct,
      expected_wait_minutes: 12.5,
      transfers_required_model: "Representative neighbourhood-to-major-destination journeys may require one transfer; see multimodal-journeys.csv.",
      daily_vehicle_hours: Number(dailyHours.toFixed(1)),
      daily_vehicle_km: Number(dailyKm.toFixed(1)),
      annual_vehicle_hours: Number(annualHours.toFixed(0)),
      annual_vehicle_km: Number(annualKm.toFixed(0)),
      expected_recovery_minutes: Number(expectedRecovery.toFixed(1)),
      adverse_recovery_minutes: Number(worstRecovery.toFixed(1)),
      reliability_risk: worstRecovery < 0 ? "high_schedule_does_not_fit" : worstRecovery < 2 ? "elevated_low_recovery" : "moderate_or_better",
      annual_costs: costs,
      annual_operating_cost_low: Math.min(...costs.filter((cost) => cost.profile_id !== "accessible_evening_minibus").map((cost) => cost.total)),
      annual_operating_cost_high: Math.max(...costs.filter((cost) => cost.profile_id !== "accessible_evening_minibus").map((cost) => cost.total)),
      evening_minibus_marginal_annual_cost: eveningMarginal,
      bicycle_rack_requirement: scenario.active_buses * 2,
      future_three_bicycle_rack_capacity: scenario.active_buses * 3,
      secure_parking_priority_locations: 5
    };
  });
  return { rows, scenarioGeo };
}

function largestComponent(graph: StreetGraph): Set<number> {
  const remaining = new Set(graph.nodes.map((node) => node.id));
  let largest = new Set<number>();
  while (remaining.size) {
    const seed = remaining.values().next().value as number;
    const component = new Set<number>();
    const queue = [seed];
    remaining.delete(seed);
    while (queue.length) {
      const node = queue.pop()!;
      component.add(node);
      for (const edgeId of graph.nodes[node].edges) {
        const next = graph.edges[edgeId].to;
        if (remaining.delete(next)) queue.push(next);
      }
    }
    if (component.size > largest.size) largest = component;
  }
  return largest;
}

function nearestIn(graph: StreetGraph, point: Position, allowed: Set<number>, maximum = 1_000) {
  let best: { node: number; distance_m: number } | undefined;
  for (const id of allowed) {
    const node = graph.nodes[id];
    const distance = distanceMetres(point, [node.lon, node.lat]);
    if (distance <= maximum && (!best || distance < best.distance_m)) best = { node: id, distance_m: distance };
  }
  return best;
}

function shortestDistance(graph: StreetGraph, from: Position, to: Position, allowed: Set<number>, stresses?: BicycleStress[], maximumLts = 4) {
  const start = nearestIn(graph, from, allowed);
  const finish = nearestIn(graph, to, allowed);
  if (!start || !finish) return undefined;
  const costs = Array(graph.nodes.length).fill(Infinity);
  const previous = new Map<number, number>();
  const queue = [{ node: start.node, cost: start.distance_m }];
  costs[start.node] = start.distance_m;
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;
    if (current.cost !== costs[current.node]) continue;
    if (current.node === finish.node) break;
    for (const edgeId of graph.nodes[current.node].edges) {
      if (stresses && stresses[edgeId]?.lts > maximumLts) continue;
      const edge = graph.edges[edgeId];
      const next = current.cost + edge.length_m;
      if (next >= costs[edge.to]) continue;
      costs[edge.to] = next;
      previous.set(edge.to, edgeId);
      queue.push({ node: edge.to, cost: next });
    }
  }
  if (!Number.isFinite(costs[finish.node])) return undefined;
  const edges: number[] = [];
  for (let node = finish.node; node !== start.node;) {
    const edge = previous.get(node);
    if (edge == null) break;
    edges.push(edge);
    node = graph.edges[edge].from;
  }
  edges.reverse();
  const coordinates: Position[] = [from];
  edges.forEach((edge) => coordinates.push(graph.edges[edge].coordinates.at(-1) as Position));
  coordinates.push(to);
  return { distance_m: costs[finish.node] + finish.distance_m, coordinates };
}

export function buildMultimodalJourneys(walkingGraph: StreetGraph, bicycleGraph: StreetGraph, bicycleStresses: BicycleStress[], loopStops: Stop[], destinations: Destination[], elevation?: CityElevationModel) {
  const walkingComponent = largestComponent(walkingGraph);
  const bicycleComponent = largestComponent(bicycleGraph);
  const origins = [
    { id: "west_hill", name: "West Hill", point: [-80.967, 44.565] as Position },
    { id: "brooke", name: "Brooke", point: [-80.951, 44.589] as Position },
    { id: "downtown", name: "Downtown", point: [-80.943, 44.568] as Position },
    { id: "east_hill", name: "East Hill", point: [-80.916, 44.568] as Position },
    { id: "south", name: "South Owen Sound", point: [-80.941, 44.548] as Position },
    { id: "north", name: "Northern neighbourhoods", point: [-80.939, 44.591] as Position }
  ];
  const destinationIds = ["osdss", "downtown_terminal", "georgian_college", "brightshores_hospital", "heritage_place", "retail_16th_12th"];
  const selectedDestinations = destinations.filter((destination) => destinationIds.includes(destination.id));
  const rows: Record<string, unknown>[] = [];
  const features: GeoCollection["features"] = [];
  for (const origin of origins) for (const destination of selectedDestinations) {
    const to: Position = [destination.lon, destination.lat];
    const walking = shortestDistance(walkingGraph, origin.point, to, walkingComponent);
    const bicycleAll = shortestDistance(bicycleGraph, origin.point, to, bicycleComponent, bicycleStresses, 4);
    const bicycleConnecting = shortestDistance(bicycleGraph, origin.point, to, bicycleComponent, bicycleStresses, 3);
    const bicycleComfort = shortestDistance(bicycleGraph, origin.point, to, bicycleComponent, bicycleStresses, 2);
    const originStop = [...loopStops].sort((a, b) => distanceMetres(origin.point, [a.lon, a.lat]) - distanceMetres(origin.point, [b.lon, b.lat]))[0];
    const destinationStop = [...loopStops].sort((a, b) => distanceMetres(to, [a.lon, a.lat]) - distanceMetres(to, [b.lon, b.lat]))[0];
    const accessWalk = shortestDistance(walkingGraph, origin.point, [originStop.lon, originStop.lat], walkingComponent);
    const egressWalk = shortestDistance(walkingGraph, [destinationStop.lon, destinationStop.lat], to, walkingComponent);
    const accessBike = shortestDistance(bicycleGraph, origin.point, [originStop.lon, originStop.lat], bicycleComponent, bicycleStresses, 3);
    const egressBike = shortestDistance(bicycleGraph, [destinationStop.lon, destinationStop.lat], to, bicycleComponent, bicycleStresses, 3);
    const stopDifference = Math.abs(loopStops.indexOf(originStop) - loopStops.indexOf(destinationStop));
    const busMinutes = Math.min(stopDifference, loopStops.length - stopDifference) / Math.max(1, loopStops.length) * 25;
    const wholeProfile = bicycleAll && elevation ? elevation.profile(bicycleAll.coordinates) : undefined;
    const accessProfile = accessBike && elevation ? elevation.profile(accessBike.coordinates) : undefined;
    const egressProfile = egressBike && elevation ? elevation.profile(egressBike.coordinates) : undefined;
    const bikeBusProfile: ElevationProfile | undefined = accessProfile && egressProfile ? { elevation_gain_m: +(accessProfile.elevation_gain_m + egressProfile.elevation_gain_m).toFixed(1), descent_m: +(accessProfile.descent_m + egressProfile.descent_m).toFixed(1), maximum_segment_grade_percent: Math.max(accessProfile.maximum_segment_grade_percent, egressProfile.maximum_segment_grade_percent), raw_maximum_segment_grade_percent: Math.max(accessProfile.raw_maximum_segment_grade_percent, egressProfile.raw_maximum_segment_grade_percent), start_elevation_m: accessProfile.start_elevation_m, end_elevation_m: egressProfile.end_elevation_m, quality_flags: [...new Set([...accessProfile.quality_flags, ...egressProfile.quality_flags])] } : undefined;
    const reduction = wholeProfile && bikeBusProfile ? +(wholeProfile.elevation_gain_m - bikeBusProfile.elevation_gain_m).toFixed(1) : null;
    const base = { origin_id: origin.id, origin: origin.name, destination_id: destination.id, destination: destination.name, elevation_status: elevation ? "interim_open_meteo_copernicus_dem90" : "unavailable_no_validated_city_dem" };
    const add = (mode: string, total: number | null, wait: number, cycle: number, walk: number, transfers: number, comfort: string, profile?: ElevationProfile) => rows.push({ ...base, mode, total_journey_minutes: total == null ? null : Number(total.toFixed(1)), waiting_minutes: wait, cycling_distance_m: Number(cycle.toFixed(0)), walking_distance_m: Number(walk.toFixed(0)), transfers, bicycle_network_category: comfort, elevation_gain_m: profile?.elevation_gain_m ?? null, descent_m: profile?.descent_m ?? null, maximum_segment_grade_percent: profile?.maximum_segment_grade_percent ?? null, hill_loop_climb_reduction_m: mode === "bicycle_plus_bus" ? reduction : null, substantial_hill_crossing_benefit: mode === "bicycle_plus_bus" && reduction != null && wholeProfile ? reduction >= 30 && reduction >= wholeProfile.elevation_gain_m * 0.35 : false, elevation_quality_flags: profile?.quality_flags ?? [] });
    add("walk_entire_trip", walking ? walking.distance_m / 75 : null, 0, 0, walking?.distance_m ?? 0, 0, "not_applicable", walking && elevation ? elevation.profile(walking.coordinates) : undefined);
    add("cycle_entire_trip", bicycleAll ? bicycleAll.distance_m / 250 : null, 0, bicycleAll?.distance_m ?? 0, 0, 0, bicycleComfort ? "comfortable_only_available" : bicycleConnecting ? "connecting_required" : "all_legal_required", wholeProfile);
    const feederTransfer = ["brooke", "south", "north"].includes(origin.id);
    const busWait = 7.5 + (feederTransfer ? 15 : 0);
    const busOnlyMinutes = accessWalk && egressWalk ? accessWalk.distance_m / 75 + busWait + busMinutes + egressWalk.distance_m / 75 : null;
    add("bus_only", busOnlyMinutes, busWait, 0, (accessWalk?.distance_m ?? 0) + (egressWalk?.distance_m ?? 0), feederTransfer ? 1 : 0, "not_applicable");
    const bikeBusMinutes = accessBike && egressBike ? accessBike.distance_m / 250 + 7.5 + busMinutes + egressBike.distance_m / 250 + 2 : null;
    add("bicycle_plus_bus", bikeBusMinutes, 7.5, (accessBike?.distance_m ?? 0) + (egressBike?.distance_m ?? 0), 0, 0, "comfortable_plus_connecting", bikeBusProfile);
    if (accessBike && egressBike) features.push({ type: "Feature", properties: { origin: origin.name, destination: destination.name, mode: "bicycle_plus_bus", elevation_gain_m: bikeBusProfile?.elevation_gain_m ?? null, hill_loop_climb_reduction_m: reduction, substantial_hill_crossing_benefit: reduction != null && wholeProfile ? reduction >= 30 && reduction >= wholeProfile.elevation_gain_m * 0.35 : false }, geometry: { type: "LineString", coordinates: [origin.point, [originStop.lon, originStop.lat], [destinationStop.lon, destinationStop.lat], to] } });
  }
  return { rows, geojson: { type: "FeatureCollection", features } as GeoCollection };
}
