import { describe, expect, it } from "vitest";
import {
  applySampleOverrides,
  defaultFollowupDate,
  distributedSample,
  samplingStratum,
  scheduleState,
} from "./followup-workflow";

const stops = Array.from({ length: 24 }, (_, index) => ({
  household_id: `home-${index + 1}`,
  street:
    index < 8
      ? "1st Avenue East"
      : index < 16
        ? "2nd Avenue East"
        : "3rd Avenue West",
  civic_number: String(100 + (index % 8) * 11),
  lon: -80.95 + index * 0.0001,
  lat: 44.56 + Math.floor(index / 8) * 0.001,
}));

describe("follow-up sampling", () => {
  it("is reproducible and defaults to twenty percent", () => {
    const first = distributedSample(stops, { seed: "route-42" });
    const second = distributedSample(stops, { seed: "route-42" });
    expect(first.map((stop) => stop.household_id)).toEqual(
      second.map((stop) => stop.household_id),
    );
    expect(first).toHaveLength(5);
  });

  it("distributes a target count across streets, blocks, and sides", () => {
    const selected = distributedSample(stops, {
      seed: "weekly-sample",
      targetCount: 12,
    });
    expect(new Set(selected.map((stop) => stop.street)).size).toBe(3);
    expect(new Set(selected.map(samplingStratum)).size).toBe(6);
    expect(
      new Set(selected.map((stop) => Number(stop.civic_number) % 2)).size,
    ).toBe(2);
    const small = distributedSample(stops, {
      seed: "small-weekly-sample",
      targetCount: 3,
    });
    expect(new Set(small.map((stop) => stop.street)).size).toBe(3);
  });

  it("applies manual inclusion, exclusion, and accepted ordering", () => {
    expect(
      applySampleOverrides(
        ["a", "b", "c"],
        ["a", "b", "c", "d"],
        [
          { type: "exclude", household_id: "b" },
          { type: "include", household_id: "d", position: 1 },
          { type: "reorder", household_ids: ["c", "d", "a"] },
        ],
      ),
    ).toEqual(["c", "d", "a"]);
  });
});

describe("weekly follow-up cadence", () => {
  it("maps Monday to Wednesday", () =>
    expect(defaultFollowupDate("2026-07-20")).toBe("2026-07-22"));
  it("maps Wednesday to following Monday", () =>
    expect(defaultFollowupDate("2026-07-22")).toBe("2026-07-27"));
  it("maps Friday to following Tuesday", () =>
    expect(defaultFollowupDate("2026-07-24")).toBe("2026-07-28"));
  it("classifies upcoming, due, and overdue dates", () => {
    expect(scheduleState("2026-07-20", "2026-07-21")).toBe("overdue");
    expect(scheduleState("2026-07-21", "2026-07-21")).toBe("due");
    expect(scheduleState("2026-07-22", "2026-07-21")).toBe("upcoming");
  });
});
