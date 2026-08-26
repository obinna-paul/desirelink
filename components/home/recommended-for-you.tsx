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
          <p className="hidden text-sm text-muted-foreground md:block">
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
      <div className="-mx-3 overflow-x-auto px-3 md:mx-0 md:overflow-visible md:px-0">
        <div className="flex gap-3 md:grid md:grid-cols-2 md:gap-4 2xl:grid-cols-3">
          {recommendations.map((recommendation) => (
            <div
              key={recommendation.profile.id}
              className="flex w-[82vw] max-w-[340px] shrink-0 flex-col gap-2 md:w-auto md:max-w-none"
            >
              <ProfileCard
                profile={recommendation.profile}
                matchScore={recommendation.compatibilityScore}
              />
              {recommendation.reasons.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {recommendation.reasons.slice(0, 2).map((reason) => (
                    <Badge key={reason} variant="outline" className="text-muted-foreground">
                      {reason}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
