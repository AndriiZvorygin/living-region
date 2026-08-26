import { describe, expect, it } from "vitest";
import {
  formatCivicNumber,
  formatOfficialAddress,
  formatOfficialBaseAddress,
  formatOfficialStreet,
} from "./official-address";

describe("authoritative Owen Sound address formatting", () => {
  it("keeps civic suffixes exact and attached", () => {
    expect(formatCivicNumber("1041", "1/2")).toBe("10411/2");
    expect(formatCivicNumber("155", "A")).toBe("155A");
  });

  it("expands official street type and direction without inventing a number", () => {
    expect(formatOfficialStreet("2nd", "AVE", "E")).toBe("2nd Avenue East");
    expect(formatOfficialAddress({
      civicNumber: "808",
      streetName: "2nd",
      streetType: "AVE",
      streetDirection: "E",
    })).toBe("808 2nd Avenue East");
  });

  it("shows a unit only for an individual address unit", () => {
    const parts = { civicNumber: "305", streetName: "14th", streetType: "ST", streetDirection: "W", unit: "101" };
    expect(formatOfficialAddress(parts)).toBe("305 14th Street West Unit 101");
    expect(formatOfficialBaseAddress(parts)).toBe("305 14th Street West");
  });
});
