import { describe, expect, it } from "vitest";
import {
  aggregateCoverage,
  buildHouseholdAdjacencyGraph,
  calculateLocalCoverageArea,
  calculateInterveningHouseholdCosts,
  calculateCoverage,
  type CoverageLocation,
  type HouseholdAdjacencyGraph,
  infernoCoverageColor,
  selectNextUnderflyeredArea,
} from "./canvassing-coverage";

const household = (household_id: string, status: string, eligible = true) => ({
  household_id,
  status,
  eligible,
});

const graphFor = (
  locations: CoverageLocation[],
  edges: Array<[string, string]>,
): HouseholdAdjacencyGraph => {
  const neighbors = new Map<string, Set<string>>();
  const stopIdByHousehold = new Map<string, string>();
  const eligibleHouseholdsByStop = new Map<string, number>();
  for (const location of locations) {
    const stopId = location.stop_id ?? location.household_id;
    stopIdByHousehold.set(location.household_id, stopId);
    neighbors.set(stopId, new Set());
    if (location.eligible)
      eligibleHouseholdsByStop.set(
        stopId,
        (eligibleHouseholdsByStop.get(stopId) ?? 0) + 1,
      );
  }
  for (const [left, right] of edges) {
    neighbors.set(left, new Set([...(neighbors.get(left) ?? []), right]));
    neighbors.set(right, new Set([...(neighbors.get(right) ?? []), left]));
  }
  return { neighbors, stopIdByHousehold, eligibleHouseholdsByStop };
};

const location = (
  household_id: string,
  covered = false,
  lon = -80.94,
  lat = 44.56,
  extra: Partial<CoverageLocation> = {},
): CoverageLocation => ({
  household_id,
  lon,
  lat,
  eligible: true,
  covered,
  ...extra,
});

