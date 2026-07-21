import {
  combinePaths,
  distanceMetres,
  geometryLines,
  project,
  shortestBusPath,
  type Destination,
  type GeoCollection,
  type PlannerConfig,
  type Position,
  type RoutedPath,
  type StreetGraph
} from "./index";

export type RouteWaypoint = { id: string; label: string; position: Position; destination_id?: string };

export type RouteEvent = {
  destination_id: string;
  waypoint_index: number;
  cumulative_distance_m: number;
  cumulative_in_motion_minutes: number;
};

export type DirectionalRoutePlan = {
  id: string;
  direction: "clockwise" | "counter_clockwise" | "existing";
  waypoints: RouteWaypoint[];
  legs: RoutedPath[];
  route: RoutedPath;
  events: RouteEvent[];
};

export type OdTravel = {
  origin_id: string;
  destination_id: string;
  in_vehicle_minutes: number;
};

export type ProjectedRouteDestination = {
  destination: Destination;
  boarding_point: Destination;
  route_offset_m: number;
  cumulative_distance_m: number;
};

export function buildDirectionalRoute(graph: StreetGraph, waypoints: RouteWaypoint[], config: PlannerConfig, id: string, direction: DirectionalRoutePlan["direction"]): DirectionalRoutePlan {
  const legs = waypoints.slice(0, -1).map((waypoint, index) => shortestBusPath(graph, waypoint.position, waypoints[index + 1].position, config));
  return planFromLegs(waypoints, legs, id, direction);
}

function planFromLegs(waypoints: RouteWaypoint[], legs: RoutedPath[], id: string, direction: DirectionalRoutePlan["direction"]): DirectionalRoutePlan {
  let distance = 0;
  let minutes = 0;
  const events: RouteEvent[] = [];
  if (waypoints[0].destination_id) events.push({ destination_id: waypoints[0].destination_id, waypoint_index: 0, cumulative_distance_m: 0, cumulative_in_motion_minutes: 0 });
  legs.forEach((leg, index) => {
    distance += leg.distance_m;
    minutes += leg.travel_seconds / 60;
    const waypoint = waypoints[index + 1];
    if (waypoint.destination_id) events.push({ destination_id: waypoint.destination_id, waypoint_index: index + 1, cumulative_distance_m: distance, cumulative_in_motion_minutes: minutes });
  });
  return { id, direction, waypoints, legs, route: combinePaths(legs), events };
}

function reversePath(path: RoutedPath, graph: StreetGraph, config: PlannerConfig): RoutedPath {
  const edgeIds = [...path.edge_ids].reverse().map((edgeId) => {
    const edge = graph.edges[edgeId];
    const reverse = graph.nodes[edge.to].edges.find((candidateId) => {
      const candidate = graph.edges[candidateId];
      return candidate.to === edge.from && candidate.road_name === edge.road_name && Math.abs(candidate.length_m - edge.length_m) < 0.2;
    });
    if (reverse == null) throw new Error(`Missing reverse bus edge for ${edge.road_name} edge ${edgeId}`);
    return reverse;
  });
  let travelSeconds = 0;
  let turns = 0;
  let sharpTurns = 0;
  let leftTurns = 0;
  let intersections = 0;
  for (let index = 0; index < edgeIds.length; index += 1) {
    const edge = graph.edges[edgeIds[index]];
    travelSeconds += edge.travel_seconds;
    if (graph.nodes[edge.from].edges.length > 2) { travelSeconds += config.bus.intersection_penalty_seconds; intersections += 1; }
    if (!index) continue;
    const prior = graph.edges[edgeIds[index - 1]];
    const angle = angleBetween(bearing(graph, prior.id), bearing(graph, edge.id));
    if (prior.road_name !== edge.road_name && Math.abs(angle) > 20) { turns += 1; travelSeconds += config.bus.turn_penalty_seconds; }
    if (Math.abs(angle) > 105) { sharpTurns += 1; travelSeconds += config.bus.sharp_turn_penalty_seconds; }
    if (angle < -20 && graph.nodes[edge.from].edges.some((id) => config.bus.major_road_classes.includes(graph.edges[id].road_class))) { leftTurns += 1; travelSeconds += config.bus.left_turn_major_road_penalty_seconds; }
  }
  return {
    coordinates: [...path.coordinates].reverse(),
    edge_ids: edgeIds,
    distance_m: path.distance_m,
    travel_seconds: travelSeconds,
    turns,
    sharp_turns: sharpTurns,
    left_turns_across_major: leftTurns,
    intersections,
    straight_distance_m: path.straight_distance_m,
    circuitry_ratio: path.circuitry_ratio
  };
}

