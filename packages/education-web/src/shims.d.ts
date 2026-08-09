declare module '@living-region/carrying-capacity/browser' {
  export function calculateHealthCanadaEER(profile: Record<string, unknown>): any;
  export function calculateInteractiveHousehold(options: Record<string, unknown>): any;
  export function calculateEvidenceHeating(overrides?: Record<string, unknown>): any;
  export const heatingCases: Record<string, any>;
}

interface ImportMetaEnv {
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
