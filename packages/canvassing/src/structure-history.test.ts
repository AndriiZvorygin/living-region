import { describe, expect, it } from "vitest";
import { aggregatePhysicalRoofActivity, selectPhysicalRoofStatus } from "./structure-history";

describe("physical roof history projection", () => {
  it("preserves flyer events and merges activity on one physical roof", () => {
    const result = aggregatePhysicalRoofActivity([
      {
        structure_id: "roof-1", event_id: "v-1", occurred_at: "2026-08-01T10:00:00Z",
        flyer_id: "flyer-1-original", flyer_name: "Original", user_id: "andrii",
        source: "legacy", flyer_delivered: 1, status: "flyer_delivered",
      },
      {
        structure_id: "roof-1", event_id: "v-2", occurred_at: "2026-08-02T10:00:00Z",
        flyer_id: null, flyer_name: "Unknown", user_id: "rynaldo",
        source: "legacy", flyer_delivered: 0, status: "conversation",
      },
    ]);
    expect(result.get("roof-1")).toMatchObject({
      flyer_delivered: 1,
      status: "conversation",
      visit_count: 2,
    });
    expect(result.get("roof-1")?.flyer_history[0]).toMatchObject({ event_id: "v-1", user_id: "andrii" });
  });

  it("uses the meaningful status when statuses are combined", () => {
    expect(selectPhysicalRoofStatus("untouched", "flyer_delivered")).toBe("flyer_delivered");
    expect(selectPhysicalRoofStatus("conversation", "flyer_delivered")).toBe("conversation");
  });
});