export function reverseDirectionalRoute(plan: DirectionalRoutePlan, graph: StreetGraph, config: PlannerConfig, id: string): DirectionalRoutePlan {
  const waypoints = [...plan.waypoints].reverse();
  const legs = [...plan.legs].reverse().map((leg) => reversePath(leg, graph, config));
  return planFromLegs(waypoints, legs, id, "counter_clockwise");
}

export function routeRideCycleMinutes(plan: DirectionalRoutePlan, stopCount: number, dwellSeconds: number): number {
  return plan.route.travel_seconds / 60 + stopCount * dwellSeconds / 60;
}

export function odTravelMatrix(plan: DirectionalRoutePlan, destinationIds: string[], stopCount: number, dwellSeconds: number): OdTravel[] {
  const rideCycle = routeRideCycleMinutes(plan, stopCount, dwellSeconds);
  const dwellPerMetre = stopCount * dwellSeconds / 60 / Math.max(1, plan.route.distance_m);
  const eventTimes = plan.events.map((event) => ({ ...event, time: event.cumulative_in_motion_minutes + event.cumulative_distance_m * dwellPerMetre }));
  const result: OdTravel[] = [];
  for (const origin of destinationIds) {
    for (const destination of destinationIds) {
      if (origin === destination) continue;
      let best = Infinity;
      for (const from of eventTimes.filter((event) => event.destination_id === origin)) {
        for (const to of eventTimes.filter((event) => event.destination_id === destination)) {
          let elapsed = to.time - from.time;
          if (elapsed <= 0.01) elapsed += rideCycle;
          best = Math.min(best, elapsed);
        }
      }
      if (Number.isFinite(best)) result.push({ origin_id: origin, destination_id: destination, in_vehicle_minutes: Number(best.toFixed(1)) });
    }
  }
  return result;
}

export function compareCounterRotatingStrategies(clockwise: OdTravel[], counterClockwise: OdTravel[], clockwiseHeadway: number, counterClockwiseHeadway: number, samples = 80) {
  const reverse = new Map(counterClockwise.map((row) => [`${row.origin_id}:${row.destination_id}`, row]));
  return clockwise.map((cw) => {
    const ccw = reverse.get(`${cw.origin_id}:${cw.destination_id}`);
    if (!ccw) throw new Error(`Counter-clockwise OD pair missing for ${cw.origin_id} -> ${cw.destination_id}`);
    let firstTotal = 0;
    let optimalTotal = 0;
    for (let a = 0; a < samples; a += 1) {
      const waitCw = (a + 0.5) / samples * clockwiseHeadway;
      for (let b = 0; b < samples; b += 1) {
        const waitCcw = (b + 0.5) / samples * counterClockwiseHeadway;
        firstTotal += waitCw <= waitCcw ? waitCw + cw.in_vehicle_minutes : waitCcw + ccw.in_vehicle_minutes;
        optimalTotal += Math.min(waitCw + cw.in_vehicle_minutes, waitCcw + ccw.in_vehicle_minutes);
      }
    }
    const divisor = samples * samples;
    const shorterDirection = cw.in_vehicle_minutes <= ccw.in_vehicle_minutes ? "clockwise" : "counter_clockwise";
    const shorterRide = Math.min(cw.in_vehicle_minutes, ccw.in_vehicle_minutes);
    const shorterWait = shorterDirection === "clockwise" ? clockwiseHeadway / 2 : counterClockwiseHeadway / 2;
    const first = firstTotal / divisor;
    const waitShorter = shorterWait + shorterRide;
    return {
      origin_id: cw.origin_id,
      destination_id: cw.destination_id,
      clockwise_in_vehicle_minutes: cw.in_vehicle_minutes,
      counter_clockwise_in_vehicle_minutes: ccw.in_vehicle_minutes,
      shorter_direction: shorterDirection,
      expected_journey_first_arriving_minutes: Number(first.toFixed(1)),
      expected_journey_wait_shorter_direction_minutes: Number(waitShorter.toFixed(1)),
      expected_journey_with_arrival_information_minutes: Number((optimalTotal / divisor).toFixed(1)),
      recommended_rule: first <= waitShorter ? "take_first_arriving" : `wait_for_${shorterDirection}`,
      expected_minutes_saved: Number(Math.abs(first - waitShorter).toFixed(1))
    };
  });
}

