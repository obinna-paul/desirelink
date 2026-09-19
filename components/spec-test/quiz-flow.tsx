"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronLeft, Loader2 } from "lucide-react";

import { BestWorstQuestion, type BestWorstSelection } from "@/components/spec-test/pilot/best-worst-question";
import { IntensityQuestion } from "@/components/spec-test/pilot/intensity-question";
import { SingleChoiceQuestion } from "@/components/spec-test/pilot/single-choice-question";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/ui/progress-ring";
import { routeForm, type Gender } from "@/lib/spec-test/gender/forms";
import type { RenderForm } from "@/lib/spec-test/gender/terms";
import { SPEC_TEST_ITEMS_V3, V3_INSTRUMENT_VERSION, type SpecItemV3 } from "@/lib/spec-test/items/spec-v3";
import type { SpecTestResponseV3 } from "@/lib/spec-test/response";
import { cn } from "@/lib/utils";

const DRAFT_STORAGE_KEY = "spec-test-draft-v3";
const TOTAL_ITEMS = SPEC_TEST_ITEMS_V3.length;
const PHASE_STARTS = new Set([0, 16, 24]);
const QUESTION_EXIT_MS = 280;

const PHASE_COPY: Record<number, { eyebrow: string; title: string; body: string }> = {
  0: {
    eyebrow: "Part 1 of 3",
    title: "First: what catches your eye?",
    body: "No overthinking. Pick the answer that pulls you in, then the one that does the least for you.",
  },
  16: {
    eyebrow: "Part 2 of 3",
    title: "Quick gut check",
    body: "Tell us how strongly each quality pulls you in. Your first reaction is enough.",
  },
  24: {
    eyebrow: "Part 3 of 3",
    title: "Last four",
    body: "A few real-life moments. Choose what you would naturally do first.",
  },
};

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "female", label: "I’m a woman" },
  { value: "male", label: "I’m a man" },
];

type Step = "gender" | "phase-intro" | "question" | "submitting" | "low-signal";
type MotionDirection = "forward" | "backward";
type MotionPhase = "entering" | "exiting";

type Draft = {
  instrumentVersion: typeof V3_INSTRUMENT_VERSION;
  gender: Gender | null;
  responses: Record<string, SpecTestResponseV3>;
  optionOrders: Record<string, number[]>;
};

type WorkingAnswer =
  | { kind: "best_worst"; selection: BestWorstSelection }
  | { kind: "intensity"; rating: 1 | 2 | 3 | 4 | 5 | 6 | 7 | null }
  | { kind: "single_choice"; optionId: string | null };

function emptyDraft(): Draft {
  return { instrumentVersion: V3_INSTRUMENT_VERSION, gender: null, responses: {}, optionOrders: {} };
}

function loadDraft(): Draft {
  if (typeof window === "undefined") return emptyDraft();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DRAFT_STORAGE_KEY) ?? "null") as Draft | null;
    if (!parsed || parsed.instrumentVersion !== V3_INSTRUMENT_VERSION) return emptyDraft();
    return { ...emptyDraft(), ...parsed };
  } catch {
    return emptyDraft();
  }
}

