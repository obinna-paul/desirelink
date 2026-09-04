import { CreatorCard } from "@/components/creators/creator-card";
import type { SubscribableCreator } from "@/lib/creators-directory";

export function CreatorDirectoryGrid({ creators }: { creators: SubscribableCreator[] }) {
  if (creators.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-card/60 p-8 text-center text-sm text-muted-foreground md:rounded-xl md:p-10">
        No creators match these filters yet. Try widening your search.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:gap-4 xl:grid-cols-4">
      {creators.map((creator) => (
        <CreatorCard key={creator.id} creator={creator} />
      ))}
    </div>
  );
}
