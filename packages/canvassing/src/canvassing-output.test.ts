import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const readJson = async (path: string) => JSON.parse(await readFile(path, "utf8"));

describe("Owen Sound canvassing prepared data", () => {
  it("uses only exact and high-confidence automatic building associations", async () => {
    const addresses = await readJson("packages/web-client/public/canvassing/addresses.geojson");
    const counts: Record<string, number> = {};
    for (const feature of addresses.features) {
      const status = feature.properties.association_status;
      counts[status] = (counts[status] ?? 0) + 1;
      expect(Boolean(feature.properties.structure_id)).toBe(["exact", "high_confidence"].includes(status));
    }
    expect(counts.exact).toBeGreaterThan(0);
    expect(counts.probable).toBeGreaterThan(0);
    expect(counts.ambiguous).toBeGreaterThan(0);
  });

  it("keeps address-quality totals internally consistent", async () => {
    const quality = await readJson("packages/web-client/public/canvassing/address-quality.json");
    const confidenceTotal = Object.values(quality.automatic_join_counts).reduce((sum: number, value) => sum + Number(value), 0);
    expect(confidenceTotal).toBe(quality.totals.civic_addresses);
    expect(quality.automatic_join_counts.exact + quality.automatic_join_counts.high_confidence).toBeLessThanOrEqual(quality.totals.civic_addresses);
  });

  it("keeps campaign fields out of public OSM QA geography", async () => {
    const exported = await readJson("artifacts/owen-sound-building-import/public-building-geography.geojson");
    const allowed = ["source_footprint_id", "source", "licence", "existing_osm_overlap_result", "geometry_validation_result", "candidate_import_batch"];
    for (const feature of exported.features) expect(Object.keys(feature.properties).sort()).toEqual([...allowed].sort());
    expect(exported.metadata.api_uploading_enabled).toBe(false);
  });
});
