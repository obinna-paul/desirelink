import { cn } from "@/lib/utils";

/**
 * A determinate circular progress meter - used in place of an indeterminate spinner
 * wherever a real percentage is known (e.g. an upload's byte progress, or Bunny Stream's
 * own transcode progress), so the person waiting sees it actually moving instead of
 * guessing how much longer it'll take.
 */
export function ProgressRing({
  progress,
  size = 48,
  strokeWidth = 3,
  className,
}: {
  /** 0-100. Clamped, so a caller can pass a raw fraction*100 without rounding first. */
  progress: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {/* currentColor-driven, like the Lucide icons it replaces - inherits whatever text
          color the caller's wrapper already sets rather than hardcoding one. */}
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth} className="stroke-current opacity-25" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="stroke-current transition-[stroke-dashoffset] duration-300 ease-out"
        />
      </svg>
      <span className="absolute text-[10px] font-bold">{Math.round(clamped)}%</span>
    </div>
  );
}
