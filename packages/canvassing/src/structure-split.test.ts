import { describe, expect, it } from "vitest";
import {
  frontageCuts,
  geometryAreaM2,
  splitStructure,
  type Geometry,
} from "./structure-split";

const rectangle = (
  west: number,
  south: number,
  east: number,
  north: number,
): Geometry => ({
  type: "Polygon",
  coordinates: [
    [
      [west, south],
      [east, south],
      [east, north],
      [west, north],
      [west, south],
    ],
  ],
});

describe("structure split geometry", () => {
  it("splits a roof on an authored cut while preserving area", () => {
    const geometry = rectangle(-80.95, 44.57, -80.9495, 44.5702),
      result = splitStructure("parent", "event", geometry, [
        {
          start: [-80.94975, 44.5699],
          end: [-80.94975, 44.5703],
        },
      ]);
    expect(result.children).toHaveLength(2);
    expect(result.retained_area_ratio).toBeCloseTo(1, 4);
    expect(new Set(result.children.map((child) => child.id)).size).toBe(2);
  });

  it("generates equal frontage cuts for a row roof", () => {
    const geometry = rectangle(-80.95, 44.57, -80.949, 44.57015),
      cuts = frontageCuts(geometry, 4),
      result = splitStructure("row", "event", geometry, cuts);
    expect(cuts).toHaveLength(3);
    expect(result.children).toHaveLength(4);
    const areas = result.children.map((child) => child.area_m2);
    expect(
      (Math.max(...areas) - Math.min(...areas)) /
        (areas.reduce((sum, area) => sum + area, 0) / areas.length),
    ).toBeLessThan(0.02);
  });

  it("rejects slivers and no-op cuts", () => {
    const geometry = rectangle(-80.95, 44.57, -80.9495, 44.5702);
    expect(() =>
      splitStructure("parent", "outside", geometry, [
        {
          start: [-80.96, 44.56],
          end: [-80.96, 44.58],
        },
      ]),
    ).toThrow("do not divide");
    expect(() =>
      splitStructure(
        "parent",
        "sliver",
        geometry,
        [
          {
            start: [-80.949995, 44.5699],
            end: [-80.949995, 44.5703],
          },
        ],
        10,
      ),
    ).toThrow("at least 10");
  });

  it("reports stable nonzero metric area", () => {
    expect(
      geometryAreaM2(rectangle(-80.95, 44.57, -80.9495, 44.5702)),
    ).toBeGreaterThan(800);
  });
});
