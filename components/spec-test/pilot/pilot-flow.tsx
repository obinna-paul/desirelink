"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, FlaskConical, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/ui/progress-ring";
import {
  SPEC_TEST_ITEMS_V3_PILOT,
  V3_PILOT_INSTRUMENT_VERSION,
  type SpecItemV3Pilot,
} from "@/lib/spec-test/items/spec-v3-pilot";
import { V3_PILOT_CONSENT_VERSION } from "@/lib/spec-test/pilot-v3-feature";
import type { SpecTestResponseV3 } from "@/lib/spec-test/response";
import { BestWorstQuestion, type BestWorstSelection } from "./best-worst-question";
import { IntensityQuestion } from "./intensity-question";
import { SingleChoiceQuestion } from "./single-choice-question";

const DRAFT_STORAGE_KEY = "spec-test-v3-pilot-draft";
const TOTAL_ITEMS = SPEC_TEST_ITEMS_V3_PILOT.length;

type PilotStep = "consent" | "question" | "submitting" | "complete" | "error";

type PilotDraft = {
  instrumentVersion: typeof V3_PILOT_INSTRUMENT_VERSION;
  attemptId: string | null;
  researchConsent: boolean;
  responses: Record<string, SpecTestResponseV3>;
  optionOrders: Record<string, number[]>;
};

type WorkingAnswer =
  | { kind: "best_worst"; selection: BestWorstSelection }
  | { kind: "intensity"; rating: 1 | 2 | 3 | 4 | 5 | 6 | 7 | null }
  | { kind: "single_choice"; optionId: string | null };

function emptyDraft(): PilotDraft {
  return {
    instrumentVersion: V3_PILOT_INSTRUMENT_VERSION,
    attemptId: null,
    researchConsent: false,
    responses: {},
    optionOrders: {},
  };
}

function loadDraft(): PilotDraft {
  if (typeof window === "undefined") return emptyDraft();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DRAFT_STORAGE_KEY) ?? "null") as PilotDraft | null;
    if (!parsed || parsed.instrumentVersion !== V3_PILOT_INSTRUMENT_VERSION) return emptyDraft();
    return {
      ...parsed,
      attemptId: parsed.researchConsent ? (parsed.attemptId ?? crypto.randomUUID()) : null,
    };
  } catch {
    return emptyDraft();
  }
}

function saveDraft(draft: PilotDraft) {
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Research participation must remain usable when storage is blocked or full.
  }
}

function clearDraft() {
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Best effort only.
  }
}

function shuffledIndexes(): number[] {
  const indexes = [0, 1, 2, 3];
  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [indexes[index], indexes[other]] = [indexes[other], indexes[index]];
  }
  return indexes;
}

function allOptionOrders(): Record<string, number[]> {
  return Object.fromEntries(
    SPEC_TEST_ITEMS_V3_PILOT.filter((item) => item.kind !== "intensity").map((item) => [
      item.id,
      shuffledIndexes(),
    ]),
  );
}

function firstUnansweredIndex(responses: Record<string, SpecTestResponseV3>): number {
  const index = SPEC_TEST_ITEMS_V3_PILOT.findIndex((item) => !responses[item.id]);
  return index === -1 ? TOTAL_ITEMS : index;
}

function workingAnswer(item: SpecItemV3Pilot | undefined, response?: SpecTestResponseV3): WorkingAnswer {
  if (!item || item.kind === "intensity") {
    return {
      kind: "intensity",
      rating: response?.kind === "intensity" && !response.skipped ? response.rating : null,
    };
  }
  if (item.kind === "best_worst") {
    return {
      kind: "best_worst",
      selection: {
        bestOptionId: response?.kind === "best_worst" && !response.skipped ? response.bestOptionId : null,
        worstOptionId: response?.kind === "best_worst" && !response.skipped ? response.worstOptionId : null,
      },
    };
  }
  return {
    kind: "single_choice",
    optionId: response?.kind === "single_choice" && !response.skipped ? response.optionId : null,
  };
}

function phaseLabel(index: number): string {
  if (index < 16) return "Attraction choices";
  if (index < 24) return "Attraction intensity";
  return "Under uncertainty";
}

