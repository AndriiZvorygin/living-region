import { describe, expect, it } from "vitest";
import {
  addAddressLabels,
  addUnaddressedStructureReferences,
  applyAddressNumberCalibrations,
  associateAddressesWithBuildings,
  findGeneratedGeometryConflicts,
  mergeBuildingSources,
  mergeCityMapBuildingSource,
  type AddressInput,
  type Feature,
} from "./building-coverage";

const rectangle = (
  id: string,
  west: number,
  south: number,
  east: number,
  north: number,
  properties: Record<string, any> = {},
): Feature => ({
  type: "Feature",
  properties: {
    structure_id: id,
    external_source: "test",
    external_id: id,
    building_type: "residential",
    ...properties,
  },
  geometry: {
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
  },
});

const road: Feature = {
  type: "Feature",
  properties: { name: "9th Street West" },
  geometry: {
    type: "LineString",
    coordinates: [
      [-80.95, 44.57],
      [-80.93, 44.57],
    ],
  },
};

const rangeRoad = (
  leftFrom = 1100,
  leftTo = 1198,
  rightFrom = 1101,
  rightTo = 1199,
): Feature => ({
  type: "Feature",
  properties: {
    road_id: "road-3rd-west-1100",
    name: "3rd Avenue West",
    lane_count: 2,
    left_from: leftFrom,
    left_to: leftTo,
    right_from: rightFrom,
    right_to: rightTo,
    left_parity: "E",
    right_parity: "O",
  },
  geometry: {
    type: "LineString",
    coordinates: [
      [-80.9482, 44.569],
      [-80.9488, 44.5713],
    ],
  },
});

const address = (
  id: string,
  civic: string,
  point: [number, number],
  unit = "",
): AddressInput => ({
  address_id: id,
  civic_number: civic,
  street: "9th Street West",
  unit,
  point,
});