describe("flyer coverage", () => {
  it("reports untouched, partial, and fully covered clusters", () => {
    expect(calculateCoverage([household("a", "untouched")])).toEqual({
      covered: 0,
      remaining: 1,
      totalEligible: 1,
      coverage: 0,
    });
    expect(
      calculateCoverage([
        household("a", "flyer_delivered"),
        household("b", "untouched"),
      ]),
    ).toEqual({ covered: 1, remaining: 1, totalEligible: 2, coverage: 0.5 });
    expect(
      calculateCoverage([
        household("a", "conversation"),
        household("b", "supportive"),
      ]),
    ).toEqual({ covered: 2, remaining: 0, totalEligible: 2, coverage: 1 });
  });

  it("deduplicates visits and excludes undeliverable stops", () => {
    expect(
      calculateCoverage([
        household("a", "untouched"),
        household("a", "flyer_delivered"),
        household("b", "inaccessible"),
        household("c", "vacant"),
        household("d", "no_campaign_material_requested"),
        household("e", "untouched", false),
      ]),
    ).toEqual({ covered: 1, remaining: 0, totalEligible: 1, coverage: 1 });
  });

  it("keeps separate units in one building as separate households", () => {
    expect(
      calculateCoverage([
        household("building-1-unit-a", "flyer_delivered"),
        household("building-1-unit-b", "untouched"),
      ]),
    ).toEqual({ covered: 1, remaining: 1, totalEligible: 2, coverage: 0.5 });
  });

  it("updates coverage immediately when a household status changes", () => {
    const items = [household("a", "untouched")];
    expect(calculateCoverage(items).remaining).toBe(1);
    items[0].status = "knocked_no_answer";
    expect(calculateCoverage(items)).toEqual({
      covered: 1,
      remaining: 0,
      totalEligible: 1,
      coverage: 1,
    });
  });

  it("aggregates child counts rather than averaging percentages", () => {
    expect(
      aggregateCoverage([
        { covered: 1, remaining: 1, totalEligible: 2, coverage: 0.5 },
        { covered: 0, remaining: 8, totalEligible: 8, coverage: 0 },
      ]),
    ).toEqual({ covered: 1, remaining: 9, totalEligible: 10, coverage: 0.1 });
  });

  it("keeps exact Inferno anchor colours", () => {
    expect(infernoCoverageColor(0)).toBe("#000004");
    expect(infernoCoverageColor(0.2)).toBe("#420a68");
    expect(infernoCoverageColor(0.4)).toBe("#932667");
    expect(infernoCoverageColor(0.6)).toBe("#dd513a");
    expect(infernoCoverageColor(0.8)).toBe("#fca50a");
    expect(infernoCoverageColor(1)).toBe("#fcffa4");
  });

  it("charges a multi-unit stop by its eligible household count", () => {
    const locations = [
      location("covered", true),
      location("unit-a", false, -80.95, 44.56, { stop_id: "building" }),
      location("unit-b", false, -80.95, 44.56, { stop_id: "building" }),
    ];
    const costs = calculateInterveningHouseholdCosts(
      locations,
      graphFor(locations, [["covered", "building"]]),
    );
    expect(costs.get("unit-a")).toBe(2);
    expect(costs.get("unit-b")).toBe(2);
  });

  it("connects frontage order and real intersections without unrelated shortcuts", () => {
    const locations = [
      location("a1", false, -80.9492, 44.56, {
        street: "1st Street",
        civic_number: "100",
      }),
      location("a2", false, -80.9392, 44.56, {
        street: "1st Street",
        civic_number: "102",
      }),
      location("b1", false, -80.95, 44.5602, {
        street: "2nd Avenue",
        civic_number: "200",
      }),
      location("unrelated", false, -80.9492, 44.56008, {
        street: "3rd Street",
        civic_number: "300",
      }),
    ];
    const graph = buildHouseholdAdjacencyGraph(locations, [
      {
        properties: { name: "1st Street", road_id: "road-a" },
        geometry: {
          type: "LineString",
          coordinates: [
            [-80.95, 44.56],
            [-80.938, 44.56],
          ],
        },
      },
      {
        properties: { name: "2nd Avenue", road_id: "road-b" },
        geometry: {
          type: "LineString",
          coordinates: [
            [-80.95, 44.56],
            [-80.95, 44.562],
          ],
        },
      },
      {
        properties: { name: "3rd Street", road_id: "road-c" },
        geometry: {
          type: "LineString",
          coordinates: [
            [-80.9492, 44.56008],
            [-80.948, 44.56008],
          ],
        },
      },
    ]);
    expect(graph.neighbors.get("a1")?.has("a2")).toBe(true);
    expect(graph.neighbors.get("a1")?.has("b1")).toBe(true);
    expect(graph.neighbors.get("a1")?.has("unrelated")).toBe(false);
  });

  it("chooses a dense central undercovered area over a remote corner", () => {
    const locations = [location("central-1")];
    const edges: Array<[string, string]> = [];
    for (let index = 1; index <= 170; index++) {
      const id = `central-${index}`;
      locations.push(location(id, index <= 20));
      edges.push([index === 1 ? "central-1" : `central-${index - 1}`, id]);
    }
    locations.push(location("remote", false, -81.2, 44.6));
    edges.push(["central-1", "remote"]);
    const result = selectNextUnderflyeredArea(locations, graphFor(locations, edges));
    expect(result?.localRemaining).toBeGreaterThan(100);
    expect(result?.center_household_id.startsWith("central-")).toBe(true);
  });

  it("ranks a partially covered area against a small untouched component", () => {
    const locations = [location("main-0", true)];
    const edges: Array<[string, string]> = [];
    for (let index = 1; index <= 180; index++) {
      const id = `main-${index}`;
      locations.push(location(id, index <= 40));
      edges.push([`main-${index - 1}`, id]);
    }
    for (let index = 0; index < 8; index++) {
      const id = `small-${index}`;
      locations.push(location(id));
      if (index) edges.push([`small-${index - 1}`, id]);
    }
    const result = selectNextUnderflyeredArea(locations, graphFor(locations, edges));
    expect(result?.center_household_id.startsWith("main-")).toBe(true);
    expect(result?.localRemaining).toBeGreaterThan(8);
  });

  it("uses household hops and ignores straight-line closeness", () => {
    const locations = [location("center", true)];
    const edges: Array<[string, string]> = [];
    for (let index = 1; index <= 149; index++) {
      const id = `long-${index}`;
      locations.push(location(id, false, -80.94 + index / 100000, 44.56));
      edges.push([index === 1 ? "center" : `long-${index - 1}`, id]);
    }
    locations.push(location("short", false, -80.94001, 44.56));
    edges.push(["center", "short"]);
    const result = selectNextUnderflyeredArea(locations, graphFor(locations, edges));
    expect(result?.center_household_id.startsWith("long-")).toBe(true);
    expect(result?.householdHopRadius).toBeGreaterThan(10);
  });

  it("counts multi-unit stops as multiple local households", () => {
    const locations = [
      location("center", true),
      location("unit-a", false, -80.95, 44.56, { stop_id: "building" }),
      location("unit-b", true, -80.95, 44.56, { stop_id: "building" }),
      location("next", false, -80.96, 44.56),
    ];
    const graph = graphFor(locations, [
      ["center", "building"],
      ["building", "next"],
    ]);
    const area = calculateLocalCoverageArea("center", locations, graph, 3);
    expect(area?.sampleSize).toBe(3);
    expect(area?.localCovered).toBe(2);
    expect(area?.localRemaining).toBe(1);
  });

  it("keeps disconnected components finite and reports their component", () => {
    const locations = [location("main", true), location("corner"), location("corner-2")];
    const graph = graphFor(locations, [["corner", "corner-2"]]);
    const result = selectNextUnderflyeredArea(locations, graph, 150);
    expect(result?.center_household_id).toBe("corner");
    expect(result?.graphComponent).toBe("corner");
    expect(Number.isFinite(result?.householdHopRadius ?? Infinity)).toBe(true);
  });

  it("returns no recommendation when every eligible household is covered", () => {
    const locations = [location("a", true), location("b", true)];
    expect(selectNextUnderflyeredArea(locations, graphFor(locations, [["a", "b"]]))).toBeNull();
  });

  it("is stable across status updates until the caller explicitly recalculates", () => {
    const locations = [location("a"), location("b"), location("c")];
    const graph = graphFor(locations, [["a", "b"], ["b", "c"]]);
    const first = selectNextUnderflyeredArea(locations, graph, 3)!;
    locations[0].covered = true;
    const pinned = calculateLocalCoverageArea(first.center_household_id, locations, graph, 3)!;
    expect(pinned.center_household_id).toBe(first.center_household_id);
    expect(pinned.localRemaining).toBeLessThan(first.localRemaining);
  });
});
