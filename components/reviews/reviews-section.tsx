import { formatDistanceToNow } from "date-fns";
import { Star } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { ReviewData, ReviewSummary } from "@/lib/reviews";

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          aria-hidden="true"
          className={cn(
            "h-3.5 w-3.5",
            rating >= value ? "fill-neon-pink text-neon-pink" : "text-muted-foreground"
          )}
        />
      ))}
    </div>
  );
}

export function ReviewsSection({
  summary,
  reviews,
}: {
  summary: ReviewSummary;
  reviews: ReviewData[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Reviews</h2>
        {summary.totalCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <StarRow rating={Math.round(summary.averageRating)} />
            {summary.averageRating.toFixed(1)} ({summary.totalCount})
          </div>
        )}
      </div>

      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reviews yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {reviews.map((review) => {
            const initials = review.reviewer.displayName.slice(0, 2).toUpperCase();
            return (
              <li key={review.id} className="rounded-lg border border-border/60 bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar className="h-7 w-7 border border-border">
                      <AvatarImage src={review.reviewer.avatarUrl} alt={review.reviewer.displayName} />
                      <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{review.reviewer.displayName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <StarRow rating={review.rating} />
                </div>
                {review.comment && <p className="mt-2 text-sm">{review.comment}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