export function SpecTestPilotFlow() {
  const initialRef = useRef<PilotDraft | null>(null);
  if (initialRef.current === null) initialRef.current = loadDraft();
  const initial = initialRef.current;
  const initialIndex = firstUnansweredIndex(initial.responses);

  const [step, setStep] = useState<PilotStep>(() =>
    !initial.researchConsent ? "consent" : initialIndex >= TOTAL_ITEMS ? "submitting" : "question",
  );
  const [attemptId, setAttemptId] = useState<string | null>(initial.attemptId);
  const [itemIndex, setItemIndex] = useState(initialIndex);
  const [responses, setResponses] = useState(initial.responses);
  const [optionOrders, setOptionOrders] = useState(initial.optionOrders);
  const [answer, setAnswer] = useState<WorkingAnswer>(() =>
    workingAnswer(SPEC_TEST_ITEMS_V3_PILOT[initialIndex], initial.responses[SPEC_TEST_ITEMS_V3_PILOT[initialIndex]?.id]),
  );
  const [error, setError] = useState<string | null>(null);
  const itemStartedAt = useRef(Date.now());
  const submittingRef = useRef(false);

  const currentItem = SPEC_TEST_ITEMS_V3_PILOT[itemIndex];
  const currentOrder = currentItem?.kind === "intensity" ? [] : optionOrders[currentItem?.id] ?? [0, 1, 2, 3];

  useEffect(() => {
    if (!currentItem) return;
    setAnswer(workingAnswer(currentItem, responses[currentItem.id]));
    itemStartedAt.current = Date.now();
    setError(null);
  }, [currentItem, responses]);

  useEffect(() => {
    if (step !== "submitting" || submittingRef.current) return;
    submittingRef.current = true;
    const orderedResponses = SPEC_TEST_ITEMS_V3_PILOT.map((item) => responses[item.id]).filter(
      (response): response is SpecTestResponseV3 => Boolean(response),
    );

    void fetch("/api/spec-test/pilot/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instrumentVersion: V3_PILOT_INSTRUMENT_VERSION,
        attemptId,
        researchConsent: true,
        consentVersion: V3_PILOT_CONSENT_VERSION,
        responses: orderedResponses,
      }),
    })
      .then(async (response) => {
        const body = (await response.json()) as { submissionId?: string; error?: string };
        if (!response.ok || !body.submissionId) throw new Error(body.error ?? "We couldn't save the pilot response.");
        clearDraft();
        setStep("complete");
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "We couldn't save the pilot response.");
        setStep("error");
      });
  }, [attemptId, responses, step]);

  function recordProgress(nextAttemptId: string, completedCount: number) {
    void fetch("/api/spec-test/pilot/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attemptId: nextAttemptId,
        instrumentVersion: V3_PILOT_INSTRUMENT_VERSION,
        consentVersion: V3_PILOT_CONSENT_VERSION,
        completedCount,
      }),
    }).catch(() => {
      // Completion telemetry is deliberately best-effort and never blocks participation.
    });
  }

  function acceptConsent() {
    const nextAttemptId = attemptId ?? crypto.randomUUID();
    const nextOrders = Object.keys(optionOrders).length > 0 ? optionOrders : allOptionOrders();
    setAttemptId(nextAttemptId);
    setOptionOrders(nextOrders);
    saveDraft({
      instrumentVersion: V3_PILOT_INSTRUMENT_VERSION,
      attemptId: nextAttemptId,
      researchConsent: true,
      responses,
      optionOrders: nextOrders,
    });
    recordProgress(nextAttemptId, Object.keys(responses).length);
    setStep("question");
  }

  function responseForCurrent(skipped = false): SpecTestResponseV3 | null {
    if (!currentItem) return null;
    const elapsedMs = Math.max(0, Date.now() - itemStartedAt.current);
    if (currentItem.kind === "best_worst") {
      const selection = answer.kind === "best_worst" ? answer.selection : { bestOptionId: null, worstOptionId: null };
      if (!skipped && (!selection.bestOptionId || !selection.worstOptionId)) return null;
      return {
        itemId: currentItem.id,
        kind: "best_worst",
        bestOptionId: skipped ? null : selection.bestOptionId,
        worstOptionId: skipped ? null : selection.worstOptionId,
        bestPresentedIndex: skipped
          ? null
          : currentOrder.findIndex((canonicalIndex) => currentItem.options[canonicalIndex].id === selection.bestOptionId),
        worstPresentedIndex: skipped
          ? null
          : currentOrder.findIndex((canonicalIndex) => currentItem.options[canonicalIndex].id === selection.worstOptionId),
        elapsedMs,
        skipped: skipped || undefined,
      };
    }
    if (currentItem.kind === "intensity") {
      const rating = answer.kind === "intensity" ? answer.rating : null;
      if (!skipped && rating === null) return null;
      return { itemId: currentItem.id, kind: "intensity", rating: skipped ? null : rating, elapsedMs, skipped: skipped || undefined };
    }
    const optionId = answer.kind === "single_choice" ? answer.optionId : null;
    if (!skipped && !optionId) return null;
    return {
      itemId: currentItem.id,
      kind: "single_choice",
      optionId: skipped ? null : optionId,
      presentedIndex: skipped
        ? null
        : currentOrder.findIndex((canonicalIndex) => currentItem.options[canonicalIndex].id === optionId),
      elapsedMs,
      skipped: skipped || undefined,
    };
  }

  function commitCurrent(skipped = false) {
    const response = responseForCurrent(skipped);
    if (!response) {
      setError(currentItem?.kind === "best_worst" ? "Choose one Most and one Least to continue." : "Choose an answer to continue.");
      return;
    }
    const nextResponses = { ...responses, [response.itemId]: response };
    const nextIndex = itemIndex + 1;
    setResponses(nextResponses);
    setItemIndex(nextIndex);
    saveDraft({
      instrumentVersion: V3_PILOT_INSTRUMENT_VERSION,
      attemptId,
      researchConsent: true,
      responses: nextResponses,
      optionOrders,
    });
    if (attemptId) recordProgress(attemptId, Object.keys(nextResponses).length);
    if (nextIndex >= TOTAL_ITEMS) setStep("submitting");
  }

  function goBack() {
    if (itemIndex <= 0) return;
    setItemIndex((index) => index - 1);
  }

  function retrySubmit() {
    submittingRef.current = false;
    setError(null);
    setStep("submitting");
  }

  if (step === "consent") {
    return (
      <div className="flex flex-col items-center gap-6 text-center" data-testid="v3-pilot-consent">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-tint">
          <FlaskConical className="h-5 w-5 text-primary" aria-hidden="true" />
        </span>
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Research pilot</p>
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">Help us test a more accurate Spec Test</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            This experimental version asks 28 questions and does not give a Spec result yet. Your answers are stored
            anonymously for item and scoring research, are not linked to your profile, and are not used for marketing
            or recommendations. We also record only how many questions an anonymous attempt completes so we can find
            confusing drop-off points. You can stop at any time.
          </p>
        </div>
        <Button size="lg" className="min-h-11 w-full max-w-sm gap-2" onClick={acceptConsent} data-testid="v3-pilot-start">
          I agree and start the pilot
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button asChild variant="ghost" className="min-h-11">
          <Link href="/spec-test">No thanks</Link>
        </Button>
      </div>
    );
  }

  if (step === "submitting") {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center" role="status">
        <Loader2 className="h-7 w-7 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
        <h1 className="font-heading text-2xl font-bold">Saving your pilot responses</h1>
        <p className="text-sm text-muted-foreground">This does not create or change your public Spec.</p>
      </div>
    );
  }

  if (step === "complete") {
    return (
      <div className="flex flex-col items-center gap-5 py-6 text-center" data-testid="v3-pilot-complete">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-tint">
          <FlaskConical className="h-5 w-5 text-primary" aria-hidden="true" />
        </span>
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">Thank you—your pilot response is in</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          We stored it anonymously for research. The live Spec Test remains available if you want a current result.
        </p>
        <Button asChild size="lg" className="min-h-11 w-full max-w-xs">
          <Link href="/spec-test">Go to the live Spec Test</Link>
        </Button>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="flex flex-col items-center gap-5 py-6 text-center" role="alert">
        <h1 className="font-heading text-2xl font-bold">Your answers are still saved on this device</h1>
        <p className="text-sm text-destructive">{error}</p>
        <Button size="lg" className="min-h-11 w-full max-w-xs" onClick={retrySubmit}>
          Try saving again
        </Button>
      </div>
    );
  }

  if (!currentItem) return null;

  return (
    <div className="flex flex-col gap-7" data-testid="v3-pilot-question">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={goBack}
          disabled={itemIndex === 0}
          aria-label="Back to previous pilot question"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent-tint hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <ProgressRing progress={(itemIndex / TOTAL_ITEMS) * 100} size={40} className="shrink-0 text-primary" />
        <div>
          <p className="text-xs font-semibold text-foreground">{phaseLabel(itemIndex)}</p>
          <p className="text-xs text-muted-foreground">Question {itemIndex + 1} of {TOTAL_ITEMS}</p>
        </div>
        <button
          type="button"
          onClick={() => commitCurrent(true)}
          className="ml-auto min-h-11 px-2 text-xs font-medium text-muted-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Skip
        </button>
      </div>

      {currentItem.kind === "best_worst" && (
        <BestWorstQuestion
          item={currentItem}
          value={answer.kind === "best_worst" ? answer.selection : { bestOptionId: null, worstOptionId: null }}
          onChange={(selection) => {
            setAnswer({ kind: "best_worst", selection });
            setError(null);
          }}
          optionOrder={currentOrder}
        />
      )}
      {currentItem.kind === "intensity" && (
        <IntensityQuestion
          item={currentItem}
          value={answer.kind === "intensity" ? answer.rating : null}
          onChange={(rating) => {
            setAnswer({ kind: "intensity", rating });
            setError(null);
          }}
        />
      )}
      {currentItem.kind === "single_choice" && (
        <SingleChoiceQuestion
          item={currentItem}
          value={answer.kind === "single_choice" ? answer.optionId : null}
          onChange={(optionId) => {
            setAnswer({ kind: "single_choice", optionId });
            setError(null);
          }}
          optionOrder={currentOrder}
        />
      )}

      {error && <p className="text-sm font-medium text-destructive" role="alert">{error}</p>}
      <Button size="lg" className="min-h-11 w-full" onClick={() => commitCurrent(false)} data-testid="v3-pilot-next">
        {itemIndex === TOTAL_ITEMS - 1 ? "Send pilot responses" : "Next question"}
      </Button>
    </div>
  );
}
