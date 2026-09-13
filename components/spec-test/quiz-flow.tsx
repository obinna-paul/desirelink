"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/ui/progress-ring";
import { SPEC_TEST_QUESTIONS, type SpecTestOptionKey } from "@/lib/spec-test/legacy-questions";
import { cn } from "@/lib/utils";

type Step = "age-gate" | "question" | "submitting";

// Long enough that the tap registers as a deliberate choice (not an instant cut), short
// enough that ten questions still feels brisk. See docs/spec-test-quiz.md's "~4 minutes"
// budget and the UI/UX pass that replaced the old instant-advance behavior.
const SELECT_HOLD_MS = 380;
const EXIT_MS = 200;

/**
 * Anonymous, single-page quiz wizard - age gate, then one scenario question at a time,
 * then a submit to the server (which does the actual scoring - see lib/spec-test.ts) and
 * a redirect to the shareable result page.
 *
 * Each answer button is keyed by `${question.id}-${optionKey}` (never just "A"/"B"/"C"/"D")
 * so React mounts a fresh DOM node per question instead of reusing the same four buttons
 * across the whole quiz - reusing them was why a tapped option's leftover browser focus
 * used to visually "stick" and look pre-selected on the next question.
 */
export function SpecTestQuizFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("age-gate");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, SpecTestOptionKey>>({});
  const [selectedOption, setSelectedOption] = useState<SpecTestOptionKey | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  const totalQuestions = SPEC_TEST_QUESTIONS.length;
  const currentQuestion = SPEC_TEST_QUESTIONS[questionIndex];

  // A failed submit only ever happens after the last question's selected/exiting state
  // was left in place (there's no "next question" transition to reset it there) - undo
  // that here so the question re-renders interactive instead of stuck mid-exit.
  function resetToRetry() {
    setStep("question");
    setSelectedOption(null);
    setIsExiting(false);
  }

  async function submitAnswers(finalAnswers: Record<string, SpecTestOptionKey>) {
    setStep("submitting");
    setError(null);
    try {
      const res = await fetch("/api/spec-test/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: finalAnswers }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Something went wrong scoring your answers. Please try again.");
        resetToRetry();
        return;
      }
      router.push(`/spec-test/result/${body.resultId}`);
    } catch {
      setError("Something went wrong scoring your answers. Please try again.");
      resetToRetry();
    }
  }

  function selectOption(option: SpecTestOptionKey, event: MouseEvent<HTMLButtonElement>) {
    if (selectedOption) return; // already mid-transition - ignore a fast double tap
    event.currentTarget.blur();

    const nextAnswers = { ...answers, [currentQuestion.id]: option };
    setAnswers(nextAnswers);
    setSelectedOption(option);

    const holdTimeout = setTimeout(() => {
      setIsExiting(true);

      const exitTimeout = setTimeout(() => {
        if (questionIndex + 1 < totalQuestions) {
          setQuestionIndex((index) => index + 1);
          setSelectedOption(null);
          setIsExiting(false);
        } else {
          void submitAnswers(nextAnswers);
        }
      }, EXIT_MS);
      timeoutsRef.current.push(exitTimeout);
    }, SELECT_HOLD_MS);
    timeoutsRef.current.push(holdTimeout);
  }

  if (step === "age-gate") {
    return (
      <div className="flex flex-col items-center gap-6 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-500">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-tint">
          <Sparkles className="h-8 w-8 text-primary" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">Before we start</h1>
          <p className="text-sm text-muted-foreground">
            The Spec Test asks about attraction and dating, so it&apos;s only for adults 18 and over.
            Your answers are used only to generate your result - not shared publicly or used for
            advertising unless you say so.
          </p>
        </div>
        <Button size="lg" onClick={() => setStep("question")} className="w-full max-w-xs">
          I&apos;m 18 or older - Start
        </Button>
      </div>
    );
  }

  if (step === "submitting") {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <p className="font-heading text-lg font-semibold">Reading your answers...</p>
        <p className="text-sm text-muted-foreground">Calculating your spec.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-3">
        <ProgressRing progress={(questionIndex / totalQuestions) * 100} size={40} className="shrink-0 text-primary" />
        <p className="text-xs font-medium text-muted-foreground">
          Question {questionIndex + 1} of {totalQuestions}
        </p>
      </div>

      <div
        key={currentQuestion.id}
        className={cn(
          "flex flex-col gap-6",
          isExiting
            ? "motion-safe:animate-out motion-safe:fade-out motion-safe:slide-out-to-top-2 motion-safe:duration-200"
            : "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300",
        )}
      >
        <h1 className="font-heading text-xl font-bold sm:text-2xl">{currentQuestion.prompt}</h1>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-col gap-3">
          {(Object.entries(currentQuestion.options) as [SpecTestOptionKey, string][]).map(([key, label], index) => {
            const isSelected = selectedOption === key;
            const isDimmed = selectedOption !== null && !isSelected;

            return (
              <button
                key={`${currentQuestion.id}-${key}`}
                type="button"
                disabled={selectedOption !== null}
                onClick={(event) => selectOption(key, event)}
                style={{ animationDelay: `${index * 45}ms` }}
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
                  {isSelected ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : key}
                </span>
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
