import { FileImage, Loader2, RefreshCw, UploadCloud } from "lucide-react";

import { cn } from "@/lib/utils";

type UploadPhase =
  | "image"
  | "preparing"
  | "uploading"
  | "processing"
  | "reconnecting"
  | "retrying";

/**
 * The upload/processing state for media: a headline percentage, a determinate bar, and the
 * phase underneath. Falls back to a sweeping indeterminate bar when no real percentage is
 * known yet (before the first progress event, or on the local-disk dev path, which reports
 * none) rather than faking a number - a bar that lies is worse than one that admits it's
 * still measuring.
 */
export function UploadProgress({
  progress,
  label,
  hint,
  fileName,
  phase,
  className,
}: {
  /** 0-100, or null when genuinely unknown - drives determinate vs. indeterminate. */
  progress: number | null;
  label: string;
  hint?: string;
  fileName?: string;
  phase?: UploadPhase | null;
  className?: string;
}) {
  const determinate = progress !== null;
  const clamped = determinate ? Math.min(100, Math.max(0, progress)) : 0;

  const isVideo = Boolean(phase && phase !== "image");
  const phaseIndex =
    phase === "processing"
      ? 2
      : phase === "uploading" || phase === "reconnecting" || phase === "retrying"
        ? 1
        : 0;
  const StatusIcon =
    phase === "reconnecting" || phase === "retrying"
      ? RefreshCw
      : phase === "processing"
        ? Loader2
        : phase === "image"
          ? FileImage
          : UploadCloud;

  return (
    <div
      className={cn("flex w-full max-w-md flex-col gap-4", className)}
      aria-live="polite"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
          <StatusIcon
            className={cn(
              "h-5 w-5",
              (phase === "reconnecting" || phase === "retrying" || phase === "processing") &&
                "motion-safe:animate-spin",
            )}
            aria-hidden="true"
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-5 text-foreground">{label}</p>
          {fileName && (
            <p className="truncate text-xs leading-5 text-muted-foreground">{fileName}</p>
          )}
        </div>
        <p className="shrink-0 font-sans text-2xl font-semibold tabular-nums text-foreground">
          {determinate ? `${Math.round(clamped)}%` : ""}
        </p>
      </div>

      <div
        role="progressbar"
        aria-valuenow={determinate ? Math.round(clamped) : undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="relative h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        {determinate ? (
          <div
            className="h-full rounded-full bg-foreground transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${clamped}%` }}
          />
        ) : (
          <div className="h-full w-1/4 rounded-full bg-foreground motion-safe:animate-progress-sweep" />
        )}
      </div>

      {isVideo && (
        <div className="grid grid-cols-3 gap-2" aria-hidden="true">
          {["Prepare", "Upload", "Process"].map((step, index) => (
            <div key={step} className="flex items-center gap-2">
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  index <= phaseIndex ? "bg-foreground" : "bg-border",
                )}
              />
              <span
                className={cn(
                  "text-xs",
                  index === phaseIndex ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {step}
              </span>
            </div>
          ))}
        </div>
      )}

      {hint && <p className="text-sm leading-6 text-muted-foreground">{hint}</p>}
    </div>
  );
}
