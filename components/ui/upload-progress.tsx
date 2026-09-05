import { cn } from "@/lib/utils";

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
  className,
}: {
  /** 0-100, or null when genuinely unknown - drives determinate vs. indeterminate. */
  progress: number | null;
  label: string;
  hint?: string;
  className?: string;
}) {
  const determinate = progress !== null;
  const clamped = determinate ? Math.min(100, Math.max(0, progress)) : 0;

  return (
    <div className={cn("flex w-full max-w-sm flex-col items-center gap-3", className)}>
      <p className="font-heading text-3xl font-semibold tabular-nums tracking-tight text-foreground">
        {determinate ? `${Math.round(clamped)}%` : " "}
      </p>

      <div
        role="progressbar"
        aria-valuenow={determinate ? Math.round(clamped) : undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        {determinate ? (
          <div
            className="h-full rounded-full bg-foreground transition-[width] duration-300 ease-out"
            style={{ width: `${clamped}%` }}
          />
        ) : (
          <div className="h-full w-1/4 rounded-full bg-foreground motion-safe:animate-progress-sweep" />
        )}
      </div>

      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-base font-semibold text-foreground">{label}</p>
        {hint && <p className="text-sm leading-6 text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}
