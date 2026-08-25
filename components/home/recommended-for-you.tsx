import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ProfileCard } from "@/components/home/profile-card";
import { Badge } from "@/components/ui/badge";
import type { ProfileRecommendation } from "@/lib/recommendations";

export function RecommendedForYou({
  recommendations,
}: {
  recommendations: ProfileRecommendation[];
}) {
  if (recommendations.length === 0) return null;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="recommended-heading">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="recommended-heading" className="text-base font-semibold">
            Recommended for you
          </h2>
          <p className="text-sm text-muted-foreground">
            Sorted by Desire Map overlap, distance, availability, and recent activity.
          </p>
        </div>
        <Link
          href="/discover?sort=active"
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md border border-border/60 px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-neon-cyan/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          More
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        {recommendations.map((recommendation) => (
          <div key={recommendation.profile.id} className="flex flex-col gap-2">
            <ProfileCard
              profile={recommendation.profile}
              matchScore={recommendation.compatibilityScore}
            />
            {recommendation.reasons.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {recommendation.reasons.map((reason) => (
                  <Badge key={reason} variant="outline" className="text-muted-foreground">
                    {reason}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
