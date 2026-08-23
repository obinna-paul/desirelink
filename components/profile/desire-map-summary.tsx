import Link from "next/link";
import type { Desire } from "@prisma/client";
import { Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DESIRE_LEVEL_LABELS, DESIRE_PRIVACY_LABELS } from "@/lib/desire-options";

const LEVEL_BADGE_VARIANT: Record<Desire["level"], "default" | "secondary" | "outline" | "neon"> = {
  curious: "outline",
  interested: "secondary",
  looking: "secondary",
  regular: "neon",
  hard_limit: "outline",
};

export function DesireMapSummary({
  desires,
  isOwner,
}: {
  desires: Desire[];
  isOwner: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Desire Map
        </h2>
        {isOwner && (
          <Button asChild variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
            <Link href="/onboarding/desires">
              <Pencil className="h-3 w-3" /> Edit
            </Link>
          </Button>
        )}
      </div>

      {desires.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {isOwner ? (
            <>
              You haven&apos;t built your desire map yet.{" "}
              <Link href="/onboarding/desires" className="text-neon-pink hover:underline">
                Get started
              </Link>
              .
            </>
          ) : (
            "No public desires to show."
          )}
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {desires.map((desire) => (
            <li
              key={desire.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-3 py-2"
            >
              <span className="text-sm font-medium">{desire.category}</span>
              <span className="flex items-center gap-1.5">
                <Badge variant={LEVEL_BADGE_VARIANT[desire.level]}>
                  {DESIRE_LEVEL_LABELS[desire.level]}
                </Badge>
                {isOwner && (
                  <Badge variant="outline" className="text-muted-foreground">
                    {DESIRE_PRIVACY_LABELS[desire.privacy]}
                  </Badge>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
