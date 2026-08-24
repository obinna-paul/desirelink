import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("motion-safe:animate-pulse rounded-md bg-muted", className)}
    />
  );
}

export function ProfileCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}

export function FeedPostSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
      <Skeleton className="aspect-video w-full rounded-lg" />
    </div>
  );
}

export function ProfileHeaderSkeleton() {
  return (
    <div className="flex items-center gap-4">
      <Skeleton className="h-20 w-20 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-6 w-48 max-w-full" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-40" />
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="flex h-80 flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
      <Skeleton className="h-4 w-36" />
      <Skeleton className="h-3 w-52" />
      <Skeleton className="mt-2 flex-1 rounded-lg" />
    </div>
  );
}