function pointSegmentDistance(point: Position, a: Position, b: Position, origin: Position): number {
  const p = project(point[0], point[1], origin);
  const pa = project(a[0], a[1], origin);
  const pb = project(b[0], b[1], origin);
  const dx = pb[0] - pa[0];
  const dy = pb[1] - pa[1];
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((p[0] - pa[0]) * dx + (p[1] - pa[1]) * dy) / lengthSquared)) : 0;
  return Math.hypot(p[0] - (pa[0] + t * dx), p[1] - (pa[1] + t * dy));
}

function projectPointToSegment(point: Position, a: Position, b: Position, origin: Position): { point: Position; distance_m: number; fraction: number } {
  const p = project(point[0], point[1], origin);
  const pa = project(a[0], a[1], origin);
  const pb = project(b[0], b[1], origin);
  const dx = pb[0] - pa[0];
  const dy = pb[1] - pa[1];
  const lengthSquared = dx * dx + dy * dy;
  const fraction = lengthSquared ? Math.max(0, Math.min(1, ((p[0] - pa[0]) * dx + (p[1] - pa[1]) * dy) / lengthSquared)) : 0;
  const projected: Position = [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction];
  return { point: projected, distance_m: Math.hypot(p[0] - (pa[0] + fraction * dx), p[1] - (pa[1] + fraction * dy)), fraction };
}

export function projectDestinationsOntoRoute(plan: DirectionalRoutePlan, destinations: Destination[], graph: StreetGraph, maxOffsetM: number): { plan: DirectionalRoutePlan; projected: ProjectedRouteDestination[]; unserved: Array<{ destination: Destination; route_offset_m: number }> } {
  const cumulative = [0];
  for (let index = 1; index < plan.route.coordinates.length; index += 1) cumulative.push(cumulative[index - 1] + distanceMetres(plan.route.coordinates[index - 1], plan.route.coordinates[index]));
  const projected: ProjectedRouteDestination[] = [];
  const unserved: Array<{ destination: Destination; route_offset_m: number }> = [];
  const events = [...plan.events];
  for (const destination of destinations) {
    let best: { point: Position; distance_m: number; fraction: number; segment: number; along: number } | undefined;
    for (let index = 0; index < plan.route.coordinates.length - 1; index += 1) {
      const candidate = projectPointToSegment([destination.lon, destination.lat], plan.route.coordinates[index], plan.route.coordinates[index + 1], graph.origin);
      const segmentLength = distanceMetres(plan.route.coordinates[index], plan.route.coordinates[index + 1]);
      const withAlong = { ...candidate, segment: index, along: cumulative[index] + segmentLength * candidate.fraction };
      if (!best || withAlong.distance_m < best.distance_m) best = withAlong;
    }
    if (!best) continue;
    if (best.distance_m > maxOffsetM) { unserved.push({ destination, route_offset_m: Number(best.distance_m.toFixed(1)) }); continue; }
    const boardingPoint: Destination = { ...destination, id: `loop-stop-${destination.id}`, name: `${destination.name} loop stop`, lon: best.point[0], lat: best.point[1] };
    projected.push({ destination, boarding_point: boardingPoint, route_offset_m: Number(best.distance_m.toFixed(1)), cumulative_distance_m: best.along });
    if (!events.some((event) => event.destination_id === destination.id)) events.push({ destination_id: destination.id, waypoint_index: best.segment, cumulative_distance_m: best.along, cumulative_in_motion_minutes: best.along / Math.max(1, plan.route.distance_m) * plan.route.travel_seconds / 60 });
  }
  return { plan: { ...plan, events: events.sort((a, b) => a.cumulative_distance_m - b.cumulative_distance_m) }, projected, unserved };
}

