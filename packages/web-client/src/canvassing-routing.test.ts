import { describe, expect, it } from "vitest";
import { WalkingRoadGraph, metresBetween } from "./canvassing-routing";

describe("canvassing walking road estimates", () => {
  it("costs connected road legs and includes stop snapping", () => {
    const graph = new WalkingRoadGraph({ features: [{ geometry: { type: "LineString", coordinates: [[-80.94, 44.56], [-80.939, 44.56], [-80.938, 44.56]] } }] });
    const direct = metresBetween([-80.94, 44.56], [-80.938, 44.56]);
    expect(graph.distance([-80.94, 44.56], [-80.938, 44.56])).toBeCloseTo(direct, 5);
    expect(graph.routeDistance([[-80.94, 44.56], [-80.939, 44.56], [-80.938, 44.56]])).toBeCloseTo(direct, 5);
  });

  it("does not claim support for stops too far from the road graph", () => {
    const graph = new WalkingRoadGraph({ features: [{ geometry: { type: "LineString", coordinates: [[-80.94, 44.56], [-80.939, 44.56]] } }] });
    expect(graph.distance([-80.94, 44.56], [-81, 45])).toBeNull();
  });
});
