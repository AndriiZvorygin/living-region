import { readFileSync } from "node:fs";

export type SystemicEnergyEvidenceStatus =
  | "not_available"
  | "contextual_evidence_only"
  | "measured_contextual"
  | "measured"
  | "derived";

export type SystemicEnergyField = {
  field_id: string;
  value: number | null;
  unit: string;
  evidence_status: SystemicEnergyEvidenceStatus;
  description: string;
  evidence_indicator_ids: string[];
  notes: string;
};

export type SystemicEnergyIndicator = {
  indicator_id: string;
  label?: string;
  value?: number | null;
  unit?: string;
  observation_date?: string | null;
  source_date?: string | null;
  retrieval_date?: string | null;
  source?: string;
  source_url?: string;
  evidence_status?: string;
  evidence_label?: string;
  confidence?: string | null;
  limitations?: string[];
};

export type SystemicEnergyContract = {
  contract_id: "living-region.systemic-energy";
  schema_version: string;
  generated_at: string;
  producer: { repository: string; git_commit: string | null; generator: string };
  scope: { upstream_scale: string; downstream_consumer: string; geography: string[] };
  fields: SystemicEnergyField[];
  indicators: SystemicEnergyIndicator[];
  compatibility: {
    rule: string;
    current_living_region_scenario_assumptions: string[];
    currently_safe_direct_import: string[];
    requires_local_calibration: string[];
  };
  provenance_requirements: string[];
};

export type SystemicEnergySnapshot = SystemicEnergyContract & {
  fieldsById: Readonly<Record<string, SystemicEnergyField>>;
  indicatorsById: Readonly<Record<string, SystemicEnergyIndicator>>;
};

export function validateSystemicEnergyContract(value: unknown): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== "object") return ["contract must be an object"];
  const contract = value as Partial<SystemicEnergyContract>;
  if (contract.contract_id !== "living-region.systemic-energy") errors.push("contract_id must be living-region.systemic-energy");
  if (!contract.schema_version) errors.push("schema_version is required");
  if (!contract.generated_at) errors.push("generated_at is required");
  if (!contract.producer?.repository) errors.push("producer.repository is required");
  if (!Array.isArray(contract.fields) || contract.fields.length === 0) errors.push("fields must be a non-empty array");
  if (!Array.isArray(contract.indicators)) errors.push("indicators must be an array");
  const fieldIds = new Set<string>();
  for (const field of contract.fields ?? []) {
    if (!field.field_id) errors.push("every field requires field_id");
    if (fieldIds.has(field.field_id)) errors.push(`duplicate field_id: ${field.field_id}`);
    fieldIds.add(field.field_id);
    if (typeof field.unit !== "string") errors.push(`field ${field.field_id} requires unit`);
    if (field.value !== null && field.value !== undefined && !Number.isFinite(field.value)) errors.push(`field ${field.field_id} value must be numeric or null`);
    if (!field.evidence_status) errors.push(`field ${field.field_id} requires evidence_status`);
    if (!Array.isArray(field.evidence_indicator_ids)) errors.push(`field ${field.field_id} evidence_indicator_ids must be an array`);
  }
  const indicatorIds = new Set<string>();
  for (const indicator of contract.indicators ?? []) {
    if (!indicator.indicator_id) errors.push("every indicator requires indicator_id");
    if (indicatorIds.has(indicator.indicator_id)) errors.push(`duplicate indicator_id: ${indicator.indicator_id}`);
    indicatorIds.add(indicator.indicator_id);
  }
  return errors;
}

export function loadSystemicEnergyContract(path: string): SystemicEnergySnapshot {
  const contract = JSON.parse(readFileSync(path, "utf8")) as SystemicEnergyContract;
  const errors = validateSystemicEnergyContract(contract);
  if (errors.length) throw new Error(`Invalid systemic-energy contract:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  return {
    ...contract,
    fieldsById: Object.fromEntries(contract.fields.map((field) => [field.field_id, field])),
    indicatorsById: Object.fromEntries(contract.indicators.map((indicator) => [indicator.indicator_id, indicator]))
  };
}

export function getSystemicEnergyField(snapshot: SystemicEnergySnapshot, fieldId: string): SystemicEnergyField | undefined {
  return snapshot.fieldsById[fieldId];
}

export function getDirectlyUsableSystemicEnergyValues(snapshot: SystemicEnergySnapshot): Record<string, number> {
  const allowed = new Set(snapshot.compatibility.currently_safe_direct_import);
  return Object.fromEntries(snapshot.fields.filter((field) => allowed.has(field.field_id) && field.value !== null).map((field) => [field.field_id, field.value as number]));
}
