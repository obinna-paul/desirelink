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
      className="flex flex-col gap-4 border-y border-neon-cyan/30 bg-secondary/30 py-4"
    >
      <div className="flex items-center gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary">
          <Sparkles className="h-4 w-4 text-neon-cyan" aria-hidden="true" />
        </span>
        <h2 id="recommended-events-heading" className="text-base font-semibold">
          Recommended events for you
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {recommendations.map((recommendation) => (
          <div key={recommendation.event.id} className="flex flex-col gap-2">
            <EventCard
              event={recommendation.event}
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
