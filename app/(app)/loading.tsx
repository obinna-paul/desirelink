import { FeedPostSkeleton, ProfileCardSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading...</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <ProfileCardSkeleton key={index} />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {Array.from({ length: 2 }).map((_, index) => (
          <FeedPostSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
