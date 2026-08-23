import { PageHeader } from "@/components/layout/page-header";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Home"
        description="Your feed of updates from people, creators, and communities you follow."
      />
      <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
        Feed coming soon.
      </div>
    </div>
  );
}