function saveDraft(draft: Draft) {
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // A blocked or full local store should never stop the test.
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

function firstUnansweredIndex(responses: Record<string, SpecTestResponseV3>): number {
  const index = SPEC_TEST_ITEMS_V3.findIndex((item) => !responses[item.id]);
  return index === -1 ? TOTAL_ITEMS : index;
}

function workingAnswer(item: SpecItemV3 | undefined, response?: SpecTestResponseV3): WorkingAnswer {
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
  if (index < 16) return "What catches your eye";
  if (index < 24) return "How strong is the pull";
  return "Your relationship instinct";
}

function questionExitDelay(): number {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return 0;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : QUESTION_EXIT_MS;
}

export function SpecTestQuizFlow() {
  const router = useRouter();
  const initialRef = useRef<Draft | null>(null);
  if (initialRef.current === null) initialRef.current = loadDraft();
  const initial = initialRef.current;
  const initialIndex = firstUnansweredIndex(initial.responses);

  const [step, setStep] = useState<Step>(() => {
    if (!initial.gender) return "gender";
    if (initialIndex >= TOTAL_ITEMS) return "submitting";
    return PHASE_STARTS.has(initialIndex) ? "phase-intro" : "question";
  });
  const [gender, setGender] = useState<Gender | null>(initial.gender);
  const [itemIndex, setItemIndex] = useState(initialIndex);
  const [responses, setResponses] = useState(initial.responses);
  const [optionOrders, setOptionOrders] = useState(initial.optionOrders);
  const [answer, setAnswer] = useState<WorkingAnswer>(() =>
    workingAnswer(SPEC_TEST_ITEMS_V3[initialIndex], initial.responses[SPEC_TEST_ITEMS_V3[initialIndex]?.id]),
  );
  const [error, setError] = useState<string | null>(null);
  const [lowSignalFlags, setLowSignalFlags] = useState<string[]>([]);
  const [motionDirection, setMotionDirection] = useState<MotionDirection>("forward");
  const [motionPhase, setMotionPhase] = useState<MotionPhase>("entering");
  const itemStartedAt = useRef(Date.now());
  const submittingRef = useRef(false);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentItem = SPEC_TEST_ITEMS_V3[itemIndex];
  const form: RenderForm = gender ? routeForm(gender).quizForm : "neutral";
  const currentOrder = currentItem?.kind === "intensity"
    ? []
    : optionOrders[currentItem?.id] ?? [0, 1, 2, 3];
  const isTransitioning = motionPhase === "exiting";

  useEffect(() => () => {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
  }, []);

  useEffect(() => {
    if (!currentItem) return;
    setAnswer(workingAnswer(currentItem, responses[currentItem.id]));
    itemStartedAt.current = Date.now();
    setError(null);
  }, [currentItem, responses]);

  useEffect(() => {
    if (step === "submitting" || step === "low-signal") return;
    saveDraft({ instrumentVersion: V3_INSTRUMENT_VERSION, gender, responses, optionOrders });
  }, [gender, optionOrders, responses, step]);

  useEffect(() => {
    if (step !== "submitting" || submittingRef.current || !gender) return;
    submittingRef.current = true;
    const orderedResponses = SPEC_TEST_ITEMS_V3.map((item) => responses[item.id]).filter(
      (response): response is SpecTestResponseV3 => Boolean(response),
    );

    void fetch("/api/spec-test/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instrumentVersion: V3_INSTRUMENT_VERSION, gender, responses: orderedResponses }),
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          resultId?: string;
          lowSignal?: boolean;
          flags?: string[];
          error?: string;
        } | null;
        if (!response.ok) {
          if (body?.resultId) {
            clearDraft();
            router.push(`/spec-test/result/${body.resultId}`);
            return;
          }
          throw new Error(body?.error ?? "We couldn’t score your answers. Please try again.");
        }
        if (body?.lowSignal) {
          clearDraft();
          setLowSignalFlags(Array.isArray(body.flags) ? body.flags : []);
          setStep("low-signal");
          return;
        }
        if (!body?.resultId) throw new Error("We couldn’t find your result. Please try again.");
        clearDraft();
        router.push(`/spec-test/result/${body.resultId}`);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "We couldn’t score your answers. Please try again.");
      });
  }, [gender, responses, router, step]);

  function chooseGender(value: Gender) {
    setGender(value);
    setItemIndex(0);
    setStep("phase-intro");
  }

  function ensureOptionOrder(item: SpecItemV3 | undefined) {
    if (!item || item.kind === "intensity" || optionOrders[item.id]) return;
    setOptionOrders((current) => ({ ...current, [item.id]: shuffledIndexes() }));
  }

  function continueFromIntro() {
    ensureOptionOrder(currentItem);
    itemStartedAt.current = Date.now();
    setMotionDirection("forward");
    setMotionPhase("entering");
    setStep("question");
  }

  function transitionQuestion(direction: MotionDirection, complete: () => void) {
    if (isTransitioning) return;
    setMotionDirection(direction);
    setMotionPhase("exiting");

    const finish = () => {
      transitionTimerRef.current = null;
      complete();
      setMotionPhase("entering");
    };
    const delay = questionExitDelay();
    if (delay === 0) finish();
    else transitionTimerRef.current = setTimeout(finish, delay);
  }

  function responseForCurrent(skipped = false): SpecTestResponseV3 | null {
    if (!currentItem) return null;
    const elapsedMs = Math.max(0, Date.now() - itemStartedAt.current);
    if (currentItem.kind === "best_worst") {
      const selection = answer.kind === "best_worst"
        ? answer.selection
        : { bestOptionId: null, worstOptionId: null };
      if (!skipped && (!selection.bestOptionId || !selection.worstOptionId)) return null;
      return {
        itemId: currentItem.id,
        kind: "best_worst",
        bestOptionId: skipped ? null : selection.bestOptionId,
        worstOptionId: skipped ? null : selection.worstOptionId,
        bestPresentedIndex: skipped ? null : currentOrder.findIndex((index) => currentItem.options[index].id === selection.bestOptionId),
        worstPresentedIndex: skipped ? null : currentOrder.findIndex((index) => currentItem.options[index].id === selection.worstOptionId),
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
      presentedIndex: skipped ? null : currentOrder.findIndex((index) => currentItem.options[index].id === optionId),
      elapsedMs,
      skipped: skipped || undefined,
    };
  }

  function commitCurrent(skipped = false) {
    if (isTransitioning) return;
    const response = responseForCurrent(skipped);
    if (!response) {
      setError(currentItem?.kind === "best_worst"
        ? "Choose one “My type” and one “Not really” to continue."
        : "Choose an answer to continue.");
      return;
    }
    const nextResponses = { ...responses, [response.itemId]: response };
    const nextIndex = itemIndex + 1;
    setResponses(nextResponses);
    transitionQuestion("forward", () => {
      setItemIndex(nextIndex);
      if (nextIndex >= TOTAL_ITEMS) {
        setStep("submitting");
        return;
      }
      ensureOptionOrder(SPEC_TEST_ITEMS_V3[nextIndex]);
      setStep(PHASE_STARTS.has(nextIndex) ? "phase-intro" : "question");
    });
  }

  function goBack() {
    if (itemIndex <= 0 || isTransitioning) return;
    const previousIndex = itemIndex - 1;
    transitionQuestion("backward", () => {
      setItemIndex(previousIndex);
      ensureOptionOrder(SPEC_TEST_ITEMS_V3[previousIndex]);
      setStep("question");
    });
  }

  function retrySubmit() {
    submittingRef.current = false;
    setError(null);
    setStep("submitting");
  }

  function restart() {
    clearDraft();
    submittingRef.current = false;
    setResponses({});
    setOptionOrders({});
    setItemIndex(0);
    setError(null);
    setLowSignalFlags([]);
    setMotionDirection("forward");
    setMotionPhase("entering");
    setStep("phase-intro");
  }

  if (step === "gender") {
    return (
      <div className="flex flex-col items-center gap-6 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-500">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Before we start</p>
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">What’s your gender?</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            We’ll use this to phrase the questions about the people you’re attracted to.
          </p>
        </div>
        <div className="flex w-full max-w-xs flex-col gap-3">
          {GENDER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => chooseGender(option.value)}
              data-testid={`spec-gender-${option.value}`}
              className="min-h-12 rounded-2xl border border-border bg-card px-4 py-3.5 text-sm font-semibold transition-colors hover:border-primary/60 hover:bg-accent-tint/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === "submitting") {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center" role="status">
        {error ? (
          <>
            <h1 className="font-heading text-2xl font-bold">Your answers are still here</h1>
            <p className="text-sm text-destructive">{error}</p>
            <Button size="lg" className="min-h-11 w-full max-w-xs" onClick={retrySubmit}>Try again</Button>
          </>
        ) : (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
            <h1 className="font-heading text-2xl font-bold">Finding your Spec…</h1>
            <p className="text-sm text-muted-foreground">Putting the full picture together.</p>
          </>
        )}
      </div>
    );
  }

  if (step === "low-signal") {
    return (
      <div className="flex flex-col items-center gap-5 py-6 text-center" role="alert">
        <h1 className="font-heading text-2xl font-bold">We need one more honest go</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Your answers didn’t give us a clear enough pattern. Take it again and trust your first reaction—we’d rather
          be honest than force the wrong result.
        </p>
        {lowSignalFlags.length > 0 && <span className="sr-only">{lowSignalFlags.join(", ")}</span>}
        <Button size="lg" className="min-h-11 w-full max-w-xs" onClick={restart} data-testid="spec-take-again">
          Take it again
        </Button>
      </div>
    );
  }

  if (step === "phase-intro") {
    const copy = PHASE_COPY[itemIndex] ?? PHASE_COPY[0];
    return (
      <div className="flex flex-col items-center gap-5 py-4 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-500">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{copy.eyebrow}</p>
        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">{copy.title}</h1>
          <p className="text-sm leading-6 text-muted-foreground">{copy.body}</p>
        </div>
        <Button size="lg" className="min-h-11 w-full max-w-xs gap-2" onClick={continueFromIntro} data-testid="spec-continue">
          Let’s go
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  if (!currentItem) return null;

  return (
    <div className="flex flex-col gap-7" data-testid="spec-question">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={goBack}
          disabled={itemIndex === 0 || isTransitioning}
          aria-label="Back to previous question"
          data-testid="spec-back"
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
          disabled={isTransitioning}
          data-testid="spec-skip"
          className="ml-auto min-h-11 px-2 text-xs font-medium text-muted-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
        >
          Skip
        </button>
      </div>

      <div
        key={currentItem.id}
        data-testid="spec-question-motion"
        data-motion-phase={motionPhase}
        data-motion-direction={motionDirection}
        className={cn(
          "flex flex-col gap-7 will-change-transform",
          motionPhase === "exiting"
            ? motionDirection === "forward"
              ? "motion-safe:animate-spec-question-exit-forward"
              : "motion-safe:animate-spec-question-exit-backward"
            : motionDirection === "forward"
              ? "motion-safe:animate-spec-question-enter-forward"
              : "motion-safe:animate-spec-question-enter-backward",
        )}
      >
        {currentItem.kind === "best_worst" && (
          <BestWorstQuestion
            item={currentItem}
            value={answer.kind === "best_worst" ? answer.selection : { bestOptionId: null, worstOptionId: null }}
            onChange={(selection) => {
              setAnswer({ kind: "best_worst", selection });
              setError(null);
            }}
            optionOrder={currentOrder}
            form={form}
            disabled={isTransitioning}
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
            form={form}
            disabled={isTransitioning}
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
            form={form}
            disabled={isTransitioning}
          />
        )}

        {error && <p className="text-sm font-medium text-destructive" role="alert">{error}</p>}
        <Button
          size="lg"
          className="min-h-11 w-full"
          onClick={() => commitCurrent(false)}
          disabled={isTransitioning}
          data-testid="spec-next"
        >
          {itemIndex === TOTAL_ITEMS - 1 ? "Show me my Spec" : "Next question"}
        </Button>
      </div>
    </div>
  );
}
