import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";

const readJson = async (path: string) => JSON.parse(await readFile(path, "utf8"));

describe("Owen Sound canvassing preparation", () => {
  test("prepared features use unique stable internal IDs and preserve external IDs", async () => {
    const structures = await readJson("packages/web-client/public/canvassing/structures.geojson");
    const addresses = await readJson("packages/web-client/public/canvassing/addresses.geojson");
    expect(new Set(structures.features.map((feature: any) => feature.properties.structure_id)).size).toBe(structures.features.length);
    expect(new Set(addresses.features.map((feature: any) => feature.properties.address_id)).size).toBe(addresses.features.length);
    expect(structures.features.every((feature: any) => feature.properties.external_source === "openstreetmap" && feature.properties.external_id)).toBe(true);
  });

  test("unmatched addresses remain mappable point stops rather than forced joins", async () => {
    const addresses = await readJson("packages/web-client/public/canvassing/addresses.geojson");
    const unmatched = addresses.features.filter((feature: any) => feature.properties.association_status === "unmatched");
    expect(unmatched.length).toBeGreaterThan(0);
    expect(unmatched.every((feature: any) => feature.geometry.type === "Point" && feature.properties.structure_id === null)).toBe(true);
  });

  test("manifest records offline sources, CRS, counts, and unavailable parcels", async () => {
    const manifest = await readJson("packages/web-client/public/canvassing/manifest.json");
    const parcels = await readJson("packages/web-client/public/canvassing/parcels.geojson");
    expect(manifest.crs).toContain("CRS84");
    expect(manifest.counts.structures).toBeGreaterThan(1_000);
    expect(manifest.counts.addresses).toBeGreaterThan(3_000);
    expect(parcels.metadata.status).toBe("unavailable");
  });
});
