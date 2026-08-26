import { PageHeader } from "@/components/layout/page-header";

export default function CreatePage() {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="hidden md:block">
        <PageHeader
          title="Create"
          description="Share a post, start an event, or open a room."
        />
      </div>
      <div className="md:hidden">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Create
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Post, host, or start a room.</p>
      </div>
      <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground shadow-sm md:rounded-xl md:bg-transparent md:p-10 md:shadow-none">
        Creation tools coming soon.
      </div>
    </div>
  );
}
