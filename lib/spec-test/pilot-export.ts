import "server-only";

import { toCsv } from "@/lib/admin/csv";
import type { SpecTestResponseV3 } from "@/lib/spec-test/response";
import {
  ATTACHMENT_RESPONSE_LABELS,
  SCORING_DIMENSION_KEYS,
  type AttachmentResponseLabel,
  type ScoringDimensionKey,
} from "@/lib/spec-test/taxonomy";

export type PilotExportSubmission = {
  instrumentVersion: string;
  consentVersion: string;
  responses: unknown;
  attractionProfile: unknown;
  uncertaintyProfile: unknown;
  qualityFlags: string[];
  dataSplit: string;
};

const CORE_HEADERS = [
  "participant_index",
  "instrument_version",
  "consent_version",
  "data_split",
  "quality_flags",
  "item_id",
  "item_kind",
  "skipped",
  "elapsed_seconds_rounded",
  "most_option_id",
  "least_option_id",
  "most_position_1_to_4",
  "least_position_1_to_4",
  "rating_1_to_7",
  "selected_option_id",
  "selected_position_1_to_4",
] as const;

function nestedNumber(value: unknown, key: string): number | "" {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const nested = (value as Record<string, unknown>)[key];
  return typeof nested === "number" && Number.isFinite(nested) ? nested : "";
}

function dimensionScores(profile: unknown, dimension: ScoringDimensionKey): Array<number | ""> {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return ["", "", ""];
  const dimensionProfile = (profile as Record<string, unknown>)[dimension];
  return [
    nestedNumber(dimensionProfile, "comparativeScore"),
    nestedNumber(dimensionProfile, "intensityScore"),
    nestedNumber(dimensionProfile, "combinedScore"),
  ];
}

function uncertaintyCount(profile: unknown, label: AttachmentResponseLabel): number | "" {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return "";
  const value = (profile as Record<string, unknown>)[label];
  return typeof value === "number" && Number.isFinite(value) ? value : "";
}

function presentedPosition(value: number | null): number | "" {
  return value === null ? "" : value + 1;
}

/**
 * One row per answered or skipped item. Scores repeat by participant so a single file can
 * support both item and profile analysis without a persistent cross-file identifier.
 * Participant indexes exist only inside this export; database ids, attempt ids, exact
 * timestamps, emails, IP addresses, and free text are never included.
 */
export function buildPilotAnalysisCsv(submissions: PilotExportSubmission[]): string {
  const scoreHeaders = SCORING_DIMENSION_KEYS.flatMap((dimension) => [
    `${dimension}_comparative_score`,
    `${dimension}_intensity_score`,
    `${dimension}_combined_score`,
  ]);
  const uncertaintyHeaders = ATTACHMENT_RESPONSE_LABELS.map((label) => `${label}_count`);
  const rows: Array<Array<string | number>> = [];

  submissions.forEach((submission, submissionIndex) => {
    if (!Array.isArray(submission.responses)) return;
    for (const response of submission.responses as SpecTestResponseV3[]) {
      const shared: Array<string | number> = [
        submissionIndex + 1,
        submission.instrumentVersion,
        submission.consentVersion,
        submission.dataSplit,
        submission.qualityFlags.join("|"),
        response.itemId,
        response.kind,
        response.skipped ? "true" : "false",
        Math.round(response.elapsedMs / 1000),
      ];
      const responseValues: Array<string | number> =
        response.kind === "best_worst"
          ? [
              response.bestOptionId ?? "",
              response.worstOptionId ?? "",
              presentedPosition(response.bestPresentedIndex),
              presentedPosition(response.worstPresentedIndex),
              "",
              "",
              "",
            ]
          : response.kind === "intensity"
            ? ["", "", "", "", response.rating ?? "", "", ""]
            : ["", "", "", "", "", response.optionId ?? "", presentedPosition(response.presentedIndex)];
      const scores = SCORING_DIMENSION_KEYS.flatMap((dimension) =>
        dimensionScores(submission.attractionProfile, dimension),
      );
      const uncertainty = ATTACHMENT_RESPONSE_LABELS.map((label) =>
        uncertaintyCount(submission.uncertaintyProfile, label),
      );
      rows.push([...shared, ...responseValues, ...scores, ...uncertainty]);
    }
  });

  return toCsv([...CORE_HEADERS, ...scoreHeaders, ...uncertaintyHeaders], rows);
}
