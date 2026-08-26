import { describe, expect, it } from "vitest";
import type { Feature } from "./building-coverage";
import {
  legacyHistoryStreetKey,
  reconcileLegacyHistory,
} from "./legacy-history-reconciliation";

const legacy = (
  id: string,
  label: string,
  coordinates: [number, number],
  unit = "",
): Feature => ({
  type: "Feature",
  id,
  properties: {
    address_id: id,
    civic_number: label.split(" ")[0],
    street: label.slice(label.indexOf(" ") + 1),
    unit,
    label,
  },
  geometry: { type: "Point", coordinates },
});

const canonical = (
  id: string,
  location: string,
  coordinates: [number, number],
  unit = "",
): Feature => ({
  type: "Feature",
  id,
  properties: {
    address_id: id,
    source_location_guid: location,
    official_street_name: "5th A",
    official_street_type: "ST",
    official_street_direction: "E",
    civic_number_base: "100",
    unit,
  },
  geometry: { type: "Point", coordinates },
});

describe("legacy activity reconciliation", () => {
  it("normalizes old suffix placement against NAR street components", () => {
    expect(legacyHistoryStreetKey("5th Street A East")).toBe("5TH A ST E");
  });

  it("confidently links a single-unit historical roof", () => {
    const result = reconcileLegacyHistory(
      [legacy("old", "100 5th Street A East", [-80.94, 44.56])],
      [canonical("new", "loc", [-80.94001, 44.56])],
      new Set(["old"]),
    );
    expect(result.links[0]).toMatchObject({
      legacy_address_id: "old",
      canonical_address_id: "new",
      canonical_location_id: "loc",
      match_status: "confident",
    });
  });

  it("keeps an old unitless apartment roof ambiguous", () => {
    const result = reconcileLegacyHistory(
      [legacy("old", "100 5th Street A East", [-80.94, 44.56])],
      [
        canonical("apt-1", "loc", [-80.94001, 44.56], "1"),
        canonical("apt-2", "loc", [-80.94001, 44.56], "2"),
      ],
      new Set(["old"]),
    );
    expect(result.links[0]).toMatchObject({
      canonical_address_id: null,
      canonical_location_id: "loc",
      match_status: "ambiguous",
    });
  });

  it("does not link a distant or unrelated historical address", () => {
    const result = reconcileLegacyHistory(
      [legacy("old", "100 Other Road", [-80.94, 44.56])],
      [canonical("new", "loc", [-80.94001, 44.56])],
      new Set(["old"]),
    );
    expect(result.links[0].match_status).toBe("unmatched");
    expect(result.summary.unmatched).toBe(1);
  });
});
