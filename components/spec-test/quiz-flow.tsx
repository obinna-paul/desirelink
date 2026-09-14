"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/ui/progress-ring";
import { SPEC_TEST_ITEMS_V2 } from "@/lib/spec-test/items/spec-v2";
import { INSTRUMENT_VERSION, type SectionKey } from "@/lib/spec-test/taxonomy";
import { routeForm, type Gender } from "@/lib/spec-test/gender/forms";
import { renderTerms } from "@/lib/spec-test/gender/render";
import type { RenderForm } from "@/lib/spec-test/gender/terms";
import type { SpecTestResponseV2 } from "@/lib/spec-test/response";
import { cn } from "@/lib/utils";

/**
 * Anonymous, single-page quiz wizard for the v2.1 instrument
 * (docs/spec-test-research.md, docs/spec-test-v2-implementation-plan.md Phase 3,
 * docs/spec-test-gender-implementation-plan.md Phase G4): a one-question gender step, three
 * sectioned batches of scenario items (each with a one-line intro, rendered for the chosen
 * gender's form), then a submit to the server (which does the actual scoring - see
 * lib/spec-test/scoring/) and a redirect to the shareable result page. A low-signal server
 * response (too fast, too straight-lined, or too many skips) surfaces an honest retake prompt
 * instead of a result.
 *
 * The gender step's scope notice and "doesn't affect your result" explainer were both removed
 * on direct request, in favor of just the bare question and its two options - kept minimal.
 *
 * There is no separate age-gate click-through screen: the "18+" badge is shown on every
 * Spec Test page (see AgeBadge), and the platform's actual binding age confirmation happens
 * at account signup (components/auth/auth-shell.tsx) - an anonymous quiz taker who never
 * signs up was never bound by that confirmation anyway, so a second click-through here was
 * redundant friction rather than a real additional safeguard. Removed on direct request.
 *
 * The two optional context questions from Phase 3 are removed per the gender plan's DG-2
 * (docs/spec-test-gender-report.md §Exec: "no relationship-status or relationship-intent
 * question").
 *
 * The submit route (app/api/spec-test/submit/route.ts) also still accepts the old v1
 * `{ answers }` shape as a compatibility safety net, but this component only ever sends the
 * v2 `{ instrumentVersion, gender, responses }` shape - see that route's file comment for why
 * the legacy branch is being kept rather than deleted outright.
 */

const SELECT_HOLD_MS = 380;
const EXIT_MS = 200;
const DRAFT_STORAGE_KEY = "spec-test-draft-v2";
const TOTAL_ITEMS = SPEC_TEST_ITEMS_V2.length;

const SECTION_ORDER: SectionKey[] = ["spark", "pattern", "partnership"];

const SECTION_INTRO_COPY: Record<SectionKey, { title: string; body: string }> = {
  spark: {
    title: "First, some snap reactions.",
    body: "Go with your gut here - there are no good answers, only revealing ones.",
  },
  pattern: {
    title: "Now, how you actually behave.",
    body: "Once someone's caught your interest, what do you actually do about it?",
  },
  partnership: {
    title: "Last stretch.",
    body: "What do you actually need for it to last, once the spark isn't doing all the work?",
  },
};

/** Shown as "Woman"/"Man" (matching the platform's own profile vocabulary - plan §8 DG-5)
 *  while the stored/submitted value stays "female"/"male" (matching the report's data model). */
const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "female", label: "Woman" },
  { value: "male", label: "Man" },
];

type Step = "gender" | "section-intro" | "question" | "submitting" | "low-signal";

type DraftShape = {
  instrumentVersion: string;
  gender: Gender | null;
  itemIndex: number;
  responses: Record<string, SpecTestResponseV2>;
  optionOrders: Record<string, number[]>;
};

function emptyDraft(): DraftShape {
  return {
    instrumentVersion: INSTRUMENT_VERSION,
    gender: null,
    itemIndex: 0,
    responses: {},
    optionOrders: {},
  };
}

function loadDraft(): DraftShape {
  if (typeof window === "undefined") return emptyDraft();
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return emptyDraft();
    const parsed = JSON.parse(raw) as DraftShape;
    if (parsed.instrumentVersion !== INSTRUMENT_VERSION) return emptyDraft();
    return parsed;
  } catch {
    return emptyDraft();
  }
}

