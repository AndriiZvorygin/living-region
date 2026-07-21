import { distanceMetres, project, type Position, type Stop, type StreetGraph } from "./index";
import type { DirectionalRoutePlan } from "./loop-analysis";

function projectedFraction(point: Position, a: Position, b: Position, origin: Position): { distance_m: number; fraction: number } {
  const p = project(point[0], point[1], origin);
  const pa = project(a[0], a[1], origin);
  const pb = project(b[0], b[1], origin);
  const dx = pb[0] - pa[0];
  const dy = pb[1] - pa[1];
  const lengthSquared = dx * dx + dy * dy;
  const fraction = lengthSquared ? Math.max(0, Math.min(1, ((p[0] - pa[0]) * dx + (p[1] - pa[1]) * dy) / lengthSquared)) : 0;
  return { distance_m: Math.hypot(p[0] - (pa[0] + fraction * dx), p[1] - (pa[1] + fraction * dy)), fraction };
}

export function stopTimeOffsets(plan: DirectionalRoutePlan, stops: Stop[], graph: StreetGraph, runningMinutes: number) {
  const cumulative = [0];
  for (let index = 1; index < plan.route.coordinates.length; index += 1) cumulative.push(cumulative[index - 1] + distanceMetres(plan.route.coordinates[index - 1], plan.route.coordinates[index]));
  const total = cumulative[cumulative.length - 1];
  return stops.map((stop) => {
    if (stop.id.includes("downtown_terminal")) {
      return { stop_id: stop.id, stop_name: stop.name, route_snap_distance_m: 0, offset_minutes: 0 };
    }
    let best: { distance_m: number; along_m: number } | undefined;
    for (let index = 0; index < plan.route.coordinates.length - 1; index += 1) {
      const projected = projectedFraction([stop.lon, stop.lat], plan.route.coordinates[index], plan.route.coordinates[index + 1], graph.origin);
      const segmentLength = distanceMetres(plan.route.coordinates[index], plan.route.coordinates[index + 1]);
      const candidate = { distance_m: projected.distance_m, along_m: cumulative[index] + segmentLength * projected.fraction };
      if (!best || candidate.distance_m < best.distance_m) best = candidate;
    }
    return { stop_id: stop.id, stop_name: stop.name, route_snap_distance_m: Number((best?.distance_m ?? Infinity).toFixed(1)), offset_minutes: Number(((best?.along_m ?? 0) / Math.max(1, total) * runningMinutes).toFixed(2)) };
  });
}

function minute(value: number): number {
  return ((value % 60) + 60) % 60;
}

function intervals(arrivals: Array<{ direction: string; minute: number }>) {
  const sorted = [...arrivals].sort((a, b) => a.minute - b.minute);
  return sorted.map((arrival, index) => {
    const next = sorted[(index + 1) % sorted.length];
    const gap = index === sorted.length - 1 ? next.minute + 60 - arrival.minute : next.minute - arrival.minute;
    return { after_direction: arrival.direction, after_minute: Number(arrival.minute.toFixed(2)), next_direction: next.direction, next_minute: Number(next.minute.toFixed(2)), gap_minutes: Number(gap.toFixed(2)) };
  });
}

export function clockfaceStopSpacing(clockwiseOffsets: ReturnType<typeof stopTimeOffsets>, counterOffsets: ReturnType<typeof stopTimeOffsets>, clockwiseDeparture = 0, counterDeparture = 15, clockwiseDelay = 0, counterDelay = 0) {
  const counterById = new Map(counterOffsets.map((row) => [row.stop_id, row]));
  return clockwiseOffsets.map((clockwise) => {
    const counter = counterById.get(clockwise.stop_id);
    if (!counter) throw new Error(`Counter-clockwise stop offset missing for ${clockwise.stop_name}`);
    const cw = minute(clockwiseDeparture + clockwise.offset_minutes + clockwiseDelay);
    const ccw = minute(counterDeparture + counter.offset_minutes + counterDelay);
    const arrivals = [
      { direction: "clockwise", minute: cw },
      { direction: "clockwise", minute: minute(cw + 30) },
      { direction: "counter_clockwise", minute: ccw },
      { direction: "counter_clockwise", minute: minute(ccw + 30) }
    ];
    const gaps = intervals(arrivals);
    return { stop_id: clockwise.stop_id, stop_name: clockwise.stop_name, clockwise_arrival_minutes: [Number(cw.toFixed(2)), Number(minute(cw + 30).toFixed(2))], counter_clockwise_arrival_minutes: [Number(ccw.toFixed(2)), Number(minute(ccw + 30).toFixed(2))], intervals: gaps, smallest_gap_minutes: Math.min(...gaps.map((gap) => gap.gap_minutes)), largest_gap_minutes: Math.max(...gaps.map((gap) => gap.gap_minutes)), clockwise_route_snap_m: clockwise.route_snap_distance_m, counter_clockwise_route_snap_m: counter.route_snap_distance_m };
  });
}

export function delayScenarios(clockwiseOffsets: ReturnType<typeof stopTimeOffsets>, counterOffsets: ReturnType<typeof stopTimeOffsets>, delays = [1, 3, 5]) {
  return ["clockwise", "counter_clockwise"].flatMap((delayedDirection) => delays.map((delay) => {
    const rows = clockfaceStopSpacing(clockwiseOffsets, counterOffsets, 0, 15, delayedDirection === "clockwise" ? delay : 0, delayedDirection === "counter_clockwise" ? delay : 0);
    const worst = [...rows].sort((a, b) => b.largest_gap_minutes - a.largest_gap_minutes)[0];
    return { delayed_direction: delayedDirection, delay_minutes: delay, largest_combined_gap_minutes: worst.largest_gap_minutes, worst_stop_id: worst.stop_id, worst_stop_name: worst.stop_name };
  }));
}
