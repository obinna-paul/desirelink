import {
  FeedPostSkeleton,
  ProfileHeaderSkeleton,
  Skeleton,
} from "@/components/ui/skeleton";

export default function PublicProfileLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading profile...</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-24" />
      </div>
      <ProfileHeaderSkeleton />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-full" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
      <FeedPostSkeleton />
    </div>
  );
}
