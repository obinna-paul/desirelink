import { PageHeader } from "@/components/layout/page-header";

export default function CreatePage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Create"
        description="Share a post, start an event, or open a room."
      />
      <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
        Creation tools coming soon.
      </div>
    </div>
  );
}