function saveDraft(draft: DraftShape) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // best-effort only - a private window or full storage should never block the quiz
  }
}

function clearDraft() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Fisher-Yates over the four canonical option positions, so which option lands where on
 *  screen varies per taker (report §5: "Randomize answer order when technically feasible,
 *  while preserving analytics") - the submitted optionId always identifies the option
 *  itself, never its on-screen position. */
function shuffledCanonicalIndexes(): number[] {
  const indexes = [0, 1, 2, 3];
  for (let i = indexes.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
  }
  return indexes;
}

function computeInitialStep(draft: DraftShape): Step {
  if (!draft.gender) return "gender";
  if (draft.itemIndex >= TOTAL_ITEMS) return "submitting";
  if (draft.itemIndex === 0 && Object.keys(draft.responses).length === 0) return "section-intro";
  return "question";
}

export function SpecTestQuizFlow() {
  const router = useRouter();
  const initialDraftRef = useRef<DraftShape | null>(null);
  if (initialDraftRef.current === null) initialDraftRef.current = loadDraft();
  const initialDraft = initialDraftRef.current;

  const [step, setStep] = useState<Step>(() => computeInitialStep(initialDraft));
  const [gender, setGender] = useState<Gender | null>(initialDraft.gender);
  const [itemIndex, setItemIndex] = useState(initialDraft.itemIndex);
  const [responses, setResponses] = useState<Record<string, SpecTestResponseV2>>(initialDraft.responses);
  const [optionOrders, setOptionOrders] = useState<Record<string, number[]>>(() => {
    const base = { ...initialDraft.optionOrders };
    const startItem = SPEC_TEST_ITEMS_V2[Math.min(initialDraft.itemIndex, TOTAL_ITEMS - 1)];
    if (startItem && !base[startItem.id]) base[startItem.id] = shuffledCanonicalIndexes();
    return base;
  });
  const [shownSectionIntros, setShownSectionIntros] = useState<Set<SectionKey>>(() => {
    if (initialDraft.itemIndex <= 0) return new Set();
    const shown = new Set<SectionKey>();
    for (let i = 0; i <= Math.min(initialDraft.itemIndex, TOTAL_ITEMS - 1); i += 1) {
      shown.add(SPEC_TEST_ITEMS_V2[i].section);
    }
    return shown;
  });
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  // Separate from selectedOptionId on purpose: selectedOptionId also gets pre-filled with an
  // item's existing answer when goToItem navigates back to it (so the prior pick still shows
  // highlighted), but that must never disable the controls the way an actual in-flight
  // selection does - isLocked is the real "ignore clicks, we're mid-transition" flag.
  const [isLocked, setIsLocked] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lowSignalFlags, setLowSignalFlags] = useState<string[]>([]);

  const itemStartRef = useRef<number>(Date.now());
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => timeoutsRef.current.forEach(clearTimeout);
  }, []);

  // Fires the submit whenever the wizard steps into "submitting" - both a draft resumed
  // mid-submit (every item answered, but the request never completed - e.g. the tab closed
  // right after the last answer) and the normal last-item-answered transition out of
  // goToItem. Doing it here rather than calling submit() directly from goToItem matters: that
  // call runs inside a setTimeout closure scheduled before the last answer's setResponses
  // update commits, so it would submit a stale responses map missing the final answer. An
  // effect keyed on `step` instead runs after the commit, on the render that already has it.
  useEffect(() => {
    if (step === "submitting" && !error) void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Persist a draft on every meaningful change so a reload mid-quiz resumes without losing
  // answers or re-asking gender (plan §8 acceptance criteria) - not written while submitting/
  // low-signal, since those are terminal-ish states the draft shouldn't try to restore into.
  useEffect(() => {
    if (step === "submitting" || step === "low-signal") return;
    saveDraft({
      instrumentVersion: INSTRUMENT_VERSION,
      gender,
      itemIndex,
      responses,
      optionOrders,
    });
  }, [step, gender, itemIndex, responses, optionOrders]);

  const currentItem = SPEC_TEST_ITEMS_V2[itemIndex];
  // The router of who's described in item text (report §3/§9) - gender only ever changes
  // this rendering form, never the score. "neutral" only appears here defensively; the
  // gender step always runs before any item, so a real taker never sees it.
  const form: RenderForm = gender ? routeForm(gender).quizForm : "neutral";

  function chooseGender(value: Gender) {
    setGender(value);
    goToItem(0);
  }

  function goToItem(index: number, opts: { skipIntroCheck?: boolean } = {}) {
    if (index >= TOTAL_ITEMS) {
      setItemIndex(index);
      setStep("submitting");
      return;
    }
    const item = SPEC_TEST_ITEMS_V2[index];
    setOptionOrders((prev) => (prev[item.id] ? prev : { ...prev, [item.id]: shuffledCanonicalIndexes() }));
    setItemIndex(index);
    setSelectedOptionId(responses[item.id]?.optionId ?? null);
    setIsLocked(false);
    setIsExiting(false);

    const needsIntro = !opts.skipIntroCheck && !shownSectionIntros.has(item.section);
    if (needsIntro) {
      setStep("section-intro");
    } else {
      itemStartRef.current = Date.now();
      setStep("question");
    }
  }

  function continueFromIntro() {
    if (!currentItem) return;
    setShownSectionIntros((prev) => new Set(prev).add(currentItem.section));
    itemStartRef.current = Date.now();
    setStep("question");
  }

  function recordAnswer(optionId: string | null, presentedIndex: number | null, skipped: boolean) {
    if (!currentItem) return;
    const elapsedMs = Date.now() - itemStartRef.current;
    const response: SpecTestResponseV2 = {
      itemId: currentItem.id,
      optionId,
      presentedIndex,
      elapsedMs,
      skipped: skipped || undefined,
    };
    setResponses((prev) => ({ ...prev, [currentItem.id]: response }));
  }

  function selectOption(optionId: string, presentedIndex: number, event: MouseEvent<HTMLButtonElement>) {
    if (isLocked) return; // already mid-transition - ignore a fast double tap
    event.currentTarget.blur();

    setSelectedOptionId(optionId);
    setIsLocked(true);
    recordAnswer(optionId, presentedIndex, false);

    const holdTimeout = setTimeout(() => {
      setIsExiting(true);
      const exitTimeout = setTimeout(() => goToItem(itemIndex + 1), EXIT_MS);
      timeoutsRef.current.push(exitTimeout);
    }, SELECT_HOLD_MS);
    timeoutsRef.current.push(holdTimeout);
  }

  function skipItem() {
    if (isLocked) return;
    recordAnswer(null, null, true);
    goToItem(itemIndex + 1);
  }

  function goBack() {
    if (isLocked || itemIndex === 0) return;
    goToItem(itemIndex - 1, { skipIntroCheck: true });
  }

  function restart() {
    clearDraft();
    setResponses({});
    setOptionOrders({});
    setShownSectionIntros(new Set());
    setError(null);
    setSelectedOptionId(null);
    setIsLocked(false);
    setItemIndex(0);
    // Gender is kept, not re-asked - a low-signal retake is about the answers, not the form.
    setStep("section-intro");
  }

  async function submit() {
    setStep("submitting");
    setError(null);

    const orderedResponses: SpecTestResponseV2[] = SPEC_TEST_ITEMS_V2.map(
      (item) => responses[item.id] ?? { itemId: item.id, optionId: null, presentedIndex: null, elapsedMs: 0, skipped: true },
    );

    try {
      const res = await fetch("/api/spec-test/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instrumentVersion: INSTRUMENT_VERSION,
          gender,
          responses: orderedResponses,
        }),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setError(body?.error ?? "Something went wrong scoring your answers. Please try again.");
        return;
      }
      if (body?.lowSignal) {
        setLowSignalFlags(Array.isArray(body.flags) ? body.flags : []);
        clearDraft();
        setStep("low-signal");
        return;
      }

      clearDraft();
      router.push(`/spec-test/result/${body.resultId}`);
    } catch {
      setError("Something went wrong scoring your answers. Please try again.");
    }
  }

  if (step === "gender") {
    return (
      <div className="flex flex-col items-center gap-6 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-500">
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">What&apos;s your gender?</h1>
        <div className="flex w-full max-w-xs flex-col gap-3">
          {GENDER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => chooseGender(option.value)}
              data-testid={`spec-gender-${option.value}`}
              className="rounded-2xl border border-border bg-card px-4 py-3.5 text-sm font-semibold transition-colors hover:border-primary/60 hover:bg-accent-tint/70"
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
      <div className="flex flex-col items-center gap-4 py-12 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
        {error ? (
          <>
            <p className="text-sm text-destructive">{error}</p>
            <Button onClick={() => void submit()}>Try again</Button>
          </>
        ) : (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
            <p className="font-heading text-lg font-semibold">Reading your answers...</p>
            <p className="text-sm text-muted-foreground">Calculating your spec.</p>
          </>
        )}
      </div>
    );
  }

  if (step === "low-signal") {
    return (
      <div className="flex flex-col items-center gap-4 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
        <h1 className="font-heading text-xl font-bold">We couldn&apos;t get a clear read</h1>
        <p className="text-sm text-muted-foreground">
          A few answers came back too fast, too uniform, or too inconsistent to score honestly.
          Rather than guess, we&apos;d rather you try again when you&apos;ve got a few uninterrupted
          minutes.
        </p>
        {lowSignalFlags.length > 0 && (
          <p className="text-xs text-muted-foreground/70">({lowSignalFlags.join(", ")})</p>
        )}
        <Button size="lg" onClick={restart} className="w-full max-w-xs" data-testid="spec-take-again">
          Take it again
        </Button>
      </div>
    );
  }

  if (step === "section-intro") {
    if (!currentItem) return null;
    const copy = SECTION_INTRO_COPY[currentItem.section];
    const sectionNumber = SECTION_ORDER.indexOf(currentItem.section) + 1;
    return (
      <div className="flex flex-col items-center gap-5 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-500">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Section {sectionNumber} of {SECTION_ORDER.length}
        </p>
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.body}</p>
        <Button size="lg" onClick={continueFromIntro} className="w-full max-w-xs" data-testid="spec-continue">
          Continue
        </Button>
      </div>
    );
  }

  // step === "question"
  if (!currentItem) return null;
  const order = optionOrders[currentItem.id] ?? [0, 1, 2, 3];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-3">
        {itemIndex > 0 && (
          <button
            type="button"
            onClick={goBack}
            disabled={isLocked}
            aria-label="Back to previous question"
            data-testid="spec-back"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent-tint hover:text-foreground disabled:opacity-40"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
        <ProgressRing progress={(itemIndex / TOTAL_ITEMS) * 100} size={40} className="shrink-0 text-primary" />
        <p className="text-xs font-medium text-muted-foreground">
          Question {itemIndex + 1} of {TOTAL_ITEMS}
        </p>
        <button
          type="button"
          onClick={skipItem}
          disabled={isLocked}
          data-testid="spec-skip"
          className="ml-auto text-xs font-medium text-muted-foreground underline underline-offset-4 disabled:opacity-40"
        >
          Skip
        </button>
      </div>

      <div
        key={currentItem.id}
        className={cn(
          "flex flex-col gap-6",
          isExiting
            ? "motion-safe:animate-out motion-safe:fade-out motion-safe:slide-out-to-top-2 motion-safe:duration-200"
            : "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300",
        )}
      >
        <h1 className="font-heading text-xl font-bold sm:text-2xl">{renderTerms(currentItem.prompt, form)}</h1>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-col gap-3">
          {order.map((canonicalIndex, presentedIndex) => {
            const option = currentItem.options[canonicalIndex];
            const isSelected = selectedOptionId === option.id;
            const isDimmed = selectedOptionId !== null && !isSelected;

            return (
              <button
                key={option.id}
                type="button"
                disabled={isLocked}
                onClick={(event) => selectOption(option.id, presentedIndex, event)}
                style={{ animationDelay: `${presentedIndex * 45}ms` }}
                data-testid="spec-option"
                className={cn(
                  "flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm font-medium",
                  "transition-[border-color,background-color,opacity,transform] duration-200 ease-out active:scale-[0.98]",
                  "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both",
                  isSelected
                    ? "border-primary bg-accent-tint"
                    : "border-border bg-card hover:border-primary/60 hover:bg-accent-tint/70",
                  isDimmed && "opacity-40",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors duration-200",
                    isSelected ? "bg-primary text-primary-foreground" : "bg-accent-tint text-primary",
                  )}
                >
                  {isSelected ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : presentedIndex + 1}
                </span>
                {renderTerms(option.label, form)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
