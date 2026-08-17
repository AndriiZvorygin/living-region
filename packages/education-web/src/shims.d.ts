declare module '@living-region/carrying-capacity/browser' {
  export function calculateHealthCanadaEER(profile: Record<string, unknown>): any;
  export function calculateInteractiveHousehold(options: Record<string, unknown>): any;
  export function calculateEvidenceHeating(overrides?: Record<string, unknown>): any;
  export function calculateBuildingHeatingDemand(building?: Record<string, unknown>, shared?: Record<string, unknown>): any;
  export function calculatePersonVisualMetrics(profile?: Record<string, unknown>): any;
  export function calculateHeatingLoads(options?: Record<string, unknown>): any;
  export function calculateHouseholdLabourCapacity(members?: Array<Record<string, unknown>>): any;
  export function calculateLandLeaseAccounting(options?: Record<string, unknown>): any;
  export function financeCapital(options?: Record<string, unknown>): any;
  export function calculateExclusiveLandAllocation(options?: Record<string, unknown>): any;
  export function calculateArcCommonAreaGeometry(options?: Record<string, unknown>): any;
  export function calculateAgroecosystemPlan(options?: Record<string, unknown>): any;
  export function defaultBuilding(): any;
  export const labourCapacityLevels: Record<string, any>;
  export const heatingCases: Record<string, any>;
}

interface ImportMetaEnv {
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
