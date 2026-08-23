import { PageHeader } from "@/components/layout/page-header";

export default function MessagesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Messages"
        description="Direct conversations with your connections."
      />
      <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
        Conversations will appear here.
      </div>
    </div>
  );
}
