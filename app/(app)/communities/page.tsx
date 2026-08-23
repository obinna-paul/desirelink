import { PageHeader } from "@/components/layout/page-header";

export default function CommunitiesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Communities"
        description="Join rooms built around shared interests."
      />
      <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
        Community rooms coming soon.
      </div>
    </div>
  );
}
