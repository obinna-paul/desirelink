import { PageHeader } from "@/components/layout/page-header";

export default function EventsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Events"
        description="Find and host in-person and virtual gatherings."
      />
      <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
        Event listings coming soon.
      </div>
    </div>
  );
}
