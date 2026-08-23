export default function AppLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="flex flex-col gap-2">
        <div className="h-7 w-40 motion-safe:animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-72 max-w-full motion-safe:animate-pulse rounded-md bg-muted" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 shrink-0 motion-safe:animate-pulse rounded-full bg-muted" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="h-4 w-2/3 motion-safe:animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/2 motion-safe:animate-pulse rounded bg-muted" />
              </div>
            </div>
            <div className="flex gap-1.5">
              <div className="h-5 w-16 motion-safe:animate-pulse rounded-full bg-muted" />
              <div className="h-5 w-14 motion-safe:animate-pulse rounded-full bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
