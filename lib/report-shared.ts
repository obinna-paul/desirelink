/**
 * Client-safe report constants/types, split out of lib/report.ts so components like
 * report-dialog.tsx never need to import that file directly - lib/report.ts pulls in
 * server-only logic (via lib/moderation.ts -> lib/admin/audit.ts), and bundling any of it
 * into a client component fails the build even if the client only wanted a constant.
 */

export const REPORT_TARGET_TYPES = ["profile", "message", "post", "post_comment"] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export function isReportTargetType(value: unknown): value is ReportTargetType {
  return typeof value === "string" && (REPORT_TARGET_TYPES as readonly string[]).includes(value);
}

export const REPORT_REASONS = [
  "Harassment or abuse",
  "Spam or scam",
  "Fake profile or impersonation",
  "Underage user",
  "Non-consensual content",
  "Illegal activity",
  "Other",
] as const;
