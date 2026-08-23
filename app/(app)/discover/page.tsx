import { PageHeader } from "@/components/layout/page-header";

export default function DiscoverPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Discover"
        description="Browse people, creators, and communities near you."
      />
      <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
        Discovery feed coming soon.
      </div>
    </div>
  );
}
