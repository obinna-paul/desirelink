import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

/**
 * A "your action just succeeded" confirmation that pins to the top of the viewport rather
 * than the top of the page's scroll position - published-while-scrolled-down (e.g. after a
 * long compose session) used to render this off-screen above the fold, invisible until the
 * user scrolled back up. `role="status"` still announces it to screen readers on mount.
 */
export function PublishToast({
  message,
  actionLabel,
  actionHref,
}: {
  message: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div
      role="status"
      className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+4rem)] z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-trust/40 bg-card px-4 py-3 text-sm shadow-lift md:top-[4.5rem]"
    >
      <span className="flex items-center gap-2 text-foreground">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-trust" aria-hidden="true" />
        {message}
      </span>
      {actionLabel && actionHref && (
        <Link href={actionHref} className="shrink-0 font-medium text-primary hover:underline">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
