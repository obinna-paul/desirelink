import { PageHeader } from "@/components/layout/page-header";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Manage your account, privacy, and safety preferences."
      />
      <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
        Settings coming soon.
      </div>
    </div>
  );
}
