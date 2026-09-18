export const V3_PILOT_CONSENT_VERSION = "2026-09-18.2" as const;

export function isV3PilotEnabled(): boolean {
  return process.env.SPEC_TEST_V3_PILOT_ENABLED?.trim().toLowerCase() === "true";
}
