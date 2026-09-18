import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import { authOptions } from "@/lib/auth";
import { requireCapability } from "@/lib/admin/access";
import {
  getSpecTestLeads,
  getSpecTestProfileResults,
  getSpecTestTypeDistribution,
  getSpecTestConfidenceMix,
  getSpecTestConfidenceMixByForm,
  getSpecTestTypeDistributionByForm,
  getSpecTestItemAnalytics,
  getSpecTestDataSplitCounts,
  getSpecTestPilotAnalytics,
  reviewSpecTestPilot,
  SPEC_TYPE_READINGS,
  INSTRUMENT_VERSION,
} from "@/lib/spec-test";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { renderTerms } from "@/lib/spec-test/gender/render";

const GENDER_LABELS: Record<string, string> = { male: "Man", female: "Woman" };
const CONFIDENCE_BADGE_LABELS: Record<string, string> = { clear: "Clear", blend: "Blend", split: "Split" };

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

export default async function AdminSpecTestLeadsPage({
  searchParams,
}: {
  searchParams?: { cursor?: string; resultsCursor?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const gate = await requireCapability(session.user.id, "view_leads");
  if (!gate.ok) {
    notFound();
  }

  const [
    { items, nextCursor },
    { items: profileResults, nextCursor: profileResultsNextCursor },
    typeDistribution,
    confidenceMix,
    dataSplit,
    itemAnalytics,
    confidenceMixByForm,
    typeDistributionByForm,
    pilotAnalytics,
  ] = await Promise.all([
    getSpecTestLeads({ take: 50, cursor: searchParams?.cursor }),
    getSpecTestProfileResults({ take: 50, cursor: searchParams?.resultsCursor }),
    getSpecTestTypeDistribution(INSTRUMENT_VERSION),
    getSpecTestConfidenceMix(INSTRUMENT_VERSION),
    getSpecTestDataSplitCounts(INSTRUMENT_VERSION),
    getSpecTestItemAnalytics(INSTRUMENT_VERSION),
    getSpecTestConfidenceMixByForm(INSTRUMENT_VERSION),
    getSpecTestTypeDistributionByForm(INSTRUMENT_VERSION),
    getSpecTestPilotAnalytics(),
  ]);
  const pilotReview = reviewSpecTestPilot(pilotAnalytics);

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Spec Test</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Instrument health, registered members who&rsquo;ve taken the test, and everyone who asked for a copy of
          their result by email.
        </p>
      </div>

      <section
        aria-labelledby="pilot-health-heading"
        className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="pilot-health-heading" className="text-sm font-semibold text-foreground">
                v3 research pilot <span className="font-normal text-muted-foreground">({pilotAnalytics.instrumentVersion})</span>
              </h2>
              <Badge variant={pilotReview.status === "ready_for_modeling" ? "trust" : "outline"}>
                {pilotReview.status === "ready_for_modeling"
                  ? "Ready for modeling review"
                  : pilotReview.status === "review_required"
                    ? "Review required"
                    : "Collecting evidence"}
              </Badge>
            </div>
            <p className="mt-1 max-w-3xl text-[11px] leading-4 text-muted-foreground/70">
              Anonymous research data only. These submissions do not create public Specs or feed recommendations.
              Hold-out comparisons are monitoring signals, never permission to retune against the hold-out sample.
            </p>
          </div>
          <Link
            href="/api/admin/spec-test/pilot/export.csv"
            className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg border border-border/70 px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Download de-identified CSV
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border/40 p-3">
            <p className="text-[11px] text-muted-foreground">Consented starts</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{pilotAnalytics.startedAttempts}</p>
          </div>
          <div className="rounded-xl border border-border/40 p-3">
            <p className="text-[11px] text-muted-foreground">Completed submissions</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{pilotAnalytics.completedSubmissions}</p>
          </div>
          <div className="rounded-xl border border-border/40 p-3">
            <p className="text-[11px] text-muted-foreground">Completion rate</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{formatPercent(pilotAnalytics.completionRate)}</p>
          </div>
          <div className="rounded-xl border border-border/40 p-3">
            <p className="text-[11px] text-muted-foreground">Development / hold-out</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
              {pilotAnalytics.dataSplit.development} / {pilotAnalytics.dataSplit.holdout}
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="overflow-x-auto rounded-xl border border-border/40">
            <table className="w-full min-w-[620px] text-left text-xs">
              <caption className="px-3 py-2 text-left text-xs font-semibold text-foreground">
                Predeclared evidence gates
              </caption>
              <thead>
                <tr className="border-y border-border/40 text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Gate</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Current</th>
                  <th className="px-3 py-2 text-right font-medium">Target</th>
                </tr>
              </thead>
              <tbody>
                {pilotReview.gates.map((reviewGate) => (
                  <tr key={reviewGate.id} className="border-b border-border/30 last:border-0">
                    <td className="px-3 py-2">
                      <p className="font-medium text-foreground">{reviewGate.label}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{reviewGate.detail}</p>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={reviewGate.state === "pass" ? "trust" : "outline"}>
                        {reviewGate.state === "pass" ? "Pass" : reviewGate.state === "fail" ? "Fail" : "Pending"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{reviewGate.current}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{reviewGate.target}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-border/40 p-3" aria-labelledby="pilot-warning-heading">
            <div className="flex items-center justify-between gap-3">
              <h3 id="pilot-warning-heading" className="text-xs font-semibold text-foreground">
                Automatic review warnings
              </h3>
              <Badge variant="outline">{pilotReview.warnings.length}</Badge>
            </div>
            {pilotReview.warnings.length === 0 ? (
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                No threshold has fired. Warnings remain inactive until their minimum sample size is reached.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {pilotReview.warnings.map((warning) => (
                  <li key={warning.id} className="border-l-2 border-primary/50 pl-3">
                    <p className="text-xs font-medium text-foreground">Review: {warning.title}</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{warning.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {pilotAnalytics.startedAttempts === 0 ? (
          <p className="text-xs text-muted-foreground">No pilot attempts yet.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="overflow-x-auto rounded-xl border border-border/40">
              <table className="w-full min-w-[420px] text-left text-xs">
                <caption className="px-3 py-2 text-left text-xs font-semibold text-foreground">Completion funnel</caption>
                <thead>
                  <tr className="border-y border-border/40 text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Milestone</th>
                    <th className="px-3 py-2 text-right font-medium">Reached</th>
                    <th className="px-3 py-2 text-right font-medium">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {pilotAnalytics.funnel.map((point) => (
                    <tr key={point.completedCount} className="border-b border-border/30 last:border-0">
                      <td className="px-3 py-2 text-foreground">{point.label}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{point.attemptsReached}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatPercent(point.reachRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border/40">
              <table className="w-full min-w-[700px] text-left text-xs">
                <caption className="px-3 py-2 text-left text-xs font-semibold text-foreground">
                  Motive score distributions <span className="font-normal text-muted-foreground">(quality-clean rows)</span>
                </caption>
                <thead>
                  <tr className="border-y border-border/40 text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Dimension</th>
                    <th className="px-3 py-2 text-right font-medium">N</th>
                    <th className="px-3 py-2 text-right font-medium">Mean ± SD</th>
                    <th className="px-3 py-2 text-right font-medium">Range</th>
                    <th className="px-3 py-2 text-right font-medium">Dev mean</th>
                    <th className="px-3 py-2 text-right font-medium">Hold-out mean</th>
                  </tr>
                </thead>
                <tbody>
                  {pilotAnalytics.motives.map((motive) => (
                    <tr key={motive.dimension} className="border-b border-border/30 last:border-0">
                      <td className="px-3 py-2 font-medium text-foreground">{motive.label}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{motive.count}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {motive.mean === null ? "—" : `${motive.mean.toFixed(2)} ± ${motive.standardDeviation?.toFixed(2)}`}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {motive.minimum === null ? "—" : `${motive.minimum.toFixed(2)} to ${motive.maximum?.toFixed(2)}`}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {motive.developmentMean?.toFixed(2) ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {motive.holdoutMean?.toFixed(2) ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-foreground">Quality flags:</span>
          <span className="text-muted-foreground">
            {pilotAnalytics.qualityClean.total} clean · {pilotAnalytics.qualityFlaggedSubmissions} flagged submissions
          </span>
          {Object.keys(pilotAnalytics.qualityFlagCounts).length === 0 ? (
            <span className="text-muted-foreground">None recorded</span>
          ) : (
            Object.entries(pilotAnalytics.qualityFlagCounts).map(([flag, count]) => (
              <Badge key={flag} variant="outline">{flag}: {count}</Badge>
            ))
          )}
        </div>

        <details className="rounded-xl border border-border/40">
          <summary className="cursor-pointer px-3 py-3 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Pilot item diagnostics ({pilotAnalytics.items.length} items)
          </summary>
          <div className="overflow-x-auto border-t border-border/40">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead>
                <tr className="border-b border-border/40 text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 text-right font-medium">Answered</th>
                  <th className="px-3 py-2 text-right font-medium">Skip</th>
                  <th className="px-3 py-2 text-right font-medium">Median</th>
                  <th className="px-3 py-2 font-medium">Distribution</th>
                </tr>
              </thead>
              <tbody>
                {pilotAnalytics.items.map((item) => (
                  <tr key={item.itemId} className="border-b border-border/30 align-top last:border-0">
                    <td className="max-w-[18rem] px-3 py-2">
                      <p className="font-medium text-foreground">{item.itemId}</p>
                      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{item.prompt}</p>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{item.kind.replaceAll("_", " ")}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{item.answeredCount}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatPercent(item.skipRate)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{(item.medianElapsedMs / 1000).toFixed(1)}s</td>
                    <td className="min-w-[28rem] px-3 py-2 text-[11px] leading-4">
                      {item.kind === "best_worst" && (
                        <ul className="flex flex-col gap-1">
                          {item.options.map((option) => (
                            <li key={option.optionId} className="grid grid-cols-[1fr_auto_auto] gap-2">
                              <span className="text-muted-foreground">{option.label}</span>
                              <span className="tabular-nums text-foreground">Most {formatPercent(option.bestRate)}</span>
                              <span className="tabular-nums text-foreground">Least {formatPercent(option.worstRate)}</span>
                            </li>
                          ))}
                          <li className="mt-1 text-muted-foreground">
                            Position spread — Most: {item.bestPositionCounts.join(" / ")}; Least: {item.worstPositionCounts.join(" / ")}
                          </li>
                        </ul>
                      )}
                      {item.kind === "intensity" && (
                        <p className="text-muted-foreground">
                          Ratings 1–7: {item.ratingCounts.join(" / ")} · mean {item.meanRating?.toFixed(2) ?? "—"} · median {item.medianRating?.toFixed(1) ?? "—"}
                        </p>
                      )}
                      {item.kind === "single_choice" && (
                        <ul className="flex flex-col gap-1">
                          {item.options.map((option) => (
                            <li key={option.optionId} className="flex justify-between gap-3">
                              <span className="text-muted-foreground">{option.label}</span>
                              <span className="shrink-0 tabular-nums text-foreground">{option.chosenCount} · {formatPercent(option.choiceRate)}</span>
                            </li>
                          ))}
                          <li className="mt-1 text-muted-foreground">Position spread: {item.positionCounts.join(" / ")}</li>
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Type distribution{" "}
              <span className="font-normal text-muted-foreground">({INSTRUMENT_VERSION})</span>
            </h2>
            <p className="mt-1 text-[11px] text-muted-foreground/70">
              Current instrument only; legacy versions are intentionally excluded.
            </p>
          </div>
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
            <table className="w-full min-w-[920px] text-left text-xs">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium">Answered</th>
                  <th className="px-3 py-2 font-medium">Skip rate</th>
                  <th className="px-3 py-2 font-medium">Median time</th>
                  <th className="px-3 py-2 font-medium">Position spread (1-4)</th>
                  <th className="px-3 py-2 font-medium">Option choices</th>
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
                    <td className="px-3 py-2">
                      <ul className="flex min-w-[22rem] flex-col gap-1.5">
                        {row.options.map((option, optionIndex) => (
                          <li key={option.optionId} className="flex items-start gap-2 text-[11px] leading-4">
                            <span className="w-5 shrink-0 font-semibold text-foreground">
                              {String.fromCharCode(65 + optionIndex)}
                            </span>
                            <span className="min-w-0 flex-1 text-muted-foreground">
                              {renderTerms(option.label, "neutral")}
                            </span>
                            <span className="shrink-0 tabular-nums text-foreground">
                              {option.chosenCount} &middot; {formatPercent(option.choiceRate)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Members who&rsquo;ve taken the test</h2>
        {profileResults.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground shadow-sm md:rounded-xl md:bg-transparent md:shadow-none">
            No registered member has taken the test yet.
          </div>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {profileResults.map((result) => (
                <li
                  key={result.id}
                  className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm md:rounded-xl md:shadow-none"
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={result.profile.avatarUrl} alt={result.profile.displayName} />
                    <AvatarFallback className="text-xs">
                      {result.profile.displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/profile/${result.profile.username}`}
                      className="text-sm font-medium text-foreground hover:text-primary hover:underline"
                    >
                      @{result.profile.username}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline">{SPEC_TYPE_READINGS[result.specType]?.name ?? result.specType}</Badge>
                      {result.resultConfidence && CONFIDENCE_BADGE_LABELS[result.resultConfidence] && (
                        <Badge>{CONFIDENCE_BADGE_LABELS[result.resultConfidence]}</Badge>
                      )}
                      {result.gender && (
                        <span className="text-xs text-muted-foreground">{GENDER_LABELS[result.gender] ?? result.gender}</span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground" title={new Date(result.createdAt).toISOString()}>
                    {formatDistanceToNow(new Date(result.createdAt), { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>

            {profileResultsNextCursor && (
              <Link
                href={`/admin/spec-test?resultsCursor=${profileResultsNextCursor}`}
                className="mt-3 block self-center text-center text-sm font-medium text-primary hover:underline"
              >
                Load more
              </Link>
            )}
          </>
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
