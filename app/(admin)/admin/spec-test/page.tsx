import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import { authOptions } from "@/lib/auth";
import { requireCapability } from "@/lib/admin/access";
import {
  getSpecTestLeads,
  getSpecTestTypeDistribution,
  getSpecTestConfidenceMix,
  getSpecTestConfidenceMixByForm,
  getSpecTestTypeDistributionByForm,
  getSpecTestItemAnalytics,
  getSpecTestDataSplitCounts,
  SPEC_TYPE_READINGS,
  INSTRUMENT_VERSION,
} from "@/lib/spec-test";
import { Badge } from "@/components/ui/badge";

const FORM_LABELS: Record<"male_user" | "female_user", string> = {
  male_user: "Woman takers (male_user)",
  female_user: "Man takers (female_user)",
};

export const dynamic = "force-dynamic";

const CONFIDENCE_LABELS: Record<"clear" | "blend" | "split" | "lowSignal", string> = {
  clear: "Clear",
  blend: "Blend",
  split: "Split",
  lowSignal: "Low signal",
};

function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export default async function AdminSpecTestLeadsPage({ searchParams }: { searchParams?: { cursor?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const gate = await requireCapability(session.user.id, "view_leads");
  if (!gate.ok) {
    notFound();
  }

  const [{ items, nextCursor }, typeDistribution, confidenceMix, dataSplit, itemAnalytics, confidenceMixByForm, typeDistributionByForm] =
    await Promise.all([
      getSpecTestLeads({ take: 50, cursor: searchParams?.cursor }),
      getSpecTestTypeDistribution(),
      getSpecTestConfidenceMix(INSTRUMENT_VERSION),
      getSpecTestDataSplitCounts(INSTRUMENT_VERSION),
      getSpecTestItemAnalytics(INSTRUMENT_VERSION),
      getSpecTestConfidenceMixByForm(INSTRUMENT_VERSION),
      getSpecTestTypeDistributionByForm(),
    ]);

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Spec Test</h1>
        <p className="mt-1 text-sm text-muted-foreground">Instrument health and everyone who asked for a copy of their result by email.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Type distribution</h2>
          {typeDistribution.length === 0 ? (
            <p className="text-xs text-muted-foreground">No results yet.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {typeDistribution.map((row) => (
                <li key={row.specType} className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{row.name}</span>
                  <span className="font-semibold text-muted-foreground">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">
            Confidence mix <span className="font-normal text-muted-foreground">({INSTRUMENT_VERSION})</span>
          </h2>
          {confidenceMix.totalAttempts === 0 ? (
            <p className="text-xs text-muted-foreground">No v2 submit attempts yet.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-1.5">
                <li className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{CONFIDENCE_LABELS.clear}</span>
                  <span className="font-semibold text-muted-foreground">
                    {confidenceMix.clear} &middot; {formatPercent(confidenceMix.rates.clear)}
                  </span>
                </li>
                <li className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{CONFIDENCE_LABELS.blend}</span>
                  <span className="font-semibold text-muted-foreground">
                    {confidenceMix.blend} &middot; {formatPercent(confidenceMix.rates.blend)}
                  </span>
                </li>
                <li className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{CONFIDENCE_LABELS.split}</span>
                  <span className="font-semibold text-muted-foreground">
                    {confidenceMix.split} &middot; {formatPercent(confidenceMix.rates.split)}
                  </span>
                </li>
                <li className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{CONFIDENCE_LABELS.lowSignal}</span>
                  <span className="font-semibold text-muted-foreground">
                    {confidenceMix.lowSignal} &middot; {formatPercent(confidenceMix.rates.low_signal)}
                  </span>
                </li>
              </ul>
              <p className="text-[11px] text-muted-foreground/70">
                {confidenceMix.totalAttempts} total submit attempts &middot; {dataSplit.development} development /{" "}
                {dataSplit.holdout} hold-out
              </p>
            </>
          )}
          {/* Quiz drop-off by section (plan §11) isn't shown here - it needs a beacon
              recording partial progress before submit, which doesn't exist yet. See
              lib/spec-test/admin-stats.ts's file comment. */}
        </section>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            By form <span className="font-normal text-muted-foreground">({INSTRUMENT_VERSION})</span>
          </h2>
          <p className="mt-1 text-[11px] text-muted-foreground/70">
            Gender only ever changes which pronouns the questions use (Spec Test gender
            plan, report §10) - it never changes scoring. A gap between forms here is a
            starting point for investigation, not evidence of an innate difference: rule out
            sample size, wording, and item bias before drawing any conclusion from it.
          </p>
        </div>
        {confidenceMixByForm.every((form) => form.totalAttempts === 0) ? (
          <p className="text-xs text-muted-foreground">No v2.1 submit attempts yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {confidenceMixByForm.map((form) => {
              const distribution = typeDistributionByForm.find((row) => row.quizForm === form.quizForm)?.rows ?? [];
              return (
                <div key={form.quizForm} className="flex flex-col gap-2 rounded-xl border border-border/40 p-3">
                  <p className="text-xs font-semibold text-foreground">{FORM_LABELS[form.quizForm]}</p>
                  {form.totalAttempts === 0 ? (
                    <p className="text-xs text-muted-foreground">No attempts yet.</p>
                  ) : (
                    <>
                      <ul className="flex flex-col gap-1">
                        {(["clear", "blend", "split"] as const).map((key) => (
                          <li key={key} className="flex items-center justify-between text-xs">
                            <span className="text-foreground">{CONFIDENCE_LABELS[key]}</span>
                            <span className="font-semibold text-muted-foreground">
                              {form[key]} &middot; {formatPercent(form.rates[key])}
                            </span>
                          </li>
                        ))}
                        <li className="flex items-center justify-between text-xs">
                          <span className="text-foreground">{CONFIDENCE_LABELS.lowSignal}</span>
                          <span className="font-semibold text-muted-foreground">
                            {form.lowSignal} &middot; {formatPercent(form.rates.low_signal)}
                          </span>
                        </li>
                      </ul>
                      <p className="text-[11px] text-muted-foreground/70">{form.totalAttempts} total submit attempts</p>
                      {distribution.length > 0 && (
                        <ul className="mt-1 flex flex-col gap-1 border-t border-border/40 pt-2">
                          {distribution.slice(0, 3).map((row) => (
                            <li key={row.specType} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{row.name}</span>
                              <span className="font-semibold text-muted-foreground">{row.count}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-foreground">
          Item analytics <span className="font-normal text-muted-foreground">({INSTRUMENT_VERSION})</span>
        </h2>
        {itemAnalytics.every((row) => row.answeredCount === 0 && row.skippedCount === 0) ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground shadow-sm md:rounded-xl md:bg-transparent md:shadow-none">
            No v2 responses yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card shadow-sm">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium">Answered</th>
                  <th className="px-3 py-2 font-medium">Skip rate</th>
                  <th className="px-3 py-2 font-medium">Median time</th>
                  <th className="px-3 py-2 font-medium">Position spread (1-4)</th>
                </tr>
              </thead>
              <tbody>
                {itemAnalytics.map((row) => (
                  <tr key={row.itemId} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2 font-medium text-foreground">{row.itemId}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.answeredCount}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatPercent(row.skipRate)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{(row.medianElapsedMs / 1000).toFixed(1)}s</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.positionCounts.join(" / ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Leads</h2>
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground shadow-sm md:rounded-xl md:bg-transparent md:shadow-none">
            No leads yet.
          </div>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {items.map((lead) => (
                <li
                  key={lead.id}
                  className="flex flex-col gap-1.5 rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm md:rounded-xl md:shadow-none"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{SPEC_TYPE_READINGS[lead.specType]?.name ?? lead.specType}</Badge>
                    {lead.consentMarketing && <Badge>Marketing OK</Badge>}
                    {lead.joinedUsername && (
                      <Link href={`/profile/${lead.joinedUsername}`} className="text-xs font-medium text-primary hover:underline">
                        Joined as @{lead.joinedUsername}
                      </Link>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground" title={new Date(lead.createdAt).toISOString()}>
                      {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">{lead.email}</p>
                </li>
              ))}
            </ul>

            {nextCursor && (
              <Link
                href={`/admin/spec-test?cursor=${nextCursor}`}
                className="mt-3 block self-center text-center text-sm font-medium text-primary hover:underline"
              >
                Load more
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