export function countSignalCrossings(route: RoutedPath, osmPois: GeoCollection, radiusM: number, origin: Position): number {
  const signalPoints = osmPois.features
    .filter((feature) => feature.geometry?.type === "Point" && feature.properties?.highway === "traffic_signals")
    .map((feature) => feature.geometry!.coordinates as Position);
  const clusters: Position[][] = [];
  for (const point of signalPoints) {
    const cluster = clusters.find((candidate) => distanceMetres(point, candidate[0]) <= 35);
    if (cluster) cluster.push(point);
    else clusters.push([point]);
  }
  const intersections = clusters.map((cluster): Position => [cluster.reduce((sum, point) => sum + point[0], 0) / cluster.length, cluster.reduce((sum, point) => sum + point[1], 0) / cluster.length]);
  return intersections.reduce((total, point) => {
    let crossings = 0;
    let nearPreviousSegment = false;
    for (let index = 0; index < route.coordinates.length - 1; index += 1) {
      const near = pointSegmentDistance(point, route.coordinates[index], route.coordinates[index + 1], origin) <= radiusM;
      if (near && !nearPreviousSegment) crossings += 1;
      nearPreviousSegment = near;
    }
    return total + crossings;
  }, 0);
}

function bearing(graph: StreetGraph, edgeId: number): number {
  const edge = graph.edges[edgeId];
  const from = graph.nodes[edge.from];
  const to = graph.nodes[edge.to];
  return Math.atan2(to.x_m - from.x_m, to.y_m - from.y_m) * 180 / Math.PI;
}

function angleBetween(a: number, b: number): number {
  return ((b - a + 540) % 360) - 180;
}

type OsmRoadSegment = { a: Position; b: Position; oneway: string; incline: string; name: string };

function osmRoadSegments(osmHighways: GeoCollection): OsmRoadSegment[] {
  const segments: OsmRoadSegment[] = [];
  for (const feature of osmHighways.features) {
    const properties = feature.properties ?? {};
    for (const line of geometryLines(feature.geometry)) {
      for (let index = 0; index < line.length - 1; index += 1) segments.push({ a: line[index], b: line[index + 1], oneway: String(properties.oneway ?? ""), incline: String(properties.incline ?? ""), name: String(properties.name ?? "") });
    }
  }
  return segments;
}

