"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

type TabKey = "all" | "verification" | "moderation" | "withdrawal" | "history";

export function InboxTabs({
  counts,
  verificationSection,
  moderationSection,
  withdrawalSection,
  historySection,
}: {
  counts: { verification: number; moderation: number; withdrawal: number };
  verificationSection: React.ReactNode | null;
  moderationSection: React.ReactNode | null;
  withdrawalSection: React.ReactNode | null;
  historySection: React.ReactNode;
}) {
  const [tab, setTab] = useState<TabKey>("all");

  const tabs: { key: TabKey; label: string; available: boolean }[] = [
    { key: "all", label: "All", available: true },
    {
      key: "verification",
      label: `Verification${counts.verification ? ` (${counts.verification})` : ""}`,
      available: verificationSection !== null,
    },
    {
      key: "moderation",
      label: `Reports${counts.moderation ? ` (${counts.moderation})` : ""}`,
      available: moderationSection !== null,
    },
    {
      key: "withdrawal",
      label: `Payouts${counts.withdrawal ? ` (${counts.withdrawal})` : ""}`,
      available: withdrawalSection !== null,
    },
    { key: "history", label: "History", available: true },
  ];

  const visibleTabs = tabs.filter((t) => t.available);
  const activeTab = visibleTabs.some((t) => t.key === tab) ? tab : "all";

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label="Inbox sections" className="flex gap-1 overflow-x-auto border-b border-border">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={activeTab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              activeTab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "all" && (
        <div className="flex flex-col gap-8">
          {verificationSection && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-foreground">Verification requests</h2>
              {verificationSection}
            </section>
          )}
          {moderationSection && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-foreground">Reports &amp; moderation</h2>
              {moderationSection}
            </section>
          )}
          {withdrawalSection && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-foreground">Withdrawal requests</h2>
              {withdrawalSection}
            </section>
          )}
          {!verificationSection && !moderationSection && !withdrawalSection && (
            <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
              Inbox is clear.
            </div>
          )}
        </div>
      )}

      {activeTab === "verification" && verificationSection}
      {activeTab === "moderation" && moderationSection}
      {activeTab === "withdrawal" && withdrawalSection}
      {activeTab === "history" && historySection}
    </div>
  );
}
