import { Sparkles } from "lucide-react";

import { EventCard } from "@/components/events/event-card";
import { Badge } from "@/components/ui/badge";
import type { EventRecommendation } from "@/lib/event-recommendations";

export function RecommendedEventsBanner({
  recommendations,
}: {
  recommendations: EventRecommendation[];
}) {
  if (recommendations.length === 0) return null;

  return (
    <section
      aria-labelledby="recommended-events-heading"
      className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm md:gap-4 md:rounded-none md:border-y md:border-x-0 md:border-neon-cyan/30 md:bg-secondary/30 md:p-0 md:py-4 md:shadow-none"
    >
      <div className="flex items-center gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary">
          <Sparkles className="h-4 w-4 text-neon-cyan" aria-hidden="true" />
        </span>
        <h2 id="recommended-events-heading" className="text-base font-semibold">
          Recommended events for you
        </h2>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
        <div className="flex gap-3 lg:grid lg:grid-cols-3 lg:gap-4">
          {recommendations.map((recommendation) => (
            <div key={recommendation.event.id} className="flex w-[82vw] max-w-[340px] shrink-0 flex-col gap-2 lg:w-auto lg:max-w-none">
              <EventCard
                event={recommendation.event}
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