describe("canvassing building coverage", () => {
  it("preserves OSM geometry and removes an overlapping Canada Structures polygon", () => {
    const osm = rectangle("osm-1", -80.941, 44.5701, -80.9408, 44.57025, {
        external_id: "w123",
      }),
      canada = rectangle("source", -80.94101, 44.57009, -80.94079, 44.57026, {
        CS_ID: 9,
        OSM: "1",
        OSM_ID: "123",
      }),
      result = mergeBuildingSources(
        [osm],
        [canada],
        [
          [-81, 44.5],
          [-80.8, 44.5],
          [-80.8, 44.7],
          [-81, 44.7],
          [-81, 44.5],
        ],
      );
    expect(result.buildings).toEqual([osm]);
    expect(result.audit.deduplicated_polygons).toBe(1);
  });

  it("uses point containment before proximity", () => {
    const building = rectangle("house", -80.941, 44.5701, -80.9408, 44.57025),
      result = associateAddressesWithBuildings(
        [address("a", "100", [-80.9409, 44.57018])],
        [building],
        [road],
      );
    expect(result.associations.get("a")).toMatchObject({
      structure_id: "house",
      association_status: "exact",
    });
    expect(result.estimated).toHaveLength(0);
  });

  it("adds a city-map roof while deduplicating one that overlaps OSM", () => {
    const osm = rectangle("osm-1", -80.941, 44.5701, -80.9408, 44.57025),
      duplicate = rectangle(
        "city-duplicate",
        -80.94101,
        44.57009,
        -80.94079,
        44.57026,
        { CITY_MAP_ID: "city-1" },
      ),
      addition = rectangle(
        "city-addition",
        -80.9405,
        44.5701,
        -80.9403,
        44.57025,
        { CITY_MAP_ID: "city-2", area_m2: 130 },
      ),
      result = mergeCityMapBuildingSource(
        [osm],
        [duplicate, addition],
        [
          [-81, 44.5],
          [-80.8, 44.5],
          [-80.8, 44.7],
          [-81, 44.7],
          [-81, 44.5],
        ],
      );
    expect(result.buildings).toHaveLength(2);
    expect(result.audit.city_map_deduplicated_polygons).toBe(1);
    expect(result.additions[0].properties.external_source).toBe(
      "owen_sound_city_map_pdf",
    );
    expect(result.additions[0].properties.private_reference_only).toBe(true);
  });

  it("does not assign adjacent detached addresses to one small house", () => {
    const building = rectangle("house", -80.941, 44.5701, -80.94086, 44.5702, {
        area_m2: 110,
      }),
      result = associateAddressesWithBuildings(
        [
          address("a", "100", [-80.9409, 44.57016]),
          address("b", "102", [-80.9407, 44.57016]),
        ],
        [building],
        [road],
      );
    expect(result.associations.get("a")?.structure_id).toBe("house");
    expect(result.associations.get("b")?.association_status).toBe("estimated");
    expect(result.associations.get("b")?.structure_id).not.toBe("house");
  });

  it("shares one estimated roof for units at the same civic address", () => {
    const result = associateAddressesWithBuildings(
      [
        address("a", "120", [-80.94, 44.57002], "1"),
        address("b", "120", [-80.94, 44.57002], "2"),
      ],
      [],
      [road],
    );
    expect(result.estimated).toHaveLength(1);
    expect(result.associations.get("a")?.structure_id).toBe(
      result.associations.get("b")?.structure_id,
    );
    expect(result.estimated[0].geometry.type).toBe("Polygon");
    expect(result.estimated[0].properties.geometry_provenance).toBe(
      "estimated",
    );
  });

  it("splits distant duplicate civic records into separate roofs", () => {
    const result = associateAddressesWithBuildings(
      [
        address("near", "120", [-80.94, 44.57002], ""),
        address("far", "120", [-80.94, 44.57502], ""),
      ],
      [],
      [],
    );
    expect(result.estimated).toHaveLength(2);
    expect(result.associations.get("near")?.structure_id).not.toBe(
      result.associations.get("far")?.structure_id,
    );
  });

  it("distributes inferred households along official block ranges by side and parity", () => {
    const buildings = [
        rectangle("west-low", -80.94855, 44.5693, -80.9484, 44.56942),
        rectangle("west-high", -80.949, 44.57085, -80.94884, 44.57098),
        rectangle("east-low", -80.94818, 44.56945, -80.94802, 44.56957),
        rectangle("east-high", -80.94858, 44.57095, -80.94842, 44.57107),
      ],
      segment = rangeRoad(),
      result = associateAddressesWithBuildings([], buildings, [segment], {
        addressRangeRoads: [segment],
      }),
      inferred = result.inferredAddresses;
    expect(inferred).toHaveLength(4);
    const west = inferred
        .filter((item) => Number(item.civic_number) % 2 === 0)
        .sort((left, right) => left.point[1] - right.point[1]),
      east = inferred
        .filter((item) => Number(item.civic_number) % 2 === 1)
        .sort((left, right) => left.point[1] - right.point[1]);
    expect(west).toHaveLength(2);
    expect(east).toHaveLength(2);
    expect(west.every((item) => Number(item.civic_number) % 2 === 0)).toBe(
      true,
    );
    expect(east.every((item) => Number(item.civic_number) % 2 === 1)).toBe(
      true,
    );
    expect(Number(west[0].civic_number)).toBeLessThan(
      Number(west[1].civic_number),
    );
    expect(Number(east[0].civic_number)).toBeLessThan(
      Number(east[1].civic_number),
    );
  });

  it("keeps an inferred household ID stable when its estimated civic number changes", () => {
    const building = rectangle(
        "stable-roof",
        -80.94855,
        44.5698,
        -80.9484,
        44.56992,
      ),
      first = associateAddressesWithBuildings(
        [],
        [structuredClone(building)],
        [rangeRoad()],
        { addressRangeRoads: [rangeRoad()] },
      ),
      changedRoad = rangeRoad(1200, 1298, 1201, 1299),
      second = associateAddressesWithBuildings(
        [],
        [structuredClone(building)],
        [changedRoad],
        { addressRangeRoads: [changedRoad] },
      );
    expect(first.inferredAddresses[0].address_id).toBe(
      second.inferredAddresses[0].address_id,
    );
    expect(first.inferredAddresses[0].civic_number).not.toBe(
      second.inferredAddresses[0].civic_number,
    );
  });

  it("reserves manually corrected numbers during regeneration", () => {
    const building = rectangle(
        "range-roof",
        -80.94855,
        44.5701,
        -80.9484,
        44.57022,
      ),
      result = associateAddressesWithBuildings([], [building], [rangeRoad()], {
        addressRangeRoads: [rangeRoad()],
        reservedAddresses: [
          { civic_number: "1148", street: "3rd Avenue West" },
        ],
      });
    expect(result.inferredAddresses).toHaveLength(1);
    expect(result.inferredAddresses[0].civic_number).not.toBe("1148");
  });

  it("replays a corrected number onto an unlinked stable roof", () => {
    const building = rectangle(
        "corrected-roof",
        -80.94855,
        44.5701,
        -80.9484,
        44.57022,
      ),
      addresses: AddressInput[] = [],
      associations = new Map(),
      result = applyAddressNumberCalibrations(
        addresses,
        [building],
        associations,
        [
          {
            event_id: "event-1",
            address_id: "manual-address",
            structure_id: "corrected-roof",
            civic_number: "1144",
            street: "3rd Avenue West",
            unit: "",
          },
        ],
      );
    expect(result).toEqual({ applied: 1, unmatched: 0 });
    expect(addresses[0]).toMatchObject({
      address_id: "manual-address",
      civic_number: "1144",
      street: "3rd Avenue West",
      address_confidence: "manual_verified",
    });
    expect(associations.get("manual-address")).toMatchObject({
      structure_id: "corrected-roof",
      association_status: "exact",
    });
  });

  it("numbers a small unclassified roof on the street frontage", () => {
    const segment = rangeRoad(),
      smallHouse = rectangle(
        "small-frontage",
        -80.94845,
        44.5698,
        -80.94838,
        44.56987,
        { building_type: "unclassified" },
      ),
      result = associateAddressesWithBuildings([], [smallHouse], [segment], {
        addressRangeRoads: [segment],
      });
    expect(result.inferredAddresses).toHaveLength(1);
    expect(result.inferredAddresses[0].inferred_from).toBe(
      "official_segment_range_and_small_frontage_roof_order",
    );
  });

  it("does not number a small rear roof behind another building", () => {
    const segment: Feature = {
        ...rangeRoad(),
        geometry: {
          type: "LineString",
          coordinates: [
            [-80.948, 44.569],
            [-80.948, 44.5713],
          ],
        },
      },
      frontHouse = rectangle(
        "front-house",
        -80.9482,
        44.5698,
        -80.94805,
        44.56994,
      ),
      rearRoof = rectangle(
        "rear-roof",
        -80.94842,
        44.56982,
        -80.94835,
        44.56989,
        { building_type: "unclassified" },
      ),
      existingAddress: AddressInput = {
        address_id: "front-address",
        civic_number: "1130",
        street: "3rd Avenue West",
        unit: "",
        point: [-80.94812, 44.56987],
      },
      result = associateAddressesWithBuildings(
        [existingAddress],
        [frontHouse, rearRoof],
        [segment],
        { addressRangeRoads: [segment] },
      );
    expect(result.associations.get("front-address")?.structure_id).toBe(
      "front-house",
    );
    expect(result.inferredAddresses).toHaveLength(0);
    expect(result.inferenceAudit.rear_or_accessory).toBe(1);
  });

  it("keeps generated roofs clear of roads and other roofs", () => {
    const segment = rangeRoad(),
      inputs: AddressInput[] = [
        {
          address_id: "a",
          civic_number: "1140",
          street: "3rd Avenue West",
          unit: "",
          point: [-80.94845, 44.57],
        },
        {
          address_id: "b",
          civic_number: "1142",
          street: "3rd Avenue West",
          unit: "",
          point: [-80.94847, 44.57005],
        },
      ],
      result = associateAddressesWithBuildings(inputs, [], [segment], {
        addressRangeRoads: [segment],
      });
    expect(result.estimated.length).toBeGreaterThan(0);
    expect(
      findGeneratedGeometryConflicts(result.estimated, [], [segment]),
    ).toEqual([]);
  });

  it("does not let a duplicate named OSM centreline block a frontage roof", () => {
    const official = {
        ...rangeRoad(),
        properties: { ...rangeRoad().properties, source: "Grey County road centrelines" },
      },
      osmDuplicate = {
        ...official,
        properties: {
          name: "3rd Avenue West",
          highway: "residential",
        },
        geometry: {
          type: "LineString",
          coordinates: [
            [-80.9482, 44.56903],
            [-80.9488, 44.57133],
          ],
        },
      } as Feature,
      result = associateAddressesWithBuildings(
        [
          {
            address_id: "duplicate-centreline",
            civic_number: "1140",
            street: "3rd Avenue West",
            unit: "",
            point: [-80.94845, 44.57],
          },
        ],
        [],
        [osmDuplicate, official],
        { addressRangeRoads: [official] },
      );
    expect(result.estimated).toHaveLength(1);
    expect(
      findGeneratedGeometryConflicts(result.estimated, [], [
        osmDuplicate,
        official,
      ]),
    ).toEqual([]);
  });

  it("moves a corner estimate inward rather than overlapping the cross street", () => {
    const segment = rangeRoad(),
      crossStreet: Feature = {
        type: "Feature",
        properties: { name: "11th Street West", lane_count: 2 },
        geometry: {
          type: "LineString",
          coordinates: [
            [-80.949, 44.569],
            [-80.948, 44.569],
          ],
        },
      },
      input: AddressInput = {
        address_id: "corner",
        civic_number: "1100",
        street: "3rd Avenue West",
        unit: "",
        point: [-80.94825, 44.56903],
      },
      result = associateAddressesWithBuildings(
        [input],
        [],
        [segment, crossStreet],
        { addressRangeRoads: [segment] },
      );
    expect(result.estimated).toHaveLength(1);
    expect(
      findGeneratedGeometryConflicts(
        result.estimated,
        [],
        [segment, crossStreet],
      ),
    ).toEqual([]);
    expect(result.estimated[0].properties.estimated_shift_m).not.toBe(0);
  });

  it("gives an unaddressed accessory roof a selectable shared-address reference", () => {
    const home = rectangle(
        "home",
        -80.95,
        44.57,
        -80.94985,
        44.5701,
      ),
      garage = rectangle(
        "garage",
        -80.94978,
        44.57,
        -80.9497,
        44.57006,
        { building_type: "accessory" },
      ),
      address: AddressInput = {
        address_id: "address-home",
        civic_number: "1142",
        street: "3rd Avenue West",
        unit: "",
        point: [-80.94992, 44.57005],
      },
      associations = new Map([
        [
          address.address_id,
          {
            structure_id: "home",
            association_status: "exact" as const,
            nearest_footprint_m: 0,
            candidates: [{ structure_id: "home", distance_m: 0 }],
          },
        ],
      ]),
      linked = addAddressLabels([home, garage], [address], associations),
      audit = addUnaddressedStructureReferences([home, garage], linked);
    expect(garage.properties).toMatchObject({
      civic_label: "1142",
      address_relation: "shared_accessory",
      address_reference_structure_id: "home",
      address_reference_ids: ["address-home"],
    });
    expect(audit.shared_accessory).toBe(1);
    expect(audit.unresolved).toBe(0);
  });
});