export function segmentSuitability(plan: DirectionalRoutePlan, graph: StreetGraph, osmHighways: GeoCollection, matchRadiusM: number) {
  const osmSegments = osmRoadSegments(osmHighways);
  const legStarts = new Set<number>();
  let edgeOffset = 0;
  for (const leg of plan.legs) { legStarts.add(edgeOffset); edgeOffset += leg.edge_ids.length; }
  return plan.route.edge_ids.map((edgeId, index) => {
    const edge = graph.edges[edgeId];
    const midpoint: Position = [(edge.coordinates[0][0] + edge.coordinates[1][0]) / 2, (edge.coordinates[0][1] + edge.coordinates[1][1]) / 2];
    let match: OsmRoadSegment | undefined;
    let matchDistance = matchRadiusM;
    let onewayStatus = "unmatched_osm_segment";
    const nearby: Array<{ segment: OsmRoadSegment; distance: number; sameDirection: boolean; violates: boolean }> = [];
    const routeStart = project(edge.coordinates[0][0], edge.coordinates[0][1], graph.origin);
    const routeEnd = project(edge.coordinates[1][0], edge.coordinates[1][1], graph.origin);
    const routeVector = [routeEnd[0] - routeStart[0], routeEnd[1] - routeStart[1]];
    for (const segment of osmSegments) {
      const distance = pointSegmentDistance(midpoint, segment.a, segment.b, graph.origin);
      if (distance > matchRadiusM) continue;
      const osmStart = project(segment.a[0], segment.a[1], graph.origin);
      const osmEnd = project(segment.b[0], segment.b[1], graph.origin);
      const osmVector = [osmEnd[0] - osmStart[0], osmEnd[1] - osmStart[1]];
      const sameDirection = routeVector[0] * osmVector[0] + routeVector[1] * osmVector[1] >= 0;
      const violates = segment.oneway === "yes" ? !sameDirection : segment.oneway === "-1" ? sameDirection : false;
      nearby.push({ segment, distance, sameDirection, violates });
    }
    if (nearby.length) {
      const selected = [...nearby].sort((a, b) => Number(a.violates) - Number(b.violates) || a.distance - b.distance)[0];
      match = selected.segment;
      matchDistance = selected.distance;
      const allTaggedCandidatesViolate = nearby.every((candidate) => candidate.violates && ["yes", "-1"].includes(candidate.segment.oneway));
      onewayStatus = allTaggedCandidatesViolate ? "violation" : match.oneway ? `complies_${match.oneway}` : "two_way_or_unmarked";
    }
    const turnInto = index ? Math.abs(angleBetween(bearing(graph, plan.route.edge_ids[index - 1]), bearing(graph, edgeId))) : 0;
    const turnContext = legStarts.has(index) && index > 0 ? "destination_or_waypoint_boundary" : "through_route";
    const turnStatus = turnInto > 130 && turnContext === "destination_or_waypoint_boundary" ? "review_destination_turnaround" : turnInto > 130 ? "review_tight_turn" : turnInto > 105 ? "review_sharp_turn" : "pass_geometry_screen";
    const winterStatus = edge.winter_maintenance ? "documented_municipal_winter_maintenance" : "winter_maintenance_not_documented";
    const gradeStatus = match?.incline ? `osm_incline_${match.incline}` : "unresolved_no_grade_data";
    const hardFailure = onewayStatus === "violation" || edge.lane_count === 1 || turnInto > 130;
    return {
      route_id: plan.id,
      direction: plan.direction,
      sequence: index + 1,
      graph_edge_id: edge.id,
      road_name: edge.road_name,
      length_m: Number(edge.length_m.toFixed(1)),
      road_class: edge.road_class,
      lane_count: edge.lane_count || null,
      speed_kph: edge.posted_speed_kph,
      winter_status: winterStatus,
      oneway_status: onewayStatus,
      osm_match_distance_m: match ? Number(matchDistance.toFixed(1)) : null,
      turn_into_degrees: Number(turnInto.toFixed(1)),
      turn_context: turnContext,
      turn_geometry_status: turnStatus,
      grade_status: gradeStatus,
      minibus_validation: hardFailure ? "fail_or_field_review" : gradeStatus.startsWith("unresolved") ? "provisional_requires_grade_check" : "pass_provisional_screen"
    };
  });
}

export function duplicatedRouteKilometres(route: RoutedPath, graph: StreetGraph): number {
  const seen = new Set<string>();
  let duplicate = 0;
  for (const edgeId of route.edge_ids) {
    const edge = graph.edges[edgeId];
    const key = [edge.from, edge.to].sort((a, b) => a - b).join(":");
    if (seen.has(key)) duplicate += edge.length_m;
    else seen.add(key);
  }
  return duplicate / 1000;
}

export function directionalOverlapKilometres(a: RoutedPath, b: RoutedPath, graph: StreetGraph): number {
  const keys = new Set(a.edge_ids.map((id) => {
    const edge = graph.edges[id];
    return [edge.from, edge.to].sort((x, y) => x - y).join(":");
  }));
  const counted = new Set<string>();
  let overlap = 0;
  for (const id of b.edge_ids) {
    const edge = graph.edges[id];
    const key = [edge.from, edge.to].sort((x, y) => x - y).join(":");
    if (keys.has(key) && !counted.has(key)) { overlap += edge.length_m; counted.add(key); }
  }
  return overlap / 1000;
}
