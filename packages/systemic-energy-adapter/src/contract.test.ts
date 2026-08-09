import { describe, expect, it } from "vitest";
import { loadSystemicEnergyContract, validateSystemicEnergyContract } from "./index";

describe("systemic energy contract", () => {
  it("validates the checked-in generated contract", () => {
    const snapshot = loadSystemicEnergyContract("data/systemic-energy/systemic-energy-v1.json");
    expect(snapshot.contract_id).toBe("living-region.systemic-energy");
    expect(snapshot.fieldsById.fuelAvailabilityIndex.evidence_status).toBe("not_available");
    expect(validateSystemicEnergyContract(snapshot)).toEqual([]);
  });

  it("rejects duplicate field identifiers", () => {
    const errors = validateSystemicEnergyContract({
      contract_id: "living-region.systemic-energy",
      schema_version: "1.0.0",
      generated_at: "2026-01-01T00:00:00Z",
      producer: { repository: "energy-model", git_commit: null, generator: "test" },
      fields: [
        { field_id: "x", value: null, unit: "index", evidence_status: "not_available", description: "x", evidence_indicator_ids: [], notes: "" },
        { field_id: "x", value: null, unit: "index", evidence_status: "not_available", description: "x", evidence_indicator_ids: [], notes: "" }
      ],
      indicators: [],
      compatibility: { rule: "", current_living_region_scenario_assumptions: [], currently_safe_direct_import: [], requires_local_calibration: [] },
      provenance_requirements: []
    });
    expect(errors).toContain("duplicate field_id: x");
  });
});
